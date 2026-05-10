import assert from 'node:assert/strict';
import test from 'node:test';
import { estimateGenerationProgress } from '../utils/generationProgress';
import type { GenerationLogEntry, GenerationProgress } from '../types';

const startedAt = '2026-05-08T12:00:00.000Z';
const now = Date.parse('2026-05-08T12:01:00.000Z');

const log = (stage: GenerationLogEntry['stage'], seconds: number): GenerationLogEntry => ({
  id: `log-${stage}-${seconds}`,
  ts: new Date(Date.parse(startedAt) + seconds * 1000).toISOString(),
  level: 'info',
  stage,
  message: String(stage),
});

const progress = (stage: GenerationProgress['stage'], extra: Partial<GenerationProgress> = {}): GenerationProgress => ({
  stage,
  totalVoices: 0,
  completedVoices: 0,
  messages: [],
  ...extra,
});

test('generation progress moves forward across pipeline stages', () => {
  const entries = [log('outline', 0), log('route', 20), log('voices', 35), log('synthesis', 55)];
  const outline = estimateGenerationProgress({ progress: progress('outline'), entries, startedAt, now }).percent;
  const route = estimateGenerationProgress({ progress: progress('route'), entries, startedAt, now }).percent;
  const voices = estimateGenerationProgress({ progress: progress('voices', { totalVoices: 4, completedVoices: 2, streamedChars: 900 }), entries, startedAt, now }).percent;
  const synthesis = estimateGenerationProgress({ progress: progress('synthesis'), entries, startedAt, now }).percent;
  const done = estimateGenerationProgress({ progress: progress('done'), entries, startedAt, now }).percent;

  assert.ok(outline < route);
  assert.ok(route < voices);
  assert.ok(voices < synthesis);
  assert.equal(done, 100);
});

test('generation progress exposes approximate ETA label', () => {
  const estimate = estimateGenerationProgress({
    progress: progress('voices', { totalVoices: 3, completedVoices: 1, streamedChars: 600 }),
    entries: [log('outline', 0), log('route', 15), log('voices', 30)],
    startedAt,
    now,
  });

  assert.match(estimate.etaLabel, /预计|估算/);
  assert.ok(estimate.percent > 30);
  assert.ok(estimate.percent < 82);
});
