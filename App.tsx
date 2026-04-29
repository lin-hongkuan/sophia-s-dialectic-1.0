import React, { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeTopic, createPartialResult, generateQuestionSuggestions } from './services/sophiaService';
import { ActiveAnalysisRun, AnalysisResult, ContinuationContext, HistoryEntry, ThoughtVoice } from './types';
import Arena from './components/Arena';
import ReasoningDisplay from './components/ReasoningDisplay';
import DynamicBackground from './components/DynamicBackground';
import HistoryPage from './components/HistoryPage';
import ManifestoPage from './components/ManifestoPage';
import ActiveRunBanner from './components/ActiveRunBanner';
import { PRELOADED_HISTORY_ENTRY } from './data/preloadedHistory';
import { Info, ArrowRight, Sparkles } from 'lucide-react';

type View = 'home' | 'history' | 'manifesto' | 'result';
type SelectedSource = 'active' | 'history' | null;

const HISTORY_KEY = 'sophia.history.v1';
const HISTORY_LIMIT = 10;
const PRESET_HISTORY_KEY = 'sophia.preset.generated.feminism.v1';
const PRESET_TOPIC = '女性主义有道理吗？';
const DEFAULT_QUESTION_SUGGESTIONS = ['女性主义有道理吗？', '如何克服虚无主义？', '如何证明你不是缸中之脑？', '我们应该生孩子吗？', '为什么有性别不止有两个？'];
const API_CONFIGURED = process.env.SOPHIA_API_CONFIGURED === 'true';

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

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [view, setView] = useState<View>('home');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveAnalysisRun | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presetEntry, setPresetEntry] = useState<HistoryEntry>(PRELOADED_HISTORY_ENTRY);
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>(DEFAULT_QUESTION_SUGGESTIONS);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
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
  const showActiveBanner = showHome && !!activeRun && !isViewingActiveRun;

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
            <div className="leading-none">
              <p className="font-serif text-base tracking-[0.04em] text-museum-900 md:text-lg">Sophia's</p>
              <p className="mt-1 hidden text-[9px] font-mono uppercase tracking-[0.24em] text-museum-500 sm:block md:text-[10px]">Dialectic Engine</p>
            </div>
          </button>
          <div className="flex items-center space-x-6">
            <button onClick={() => setView('history')} className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">History</button>
            <button onClick={() => setView('manifesto')} className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">Manifesto</button>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-20 md:pt-24 px-4 relative z-10 flex flex-col">
        <AppErrorBoundary resetKey={`${view}-${selectedSource || 'none'}-${displayedResult?.id || 'empty'}`}>
        {showHome && (
          <div className="flex-grow flex flex-col items-center justify-center -mt-2 pt-6 pb-10 transition-all duration-700 animate-fade-in px-2 md:-mt-8 md:pt-8 md:pb-14 md:px-0">
            <div className="max-w-4xl w-full text-center relative mb-8 md:mb-16">
              <div className="absolute left-1/2 -top-12 h-12 w-px bg-museum-300 -translate-x-1/2 hidden md:block" />

              <div
                className="notranslate pointer-events-none relative z-20 mb-4 inline-flex h-8 max-w-[calc(100vw-2rem)] select-none items-center justify-center rounded-full border border-museum-300/80 bg-museum-50/90 px-4 shadow-sm backdrop-blur-md md:mb-8"
                translate="no"
                aria-label="The Philosophical Engine"
              >
                <span className="block whitespace-nowrap text-[10px] font-mono uppercase leading-none tracking-[0.18em] text-museum-700 md:text-xs md:tracking-[0.2em]">The Philosophical Engine</span>
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
                  className="px-3 py-1.5 md:px-5 md:py-2.5 bg-white/60 border border-museum-200 rounded-lg text-xs md:text-sm text-museum-700 hover:border-museum-400 hover:shadow-md hover:bg-white hover:-translate-y-0.5 transition-all duration-300 font-medium backdrop-blur-sm disabled:opacity-50 disabled:hover:translate-y-0"
                >
                  {suggestion}
                </button>
              ))}
              {suggestionError && (
                <p className="w-full text-center text-[11px] text-red-700/80">{suggestionError}</p>
              )}
            </div>

            {showActiveBanner && activeRun && (
              <div className="mt-10 md:mt-16 w-full">
                <ActiveRunBanner activeRun={activeRun} onOpen={openActiveRun} />
              </div>
            )}

            {!API_CONFIGURED && (
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
            canRegeneratePreset={!!API_CONFIGURED && !activeRunIsRunning}
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
