export type ProgramMode =
  | 'progressive'
  | 'roundtable'
  | 'genealogy'
  | 'dilemma'
  | 'concept_archaeology'
  | 'thought_experiment'
  | 'school_seminar'
  | 'diagnosis_clinic'
  | 'thought_experiment_panel'
  | 'custom';

export type VoiceKind = 'philosopher' | 'school' | 'concept' | 'position' | 'contemporary';
export type VoiceStatus = 'queued' | 'generating' | 'completed' | 'failed';

export interface QuestionFrame {
  original: string;
  bigQuestion: string;
  plainTranslation: string;
  keywords: string[];
}

export interface ProgramSection {
  id: string;
  title: string;
  description: string;
}

export interface RouteNode {
  id: string;
  title: string;
  role: string;
  plain: string;
  philosophical: string;
  tension?: string;
  nextQuestion?: string;
}

export interface SeminarAxis {
  factualQuestion: string;
  valueQuestion: string;
  factualOptions: string[];
  valueOptions: string[];
  cells: Array<{
    id: string;
    factualOption: string;
    valueOption: string;
    label: string;
    description: string;
  }>;
}

export interface DiagnosisFrame {
  symptomTitle: string;
  symptoms: string[];
  framing: string;
  doctors: Array<{
    voiceId: string;
    diagnosis: string;
    prescription: string;
  }>;
}

export interface ThoughtExperimentFrame {
  poeticVersion?: string;
  unsettlingVersion: string;
  coreChallenge: string;
  stakes: string;
  responseMap: Array<{
    voiceId: string;
    route: string;
  }>;
}

export interface ThoughtVoiceImageAvatar {
  imageUrl: string;
  prompt: string;
  style: string;
  model: string;
  alt: string;
  generatedAt?: string;
  subjectType?: VoiceKind;
}

export interface ThoughtVoice {
  id: string;
  name: string;
  kind: VoiceKind;
  school?: string;
  role: string;
  coreConcept: string;
  oneLine: string;
  stance: string;
  diagnosis?: string;
  prescription?: string;
  thesis?: string;
  critique?: string;
  argument: string;
  quote?: string;
  challenges?: string[];
  summaryForSynthesis: string;
  avatar?: ThoughtVoiceImageAvatar;
  status?: VoiceStatus;
  error?: string;
}

export interface TensionFocus {
  id: string;
  title: string;
  content: string;
  relatedVoiceIds: string[];
}

export interface KeywordExplainer {
  id: string;
  term: string;
  meaning: string;
  importance: string;
}

export interface FollowUpQuestion {
  id: string;
  question: string;
  reason: string;
}

export interface OpenConclusion {
  summary: string;
  openQuestion: string;
  realLifeReturn: string;
}

export interface AnalysisResult {
  id: string;
  createdAt: string;
  topic: string;
  philosophical_title: string;
  mode: ProgramMode;
  modeLabel: string;
  introduction: string;
  questionFrame: QuestionFrame;
  programStructure: ProgramSection[];
  routeMap: RouteNode[];
  voices: ThoughtVoice[];
  tensions: TensionFocus[];
  keywords: KeywordExplainer[];
  followUps: FollowUpQuestion[];
  seminarMatrix?: SeminarAxis;
  diagnosisFrame?: DiagnosisFrame;
  thoughtExperiment?: ThoughtExperimentFrame;
  conclusion: OpenConclusion;
  reasoning_trace?: string[];
}

export interface AnalysisOutline {
  id: string;
  createdAt: string;
  topic: string;
  philosophical_title: string;
  mode: ProgramMode;
  modeLabel: string;
  introduction: string;
  questionFrame: QuestionFrame;
  programStructure: ProgramSection[];
  routeMap: RouteNode[];
  voicePlans: Array<{
    id: string;
    name: string;
    kind: VoiceKind;
    school?: string;
    role: string;
    coreConcept: string;
    oneLine: string;
    stance: string;
    diagnosis?: string;
    prescription?: string;
    thesis?: string;
    critique?: string;
  }>;
  seminarMatrix?: SeminarAxis;
  diagnosisFrame?: DiagnosisFrame;
  thoughtExperiment?: ThoughtExperimentFrame;
  reasoning_trace?: string[];
}

export interface GenerationProgress {
  stage: 'idle' | 'outline' | 'route' | 'voices' | 'synthesis' | 'done' | 'error';
  modeLabel?: string;
  totalVoices: number;
  completedVoices: number;
  currentVoiceName?: string;
  streamedChars?: number;
  messages: string[];
}

export interface AnalyzeCallbacks {
  onProgress?: (progress: GenerationProgress) => void;
  onOutline?: (outline: AnalysisOutline) => void;
  onRouteMap?: (routeMap: RouteNode[]) => void;
  onVoiceStart?: (voiceId: string, voiceName: string) => void;
  onVoiceDelta?: (voiceId: string, delta: string, fullText: string) => void;
  onVoiceComplete?: (voice: ThoughtVoice) => void;
  onSynthesis?: (partial: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>) => void;
  onError?: (message: string) => void;
}

export interface ContinuationContext {
  parentTitle: string;
  parentTopic: string;
  parentQuestion: string;
  parentSummary?: string;
  parentTensions?: string[];
  selectedFollowUpReason?: string;
}

export type AnalysisRunStatus = 'starting' | 'running' | 'completed' | 'error';

export interface ActiveAnalysisRun {
  runId: string;
  topic: string;
  createdAt: string;
  status: AnalysisRunStatus;
  result: AnalysisResult | null;
  progress: GenerationProgress | null;
  error: string | null;
  isPresetRegeneration?: boolean;
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

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export const emptyConclusion: OpenConclusion = {
  summary: '',
  openQuestion: '',
  realLifeReturn: '',
};
