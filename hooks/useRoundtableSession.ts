/**
 * useRoundtableSession
 * --------------------
 * React hook that owns one live roundtable session's state machine and
 * bridges it to the service layer (`services/roundtableService`).
 *
 * Responsibilities:
 * - Track current session (planning → seating → running → closing → completed).
 * - Stream turn deltas into transcript state with minimal re-render churn.
 * - Expose moderator controls: start, cancel, pause, interject, close.
 * - Persist the session to localStorage + IDB via `roundtableStore` at every
 *   stage boundary so a reload doesn't lose the transcript.
 *
 * The hook never renders anything — UI components consume the returned
 * shape through destructuring. A single `roundtableCallbacks` instance is
 * reused across service calls to guarantee the same state setters are hit
 * regardless of which helper the UI triggers.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  GenerationLogEntry,
  RoundtableCallbacks,
  RoundtableInterjectionSeed,
  RoundtableSession,
  RoundtableTurn,
  TokenUsage,
} from '../types';
import {
  appendModeratorLine,
  appendUserInterjection,
  closeRoundtableSession,
  generateNextRoundtableTurn,
  generateRoundtableAvatars,
  planRoundtableSession,
  regenerateRoundtableAvatar,
} from '../services/roundtableService';
import { interjectionActionLabel } from '../services/roundtablePrompts';
import {
  findRoundtableSession,
  hydrateRoundtableSession,
  saveRoundtableSession,
} from '../services/roundtableStore';
import { appendCappedLog } from '../utils/generationLog';
import {
  chooseInterjectionSpeaker,
  mergeRoundtableSessions,
} from '../utils/roundtableFlow';

export interface UseRoundtableSessionReturn {
  session: RoundtableSession | null;
  setSession: (session: RoundtableSession | null) => void;
  log: GenerationLogEntry[];
  tokenUsage: TokenUsage[];
  status: RoundtableSession['status'] | 'idle';
  isBusy: boolean;
  canInterject: boolean;
  pendingInterjection: RoundtableInterjectionSeed | null;
  currentTurnId: string | null;
  error: string | null;
  /** Plan + seating + scripted full run in one shot. */
  start: (topic: string) => Promise<void>;
  /** Load an existing session from storage (for /roundtable/:id). */
  load: (sessionId: string) => Promise<void>;
  /** Moderator inserts an interjection; the auto-run folds it into the next available turn. */
  submitInterjection: (input: RoundtableInterjectionSeed) => Promise<void>;
  /** Force the closing minutes now (skipping remaining scheduled turns). */
  closeNow: () => Promise<void>;
  /** Abort every in-flight request. */
  cancel: () => void;
  /** Re-run the avatar call for one seat. */
  regenerateAvatar: (participantId: string) => Promise<void>;
  /** Clear the local draft so the UI returns to the idle entry view. */
  reset: () => void;
}

export const useRoundtableSession = (): UseRoundtableSessionReturn => {
  const [session, setSessionState] = useState<RoundtableSession | null>(null);
  const [log, setLog] = useState<GenerationLogEntry[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [pendingInterjection, setPendingInterjection] = useState<RoundtableInterjectionSeed | null>(null);

  /** Latest session snapshot — read inside async helpers where stale state would bite us. */
  const sessionRef = useRef<RoundtableSession | null>(null);
  /** Live abort controller for any running request. Reset on start/cancel. */
  const abortRef = useRef<AbortController | null>(null);
  /** Avatar regeneration should not share the run abort controller. */
  const avatarAbortRef = useRef<AbortController | null>(null);
  /** Pause flag set by `pauseAfterCurrentTurn`. */
  const pausedRef = useRef(false);
  const isBusyRef = useRef(false);
  const activeRunTokenRef = useRef(0);
  const interjectionQueueRef = useRef<Array<RoundtableInterjectionSeed & { turnId: string }>>([]);

  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { isBusyRef.current = isBusy; }, [isBusy]);

  const setSession = useCallback((next: RoundtableSession | null) => {
    sessionRef.current = next;
    setSessionState(next);
  }, []);

  const persist = useCallback(async (next: RoundtableSession | null) => {
    if (!next) return;
    try {
      await saveRoundtableSession(next);
    } catch (persistError) {
      // eslint-disable-next-line no-console
      console.warn('[sophia][roundtable] failed to persist session:', persistError);
    }
  }, []);

  const commitSession = useCallback((next: RoundtableSession, shouldPersist = true): RoundtableSession => {
    const merged = mergeRoundtableSessions(sessionRef.current, next);
    sessionRef.current = merged;
    setSessionState(merged);
    if (shouldPersist) void persist(merged);
    return merged;
  }, [persist]);

  const buildCallbacks = useCallback((token?: number): RoundtableCallbacks => {
    const isCurrent = () => token === undefined || activeRunTokenRef.current === token;
    return {
      onSession: (next) => {
        if (!isCurrent()) return;
        commitSession(next);
      },
      onParticipantUpdate: (participant) => {
        if (!isCurrent()) return;
        setSessionState((prev) => {
          if (!prev) return prev;
          const merged = mergeRoundtableSessions(prev, {
            ...prev,
            participants: prev.participants.map((p) => (p.id === participant.id ? participant : p)),
            updatedAt: new Date().toISOString(),
          });
          sessionRef.current = merged;
          return merged;
        });
      },
      onTurnStart: (turn) => {
        if (!isCurrent()) return;
        setCurrentTurnId(turn.id);
        setSessionState((prev) => {
          if (!prev) return prev;
          const turns = prev.turns.some((existing) => existing.id === turn.id)
            ? prev.turns.map((existing) => (existing.id === turn.id ? turn : existing))
            : [...prev.turns, turn];
          const merged: RoundtableSession = {
            ...prev,
            turns,
            updatedAt: new Date().toISOString(),
          };
          sessionRef.current = merged;
          return merged;
        });
      },
      onTurnDelta: (turnId, _delta, fullText) => {
        if (!isCurrent()) return;
        setSessionState((prev) => {
          if (!prev) return prev;
          const index = prev.turns.findIndex((t) => t.id === turnId);
          if (index < 0) return prev;
          const turn = prev.turns[index];
          if (turn.content === fullText) return prev;
          const updated = { ...turn, content: fullText, status: 'streaming' as const };
          const turns = prev.turns.slice();
          turns[index] = updated;
          const merged = { ...prev, turns, updatedAt: new Date().toISOString() };
          sessionRef.current = merged;
          return merged;
        });
      },
      onTurnComplete: (turn) => {
        if (!isCurrent()) return;
        setCurrentTurnId((curr) => (curr === turn.id ? null : curr));
        setSessionState((prev) => {
          if (!prev) return prev;
          const index = prev.turns.findIndex((t) => t.id === turn.id);
          let turns: RoundtableTurn[];
          if (index >= 0) {
            turns = prev.turns.slice();
            turns[index] = turn;
          } else {
            turns = [...prev.turns, turn];
          }
          const merged = { ...prev, turns, updatedAt: new Date().toISOString() };
          sessionRef.current = merged;
          return merged;
        });
      },
      onMinutes: () => {
        // nothing — onSession already carries the updated minutes/summary
      },
      onError: (message) => {
        if (isCurrent()) setError(message);
      },
      onTokenUsage: (usage) => {
        if (isCurrent()) setTokenUsage((prev) => prev.concat(usage));
      },
      onLog: (entry) => {
        if (isCurrent()) setLog((prev) => appendCappedLog(prev, entry));
      },
    };
  }, [commitSession]);

  const scriptedRun = useCallback(async (
    seated: RoundtableSession,
    callbacks: RoundtableCallbacks,
    signal: AbortSignal,
  ) => {
    let current: RoundtableSession = seated;

    const latest = () => {
      const live = sessionRef.current;
      if (live?.id === current.id) {
        current = mergeRoundtableSessions(current, live);
      }
      return current;
    };

    const drainInterjections = async (): Promise<boolean> => {
      while (!signal.aborted && interjectionQueueRef.current.length > 0) {
        const queued = interjectionQueueRef.current[0];
        setPendingInterjection(queued);
        current = latest();

        if (queued.action === 'close') {
          interjectionQueueRef.current = [];
          setPendingInterjection(null);
          current = { ...current, status: 'closing', updatedAt: new Date().toISOString() };
          callbacks.onSession?.(current);
          current = await closeRoundtableSession(current, callbacks, signal);
          current = latest();
          return true;
        }

        const { participantId, replyToParticipantId } = chooseInterjectionSpeaker(current, queued);
        if (!participantId) {
          interjectionQueueRef.current.shift();
          setPendingInterjection(interjectionQueueRef.current[0] || null);
          continue;
        }

        const { session: next } = await generateNextRoundtableTurn(current, {
          phase: 'response',
          participantId,
          replyToParticipantId,
          userInterjectionTurnId: queued.turnId,
          action: queued.action,
        }, callbacks, signal);
        const liveAfterInterjection = sessionRef.current;
        current = liveAfterInterjection?.id === next.id
          ? mergeRoundtableSessions(next, liveAfterInterjection)
          : next;
        interjectionQueueRef.current.shift();
        setPendingInterjection(interjectionQueueRef.current[0] || null);
      }
      return false;
    };

    const runStage = async (
      phase: 'opening' | 'response' | 'conflict',
      items: Array<{ participantId: string; replyToParticipantId?: string; moderatorText?: string }>,
    ): Promise<boolean> => {
      for (const item of items) {
        if (signal.aborted || pausedRef.current) return false;
        if (await drainInterjections()) return true;
        if (item.moderatorText) {
          current = latest();
          const inserted = appendModeratorLine(current, item.moderatorText, phase);
          current = inserted.session;
          callbacks.onSession?.(current);
          callbacks.onTurnComplete?.(inserted.turn);
        }
        const { session: next } = await generateNextRoundtableTurn(current, {
          phase,
          participantId: item.participantId,
          replyToParticipantId: item.replyToParticipantId,
        }, callbacks, signal);
        current = next;
        current = latest();
        if (await drainInterjections()) return true;
      }
      return false;
    };

    const openingItems = current.participants.map((p) => ({
      participantId: p.id,
      moderatorText: `请 ${p.name} 作开场陈述，说明你在这个问题上的立场和理由。`,
    }));
    if (await runStage('opening', openingItems)) return current;
    if (signal.aborted || pausedRef.current) return current;

    const order = current.participants.map((p) => p.id);
    const responseItems = order.map((id, index) => {
      const target = order[(index + order.length - 1) % order.length];
      const replier = current.participants.find((p) => p.id === id)?.name || '参会者';
      const targetName = current.participants.find((p) => p.id === target)?.name || '参会者';
      return {
        participantId: id,
        replyToParticipantId: target,
        moderatorText: `${replier}，请对 ${targetName} 刚才的发言作一次明确的回应。`,
      };
    });
    if (await runStage('response', responseItems)) return current;
    if (signal.aborted || pausedRef.current) return current;

    const [first, second] = current.participants;
    if (first && second) {
      if (await runStage('conflict', [
        {
          participantId: first.id,
          replyToParticipantId: second.id,
          moderatorText: `我想把焦点放在一处真正的分歧上：${current.coreQuestion}。${first.name}，请先推进这个分歧。`,
        },
        { participantId: second.id, replyToParticipantId: first.id },
      ])) return current;
    }

    return current;
  }, []);

  const start = useCallback(async (topic: string) => {
    if (isBusyRef.current) return;
    const token = activeRunTokenRef.current + 1;
    activeRunTokenRef.current = token;
    const runCallbacks = buildCallbacks(token);
    setIsBusy(true);
    setError(null);
    setLog([]);
    setTokenUsage([]);
    setCurrentTurnId(null);
    setPendingInterjection(null);
    interjectionQueueRef.current = [];
    pausedRef.current = false;
    abortRef.current?.abort();
    const runController = new AbortController();
    abortRef.current = runController;

    try {
      let current = await planRoundtableSession(topic, runCallbacks, runController.signal);
      if (activeRunTokenRef.current !== token) return;
      await persist(current);

      current = await generateRoundtableAvatars(current, runCallbacks, runController.signal);
      if (activeRunTokenRef.current !== token) return;
      await persist(current);

      current = (await scriptedRun(current, runCallbacks, runController.signal)) || current;
      if (activeRunTokenRef.current !== token) return;
      current = sessionRef.current?.id === current.id ? mergeRoundtableSessions(current, sessionRef.current) : current;
      if (current.status === 'completed') {
        await persist(current);
        return;
      }
      if (runController.signal.aborted) {
        const cancelled: RoundtableSession = { ...current, status: 'cancelled', updatedAt: new Date().toISOString() };
        setSession(cancelled);
        await persist(cancelled);
        return;
      }
      if (pausedRef.current) {
        await persist(current);
        return;
      }

      current = sessionRef.current?.id === current.id ? mergeRoundtableSessions(current, sessionRef.current) : current;
      current = { ...current, status: 'closing', updatedAt: new Date().toISOString() };
      runCallbacks.onSession?.(current);
      current = await closeRoundtableSession(current, runCallbacks, runController.signal);
      await persist(current);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      if (activeRunTokenRef.current === token) setError(message);
      if (activeRunTokenRef.current === token && runController.signal.aborted && sessionRef.current) {
        const cancelled: RoundtableSession = { ...sessionRef.current, status: 'cancelled', updatedAt: new Date().toISOString() };
        setSession(cancelled);
        await persist(cancelled);
      }
    } finally {
      if (activeRunTokenRef.current === token) {
        setIsBusy(false);
        setPendingInterjection(null);
        interjectionQueueRef.current = [];
      }
    }
  }, [buildCallbacks, persist, scriptedRun, setSession]);

  const load = useCallback(async (sessionId: string) => {
    activeRunTokenRef.current += 1;
    abortRef.current?.abort(new DOMException('load roundtable session', 'AbortError'));
    avatarAbortRef.current?.abort(new DOMException('load roundtable session', 'AbortError'));
    interjectionQueueRef.current = [];
    setPendingInterjection(null);
    setIsBusy(false);
    setError(null);
    const stored = findRoundtableSession(sessionId);
    if (!stored) {
      setSession(null);
      return;
    }
    const hydrated = await hydrateRoundtableSession(stored);
    setSession(hydrated);
    setLog([]);
    setTokenUsage([]);
    setCurrentTurnId(null);
  }, [setSession]);

  const closeNow = useCallback(async () => {
    const current = sessionRef.current;
    if (!current || isBusyRef.current || current.status === 'completed') return;
    const token = activeRunTokenRef.current + 1;
    activeRunTokenRef.current = token;
    const callbacks = buildCallbacks(token);
    setIsBusy(true);
    setError(null);
    pausedRef.current = true;
    abortRef.current?.abort(new DOMException('closing roundtable', 'AbortError'));
    const closeController = new AbortController();
    abortRef.current = closeController;
    try {
      const closing: RoundtableSession = { ...current, status: 'closing', updatedAt: new Date().toISOString() };
      callbacks.onSession?.(closing);
      const closed = await closeRoundtableSession(closing, callbacks, closeController.signal);
      if (activeRunTokenRef.current !== token) return;
      await persist(closed);
    } catch (closeError) {
      const message = closeError instanceof Error ? closeError.message : String(closeError);
      if (activeRunTokenRef.current === token) setError(message);
    } finally {
      if (activeRunTokenRef.current === token) setIsBusy(false);
    }
  }, [buildCallbacks, persist]);

  const processQueuedInterjectionNow = useCallback(async () => {
    const current = sessionRef.current;
    const queued = interjectionQueueRef.current[0];
    if (!current || !queued || isBusyRef.current) return;

    if (queued.action === 'close') {
      interjectionQueueRef.current.shift();
      setPendingInterjection(interjectionQueueRef.current[0] || null);
      await closeNow();
      return;
    }

    const token = activeRunTokenRef.current + 1;
    activeRunTokenRef.current = token;
    const callbacks = buildCallbacks(token);
    setIsBusy(true);
    setError(null);
    const turnController = new AbortController();
    abortRef.current = turnController;
    pausedRef.current = false;
    setPendingInterjection(queued);

    try {
      const { participantId, replyToParticipantId } = chooseInterjectionSpeaker(current, queued);
      if (!participantId) {
        interjectionQueueRef.current.shift();
        setPendingInterjection(interjectionQueueRef.current[0] || null);
        return;
      }
      const { session: next } = await generateNextRoundtableTurn(current, {
        phase: 'response',
        participantId,
        replyToParticipantId,
        userInterjectionTurnId: queued.turnId,
        action: queued.action,
      }, callbacks, turnController.signal);
      if (activeRunTokenRef.current !== token) return;
      await persist(sessionRef.current?.id === next.id ? sessionRef.current : next);
      interjectionQueueRef.current.shift();
      setPendingInterjection(interjectionQueueRef.current[0] || null);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError);
      if (activeRunTokenRef.current === token) setError(message);
    } finally {
      if (activeRunTokenRef.current === token) setIsBusy(false);
    }
  }, [buildCallbacks, closeNow, persist]);

  const submitInterjection = useCallback(async (input: RoundtableInterjectionSeed) => {
    const current = sessionRef.current;
    if (!current || current.status !== 'running') return;
    if (interjectionQueueRef.current.length > 0) return;

    const trimmed = input.content.trim();
    if (!trimmed && input.action !== 'close') return;
    const normalized: RoundtableInterjectionSeed = {
      ...input,
      content: input.action === 'close'
        ? (trimmed || '主持人请求直接收束会议。')
        : trimmed,
    };

    const note = appendModeratorLine(current, `主持人记下：${interjectionActionLabel(normalized.action)} — “${normalized.content}”`, 'response');
    const { session: updated, turn } = appendUserInterjection(note.session, normalized);
    commitSession(updated);
    interjectionQueueRef.current.push({ ...normalized, turnId: turn.id });
    setPendingInterjection(interjectionQueueRef.current[0] || null);

    if (!isBusyRef.current) {
      await processQueuedInterjectionNow();
    }
  }, [commitSession, processQueuedInterjectionNow]);

  const cancel = useCallback(() => {
    activeRunTokenRef.current += 1;
    abortRef.current?.abort(new DOMException('用户取消', 'AbortError'));
    pausedRef.current = true;
    interjectionQueueRef.current = [];
    setPendingInterjection(null);
    if (sessionRef.current) {
      const cancelled: RoundtableSession = { ...sessionRef.current, status: 'cancelled', updatedAt: new Date().toISOString() };
      setSession(cancelled);
      void persist(cancelled);
    }
    setIsBusy(false);
  }, [persist, setSession]);

  const regenerateAvatar = useCallback(async (participantId: string) => {
    const current = sessionRef.current;
    if (!current) return;
    avatarAbortRef.current?.abort(new DOMException('restart avatar regeneration', 'AbortError'));
    const controller = new AbortController();
    avatarAbortRef.current = controller;
    const callbacks = buildCallbacks();
    try {
      const next = await regenerateRoundtableAvatar(current, participantId, callbacks, controller.signal);
      await persist(next);
    } catch (regenError) {
      const message = regenError instanceof Error ? regenError.message : String(regenError);
      setError(message);
    }
  }, [buildCallbacks, persist]);

  const reset = useCallback(() => {
    activeRunTokenRef.current += 1;
    abortRef.current?.abort();
    avatarAbortRef.current?.abort();
    pausedRef.current = false;
    abortRef.current = null;
    avatarAbortRef.current = null;
    interjectionQueueRef.current = [];
    const current = sessionRef.current;
    if (current && ['planning', 'seating', 'running', 'closing'].includes(current.status)) {
      void persist({ ...current, status: 'cancelled', updatedAt: new Date().toISOString() });
    }
    setSession(null);
    setLog([]);
    setTokenUsage([]);
    setCurrentTurnId(null);
    setPendingInterjection(null);
    setIsBusy(false);
    setError(null);
  }, [persist, setSession]);

  useEffect(() => () => {
    activeRunTokenRef.current += 1;
    abortRef.current?.abort(new DOMException('roundtable unmounted', 'AbortError'));
    avatarAbortRef.current?.abort(new DOMException('roundtable unmounted', 'AbortError'));
    const current = sessionRef.current;
    if (current && ['planning', 'seating', 'running', 'closing'].includes(current.status)) {
      void saveRoundtableSession({ ...current, status: 'cancelled', updatedAt: new Date().toISOString() });
    }
  }, []);

  const canInterject = Boolean(
    session?.status === 'running'
    && interjectionQueueRef.current.length === 0
    && !pendingInterjection,
  );

  return {
    session,
    setSession,
    log,
    tokenUsage,
    status: session?.status || 'idle',
    isBusy,
    canInterject,
    pendingInterjection,
    currentTurnId,
    error,
    start,
    load,
    submitInterjection,
    closeNow,
    cancel,
    regenerateAvatar,
    reset,
  };
};
