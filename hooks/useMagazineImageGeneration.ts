import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { generateMagazineImage } from '../services/sophiaService';
import type { AnalysisResult, MagazineImageAsset, MagazineImageSlot } from '../types/domain';
import type { ActiveAnalysisRun, HistoryEntry } from '../types/storage';

type SelectedSource = 'active' | 'history' | null;

interface UseMagazineImageGenerationOptions {
  displayedResult: AnalysisResult | null;
  selectedSource: SelectedSource;
  activeRun: ActiveAnalysisRun | null;
  activeRunIsRunning: boolean;
  presetEntry: HistoryEntry;
  historyEntries: HistoryEntry[];
  setActiveRun: Dispatch<SetStateAction<ActiveAnalysisRun | null>>;
  setSelectedHistoryResult: Dispatch<SetStateAction<AnalysisResult | null>>;
  persistResult: (result: AnalysisResult) => void;
  persistGeneratedPreset: (result: AnalysisResult) => void;
}

const MAGAZINE_IMAGE_SLOTS: MagazineImageSlot[] = ['cover', 'conclusion'];

const shouldGenerateSlot = (result: AnalysisResult, slot: MagazineImageSlot): boolean => {
  const image = result.magazineImages?.[slot];
  return !image || (!image.imageUrl && image.status !== 'failed');
};

const hasResolvedSlot = (result: AnalysisResult, slot: MagazineImageSlot): boolean => {
  const image = result.magazineImages?.[slot];
  return !!image?.imageUrl || image?.status === 'failed';
};

const canBackfillSlot = (result: AnalysisResult, slot: MagazineImageSlot): boolean => {
  if (slot === 'conclusion') return !!result.conclusion.summary;
  return !!(result.philosophical_title || result.questionFrame.bigQuestion || result.introduction);
};

export const useMagazineImageGeneration = ({
  displayedResult,
  selectedSource,
  activeRun,
  activeRunIsRunning,
  presetEntry,
  historyEntries,
  setActiveRun,
  setSelectedHistoryResult,
  persistResult,
  persistGeneratedPreset,
}: UseMagazineImageGenerationOptions) => {
  const inFlightRef = useRef<Set<string>>(new Set());
  const latestResultRef = useRef<AnalysisResult | null>(null);

  useEffect(() => {
    latestResultRef.current = displayedResult;
  }, [displayedResult]);

  useEffect(() => {
    const result = displayedResult;
    if (!result || !selectedSource) return;
    if (selectedSource === 'active' && (activeRunIsRunning || activeRun?.status !== 'completed')) return;

    const slots = MAGAZINE_IMAGE_SLOTS.filter((slot) => canBackfillSlot(result, slot) && shouldGenerateSlot(result, slot));
    if (slots.length === 0) return;

    let cancelled = false;

    const persistUpdatedResult = (updated: AnalysisResult) => {
      if (presetEntry.result.id === updated.id || (selectedSource === 'active' && activeRun?.isPresetRegeneration)) {
        persistGeneratedPreset(updated);
        return;
      }
      if (selectedSource === 'active' || historyEntries.some((entry) => entry.id === updated.id)) {
        persistResult(updated);
      }
    };

    const commitImage = (slot: MagazineImageSlot, image: MagazineImageAsset) => {
      const base = latestResultRef.current;
      if (!base || base.id !== result.id || hasResolvedSlot(base, slot)) return;

      const updated: AnalysisResult = {
        ...base,
        magazineImages: {
          ...(base.magazineImages || {}),
          [slot]: image,
        },
      };
      latestResultRef.current = updated;

      if (selectedSource === 'active') {
        setActiveRun((current) => {
          if (!current?.result || current.result.id !== result.id) return current;
          if (hasResolvedSlot(current.result, slot)) return current;
          return { ...current, result: updated };
        });
      } else if (selectedSource === 'history') {
        setSelectedHistoryResult((current) => {
          if (!current || current.id !== result.id) return current;
          if (hasResolvedSlot(current, slot)) return current;
          return updated;
        });
      }

      persistUpdatedResult(updated);
    };

    slots.forEach((slot) => {
      const key = `${result.id}:${slot}`;
      if (cancelled || inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);
      void generateMagazineImage(result, slot)
        .then((image) => {
          if (!cancelled) commitImage(slot, image);
        })
        .catch((error) => {
          console.warn(`[sophia] magazine image background job failed: ${slot}`, error);
        })
        .finally(() => {
          inFlightRef.current.delete(key);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [
    activeRun?.isPresetRegeneration,
    activeRun?.status,
    activeRunIsRunning,
    displayedResult,
    historyEntries,
    persistGeneratedPreset,
    persistResult,
    presetEntry.result.id,
    selectedSource,
    setActiveRun,
    setSelectedHistoryResult,
  ]);
};
