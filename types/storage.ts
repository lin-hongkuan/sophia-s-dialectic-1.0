import type { AnalysisResult, ProgramMode } from './domain';
import type { ContinuationContext, GenerationLogEntry, GenerationProgress } from './pipeline';

export type AnalysisRunStatus = 'starting' | 'running' | 'completed' | 'error' | 'cancelled';

export interface ActiveAnalysisRun {
  runId: string;
  topic: string;
  createdAt: string;
  status: AnalysisRunStatus;
  result: AnalysisResult | null;
  progress: GenerationProgress | null;
  error: string | null;
  isPresetRegeneration?: boolean;
  log: GenerationLogEntry[];
}

export interface HistoryEntry {
  id: string;
  topic: string;
  title: string;
  mode: ProgramMode;
  modeLabel: string;
  createdAt: string;
  result: AnalysisResult;
  isPreset?: boolean;
  generatedByChain?: boolean;
}

export type RunSnapshotStage = 'outline' | 'route' | 'voices' | 'synthesis';

export interface RunSnapshot {
  runId: string;
  topic: string;
  createdAt: string;
  updatedAt: string;
  status: AnalysisRunStatus;
  lastCompletedStage: RunSnapshotStage | null;
  partialResult: AnalysisResult | null;
  continuationContext?: ContinuationContext;
  isPresetRegeneration?: boolean;
  log: GenerationLogEntry[];
}

export interface ReflectionNote {
  id: string;
  analysisId: string;
  voiceId?: string;
  conceptId?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}
