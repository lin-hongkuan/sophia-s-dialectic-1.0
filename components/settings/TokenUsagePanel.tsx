import React from 'react';
import { BarChart3, Download, Trash2 } from 'lucide-react';
import { STAGE_LABEL } from '../../presentation/generationStages';
import type { UsageTotals } from '../../services/tokenAccounting';
import { SectionHeader } from './SectionHeader';

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
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

interface TokenUsagePanelProps {
  tokens: UsageTotals;
  onRefreshTokens: () => void;
  onExportTokens: () => void;
  onClearTokens: () => void;
}

export const TokenUsagePanel: React.FC<TokenUsagePanelProps> = ({
  tokens,
  onRefreshTokens,
  onExportTokens,
  onClearTokens,
}) => {
  const stageEntries = Object.entries(tokens.byStage)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  const modelEntries = Object.entries(tokens.byModel)
    .sort((a, b) => b[1].totalTokens - a[1].totalTokens);
  const allTimeTotal = tokens.allTime.totalTokens;
  const approxRuns = allTimeTotal > 0 ? Math.max(1, Math.round(allTimeTotal / 25000)) : 0;

  return (
    <section
      id="settings-panel-tokens"
      role="tabpanel"
      aria-labelledby="settings-tab-tokens"
      className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6"
    >
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
          onClick={onRefreshTokens}
          className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
        >
          刷新
        </button>
        <button
          type="button"
          onClick={onExportTokens}
          className="inline-flex items-center gap-1.5 rounded border border-museum-200 px-3 py-1.5 text-[11px] text-museum-700 hover:bg-museum-100"
        >
          <Download className="h-3 w-3" />
          导出 CSV
        </button>
        <button
          type="button"
          onClick={onClearTokens}
          className="inline-flex items-center gap-1.5 rounded border border-red-200 bg-red-50/70 px-3 py-1.5 text-[11px] text-red-800 hover:bg-red-100"
        >
          <Trash2 className="h-3 w-3" />
          清空记录
        </button>
      </div>
    </section>
  );
};
