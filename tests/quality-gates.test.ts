import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  conceptRoute,
  historyItemRoute,
  normalizeRoute,
  parseConceptRoute,
  routeHistoryId,
} from '../utils/routing.ts';
import { validateUserPrompt } from '../utils/inputValidation.ts';
import {
  appendCappedLog,
  checkpointStageForProgress,
  GENERATION_LOG_LIMIT,
} from '../utils/generationLog.ts';
import { isStageEntryUsable, STAGE_TTL_MS } from '../services/storage/stageCache.ts';
import { compareRunSnapshotsByUpdatedAtDesc, isResumableRunSnapshot } from '../services/storage/runSnapshotStore.ts';
import { DEFAULT_ANALYSIS_PROFILE, exportSettings, importSettings, getActiveConfig, resetToDefaults } from '../services/sophiaConfig.ts';
import { buildAnalysisProfileInstruction } from '../services/analysisProfile.ts';
import { clearAll, exportCsv, flushNow, recordUsage } from '../services/tokenAccounting.ts';
import { extractChatCompletionContent, parseChatCompletionResponseText } from '../services/api/apiClient.ts';
import type { RunSnapshot } from '../types/storage.ts';

const makeSnapshot = (partial: Partial<RunSnapshot>): RunSnapshot => ({
  runId: partial.runId || 'run',
  topic: partial.topic || 'topic',
  createdAt: partial.createdAt || '2026-05-08T00:00:00.000Z',
  updatedAt: partial.updatedAt || '2026-05-08T00:00:00.000Z',
  status: partial.status || 'running',
  lastCompletedStage: partial.lastCompletedStage ?? 'outline',
  partialResult: partial.partialResult ?? null,
  continuationContext: partial.continuationContext,
  isPresetRegeneration: partial.isPresetRegeneration,
  log: partial.log || [],
});

test('normalizes known app routes and strips trailing slash', () => {
  assert.equal(normalizeRoute('/'), '/');
  assert.equal(normalizeRoute('/history/'), '/history');
  assert.equal(normalizeRoute('/manifesto/'), '/manifesto');
  assert.equal(normalizeRoute('/settings/'), '/settings');
  assert.equal(normalizeRoute('/unknown'), '/');
});

test('encodes and decodes history and concept routes', () => {
  assert.equal(historyItemRoute({ id: 'run id/一', isPreset: false } as any), '/history/run%20id%2F%E4%B8%80');
  assert.equal(routeHistoryId('/history/run%20id%2F%E4%B8%80'), 'run id/一');
  assert.equal(historyItemRoute({ id: 'preset', isPreset: true } as any), '/history/sample');

  const route = conceptRoute('analysis/一', 'keyword 二');
  assert.equal(route, '/concept/analysis%2F%E4%B8%80/keyword%20%E4%BA%8C');
  assert.deepEqual(parseConceptRoute(route), { analysisId: 'analysis/一', keywordId: 'keyword 二' });
  assert.equal(parseConceptRoute('/history/sample'), null);
});

test('validates user prompts by mode', () => {
  assert.equal(validateUserPrompt('如何面对虚无主义？', { mode: 'topic' }).ok, true);
  assert.equal(validateUserPrompt('Hi', { mode: 'topic' }).ok, false);
  assert.equal(validateUserPrompt('https://example.com/article', { mode: 'branch' }).ok, false);
  assert.equal(validateUserPrompt('12345', { mode: 'voice' }).ok, false);
  assert.equal(validateUserPrompt('???', { mode: 'note' }).ok, false);
});

test('caps generation logs and derives snapshot checkpoints', () => {
  const entries = Array.from({ length: GENERATION_LOG_LIMIT + 5 }, (_, index) => ({
    id: `id-${index}`,
    ts: '2026-05-08T00:00:00.000Z',
    level: 'info' as const,
    stage: 'meta' as const,
    message: String(index),
  })).reduce(appendCappedLog, [] as Parameters<typeof appendCappedLog>[0]);

  assert.equal(entries.length, GENERATION_LOG_LIMIT);
  assert.equal(entries[0].id, 'id-5');
  assert.equal(checkpointStageForProgress(null), null);
  assert.equal(checkpointStageForProgress({ stage: 'outline', totalVoices: 0, completedVoices: 0, messages: [] }), 'outline');
  assert.equal(checkpointStageForProgress({ stage: 'voices', totalVoices: 1, completedVoices: 0, messages: [] }), 'route');
  assert.equal(checkpointStageForProgress({ stage: 'done', totalVoices: 1, completedVoices: 1, messages: [] }), 'synthesis');
});

test('normalizes SSE chat completions returned to non-streaming callers', () => {
  const sse = [
    'data: {"choices":[{"delta":{"role":"assistant"}}]}',
    'data: {"choices":[{"delta":{"content":"{\\"ok\\":"}}]}',
    'data: {"choices":[{"delta":{"content":"true}"}}]}',
    'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}',
    'data: [DONE]',
  ].join('\n');

  const data = parseChatCompletionResponseText(sse);
  assert.equal(extractChatCompletionContent(data), '{"ok":true}');
  assert.equal(data.usage.total_tokens, 3);
  assert.equal(data.choices[0].finish_reason, 'stop');
});

test('extracts text from array-style chat completion content', () => {
  const data = parseChatCompletionResponseText(JSON.stringify({
    choices: [{
      message: {
        content: [
          { type: 'text', text: '{"answer":' },
          { type: 'text', text: '"yes"}' },
        ],
      },
    }],
  }));

  assert.equal(extractChatCompletionContent(data), '{"answer":"yes"}');
});

test('rejects stale or malformed stage cache entries', () => {
  const now = Date.parse('2026-05-08T00:00:00.000Z');
  assert.equal(isStageEntryUsable('outline', { version: 2, writtenAt: new Date(now).toISOString(), value: 'ok' }, now), true);
  assert.equal(isStageEntryUsable('outline', { version: 1, writtenAt: new Date(now).toISOString(), value: 'old' }, now), false);
  assert.equal(isStageEntryUsable('outline', { version: 2, writtenAt: 'not-a-date', value: 'bad' }, now), false);
  assert.equal(isStageEntryUsable('outline', { version: 2, writtenAt: new Date(now - STAGE_TTL_MS.outline - 1).toISOString(), value: 'stale' }, now), false);
});

test('selects resumable run snapshots deterministically', () => {
  const running = makeSnapshot({ runId: 'running', status: 'running', updatedAt: '2026-05-08T01:00:00.000Z' });
  const invalidDate = makeSnapshot({ runId: 'invalid', status: 'running', updatedAt: 'invalid-date' });
  const completedWithResult = makeSnapshot({ runId: 'done', status: 'completed', lastCompletedStage: 'synthesis', partialResult: {} as any });
  const cancelled = makeSnapshot({ runId: 'cancelled', status: 'cancelled' });
  const synthesizedRunning = makeSnapshot({ runId: 'synth-running', status: 'running', lastCompletedStage: 'synthesis' });

  assert.equal(isResumableRunSnapshot(running), true);
  assert.equal(isResumableRunSnapshot(completedWithResult), true);
  assert.equal(isResumableRunSnapshot(cancelled), false);
  assert.equal(isResumableRunSnapshot(synthesizedRunning), false);
  assert.deepEqual([invalidDate, running].sort(compareRunSnapshotsByUpdatedAtDesc).map((snap) => snap.runId), ['running', 'invalid']);
});

test('normalizes runtime config without leaking custom image model into presets', () => {
  importSettings(JSON.stringify({
    activeProviderId: 'custom',
    customProvider: {
      name: '  Local Gateway  ',
      baseUrl: '  https://llm.example.test/v1///  ',
      apiKey: '  sk-test  ',
      textModel: '  model-a  ',
      imageModel: '  image-a  ',
    },
  }));

  const custom = getActiveConfig();
  assert.equal(custom.apiProvider, 'Local Gateway');
  assert.equal(custom.apiBaseUrl, 'https://llm.example.test/v1');
  assert.equal(custom.apiKey, 'sk-test');
  assert.equal(custom.apiModel, 'model-a');
  assert.equal(custom.avatarImageModel, 'image-a');

  importSettings(JSON.stringify({
    activeProviderId: 'preset:gpt',
    customProvider: {
      name: 'Custom',
      baseUrl: 'https://custom.example/v1',
      apiKey: 'custom-key',
      textModel: 'custom-text',
      imageModel: 'custom-image-should-not-leak',
    },
  }));
  const preset = getActiveConfig();
  assert.notEqual(preset.avatarImageModel, 'custom-image-should-not-leak');
  resetToDefaults();
});

test('normalizes analysis profile settings defensively', () => {
  importSettings(JSON.stringify({
    analysisProfile: {
      depth: 'deep',
      expressionStyle: 'plain',
      evidenceFocus: 'practical',
    },
  }));

  const profile = {
    depth: 'deep',
    expressionStyle: 'plain',
    evidenceFocus: 'practical',
  } as const;
  assert.deepEqual(getActiveConfig().analysisProfile, profile);
  assert.deepEqual(JSON.parse(exportSettings()).analysisProfile, profile);
  assert.match(buildAnalysisProfileInstruction(profile), /practical-first/);

  importSettings(JSON.stringify({
    analysisProfile: {
      depth: 'invalid',
      expressionStyle: 'invalid',
      evidenceFocus: 'invalid',
    },
  }));
  assert.deepEqual(getActiveConfig().analysisProfile, DEFAULT_ANALYSIS_PROFILE);
  resetToDefaults();
});

test('normalizes image retry option defensively', () => {
  resetToDefaults();
  assert.equal(getActiveConfig().options.imageRetryCount, 2);

  importSettings(JSON.stringify({
    options: {
      imageRetryCount: 4,
    },
  }));
  assert.equal(getActiveConfig().options.imageRetryCount, 4);
  assert.equal(JSON.parse(exportSettings()).options.imageRetryCount, 4);

  importSettings(JSON.stringify({
    options: {
      imageRetryCount: 9,
    },
  }));
  assert.equal(getActiveConfig().options.imageRetryCount, 2);
  resetToDefaults();
});

test('exports token accounting csv defensively', () => {
  clearAll();
  recordUsage({
    ts: '2026-05-08T00:00:00.000Z',
    stage: 'voices',
    model: 'model, "quoted"',
    promptTokens: 1,
    completionTokens: 2,
    totalTokens: 3,
    voiceId: 'voice-1',
  });
  flushNow();
  const csv = exportCsv();
  assert.match(csv, /ts,stage,model,promptTokens,completionTokens,totalTokens,voiceId/);
  assert.match(csv, /"model, ""quoted"""/);
  assert.match(csv, /voice-1/);
  clearAll();
});
