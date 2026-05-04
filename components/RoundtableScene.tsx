import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MinusCircle, Pause, Sparkles } from 'lucide-react';
import { AnalysisResult, GenerationLogEntry, GenerationProgress, ThoughtVoice } from '../types';
import { STAGE_LABEL, STAGE_ORDER } from '../constants';
import GenerationLogPanel from './GenerationLogPanel';

interface RoundtableSceneProps {
  isAnalyzing: boolean;
  isFinished: boolean;
  progress?: GenerationProgress | null;
  /**
   * The partial analysis result is the source of truth for the seats. Once
   * the outline lands the orchestrator inserts placeholder voices with
   * status = 'queued'; as voices stream we mutate them in place. We render
   * whichever voices exist on the result, in their original order.
   */
  result?: AnalysisResult | null;
  log?: GenerationLogEntry[];
}

const formatElapsed = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

/**
 * Match the same percentage curve as ReasoningDisplay so users who toggle
 * between layouts get a consistent reading.
 */
const estimatePercent = (stage: GenerationProgress['stage'], total: number, completed: number, streamedChars?: number) => {
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

interface SeatVisual {
  voice: ThoughtVoice;
  state: 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled';
  isCurrent: boolean;
}

const seatStateFromVoice = (voice: ThoughtVoice, currentVoiceName?: string): SeatVisual => {
  const status = voice.status || 'queued';
  const isCurrent = !!currentVoiceName && voice.name === currentVoiceName;
  if (status === 'completed') return { voice, state: 'completed', isCurrent };
  if (status === 'failed') return { voice, state: 'failed', isCurrent };
  if (status === 'cancelled') return { voice, state: 'cancelled', isCurrent };
  if (status === 'generating' || isCurrent) return { voice, state: 'generating', isCurrent };
  return { voice, state: 'queued', isCurrent };
};

const SEAT_STATE_STYLES: Record<SeatVisual['state'], { wrapper: string; chip: string; chipText: string }> = {
  queued: {
    wrapper: 'border-museum-200 bg-museum-50/70 text-museum-500',
    chip: 'bg-museum-100 text-museum-600',
    chipText: '等待登场',
  },
  generating: {
    wrapper: 'border-museum-900 bg-museum-900 text-museum-50 shadow-[0_18px_40px_rgba(44,42,38,0.18)]',
    chip: 'bg-museum-50 text-museum-900',
    chipText: '正在发声',
  },
  completed: {
    wrapper: 'border-museum-200 bg-white text-museum-900 shadow-sm',
    chip: 'bg-emerald-50 text-emerald-700',
    chipText: '声音已就位',
  },
  failed: {
    wrapper: 'border-red-200 bg-red-50/70 text-red-700',
    chip: 'bg-red-100 text-red-700',
    chipText: '声音受阻',
  },
  cancelled: {
    wrapper: 'border-museum-200 bg-museum-50/40 text-museum-400',
    chip: 'bg-museum-100 text-museum-500',
    chipText: '已跳过',
  },
};

const Seat: React.FC<{ visual: SeatVisual; streamedChars?: number }> = ({ visual, streamedChars }) => {
  const { voice, state, isCurrent } = visual;
  const styles = SEAT_STATE_STYLES[state];
  const StateIcon = state === 'completed'
    ? CheckCircle2
    : state === 'failed'
      ? AlertCircle
      : state === 'cancelled'
        ? MinusCircle
        : state === 'generating'
          ? Loader2
          : Pause;

  return (
    <div
      className={`relative flex flex-col gap-3 border p-4 md:p-5 transition-all duration-500 ${styles.wrapper} ${state === 'generating' ? 'ring-2 ring-museum-300/40 ring-offset-2 ring-offset-museum-50/30' : ''}`}
      aria-current={isCurrent || undefined}
    >
      {state === 'generating' && (
        <div className="absolute -inset-px pointer-events-none border border-museum-50/30 motion-safe:animate-pulse" aria-hidden="true" />
      )}

      <div className="flex items-center gap-3">
        <div className={`relative h-12 w-12 shrink-0 overflow-hidden border ${state === 'generating' ? 'border-museum-50/60' : 'border-museum-200'} rounded-full bg-museum-50`}>
          {voice.avatar?.imageUrl ? (
            <img src={voice.avatar.imageUrl} alt={voice.avatar.alt || voice.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-serif text-lg">
              {voice.name?.slice(0, 1) || '?'}
            </div>
          )}
          {state === 'generating' && (
            <div className="absolute inset-0 motion-safe:animate-pulse bg-gradient-to-br from-white/0 via-white/0 to-white/30" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base md:text-lg leading-tight">
            {voice.name || '未命名声音'}
          </p>
          <p className={`truncate text-[10px] font-mono uppercase tracking-widest ${state === 'generating' ? 'text-museum-300' : 'text-museum-500'}`}>
            {voice.role || voice.school || ''}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 px-2 py-1 text-[10px] font-mono uppercase tracking-widest rounded-full ${styles.chip}`}>
          <StateIcon className={`h-3 w-3 ${state === 'generating' ? 'animate-spin' : ''}`} />
          {styles.chipText}
        </span>
      </div>

      <p className={`text-sm leading-relaxed line-clamp-3 ${state === 'generating' ? 'text-museum-100' : state === 'completed' ? 'text-museum-700' : ''}`}>
        {voice.oneLine || voice.stance || '正在准备开口...'}
      </p>

      {state === 'generating' && typeof streamedChars === 'number' && streamedChars > 0 && (
        <p className="text-[10px] font-mono uppercase tracking-widest text-museum-300">
          正在写作 · {streamedChars} 字
        </p>
      )}
      {state === 'failed' && voice.error && (
        <p className="text-[11px] leading-relaxed">原因：{voice.error}</p>
      )}
    </div>
  );
};

const StageDot: React.FC<{ active: boolean; complete: boolean; label: string }> = ({ active, complete, label }) => (
  <div className="flex items-center gap-2">
    <span
      className={`inline-block h-2 w-2 rounded-full transition-all duration-500 ${
        complete ? 'bg-emerald-700' : active ? 'bg-museum-900 ring-4 ring-museum-300/40 motion-safe:animate-pulse' : 'bg-museum-200'
      }`}
      aria-hidden="true"
    />
    <span className={`text-[10px] font-mono uppercase tracking-widest ${active ? 'text-museum-900' : complete ? 'text-emerald-700' : 'text-museum-400'}`}>
      {label}
    </span>
  </div>
);

const RoundtableScene: React.FC<RoundtableSceneProps> = ({ isAnalyzing, isFinished, progress, result, log }) => {
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

  const stage = progress?.stage || 'outline';
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const total = progress?.totalVoices || result?.voices.length || 0;
  const completed = progress?.completedVoices || result?.voices.filter((v) => v.status === 'completed').length || 0;
  const isDone = isFinished || stage === 'done';
  const elapsed = startedAt ? Math.max(0, Math.round((now - startedAt) / 1000)) : 0;
  const percent = isDone ? 100 : estimatePercent(stage, total, completed, progress?.streamedChars);

  const seats = useMemo<SeatVisual[]>(() => {
    if (!result?.voices?.length) return [];
    return result.voices.map((voice) => seatStateFromVoice(voice, progress?.currentVoiceName));
  }, [result?.voices, progress?.currentVoiceName]);

  const synthesisActive = stage === 'synthesis' || (isDone && (result?.tensions?.length ?? 0) > 0);
  const synthesisDone = isDone || (result?.conclusion?.summary?.length ?? 0) > 0;

  if (!isAnalyzing && !progress && !result) return null;

  return (
    <div className={`transition-all duration-700 ease-in-out ${isDone ? 'opacity-90 py-4' : 'opacity-100 py-6 md:py-8'}`}>
      <div className="max-w-5xl mx-auto bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm rounded-xl p-4 md:p-7">
        <div className="flex flex-col gap-2 mb-4 md:flex-row md:items-end md:justify-between md:gap-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400">Sophia's Roundtable</p>
            <h2 className="font-serif text-2xl md:text-3xl text-museum-900 mt-1 leading-tight">
              {result?.philosophical_title || '正在召集这场圆桌'}
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-museum-500 mt-1">
              {STAGE_LABEL[stage]}{progress?.modeLabel ? ` · ${progress.modeLabel}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-museum-500">
            <span>{formatElapsed(elapsed)}</span>
            {total > 0 && <span>{completed}/{total} 个声音就位</span>}
            <span>{isDone ? '100%' : `约 ${percent}%`}</span>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2">
          {STAGE_ORDER.filter((key) => key !== 'done').map((key, idx) => (
            <StageDot
              key={key}
              active={stage === key && !isDone}
              complete={isDone || stageIndex > idx}
              label={STAGE_LABEL[key]}
            />
          ))}
        </div>

        <div className="mb-5 h-1.5 bg-museum-100 rounded-full overflow-hidden">
          <div className="h-full bg-museum-900 transition-all duration-700 ease-out" style={{ width: `${percent}%` }} />
        </div>

        {/* Stage card — the question that the table is gathered around. */}
        {result?.questionFrame?.bigQuestion && (
          <div className="mb-6 mx-auto max-w-3xl border border-museum-200 bg-museum-50/60 px-5 py-4 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400 mb-2">桌面议题</p>
            <p className="font-serif text-lg md:text-xl text-museum-900 leading-snug">{result.questionFrame.bigQuestion}</p>
          </div>
        )}

        {seats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {seats.map((visual) => (
              <Seat
                key={visual.voice.id}
                visual={visual}
                streamedChars={visual.isCurrent ? progress?.streamedChars : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-museum-200 bg-museum-50/40 p-6 text-center text-museum-500 text-sm">
            正在确定本场圆桌的思想席位...
          </div>
        )}

        <div className={`mt-6 border ${synthesisActive || synthesisDone ? 'border-museum-900 bg-museum-900 text-museum-50' : 'border-museum-200 bg-museum-50/60 text-museum-600'} px-5 py-4 transition-all duration-500`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${synthesisActive && !synthesisDone ? 'motion-safe:animate-pulse' : ''}`} />
            <p className="text-[10px] font-mono uppercase tracking-[0.24em]">
              聚合 · {synthesisDone ? '已凝结成判断' : synthesisActive ? '正在收束所有声音' : '声音齐全后才会聚拢'}
            </p>
          </div>
          {synthesisDone && result?.conclusion?.summary && (
            <p className={`mt-2 text-sm leading-relaxed line-clamp-3 ${synthesisActive || synthesisDone ? 'text-museum-100' : 'text-museum-700'}`}>
              {result.conclusion.summary}
            </p>
          )}
        </div>

        {progress?.stage === 'error' && progress.messages?.length ? (
          <div className="mt-5 border-t border-red-100 pt-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-red-700">错误信息</p>
            <p className="mt-1 text-sm text-red-700 leading-relaxed">{progress.messages[progress.messages.length - 1]}</p>
          </div>
        ) : null}

        <GenerationLogPanel entries={log ?? []} isAnalyzing={isAnalyzing} />
      </div>
    </div>
  );
};

export default RoundtableScene;
