import React from 'react';
import { ActiveAnalysisRun, HistoryEntry } from '../types';
import { Archive, ArrowRight, BookOpen, Clock, Loader2, RotateCcw, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface HistoryPageProps {
  entries: HistoryEntry[];
  activeRun?: ActiveAnalysisRun | null;
  entryHref?: (entry: HistoryEntry) => string;
  onOpen: (entry: HistoryEntry) => void;
  onOpenActive?: () => void;
  onBack: () => void;
  onRegeneratePreset?: () => void;
  canRegeneratePreset?: boolean;
}

const stageLabel: Record<string, string> = {
  idle: '等待',
  outline: '整理问题结构',
  route: '生成论证路线',
  voices: '生成思想声音',
  synthesis: '综合判断',
  done: '完成',
  error: '出错',
};

const stageOrder = ['outline', 'route', 'voices', 'synthesis', 'done'];

const formatActiveRunProgress = (activeProgress?: ActiveAnalysisRun['progress']) => {
  const stage = activeProgress?.stage || 'outline';
  const stageIndex = stageOrder.indexOf(stage);
  const stageText = stageIndex >= 0 ? `第 ${Math.min(stageIndex + 1, 4)}/4 步 · ${stageLabel[stage]}` : stageLabel[stage];
  if (!activeProgress?.totalVoices) return stageText;
  const voiceText = `${activeProgress.completedVoices}/${activeProgress.totalVoices} 个思想声音`;
  const currentVoiceText = activeProgress.currentVoiceName ? ` · 正在展开：${activeProgress.currentVoiceName}` : '';
  return `${stageText} · ${voiceText}${currentVoiceText}`;
};

const HistoryPage: React.FC<HistoryPageProps> = ({
  entries,
  activeRun,
  entryHref,
  onOpen,
  onOpenActive,
  onBack,
  onRegeneratePreset,
  canRegeneratePreset,
}) => {
  const activeRunIsRunning = activeRun?.status === 'starting' || activeRun?.status === 'running';
  const activeRunTitle = activeRun?.result?.philosophical_title || activeRun?.topic;
  const activeProgress = activeRun?.progress;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-16 md:pb-20 animate-fade-in -mt-4 md:-mt-12">
      <div className="relative mx-auto max-w-4xl py-7 text-center md:py-14">
        <div className="absolute left-1/2 top-0 hidden h-28 w-px -translate-x-1/2 bg-museum-300/80 md:block" />
        <div
          className="notranslate relative z-10 mb-5 mt-10 inline-flex h-8 select-none items-center justify-center rounded-full border border-museum-300/80 bg-museum-50/90 px-4 shadow-sm backdrop-blur-md md:mb-8 md:mt-12"
          translate="no"
        >
          <Archive className="mr-2 h-3.5 w-3.5 text-museum-600" />
          <span className="whitespace-nowrap text-[10px] font-mono uppercase leading-none tracking-[0.18em] text-museum-700 md:text-xs md:tracking-[0.2em]">Archive of Questions</span>
        </div>
        <h1 className="font-serif text-4xl leading-[0.92] tracking-tight text-museum-900 drop-shadow-sm sm:text-7xl md:text-8xl">
          Sophia's<br />
          <span className="relative inline-block italic">
            History
            <svg className="absolute -bottom-1 -left-[5%] h-2 w-[110%] text-museum-300/50 md:-bottom-2 md:h-4" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl px-2 text-sm leading-relaxed text-museum-700 md:mt-8 md:text-base">
          这里保存你每次提问生成的完整结果页。正在生成的问题也会临时出现在这里，方便你离开后再回来。
        </p>
      </div>

      {activeRun && (
        <button
          onClick={onOpenActive}
          className="w-full text-left mb-8 bg-museum-900 text-museum-50 p-6 md:p-8 shadow-lg hover:bg-black transition-colors group"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 border border-museum-500/70 bg-white/10 flex items-center justify-center shrink-0">
                {activeRunIsRunning && <Loader2 className="w-5 h-5 animate-spin" />}
                {activeRun.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
                {activeRun.status === 'error' && <AlertCircle className="w-5 h-5 text-red-200" />}
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-museum-300 mb-2">
                  {activeRunIsRunning ? '正在生成' : activeRun.status === 'completed' ? '刚刚完成' : '生成出错'}
                  {activeRun.isPresetRegeneration ? ' · 预置样本真实链路' : ''}
                </p>
                <h2 className="font-serif text-2xl md:text-3xl leading-tight mb-3">{activeRunTitle}</h2>
                <p className="text-museum-200 text-sm leading-relaxed">
                  {formatActiveRunProgress(activeProgress)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-200 group-hover:text-white shrink-0">
              回到这个问题 <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      )}

      {entries.length === 0 ? (
        <div className="max-w-2xl mx-auto bg-white/80 border border-museum-200 rounded-xl p-10 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-museum-300 mb-4" />
          <h2 className="font-serif text-3xl text-museum-900 mb-3">还没有历史记录</h2>
          <p className="text-museum-600 mb-6">先提出一个问题，Sophia 会把结果保存到这里。</p>
          <button onClick={onBack} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
            回到首页
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {entries.map((entry) => (
            <div key={entry.id} className="bg-white/85 backdrop-blur-sm border border-museum-200 rounded-xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all group overflow-hidden">
              <a
                href={entryHref?.(entry) || '/history'}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(entry);
                }}
                className="block w-full text-left p-5 md:p-8"
              >
                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-museum-800 bg-museum-100 px-3 py-1 rounded-sm font-semibold border border-museum-200">
                      {entry.modeLabel}
                    </span>
                    {entry.isPreset && (
                      <span className="text-[10px] uppercase tracking-widest text-amber-800 bg-amber-50 px-3 py-1 rounded-sm font-semibold border border-amber-100 inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> {entry.generatedByChain ? '真实链路生成' : '参考样本'}
                      </span>
                    )}
                  </div>
                  <BookOpen className="w-5 h-5 text-museum-300 group-hover:text-museum-900 transition-colors" />
                </div>
                <h2 className="font-serif text-xl md:text-3xl text-museum-900 leading-tight mb-3 md:mb-4 group-hover:underline break-words">
                  {entry.title}
                </h2>
                <p className="text-sm md:text-base text-museum-600 leading-relaxed mb-5 md:mb-6 break-words">{entry.topic}</p>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-400">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.createdAt).toLocaleString('zh-CN')}
                </div>
              </a>
              {entry.isPreset && onRegeneratePreset && (
                <div className="border-t border-museum-100 px-6 md:px-8 py-4 bg-white/55">
                  <button
                    onClick={onRegeneratePreset}
                    disabled={!canRegeneratePreset}
                    className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-600 hover:text-museum-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <RotateCcw className="w-3 h-3" /> 用真实链路重新生成样本
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
