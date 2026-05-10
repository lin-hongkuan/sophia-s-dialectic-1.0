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
}

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
  /** Academic / school definition. Optional — older entries may not have it. */
  definition?: string;
  /** Common misconception users carry into the term. */
  misconception?: string;
  /** Two or three representative thinkers, each with a one-line stance. */
  representativeFigures?: KeywordRepresentativeFigure[];
  /** How the concept reshapes the current question — analysis-specific. */
  relationToQuestion?: string;
  /** A concrete everyday example illustrating the concept. */
  lifeExample?: string;
  /** A counter-question that flips the user's intuition. */
  challengeQuestion?: string;
  /** 3-5 short pointers (book / essay / movement names) for further reading. */
  furtherReading?: string[];
  /** True only after enrichKeyword has filled the long-form fields. */
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
  conclusion: OpenConclusion;
  reasoning_trace?: string[];
  metadata?: AnalysisMetadata;
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
  /** Optional voice id when the call was a per-voice generation. */
  voiceId?: string;
}

export interface AnalysisMetadata {
  tokenUsage?: TokenUsage[];
  totalTokens?: number;
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

export interface GenerationLogEntry {
  id: string;
  ts: string;
  level: 'info' | 'detail' | 'warn' | 'error';
  stage: TokenUsageStage | 'meta';
  voiceId?: string;
  voiceName?: string;
  message: string;
  /** Optional inline token usage for this step, surfaced by the log panel. */
  tokens?: { prompt: number; completion: number; total: number };
}

export interface AnalyzeCallbacks {
  onProgress?: (progress: GenerationProgress) => void;
  onOutline?: (outline: AnalysisOutline) => void;
  onRouteMap?: (routeMap: RouteNode[]) => void;
  /**
   * Fired when a brand-new voice plan enters the queue *outside* the original
   * outline — i.e. a user-driven mid-run insertVoice. The orchestrator emits
   * this BEFORE onVoiceStart so the UI can render a queued placeholder card
   * for inserts (the regular outline-time placeholders are already created
   * via onOutline → createPartialResult).
   *
   * Voices already represented in the outline never trigger this callback.
   */
  onVoicePlanned?: (voice: ThoughtVoice) => void;
  onVoiceStart?: (voiceId: string, voiceName: string) => void;
  onVoiceDelta?: (voiceId: string, delta: string, fullText: string) => void;
  onVoiceStep?: (voiceId: string, voiceName: string, message: string) => void;
  onVoiceComplete?: (voice: ThoughtVoice) => void;
  onSynthesis?: (partial: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>) => void;
  onThoughtExperimentImage?: (images: Partial<Pick<ThoughtExperimentFrame, 'sceneImage' | 'pressureImage'>>) => void;
  onError?: (message: string) => void;
  /** Each emit lands as a row in the GenerationLogPanel. */
  onLog?: (entry: GenerationLogEntry) => void;
  /** Per-network-call token usage, accumulated by the orchestrator. */
  onTokenUsage?: (usage: TokenUsage) => void;
  /**
   * Fired once at run start with a handle the UI can use to cancel the run,
   * skip a stuck voice, or insert an extra voice mid-flight. The orchestrator
   * never references the handle internally — it's purely a control surface
   * for the UI layer (App.tsx → ReasoningDisplay).
   */
  onControl?: (handle: RunControlHandle) => void;
}

/**
 * Mid-run control surface returned via {@link AnalyzeCallbacks.onControl}.
 *
 * All methods are best-effort and idempotent: calling cancel twice, or
 * skipping a voice that already finished, is a no-op. The pipeline stays
 * responsible for surfacing status changes through the existing callbacks
 * (onVoiceComplete with status: 'skipped', onError with cancelled message,
 * etc.) so the UI doesn't need a parallel feedback channel.
 */
export interface RunControlHandle {
  /** Abort every in-flight stage. The orchestrator throws and the run ends. */
  cancel: (reason?: string) => void;
  /**
   * Abort just this one voice's network calls and mark it status: 'skipped'.
   * Safe to call before the voice has started — it will be skipped when the
   * worker pulls it off the queue. No-op if the voice already completed or
   * the voice id is unknown.
   */
  skipVoice: (voiceId: string) => void;
  /**
   * Push a new voicePlan onto the running pipeline. Returns the voice id that
   * will be used for tracking (so the UI can pre-emptively render a "queued"
   * card). The plan is generated and inserted into the worker queue; if
   * voices stage already finished, this becomes a deferred append run after
   * synthesis so the new voice still ends up in the result.
   */
  insertVoice: (seed: VoiceInsertSeed) => string;
}

/** User-supplied hint for what voice to add mid-run via {@link RunControlHandle.insertVoice}. */
export interface VoiceInsertSeed {
  /** Free-form user prompt: "加入加缪的视角" or "我想看罗尔斯的回应". */
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

/**
 * One of the four pipeline stages that can be "completed" — used by the
 * snapshot system to know where to resume from after a refresh or abort.
 * 'synthesis' as the lastCompletedStage means the run is effectively done.
 */
export type RunSnapshotStage = 'outline' | 'route' | 'voices' | 'synthesis';

/**
 * Persisted shape of an in-flight (or just-finished) analysis run. Written
 * incrementally to IndexedDB at every stage boundary so a refresh / crash /
 * cancel can resume from the most recent committed stage instead of redoing
 * the whole pipeline.
 */
export interface RunSnapshot {
  runId: string;
  topic: string;
  createdAt: string;
  /** Last write timestamp; used for TTL cleanup. */
  updatedAt: string;
  status: AnalysisRunStatus;
  /** null when nothing has finished yet (still in initial outline call). */
  lastCompletedStage: RunSnapshotStage | null;
  /**
   * Whatever the orchestrator has produced so far — outline-derived
   * placeholder, partially streamed voices, or full result. Mirrors what
   * Arena / RoundtableScene would render right now.
   */
  partialResult: AnalysisResult | null;
  continuationContext?: ContinuationContext;
  isPresetRegeneration?: boolean;
  log: GenerationLogEntry[];
}

/**
 * Hooks the App layer hands to analyzeTopic / resumeAnalysis so the user can
 * (a) abort the whole pipeline, (b) skip individual voices that haven't
 * started yet, and (c) inject new voice plans into the queue mid-run. The
 * service treats all three as best-effort — each is checked at safe points
 * inside the orchestrator (between stages, before each voice worker picks up
 * its next item).
 */
export interface AnalyzeControl {
  /** Aborting this signal cancels every in-flight fetch and exits the orchestrator. */
  signal: AbortSignal;
  /** Polled before a worker starts a voice; true → mark cancelled and skip. */
  shouldSkipVoice?: (voiceId: string) => boolean;
  /**
   * Drained by the voices stage at safe points. Push a fully-formed voicePlan
   * here from the UI and the orchestrator will pick it up on the next poll.
   * The plan is consumed (shifted) once scheduled.
   */
  voiceQueue?: ThoughtVoice[];
}

/**
 * User-authored note attached to an analysis (and optionally to a specific
 * voice or concept inside it). Stored fully locally — the offline read-only
 * mode treats these as first-class content alongside the generated analysis.
 */
export interface ReflectionNote {
  id: string;
  analysisId: string;
  voiceId?: string;
  conceptId?: string;
  body: string;
  createdAt: string;
  updatedAt: string;
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
