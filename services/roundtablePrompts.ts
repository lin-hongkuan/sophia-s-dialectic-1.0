/**
 * System / user prompts for the Roundtable feature.
 *
 * Kept in a dedicated module (mirroring `prompts.ts` for the analyze pipeline)
 * so all wording edits happen in one place. The roundtable never reuses the
 * analysis prompts because the shape of the task is different: instead of
 * writing a long-form essay, we orchestrate turn-based discussion with
 * planned seats, cross-replies and moderator control.
 *
 * Callers pass `promptOverrides` through if they ever need to let Settings
 * customise these blocks — for the first release we keep them hard-coded
 * and let the service read them directly.
 */

import type {
  RoundtableInterjectionSeed,
  RoundtableParticipant,
  RoundtableSession,
  RoundtableTurn,
  RoundtableTurnDirective,
} from '../types';

/* ----------------------- Planning stage ----------------------- */

export const ROUNDTABLE_PLANNING_SYSTEM = `
Role: You are Sophia, a world-class philosophy moderator who convenes serious, cross-tradition roundtables.
Your job here is to design the roster and opening brief for a live roundtable discussion.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Every user-facing string in the JSON must be Simplified Chinese (zh-CN), except participant.kind (english enum).
2. OUTPUT FORMAT: Return a single JSON object. No markdown, no code fences, no prose outside JSON.
3. ROSTER CONSTRAINTS:
   - Exactly 4 participants. Do not return 3 or 5.
   - The roster MUST be mixed — roughly:
     · 1 real, historical or classical philosopher/thinker (kind = "philosopher").
     · 1 thought school or theoretical tradition (kind = "school").
     · 1 contemporary real-world stance or practitioner (kind = "position").
     · 1 sceptic, method-critic or opposing-method voice (kind = "skeptic").
   - Never return 4 philosophers, 4 schools, or otherwise homogeneous seats.
   - Avoid recycling default names (Kant / Nietzsche / Socrates) unless they are the technically strongest pick.
4. DEFINITIONS:
   - role          : one-line description of the functional slot the seat fills in this specific discussion.
   - stance        : the actual thesis/position this seat will defend, in 1-2 rigorous sentences.
   - temperament   : short speaking-style and temperament hint (e.g. "谨慎、善于引用、讲历史例证").
   - conflictWith  : list of other participant ids in this roster that this seat is expected to clash with. May be empty.
5. OPENING: moderatorOpening must be 2-3 sentences in zh-CN, framing the question, introducing the stakes, and naming the first expected speaker by id.
6. RIGOUR: Title and coreQuestion must read like a serious seminar topic, not a headline. No clickbait, no hedging words like "或许".

JSON shape (strict):
{
  "title": string,
  "coreQuestion": string,
  "moderatorOpening": string,
  "participants": [
    {
      "id": string,            // e.g. "p1".."p4", stable across the session
      "name": string,
      "kind": "philosopher" | "school" | "position" | "skeptic",
      "role": string,
      "stance": string,
      "temperament": string,
      "conflictWith": string[] // other participant ids in this same response
    }
  ]
}
`.trim();

export const buildRoundtablePlanningUser = (topic: string): string => `
用户主题：${topic}

请设计一场 4 人圆桌会谈。严格遵循系统提示词里关于混合席位与 JSON 形式的所有要求。
`.trim();

/* ----------------------- Turn stage ----------------------- */

export const ROUNDTABLE_TURN_SYSTEM = `
Role: You are the single participant currently speaking at Sophia's roundtable.
You are NOT the moderator and you do NOT summarise the whole discussion.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Simplified Chinese (zh-CN).
2. OUTPUT: Plain prose only. No JSON, no Markdown headings, no quotation marks around the whole reply, no narration ("我将发言……"), no speaker label.
3. LENGTH: 120–220 Chinese characters. One natural paragraph.
4. VOICE DISCIPLINE:
   - Speak strictly in the assigned persona — use the given stance, role and temperament.
   - Do not impersonate other participants. Do not describe what others will say next.
   - Do not pre-empt the final conclusion. Leave space for continued discussion.
5. PHASE BEHAVIOUR:
   - opening  : Stake out your position clearly; do NOT yet respond to anyone.
   - response : Quote ONE specific claim from the participant you are replying to; say whether you agree, refine or reject it, and why.
   - conflict : Push the current core disagreement forward — add a new reason, distinction or example, don't just repeat your opening.
   - closing  : You may acknowledge what is at stake and what remains open.
6. ACTION MODIFIERS (if provided):
   - ask     : ask the target seat a sharp follow-up question.
   - rebut   : challenge the last speaker's strongest premise head-on.
   - example : give a concrete real-life example that anchors the abstract claim.
   - cost    : name the cost or trade-off your own position has to pay.
   - close   : offer a compact statement that prepares for the moderator's closing.
7. If a user interjection is attached below, you MUST engage with it directly — quote it, and answer the specific thing it asks.

Never include your own name or the moderator's stage directions in the reply.
`.trim();

/**
 * Summarise earlier transcript into short context. We cap the window so long
 * sessions don't blow up the prompt; the running summary supplements it.
 */
const summariseTurn = (turn: RoundtableTurn, participantName: string): string => {
  const text = (turn.content || '').trim().replace(/\s+/g, ' ');
  const clipped = text.length > 160 ? `${text.slice(0, 160)}…` : text;
  const header = turn.kind === 'moderator'
    ? '主持人'
    : turn.kind === 'user_interjection'
      ? '用户（主持人身份）'
      : turn.kind === 'minutes'
        ? '主持人 · 会议纪要'
        : participantName;
  return `${header}：${clipped}`;
};

const participantCard = (participant: RoundtableParticipant): string => [
  `- id=${participant.id}`,
  `  name=${participant.name}`,
  `  kind=${participant.kind}`,
  `  role=${participant.role}`,
  `  stance=${participant.stance}`,
  `  temperament=${participant.temperament}`,
].join('\n');

/** Build the user-message payload for a single turn. */
export const buildRoundtableTurnUser = (
  session: RoundtableSession,
  directive: RoundtableTurnDirective,
  rollingSummary: string,
  currentParticipant: RoundtableParticipant,
  recentTurns: RoundtableTurn[],
  userInterjection?: RoundtableTurn,
): string => {
  const participantIndex = new Map(session.participants.map((p) => [p.id, p] as const));
  const transcript = recentTurns
    .map((turn) => {
      const participant = turn.participantId ? participantIndex.get(turn.participantId) : undefined;
      return summariseTurn(turn, participant?.name || '参会者');
    })
    .join('\n');

  const replyTo = directive.replyToParticipantId
    ? participantIndex.get(directive.replyToParticipantId)
    : undefined;

  const target = directive.participantId
    ? participantIndex.get(directive.participantId)
    : undefined;

  const roster = session.participants.map(participantCard).join('\n');

  const parts: string[] = [
    `圆桌主题：${session.topic}`,
    `会谈标题：${session.title}`,
    `核心问题：${session.coreQuestion}`,
    `当前阶段：${directive.phase}`,
    '',
    '席位名单（你只能以“你本人”的 id 发言）：',
    roster,
    '',
    `你的身份 id = ${currentParticipant.id}（${currentParticipant.name}）`,
    `你的立场：${currentParticipant.stance}`,
    `你的气质：${currentParticipant.temperament}`,
  ];

  if (target && target.id !== currentParticipant.id) {
    parts.push(`主持人点名对象：${target.name}（${target.id}）`);
  }

  if (replyTo) {
    parts.push(`你必须回应：${replyTo.name}（${replyTo.id}）的最近一次发言，引用其中一个具体主张。`);
  }

  if (directive.action) {
    parts.push(`动作要求：${directive.action}`);
  }

  if (rollingSummary) {
    parts.push('', '到目前为止的要点（供上下文，不要直接复述）：', rollingSummary);
  }

  if (transcript) {
    parts.push('', '最近 transcript：', transcript);
  }

  if (userInterjection) {
    parts.push(
      '',
      '用户插话（你必须在本轮发言里直接回应这条插话）：',
      `用户：${userInterjection.content.trim()}`,
    );
    if (userInterjection.action) {
      parts.push(`用户动作意图：${userInterjection.action}`);
    }
  }

  parts.push('', '请严格按系统提示词输出一段 120-220 字的中文发言。');
  return parts.join('\n');
};

/* ----------------------- Rolling summary ----------------------- */

export const ROUNDTABLE_SUMMARY_SYSTEM = `
你是 Sophia 的会议速记员。把截至目前的圆桌进展压缩成一段 150 字以内的中文要点：保留已经出现过的真实分歧与关键举证，不加入新观点，不出现任何人没有说过的话。输出纯文本。
`.trim();

export const buildRoundtableSummaryUser = (session: RoundtableSession): string => {
  const recent = session.turns.slice(-12);
  const index = new Map(session.participants.map((p) => [p.id, p] as const));
  const lines = recent.map((turn) => {
    const participant = turn.participantId ? index.get(turn.participantId) : undefined;
    return summariseTurn(turn, participant?.name || '参会者');
  });
  return [
    `主题：${session.topic}`,
    `核心问题：${session.coreQuestion}`,
    '',
    lines.join('\n'),
  ].join('\n');
};

/* ----------------------- Moderator directive helper ----------------------- */

/**
 * The transcript-facing moderator block is pure markup (stage direction),
 * not an LLM call. We still keep the wording here so the UI + service share
 * a vocabulary for how the moderator addresses the room.
 */
export const buildModeratorLine = (
  kind:
    | { type: 'open' }
    | { type: 'invite_opening'; participantName: string }
    | { type: 'ask_response'; participantName: string; targetName: string }
    | { type: 'escalate_conflict'; disagreementTopic: string }
    | { type: 'acknowledge_user_interjection'; participantName: string }
    | { type: 'before_closing' },
  session: RoundtableSession,
): string => {
  switch (kind.type) {
    case 'open':
      return `欢迎来到圆桌。围绕「${session.title}」，我们先请每位参会者用一段简短的开场陈述说明自己的立场。`;
    case 'invite_opening':
      return `请 ${kind.participantName} 作开场陈述，说明你在这个问题上的立场和理由。`;
    case 'ask_response':
      return `${kind.participantName}，请对 ${kind.targetName} 刚才的发言作一次明确的回应——赞同、反驳或重新界定其中的一个具体主张。`;
    case 'escalate_conflict':
      return `我想把焦点放在一处真正的分歧上：${kind.disagreementTopic}。请相关几位再各说一次，尽量推进这个分歧，而不是重复开场立场。`;
    case 'acknowledge_user_interjection':
      return `刚才用户从主持人席位插入了一个追问，请 ${kind.participantName} 直接回答。`;
    case 'before_closing':
      return '谢谢各位。让我收束一下本次圆桌的主要共识与未解决的问题。';
    default:
      return '';
  }
};

/** Map a user interjection action to a short Chinese label for transcript UI. */
export const interjectionActionLabel = (action: RoundtableInterjectionSeed['action']): string => {
  switch (action) {
    case 'ask': return '追问';
    case 'rebut': return '反驳';
    case 'example': return '请举例';
    case 'cost': return '追问代价';
    case 'close': return '收束会议';
    default: return '追问';
  }
};

/* ----------------------- Minutes stage ----------------------- */

export const ROUNDTABLE_MINUTES_SYSTEM = `
Role: You are Sophia, the moderator writing the closing minutes of this roundtable.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Simplified Chinese (zh-CN).
2. OUTPUT: Return a single JSON object, no markdown / prose outside JSON.
3. FIDELITY: Every sentence must be grounded in what the transcript ACTUALLY contains. Do not invent new arguments. Do not introduce positions that were never voiced.
4. SHAPE: The JSON must have exactly the following keys and types:

{
  "consensus": string,                  // 2-3 sentences on what the seats actually agree on
  "disagreements": string[],            // 2-4 items, each a concrete disagreement between named seats
  "unresolvedQuestions": string[],      // 2-4 items, strongest questions each seat leaves behind
  "nextQuestions": string[],            // exactly 3 items, worth pursuing next if the user continues
  "realLifeReturn": string              // 1-2 sentences returning the conversation to real-life choice
}

5. STYLE: Serious, seminar-grade Chinese. No exclamation marks, no emojis, no meta-commentary about the JSON.
`.trim();

export const buildRoundtableMinutesUser = (session: RoundtableSession): string => {
  const index = new Map(session.participants.map((p) => [p.id, p] as const));
  const transcript = session.turns
    .map((turn) => {
      const participant = turn.participantId ? index.get(turn.participantId) : undefined;
      return summariseTurn(turn, participant?.name || '参会者');
    })
    .join('\n');
  return [
    `主题：${session.topic}`,
    `标题：${session.title}`,
    `核心问题：${session.coreQuestion}`,
    '',
    '席位：',
    session.participants.map(participantCard).join('\n'),
    '',
    '完整 transcript（按时间顺序）：',
    transcript,
    '',
    '请严格依据上面的 transcript 生成会议纪要 JSON。',
  ].join('\n');
};

/* ----------------------- Avatar prompt ----------------------- */

export const buildRoundtableAvatarPrompt = (
  topic: string,
  sessionTitle: string,
  participant: RoundtableParticipant,
  baseStyle: string,
  historicalStyle: string,
  negativePrompt: string,
  historicalNegativePrompt: string,
  aspectHint: string,
): string => {
  const isHistorical = participant.kind === 'philosopher';
  const subject = isHistorical
    ? 'a recognizable historical portrait interpretation of the named real philosopher; preserve the thinker\'s known facial structure, hair, clothing era, posture and intellectual temperament while keeping Sophia\'s restrained museum-catalog style.'
    : participant.kind === 'school'
      ? 'a fictional archetypal figure who embodies the temperament of this school of thought; symbolic, never a real person.'
      : participant.kind === 'position'
        ? 'a fictional contemporary figure holding this real-world stance; ordinary modern attire, museum-catalog framing, no celebrity likeness.'
        : participant.kind === 'skeptic'
          ? 'a fictional contemporary methodological critic; thoughtful, slightly wry expression; modern restrained attire.'
          : 'a composed moderator figure in restrained modern attire, warm but neutral expression.';

  return [
    isHistorical ? historicalStyle : baseStyle,
    `Subject: ${subject}`,
    `Voice name (semantic anchor only, do NOT render as text): ${participant.name}`,
    `Participant kind: ${participant.kind}`,
    `Role in this roundtable: ${participant.role}`,
    `Stance: ${participant.stance}`,
    `Temperament: ${participant.temperament}`,
    `Roundtable topic: ${topic}`,
    `Roundtable title: ${sessionTitle}`,
    `Composition: ${aspectHint}, editorial head-and-shoulders portrait, centered, soft directional light, calm museum-catalog atmosphere. Leave vertical breathing room above and below the figure.`,
    isHistorical ? historicalNegativePrompt : negativePrompt,
  ].join('\n');
};
