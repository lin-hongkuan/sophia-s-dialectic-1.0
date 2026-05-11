/**
 * RoundtableService — orchestrates the "实时圆桌会谈" pipeline.
 *
 * The shape of a run is:
 *   plan  → seat  → (turn × N) → minutes
 *
 * Each stage is a single LLM (or image) call. This module deliberately keeps
 * its own network abstractions thin: we reuse the shared `apiClient`
 * utilities (fetchWithRetry, chatEndpoint, apiErrorMessage, request headers)
 * and the token accounting helpers, so retry / logging / cost tracking
 * behave identically to the main analyze pipeline.
 */

import type {
  GenerationLogEntry,
  RoundtableCallbacks,
  RoundtableInterjectionSeed,
  RoundtableMinutes,
  RoundtableParticipant,
  RoundtableParticipantAvatar,
  RoundtableSession,
  RoundtableTurn,
  RoundtableTurnDirective,
  TokenUsage,
} from '../types';
import {
  chatEndpoint,
  fetchWithRetry,
  imageEndpoint,
  requestHeaders,
  apiErrorMessage,
  type ChatMessage,
} from './apiClient';
import { getActiveConfig } from './sophiaConfig';
import { buildUsage, recordUsage } from './tokenAccounting';
import { parseModelJson, ModelJsonParseError } from './jsonResponse';
import {
  HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
  HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
  NEGATIVE_AVATAR_PROMPT,
  THOUGHT_VOICE_AVATAR_STYLE,
  resolveHistoricalPhilosopherAvatarStyle,
  resolveHistoricalPhilosopherNegativeAvatarPrompt,
  resolveNegativeAvatarPrompt,
  resolveThoughtVoiceAvatarStyle,
} from './prompts';
import {
  ROUNDTABLE_MINUTES_SYSTEM,
  ROUNDTABLE_PLANNING_SYSTEM,
  ROUNDTABLE_SUMMARY_SYSTEM,
  ROUNDTABLE_TURN_SYSTEM,
  buildRoundtableAvatarPrompt,
  buildRoundtableMinutesUser,
  buildRoundtablePlanningUser,
  buildRoundtableSummaryUser,
  buildRoundtableTurnUser,
} from './roundtablePrompts';

/* ---------- small helpers ---------- */

const shortId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '').slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${shortId()}`;

const nowIso = () => new Date().toISOString();

const emitLog = (
  callbacks: RoundtableCallbacks | undefined,
  level: GenerationLogEntry['level'],
  stage: GenerationLogEntry['stage'],
  message: string,
  extras?: { voiceId?: string; voiceName?: string; tokens?: GenerationLogEntry['tokens'] },
) => {
  callbacks?.onLog?.({
    id: `rt-log-${Date.now()}-${shortId()}`,
    ts: nowIso(),
    level,
    stage,
    message,
    voiceId: extras?.voiceId,
    voiceName: extras?.voiceName,
    tokens: extras?.tokens,
  });
};

const surfaceTokenUsage = (
  callbacks: RoundtableCallbacks | undefined,
  usage: TokenUsage | null,
) => {
  if (!usage) return;
  recordUsage(usage);
  callbacks?.onTokenUsage?.(usage);
};

/* ---------- network wrappers ---------- */

const callChatJson = async <T>(
  messages: ChatMessage[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    label: string;
    stage?: TokenUsage['stage'];
  },
): Promise<{ value: T; rawUsage: TokenUsage | null }> => {
  const cfg = getActiveConfig();
  const body = {
    model: cfg.apiModel,
    messages,
    temperature: opts.temperature ?? cfg.options.temperature,
    max_tokens: opts.maxTokens ?? 2000,
    stream: false,
    response_format: { type: 'json_object' as const },
  };

  const response = await fetchWithRetry(chatEndpoint(), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify(body),
  }, { timeoutMs: 90000, label: opts.label, signal: opts.signal });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  const data = await response.json().catch(() => ({} as any));
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`${cfg.apiProvider} 未返回圆桌 ${opts.label} 的 JSON。`);
  }

  const usage = buildUsage(data?.usage, opts.stage || 'outline', cfg.apiModel);
  try {
    return { value: parseModelJson<T>(content), rawUsage: usage };
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      throw new Error(`圆桌 ${opts.label} 返回了无法解析的 JSON：${error.preview || '（空）'}`);
    }
    throw error;
  }
};

const STREAM_IDLE_TIMEOUT_MS = 45000;

const callChatStream = async (
  messages: ChatMessage[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
    label: string;
    stage?: TokenUsage['stage'];
    onDelta?: (delta: string, fullText: string) => void;
  },
): Promise<{ text: string; rawUsage: TokenUsage | null }> => {
  const cfg = getActiveConfig();
  const body = {
    model: cfg.apiModel,
    messages,
    temperature: opts.temperature ?? cfg.options.temperature,
    max_tokens: opts.maxTokens ?? 600,
    stream: true,
  };

  const response = await fetchWithRetry(chatEndpoint(), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify(body),
  }, { timeoutMs: 60000, label: `${opts.label}-connect`, signal: opts.signal });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  if (!response.body) {
    // Some upstreams ignore stream:true. Fall back to a non-streaming read.
    const data = await response.json().catch(() => ({} as any));
    const text = data?.choices?.[0]?.message?.content || '';
    const usage = buildUsage(data?.usage, opts.stage || 'voices', cfg.apiModel);
    opts.onDelta?.(text, text);
    return { text, rawUsage: usage };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let full = '';
  let usageRaw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;

  const onOuterAbort = () => {
    reader.cancel(opts.signal?.reason ?? new DOMException('aborted', 'AbortError')).catch(() => {});
  };
  if (opts.signal) {
    if (opts.signal.aborted) onOuterAbort();
    else opts.signal.addEventListener('abort', onOuterAbort, { once: true });
  }

  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  const armIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      reader.cancel(new DOMException('stream idle timeout', 'AbortError')).catch(() => {});
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  const disarmIdle = () => { if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; } };

  try {
    armIdle();
    while (true) {
      const { value, done } = await reader.read();
      armIdle();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          if (parsed?.usage) usageRaw = parsed.usage;
          const delta = parsed?.choices?.[0]?.delta?.content
            ?? parsed?.choices?.[0]?.message?.content
            ?? '';
          if (delta) {
            full += delta;
            opts.onDelta?.(delta, full);
          }
        } catch {
          // Ignore non-JSON keepalive lines.
        }
      }
    }
  } finally {
    disarmIdle();
  }

  return {
    text: full,
    rawUsage: buildUsage(usageRaw, opts.stage || 'voices', cfg.apiModel),
  };
};

/* ---------- avatar image ---------- */

const callAvatarImage = async (prompt: string, signal?: AbortSignal): Promise<string> => {
  const cfg = getActiveConfig();
  const response = await fetchWithRetry(imageEndpoint(), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      model: cfg.avatarImageModel,
      prompt,
      n: 1,
      size: cfg.avatarImageSize,
      response_format: 'b64_json',
    }),
  }, { timeoutMs: 120000, label: 'roundtable-avatar', signal });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  const data = await response.json().catch(() => ({} as any));
  const usage = buildUsage(data?.usage, 'avatar', cfg.avatarImageModel);
  if (usage) recordUsage(usage);
  const item = data?.data?.[0];
  if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
  if (typeof item?.url === 'string' && item.url) return item.url;
  throw new Error(`${cfg.apiProvider} 图片接口未返回可用图像。`);
};

/* ---------- planning ---------- */

interface PlanningResponse {
  title: string;
  coreQuestion: string;
  moderatorOpening: string;
  participants: Array<{
    id: string;
    name: string;
    kind: RoundtableParticipant['kind'];
    role: string;
    stance: string;
    temperament: string;
    conflictWith?: string[];
  }>;
}

const VALID_PLANNED_KINDS: RoundtableParticipant['kind'][] = ['philosopher', 'school', 'position', 'skeptic'];

const sanitizePlanning = (raw: PlanningResponse): PlanningResponse => {
  const safeParticipants = Array.isArray(raw.participants) ? raw.participants : [];
  const seen = new Set<string>();
  const sanitized = safeParticipants
    .filter((p) => p && typeof p === 'object' && typeof p.name === 'string' && p.name.trim())
    .slice(0, 4)
    .map((p, index) => {
      let id = typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `p${index + 1}`;
      while (seen.has(id)) id = `${id}-${shortId().slice(0, 3)}`;
      seen.add(id);
      const kind = VALID_PLANNED_KINDS.includes(p.kind) ? p.kind : 'philosopher';
      return {
        id,
        name: p.name.trim(),
        kind,
        role: (p.role || '').trim(),
        stance: (p.stance || '').trim(),
        temperament: (p.temperament || '').trim(),
        conflictWith: Array.isArray(p.conflictWith)
          ? p.conflictWith.filter((c): c is string => typeof c === 'string')
          : [],
      };
    });

  while (sanitized.length < 4) {
    const filler = {
      id: `p${sanitized.length + 1}`,
      name: sanitized.length === 0 ? '古典立场' : sanitized.length === 1 ? '思想流派' : sanitized.length === 2 ? '当代立场' : '方法论怀疑者',
      kind: sanitized.length === 0 ? 'philosopher' as const
        : sanitized.length === 1 ? 'school' as const
          : sanitized.length === 2 ? 'position' as const
            : 'skeptic' as const,
      role: '填补席位，保证混合。',
      stance: '在讨论中提出与其他席位形成区分的立场。',
      temperament: '克制、发言不长。',
      conflictWith: [],
    };
    sanitized.push(filler);
  }

  return {
    title: (raw.title || '').trim() || '圆桌会谈',
    coreQuestion: (raw.coreQuestion || '').trim() || '我们究竟在争论什么？',
    moderatorOpening: (raw.moderatorOpening || '').trim() || '欢迎各位来到圆桌，请依次作开场陈述。',
    participants: sanitized,
  };
};

export const planRoundtableSession = async (
  topic: string,
  callbacks: RoundtableCallbacks = {},
  signal?: AbortSignal,
): Promise<RoundtableSession> => {
  const sessionId = makeId('rt');
  emitLog(callbacks, 'info', 'outline', '正在规划圆桌席位...');

  let plan: PlanningResponse;
  try {
    const { value, rawUsage } = await callChatJson<PlanningResponse>([
      { role: 'system', content: ROUNDTABLE_PLANNING_SYSTEM },
      { role: 'user', content: buildRoundtablePlanningUser(topic) },
    ], { maxTokens: 1200, label: 'roundtable-plan', stage: 'outline', signal });
    plan = sanitizePlanning(value);
    surfaceTokenUsage(callbacks, rawUsage);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onError?.(message);
    emitLog(callbacks, 'error', 'outline', `圆桌规划失败：${message}`);
    throw error;
  }

  const cfg = getActiveConfig();
  const createdAt = nowIso();
  const participants: RoundtableParticipant[] = plan.participants.map((p) => ({
    ...p,
    status: 'planned',
  }));

  const moderatorTurn: RoundtableTurn = {
    id: makeId('turn'),
    phase: 'opening',
    kind: 'moderator',
    content: plan.moderatorOpening,
    status: 'completed',
    createdAt,
  };

  const session: RoundtableSession = {
    id: sessionId,
    createdAt,
    updatedAt: createdAt,
    topic,
    title: plan.title,
    coreQuestion: plan.coreQuestion,
    status: 'seating',
    participants,
    turns: [moderatorTurn],
    metadata: {
      model: cfg.apiModel,
      avatarModel: cfg.avatarImageModel,
      totalTokens: 0,
      tokenUsage: [],
    },
  };

  emitLog(callbacks, 'info', 'outline', `已规划 ${participants.length} 位参会者，准备生成头像。`);
  callbacks.onSession?.(session);
  return session;
};

/* ---------- avatars ---------- */

const buildAvatarFor = (
  session: RoundtableSession,
  participant: RoundtableParticipant,
): string => {
  const cfg = getActiveConfig();
  return buildRoundtableAvatarPrompt(
    session.topic,
    session.title,
    participant,
    resolveThoughtVoiceAvatarStyle(cfg.promptOverrides) || THOUGHT_VOICE_AVATAR_STYLE,
    resolveHistoricalPhilosopherAvatarStyle(cfg.promptOverrides) || HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
    resolveNegativeAvatarPrompt(cfg.promptOverrides) || NEGATIVE_AVATAR_PROMPT,
    resolveHistoricalPhilosopherNegativeAvatarPrompt(cfg.promptOverrides) || HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
    cfg.avatarAspectHint,
  );
};

/**
 * Generate all 4 participant avatars in a bounded-concurrency fashion.
 * Individual failures are recorded on the participant but do not abort the
 * session: the UI falls back to a symbolic avatar.
 */
export const generateRoundtableAvatars = async (
  session: RoundtableSession,
  callbacks: RoundtableCallbacks = {},
  signal?: AbortSignal,
): Promise<RoundtableSession> => {
  const cfg = getActiveConfig();
  const limit = Math.max(1, Math.min(5, cfg.options.avatarConcurrency || 2));

  const workers = [...session.participants];
  let pointer = 0;
  const nextParticipants: RoundtableParticipant[] = session.participants.map((p) => ({
    ...p,
    status: 'seating',
    avatar: p.avatar || {
      imageUrl: '',
      prompt: buildAvatarFor(session, p),
      model: cfg.avatarImageModel,
      alt: `${p.name} 的圆桌头像`,
      status: 'queued',
    },
  }));

  const publish = (idx: number) => {
    const updated = { ...nextParticipants[idx] };
    nextParticipants[idx] = updated;
    callbacks.onParticipantUpdate?.(updated);
  };

  const runOne = async () => {
    while (pointer < workers.length) {
      if (signal?.aborted) return;
      const index = pointer;
      pointer += 1;
      const participant = nextParticipants[index];
      const prompt = buildAvatarFor(session, participant);
      nextParticipants[index] = {
        ...participant,
        status: 'seating',
        avatar: { ...(participant.avatar as RoundtableParticipantAvatar), prompt, status: 'generating' },
      };
      publish(index);
      emitLog(callbacks, 'detail', 'avatar', `${participant.name} 头像生成中...`, {
        voiceId: participant.id,
        voiceName: participant.name,
      });

      try {
        const url = await callAvatarImage(prompt, signal);
        nextParticipants[index] = {
          ...nextParticipants[index],
          status: 'present',
          avatar: {
            prompt,
            model: cfg.avatarImageModel,
            alt: `${participant.name} 的圆桌头像`,
            generatedAt: nowIso(),
            status: 'completed',
            imageUrl: url,
          },
        };
        publish(index);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitLog(callbacks, 'warn', 'avatar', `${participant.name} 头像失败，将用首字占位：${message}`, {
          voiceId: participant.id,
          voiceName: participant.name,
        });
        nextParticipants[index] = {
          ...nextParticipants[index],
          status: 'present',
          avatar: {
            prompt,
            model: cfg.avatarImageModel,
            alt: `${participant.name} 的圆桌头像`,
            status: 'failed',
            error: message,
            imageUrl: '',
          },
        };
        publish(index);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, workers.length) }, runOne));

  const updated: RoundtableSession = {
    ...session,
    updatedAt: nowIso(),
    status: 'running',
    participants: nextParticipants,
  };
  callbacks.onSession?.(updated);
  return updated;
};

export const regenerateRoundtableAvatar = async (
  session: RoundtableSession,
  participantId: string,
  callbacks: RoundtableCallbacks = {},
  signal?: AbortSignal,
): Promise<RoundtableSession> => {
  const cfg = getActiveConfig();
  const idx = session.participants.findIndex((p) => p.id === participantId);
  if (idx < 0) return session;
  const participant = session.participants[idx];
  const prompt = buildAvatarFor(session, participant);
  const pending: RoundtableParticipant = {
    ...participant,
    avatar: {
      ...(participant.avatar as RoundtableParticipantAvatar),
      prompt,
      model: cfg.avatarImageModel,
      alt: `${participant.name} 的圆桌头像`,
      status: 'generating',
    },
  };
  callbacks.onParticipantUpdate?.(pending);

  try {
    const url = await callAvatarImage(prompt, signal);
    const complete: RoundtableParticipant = {
      ...pending,
      avatar: {
        prompt,
        model: cfg.avatarImageModel,
        alt: `${participant.name} 的圆桌头像`,
        generatedAt: nowIso(),
        status: 'completed',
        imageUrl: url,
      },
    };
    const next = { ...session, participants: session.participants.map((p, i) => (i === idx ? complete : p)), updatedAt: nowIso() };
    callbacks.onParticipantUpdate?.(complete);
    callbacks.onSession?.(next);
    return next;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failed: RoundtableParticipant = {
      ...pending,
      avatar: {
        prompt,
        model: cfg.avatarImageModel,
        alt: `${participant.name} 的圆桌头像`,
        status: 'failed',
        error: message,
        imageUrl: '',
      },
    };
    const next = { ...session, participants: session.participants.map((p, i) => (i === idx ? failed : p)), updatedAt: nowIso() };
    callbacks.onParticipantUpdate?.(failed);
    callbacks.onSession?.(next);
    return next;
  }
};

/* ---------- rolling summary ---------- */

const buildRollingSummary = async (
  session: RoundtableSession,
  signal?: AbortSignal,
  callbacks?: RoundtableCallbacks,
): Promise<string> => {
  if (session.turns.filter((t) => t.kind === 'participant').length < 4) return '';
  try {
    const { text, rawUsage } = await callChatStream([
      { role: 'system', content: ROUNDTABLE_SUMMARY_SYSTEM },
      { role: 'user', content: buildRoundtableSummaryUser(session) },
    ], { maxTokens: 400, temperature: 0.4, stage: 'reflection', label: 'roundtable-summary', signal });
    surfaceTokenUsage(callbacks, rawUsage);
    return text.trim();
  } catch {
    return '';
  }
};

/* ---------- turn generation ---------- */

/**
 * Run one participant turn end-to-end. Streams deltas through onTurnDelta.
 */
export const generateNextRoundtableTurn = async (
  session: RoundtableSession,
  directive: RoundtableTurnDirective,
  callbacks: RoundtableCallbacks = {},
  signal?: AbortSignal,
): Promise<{ session: RoundtableSession; turn: RoundtableTurn }> => {
  if (directive.phase === 'closing') {
    throw new Error('closing 阶段请走 closeRoundtableSession');
  }

  const participant = session.participants.find((p) => p.id === directive.participantId);
  if (!participant) {
    throw new Error(`找不到发言席位 ${directive.participantId}`);
  }

  const turn: RoundtableTurn = {
    id: makeId('turn'),
    phase: directive.phase,
    kind: 'participant',
    participantId: participant.id,
    targetParticipantId: directive.participantId && directive.participantId !== participant.id ? directive.participantId : undefined,
    replyToParticipantId: directive.replyToParticipantId,
    action: directive.action,
    content: '',
    status: 'streaming',
    createdAt: nowIso(),
  };
  callbacks.onTurnStart?.(turn);

  const rollingSummary = await buildRollingSummary(session, signal, callbacks);
  const recent = session.turns.slice(-8);
  const userInterjection = directive.userInterjectionTurnId
    ? session.turns.find((t) => t.id === directive.userInterjectionTurnId && t.kind === 'user_interjection')
    : undefined;

  let streamed = '';

  try {
    const { text, rawUsage } = await callChatStream([
      { role: 'system', content: ROUNDTABLE_TURN_SYSTEM },
      { role: 'user', content: buildRoundtableTurnUser(session, directive, rollingSummary, participant, recent, userInterjection) },
    ], {
      maxTokens: 550,
      temperature: 0.8,
      label: 'roundtable-turn',
      stage: 'voices',
      signal,
      onDelta: (_delta, full) => {
        streamed = full;
        callbacks.onTurnDelta?.(turn.id, _delta, full);
      },
    });
    surfaceTokenUsage(callbacks, rawUsage);

    const completed: RoundtableTurn = {
      ...turn,
      content: (text || streamed).trim(),
      status: 'completed',
    };
    const nextParticipants = session.participants.map((p) =>
      p.id === participant.id ? { ...p, status: 'silent' as const } : p,
    );
    const nextSession: RoundtableSession = {
      ...session,
      participants: nextParticipants,
      turns: [...session.turns, completed],
      updatedAt: nowIso(),
    };
    callbacks.onTurnComplete?.(completed);
    callbacks.onSession?.(nextSession);
    return { session: nextSession, turn: completed };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedTurn: RoundtableTurn = {
      ...turn,
      content: streamed.trim(),
      status: 'failed',
      error: message,
    };
    const nextSession: RoundtableSession = {
      ...session,
      turns: [...session.turns, failedTurn],
      updatedAt: nowIso(),
    };
    callbacks.onError?.(message);
    emitLog(callbacks, 'error', 'voices', `${participant.name} 发言失败：${message}`, {
      voiceId: participant.id,
      voiceName: participant.name,
    });
    callbacks.onTurnComplete?.(failedTurn);
    callbacks.onSession?.(nextSession);
    return { session: nextSession, turn: failedTurn };
  }
};

/* ---------- user interjection (no network) ---------- */

export const appendUserInterjection = (
  session: RoundtableSession,
  input: RoundtableInterjectionSeed,
): { session: RoundtableSession; turn: RoundtableTurn } => {
  const turn: RoundtableTurn = {
    id: makeId('interject'),
    phase: 'response',
    kind: 'user_interjection',
    content: input.content.trim(),
    targetParticipantId: input.targetParticipantId,
    action: input.action,
    status: 'completed',
    createdAt: nowIso(),
  };
  const next = { ...session, turns: [...session.turns, turn], updatedAt: nowIso() };
  return { session: next, turn };
};

/** Insert a moderator stage-direction line. No LLM call. */
export const appendModeratorLine = (
  session: RoundtableSession,
  content: string,
  phase: RoundtableTurn['phase'] = 'response',
): { session: RoundtableSession; turn: RoundtableTurn } => {
  const turn: RoundtableTurn = {
    id: makeId('moderator'),
    phase,
    kind: 'moderator',
    content: content.trim(),
    status: 'completed',
    createdAt: nowIso(),
  };
  const next = { ...session, turns: [...session.turns, turn], updatedAt: nowIso() };
  return { session: next, turn };
};

/* ---------- closing / minutes ---------- */

const sanitizeMinutes = (raw: Partial<RoundtableMinutes>): RoundtableMinutes => {
  const arrayOrEmpty = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean)
      : [];
  const next = arrayOrEmpty(raw.nextQuestions).slice(0, 3);
  while (next.length < 3) next.push('');
  return {
    consensus: (raw.consensus || '').trim(),
    disagreements: arrayOrEmpty(raw.disagreements).slice(0, 6),
    unresolvedQuestions: arrayOrEmpty(raw.unresolvedQuestions).slice(0, 6),
    nextQuestions: next.slice(0, 3),
    realLifeReturn: (raw.realLifeReturn || '').trim(),
  };
};

export const closeRoundtableSession = async (
  session: RoundtableSession,
  callbacks: RoundtableCallbacks = {},
  signal?: AbortSignal,
): Promise<RoundtableSession> => {
  emitLog(callbacks, 'info', 'synthesis', '主持人正在写会议纪要...');
  try {
    const { value, rawUsage } = await callChatJson<Partial<RoundtableMinutes>>([
      { role: 'system', content: ROUNDTABLE_MINUTES_SYSTEM },
      { role: 'user', content: buildRoundtableMinutesUser(session) },
    ], { maxTokens: 1400, temperature: 0.5, stage: 'synthesis', label: 'roundtable-minutes', signal });
    surfaceTokenUsage(callbacks, rawUsage);

    const minutes = sanitizeMinutes(value);
    const minutesTurn: RoundtableTurn = {
      id: makeId('minutes'),
      phase: 'closing',
      kind: 'minutes',
      content: [
        minutes.consensus ? `【共识】${minutes.consensus}` : '',
        minutes.disagreements.length ? `【分歧】${minutes.disagreements.join(' / ')}` : '',
        minutes.realLifeReturn ? `【回到现实】${minutes.realLifeReturn}` : '',
      ].filter(Boolean).join('\n'),
      status: 'completed',
      createdAt: nowIso(),
    };

    const nextSession: RoundtableSession = {
      ...session,
      status: 'completed',
      updatedAt: nowIso(),
      minutes,
      turns: [...session.turns, minutesTurn],
    };
    callbacks.onMinutes?.(minutes);
    callbacks.onTurnComplete?.(minutesTurn);
    callbacks.onSession?.(nextSession);
    emitLog(callbacks, 'info', 'synthesis', '会议纪要已完成。');
    return nextSession;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    callbacks.onError?.(message);
    emitLog(callbacks, 'error', 'synthesis', `会议纪要生成失败：${message}`);
    const next: RoundtableSession = { ...session, status: 'error', updatedAt: nowIso(), error: message };
    callbacks.onSession?.(next);
    throw error;
  }
};
