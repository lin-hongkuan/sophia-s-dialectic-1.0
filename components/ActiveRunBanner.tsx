import React from 'react';
import { ActiveAnalysisRun } from '../types';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ActiveRunBannerProps {
  activeRun: ActiveAnalysisRun;
  onOpen: () => void;
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

const ActiveRunBanner: React.FC<ActiveRunBannerProps> = ({ activeRun, onOpen }) => {
  const isRunning = activeRun.status === 'starting' || activeRun.status === 'running';
  const isCompleted = activeRun.status === 'completed';
  const isError = activeRun.status === 'error';
  const title = activeRun.result?.philosophical_title || activeRun.topic;
  const progress = activeRun.progress;
  const progressText = progress?.totalVoices
    ? `${progress.completedVoices}/${progress.totalVoices} 个思想声音`
    : stageLabel[progress?.stage || 'outline'];

  return (
    <div className="fixed left-1/2 top-[4.5rem] z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 animate-fade-in">
      <button
        onClick={onOpen}
        className="group w-full border border-museum-200 bg-white/78 backdrop-blur-[5px] shadow-sm hover:shadow-md transition-all text-left"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 w-8 h-8 border border-museum-300 bg-museum-50/80 flex items-center justify-center shrink-0">
              {isRunning && <Loader2 className="w-4 h-4 animate-spin text-museum-800" />}
              {isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              {isError && <AlertCircle className="w-4 h-4 text-red-700" />}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-museum-400 mb-1">
                {isRunning ? '正在生成的问题' : isCompleted ? '刚完成的分析' : '生成遇到问题'} · {progressText}
              </p>
              <p className="font-serif text-lg md:text-xl text-museum-900 truncate">{title}</p>
              {progress?.currentVoiceName && isRunning && (
                <p className="text-xs text-museum-500 mt-1">正在展开：{progress.currentVoiceName}</p>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-600 group-hover:text-museum-900 shrink-0">
            {isRunning ? '回到生成' : isCompleted ? '查看结果' : '查看错误'} <ArrowRight className="w-3 h-3" />
          </span>
        </div>
      </button>
    </div>
  );
};

export default ActiveRunBanner;
