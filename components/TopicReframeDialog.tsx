import React, { useEffect, useRef } from 'react';
import { X, Sparkles, ArrowRight } from 'lucide-react';
import type { ReframeCandidate } from '../services/topicReframe';

interface TopicReframeDialogProps {
  open: boolean;
  originalTopic: string;
  candidates: ReframeCandidate[];
  onPick: (title: string) => void;
  onKeepOriginal: () => void;
  onCancel: () => void;
}

const TopicReframeDialog: React.FC<TopicReframeDialogProps> = ({
  open,
  originalTopic,
  candidates,
  onPick,
  onKeepOriginal,
  onCancel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-museum-950/55 px-4 py-8 backdrop-blur-sm"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reframe-dialog-title"
        onClick={(event) => event.stopPropagation()}
        className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-museum-200 bg-museum-50 px-6 py-7 shadow-[0_20px_60px_-20px_rgba(40,30,15,0.45)] focus:outline-none"
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-museum-500 transition hover:bg-museum-100 hover:text-museum-800"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-museum-500">
          <Sparkles className="h-3 w-3" />
          问题转译建议
        </div>

        <h2
          id="reframe-dialog-title"
          className="mt-3 font-serif text-2xl text-museum-900"
        >
          这看起来还不像一个能展开的哲学问题
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-museum-700">
          Sophia 已经把你的输入翻译成了几个可以正面讨论的版本。挑一个开始，或者保留你的原文继续。
        </p>

        <div className="mt-5 rounded-md border border-museum-200/80 bg-white/70 px-4 py-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-museum-500">你的原文</div>
          <p className="mt-1 break-words font-serif text-museum-800">{originalTopic}</p>
        </div>

        <ul className="mt-5 space-y-3">
          {candidates.map((candidate, idx) => (
            <li key={`${candidate.title}-${idx}`}>
              <button
                type="button"
                onClick={() => onPick(candidate.title)}
                className="group flex w-full items-start gap-3 rounded-lg border border-museum-200 bg-white/80 px-4 py-3 text-left transition hover:border-museum-400 hover:bg-white"
              >
                <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-museum-300 bg-museum-50 text-[10px] font-mono text-museum-600">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-base text-museum-900">{candidate.title}</p>
                  {candidate.rationale && (
                    <p className="mt-1 text-[12px] leading-relaxed text-museum-600">{candidate.rationale}</p>
                  )}
                </div>
                <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-museum-400 transition group-hover:translate-x-0.5 group-hover:text-museum-700" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 border-t border-museum-200/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-museum-500">
            如果你确认就是要分析这个原文，可以直接保留它。
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded border border-museum-300 px-4 py-2 text-sm text-museum-700 transition hover:bg-museum-100"
            >
              暂不开始
            </button>
            <button
              type="button"
              onClick={onKeepOriginal}
              className="rounded border border-museum-700 bg-museum-900 px-4 py-2 text-sm text-museum-50 transition hover:bg-museum-800"
            >
              保留原文继续
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopicReframeDialog;
