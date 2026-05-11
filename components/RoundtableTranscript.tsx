import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, Pin, PinOff } from 'lucide-react';
import type { RoundtableSession, RoundtableTurn } from '../types';
import { interjectionActionLabel } from '../services/roundtablePrompts';

interface RoundtableTranscriptProps {
  session: RoundtableSession;
  /** The id of the turn that is currently streaming, if any. */
  currentTurnId?: string | null;
  /** Global busy flag from the hook — drives the pulse on the pinned marker. */
  isBusy?: boolean;
}

const PHASE_LABEL: Record<RoundtableTurn['phase'], string> = {
  opening: '第一幕 · 开场陈述',
  response: '第二幕 · 交锋回应',
  conflict: '第三幕 · 分歧聚焦',
  closing: '第四幕 · 主持人纪要',
};

const PHASE_ORDER: RoundtableTurn['phase'][] = ['opening', 'response', 'conflict', 'closing'];

type GroupedTurns = Array<{ phase: RoundtableTurn['phase']; turns: RoundtableTurn[] }>;

const groupByPhase = (turns: RoundtableTurn[]): GroupedTurns => {
  const groups = new Map<RoundtableTurn['phase'], RoundtableTurn[]>();
  for (const turn of turns) {
    if (!groups.has(turn.phase)) groups.set(turn.phase, []);
    groups.get(turn.phase)!.push(turn);
  }
  return PHASE_ORDER
    .filter((phase) => groups.has(phase))
    .map((phase) => ({ phase, turns: groups.get(phase)! }));
};

const RoundtableTranscript: React.FC<RoundtableTranscriptProps> = ({
  session,
  currentTurnId,
  isBusy,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const participantById = useMemo(
    () => new Map(session.participants.map((p) => [p.id, p] as const)),
    [session.participants],
  );
  const groups = useMemo(() => groupByPhase(session.turns), [session.turns]);
  const transcriptVersion = useMemo(
    () => session.turns.map((turn) => `${turn.id}:${turn.status}:${turn.content.length}`).join('|'),
    [session.turns],
  );

  // Auto-scroll to bottom on new turns / deltas — unless the user paused it.
  useEffect(() => {
    if (!autoScroll) return;
    const node = containerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [transcriptVersion, currentTurnId, autoScroll]);

  // Re-enable auto-scroll when the user scrolls back to near the bottom.
  const handleScroll = () => {
    const node = containerRef.current;
    if (!node) return;
    const delta = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (delta > 96 && autoScroll) setAutoScroll(false);
    if (delta < 48 && !autoScroll) setAutoScroll(true);
  };

  const renderTurn = (turn: RoundtableTurn) => {
    const isStreaming = turn.status === 'streaming' || turn.id === currentTurnId;
    const isFailed = turn.status === 'failed';

    if (turn.kind === 'moderator') {
      return (
        <div className="flex gap-3 md:gap-4">
          <div className="w-14 shrink-0 pt-1 text-right md:w-16">
            <span className="notranslate font-mono text-[9px] uppercase tracking-[0.22em] text-museum-400" translate="no">
              主持人
            </span>
          </div>
          <blockquote className="flex-1 border-l-2 border-museum-300 bg-museum-50/45 px-4 py-3 text-[13px] italic leading-relaxed text-museum-700 md:text-sm">
            {turn.content || <span className="text-museum-400">…</span>}
          </blockquote>
        </div>
      );
    }

    if (turn.kind === 'user_interjection') {
      const target = turn.targetParticipantId ? participantById.get(turn.targetParticipantId) : undefined;
      return (
        <div className="flex gap-3 md:gap-4">
          <div className="w-14 shrink-0 pt-1 text-right md:w-16">
            <span className="notranslate inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-amber-800" translate="no">
              你
            </span>
          </div>
          <div className="flex-1 border border-amber-200 bg-amber-50/60 p-3 text-[13px] leading-relaxed text-amber-900 md:p-4 md:text-sm">
            <p className="mb-1 text-[10px] font-mono uppercase tracking-[0.22em] text-amber-800/80">
              主持人身份 · {turn.action ? interjectionActionLabel(turn.action) : '追问'}
              {target && <span className="ml-2 text-amber-700">→ {target.name}</span>}
            </p>
            <p>{turn.content}</p>
          </div>
        </div>
      );
    }

    if (turn.kind === 'minutes') {
      return (
        <div className="mt-2 rounded-sm border border-museum-900 bg-museum-900 p-4 text-museum-50 shadow-lg md:p-5">
          <p className="notranslate mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-museum-300" translate="no">
            Closing Minutes
          </p>
          <div className="whitespace-pre-line font-serif text-[13px] leading-relaxed md:text-sm">
            {turn.content}
          </div>
        </div>
      );
    }

    const speaker = turn.participantId ? participantById.get(turn.participantId) : undefined;
    const replyTo = turn.replyToParticipantId ? participantById.get(turn.replyToParticipantId) : undefined;
    const avatarUrl = speaker?.avatar?.imageUrl || '';

    return (
      <div className="flex gap-3 md:gap-4">
        <div className="w-14 shrink-0 md:w-16">
          <div className="h-14 w-14 overflow-hidden rounded-sm border border-museum-200 bg-museum-50 shadow-sm md:h-16 md:w-16">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={speaker?.name || ''}
                className="h-full w-full object-cover [filter:saturate(0.86)_contrast(0.95)]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center font-serif text-museum-700" style={{ background: 'linear-gradient(135deg,#F2F0EB,#D1CCC0)' }} aria-hidden="true">
                {(speaker?.name || '?').slice(0, 1)}
              </div>
            )}
          </div>
        </div>
        <div
          className={`flex-1 border bg-white/85 p-3 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(44,42,38,0.04)] transition-all md:p-4 ${
            isFailed
              ? 'border-red-200 bg-red-50/70'
              : isStreaming
                ? 'border-museum-900 ring-1 ring-museum-300/30'
                : 'border-museum-200'
          }`}
        >
          <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-serif text-base text-museum-900 md:text-lg">{speaker?.name || '参会者'}</span>
            {replyTo && (
              <span className="inline-flex items-center gap-1 border border-museum-200 bg-museum-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-600">
                回应 {replyTo.name}
              </span>
            )}
            {turn.action && (
              <span className="inline-flex items-center gap-1 border border-museum-200 bg-museum-50 px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-500">
                {interjectionActionLabel(turn.action)}
              </span>
            )}
            {isStreaming && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-500">
                <Loader2 className="h-3 w-3 animate-spin" /> streaming
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.22em] text-red-700">
                <AlertCircle className="h-3 w-3" /> failed
              </span>
            )}
          </div>
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-museum-800 md:text-[14.5px]">
            {turn.content || <span className="text-museum-400">…</span>}
            {isStreaming && turn.content && <span className="ml-0.5 inline-block w-1.5 animate-pulse bg-museum-400 align-middle" style={{ height: '0.9em' }} aria-hidden="true" />}
          </p>
          {isFailed && turn.error && (
            <p className="mt-2 text-xs text-red-700">{turn.error}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="relative flex h-full w-full flex-col overflow-hidden rounded-sm border border-museum-200 bg-white/75 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(44,42,38,0.04)] backdrop-blur-sm">
      <header className="flex items-center justify-between border-b border-museum-200/80 bg-museum-50/60 px-4 py-3 md:px-5">
        <div>
          <p className="notranslate font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
            Transcript
          </p>
          <p className="mt-0.5 font-serif text-sm text-museum-700 md:text-base">
            {session.turns.filter((t) => t.kind === 'participant').length} 段参会者发言
            {isBusy && <span className="ml-2 text-museum-500">· 仍在进行中</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAutoScroll((prev) => !prev)}
          title={autoScroll ? '暂停自动滚动' : '恢复自动滚动'}
          className="inline-flex items-center gap-1.5 border border-museum-300 bg-white/80 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-museum-600 shadow-sm transition-colors hover:bg-white"
        >
          {autoScroll ? <Pin className="h-3 w-3" /> : <PinOff className="h-3 w-3" />}
          {autoScroll ? '自动滚动' : '已暂停'}
        </button>
      </header>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6"
        style={{ maxHeight: 'min(70vh, 720px)', minHeight: 320 }}
      >
        {groups.length === 0 && (
          <p className="text-sm italic text-museum-500">等待主持人开场……</p>
        )}

        {groups.map(({ phase, turns }) => (
          <div key={phase} className="mb-8 last:mb-0 animate-section-in">
            <div className="mb-4 flex items-center gap-3 md:mb-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-museum-500">
                {PHASE_LABEL[phase]}
              </span>
              <span className="h-px flex-1 bg-gradient-to-r from-museum-300/80 via-museum-300/40 to-transparent" />
            </div>
            <ol className="flex flex-col gap-4 md:gap-5">
              {turns.map((turn) => (
                <li key={turn.id}>{renderTurn(turn)}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RoundtableTranscript;
