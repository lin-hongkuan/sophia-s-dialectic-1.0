import React from 'react';
import type { RoundtableSession, RoundtableTurn } from '../types';
import RoundtableSeat from './RoundtableSeat';

interface RoundtableRoomProps {
  session: RoundtableSession;
  /**
   * The participant currently holding the floor, derived from the last
   * streaming participant turn. Used to light up the seat + draw the
   * focus ring on the table.
   */
  currentSpeakerId?: string | null;
  /**
   * If present, the seat the current speaker is replying to. Surfaces
   * a small "回应 X" tag under the speaker and a dashed line on the table.
   */
  replyToId?: string | null;
  regeneratingAvatarId?: string | null;
  onRegenerateAvatar?: (participantId: string) => void;
}

/**
 * Derive the speaker / reply ids from the transcript when the caller
 * didn't provide them explicitly.
 */
const deriveFocus = (
  turns: RoundtableTurn[],
): { speakerId?: string; replyToId?: string } => {
  const last = [...turns].reverse().find((turn) => turn.kind === 'participant');
  return {
    speakerId: last?.participantId,
    replyToId: last?.replyToParticipantId,
  };
};

const RoundtableRoom: React.FC<RoundtableRoomProps> = ({
  session,
  currentSpeakerId,
  replyToId,
  regeneratingAvatarId,
  onRegenerateAvatar,
}) => {
  const derived = deriveFocus(session.turns);
  const speakerId = currentSpeakerId === undefined ? (derived.speakerId ?? null) : currentSpeakerId;
  const activeReplyId = replyToId === undefined ? (derived.replyToId ?? null) : replyToId;

  const participants = session.participants.slice(0, 4);
  const nameById = new Map(participants.map((p) => [p.id, p.name] as const));

  return (
    <div className="relative w-full">
      {/* paper-grid backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-70" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(44,42,38,0.06) 1px, transparent 1px),' +
              'linear-gradient(to bottom, rgba(44,42,38,0.06) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            backgroundPosition: '0 0',
          }}
        />
      </div>

      {/* the round table, rendered as an inner plate; decorative only */}
      <div className="relative mx-auto mb-6 flex aspect-[16/6] w-full max-w-3xl items-center justify-center md:mb-8" aria-hidden="true">
        <div className="absolute inset-x-[12%] inset-y-0 border border-museum-300/70 bg-white/55 shadow-inner backdrop-blur-sm" />
        <div className="absolute inset-x-[14%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-museum-400/60 to-transparent" />
        <div className="relative z-10 text-center">
          <p className="notranslate font-mono text-[10px] uppercase tracking-[0.28em] text-museum-500" translate="no">
            Roundtable
          </p>
          <p className="mt-2 font-serif text-base italic text-museum-600 md:text-lg">
            围绕「{session.coreQuestion || session.title}」
          </p>
          {speakerId && (
            <p className="mt-2 text-[11px] font-mono uppercase tracking-[0.22em] text-museum-500">
              <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-museum-800 align-middle" />
              现任发言 · {nameById.get(speakerId) || ''}
              {activeReplyId && (
                <span className="ml-2 text-museum-400">→ 回应 {nameById.get(activeReplyId) || ''}</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* seat grid — 2×2 on desktop, single column on mobile */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        {participants.map((participant, index) => (
          <RoundtableSeat
            key={participant.id}
            participant={participant}
            index={index}
            isSpeaking={participant.id === speakerId}
            replyToName={participant.id === speakerId && activeReplyId ? nameById.get(activeReplyId) : undefined}
            isRegeneratingAvatar={regeneratingAvatarId === participant.id}
            onRegenerateAvatar={onRegenerateAvatar}
          />
        ))}
      </div>
    </div>
  );
};

export default RoundtableRoom;
