/**
 * Local-only token usage accounting.
 *
 * Each call to the chat / image endpoints emits a `TokenUsage` entry; this module persists
 * them under `sophia.tokens.v1` and exposes aggregates for the Settings page panel.
 *
 * Storage budget: keep the most recent `MAX_RECORDS` rows (default 1000). Anything older is
 * dropped on write to bound localStorage growth.
 */

import type { TokenUsage, TokenUsageStage } from '../types/pipeline';

const STORAGE_KEY = 'sophia.tokens.v1';
const MAX_RECORDS = 1000;
const FLUSH_INTERVAL_MS = 2000;

interface PersistedShape {
  schemaVersion: 1;
  records: TokenUsage[];
}

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

type TokenUsageInput = Partial<TokenUsage> | null | undefined;

const safeString = (value: unknown): string => typeof value === 'string' ? value : '';
const safeNumber = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;

const normalizeRecord = (entry: TokenUsageInput): TokenUsage | null => {
  if (!entry || typeof entry !== 'object') return null;
  const promptTokens = safeNumber(entry.promptTokens);
  const completionTokens = safeNumber(entry.completionTokens);
  const totalTokens = safeNumber(entry.totalTokens) || promptTokens + completionTokens;
  if (totalTokens <= 0) return null;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model: safeString(entry.model) || '(unknown)',
    stage: (safeString(entry.stage) || 'meta') as TokenUsageStage,
    ts: safeString(entry.ts) || new Date(0).toISOString(),
    voiceId: safeString(entry.voiceId) || undefined,
  };
};

const normalizeRecords = (records: unknown): TokenUsage[] => Array.isArray(records)
  ? records.map((entry) => normalizeRecord(entry as TokenUsageInput)).filter((entry): entry is TokenUsage => !!entry)
  : [];

let cache: TokenUsage[] = loadFromStorage();
let pending: TokenUsage[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadFromStorage(): TokenUsage[] {
  if (!isBrowser) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<PersistedShape> | TokenUsage[];
    if (Array.isArray(parsed)) return normalizeRecords(parsed);
    if (parsed && Array.isArray(parsed.records)) return normalizeRecords(parsed.records);
    return [];
  } catch {
    return [];
  }
}

function persistNow() {
  if (pending.length === 0) return;
  cache = cache.concat(pending);
  pending = [];
  if (cache.length > MAX_RECORDS) {
    cache = cache.slice(cache.length - MAX_RECORDS);
  }
  if (!isBrowser) return;
  try {
    const payload: PersistedShape = { schemaVersion: 1, records: cache };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[sophia][tokenAccounting] failed to persist usage:', error);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    persistNow();
  }, FLUSH_INTERVAL_MS);
}

export const recordUsage = (entry: TokenUsage): void => {
  const normalized = normalizeRecord(entry);
  if (!normalized) return;
  pending.push(normalized);
  scheduleFlush();
};

export const recordUsageBatch = (entries: TokenUsage[]): void => {
  if (!entries || entries.length === 0) return;
  pending.push(...entries.map((entry) => normalizeRecord(entry)).filter((entry): entry is TokenUsage => !!entry));
  if (pending.length > 0) scheduleFlush();
};

export const flushNow = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  persistNow();
};

export interface UsageBucket {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  count: number;
}

export interface UsageTotals {
  today: UsageBucket;
  week: UsageBucket;
  month: UsageBucket;
  allTime: UsageBucket;
  byStage: Record<string, UsageBucket>;
  byModel: Record<string, UsageBucket>;
  records: TokenUsage[];
}

const emptyBucket = (): UsageBucket => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0, count: 0 });

const accumulate = (bucket: UsageBucket, entry: TokenUsage) => {
  bucket.promptTokens += entry.promptTokens || 0;
  bucket.completionTokens += entry.completionTokens || 0;
  bucket.totalTokens += entry.totalTokens || 0;
  bucket.count += 1;
};

export const getTotals = (): UsageTotals => {
  flushNow();
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const weekMs = now - 7 * 24 * 60 * 60 * 1000;
  const monthMs = now - 30 * 24 * 60 * 60 * 1000;

  const totals: UsageTotals = {
    today: emptyBucket(),
    week: emptyBucket(),
    month: emptyBucket(),
    allTime: emptyBucket(),
    byStage: {},
    byModel: {},
    records: cache.slice(),
  };

  for (const entry of cache) {
    const ts = Date.parse(entry.ts);
    accumulate(totals.allTime, entry);

    const stageKey = String(entry.stage);
    totals.byStage[stageKey] ??= emptyBucket();
    accumulate(totals.byStage[stageKey], entry);

    const modelKey = entry.model || '(unknown)';
    totals.byModel[modelKey] ??= emptyBucket();
    accumulate(totals.byModel[modelKey], entry);

    if (Number.isFinite(ts)) {
      if (ts >= todayMs) accumulate(totals.today, entry);
      if (ts >= weekMs) accumulate(totals.week, entry);
      if (ts >= monthMs) accumulate(totals.month, entry);
    }
  }
  return totals;
};

export const clearAll = (): void => {
  cache = [];
  pending = [];
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (!isBrowser) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const csvValue = (value: unknown): string => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const exportCsv = (): string => {
  flushNow();
  const header = 'ts,stage,model,promptTokens,completionTokens,totalTokens,voiceId';
  const rows = cache.map((entry) => [
    entry.ts,
    entry.stage,
    entry.model,
    entry.promptTokens,
    entry.completionTokens,
    entry.totalTokens,
    entry.voiceId || '',
  ].map(csvValue).join(','));
  return [header, ...rows].join('\n');
};

/** Helper: build a TokenUsage record. Returns null when usage is missing/zero. */
export const buildUsage = (
  raw: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
  stage: TokenUsageStage,
  model: string,
  voiceId?: string,
): TokenUsage | null => {
  if (!raw) return null;
  const promptTokens = raw.prompt_tokens || 0;
  const completionTokens = raw.completion_tokens || 0;
  const totalTokens = raw.total_tokens || (promptTokens + completionTokens);
  if (totalTokens <= 0) return null;
  return {
    promptTokens,
    completionTokens,
    totalTokens,
    model,
    stage,
    ts: new Date().toISOString(),
    voiceId,
  };
};

if (isBrowser) {
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushNow();
  });
}
