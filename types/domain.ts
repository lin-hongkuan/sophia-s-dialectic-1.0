import type { AnalysisMetadata } from './pipeline';

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
export type VoiceStatus = 'queued' | 'generating' | 'completed' | 'failed' | 'cancelled' | 'skipped';

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

export interface ThoughtExperimentImage {
  imageUrl: string;
  prompt: string;
  model: string;
  alt: string;
  generatedAt?: string;
  status?: 'completed' | 'failed';
  error?: string;
}

export type MagazineImageSlot = 'cover' | 'conclusion';

export interface MagazineImageAsset {
  imageUrl: string;
  prompt: string;
  model: string;
  alt: string;
  generatedAt?: string;
  status?: 'completed' | 'failed';
  error?: string;
}

export type MagazineImageMap = Partial<Record<MagazineImageSlot, MagazineImageAsset>>;

export interface ThoughtExperimentFrame {
  poeticVersion?: string;
  unsettlingVersion: string;
  coreChallenge: string;
  stakes: string;
  sceneImage?: ThoughtExperimentImage;
  pressureImage?: ThoughtExperimentImage;
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
  avatarError?: string;
  status?: VoiceStatus;
  error?: string;
  addedByUserPrompt?: string;
  addedAt?: string;
}

export interface TensionFocus {
  id: string;
  title: string;
  content: string;
  relatedVoiceIds: string[];
}

export interface KeywordRepresentativeFigure {
  name: string;
  oneLine: string;
}

export interface KeywordExplainer {
  id: string;
  term: string;
  meaning: string;
  importance: string;
  definition?: string;
  misconception?: string;
  representativeFigures?: KeywordRepresentativeFigure[];
  relationToQuestion?: string;
  lifeExample?: string;
  challengeQuestion?: string;
  furtherReading?: string[];
  enriched?: boolean;
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
  magazineImages?: MagazineImageMap;
  conclusion: OpenConclusion;
  reasoning_trace?: string[];
  metadata?: AnalysisMetadata;
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

export const emptyConclusion: OpenConclusion = {
  summary: '',
  openQuestion: '',
  realLifeReturn: '',
};
