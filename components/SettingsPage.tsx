import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings as SettingsIcon, Sparkles, ShieldAlert, Database, Cpu, FileText, Sliders, BarChart3, Plug, RotateCcw, Download, Upload, Trash2, Check, AlertTriangle, Image as ImageIcon, Copy } from 'lucide-react';
import {
  CustomProvider,
  ProviderId,
  SophiaSettings,
  exportSettings,
  getActiveConfig,
  getSettings,
  importSettings,
  resetToDefaults,
  subscribe,
  updateSettings,
} from '../services/sophiaConfig';
import { MODEL_PRESETS, ModelPreset } from '../services/modelPresets';
import {
  AVATAR_STYLE_PRESETS,
  AvatarStylePreset,
  DEFAULT_AVATAR_STYLE_PRESET_ID,
  DEFAULT_OUTLINE_SYSTEM_PROMPT,
  DEFAULT_SYNTHESIS_SYSTEM_PROMPT,
  DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT,
  DEFAULT_VOICE_SYSTEM_PROMPT,
  HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
  HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
  NEGATIVE_AVATAR_PROMPT,
  PromptOverrides,
  THOUGHT_VOICE_AVATAR_STYLE,
} from '../services/prompts';
import {
  UsageTotals,
  clearAll as clearTokenAccounting,
  exportCsv as exportTokenCsv,
  getTotals,
} from '../services/tokenAccounting';
import { STAGE_LABEL } from '../constants';
import { PageHero } from './PageHero';

interface SettingsPageProps {
  onBack: () => void;
}

type SectionId = 'provider' | 'prompts' | 'avatars' | 'options' | 'tokens' | 'data';

interface PromptDef {
  key: keyof PromptOverrides;
  label: string;
  description: string;
  defaultText: string;
}

const PROMPT_DEFS: PromptDef[] = [
  {
    key: 'outlineSystem',
    label: '问题图谱（outline）',
    description: '决定大问题、分析路径、思想声音名单的生成。',
    defaultText: DEFAULT_OUTLINE_SYSTEM_PROMPT,
  },
  {
    key: 'voiceSystem',
    label: '思想声音长文（voice）',
    description: '每个思想声音 1800-2400 字论述的写作风格与引用规范。',
    defaultText: DEFAULT_VOICE_SYSTEM_PROMPT,
  },
  {
    key: 'synthesisSystem',
    label: '综合判断（synthesis）',
    description: '声音之间的张力、关键词、综合结论的生成。',
    defaultText: DEFAULT_SYNTHESIS_SYSTEM_PROMPT,
  },
  {
    key: 'topicReframeSystem',
    label: '问题转译（topic reframe）',
    description: '判断用户输入是否需要转译，以及生成 3 个候选哲学化标题的规则。',
    defaultText: DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT,
  },
];

interface AvatarPromptDef {
  key: keyof PromptOverrides;
  label: string;
  description: string;
  defaultText: string;
  presetField: keyof Pick<AvatarStylePreset, 'thoughtVoice' | 'historicalPhilosopher' | 'negative' | 'historicalPhilosopherNegative'>;
}

const AVATAR_PROMPT_DEFS: AvatarPromptDef[] = [
  {
    key: 'thoughtVoiceAvatarStyle',
    label: '思想声音头像风格',
    description: '所有非历史哲学家头像的视觉风格描述（思想流派 / 概念 / 立场 / 当代批评者）。',
    defaultText: THOUGHT_VOICE_AVATAR_STYLE,
    presetField: 'thoughtVoice',
  },
  {
    key: 'historicalPhilosopherAvatarStyle',
    label: '历史哲学家头像风格',
    description: '当声音是真实历史哲学家时使用的视觉风格。通常需要更写实、更尊重时代特征。',
    defaultText: HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
    presetField: 'historicalPhilosopher',
  },
  {
    key: 'negativeAvatarPrompt',
    label: '思想声音负向提示',
    description: '附加在思想声音头像 prompt 末尾，告诉模型应避免什么（文字、水印、变形等）。',
    defaultText: NEGATIVE_AVATAR_PROMPT,
    presetField: 'negative',
  },
  {
    key: 'historicalPhilosopherNegativeAvatarPrompt',
    label: '历史哲学家负向提示',
    description: '附加在历史哲学家头像 prompt 末尾的负向约束。',
    defaultText: HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
    presetField: 'historicalPhilosopherNegative',
  },
];

type TestConnectionState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; latencyMs: number }
  | { status: 'failed'; message: string };

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};

const lineCount = (value: string): number => value ? value.split(/\r\n|\r|\n/).length : 0;

const downloadBlob = (filename: string, mime: string, content: string) => {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; description?: string }> = ({ icon, title, description }) => (
  <div className="mb-4 flex items-start gap-3">
    <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-museum-300/80 bg-museum-50 text-museum-700">
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <h2 className="font-serif text-xl text-museum-900">{title}</h2>
      {description && <p className="mt-1 text-[13px] leading-relaxed text-museum-600">{description}</p>}
    </div>
  </div>
);

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

const Bar: React.FC<{ label: string; value: number; total: number; subtitle?: string }> = ({ label, value, total, subtitle }) => {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[12px] text-museum-700">{label}</span>
        <span className="shrink-0 font-mono text-[11px] text-museum-600">
          {formatNumber(value)}{subtitle ? ` · ${subtitle}` : ''}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-museum-100">
        <div className="h-full bg-museum-700/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const SettingsPage: React.FC<SettingsPageProps> = () => {
  const [settings, setSettingsState] = useState<SophiaSettings>(() => getSettings());
  const [active, setActive] = useState<SectionId>('provider');
  const [testState, setTestState] = useState<TestConnectionState>({ status: 'idle' });
  const [tokens, setTokens] = useState<UsageTotals>(() => getTotals());
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [copiedPromptKey, setCopiedPromptKey] = useState<keyof PromptOverrides | null>(null);
  const [activePromptKey, setActivePromptKey] = useState<keyof PromptOverrides>(PROMPT_DEFS[0].key);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = subscribe((next) => setSettingsState(next));
    return () => {
      unsubscribe();
    };
  }, []);

  const refreshTokens = () => setTokens(getTotals());

  const presetCards = useMemo<ModelPreset[]>(() => [
    ...MODEL_PRESETS,
    {
      id: 'custom' as ProviderId,
      label: settings.customProvider.name || '自定义 LLM',
      modelName: settings.customProvider.textModel || '未填写',
      configured: true,
      hint: '使用你自己的 OpenAI-compatible 网关。',
    },
  ], [settings.customProvider.name, settings.customProvider.textModel]);

  const handleSelectProvider = (id: ProviderId) => {
    updateSettings({ activeProviderId: id });
    setTestState({ status: 'idle' });
  };

  const handleCustomChange = (patch: Partial<CustomProvider>) => {
    updateSettings((current) => ({
      customProvider: { ...current.customProvider, ...patch },
    }));
  };

  const handleOptionChange = (patch: Partial<SophiaSettings['options']>) => {
    updateSettings((current) => ({ options: { ...current.options, ...patch } }));
  };

  const handlePromptChange = (key: keyof PromptOverrides, value: string) => {
    updateSettings((current) => {
      const next = { ...current.promptOverrides };
      if (value.length === 0) delete next[key];
      else next[key] = value;
      return { promptOverrides: next };
    });
  };

  const handleResetPrompt = (key: keyof PromptOverrides) => {
    updateSettings((current) => {
      const next = { ...current.promptOverrides };
      delete next[key];
      return { promptOverrides: next };
    });
  };

  const handleResetAllCorePrompts = () => {
    updateSettings((current) => {
      const next = { ...current.promptOverrides };
      PROMPT_DEFS.forEach((def) => {
        delete next[def.key];
      });
      return { promptOverrides: next };
    });
  };

  const handleCopyDefaultPrompt = async (def: PromptDef) => {
    try {
      await navigator.clipboard.writeText(def.defaultText);
      setCopiedPromptKey(def.key);
      window.setTimeout(() => setCopiedPromptKey((current) => current === def.key ? null : current), 1400);
    } catch {
      setCopiedPromptKey(null);
    }
  };

  /**
   * Detect which avatar preset (if any) the current overrides correspond to.
   *
   * A preset matches when, for every avatar field, the current value is either
   * absent (= falls back to default) or equal to the preset's bundled string.
   * The default 'museum' preset wins when nothing is overridden, since its
   * bundle is identical to the project defaults.
   */
  const activeAvatarPresetId = useMemo<string | null>(() => {
    const po = settings.promptOverrides;
    const fieldFor = (preset: AvatarStylePreset, def: AvatarPromptDef): string => preset[def.presetField];
    const matches = AVATAR_STYLE_PRESETS.find((preset) =>
      AVATAR_PROMPT_DEFS.every((def) => {
        const current = po[def.key];
        const expected = fieldFor(preset, def);
        // Empty / undefined override means we're using the project default,
        // which equals the museum preset for these four fields.
        if (!current || !current.trim()) return expected === def.defaultText;
        return current === expected;
      }),
    );
    return matches?.id ?? null;
  }, [settings.promptOverrides]);

  const handleApplyAvatarPreset = (preset: AvatarStylePreset) => {
    updateSettings((current) => {
      const next = { ...current.promptOverrides };
      if (preset.id === DEFAULT_AVATAR_STYLE_PRESET_ID) {
        // Default preset == project defaults; clear overrides so the underlying
        // constants apply (and exported settings stay clean).
        delete next.thoughtVoiceAvatarStyle;
        delete next.historicalPhilosopherAvatarStyle;
        delete next.negativeAvatarPrompt;
        delete next.historicalPhilosopherNegativeAvatarPrompt;
      } else {
        next.thoughtVoiceAvatarStyle = preset.thoughtVoice;
        next.historicalPhilosopherAvatarStyle = preset.historicalPhilosopher;
        next.negativeAvatarPrompt = preset.negative;
        next.historicalPhilosopherNegativeAvatarPrompt = preset.historicalPhilosopherNegative;
      }
      return { promptOverrides: next };
    });
  };

  const handleResetAllAvatarPrompts = () => {
    updateSettings((current) => {
      const next = { ...current.promptOverrides };
      delete next.thoughtVoiceAvatarStyle;
      delete next.historicalPhilosopherAvatarStyle;
      delete next.negativeAvatarPrompt;
      delete next.historicalPhilosopherNegativeAvatarPrompt;
      return { promptOverrides: next };
    });
  };

  const handleTestConnection = async () => {
    setTestState({ status: 'testing' });
    const cfg = getActiveConfig();
    const startedAt = Date.now();
    try {
      const response = await fetch(`${cfg.apiBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: cfg.apiModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'ping' }],
        }),
      });

      const elapsed = Date.now() - startedAt;
      if (response.ok) {
        setTestState({ status: 'ok', latencyMs: elapsed });
        return;
      }
      const status = response.status;
      let summary: string;
      if (status === 401) summary = 'API key 无效或已过期。';
      else if (status === 403) summary = '当前 key 无该模型的访问权限。';
      else if (status === 404) summary = '模型名错误或服务未上线。';
      else if (status === 429) summary = '触发了配额或限流。';
      else if (status >= 500) summary = '上游服务波动，请稍后重试。';
      else summary = `请求被拒绝（HTTP ${status}）。`;
      let upstream = '';
      try {
        const data = await response.json();
        upstream = data?.error?.message || data?.message || '';
      } catch {
        // ignore
      }
      setTestState({ status: 'failed', message: upstream ? `${summary}（${upstream}）` : summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      setTestState({ status: 'failed', message: `网络错误：${message}` });
    }
  };

  const handleExportSettings = () => {
    const payload = exportSettings();
    downloadBlob(`sophia-settings-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', payload);
  };

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportBusy(true);
    setImportError(null);
    try {
      const text = await file.text();
      importSettings(text);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImportBusy(false);
    }
  };

  const handleResetSettings = () => {
    if (!resetConfirm) {
      setResetConfirm(true);
      return;
    }
    resetToDefaults();
    setResetConfirm(false);
    setTestState({ status: 'idle' });
  };

  const handleClearTokens = () => {
    clearTokenAccounting();
    refreshTokens();
  };

  const handleExportTokens = () => {
    downloadBlob(`sophia-tokens-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv', exportTokenCsv());
  };

  const sections: Array<{ id: SectionId; label: string; icon: React.ReactNode }> = [
    { id: 'provider', label: '生成模型', icon: <Cpu className="h-3.5 w-3.5" /> },
    { id: 'prompts', label: '提示词', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'avatars', label: '头像风格', icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: 'options', label: '运行参数', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'tokens', label: 'Token 预算', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'data', label: '数据管理', icon: <Database className="h-3.5 w-3.5" /> },
  ];

  const isCustomActive = settings.activeProviderId === 'custom';
  const stageEntries = Object.entries(tokens.byStage)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  const modelEntries = Object.entries(tokens.byModel)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  const allTimeTotal = tokens.allTime.totalTokens;
  const approxRuns = allTimeTotal > 0 ? Math.max(1, Math.round(allTimeTotal / 25000)) : 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28 animate-fade-in -mt-4 md:-mt-12 text-museum-900">
      <PageHero
        eyebrow="Local Console"
        accent="Settings"
        icon={<SettingsIcon className="h-3.5 w-3.5" />}
        description="在你的浏览器里调谐 Sophia 的模型、提示词、头像与运行参数。改动会立即对下一次生成生效，不需要刷新或重新部署。"
      />

      <nav className="sticky top-0 z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-museum-50/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:border-museum-200/80 sm:px-2">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActive(section.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest transition ${
              active === section.id
                ? 'bg-museum-900 text-museum-50'
                : 'text-museum-600 hover:bg-museum-100/80 hover:text-museum-800'
            }`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </nav>

      {active === 'provider' && (
        <section className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6">
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
                onSelect={() => handleSelectProvider(preset.id)}
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
                    onChange={(e) => handleCustomChange({ name: e.target.value })}
                    className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 text-sm focus:border-museum-700 focus:outline-none"
                    placeholder="My LLM"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">文本模型名（model）</span>
                  <input
                    type="text"
                    value={settings.customProvider.textModel}
                    onChange={(e) => handleCustomChange({ textModel: e.target.value })}
                    className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                    placeholder="gpt-4o-mini"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">生图模型名（Image model）</span>
                  <input
                    type="text"
                    value={settings.customProvider.imageModel ?? ''}
                    onChange={(e) => handleCustomChange({ imageModel: e.target.value })}
                    className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                    placeholder="grok-imagine-image-lite"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Base URL</span>
                  <input
                    type="text"
                    value={settings.customProvider.baseUrl}
                    onChange={(e) => handleCustomChange({ baseUrl: e.target.value })}
                    className="mt-1 w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-sm focus:border-museum-700 focus:outline-none"
                    placeholder="https://api.example.com/v1"
                  />
                </label>
                <label className="block md:col-span-2">
                  <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">API Key</span>
                  <input
                    type="password"
                    value={settings.customProvider.apiKey}
                    onChange={(e) => handleCustomChange({ apiKey: e.target.value })}
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
              onClick={handleTestConnection}
              disabled={testState.status === 'testing'}
              className="inline-flex items-center gap-2 rounded border border-museum-700 bg-museum-900 px-4 py-2 text-sm text-museum-50 transition hover:bg-museum-800 disabled:opacity-60"
            >
              <Plug className="h-4 w-4" />
              {testState.status === 'testing' ? '正在测试...' : '测试连接'}
            </button>
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
          </div>
        </section>
      )}

      {active === 'prompts' && (() => {
        const activeDef = PROMPT_DEFS.find((def) => def.key === activePromptKey) || PROMPT_DEFS[0];
        const activeValue = settings.promptOverrides[activeDef.key] ?? '';
        const activeHasOverride = !!activeValue.trim();
        const activeEffective = activeHasOverride ? activeValue : activeDef.defaultText;
        const overrideCount = PROMPT_DEFS.reduce((sum, def) => {
          const v = settings.promptOverrides[def.key];
          return v && v.trim() ? sum + 1 : sum;
        }, 0);
        return (
          <section className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-4 sm:p-5 flex flex-col">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between pb-4 border-b border-museum-200/60">
              <SectionHeader
                icon={<FileText className="h-4 w-4" />}
                title="系统提示词"
                description="Sophia 的 4 个核心 system prompt。修改将改变分析路径、写作风格及判定逻辑。"
              />
              <div className="flex shrink-0 items-center justify-end gap-2 mt-2 md:mt-0">
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest ${
                  overrideCount > 0
                    ? 'border-museum-700 bg-museum-900 text-museum-50'
                    : 'border-museum-200 bg-museum-50 text-museum-500'
                }`}>
                  {overrideCount > 0 ? `${overrideCount}/${PROMPT_DEFS.length} 已覆盖` : '全部默认'}
                </span>
                <button
                  type="button"
                  onClick={handleResetAllCorePrompts}
                  disabled={overrideCount === 0}
                  className="inline-flex items-center justify-center gap-1.5 rounded border border-museum-200 bg-white/70 px-3 py-1.5 text-[11px] text-museum-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <RotateCcw className="h-3 w-3" />
                  全恢默认
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col md:flex-row gap-4">
              {/* Sidebar List */}
              <div className="w-full md:w-1/4 lg:w-1/3 flex flex-col gap-1.5">
                {PROMPT_DEFS.map((def) => {
                  const isActive = def.key === activePromptKey;
                  const v = settings.promptOverrides[def.key] ?? '';
                  const hasOverride = !!v.trim();
                  return (
                    <button
                      key={def.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActivePromptKey(def.key)}
                      className={`relative flex flex-col items-start gap-0.5 rounded-lg border p-2.5 text-left transition ${
                        isActive
                          ? 'border-museum-500 bg-museum-50 shadow-sm'
                          : 'border-transparent bg-transparent hover:bg-museum-50/50'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className={`text-[12px] font-bold ${isActive ? 'text-museum-900' : 'text-museum-700'}`}>
                          {def.label}
                        </span>
                        {hasOverride && (
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full bg-amber-600"
                            title="已覆盖"
                          />
                        )}
                      </div>
                      <span className={`text-[10px] leading-snug ${isActive ? 'text-museum-700' : 'text-museum-500 line-clamp-2'}`}>
                        {def.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Editor Pane */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-2 px-1">
                  <h3 className="font-serif text-base text-museum-900">{activeDef.label}</h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handlePromptChange(activeDef.key, activeDef.defaultText)}
                      className="inline-flex items-center gap-1 rounded border border-museum-200 bg-white/60 px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest text-museum-600 transition hover:bg-white hover:text-museum-900"
                    >
                      <FileText className="h-3 w-3" />
                      填入默认
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyDefaultPrompt(activeDef)}
                      className="inline-flex items-center gap-1 rounded border border-museum-200 bg-white/60 px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest text-museum-600 transition hover:bg-white hover:text-museum-900"
                    >
                      <Copy className="h-3 w-3" />
                      {copiedPromptKey === activeDef.key ? '已复制' : '复制默认'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResetPrompt(activeDef.key)}
                      disabled={!activeHasOverride}
                      className="inline-flex items-center gap-1 rounded border border-museum-200 bg-white/60 px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest transition hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-museum-600 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RotateCcw className="h-3 w-3" />
                      清空(用默认)
                    </button>
                  </div>
                </div>

                <textarea
                  value={activeValue}
                  onChange={(event) => handlePromptChange(activeDef.key, event.target.value)}
                  rows={14}
                  spellCheck={false}
                  placeholder={`留空 = 使用系统默认。\n\n默认内容（${activeDef.defaultText.length} 字符 / ${lineCount(activeDef.defaultText)} 行）:\n${activeDef.defaultText.slice(0, 100)}...`}
                  className="w-full flex-1 resize-y rounded-lg border border-museum-200 bg-white/70 px-3 py-3 font-mono text-[11px] leading-relaxed text-museum-900 shadow-sm placeholder:text-museum-400 focus:border-museum-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-museum-500"
                />

                <div className="mt-2 px-1 flex flex-wrap items-center justify-between gap-2 text-[10px] tracking-widest uppercase font-mono text-museum-500">
                  <div className="flex items-center gap-2">
                    <span>生效: {activeEffective.length} 字符 / {lineCount(activeEffective)} 行</span>
                    {activeHasOverride && (
                      <span className="rounded bg-amber-100/80 px-1.5 py-0.5 text-amber-800">
                        自定义生效中
                      </span>
                    )}
                  </div>
                </div>

                <details className="mt-3 group">
                  <summary className="cursor-pointer inline-flex items-center gap-1.5 px-1 text-[10px] font-mono uppercase tracking-widest text-museum-500 hover:text-museum-800 transition">
                    <span className="group-open:hidden">▶ 展开默认提示词对照</span>
                    <span className="hidden group-open:inline">▼ 收起默认提示词对照</span>
                  </summary>
                  <div className="mt-1.5 rounded-lg border border-museum-200 bg-museum-50/40 p-3">
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[10px] leading-relaxed text-museum-600">
                      {activeDef.defaultText}
                    </pre>
                  </div>
                </details>
              </div>
            </div>
          </section>
        );
      })()}

      {active === 'avatars' && (
        <section className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6">
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
                    onClick={() => handleApplyAvatarPreset(preset)}
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
                onClick={handleResetAllAvatarPrompts}
                className="inline-flex items-center gap-1 rounded border border-museum-200 px-2 py-1 text-[11px] text-museum-600 hover:bg-museum-100"
              >
                <RotateCcw className="h-3 w-3" />
                全部恢复默认
              </button>
            </div>
            <div className="mt-4 space-y-5">
              {AVATAR_PROMPT_DEFS.map((def) => {
                const value = settings.promptOverrides[def.key] ?? '';
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
                        onChange={(e) => handlePromptChange(def.key, e.target.value)}
                        rows={5}
                        spellCheck={false}
                        className="w-full rounded border border-museum-200 bg-white px-3 py-2 font-mono text-[12px] leading-relaxed focus:border-museum-700 focus:outline-none"
                      />
                      <div className="mt-2 flex items-center justify-between text-[11px] text-museum-500">
                        <span>{(value || def.defaultText).length} 字符</span>
                        <button
                          type="button"
                          onClick={() => handleResetPrompt(def.key)}
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
      )}

      {active === 'options' && (
        <section className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6">
          <SectionHeader
            icon={<Sliders className="h-4 w-4" />}
            title="运行参数"
            description="影响每次生成的 LLM 行为。改动后立即对下一次生成生效。"
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Temperature</span>
                <span className="font-mono text-sm text-museum-800">{settings.options.temperature.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.2}
                step={0.02}
                value={settings.options.temperature}
                onChange={(e) => handleOptionChange({ temperature: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-[11px] text-museum-500">越低越保守，越高越发散。默认 0.72。</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Voice 并发</span>
                <span className="font-mono text-sm text-museum-800">{settings.options.voiceConcurrency}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={settings.options.voiceConcurrency}
                onChange={(e) => handleOptionChange({ voiceConcurrency: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-[11px] text-museum-500">同时生成的思想声音数。默认 2。提高更快，但更易触发限流。</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Avatar 并发</span>
                <span className="font-mono text-sm text-museum-800">{settings.options.avatarConcurrency}</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={settings.options.avatarConcurrency}
                onChange={(e) => handleOptionChange({ avatarConcurrency: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-[11px] text-museum-500">同时排队的头像图像请求数。默认 2。如果上游图像服务 CPU 过载，可调到 1。</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-mono uppercase tracking-widest text-museum-500">Voice max tokens</span>
                <span className="font-mono text-sm text-museum-800">{settings.options.voiceMaxTokens}</span>
              </div>
              <input
                type="range"
                min={2000}
                max={12000}
                step={500}
                value={settings.options.voiceMaxTokens}
                onChange={(e) => handleOptionChange({ voiceMaxTokens: Number(e.target.value) })}
                className="mt-2 w-full"
              />
              <p className="mt-1 text-[11px] text-museum-500">单个声音正文的输出上限。默认 7000。</p>
            </div>
          </div>
        </section>
      )}

      {active === 'tokens' && (
        <section className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6">
          <SectionHeader
            icon={<BarChart3 className="h-4 w-4" />}
            title="Token 预算"
            description="仅本地统计；不包含 API 端的真实计费数据。一次完整分析平均消耗约 25k tokens。"
          />

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: '今日', bucket: tokens.today },
              { label: '本周', bucket: tokens.week },
              { label: '本月', bucket: tokens.month },
              { label: '全部', bucket: tokens.allTime },
            ].map((item) => (
              <div key={item.label} className="rounded-lg border border-museum-200 bg-museum-50/60 p-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-museum-500">{item.label}</p>
                <p className="mt-1 font-serif text-2xl text-museum-900">{formatNumber(item.bucket.totalTokens)}</p>
                <p className="text-[11px] text-museum-500">{item.bucket.count} 次请求</p>
              </div>
            ))}
          </div>

          {allTimeTotal > 0 && (
            <p className="mt-4 text-[12px] text-museum-600">
              全部时间累计 <span className="font-mono">{formatNumber(allTimeTotal)}</span> tokens，按平均一次 25k 估算约相当于 <span className="font-serif text-base">{approxRuns}</span> 次完整分析。
            </p>
          )}

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-museum-200 bg-white/70 p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-widest text-museum-500">按阶段</h3>
              {stageEntries.length === 0 ? (
                <p className="mt-3 text-[12px] text-museum-500">暂无数据。完成一次生成后这里会出现统计。</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {stageEntries.slice(0, 8).map(([stage, bucket]) => (
                    <Bar
                      key={stage}
                      label={STAGE_LABEL[stage as keyof typeof STAGE_LABEL] || stage}
                      value={bucket.totalTokens}
                      total={allTimeTotal}
                      subtitle={`${bucket.count}x`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-museum-200 bg-white/70 p-4">
              <h3 className="text-[12px] font-mono uppercase tracking-widest text-museum-500">按模型</h3>
              {modelEntries.length === 0 ? (
                <p className="mt-3 text-[12px] text-museum-500">暂无数据。</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {modelEntries.slice(0, 8).map(([model, bucket]) => (
                    <Bar
                      key={model}
                      label={model}
                      value={bucket.totalTokens}
                      total={allTimeTotal}
                      subtitle={`${bucket.count}x`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-museum-200 pt-4">
            <button
              type="button"
              onClick={refreshTokens}
              className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
            >
              刷新
            </button>
            <button
              type="button"
              onClick={handleExportTokens}
              className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
            >
              <Download className="h-3 w-3" />
              导出 CSV
            </button>
            <button
              type="button"
              onClick={handleClearTokens}
              className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50/70 px-3 py-1.5 text-[11px] text-red-800 hover:bg-red-100"
            >
              <Trash2 className="h-3 w-3" />
              清空记录
            </button>
          </div>
        </section>
      )}

      {active === 'data' && (
        <section className="mt-8 space-y-6">
          <div className="rounded-xl border border-museum-200 bg-white/60 p-6">
            <SectionHeader
              icon={<Database className="h-4 w-4" />}
              title="设置数据"
              description="导出 / 导入整套 settings.json，方便迁移到另一台设备。"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportSettings}
                className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
              >
                <Download className="h-3 w-3" />
                导出 settings.json
              </button>
              <button
                type="button"
                onClick={handleImportClick}
                disabled={importBusy}
                className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100 disabled:opacity-60"
              >
                <Upload className="h-3 w-3" />
                {importBusy ? '正在导入...' : '导入 settings.json'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleResetSettings}
                className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] transition ${
                  resetConfirm
                    ? 'border-red-300 bg-red-100 text-red-900 hover:bg-red-200'
                    : 'border-museum-200 text-museum-700 hover:bg-museum-100'
                }`}
              >
                <RotateCcw className="h-3 w-3" />
                {resetConfirm ? '再点一次确认重置' : '重置全部设置'}
              </button>
            </div>
            {importError && (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-red-50 px-3 py-1.5 text-[11px] text-red-800">
                <AlertTriangle className="h-3 w-3" />
                导入失败：{importError}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/70 p-6">
            <div className="mb-3 flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-red-700" />
              <div>
                <h2 className="font-serif text-lg text-red-900">安全提示</h2>
                <p className="mt-1 text-[13px] leading-relaxed text-red-800">
                  所有设置（包括自定义 LLM 的 API Key）以明文形式存放于浏览器的 localStorage。任何能访问此浏览器的程序与人都能读到。导出的 settings.json 同样包含 key，请勿在公共设备或聊天记录中传播。
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <footer className="mt-12 border-t border-museum-200/80 pt-6">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3 text-left">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-museum-500" />
            <p className="text-[12px] leading-relaxed text-museum-600">
              所有设置仅保存在你的浏览器本地（<span className="font-mono">localStorage</span>）。
              自定义 LLM 的 API Key 以明文存放，导出 settings.json 也包含此 key —— 请勿在公共设备或聊天记录中传播。
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-museum-200 bg-white/40 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-museum-500 shrink-0">
            <Sparkles className="h-3 w-3" />
            改动会立即对下一次生成生效
          </span>
        </div>
      </footer>
    </div>
  );
};

export default SettingsPage;
