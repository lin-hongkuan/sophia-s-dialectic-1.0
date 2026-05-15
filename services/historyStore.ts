import type { AnalysisResult, HistoryEntry } from '../types';
import { buildAvatarKey, buildMagazineImageKey, buildSceneImageKey, getAvatarImages, putAvatarImage } from './imageStore';
import { createLocalJsonStore, safeLocalStorageGet, safeLocalStorageSet } from './localStorageGateway';

export const HISTORY_KEY = 'sophia.history.v1';
export const HISTORY_LIMIT = 10;
export const HISTORY_EXPORT_VERSION = 1;
export const PRESET_HISTORY_KEY = 'sophia.preset.generated.feminism.v1';

const IDB_MIGRATION_FLAG = 'sophia.idb.migrated.v1';
const historyStore = createLocalJsonStore<HistoryEntry[]>(HISTORY_KEY);
const presetStore = createLocalJsonStore<HistoryEntry>(PRESET_HISTORY_KEY);

export const loadHistory = (): HistoryEntry[] => {
  const parsed = historyStore.get();
  return Array.isArray(parsed) ? parsed : [];
};

export const loadGeneratedPreset = (): HistoryEntry | null => {
  const parsed = presetStore.get();
  return parsed?.result ? parsed : null;
};

export const stripAvatarImage = (entry: HistoryEntry): HistoryEntry => ({
  ...entry,
  result: {
    ...entry.result,
    voices: entry.result.voices.map((voice) =>
      voice.avatar?.imageUrl ? { ...voice, avatar: { ...voice.avatar, imageUrl: '' } } : voice,
    ),
  },
});

type StoredImage = { key: string; imageUrl: string };

const stripThoughtExperimentImage = (
  entryId: string,
  image: AnalysisResult['thoughtExperiment']['sceneImage'] | undefined,
  variant: 'scene' | 'pressure',
  images: StoredImage[],
) => {
  if (!image?.imageUrl?.startsWith('data:')) return image;
  images.push({ key: buildSceneImageKey(entryId, variant), imageUrl: image.imageUrl });
  return { ...image, imageUrl: '' };
};

const stripMagazineImages = (
  entryId: string,
  magazineImages: AnalysisResult['magazineImages'] | undefined,
  images: StoredImage[],
): AnalysisResult['magazineImages'] | undefined => {
  if (!magazineImages) return magazineImages;
  const next: AnalysisResult['magazineImages'] = { ...magazineImages };
  (Object.keys(next) as Array<keyof NonNullable<AnalysisResult['magazineImages']>>).forEach((slot) => {
    const image = next[slot];
    if (!image?.imageUrl?.startsWith('data:')) return;
    images.push({ key: buildMagazineImageKey(entryId, slot), imageUrl: image.imageUrl });
    next[slot] = { ...image, imageUrl: '' };
  });
  return next;
};

export const splitAvatarsForStorage = (
  entry: HistoryEntry,
): { lean: HistoryEntry; images: Array<{ key: string; imageUrl: string }> } => {
  const images: StoredImage[] = [];
  const lean: HistoryEntry = {
    ...entry,
    result: {
      ...entry.result,
      voices: entry.result.voices.map((voice) => {
        if (!voice.avatar?.imageUrl) return voice;
        const url = voice.avatar.imageUrl;
        if (!url.startsWith('data:')) return voice;
        images.push({ key: buildAvatarKey(entry.id, voice.id), imageUrl: url });
        return { ...voice, avatar: { ...voice.avatar, imageUrl: '' } };
      }),
      thoughtExperiment: entry.result.thoughtExperiment
        ? {
          ...entry.result.thoughtExperiment,
          sceneImage: stripThoughtExperimentImage(entry.id, entry.result.thoughtExperiment.sceneImage, 'scene', images),
          pressureImage: stripThoughtExperimentImage(entry.id, entry.result.thoughtExperiment.pressureImage, 'pressure', images),
        }
        : entry.result.thoughtExperiment,
      magazineImages: stripMagazineImages(entry.id, entry.result.magazineImages, images),
    },
  };
  return { lean, images };
};

const mergeMagazineImagesFromStore = (
  entryId: string,
  magazineImages: AnalysisResult['magazineImages'] | undefined,
  imageMap: Record<string, string>,
): AnalysisResult['magazineImages'] | undefined => {
  if (!magazineImages) return magazineImages;
  const next: AnalysisResult['magazineImages'] = { ...magazineImages };
  (Object.keys(next) as Array<keyof NonNullable<AnalysisResult['magazineImages']>>).forEach((slot) => {
    const image = next[slot];
    if (!image || image.imageUrl) return;
    const url = imageMap[buildMagazineImageKey(entryId, slot)];
    if (url) next[slot] = { ...image, imageUrl: url };
  });
  return next;
};

export const mergeAvatarsFromStore = (
  entry: HistoryEntry,
  imageMap: Record<string, string>,
): HistoryEntry => ({
  ...entry,
  result: {
    ...entry.result,
    voices: entry.result.voices.map((voice) => {
      if (!voice.avatar) return voice;
      if (voice.avatar.imageUrl) return voice;
      const url = imageMap[buildAvatarKey(entry.id, voice.id)];
      if (!url) return voice;
      return { ...voice, avatar: { ...voice.avatar, imageUrl: url } };
    }),
    thoughtExperiment: entry.result.thoughtExperiment
      ? {
        ...entry.result.thoughtExperiment,
        sceneImage: entry.result.thoughtExperiment.sceneImage && !entry.result.thoughtExperiment.sceneImage.imageUrl
          ? {
            ...entry.result.thoughtExperiment.sceneImage,
            imageUrl: imageMap[buildSceneImageKey(entry.id, 'scene')] || imageMap[buildSceneImageKey(entry.id)] || entry.result.thoughtExperiment.sceneImage.imageUrl,
          }
          : entry.result.thoughtExperiment.sceneImage,
        pressureImage: entry.result.thoughtExperiment.pressureImage && !entry.result.thoughtExperiment.pressureImage.imageUrl
          ? {
            ...entry.result.thoughtExperiment.pressureImage,
            imageUrl: imageMap[buildSceneImageKey(entry.id, 'pressure')] || entry.result.thoughtExperiment.pressureImage.imageUrl,
          }
          : entry.result.thoughtExperiment.pressureImage,
      }
      : entry.result.thoughtExperiment,
    magazineImages: mergeMagazineImagesFromStore(entry.id, entry.result.magazineImages, imageMap),
  },
});

export const collectAvatarKeys = (entry: HistoryEntry): string[] => {
  const keys = entry.result.voices
    .filter((voice) => !!voice.avatar)
    .map((voice) => buildAvatarKey(entry.id, voice.id));
  if (entry.result.thoughtExperiment?.sceneImage) keys.push(buildSceneImageKey(entry.id, 'scene'));
  if (entry.result.thoughtExperiment?.pressureImage) keys.push(buildSceneImageKey(entry.id, 'pressure'));
  if (entry.result.magazineImages) {
    (Object.keys(entry.result.magazineImages) as Array<keyof NonNullable<AnalysisResult['magazineImages']>>)
      .forEach((slot) => keys.push(buildMagazineImageKey(entry.id, slot)));
  }
  return keys;
};

export const persistEntryAvatars = async (entry: HistoryEntry): Promise<void> => {
  const { images } = splitAvatarsForStorage(entry);
  if (images.length === 0) return;
  await Promise.all(images.map(({ key, imageUrl }) => putAvatarImage(key, imageUrl)));
};

export const hydrateEntriesWithAvatars = async (entries: HistoryEntry[]): Promise<HistoryEntry[]> => {
  if (entries.length === 0) return entries;
  const keys: string[] = [];
  entries.forEach((entry) => {
    entry.result.voices.forEach((voice) => {
      if (voice.avatar && !voice.avatar.imageUrl) {
        keys.push(buildAvatarKey(entry.id, voice.id));
      }
    });
    if (entry.result.thoughtExperiment?.sceneImage && !entry.result.thoughtExperiment.sceneImage.imageUrl) {
      keys.push(buildSceneImageKey(entry.id, 'scene'), buildSceneImageKey(entry.id));
    }
    if (entry.result.thoughtExperiment?.pressureImage && !entry.result.thoughtExperiment.pressureImage.imageUrl) {
      keys.push(buildSceneImageKey(entry.id, 'pressure'));
    }
    if (entry.result.magazineImages) {
      (Object.keys(entry.result.magazineImages) as Array<keyof NonNullable<AnalysisResult['magazineImages']>>)
        .forEach((slot) => {
          const image = entry.result.magazineImages?.[slot];
          if (image && !image.imageUrl) keys.push(buildMagazineImageKey(entry.id, slot));
        });
    }
  });
  if (keys.length === 0) return entries;
  const imageMap = await getAvatarImages(keys);
  if (Object.keys(imageMap).length === 0) return entries;
  return entries.map((entry) => mergeAvatarsFromStore(entry, imageMap));
};

export const saveHistory = (entries: HistoryEntry[]): HistoryEntry[] => {
  const trimmed = entries.slice(0, HISTORY_LIMIT);
  const tryWriteLean = (candidate: HistoryEntry[]): boolean => {
    const lean = candidate.map((entry) => splitAvatarsForStorage(entry).lean);
    return historyStore.set(lean);
  };

  if (tryWriteLean(trimmed)) return trimmed;

  let candidate = trimmed;
  while (candidate.length > 0) {
    candidate = candidate.slice(0, -1);
    if (candidate.length === 0) break;
    if (tryWriteLean(candidate)) {
      console.warn(`[sophia] history metadata too large; kept ${candidate.length} most recent entries.`);
      return candidate;
    }
  }

  historyStore.remove();
  console.warn('[sophia] localStorage exhausted — history not persisted; in-memory only.');
  return [];
};

const isHistoryEntry = (value: unknown): value is HistoryEntry => {
  const item = value as Partial<HistoryEntry> | null;
  const result = item?.result as Partial<AnalysisResult> | undefined;
  return !!item
    && typeof item.id === 'string'
    && typeof item.topic === 'string'
    && typeof item.title === 'string'
    && typeof item.createdAt === 'string'
    && !!result
    && typeof result.id === 'string'
    && typeof result.topic === 'string'
    && typeof result.philosophical_title === 'string'
    && Array.isArray(result.voices)
    && Array.isArray(result.tensions)
    && Array.isArray(result.followUps);
};

export const extractImportedHistory = (value: unknown): HistoryEntry[] => {
  if (Array.isArray(value)) return value.filter(isHistoryEntry);
  const maybeEntries = (value as { entries?: unknown })?.entries;
  if (Array.isArray(maybeEntries)) return maybeEntries.filter(isHistoryEntry);
  return [];
};

export const buildHistoryBackupFilename = () => `sophia-history-${new Date().toISOString().slice(0, 10)}.json`;

export const maybeMigrateLegacyAvatars = async (): Promise<void> => {
  if (typeof localStorage === 'undefined') return;
  if (safeLocalStorageGet(IDB_MIGRATION_FLAG) === '1') return;
  const entries = loadHistory();
  const preset = loadGeneratedPreset();
  const all = preset ? [preset, ...entries] : entries;
  const hasInline = all.some((entry) =>
    entry.result.voices.some((voice) => voice.avatar?.imageUrl?.startsWith('data:'))
      || Object.values(entry.result.magazineImages || {}).some((image) => image?.imageUrl?.startsWith('data:')),
  );
  if (hasInline) {
    await Promise.all(all.map(persistEntryAvatars));
    saveHistory(entries);
    if (preset) {
      if (!presetStore.set(splitAvatarsForStorage(preset).lean)) return;
    }
    console.info('[sophia] migrated inline avatars to IndexedDB');
  }
  safeLocalStorageSet(IDB_MIGRATION_FLAG, '1');
};
