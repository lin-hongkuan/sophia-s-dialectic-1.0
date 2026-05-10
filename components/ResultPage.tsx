import React from 'react';
import type { ActiveAnalysisRun, AnalysisResult, GenerationProgress, GenerationLogEntry } from '../types';
import Arena from './Arena';
import RoundtableScene from './RoundtableScene';

type SelectedSource = 'active' | 'history' | null;

interface ResultPageProps {
  selectedSource: SelectedSource;
  activeRun: ActiveAnalysisRun | null;
  activeRunIsRunning: boolean;
  displayedResult: AnalysisResult | null;
  displayedProgress: GenerationProgress | null;
  displayedError: string | null;
  log?: GenerationLogEntry[];
  canRegenerateFromContext: boolean;
  isAppendingVoice: boolean;
  retryingVoiceId: string | null;
  regeneratingAvatarVoiceId: string | null;
  onCancelActiveRun: () => void;
  onSkipActiveVoice: (voiceId: string) => void;
  onInsertActiveVoice: (prompt: string) => void;
  onRegenerateAll: () => void;
  onReset: () => void;
  onFollowUp: (question: string) => void;
  onAppendThoughtVoice: (prompt: string) => void;
  onRetryVoice: (voiceId: string) => void;
  onOpenConcept: (keywordId: string) => void;
  onRegenerateAvatar: (voiceId: string) => void;
}

const ResultPage: React.FC<ResultPageProps> = ({
  selectedSource,
  activeRun,
  activeRunIsRunning,
  displayedResult,
  displayedProgress,
  displayedError,
  log,
  canRegenerateFromContext,
  isAppendingVoice,
  retryingVoiceId,
  regeneratingAvatarVoiceId,
  onCancelActiveRun,
  onSkipActiveVoice,
  onInsertActiveVoice,
  onRegenerateAll,
  onReset,
  onFollowUp,
  onAppendThoughtVoice,
  onRetryVoice,
  onOpenConcept,
  onRegenerateAvatar,
}) => (
  <>
    {selectedSource === 'active' && (
      <RoundtableScene
        isAnalyzing={activeRunIsRunning}
        isFinished={!activeRunIsRunning && !!displayedResult && displayedProgress?.stage === 'done'}
        progress={displayedProgress}
        startedAt={activeRun?.createdAt}
        result={displayedResult}
        log={log}
        onCancel={activeRunIsRunning ? onCancelActiveRun : undefined}
        onSkipVoice={activeRunIsRunning ? onSkipActiveVoice : undefined}
        onInsertVoice={activeRunIsRunning ? onInsertActiveVoice : undefined}
      />
    )}

    {displayedError && (
      <div className="max-w-md mx-auto mt-8 text-center text-red-700 bg-red-50 p-5 rounded-lg border border-red-100">
        <p className="font-serif">苏菲遇到了错误：{displayedError}</p>
        {selectedSource === 'active' && !activeRunIsRunning && canRegenerateFromContext && (
          <button
            type="button"
            onClick={onRegenerateAll}
            className="mt-3 px-5 py-2 bg-museum-900 text-museum-50 rounded-full text-sm font-serif hover:bg-black transition-colors disabled:opacity-50"
            disabled={isAppendingVoice || !!retryingVoiceId || !!regeneratingAvatarVoiceId}
          >
            重新生成这份分析
          </button>
        )}
      </div>
    )}

    {displayedResult && (
      <Arena
        data={displayedResult}
        onReset={onReset}
        onFollowUp={onFollowUp}
        onAppendThoughtVoice={onAppendThoughtVoice}
        onRetryVoice={onRetryVoice}
        retryingVoiceId={retryingVoiceId}
        isGenerating={selectedSource === 'active' && activeRunIsRunning}
        isAppendingVoice={isAppendingVoice}
        onOpenConcept={onOpenConcept}
        onRegenerateAll={selectedSource === 'active' || canRegenerateFromContext ? onRegenerateAll : undefined}
        isRegenerateAllDisabled={activeRunIsRunning || isAppendingVoice || !!retryingVoiceId || !!regeneratingAvatarVoiceId}
        onRegenerateAvatar={onRegenerateAvatar}
        regeneratingAvatarVoiceId={regeneratingAvatarVoiceId}
      />
    )}
  </>
);

export default ResultPage;
