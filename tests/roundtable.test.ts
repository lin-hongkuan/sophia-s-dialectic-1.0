import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  conceptRoute,
  normalizeRoute,
  parseConceptRoute,
  roundtableSessionRoute,
  routeRoundtableId,
} from '../utils/routing.ts';
import { buildRoundtableAvatarKey } from '../services/imageStore.ts';
import {
  buildRoundtableMarkdown,
  buildRoundtableMarkdownFilename,
} from '../utils/exportRoundtable.ts';
import type { RoundtableSession } from '../types.ts';

const sampleSession = (): RoundtableSession => ({
  id: 'rt-1',
  topic: '自由与孤独是什么关系？',
  title: '自由与孤独的张力',
  coreQuestion: '在什么条件下，孤独是自由的代价？',
  createdAt: '2026-05-11T12:00:00.000Z',
  updatedAt: '2026-05-11T12:30:00.000Z',
  status: 'completed',
  participants: [
    { id: 'p1', name: '萨特', kind: 'philosopher', role: '存在先于本质的代言', stance: '自由是无法逃避的结构。', temperament: '直接、辨析、锋利', conflictWith: ['p2'], status: 'silent' },
    { id: 'p2', name: '共同体主义', kind: 'school', role: '从关系出发理解人', stance: '自由只在与他人的绑定中成形。', temperament: '稳重、举历史例子', conflictWith: ['p1'], status: 'silent' },
    { id: 'p3', name: '现代上班族', kind: 'position', role: '日常被迫自由的当代声音', stance: '自由意味着无法与人分担重量。', temperament: '口语、克制、自嘲', conflictWith: [], status: 'silent' },
    { id: 'p4', name: '方法论怀疑者', kind: 'skeptic', role: '质疑命题本身的框架', stance: '“自由—孤独”这对概念本身需要解构。', temperament: '冷静、反问、拒绝前提', conflictWith: ['p1', 'p2'], status: 'silent' },
  ],
  turns: [
    { id: 't0', phase: 'opening', kind: 'moderator', content: '欢迎来到圆桌。', status: 'completed', createdAt: '2026-05-11T12:01:00.000Z' },
    { id: 't1', phase: 'opening', kind: 'participant', participantId: 'p1', content: '先把自由看成负担。', status: 'completed', createdAt: '2026-05-11T12:02:00.000Z' },
    { id: 't2', phase: 'response', kind: 'participant', participantId: 'p2', replyToParticipantId: 'p1', content: '但孤独并不等于自由。', status: 'completed', createdAt: '2026-05-11T12:05:00.000Z' },
    { id: 'iu1', phase: 'response', kind: 'user_interjection', content: '把“自由”具体到一个劳动日。', action: 'example', targetParticipantId: 'p3', status: 'completed', createdAt: '2026-05-11T12:07:00.000Z' },
    { id: 't3', phase: 'conflict', kind: 'participant', participantId: 'p3', replyToParticipantId: 'p1', content: '一个人下班回家的沉默。', status: 'completed', createdAt: '2026-05-11T12:09:00.000Z' },
    { id: 'tm', phase: 'closing', kind: 'minutes', content: '【共识】四人都承认孤独不是自由的代名词。', status: 'completed', createdAt: '2026-05-11T12:15:00.000Z' },
  ],
  minutes: {
    consensus: '四人都承认孤独不是自由的代名词。',
    disagreements: ['自由是否必须由他人确认', '孤独是代价还是条件'],
    unresolvedQuestions: ['谁来承担自由的代价？'],
    nextQuestions: ['制度性孤独如何被减轻？', '自由的成本可否被分摊？', '存在不被孤独纠缠的自由吗？'],
    realLifeReturn: '下次通勤时数一数自己能并肩的关系。',
  },
});

test('normalizes /roundtable routes and strips trailing slash', () => {
  assert.equal(normalizeRoute('/roundtable'), '/roundtable');
  assert.equal(normalizeRoute('/roundtable/'), '/roundtable');
  assert.equal(normalizeRoute('/roundtable/abc/'), '/roundtable/abc');
  assert.equal(normalizeRoute('/unknown-thing'), '/');
});

test('round-trips a roundtable session route', () => {
  const route = roundtableSessionRoute('rt id/一');
  assert.equal(route, '/roundtable/rt%20id%2F%E4%B8%80');
  assert.equal(routeRoundtableId(route), 'rt id/一');
  assert.equal(routeRoundtableId('/roundtable'), '');
  assert.equal(routeRoundtableId('/history/sample'), '');
});

test('roundtable routes coexist with history/concept routes without aliasing', () => {
  const concept = conceptRoute('analysis', 'keyword');
  assert.equal(parseConceptRoute(concept)?.analysisId, 'analysis');
  assert.equal(routeRoundtableId(concept), '');
  assert.equal(routeRoundtableId(roundtableSessionRoute('rt-1')), 'rt-1');
});

test('avatar key is stable and namespaced', () => {
  assert.equal(
    buildRoundtableAvatarKey('rt-1', 'p1'),
    'roundtable::rt-1::participant::p1',
  );
  assert.notEqual(
    buildRoundtableAvatarKey('rt-1', 'p1'),
    buildRoundtableAvatarKey('rt-2', 'p1'),
  );
});

test('markdown export preserves phases, participants and minutes', () => {
  const session = sampleSession();
  const md = buildRoundtableMarkdown(session);

  assert.match(md, /# 自由与孤独的张力/);
  assert.match(md, /## 参会者/);
  assert.match(md, /- 萨特/);
  assert.match(md, /第一幕 · 开场陈述/);
  assert.match(md, /第二幕 · 交锋回应/);
  assert.match(md, /第三幕 · 分歧聚焦/);
  assert.match(md, /\*\*共同体主义\*\*（回应 萨特）/);
  assert.match(md, /你（主持人 → 现代上班族）/);
  assert.match(md, /## 主持人纪要/);
  assert.match(md, /### 共识/);
  assert.match(md, /### 分歧/);
  assert.match(md, /### 未解决的问题/);
  assert.match(md, /### 可以继续追问/);
  assert.match(md, /### 回到现实[\s\S]+下次通勤时/);
});

test('markdown filename is safe and ends with -date.md', () => {
  const session = sampleSession();
  const name = buildRoundtableMarkdownFilename(session);
  assert.match(name, /^sophia-roundtable-/);
  assert.match(name, /2026-05-11\.md$/);
  assert.doesNotMatch(name, /[<>:"/\\|?*]/);
});

test('markdown export drops streaming / failed participant turns gracefully', () => {
  const session = sampleSession();
  // Inject a streaming turn with empty content — should not produce an empty speaker header.
  session.turns.push({
    id: 't-stream',
    phase: 'conflict',
    kind: 'participant',
    participantId: 'p4',
    content: '',
    status: 'streaming',
    createdAt: '2026-05-11T12:20:00.000Z',
  });
  const md = buildRoundtableMarkdown(session);
  assert.doesNotMatch(md, /\*\*方法论怀疑者:\*\*\s*$/m);
});
