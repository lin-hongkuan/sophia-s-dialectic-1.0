import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTopic, appendThoughtVoice, createPartialResult, generateQuestionSuggestions, regenerateThoughtVoice } from './services/sophiaService';
import { ActiveAnalysisRun, AnalysisResult, ContinuationContext, GenerationLogEntry, HistoryEntry, ThoughtVoice, TokenUsage } from './types';
import Arena from './components/Arena';
import ReasoningDisplay from './components/ReasoningDisplay';
import RoundtableScene from './components/RoundtableScene';
import DynamicBackground from './components/DynamicBackground';
import HistoryPage from './components/HistoryPage';
import ManifestoPage from './components/ManifestoPage';
import SettingsPage from './components/SettingsPage';
import ConceptDetailPage from './components/ConceptDetailPage';
import ActiveRunBanner from './components/ActiveRunBanner';
import AnnouncementModal from './components/AnnouncementModal';
import { HangingLabel } from './components/PageHero';
import { PRELOADED_HISTORY_ENTRY } from './data/preloadedHistory';
import { ANNOUNCEMENT } from './data/announcement';
import { Info, ArrowRight, Sparkles, Megaphone } from 'lucide-react';
import { validateUserPrompt } from './utils/inputValidation';
import { recordUsage as recordTokenUsage } from './services/tokenAccounting';
import { reframeUserTopic, type ReframeCandidate } from './services/topicReframe';
import {
  buildAvatarKey,
  deleteAvatarImages,
  getAvatarImages,
  putAvatarImage,
} from './services/imageStore';
import TopicReframeDialog from './components/TopicReframeDialog';

type View = 'home' | 'history' | 'manifesto' | 'settings' | 'result' | 'concept';
type SelectedSource = 'active' | 'history' | null;
type AppRoute = '/' | '/history' | '/history/sample' | '/manifesto' | '/settings' | `/history/${string}` | `/concept/${string}/${string}`;

const HISTORY_KEY = 'sophia.history.v1';
const ANNOUNCEMENT_DISMISSED_KEY = 'sophia.announcement.dismissed.v1';
const HISTORY_LIMIT = 10;
const HISTORY_EXPORT_VERSION = 1;
const PRESET_HISTORY_KEY = 'sophia.preset.generated.feminism.v1';
const PRESET_TOPIC = '女性主义有道理吗？';
const DEFAULT_QUESTION_SUGGESTIONS = ['女性主义有道理吗？', '如何克服虚无主义？', '如何证明你不是缸中之脑？', '我们应该生孩子吗？', '为什么有性别不止有两个？'];
const API_CONFIGURED = process.env.SOPHIA_API_CONFIGURED === 'true';
const ROUTES: Record<string, AppRoute> = {
  '/': '/',
  '/history': '/history',
  '/history/': '/history',
  '/history/sample': '/history/sample',
  '/history/sample/': '/history/sample',
  '/manifesto': '/manifesto',
  '/manifesto/': '/manifesto',
  '/settings': '/settings',
  '/settings/': '/settings',
};

const makeRunId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix = uuid ? uuid.replace(/-/g, '').slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `run-${Date.now()}-${suffix}`;
};

const normalizeRoute = (pathname: string): AppRoute => {
  if (ROUTES[pathname]) return ROUTES[pathname];
  if (/^\/concept\/[^/]+\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '') as AppRoute;
  if (/^\/history\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '') as AppRoute;
  return '/';
};

const pushRoute = (route: AppRoute) => {
  if (window.location.pathname !== route) {
    window.history.pushState(null, '', route);
  }
};

const historyItemRoute = (entry: HistoryEntry): AppRoute => {
  if (entry.isPreset || entry.generatedByChain) return '/history/sample';
  return `/history/${encodeURIComponent(entry.id)}`;
};

const routeHistoryId = (route: AppRoute) => route.startsWith('/history/') ? decodeURIComponent(route.slice('/history/'.length)) : '';

const parseConceptRoute = (route: AppRoute): { analysisId: string; keywordId: string } | null => {
  if (!route.startsWith('/concept/')) return null;
  const [analysisRaw, keywordRaw] = route.slice('/concept/'.length).split('/');
  if (!analysisRaw || !keywordRaw) return null;
  return { analysisId: decodeURIComponent(analysisRaw), keywordId: decodeURIComponent(keywordRaw) };
};

const conceptRoute = (analysisId: string, keywordId: string): AppRoute =>
  `/concept/${encodeURIComponent(analysisId)}/${encodeURIComponent(keywordId)}` as AppRoute;

const loadHistory = (): HistoryEntry[] => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const loadGeneratedPreset = (): HistoryEntry | null => {
  try {
    const raw = localStorage.getItem(PRESET_HISTORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.result ? parsed : null;
  } catch {
    return null;
  }
};

const isQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22;
  }
  const name = (error as { name?: string })?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
};

const stripAvatarImage = (entry: HistoryEntry): HistoryEntry => ({
  ...entry,
  result: {
    ...entry.result,
    voices: entry.result.voices.map((voice) =>
      voice.avatar?.imageUrl ? { ...voice, avatar: { ...voice.avatar, imageUrl: '' } } : voice,
    ),
  },
});

/**
 * Split an entry into its lean form (suitable for localStorage) plus the list
 * of (key, imageUrl) pairs that should land in IndexedDB. Voice ids are
 * scoped per-analysis, so we namespace by entry id.
 */
const splitAvatarsForStorage = (
  entry: HistoryEntry,
): { lean: HistoryEntry; images: Array<{ key: string; imageUrl: string }> } => {
  const images: Array<{ key: string; imageUrl: string }> = [];
  const lean: HistoryEntry = {
    ...entry,
    result: {
      ...entry.result,
      voices: entry.result.voices.map((voice) => {
        if (!voice.avatar?.imageUrl) return voice;
        const url = voice.avatar.imageUrl;
        // Bundled preset avatars are imported as small Vite asset URLs (e.g.
        // `/assets/01-...png`); leave those inline so the preloaded preset
        // works without IDB. Only base64 data: URLs are the storage hog.
        if (!url.startsWith('data:')) return voice;
        images.push({ key: buildAvatarKey(entry.id, voice.id), imageUrl: url });
        return { ...voice, avatar: { ...voice.avatar, imageUrl: '' } };
      }),
    },
  };
  return { lean, images };
};

const mergeAvatarsFromStore = (
  entry: HistoryEntry,
  imageMap: Record<string, string>,
): HistoryEntry => ({
  ...entry,
  result: {
    ...entry.result,
    voices: entry.result.voices.map((voice) => {
      if (!voice.avatar) return voice;
      if (voice.avatar.imageUrl) return voice; // already has a url (bundled preset)
      const url = imageMap[buildAvatarKey(entry.id, voice.id)];
      if (!url) return voice;
      return { ...voice, avatar: { ...voice.avatar, imageUrl: url } };
    }),
  },
});

const collectAvatarKeys = (entry: HistoryEntry): string[] =>
  entry.result.voices
    .filter((voice) => !!voice.avatar)
    .map((voice) => buildAvatarKey(entry.id, voice.id));

const persistEntryAvatars = async (entry: HistoryEntry): Promise<void> => {
  const { images } = splitAvatarsForStorage(entry);
  if (images.length === 0) return;
  await Promise.all(images.map(({ key, imageUrl }) => putAvatarImage(key, imageUrl)));
};

const hydrateEntriesWithAvatars = async (entries: HistoryEntry[]): Promise<HistoryEntry[]> => {
  if (entries.length === 0) return entries;
  const keys: string[] = [];
  entries.forEach((entry) => {
    entry.result.voices.forEach((voice) => {
      if (voice.avatar && !voice.avatar.imageUrl) {
        keys.push(buildAvatarKey(entry.id, voice.id));
      }
    });
  });
  if (keys.length === 0) return entries;
  const imageMap = await getAvatarImages(keys);
  if (Object.keys(imageMap).length === 0) return entries;
  return entries.map((entry) => mergeAvatarsFromStore(entry, imageMap));
};

/**
 * Best-effort write to localStorage. Avatar imageUrls now live in IndexedDB —
 * we always write the LEAN form here. The legacy quota cascade stays as a
 * paranoid backstop for the rare case where even avatar-stripped metadata
 * exceeds 5MB. Returns the entries kept in storage; caller mirrors that into
 * in-memory state so reload-after-shed doesn't reveal a different list.
 */
const saveHistory = (entries: HistoryEntry[]): HistoryEntry[] => {
  const trimmed = entries.slice(0, HISTORY_LIMIT);
  const tryWriteLean = (candidate: HistoryEntry[]): boolean => {
    const lean = candidate.map((entry) => splitAvatarsForStorage(entry).lean);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(lean));
      return true;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      return false;
    }
  };

  if (tryWriteLean(trimmed)) return trimmed;

  // Even with avatars out, metadata could in theory exceed 5MB — drop oldest.
  let candidate = trimmed;
  while (candidate.length > 0) {
    candidate = candidate.slice(0, -1);
    if (candidate.length === 0) break;
    if (tryWriteLean(candidate)) {
      console.warn(`[sophia] history metadata too large; kept ${candidate.length} most recent entries.`);
      return candidate;
    }
  }

  try { localStorage.removeItem(HISTORY_KEY); } catch { /* ignore */ }
  console.warn('[sophia] localStorage exhausted — history not persisted; in-memory only.');
  return [];
};

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  const item = value as Partial<HistoryEntry> | null;
  const result = item?.result as Partial<AnalysisResult> | undefined;
  return !!item
    && typeof item.id === 'string'
    && typeof item.topic === 'string'
    && typeof item.title === 'string'
    && typeof item.createdAt === 'string'
    && !!result
    && typeof result.id === 'string'
    && typeof result.topic === 'string'
    && typeof result.philosophical_title === 'string'
    && Array.isArray(result.voices)
    && Array.isArray(result.tensions)
    && Array.isArray(result.followUps);
};

const extractImportedHistory = (value: unknown): HistoryEntry[] => {
  if (Array.isArray(value)) return value.filter(isHistoryEntry);
  const maybeEntries = (value as { entries?: unknown })?.entries;
  if (Array.isArray(maybeEntries)) return maybeEntries.filter(isHistoryEntry);
  return [];
};

const buildHistoryBackupFilename = () => `sophia-history-${new Date().toISOString().slice(0, 10)}.json`;

const downloadJsonFile = (filename: string, data: unknown) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

interface AppErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Sophia] render error boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-red-100 rounded-xl p-8 text-center shadow-sm">
          <h2 className="font-serif text-3xl text-museum-900 mb-3">页面渲染遇到了问题</h2>
          <p className="text-museum-600 leading-relaxed mb-6">这次不会再白屏。请刷新页面后继续使用，如果刚才正在生成，完成结果会在 History 里保留。</p>
          <button onClick={() => window.location.reload()} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
            刷新页面
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

interface VoiceStreamThrottle {
  schedule: (voiceId: string, fullText: string) => void;
  flush: (voiceId: string) => void;
  clearOne: (voiceId: string) => void;
  clearAll: () => void;
}

// Coalesces streaming voice deltas to a 120ms cadence so React doesn't re-render on every chunk.
const createVoiceStreamThrottle = (
  applyVoiceText: (voiceId: string, fullText: string) => void,
): VoiceStreamThrottle => {
  const pending = new Map<string, string>();
  const timers = new Map<string, number>();

  const clearOne = (voiceId: string) => {
    const timer = timers.get(voiceId);
    if (timer) window.clearTimeout(timer);
    timers.delete(voiceId);
    pending.delete(voiceId);
  };

  const flush = (voiceId: string) => {
    const fullText = pending.get(voiceId);
    clearOne(voiceId);
    if (fullText !== undefined) applyVoiceText(voiceId, fullText);
  };

  const schedule = (voiceId: string, fullText: string) => {
    pending.set(voiceId, fullText);
    if (timers.has(voiceId)) return;
    const timer = window.setTimeout(() => flush(voiceId), 120);
    timers.set(voiceId, timer);
  };

  const clearAll = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    pending.clear();
  };

  return { schedule, flush, clearOne, clearAll };
};

/**
 * One-shot migration on first load after the IDB upgrade lands. Detects legacy
 * inline base64 avatars in localStorage, lifts them into IndexedDB, and rewrites
 * localStorage as the lean form. Idempotent — sentinel flag prevents re-runs.
 */
const IDB_MIGRATION_FLAG = 'sophia.idb.migrated.v1';

const maybeMigrateLegacyAvatars = async (): Promise<void> => {
  if (typeof localStorage === 'undefined') return;
  try {
    if (localStorage.getItem(IDB_MIGRATION_FLAG) === '1') return;
  } catch {
    return;
  }
  const entries = loadHistory();
  const preset = loadGeneratedPreset();
  const all = preset ? [preset, ...entries] : entries;
  const hasInline = all.some((entry) =>
    entry.result.voices.some((voice) => voice.avatar?.imageUrl?.startsWith('data:')),
  );
  if (hasInline) {
    await Promise.all(all.map(persistEntryAvatars));
    saveHistory(entries); // already strips for storage internally
    if (preset) {
      try {
        const { lean } = splitAvatarsForStorage(preset);
        localStorage.setItem(PRESET_HISTORY_KEY, JSON.stringify(lean));
      } catch {
        // leave as-is; migration will retry next load
      }
    }
    console.info('[sophia] migrated inline avatars to IndexedDB');
  }
  try { localStorage.setItem(IDB_MIGRATION_FLAG, '1'); } catch { /* ignore */ }
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [topicHint, setTopicHint] = useState<{ message: string; suggestions?: string[] } | null>(null);
  const [view, setView] = useState<View>('home');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveAnalysisRun | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presetEntry, setPresetEntry] = useState<HistoryEntry>(PRELOADED_HISTORY_ENTRY);
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>(DEFAULT_QUESTION_SUGGESTIONS);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [isAppendingVoice, setIsAppendingVoice] = useState(false);
  const [retryingVoiceId, setRetryingVoiceId] = useState<string | null>(null);
  const [reframeState, setReframeState] = useState<{
    open: boolean;
    originalTopic: string;
    candidates: ReframeCandidate[];
    continuationContext?: ContinuationContext;
  } | null>(null);
  const [isReframing, setIsReframing] = useState(false);
  // Announcement visibility is its own piece of state so the nav "Notice"
  // button can re-open the modal even after the user dismissed it. The first
  // mount seeds it from localStorage (auto-show only when the visitor hasn't
  // already dismissed THIS announcement id).
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [conceptTarget, setConceptTarget] = useState<{ analysisId: string; keywordId: string } | null>(null);
  const conceptBackRouteRef = useRef<AppRoute>('/');
  const activeRunIdRef = useRef<string | null>(null);
  const lastRunContextRef = useRef<{ topic: string; continuationContext?: ContinuationContext; isPresetRegeneration?: boolean } | null>(null);

  const openRoute = (route: AppRoute, replace = false) => {
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;

    if (replace) {
      window.history.replaceState(null, '', route);
    } else {
      pushRoute(route);
    }

    if (route === '/history/sample') {
      setPresetEntry(nextPresetEntry);
      setSelectedHistoryResult(nextPresetEntry.result);
      setTopic(nextPresetEntry.topic);
      setSelectedSource('history');
      setView('result');
      void hydrateEntriesWithAvatars([nextPresetEntry]).then(([hydratedPreset]) => {
        if (hydratedPreset === nextPresetEntry) return;
        setPresetEntry(hydratedPreset);
        setSelectedHistoryResult(hydratedPreset.result);
      });
      return;
    }

    const conceptTargetFromRoute = parseConceptRoute(route);
    if (conceptTargetFromRoute) {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setConceptTarget(conceptTargetFromRoute);
      setView('concept');
      return;
    }

    const historyId = routeHistoryId(route);
    if (historyId && historyId !== 'sample') {
      const storedHistory = loadHistory();
      const historyEntry = storedHistory.find((entry) => entry.id === historyId);
      if (historyEntry) {
        setHistoryEntries(storedHistory);
        setSelectedHistoryResult(historyEntry.result);
        setTopic(historyEntry.topic);
        setSelectedSource('history');
        setView('result');
        void hydrateEntriesWithAvatars(storedHistory).then((hydrated) => {
          if (hydrated === storedHistory) return;
          setHistoryEntries(hydrated);
          const refreshed = hydrated.find((entry) => entry.id === historyId);
          if (refreshed) setSelectedHistoryResult(refreshed.result);
        });
        return;
      }
      window.history.replaceState(null, '', '/history');
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('history');
      return;
    }

    if (route === '/history') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('history');
      return;
    }

    if (route === '/manifesto') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('manifesto');
      return;
    }

    if (route === '/settings') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('settings');
      return;
    }

    setSelectedSource(null);
    setSelectedHistoryResult(null);
    setView('home');
  };

  useEffect(() => {
    // Hide the pre-React boot splash and cancel its slow-network timer.
    const splash = document.getElementById('boot-splash');
    if (splash) splash.remove();
    const w = window as Window & { __bootSlowTimer?: ReturnType<typeof setTimeout> };
    if (w.__bootSlowTimer) {
      clearTimeout(w.__bootSlowTimer);
      w.__bootSlowTimer = undefined;
    }

    setHistoryEntries(loadHistory());
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;
    setPresetEntry(nextPresetEntry);
    openRoute(normalizeRoute(window.location.pathname), true);

    try {
      const dismissedId = localStorage.getItem(ANNOUNCEMENT_DISMISSED_KEY);
      if (ANNOUNCEMENT.enabled && dismissedId !== ANNOUNCEMENT.id) {
        setAnnouncementOpen(true);
      }
    } catch {
      /* ignore */
    }

    // Async: lift any legacy inline avatars into IDB, then hydrate the lean
    // entries we just loaded with their imageUrls. The initial render is fine
    // without imageUrls — ThoughtVoiceCard already handles the fallback path.
    void (async () => {
      await maybeMigrateLegacyAvatars();
      const stored = loadHistory();
      const hydrated = await hydrateEntriesWithAvatars(stored);
      if (hydrated !== stored) setHistoryEntries(hydrated);
      const presetStored = loadGeneratedPreset();
      if (presetStored) {
        const [hydratedPreset] = await hydrateEntriesWithAvatars([presetStored]);
        if (hydratedPreset !== presetStored) setPresetEntry(hydratedPreset);
      }
    })();

    const handlePopState = () => openRoute(normalizeRoute(window.location.pathname), true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeRunIsRunning = activeRun?.status === 'starting' || activeRun?.status === 'running';
  const allHistoryEntries = useMemo(() => [presetEntry, ...historyEntries], [presetEntry, historyEntries]);
  const displayedResult = selectedSource === 'active' ? activeRun?.result || null : selectedHistoryResult;
  const displayedProgress = selectedSource === 'active' ? activeRun?.progress || null : null;
  const displayedError = selectedSource === 'active' ? activeRun?.error || null : null;
  const showHome = view === 'home';
  const showHistory = view === 'history';
  const showManifesto = view === 'manifesto';
  const showSettings = view === 'settings';
  const showResult = view === 'result';
  const showConcept = view === 'concept';
  const isViewingActiveRun = showResult && selectedSource === 'active';
  const showActiveBanner = showHome && !!activeRun && !isViewingActiveRun;
  // Hide the announcement modal whenever the reframe modal is open so the
  // two never stack on top of each other.
  const showAnnouncement = announcementOpen && !reframeState?.open;

  const openAnnouncement = () => setAnnouncementOpen(true);

  const handleDismissAnnouncement = () => {
    try {
      localStorage.setItem(ANNOUNCEMENT_DISMISSED_KEY, ANNOUNCEMENT.id);
    } catch {
      /* ignore */
    }
    setAnnouncementOpen(false);
  };

  const persistResult = (nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: nextResult.id,
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
    };
    void persistEntryAvatars(entry);
    setHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].slice(0, HISTORY_LIMIT);
      const saved = saveHistory(next);
      // GC IDB rows for entries that fell off the tail.
      const keptIds = new Set(saved.map((e) => e.id));
      const droppedKeys: string[] = [];
      next.forEach((e) => {
        if (!keptIds.has(e.id)) droppedKeys.push(...collectAvatarKeys(e));
      });
      if (droppedKeys.length > 0) void deleteAvatarImages(droppedKeys);
      return saved.length > 0 ? saved : next;
    });
  };

  const persistGeneratedPreset = (nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: 'preset-generated-feminism',
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
      isPreset: true,
      generatedByChain: true,
    };
    void persistEntryAvatars(entry);
    const { lean } = splitAvatarsForStorage(entry);
    try {
      localStorage.setItem(PRESET_HISTORY_KEY, JSON.stringify(lean));
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      console.warn('[sophia] preset cache quota exhausted — preset not persisted.');
    }
    setPresetEntry(entry);
  };

  /**
   * Locate an analysis result by id across the four places it might live:
   * the in-flight active run, the user's history list, the regenerated
   * preset (if any), and the bundled preloaded sample.
   */
  const findAnalysisResultById = (analysisId: string): AnalysisResult | null => {
    if (activeRun?.result?.id === analysisId) return activeRun.result;
    if (presetEntry.result.id === analysisId) return presetEntry.result;
    const fromHistory = historyEntries.find((entry) => entry.id === analysisId);
    if (fromHistory) return fromHistory.result;
    if (PRELOADED_HISTORY_ENTRY.result.id === analysisId) return PRELOADED_HISTORY_ENTRY.result;
    return null;
  };

  /**
   * Persist a result whose keywords have just been enriched. Routes to the
   * matching persistence path (active run state, preset cache, or normal
   * history). The bundled preloaded sample is read-only at runtime, so an
   * enrichment against it stays in-memory only.
   */
  const handleKeywordEnriched = (updatedResult: AnalysisResult) => {
    const analysisId = updatedResult.id;
    if (activeRun?.result?.id === analysisId) {
      setActiveRun((current) => current?.result ? { ...current, result: updatedResult } : current);
    }
    if (presetEntry.result.id === analysisId) {
      persistGeneratedPreset(updatedResult);
      return;
    }
    if (historyEntries.some((entry) => entry.id === analysisId)) {
      persistResult(updatedResult);
      return;
    }
    // Otherwise (e.g. preloaded sample), no persistence — page state already updated.
  };

  const openActiveRun = () => {
    if (!activeRun) return;
    setSelectedSource('active');
    setSelectedHistoryResult(null);
    setView('result');
  };

  const goHome = () => openRoute('/');
  const goHistory = () => openRoute('/history');
  const goManifesto = () => openRoute('/manifesto');
  const goSettings = () => openRoute('/settings');

  /**
   * Open the concept detail page for one keyword inside an analysis.
   *
   * `fromRoute` is the route the user came from; we keep it in a ref so the
   * "回到分析" button can return them to the same analysis page they clicked
   * "查看完整概念" on (active run, normal history entry, or preloaded sample).
   */
  const goToConcept = (analysisId: string, keywordId: string, fromRoute?: AppRoute) => {
    if (fromRoute) conceptBackRouteRef.current = fromRoute;
    else if (typeof window !== 'undefined') conceptBackRouteRef.current = normalizeRoute(window.location.pathname);
    openRoute(conceptRoute(analysisId, keywordId));
  };

  const goConceptBack = () => {
    const target = conceptBackRouteRef.current || '/';
    openRoute(target);
  };

  const updateActiveRun = (runId: string, updater: (run: ActiveAnalysisRun) => ActiveAnalysisRun) => {
    if (activeRunIdRef.current !== runId) return;
    setActiveRun((current) => {
      if (!current || current.runId !== runId) return current;
      return updater(current);
    });
  };

  const updateDisplayedResult = (updater: (result: AnalysisResult) => AnalysisResult) => {
    if (selectedSource === 'active') {
      setActiveRun((current) => current?.result ? { ...current, result: updater(current.result) } : current);
      return;
    }
    if (selectedSource === 'history') {
      setSelectedHistoryResult((current) => current ? updater(current) : current);
    }
  };

  const startAnalysis = async (nextTopic: string, continuationContext?: ContinuationContext, isPresetRegeneration = false) => {
    const trimmedTopic = nextTopic.trim();
    if (!trimmedTopic) return;
    if (activeRunIsRunning) {
      openActiveRun();
      return;
    }

    const runId = makeRunId();
    activeRunIdRef.current = runId;
    lastRunContextRef.current = { topic: trimmedTopic, continuationContext, isPresetRegeneration };
    setTopic(trimmedTopic);
    setSelectedHistoryResult(null);
    setSelectedSource('active');
    setView('result');
    setActiveRun({
      runId,
      topic: trimmedTopic,
      createdAt: new Date().toISOString(),
      status: 'starting',
      result: null,
      progress: {
        stage: 'outline',
        totalVoices: 0,
        completedVoices: 0,
        messages: [continuationContext ? '正在沿着上一份分析继续展开...' : '正在把问题整理成一张思想地图...'],
      },
      error: null,
      isPresetRegeneration,
      log: [],
    });

    const throttle = createVoiceStreamThrottle((voiceId, fullText) => {
      updateActiveRun(runId, (run) => run.result ? {
        ...run,
        result: {
          ...run.result,
          voices: run.result.voices.map((voice) => voice.id === voiceId ? { ...voice, argument: fullText, status: 'generating' } : voice),
        },
      } : run);
    });

    try {
      const data = await analyzeTopic(trimmedTopic, {
        onProgress: (progress) => updateActiveRun(runId, (run) => ({ ...run, status: progress.stage === 'done' ? run.status : 'running', progress })),
        onOutline: (outline) => updateActiveRun(runId, (run) => ({ ...run, status: 'running', result: createPartialResult(outline), error: null })),
        onRouteMap: (routeMap) => updateActiveRun(runId, (run) => run.result ? { ...run, result: { ...run.result, routeMap } } : run),
        onVoiceStart: (voiceId) => updateActiveRun(runId, (run) => run.result ? {
          ...run,
          result: {
            ...run.result,
            voices: run.result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating' } : voice),
          },
        } : run),
        onVoiceDelta: (voiceId, _delta, fullText) => throttle.schedule(voiceId, fullText),
        onVoiceStep: (voiceId, _voiceName, _message) => throttle.flush(voiceId),
        onVoiceComplete: (voice: ThoughtVoice) => {
          throttle.clearOne(voice.id);
          updateActiveRun(runId, (run) => run.result ? {
            ...run,
            result: {
              ...run.result,
              voices: run.result.voices.map((item) => item.id === voice.id ? voice : item),
            },
          } : run);
        },
        onSynthesis: (partial) => updateActiveRun(runId, (run) => run.result ? { ...run, result: { ...run.result, ...partial } } : run),
        onError: (message) => updateActiveRun(runId, (run) => ({ ...run, status: 'error', error: message, progress: { stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] } })),
        onLog: (entry: GenerationLogEntry) => updateActiveRun(runId, (run) => ({ ...run, log: [...run.log, entry] })),
        onTokenUsage: (usage: TokenUsage) => recordTokenUsage(usage),
      }, continuationContext);

      throttle.clearAll();
      updateActiveRun(runId, (run) => ({
        ...run,
        status: 'completed',
        result: data,
        progress: {
          stage: 'done',
          modeLabel: data.modeLabel,
          totalVoices: data.voices.length,
          completedVoices: data.voices.filter((voice) => voice.status === 'completed').length,
          messages: ['这份哲学分析已生成完成。'],
        },
        error: null,
      }));

      if (isPresetRegeneration) {
        persistGeneratedPreset(data);
      } else {
        persistResult(data);
      }
    } catch (err) {
      throttle.clearAll();
      const message = err instanceof Error ? err.message : '发生了未知错误';
      updateActiveRun(runId, (run) => ({
        ...run,
        status: 'error',
        error: message,
        progress: { stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] },
      }));
    }
  };

  const handleAnalyze = async (e?: React.FormEvent, explicitTopic?: string, continuationContext?: ContinuationContext) => {
    e?.preventDefault();
    const candidate = (explicitTopic || topic).trim();
    const validation = validateUserPrompt(candidate, { mode: 'topic' });
    if (!validation.ok) {
      setTopicHint({ message: validation.hint || '', suggestions: validation.suggestions });
      return;
    }
    setTopicHint(null);

    // Continuation flows are already a philosophical question (followUp / append branch
    // sourced from a prior analysis), so skip the reframe round-trip.
    if (continuationContext) {
      startAnalysis(candidate, continuationContext);
      return;
    }

    if (isReframing) return;
    setIsReframing(true);
    try {
      const reframe = await reframeUserTopic(candidate);
      if (reframe.shouldReframe && reframe.candidates.length > 0) {
        setReframeState({
          open: true,
          originalTopic: candidate,
          candidates: reframe.candidates,
        });
        return;
      }
      startAnalysis(candidate);
    } finally {
      setIsReframing(false);
    }
  };

  const handleReframePick = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTopic(trimmed);
    setReframeState(null);
    startAnalysis(trimmed);
  };

  const handleReframeKeepOriginal = () => {
    if (!reframeState) {
      return;
    }
    const original = reframeState.originalTopic;
    setReframeState(null);
    startAnalysis(original, reframeState.continuationContext);
  };

  const handleReframeCancel = () => {
    setReframeState(null);
  };

  const handleGenerateQuestionSuggestions = async () => {
    if (activeRunIsRunning || isGeneratingSuggestions) return;

    setIsGeneratingSuggestions(true);
    setSuggestionError('');
    try {
      const generatedQuestions = await generateQuestionSuggestions(topic);
      if (generatedQuestions.length > 0) {
        setQuestionSuggestions(generatedQuestions);
      } else {
        setSuggestionError('这次没有生成出新问题，请稍后再试。');
      }
    } catch (error) {
      console.error('[Sophia] question suggestion generation failed:', error);
      setSuggestionError(error instanceof Error ? error.message : 'AI 暂时没有生成出问题。');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleOpenHistory = (entry: HistoryEntry) => {
    const route = historyItemRoute(entry);
    if (route === '/history/sample') {
      openRoute('/history/sample');
      return;
    }

    pushRoute(route);
    setSelectedHistoryResult(entry.result);
    setTopic(entry.topic);
    setSelectedSource('history');
    setView('result');
  };

  const handleFollowUp = (question: string) => {
    const sourceResult = displayedResult;
    const selectedFollowUp = sourceResult?.followUps.find((item) => item.question === question);
    const continuationContext: ContinuationContext | undefined = sourceResult ? {
      parentTitle: sourceResult.philosophical_title,
      parentTopic: sourceResult.topic,
      parentQuestion: sourceResult.questionFrame.bigQuestion,
      parentSummary: sourceResult.conclusion.summary,
      parentTensions: sourceResult.tensions.map((item) => `${item.title}: ${item.content}`),
      selectedFollowUpReason: selectedFollowUp?.reason,
    } : undefined;

    startAnalysis(question, continuationContext);
  };

  const handleAppendThoughtVoice = async (prompt: string) => {
    const baseResult = displayedResult;
    const trimmedPrompt = prompt.trim();
    if (!baseResult || !trimmedPrompt || isAppendingVoice || activeRunIsRunning) return;

    setIsAppendingVoice(true);
    const sourceResult = selectedSource === 'history' && (baseResult.id === PRELOADED_HISTORY_ENTRY.result.id || baseResult.id === presetEntry.result.id)
      ? { ...baseResult, id: makeRunId(), createdAt: new Date().toISOString() }
      : baseResult;

    if (sourceResult !== baseResult) {
      pushRoute(`/history/${encodeURIComponent(sourceResult.id)}`);
      setSelectedHistoryResult(sourceResult);
      setTopic(sourceResult.topic);
    }

    const throttle = createVoiceStreamThrottle((voiceId, fullText) => {
      updateDisplayedResult((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, argument: fullText, status: 'generating' } : voice),
      }));
    });

    try {
      const updatedResult = await appendThoughtVoice(sourceResult, trimmedPrompt, {
        onVoicePlanned: (voice) => updateDisplayedResult((result) => ({ ...result, voices: [...result.voices, voice] })),
        onVoiceStart: (voiceId) => updateDisplayedResult((result) => ({
          ...result,
          voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating' } : voice),
        })),
        onVoiceDelta: (voiceId, _delta, fullText) => throttle.schedule(voiceId, fullText),
        onVoiceStep: (voiceId) => throttle.flush(voiceId),
        onVoiceComplete: (voice) => {
          throttle.clearOne(voice.id);
          updateDisplayedResult((result) => ({
            ...result,
            voices: result.voices.map((item) => item.id === voice.id ? voice : item),
          }));
        },
        onSynthesis: (partial) => updateDisplayedResult((result) => ({ ...result, ...partial })),
        onTokenUsage: (usage) => recordTokenUsage(usage),
      });

      throttle.clearAll();
      updateDisplayedResult(() => updatedResult);
      persistResult(updatedResult);
    } catch (error) {
      console.error('[Sophia] append voice failed:', error);
    } finally {
      throttle.clearAll();
      setIsAppendingVoice(false);
    }
  };

  const handleRetryVoice = async (voiceId: string) => {
    if (activeRunIsRunning || isAppendingVoice || retryingVoiceId) return;
    const baseResult = displayedResult;
    if (!baseResult) return;
    const targetVoice = baseResult.voices.find((voice) => voice.id === voiceId);
    if (!targetVoice) return;

    setRetryingVoiceId(voiceId);

    // If retrying on the bundled preset, clone it into a regular history entry first.
    const sourceResult = selectedSource === 'history' && (baseResult.id === PRELOADED_HISTORY_ENTRY.result.id || baseResult.id === presetEntry.result.id)
      ? { ...baseResult, id: makeRunId(), createdAt: new Date().toISOString() }
      : baseResult;

    if (sourceResult !== baseResult) {
      pushRoute(`/history/${encodeURIComponent(sourceResult.id)}`);
      setSelectedHistoryResult(sourceResult);
      setTopic(sourceResult.topic);
    }

    // Optimistic UI: clear the prior failure on this card so user sees progress immediately.
    updateDisplayedResult((result) => ({
      ...result,
      voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating', error: undefined, argument: '', summaryForSynthesis: '' } : voice),
    }));

    const throttle = createVoiceStreamThrottle((vid, fullText) => {
      updateDisplayedResult((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === vid ? { ...voice, argument: fullText, status: 'generating' } : voice),
      }));
    });

    try {
      const updatedResult = await regenerateThoughtVoice(sourceResult, voiceId, {
        onVoiceStart: (vid) => updateDisplayedResult((result) => ({
          ...result,
          voices: result.voices.map((voice) => voice.id === vid ? { ...voice, status: 'generating', error: undefined } : voice),
        })),
        onVoiceDelta: (vid, _delta, fullText) => throttle.schedule(vid, fullText),
        onVoiceStep: (vid) => throttle.flush(vid),
        onVoiceComplete: (voice) => {
          throttle.clearOne(voice.id);
          updateDisplayedResult((result) => ({
            ...result,
            voices: result.voices.map((item) => item.id === voice.id ? voice : item),
          }));
        },
        onSynthesis: (partial) => updateDisplayedResult((result) => ({ ...result, ...partial })),
        onTokenUsage: (usage) => recordTokenUsage(usage),
      });

      throttle.clearAll();
      updateDisplayedResult(() => updatedResult);
      persistResult(updatedResult);
    } catch (error) {
      console.error('[Sophia] retry voice failed:', error);
      const message = error instanceof Error ? error.message : '重新生成失败';
      updateDisplayedResult((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'failed', error: message } : voice),
      }));
    } finally {
      throttle.clearAll();
      setRetryingVoiceId(null);
    }
  };

  const handleRegenerateAll = () => {
    if (activeRunIsRunning || isAppendingVoice) return;
    const ctx = lastRunContextRef.current;
    if (ctx) {
      startAnalysis(ctx.topic, ctx.continuationContext, ctx.isPresetRegeneration);
      return;
    }
    const fallbackTopic = activeRun?.topic || topic;
    if (fallbackTopic) startAnalysis(fallbackTopic);
  };

  const handleDownloadHistory = () => {
    downloadJsonFile(buildHistoryBackupFilename(), {
      app: 'sophia-dialectic',
      version: HISTORY_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      entries: historyEntries,
    });
  };

  const handleImportHistory = (content: string) => {
    const importedEntries = extractImportedHistory(JSON.parse(content))
      .filter((entry) => !entry.isPreset)
      .map((entry) => ({ ...entry, isPreset: false, generatedByChain: false }));
    const existingIds = new Set(historyEntries.map((entry) => entry.id));
    const newEntries = importedEntries.filter((entry) => !existingIds.has(entry.id));
    const nextEntries = [...newEntries, ...historyEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, HISTORY_LIMIT);

    // Lift inline base64 avatars from the imported JSON into IDB, fire-and-forget.
    newEntries.forEach((entry) => { void persistEntryAvatars(entry); });

    const saved = saveHistory(nextEntries);
    setHistoryEntries(saved.length > 0 ? saved : nextEntries);
    return {
      imported: newEntries.length,
      scanned: importedEntries.length,
      limit: HISTORY_LIMIT,
    };
  };

  const handleDeleteHistoryEntry = (entry: HistoryEntry) => {
    if (entry.isPreset) return;
    const nextEntries = historyEntries.filter((item) => item.id !== entry.id);
    void deleteAvatarImages(collectAvatarKeys(entry));
    saveHistory(nextEntries);
    setHistoryEntries(nextEntries);
    if (selectedHistoryResult?.id === entry.id) {
      setSelectedHistoryResult(null);
      setSelectedSource(null);
      setView('history');
      pushRoute('/history');
    }
  };

  const handleRegeneratePreset = () => {
    startAnalysis(PRESET_TOPIC, undefined, true);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-museum-900 overflow-x-hidden relative">
      <DynamicBackground showFrontOcclusion={showHome} />

      <nav className="fixed w-full top-0 z-50 bg-museum-50/60 backdrop-blur-sm border-b border-museum-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={goHome}
            aria-label="返回 Sophia's Dialectic 首页"
            className="group -ml-2 flex items-center gap-3 rounded-full px-2 py-1 text-left transition-all duration-300 hover:bg-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/50"
          >
            <div className="relative h-10 w-10 shrink-0 md:h-11 md:w-11">
              <div className="absolute inset-0 rounded-[1.05rem] border border-museum-300/80 bg-gradient-to-br from-white/95 via-museum-50/80 to-museum-200/65 shadow-[0_10px_28px_rgba(44,42,38,0.10)] backdrop-blur-md transition-all duration-300 group-hover:-rotate-3 group-hover:shadow-[0_14px_34px_rgba(44,42,38,0.14)]" />
              <div className="absolute inset-1 rounded-[0.82rem] border border-white/70 bg-museum-50/45" />
              <svg className="absolute inset-0 h-full w-full p-2.5 text-museum-900" viewBox="0 0 40 40" fill="none" aria-hidden="true">
                <path d="M12 26C12 18 28 22 28 14C28 10.8 24.9 8.8 20.7 8.8C17.8 8.8 15.1 9.8 13.1 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <path d="M28 14C28 22 12 18 12 26C12 29.3 15.3 31.2 19.6 31.2C22.8 31.2 25.7 30.1 27.8 28.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="13" cy="12" r="1.7" fill="currentColor" />
                <circle cx="27" cy="28" r="1.7" fill="currentColor" />
              </svg>
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-white/80 bg-[#C5A059] shadow-[0_0_0_3px_rgba(197,160,89,0.18)] transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="hidden leading-none sm:block">
              <p className="font-serif text-base tracking-[0.04em] text-museum-900 md:text-lg">Sophia's</p>
              <p className="mt-1 hidden text-[9px] font-mono uppercase tracking-[0.24em] text-museum-500 sm:block md:text-[10px]">Dialectic Engine</p>
            </div>
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1 overflow-x-auto pl-2 md:flex-none md:gap-6 md:overflow-visible md:pl-0">
            {ANNOUNCEMENT.enabled && (
              <button
                onClick={openAnnouncement}
                aria-label="查看公告"
                title="查看公告"
                className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full border border-museum-200/80 bg-white/45 px-2.5 py-2 text-museum-600 hover:text-museum-900 transition-colors sm:px-3 md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:py-0"
              >
                <Megaphone className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
                <span className="sr-only">查看公告</span>
              </button>
            )}
            <button onClick={goHistory} className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-museum-200/80 bg-white/45 px-2.5 py-2 text-[9px] uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors sm:px-3.5 sm:text-[10px] md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-xs">History</button>
            <button onClick={goManifesto} className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-museum-200/80 bg-white/45 px-2.5 py-2 text-[9px] uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors sm:px-3.5 sm:text-[10px] md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-xs">Manifesto</button>
            <button onClick={goSettings} className="inline-flex min-h-[36px] shrink-0 items-center rounded-full border border-museum-200/80 bg-white/45 px-2.5 py-2 text-[9px] uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors sm:px-3.5 sm:text-[10px] md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:text-xs">Settings</button>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-20 md:pt-24 px-4 relative flex flex-col">
        <AppErrorBoundary resetKey={`${view}-${selectedSource || 'none'}-${displayedResult?.id || 'empty'}`}>
        {showHome && (
          <div className="flex-grow flex flex-col items-center justify-center -mt-2 pt-6 pb-10 transition-all duration-700 animate-fade-in px-2 md:-mt-8 md:pt-8 md:pb-14 md:px-0">
            <div className="max-w-4xl w-full text-center relative mb-8 md:mb-16">
              <div className="relative z-30">
                <HangingLabel ariaLabel="The Philosophical Engine" className="mb-4 md:mb-8">
                  The Philosophical Engine
                </HangingLabel>
              </div>

              <div className="relative z-10">
                <h1 className="font-serif text-4xl sm:text-7xl md:text-9xl text-museum-900 leading-[0.92] sm:leading-[0.9] mb-4 md:mb-6 tracking-tight drop-shadow-sm">
                  Sophia's<br />
                  <span className="italic relative inline-block">
                    Dialectic
                    <svg className="absolute w-[110%] h-2 md:h-4 -bottom-1 md:-bottom-2 -left-[5%] text-museum-300/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                      <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                    </svg>
                  </span>
                </h1>

              <p className="text-sm sm:text-base md:text-xl text-museum-700 max-w-xs sm:max-w-xl mx-auto leading-relaxed font-light mt-4 md:mt-8 px-2">
                Where your modern anxieties become a map of thought.
                <span className="block mt-2 text-museum-500 text-xs md:text-sm font-serif font-light tracking-wider">
                  输入一个困惑，生成一份可阅读的哲学分析。
                </span>
              </p>
              </div>
            </div>

            <form onSubmit={handleAnalyze} className="relative w-full max-w-2xl mx-auto group z-30">
              <div className="absolute -inset-1 bg-gradient-to-r from-museum-200 via-museum-100 to-museum-200 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000" />
              <input
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  if (topicHint) setTopicHint(null);
                }}
                placeholder={activeRunIsRunning ? '已有问题正在生成。' : '输入一个困惑...'}
                className="relative w-full px-5 py-4 pr-16 md:px-8 md:py-6 md:pr-20 text-base md:text-xl rounded-full bg-white/90 border-2 border-museum-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:outline-none focus:border-museum-300 focus:ring-0 focus:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-300 placeholder:text-museum-300 font-serif text-left backdrop-blur-md disabled:opacity-70"
                disabled={activeRunIsRunning || isReframing}
              />
              <button
                type="submit"
                disabled={!topic || activeRunIsRunning || isReframing}
                className="absolute right-1.5 top-1.5 md:right-2 md:top-2 h-[calc(100%-12px)] md:h-[calc(100%-16px)] aspect-square bg-museum-900 text-museum-50 rounded-full flex items-center justify-center hover:bg-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-lg"
              >
                {activeRunIsRunning || isReframing ? <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            </form>

            {topicHint && (
              <div className="relative z-30 mt-4 w-full max-w-2xl mx-auto px-4 py-3 rounded-2xl border border-amber-200/80 bg-amber-50/85 backdrop-blur-sm text-left">
                <p className="text-sm text-amber-900 leading-relaxed">{topicHint.message}</p>
                {topicHint.suggestions && topicHint.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {topicHint.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setTopic(suggestion);
                          setTopicHint(null);
                        }}
                        className="px-3 py-1.5 bg-white/80 border border-amber-200 rounded-full text-xs text-amber-900 hover:bg-white hover:border-amber-400 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="relative z-30 mt-5 flex flex-col items-center gap-3">
              {activeRunIsRunning ? (
                <button onClick={openActiveRun} className="text-xs font-mono uppercase tracking-widest text-museum-600 hover:text-museum-900 underline underline-offset-4">
                  回到正在生成的问题
                </button>
              ) : (
                <button onClick={() => openRoute('/history/sample')} className="text-xs font-mono uppercase tracking-[0.2em] text-museum-500 hover:text-museum-800 transition-colors flex items-center gap-2 group">
                  <span className="inline-block w-8 h-px bg-museum-300 group-hover:w-4 transition-all duration-300"></span>
                  Explore Preloaded Sample
                  <span className="inline-block w-8 h-px bg-museum-300 group-hover:w-4 transition-all duration-300"></span>
                </button>
              )}
            </div>

            <div className="relative z-30 mt-7 md:mt-16 flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl px-1 md:px-2">
              <div className="mb-1 flex w-full flex-col items-center justify-center gap-3 md:mb-2 md:flex-row">
                <span className="text-center text-[10px] font-mono uppercase tracking-widest text-museum-400 md:text-xs">Philosophy as a Program</span>
                <button
                  type="button"
                  onClick={handleGenerateQuestionSuggestions}
                  disabled={activeRunIsRunning || isGeneratingSuggestions || !API_CONFIGURED}
                  className="inline-flex items-center gap-1.5 rounded-full border border-museum-300/70 bg-white/65 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-museum-600 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-museum-500 hover:bg-white hover:text-museum-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  <Sparkles className={`h-3 w-3 ${isGeneratingSuggestions ? 'animate-spin' : ''}`} />
                  {isGeneratingSuggestions ? 'AI Thinking' : 'AI 生成问题'}
                </button>
              </div>
              {questionSuggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  disabled={activeRunIsRunning || isGeneratingSuggestions}
                  className="px-3 py-1.5 md:px-5 md:py-2.5 bg-white/60 border border-museum-200 rounded-lg text-[11px] md:text-sm text-museum-700 hover:border-museum-400 hover:shadow-md hover:bg-white hover:-translate-y-0.5 transition-all duration-300 font-medium backdrop-blur-sm disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {suggestion}
                </button>
              ))}
              {suggestionError && (
                <p className="w-full text-center text-[11px] text-red-700/80">{suggestionError}</p>
              )}
            </div>

            {showActiveBanner && activeRun && (
              <div className="relative z-30 mt-10 md:mt-16 w-full">
                <ActiveRunBanner activeRun={activeRun} onOpen={openActiveRun} />
              </div>
            )}

            {!API_CONFIGURED && (
              <div className="relative z-30 mt-8 md:mt-12 p-3 px-6 bg-red-50 text-red-800 rounded-full border border-red-100 inline-flex items-center gap-2 text-xs font-medium shadow-sm">
                <Info className="w-3 h-3" />
                <span>未配置 API key：请到设置页填入自定义 LLM，或在部署环境补上 SOPHIA_API_KEY 后重新部署。</span>
              </div>
            )}
          </div>
        )}

        {showHistory && (
          <HistoryPage
            entries={allHistoryEntries}
            activeRun={activeRun}
            entryHref={(entry) => historyItemRoute(entry)}
            onOpen={handleOpenHistory}
            onOpenActive={openActiveRun}
            onBack={goHome}
            onRegeneratePreset={handleRegeneratePreset}
            canRegeneratePreset={!!API_CONFIGURED && !activeRunIsRunning}
            onDownloadHistory={handleDownloadHistory}
            onImportHistory={handleImportHistory}
            onDeleteEntry={handleDeleteHistoryEntry}
          />
        )}

        {showManifesto && <ManifestoPage onBack={goHome} />}

        {showSettings && <SettingsPage onBack={goHome} />}

        {showResult && (
          <>
            {selectedSource === 'active' && (
              <RoundtableScene
                isAnalyzing={activeRunIsRunning}
                isFinished={!activeRunIsRunning && !!displayedResult && displayedProgress?.stage === 'done'}
                progress={displayedProgress}
                result={displayedResult}
                log={activeRun?.log}
              />
            )}

            {displayedError && (
              <div className="max-w-md mx-auto mt-8 text-center text-red-700 bg-red-50 p-5 rounded-lg border border-red-100">
                <p className="font-serif">苏菲遇到了错误：{displayedError}</p>
                {selectedSource === 'active' && !activeRunIsRunning && (lastRunContextRef.current || activeRun?.topic) && (
                  <button
                    type="button"
                    onClick={handleRegenerateAll}
                    className="mt-3 px-5 py-2 bg-museum-900 text-museum-50 rounded-full text-sm font-serif hover:bg-black transition-colors disabled:opacity-50"
                    disabled={isAppendingVoice || !!retryingVoiceId}
                  >
                    重新生成这份分析
                  </button>
                )}
              </div>
            )}

            {displayedResult && (
              <Arena
                data={displayedResult}
                onReset={goHome}
                onFollowUp={handleFollowUp}
                onAppendThoughtVoice={handleAppendThoughtVoice}
                onRetryVoice={handleRetryVoice}
                retryingVoiceId={retryingVoiceId}
                isGenerating={selectedSource === 'active' && activeRunIsRunning}
                isAppendingVoice={isAppendingVoice}
                onOpenConcept={(keywordId) => goToConcept(displayedResult.id, keywordId)}
              />
            )}
          </>
        )}

        {showConcept && conceptTarget && (() => {
          const sourceResult = findAnalysisResultById(conceptTarget.analysisId);
          if (!sourceResult) {
            return (
              <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-museum-200 rounded-xl p-8 text-center shadow-sm">
                <h2 className="font-serif text-3xl text-museum-900 mb-3">这个概念已经离线</h2>
                <p className="text-museum-600 leading-relaxed mb-6">来源分析不在当前历史中。可能是已被删除，或链接来自另一台设备的本地存储。</p>
                <button onClick={goHome} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
                  回到首页
                </button>
              </div>
            );
          }
          return (
            <ConceptDetailPage
              result={sourceResult}
              keywordId={conceptTarget.keywordId}
              canEnrich={!!API_CONFIGURED}
              onEnriched={handleKeywordEnriched}
              onBack={goConceptBack}
            />
          );
        })()}
        </AppErrorBoundary>
      </main>

      <footer className="py-6 md:py-8 text-center text-museum-400 text-[10px] md:text-xs font-mono uppercase tracking-widest relative z-30 opacity-60 hover:opacity-100 transition-opacity">
        <p>© 2026 Sophia's Dialectic. Powered by Sophia & The Ancients.</p>
      </footer>

      <TopicReframeDialog
        open={!!reframeState?.open}
        originalTopic={reframeState?.originalTopic || ''}
        candidates={reframeState?.candidates || []}
        onPick={handleReframePick}
        onKeepOriginal={handleReframeKeepOriginal}
        onCancel={handleReframeCancel}
      />

      <AnnouncementModal
        open={showAnnouncement}
        announcement={ANNOUNCEMENT}
        onDismiss={handleDismissAnnouncement}
        onCta={
          ANNOUNCEMENT.cta?.href === '/manifesto'
            ? () => {
                handleDismissAnnouncement();
                goManifesto();
              }
            : undefined
        }
      />
    </div>
  );
};

export default App;
