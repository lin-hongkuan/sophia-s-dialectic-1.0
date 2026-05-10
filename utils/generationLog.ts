import type { GenerationLogEntry, GenerationProgress, RunSnapshotStage } from '../types';

export const GENERATION_LOG_LIMIT = 300;

export const appendCappedLog = (entries: GenerationLogEntry[], entry: GenerationLogEntry): GenerationLogEntry[] => {
  const next = [...entries, entry];
  return next.length > GENERATION_LOG_LIMIT ? next.slice(-GENERATION_LOG_LIMIT) : next;
};

export const checkpointStageForProgress = (progress: GenerationProgress | null): RunSnapshotStage | null => {
  if (!progress) return null;
  if (progress.stage === 'done' || progress.stage === 'synthesis') return 'synthesis';
  if (progress.stage === 'voices' || progress.stage === 'route') return 'route';
  if (progress.stage === 'outline') return 'outline';
  return null;
};
