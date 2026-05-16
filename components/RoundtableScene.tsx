import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MinusCircle, Pause, Sparkles, X, SkipForward, Plus, ChevronDown, Hammer } from 'lucide-react';
import type { AnalysisResult, ProgramMode, ThoughtVoice } from '../types/domain';
import type { GenerationLogEntry, GenerationProgress } from '../types/pipeline';
import { STAGE_LABEL, STAGE_ORDER } from '../presentation/generationStages';
import { getModePresentation } from '../presentation/modePresentation';
import type { ModePresentation } from '../presentation/modePresentation';
import { estimateGenerationProgress, formatElapsedTime } from '../utils/generationProgress';
import GenerationLogPanel from './GenerationLogPanel';
import RubbingGame from './RubbingGame';

interface RoundtableSceneProps {
  isAnalyzing: boolean;
  isFinished: boolean;
  progress?: GenerationProgress | null;
  startedAt?: string;
  /**
   * The partial analysis result is the source of truth for the seats. Once
   * the outline lands the orchestrator inserts placeholder voices with
   * status = 'queued'; as voices stream we mutate them in place. We render
   * whichever voices exist on the result, in their original order.
   */
  result?: AnalysisResult | null;
  log?: GenerationLogEntry[];
  /**
   * Mid-run controls. Provided by App.tsx, which holds the RunControlHandle
   * returned by analyzeTopic's onControl callback. Optional so this component
   * still works for read-only views (history page, sample preset).
   */
  onCancel?: () => void;
  onSkipVoice?: (voiceId: string) => void;
  onInsertVoice?: (prompt: string) => void;
}

interface SeatVisual {
  voice: ThoughtVoice;
  state: 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled' | 'skipped';
  isCurrent: boolean;
}

const seatStateFromVoice = (voice: ThoughtVoice, currentVoiceName?: string): SeatVisual => {
  const status = voice.status || 'queued';
  const isCurrent = !!currentVoiceName && voice.name === currentVoiceName;
  if (status === 'completed') return { voice, state: 'completed', isCurrent };
  if (status === 'failed') return { voice, state: 'failed', isCurrent };
  if (status === 'cancelled') return { voice, state: 'cancelled', isCurrent };
  if (status === 'skipped') return { voice, state: 'skipped', isCurrent };
  if (status === 'generating' || isCurrent) return { voice, state: 'generating', isCurrent };
  return { voice, state: 'queued', isCurrent };
};

const SEAT_STATE_STYLES: Record<SeatVisual['state'], { wrapper: string; chip: string }> = {
  queued: {
    wrapper: 'border-museum-200 bg-museum-50/70 text-museum-500',
    chip: 'bg-museum-100 text-museum-600',
  },
  generating: {
    wrapper: 'border-museum-900 bg-museum-900 text-museum-50 shadow-[0_18px_40px_rgba(44,42,38,0.18)]',
    chip: 'bg-museum-50 text-museum-900',
  },
  completed: {
    wrapper: 'border-museum-200 bg-white text-museum-900 shadow-sm',
    chip: 'bg-emerald-50 text-emerald-700',
  },
  failed: {
    wrapper: 'border-red-200 bg-red-50/70 text-red-700',
    chip: 'bg-red-100 text-red-700',
  },
  cancelled: {
    wrapper: 'border-museum-200 bg-museum-50/40 text-museum-400',
    chip: 'bg-museum-100 text-museum-500',
  },
  skipped: {
    wrapper: 'border-museum-200 bg-museum-50/40 text-museum-400',
    chip: 'bg-museum-100 text-museum-500',
  },
};

const STATE_FALLBACK_CHIP_TEXT: Record<SeatVisual['state'], string> = {
  queued: '等待登场',
  generating: '正在发声',
  completed: '声音已就位',
  failed: '声音受阻',
  cancelled: '已取消',
  skipped: '已跳过',
};

const chipTextFor = (state: SeatVisual['state'], presentation: ModePresentation): string => {
  if (state === 'queued' || state === 'generating' || state === 'completed') {
    return presentation.chipText[state];
  }
  return STATE_FALLBACK_CHIP_TEXT[state];
};

const Seat: React.FC<{ visual: SeatVisual; presentation: ModePresentation; streamedChars?: number; onSkip?: () => void }> = ({ visual, presentation, streamedChars, onSkip }) => {
  const { voice, state, isCurrent } = visual;
  const styles = SEAT_STATE_STYLES[state];
  const chipText = chipTextFor(state, presentation);
  const StateIcon = state === 'completed'
    ? CheckCircle2
    : state === 'failed'
      ? AlertCircle
      : state === 'cancelled' || state === 'skipped'
        ? MinusCircle
        : state === 'generating'
          ? Loader2
          : Pause;
  const skippable = (state === 'queued' || state === 'generating') && !!onSkip;

  return (
    <div
      className={`relative flex min-h-[218px] flex-col gap-3 border p-4 md:min-h-[232px] md:p-5 transition-all duration-500 ${styles.wrapper} ${state === 'generating' ? 'ring-2 ring-museum-300/40 ring-offset-2 ring-offset-museum-50/30' : ''}`}
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
          {chipText}
        </span>
      </div>

      <p className={`text-sm leading-relaxed line-clamp-3 ${state === 'generating' ? 'text-museum-100' : state === 'completed' ? 'text-museum-700' : ''}`}>
        {voice.oneLine || voice.stance || '正在准备开口...'}
      </p>

      <p className={`min-h-[14px] text-[10px] font-mono uppercase tracking-widest ${state === 'generating' && typeof streamedChars === 'number' && streamedChars > 0 ? 'text-museum-300' : 'invisible'}`}>
        正在写作 · {streamedChars || 0} 字
      </p>
      {state === 'failed' && voice.error && (
        <p className="text-[11px] leading-relaxed">原因：{voice.error}</p>
      )}
      {skippable && (
        <button
          type="button"
          onClick={onSkip}
          aria-label={`跳过 ${voice.name}`}
          className={`mt-1 self-start inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest transition ${
            state === 'generating'
              ? 'border-museum-100/60 bg-white/10 text-museum-100 hover:bg-white/20'
              : 'border-museum-200 text-museum-600 hover:bg-museum-100 hover:text-museum-900'
          }`}
        >
          <SkipForward className="h-3 w-3" />
          跳过这个{presentation.itemLabel}
        </button>
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

const RoundtableScene: React.FC<RoundtableSceneProps> = ({ isAnalyzing, isFinished, progress, startedAt: startedAtIso, result, log, onCancel, onSkipVoice, onInsertVoice }) => {
  const [startedAt, setStartedAt] = useState<number | null>(() => startedAtIso ? Date.parse(startedAtIso) : null);
  const [now, setNow] = useState(Date.now());
  const [insertDraft, setInsertDraft] = useState('');
  const [gameOpen, setGameOpen] = useState(false);
  // Confirm-on-second-click for cancel — accidental clicks shouldn't kill a
  // 30-second-into-it run. Reset whenever isAnalyzing flips so the next run
  // starts with a clean slate.
  const [cancelArmed, setCancelArmed] = useState(false);
  useEffect(() => {
    if (!isAnalyzing) setCancelArmed(false);
  }, [isAnalyzing]);

  useEffect(() => {
    if (startedAtIso) {
      const parsed = Date.parse(startedAtIso);
      setStartedAt(Number.isFinite(parsed) ? parsed : Date.now());
      return;
    }
    if (isAnalyzing && !startedAt) setStartedAt(Date.now());
    if (!isAnalyzing && !progress) setStartedAt(null);
  }, [isAnalyzing, progress, startedAt, startedAtIso]);

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
  const estimate = estimateGenerationProgress({
    progress,
    entries: log ?? [],
    startedAt,
    now,
    result,
    isFinished: isDone,
  });
  const elapsed = Math.round(estimate.elapsedMs / 1000);
  const percent = estimate.percent;

  // Mode-aware copy. Falls back to neutral "声音/核心议题" wording when the
  // outline hasn't landed yet (no result.mode), so the surface never says
  // "圆桌" for a diagnosis_clinic or thought_experiment run.
  const presentation = useMemo(() => getModePresentation(result?.mode as ProgramMode | undefined), [result?.mode]);

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
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400">{presentation.eyebrow}</p>
            <h2 className="font-serif text-2xl md:text-3xl text-museum-900 mt-1 leading-tight">
              {result?.philosophical_title || presentation.pendingTitle}
            </h2>
            <p className="text-xs font-mono uppercase tracking-widest text-museum-500 mt-1">
              {STAGE_LABEL[stage]}{progress?.modeLabel ? ` · ${progress.modeLabel}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono uppercase tracking-widest text-museum-500">
            <span>{formatElapsedTime(elapsed)}</span>
            {total > 0 && <span>{completed}/{total} {presentation.itemUnit}就位</span>}
            <span>{isDone ? '100%' : `约 ${percent}%`}</span>
            {!isDone && <span>{estimate.etaLabel}</span>}
            {isAnalyzing && !isDone && onCancel && (
              <button
                type="button"
                onClick={() => {
                  if (!cancelArmed) {
                    setCancelArmed(true);
                    return;
                  }
                  onCancel();
                }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 transition ${
                  cancelArmed
                    ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                    : 'border-museum-200 text-museum-600 hover:bg-museum-100 hover:text-museum-900'
                }`}
                aria-label={cancelArmed ? '确认取消整次生成' : '准备取消整次生成'}
              >
                <X className="h-3 w-3" />
                {cancelArmed ? '再点一次确认取消' : '取消生成'}
              </button>
            )}
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

        <div className="mb-5 h-1.5 bg-museum-100 rounded-full overflow-hidden" aria-live={isAnalyzing ? 'polite' : 'off'}>
          <div className="h-full bg-museum-900 transition-all duration-700 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>

        {/* Stage card — the question that the analysis is gathered around. */}
        {result?.questionFrame?.bigQuestion && (
          <div className="mb-6 mx-auto max-w-3xl border border-museum-200 bg-museum-50/60 px-5 py-4 text-center">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400 mb-2">{presentation.questionLabel}</p>
            <p className="font-serif text-lg md:text-xl text-museum-900 leading-snug">{result.questionFrame.bigQuestion}</p>
          </div>
        )}

        {seats.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {seats.map((visual) => (
              <Seat
                key={visual.voice.id}
                visual={visual}
                presentation={presentation}
                streamedChars={visual.isCurrent ? progress?.streamedChars : undefined}
                onSkip={
                  isAnalyzing && !isDone && onSkipVoice
                    ? () => onSkipVoice(visual.voice.id)
                    : undefined
                }
              />
            ))}
          </div>
        ) : (
          <div className="border border-dashed border-museum-200 bg-museum-50/40 p-6 text-center text-museum-500 text-sm">
            {presentation.pendingItemsCopy}
          </div>
        )}

        {/* Insert: stays visible throughout the voices stage. The orchestrator
            also accepts inserts during outline / route by buffering them and
            flushing when the voices stage opens, but we hide the affordance
            outside the voices stage to keep expectations crisp. */}
        {isAnalyzing && !isDone && stage === 'voices' && onInsertVoice && (
          <form
            className="mt-5 flex flex-col gap-2 rounded-lg border border-museum-200 bg-museum-50/60 p-4 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = insertDraft.trim();
              if (!trimmed) return;
              onInsertVoice(trimmed);
              setInsertDraft('');
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500">{presentation.insertHeading}</p>
              <p className="mt-0.5 text-[11px] text-museum-500 leading-snug">
                例如「加缪会怎么回应」或「我想听一下罗尔斯」。会被插入到当前队列后面，照样写完正文与头像。
              </p>
            </div>
            <div className="flex flex-1 gap-2 sm:max-w-md">
              <input
                type="text"
                value={insertDraft}
                onChange={(e) => setInsertDraft(e.target.value)}
                placeholder={`加入哪个${presentation.itemLabel}？`}
                className="flex-1 rounded border border-museum-200 bg-white px-3 py-1.5 text-sm focus:border-museum-700 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!insertDraft.trim()}
                className="inline-flex items-center gap-1 rounded border border-museum-700 bg-museum-900 px-3 py-1.5 text-xs text-museum-50 transition hover:bg-museum-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                加入
              </button>
            </div>
          </form>
        )}

        <div className={`mt-6 border ${synthesisActive || synthesisDone ? 'border-museum-900 bg-museum-900 text-museum-50' : 'border-museum-200 bg-museum-50/60 text-museum-600'} px-5 py-4 transition-all duration-500`}>
          <div className="flex items-center gap-2">
            <Sparkles className={`h-4 w-4 ${synthesisActive && !synthesisDone ? 'motion-safe:animate-pulse' : ''}`} />
            <p className="text-[10px] font-mono uppercase tracking-[0.24em]">
              {presentation.synthesisLabel} · {synthesisDone ? '已凝结成判断' : synthesisActive ? `正在收束所有${presentation.itemLabel}` : `${presentation.itemLabel}齐全后才会聚拢`}
            </p>
          </div>
          {synthesisDone && result?.conclusion?.summary && (
            <p className={`mt-2 text-sm leading-relaxed line-clamp-3 ${synthesisActive || synthesisDone ? 'text-museum-100' : 'text-museum-700'}`}>
              {result.conclusion.summary}
            </p>
          )}
        </div>

        {isAnalyzing && !isDone && (
          <div className="mt-5 border-t border-museum-100 pt-4">
            <button
              type="button"
              onClick={() => setGameOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left group"
              aria-expanded={gameOpen}
              aria-controls="roundtable-rubbing-game"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Hammer className="h-4 w-4 shrink-0 text-museum-500 transition-colors group-hover:text-museum-900" />
                <span className="font-serif text-sm text-museum-900">等待时修复一件藏品</span>
                <span className="hidden text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400 sm:inline">
                  Archive Puzzle
                </span>
              </span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-museum-500 transition-transform duration-300 ${gameOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {gameOpen && (
              <div id="roundtable-rubbing-game" className="mt-4 flex justify-center rounded-lg border border-museum-100 bg-museum-50/60 px-3 py-5 animate-fade-in motion-reduce:animate-none">
                <RubbingGame variant="panel" />
              </div>
            )}
          </div>
        )}

        {progress?.stage === 'error' && progress.messages?.length ? (
          <div className="mt-5 border-t border-red-100 pt-4" role="alert">
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
