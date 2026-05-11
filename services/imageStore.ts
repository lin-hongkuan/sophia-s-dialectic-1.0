/**
 * IndexedDB-backed store for voice avatar imageUrls (base64 data URLs).
 *
 * Why this exists: avatar imageUrls are 200-300KB each and quickly blow past
 * localStorage's 5MB origin quota. IDB quota is typically 60% of disk, so
 * moving them here lets the history archive grow far beyond ~10 entries.
 *
 * Failure model: every operation catches errors and resolves to a safe empty
 * value. Callers never need to wrap in try/catch — the worst case is "avatars
 * don't persist across reloads", which the UI already handles via fallback.
 *
 * Implementation note: this file is a thin wrapper around the generic
 * `createKeyValueStore` abstraction in `indexedDbStore.ts`. The DB and store
 * names are unchanged from the original implementation, so existing data is
 * preserved across the refactor.
 */

import { createKeyValueStore, isIndexedDbAvailable } from './indexedDbStore';

const store = createKeyValueStore<string>({
  dbName: 'sophia-images-v1',
  storeName: 'avatars',
  version: 1,
  logTag: '[sophia:images]',
});

export const isImageStoreAvailable = isIndexedDbAvailable;

export const buildAvatarKey = (entryId: string, voiceId: string): string =>
  `${entryId}::${voiceId}`;

export const buildSceneImageKey = (entryId: string, variant = 'scene'): string =>
  `${entryId}::thought-experiment-${variant}`;

/**
 * Key layout used by the Roundtable feature. Living in a separate namespace
 * means an analysis voice id can never collide with a roundtable participant
 * id even if the application ever reused them.
 */
export const buildRoundtableAvatarKey = (sessionId: string, participantId: string): string =>
  `roundtable::${sessionId}::participant::${participantId}`;

export const putAvatarImage = async (key: string, imageUrl: string): Promise<void> => {
  if (!imageUrl) return;
  await store.put(key, imageUrl);
};

export const getAvatarImages = async (keys: string[]): Promise<Record<string, string>> => {
  if (keys.length === 0) return {};
  return store.getMany(keys);
};

export const deleteAvatarImages = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  await store.del(keys);
};

export const clearAvatarImages = async (): Promise<void> => {
  await store.clear();
};

export const listAvatarKeys = async (): Promise<string[]> => store.listKeys();
