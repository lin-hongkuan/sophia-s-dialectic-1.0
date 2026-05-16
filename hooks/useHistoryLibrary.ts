import { useCallback, useEffect, useMemo, useState } from 'react';
import { emptyConclusion, type AnalysisResult } from '../types/domain';
import type { HistoryEntry, RunSnapshot } from '../types/storage';
import { PRELOADED_HISTORY_ENTRY } from '../data/preloadedHistory';
import { downloadJsonFile } from '../utils/download';
import {
  buildHistoryBackupFilename,
  collectAvatarKeys,
  extractImportedHistory,
  HISTORY_EXPORT_VERSION,
  HISTORY_LIMIT,
  hydrateEntriesWithAvatars,
  loadGeneratedPreset,
  loadHistory,
  maybeMigrateLegacyAvatars,
  persistEntryAvatars,
  PRESET_HISTORY_KEY,
  saveHistory,
  splitAvatarsForStorage,
} from '../services/storage/historyStore';
import { deleteAvatarImages } from '../services/storage/imageStore';
import { deleteRunSnapshot, findMostRecentResumable, pruneStaleRunSnapshots } from '../services/storage/runSnapshotStore';
import { safeLocalStorageSet } from '../services/storage/localStorageGateway';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const safeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const safeStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeImportedResult = (result: AnalysisResult): AnalysisResult => {
  const source = result as Partial<AnalysisResult>;
  const questionFrame: Record<string, unknown> = isRecord(source.questionFrame) ? source.questionFrame : {};
  const title = safeString(source.philosophical_title, safeString(source.topic, '未命名分析'));
  const topic = safeString(source.topic, title);

  return {
    ...result,
    id: safeString(source.id, `imported-${Date.now()}`),
    createdAt: safeString(source.createdAt, new Date().toISOString()),
    topic,
    philosophical_title: title,
    mode: source.mode || 'custom',
    modeLabel: safeString(source.modeLabel, '自定义'),
    introduction: safeString(source.introduction),
    questionFrame: {
      original: safeString(questionFrame.original, topic),
      bigQuestion: safeString(questionFrame.bigQuestion, title),
      plainTranslation: safeString(questionFrame.plainTranslation),
      keywords: safeStringArray(questionFrame.keywords),
    },
    programStructure: Array.isArray(source.programStructure) ? source.programStructure : [],
    routeMap: Array.isArray(source.routeMap) ? source.routeMap : [],
    voices: Array.isArray(source.voices) ? source.voices : [],
    tensions: Array.isArray(source.tensions) ? source.tensions : [],
    keywords: Array.isArray(source.keywords) ? source.keywords : [],
    followUps: Array.isArray(source.followUps) ? source.followUps : [],
    conclusion: isRecord(source.conclusion)
      ? {
        summary: safeString(source.conclusion.summary),
        openQuestion: safeString(source.conclusion.openQuestion),
        realLifeReturn: safeString(source.conclusion.realLifeReturn),
      }
      : emptyConclusion,
  };
};

const normalizeImportedEntry = (entry: HistoryEntry): HistoryEntry => {
  const result = normalizeImportedResult(entry.result);
  return {
    ...entry,
    id: safeString(entry.id, result.id),
    topic: safeString(entry.topic, result.topic),
    title: safeString(entry.title, result.philosophical_title),
    mode: entry.mode || result.mode,
    modeLabel: safeString(entry.modeLabel, result.modeLabel),
    createdAt: safeString(entry.createdAt, result.createdAt),
    result,
  };
};

export const useHistoryLibrary = () => {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presetEntry, setPresetEntry] = useState<HistoryEntry>(PRELOADED_HISTORY_ENTRY);
  const [pendingResumeSnap, setPendingResumeSnap] = useState<RunSnapshot | null>(null);

  useEffect(() => {
    setHistoryEntries(loadHistory());
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;
    setPresetEntry(nextPresetEntry);

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

    void (async () => {
      try { await pruneStaleRunSnapshots(); } catch { /* best-effort */ }
      const snap = await findMostRecentResumable();
      if (snap) setPendingResumeSnap(snap);
    })();
  }, []);

  const allHistoryEntries = useMemo(() => [presetEntry, ...historyEntries], [presetEntry, historyEntries]);

  const persistResult = useCallback((nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: nextResult.id,
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
    };
    setHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].slice(0, HISTORY_LIMIT);
      const saved = saveHistory(next);
      const keptIds = new Set(saved.map((e) => e.id));
      const droppedKeys: string[] = [];
      next.forEach((e) => {
        if (!keptIds.has(e.id)) droppedKeys.push(...collectAvatarKeys(e));
      });
      if (droppedKeys.length > 0) void deleteAvatarImages(droppedKeys);
      void persistEntryAvatars(entry).catch((error) => {
        console.warn('[sophia] failed to persist avatar images:', error);
      });
      return saved.length > 0 ? saved : next;
    });
  }, []);

  const persistGeneratedPreset = useCallback((nextResult: AnalysisResult) => {
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
    const { lean } = splitAvatarsForStorage(entry);
    const savedPreset = safeLocalStorageSet(PRESET_HISTORY_KEY, JSON.stringify(lean));
    if (!savedPreset) console.warn('[sophia] preset cache quota exhausted — preset not persisted.');
    void persistEntryAvatars(entry).catch((error) => {
      console.warn('[sophia] failed to persist preset avatar images:', error);
    });
    setPresetEntry(entry);
  }, []);

  const hydratePresetForCurrentRoute = useCallback((route: string, onHydrated: (entry: HistoryEntry) => void) => {
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;
    setPresetEntry(nextPresetEntry);
    void hydrateEntriesWithAvatars([nextPresetEntry]).then(([hydratedPreset]) => {
      if (window.location.pathname !== route) return;
      if (hydratedPreset === nextPresetEntry) return;
      setPresetEntry(hydratedPreset);
      onHydrated(hydratedPreset);
    });
    return nextPresetEntry;
  }, []);

  const hydrateHistoryForCurrentRoute = useCallback((route: string, entries: HistoryEntry[], historyId: string, onHydrated: (entry: HistoryEntry) => void) => {
    void hydrateEntriesWithAvatars(entries).then((hydrated) => {
      if (window.location.pathname !== route) return;
      if (hydrated === entries) return;
      setHistoryEntries(hydrated);
      const refreshed = hydrated.find((entry) => entry.id === historyId);
      if (refreshed) onHydrated(refreshed);
    });
  }, []);

  const findStoredEntry = useCallback((historyId: string, selectedResult?: AnalysisResult | null) => {
    const inMemoryEntry = historyEntries.find((entry) => entry.id === historyId)
      || (selectedResult?.id === historyId
        ? {
          id: selectedResult.id,
          topic: selectedResult.topic,
          title: selectedResult.philosophical_title,
          mode: selectedResult.mode,
          modeLabel: selectedResult.modeLabel,
          createdAt: selectedResult.createdAt,
          result: selectedResult,
        }
        : null);
    const storedHistory = loadHistory();
    const historyEntry = inMemoryEntry || storedHistory.find((entry) => entry.id === historyId);
    if (!historyEntry) return null;
    const entries = historyEntries.some((entry) => entry.id === historyId) ? historyEntries : storedHistory;
    return { entry: historyEntry, entries };
  }, [historyEntries]);

  const importHistory = useCallback((content: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        imported: 0,
        scanned: 0,
        limit: HISTORY_LIMIT,
        error: '导入文件不是有效 JSON。',
      };
    }

    const importedEntries = extractImportedHistory(parsed)
      .filter((entry) => !entry.isPreset)
      .map((entry) => ({ ...normalizeImportedEntry(entry), isPreset: false, generatedByChain: false }));
    const existingIds = new Set(historyEntries.map((entry) => entry.id));
    const newEntries = importedEntries.filter((entry) => !existingIds.has(entry.id));
    const nextEntries = [...newEntries, ...historyEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, HISTORY_LIMIT);

    newEntries.forEach((entry) => { void persistEntryAvatars(entry); });

    const saved = saveHistory(nextEntries);
    setHistoryEntries(saved.length > 0 ? saved : nextEntries);
    return {
      imported: newEntries.length,
      scanned: importedEntries.length,
      limit: HISTORY_LIMIT,
    };
  }, [historyEntries]);

  const downloadHistory = useCallback(() => {
    downloadJsonFile(buildHistoryBackupFilename(), {
      app: 'sophia-dialectic',
      version: HISTORY_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      entries: historyEntries,
    });
  }, [historyEntries]);

  const deleteHistoryEntry = useCallback((entry: HistoryEntry) => {
    if (entry.isPreset) return historyEntries;
    const nextEntries = historyEntries.filter((item) => item.id !== entry.id);
    void deleteAvatarImages(collectAvatarKeys(entry));
    saveHistory(nextEntries);
    setHistoryEntries(nextEntries);
    return nextEntries;
  }, [historyEntries]);

  const dismissResumePrompt = useCallback((snap: RunSnapshot) => {
    setPendingResumeSnap(null);
    void deleteRunSnapshot(snap.runId);
  }, []);

  return {
    historyEntries,
    presetEntry,
    setPresetEntry,
    allHistoryEntries,
    pendingResumeSnap,
    setPendingResumeSnap,
    persistResult,
    persistGeneratedPreset,
    hydratePresetForCurrentRoute,
    hydrateHistoryForCurrentRoute,
    findStoredEntry,
    importHistory,
    downloadHistory,
    deleteHistoryEntry,
    dismissResumePrompt,
  };
};
