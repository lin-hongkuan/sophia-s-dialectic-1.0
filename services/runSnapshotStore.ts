/**
 * Per-run snapshot store backed by IndexedDB.
 *
 * Why this exists: the analyze pipeline can take 30-90 seconds. If the user
 * refreshes mid-run, kills the tab, or hits a transient error, the only thing
 * keeping their progress alive today is React state — which is gone the
 * moment the page reloads. We persist a snapshot at every stage boundary so
 * the next visit can offer "上次有一份未完成的分析，是否继续？" and resume
 * from the most recent completed stage instead of redoing the whole run.
 *
 * Lifecycle:
 *   - analyzeTopic / resumeAnalysis writes after onOutline, onRouteMap,
 *     each onVoiceComplete, and onSynthesis.
 *   - On a clean completion (or explicit cancel/error after synthesis) we
 *     delete the snapshot — finished runs already live in the history list.
 *   - On mount, App.tsx loads any remaining snapshots, drops anything stale
 *     (older than RUN_SNAPSHOT_TTL_MS), and surfaces the most recent one.
 */

import { RunSnapshot } from '../types';
import { createKeyValueStore } from './indexedDbStore';

const store = createKeyValueStore<RunSnapshot>({
  dbName: 'sophia-runs-v1',
  storeName: 'snapshots',
  version: 1,
  logTag: '[sophia:runs]',
});

/** Snapshots older than this are considered abandoned and pruned on mount. */
export const RUN_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export const saveRunSnapshot = async (snap: RunSnapshot): Promise<void> => {
  await store.put(snap.runId, snap);
};

export const loadRunSnapshot = async (runId: string): Promise<RunSnapshot | null> =>
  store.get(runId);

export const deleteRunSnapshot = async (runId: string): Promise<void> => {
  await store.del(runId);
};

export const clearRunSnapshots = async (): Promise<void> => {
  await store.clear();
};

/**
 * Return all snapshots that haven't yet been cleaned up. The caller is
 * responsible for filtering by status / age.
 */
export const listRunSnapshots = async (): Promise<RunSnapshot[]> => {
  const entries = await store.listEntries();
  return entries.map((entry) => entry.value).filter((value): value is RunSnapshot => !!value);
};

/**
 * Delete every snapshot whose updatedAt is older than ttlMs ago. Run on
 * app mount so a long-abandoned run doesn't follow the user around forever.
 */
export const pruneStaleRunSnapshots = async (ttlMs = RUN_SNAPSHOT_TTL_MS): Promise<void> => {
  const cutoff = Date.now() - ttlMs;
  const entries = await store.listEntries();
  const stale = entries.filter(({ value }) => {
    if (!value) return true;
    const ts = Date.parse(value.updatedAt);
    return Number.isFinite(ts) ? ts < cutoff : true;
  });
  if (stale.length === 0) return;
  await store.del(stale.map(({ key }) => key));
};

/**
 * Find the most recent snapshot whose status is still "in flight" — meaning
 * the user could plausibly want to resume it. Completed / cancelled / error
 * snapshots are skipped (they should have been deleted on the way out, but
 * we double-check here in case a bug or hard crash left them behind).
 */
export const findMostRecentResumable = async (): Promise<RunSnapshot | null> => {
  const all = await listRunSnapshots();
  const candidates = all.filter((snap) =>
    (snap.status === 'starting' || snap.status === 'running') && snap.lastCompletedStage !== 'synthesis'
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return candidates[0];
};
