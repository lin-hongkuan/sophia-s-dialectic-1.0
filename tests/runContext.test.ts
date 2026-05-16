import assert from 'node:assert/strict';
import test from 'node:test';
import type { GenerationLogEntry, TokenUsage } from '../types/pipeline';
import {
  currentRunContext,
  effectiveSignal,
  emitLog,
  popRunContext,
  pushRunContext,
  recordUsageFromResponse,
  withStage,
} from '../services/analysis/runContext';

test('run context scopes logs and restores parent stage after withStage', async () => {
  const logs: GenerationLogEntry[] = [];
  const ctx = pushRunContext({
    stage: 'outline',
    voiceId: 'voice-parent',
    voiceName: 'Parent Voice',
    onLog: (entry) => logs.push(entry),
  });

  try {
    emitLog({ level: 'info', stage: 'outline', message: 'before' });
    await withStage('voices', async () => {
      emitLog({ level: 'detail', stage: 'voices', message: 'inside' });
      assert.equal(currentRunContext()?.stage, 'voices');
    }, { voiceId: 'voice-child', voiceName: 'Child Voice' });
    emitLog({ level: 'info', stage: 'outline', message: 'after' });
  } finally {
    popRunContext(ctx);
  }

  assert.equal(logs.length, 3);
  assert.equal(logs[0].voiceId, 'voice-parent');
  assert.equal(logs[1].voiceId, 'voice-child');
  assert.equal(logs[1].voiceName, 'Child Voice');
  assert.equal(logs[2].voiceId, 'voice-parent');
  assert.match(logs[0].id, /^log-/);
  assert.ok(Date.parse(logs[0].ts) > 0);
});

test('effectiveSignal aborts when either run or voice signal aborts', () => {
  const runController = new AbortController();
  const voiceController = new AbortController();
  const signal = effectiveSignal({
    stage: 'voices',
    abortSignal: runController.signal,
    voiceAbortSignal: voiceController.signal,
  });

  assert.equal(signal?.aborted, false);
  voiceController.abort('skip-voice');
  assert.equal(signal?.aborted, true);
  assert.equal(signal?.reason, 'skip-voice');
});

test('recordUsageFromResponse emits token usage from current context', () => {
  const usages: TokenUsage[] = [];
  const ctx = pushRunContext({
    stage: 'avatar',
    voiceId: 'voice-1',
    onTokenUsage: (usage) => usages.push(usage),
  });

  try {
    const usage = recordUsageFromResponse({
      prompt_tokens: 10,
      completion_tokens: 4,
      total_tokens: 14,
    }, 'image-model');

    assert.deepEqual(usage && {
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
      model: usage.model,
      stage: usage.stage,
      voiceId: usage.voiceId,
    }, {
      promptTokens: 10,
      completionTokens: 4,
      totalTokens: 14,
      model: 'image-model',
      stage: 'avatar',
      voiceId: 'voice-1',
    });
    assert.equal(usages.length, 1);
  } finally {
    popRunContext(ctx);
  }
});
