import type { AnalysisResult } from '../types/domain';
import type { ActiveAnalysisRun } from '../types/storage';
import type { SelectedSource } from '../utils/routing';

interface UseSelectedResultOptions {
  selectedSource: SelectedSource;
  activeRun: ActiveAnalysisRun | null;
  selectedHistoryResult: AnalysisResult | null;
}

export const useSelectedResult = ({
  selectedSource,
  activeRun,
  selectedHistoryResult,
}: UseSelectedResultOptions) => {
  const displayedResult = selectedSource === 'active' ? activeRun?.result || null : selectedHistoryResult;
  const displayedProgress = selectedSource === 'active' ? activeRun?.progress || null : null;
  const displayedError = selectedSource === 'active' ? activeRun?.error || null : null;

  return {
    displayedResult,
    displayedProgress,
    displayedError,
  };
};
