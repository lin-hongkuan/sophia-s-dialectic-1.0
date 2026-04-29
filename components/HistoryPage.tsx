import React from 'react';
import { ActiveAnalysisRun, HistoryEntry } from '../types';
import { Archive, ArrowRight, BookOpen, Clock, Loader2, RotateCcw, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';

interface HistoryPageProps {
  entries: HistoryEntry[];
  activeRun?: ActiveAnalysisRun | null;
  onOpen: (entry: HistoryEntry) => void;
  onOpenActive?: () => void;
  onBack: () => void;
  onRegeneratePreset?: () => void;
  canRegeneratePreset?: boolean;
}

const stageLabel: Record<string, string> = {
  idle: '等待',
  outline: '整理问题',
  route: '路线图',
  voices: '思想声音',
  synthesis: '综合判断',
  done: '完成',
  error: '出错',
};

const HistoryPage: React.FC<HistoryPageProps> = ({
  entries,
  activeRun,
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
    <div className="w-full max-w-6xl mx-auto px-4 pb-20 animate-fade-in">
      <div className="text-center py-12 md:py-20">
        <div className="inline-flex items-center gap-2 border border-museum-300 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm mb-6">
          <Archive className="w-4 h-4" />
          <span className="text-xs font-mono uppercase tracking-widest text-museum-800">Archive of Questions</span>
        </div>
        <h1 className="font-serif text-5xl md:text-7xl text-museum-900 leading-tight">History</h1>
        <p className="max-w-2xl mx-auto mt-6 text-museum-700 leading-relaxed">
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
                  {activeProgress?.totalVoices
                    ? `${stageLabel[activeProgress.stage]} · ${activeProgress.completedVoices}/${activeProgress.totalVoices} 个思想声音`
                    : stageLabel[activeProgress?.stage || 'outline']}
                  {activeProgress?.currentVoiceName ? ` · ${activeProgress.currentVoiceName}` : ''}
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
              <button onClick={() => onOpen(entry)} className="w-full text-left p-6 md:p-8">
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
                <h2 className="font-serif text-2xl md:text-3xl text-museum-900 leading-tight mb-4 group-hover:underline">
                  {entry.title}
                </h2>
                <p className="text-museum-600 leading-relaxed mb-6">{entry.topic}</p>
                <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-400">
                  <Clock className="w-3 h-3" />
                  {new Date(entry.createdAt).toLocaleString('zh-CN')}
                </div>
              </button>
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
