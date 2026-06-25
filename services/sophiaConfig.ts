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
  imageModel: string;
}

export interface RuntimeOptions {
  /** Sampling temperature for chat completions. Default 0.72 (preserves prior behavior). */
  temperature: number;
  /** Max tokens for the long-form voice essay call. Default 7000. */
  voiceMaxTokens: number;
  /** Concurrency for parallel voice generation. Default 2. */
  voiceConcurrency: number;
  /** Concurrency for parallel avatar image generation. Default 2. Capped independently of
   *  voiceConcurrency so a slow image model can't pile up requests on the upstream provider. */
  avatarConcurrency: number;
  /** Extra retries after an image generation request fails. Default 2. */
  imageRetryCount: number;
}

export type AnalysisDepth = 'concise' | 'standard' | 'deep';
export type AnalysisExpressionStyle = 'academic' | 'plain' | 'sharp';
export type AnalysisEvidenceFocus = 'theory' | 'balanced' | 'practical';

export interface AnalysisProfile {
  depth: AnalysisDepth;
  expressionStyle: AnalysisExpressionStyle;
  evidenceFocus: AnalysisEvidenceFocus;
}

export interface SophiaSettings {
  activeProviderId: ProviderId;
  customProvider: CustomProvider;
  promptOverrides: PromptOverrides;
  options: RuntimeOptions;
  analysisProfile: AnalysisProfile;
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
  analysisProfile: AnalysisProfile;
  activeProviderId: ProviderId;
}

const DEFAULT_OPTIONS: RuntimeOptions = {
  temperature: 0.72,
  voiceMaxTokens: 7000,
  voiceConcurrency: 2,
  avatarConcurrency: 2,
  imageRetryCount: 2,
};

export const DEFAULT_ANALYSIS_PROFILE: AnalysisProfile = {
  depth: 'standard',
  expressionStyle: 'academic',
  evidenceFocus: 'balanced',
};

const DEFAULT_CUSTOM_PROVIDER: CustomProvider = {
  name: '自定义 LLM',
  baseUrl: process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1',
  apiKey: '',
  textModel: process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini',
  imageModel: process.env.SOPHIA_IMAGE_MODEL || 'gpt-image-2',
};

export const DEFAULT_SETTINGS: SophiaSettings = {
  activeProviderId: 'preset:gpt',
  customProvider: { ...DEFAULT_CUSTOM_PROVIDER },
  promptOverrides: {},
  options: { ...DEFAULT_OPTIONS },
  analysisProfile: { ...DEFAULT_ANALYSIS_PROFILE },
};

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const trimOrFallback = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
};

const normalizeBaseUrl = (value: unknown, fallback: string) => trimOrFallback(value, fallback).replace(/\/+$/, '');

const ENV_BASELINE = {
  apiKey: process.env.SOPHIA_API_KEY || '',
  apiBaseUrl: normalizeBaseUrl(process.env.SOPHIA_API_BASE_URL, 'https://api.linhongkuan.com/v1'),
  apiModel: process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini',
  apiProvider: process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible',
  avatarImageModel: process.env.SOPHIA_IMAGE_MODEL || 'gpt-image-2',
  avatarImageSize: process.env.SOPHIA_IMAGE_SIZE || '1024x1024',
  avatarAspectHint: process.env.SOPHIA_IMAGE_ASPECT_HINT || 'portrait 1:1.2 aspect ratio',
  presetGpt: process.env.SOPHIA_PRESET_GPT_MODEL || process.env.SOPHIA_API_MODEL || '',
  presetMimo: process.env.SOPHIA_PRESET_MIMO_MODEL || '',
  presetGrok: process.env.SOPHIA_PRESET_GROK_MODEL || '',
};

const cloneSettings = (settings: SophiaSettings): SophiaSettings => ({
  activeProviderId: settings.activeProviderId,
  customProvider: { ...settings.customProvider },
  promptOverrides: { ...settings.promptOverrides },
  options: { ...settings.options },
  analysisProfile: { ...settings.analysisProfile },
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
      name: trimOrFallback(cp.name, merged.customProvider.name),
      baseUrl: normalizeBaseUrl(cp.baseUrl, merged.customProvider.baseUrl),
      apiKey: trimOrFallback(cp.apiKey, merged.customProvider.apiKey),
      textModel: trimOrFallback(cp.textModel, merged.customProvider.textModel),
      imageModel: trimOrFallback(cp.imageModel, merged.customProvider.imageModel),
    };
  }

  if (source.promptOverrides && typeof source.promptOverrides === 'object') {
    const po = source.promptOverrides as PromptOverrides;
    merged.promptOverrides = {
      outlineSystem: typeof po.outlineSystem === 'string' ? po.outlineSystem : undefined,
      voiceSystem: typeof po.voiceSystem === 'string' ? po.voiceSystem : undefined,
      synthesisSystem: typeof po.synthesisSystem === 'string' ? po.synthesisSystem : undefined,
      topicReframeSystem: typeof po.topicReframeSystem === 'string' ? po.topicReframeSystem : undefined,
      thoughtVoiceAvatarStyle: typeof po.thoughtVoiceAvatarStyle === 'string' ? po.thoughtVoiceAvatarStyle : undefined,
      historicalPhilosopherAvatarStyle: typeof po.historicalPhilosopherAvatarStyle === 'string' ? po.historicalPhilosopherAvatarStyle : undefined,
      negativeAvatarPrompt: typeof po.negativeAvatarPrompt === 'string' ? po.negativeAvatarPrompt : undefined,
      historicalPhilosopherNegativeAvatarPrompt: typeof po.historicalPhilosopherNegativeAvatarPrompt === 'string' ? po.historicalPhilosopherNegativeAvatarPrompt : undefined,
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
      avatarConcurrency: typeof opt.avatarConcurrency === 'number' && opt.avatarConcurrency >= 1 && opt.avatarConcurrency <= 5
        ? Math.round(opt.avatarConcurrency) : merged.options.avatarConcurrency,
      imageRetryCount: typeof opt.imageRetryCount === 'number' && opt.imageRetryCount >= 0 && opt.imageRetryCount <= 5
        ? Math.round(opt.imageRetryCount) : merged.options.imageRetryCount,
    };
  }

  if (source.analysisProfile && typeof source.analysisProfile === 'object') {
    const profile = source.analysisProfile as Partial<AnalysisProfile>;
    merged.analysisProfile = {
      depth: profile.depth === 'concise' || profile.depth === 'standard' || profile.depth === 'deep'
        ? profile.depth : merged.analysisProfile.depth,
      expressionStyle: profile.expressionStyle === 'academic' || profile.expressionStyle === 'plain' || profile.expressionStyle === 'sharp'
        ? profile.expressionStyle : merged.analysisProfile.expressionStyle,
      evidenceFocus: profile.evidenceFocus === 'theory' || profile.evidenceFocus === 'balanced' || profile.evidenceFocus === 'practical'
        ? profile.evidenceFocus : merged.analysisProfile.evidenceFocus,
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
      apiBaseUrl: normalizeBaseUrl(cp.baseUrl, ENV_BASELINE.apiBaseUrl),
      apiModel: cp.textModel || ENV_BASELINE.apiModel,
      apiProvider: cp.name || DEFAULT_CUSTOM_PROVIDER.name,
      avatarImageModel: cp.imageModel || ENV_BASELINE.avatarImageModel,
      avatarImageSize: ENV_BASELINE.avatarImageSize,
      avatarAspectHint: ENV_BASELINE.avatarAspectHint,
      promptOverrides: settings.promptOverrides,
      options: settings.options,
      analysisProfile: settings.analysisProfile,
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
    analysisProfile: settings.analysisProfile,
    activeProviderId: settings.activeProviderId,
  };
};

export const isActiveConfigReady = (): boolean => {
  const cfg = getActiveConfig();
  return Boolean(cfg.apiKey && cfg.apiBaseUrl && cfg.apiModel);
};
