import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeTopic, createPartialResult, resumeAnalysis } from '../services/sophiaService';
import type { AnalysisResult, ThoughtVoice } from '../types/domain';
import type { ContinuationContext, GenerationLogEntry, RunControlHandle, TokenUsage, VoiceInsertSeed } from '../types/pipeline';
import type { ActiveAnalysisRun, RunSnapshot, RunSnapshotStage } from '../types/storage';
import {
  appendRunLog,
  buildRunSnapshotPayload,
  createGenerationLogEntry,
  progressForCompletedResult,
  progressForResume,
  progressForRunFailure,
} from '../utils/runLifecycle';
import { checkpointStageForProgress } from '../utils/generationLog';
import { createVoiceStreamThrottle } from '../utils/voiceStreamThrottle';
import { recordUsage as recordTokenUsage } from '../services/tokenAccounting';
import { deleteRunSnapshot, saveRunSnapshot } from '../services/storage/runSnapshotStore';

interface UseAnalysisRunOptions {
  createRunId: () => string;
  onRunOpen: (topic: string) => void;
  onRunComplete: (result: AnalysisResult, isPresetRegeneration?: boolean) => void;
  onResumeAccepted: () => void;
}

export const useAnalysisRun = ({
  createRunId,
  onRunOpen,
  onRunComplete,
  onResumeAccepted,
}: UseAnalysisRunOptions) => {
  const [activeRun, setActiveRun] = useState<ActiveAnalysisRun | null>(null);
  const activeRunIdRef = useRef<string | null>(null);
  const activeRunRef = useRef<ActiveAnalysisRun | null>(null);
  const lastRunContextRef = useRef<{ topic: string; continuationContext?: ContinuationContext; isPresetRegeneration?: boolean } | null>(null);
  const activeRunControlRef = useRef<RunControlHandle | null>(null);
  const pendingPlannedVoicesRef = useRef<ThoughtVoice[]>([]);
  const pendingMagazineImagesRef = useRef<NonNullable<AnalysisResult['magazineImages']>>({});

  const activeRunIsRunning = activeRun?.status === 'starting' || activeRun?.status === 'running';

  useEffect(() => {
    activeRunRef.current = activeRun;
  }, [activeRun]);

  const updateActiveRun = useCallback((runId: string, updater: (run: ActiveAnalysisRun) => ActiveAnalysisRun) => {
    if (activeRunIdRef.current !== runId) return;
    setActiveRun((current) => {
      if (!current || current.runId !== runId) return current;
      const next = updater(current);
      activeRunRef.current = next;
      return next;
    });
  }, []);

  const writeRunSnapshot = useCallback((
    run: ActiveAnalysisRun,
    lastCompletedStage: RunSnapshotStage | null = checkpointStageForProgress(run.progress),
    continuationContext?: ContinuationContext,
  ) => {
    void saveRunSnapshot(buildRunSnapshotPayload(run, lastCompletedStage, continuationContext));
  }, []);

  const updateActiveRunWithSnapshot = useCallback((
    runId: string,
    updater: (run: ActiveAnalysisRun) => ActiveAnalysisRun,
    continuationContext?: ContinuationContext,
    lastCompletedStage?: RunSnapshotStage | null,
  ) => {
    updateActiveRun(runId, (run) => {
      const next = updater(run);
      writeRunSnapshot(next, lastCompletedStage ?? checkpointStageForProgress(next.progress), continuationContext);
      return next;
    });
  }, [updateActiveRun, writeRunSnapshot]);

  const buildCallbacks = useCallback((runId: string, continuationContext?: ContinuationContext) => {
    const throttle = createVoiceStreamThrottle((voiceId, fullText) => {
      updateActiveRun(runId, (run) => run.result ? {
        ...run,
        result: {
          ...run.result,
          voices: run.result.voices.map((voice) => voice.id === voiceId ? { ...voice, argument: fullText, status: 'generating' } : voice),
        },
      } : run);
    });

    return {
      throttle,
      callbacks: {
        onControl: (handle: RunControlHandle) => {
          activeRunControlRef.current = handle;
        },
        onProgress: (progress: ActiveAnalysisRun['progress']) => updateActiveRun(runId, (run) => ({ ...run, status: progress.stage === 'done' ? run.status : 'running', progress })),
        onOutline: (outline: Parameters<typeof createPartialResult>[0]) => updateActiveRun(runId, (run) => {
          const pendingPlannedVoices = pendingPlannedVoicesRef.current;
          const pendingMagazineImages = pendingMagazineImagesRef.current;
          pendingPlannedVoicesRef.current = [];
          pendingMagazineImagesRef.current = {};
          const partialResult = createPartialResult(outline);
          const existingIds = new Set(partialResult.voices.map((voice) => voice.id));
          const voices = [
            ...partialResult.voices,
            ...pendingPlannedVoices.filter((voice) => !existingIds.has(voice.id)),
          ];
          const nextResult: AnalysisResult = {
            ...partialResult,
            voices,
            magazineImages: Object.keys(pendingMagazineImages).length > 0
              ? { ...(partialResult.magazineImages || {}), ...pendingMagazineImages }
              : partialResult.magazineImages,
          };
          const next: ActiveAnalysisRun = { ...run, status: 'running', result: nextResult, error: null };
          writeRunSnapshot(next, 'outline', continuationContext);
          return next;
        }),
        onRouteMap: (routeMap: NonNullable<AnalysisResult['routeMap']>) => updateActiveRun(runId, (run) => {
          if (!run.result) return run;
          const next: ActiveAnalysisRun = { ...run, result: { ...run.result, routeMap } };
          writeRunSnapshot(next, 'route', continuationContext);
          return next;
        }),
        onVoicePlanned: (voice: ThoughtVoice) => updateActiveRun(runId, (run) => {
          if (!run.result) {
            if (!pendingPlannedVoicesRef.current.some((item) => item.id === voice.id)) {
              pendingPlannedVoicesRef.current = [...pendingPlannedVoicesRef.current, voice];
            }
            return run;
          }
          if (run.result.voices.some((v) => v.id === voice.id)) return run;
          return {
            ...run,
            result: { ...run.result, voices: [...run.result.voices, voice] },
          };
        }),
        onVoiceStart: (voiceId: string) => updateActiveRun(runId, (run) => run.result ? {
          ...run,
          result: {
            ...run.result,
            voices: run.result.voices.map((voice) => voice.id === voiceId ? { ...voice, status: 'generating' } : voice),
          },
        } : run),
        onVoiceDelta: (voiceId: string, _delta: string, fullText: string) => throttle.schedule(voiceId, fullText),
        onVoiceStep: (voiceId: string) => throttle.flush(voiceId),
        onVoiceComplete: (voice: ThoughtVoice) => {
          throttle.clearOne(voice.id);
          updateActiveRun(runId, (run) => {
            if (!run.result) return run;
            const next: ActiveAnalysisRun = {
              ...run,
              result: {
                ...run.result,
                voices: run.result.voices.map((item) => item.id === voice.id ? voice : item),
              },
            };
            writeRunSnapshot(next, 'route', continuationContext);
            return next;
          });
        },
        onSynthesis: (partial: Partial<AnalysisResult>) => updateActiveRun(runId, (run) => {
          if (!run.result) return run;
          const next: ActiveAnalysisRun = { ...run, result: { ...run.result, ...partial } };
          writeRunSnapshot(next, 'synthesis', continuationContext);
          return next;
        }),
        onThoughtExperimentImage: (images) => updateActiveRun(runId, (run) => {
          if (!run.result?.thoughtExperiment) return run;
          const next: ActiveAnalysisRun = {
            ...run,
            result: {
              ...run.result,
              thoughtExperiment: { ...run.result.thoughtExperiment, ...images },
            },
          };
          writeRunSnapshot(next, checkpointStageForProgress(run.progress), continuationContext);
          return next;
        }),
        onMagazineImage: (slot, image) => updateActiveRun(runId, (run) => {
          if (!run.result) {
            pendingMagazineImagesRef.current = {
              ...pendingMagazineImagesRef.current,
              [slot]: image,
            };
            return run;
          }
          const next: ActiveAnalysisRun = {
            ...run,
            result: {
              ...run.result,
              magazineImages: {
                ...(run.result.magazineImages || {}),
                [slot]: image,
              },
            },
          };
          writeRunSnapshot(next, checkpointStageForProgress(run.progress), continuationContext);
          return next;
        }),
        onError: (message: string) => updateActiveRun(runId, (run) => ({ ...run, status: 'error', error: message, progress: progressForRunFailure(message) })),
        onLog: (entry: GenerationLogEntry) => updateActiveRunWithSnapshot(runId, (run) => appendRunLog(run, entry), continuationContext),
        onTokenUsage: (usage: TokenUsage) => recordTokenUsage(usage),
      },
    };
  }, [updateActiveRun, updateActiveRunWithSnapshot, writeRunSnapshot]);

  const completeRun = useCallback((runId: string, data: AnalysisResult, isPresetRegeneration?: boolean) => {
    const existingMagazineImages = activeRunRef.current?.runId === runId
      ? activeRunRef.current.result?.magazineImages
      : undefined;
    const pendingMagazineImages = pendingMagazineImagesRef.current;
    const mergedMagazineImages = {
      ...(existingMagazineImages || {}),
      ...pendingMagazineImages,
      ...(data.magazineImages || {}),
    };
    const completedResult: AnalysisResult = Object.keys(mergedMagazineImages).length > 0
      ? {
        ...data,
        magazineImages: mergedMagazineImages,
      }
      : data;
    pendingMagazineImagesRef.current = {};
    updateActiveRun(runId, (run) => ({
      ...run,
      status: 'completed',
      result: completedResult,
      progress: progressForCompletedResult({ result: completedResult }),
      error: null,
    }));
    void deleteRunSnapshot(runId);
    onRunComplete(completedResult, isPresetRegeneration);
  }, [onRunComplete, updateActiveRun]);

  const failRun = useCallback((runId: string, err: unknown, continuationContext?: ContinuationContext) => {
    const isCancel = err instanceof Error && err.name === 'AbortError';
    const message = isCancel ? '生成已取消。' : (err instanceof Error ? err.message : '发生了未知错误');
    updateActiveRun(runId, (run) => {
      const next: ActiveAnalysisRun = {
        ...run,
        status: isCancel ? 'cancelled' : 'error',
        error: message,
        progress: progressForRunFailure(message),
      };
      writeRunSnapshot(next, null, continuationContext);
      return next;
    });
  }, [updateActiveRun, writeRunSnapshot]);

  const startAnalysis = useCallback(async (nextTopic: string, continuationContext?: ContinuationContext, isPresetRegeneration = false) => {
    const trimmedTopic = nextTopic.trim();
    if (!trimmedTopic) return;
    if (activeRunIsRunning) {
      onRunOpen(activeRun?.topic || trimmedTopic);
      return;
    }

    const runId = createRunId();
    const createdAt = new Date().toISOString();
    pendingPlannedVoicesRef.current = [];
    pendingMagazineImagesRef.current = {};
    activeRunIdRef.current = runId;
    lastRunContextRef.current = { topic: trimmedTopic, continuationContext, isPresetRegeneration };
    onRunOpen(trimmedTopic);
    const initialRun: ActiveAnalysisRun = {
      runId,
      topic: trimmedTopic,
      createdAt,
      status: 'starting',
      result: null,
      progress: {
        stage: 'outline',
        totalVoices: 0,
        completedVoices: 0,
        messages: [continuationContext ? '正在沿着上一份分析继续展开...' : '正在把问题整理成一张思想地图...'],
      },
      error: null,
      isPresetRegeneration,
      log: [],
    };
    activeRunRef.current = initialRun;
    setActiveRun(initialRun);

    void saveRunSnapshot({
      runId,
      topic: trimmedTopic,
      createdAt,
      updatedAt: new Date().toISOString(),
      status: 'starting',
      lastCompletedStage: null,
      partialResult: null,
      continuationContext,
      isPresetRegeneration,
      log: [],
    });

    const { throttle, callbacks } = buildCallbacks(runId, continuationContext);

    try {
      const data = await analyzeTopic(trimmedTopic, callbacks, continuationContext);
      throttle.clearAll();
      completeRun(runId, data, isPresetRegeneration);
    } catch (err) {
      throttle.clearAll();
      failRun(runId, err, continuationContext);
    } finally {
      if (activeRunIdRef.current === runId) {
        activeRunControlRef.current = null;
      }
    }
  }, [activeRun?.topic, activeRunIsRunning, buildCallbacks, completeRun, createRunId, failRun, onRunOpen]);

  const resumeRun = useCallback(async (snap: RunSnapshot) => {
    if (activeRunIsRunning) {
      onRunOpen(activeRun?.topic || snap.topic);
      return;
    }
    onResumeAccepted();

    const { runId, topic: snapTopic, continuationContext, isPresetRegeneration } = snap;
    pendingPlannedVoicesRef.current = [];
    pendingMagazineImagesRef.current = {};
    activeRunIdRef.current = runId;
    lastRunContextRef.current = { topic: snapTopic, continuationContext, isPresetRegeneration };
    onRunOpen(snapTopic);
    const resumedRun: ActiveAnalysisRun = {
      runId,
      topic: snapTopic,
      createdAt: snap.createdAt,
      status: 'running',
      result: snap.partialResult,
      progress: progressForResume({ result: snap.partialResult }, snap.lastCompletedStage),
      error: null,
      isPresetRegeneration,
      log: snap.log,
    };
    activeRunRef.current = resumedRun;
    setActiveRun(resumedRun);

    const { throttle, callbacks } = buildCallbacks(runId, continuationContext);

    try {
      const data = await resumeAnalysis(snap, callbacks);
      throttle.clearAll();
      completeRun(runId, data, isPresetRegeneration);
    } catch (err) {
      throttle.clearAll();
      failRun(runId, err, continuationContext);
    } finally {
      if (activeRunIdRef.current === runId) {
        activeRunControlRef.current = null;
      }
    }
  }, [activeRun?.topic, activeRunIsRunning, buildCallbacks, completeRun, failRun, onResumeAccepted, onRunOpen]);

  const cancelActiveRun = useCallback(() => {
    activeRunControlRef.current?.cancel('用户取消生成');
    const runId = activeRunIdRef.current;
    if (!runId) return;
    updateActiveRun(runId, (run) => ({
      ...run,
      status: 'cancelled',
      error: '生成已取消。',
      progress: {
        ...(run.progress ?? { totalVoices: 0, completedVoices: 0, messages: [] }),
        stage: 'error',
        messages: ['生成已取消。已保留目前可见的内容。'],
      },
      log: appendRunLog(run, createGenerationLogEntry({
        level: 'warn',
        stage: 'meta',
        message: '用户取消了本次生成。',
      })).log,
    }));
  }, [updateActiveRun]);

  const skipActiveVoice = useCallback((voiceId: string) => {
    activeRunControlRef.current?.skipVoice(voiceId);
  }, []);

  const insertActiveVoice = useCallback((prompt: string) => {
    const seed: VoiceInsertSeed = { prompt };
    activeRunControlRef.current?.insertVoice(seed);
  }, []);

  const regenerateAll = useCallback((fallbackTopic: string) => {
    if (activeRunIsRunning) return;
    const ctx = lastRunContextRef.current;
    if (ctx) {
      void startAnalysis(ctx.topic, ctx.continuationContext, ctx.isPresetRegeneration);
      return;
    }
    const topic = activeRun?.topic || fallbackTopic;
    if (topic) void startAnalysis(topic);
  }, [activeRun?.topic, activeRunIsRunning, startAnalysis]);

  return {
    activeRun,
    setActiveRun,
    activeRunIsRunning,
    canRegenerateFromContext: !!(lastRunContextRef.current || activeRun?.topic),
    startAnalysis,
    resumeRun,
    cancelActiveRun,
    skipActiveVoice,
    insertActiveVoice,
    regenerateAll,
  };
};
