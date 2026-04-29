import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTopic, createPartialResult } from './services/sophiaService';
import { ActiveAnalysisRun, AnalysisResult, ContinuationContext, HistoryEntry, ThoughtVoice } from './types';
import Arena from './components/Arena';
import ReasoningDisplay from './components/ReasoningDisplay';
import DynamicBackground from './components/DynamicBackground';
import HistoryPage from './components/HistoryPage';
import ManifestoPage from './components/ManifestoPage';
import ActiveRunBanner from './components/ActiveRunBanner';
import { PRELOADED_HISTORY_ENTRY } from './data/preloadedHistory';
import { Info, ArrowRight } from 'lucide-react';

type View = 'home' | 'history' | 'manifesto' | 'result';
type SelectedSource = 'active' | 'history' | null;

const HISTORY_KEY = 'sophia.history.v1';
const HISTORY_LIMIT = 10;
const PRESET_HISTORY_KEY = 'sophia.preset.generated.v1';
const PRESET_TOPIC = '我们应该生孩子吗？';

const makeRunId = () => `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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

const saveHistory = (entries: HistoryEntry[]) => {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_LIMIT)));
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

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [view, setView] = useState<View>('home');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveAnalysisRun | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presetEntry, setPresetEntry] = useState<HistoryEntry>(PRELOADED_HISTORY_ENTRY);
  const activeRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    setHistoryEntries(loadHistory());
    setPresetEntry(loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY);
  }, []);

  const activeRunIsRunning = activeRun?.status === 'starting' || activeRun?.status === 'running';
  const allHistoryEntries = useMemo(() => [presetEntry, ...historyEntries], [presetEntry, historyEntries]);
  const displayedResult = selectedSource === 'active' ? activeRun?.result || null : selectedHistoryResult;
  const displayedProgress = selectedSource === 'active' ? activeRun?.progress || null : null;
  const displayedError = selectedSource === 'active' ? activeRun?.error || null : null;
  const showHome = view === 'home';
  const showHistory = view === 'history';
  const showManifesto = view === 'manifesto';
  const showResult = view === 'result';
  const isViewingActiveRun = showResult && selectedSource === 'active';
  const showActiveBanner = !!activeRun && !isViewingActiveRun;

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
    setHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].slice(0, HISTORY_LIMIT);
      saveHistory(next);
      return next;
    });
  };

  const persistGeneratedPreset = (nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: 'preset-generated-should-we-have-children',
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
      isPreset: true,
      generatedByChain: true,
    };
    localStorage.setItem(PRESET_HISTORY_KEY, JSON.stringify(entry));
    setPresetEntry(entry);
  };

  const openActiveRun = () => {
    if (!activeRun) return;
    setSelectedSource('active');
    setSelectedHistoryResult(null);
    setView('result');
  };

  const goHome = () => {
    setSelectedSource(null);
    setSelectedHistoryResult(null);
    setView('home');
  };

  const updateActiveRun = (runId: string, updater: (run: ActiveAnalysisRun) => ActiveAnalysisRun) => {
    if (activeRunIdRef.current !== runId) return;
    setActiveRun((current) => {
      if (!current || current.runId !== runId) return current;
      return updater(current);
    });
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
    });

    const pendingVoiceText = new Map<string, string>();
    const voiceFlushTimers = new Map<string, number>();

    const clearVoiceFlush = (voiceId: string) => {
      const timer = voiceFlushTimers.get(voiceId);
      if (timer) window.clearTimeout(timer);
      voiceFlushTimers.delete(voiceId);
      pendingVoiceText.delete(voiceId);
    };

    const flushVoiceText = (voiceId: string) => {
      const fullText = pendingVoiceText.get(voiceId);
      clearVoiceFlush(voiceId);
      if (fullText === undefined) return;

      updateActiveRun(runId, (run) => run.result ? {
        ...run,
        result: {
          ...run.result,
          voices: run.result.voices.map((voice) => voice.id === voiceId ? { ...voice, argument: fullText, status: 'generating' } : voice),
        },
      } : run);
    };

    const scheduleVoiceTextFlush = (voiceId: string, fullText: string) => {
      pendingVoiceText.set(voiceId, fullText);
      if (voiceFlushTimers.has(voiceId)) return;

      const timer = window.setTimeout(() => flushVoiceText(voiceId), 120);
      voiceFlushTimers.set(voiceId, timer);
    };

    const clearAllVoiceFlushes = () => {
      voiceFlushTimers.forEach((timer) => window.clearTimeout(timer));
      voiceFlushTimers.clear();
      pendingVoiceText.clear();
    };

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
        onVoiceDelta: (voiceId, _delta, fullText) => scheduleVoiceTextFlush(voiceId, fullText),
        onVoiceComplete: (voice: ThoughtVoice) => {
          clearVoiceFlush(voice.id);
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
      }, continuationContext);

      clearAllVoiceFlushes();
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
      clearAllVoiceFlushes();
      const message = err instanceof Error ? err.message : '发生了未知错误';
      updateActiveRun(runId, (run) => ({
        ...run,
        status: 'error',
        error: message,
        progress: { stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] },
      }));
    }
  };

  const handleAnalyze = (e?: React.FormEvent, explicitTopic?: string, continuationContext?: ContinuationContext) => {
    e?.preventDefault();
    startAnalysis(explicitTopic || topic, continuationContext);
  };

  const handleOpenHistory = (entry: HistoryEntry) => {
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

  const handleRegeneratePreset = () => {
    startAnalysis(PRESET_TOPIC, undefined, true);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-museum-900 overflow-x-hidden relative">
      <DynamicBackground />

      <nav className="fixed w-full top-0 z-50 bg-museum-50/60 backdrop-blur-sm border-b border-museum-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer group" onClick={goHome}>
            <div className="relative w-9 h-9 md:w-10 md:h-10 border border-museum-800/80 bg-white/55 backdrop-blur-[3px] flex items-center justify-center shadow-sm">
              <div className="absolute inset-1 border border-museum-300/70" />
              <span className="relative font-serif text-lg md:text-xl italic text-museum-900 leading-none">S</span>
            </div>
            <div className="leading-none">
              <p className="font-serif text-base md:text-lg tracking-[0.08em] text-museum-900">Sophia</p>
              <p className="hidden sm:block text-[9px] md:text-[10px] font-mono uppercase tracking-[0.28em] text-museum-500 mt-1">Dialectic Archive</p>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <button onClick={() => setView('history')} className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">History</button>
            <button onClick={() => setView('manifesto')} className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">Manifesto</button>
          </div>
        </div>
      </nav>

      {showActiveBanner && activeRun && <ActiveRunBanner activeRun={activeRun} onOpen={openActiveRun} />}

      <main className="flex-grow pt-20 md:pt-24 px-4 relative z-10 flex flex-col">
        <AppErrorBoundary resetKey={`${view}-${selectedSource || 'none'}-${displayedResult?.id || 'empty'}`}>
        {showHome && (
          <div className="flex-grow flex flex-col items-center justify-center -mt-10 md:-mt-20 transition-all duration-700 animate-fade-in px-2 md:px-0">
            <div className="max-w-4xl w-full text-center relative mb-8 md:mb-16">
              <div className="absolute left-1/2 -top-12 h-12 w-px bg-museum-300 -translate-x-1/2 hidden md:block" />

              <div className="inline-block mb-4 md:mb-8 px-3 py-1 border border-museum-300 rounded-full bg-white/40 backdrop-blur-sm scale-90 md:scale-100">
                <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-museum-600">The Philosophical Engine</span>
              </div>

              <h1 className="font-serif text-5xl sm:text-7xl md:text-9xl text-museum-900 leading-[0.9] mb-4 md:mb-6 tracking-tight drop-shadow-sm">
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
                <span className="block mt-2 text-museum-500 text-xs md:text-sm font-serif italic">
                  输入一个困惑，生成一份可阅读的哲学分析。
                </span>
              </p>
            </div>

            <form onSubmit={handleAnalyze} className="relative w-full max-w-2xl mx-auto group z-20">
              <div className="absolute -inset-1 bg-gradient-to-r from-museum-200 via-museum-100 to-museum-200 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000" />
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={activeRunIsRunning ? '已有问题正在生成，可先回到它。' : 'What is your dialectic today? (输入困惑...)'}
                className="relative w-full px-5 py-4 md:px-8 md:py-6 text-base md:text-xl rounded-full bg-white/90 border-2 border-museum-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:outline-none focus:border-museum-300 focus:ring-0 focus:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-300 placeholder:text-museum-300 font-serif text-center md:text-left backdrop-blur-md disabled:opacity-70"
                disabled={activeRunIsRunning}
              />
              <button
                type="submit"
                disabled={!topic || activeRunIsRunning}
                className="absolute right-1.5 top-1.5 md:right-2 md:top-2 h-[calc(100%-12px)] md:h-[calc(100%-16px)] aspect-square bg-museum-900 text-museum-50 rounded-full flex items-center justify-center hover:bg-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-lg"
              >
                {activeRunIsRunning ? <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />}
              </button>
            </form>

            {activeRunIsRunning && (
              <button onClick={openActiveRun} className="mt-5 text-xs font-mono uppercase tracking-widest text-museum-600 hover:text-museum-900 underline underline-offset-4">
                回到正在生成的问题
              </button>
            )}

            <div className="mt-8 md:mt-16 flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl px-2">
              <span className="w-full text-center text-[10px] md:text-xs font-mono text-museum-400 uppercase tracking-widest mb-1 md:mb-2">Philosophy as a Program</span>
              {['如何克服虚无主义？', '女权主义有道理吗？', '如何证明你不是缸中之脑？', '我们应该生孩子吗？', '为什么有性别不止有两个？'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  disabled={activeRunIsRunning}
                  className="px-3 py-1.5 md:px-5 md:py-2.5 bg-white/60 border border-museum-200 rounded-lg text-xs md:text-sm text-museum-700 hover:border-museum-400 hover:shadow-md hover:bg-white hover:-translate-y-0.5 transition-all duration-300 font-medium backdrop-blur-sm disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>

            {!process.env.SOPHIA_API_KEY && (
              <div className="mt-8 md:mt-12 p-3 px-6 bg-red-50 text-red-800 rounded-full border border-red-100 inline-flex items-center gap-2 text-xs font-medium shadow-sm">
                <Info className="w-3 h-3" />
                <span>System Alert: Missing SOPHIA_API_KEY configuration.</span>
              </div>
            )}
          </div>
        )}

        {showHistory && (
          <HistoryPage
            entries={allHistoryEntries}
            activeRun={activeRun}
            onOpen={handleOpenHistory}
            onOpenActive={openActiveRun}
            onBack={goHome}
            onRegeneratePreset={handleRegeneratePreset}
            canRegeneratePreset={!!process.env.SOPHIA_API_KEY && !activeRunIsRunning}
          />
        )}

        {showManifesto && <ManifestoPage onBack={goHome} />}

        {showResult && (
          <>
            {selectedSource === 'active' && (
              <ReasoningDisplay
                isAnalyzing={activeRunIsRunning}
                isFinished={!activeRunIsRunning && !!displayedResult && displayedProgress?.stage === 'done'}
                progress={displayedProgress}
              />
            )}

            {displayedError && (
              <div className="max-w-md mx-auto mt-8 text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
                <p className="font-serif">苏菲遇到了错误: {displayedError}</p>
              </div>
            )}

            {displayedResult && (
              <Arena
                data={displayedResult}
                onReset={goHome}
                onFollowUp={handleFollowUp}
                isGenerating={selectedSource === 'active' && activeRunIsRunning}
              />
            )}
          </>
        )}
        </AppErrorBoundary>
      </main>

      <footer className="py-6 md:py-8 text-center text-museum-400 text-[10px] md:text-xs font-mono uppercase tracking-widest relative z-10 opacity-60 hover:opacity-100 transition-opacity">
        <p>© 2026 Sophia's Dialectic. Powered by Sophia & The Ancients.</p>
      </footer>
    </div>
  );
};

export default App;
