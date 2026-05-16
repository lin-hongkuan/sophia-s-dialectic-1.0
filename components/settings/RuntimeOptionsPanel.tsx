import React from 'react';
import { Sliders } from 'lucide-react';
import type { RuntimeOptions } from '../../services/sophiaConfig';
import { SectionHeader } from './SectionHeader';

interface RuntimeOptionsPanelProps {
  options: RuntimeOptions;
  onOptionChange: (patch: Partial<RuntimeOptions>) => void;
}

export const RuntimeOptionsPanel: React.FC<RuntimeOptionsPanelProps> = ({ options, onOptionChange }) => (
  <section
    id="settings-panel-options"
    role="tabpanel"
    aria-labelledby="settings-tab-options"
    className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6"
  >
    <SectionHeader
      icon={<Sliders className="h-4 w-4" />}
      title="运行参数"
      description="影响每次生成的 LLM 行为。改动后立即对下一次生成生效。"
    />
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Temperature</span>
          <span className="font-mono text-sm text-museum-800">{options.temperature.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1.2}
          step={0.02}
          value={options.temperature}
          onChange={(e) => onOptionChange({ temperature: Number(e.target.value) })}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-[11px] text-museum-500">越低越保守，越高越发散。默认 0.72。</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Voice 并发</span>
          <span className="font-mono text-sm text-museum-800">{options.voiceConcurrency}</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={options.voiceConcurrency}
          onChange={(e) => onOptionChange({ voiceConcurrency: Number(e.target.value) })}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-[11px] text-museum-500">同时生成的思想声音数。默认 2。提高更快，但更易触发限流。</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Avatar 并发</span>
          <span className="font-mono text-sm text-museum-800">{options.avatarConcurrency}</span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={options.avatarConcurrency}
          onChange={(e) => onOptionChange({ avatarConcurrency: Number(e.target.value) })}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-[11px] text-museum-500">同时排队的头像图像请求数。默认 2。如果上游图像服务 CPU 过载，可调到 1。</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Image retry</span>
          <span className="font-mono text-sm text-museum-800">{options.imageRetryCount}</span>
        </div>
        <input
          type="range"
          min={0}
          max={5}
          step={1}
          value={options.imageRetryCount}
          onChange={(e) => onOptionChange({ imageRetryCount: Number(e.target.value) })}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-[11px] text-museum-500">图片生成失败后的额外重试次数。默认 2；设为 0 表示不重试。</p>
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Voice max tokens</span>
          <span className="font-mono text-sm text-museum-800">{options.voiceMaxTokens}</span>
        </div>
        <input
          type="range"
          min={2000}
          max={12000}
          step={500}
          value={options.voiceMaxTokens}
          onChange={(e) => onOptionChange({ voiceMaxTokens: Number(e.target.value) })}
          className="mt-2 w-full"
        />
        <p className="mt-1 text-[11px] text-museum-500">单个声音正文的输出上限。默认 7000。</p>
      </div>
    </div>
  </section>
);
