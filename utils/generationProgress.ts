import { STAGE_LABEL } from '../constants';
import { AnalysisResult, GenerationLogEntry, GenerationProgress } from '../types';

export type ProgressConfidence = 'low' | 'medium' | 'high';

export interface GenerationProgressEstimate {
  percent: number;
  elapsedMs: number;
  etaMs?: number;
  etaLabel: string;
  confidence: ProgressConfidence;
  stageLabel: string;
}

interface StageRange {
  start: number;
  end: number;
}

const STAGE_RANGES: Record<GenerationProgress['stage'], StageRange> = {
  idle: { start: 0, end: 0 },
  outline: { start: 2, end: 18 },
  route: { start: 18, end: 30 },
  voices: { start: 30, end: 82 },
  synthesis: { start: 82, end: 96 },
  done: { start: 100, end: 100 },
  error: { start: 0, end: 0 },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const stageStartTime = (entries: GenerationLogEntry[], stage: GenerationProgress['stage']): number | undefined => {
  const entry = entries.find((item) => item.stage === stage);
  if (!entry) return undefined;
  const parsed = Date.parse(entry.ts);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const estimateStageFraction = (
  progress: GenerationProgress,
  entries: GenerationLogEntry[],
  nowMs: number,
  result?: AnalysisResult | null,
): { fraction: number; confidence: ProgressConfidence } => {
  const stage = progress.stage;
  if (stage === 'done') return { fraction: 1, confidence: 'high' };
  if (stage === 'error' || stage === 'idle') return { fraction: 0, confidence: 'low' };

  const startedAt = stageStartTime(entries, stage);
  const stageElapsed = startedAt ? Math.max(0, nowMs - startedAt) : 0;

  if (stage === 'outline') {
    return { fraction: clamp(stageElapsed / 90_000, 0.08, 0.86), confidence: 'low' };
  }

  if (stage === 'route') {
    return { fraction: clamp(stageElapsed / 75_000, 0.08, 0.9), confidence: 'low' };
  }

  if (stage === 'synthesis') {
    return { fraction: clamp(stageElapsed / 90_000, 0.12, 0.9), confidence: 'low' };
  }

  const total = progress.totalVoices || result?.voices.length || 0;
  const completed = progress.completedVoices || result?.voices.filter((voice) => voice.status === 'completed').length || 0;
  const failedOrSkipped = result?.voices.filter((voice) => voice.status === 'failed' || voice.status === 'skipped' || voice.status === 'cancelled').length || 0;
  const settled = completed + (failedOrSkipped || 0);
  const settledFraction = total > 0 ? settled / total : 0;
  const currentVoiceBoost = total > 0 && settled < total && typeof progress.streamedChars === 'number'
    ? clamp(progress.streamedChars / 2_400 / total, 0, 0.16)
    : 0;
  return {
    fraction: clamp(settledFraction + currentVoiceBoost, total > 0 ? 0.04 : 0, 0.96),
    confidence: total > 0 && completed > 0 ? 'high' : 'medium',
  };
};

const formatEta = (etaMs: number | undefined, confidence: ProgressConfidence): string => {
  if (!etaMs || !Number.isFinite(etaMs) || etaMs <= 0) return confidence === 'low' ? '正在估算剩余时间' : '预计时间计算中';
  const minutes = Math.max(1, Math.ceil(etaMs / 60_000));
  const lower = Math.max(1, Math.floor(minutes * 0.75));
  const upper = Math.max(lower + 1, Math.ceil(minutes * 1.35));
  const prefix = confidence === 'low' ? '粗略预计' : '预计还需';
  return `${prefix} ${lower}–${upper} 分钟`;
};

export const formatElapsedTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
};

export const estimateGenerationProgress = ({
  progress,
  entries = [],
  startedAt,
  now = Date.now(),
  result,
  isFinished = false,
}: {
  progress?: GenerationProgress | null;
  entries?: GenerationLogEntry[];
  startedAt?: string | number | null;
  now?: number;
  result?: AnalysisResult | null;
  isFinished?: boolean;
}): GenerationProgressEstimate => {
  const startedAtMs = typeof startedAt === 'string' ? Date.parse(startedAt) : startedAt;
  const elapsedMs = startedAtMs && Number.isFinite(startedAtMs) ? Math.max(0, now - startedAtMs) : 0;
  const stage = progress?.stage || 'outline';

  if (isFinished || stage === 'done') {
    return {
      percent: 100,
      elapsedMs,
      etaMs: 0,
      etaLabel: '已完成',
      confidence: 'high',
      stageLabel: STAGE_LABEL.done,
    };
  }

  const syntheticProgress: GenerationProgress = progress ?? {
    stage,
    totalVoices: 0,
    completedVoices: 0,
    messages: [],
  };
  const range = STAGE_RANGES[stage] || STAGE_RANGES.outline;
  const { fraction, confidence } = estimateStageFraction(syntheticProgress, entries, now, result);
  const percent = stage === 'error'
    ? 0
    : Math.round(clamp(range.start + (range.end - range.start) * fraction, range.start, range.end));
  const etaMs = percent > 5 && percent < 100 && elapsedMs > 0 ? Math.max(0, (elapsedMs / percent) * (100 - percent)) : undefined;

  return {
    percent,
    elapsedMs,
    etaMs,
    etaLabel: formatEta(etaMs, confidence),
    confidence,
    stageLabel: STAGE_LABEL[stage] || STAGE_LABEL.outline,
  };
};
