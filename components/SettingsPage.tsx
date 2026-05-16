import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Settings as SettingsIcon, Sparkles, ShieldAlert, Database, Cpu, FileText, Sliders, BarChart3, Image as ImageIcon } from 'lucide-react';
import {
  DEFAULT_ANALYSIS_PROFILE,
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
import type { AnalysisProfile } from '../services/sophiaConfig';
import { MODEL_PRESETS, ModelPreset } from '../services/modelPresets';
import {
  AVATAR_STYLE_PRESETS,
  AvatarStylePreset,
  DEFAULT_AVATAR_STYLE_PRESET_ID,
  PromptOverrides,
} from '../services/prompts';
import {
  UsageTotals,
  clearAll as clearTokenAccounting,
  exportCsv as exportTokenCsv,
  getTotals,
} from '../services/tokenAccounting';
import { apiErrorMessage } from '../services/api/apiClient';
import { clearStageCache, countStageEntries } from '../services/storage/stageCache';
import { PageHero } from './PageHero';
import { AvatarPanel } from './settings/AvatarPanel';
import { DataPanel } from './settings/DataPanel';
import { ProfilePanel } from './settings/ProfilePanel';
import { PromptPanel } from './settings/PromptPanel';
import { ProviderPanel } from './settings/ProviderPanel';
import { RuntimeOptionsPanel } from './settings/RuntimeOptionsPanel';
import { TokenUsagePanel } from './settings/TokenUsagePanel';
import { AVATAR_PROMPT_DEFS, PROMPT_DEFS } from './settings/promptDefs';
import type { AvatarPromptDef, PromptDef } from './settings/promptDefs';
import type { SectionId, TestConnectionState } from './settings/types';

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


const SettingsPage: React.FC = () => {
  const [settings, setSettingsState] = useState<SophiaSettings>(() => getSettings());
  const [active, setActive] = useState<SectionId>('provider');
  const [testState, setTestState] = useState<TestConnectionState>({ status: 'idle' });
  const [tokens, setTokens] = useState<UsageTotals>(() => getTotals());
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [copiedPromptKey, setCopiedPromptKey] = useState<keyof PromptOverrides | null>(null);
  const [activePromptKey, setActivePromptKey] = useState<keyof PromptOverrides>(PROMPT_DEFS[0].key);
  // Stage cache (analyze pipeline outputs cached in IndexedDB).
  // `null` while we haven't read the count yet — distinguishes "loading" from
  // "loaded with 0 entries" so the UI doesn't flicker "0" on first paint.
  const [stageCacheCount, setStageCacheCount] = useState<number | null>(null);
  const [stageCacheBusy, setStageCacheBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const testControllerRef = useRef<AbortController | null>(null);
  const testSeqRef = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribe((next) => setSettingsState(next));
    return () => {
      unsubscribe();
      testControllerRef.current?.abort();
    };
  }, []);

  // Refresh stage-cache count when the data tab is opened. We don't poll
  // because the only ways the count changes are (a) a new run wrote entries,
  // (b) the user clicked the clear button — both of which we either react to
  // explicitly or are happy to defer until next visit.
  useEffect(() => {
    if (active !== 'data') return;
    let cancelled = false;
    countStageEntries().then((count) => {
      if (!cancelled) setStageCacheCount(count);
    }).catch(() => {
      if (!cancelled) setStageCacheCount(0);
    });
    return () => { cancelled = true; };
  }, [active]);

  const handleClearStageCache = async () => {
    setStageCacheBusy(true);
    try {
      await clearStageCache();
      setStageCacheCount(0);
    } finally {
      setStageCacheBusy(false);
    }
  };

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
    testControllerRef.current?.abort();
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

  const handleProfileChange = (patch: Partial<AnalysisProfile>) => {
    updateSettings((current) => ({
      analysisProfile: { ...current.analysisProfile, ...patch },
    }));
  };

  const handleResetProfile = () => {
    updateSettings({ analysisProfile: { ...DEFAULT_ANALYSIS_PROFILE } });
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
    testControllerRef.current?.abort();
    const controller = new AbortController();
    testControllerRef.current = controller;
    const seq = testSeqRef.current + 1;
    testSeqRef.current = seq;
    const setLatestTestState = (next: TestConnectionState) => {
      if (testSeqRef.current === seq && !controller.signal.aborted) setTestState(next);
    };

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
        signal: controller.signal,
      });

      const elapsed = Date.now() - startedAt;
      if (response.ok) {
        setLatestTestState({ status: 'ok', latencyMs: elapsed });
        return;
      }
      setLatestTestState({ status: 'failed', message: await apiErrorMessage(response) });
    } catch (error) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : '未知错误';
      setLatestTestState({ status: 'failed', message: `网络错误：${message}` });
    } finally {
      if (testControllerRef.current === controller) testControllerRef.current = null;
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
    { id: 'profile', label: '分析画像', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'prompts', label: '提示词', icon: <FileText className="h-3.5 w-3.5" /> },
    { id: 'avatars', label: '头像风格', icon: <ImageIcon className="h-3.5 w-3.5" /> },
    { id: 'options', label: '运行参数', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'tokens', label: 'Token 预算', icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: 'data', label: '数据管理', icon: <Database className="h-3.5 w-3.5" /> },
  ];

  const activateSectionByIndex = (index: number) => {
    const next = sections[index];
    if (!next) return;
    setActive(next.id);
    window.requestAnimationFrame(() => document.getElementById(`settings-tab-${next.id}`)?.focus());
  };

  const handleSectionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      activateSectionByIndex((index + 1) % sections.length);
      return;
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      activateSectionByIndex((index - 1 + sections.length) % sections.length);
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      activateSectionByIndex(0);
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      activateSectionByIndex(sections.length - 1);
    }
  };


  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-28 animate-fade-in -mt-4 md:-mt-12 text-museum-900">
      <PageHero
        eyebrow="Local Console"
        accent="Settings"
        icon={<SettingsIcon className="h-3.5 w-3.5" />}
        description="在你的浏览器里调谐 Sophia 的模型、提示词、头像与运行参数。改动会立即对下一次生成生效，不需要刷新或重新部署。"
      />

      <nav
        className="sticky top-0 z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-museum-50/85 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-full sm:border sm:border-museum-200/80 sm:px-2"
        role="tablist"
        aria-label="设置分区"
      >
        {sections.map((section, index) => (
          <button
            id={`settings-tab-${section.id}`}
            key={section.id}
            type="button"
            role="tab"
            aria-selected={active === section.id}
            aria-controls={`settings-panel-${section.id}`}
            tabIndex={active === section.id ? 0 : -1}
            onClick={() => setActive(section.id)}
            onKeyDown={(event) => handleSectionKeyDown(event, index)}
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
        <ProviderPanel
          settings={settings}
          presetCards={presetCards}
          testState={testState}
          onSelectProvider={handleSelectProvider}
          onCustomChange={handleCustomChange}
          onTestConnection={handleTestConnection}
        />
      )}

      {active === 'profile' && (
        <ProfilePanel
          profile={settings.analysisProfile}
          onProfileChange={handleProfileChange}
          onResetProfile={handleResetProfile}
        />
      )}

      {active === 'prompts' && (
        <PromptPanel
          promptOverrides={settings.promptOverrides}
          activePromptKey={activePromptKey}
          copiedPromptKey={copiedPromptKey}
          onActivePromptKeyChange={setActivePromptKey}
          onPromptChange={handlePromptChange}
          onResetPrompt={handleResetPrompt}
          onResetAllCorePrompts={handleResetAllCorePrompts}
          onCopyDefaultPrompt={handleCopyDefaultPrompt}
        />
      )}

      {active === 'avatars' && (
        <AvatarPanel
          promptOverrides={settings.promptOverrides}
          activeAvatarPresetId={activeAvatarPresetId}
          onApplyAvatarPreset={handleApplyAvatarPreset}
          onPromptChange={handlePromptChange}
          onResetPrompt={handleResetPrompt}
          onResetAllAvatarPrompts={handleResetAllAvatarPrompts}
        />
      )}

      {active === 'options' && (
        <RuntimeOptionsPanel
          options={settings.options}
          onOptionChange={handleOptionChange}
        />
      )}

      {active === 'tokens' && (
        <TokenUsagePanel
          tokens={tokens}
          onRefreshTokens={refreshTokens}
          onExportTokens={handleExportTokens}
          onClearTokens={handleClearTokens}
        />
      )}

      {active === 'data' && (
        <DataPanel
          importBusy={importBusy}
          importError={importError}
          resetConfirm={resetConfirm}
          stageCacheCount={stageCacheCount}
          stageCacheBusy={stageCacheBusy}
          fileInputRef={fileInputRef}
          onExportSettings={handleExportSettings}
          onImportClick={handleImportClick}
          onImportFile={handleImportFile}
          onResetSettings={handleResetSettings}
          onClearStageCache={handleClearStageCache}
        />
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
