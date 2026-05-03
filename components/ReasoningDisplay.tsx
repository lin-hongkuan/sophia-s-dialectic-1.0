import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, BrainCircuit, Search, BookOpen, Scale, CheckCircle2, Circle } from 'lucide-react';
import { GenerationLogEntry, GenerationProgress } from '../types';
import { STAGE_LABEL, STAGE_ORDER } from '../constants';
import GenerationLogPanel from './GenerationLogPanel';

interface ReasoningDisplayProps {
  isAnalyzing: boolean;
  isFinished: boolean;
  progress?: GenerationProgress | null;
  log?: GenerationLogEntry[];
}

const stageSteps: Array<{ key: GenerationProgress['stage']; title: string; description: string; icon: typeof BrainCircuit }> = [
  { key: 'outline', title: '整理问题结构', description: '把原始困惑改写成大问题、关键词和阅读框架。', icon: BrainCircuit },
  { key: 'route', title: '补全论证路线', description: '把分析路径拆成可阅读的节点和张力。', icon: Search },
  { key: 'voices', title: '生成思想声音', description: '并发写作每一种立场的长篇论述与头像。', icon: BookOpen },
  { key: 'synthesis', title: '整理分歧与结论', description: '收束关键词、争论焦点和继续追问。', icon: Scale },
];

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

const formatStageNumber = (stage: string, isDone: boolean) => {
  if (isDone || stage === 'done') return `${stageSteps.length}/${stageSteps.length}`;
  const index = stageSteps.findIndex((step) => step.key === stage);
  return index >= 0 ? `${index + 1}/${stageSteps.length}` : '—';
};

const estimatePercent = (stage: string, total: number, completed: number, streamedChars?: number) => {
  if (stage === 'done') return 100;
  if (stage === 'error') return 0;
  if (stage === 'outline') return 12;
  if (stage === 'route') return 30;
  if (stage === 'synthesis') return 86;
  if (stage !== 'voices') return 0;

  const completedVoicePercent = total > 0 ? (completed / total) * 38 : 0;
  const currentVoiceBoost = total > 0 && completed < total && streamedChars
    ? Math.min(8, Math.floor(streamedChars / 450))
    : 0;
  return Math.min(82, Math.round(42 + completedVoicePercent + currentVoiceBoost));
};

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({ isAnalyzing, isFinished, progress, log }) => {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (isAnalyzing && !startedAt) setStartedAt(Date.now());
    if (!isAnalyzing && !progress) setStartedAt(null);
  }, [isAnalyzing, progress, startedAt]);

  useEffect(() => {
    if (!isAnalyzing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isAnalyzing]);

  if (!isAnalyzing && !progress) return null;

  const currentStage = progress?.stage || 'outline';
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const isDone = isFinished || currentStage === 'done';
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const total = progress?.totalVoices || 0;
  const completed = progress?.completedVoices || 0;
  const percent = isDone ? 100 : estimatePercent(currentStage, total, completed, progress?.streamedChars);
  const stageNumber = formatStageNumber(currentStage, isDone);
  const activeStepIndex = stageSteps.findIndex((step) => step.key === currentStage);
  const completedStageCount = isDone ? stageSteps.length : Math.max(0, activeStepIndex);
  const activeVoiceOrdinal = total > 0 ? Math.min(total, completed + 1) : 0;

  const rotatingHint = useMemo(() => {
    if (currentStage === 'voices' && progress?.currentVoiceName) return `${progress.currentVoiceName} 正在写作，第 ${activeVoiceOrdinal}/${total} 个思想声音`;
    if (currentStage === 'voices') return `正在并发生成 ${total || '多个'} 个思想声音`;
    if (currentStage === 'synthesis') return '思想声音已收束，正在整理分歧、关键词和继续追问';
    if (currentStage === 'route') return '问题结构已完成，正在补全论证路线图';
    if (currentStage === 'done') return '分析已经完成，可以阅读完整结果';
    if (currentStage === 'error') return progress?.messages?.[0] || '生成遇到错误';
    return '正在把原始困惑改写成思想地图';
  }, [activeVoiceOrdinal, currentStage, progress, total]);

  const nextStep = useMemo(() => {
    if (currentStage === 'outline') return '下一步：生成论证路线图';
    if (currentStage === 'route') return '下一步：开始生成各个思想声音';
    if (currentStage === 'voices') return completed >= total && total > 0 ? '下一步：综合判断' : '继续：完成剩余思想声音';
    if (currentStage === 'synthesis') return '下一步：呈现完整分析结果';
    if (currentStage === 'done') return '已完成：可以开始阅读';
    if (currentStage === 'error') return '请查看错误信息后重试';
    return '等待开始';
  }, [completed, currentStage, total]);

  return (
    <div className={`transition-all duration-700 ease-in-out ${isDone ? 'opacity-80 py-4' : 'opacity-100 py-8'}`}>
      <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-4 md:p-6 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 border-b border-museum-100 pb-4">
          <div className="flex items-center space-x-3">
            {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <Loader2 className="w-5 h-5 animate-spin text-museum-800" />}
            <div>
              <span className="font-serif italic text-museum-900">Sophia 的思想工作台</span>
              <p className="text-xs font-mono uppercase tracking-widest text-museum-400 mt-1">
                第 {stageNumber} 步 · {STAGE_LABEL[currentStage]} {progress?.modeLabel ? `· ${progress.modeLabel}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-museum-500 md:justify-end">
            <span>{formatElapsed(elapsed)}</span>
            {total > 0 && <span>{completed}/{total} 个声音完成</span>}
            {typeof progress?.streamedChars === 'number' && <span>当前声音 {progress.streamedChars} 字</span>}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex flex-col gap-1 text-[10px] font-mono uppercase tracking-widest text-museum-400 mb-2 sm:flex-row sm:justify-between sm:gap-4">
            <span>{rotatingHint}</span>
            <span>{isDone ? '100%' : `约 ${percent}%`}</span>
          </div>
          <div className="h-2 bg-museum-100 rounded-full overflow-hidden">
            <div className="h-full bg-museum-900 transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 border border-museum-100 bg-museum-50/50 p-4 md:grid-cols-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-museum-400">当前阶段</p>
            <p className="mt-1 font-serif text-lg text-museum-900">{STAGE_LABEL[currentStage]}</p>
            <p className="mt-1 text-xs text-museum-500">已完成 {completedStageCount}/{stageSteps.length} 个大步骤</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-museum-400">思想声音</p>
            <p className="mt-1 font-serif text-lg text-museum-900">{total > 0 ? `${completed}/${total}` : '等待确定'}</p>
            <p className="mt-1 text-xs text-museum-500 line-clamp-2">{progress?.currentVoiceName ? `正在展开：${progress.currentVoiceName}` : '尚未进入长篇声音生成'}</p>
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-museum-400">接下来</p>
            <p className="mt-1 font-serif text-lg text-museum-900">{nextStep}</p>
            <p className="mt-1 text-xs text-museum-500">进度条为阶段估算，会随完成节点更新</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stageSteps.map((step, idx) => {
            const Icon = step.icon;
            const stepIndex = STAGE_ORDER.indexOf(step.key);
            const active = step.key === currentStage;
            const complete = currentIndex > stepIndex || isDone;
            return (
              <div key={step.key} className={`border p-4 transition-all ${active ? 'bg-museum-900 text-museum-50 border-museum-900' : complete ? 'bg-white/80 border-museum-200' : 'bg-museum-50/70 border-museum-100'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-museum-500 bg-white/10' : 'border-museum-200 bg-white/70'}`}>
                    {complete && !active ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : idx === 0 ? <Icon className="w-4 h-4 text-museum-500" /> : <Circle className="w-3 h-3 text-museum-300" />}
                  </div>
                  <div>
                    <p className={`mb-1 text-[10px] font-mono uppercase tracking-widest ${active ? 'text-museum-300' : complete ? 'text-emerald-700' : 'text-museum-400'}`}>
                      {complete ? '已完成' : active ? '正在进行' : '等待中'} · 第 {idx + 1}/{stageSteps.length} 步
                    </p>
                    <h3 className={`font-serif text-lg ${active ? 'text-museum-50' : 'text-museum-900'}`}>{step.title}</h3>
                    <p className={`text-xs leading-relaxed mt-1 ${active ? 'text-museum-200' : 'text-museum-500'}`}>{step.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {progress?.messages?.length ? (
          <div className="mt-5 border-t border-museum-100 pt-4 space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-widest text-museum-400">最新生成动态</p>
            {progress.messages.slice(-3).map((message, idx) => (
              <p key={`${message}-${idx}`} className="text-sm text-museum-700 leading-relaxed">· {message}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReasoningDisplay;
