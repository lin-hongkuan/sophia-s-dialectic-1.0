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
 */

const DB_NAME = 'sophia-images-v1';
const STORE_NAME = 'avatars';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

export const isImageStoreAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';

const openDB = (): Promise<IDBDatabase | null> => {
  if (!isImageStoreAvailable()) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn('[sophia] IndexedDB open failed:', request.error);
      resolve(null);
    };
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
};

export const buildAvatarKey = (entryId: string, voiceId: string): string =>
  `${entryId}::${voiceId}`;

export const putAvatarImage = async (key: string, imageUrl: string): Promise<void> => {
  if (!imageUrl) return;
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch {
      resolve();
      return;
    }
    const store = tx.objectStore(STORE_NAME);
    store.put(imageUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
};

export const getAvatarImages = async (keys: string[]): Promise<Record<string, string>> => {
  if (keys.length === 0) return {};
  const db = await openDB();
  if (!db) return {};
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readonly');
    } catch {
      resolve({});
      return;
    }
    const store = tx.objectStore(STORE_NAME);
    const result: Record<string, string> = {};
    keys.forEach((key) => {
      const req = store.get(key);
      req.onsuccess = () => {
        if (typeof req.result === 'string' && req.result) result[key] = req.result;
      };
      // ignore individual onerror — tx.oncomplete/onerror handles overall
    });
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => resolve(result);
    tx.onabort = () => resolve(result);
  });
};

export const deleteAvatarImages = async (keys: string[]): Promise<void> => {
  if (keys.length === 0) return;
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch {
      resolve();
      return;
    }
    const store = tx.objectStore(STORE_NAME);
    keys.forEach((key) => store.delete(key));
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
};

export const clearAvatarImages = async (): Promise<void> => {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readwrite');
    } catch {
      resolve();
      return;
    }
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
};

export const listAvatarKeys = async (): Promise<string[]> => {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE_NAME, 'readonly');
    } catch {
      resolve([]);
      return;
    }
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as IDBValidKey[]).map((k) => String(k));
      resolve(keys);
    };
    req.onerror = () => resolve([]);
    tx.onerror = () => resolve([]);
    tx.onabort = () => resolve([]);
  });
};
