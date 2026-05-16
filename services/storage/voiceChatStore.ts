import type { Message } from '../../types/chat';

const KEY = 'sophia.voiceChats.v1';
const MAX_MESSAGES_PER_VOICE = 60;

type Store = Record<string /* analysisId */, Record<string /* voiceId */, Message[]>>;

const isQuotaError = (error: unknown): boolean => {
  if (!error) return false;
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.code === 22;
  }
  const name = (error as { name?: string })?.name;
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
};

const readStore = (): Store => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Store : {};
  } catch {
    return {};
  }
};

const writeStore = (store: Store): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch (error) {
    if (!isQuotaError(error)) return;
    // Quota: drop the oldest analysis bucket and retry once. Iteration order
    // matches insertion order for non-numeric keys, so the first key is the
    // earliest one we wrote — close enough for "evict oldest".
    const ids = Object.keys(store);
    if (ids.length === 0) return;
    delete store[ids[0]];
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
    } catch {
      /* give up — chat will live in memory only this session */
    }
  }
};

export const loadVoiceChat = (analysisId: string, voiceId: string): Message[] => {
  const store = readStore();
  const messages = store[analysisId]?.[voiceId];
  return Array.isArray(messages) ? messages : [];
};

export const saveVoiceChat = (analysisId: string, voiceId: string, messages: Message[]): void => {
  const store = readStore();
  if (!store[analysisId]) store[analysisId] = {};
  store[analysisId][voiceId] = messages.slice(-MAX_MESSAGES_PER_VOICE);
  writeStore(store);
};

export const clearVoiceChat = (analysisId: string, voiceId: string): void => {
  const store = readStore();
  const bucket = store[analysisId];
  if (!bucket) return;
  delete bucket[voiceId];
  if (Object.keys(bucket).length === 0) delete store[analysisId];
  writeStore(store);
};
