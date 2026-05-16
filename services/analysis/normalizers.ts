import type { AnalysisOutline, AnalysisResult, KeywordExplainer, OpenConclusion, ProgramMode, RouteNode, TensionFocus, VoiceKind } from '../../types/domain';
import { emptyConclusion } from '../../types/domain';
import { VALID_MODES } from '../prompts';

export const normalizeMode = (mode: string | undefined): ProgramMode => {
  if (mode && VALID_MODES.has(mode)) return mode as ProgramMode;
  return 'custom';
};

export const normalizeKind = (kind: string | undefined): VoiceKind => {
  if (kind === 'philosopher' || kind === 'school' || kind === 'concept' || kind === 'position' || kind === 'contemporary') return kind;
  return 'philosopher';
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const toText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

export const toTextArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => toText(item)).filter(Boolean) : [];

export const normalizeQuestionFrame = (value: unknown, topic: string, title: string): AnalysisOutline['questionFrame'] => {
  const source = isRecord(value) ? value : {};
  return {
    original: toText(source.original, topic),
    bigQuestion: toText(source.bigQuestion, title || topic),
    plainTranslation: toText(source.plainTranslation),
    keywords: toTextArray(source.keywords),
  };
};

export const normalizeProgramStructure = (value: unknown): AnalysisOutline['programStructure'] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `section-${index + 1}`),
        title: toText(source.title, `阅读节点 ${index + 1}`),
        description: toText(source.description),
      };
    })
    : [];

export const normalizeRouteMap = (value: unknown): RouteNode[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      const node: RouteNode = {
        id: toText(source.id, `route-${index + 1}`),
        title: toText(source.title, `路线节点 ${index + 1}`),
        role: toText(source.role, '节点'),
        plain: toText(source.plain),
        philosophical: toText(source.philosophical),
      };
      const tension = toText(source.tension);
      const nextQuestion = toText(source.nextQuestion);
      if (tension) node.tension = tension;
      if (nextQuestion) node.nextQuestion = nextQuestion;
      return node;
    })
    : [];

export const normalizeVoicePlans = (value: unknown): AnalysisOutline['voicePlans'] =>
  Array.isArray(value)
    ? value.slice(0, 5).map((voice, index) => {
      const source = isRecord(voice) ? voice : {};
      return {
        id: toText(source.id, `voice-${index + 1}`),
        name: toText(source.name, `思想声音 ${index + 1}`),
        kind: normalizeKind(toText(source.kind)),
        school: toText(source.school),
        role: toText(source.role, '思想声音'),
        coreConcept: toText(source.coreConcept),
        oneLine: toText(source.oneLine, toText(source.stance)),
        stance: toText(source.stance, toText(source.oneLine)),
        diagnosis: toText(source.diagnosis),
        prescription: toText(source.prescription),
        thesis: toText(source.thesis),
        critique: toText(source.critique),
      };
    })
    : [];

export const normalizeSeminarMatrix = (value: unknown): AnalysisOutline['seminarMatrix'] => {
  if (!isRecord(value)) return undefined;
  const cells = Array.isArray(value.cells)
    ? value.cells.map((cell, index) => {
      const source = isRecord(cell) ? cell : {};
      return {
        id: toText(source.id, `cell-${index + 1}`),
        factualOption: toText(source.factualOption),
        valueOption: toText(source.valueOption),
        label: toText(source.label, `位置 ${index + 1}`),
        description: toText(source.description),
      };
    })
    : [];

  const matrix = {
    factualQuestion: toText(value.factualQuestion),
    valueQuestion: toText(value.valueQuestion),
    factualOptions: toTextArray(value.factualOptions),
    valueOptions: toTextArray(value.valueOptions),
    cells,
  };

  return matrix.factualQuestion || matrix.valueQuestion || matrix.cells.length > 0 ? matrix : undefined;
};

export const normalizeDiagnosisFrame = (value: unknown): AnalysisOutline['diagnosisFrame'] => {
  if (!isRecord(value)) return undefined;
  const doctors = Array.isArray(value.doctors)
    ? value.doctors.map((doctor, index) => {
      const source = isRecord(doctor) ? doctor : {};
      return {
        voiceId: toText(source.voiceId, `voice-${index + 1}`),
        diagnosis: toText(source.diagnosis),
        prescription: toText(source.prescription),
      };
    })
    : [];

  const frame = {
    symptomTitle: toText(value.symptomTitle),
    symptoms: toTextArray(value.symptoms),
    framing: toText(value.framing),
    doctors,
  };

  return frame.symptomTitle || frame.symptoms.length > 0 || frame.framing || frame.doctors.length > 0 ? frame : undefined;
};

export const normalizeThoughtExperiment = (value: unknown): AnalysisOutline['thoughtExperiment'] => {
  if (!isRecord(value)) return undefined;
  const responseMap = Array.isArray(value.responseMap)
    ? value.responseMap.map((response, index) => {
      const source = isRecord(response) ? response : {};
      return {
        voiceId: toText(source.voiceId, `voice-${index + 1}`),
        route: toText(source.route),
      };
    })
    : [];
  const poeticVersion = toText(value.poeticVersion);
  const frame = {
    ...(poeticVersion ? { poeticVersion } : {}),
    unsettlingVersion: toText(value.unsettlingVersion),
    coreChallenge: toText(value.coreChallenge),
    stakes: toText(value.stakes),
    responseMap,
  };

  return frame.poeticVersion || frame.unsettlingVersion || frame.coreChallenge || frame.stakes || frame.responseMap.length > 0 ? frame : undefined;
};

export const normalizeTensions = (value: unknown): TensionFocus[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `tension-${index + 1}`),
        title: toText(source.title, `分歧 ${index + 1}`),
        content: toText(source.content),
        relatedVoiceIds: toTextArray(source.relatedVoiceIds),
      };
    })
    : [];

const normalizeRepresentativeFigures = (value: unknown): KeywordExplainer['representativeFigures'] => {
  if (!Array.isArray(value)) return undefined;
  const figures = value
    .map((item) => {
      if (!isRecord(item)) return null;
      const name = toText(item.name).trim();
      if (!name) return null;
      return { name, oneLine: toText(item.oneLine).trim() };
    })
    .filter((entry): entry is { name: string; oneLine: string } => entry !== null);
  return figures.length > 0 ? figures : undefined;
};

const optionalText = (value: unknown): string | undefined => {
  const text = toText(value).trim();
  return text || undefined;
};

const optionalTextArray = (value: unknown): string[] | undefined => {
  const arr = toTextArray(value).map((entry) => entry.trim()).filter(Boolean);
  return arr.length > 0 ? arr : undefined;
};

export const isKeywordEnriched = (kw: Pick<KeywordExplainer, 'definition' | 'misconception' | 'representativeFigures' | 'relationToQuestion' | 'lifeExample' | 'challengeQuestion' | 'furtherReading'>): boolean => {
  let count = 0;
  if (kw.definition) count += 1;
  if (kw.misconception) count += 1;
  if (kw.representativeFigures && kw.representativeFigures.length > 0) count += 1;
  if (kw.relationToQuestion) count += 1;
  if (kw.lifeExample) count += 1;
  if (kw.challengeQuestion) count += 1;
  if (kw.furtherReading && kw.furtherReading.length > 0) count += 1;
  return count >= 4;
};

export const normalizeKeyword = (item: unknown, index: number): KeywordExplainer => {
  const source = isRecord(item) ? item : {};
  const definition = optionalText(source.definition);
  const misconception = optionalText(source.misconception);
  const representativeFigures = normalizeRepresentativeFigures(source.representativeFigures);
  const relationToQuestion = optionalText(source.relationToQuestion);
  const lifeExample = optionalText(source.lifeExample);
  const challengeQuestion = optionalText(source.challengeQuestion);
  const furtherReading = optionalTextArray(source.furtherReading);
  const explicitEnriched = typeof source.enriched === 'boolean' ? source.enriched : undefined;
  const longForm = { definition, misconception, representativeFigures, relationToQuestion, lifeExample, challengeQuestion, furtherReading };
  return {
    id: toText(source.id, `keyword-${index + 1}`),
    term: toText(source.term, `关键词 ${index + 1}`),
    meaning: toText(source.meaning),
    importance: toText(source.importance),
    ...longForm,
    enriched: explicitEnriched ?? isKeywordEnriched(longForm),
  };
};

export const normalizeKeywords = (value: unknown): KeywordExplainer[] =>
  Array.isArray(value) ? value.map(normalizeKeyword) : [];

export const normalizeFollowUps = (value: unknown): AnalysisResult['followUps'] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `follow-${index + 1}`),
        question: toText(source.question),
        reason: toText(source.reason),
      };
    }).filter((item) => item.question)
    : [];

export const normalizeQuestionSuggestions = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item).replace(/^[-•\d.、\s]+/, '').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 5);

export const normalizeConclusion = (value: unknown): OpenConclusion => {
  if (!isRecord(value)) return emptyConclusion;
  return {
    summary: toText(value.summary),
    openQuestion: toText(value.openQuestion),
    realLifeReturn: toText(value.realLifeReturn),
  };
};
