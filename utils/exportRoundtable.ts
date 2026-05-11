/**
 * Markdown export for roundtable sessions.
 *
 * The output structure mirrors the plan's section 12 and intentionally
 * mimics `exportResult.buildResultMarkdown` so the two feel like the same
 * museum catalog. Avatars, API config and raw SSE usage counts are never
 * included — only semantic transcript content.
 */

import type {
  RoundtableMinutes,
  RoundtableParticipant,
  RoundtableSession,
  RoundtableTurn,
} from '../types';
import { interjectionActionLabel } from '../services/roundtablePrompts';

const clean = (value?: string | null) => (value || '').trim();

const participantKindLabel: Record<RoundtableParticipant['kind'], string> = {
  philosopher: '哲学家',
  school: '思想流派',
  position: '现实立场',
  skeptic: '方法论怀疑者',
  moderator: '主持人',
};

const participantLine = (participant: RoundtableParticipant) => [
  `- ${participant.name}`,
  `  · 类型：${participantKindLabel[participant.kind]}`,
  clean(participant.role) ? `  · 角色：${participant.role}` : '',
  clean(participant.stance) ? `  · 立场：${participant.stance}` : '',
  clean(participant.temperament) ? `  · 气质：${participant.temperament}` : '',
].filter(Boolean).join('\n');

const phaseLabel: Record<RoundtableTurn['phase'], string> = {
  opening: '第一幕 · 开场陈述',
  response: '第二幕 · 交锋回应',
  conflict: '第三幕 · 分歧聚焦',
  closing: '第四幕 · 主持人纪要',
};

const renderTurn = (
  turn: RoundtableTurn,
  participantById: Map<string, RoundtableParticipant>,
): string => {
  const content = clean(turn.content);
  if (!content) return '';

  if (turn.kind === 'moderator') {
    return `> **主持人：** ${content}`;
  }

  if (turn.kind === 'user_interjection') {
    const target = turn.targetParticipantId ? participantById.get(turn.targetParticipantId) : undefined;
    const head = target ? `你（主持人 → ${target.name}）` : '你（主持人）';
    const action = turn.action ? `｜动作：${interjectionActionLabel(turn.action)}` : '';
    return `> **${head}${action}：** ${content}`;
  }

  if (turn.kind === 'minutes') {
    return content.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => `> ${line}`).join('\n');
  }

  const speaker = turn.participantId ? participantById.get(turn.participantId) : undefined;
  const reply = turn.replyToParticipantId ? participantById.get(turn.replyToParticipantId) : undefined;
  const header = reply
    ? `**${speaker?.name || '参会者'}**（回应 ${reply.name}）：`
    : `**${speaker?.name || '参会者'}：**`;
  return `${header} ${content}`;
};

const renderPhaseGroup = (
  phase: RoundtableTurn['phase'],
  turns: RoundtableTurn[],
  participantById: Map<string, RoundtableParticipant>,
): string => {
  const rendered = turns
    .map((turn) => renderTurn(turn, participantById))
    .filter(Boolean)
    .join('\n\n');
  if (!rendered) return '';
  return `### ${phaseLabel[phase]}\n\n${rendered}`;
};

const renderMinutes = (minutes: RoundtableMinutes | undefined): string => {
  if (!minutes) return '';
  const parts: string[] = [];
  if (clean(minutes.consensus)) parts.push(`### 共识\n\n${clean(minutes.consensus)}`);
  if (minutes.disagreements.length) {
    parts.push(['### 分歧', minutes.disagreements.filter(Boolean).map((item) => `- ${item}`).join('\n')].filter(Boolean).join('\n\n'));
  }
  if (minutes.unresolvedQuestions.length) {
    parts.push(['### 未解决的问题', minutes.unresolvedQuestions.filter(Boolean).map((item) => `- ${item}`).join('\n')].filter(Boolean).join('\n\n'));
  }
  if (minutes.nextQuestions.length) {
    parts.push(['### 可以继续追问', minutes.nextQuestions.filter(Boolean).map((item, index) => `${index + 1}. ${item}`).join('\n')].filter(Boolean).join('\n\n'));
  }
  if (clean(minutes.realLifeReturn)) parts.push(`### 回到现实\n\n${clean(minutes.realLifeReturn)}`);
  return parts.join('\n\n');
};

export const buildRoundtableMarkdown = (session: RoundtableSession): string => {
  const participantById = new Map(session.participants.map((p) => [p.id, p] as const));
  const phases: RoundtableTurn['phase'][] = ['opening', 'response', 'conflict', 'closing'];

  const transcript = phases
    .map((phase) => renderPhaseGroup(
      phase,
      session.turns.filter((t) => t.phase === phase && t.kind !== 'minutes'),
      participantById,
    ))
    .filter(Boolean)
    .join('\n\n');

  const sections = [
    `# ${session.title || '圆桌会谈'}`,
    [
      `- 主题：${session.topic}`,
      `- 核心问题：${session.coreQuestion}`,
      `- 创建于：${new Date(session.createdAt).toLocaleString('zh-CN')}`,
    ].join('\n'),
    '## 参会者\n\n' + session.participants.map(participantLine).join('\n\n'),
    transcript ? `## 会谈记录\n\n${transcript}` : '',
    renderMinutes(session.minutes) ? `## 主持人纪要\n\n${renderMinutes(session.minutes)}` : '',
  ].filter(Boolean);

  return sections.join('\n\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
};

export const buildRoundtableMarkdownFilename = (session: RoundtableSession): string => {
  const date = (session.createdAt || new Date().toISOString()).slice(0, 10);
  const base = clean(session.title) || clean(session.topic) || 'roundtable';
  const safe = base
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'roundtable';
  return `sophia-roundtable-${safe}-${date}.md`;
};

export const copyRoundtableMarkdown = async (content: string): Promise<boolean> => {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(content);
    return true;
  } catch {
    return false;
  }
};

export const downloadRoundtableMarkdown = (filename: string, content: string): boolean => {
  try {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
};
