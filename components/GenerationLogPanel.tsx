import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, ArrowDown, Activity } from 'lucide-react';
import { GenerationLogEntry } from '../types';
import { STAGE_LABEL } from '../constants';

interface GenerationLogPanelProps {
  entries: GenerationLogEntry[];
  isAnalyzing: boolean;
}

const SESSION_STORAGE_KEY = 'sophia.log.expanded';
const MOBILE_HEIGHT_PX = 240;
const DESKTOP_HEIGHT_PX = 360;
const STICKY_THRESHOLD_PX = 32;

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const stageTagText = (entry: GenerationLogEntry): string => {
  if (entry.stage === 'meta') return 'meta';
  if (entry.stage === 'reframe') return 'reframe';
  return STAGE_LABEL[entry.stage as keyof typeof STAGE_LABEL] || entry.stage;
};

const levelClass = (level: GenerationLogEntry['level']): string => {
  switch (level) {
    case 'detail': return 'text-museum-500';
    case 'warn': return 'text-amber-700';
    case 'error': return 'text-red-700';
    default: return 'text-museum-800';
  }
};

const stageTagClass = (level: GenerationLogEntry['level']): string => {
  switch (level) {
    case 'warn': return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'error': return 'bg-red-100 text-red-900 border-red-200';
    case 'detail': return 'bg-museum-100/70 text-museum-600 border-museum-200/70';
    default: return 'bg-museum-100 text-museum-700 border-museum-200';
  }
};

const loadExpanded = (): boolean => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return true;
  try {
    const value = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (value === null) return true;
    return value === '1';
  } catch {
    return true;
  }
};

const persistExpanded = (expanded: boolean) => {
  if (typeof window === 'undefined' || typeof window.sessionStorage === 'undefined') return;
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, expanded ? '1' : '0');
  } catch {
    // ignore quota errors
  }
};

const GenerationLogPanel: React.FC<GenerationLogPanelProps> = ({ entries, isAnalyzing }) => {
  const [expanded, setExpanded] = useState<boolean>(loadExpanded);
  const [stickToBottom, setStickToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const heightPx = typeof window !== 'undefined' && window.innerWidth < 768 ? MOBILE_HEIGHT_PX : DESKTOP_HEIGHT_PX;

  const totalCount = entries.length;
  const lastTokenLine = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i -= 1) {
      const entry = entries[i];
      if (entry.tokens) return entry;
    }
    return null;
  }, [entries]);

  useEffect(() => {
    persistExpanded(expanded);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;
    if (!stickToBottom) return;
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [entries, expanded, stickToBottom]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    const distanceFromBottom = node.scrollHeight - node.clientHeight - node.scrollTop;
    setStickToBottom(distanceFromBottom <= STICKY_THRESHOLD_PX);
  };

  const handleScrollToBottom = () => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    setStickToBottom(true);
  };

  return (
    <section className="mt-5 border-t border-museum-100 pt-4" aria-label="生成日志面板">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={expanded}
      >
        <span className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-museum-500">
          <Activity className="h-3 w-3" />
          生成日志
          <span className="rounded-full border border-museum-200 bg-museum-50/80 px-2 py-0.5 text-[9px] tracking-[0.18em] text-museum-600">
            {totalCount} 条{isAnalyzing ? ' · 实时' : ''}
          </span>
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-museum-500">
          {expanded ? '收起' : '展开'} {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>

      {expanded && (
        <div className="relative mt-3">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{ maxHeight: `${heightPx}px` }}
            className="overflow-y-auto rounded border border-museum-100 bg-museum-50/40 p-3 font-mono text-[11px] leading-snug"
          >
            {entries.length === 0 ? (
              <p className="text-museum-400">尚未产生日志条目。生成开始后这里会持续滚动。</p>
            ) : (
              <ul className="space-y-1.5">
                {entries.map((entry) => (
                  <li key={entry.id} className={`flex flex-wrap items-start gap-x-2 gap-y-0.5 ${levelClass(entry.level)}`}>
                    <span className="shrink-0 text-museum-400">[{formatTime(entry.ts)}]</span>
                    <span className={`shrink-0 rounded-full border px-1.5 py-[1px] text-[9px] tracking-widest ${stageTagClass(entry.level)}`}>
                      {stageTagText(entry)}
                    </span>
                    {entry.voiceName && (
                      <span className="shrink-0 rounded-sm border border-museum-200/80 bg-white/70 px-1.5 py-[1px] text-[9px] text-museum-700">
                        {entry.voiceName}
                      </span>
                    )}
                    <span className="break-words">{entry.message}</span>
                    {entry.tokens && (
                      <span className="ml-auto shrink-0 text-[9px] tracking-widest text-museum-400">
                        prompt {entry.tokens.prompt} / completion {entry.tokens.completion}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!stickToBottom && (
            <button
              type="button"
              onClick={handleScrollToBottom}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full border border-museum-300/80 bg-white/85 px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-museum-700 shadow-sm hover:bg-white"
            >
              回到最新 <ArrowDown className="h-3 w-3" />
            </button>
          )}

          {lastTokenLine && (
            <p className="mt-2 text-[10px] text-museum-400 font-mono tracking-widest">
              最近一次 token 用量：prompt {lastTokenLine.tokens?.prompt} / completion {lastTokenLine.tokens?.completion} / total {lastTokenLine.tokens?.total}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

export default GenerationLogPanel;
