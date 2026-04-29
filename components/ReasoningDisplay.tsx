import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, BrainCircuit, Search, BookOpen, Scale, CheckCircle2, Circle } from 'lucide-react';
import { GenerationProgress } from '../types';

interface ReasoningDisplayProps {
  isAnalyzing: boolean;
  isFinished: boolean;
  progress?: GenerationProgress | null;
}

const stageLabel: Record<string, string> = {
  idle: '等待提问',
  outline: '结构整理',
  route: '路线图',
  voices: '思想展开',
  synthesis: '综合判断',
  done: '完成',
  error: '遇到错误',
};

const stageOrder = ['outline', 'route', 'voices', 'synthesis', 'done'];

const stageSteps = [
  { key: 'outline', title: '整理问题结构', description: '把原始困惑改写成大问题、关键词和阅读框架。', icon: BrainCircuit },
  { key: 'route', title: '补全论证路线', description: '把分析路径拆成可阅读的节点和张力。', icon: Search },
  { key: 'voices', title: '生成思想声音', description: '并发写作每一种立场的长篇论述。', icon: BookOpen },
  { key: 'synthesis', title: '整理分歧与结论', description: '收束关键词、争论焦点和继续追问。', icon: Scale },
];

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({ isAnalyzing, isFinished, progress }) => {
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
  const currentIndex = stageOrder.indexOf(currentStage);
  const isDone = isFinished || currentStage === 'done';
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const total = progress?.totalVoices || 0;
  const completed = progress?.completedVoices || 0;
  const stageBasePercent = currentStage === 'outline' ? 12 : currentStage === 'route' ? 28 : currentStage === 'voices' ? 45 : currentStage === 'synthesis' ? 82 : currentStage === 'done' ? 100 : 0;
  const voicePercent = total > 0 ? Math.round((completed / total) * 32) : 0;
  const percent = currentStage === 'voices' ? Math.min(78, 45 + voicePercent) : stageBasePercent;

  const rotatingHint = useMemo(() => {
    if (currentStage === 'voices' && progress?.currentVoiceName) return `${progress.currentVoiceName} 正在写作`;
    if (currentStage === 'voices') return '多个思想声音正在并发生成';
    if (currentStage === 'synthesis') return '正在把分歧、关键词和继续追问收束到一起';
    if (currentStage === 'route') return '正在把问题拆成可以阅读的路线';
    if (currentStage === 'done') return '分析已经完成';
    if (currentStage === 'error') return progress?.messages?.[0] || '生成遇到错误';
    return '正在把原始困惑改写成思想地图';
  }, [currentStage, progress]);

  return (
    <div className={`transition-all duration-700 ease-in-out ${isDone ? 'opacity-80 py-4' : 'opacity-100 py-8'}`}>
      <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-6 rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5 border-b border-museum-100 pb-4">
          <div className="flex items-center space-x-3">
            {isDone ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <Loader2 className="w-5 h-5 animate-spin text-museum-800" />}
            <div>
              <span className="font-serif italic text-museum-900">Sophia 的思想工作台</span>
              <p className="text-xs font-mono uppercase tracking-widest text-museum-400 mt-1">
                {stageLabel[currentStage]} {progress?.modeLabel ? `· ${progress.modeLabel}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono uppercase tracking-widest text-museum-500">
            <span>{formatElapsed(elapsed)}</span>
            {total > 0 && <span>{completed}/{total} voices</span>}
            {typeof progress?.streamedChars === 'number' && <span>{progress.streamedChars} chars</span>}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-museum-400 mb-2">
            <span>{rotatingHint}</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-museum-100 rounded-full overflow-hidden">
            <div className="h-full bg-museum-900 transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {stageSteps.map((step, idx) => {
            const Icon = step.icon;
            const stepIndex = stageOrder.indexOf(step.key);
            const active = step.key === currentStage;
            const complete = currentIndex > stepIndex || isDone;
            return (
              <div key={step.key} className={`border p-4 transition-all ${active ? 'bg-museum-900 text-museum-50 border-museum-900' : complete ? 'bg-white/80 border-museum-200' : 'bg-museum-50/70 border-museum-100'}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${active ? 'border-museum-500 bg-white/10' : 'border-museum-200 bg-white/70'}`}>
                    {complete && !active ? <CheckCircle2 className="w-4 h-4 text-emerald-700" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : idx === 0 ? <Icon className="w-4 h-4 text-museum-500" /> : <Circle className="w-3 h-3 text-museum-300" />}
                  </div>
                  <div>
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
            {progress.messages.slice(-3).map((message, idx) => (
              <p key={`${message}-${idx}`} className="text-sm font-mono text-museum-700 leading-relaxed">{message}</p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReasoningDisplay;
