import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnalysisResult, HistoryEntry, RunSnapshot } from '../types';
import { PRELOADED_HISTORY_ENTRY } from '../data/preloadedHistory';
import { downloadJsonFile } from '../utils/download';
import {
  buildHistoryBackupFilename,
  collectAvatarKeys,
  extractImportedHistory,
  HISTORY_EXPORT_VERSION,
  HISTORY_LIMIT,
  hydrateEntriesWithAvatars,
  loadGeneratedPreset,
  loadHistory,
  maybeMigrateLegacyAvatars,
  persistEntryAvatars,
  PRESET_HISTORY_KEY,
  saveHistory,
  splitAvatarsForStorage,
} from '../services/historyStore';
import { deleteAvatarImages } from '../services/imageStore';
import { deleteRunSnapshot, findMostRecentResumable, pruneStaleRunSnapshots } from '../services/runSnapshotStore';
import { safeLocalStorageSet } from '../services/localStorageGateway';

export const useHistoryLibrary = () => {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [presetEntry, setPresetEntry] = useState<HistoryEntry>(PRELOADED_HISTORY_ENTRY);
  const [pendingResumeSnap, setPendingResumeSnap] = useState<RunSnapshot | null>(null);

  useEffect(() => {
    setHistoryEntries(loadHistory());
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;
    setPresetEntry(nextPresetEntry);

    void (async () => {
      await maybeMigrateLegacyAvatars();
      const stored = loadHistory();
      const hydrated = await hydrateEntriesWithAvatars(stored);
      if (hydrated !== stored) setHistoryEntries(hydrated);
      const presetStored = loadGeneratedPreset();
      if (presetStored) {
        const [hydratedPreset] = await hydrateEntriesWithAvatars([presetStored]);
        if (hydratedPreset !== presetStored) setPresetEntry(hydratedPreset);
      }
    })();

    void (async () => {
      try { await pruneStaleRunSnapshots(); } catch { /* best-effort */ }
      const snap = await findMostRecentResumable();
      if (snap) setPendingResumeSnap(snap);
    })();
  }, []);

  const allHistoryEntries = useMemo(() => [presetEntry, ...historyEntries], [presetEntry, historyEntries]);

  const persistResult = useCallback((nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: nextResult.id,
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
    };
    setHistoryEntries((prev) => {
      const filtered = prev.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].slice(0, HISTORY_LIMIT);
      const saved = saveHistory(next);
      const keptIds = new Set(saved.map((e) => e.id));
      const droppedKeys: string[] = [];
      next.forEach((e) => {
        if (!keptIds.has(e.id)) droppedKeys.push(...collectAvatarKeys(e));
      });
      if (droppedKeys.length > 0) void deleteAvatarImages(droppedKeys);
      void persistEntryAvatars(entry).catch((error) => {
        console.warn('[sophia] failed to persist avatar images:', error);
      });
      return saved.length > 0 ? saved : next;
    });
  }, []);

  const persistGeneratedPreset = useCallback((nextResult: AnalysisResult) => {
    const entry: HistoryEntry = {
      id: 'preset-generated-feminism',
      topic: nextResult.topic,
      title: nextResult.philosophical_title,
      mode: nextResult.mode,
      modeLabel: nextResult.modeLabel,
      createdAt: nextResult.createdAt,
      result: nextResult,
      isPreset: true,
      generatedByChain: true,
    };
    const { lean } = splitAvatarsForStorage(entry);
    const savedPreset = safeLocalStorageSet(PRESET_HISTORY_KEY, JSON.stringify(lean));
    if (!savedPreset) console.warn('[sophia] preset cache quota exhausted — preset not persisted.');
    void persistEntryAvatars(entry).catch((error) => {
      console.warn('[sophia] failed to persist preset avatar images:', error);
    });
    setPresetEntry(entry);
  }, []);

  const hydratePresetForCurrentRoute = useCallback((route: string, onHydrated: (entry: HistoryEntry) => void) => {
    const nextPresetEntry = loadGeneratedPreset() || PRELOADED_HISTORY_ENTRY;
    setPresetEntry(nextPresetEntry);
    void hydrateEntriesWithAvatars([nextPresetEntry]).then(([hydratedPreset]) => {
      if (window.location.pathname !== route) return;
      if (hydratedPreset === nextPresetEntry) return;
      setPresetEntry(hydratedPreset);
      onHydrated(hydratedPreset);
    });
    return nextPresetEntry;
  }, []);

  const hydrateHistoryForCurrentRoute = useCallback((route: string, entries: HistoryEntry[], historyId: string, onHydrated: (entry: HistoryEntry) => void) => {
    void hydrateEntriesWithAvatars(entries).then((hydrated) => {
      if (window.location.pathname !== route) return;
      if (hydrated === entries) return;
      setHistoryEntries(hydrated);
      const refreshed = hydrated.find((entry) => entry.id === historyId);
      if (refreshed) onHydrated(refreshed);
    });
  }, []);

  const findStoredEntry = useCallback((historyId: string, selectedResult?: AnalysisResult | null) => {
    const inMemoryEntry = historyEntries.find((entry) => entry.id === historyId)
      || (selectedResult?.id === historyId
        ? {
          id: selectedResult.id,
          topic: selectedResult.topic,
          title: selectedResult.philosophical_title,
          mode: selectedResult.mode,
          modeLabel: selectedResult.modeLabel,
          createdAt: selectedResult.createdAt,
          result: selectedResult,
        }
        : null);
    const storedHistory = loadHistory();
    const historyEntry = inMemoryEntry || storedHistory.find((entry) => entry.id === historyId);
    if (!historyEntry) return null;
    const entries = historyEntries.some((entry) => entry.id === historyId) ? historyEntries : storedHistory;
    return { entry: historyEntry, entries };
  }, [historyEntries]);

  const importHistory = useCallback((content: string) => {
    const importedEntries = extractImportedHistory(JSON.parse(content))
      .filter((entry) => !entry.isPreset)
      .map((entry) => ({ ...entry, isPreset: false, generatedByChain: false }));
    const existingIds = new Set(historyEntries.map((entry) => entry.id));
    const newEntries = importedEntries.filter((entry) => !existingIds.has(entry.id));
    const nextEntries = [...newEntries, ...historyEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, HISTORY_LIMIT);

    newEntries.forEach((entry) => { void persistEntryAvatars(entry); });

    const saved = saveHistory(nextEntries);
    setHistoryEntries(saved.length > 0 ? saved : nextEntries);
    return {
      imported: newEntries.length,
      scanned: importedEntries.length,
      limit: HISTORY_LIMIT,
    };
  }, [historyEntries]);

  const downloadHistory = useCallback(() => {
    downloadJsonFile(buildHistoryBackupFilename(), {
      app: 'sophia-dialectic',
      version: HISTORY_EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      entries: historyEntries,
    });
  }, [historyEntries]);

  const deleteHistoryEntry = useCallback((entry: HistoryEntry) => {
    if (entry.isPreset) return historyEntries;
    const nextEntries = historyEntries.filter((item) => item.id !== entry.id);
    void deleteAvatarImages(collectAvatarKeys(entry));
    saveHistory(nextEntries);
    setHistoryEntries(nextEntries);
    return nextEntries;
  }, [historyEntries]);

  const dismissResumePrompt = useCallback((snap: RunSnapshot) => {
    setPendingResumeSnap(null);
    void deleteRunSnapshot(snap.runId);
  }, []);

  return {
    historyEntries,
    presetEntry,
    setPresetEntry,
    allHistoryEntries,
    pendingResumeSnap,
    setPendingResumeSnap,
    persistResult,
    persistGeneratedPreset,
    hydratePresetForCurrentRoute,
    hydrateHistoryForCurrentRoute,
    findStoredEntry,
    importHistory,
    downloadHistory,
    deleteHistoryEntry,
    dismissResumePrompt,
  };
};
