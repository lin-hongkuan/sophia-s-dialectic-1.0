import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react';
import type { ActiveAnalysisRun, AnalysisResult, HistoryEntry } from '../types';
import { PRELOADED_HISTORY_ENTRY } from '../data/preloadedHistory';
import {
  AppRoute,
  View,
  conceptRoute,
  historyItemRoute,
  normalizeRoute,
  parseConceptRoute,
  pushRoute,
  routeHistoryId,
} from '../utils/routing';
import { loadGeneratedPreset, loadHistory } from '../services/historyStore';

type SelectedSource = 'active' | 'history' | null;

interface StoredEntryLookup {
  entry: HistoryEntry;
  entries: HistoryEntry[];
}

interface UseAppRoutingOptions {
  activeRun: ActiveAnalysisRun | null;
  historyEntries: HistoryEntry[];
  presetEntry: HistoryEntry;
  selectedHistoryResult: AnalysisResult | null;
  setTopic: Dispatch<SetStateAction<string>>;
  setView: Dispatch<SetStateAction<View>>;
  setSelectedSource: Dispatch<SetStateAction<SelectedSource>>;
  setSelectedHistoryResult: Dispatch<SetStateAction<AnalysisResult | null>>;
  setConceptTarget: Dispatch<SetStateAction<{ analysisId: string; keywordId: string } | null>>;
  hydratePresetForCurrentRoute: (route: string, onHydrated: (entry: HistoryEntry) => void) => HistoryEntry;
  hydrateHistoryForCurrentRoute: (route: string, entries: HistoryEntry[], historyId: string, onHydrated: (entry: HistoryEntry) => void) => void;
  findStoredEntry: (historyId: string, selectedResult?: AnalysisResult | null) => StoredEntryLookup | null;
}

export const useAppRouting = ({
  activeRun,
  historyEntries,
  presetEntry,
  selectedHistoryResult,
  setTopic,
  setView,
  setSelectedSource,
  setSelectedHistoryResult,
  setConceptTarget,
  hydratePresetForCurrentRoute,
  hydrateHistoryForCurrentRoute,
  findStoredEntry,
}: UseAppRoutingOptions) => {
  const conceptBackRouteRef = useRef<AppRoute>('/');

  const findAnalysisResultById = useCallback((analysisId: string): AnalysisResult | null => {
    if (activeRun?.result?.id === analysisId) return activeRun.result;
    if (presetEntry.result.id === analysisId) return presetEntry.result;
    const fromHistory = historyEntries.find((entry) => entry.id === analysisId);
    if (fromHistory) return fromHistory.result;
    if (PRELOADED_HISTORY_ENTRY.result.id === analysisId) return PRELOADED_HISTORY_ENTRY.result;
    return null;
  }, [activeRun?.result, historyEntries, presetEntry.result]);

  const deriveAnalysisRoute = useCallback((analysisId: string): AppRoute => {
    const latestPreset = loadGeneratedPreset() || presetEntry;
    if (latestPreset.result.id === analysisId || PRELOADED_HISTORY_ENTRY.result.id === analysisId) return '/history/sample';
    const storedHistory = historyEntries.length > 0 ? historyEntries : loadHistory();
    if (storedHistory.some((entry) => entry.id === analysisId)) return `/history/${encodeURIComponent(analysisId)}` as AppRoute;
    return '/history';
  }, [historyEntries, presetEntry]);

  const openRoute = useCallback((route: AppRoute, replace = false) => {
    if (replace) {
      window.history.replaceState(null, '', route);
    } else {
      pushRoute(route);
    }

    if (route === '/active') {
      if (activeRun) {
        setSelectedSource('active');
        setSelectedHistoryResult(null);
        setView('result');
      } else {
        window.history.replaceState(null, '', '/');
        setSelectedSource(null);
        setSelectedHistoryResult(null);
        setView('home');
      }
      return;
    }

    if (route === '/history/sample') {
      const nextPresetEntry = hydratePresetForCurrentRoute('/history/sample', (hydratedPreset) => {
        setSelectedHistoryResult(hydratedPreset.result);
      });
      setSelectedHistoryResult(nextPresetEntry.result);
      setTopic(nextPresetEntry.topic);
      setSelectedSource('history');
      setView('result');
      return;
    }

    const conceptTargetFromRoute = parseConceptRoute(route);
    if (conceptTargetFromRoute) {
      conceptBackRouteRef.current = deriveAnalysisRoute(conceptTargetFromRoute.analysisId);
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setConceptTarget(conceptTargetFromRoute);
      setView('concept');
      return;
    }

    const historyId = routeHistoryId(route);
    if (historyId && historyId !== 'sample') {
      const found = findStoredEntry(historyId, selectedHistoryResult);
      if (found) {
        const { entry: historyEntry, entries: nextHistoryEntries } = found;
        setSelectedHistoryResult(historyEntry.result);
        setTopic(historyEntry.topic);
        setSelectedSource('history');
        setView('result');
        hydrateHistoryForCurrentRoute(`/history/${encodeURIComponent(historyId)}`, nextHistoryEntries, historyId, (refreshed) => {
          setSelectedHistoryResult(refreshed.result);
        });
        return;
      }
      window.history.replaceState(null, '', '/history');
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('history');
      return;
    }

    if (route === '/history') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('history');
      return;
    }

    if (route === '/manifesto') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('manifesto');
      return;
    }

    if (route === '/settings') {
      setSelectedSource(null);
      setSelectedHistoryResult(null);
      setView('settings');
      return;
    }

    setSelectedSource(null);
    setSelectedHistoryResult(null);
    setView('home');
  }, [
    activeRun,
    deriveAnalysisRoute,
    findStoredEntry,
    hydrateHistoryForCurrentRoute,
    hydratePresetForCurrentRoute,
    selectedHistoryResult,
    setConceptTarget,
    setSelectedHistoryResult,
    setSelectedSource,
    setTopic,
    setView,
  ]);

  const openActiveRun = useCallback(() => {
    if (!activeRun) return;
    pushRoute('/active');
    setSelectedSource('active');
    setSelectedHistoryResult(null);
    setView('result');
  }, [activeRun, setSelectedHistoryResult, setSelectedSource, setView]);

  const openHistoryEntry = useCallback((entry: HistoryEntry) => {
    const route = historyItemRoute(entry);
    if (route === '/history/sample') {
      openRoute('/history/sample');
      return;
    }

    pushRoute(route);
    setSelectedHistoryResult(entry.result);
    setTopic(entry.topic);
    setSelectedSource('history');
    setView('result');
  }, [openRoute, setSelectedHistoryResult, setSelectedSource, setTopic, setView]);

  const goHome = useCallback(() => openRoute('/'), [openRoute]);
  const goHistory = useCallback(() => openRoute('/history'), [openRoute]);
  const goManifesto = useCallback(() => openRoute('/manifesto'), [openRoute]);
  const goSettings = useCallback(() => openRoute('/settings'), [openRoute]);

  const goToConcept = useCallback((analysisId: string, keywordId: string, fromRoute?: AppRoute) => {
    if (fromRoute) conceptBackRouteRef.current = fromRoute;
    else if (typeof window !== 'undefined') conceptBackRouteRef.current = normalizeRoute(window.location.pathname);
    openRoute(conceptRoute(analysisId, keywordId));
  }, [openRoute]);

  const goConceptBack = useCallback(() => {
    openRoute(conceptBackRouteRef.current || '/');
  }, [openRoute]);

  return {
    openRoute,
    openActiveRun,
    openHistoryEntry,
    goHome,
    goHistory,
    goManifesto,
    goSettings,
    goToConcept,
    goConceptBack,
    findAnalysisResultById,
  };
};
