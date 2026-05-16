import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const sourceExtensions = new Set(['.ts', '.tsx', '.mjs']);
const skippedDirs = new Set(['.git', 'dist', 'node_modules']);

const collectSourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!skippedDirs.has(entry.name)) collectSourceFiles(path.join(dir, entry.name), out);
      continue;
    }
    if (sourceExtensions.has(path.extname(entry.name))) out.push(path.join(dir, entry.name));
  }
  return out;
};

test('legacy facade files have been fully migrated away', () => {
  const legacyFiles = [
    'constants.ts',
    'types.ts',
    'types/app.ts',
    'services/apiClient.ts',
    'services/historyStore.ts',
    'services/imageStore.ts',
    'services/indexedDbStore.ts',
    'services/localStorageGateway.ts',
    'services/runSnapshotStore.ts',
    'services/stageCache.ts',
    'services/voiceChatStore.ts',
  ];

  for (const file of legacyFiles) {
    assert.equal(existsSync(path.join(process.cwd(), file)), false, `${file} should not exist`);
  }
});

test('source imports do not target removed facade modules', () => {
  const rootDir = process.cwd();
  const legacyFiles = new Set([
    'constants.ts',
    'types.ts',
    'types/app.ts',
    'services/apiClient.ts',
    'services/historyStore.ts',
    'services/imageStore.ts',
    'services/indexedDbStore.ts',
    'services/localStorageGateway.ts',
    'services/runSnapshotStore.ts',
    'services/stageCache.ts',
    'services/voiceChatStore.ts',
  ].map((file) => path.normalize(path.join(rootDir, file))));

  const violations: string[] = [];
  const importSourcePattern = /\bfrom\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

  for (const file of collectSourceFiles(rootDir)) {
    if (path.basename(file) === 'module-boundaries.test.ts') continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(importSourcePattern)) {
      const source = match[1] || match[2];
      if (!source.startsWith('.')) continue;
      const resolved = path.resolve(path.dirname(file), source);
      const candidates = path.extname(resolved)
        ? [resolved]
        : [`${resolved}.ts`, `${resolved}.tsx`, `${resolved}.mjs`];
      if (candidates.some((candidate) => legacyFiles.has(path.normalize(candidate)))) {
        violations.push(`${path.relative(rootDir, file)} imports ${source}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('direct type modules expose the app contracts without root re-exports', () => {
  const rootDir = process.cwd();
  const virtualFile = path.join(rootDir, '__module_type_guard__.ts');
  const sourceText = `
    import { emptyConclusion } from './types/domain.ts';
    import type { AnalysisResult, MagazineImageAsset, ProgramMode, ThoughtExperimentImage } from './types/domain.ts';
    import type { GenerationProgress } from './types/pipeline.ts';
    import type { HistoryEntry, RunSnapshot } from './types/storage.ts';
    import type { Message } from './types/chat.ts';
    import type { SelectedSource } from './utils/routing.ts';

    const mode: ProgramMode = 'roundtable';
    const progress: GenerationProgress = {
      stage: 'voices',
      totalVoices: 1,
      completedVoices: 0,
      messages: [],
    };
    const selected: SelectedSource = 'active';
    const message: Message = { role: 'assistant', content: 'ok' };
    const result = null as unknown as AnalysisResult;
    const history: HistoryEntry = {
      id: 'history-1',
      topic: 'topic',
      title: 'title',
      mode,
      modeLabel: 'Roundtable',
      createdAt: '2026-05-08T00:00:00.000Z',
      result,
    };
    const snapshot: RunSnapshot = {
      runId: 'run-1',
      topic: 'topic',
      createdAt: history.createdAt,
      updatedAt: history.createdAt,
      status: 'running',
      lastCompletedStage: 'outline',
      partialResult: result,
      log: [],
    };
    const thoughtImage: ThoughtExperimentImage = {
      imageUrl: '',
      prompt: '',
      model: '',
      alt: '',
    };
    const magazineImage: MagazineImageAsset = thoughtImage;

    void [emptyConclusion, progress, selected, message, history, snapshot, magazineImage];
  `;

  const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, 'tsconfig.json');
  assert.ok(configPath, 'tsconfig.json should exist');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(config.error, undefined);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, rootDir);

  const host = ts.createCompilerHost(parsed.options, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const isVirtualFile = (fileName: string) => path.normalize(fileName) === path.normalize(virtualFile);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    if (isVirtualFile(fileName)) {
      return ts.createSourceFile(fileName, sourceText, languageVersion, true, ts.ScriptKind.TS);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
  };
  host.fileExists = (fileName) => isVirtualFile(fileName) || originalFileExists(fileName);
  host.readFile = (fileName) => (isVirtualFile(fileName) ? sourceText : originalReadFile(fileName));

  const program = ts.createProgram([virtualFile], parsed.options, host);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.deepEqual(diagnostics.map((diagnostic) => ({
    code: diagnostic.code,
    file: diagnostic.file ? path.relative(rootDir, diagnostic.file.fileName) : undefined,
    message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
  })), []);
});

test('presentation and service modules are imported from their real locations', async () => {
  const [
    generationStages,
    imageMessages,
    modePresentation,
    historyStore,
    imageStore,
    indexedDbStore,
    localStorageGateway,
    runSnapshotStore,
    stageCache,
    voiceChatStore,
    apiClient,
  ] = await Promise.all([
    import('../presentation/generationStages.ts'),
    import('../presentation/imageMessages.ts'),
    import('../presentation/modePresentation.ts'),
    import('../services/storage/historyStore.ts'),
    import('../services/storage/imageStore.ts'),
    import('../services/storage/indexedDbStore.ts'),
    import('../services/storage/localStorageGateway.ts'),
    import('../services/storage/runSnapshotStore.ts'),
    import('../services/storage/stageCache.ts'),
    import('../services/storage/voiceChatStore.ts'),
    import('../services/api/apiClient.ts'),
  ]);

  assert.ok(generationStages.STAGE_ORDER.includes('voices'));
  assert.equal(typeof generationStages.STAGE_LABEL.voices, 'string');
  assert.equal(typeof imageMessages.GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE, 'string');
  assert.equal(modePresentation.getModePresentation('roundtable'), modePresentation.MODE_PRESENTATION.roundtable);
  assert.equal(typeof historyStore.collectAvatarKeys, 'function');
  assert.equal(typeof imageStore.buildAvatarKey, 'function');
  assert.equal(typeof indexedDbStore.createKeyValueStore, 'function');
  assert.equal(typeof localStorageGateway.safeLocalStorageGet, 'function');
  assert.equal(typeof runSnapshotStore.isResumableRunSnapshot, 'function');
  assert.equal(typeof stageCache.buildStageKey, 'function');
  assert.equal(typeof voiceChatStore.loadVoiceChat, 'function');
  assert.equal(typeof apiClient.extractChatCompletionContent, 'function');
});
