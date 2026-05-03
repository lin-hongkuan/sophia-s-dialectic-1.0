/**
 * Pre-configured model entries surfaced as cards on the Settings page.
 *
 * All presets share the same base URL (set via SOPHIA_API_BASE_URL env / GitHub Variable);
 * they only differ in the `model` field of the OpenAI-compatible request body. Operators
 * provision the model name per preset via `SOPHIA_PRESET_{GPT,MIMO,GROK}_MODEL` GitHub
 * Variables (or local `.env.local`); when an env var is empty, the preset is shown in a
 * disabled "未配置" state and is not selectable.
 */

import type { ProviderId } from './sophiaConfig';

export interface ModelPreset {
  id: ProviderId;
  label: string;
  /** Resolved model name from env. Empty string means "not provisioned". */
  modelName: string;
  configured: boolean;
  /** Operator hint shown when the preset is unconfigured. */
  hint: string;
}

const presetGptModel = process.env.SOPHIA_PRESET_GPT_MODEL || process.env.SOPHIA_API_MODEL || '';
const presetMimoModel = process.env.SOPHIA_PRESET_MIMO_MODEL || '';
const presetGrokModel = process.env.SOPHIA_PRESET_GROK_MODEL || '';

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'preset:gpt',
    label: 'GPT',
    modelName: presetGptModel,
    configured: presetGptModel.length > 0,
    hint: '请在 GitHub Variables 中设置 SOPHIA_PRESET_GPT_MODEL（或 .env.local 中的 SOPHIA_API_MODEL）后重新部署。',
  },
  {
    id: 'preset:mimo',
    label: 'MiMo',
    modelName: presetMimoModel,
    configured: presetMimoModel.length > 0,
    hint: '请在 GitHub Variables 中设置 SOPHIA_PRESET_MIMO_MODEL（或 .env.local）后重新部署。',
  },
  {
    id: 'preset:grok',
    label: 'Grok',
    modelName: presetGrokModel,
    configured: presetGrokModel.length > 0,
    hint: '请在 GitHub Variables 中设置 SOPHIA_PRESET_GROK_MODEL（或 .env.local）后重新部署。',
  },
];

export const getPreset = (id: ProviderId): ModelPreset | undefined =>
  MODEL_PRESETS.find((preset) => preset.id === id);
