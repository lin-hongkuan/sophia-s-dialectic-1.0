import React from 'react';
import { ActiveAnalysisRun } from '../types';
import { ArrowRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ActiveRunBannerProps {
  activeRun: ActiveAnalysisRun;
  onOpen: () => void;
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

const ActiveRunBanner: React.FC<ActiveRunBannerProps> = ({ activeRun, onOpen }) => {
  const isRunning = activeRun.status === 'starting' || activeRun.status === 'running';
  const isCompleted = activeRun.status === 'completed';
  const isError = activeRun.status === 'error';
  const title = activeRun.result?.philosophical_title || activeRun.topic;
  const progress = activeRun.progress;
  const stage = progress?.stage || 'outline';
  const stageIndex = stageOrder.indexOf(stage);
  const stageText = stageIndex >= 0 ? `第 ${Math.min(stageIndex + 1, 4)}/4 步 · ${stageLabel[stage]}` : stageLabel[stage];
  const progressText = progress?.totalVoices
    ? `${stageText} · ${progress.completedVoices}/${progress.totalVoices} 个思想声音`
    : stageText;
  const currentWork = progress?.currentVoiceName
    ? `正在展开：${progress.currentVoiceName}${typeof progress.streamedChars === 'number' ? ` · ${progress.streamedChars} 字` : ''}`
    : progress?.messages?.slice(-1)[0];
  const statusText = isRunning ? '档案正在整理' : isCompleted ? '新档案已归卷' : '档案整理受阻';
  const actionText = isRunning ? '回到生成' : isCompleted ? '查看结果' : '查看错误';

  return (
    <section className="w-full max-w-3xl mx-auto animate-fade-in px-1 sm:px-0" aria-live={isRunning ? 'polite' : 'off'}>
      <button
        onClick={onOpen}
        className="group relative w-full overflow-hidden border-y border-museum-300/70 bg-museum-50/55 text-left backdrop-blur-[4px] transition-colors hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/50"
      >
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-museum-300/60 to-transparent" aria-hidden="true" />
        <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-5">
          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-museum-300/80 bg-white/45 text-museum-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:mt-0">
              {isRunning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isCompleted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />}
              {isError && <AlertCircle className="h-3.5 w-3.5 text-red-700" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-[9px] font-mono uppercase tracking-[0.22em] text-museum-500 sm:text-[10px]">
                {statusText} · {progressText}
              </p>
              <p className="truncate font-serif text-sm leading-snug text-museum-900 sm:text-base">{title}</p>
              {currentWork && isRunning && (
                <p className="mt-0.5 truncate text-xs text-museum-500">{currentWork}</p>
              )}
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 self-start whitespace-nowrap border-l border-museum-300/60 pl-3 text-[10px] font-mono uppercase tracking-widest text-museum-600 transition-colors group-hover:text-museum-900 sm:self-center">
            {actionText} <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </section>
  );
};

export default ActiveRunBanner;
