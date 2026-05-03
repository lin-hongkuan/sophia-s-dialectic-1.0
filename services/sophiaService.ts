import {
  AnalysisOutline,
  AnalysisResult,
  AnalyzeCallbacks,
  AppendVoiceCallbacks,
  ContinuationContext,
  GenerationLogEntry,
  GenerationProgress,
  KeywordExplainer,
  OpenConclusion,
  ProgramMode,
  RouteNode,
  TensionFocus,
  ThoughtVoice,
  ThoughtVoiceImageAvatar,
  TokenUsage,
  TokenUsageStage,
  VoiceKind,
  emptyConclusion,
} from '../types';
import {
  HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
  HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
  MODE_LABELS,
  NEGATIVE_AVATAR_PROMPT,
  THOUGHT_VOICE_AVATAR_STYLE,
  VALID_MODES,
  VOICE_KIND_AVATAR_SUBJECT,
  resolveHistoricalPhilosopherAvatarStyle,
  resolveHistoricalPhilosopherNegativeAvatarPrompt,
  resolveNegativeAvatarPrompt,
  resolveOutlineSystemPrompt,
  resolveSynthesisSystemPrompt,
  resolveThoughtVoiceAvatarStyle,
  resolveVoiceSystemPrompt,
} from './prompts';
import { getActiveConfig } from './sophiaConfig';
import { buildUsage, recordUsage as recordUsageStandalone } from './tokenAccounting';
import { ModelJsonParseError, parseModelJson } from './jsonResponse';

export { THOUGHT_VOICE_AVATAR_STYLE } from './prompts';

interface RunContext {
  onLog?: (entry: GenerationLogEntry) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
  stage: TokenUsageStage;
  voiceId?: string;
  voiceName?: string;
}

const runStack: RunContext[] = [];

const currentRunContext = (): RunContext | null => runStack[runStack.length - 1] || null;

const pushRunContext = (ctx: RunContext) => {
  runStack.push(ctx);
  return ctx;
};

const popRunContext = (ctx: RunContext) => {
  const idx = runStack.lastIndexOf(ctx);
  if (idx >= 0) runStack.splice(idx, 1);
};

const withStage = <T>(stage: TokenUsageStage, fn: () => Promise<T>, extra?: Pick<RunContext, 'voiceId' | 'voiceName'>): Promise<T> => {
  const top = currentRunContext();
  if (!top) return fn();
  const previous: RunContext = { ...top };
  top.stage = stage;
  if (extra) {
    top.voiceId = extra.voiceId;
    top.voiceName = extra.voiceName;
  }
  return fn().finally(() => {
    top.stage = previous.stage;
    top.voiceId = previous.voiceId;
    top.voiceName = previous.voiceName;
  });
};

const emitLog = (entry: Omit<GenerationLogEntry, 'id' | 'ts'> & { id?: string; ts?: string }) => {
  const ctx = currentRunContext();
  if (!ctx?.onLog) return;
  const id = entry.id || `log-${Date.now()}-${shortRandomId()}`;
  ctx.onLog({
    id,
    ts: entry.ts || new Date().toISOString(),
    level: entry.level,
    stage: entry.stage,
    voiceId: entry.voiceId ?? ctx.voiceId,
    voiceName: entry.voiceName ?? ctx.voiceName,
    message: entry.message,
    tokens: entry.tokens,
  });
};

/**
 * Heartbeat helper for long blocking single LLM calls (outline / route / synthesis).
 * The user's pain: a 20-30s call emits one log line then nothing — feels frozen.
 * Heartbeat emits a 'detail' tick every ~10s so the log feed shows the system is alive.
 * Cleanup is idempotent.
 */
const startHeartbeat = (stage: GenerationLogEntry['stage'], label: string, intervalMs = 10000) => {
  if (typeof window === 'undefined') return () => {};
  const startedAt = Date.now();
  const ctx = currentRunContext();
  const voiceId = ctx?.voiceId;
  const voiceName = ctx?.voiceName;
  const handle = window.setInterval(() => {
    const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
    emitLog({
      level: 'detail',
      stage,
      voiceId,
      voiceName,
      message: `${label}（已等待 ${elapsedSec}s，模型仍在处理...）`,
    });
  }, intervalMs);
  return () => window.clearInterval(handle);
};

const recordUsageFromResponse = (
  raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  modelOverride?: string,
): TokenUsage | null => {
  const ctx = currentRunContext();
  if (!ctx) return null;
  const cfg = getActiveConfig();
  const usage = buildUsage(raw, ctx.stage, modelOverride || cfg.apiModel, ctx.voiceId);
  if (!usage) return null;
  ctx.onTokenUsage?.(usage);
  return usage;
};

const requestHeaders = () => {
  const cfg = getActiveConfig();
  return {
    'Content-Type': 'application/json',
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
  };
};

const chatEndpoint = () => `${getActiveConfig().apiBaseUrl}/chat/completions`;
const imageEndpoint = () => `${getActiveConfig().apiBaseUrl}/images/generations`;

const shortRandomId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '').slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${shortRandomId()}`;

const parseJson = <T>(content: string): T => parseModelJson<T>(content);

const isTransientStatus = (status: number) => status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryableNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof Error) {
    // AbortError: our timeout fired (caller signal handled separately)
    if (error.name === 'AbortError') return true;
    // Most browsers throw TypeError for DNS / TLS / offline / ECONNRESET
    if (error.name === 'TypeError') return true;
    if (/network|failed to fetch|load failed|fetch failed/i.test(error.message || '')) return true;
  }
  return false;
};

const computeBackoffMs = (attempt: number) => {
  const base = 800 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(base + jitter, 8000);
};

interface FetchWithRetryOptions {
  /** Per-attempt request timeout (driven by AbortController). Default 60s. */
  timeoutMs?: number;
  /** Total attempts including the first. Default 4. */
  maxAttempts?: number;
  /** External cancel signal forwarded to fetch. */
  signal?: AbortSignal;
  /** Short label that goes into the warn log so different call sites are distinguishable. */
  label?: string;
}

const fetchWithRetry = async (
  input: RequestInfo,
  init: RequestInit = {},
  { timeoutMs = 60000, maxAttempts = 4, signal, label = 'sophia-fetch' }: FetchWithRetryOptions = {},
): Promise<Response> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('aborted by caller', 'AbortError');

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(signal?.reason);
    if (signal) signal.addEventListener('abort', onCallerAbort, { once: true });
    const timeoutId = setTimeout(
      () => controller.abort(new DOMException(`timeout after ${timeoutMs}ms`, 'AbortError')),
      timeoutMs,
    );

    const startedAt = Date.now();
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onCallerAbort);

      if (response.ok) return response;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!isTransientStatus(response.status) || isLastAttempt) return response;

      // Transient HTTP: drain body so the connection can be reused, then back off.
      try { await response.text(); } catch { /* body may already be closed */ }
      const backoff = computeBackoffMs(attempt);
      // eslint-disable-next-line no-console
      console.warn(`[sophia][${label}] transient HTTP ${response.status} on attempt ${attempt + 1}/${maxAttempts}, retrying in ${backoff}ms`);
      await wait(backoff);
    } catch (error) {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onCallerAbort);
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;
      // Caller cancellation always propagates.
      if (signal?.aborted) throw error;
      const retryable = isRetryableNetworkError(error);
      if (!retryable || isLastAttempt) throw error;
      const backoff = computeBackoffMs(attempt);
      const elapsed = Date.now() - startedAt;
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      // eslint-disable-next-line no-console
      console.warn(`[sophia][${label}] network error on attempt ${attempt + 1}/${maxAttempts} after ${elapsed}ms (${reason}), retrying in ${backoff}ms`);
      await wait(backoff);
    }
  }
  throw lastError ?? new Error(`[sophia][${label}] retries exhausted`);
};

const apiErrorMessage = async (response: Response) => {
  const cfg = getActiveConfig();
  const errorData = await response.json().catch(() => ({}));
  const upstream = errorData?.error?.message || errorData?.message || '';
  const code = errorData?.error?.code || '';
  const status = response.status;

  let summary = '';
  if (status === 401) {
    summary = 'API key 无效或已过期，请到设置页检查 / 更换 key。';
  } else if (status === 403) {
    summary = '当前 key 无权访问该模型，可能是账号未开通或被限制。';
  } else if (status === 404) {
    summary = '模型名错误或服务未上线。请到设置页检查 model 字段是否拼写正确。';
  } else if (status === 408) {
    summary = '上游响应超时，已自动重试仍失败。请稍后再试。';
  } else if (status === 429) {
    summary = '触发了配额或限流。请稍后重试或更换一个限额更高的 key / 模型。';
  } else if (status >= 500 && status < 600) {
    summary = '上游服务波动，已自动重试仍失败。可以稍后再试，或在设置页换一个 provider。';
  } else if (status >= 400 && status < 500) {
    summary = `请求被 ${cfg.apiProvider} 拒绝（${status}）。请检查请求参数或更换模型。`;
  } else {
    summary = `${cfg.apiProvider} API 请求失败（HTTP ${status}）。`;
  }

  const trail: string[] = [];
  if (upstream) trail.push(upstream);
  if (code && code !== upstream) trail.push(`code=${code}`);
  return trail.length > 0 ? `${summary}（${trail.join(' · ')}）` : summary;
};

// Avatar request semaphore — caps concurrent /images/generations calls so a slow image
// model can't stack up requests when several voices are running in parallel. The limit is
// re-read on every release so a settings change takes effect mid-run.
let avatarInFlight = 0;
const avatarWaiters: Array<() => void> = [];

const acquireAvatarSlot = (): Promise<void> => {
  const limit = Math.max(1, getActiveConfig().options.avatarConcurrency);
  if (avatarInFlight < limit) {
    avatarInFlight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    avatarWaiters.push(resolve);
  });
};

const releaseAvatarSlot = (): void => {
  avatarInFlight = Math.max(0, avatarInFlight - 1);
  const limit = Math.max(1, getActiveConfig().options.avatarConcurrency);
  while (avatarInFlight < limit && avatarWaiters.length > 0) {
    const wake = avatarWaiters.shift()!;
    avatarInFlight += 1;
    wake();
  }
};

const callAvatarImage = async (prompt: string): Promise<string> => {
  await acquireAvatarSlot();
  try {
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
    }, { timeoutMs: 120000, label: 'avatar-image' });

    if (!response.ok) {
      throw new Error(await apiErrorMessage(response));
    }

    const data = await response.json().catch(() => ({} as any));
    recordUsageFromResponse(data?.usage, cfg.avatarImageModel);
    const item = data?.data?.[0];
    if (item?.b64_json) {
      return `data:image/png;base64,${item.b64_json}`;
    }
    if (typeof item?.url === 'string' && item.url) {
      return item.url;
    }
    throw new Error(`${cfg.apiProvider} 图片接口未返回可用图像。`);
  } finally {
    releaseAvatarSlot();
  }
};

export const buildThoughtVoiceAvatarPrompt = (
  topic: string,
  outline: Pick<AnalysisOutline, 'philosophical_title' | 'modeLabel'>,
  voicePlan: { name: string; kind: VoiceKind; school?: string; role: string; coreConcept: string; oneLine: string; stance: string },
): string => {
  const cfg = getActiveConfig();
  const isHistoricalPhilosopher = voicePlan.kind === 'philosopher';
  const subject = VOICE_KIND_AVATAR_SUBJECT[voicePlan.kind] || VOICE_KIND_AVATAR_SUBJECT.philosopher;
  const schoolLine = voicePlan.school ? `\nSchool / tradition: ${voicePlan.school}` : '';
  const historicalLikenessLine = isHistoricalPhilosopher
    ? 'Historical likeness cues: use the voice name to infer recognizable portrait references and era-specific details. For example, Sartre may have round glasses, a slightly asymmetrical gaze and Left Bank intellectual austerity; Spinoza may suggest a 17th-century Dutch-Sephardic scholar portrait with dark period clothing and lens-grinder study ambience; Camus may suggest a mid-century French-Algerian writer in black-and-white editorial mood, trench-coat restraint and direct lucid gaze.'
    : '';
  return [
    isHistoricalPhilosopher ? resolveHistoricalPhilosopherAvatarStyle(cfg.promptOverrides) : resolveThoughtVoiceAvatarStyle(cfg.promptOverrides),
    `Subject: ${subject}`,
    `Voice name (semantic anchor only, do NOT render as text): ${voicePlan.name}`,
    historicalLikenessLine,
    `Voice kind: ${voicePlan.kind}${schoolLine}`,
    `Role in this analysis: ${voicePlan.role}`,
    `Core concept: ${voicePlan.coreConcept}`,
    `One-line stance: ${voicePlan.oneLine || voicePlan.stance}`,
    `User question being analyzed: ${topic}`,
    `Big question: ${outline.philosophical_title}`,
    `Analytical mode: ${outline.modeLabel}`,
    `Composition: ${cfg.avatarAspectHint}, slightly taller-than-wide editorial portrait, head-and-shoulders or symbolic chest-up vignette, centered, soft directional light, calm museum-catalog atmosphere. Avoid square crop; leave quiet vertical breathing room above and below the figure.`,
    isHistoricalPhilosopher ? resolveHistoricalPhilosopherNegativeAvatarPrompt(cfg.promptOverrides) : resolveNegativeAvatarPrompt(cfg.promptOverrides),
  ].join('\n');
};

export const generateThoughtVoiceAvatar = async (
  topic: string,
  outline: Pick<AnalysisOutline, 'philosophical_title' | 'modeLabel'>,
  voicePlan: { name: string; kind: VoiceKind; school?: string; role: string; coreConcept: string; oneLine: string; stance: string },
): Promise<ThoughtVoiceImageAvatar> => {
  const prompt = buildThoughtVoiceAvatarPrompt(topic, outline, voicePlan);
  const imageUrl = await callAvatarImage(prompt);
  const cfg = getActiveConfig();
  return {
    imageUrl,
    prompt,
    style: resolveThoughtVoiceAvatarStyle(cfg.promptOverrides),
    model: cfg.avatarImageModel,
    alt: `${voicePlan.name} 的竖版思想声音头像`,
    generatedAt: new Date().toISOString(),
    subjectType: voicePlan.kind,
  };
};

const parseSseResponse = (text: string): unknown => {
  const lines = text.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice(5).trim();
    if (payload === '[DONE]') continue;
    try {
      return JSON.parse(payload);
    } catch {
      // continue to next line
    }
  }
  throw new Error('No valid JSON found in SSE response');
};

// Appended as an extra system message on the second attempt of callChatJson when
// the first attempt returned content we couldn't parse even after markdown recovery.
// Some providers (Grok we've seen in practice) ignore response_format hints and wrap
// the JSON in **bold** or prepend prose; this clause is a stronger lever.
const STRICT_JSON_REINFORCEMENT = '严格规则：仅输出一个有效的 JSON 对象。不要使用 Markdown 代码围栏（``` 或 ```json），不要加粗体（**）或斜体（*、_）修饰，不要在 JSON 前后添加任何文字、注释或致谢。整个回复必须能被 JSON.parse 直接解析。';

const callChatJsonOnce = async <T>(
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens: number,
  attemptLabel: string,
): Promise<T> => {
  const cfg = getActiveConfig();
  const response = await fetchWithRetry(chatEndpoint(), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      model: cfg.apiModel,
      messages,
      temperature: cfg.options.temperature,
      max_tokens: maxTokens,
      stream: false,
      response_format: { type: 'json_object' },
    }),
  }, { timeoutMs: 90000, label: attemptLabel });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    const text = await response.clone().text();
    data = parseSseResponse(text);
  }
  recordUsageFromResponse(data?.usage);
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new ModelJsonParseError('苏菲没有回应。API 返回数据格式异常。', '');
  }
  return parseJson<T>(content);
};

const callChatJson = async <T>(messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens = 4096): Promise<T> => {
  try {
    return await callChatJsonOnce<T>(messages, maxTokens, 'chat-json');
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) throw error;
    // First attempt couldn't be coaxed into valid JSON. Try once more with an extra
    // system message that forbids markdown, then surface the upstream error for
    // diagnosis if even that fails.
    // eslint-disable-next-line no-console
    console.warn('[sophia][chat-json] retrying with stricter prompt after parse failure:', error.message);
    const reinforced = [...messages, { role: 'system' as const, content: STRICT_JSON_REINFORCEMENT }];
    try {
      return await callChatJsonOnce<T>(reinforced, maxTokens, 'chat-json-strict');
    } catch (retryError) {
      if (retryError instanceof ModelJsonParseError) {
        throw new Error(
          `${getActiveConfig().apiProvider} 模型连续两次返回了无法解析的 JSON。最近一次预览：${retryError.preview || '（空）'}`,
        );
      }
      throw retryError;
    }
  }
};

const STREAM_IDLE_TIMEOUT_MS = 45000;
const STREAM_FALLBACK_MIN_CHARS = 200;

const callChatText = async (
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens = 4096,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> => {
  const cfg = getActiveConfig();
  if (!onDelta) {
    const response = await fetchWithRetry(chatEndpoint(), {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        model: cfg.apiModel,
        messages,
        temperature: cfg.options.temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    }, { timeoutMs: 120000, label: 'chat-text' });

    if (!response.ok) {
      throw new Error(await apiErrorMessage(response));
    }

    let data: any;
    try {
      data = await response.json();
    } catch {
      const text = await response.clone().text();
      data = parseSseResponse(text);
    }
    recordUsageFromResponse(data?.usage);
    return data.choices?.[0]?.message?.content || '';
  }

  // Streaming path: connect with retry+timeout, then read body with per-chunk idle timeout.
  const response = await fetchWithRetry(chatEndpoint(), {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      model: cfg.apiModel,
      messages,
      temperature: cfg.options.temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  }, { timeoutMs: 60000, label: 'chat-text-stream-connect' });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`${cfg.apiProvider} 流式请求失败: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  // Idle timeout: if no chunk arrives for STREAM_IDLE_TIMEOUT_MS, abort the read.
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let idleAborted = false;
  const armIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      idleAborted = true;
      reader.cancel(new DOMException('stream idle timeout', 'AbortError')).catch(() => {});
    }, STREAM_IDLE_TIMEOUT_MS);
  };
  const disarmIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  try {
    armIdleTimer();
    while (true) {
      const { value, done } = await reader.read();
      armIdleTimer();
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
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            onDelta(delta, fullText);
          }
          // Some OpenAI-compatible providers emit a final chunk that contains a usage block.
          if (parsed.usage) recordUsageFromResponse(parsed.usage);
        } catch {
          // Ignore malformed SSE keepalive chunks.
        }
      }
    }
    disarmIdleTimer();
    return fullText;
  } catch (error) {
    disarmIdleTimer();
    // If the stream broke early without producing meaningful content, fall back to a
    // non-streaming retry so the user still gets something readable.
    const reason = idleAborted
      ? '流式响应空闲超时'
      : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (fullText.length < STREAM_FALLBACK_MIN_CHARS) {
      // eslint-disable-next-line no-console
      console.warn(`[sophia][chat-text-stream] dropped after ${fullText.length} chars (${reason}), falling back to non-streaming request`);
      emitLog({
        level: 'warn',
        stage: 'voices',
        message: `流式响应中断（${reason}），自动回退到非流式重试。`,
      });
      return callChatText(messages, maxTokens);
    }
    // Got a substantial partial: surface it instead of losing the work.
    // eslint-disable-next-line no-console
    console.warn(`[sophia][chat-text-stream] truncated at ${fullText.length} chars (${reason}); returning partial text`);
    emitLog({
      level: 'warn',
      stage: 'voices',
      message: `流式响应在第 ${fullText.length} 字处中断（${reason}），返回已生成的部分。`,
    });
    return fullText;
  }
};

const normalizeMode = (mode: string | undefined): ProgramMode => {
  if (mode && VALID_MODES.has(mode)) return mode as ProgramMode;
  return 'custom';
};

const normalizeKind = (kind: string | undefined): VoiceKind => {
  if (kind === 'philosopher' || kind === 'school' || kind === 'concept' || kind === 'position' || kind === 'contemporary') return kind;
  return 'philosopher';
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toTextArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => toText(item)).filter(Boolean) : [];

const normalizeQuestionFrame = (value: unknown, topic: string, title: string): AnalysisOutline['questionFrame'] => {
  const source = isRecord(value) ? value : {};
  return {
    original: toText(source.original, topic),
    bigQuestion: toText(source.bigQuestion, title || topic),
    plainTranslation: toText(source.plainTranslation),
    keywords: toTextArray(source.keywords),
  };
};

const normalizeProgramStructure = (value: unknown): AnalysisOutline['programStructure'] =>
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

const normalizeRouteMap = (value: unknown): RouteNode[] =>
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

const normalizeVoicePlans = (value: unknown): AnalysisOutline['voicePlans'] =>
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

const normalizeSeminarMatrix = (value: unknown): AnalysisOutline['seminarMatrix'] => {
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

const normalizeDiagnosisFrame = (value: unknown): AnalysisOutline['diagnosisFrame'] => {
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

const normalizeThoughtExperiment = (value: unknown): AnalysisOutline['thoughtExperiment'] => {
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

const normalizeTensions = (value: unknown): TensionFocus[] =>
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

const normalizeKeywords = (value: unknown): KeywordExplainer[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `keyword-${index + 1}`),
        term: toText(source.term, `关键词 ${index + 1}`),
        meaning: toText(source.meaning),
        importance: toText(source.importance),
      };
    })
    : [];

const normalizeFollowUps = (value: unknown): AnalysisResult['followUps'] =>
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

const normalizeQuestionSuggestions = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item).replace(/^[-•\d.、\s]+/, '').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 5);

const normalizeConclusion = (value: unknown): OpenConclusion => {
  if (!isRecord(value)) return emptyConclusion;
  return {
    summary: toText(value.summary),
    openQuestion: toText(value.openQuestion),
    realLifeReturn: toText(value.realLifeReturn),
  };
};

const formatContinuationContext = (context?: ContinuationContext) => {
  if (!context) return '';
  return `
这是对上一份分析的继续追问，不要当成完全无关的新题。
上一份标题：${context.parentTitle}
上一份原问题：${context.parentTopic}
上一份核心问题：${context.parentQuestion}
上一份暂时总结：${context.parentSummary || '无'}
上一份主要分歧：${context.parentTensions?.join('\n') || '无'}
这次追问的触发理由：${context.selectedFollowUpReason || '用户沿着当前分析继续追问'}
请承接上一份分析的概念、张力和结论，生成一份延伸分析。`;
};

const generateOutline = async (topic: string, continuationContext?: ContinuationContext): Promise<AnalysisOutline> => {
  const continuationText = formatContinuationContext(continuationContext);
  const raw = await callChatJson<any>([
    { role: 'system', content: resolveOutlineSystemPrompt(getActiveConfig().promptOverrides) },
    {
      role: 'user',
      content: `为这个用户问题设计哲学分析骨架：${topic}${continuationText}

必须输出 JSON：
{
  "philosophical_title": "大问题标题",
  "mode": "可选分析路径之一",
  "modeLabel": "自然的中文路径名，避免机器式命名",
  "introduction": "300-500字开题，让普通用户进入问题，不要说节目或本期",
  "questionFrame": {
    "original": "用户原问题",
    "bigQuestion": "哲学化后的大问题",
    "plainTranslation": "现实处境中的翻译",
    "keywords": ["关键词"]
  },
  "programStructure": [{"id":"section-1","title":"阅读节点标题","description":"这一步在分析中的作用"}],
  "routeMap": [{"id":"route-1","title":"路线节点","role":"节点功能","plain":"80-150字人话说明","philosophical":"80-150字哲学说明","tension":"可选张力"}],
  "voicePlans": [{
    "id":"voice-1",
    "name":"哲学家/流派名",
    "kind":"philosopher|school|concept|position|contemporary",
    "school":"学派，可选",
    "role":"在这份分析中的角色，比如医生/流派/回应者",
    "coreConcept":"核心概念",
    "oneLine":"一句话观点",
    "stance":"立场摘要",
    "diagnosis":"如果适用，诊断",
    "prescription":"如果适用，药方",
    "thesis":"如果适用，主张",
    "critique":"如果适用，会受到的批评"
  }],
  "seminarMatrix": "school_seminar 时可选",
  "diagnosisFrame": "diagnosis_clinic 时可选",
  "thoughtExperiment": {
    "poeticVersion": "可选，富有画面感的一段设定",
    "unsettlingVersion": "更尖锐的不安版本",
    "coreChallenge": "这个思想实验真正逼问的是什么",
    "stakes": "如果认真接受它，现实/认识/伦理上会付出什么代价",
    "responseMap": [{"voiceId":"必须匹配 voicePlans 中的 id","route":"这个思想声音如何回应该实验，80-160字"}]
  },
  "reasoning_trace": ["真实生成步骤，6-8条"]
}

voicePlans 选择 2-5 个，必须足够贴题。不要生成 routeMap.nextQuestion；继续追问统一放到 followUps。如果 mode 是 thought_experiment 或 thought_experiment_panel，必须生成 thoughtExperiment，且 responseMap.voiceId 必须匹配 voicePlans 的 id。`,
    },
  ], 3500);

  const mode = normalizeMode(raw.mode);
  const now = new Date().toISOString();
  const title = toText(raw.philosophical_title, `大问题：${topic}`);
  return {
    id: makeId('analysis'),
    createdAt: now,
    topic,
    philosophical_title: title,
    mode,
    modeLabel: toText(raw.modeLabel, MODE_LABELS[mode]),
    introduction: toText(raw.introduction),
    questionFrame: normalizeQuestionFrame(raw.questionFrame, topic, title),
    programStructure: normalizeProgramStructure(raw.programStructure),
    routeMap: normalizeRouteMap(raw.routeMap),
    voicePlans: normalizeVoicePlans(raw.voicePlans),
    seminarMatrix: normalizeSeminarMatrix(raw.seminarMatrix),
    diagnosisFrame: normalizeDiagnosisFrame(raw.diagnosisFrame),
    thoughtExperiment: normalizeThoughtExperiment(raw.thoughtExperiment),
    reasoning_trace: toTextArray(raw.reasoning_trace),
  };
};

const generateVoiceEssay = async (
  topic: string,
  outline: AnalysisOutline,
  voicePlan: AnalysisOutline['voicePlans'][number],
  onDelta?: (delta: string, fullText: string) => void,
  onStep?: (message: string) => void,
): Promise<ThoughtVoice> => {
  onStep?.(`${voicePlan.name} 正在并行生成正文与思想头像...`);
  const avatarPromise = withStage(
    'avatar',
    () => generateThoughtVoiceAvatar(topic, outline, voicePlan),
    { voiceId: voicePlan.id, voiceName: voicePlan.name },
  ).then((avatar) => {
    emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 思想头像已完成。` });
    return avatar;
  }).catch((error) => {
    console.warn(`[sophia] 思想声音头像生成失败：${voicePlan.name}`, error);
    emitLog({ level: 'warn', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 思想头像生成失败，将使用占位。` });
    return undefined;
  });
  const argument = await callChatText([
    { role: 'system', content: resolveVoiceSystemPrompt(getActiveConfig().promptOverrides) },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
大问题：${outline.philosophical_title}
开题：${outline.introduction}
阅读结构：${outline.programStructure.map((s) => `${s.title}：${s.description}`).join('\n')}

请只为这个思想声音写长篇论述：
名称：${voicePlan.name}
类型：${voicePlan.kind}
学派：${voicePlan.school || '无'}
角色：${voicePlan.role}
核心概念：${voicePlan.coreConcept}
一句话观点：${voicePlan.oneLine}
立场摘要：${voicePlan.stance}
诊断：${voicePlan.diagnosis || '无'}
药方：${voicePlan.prescription || '无'}
主张：${voicePlan.thesis || '无'}
可被批评处：${voicePlan.critique || '无'}

直接输出正文，不要 JSON，不要标题。`,
    },
  ], getActiveConfig().options.voiceMaxTokens, onDelta);

  onStep?.(`${voicePlan.name} 正在提炼摘要与可被批评处...`);
  const summary = await callChatJson<{ summaryForSynthesis: string; quote?: string; challenges?: string[] }>([
    { role: 'system', content: '你是哲学分析编辑。请把长文压缩成供最终综合判断使用的 JSON。只输出 JSON。' },
    {
      role: 'user',
      content: `用户问题：${topic}
思想声音：${voicePlan.name}
长文：${argument}

输出 JSON：{"summaryForSynthesis":"120-180字摘要，说明诊断/主张/药方和与其他立场的潜在分歧","quote":"一句适合展示的短句，可合成风格化表达","challenges":["它会挑战的其他立场或问题"]}`,
    },
  ], 1000).catch(() => ({ summaryForSynthesis: voicePlan.stance || voicePlan.oneLine || '', quote: '', challenges: [] }));

  onStep?.(`${voicePlan.name} 正在等待并行头像完成...`);
  const avatar = await avatarPromise;

  return {
    id: voicePlan.id,
    name: voicePlan.name,
    kind: voicePlan.kind,
    school: voicePlan.school,
    role: voicePlan.role,
    coreConcept: voicePlan.coreConcept,
    oneLine: voicePlan.oneLine,
    stance: voicePlan.stance,
    diagnosis: voicePlan.diagnosis,
    prescription: voicePlan.prescription,
    thesis: voicePlan.thesis,
    critique: voicePlan.critique,
    argument,
    quote: summary.quote,
    challenges: Array.isArray(summary.challenges) ? summary.challenges : [],
    summaryForSynthesis: summary.summaryForSynthesis || voicePlan.stance,
    avatar,
    status: 'completed',
  };
};

const generateRouteDetails = async (topic: string, outline: AnalysisOutline): Promise<RouteNode[]> => {
  const result = await callChatJson<{ routeMap: RouteNode[] }>([
    { role: 'system', content: '你是中文哲学分析结构编辑。补全论证路线图，保持短而有推进力。只输出 JSON。' },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
已有路线：${JSON.stringify(outline.routeMap)}

请补全 routeMap，每个节点 plain 120-220字，philosophical 120-220字，必须有清晰推进。不要生成 nextQuestion 字段，继续追问统一留给 followUps。输出 JSON：{"routeMap":[...]}`,
    },
  ], 2500).catch(() => ({ routeMap: outline.routeMap }));
  const routeMap = normalizeRouteMap(result.routeMap);
  return routeMap.length > 0 ? routeMap : outline.routeMap;
};

const generateSynthesis = async (
  topic: string,
  outline: AnalysisOutline,
  voices: ThoughtVoice[],
): Promise<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>> => {
  const fallback: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'> = {
    tensions: [],
    keywords: [],
    followUps: [],
    conclusion: emptyConclusion,
  };

  const raw = await callChatJson<Partial<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>>>([
    { role: 'system', content: resolveSynthesisSystemPrompt(getActiveConfig().promptOverrides) },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
大问题：${outline.philosophical_title}
思想声音摘要：
${voices.map((v) => `${v.name}: ${v.summaryForSynthesis}`).join('\n')}

输出 JSON：
{
  "tensions": [{"id":"tension-1","title":"他们到底在争什么","content":"220-320字，解释这几个声音之间真正在争什么；必须是声音之间的真实分歧，不要逐个复述每个声音的立场","relatedVoiceIds":["voice-id"]}],
  "keywords": [{"id":"keyword-1","term":"关键词","meaning":"这个词是什么意思","importance":"它在这个问题里为什么重要"}],
  "followUps": [{"id":"follow-1","question":"承接当前分析的继续追问","reason":"说明它如何接着当前分歧、关键词或结论往下走"}],
  "conclusion": {"summary":"综合判断，400-700字","openQuestion":"仍然悬而未决的问题","realLifeReturn":"回到用户现实处境，200-350字"}
}

followUps 必须是对当前分析的延伸，不要像另一个全新选题。tensions 至少 2 条；如果声音之间没有真实分歧，要诚实指出"这几位在该问题上有共识、分歧出现在更细的环节"。`,
    },
  ], 3500).catch(() => fallback);

  return {
    tensions: normalizeTensions(raw.tensions),
    keywords: normalizeKeywords(raw.keywords),
    followUps: normalizeFollowUps(raw.followUps),
    conclusion: normalizeConclusion(raw.conclusion),
  };
};

const trimmedVoiceName = (prompt: string) => prompt.replace(/^(我想看看|想看看|让|请|加入|邀请)/, '').replace(/(的看法|会怎么说|加入讨论|回应这个问题)[？?。]*$/, '').trim() || '新的思想声音';

const outlineFromResult = (result: AnalysisResult, voicePlans: AnalysisOutline['voicePlans']): AnalysisOutline => ({
  id: result.id,
  createdAt: result.createdAt,
  topic: result.topic,
  philosophical_title: result.philosophical_title,
  mode: result.mode,
  modeLabel: result.modeLabel,
  introduction: result.introduction,
  questionFrame: result.questionFrame,
  programStructure: result.programStructure,
  routeMap: result.routeMap,
  voicePlans,
  seminarMatrix: result.seminarMatrix,
  diagnosisFrame: result.diagnosisFrame,
  thoughtExperiment: result.thoughtExperiment,
  reasoning_trace: result.reasoning_trace,
});

const planAdditionalVoice = async (existingResult: AnalysisResult, userPrompt: string): Promise<AnalysisOutline['voicePlans'][number]> => {
  const existingVoiceSummary = existingResult.voices
    .map((voice) => `${voice.name}（${voice.kind}）：${voice.summaryForSynthesis || voice.stance || voice.oneLine}`)
    .join('\n');
  const existingIds = new Set(existingResult.voices.map((voice) => voice.id));
  const fallbackPlan = {
    id: makeId('voice'),
    name: trimmedVoiceName(userPrompt),
    kind: 'philosopher' as VoiceKind,
    school: '',
    role: '后来加入的思想声音',
    coreConcept: '延展视角',
    oneLine: `沿着“${userPrompt}”加入当前分析`,
    stance: `回应用户希望补充的视角：${userPrompt}`,
    diagnosis: '',
    prescription: '',
    thesis: '',
    critique: '',
  };
  const raw = await callChatJson<any>([
    {
      role: 'system',
      content: '你是 Sophia 的思想声音策展人。请把用户的延展请求规划成一个新的思想声音，不写正文，只输出 JSON。',
    },
    {
      role: 'user',
      content: `当前分析标题：${existingResult.philosophical_title}
原始问题：${existingResult.topic}
核心问题：${existingResult.questionFrame.bigQuestion}
分析路径：${existingResult.modeLabel}
已有思想声音：
${existingVoiceSummary || '无'}
已有核心分歧：
${existingResult.tensions.map((tension) => `${tension.title}: ${tension.content}`).join('\n') || '无'}
当前综合判断：${existingResult.conclusion.summary || '无'}
用户希望加入的新声音：${userPrompt}

请规划一个新的 voicePlan。要求：
- 如果用户点名哲学家或思想家，例如“加缪会怎么说”，就以这个人物为新声音。
- 如果用户点名流派、概念或立场，就选择合适的 kind。
- 不要重复已有思想声音，除非用户明确要求同一声音的另一种版本。
- 必须贴合当前问题，而不是泛泛介绍哲学史。

输出 JSON：{
  "voicePlan": {
    "name":"哲学家/流派/概念/立场名",
    "kind":"philosopher|school|concept|position|contemporary",
    "school":"学派，可选",
    "role":"它在当前分析中承担的角色",
    "coreConcept":"核心概念",
    "oneLine":"一句话观点",
    "stance":"立场摘要",
    "diagnosis":"如果适用，诊断",
    "prescription":"如果适用，药方",
    "thesis":"如果适用，主张",
    "critique":"如果适用，会受到的批评"
  }
}`,
    },
  ], 1600).catch(() => ({ voicePlan: fallbackPlan }));

  const [normalizedPlan] = normalizeVoicePlans([raw?.voicePlan || raw]);
  const id = makeId('voice');
  const voicePlan = normalizedPlan || fallbackPlan;
  return {
    ...voicePlan,
    id: existingIds.has(voicePlan.id) ? id : (voicePlan.id || id),
  };
};

export const appendThoughtVoice = async (
  existingResult: AnalysisResult,
  userPrompt: string,
  callbacks: AppendVoiceCallbacks = {},
): Promise<AnalysisResult> => {
  const trimmedPrompt = userPrompt.trim();
  if (!trimmedPrompt) return existingResult;

  const ctx = pushRunContext({
    stage: 'append',
    onLog: callbacks.onLog,
    onTokenUsage: callbacks.onTokenUsage,
  });
  emitLog({ level: 'info', stage: 'meta', message: `邀请新声音：${trimmedPrompt}` });

  try {
    const voicePlan = await planAdditionalVoice(existingResult, trimmedPrompt);
    emitLog({ level: 'info', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `已规划新声音：${voicePlan.name}（${voicePlan.kind}）。` });
    const addedAt = new Date().toISOString();
    const placeholder: ThoughtVoice = {
      ...voicePlan,
      argument: '',
      summaryForSynthesis: '',
      status: 'queued',
      addedByUserPrompt: trimmedPrompt,
      addedAt,
    };
    callbacks.onVoicePlanned?.(placeholder);

    const outline = outlineFromResult(existingResult, [voicePlan]);
    callbacks.onVoiceStart?.(voicePlan.id, voicePlan.name);

    const reportStep = (message: string) => {
      callbacks.onVoiceStep?.(voicePlan.id, voicePlan.name, message);
      emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message });
    };
    const voice = await withStage('voices', () => generateVoiceEssay(
      existingResult.topic,
      outline,
      voicePlan,
      (delta, fullText) => callbacks.onVoiceDelta?.(voicePlan.id, delta, fullText),
      reportStep,
    ), { voiceId: voicePlan.id, voiceName: voicePlan.name }).catch(async () => withStage('voices', () => generateVoiceEssay(existingResult.topic, outline, voicePlan, undefined, reportStep), { voiceId: voicePlan.id, voiceName: voicePlan.name }));
    const appendedVoice: ThoughtVoice = {
      ...voice,
      addedByUserPrompt: trimmedPrompt,
      addedAt,
      status: 'completed',
    };
    callbacks.onVoiceComplete?.(appendedVoice);
    emitLog({ level: 'info', stage: 'voices', voiceId: appendedVoice.id, voiceName: appendedVoice.name, message: `${appendedVoice.name} 已加入分析（${appendedVoice.argument.length} 字），正在重算分歧与综合判断...` });

    const voices = [...existingResult.voices, appendedVoice];
    const synthesisVoices = voices.filter((item) => item.status !== 'failed' && item.summaryForSynthesis);
    const synthesis = await withStage('synthesis', () => generateSynthesis(existingResult.topic, outlineFromResult(existingResult, [voicePlan]), synthesisVoices));
    callbacks.onSynthesis?.(synthesis);
    emitLog({ level: 'info', stage: 'synthesis', message: '综合判断已重新整理。' });

    return {
      ...existingResult,
      voices,
      tensions: normalizeTensions(synthesis.tensions),
      keywords: normalizeKeywords(synthesis.keywords),
      followUps: normalizeFollowUps(synthesis.followUps),
      conclusion: normalizeConclusion(synthesis.conclusion),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '生成失败';
    const failedVoice: ThoughtVoice = {
      argument: '',
      summaryForSynthesis: '',
      id: makeId('voice'),
      name: trimmedVoiceName(trimmedPrompt),
      kind: 'philosopher',
      role: '后来加入的思想声音',
      coreConcept: '延展视角',
      oneLine: trimmedPrompt,
      stance: trimmedPrompt,
      status: 'failed',
      error: message,
      addedByUserPrompt: trimmedPrompt,
    };
    callbacks.onVoiceComplete?.(failedVoice);
    callbacks.onError?.(message);
    emitLog({ level: 'error', stage: 'voices', message: `新声音生成失败：${message}` });
    return {
      ...existingResult,
      voices: [...existingResult.voices, failedVoice],
    };
  } finally {
    popRunContext(ctx);
  }
};

export const regenerateThoughtVoice = async (
  existingResult: AnalysisResult,
  voiceId: string,
  callbacks: AppendVoiceCallbacks = {},
): Promise<AnalysisResult> => {
  const failedVoice = existingResult.voices.find((voice) => voice.id === voiceId);
  if (!failedVoice) {
    const message = '找不到要重新生成的思想声音。';
    callbacks.onError?.(message);
    throw new Error(message);
  }

  const voicePlan: AnalysisOutline['voicePlans'][number] = {
    id: failedVoice.id,
    name: failedVoice.name,
    kind: failedVoice.kind,
    school: failedVoice.school,
    role: failedVoice.role,
    coreConcept: failedVoice.coreConcept,
    oneLine: failedVoice.oneLine,
    stance: failedVoice.stance,
    diagnosis: failedVoice.diagnosis,
    prescription: failedVoice.prescription,
    thesis: failedVoice.thesis,
    critique: failedVoice.critique,
  };
  const outline = outlineFromResult(existingResult, [voicePlan]);

  const ctx = pushRunContext({
    stage: 'voices',
    voiceId: voicePlan.id,
    voiceName: voicePlan.name,
    onLog: callbacks.onLog,
    onTokenUsage: callbacks.onTokenUsage,
  });
  callbacks.onVoiceStart?.(voicePlan.id, voicePlan.name);
  emitLog({ level: 'info', stage: 'voices', message: `正在重新生成 ${voicePlan.name}...` });

  const reportStep = (message: string) => {
    callbacks.onVoiceStep?.(voicePlan.id, voicePlan.name, message);
    emitLog({ level: 'detail', stage: 'voices', message });
  };

  try {
    const voice = await generateVoiceEssay(
      existingResult.topic,
      outline,
      voicePlan,
      (delta, fullText) => callbacks.onVoiceDelta?.(voicePlan.id, delta, fullText),
      reportStep,
    ).catch(async () => generateVoiceEssay(existingResult.topic, outline, voicePlan, undefined, reportStep));

    const refreshed: ThoughtVoice = {
      ...voice,
      addedByUserPrompt: failedVoice.addedByUserPrompt,
      addedAt: failedVoice.addedAt,
      status: 'completed',
      error: undefined,
    };
    callbacks.onVoiceComplete?.(refreshed);
    emitLog({ level: 'info', stage: 'voices', message: `${voicePlan.name} 重新生成完成（${refreshed.argument.length} 字）。` });

    const voices = existingResult.voices.map((v) => v.id === voiceId ? refreshed : v);
    const synthesisVoices = voices.filter((v) => v.status !== 'failed' && v.summaryForSynthesis);
    let synthesis: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'> | null = null;
    try {
      synthesis = await withStage('synthesis', () => generateSynthesis(existingResult.topic, outline, synthesisVoices));
      callbacks.onSynthesis?.(synthesis);
    } catch (synthesisError) {
      // eslint-disable-next-line no-console
      console.warn('[sophia][regenerate] synthesis after retry failed; keeping previous tensions/keywords/conclusion:', synthesisError);
      emitLog({ level: 'warn', stage: 'synthesis', message: '重新生成后整理分歧失败，保留上一份分歧与综合判断。' });
    }

    return {
      ...existingResult,
      voices,
      tensions: synthesis ? normalizeTensions(synthesis.tensions) : existingResult.tensions,
      keywords: synthesis ? normalizeKeywords(synthesis.keywords) : existingResult.keywords,
      followUps: synthesis ? normalizeFollowUps(synthesis.followUps) : existingResult.followUps,
      conclusion: synthesis ? normalizeConclusion(synthesis.conclusion) : existingResult.conclusion,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '重新生成失败';
    const stillFailed: ThoughtVoice = {
      ...failedVoice,
      argument: '',
      summaryForSynthesis: '',
      status: 'failed',
      error: message,
    };
    callbacks.onVoiceComplete?.(stillFailed);
    callbacks.onError?.(message);
    emitLog({ level: 'error', stage: 'voices', message: `${voicePlan.name} 重新生成失败：${message}` });
    return {
      ...existingResult,
      voices: existingResult.voices.map((v) => v.id === voiceId ? stillFailed : v),
    };
  } finally {
    popRunContext(ctx);
  }
};

export const createPartialResult = (outline: AnalysisOutline): AnalysisResult => ({
  id: outline.id,
  createdAt: outline.createdAt,
  topic: outline.topic,
  philosophical_title: outline.philosophical_title,
  mode: outline.mode,
  modeLabel: outline.modeLabel,
  introduction: outline.introduction,
  questionFrame: outline.questionFrame,
  programStructure: outline.programStructure,
  routeMap: outline.routeMap,
  voices: outline.voicePlans.map((voice) => ({
    ...voice,
    argument: '',
    summaryForSynthesis: '',
    status: 'queued',
  })),
  tensions: [],
  keywords: [],
  followUps: [],
  seminarMatrix: outline.seminarMatrix,
  diagnosisFrame: outline.diagnosisFrame,
  thoughtExperiment: outline.thoughtExperiment,
  conclusion: emptyConclusion,
  reasoning_trace: outline.reasoning_trace,
});

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

export const analyzeTopic = async (
  userTopic: string,
  callbacks: AnalyzeCallbacks = {},
  continuationContext?: ContinuationContext,
): Promise<AnalysisResult> => {
  const report = (progress: GenerationProgress) => callbacks.onProgress?.(progress);
  const tokenUsage: TokenUsage[] = [];
  const ctx = pushRunContext({
    stage: 'outline',
    onLog: callbacks.onLog,
    onTokenUsage: (usage) => {
      tokenUsage.push(usage);
      callbacks.onTokenUsage?.(usage);
    },
  });

  try {
    emitLog({ level: 'info', stage: 'outline', message: continuationContext ? '正在沿着上一份分析继续展开思想地图...' : '正在把问题整理成一张思想地图...' });
    report({
      stage: 'outline',
      totalVoices: 0,
      completedVoices: 0,
      messages: [continuationContext ? '正在沿着上一份分析继续展开...' : '正在把问题整理成一张思想地图...'],
    });
    const stopOutlineHeartbeat = startHeartbeat('outline', '正在等待问题图谱返回');
    let outline: AnalysisOutline;
    try {
      outline = await generateOutline(userTopic, continuationContext);
    } finally {
      stopOutlineHeartbeat();
    }
    callbacks.onOutline?.(outline);
    emitLog({ level: 'info', stage: 'outline', message: `问题图谱已成形 · 分析路径：${outline.modeLabel}（计划 ${outline.voicePlans.length} 位思想声音）。` });

    let result = createPartialResult(outline);
    ctx.stage = 'route';
    report({
      stage: 'route',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: 0,
      messages: [`已形成分析路径：${outline.modeLabel}`, '正在补全论证路线图...'],
    });
    emitLog({ level: 'info', stage: 'route', message: '正在补全论证路线图...' });

    const stopRouteHeartbeat = startHeartbeat('route', '正在等待论证路线图返回');
    let routeMap;
    try {
      routeMap = await generateRouteDetails(userTopic, outline);
    } finally {
      stopRouteHeartbeat();
    }
    result = { ...result, routeMap };
    callbacks.onRouteMap?.(routeMap);
    emitLog({ level: 'info', stage: 'route', message: `已生成 ${routeMap.length} 个路线节点。` });

    const voices: ThoughtVoice[] = [];
    ctx.stage = 'voices';
    report({
      stage: 'voices',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: 0,
      messages: [`正在生成 ${outline.voicePlans.length} 个长篇思想声音...`],
    });
    emitLog({ level: 'info', stage: 'voices', message: `准备并发生成 ${outline.voicePlans.length} 个思想声音（并发数 ${getActiveConfig().options.voiceConcurrency}）。` });

    const generatedVoices = await runWithConcurrency(outline.voicePlans, getActiveConfig().options.voiceConcurrency, async (voicePlan) => {
      callbacks.onVoiceStart?.(voicePlan.id, voicePlan.name);
      emitLog({ level: 'info', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 启动。` });
      report({
        stage: 'voices',
        modeLabel: outline.modeLabel,
        totalVoices: outline.voicePlans.length,
        completedVoices: voices.length,
        currentVoiceName: voicePlan.name,
        messages: [`正在生成：${voicePlan.name}`],
      });

      try {
        const reportVoiceStep = (message: string) => {
          callbacks.onVoiceStep?.(voicePlan.id, voicePlan.name, message);
          emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message });
          report({
            stage: 'voices',
            modeLabel: outline.modeLabel,
            totalVoices: outline.voicePlans.length,
            completedVoices: voices.length,
            currentVoiceName: voicePlan.name,
            messages: [message],
          });
        };
        let lastStreamLogTs = 0;
        const voice = await withStage('voices', () => generateVoiceEssay(userTopic, outline, voicePlan, (delta, fullText) => {
          callbacks.onVoiceDelta?.(voicePlan.id, delta, fullText);
          const now = Date.now();
          if (now - lastStreamLogTs >= 3000) {
            lastStreamLogTs = now;
            emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 正文流式输出：${fullText.length} 字。` });
          }
          report({
            stage: 'voices',
            modeLabel: outline.modeLabel,
            totalVoices: outline.voicePlans.length,
            completedVoices: voices.length,
            currentVoiceName: voicePlan.name,
            streamedChars: fullText.length,
            messages: [`${voicePlan.name} 正在生成长篇论述...`],
          });
        }, reportVoiceStep), { voiceId: voicePlan.id, voiceName: voicePlan.name }).catch(async () => withStage('voices', () => generateVoiceEssay(userTopic, outline, voicePlan, undefined, reportVoiceStep), { voiceId: voicePlan.id, voiceName: voicePlan.name }));
        voices.push(voice);
        callbacks.onVoiceComplete?.(voice);
        emitLog({
          level: 'info',
          stage: 'voices',
          voiceId: voicePlan.id,
          voiceName: voicePlan.name,
          message: `${voicePlan.name} 已完成（${voice.argument.length} 字）。${voice.avatar ? '' : '思想头像未生成，使用占位。'}`,
        });
        report({
          stage: 'voices',
          modeLabel: outline.modeLabel,
          totalVoices: outline.voicePlans.length,
          completedVoices: voices.length,
          currentVoiceName: voicePlan.name,
          messages: [`${voicePlan.name} 已完成。`],
        });
        return voice;
      } catch (error) {
        const message = error instanceof Error ? error.message : '生成失败';
        const failed: ThoughtVoice = {
          ...voicePlan,
          argument: '',
          summaryForSynthesis: '',
          status: 'failed',
          error: message,
        };
        callbacks.onVoiceComplete?.(failed);
        emitLog({ level: 'error', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 失败：${message}` });
        return failed;
      }
    });

    const completedVoices = generatedVoices.filter((voice) => voice.status === 'completed');
    ctx.stage = 'synthesis';
    report({
      stage: 'synthesis',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: completedVoices.length,
      messages: ['正在生成分歧、关键词和综合判断...'],
    });
    emitLog({ level: 'info', stage: 'synthesis', message: `所有思想声音已收束（${completedVoices.length}/${outline.voicePlans.length} 完成），正在生成分歧、关键词与综合判断...` });
    const stopSynthesisHeartbeat = startHeartbeat('synthesis', '正在等待综合判断返回');
    let synthesis;
    try {
      synthesis = await generateSynthesis(userTopic, outline, completedVoices);
    } finally {
      stopSynthesisHeartbeat();
    }
    callbacks.onSynthesis?.(synthesis);
    emitLog({ level: 'info', stage: 'synthesis', message: `综合判断已完成（${synthesis.tensions.length} 条分歧 / ${synthesis.keywords.length} 个关键词 / ${synthesis.followUps.length} 条延伸追问）。` });

    const totalTokens = tokenUsage.reduce((sum, entry) => sum + entry.totalTokens, 0);
    result = {
      ...result,
      voices: result.voices.map((placeholder) => generatedVoices.find((voice) => voice.id === placeholder.id) || placeholder),
      tensions: normalizeTensions(synthesis.tensions),
      keywords: normalizeKeywords(synthesis.keywords),
      followUps: normalizeFollowUps(synthesis.followUps),
      conclusion: normalizeConclusion(synthesis.conclusion),
      metadata: { tokenUsage, totalTokens },
    };

    ctx.stage = 'done';
    report({
      stage: 'done',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: completedVoices.length,
      messages: ['这份哲学分析已生成完成。'],
    });
    emitLog({ level: 'info', stage: 'done', message: `整份分析已生成完成（累计 ${totalTokens} tokens）。` });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '发生了未知错误';
    callbacks.onError?.(message);
    report({ stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] });
    emitLog({ level: 'error', stage: 'error', message: `生成中断：${message}` });
    throw error;
  } finally {
    popRunContext(ctx);
  }
};

export const generateQuestionSuggestions = async (seedTopic = ''): Promise<string[]> => {
  const ctx = pushRunContext({
    stage: 'suggestion',
    onTokenUsage: (usage) => recordUsageStandalone(usage),
  });
  try {
    const raw = await callChatJson<{ questions: string[] }>([
      {
        role: 'system',
        content: '你是 Sophia 的首页问题策展人。请生成适合被哲学分析器展开的中文问题。只输出 JSON。',
      },
      {
        role: 'user',
        content: `请生成 5 个适合首页展示的哲学问题。
${seedTopic ? `用户当前输入或兴趣：${seedTopic}` : '用户没有输入具体兴趣，请覆盖生活焦虑、伦理困境、认识论、社会议题和存在问题。'}

要求：
- 每个问题 8-22 个中文字符左右，必须以问号结尾。
- 问题要具体、有张力、普通人也愿意点击。
- 不要重复首页已有问题；如果用户给了当前兴趣，围绕它生成更尖锐的变体。
- 不要输出解释。

输出 JSON：{"questions":["问题1？","问题2？","问题3？","问题4？","问题5？"]}`,
      },
    ], 900);

    const questions = normalizeQuestionSuggestions(raw.questions);
    return questions.length > 0 ? questions : [];
  } finally {
    popRunContext(ctx);
  }
};

const truncateForReflection = (value: string | undefined, maxLength = 360) => {
  const text = (value || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

const stripReplyMarkdown = (value: string) => value
  .replace(/```(?:\w+)?\s*([\s\S]*?)```/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/__([^_]+)__/g, '$1')
  .replace(/^\s{0,3}#{1,6}\s+/gm, '')
  .replace(/^\s*[-*]\s+/gm, '')
  .trim();

const buildReflectionContext = (result: AnalysisResult) => {
  const voices = result.voices
    .filter((voice) => voice.status !== 'failed')
    .map((voice, index) => [
      `${index + 1}. ${voice.name}`,
      `类型：${voice.kind}${voice.school ? ` / ${voice.school}` : ''}`,
      `角色：${truncateForReflection(voice.role, 160)}`,
      `核心概念：${truncateForReflection(voice.coreConcept, 160)}`,
      `一句话：${truncateForReflection(voice.oneLine || voice.stance, 220)}`,
      voice.thesis ? `主张：${truncateForReflection(voice.thesis, 220)}` : '',
      voice.critique ? `批评：${truncateForReflection(voice.critique, 220)}` : '',
      voice.summaryForSynthesis ? `综合摘要：${truncateForReflection(voice.summaryForSynthesis, 360)}` : '',
      voice.argument ? `正文片段：${truncateForReflection(voice.argument, 420)}` : '',
    ].filter(Boolean).join('\n'))
    .join('\n\n');

  const keywords = result.keywords
    .map((keyword) => `${keyword.term}：${truncateForReflection(keyword.meaning, 220)}${keyword.importance ? `；重要性：${truncateForReflection(keyword.importance, 180)}` : ''}`)
    .join('\n');

  const tensions = result.tensions
    .map((tension, index) => `${index + 1}. ${tension.title}：${truncateForReflection(tension.content, 320)}`)
    .join('\n');

  const routeMap = result.routeMap
    .map((node, index) => `${index + 1}. ${node.title}：${truncateForReflection(node.plain, 220)}${node.tension ? `；张力：${truncateForReflection(node.tension, 180)}` : ''}`)
    .join('\n');

  return [
    `标题：${result.philosophical_title}`,
    `原始问题：${result.topic}`,
    `核心问题：${result.questionFrame.bigQuestion}`,
    `现实翻译：${result.questionFrame.plainTranslation}`,
    result.introduction ? `导言：${truncateForReflection(result.introduction, 420)}` : '',
    keywords ? `\n概念标记：\n${keywords}` : '',
    routeMap ? `\n论证路线：\n${routeMap}` : '',
    voices ? `\n思想声音：\n${voices}` : '',
    tensions ? `\n主要分歧：\n${tensions}` : '',
    result.conclusion.summary ? `\n暂时合流：${truncateForReflection(result.conclusion.summary, 520)}` : '',
    result.conclusion.openQuestion ? `仍然悬着的问题：${truncateForReflection(result.conclusion.openQuestion, 260)}` : '',
  ].filter(Boolean).join('\n');
};

export const getReflectionFeedback = async (result: AnalysisResult, userReflection: string): Promise<string> => {
  const ctx = pushRunContext({
    stage: 'reflection',
    onTokenUsage: (usage) => recordUsageStandalone(usage),
  });
  try {
    const response = await callChatText([
      {
        role: 'system',
        content: `你是 Sophia，一个正在和用户讨论当前分析结果的哲学对话者。必须紧扣用户面前这份分析的具体内容回答，而不是凭外部常识泛泛解释。若用户点名某个声音、概念、分歧或卡片标题，要优先解释这个对象在当前分析里的含义。不要编造当前分析里没有的立场。输出纯文本，不使用 Markdown 标记：不要 **、不要标题符号、不要项目符号。语气要像对话：准确、清楚、能继续追问。`,
      },
      {
        role: 'user',
        content: `当前分析上下文：\n${buildReflectionContext(result)}\n\n用户对 Sophia 说：${userReflection}\n\n请直接回应用户。若用户是在要求”换一种说法/更日常解释”，就先用日常语言解释其点名对象，再补一句它在整场分析中的作用，最后给一个更准确的追问方向。180-420 字。`,
      },
    ], 1200);
    return stripReplyMarkdown(response);
  } catch (error) {
    console.error('Reflection feedback error:', error);
    return 'Sophia 暂时无法回应，请稍后再试。';
  } finally {
    popRunContext(ctx);
  }
};
