import React from 'react';
import { AlertTriangle, Database, Download, RotateCcw, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { SectionHeader } from './SectionHeader';

interface DataPanelProps {
  importBusy: boolean;
  importError: string | null;
  resetConfirm: boolean;
  stageCacheCount: number | null;
  stageCacheBusy: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onExportSettings: () => void;
  onImportClick: () => void;
  onImportFile: (event: React.ChangeEvent<HTMLInputElement>) => void | Promise<void>;
  onResetSettings: () => void;
  onClearStageCache: () => void | Promise<void>;
}

export const DataPanel: React.FC<DataPanelProps> = ({
  importBusy,
  importError,
  resetConfirm,
  stageCacheCount,
  stageCacheBusy,
  fileInputRef,
  onExportSettings,
  onImportClick,
  onImportFile,
  onResetSettings,
  onClearStageCache,
}) => (
  <section
    id="settings-panel-data"
    role="tabpanel"
    aria-labelledby="settings-tab-data"
    className="mt-8 space-y-6"
  >
    <div className="rounded-xl border border-museum-200 bg-white/60 p-6">
      <SectionHeader
        icon={<Database className="h-4 w-4" />}
        title="设置数据"
        description="导出 / 导入整套 settings.json，方便迁移到另一台设备。"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onExportSettings}
          className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
        >
          <Download className="h-3 w-3" />
          导出 settings.json
        </button>
        <button
          type="button"
          onClick={onImportClick}
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
          onChange={onImportFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={onResetSettings}
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

    <div className="rounded-xl border border-museum-200 bg-white/60 p-6">
      <SectionHeader
        icon={<Database className="h-4 w-4" />}
        title="阶段缓存"
        description="分析流水线的中间产物（开题、路线、思想声音正文、思想头像、综合判断）会按输入指纹缓存在浏览器本地。重跑同样的题目或重连同一份历史时直接复用，省一次 LLM 与生图调用。修改提示词或切换模型后，旧条目会自动失效。"
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-museum-200 bg-museum-50 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-museum-600">
          {stageCacheCount === null ? '正在统计...' : `已缓存 ${stageCacheCount} 条`}
        </span>
        <button
          type="button"
          onClick={onClearStageCache}
          disabled={stageCacheBusy || stageCacheCount === 0}
          className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50/70 px-3 py-1.5 text-[11px] text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 className="h-3 w-3" />
          {stageCacheBusy ? '正在清空...' : '清空阶段缓存'}
        </button>
        <p className="text-[11px] leading-snug text-museum-500">
          这只清掉 LLM 阶段产物缓存，不影响"生成历史"里的已保存分析。
        </p>
      </div>
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
);
