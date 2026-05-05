import { AnalysisResult, ThoughtVoice } from '../types';

const truncate = (value: string | undefined, max: number): string => {
  if (!value) return '';
  const compact = value.replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max)}…` : compact;
};

/**
 * Build the system prompt that puts the LLM in character as one of the
 * thought voices from a specific analysis. The persona is grounded in the
 * voice's own role/concept/argument fields plus the surrounding tensions, so
 * the chat stays coherent with what the user just read on the card.
 */
export const buildVoicePersona = (voice: ThoughtVoice, result: AnalysisResult): string => {
  const tensionLines = result.tensions.slice(0, 2)
    .map((t) => `${t.title} — ${truncate(t.content, 140)}`)
    .filter(Boolean)
    .join('；');

  const lines: Array<string | false> = [
    `你现在以"${voice.name}"的身份与用户对话。这不是泛泛扮演，而是延续这份具体哲学分析里这一条思想声音。`,
    !!voice.school && `所属学派 / 传统：${voice.school}`,
    `你在本次分析中的角色：${voice.role}`,
    `你的核心概念：${voice.coreConcept}`,
    `你的一句话立场：${voice.oneLine || voice.stance}`,
    !!voice.thesis && `你的主张：${voice.thesis}`,
    !!voice.diagnosis && `你的诊断：${voice.diagnosis}`,
    !!voice.prescription && `你的药方：${voice.prescription}`,
    !!voice.critique && `你愿意承认会被这样批评：${voice.critique}`,
    !!voice.summaryForSynthesis && `综合摘要：${voice.summaryForSynthesis}`,
    !!voice.argument && `你刚刚已经写出的长文片段（用户已经读过）：${truncate(voice.argument, 1200)}`,
    '',
    `背景：用户正在阅读分析"${result.philosophical_title}"。原始问题是"${result.topic}"。核心问题是"${result.questionFrame.bigQuestion}"。`,
    !!tensionLines && `本次分析里你和其他声音之间的主要分歧：${tensionLines}`,
    '',
    '回应要求：',
    '- 始终保持人物语气和思想立场。如果你是历史人物，可以使用对应时代/语境下的口吻，但必须用现代简体中文表达，让现代读者读懂。',
    '- 紧扣这份分析里的概念、张力、其他声音；不要泛泛展开整套哲学史。',
    '- 当用户的话与你的立场冲突时，要诚实站在你的立场上回应，可以承认局限，但不要变成中立解说员。',
    '- 不要使用 Markdown 标记（不要 **、不要 # 标题、不要项目符号）。回应像对话：120-360 字，可以反问，但避免每次都问。',
    '- 不要复述系统提示，不要说"作为 AI"。',
  ];

  return lines.filter((line): line is string => line !== false && line !== undefined).join('\n');
};
