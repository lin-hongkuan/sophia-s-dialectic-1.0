import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  collectAvatarKeys,
  mergeAvatarsFromStore,
  splitAvatarsForStorage,
} from '../services/storage/historyStore.ts';
import {
  buildAvatarKey,
  buildMagazineImageKey,
  buildSceneImageKey,
} from '../services/storage/imageStore.ts';
import type { HistoryEntry } from '../types/storage.ts';

const dataAvatar = 'data:image/png;base64,avatar';
const dataScene = 'data:image/png;base64,scene';
const dataPressure = 'data:image/png;base64,pressure';
const dataCover = 'data:image/png;base64,cover';
const externalAvatar = 'https://cdn.example.test/avatar.png';
const externalConclusion = 'https://cdn.example.test/conclusion.png';

const makeEntry = (): HistoryEntry => ({
  id: 'entry-1',
  topic: 'topic',
  title: 'title',
  mode: 'roundtable',
  modeLabel: 'Roundtable',
  createdAt: '2026-05-08T00:00:00.000Z',
  result: {
    id: 'analysis-1',
    createdAt: '2026-05-08T00:00:00.000Z',
    topic: 'topic',
    philosophical_title: 'title',
    mode: 'roundtable',
    modeLabel: 'Roundtable',
    introduction: '',
    questionFrame: {
      original: 'topic',
      bigQuestion: '',
      plainTranslation: '',
      keywords: [],
    },
    programStructure: [],
    routeMap: [],
    voices: [
      {
        id: 'voice-data',
        name: 'Data Voice',
        kind: 'philosopher',
        role: '',
        coreConcept: '',
        oneLine: '',
        stance: '',
        argument: '',
        summaryForSynthesis: '',
        avatar: {
          imageUrl: dataAvatar,
          prompt: 'avatar prompt',
          style: 'portrait',
          model: 'image-model',
          alt: 'avatar alt',
        },
      },
      {
        id: 'voice-external',
        name: 'External Voice',
        kind: 'school',
        role: '',
        coreConcept: '',
        oneLine: '',
        stance: '',
        argument: '',
        summaryForSynthesis: '',
        avatar: {
          imageUrl: externalAvatar,
          prompt: 'external avatar prompt',
          style: 'portrait',
          model: 'image-model',
          alt: 'external avatar alt',
        },
      },
      {
        id: 'voice-empty',
        name: 'Empty Voice',
        kind: 'concept',
        role: '',
        coreConcept: '',
        oneLine: '',
        stance: '',
        argument: '',
        summaryForSynthesis: '',
        avatar: {
          imageUrl: '',
          prompt: 'empty avatar prompt',
          style: 'portrait',
          model: 'image-model',
          alt: 'empty avatar alt',
        },
      },
    ],
    tensions: [],
    keywords: [],
    followUps: [],
    thoughtExperiment: {
      unsettlingVersion: '',
      coreChallenge: '',
      stakes: '',
      sceneImage: {
        imageUrl: dataScene,
        prompt: 'scene prompt',
        model: 'image-model',
        alt: 'scene alt',
      },
      pressureImage: {
        imageUrl: dataPressure,
        prompt: 'pressure prompt',
        model: 'image-model',
        alt: 'pressure alt',
      },
      responseMap: [],
    },
    magazineImages: {
      cover: {
        imageUrl: dataCover,
        prompt: 'cover prompt',
        model: 'image-model',
        alt: 'cover alt',
      },
      conclusion: {
        imageUrl: externalConclusion,
        prompt: 'conclusion prompt',
        model: 'image-model',
        alt: 'conclusion alt',
      },
    },
    conclusion: {
      summary: '',
      openQuestion: '',
      realLifeReturn: '',
    },
  },
});

test('splitAvatarsForStorage extracts only inline avatar, thought experiment, and magazine images', () => {
  const entry = makeEntry();
  const { lean, images } = splitAvatarsForStorage(entry);

  assert.deepEqual(images, [
    { key: buildAvatarKey(entry.id, 'voice-data'), imageUrl: dataAvatar },
    { key: buildSceneImageKey(entry.id, 'scene'), imageUrl: dataScene },
    { key: buildSceneImageKey(entry.id, 'pressure'), imageUrl: dataPressure },
    { key: buildMagazineImageKey(entry.id, 'cover'), imageUrl: dataCover },
  ]);

  assert.equal(lean.result.voices[0].avatar?.imageUrl, '');
  assert.equal(lean.result.voices[1].avatar?.imageUrl, externalAvatar);
  assert.equal(lean.result.voices[2].avatar?.imageUrl, '');
  assert.equal(lean.result.thoughtExperiment?.sceneImage?.imageUrl, '');
  assert.equal(lean.result.thoughtExperiment?.pressureImage?.imageUrl, '');
  assert.equal(lean.result.magazineImages?.cover?.imageUrl, '');
  assert.equal(lean.result.magazineImages?.conclusion?.imageUrl, externalConclusion);

  assert.equal(entry.result.voices[0].avatar?.imageUrl, dataAvatar);
  assert.equal(entry.result.thoughtExperiment?.sceneImage?.imageUrl, dataScene);
  assert.equal(entry.result.magazineImages?.cover?.imageUrl, dataCover);
});

test('mergeAvatarsFromStore hydrates lean images without overwriting existing urls', () => {
  const entry = makeEntry();
  const { lean } = splitAvatarsForStorage(entry);
  const hydrated = mergeAvatarsFromStore(lean, {
    [buildAvatarKey(entry.id, 'voice-data')]: dataAvatar,
    [buildAvatarKey(entry.id, 'voice-external')]: 'data:image/png;base64,should-not-overwrite',
    [buildSceneImageKey(entry.id, 'scene')]: dataScene,
    [buildSceneImageKey(entry.id, 'pressure')]: dataPressure,
    [buildMagazineImageKey(entry.id, 'cover')]: dataCover,
    [buildMagazineImageKey(entry.id, 'conclusion')]: 'data:image/png;base64,should-not-overwrite',
  });

  assert.equal(hydrated.result.voices[0].avatar?.imageUrl, dataAvatar);
  assert.equal(hydrated.result.voices[1].avatar?.imageUrl, externalAvatar);
  assert.equal(hydrated.result.voices[2].avatar?.imageUrl, '');
  assert.equal(hydrated.result.thoughtExperiment?.sceneImage?.imageUrl, dataScene);
  assert.equal(hydrated.result.thoughtExperiment?.pressureImage?.imageUrl, dataPressure);
  assert.equal(hydrated.result.magazineImages?.cover?.imageUrl, dataCover);
  assert.equal(hydrated.result.magazineImages?.conclusion?.imageUrl, externalConclusion);
});

test('collectAvatarKeys includes every persisted image slot for cleanup and hydration', () => {
  const entry = makeEntry();

  assert.deepEqual(collectAvatarKeys(entry), [
    buildAvatarKey(entry.id, 'voice-data'),
    buildAvatarKey(entry.id, 'voice-external'),
    buildAvatarKey(entry.id, 'voice-empty'),
    buildSceneImageKey(entry.id, 'scene'),
    buildSceneImageKey(entry.id, 'pressure'),
    buildMagazineImageKey(entry.id, 'cover'),
    buildMagazineImageKey(entry.id, 'conclusion'),
  ]);
});
