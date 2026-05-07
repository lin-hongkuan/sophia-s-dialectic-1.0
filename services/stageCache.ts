/**
 * Per-stage IndexedDB cache for the analyze pipeline.
 *
 * Why this exists:
 * - Outline / route / voice essay / avatar / synthesis are all expensive LLM
 *   calls. When a user retries after a partial failure, regenerates a single
 *   voice, or resumes a snapshot from a previous session, we end up calling
 *   the same prompt with the same inputs we already paid for once.
 * - This cache fingerprints each call by its semantic inputs (topic, voice
 *   plan, model, etc.) and returns the previous result when the fingerprint
 *   matches. Cache misses fall through to the LLM as normal — the cache is
 *   strictly an optimization, never a correctness dependency.
 *
 * Failure model: every operation is best-effort and resolves on error. A
 * cache miss is indistinguishable from a cache failure to the caller.
 *
 * Versioning: bump CACHE_VERSION when the prompt schema changes
 * incompatibly (e.g., synthesis schema gained the 7-field keyword shape in
 * Phase 2.1 — anything cached before that would have stale 3-field data).
 * The version is mixed into every key so old entries are simply orphaned and
 * pruned by ageOff over time.
 */

import { createKeyValueStore } from './indexedDbStore';

export type StageKind = 'outline' | 'route' | 'voice' | 'avatar' | 'synthesis';

export interface StageCacheEntry<T> {
  /** Wall-clock write time. Used for TTL pruning and "cache hit (recent)" UX. */
  writtenAt: string;
  /** Cache schema version this entry was written under. */
  version: number;
  /** The actual cached value. */
  value: T;
}

/** Bump when the shape of any cached value changes incompatibly. */
const CACHE_VERSION = 2;  // v2: keywords schema gained the 7 long-form fields

/** Per-stage TTLs — synthesis goes stale fastest because it depends on the voices. */
export const STAGE_TTL_MS: Record<StageKind, number> = {
  outline: 7 * 24 * 3600 * 1000,
  route: 7 * 24 * 3600 * 1000,
  voice: 7 * 24 * 3600 * 1000,
  avatar: 30 * 24 * 3600 * 1000,
  synthesis: 24 * 3600 * 1000,
};

const store = createKeyValueStore<StageCacheEntry<unknown>>({
  dbName: 'sophia-stage-cache-v1',
  storeName: 'entries',
  version: 1,
  logTag: '[sophia:stagecache]',
});

/**
 * Tiny non-cryptographic 53-bit hash (cyrb53). Plenty of collision resistance
 * for our domain (a few thousand entries per user) without bringing in a
 * SHA library or bumping the bundle.
 */
const cyrb53 = (str: string, seed = 0): string => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

/**
 * Stable JSON.stringify for keys — sorts object keys recursively so two
 * fingerprints with the same content produce the same hash regardless of
 * field declaration order.
 */
const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
};

/**
 * Build a stable cache key from (kind, fingerprint). Callers should put EVERY
 * input that affects output into the fingerprint — topic, mode, voicePlan,
 * model, provider — otherwise stale cached output will leak between distinct
 * runs.
 */
export const buildStageKey = (kind: StageKind, fingerprint: object): string => {
  const serialized = stableStringify({ kind, version: CACHE_VERSION, fingerprint });
  return `${kind}:${cyrb53(serialized)}`;
};

/**
 * Read a cached entry. Returns null on miss, version mismatch, or TTL expiry.
 * The TTL check happens at read time so we don't have to pre-emptively
 * iterate the store on every load.
 */
export const getStageEntry = async <T>(kind: StageKind, key: string): Promise<T | null> => {
  const entry = await store.get(key);
  if (!entry) return null;
  if (entry.version !== CACHE_VERSION) return null;
  const age = Date.now() - Date.parse(entry.writtenAt);
  if (Number.isFinite(age) && age > STAGE_TTL_MS[kind]) return null;
  return entry.value as T;
};

/**
 * Write a cache entry. Always succeeds from the caller's perspective (errors
 * are swallowed by the underlying store). The kind is included in the key so
 * stages can't collide even if their fingerprints happen to hash the same.
 */
export const putStageEntry = async <T>(_kind: StageKind, key: string, value: T): Promise<void> => {
  await store.put(key, {
    writtenAt: new Date().toISOString(),
    version: CACHE_VERSION,
    value,
  });
};

/** Convenience for "give me the cached value or compute and cache it". */
export const withStageCache = async <T>(
  kind: StageKind,
  fingerprint: object,
  loader: () => Promise<T>,
  options?: { bypass?: boolean; onHit?: (key: string) => void; onMiss?: (key: string) => void },
): Promise<T> => {
  const key = buildStageKey(kind, fingerprint);
  if (!options?.bypass) {
    const hit = await getStageEntry<T>(kind, key);
    if (hit !== null && hit !== undefined) {
      options?.onHit?.(key);
      return hit;
    }
  }
  options?.onMiss?.(key);
  const value = await loader();
  // Fire-and-forget the write so we don't slow down the caller's response.
  void putStageEntry(kind, key, value);
  return value;
};

/** Wipe every stage cache entry (settings page button). */
export const clearStageCache = async (): Promise<void> => {
  await store.clear();
};

/**
 * Approximate count of entries in the store. Used by the settings UI so we
 * can show "缓存了 N 条阶段产物" without having to load them all.
 */
export const countStageEntries = async (): Promise<number> => {
  const keys = await store.listKeys();
  return keys.length;
};
