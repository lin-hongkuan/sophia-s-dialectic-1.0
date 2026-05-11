import type { RoundtableInterjectionSeed, RoundtableParticipant, RoundtableSession, RoundtableTurn } from '../types';

const activeStatuses = new Set<RoundtableTurn['status']>(['queued', 'streaming']);

const mergeAvatar = (
  prev: RoundtableParticipant['avatar'],
  next: RoundtableParticipant['avatar'],
): RoundtableParticipant['avatar'] => {
  if (!prev) return next;
  if (!next) return prev;
  return {
    ...prev,
    ...next,
    imageUrl: next.imageUrl || (next.status === 'failed' ? '' : prev.imageUrl),
  };
};

/**
 * Service helpers often resolve from an older session snapshot while the UI may
 * have already inserted a moderator/user interjection. Merge by turn id so late
 * service callbacks update their own turn without dropping newer transcript rows.
 */
export const mergeRoundtableSessions = (
  prev: RoundtableSession | null,
  next: RoundtableSession,
): RoundtableSession => {
  if (!prev || prev.id !== next.id) return next;

  const nextTurnsById = new Map(next.turns.map((turn) => [turn.id, turn] as const));
  const seenTurns = new Set<string>();
  const turns = prev.turns.map((turn) => {
    seenTurns.add(turn.id);
    return nextTurnsById.get(turn.id) || turn;
  });
  for (const turn of next.turns) {
    if (!seenTurns.has(turn.id)) turns.push(turn);
  }

  const prevParticipants = new Map(prev.participants.map((participant) => [participant.id, participant] as const));
  const participants = next.participants.map((participant) => {
    const previous = prevParticipants.get(participant.id);
    if (!previous) return participant;
    return {
      ...previous,
      ...participant,
      avatar: mergeAvatar(previous.avatar, participant.avatar),
    };
  });

  return {
    ...prev,
    ...next,
    participants,
    turns,
  };
};

export const activeRoundtableTurn = (
  session: RoundtableSession | null,
  currentTurnId?: string | null,
): RoundtableTurn | null => {
  if (!session) return null;
  if (currentTurnId) {
    const current = session.turns.find((turn) => turn.id === currentTurnId);
    if (current?.kind === 'participant' && activeStatuses.has(current.status)) {
      return current;
    }
  }
  return [...session.turns]
    .reverse()
    .find((turn) => turn.kind === 'participant' && activeStatuses.has(turn.status)) || null;
};

export const roundtableFocus = (
  session: RoundtableSession | null,
  currentTurnId?: string | null,
): { speakerId: string | null; replyToId: string | null } => {
  const turn = activeRoundtableTurn(session, currentTurnId);
  return {
    speakerId: turn?.participantId || null,
    replyToId: turn?.replyToParticipantId || null,
  };
};

export const chooseInterjectionSpeaker = (
  session: RoundtableSession,
  input: Pick<RoundtableInterjectionSeed, 'targetParticipantId' | 'action'>,
): { participantId: string | null; replyToParticipantId?: string } => {
  const participants = session.participants.filter((participant) => participant.status !== 'failed');
  if (participants.length === 0) return { participantId: null };

  const lastParticipantTurn = [...session.turns]
    .reverse()
    .find((turn) => turn.kind === 'participant' && turn.participantId);

  const explicitTarget = input.targetParticipantId
    ? participants.find((participant) => participant.id === input.targetParticipantId)
    : undefined;

  let speaker = explicitTarget;
  if (!speaker) {
    const lastIndex = lastParticipantTurn?.participantId
      ? participants.findIndex((participant) => participant.id === lastParticipantTurn.participantId)
      : -1;
    speaker = participants[(lastIndex + 1) % participants.length] || participants[0];
  }

  const replyToParticipantId = input.action === 'rebut'
    ? lastParticipantTurn?.participantId
    : undefined;

  return {
    participantId: speaker?.id || null,
    replyToParticipantId: replyToParticipantId && replyToParticipantId !== speaker?.id
      ? replyToParticipantId
      : undefined,
  };
};

