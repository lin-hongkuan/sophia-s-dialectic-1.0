import React, { useRef, useState } from 'react';
import { ActiveAnalysisRun, HistoryEntry } from '../types';
import { AlertCircle, Archive, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Clock, Download, Loader2, Quote, RotateCcw, Sparkles, Trash2, Upload } from 'lucide-react';
import { STAGE_LABEL, STAGE_ORDER } from '../constants';
import { PageHero } from './PageHero';

interface HistoryPageProps {
  entries: HistoryEntry[];
  activeRun?: ActiveAnalysisRun | null;
  entryHref?: (entry: HistoryEntry) => string;
  onOpen: (entry: HistoryEntry) => void;
  onOpenActive?: () => void;
  onBack: () => void;
  onRegeneratePreset?: () => void;
  canRegeneratePreset?: boolean;
  onDownloadHistory?: () => void;
  onImportHistory?: (content: string) => { imported: number; scanned: number; limit: number };
  onDeleteEntry?: (entry: HistoryEntry) => void;
}

const formatActiveRunProgress = (activeProgress?: ActiveAnalysisRun['progress']) => {
  const stage = activeProgress?.stage || 'outline';
  const stageIndex = STAGE_ORDER.indexOf(stage);
  const stageText = stageIndex >= 0 ? `第 ${Math.min(stageIndex + 1, 4)}/4 步 · ${STAGE_LABEL[stage]}` : STAGE_LABEL[stage];
  if (!activeProgress?.totalVoices) return stageText;
  const voiceText = `${activeProgress.completedVoices}/${activeProgress.totalVoices} 个思想声音`;
  const currentVoiceText = activeProgress.currentVoiceName ? ` · 正在展开：${activeProgress.currentVoiceName}` : '';
  return `${stageText} · ${voiceText}${currentVoiceText}`;
};

const HistoryPage: React.FC<HistoryPageProps> = ({
  entries,
  activeRun,
  entryHref,
  onOpen,
  onOpenActive,
  onBack,
  onRegeneratePreset,
  canRegeneratePreset,
  onDownloadHistory,
  onImportHistory,
  onDeleteEntry,
}) => {
  const [archiveMessage, setArchiveMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRunIsRunning = activeRun?.status === 'starting' || activeRun?.status === 'running';
  const activeRunTitle = activeRun?.result?.philosophical_title || activeRun?.topic;
  const activeProgress = activeRun?.progress;
  const userEntries = entries.filter((entry) => !entry.isPreset);

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onImportHistory) return;

    try {
      const result = onImportHistory(await file.text());
      setArchiveMessage(result.imported > 0
        ? `已导入 ${result.imported} 条历史记录。最多保留最近 ${result.limit} 条。`
        : result.scanned > 0 ? '没有发现新的历史记录，可能已经导入过。' : '这个文件里没有可导入的 Sophia 历史记录。');
    } catch {
      setArchiveMessage('导入失败：请选择有效的 Sophia 历史 JSON 文件。');
    }
  };

  const handleDeleteEntry = (entry: HistoryEntry) => {
    if (!onDeleteEntry || entry.isPreset) return;
    const confirmed = window.confirm(`删除这条历史记录？\n\n${entry.title}`);
    if (!confirmed) return;
    onDeleteEntry(entry);
    setArchiveMessage('已删除一条历史记录。');
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-16 md:pb-20 animate-fade-in -mt-4 md:-mt-12">
      <PageHero
        eyebrow="Archive of Questions"
        accent="History"
        icon={<Archive className="h-3.5 w-3.5" />}
        description="这里保存你每次提问生成的完整结果页。正在生成的问题也会临时出现在这里，方便你离开后再回来。"
      />

      {activeRun && (
        <button
          onClick={onOpenActive}
          className="w-full text-left mb-8 bg-museum-900 text-museum-50 p-6 md:p-8 shadow-lg hover:bg-black transition-colors group"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 border border-museum-500/70 bg-white/10 flex items-center justify-center shrink-0">
                {activeRunIsRunning && <Loader2 className="w-5 h-5 animate-spin" />}
                {activeRun.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-emerald-200" />}
                {activeRun.status === 'error' && <AlertCircle className="w-5 h-5 text-red-200" />}
              </div>
              <div>
                <p className="text-xs font-mono uppercase tracking-[0.24em] text-museum-300 mb-2">
                  {activeRunIsRunning ? '正在生成' : activeRun.status === 'completed' ? '刚刚完成' : '生成出错'}
                  {activeRun.isPresetRegeneration ? ' · 预置样本真实链路' : ''}
                </p>
                <h2 className="font-serif text-2xl md:text-3xl leading-tight mb-3">{activeRunTitle}</h2>
                <p className="text-museum-200 text-sm leading-relaxed">
                  {formatActiveRunProgress(activeProgress)}
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-200 group-hover:text-white shrink-0">
              回到这个问题 <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </button>
      )}

      {entries.length === 0 ? (
        <div className="max-w-2xl mx-auto bg-white/80 border border-museum-200 rounded-xl p-10 text-center">
          <BookOpen className="w-10 h-10 mx-auto text-museum-300 mb-4" />
          <h2 className="font-serif text-3xl text-museum-900 mb-3">还没有历史记录</h2>
          <p className="text-museum-600 mb-6">先提出一个问题，Sophia 会把结果保存到这里。</p>
          <button onClick={onBack} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
            回到首页
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-7">
          {entries.map((entry, index) => {
            const catalogNo = String(entries.length - index).padStart(3, '0');
            const voiceCount = entry.result?.voices?.length ?? 0;
            return (
            <div
              key={entry.id}
              className="group relative isolate overflow-hidden rounded-xl border border-museum-200/80 bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(44,42,38,0.04)] backdrop-blur-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:border-museum-300 hover:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_36px_-18px_rgba(44,42,38,0.28)]"
            >
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px bg-museum-200/80 transition-colors duration-500 group-hover:bg-museum-800/70" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-museum-200/70 to-transparent" />
              <span aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br from-museum-50/0 via-transparent to-museum-100/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 group-hover:from-museum-50/40 group-hover:to-museum-100/60" />

              <a
                href={entryHref?.(entry) || '/history'}
                onClick={(event) => {
                  event.preventDefault();
                  onOpen(entry);
                }}
                className="block w-full text-left p-5 md:p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="notranslate font-mono text-[10px] uppercase leading-none tracking-[0.22em] text-museum-400" translate="no">
                    NO. {catalogNo}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-museum-300 transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-museum-900" />
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-sm border border-museum-200 bg-museum-100/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-museum-800">
                    {entry.modeLabel}
                  </span>
                  {entry.isPreset && (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-100 bg-amber-50/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-800">
                      <Sparkles className="h-3 w-3" /> {entry.generatedByChain ? '真实链路生成' : '参考样本'}
                    </span>
                  )}
                </div>

                <h2 className="mt-5 font-serif text-xl leading-tight text-museum-900 break-words decoration-museum-300/80 underline-offset-[6px] transition-all duration-500 group-hover:decoration-museum-800 group-hover:underline md:mt-6 md:text-3xl">
                  {entry.title}
                </h2>
                <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-museum-600 break-words md:mt-4 md:text-[15px]">
                  {entry.topic}
                </p>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-museum-200/70 pt-4 md:mt-7 md:pt-5">
                  <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.18em] text-museum-400">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </span>
                    {voiceCount > 0 && (
                      <>
                        <span className="text-museum-300">·</span>
                        <span className="inline-flex items-center gap-1.5">
                          <Quote className="h-3 w-3" />
                          {voiceCount} 段声音
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </a>

              {!entry.isPreset && onDeleteEntry && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeleteEntry(entry);
                  }}
                  aria-label={`删除「${entry.title}」`}
                  title="删除这条历史记录"
                  className="group/del absolute bottom-3 right-3 inline-flex h-8 items-center rounded-full border border-museum-200/70 bg-white/80 px-2 text-museum-400 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-red-200/80 hover:bg-red-50/95 hover:text-red-700 hover:shadow active:translate-y-0 active:bg-red-100/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-200 opacity-60 hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none inline-block max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-mono uppercase tracking-[0.22em] opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover/del:mr-1.5 group-hover/del:max-w-[3rem] group-hover/del:opacity-100 group-focus-visible/del:mr-1.5 group-focus-visible/del:max-w-[3rem] group-focus-visible/del:opacity-100"
                  >
                    删除
                  </span>
                  <Trash2 className="h-3.5 w-3.5 shrink-0 transition-transform duration-300 ease-out group-hover/del:-rotate-6 group-active/del:rotate-0" />
                </button>
              )}

              {entry.isPreset && onRegeneratePreset && (
                <div className="border-t border-museum-200/60 bg-museum-50/40 px-5 py-3 md:px-7">
                  <button
                    onClick={onRegeneratePreset}
                    disabled={!canRegeneratePreset}
                    className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-600 transition-colors hover:text-museum-900 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <RotateCcw className="h-3 w-3" /> 用真实链路重新生成样本
                  </button>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}

      <div className="mx-auto mt-12 max-w-3xl rounded-xl border border-museum-200 bg-white/75 p-4 shadow-sm backdrop-blur-md md:mt-16 md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-left">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-museum-400">Archive Toolkit</p>
            <p className="mt-2 text-sm leading-relaxed text-museum-700">下载或导入本地历史记录；删除操作只影响当前浏览器里的档案。</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                onDownloadHistory?.();
                setArchiveMessage(userEntries.length > 0 ? '已开始下载历史备份。' : '当前没有可下载的用户历史。');
              }}
              disabled={!onDownloadHistory || userEntries.length === 0}
              className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download className="h-3.5 w-3.5" /> 下载 JSON
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!onImportHistory}
              className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Upload className="h-3.5 w-3.5" /> 导入 JSON
            </button>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
        {archiveMessage && <p className="mt-3 text-left text-xs leading-relaxed text-museum-500">{archiveMessage}</p>}
      </div>
    </div>
  );
};

export default HistoryPage;
