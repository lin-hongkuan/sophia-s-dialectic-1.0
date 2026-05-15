import { useState, type Dispatch, type SetStateAction } from 'react';
import { appendThoughtVoice, regenerateThoughtVoice, regenerateVoiceAvatar } from '../services/sophiaService';
import { recordUsage as recordTokenUsage } from '../services/tokenAccounting';
import { PRELOADED_HISTORY_ENTRY } from '../data/preloadedHistory';
import { GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE } from '../constants';
import { createVoiceStreamThrottle } from '../utils/voiceStreamThrottle';
import { pushRoute, type View } from '../utils/routing';
import type { ActiveAnalysisRun, AnalysisResult, HistoryEntry } from '../types';

type SelectedSource = 'active' | 'history' | null;

interface UseResultMutationsOptions {
  activeRun: ActiveAnalysisRun | null;
  activeRunIsRunning: boolean;
  displayedResult: AnalysisResult | null;
  selectedSource: SelectedSource;
  presetEntry: HistoryEntry;
  historyEntries: HistoryEntry[];
  setActiveRun: Dispatch<SetStateAction<ActiveAnalysisRun | null>>;
  setSelectedHistoryResult: Dispatch<SetStateAction<AnalysisResult | null>>;
  setSelectedSource: Dispatch<SetStateAction<SelectedSource>>;
  setView: Dispatch<SetStateAction<View>>;
  setTopic: Dispatch<SetStateAction<string>>;
  persistResult: (result: AnalysisResult) => void;
  persistGeneratedPreset: (result: AnalysisResult) => void;
  createRunId: () => string;
}

export const useResultMutations = ({
  activeRun,
  activeRunIsRunning,
  displayedResult,
  selectedSource,
  presetEntry,
  historyEntries,
  setActiveRun,
  setSelectedHistoryResult,
  setSelectedSource,
  setView,
  setTopic,
  persistResult,
  persistGeneratedPreset,
  createRunId,
}: UseResultMutationsOptions) => {
  const [isAppendingVoice, setIsAppendingVoice] = useState(false);
  const [retryingVoiceId, setRetryingVoiceId] = useState<string | null>(null);
  const [regeneratingAvatarVoiceId, setRegeneratingAvatarVoiceId] = useState<string | null>(null);

  const updateDisplayedResult = (updater: (result: AnalysisResult) => AnalysisResult) => {
    if (selectedSource === 'active') {
      setActiveRun((current) => current?.result ? { ...current, result: updater(current.result) } : current);
      return;
    }
    if (selectedSource === 'history') {
      setSelectedHistoryResult((current) => current ? updater(current) : current);
    }
  };

  const editableResultFor = (baseResult: AnalysisResult) => {
    const shouldClonePreset = selectedSource === 'history'
      && (baseResult.id === PRELOADED_HISTORY_ENTRY.result.id || baseResult.id === presetEntry.result.id);
    const sourceResult = shouldClonePreset
      ? { ...baseResult, id: createRunId(), createdAt: new Date().toISOString() }
      : baseResult;

    if (sourceResult !== baseResult) {
      pushRoute(`/history/${encodeURIComponent(sourceResult.id)}`);
      setSelectedHistoryResult(sourceResult);
      setSelectedSource('history');
      setView('result');
      setTopic(sourceResult.topic);
    }

    return sourceResult;
  };

  const applySourceResultUpdate = (
    baseResult: AnalysisResult,
    sourceResult: AnalysisResult,
    updater: (result: AnalysisResult) => AnalysisResult,
  ) => {
    if (sourceResult !== baseResult) {
      setSelectedHistoryResult((current) => current ? updater(current) : current);
      return;
    }
    updateDisplayedResult(updater);
  };

  const handleKeywordEnriched = (updatedResult: AnalysisResult) => {
    const analysisId = updatedResult.id;
    if (activeRun?.result?.id === analysisId) {
      setActiveRun((current) => current?.result ? { ...current, result: updatedResult } : current);
    }
    if (presetEntry.result.id === analysisId) {
      persistGeneratedPreset(updatedResult);
      return;
    }
    if (historyEntries.some((entry) => entry.id === analysisId)) {
      persistResult(updatedResult);
    }
  };

  const handleAppendThoughtVoice = async (prompt: string) => {
    const baseResult = displayedResult;
    const trimmedPrompt = prompt.trim();
    if (!baseResult || !trimmedPrompt || isAppendingVoice || activeRunIsRunning) return;

    setIsAppendingVoice(true);
    const sourceResult = editableResultFor(baseResult);
    const applyResultUpdate = (updater: (result: AnalysisResult) => AnalysisResult) => {
      applySourceResultUpdate(baseResult, sourceResult, updater);
    };

    const throttle = createVoiceStreamThrottle((voiceId, fullText) => {
      applyResultUpdate((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, argument: fullText, status: 'generating' } : voice),
      }));
    });

    try {
      const updatedResult = await appendThoughtVoice(sourceResult, trimmedPrompt, {
        onVoicePlanned: (voice) => applyResultUpdate((result) => ({ ...result, voices: [...result.voices, voice] })),
        onVoiceStart: (voiceId) => applyResultUpdate((result) => ({
          ...result,
          voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating' } : voice),
        })),
        onVoiceDelta: (voiceId, _delta, fullText) => throttle.schedule(voiceId, fullText),
        onVoiceStep: (voiceId) => throttle.flush(voiceId),
        onVoiceComplete: (voice) => {
          throttle.clearOne(voice.id);
          applyResultUpdate((result) => ({
            ...result,
            voices: result.voices.map((item) => item.id === voice.id ? voice : item),
          }));
        },
        onSynthesis: (partial) => applyResultUpdate((result) => ({ ...result, ...partial })),
        onTokenUsage: (usage) => recordTokenUsage(usage),
      });

      throttle.clearAll();
      applyResultUpdate(() => updatedResult);
      persistResult(updatedResult);
    } catch (error) {
      console.error('[Sophia] append voice failed:', error);
    } finally {
      throttle.clearAll();
      setIsAppendingVoice(false);
    }
  };

  const handleRetryVoice = async (voiceId: string) => {
    if (activeRunIsRunning || isAppendingVoice || retryingVoiceId) return;
    const baseResult = displayedResult;
    if (!baseResult) return;
    const targetVoice = baseResult.voices.find((voice) => voice.id === voiceId);
    if (!targetVoice) return;

    setRetryingVoiceId(voiceId);
    const sourceResult = editableResultFor(baseResult);
    const applyResultUpdate = (updater: (result: AnalysisResult) => AnalysisResult) => {
      applySourceResultUpdate(baseResult, sourceResult, updater);
    };

    applyResultUpdate((result) => ({
      ...result,
      voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating', error: undefined, avatarError: undefined, argument: '', summaryForSynthesis: '' } : voice),
    }));

    const throttle = createVoiceStreamThrottle((vid, fullText) => {
      applyResultUpdate((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === vid ? { ...voice, argument: fullText, status: 'generating' } : voice),
      }));
    });

    try {
      const updatedResult = await regenerateThoughtVoice(sourceResult, voiceId, {
        onVoiceStart: (vid) => applyResultUpdate((result) => ({
          ...result,
          voices: result.voices.map((voice) => voice.id === vid ? { ...voice, status: 'generating', error: undefined, avatarError: undefined } : voice),
        })),
        onVoiceDelta: (vid, _delta, fullText) => throttle.schedule(vid, fullText),
        onVoiceStep: (vid) => throttle.flush(vid),
        onVoiceComplete: (voice) => {
          throttle.clearOne(voice.id);
          applyResultUpdate((result) => ({
            ...result,
            voices: result.voices.map((item) => item.id === voice.id ? voice : item),
          }));
        },
        onSynthesis: (partial) => applyResultUpdate((result) => ({ ...result, ...partial })),
        onTokenUsage: (usage) => recordTokenUsage(usage),
      });

      throttle.clearAll();
      applyResultUpdate(() => updatedResult);
      persistResult(updatedResult);
    } catch (error) {
      console.error('[Sophia] retry voice failed:', error);
      const message = error instanceof Error ? error.message : '重新生成失败';
      applyResultUpdate((result) => ({
        ...result,
        voices: result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'failed', error: message } : voice),
      }));
    } finally {
      throttle.clearAll();
      setRetryingVoiceId(null);
    }
  };

  const handleRegenerateAvatar = async (voiceId: string) => {
    if (activeRunIsRunning || isAppendingVoice || regeneratingAvatarVoiceId) return;
    const baseResult = displayedResult;
    if (!baseResult) return;
    const targetVoice = baseResult.voices.find((voice) => voice.id === voiceId);
    if (!targetVoice) return;

    setRegeneratingAvatarVoiceId(voiceId);
    const sourceResult = editableResultFor(baseResult);

    try {
      const avatar = await regenerateVoiceAvatar(sourceResult, voiceId);
      const updatedResult: AnalysisResult = {
        ...sourceResult,
        voices: sourceResult.voices.map((voice) => voice.id === voiceId ? { ...voice, avatar, avatarError: undefined } : voice),
      };
      if (sourceResult !== baseResult) {
        setSelectedHistoryResult(updatedResult);
      } else {
        updateDisplayedResult(() => updatedResult);
      }
      if (sourceResult.id === presetEntry.result.id) {
        persistGeneratedPreset(updatedResult);
      } else {
        persistResult(updatedResult);
      }
    } catch (error) {
      console.error('[Sophia] regenerate avatar failed:', error);
      const message = error instanceof Error ? error.message : GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE;
      const updatedResult: AnalysisResult = {
        ...sourceResult,
        voices: sourceResult.voices.map((voice) => voice.id === voiceId ? { ...voice, avatarError: message } : voice),
      };
      if (sourceResult !== baseResult) {
        setSelectedHistoryResult(updatedResult);
      } else {
        updateDisplayedResult(() => updatedResult);
      }
      if (sourceResult.id === presetEntry.result.id) {
        persistGeneratedPreset(updatedResult);
      } else {
        persistResult(updatedResult);
      }
    } finally {
      setRegeneratingAvatarVoiceId(null);
    }
  };

  return {
    isAppendingVoice,
    retryingVoiceId,
    regeneratingAvatarVoiceId,
    handleKeywordEnriched,
    handleAppendThoughtVoice,
    handleRetryVoice,
    handleRegenerateAvatar,
  };
};
