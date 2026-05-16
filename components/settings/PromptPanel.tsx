import React from 'react';
import { Copy, FileText, RotateCcw } from 'lucide-react';
import type { PromptOverrides } from '../../services/prompts';
import { SectionHeader } from './SectionHeader';
import { PROMPT_DEFS } from './promptDefs';
import type { PromptDef } from './promptDefs';

const lineCount = (value: string): number => value ? value.split(/\r\n|\r|\n/).length : 0;

interface PromptPanelProps {
  promptOverrides: PromptOverrides;
  activePromptKey: keyof PromptOverrides;
  copiedPromptKey: keyof PromptOverrides | null;
  onActivePromptKeyChange: (key: keyof PromptOverrides) => void;
  onPromptChange: (key: keyof PromptOverrides, value: string) => void;
  onResetPrompt: (key: keyof PromptOverrides) => void;
  onResetAllCorePrompts: () => void;
  onCopyDefaultPrompt: (def: PromptDef) => void | Promise<void>;
}

export const PromptPanel: React.FC<PromptPanelProps> = ({
  promptOverrides,
  activePromptKey,
  copiedPromptKey,
  onActivePromptKeyChange,
  onPromptChange,
  onResetPrompt,
  onResetAllCorePrompts,
  onCopyDefaultPrompt,
}) => {
  const activeDef = PROMPT_DEFS.find((def) => def.key === activePromptKey) || PROMPT_DEFS[0];
  const activeValue = promptOverrides[activeDef.key] ?? '';
  const activeHasOverride = !!activeValue.trim();
  const activeEffective = activeHasOverride ? activeValue : activeDef.defaultText;
  const overrideCount = PROMPT_DEFS.reduce((sum, def) => {
    const v = promptOverrides[def.key];
    return v && v.trim() ? sum + 1 : sum;
  }, 0);

  return (
    <section
      id="settings-panel-prompts"
      role="tabpanel"
      aria-labelledby="settings-tab-prompts"
      className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-4 sm:p-5 flex flex-col"
    >
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
            onClick={onResetAllCorePrompts}
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
        <div className="w-full md:w-1/4 lg:w-1/3 flex flex-col gap-1.5" role="tablist" aria-label="系统提示词类型">
          {PROMPT_DEFS.map((def) => {
            const isActive = def.key === activePromptKey;
            const v = promptOverrides[def.key] ?? '';
            const hasOverride = !!v.trim();
            return (
              <button
                id={`prompt-tab-${def.key}`}
                key={def.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls="prompt-editor-panel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => onActivePromptKeyChange(def.key)}
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
        <div
          id="prompt-editor-panel"
          role="tabpanel"
          aria-labelledby={`prompt-tab-${activeDef.key}`}
          className="flex-1 flex flex-col min-w-0"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h3 className="font-serif text-base text-museum-900">{activeDef.label}</h3>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onPromptChange(activeDef.key, activeDef.defaultText)}
                className="inline-flex items-center gap-1 rounded border border-museum-200 bg-white/60 px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest text-museum-600 transition hover:bg-white hover:text-museum-900"
              >
                <FileText className="h-3 w-3" />
                填入默认
              </button>
              <button
                type="button"
                onClick={() => void onCopyDefaultPrompt(activeDef)}
                className="inline-flex items-center gap-1 rounded border border-museum-200 bg-white/60 px-2 py-0.5 text-[10px] uppercase font-mono tracking-widest text-museum-600 transition hover:bg-white hover:text-museum-900"
              >
                <Copy className="h-3 w-3" />
                {copiedPromptKey === activeDef.key ? '已复制' : '复制默认'}
              </button>
              <button
                type="button"
                onClick={() => onResetPrompt(activeDef.key)}
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
            onChange={(event) => onPromptChange(activeDef.key, event.target.value)}
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
};
