import type { AnalysisProfile } from './sophiaConfig';

const depthInstruction: Record<AnalysisProfile['depth'], string> = {
  concise: [
    'Depth: concise.',
    'Prefer 2-3 thought voices, a tighter route map, shorter opening and synthesis, and direct conclusions.',
    'Voice essays should usually be about 900-1300 Chinese characters unless the user explicitly asks for depth.',
  ].join(' '),
  standard: [
    'Depth: standard.',
    'Keep Sophia\'s default density: 3-4 thought voices, enough conceptual tension, and complete but not sprawling explanations.',
    'Voice essays should usually be about 1800-2400 Chinese characters.',
  ].join(' '),
  deep: [
    'Depth: deep.',
    'Prefer 4-5 thought voices when the topic supports it, stronger counterarguments, clearer tradeoffs, and a fuller synthesis.',
    'Voice essays should usually be about 2600-3600 Chinese characters.',
  ].join(' '),
};

const styleInstruction: Record<AnalysisProfile['expressionStyle'], string> = {
  academic: [
    'Expression: academically rigorous.',
    'Define conceptual boundaries, name theoretical assumptions, state qualifications, and avoid casual simplification.',
  ].join(' '),
  plain: [
    'Expression: plain and clear.',
    'Translate the issue into everyday language before technical terms, and explain every important term when it first appears.',
  ].join(' '),
  sharp: [
    'Expression: sharp diagnostic.',
    'Name contradictions, evasions, value costs, and uncomfortable implications directly while staying fair and precise.',
  ].join(' '),
};

const evidenceInstruction: Record<AnalysisProfile['evidenceFocus'], string> = {
  theory: [
    'Evidence focus: theory-first.',
    'Use more concepts, schools, classic problems, and intellectual-history relations; keep everyday examples secondary.',
  ].join(' '),
  balanced: [
    'Evidence focus: balanced.',
    'Pair conceptual explanation with concrete examples so neither theory nor daily life dominates.',
  ].join(' '),
  practical: [
    'Evidence focus: practical-first.',
    'Use more concrete scenes from work, relationships, education, technology, public life, and daily decisions; avoid purely abstract drift.',
  ].join(' '),
};

export const buildAnalysisProfileInstruction = (profile: AnalysisProfile): string => [
  'Runtime analysis profile.',
  'If this profile conflicts with older numeric length hints in the base prompt, follow this profile.',
  depthInstruction[profile.depth],
  styleInstruction[profile.expressionStyle],
  evidenceInstruction[profile.evidenceFocus],
].join('\n');
