import React from 'react';
import { ArrowRight, Info, Sparkles } from 'lucide-react';
import type { ActiveAnalysisRun, RunSnapshot } from '../types';
import ActiveRunBanner from './ActiveRunBanner';
import { HangingLabel } from './PageHero';

interface TopicHint {
  message: string;
  suggestions?: string[];
}

interface HomePageProps {
  topic: string;
  topicHint: TopicHint | null;
  activeRun: ActiveAnalysisRun | null;
  pendingResumeSnap: RunSnapshot | null;
  isOffline: boolean;
  activeRunIsRunning: boolean;
  isReframing: boolean;
  isGeneratingSuggestions: boolean;
  questionSuggestions: string[];
  suggestionError: string;
  apiConfigured: boolean;
  showActiveBanner: boolean;
  onAnalyze: (event: React.FormEvent) => void;
  onTopicChange: (value: string) => void;
  onTopicSuggestionPick: (value: string) => void;
  onOpenActiveRun: () => void;
  onOpenSample: () => void;
  onGenerateQuestionSuggestions: () => void;
  onDismissResumePrompt: (snap: RunSnapshot) => void;
  onResumeRun: (snap: RunSnapshot) => void;
}

const runSnapshotStageLabel = (snap: RunSnapshot): string => {
  if (snap.lastCompletedStage === 'synthesis') return '综合判断';
  if (snap.lastCompletedStage === 'route') return '生成思想声音';
  if (snap.lastCompletedStage === 'outline') return '生成论证路线';
  return '整理问题结构';
};

const HomePage: React.FC<HomePageProps> = ({
  topic,
  topicHint,
  activeRun,
  pendingResumeSnap,
  isOffline,
  activeRunIsRunning,
  isReframing,
  isGeneratingSuggestions,
  questionSuggestions,
  suggestionError,
  apiConfigured,
  showActiveBanner,
  onAnalyze,
  onTopicChange,
  onTopicSuggestionPick,
  onOpenActiveRun,
  onOpenSample,
  onGenerateQuestionSuggestions,
  onDismissResumePrompt,
  onResumeRun,
}) => (
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

    <form onSubmit={onAnalyze} className="relative w-full max-w-2xl mx-auto group z-30">
      <div className="absolute -inset-1 bg-gradient-to-r from-museum-200 via-museum-100 to-museum-200 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000" />
      <input
        type="text"
        value={topic}
        onChange={(event) => onTopicChange(event.target.value)}
        placeholder={
          isOffline ? '当前离线 · 暂时无法生成新分析' :
          activeRunIsRunning ? '已有问题正在生成。' : '输入一个困惑...'
        }
        className="relative w-full px-5 py-4 pr-16 md:px-8 md:py-6 md:pr-20 text-base md:text-xl rounded-full bg-white/90 border-2 border-museum-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:outline-none focus:border-museum-300 focus:ring-0 focus:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-300 placeholder:text-museum-300 font-serif text-left backdrop-blur-md disabled:opacity-70"
        disabled={isOffline || activeRunIsRunning || isReframing}
      />
      <button
        type="submit"
        disabled={isOffline || !topic || activeRunIsRunning || isReframing}
        className="absolute right-1.5 top-1.5 md:right-2 md:top-2 h-[calc(100%-12px)] md:h-[calc(100%-16px)] aspect-square bg-museum-900 text-museum-50 rounded-full flex items-center justify-center hover:bg-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-lg"
      >
        {activeRunIsRunning || isReframing ? <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />}
      </button>
    </form>

    {topicHint && (
      <div className="relative z-30 mt-4 w-full max-w-2xl mx-auto px-4 py-3 rounded-2xl border border-amber-200/80 bg-amber-50/85 backdrop-blur-sm text-left shadow-[0_4px_16px_-4px_rgba(180,140,50,0.08)]">
        <p className="text-sm text-amber-900 leading-relaxed">{topicHint.message}</p>
        {topicHint.suggestions && topicHint.suggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {topicHint.suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onTopicSuggestionPick(suggestion)}
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
        <button type="button" onClick={onOpenActiveRun} className="text-xs font-mono uppercase tracking-widest text-museum-600 hover:text-museum-900 underline underline-offset-4">
          回到正在生成的问题
        </button>
      ) : (
        <button type="button" onClick={onOpenSample} className="text-xs font-mono uppercase tracking-[0.2em] text-museum-500 hover:text-museum-800 transition-colors flex items-center gap-2 group">
          <span className="inline-block w-8 h-px bg-museum-300 group-hover:w-4 transition-all duration-300" />
          Explore Preloaded Sample
          <span className="inline-block w-8 h-px bg-museum-300 group-hover:w-4 transition-all duration-300" />
        </button>
      )}
    </div>

    <div className="relative z-30 mt-7 md:mt-16 flex flex-col items-center max-w-3xl px-1 md:px-2">
      <div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-museum-300 to-transparent mb-6" aria-hidden="true" />
      <div className="mb-3 flex w-full flex-col items-center justify-center gap-3 md:mb-4 md:flex-row">
        <span className="text-center text-[10px] font-mono uppercase tracking-widest text-museum-500 md:text-xs">Philosophy as a Program</span>
        <button
          type="button"
          onClick={onGenerateQuestionSuggestions}
          disabled={activeRunIsRunning || isGeneratingSuggestions || !apiConfigured}
          className="inline-flex items-center gap-1.5 rounded-full border border-museum-300/70 bg-white/65 px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.16em] text-museum-600 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-museum-500 hover:bg-white hover:text-museum-900 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
        >
          <Sparkles className={`h-3 w-3 ${isGeneratingSuggestions ? 'animate-spin' : ''}`} />
          {isGeneratingSuggestions ? 'AI Thinking' : 'AI 生成问题'}
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-2 md:gap-3">
        {questionSuggestions.map((suggestion, idx) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => onTopicSuggestionPick(suggestion)}
            disabled={activeRunIsRunning || isGeneratingSuggestions}
            className="px-4 py-2 md:px-5 md:py-2.5 bg-white/70 border border-museum-200 border-l-2 border-l-museum-400/60 rounded-full text-[11px] md:text-sm text-museum-700 hover:border-museum-400 hover:shadow-[0_8px_24px_-8px_rgba(44,42,38,0.12)] hover:bg-white hover:-translate-y-0.5 transition-all duration-300 font-medium backdrop-blur-sm disabled:opacity-50 disabled:hover:translate-y-0 animate-chip-in"
            style={{ animationDelay: `${idx * 60}ms` }}
          >
            {suggestion}
          </button>
        ))}
      </div>
      {suggestionError && (
        <p className="w-full text-center text-[11px] text-red-700/80 mt-3">{suggestionError}</p>
      )}
    </div>

    {showActiveBanner && activeRun && (
      <div className="relative z-30 mt-10 md:mt-16 w-full">
        <ActiveRunBanner activeRun={activeRun} onOpen={onOpenActiveRun} />
      </div>
    )}

    {pendingResumeSnap && !activeRun && (
      <div className="relative z-30 mt-8 md:mt-12 w-full max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-museum-300 shadow-[0_4px_20px_-4px_rgba(44,42,38,0.08)] p-5 md:p-6 hover:shadow-[0_8px_30px_-6px_rgba(44,42,38,0.12)] transition-shadow duration-500">
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-museum-400/50 to-transparent" aria-hidden="true" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-museum-500 mb-1">未完成的分析</p>
            <p className="font-serif text-museum-900 text-base md:text-lg leading-snug truncate">{pendingResumeSnap.partialResult?.philosophical_title || pendingResumeSnap.topic}</p>
            <p className="text-xs text-museum-500 mt-1">
              上次在 {runSnapshotStageLabel(pendingResumeSnap)} 阶段中断。
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onDismissResumePrompt(pendingResumeSnap)}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-600 hover:text-museum-900 transition-colors"
            >
              放弃
            </button>
            <button
              type="button"
              onClick={() => onResumeRun(pendingResumeSnap)}
              className="px-4 py-2 text-xs font-mono uppercase tracking-widest bg-museum-900 text-museum-50 shadow-[0_4px_12px_-4px_rgba(44,42,38,0.3)] hover:bg-black transition-colors"
            >
              继续上次的分析
            </button>
          </div>
        </div>
      </div>
    )}

    {!apiConfigured && (
      <div className="relative z-30 mt-8 md:mt-12 p-3 px-6 bg-red-50 text-red-800 rounded-full border border-red-100 inline-flex items-center gap-2 text-xs font-medium shadow-sm">
        <Info className="w-3 h-3" />
        <span>未配置 API key：请到设置页填入自定义 LLM，或在部署环境补上 SOPHIA_API_KEY 后重新部署。</span>
      </div>
    )}
  </div>
);

export default HomePage;
