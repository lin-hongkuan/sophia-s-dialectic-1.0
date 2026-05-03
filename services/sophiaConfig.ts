/**
 * Runtime configuration store for Sophia.
 *
 * `process.env.*` (injected by `vite.config.ts` at build time) holds the *defaults*.
 * Users can override the active provider, supply a BYO LLM, edit prompts, and tune
 * runtime knobs from the Settings page; those overrides live in localStorage under
 * `sophia.settings.v1`.
 *
 * `getActiveConfig()` returns the resolved view (override-on-default) and is what
 * `sophiaService.ts` calls before each request — so changing settings takes effect
 * without a reload.
 */

import type { PromptOverrides } from './prompts';

const STORAGE_KEY = 'sophia.settings.v1';

export type ProviderId = 'preset:gpt' | 'preset:mimo' | 'preset:grok' | 'custom';

export interface CustomProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  textModel: string;
}

export interface RuntimeOptions {
  /** Sampling temperature for chat completions. Default 0.72 (preserves prior behavior). */
  temperature: number;
  /** Max tokens for the long-form voice essay call. Default 7000. */
  voiceMaxTokens: number;
  /** Concurrency for parallel voice generation. Default 3. */
  voiceConcurrency: number;
}

export interface SophiaSettings {
  activeProviderId: ProviderId;
  customProvider: CustomProvider;
  promptOverrides: PromptOverrides;
  options: RuntimeOptions;
}

/** Resolved view: merges Settings overrides on top of the env baseline. */
export interface ResolvedSophiaConfig {
  apiKey: string;
  apiBaseUrl: string;
  apiModel: string;
  apiProvider: string;
  avatarImageModel: string;
  avatarImageSize: string;
  avatarAspectHint: string;
  promptOverrides: PromptOverrides;
  options: RuntimeOptions;
  activeProviderId: ProviderId;
}

const DEFAULT_OPTIONS: RuntimeOptions = {
  temperature: 0.72,
  voiceMaxTokens: 7000,
  voiceConcurrency: 3,
};

const DEFAULT_CUSTOM_PROVIDER: CustomProvider = {
  name: '自定义 LLM',
  baseUrl: process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1',
  apiKey: '',
  textModel: process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini',
};

export const DEFAULT_SETTINGS: SophiaSettings = {
  activeProviderId: 'preset:gpt',
  customProvider: { ...DEFAULT_CUSTOM_PROVIDER },
  promptOverrides: {},
  options: { ...DEFAULT_OPTIONS },
};

const ENV_BASELINE = {
  apiKey: process.env.SOPHIA_API_KEY || '',
  apiBaseUrl: (process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/$/, ''),
  apiModel: process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini',
  apiProvider: process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible',
  avatarImageModel: process.env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite',
  avatarImageSize: process.env.SOPHIA_IMAGE_SIZE || '1024x1024',
  avatarAspectHint: process.env.SOPHIA_IMAGE_ASPECT_HINT || 'portrait 1:1.2 aspect ratio',
  presetGpt: process.env.SOPHIA_PRESET_GPT_MODEL || process.env.SOPHIA_API_MODEL || '',
  presetMimo: process.env.SOPHIA_PRESET_MIMO_MODEL || '',
  presetGrok: process.env.SOPHIA_PRESET_GROK_MODEL || '',
};

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const cloneSettings = (settings: SophiaSettings): SophiaSettings => ({
  activeProviderId: settings.activeProviderId,
  customProvider: { ...settings.customProvider },
  promptOverrides: { ...settings.promptOverrides },
  options: { ...settings.options },
});

const sanitizeSettings = (raw: unknown): SophiaSettings => {
  const merged = cloneSettings(DEFAULT_SETTINGS);
  if (!raw || typeof raw !== 'object') return merged;
  const source = raw as Partial<SophiaSettings>;

  if (
    source.activeProviderId === 'preset:gpt'
    || source.activeProviderId === 'preset:mimo'
    || source.activeProviderId === 'preset:grok'
    || source.activeProviderId === 'custom'
  ) {
    merged.activeProviderId = source.activeProviderId;
  }

  if (source.customProvider && typeof source.customProvider === 'object') {
    const cp = source.customProvider as Partial<CustomProvider>;
    merged.customProvider = {
      name: typeof cp.name === 'string' ? cp.name : merged.customProvider.name,
      baseUrl: typeof cp.baseUrl === 'string' ? cp.baseUrl : merged.customProvider.baseUrl,
      apiKey: typeof cp.apiKey === 'string' ? cp.apiKey : merged.customProvider.apiKey,
      textModel: typeof cp.textModel === 'string' ? cp.textModel : merged.customProvider.textModel,
    };
  }

  if (source.promptOverrides && typeof source.promptOverrides === 'object') {
    const po = source.promptOverrides as PromptOverrides;
    merged.promptOverrides = {
      outlineSystem: typeof po.outlineSystem === 'string' ? po.outlineSystem : undefined,
      voiceSystem: typeof po.voiceSystem === 'string' ? po.voiceSystem : undefined,
      synthesisSystem: typeof po.synthesisSystem === 'string' ? po.synthesisSystem : undefined,
    };
  }

  if (source.options && typeof source.options === 'object') {
    const opt = source.options as Partial<RuntimeOptions>;
    merged.options = {
      temperature: typeof opt.temperature === 'number' && opt.temperature >= 0 && opt.temperature <= 2
        ? opt.temperature : merged.options.temperature,
      voiceMaxTokens: typeof opt.voiceMaxTokens === 'number' && opt.voiceMaxTokens >= 1000 && opt.voiceMaxTokens <= 16000
        ? Math.round(opt.voiceMaxTokens) : merged.options.voiceMaxTokens,
      voiceConcurrency: typeof opt.voiceConcurrency === 'number' && opt.voiceConcurrency >= 1 && opt.voiceConcurrency <= 5
        ? Math.round(opt.voiceConcurrency) : merged.options.voiceConcurrency,
    };
  }

  return merged;
};

const loadFromStorage = (): SophiaSettings => {
  if (!isBrowser) return cloneSettings(DEFAULT_SETTINGS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSettings(DEFAULT_SETTINGS);
    return sanitizeSettings(JSON.parse(raw));
  } catch {
    return cloneSettings(DEFAULT_SETTINGS);
  }
};

let cachedSettings: SophiaSettings = loadFromStorage();
const listeners = new Set<(settings: SophiaSettings) => void>();

const persist = (settings: SophiaSettings) => {
  if (!isBrowser) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    // localStorage may be full or disabled (private mode). Surface a warning but don't crash.
    // eslint-disable-next-line no-console
    console.warn('[sophia][config] failed to persist settings:', error);
  }
};

const notify = () => {
  const snapshot = cloneSettings(cachedSettings);
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[sophia][config] subscriber threw:', error);
    }
  });
};

export const getSettings = (): SophiaSettings => cloneSettings(cachedSettings);

export const updateSettings = (
  partial: Partial<SophiaSettings> | ((current: SophiaSettings) => Partial<SophiaSettings>),
): SophiaSettings => {
  const next = sanitizeSettings({
    ...cachedSettings,
    ...(typeof partial === 'function' ? partial(cachedSettings) : partial),
  });
  cachedSettings = next;
  persist(next);
  notify();
  return cloneSettings(next);
};

export const subscribe = (listener: (settings: SophiaSettings) => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const resetToDefaults = (): SophiaSettings => {
  cachedSettings = cloneSettings(DEFAULT_SETTINGS);
  persist(cachedSettings);
  notify();
  return cloneSettings(cachedSettings);
};

export const exportSettings = (): string => JSON.stringify(cachedSettings, null, 2);

export const importSettings = (json: string): SophiaSettings => {
  const parsed = JSON.parse(json);
  cachedSettings = sanitizeSettings(parsed);
  persist(cachedSettings);
  notify();
  return cloneSettings(cachedSettings);
};

/** Resolve which model name corresponds to a preset id, given current env. */
export const presetModelFor = (id: ProviderId): string => {
  switch (id) {
    case 'preset:gpt': return ENV_BASELINE.presetGpt;
    case 'preset:mimo': return ENV_BASELINE.presetMimo;
    case 'preset:grok': return ENV_BASELINE.presetGrok;
    default: return '';
  }
};

/**
 * Resolve the active runtime config: which provider / key / model / options to use right now.
 * Called before each network request from `services/sophiaService.ts`.
 */
export const getActiveConfig = (): ResolvedSophiaConfig => {
  const settings = cachedSettings;

  if (settings.activeProviderId === 'custom') {
    const cp = settings.customProvider;
    return {
      apiKey: cp.apiKey || ENV_BASELINE.apiKey,
      apiBaseUrl: (cp.baseUrl || ENV_BASELINE.apiBaseUrl).replace(/\/$/, ''),
      apiModel: cp.textModel || ENV_BASELINE.apiModel,
      apiProvider: ENV_BASELINE.apiProvider,
      avatarImageModel: ENV_BASELINE.avatarImageModel,
      avatarImageSize: ENV_BASELINE.avatarImageSize,
      avatarAspectHint: ENV_BASELINE.avatarAspectHint,
      promptOverrides: settings.promptOverrides,
      options: settings.options,
      activeProviderId: settings.activeProviderId,
    };
  }

  const presetModel = presetModelFor(settings.activeProviderId);
  return {
    apiKey: ENV_BASELINE.apiKey,
    apiBaseUrl: ENV_BASELINE.apiBaseUrl,
    apiModel: presetModel || ENV_BASELINE.apiModel,
    apiProvider: ENV_BASELINE.apiProvider,
    avatarImageModel: ENV_BASELINE.avatarImageModel,
    avatarImageSize: ENV_BASELINE.avatarImageSize,
    avatarAspectHint: ENV_BASELINE.avatarAspectHint,
    promptOverrides: settings.promptOverrides,
    options: settings.options,
    activeProviderId: settings.activeProviderId,
  };
};
