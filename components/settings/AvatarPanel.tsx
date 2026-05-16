import React from 'react';
import { Check, Image as ImageIcon, RotateCcw, Sparkles } from 'lucide-react';
import {
  AVATAR_STYLE_PRESETS,
  DEFAULT_AVATAR_STYLE_PRESET_ID,
  type AvatarStylePreset,
  type PromptOverrides,
} from '../../services/prompts';
import { SectionHeader } from './SectionHeader';
import { AVATAR_PROMPT_DEFS } from './promptDefs';

interface AvatarPanelProps {
  promptOverrides: PromptOverrides;
  activeAvatarPresetId: string | null;
  onApplyAvatarPreset: (preset: AvatarStylePreset) => void;
  onPromptChange: (key: keyof PromptOverrides, value: string) => void;
  onResetPrompt: (key: keyof PromptOverrides) => void;
  onResetAllAvatarPrompts: () => void;
}

export const AvatarPanel: React.FC<AvatarPanelProps> = ({
  promptOverrides,
  activeAvatarPresetId,
  onApplyAvatarPreset,
  onPromptChange,
  onResetPrompt,
  onResetAllAvatarPrompts,
}) => (
  <section
    id="settings-panel-avatars"
    role="tabpanel"
    aria-labelledby="settings-tab-avatars"
    className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6"
  >
    <SectionHeader
      icon={<ImageIcon className="h-4 w-4" />}
      title="头像风格"
      description="思想声音卡片上的肖像视觉风格。先一键选预设，再到下方按需精调。改动会立即对下一次生成的头像生效，已生成的旧头像不会被替换。"
    />

    <div>
      <h3 className="text-[11px] font-mono uppercase tracking-widest text-museum-500">一键预设</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {AVATAR_STYLE_PRESETS.map((preset) => {
          const isActive = activeAvatarPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onApplyAvatarPreset(preset)}
              aria-pressed={isActive}
              className={`relative flex flex-col rounded-lg border px-4 py-3 text-left transition ${
                isActive
                  ? 'border-museum-700 bg-museum-900 text-museum-50 shadow'
                  : 'border-museum-200 bg-white/70 text-museum-800 hover:border-museum-400 hover:bg-white'
              }`}
            >
              <span className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? 'text-museum-200' : 'text-museum-500'}`}>
                {preset.id === DEFAULT_AVATAR_STYLE_PRESET_ID ? 'Default' : 'Preset'}
              </span>
              <span className="mt-1 font-serif text-base">{preset.label}</span>
              <span className={`mt-1 text-[11px] leading-snug ${isActive ? 'text-museum-200' : 'text-museum-500'}`}>
                {preset.description}
              </span>
              {isActive && (
                <span className="absolute right-3 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-museum-50 text-museum-900">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {activeAvatarPresetId === null && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] text-amber-800">
          <Sparkles className="h-3 w-3" />
          当前为自定义组合，未匹配任何预设。
        </p>
      )}
    </div>

    <div className="mt-7 border-t border-museum-200 pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[11px] font-mono uppercase tracking-widest text-museum-500">精调（覆盖具体字段）</h3>
        <button
          type="button"
          onClick={onResetAllAvatarPrompts}
          className="inline-flex items-center gap-1 rounded border border-museum-200 px-2 py-1 text-[11px] text-museum-600 hover:bg-museum-100"
        >
          <RotateCcw className="h-3 w-3" />
          全部恢复默认
        </button>
      </div>
      <div className="mt-4 space-y-5">
        {AVATAR_PROMPT_DEFS.map((def) => {
          const value = promptOverrides[def.key] ?? '';
          const isCustom = !!(value && value.trim());
          return (
            <details key={def.key} className="group rounded-lg border border-museum-200 bg-museum-50/40 px-4 py-3 open:bg-white/70" open={isCustom}>
              <summary className="flex cursor-pointer items-center justify-between gap-3 text-left">
                <div>
                  <p className="font-serif text-base text-museum-900">{def.label}</p>
                  <p className="text-[12px] text-museum-600">{def.description}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-mono tracking-widest ${
                  isCustom ? 'border-museum-700 bg-museum-900 text-museum-50' : 'border-museum-200 text-museum-500'
                }`}>
                  {isCustom ? '已覆盖' : '默认'}
                </span>
              </summary>
              <div className="mt-3">
                <textarea
                  value={value || def.defaultText}
                  onChange={(e) => onPromptChange(def.key, e.target.value)}
                  rows={5}
                  spellCheck={false}
                  className="w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-[12px] leading-relaxed focus:border-museum-700 focus:outline-none"
                />
                <div className="mt-2 flex items-center justify-between text-[11px] text-museum-500">
                  <span>{(value || def.defaultText).length} 字符</span>
                  <button
                    type="button"
                    onClick={() => onResetPrompt(def.key)}
                    className="inline-flex items-center gap-1 rounded border border-museum-200 px-2 py-1 hover:bg-museum-100"
                  >
                    <RotateCcw className="h-3 w-3" />
                    恢复默认
                  </button>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  </section>
);
