import React from 'react';
import { AlertTriangle, Check, Cpu, Plug, ShieldAlert } from 'lucide-react';
import type { CustomProvider, ProviderId, SophiaSettings } from '../../services/sophiaConfig';
import type { ModelPreset } from '../../services/modelPresets';
import { SectionHeader } from './SectionHeader';
import type { TestConnectionState } from './types';

const ProviderCard: React.FC<{
  preset: ModelPreset;
  isActive: boolean;
  onSelect: () => void;
}> = ({ preset, isActive, onSelect }) => {
  const disabled = !preset.configured;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={isActive}
      title={disabled ? preset.hint : preset.modelName}
      className={`relative flex flex-col rounded-lg border px-4 py-3 text-left transition ${
        isActive
          ? 'border-museum-700 bg-museum-900 text-museum-50 shadow'
          : disabled
            ? 'border-museum-200 bg-museum-100/40 text-museum-400 cursor-not-allowed'
            : 'border-museum-200 bg-white/70 text-museum-800 hover:border-museum-400 hover:bg-white'
      }`}
    >
      <span className={`text-[10px] font-mono uppercase tracking-widest ${isActive ? 'text-museum-200' : 'text-museum-500'}`}>
        {preset.id === 'custom' ? 'Custom' : 'Preset'}
      </span>
      <span className="mt-1 font-serif text-lg">{preset.label}</span>
      <span className={`mt-1 truncate font-mono text-[11px] ${isActive ? 'text-museum-200' : 'text-museum-500'}`}>
        {preset.configured ? preset.modelName : '未配置'}
      </span>
      {isActive && (
        <span className="absolute right-3 top-3 inline-flex h-4 w-4 items-center justify-center rounded-full bg-museum-50 text-museum-900">
          <Check className="h-3 w-3" />
        </span>
      )}
      {!preset.configured && !isActive && (
        <span className="mt-2 text-[10px] leading-snug text-museum-500">{preset.hint}</span>
      )}
    </button>
  );
};

interface ProviderPanelProps {
  settings: SophiaSettings;
  presetCards: ModelPreset[];
  testState: TestConnectionState;
  onSelectProvider: (id: ProviderId) => void;
  onCustomChange: (patch: Partial<CustomProvider>) => void;
  onTestConnection: () => void | Promise<void>;
}

export const ProviderPanel: React.FC<ProviderPanelProps> = ({
  settings,
  presetCards,
  testState,
  onSelectProvider,
  onCustomChange,
  onTestConnection,
}) => {
  const isCustomActive = settings.activeProviderId === 'custom';

  return (
    <section
      id="settings-panel-provider"
      role="tabpanel"
      aria-labelledby="settings-tab-provider"
      className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6"
    >
      <SectionHeader
        icon={<Cpu className="h-4 w-4" />}
        title="生成模型"
        description="在预置模型间切换，或填入你自己的 OpenAI-compatible 网关。生图模型保留默认（grok-imagine-image-lite），不进入运行时切换。"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {presetCards.map((preset) => (
          <ProviderCard
            key={preset.id}
            preset={preset}
            isActive={settings.activeProviderId === preset.id}
            onSelect={() => onSelectProvider(preset.id)}
          />
        ))}
      </div>

      {isCustomActive && (
        <div className="mt-6 rounded-lg border border-museum-200 bg-museum-50/60 p-5">
          <h3 className="font-serif text-base text-museum-900">自定义 LLM</h3>
          <p className="mt-1 text-[12px] text-museum-600">
            兼容 OpenAI Chat Completions 协议（`/v1/chat/completions`）。Key 与 baseUrl 仅保存在此浏览器。
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">展示名</span>
              <input
                type="text"
                value={settings.customProvider.name}
                onChange={(e) => onCustomChange({ name: e.target.value })}
                className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 text-sm focus:border-museum-700 focus:outline-none"
                placeholder="My LLM"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">文本模型名（model）</span>
              <input
                type="text"
                value={settings.customProvider.textModel}
                onChange={(e) => onCustomChange({ textModel: e.target.value })}
                className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                placeholder="gpt-4o-mini"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">生图模型名（Image model）</span>
              <input
                type="text"
                value={settings.customProvider.imageModel ?? ''}
                onChange={(e) => onCustomChange({ imageModel: e.target.value })}
                className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                placeholder="grok-imagine-image-lite"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Base URL</span>
              <input
                type="text"
                value={settings.customProvider.baseUrl}
                onChange={(e) => onCustomChange({ baseUrl: e.target.value })}
                className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">API Key</span>
              <input
                type="password"
                value={settings.customProvider.apiKey}
                onChange={(e) => onCustomChange({ apiKey: e.target.value })}
                className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                placeholder="sk-..."
                autoComplete="off"
              />
            </label>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-800">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>API key 仅本地保存，但任何能访问此浏览器的人都能读到它，导出 settings.json 也包含此 key。请避免在公共设备上填写。</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-museum-200 pt-4">
        <button
          type="button"
          onClick={onTestConnection}
          disabled={testState.status === 'testing'}
          className="inline-flex items-center gap-2 rounded border border-museum-700 bg-museum-900 px-4 py-2 text-sm text-museum-50 transition hover:bg-museum-800 disabled:opacity-60"
        >
          <Plug className="h-4 w-4" />
          {testState.status === 'testing' ? '正在测试...' : '测试连接'}
        </button>
        <span aria-live="polite" aria-atomic="true">
          {testState.status === 'testing' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-museum-50 px-3 py-1 text-[11px] text-museum-700">
              正在测试当前连接...
            </span>
          )}
          {testState.status === 'ok' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-800">
              <Check className="h-3 w-3" />
              成功 · {testState.latencyMs}ms
            </span>
          )}
          {testState.status === 'failed' && (
            <span className="inline-flex items-start gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[11px] text-red-800">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              {testState.message}
            </span>
          )}
        </span>
      </div>
    </section>
  );
};
