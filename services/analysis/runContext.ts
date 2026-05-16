import type { GenerationLogEntry, TokenUsage, TokenUsageStage } from '../../types/pipeline';
import { buildUsage } from '../tokenAccounting';
import { getActiveConfig } from '../sophiaConfig';

export interface RunContext {
  onLog?: (entry: GenerationLogEntry) => void;
  onTokenUsage?: (usage: TokenUsage) => void;
  stage: TokenUsageStage;
  voiceId?: string;
  voiceName?: string;
  /**
   * Run-wide cancel signal. Threaded into chat/image callers so every
   * in-flight network call aborts when the whole run is cancelled.
   */
  abortSignal?: AbortSignal;
  /**
   * Per-voice cancel signal pushed while a voice is generated. Skipping one
   * voice aborts only this signal and leaves the run-wide signal alive.
   */
  voiceAbortSignal?: AbortSignal;
}

const runStack: RunContext[] = [];

const shortRandomId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return uuid.replace(/-/g, '').slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
};

export const makeId = (prefix: string) => `${prefix}-${Date.now()}-${shortRandomId()}`;

export const currentRunContext = (): RunContext | null => runStack[runStack.length - 1] || null;

/**
 * Compose the run-wide signal with the per-voice signal so a single fetch can
 * react to either. AbortSignal.any is not available in the current TS target.
 */
export const effectiveSignal = (ctx: RunContext | null): AbortSignal | undefined => {
  if (!ctx) return undefined;
  const { abortSignal: run, voiceAbortSignal: voice } = ctx;
  if (!run && !voice) return undefined;
  if (run && !voice) return run;
  if (voice && !run) return voice;

  const merged = new AbortController();
  const onAbort = (origin?: AbortSignal) => merged.abort(origin?.reason);
  if (run!.aborted) merged.abort(run!.reason);
  else run!.addEventListener('abort', () => onAbort(run!), { once: true });
  if (voice!.aborted) merged.abort(voice!.reason);
  else voice!.addEventListener('abort', () => onAbort(voice!), { once: true });
  return merged.signal;
};

export const pushRunContext = (ctx: RunContext) => {
  runStack.push(ctx);
  return ctx;
};

export const popRunContext = (ctx: RunContext) => {
  const idx = runStack.lastIndexOf(ctx);
  if (idx >= 0) runStack.splice(idx, 1);
};

export const withStage = <T>(
  stage: TokenUsageStage,
  fn: () => Promise<T>,
  extra?: Pick<RunContext, 'voiceId' | 'voiceName'>,
): Promise<T> => {
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

export const emitLog = (entry: Omit<GenerationLogEntry, 'id' | 'ts'> & { id?: string; ts?: string }) => {
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

export const startHeartbeat = (stage: GenerationLogEntry['stage'], label: string, intervalMs = 18000) => {
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

export const recordUsageFromResponse = (
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
