import type { ActiveAnalysisRun, ContinuationContext, GenerationLogEntry, GenerationProgress, RunSnapshotStage } from '../types';
import { appendCappedLog, GENERATION_LOG_LIMIT, checkpointStageForProgress } from './generationLog';

export { appendCappedLog, GENERATION_LOG_LIMIT, checkpointStageForProgress } from './generationLog';

export const createGenerationLogEntry = (
  partial: Omit<GenerationLogEntry, 'id' | 'ts'> & { id?: string; ts?: string },
): GenerationLogEntry => ({
  id: partial.id ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  ts: partial.ts ?? new Date().toISOString(),
  level: partial.level,
  stage: partial.stage,
  message: partial.message,
  tokens: partial.tokens,
});

export const appendRunLog = (run: ActiveAnalysisRun, entry: GenerationLogEntry): ActiveAnalysisRun => ({
  ...run,
  log: appendCappedLog(run.log, entry),
});

export const buildRunSnapshotPayload = (
  run: ActiveAnalysisRun,
  lastCompletedStage: RunSnapshotStage | null = checkpointStageForProgress(run.progress),
  continuationContext?: ContinuationContext,
) => ({
  runId: run.runId,
  topic: run.topic,
  createdAt: run.createdAt,
  updatedAt: new Date().toISOString(),
  status: run.status,
  lastCompletedStage,
  partialResult: run.result,
  continuationContext,
  isPresetRegeneration: run.isPresetRegeneration,
  log: run.log.slice(-GENERATION_LOG_LIMIT),
});

export const progressForRunFailure = (message: string): GenerationProgress => ({
  stage: 'error',
  totalVoices: 0,
  completedVoices: 0,
  messages: [message],
});

export const progressForResume = (run: Pick<ActiveAnalysisRun, 'result'>, lastCompletedStage: RunSnapshotStage | null): GenerationProgress => ({
  stage: lastCompletedStage === 'synthesis' ? 'done' : lastCompletedStage === 'route' ? 'voices' : lastCompletedStage === 'outline' ? 'route' : 'outline',
  modeLabel: run.result?.modeLabel,
  totalVoices: run.result?.voices.length || 0,
  completedVoices: run.result?.voices.filter((voice) => voice.status === 'completed').length || 0,
  messages: ['正在恢复上次的进度...'],
});

export const progressForCompletedResult = (run: Pick<ActiveAnalysisRun, 'result'>): GenerationProgress | null => {
  const data = run.result;
  if (!data) return null;
  return {
    stage: 'done',
    modeLabel: data.modeLabel,
    totalVoices: data.voices.length,
    completedVoices: data.voices.filter((voice) => voice.status === 'completed').length,
    messages: ['这份哲学分析已生成完成。'],
  };
};
