import {
  AnalysisOutline,
  AnalysisResult,
  AnalyzeCallbacks,
  AppendVoiceCallbacks,
  ContinuationContext,
  GenerationLogEntry,
  GenerationProgress,
  KeywordExplainer,
  Message,
  OpenConclusion,
  ProgramMode,
  RouteNode,
  RunControlHandle,
  RunSnapshot,
  TensionFocus,
  ThoughtVoice,
  ThoughtVoiceImageAvatar,
  ThoughtExperimentImage,
  TokenUsage,
  TokenUsageStage,
  VoiceInsertSeed,
  VoiceKind,
  emptyConclusion,
} from '../types';
import { buildVoicePersona } from './voiceChat';
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
import { buildAnalysisProfileInstruction } from './analysisProfile';
import { buildUsage, recordUsage as recordUsageStandalone } from './tokenAccounting';
import { ModelJsonParseError, parseModelJson } from './jsonResponse';
import { buildStageKey, getStageEntry, putStageEntry, withStageCache } from './stageCache';
import {
  apiErrorMessage,
  chatEndpoint,
  extractChatCompletionContent,
  fetchWithRetry,
  imageEndpoint,
  parseChatCompletionResponseText,
  requestHeaders,
  type ChatMessage,
} from './apiClient';

export { THOUGHT_VOICE_AVATAR_STYLE } from './prompts';

interface RunContext {
  onLog?: (entry: GenerationLogEntry) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
  stage: TokenUsageStage;
  voiceId?: string;
  voiceName?: string;
  /**
   * Run-wide cancel signal (e.g., the user clicked "取消"). Threaded into
   * fetchWithRetry by the chat/image callers below. When this fires every
   * in-flight network call aborts.
   */
  abortSignal?: AbortSignal;
  /**
   * Per-voice cancel signal pushed onto the stack while a voice is being
   * generated. Skipping a single voice aborts only this signal, leaving the
   * run-wide signal alive so the rest of the pipeline keeps going.
   */
  voiceAbortSignal?: AbortSignal;
}

const runStack: RunContext[] = [];

const currentRunContext = (): RunContext | null => runStack[runStack.length - 1] || null;

/**
 * Compose the run-wide signal with the per-voice signal so a single call to
 * fetchWithRetry can react to either. We can't use AbortSignal.any (not in
 * TS lib targets here) so a tiny manual fan-in does the job.
 */
const effectiveSignal = (ctx: RunContext | null): AbortSignal | undefined => {
  if (!ctx) return undefined;
  const { abortSignal: run, voiceAbortSignal: voice } = ctx;
  if (!run && !voice) return undefined;
  if (run && !voice) return run;
  if (voice && !run) return voice;
  // Both present — fan in by aborting a fresh controller when either fires.
  const merged = new AbortController();
  const onAbort = (origin?: AbortSignal) => merged.abort(origin?.reason);
  if (run!.aborted) merged.abort(run!.reason);
  else run!.addEventListener('abort', () => onAbort(run!), { once: true });
  if (voice!.aborted) merged.abort(voice!.reason);
  else voice!.addEventListener('abort', () => onAbort(voice!), { once: true });
  return merged.signal;
};

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
  const ctx = pushRunContext({
    ...top,
    stage,
    voiceId: extra?.voiceId ?? top.voiceId,
    voiceName: extra?.voiceName ?? top.voiceName,
  });
  return fn().finally(() => popRunContext(ctx));
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

const HEARTBEAT_MESSAGES: Partial<Record<GenerationLogEntry['stage'], string[]>> = {
  outline: [
    '[keepalive] outline · waiting on /chat/completions JSON response',
    '[keepalive] outline · parsing questionFrame / programStructure / routeMap / voicePlans',
    '[keepalive] outline · server-side reasoning still running',
  ],
  route: [
    '[keepalive] route · waiting on /chat/completions JSON response',
    '[keepalive] route · expanding routeMap nodes and tension links',
    '[keepalive] route · server-side reasoning still running',
  ],
  synthesis: [
    '[keepalive] synthesis · waiting on /chat/completions JSON response',
    '[keepalive] synthesis · merging tensions / keywords / followUps / conclusion',
    '[keepalive] synthesis · server-side reasoning still running',
  ],
};

const startHeartbeat = (stage: GenerationLogEntry['stage'], label: string, intervalMs = 18000) => {
  if (typeof window === 'undefined') return () => {};
  const messages = HEARTBEAT_MESSAGES[stage] || [label];
  const ctx = currentRunContext();
  const voiceId = ctx?.voiceId;
  const voiceName = ctx?.voiceName;
  let index = 0;
  const emitBeat = () => {
    const message = messages[index % messages.length];
    index += 1;
    emitLog({
      level: 'detail',
      stage,
      voiceId,
      voiceName,
      message: `${message}。`,
    });
  };
  const handle = window.setInterval(emitBeat, intervalMs);
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

const shortRandomId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '').slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
};

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${shortRandomId()}`;

const parseJson = <T>(content: string): T => parseModelJson<T>(content);

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

class ImageGenerationError extends Error {
  status?: number;
  retryable: boolean;

  constructor(message: string, options: { status?: number; retryable?: boolean } = {}) {
    super(message);
    this.name = 'ImageGenerationError';
    this.status = options.status;
    this.retryable = options.retryable ?? true;
  }
}

const isRetryableImageStatus = (status: number): boolean =>
  status === 408 || status === 429 || status >= 500;

const computeImageRetryDelayMs = (retryIndex: number): number => {
  const base = 1000 * Math.pow(2, retryIndex);
  const jitter = Math.floor(Math.random() * 500);
  return Math.min(base + jitter, 10000);
};

const waitForImageRetry = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('aborted by caller', 'AbortError'));
    return;
  }
  const timeoutId = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  const onAbort = () => {
    clearTimeout(timeoutId);
    reject(new DOMException('aborted by caller', 'AbortError'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

const callAvatarImageRequest = async (prompt: string, signal?: AbortSignal): Promise<string> => {
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
    }, { timeoutMs: 120000, maxAttempts: 1, label: 'avatar-image', signal });

    if (!response.ok) {
      throw new ImageGenerationError(await apiErrorMessage(response), {
        status: response.status,
        retryable: isRetryableImageStatus(response.status),
      });
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

const callAvatarImage = async (prompt: string): Promise<string> => {
  const signal = effectiveSignal(currentRunContext());
  const retryCount = Math.max(0, Math.round(getActiveConfig().options.imageRetryCount));
  const maxAttempts = retryCount + 1;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('aborted by caller', 'AbortError');

    try {
      if (attempt > 0) {
        emitLog({
          level: 'detail',
          stage: 'avatar',
          message: `图片生成重试中：${attempt}/${retryCount}。`,
        });
      }
      return await callAvatarImageRequest(prompt, signal);
    } catch (error) {
      lastError = error;
      if (signal?.aborted) throw error;

      const retryable = !(error instanceof ImageGenerationError) || error.retryable;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!retryable || isLastAttempt) throw error;

      const delay = computeImageRetryDelayMs(attempt);
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[sophia][avatar-image] image generation failed on attempt ${attempt + 1}/${maxAttempts}; retrying in ${delay}ms: ${reason}`);
      emitLog({
        level: 'warn',
        stage: 'avatar',
        message: `图片生成失败，准备重试：${attempt + 1}/${retryCount}。`,
      });
      await waitForImageRetry(delay, signal);
    }
  }

  throw lastError ?? new Error('[sophia][avatar-image] image generation retries exhausted');
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
  const cfg = getActiveConfig();
  // The prompt already incorporates style overrides + cfg-derived inputs, so
  // the prompt + image model + size form a complete fingerprint for the
  // image call. We cache the whole avatar object (URL + metadata) so a hit
  // can skip the /images/generations round-trip entirely.
  return withStageCache<ThoughtVoiceImageAvatar>(
    'avatar',
    {
      prompt,
      model: cfg.avatarImageModel,
      size: cfg.avatarImageSize,
      aspect: cfg.avatarAspectHint,
      voiceKind: voicePlan.kind,
    },
    async () => {
      const imageUrl = await callAvatarImage(prompt);
      return {
        imageUrl,
        prompt,
        style: voicePlan.kind === 'philosopher'
          ? resolveHistoricalPhilosopherAvatarStyle(cfg.promptOverrides)
          : resolveThoughtVoiceAvatarStyle(cfg.promptOverrides),
        model: cfg.avatarImageModel,
        alt: `${voicePlan.name} 的竖版思想声音头像`,
        generatedAt: new Date().toISOString(),
        subjectType: voicePlan.kind,
      };
    },
    {
      onHit: () => emitLog({
        level: 'detail',
        stage: 'avatar',
        voiceName: voicePlan.name,
        message: `${voicePlan.name} 命中阶段缓存：复用上次的思想头像。`,
      }),
    },
  );
};

// Appended as an extra system message on the second attempt of callChatJson when
// the first attempt returned content we couldn't parse even after markdown recovery.
// Some providers (Grok we've seen in practice) ignore response_format hints and wrap
// the JSON in **bold** or prepend prose; this clause is a stronger lever.
const STRICT_JSON_REINFORCEMENT = '严格规则：仅输出一个有效的 JSON 对象。不要使用 Markdown 代码围栏（``` 或 ```json），不要加粗体（**）或斜体（*、_）修饰，不要在 JSON 前后添加任何文字、注释或致谢。整个回复必须能被 JSON.parse 直接解析。';

const callChatJsonOnce = async <T>(
  messages: ChatMessage[],
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
  }, { timeoutMs: 90000, label: attemptLabel, signal: effectiveSignal(currentRunContext()) });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  const text = await response.text();
  const data = parseChatCompletionResponseText(text);
  recordUsageFromResponse(data?.usage);
  const content = extractChatCompletionContent(data);
  if (!content) {
    throw new ModelJsonParseError('苏菲没有回应。API 返回数据格式异常。', '');
  }
  return parseJson<T>(content);
};

const callChatJson = async <T>(messages: ChatMessage[], maxTokens = 4096): Promise<T> => {
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

const callChatTextNonStreaming = async (
  messages: ChatMessage[],
  maxTokens = 4096,
): Promise<string> => {
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
    }),
  }, { timeoutMs: 120000, label: 'chat-text', signal: effectiveSignal(currentRunContext()) });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }

  const text = await response.text();
  const data = parseChatCompletionResponseText(text);
  recordUsageFromResponse(data?.usage);
  return extractChatCompletionContent(data);
};

const fallbackToNonStreamingText = async (
  messages: ChatMessage[],
  maxTokens: number,
  onDelta: ((delta: string, fullText: string) => void) | undefined,
  reason: string,
): Promise<string> => {
  // eslint-disable-next-line no-console
  console.warn(`[sophia][chat-text-stream] ${reason}; falling back to non-streaming request`);
  emitLog({
    level: 'warn',
    stage: currentRunContext()?.stage ?? 'voices',
    message: `流式响应异常（${reason}），自动回退到非流式重试。`,
  });
  const text = await callChatTextNonStreaming(messages, maxTokens);
  onDelta?.(text, text);
  return text;
};

const callChatText = async (
  messages: ChatMessage[],
  maxTokens = 4096,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> => {
  if (!onDelta) return callChatTextNonStreaming(messages, maxTokens);

  // Streaming path: connect with retry+timeout, then read body with per-chunk idle timeout.
  const cfg = getActiveConfig();
  const streamSignal = effectiveSignal(currentRunContext());
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
  }, { timeoutMs: 60000, label: 'chat-text-stream-connect', signal: streamSignal });

  if (!response.ok) {
    const message = await apiErrorMessage(response);
    return fallbackToNonStreamingText(messages, maxTokens, onDelta, `流式连接失败：${message}`);
  }

  if (!response.body) {
    return fallbackToNonStreamingText(messages, maxTokens, onDelta, `${cfg.apiProvider} 没有返回可读的流式响应`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  // The outer signal (run cancel / voice skip) was only attached to fetchWithRetry's
  // internal controller, which has already been detached by the time we hold the
  // reader. Re-attach a listener so cancelling now actually breaks the stream.
  const onOuterAbort = () => {
    reader.cancel(streamSignal?.reason ?? new DOMException('aborted by caller', 'AbortError')).catch(() => {});
  };
  if (streamSignal) {
    if (streamSignal.aborted) onOuterAbort();
    else streamSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

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
    if (idleAborted && fullText.length < STREAM_FALLBACK_MIN_CHARS) {
      return fallbackToNonStreamingText(messages, maxTokens, onDelta, '流式响应空闲超时');
    }
    return fullText;
  } catch (error) {
    disarmIdleTimer();
    // Outer cancel / voice skip — propagate the abort instead of trying to
    // fall back, otherwise we'd just hammer a fresh fetch that immediately
    // rejects with the same AbortError.
    if (streamSignal?.aborted) {
      throw error instanceof Error ? error : new DOMException('aborted', 'AbortError');
    }
    // If the stream broke early without producing meaningful content, fall back to a
    // non-streaming retry so the user still gets something readable.
    const reason = idleAborted
      ? '流式响应空闲超时'
      : error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    if (fullText.length < STREAM_FALLBACK_MIN_CHARS) {
      return fallbackToNonStreamingText(messages, maxTokens, onDelta, `流式响应在 ${fullText.length} 字后中断：${reason}`);
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

const isKeywordEnriched = (kw: Pick<KeywordExplainer, 'definition' | 'misconception' | 'representativeFigures' | 'relationToQuestion' | 'lifeExample' | 'challengeQuestion' | 'furtherReading'>): boolean => {
  // Treat the keyword as "enriched" only when at least 4 of the 7 long-form
  // fields are present. Synthesis often returns 6-7; older / partial results
  // returning 0-3 should still trigger the enrichment LLM call.
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

const normalizeKeyword = (item: unknown, index: number): KeywordExplainer => {
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

const normalizeKeywords = (value: unknown): KeywordExplainer[] =>
  Array.isArray(value) ? value.map(normalizeKeyword) : [];

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
  const cfg = getActiveConfig();
  const profileInstruction = buildAnalysisProfileInstruction(cfg.analysisProfile);
  const systemPrompt = `${resolveOutlineSystemPrompt(cfg.promptOverrides)}\n\n${profileInstruction}`;
  const fingerprint = {
    topic,
    continuationContext: continuationContext || null,
    model: cfg.apiModel,
    provider: cfg.apiProvider,
    analysisProfile: cfg.analysisProfile,
    systemPrompt,
  };

  const raw = await withStageCache<any>(
    'outline',
    fingerprint,
    () => callChatJson<any>([
      { role: 'system', content: systemPrompt },
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
    ], 3500),
    { onHit: () => emitLog({ level: 'detail', stage: 'outline', message: '命中阶段缓存：outline 直接返回上次结果。' }) },
  );

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

export const generateThoughtExperimentSceneImage = async (
  topic: string,
  outline: Pick<AnalysisOutline, 'philosophical_title' | 'modeLabel' | 'thoughtExperiment'>,
  variant: 'scene' | 'pressure' = 'scene',
): Promise<ThoughtExperimentImage | null> => {
  if (!outline.thoughtExperiment) return null;
  const cfg = getActiveConfig();
  const isPressure = variant === 'pressure';
  const prompt = [
    'Create a cinematic philosophical scene image for a Chinese philosophy analysis. No text, no subtitles, no poster typography.',
    isPressure
      ? 'Style: minimalist pale line art, airy off-white background, thin ink lines, quiet museum sketch, restrained symbolic objects, lots of negative space.'
      : 'Style: museum installation, dramatic but restrained lighting, realistic objects, contemplative atmosphere, high-detail editorial composition.',
    `User question: ${topic}`,
    `Big question: ${outline.philosophical_title}`,
    `Analytical mode: ${outline.modeLabel}`,
    `Scene: ${outline.thoughtExperiment.poeticVersion || outline.thoughtExperiment.unsettlingVersion}`,
    `Core challenge: ${outline.thoughtExperiment.coreChallenge}`,
    `Stakes: ${outline.thoughtExperiment.stakes}`,
    isPressure
      ? `Composition: ${cfg.avatarAspectHint}, small companion image for the lower-right core pressure panel, simple line drawing of the philosophical cost and contradiction rather than the main scene, pale background, no readable words, no UI, no logos.`
      : `Composition: ${cfg.avatarAspectHint}, wide scene vignette, one central situation with symbolic objects, no readable words, no UI, no logos.`,
    'Avoid: portrait headshot, book cover, infographic, text, calligraphy, speech bubbles, low-detail generic fantasy art, dark heavy rendering for pressure variant.',
  ].join('\n');

  return withStageCache<ThoughtExperimentImage>(
    'avatar',
    {
      kind: isPressure ? 'thought-experiment-pressure' : 'thought-experiment-scene',
      prompt,
      model: cfg.avatarImageModel,
      size: cfg.avatarImageSize,
      aspect: cfg.avatarAspectHint,
    },
    async () => {
      const imageUrl = await callAvatarImage(prompt);
      return {
        imageUrl,
        prompt,
        model: cfg.avatarImageModel,
        alt: isPressure ? `${outline.philosophical_title} 的核心挑战场景图` : `${outline.philosophical_title} 的思想实验场景图`,
        generatedAt: new Date().toISOString(),
        status: 'completed',
      };
    },
    {
      onHit: () => emitLog({
        level: 'detail',
        stage: 'avatar',
        message: isPressure ? '核心挑战配图命中阶段缓存：复用上次图像。' : '思想实验场景图命中阶段缓存：复用上次图像。',
      }),
    },
  );
};

const generateVoiceEssay = async (
  topic: string,
  outline: AnalysisOutline,
  voicePlan: AnalysisOutline['voicePlans'][number],
  onDelta?: (delta: string, fullText: string) => void,
  onStep?: (message: string) => void,
): Promise<ThoughtVoice> => {
  onStep?.(`voice pipeline started · text stream + avatar image jobs launched in parallel.`);
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

  // We cache the (argument + summary) pair under the 'voice' kind. The avatar
  // is cached separately under 'avatar' (different TTL), and runs in parallel.
  // We use buildStageKey + manual get/put rather than withStageCache so that
  // on a cache hit we can still call onDelta with the full text in one shot —
  // the streaming UI relies on at least one onDelta to render the final body.
  const cfg = getActiveConfig();
  const profileInstruction = buildAnalysisProfileInstruction(cfg.analysisProfile);
  const voiceSystemPrompt = `${resolveVoiceSystemPrompt(cfg.promptOverrides)}\n\n${profileInstruction}`;
  const voiceMaxTokens = cfg.options.voiceMaxTokens;
  const fingerprint = {
    topic,
    modeLabel: outline.modeLabel,
    bigQuestion: outline.philosophical_title,
    introduction: outline.introduction,
    programStructure: outline.programStructure,
    voicePlan,
    model: cfg.apiModel,
    provider: cfg.apiProvider,
    voiceMaxTokens,
    analysisProfile: cfg.analysisProfile,
    voiceSystemPrompt,
  };
  const voiceCacheKey = buildStageKey('voice', fingerprint);
  type VoiceCacheValue = {
    argument: string;
    summary: { summaryForSynthesis: string; quote?: string; challenges?: string[] };
  };
  const cachedEssay = await getStageEntry<VoiceCacheValue>('voice', voiceCacheKey);

  let argument: string;
  let summary: { summaryForSynthesis: string; quote?: string; challenges?: string[] };

  if (cachedEssay) {
    emitLog({
      level: 'detail',
      stage: 'voices',
      voiceId: voicePlan.id,
      voiceName: voicePlan.name,
      message: `${voicePlan.name} 命中阶段缓存：复用上次的正文与摘要。`,
    });
    argument = cachedEssay.argument;
    summary = cachedEssay.summary;
    // Replay the full body in a single chunk so the streaming UI lands on the
    // cached text instead of staying blank.
    onDelta?.(argument, argument);
  } else {
    argument = await callChatText([
      { role: 'system', content: voiceSystemPrompt },
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
    ], voiceMaxTokens, onDelta);

    onStep?.(`POST /chat/completions · summary extraction request sent.`);
    summary = await callChatJson<{ summaryForSynthesis: string; quote?: string; challenges?: string[] }>([
      { role: 'system', content: '你是哲学分析编辑。请把长文压缩成供最终综合判断使用的 JSON。只输出 JSON。' },
      {
        role: 'user',
        content: `用户问题：${topic}
思想声音：${voicePlan.name}
长文：${argument}

输出 JSON：{"summaryForSynthesis":"120-180字摘要，说明诊断/主张/药方和与其他立场的潜在分歧","quote":"一句适合展示的短句，可合成风格化表达","challenges":["它会挑战的其他立场或问题"]}`,
      },
    ], 1000).catch(() => ({ summaryForSynthesis: voicePlan.stance || voicePlan.oneLine || '', quote: '', challenges: [] }));

    // Fire-and-forget the write so it doesn't slow down voice completion.
    void putStageEntry('voice', voiceCacheKey, { argument, summary });
  }

    onStep?.(`waiting on avatar job result for ${voicePlan.name}...`);
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
  const cfg = getActiveConfig();
  // Route detail expansion only depends on the outline's modeLabel, the
  // existing routeMap shape, the topic, and the model. Mode label changes
  // would invalidate; voicePlans don't enter this stage.
  const fingerprint = {
    topic,
    modeLabel: outline.modeLabel,
    routeMap: outline.routeMap,
    model: cfg.apiModel,
    provider: cfg.apiProvider,
  };
  const result = await withStageCache<{ routeMap: RouteNode[] }>(
    'route',
    fingerprint,
    () => callChatJson<{ routeMap: RouteNode[] }>([
      { role: 'system', content: '你是中文哲学分析结构编辑。补全论证路线图，保持短而有推进力。只输出 JSON。' },
      {
        role: 'user',
        content: `用户问题：${topic}
分析路径：${outline.modeLabel}
已有路线：${JSON.stringify(outline.routeMap)}

请补全 routeMap，每个节点 plain 120-220字，philosophical 120-220字，必须有清晰推进。不要生成 nextQuestion 字段，继续追问统一留给 followUps。输出 JSON：{"routeMap":[...]}`,
      },
    ], 2500).catch(() => ({ routeMap: outline.routeMap })),
    { onHit: () => emitLog({ level: 'detail', stage: 'route', message: '命中阶段缓存：路线细节直接返回上次结果。' }) },
  );
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

  const cfg = getActiveConfig();
  const profileInstruction = buildAnalysisProfileInstruction(cfg.analysisProfile);
  const systemPrompt = `${resolveSynthesisSystemPrompt(cfg.promptOverrides)}\n\n${profileInstruction}`;
  // Synthesis only sees voice summaries (not full essays) — fingerprint matches
  // the prompt input exactly so a re-run on the same voices reuses output.
  const voicesSummary = voices.map((v) => ({
    id: v.id,
    name: v.name,
    summaryForSynthesis: v.summaryForSynthesis,
  }));
  const fingerprint = {
    topic,
    modeLabel: outline.modeLabel,
    bigQuestion: outline.philosophical_title,
    voicesSummary,
    model: cfg.apiModel,
    provider: cfg.apiProvider,
    analysisProfile: cfg.analysisProfile,
    systemPrompt,
  };

  const raw = await withStageCache<Partial<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>>>(
    'synthesis',
    fingerprint,
    () => callChatJson<Partial<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>>>([
      { role: 'system', content: systemPrompt },
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
  "keywords": [{
    "id":"keyword-1",
    "term":"关键词",
    "meaning":"30-60字的日常解释，让没读过哲学的人也能立刻理解",
    "importance":"30-80字，说明它在这个问题里为什么重要",
    "definition":"60-120字的学理化定义，可以引出概念背景",
    "misconception":"40-80字，常见误解或望文生义",
    "representativeFigures":[{"name":"代表人物或学派","oneLine":"一句话立场"}],
    "relationToQuestion":"60-120字，这个概念在当前分析里如何转动问题",
    "lifeExample":"40-80字的生活例子，避免抽象重复",
    "challengeQuestion":"一句反问，能让用户重新审视自己的直觉",
    "furtherReading":["《代表书目1》","《代表书目2》"]
  }],
  "followUps": [{"id":"follow-1","question":"承接当前分析的继续追问","reason":"说明它如何接着当前分歧、关键词或结论往下走"}],
  "conclusion": {"summary":"综合判断，400-700字","openQuestion":"仍然悬而未决的问题","realLifeReturn":"回到用户现实处境，200-350字"}
}

followUps 必须是对当前分析的延伸，不要像另一个全新选题。tensions 至少 2 条；如果声音之间没有真实分歧，要诚实指出"这几位在该问题上有共识、分歧出现在更细的环节"。
keywords 至少 3 条；每条都必须填齐七个长字段（definition / misconception / representativeFigures / relationToQuestion / lifeExample / challengeQuestion / furtherReading），不要为了凑数复述其他字段。representativeFigures 至少 1 项；furtherReading 至少 2 项书目或思想方向。`,
      },
    ], 5500).catch(() => fallback),
    { onHit: () => emitLog({ level: 'detail', stage: 'synthesis', message: '命中阶段缓存：综合判断直接返回上次结果。' }) },
  );

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
  // Hard-fail before any state setup if we know we're offline. The browser
  // would otherwise reject the first fetch with a generic TypeError that's
  // hard to surface as "you're offline" in the UI; this gives us a clean,
  // localized error without spending any setup work.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineErr = new Error('当前处于离线状态，暂时无法生成新分析。请等网络恢复后再试。');
    callbacks.onError?.(offlineErr.message);
    throw offlineErr;
  }
  const report = (progress: GenerationProgress) => callbacks.onProgress?.(progress);
  const tokenUsage: TokenUsage[] = [];

  // Run-wide cancel signal. Single source of truth — fired by handle.cancel()
  // and observed by every chat/image call via runStack → currentRunContext.
  const runAborter = new AbortController();
  // Per-voice cancel signals. Skipping a voice aborts only its controller;
  // other workers and the run-wide signal stay alive.
  const inFlightVoices = new Map<string, AbortController>();

  const ctx = pushRunContext({
    stage: 'outline',
    onLog: callbacks.onLog,
    onTokenUsage: (usage) => {
      tokenUsage.push(usage);
      callbacks.onTokenUsage?.(usage);
    },
    abortSignal: runAborter.signal,
  });

  /**
   * Mutable voice queue. Workers pop from the front; inserts push onto the
   * back. Sharing this array between workers and the insert handler is the
   * whole reason inserts can land mid-stage without an extra plumbing layer.
   */
  const voiceQueue: AnalysisOutline['voicePlans'] = [];
  /**
   * Inserts that arrive BEFORE the voices stage opens (i.e. while we're still
   * in outline / route). They get flushed onto voiceQueue the moment the
   * voices stage starts, so the user can click "加入" early without losing
   * the request.
   */
  const pendingInserts: AnalysisOutline['voicePlans'] = [];
  const completedVoices: ThoughtVoice[] = [];
  let voicesStageEntered = false;
  /** Set true once the worker pool has fully drained AND the grace window
   *  for late inserts has elapsed. After this point, insertVoice no-ops. */
  let voicesStageClosed = false;
  /** Number of workers currently inside processOneVoice — used to detect a
   *  fully-idle pool before triggering the close-grace timer. */
  let activeWorkerCount = 0;
  /** Total voices the orchestrator currently expects to ship in the final
   *  result. Starts as outline.voicePlans.length and grows by 1 per insert.
   *  Used for the progress counter so totalVoices stays monotonic. */
  let plannedVoiceTotal = 0;
  /** Wakeup resolvers for idle workers. We track every parked worker (not
   *  just the last one) so a single wake broadcasts to all of them — JS is
   *  single-threaded, so the resulting "thundering herd" is benign: workers
   *  that wake without finding work just loop and re-park or exit. Tracking
   *  only the last resolver was an earlier bug that left N-1 workers stuck
   *  forever and prevented Promise.all from ever resolving. */
  const wakeupResolvers: Array<() => void> = [];
  const waitForWork = (): Promise<void> => {
    if (voiceQueue.length > 0 || voicesStageClosed || runAborter.signal.aborted) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      wakeupResolvers.push(resolve);
    });
  };
  const wakeWorkers = () => {
    if (wakeupResolvers.length === 0) return;
    const resolvers = wakeupResolvers.splice(0);
    for (const r of resolvers) r();
  };

  const buildInsertedPlan = (seed: VoiceInsertSeed): AnalysisOutline['voicePlans'][number] => ({
    id: makeId('voice'),
    name: trimmedVoiceName(seed.prompt),
    kind: 'philosopher',
    school: '',
    role: '后来加入的思想声音',
    coreConcept: '延展视角',
    oneLine: `沿着"${seed.prompt}"加入当前分析`,
    stance: `回应用户希望补充的视角：${seed.prompt}`,
    diagnosis: '',
    prescription: '',
    thesis: '',
    critique: '',
  });

  const emitInsertedPlaceholder = (plan: AnalysisOutline['voicePlans'][number], userPrompt: string) => {
    const placeholder: ThoughtVoice = {
      ...plan,
      argument: '',
      summaryForSynthesis: '',
      status: 'queued',
      addedByUserPrompt: userPrompt,
      addedAt: new Date().toISOString(),
    };
    callbacks.onVoicePlanned?.(placeholder);
  };

  const handle: RunControlHandle = {
    cancel: (reason) => {
      if (runAborter.signal.aborted) return;
      const err = new DOMException(reason || '用户已取消生成', 'AbortError');
      runAborter.abort(err);
      // Also abort every per-voice controller so streaming readers exit promptly.
      inFlightVoices.forEach((c) => c.abort(err));
      // Wake any worker parked on waitForWork so they observe the abort and exit.
      voicesStageClosed = true;
      wakeWorkers();
      emitLog({ level: 'warn', stage: ctx.stage, message: '收到取消信号，正在中止当前生成...' });
    },
    skipVoice: (voiceId) => {
      // In flight → abort the per-voice controller; processOneVoice's catch
      // will mark it 'skipped'.
      const ctrl = inFlightVoices.get(voiceId);
      if (ctrl && !ctrl.signal.aborted) {
        ctrl.abort(new DOMException('skipped by user', 'AbortError'));
        return;
      }
      // Still queued → splice and emit a synthetic 'skipped' completion so
      // the UI can update the placeholder card immediately.
      const queueIdx = voiceQueue.findIndex((p) => p.id === voiceId);
      if (queueIdx >= 0) {
        const [removed] = voiceQueue.splice(queueIdx, 1);
        const skipped: ThoughtVoice = {
          ...removed,
          argument: '',
          summaryForSynthesis: '',
          status: 'skipped',
        };
        callbacks.onVoiceComplete?.(skipped);
        completedVoices.push(skipped);
        emitLog({ level: 'warn', stage: 'voices', voiceId, voiceName: removed.name, message: `${removed.name} 已被用户跳过（未启动）。` });
        return;
      }
      // Not yet flushed (still buffered while we're in outline / route) →
      // remove from pendingInserts. No onVoiceComplete here because no
      // placeholder card was ever shown (insertedPlaceholder fires on insert).
      const pendingIdx = pendingInserts.findIndex((p) => p.id === voiceId);
      if (pendingIdx >= 0) {
        const [removed] = pendingInserts.splice(pendingIdx, 1);
        const skipped: ThoughtVoice = {
          ...removed,
          argument: '',
          summaryForSynthesis: '',
          status: 'skipped',
        };
        callbacks.onVoiceComplete?.(skipped);
        completedVoices.push(skipped);
        emitLog({ level: 'warn', stage: ctx.stage, voiceId, voiceName: removed.name, message: `${removed.name} 已被用户跳过（尚未进入声音阶段）。` });
      }
    },
    insertVoice: (seed: VoiceInsertSeed) => {
      if (runAborter.signal.aborted) return '';
      const stubPlan = buildInsertedPlan(seed);

      if (!voicesStageEntered) {
        // Voices stage hasn't opened yet — buffer the insert and surface a
        // queued placeholder card. It'll be flushed onto voiceQueue the
        // moment we transition to the voices stage.
        pendingInserts.push(stubPlan);
        emitInsertedPlaceholder(stubPlan, seed.prompt);
        emitLog({ level: 'info', stage: ctx.stage, voiceId: stubPlan.id, voiceName: stubPlan.name, message: `已记录用户请求的新声音：${stubPlan.name}（"${seed.prompt}"），将在声音阶段开始时加入队列。` });
        return stubPlan.id;
      }

      if (voicesStageClosed) {
        // Workers have drained and the close-grace window has expired; we're
        // either inside synthesis or about to start it. The append-after-result
        // path (appendThoughtVoice) handles this case from the Arena page —
        // here we just no-op so the insert never silently disappears mid-state.
        emitLog({ level: 'warn', stage: ctx.stage, message: `声音阶段已关闭，无法在此时加入新声音（"${seed.prompt}"）。请在分析完成后通过"追加思想声音"加入。` });
        return '';
      }

      voiceQueue.push(stubPlan);
      plannedVoiceTotal += 1;
      emitInsertedPlaceholder(stubPlan, seed.prompt);
      emitLog({ level: 'info', stage: 'voices', voiceId: stubPlan.id, voiceName: stubPlan.name, message: `已加入用户请求的新声音：${stubPlan.name}（"${seed.prompt}"）。` });
      // Refresh the progress counter so totalVoices reflects the bump.
      report({
        stage: 'voices',
        totalVoices: plannedVoiceTotal,
        completedVoices: completedVoices.length,
        messages: [`已插入新声音：${stubPlan.name}`],
      });
      // Wake any idle worker so the insert gets picked up immediately.
      wakeWorkers();
      return stubPlan.id;
    },
  };
  callbacks.onControl?.(handle);

  try {
    emitLog({ level: 'info', stage: 'outline', message: continuationContext ? 'POST /chat/completions · continuation outline request sent, waiting for JSON payload...' : 'POST /chat/completions · outline request sent, waiting for JSON payload...' });
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
    const sceneImagePromise = outline.thoughtExperiment
      ? withStage('avatar', () => Promise.all([
        generateThoughtExperimentSceneImage(userTopic, outline, 'scene'),
        generateThoughtExperimentSceneImage(userTopic, outline, 'pressure'),
      ]))
        .then(([sceneImage, pressureImage]) => {
          const images = { sceneImage: sceneImage || undefined, pressureImage: pressureImage || undefined };
          if (sceneImage || pressureImage) callbacks.onThoughtExperimentImage?.(images);
          if (sceneImage) emitLog({ level: 'info', stage: 'avatar', message: '思想实验场景图已生成，将随结果展示。' });
          if (pressureImage) emitLog({ level: 'info', stage: 'avatar', message: '核心挑战配图已生成，将填充右侧留白。' });
          return images;
        })
        .catch((error) => {
          console.warn('[sophia] 思想实验配图生成失败', error);
          emitLog({ level: 'warn', stage: 'avatar', message: '思想实验配图生成失败，文本分析不受影响。' });
          return null;
        })
      : Promise.resolve(null);
    ctx.stage = 'route';
    report({
      stage: 'route',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: 0,
      messages: [`已形成分析路径：${outline.modeLabel}`, '正在补全论证路线图...'],
    });
    emitLog({ level: 'info', stage: 'route', message: `POST /chat/completions · route expansion request sent for ${outline.routeMap.length} base nodes...` });

    const stopRouteHeartbeat = startHeartbeat('route', '正在等待论证路线图返回');
    let routeMap;
    try {
      routeMap = await generateRouteDetails(userTopic, outline);
    } finally {
      stopRouteHeartbeat();
    }
    result = { ...result, routeMap };
    callbacks.onRouteMap?.(routeMap);
    emitLog({ level: 'info', stage: 'route', message: `routeMap normalized · ${routeMap.length} nodes ready for UI and synthesis context.` });

    // Voices stage. Seed the queue with outline.voicePlans, then launch a
    // bounded worker pool. Workers wait on a wakeup promise when the queue
    // is empty (instead of exiting), so inserts that arrive after the
    // initial drain still get picked up. The pool only fully exits once
    // voicesStageClosed is set — which happens after a 150ms grace window
    // of zero queue + zero active workers.
    voiceQueue.push(...outline.voicePlans);
    if (pendingInserts.length > 0) {
      // Flush inserts that arrived while we were still in outline / route.
      voiceQueue.push(...pendingInserts);
      emitLog({ level: 'info', stage: 'voices', message: `已将 ${pendingInserts.length} 个早到的插入声音并入队列。` });
      pendingInserts.length = 0;
    }
    plannedVoiceTotal = voiceQueue.length;
    voicesStageEntered = true;
    ctx.stage = 'voices';
    report({
      stage: 'voices',
      modeLabel: outline.modeLabel,
      totalVoices: plannedVoiceTotal,
      completedVoices: 0,
      messages: [`正在生成 ${plannedVoiceTotal} 个长篇思想声音...`],
    });
    emitLog({ level: 'info', stage: 'voices', message: `voice worker pool started · queued=${plannedVoiceTotal}, concurrency=${getActiveConfig().options.voiceConcurrency}, avatarConcurrency=${getActiveConfig().options.avatarConcurrency}.` });

    const processOneVoice = async (voicePlan: AnalysisOutline['voicePlans'][number]) => {
      const voiceCtrl = new AbortController();
      inFlightVoices.set(voicePlan.id, voiceCtrl);
      callbacks.onVoiceStart?.(voicePlan.id, voicePlan.name);
      emitLog({ level: 'info', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `worker picked voice · id=${voicePlan.id}, queueRemaining=${voiceQueue.length}.` });
      report({
        stage: 'voices',
        modeLabel: outline.modeLabel,
        totalVoices: plannedVoiceTotal,
        completedVoices: completedVoices.length,
        currentVoiceName: voicePlan.name,
        messages: [`正在生成：${voicePlan.name}`],
      });

      // Push a voice-scoped context so chat/image calls see the per-voice
      // signal. The orchestrator's run-wide signal still applies via the
      // parent context — effectiveSignal merges both.
      const voiceCtx = pushRunContext({
        stage: 'voices',
        voiceId: voicePlan.id,
        voiceName: voicePlan.name,
        onLog: ctx.onLog,
        onTokenUsage: ctx.onTokenUsage,
        abortSignal: runAborter.signal,
        voiceAbortSignal: voiceCtrl.signal,
      });

      try {
        const reportVoiceStep = (message: string) => {
          callbacks.onVoiceStep?.(voicePlan.id, voicePlan.name, message);
          emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message });
          report({
            stage: 'voices',
            modeLabel: outline.modeLabel,
            totalVoices: plannedVoiceTotal,
            completedVoices: completedVoices.length,
            currentVoiceName: voicePlan.name,
            messages: [message],
          });
        };
        let lastStreamLogTs = 0;
        const voice = await generateVoiceEssay(userTopic, outline, voicePlan, (delta, fullText) => {
          callbacks.onVoiceDelta?.(voicePlan.id, delta, fullText);
          const now = Date.now();
          if (now - lastStreamLogTs >= 3000) {
            lastStreamLogTs = now;
            emitLog({ level: 'detail', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `stream chunk received · chars=${fullText.length}, delta=${delta.length}.` });
          }
          report({
            stage: 'voices',
            modeLabel: outline.modeLabel,
            totalVoices: plannedVoiceTotal,
            completedVoices: completedVoices.length,
            currentVoiceName: voicePlan.name,
            streamedChars: fullText.length,
            messages: [`${voicePlan.name} 正在生成长篇论述...`],
          });
        }, reportVoiceStep);
        completedVoices.push(voice);
        callbacks.onVoiceComplete?.(voice);
        emitLog({
          level: 'info',
          stage: 'voices',
          voiceId: voicePlan.id,
          voiceName: voicePlan.name,
          message: `voice complete · chars=${voice.argument.length}, avatar=${voice.avatar ? 'ready' : 'fallback'}, completed=${completedVoices.length}/${plannedVoiceTotal}.`,
        });
        report({
          stage: 'voices',
          modeLabel: outline.modeLabel,
          totalVoices: plannedVoiceTotal,
          completedVoices: completedVoices.length,
          currentVoiceName: voicePlan.name,
          messages: [`${voicePlan.name} 已完成。`],
        });
      } catch (error) {
        // Disambiguate cancel vs skip vs failure.
        const message = error instanceof Error ? error.message : '生成失败';
        if (runAborter.signal.aborted) {
          // The orchestrator's outer catch will surface the cancellation. Don't
          // emit a voice 'failed' — the voice just never finished.
          throw error;
        }
        if (voiceCtrl.signal.aborted) {
          const skipped: ThoughtVoice = {
            ...voicePlan,
            argument: '',
            summaryForSynthesis: '',
            status: 'skipped',
          };
          callbacks.onVoiceComplete?.(skipped);
          completedVoices.push(skipped);
          emitLog({ level: 'warn', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 已被用户跳过。` });
          return;
        }
        const failed: ThoughtVoice = {
          ...voicePlan,
          argument: '',
          summaryForSynthesis: '',
          status: 'failed',
          error: message,
        };
        callbacks.onVoiceComplete?.(failed);
        completedVoices.push(failed);
        emitLog({ level: 'error', stage: 'voices', voiceId: voicePlan.id, voiceName: voicePlan.name, message: `${voicePlan.name} 失败：${message}` });
      } finally {
        inFlightVoices.delete(voicePlan.id);
        popRunContext(voiceCtx);
      }
    };

    /**
     * Worker that loops on the shared queue and parks on waitForWork() when
     * empty. The pool only exits when voicesStageClosed flips to true — which
     * happens after a 150ms grace window of "queue empty + every worker
     * idle". The grace window is what lets a UI-driven insert that fires at
     * the exact boundary still get picked up rather than being lost between
     * Promise.all() resolving and synthesis starting.
     */
    const VOICE_DRAIN_GRACE_MS = 150;
    const tryClosePoolAfterGrace = async () => {
      // Only one drain timer at a time. If another worker already triggered
      // a close, just bail.
      if (voicesStageClosed) return;
      if (voiceQueue.length > 0 || activeWorkerCount > 0) return;
      await new Promise<void>((resolve) => setTimeout(resolve, VOICE_DRAIN_GRACE_MS));
      // Re-check after the grace window — an insert that landed during the
      // wait will have repopulated the queue or bumped activeWorkerCount.
      if (voicesStageClosed) return;
      if (voiceQueue.length > 0 || activeWorkerCount > 0) return;
      voicesStageClosed = true;
      wakeWorkers();
    };

    const worker = async () => {
      while (!runAborter.signal.aborted) {
        const next = voiceQueue.shift();
        if (next) {
          activeWorkerCount += 1;
          try {
            await processOneVoice(next);
          } finally {
            activeWorkerCount -= 1;
            // Fire and forget — the grace timer self-cancels if more work
            // arrives. We don't await it because we want the worker to loop
            // back to the queue check immediately for any work that just
            // got pushed (e.g. by a synchronous insertVoice during this tick).
            void tryClosePoolAfterGrace();
          }
          continue;
        }
        if (voicesStageClosed) return;
        await waitForWork();
      }
    };

    const concurrency = Math.max(1, getActiveConfig().options.voiceConcurrency);
    const workerCount = Math.max(1, Math.min(concurrency, voiceQueue.length || 1));
    await Promise.all(Array.from({ length: workerCount }, worker));

    // Run-wide cancel during voices: bail out before synthesis.
    if (runAborter.signal.aborted) {
      throw runAborter.signal.reason ?? new DOMException('cancelled', 'AbortError');
    }

    ctx.stage = 'synthesis';
    report({
      stage: 'synthesis',
      modeLabel: outline.modeLabel,
      totalVoices: plannedVoiceTotal,
      completedVoices: completedVoices.length,
      messages: ['正在生成分歧、关键词和综合判断...'],
    });
    emitLog({ level: 'info', stage: 'synthesis', message: `POST /chat/completions · synthesis request sent with ${completedVoices.length} voice summaries...` });
    const stopSynthesisHeartbeat = startHeartbeat('synthesis', '正在等待综合判断返回');
    let synthesis;
    try {
      synthesis = await generateSynthesis(userTopic, outline, completedVoices);
    } finally {
      stopSynthesisHeartbeat();
    }
    callbacks.onSynthesis?.(synthesis);
    emitLog({ level: 'info', stage: 'synthesis', message: `synthesis JSON normalized · tensions=${synthesis.tensions.length}, keywords=${synthesis.keywords.length}, followUps=${synthesis.followUps.length}.` });

    const totalTokens = tokenUsage.reduce((sum, entry) => sum + entry.totalTokens, 0);
    const thoughtExperimentImages = await sceneImagePromise;
    // Merge: any voice in completedVoices that isn't in result.voices' placeholders
    // (e.g., user-inserted) gets appended at the end.
    const placeholderIds = new Set(result.voices.map((v) => v.id));
    const insertedVoices = completedVoices.filter((v) => !placeholderIds.has(v.id));
    result = {
      ...result,
      voices: [
        ...result.voices.map((placeholder) => completedVoices.find((voice) => voice.id === placeholder.id) || placeholder),
        ...insertedVoices,
      ],
      tensions: normalizeTensions(synthesis.tensions),
      keywords: normalizeKeywords(synthesis.keywords),
      followUps: normalizeFollowUps(synthesis.followUps),
      conclusion: normalizeConclusion(synthesis.conclusion),
      thoughtExperiment: result.thoughtExperiment && thoughtExperimentImages
        ? { ...result.thoughtExperiment, ...thoughtExperimentImages }
        : result.thoughtExperiment,
      metadata: { tokenUsage, totalTokens },
    };

    ctx.stage = 'done';
    report({
      stage: 'done',
      modeLabel: outline.modeLabel,
      totalVoices: plannedVoiceTotal,
      completedVoices: completedVoices.length,
      messages: ['这份哲学分析已生成完成。'],
    });
    emitLog({ level: 'info', stage: 'done', message: `整份分析已生成完成（累计 ${totalTokens} tokens）。` });

    return result;
  } catch (error) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    if (isAbort) {
      const message = '生成已取消。';
      callbacks.onError?.(message);
      report({ stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] });
      emitLog({ level: 'warn', stage: 'error', message });
      throw error;
    }
    const message = error instanceof Error ? error.message : '发生了未知错误';
    callbacks.onError?.(message);
    report({ stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] });
    emitLog({ level: 'error', stage: 'error', message: `生成中断：${message}` });
    throw error;
  } finally {
    popRunContext(ctx);
  }
};

/**
 * Re-enter the analysis pipeline using a previously persisted RunSnapshot.
 *
 * The current implementation is intentionally tactical: it short-circuits the
 * fully-finished case (lastCompletedStage === 'synthesis' just returns the
 * partial result) and otherwise replays analyzeTopic from the top with the
 * snapshot's topic + continuationContext. The optimization that lets us
 * skip already-completed stages comes from the stage cache (Phase 4): once
 * generateOutline / generateRouteDetails / generateVoiceEssay are
 * fingerprint-cached, calling analyzeTopic again on a refresh will hit the
 * cache for every stage that already finished and only redo what was
 * unfinished — which is functionally what "resume from last completed
 * stage" promises, without forcing analyzeTopic into a more invasive
 * refactor.
 *
 * Returns the resulting AnalysisResult so the caller can persist it.
 */
export const resumeAnalysis = async (
  snap: RunSnapshot,
  callbacks: AnalyzeCallbacks = {},
): Promise<AnalysisResult> => {
  if (snap.lastCompletedStage === 'synthesis' && snap.partialResult) {
    const completed = snap.partialResult.voices.filter((voice) => voice.status === 'completed').length;
    callbacks.onProgress?.({
      stage: 'done',
      modeLabel: snap.partialResult.modeLabel,
      totalVoices: snap.partialResult.voices.length,
      completedVoices: completed,
      messages: ['这份分析在上次离开前已经完成。'],
    });
    callbacks.onLog?.({
      id: `resume-done-${Date.now()}`,
      ts: new Date().toISOString(),
      level: 'info',
      stage: 'done',
      message: '检测到这份分析已经完成，直接恢复结果。',
    });
    return snap.partialResult;
  }

  // Surface whatever the snapshot already had so the user sees the partial
  // shape immediately while the pipeline restarts in the background.
  if (snap.partialResult) {
    callbacks.onLog?.({
      id: `resume-restart-${Date.now()}`,
      ts: new Date().toISOString(),
      level: 'info',
      stage: 'meta',
      message: `正在从上次保存的进度（${snap.lastCompletedStage || '初始'} 阶段）继续。已缓存的阶段会直接命中，不会重跑。`,
    });
  }

  return analyzeTopic(snap.topic, callbacks, snap.continuationContext);
};

export const generateQuestionSuggestions = async (seedTopic = ''): Promise<string[]> => {
  const trimmedSeedTopic = seedTopic.trim();
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
${trimmedSeedTopic ? `用户当前输入或兴趣：${trimmedSeedTopic}` : '用户没有输入具体兴趣。此时只能生成哲学传统中的有趣“大问题”：存在与死亡、自由意志、意识与自我、知识与怀疑、善与正义、意义与虚无、真实与表象等。不要生成日常焦虑、社会热点、应用伦理、身份议题或自我改善式问题。'}

要求：
- 每个问题 8-22 个中文字符左右，必须以问号结尾。
- 空输入时，每个问题都必须是可被哲学史长期讨论的根本问题。
- 问题要具体、有张力、普通人也愿意点击。
- 
- 不要重复首页已有问题；如果用户给了当前兴趣，围绕它生成更尖锐的变体。
- 不要输出解释。
- 每个问题都要涉及不同方面。

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

/**
 * Fill in any missing long-form fields on a single KeywordExplainer using a
 * scoped LLM call. Synthesis already asks for the full schema, but older
 * stored entries (or runs where synthesis got truncated) can still arrive
 * with only term/meaning/importance — the concept detail page calls this
 * lazily on first open and the result is then written back into history.
 *
 * Returns a brand new keyword object. The caller is responsible for
 * persisting it back into the appropriate AnalysisResult.
 */
export const enrichKeyword = async (
  result: AnalysisResult,
  keywordId: string,
): Promise<KeywordExplainer> => {
  const target = result.keywords.find((k) => k.id === keywordId);
  if (!target) throw new Error(`关键词 ${keywordId} 不存在`);
  if (target.enriched) return target;

  const ctx = pushRunContext({
    stage: 'keyword_enrich',
    onTokenUsage: (usage) => recordUsageStandalone(usage),
  });
  try {
    const otherKeywords = result.keywords
      .filter((k) => k.id !== keywordId)
      .map((k) => `${k.term}: ${k.meaning}`)
      .join('\n');
    const tensionsSummary = result.tensions
      .map((tension) => `${tension.title}: ${tension.content}`)
      .join('\n') || '无';

    const raw = await callChatJson<Partial<KeywordExplainer>>([
      {
        role: 'system',
        content: '你是 Sophia 的概念档案编辑。把单个关键词扩写成完整的概念卡。所有用户可见内容必须是简体中文。仅输出有效 JSON，不要 markdown，不要 JSON 前后任何文字。',
      },
      {
        role: 'user',
        content: `当前分析标题：${result.philosophical_title}
原始问题：${result.topic}
核心问题：${result.questionFrame.bigQuestion}
分析路径：${result.modeLabel}
本分析中的其他关键词：
${otherKeywords || '无'}
本分析的核心分歧：
${tensionsSummary}
本分析的综合判断：${result.conclusion.summary || '无'}

需要扩写的概念：
- 词目：${target.term}
- 当前简短解释：${target.meaning || '（暂无）'}
- 当前重要性说明：${target.importance || '（暂无）'}

请补全这个概念的完整档案。要求：
1. relationToQuestion 必须紧扣"在 ${result.philosophical_title} 这场分析里"，不要泛谈。
2. representativeFigures 至少 1 项，最多 4 项；优先列出与本分析声音相关的人物/学派。
3. lifeExample 不要重复 meaning 已有的例子。
4. challengeQuestion 是一个反问句，能让用户怀疑自己原本对该概念的直觉。
5. furtherReading 至少 2 项；可以是书目、论文标题、思想流派或重要论争。
6. 全部字段必须填，不能空字符串。

输出 JSON：
{
  "term": "${target.term}",
  "meaning": "30-60字日常解释",
  "importance": "30-80字重要性",
  "definition": "60-120字学理化定义",
  "misconception": "40-80字常见误解",
  "representativeFigures": [{"name":"人物或学派","oneLine":"一句话立场"}],
  "relationToQuestion": "60-120字与本分析的关系",
  "lifeExample": "40-80字生活例子",
  "challengeQuestion": "一句反问",
  "furtherReading": ["《代表书目1》", "《代表书目2》"]
}`,
      },
    ], 1600);

    const next = normalizeKeyword({ ...target, ...raw, id: target.id }, 0);
    return { ...next, enriched: isKeywordEnriched(next) };
  } finally {
    popRunContext(ctx);
  }
};

/**
 * Re-run the avatar image call for a single voice without touching its essay.
 * Bypasses the stage cache (so the user always gets a different image) and
 * keeps the run context active so token usage is still recorded.
 */
export const regenerateVoiceAvatar = async (
  result: AnalysisResult,
  voiceId: string,
): Promise<ThoughtVoiceImageAvatar> => {
  const voice = result.voices.find((v) => v.id === voiceId);
  if (!voice) throw new Error(`找不到要重生头像的思想声音：${voiceId}`);

  const ctx = pushRunContext({
    stage: 'avatar',
    voiceId: voice.id,
    voiceName: voice.name,
    onTokenUsage: (usage) => recordUsageStandalone(usage),
  });
  try {
    const cfg = getActiveConfig();
    // Append a small "regen" nonce to the prompt so the upstream image cache
    // (and our own withStageCache, were it to be reintroduced) can't serve
    // the previous render — users explicitly want a different image.
    const nonce = Math.floor(Math.random() * 1e9).toString(36);
    const basePrompt = buildThoughtVoiceAvatarPrompt(
      result.topic,
      { philosophical_title: result.philosophical_title, modeLabel: result.modeLabel },
      {
        name: voice.name,
        kind: voice.kind,
        school: voice.school,
        role: voice.role,
        coreConcept: voice.coreConcept,
        oneLine: voice.oneLine,
        stance: voice.stance,
      },
    );
    const prompt = `${basePrompt}\nRegen variant token (do NOT render): ${nonce}`;
    const imageUrl = await callAvatarImage(prompt);
    return {
      imageUrl,
      prompt,
      style: voice.kind === 'philosopher'
        ? resolveHistoricalPhilosopherAvatarStyle(cfg.promptOverrides)
        : resolveThoughtVoiceAvatarStyle(cfg.promptOverrides),
      model: cfg.avatarImageModel,
      alt: `${voice.name} 的竖版思想声音头像`,
      generatedAt: new Date().toISOString(),
      subjectType: voice.kind,
    };
  } finally {
    popRunContext(ctx);
  }
};

/**
 * Stream a chat response from the LLM in the persona of one of the analysis's
 * thought voices. Caller maintains the message history; we add the persona
 * system prompt and tail-trim history to keep the upstream prompt bounded.
 */
export const chatWithVoice = async (
  result: AnalysisResult,
  voiceId: string,
  history: Message[],
  userMessage: string,
  onDelta?: (delta: string, fullText: string) => void,
  signal?: AbortSignal,
): Promise<string> => {
  const voice = result.voices.find((v) => v.id === voiceId);
  if (!voice) throw new Error('找不到这位思想声音。');

  const ctx = pushRunContext({
    stage: 'reflection',
    voiceId: voice.id,
    voiceName: voice.name,
    onTokenUsage: (usage) => recordUsageStandalone(usage),
    abortSignal: signal,
  });
  try {
    const trimmedHistory = history.slice(-20).map<ChatMessage>((m) => ({
      role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
    const messages: ChatMessage[] = [
      { role: 'system', content: buildVoicePersona(voice, result) },
      ...trimmedHistory,
      { role: 'user', content: userMessage },
    ];
    const reply = await callChatText(messages, 1200, onDelta);
    return stripReplyMarkdown(reply);
  } finally {
    popRunContext(ctx);
  }
};
