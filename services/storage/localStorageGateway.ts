const isQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22;
  }
  const name = (error as { name?: string })?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
};

export interface LocalJsonStore<T> {
  get: () => T | null;
  set: (value: T) => boolean;
  remove: () => void;
}

export const createLocalJsonStore = <T>(key: string): LocalJsonStore<T> => ({
  get: () => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) as T : null;
    } catch {
      return null;
    }
  },
  set: (value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      return false;
    }
  },
  remove: () => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
});

export const safeLocalStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeLocalStorageSet = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (!isQuotaError(error)) throw error;
    return false;
  }
};
