/**
 * Generic IndexedDB key-value abstraction.
 *
 * Why this exists: imageStore.ts proved a clean failure model — every IDB
 * call resolves to a safe empty value, callers never need try/catch. As we
 * add more local-only stores (run snapshots, stage cache, reflection notes)
 * we want the same semantics without copy-pasting the open / transaction
 * boilerplate four times.
 *
 * Each created store owns one IndexedDB database with one object store.
 * Keeping them in separate DBs (instead of one DB with many stores) avoids
 * forcing a schema migration whenever a new feature lands.
 *
 * Failure model:
 * - All operations are best-effort. Errors are logged with a tag and resolved
 *   to a safe empty value (null / [] / undefined). The UI must keep working
 *   when IDB is unavailable (private mode, exceeded quota, etc).
 * - Operations are async. Callers should kick them off in effects / event
 *   handlers, never block the initial render.
 */

export const isIndexedDbAvailable = (): boolean =>
  typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';

export interface KeyValueStore<T> {
  /** Read one value by key. Returns null when missing or on error. */
  get: (key: string) => Promise<T | null>;
  /** Read many values at once. Missing keys are omitted. */
  getMany: (keys: string[]) => Promise<Record<string, T>>;
  /** Write or overwrite a value. Resolves even if the write fails. */
  put: (key: string, value: T) => Promise<void>;
  /** Delete one or many keys. Missing keys are ignored. */
  del: (keys: string | string[]) => Promise<void>;
  /** List every key currently in the store. */
  listKeys: () => Promise<string[]>;
  /** List every (key, value) pair. Use sparingly on large stores. */
  listEntries: () => Promise<Array<{ key: string; value: T }>>;
  /** Wipe the store. */
  clear: () => Promise<void>;
}

interface CreateStoreOptions {
  /** Database name. Each store owns one DB. Bump if the schema needs to break. */
  dbName: string;
  /** Object store name inside the DB. */
  storeName: string;
  /** Schema version. Increment when adding indexes (none today, but reserved). */
  version?: number;
  /**
   * Tag used in console.warn / console.info so multiple stores don't fight
   * over the same `[sophia]` prefix in DevTools.
   */
  logTag?: string;
}

/**
 * Build a fresh store handle. Safe to call at module top level — opening the
 * DB is lazy, so import order doesn't trigger any IDB activity.
 */
export const createKeyValueStore = <T>(options: CreateStoreOptions): KeyValueStore<T> => {
  const { dbName, storeName, version = 1, logTag = `[sophia:${dbName}]` } = options;
  let dbPromise: Promise<IDBDatabase | null> | null = null;

  const openDB = (): Promise<IDBDatabase | null> => {
    if (!isIndexedDbAvailable()) return Promise.resolve(null);
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(dbName, version);
      } catch (error) {
        console.warn(`${logTag} indexedDB.open threw:`, error);
        resolve(null);
        return;
      }
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn(`${logTag} open failed:`, request.error);
        resolve(null);
      };
      request.onblocked = () => {
        console.warn(`${logTag} open blocked (another tab holds an older version)`);
        resolve(null);
      };
    });
    return dbPromise;
  };

  const get = async (key: string): Promise<T | null> => {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readonly');
      } catch {
        resolve(null);
        return;
      }
      const req = tx.objectStore(storeName).get(key);
      req.onsuccess = () => resolve((req.result as T | undefined) ?? null);
      req.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    });
  };

  const getMany = async (keys: string[]): Promise<Record<string, T>> => {
    if (keys.length === 0) return {};
    const db = await openDB();
    if (!db) return {};
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readonly');
      } catch {
        resolve({});
        return;
      }
      const store = tx.objectStore(storeName);
      const result: Record<string, T> = {};
      keys.forEach((key) => {
        const req = store.get(key);
        req.onsuccess = () => {
          if (req.result !== undefined) result[key] = req.result as T;
        };
        // individual errors swallowed; tx.oncomplete / onerror handle overall outcome
      });
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => resolve(result);
      tx.onabort = () => resolve(result);
    });
  };

  const put = async (key: string, value: T): Promise<void> => {
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readwrite');
      } catch {
        resolve();
        return;
      }
      tx.objectStore(storeName).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => {
        console.warn(`${logTag} put(${key}) failed:`, tx.error);
        resolve();
      };
      tx.onabort = () => resolve();
    });
  };

  const del = async (keys: string | string[]): Promise<void> => {
    const list = Array.isArray(keys) ? keys : [keys];
    if (list.length === 0) return;
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readwrite');
      } catch {
        resolve();
        return;
      }
      const store = tx.objectStore(storeName);
      list.forEach((key) => store.delete(key));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  };

  const listKeys = async (): Promise<string[]> => {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readonly');
      } catch {
        resolve([]);
        return;
      }
      const req = tx.objectStore(storeName).getAllKeys();
      req.onsuccess = () => resolve((req.result as IDBValidKey[]).map((k) => String(k)));
      req.onerror = () => resolve([]);
      tx.onerror = () => resolve([]);
      tx.onabort = () => resolve([]);
    });
  };

  const listEntries = async (): Promise<Array<{ key: string; value: T }>> => {
    const db = await openDB();
    if (!db) return [];
    return new Promise((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readonly');
      } catch {
        resolve([]);
        return;
      }
      const store = tx.objectStore(storeName);
      const keysReq = store.getAllKeys();
      const valuesReq = store.getAll();
      let keys: string[] = [];
      let values: T[] = [];
      keysReq.onsuccess = () => { keys = (keysReq.result as IDBValidKey[]).map((k) => String(k)); };
      valuesReq.onsuccess = () => { values = valuesReq.result as T[]; };
      tx.oncomplete = () => {
        const out: Array<{ key: string; value: T }> = [];
        for (let i = 0; i < keys.length; i += 1) {
          out.push({ key: keys[i], value: values[i] });
        }
        resolve(out);
      };
      tx.onerror = () => resolve([]);
      tx.onabort = () => resolve([]);
    });
  };

  const clear = async (): Promise<void> => {
    const db = await openDB();
    if (!db) return;
    await new Promise<void>((resolve) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeName, 'readwrite');
      } catch {
        resolve();
        return;
      }
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    });
  };

  return { get, getMany, put, del, listKeys, listEntries, clear };
};
