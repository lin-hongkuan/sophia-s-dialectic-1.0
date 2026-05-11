import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  activeRoundtableTurn,
  chooseInterjectionSpeaker,
  mergeRoundtableSessions,
  roundtableFocus,
} from '../utils/roundtableFlow.ts';
import type { RoundtableSession } from '../types.ts';

const makeSession = (): RoundtableSession => ({
  id: 'rt-flow',
  topic: 'topic',
  title: 'title',
  coreQuestion: 'core question',
  createdAt: '2026-05-11T12:00:00.000Z',
  updatedAt: '2026-05-11T12:00:00.000Z',
  status: 'running',
  participants: [
    { id: 'p1', name: 'P1', kind: 'philosopher', role: 'r1', stance: 's1', temperament: 't1', status: 'silent' },
    { id: 'p2', name: 'P2', kind: 'school', role: 'r2', stance: 's2', temperament: 't2', status: 'silent' },
    { id: 'p3', name: 'P3', kind: 'position', role: 'r3', stance: 's3', temperament: 't3', status: 'silent' },
    { id: 'p4', name: 'P4', kind: 'skeptic', role: 'r4', stance: 's4', temperament: 't4', status: 'silent' },
  ],
  turns: [
    { id: 'm0', phase: 'opening', kind: 'moderator', content: 'open', status: 'completed', createdAt: '2026-05-11T12:01:00.000Z' },
    { id: 't1', phase: 'opening', kind: 'participant', participantId: 'p1', content: 'done', status: 'completed', createdAt: '2026-05-11T12:02:00.000Z' },
    { id: 't2', phase: 'response', kind: 'participant', participantId: 'p3', content: 'last', status: 'completed', createdAt: '2026-05-11T12:03:00.000Z' },
  ],
});

test('roundtable focus only highlights an active streaming participant', () => {
  const session = makeSession();
  assert.equal(activeRoundtableTurn(session, null), null);
  assert.deepEqual(roundtableFocus(session, null), { speakerId: null, replyToId: null });

  session.turns.push({
    id: 'live',
    phase: 'response',
    kind: 'participant',
    participantId: 'p2',
    replyToParticipantId: 'p1',
    content: 'streaming',
    status: 'streaming',
    createdAt: '2026-05-11T12:04:00.000Z',
  });

  assert.equal(activeRoundtableTurn(session, 'live')?.participantId, 'p2');
  assert.deepEqual(roundtableFocus(session, 'live'), { speakerId: 'p2', replyToId: 'p1' });
});

test('roundtable session merge preserves interjections from newer UI state', () => {
  const base = makeSession();
  base.turns = base.turns.slice(0, 2);
  const streaming = {
    id: 'live',
    phase: 'response' as const,
    kind: 'participant' as const,
    participantId: 'p2',
    content: '',
    status: 'streaming' as const,
    createdAt: '2026-05-11T12:04:00.000Z',
  };
  const interjection = {
    id: 'queued',
    phase: 'response' as const,
    kind: 'user_interjection' as const,
    content: 'please clarify',
    action: 'ask' as const,
    status: 'completed' as const,
    createdAt: '2026-05-11T12:05:00.000Z',
  };
  const prev: RoundtableSession = { ...base, turns: [...base.turns, streaming, interjection] };
  const next: RoundtableSession = {
    ...base,
    turns: [...base.turns, { ...streaming, content: 'completed answer', status: 'completed' }],
  };

  const merged = mergeRoundtableSessions(prev, next);
  assert.deepEqual(merged.turns.map((turn) => turn.id), ['m0', 't1', 'live', 'queued']);
  assert.equal(merged.turns.find((turn) => turn.id === 'live')?.content, 'completed answer');
  assert.equal(merged.turns.find((turn) => turn.id === 'queued')?.content, 'please clarify');
});

test('interjection speaker selection honors explicit target and rebut reply target', () => {
  const session = makeSession();
  assert.deepEqual(
    chooseInterjectionSpeaker(session, { action: 'ask', targetParticipantId: 'p3' }),
    { participantId: 'p3', replyToParticipantId: undefined },
  );
  assert.deepEqual(
    chooseInterjectionSpeaker(session, { action: 'rebut' }),
    { participantId: 'p4', replyToParticipantId: 'p3' },
  );
});

