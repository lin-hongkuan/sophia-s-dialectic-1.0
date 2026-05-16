import type {
  AnalysisOutline,
  AnalysisResult,
  MagazineImageAsset,
  MagazineImageSlot,
  RouteNode,
  ThoughtExperimentFrame,
  ThoughtVoice,
} from './domain';

export interface GenerationProgress {
  stage: 'idle' | 'outline' | 'route' | 'voices' | 'synthesis' | 'done' | 'error';
  modeLabel?: string;
  totalVoices: number;
  completedVoices: number;
  currentVoiceName?: string;
  streamedChars?: number;
  messages: string[];
}

export type TokenUsageStage =
  | GenerationProgress['stage']
  | 'reframe'
  | 'append'
  | 'reflection'
  | 'suggestion'
  | 'avatar'
  | 'keyword_enrich';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  stage: TokenUsageStage;
  ts: string;
  voiceId?: string;
}

export interface AnalysisMetadata {
  tokenUsage?: TokenUsage[];
  totalTokens?: number;
}

export interface GenerationLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'detail' | 'warn' | 'error';
  stage: TokenUsageStage | 'meta';
  voiceId?: string;
  voiceName?: string;
  message: string;
  tokens?: { prompt: number; completion: number; total: number };
}

export interface AnalyzeCallbacks {
  onProgress?: (progress: GenerationProgress) => void;
  onOutline?: (outline: AnalysisOutline) => void;
  onRouteMap?: (routeMap: RouteNode[]) => void;
  onVoicePlanned?: (voice: ThoughtVoice) => void;
  onVoiceStart?: (voiceId: string, voiceName: string) => void;
  onVoiceDelta?: (voiceId: string, delta: string, fullText: string) => void;
  onVoiceStep?: (voiceId: string, voiceName: string, message: string) => void;
  onVoiceComplete?: (voice: ThoughtVoice) => void;
  onSynthesis?: (partial: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>) => void;
  onThoughtExperimentImage?: (images: Partial<Pick<ThoughtExperimentFrame, 'sceneImage' | 'pressureImage'>>) => void;
  onMagazineImage?: (slot: MagazineImageSlot, image: MagazineImageAsset) => void;
  onError?: (message: string) => void;
  onLog?: (entry: GenerationLogEntry) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
  onControl?: (handle: RunControlHandle) => void;
}

export interface RunControlHandle {
  cancel: (reason?: string) => void;
  skipVoice: (voiceId: string) => void;
  insertVoice: (seed: VoiceInsertSeed) => string;
}

export interface VoiceInsertSeed {
  prompt: string;
}

export interface AppendVoiceCallbacks {
  onVoicePlanned?: (voice: ThoughtVoice) => void;
  onVoiceStart?: (voiceId: string, voiceName: string) => void;
  onVoiceDelta?: (voiceId: string, delta: string, fullText: string) => void;
  onVoiceStep?: (voiceId: string, voiceName: string, message: string) => void;
  onVoiceComplete?: (voice: ThoughtVoice) => void;
  onSynthesis?: (partial: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>) => void;
  onError?: (message: string) => void;
  onLog?: (entry: GenerationLogEntry) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
}

export interface ContinuationContext {
  parentTitle: string;
  parentTopic: string;
  parentQuestion: string;
  parentSummary?: string;
  parentTensions?: string[];
  selectedFollowUpReason?: string;
}

export interface AnalyzeControl {
  signal: AbortSignal;
  shouldSkipVoice?: (voiceId: string) => boolean;
  voiceQueue?: ThoughtVoice[];
}
