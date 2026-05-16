import React, { useEffect, useState } from 'react';
import type { AnalysisResult, ThoughtVoice } from '../types/domain';
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, ImageOff, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import VoiceChatModal from './VoiceChatModal';
import { getAvatarFallbackMessage, getSymbolicAvatar, resolveThoughtVoiceAvatar } from './thoughtVoice/avatar';
import { useCollapsibleContent } from './thoughtVoice/useCollapsibleContent';
import { VoiceAvatar } from './thoughtVoice/VoiceAvatar';

interface ThoughtVoiceCardProps {
  data: ThoughtVoice;
  index: number;
  /** Required so the in-card "talk to this voice" modal has the surrounding analysis context. */
  result: AnalysisResult;
  onRetry?: (voiceId: string) => void;
  isRetrying?: boolean;
  retryDisabled?: boolean;
  /** Optional — when provided, renders a barely-visible regenerate-avatar button overlaid on the avatar. */
  onRegenerateAvatar?: (voiceId: string) => void;
  isRegeneratingAvatar?: boolean;
}

const kindLabel: Record<ThoughtVoice['kind'], string> = {
  philosopher: '哲学家',
  school: '思想流派',
  concept: '核心概念',
  position: '现实立场',
  contemporary: '当代批评',
};

const QUOTE_PAIRS: Array<[string, string]> = [
  ['「', '」'],
  ['『', '』'],
  ['“', '”'],
  ['‘', '’'],
  ['\"', '\"'],
  ["'", "'"],
];

const QUOTE_EDGE_CHARS = '「」『』“”‘’\"\'';
const quoteEdgePattern = new RegExp(`^[${QUOTE_EDGE_CHARS}]+|[${QUOTE_EDGE_CHARS}]+$`, 'g');

const normalizeQuoteText = (value?: string) => {
  if (!value) return '';

  let text = value
    .replace(/\r\n/g, '\n')
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let changed = true;
  while (changed && text.length > 1) {
    changed = false;
    for (const [open, close] of QUOTE_PAIRS) {
      if (text.startsWith(open) && text.endsWith(close) && text.length > open.length + close.length) {
        text = text.slice(open.length, text.length - close.length).trim();
        changed = true;
        break;
      }
    }
  }

  return text.replace(quoteEdgePattern, '').trim();
};

const ThoughtVoiceCard: React.FC<ThoughtVoiceCardProps> = ({ data, index, result, onRetry, isRetrying = false, retryDisabled = false, onRegenerateAvatar, isRegeneratingAvatar = false }) => {
  const [chatOpen, setChatOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const generatedAvatarUrl = data.avatar?.imageUrl || '';

  useEffect(() => {
    if (generatedAvatarUrl) setAvatarFailed(false);
  }, [generatedAvatarUrl]);

  const avatar = avatarFailed ? getSymbolicAvatar(data, index) : resolveThoughtVoiceAvatar(data, index);
  const isGenerating = data.status === 'generating';
  const isQueued = data.status === 'queued';
  const isFailed = data.status === 'failed';
  const hasArgument = Boolean(data.argument?.trim());
  const isReversed = index % 2 === 1;
  const statusLabel = isQueued ? '排队中' : isGenerating ? '正在展开' : data.status === 'completed' ? '已完成' : '失败';
  const normalizedQuote = normalizeQuoteText(data.quote);
  const avatarFallbackMessage = avatar.type === 'symbolic'
    ? getAvatarFallbackMessage(data, avatarFailed)
    : '';

  // While text is actively streaming in we don't lock the wrapper to a measured height or animate
  // it: ResizeObserver fires every ~120ms as new chunks land, and a 700ms height tween chasing
  // that moving target causes the card (and everything below it) to oscillate up and down.
  // Once status flips to 'completed' the height-tween + collapsibility UI takes over.
  const isStreaming = isGenerating && hasArgument;
  const {
    contentRef,
    isExpanded,
    isCollapsible,
    toggleExpanded,
    visibleContentHeight,
  } = useCollapsibleContent({ hasContent: hasArgument, isStreaming });

  const metaPanel = (
    <aside className={`relative lg:w-[27%] xl:w-[24%] shrink-0 bg-museum-50/72 md:backdrop-blur-[4px] border-museum-200 p-4 md:p-6 lg:p-7 xl:p-8 flex flex-col ${isReversed ? 'lg:border-l' : 'lg:border-r'}`}>
      <div className="pointer-events-none absolute inset-x-4 top-4 h-px bg-gradient-to-r from-transparent via-museum-300/70 to-transparent md:inset-x-5 md:top-5" />
      <div>
        <div className="flex flex-wrap gap-1.5 md:gap-2 mb-4 md:mb-6">
          <span className="text-[10px] uppercase tracking-widest text-museum-800 bg-white/78 px-3 py-1 font-semibold border border-museum-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            {kindLabel[data.kind] || '思想声音'}
          </span>
          {data.school && (
            <span className="text-[10px] uppercase tracking-widest text-museum-500 bg-museum-50/90 px-3 py-1 font-semibold border border-museum-200/90">
              {data.school}
            </span>
          )}
          {data.status && (
            <span className="text-[10px] uppercase tracking-widest text-museum-500 bg-white/78 px-3 py-1 font-semibold border border-museum-200/90 inline-flex items-center gap-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
              {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
              {data.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
              {isFailed && <AlertCircle className="w-3 h-3 text-red-700" />}
              {statusLabel}
            </span>
          )}
        </div>

        <div className="flex lg:block items-center gap-4 md:gap-5">
          <VoiceAvatar
            voice={data}
            avatar={avatar}
            fallbackMessage={avatarFallbackMessage}
            onImageError={() => setAvatarFailed(true)}
            onRegenerateAvatar={onRegenerateAvatar}
            isRegeneratingAvatar={isRegeneratingAvatar}
          />
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.28em] text-museum-400 mb-2">Voice {String(index + 1).padStart(2, '0')}</p>
            <h3 className="font-serif text-2xl md:text-4xl xl:text-[2.55rem] font-bold text-museum-900 leading-tight break-words">{data.name}</h3>
            {(data.role || data.coreConcept) && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-museum-500 leading-relaxed">
                {data.role || data.coreConcept}
              </p>
            )}
          </div>
        </div>

        {avatarFallbackMessage && (
          <div
            className="mt-3 flex items-start gap-2 border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-[11px] leading-relaxed text-amber-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
            role="status"
          >
            <ImageOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{avatarFallbackMessage}</span>
          </div>
        )}

        <p className="mt-4 md:mt-6 border-l border-museum-300/90 pl-3 md:pl-4 text-base md:text-xl font-serif font-light text-museum-700 leading-loose tracking-wide">
          {data.oneLine || data.stance || data.coreConcept}
        </p>

        <button
          type="button"
          onClick={() => setChatOpen(true)}
          disabled={data.status !== 'completed'}
          title={data.status === 'completed' ? `与 ${data.name} 对话` : '正文完成后即可对话'}
          aria-label={`与 ${data.name} 对话`}
          className="mt-5 md:mt-6 inline-flex items-center gap-2 border border-museum-300/90 bg-white/70 px-3.5 py-2 text-[11px] font-mono uppercase tracking-[0.22em] text-museum-700 hover:bg-museum-900 hover:text-museum-50 hover:border-museum-900 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:text-museum-700 disabled:hover:border-museum-300/90"
        >
          <MessageSquare className="w-3 h-3" />
          与 {data.name} 对话
        </button>
      </div>

      {normalizedQuote && (
        <figure className="hidden lg:block mt-8 relative overflow-hidden border border-museum-200/90 bg-gradient-to-br from-white/ via-museum-50/38 to-white/20 backdrop-blur-[2px] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_30px_rgba(44,42,38,0.06)]">
          <span className="absolute right-4 top-3 font-serif text-5xl leading-none text-museum-200/70" aria-hidden="true">※</span>
          <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-museum-400">
            <span className="h-px w-7 bg-museum-300" aria-hidden="true" />
            引文
          </div>
          <blockquote className="relative border-l border-museum-300/80 pl-4 font-serif text-lg font-light text-museum-900 leading-loose tracking-wide">
            <span>「{normalizedQuote}」</span>
          </blockquote>
        </figure>
      )}
    </aside>
  );

  const detailTiles = (data.diagnosis || data.prescription || data.thesis || data.critique) && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-museum-200/90 border border-museum-200/90 mb-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]">
      {data.diagnosis && (
        <div className="bg-white/76 backdrop-blur-[2px] p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">诊断</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.diagnosis}</p>
        </div>
      )}
      {data.prescription && (
        <div className="bg-white/76 backdrop-blur-[2px] p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">药方</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.prescription}</p>
        </div>
      )}
      {!data.diagnosis && data.thesis && (
        <div className="bg-white/76 backdrop-blur-[2px] p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">主张</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.thesis}</p>
        </div>
      )}
      {!data.prescription && data.critique && (
        <div className="bg-white/76 backdrop-blur-[2px] p-5 md:p-6">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">可能的批评</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.critique}</p>
        </div>
      )}
    </div>
  );

  const articlePanel = (
    <section className="flex-1 min-w-0 bg-white/82 md:backdrop-blur-[3px] px-4 py-5 md:p-7 lg:p-9 xl:p-10">
      {detailTiles}

      <div className="mb-5 md:mb-8">
        {!hasArgument && !isFailed && (
          <div className="min-h-[180px] md:min-h-[300px] border border-museum-100 bg-white/55 backdrop-blur-[2px] p-5 md:p-8 flex flex-col items-center justify-center text-center">
            <Loader2 className="w-6 h-6 animate-spin text-museum-600 mb-4" />
            <p className="font-serif text-xl text-museum-900">{isQueued ? '等待这一路思想展开' : '正在展开这一路思想'}</p>
            <p className="text-sm text-museum-500 mt-2">这部分会以长文形式逐段呈现。</p>
          </div>
        )}

        {isFailed && (
          <div className="min-h-[180px] border border-red-100 bg-red-50/90 p-8 text-center text-red-800">
            <AlertCircle className="w-6 h-6 mx-auto mb-4" />
            <p className="font-serif text-xl">这一位思想声音生成失败</p>
            <p className="text-sm mt-2">{data.error || '可以稍后重新生成。'}</p>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(data.id)}
                disabled={retryDisabled || isRetrying}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-museum-900 text-museum-50 rounded-full text-sm font-serif hover:bg-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`重新生成 ${data.name}`}
              >
                {isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {isRetrying ? '正在重新生成…' : '重新生成这张卡片'}
              </button>
            )}
          </div>
        )}

        {hasArgument && (
          <div className="relative border-0 bg-white/55 shadow-none md:border md:border-museum-100/90 md:bg-white/42 md:backdrop-blur-[2px] md:shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
            <div
              className={`relative overflow-hidden ${isStreaming ? '' : 'transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]'}`}
              style={{ height: `${visibleContentHeight}px` }}
            >
              <div ref={contentRef} className="px-0 md:px-3 pt-1 md:pt-2 pb-8 md:pb-10 prose prose-stone max-w-none text-museum-800 leading-relaxed md:leading-loose md:text-justify whitespace-pre-line">
                <span className="md:first-letter:text-7xl md:first-letter:font-bold md:first-letter:text-museum-900 md:first-letter:mr-3 md:first-letter:float-left md:first-letter:font-serif">
                  {data.argument}
                </span>
              </div>
              {!isStreaming && !isExpanded && isCollapsible && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-36 md:h-32 bg-gradient-to-t from-white via-white/80 to-transparent transition-opacity duration-300" />
              )}
            </div>

            {!isStreaming && isCollapsible && (
              <div className={`relative z-10 flex justify-center border-t border-museum-100 ${isExpanded ? 'bg-white/72' : 'bg-white/86'} md:backdrop-blur-[2px] px-3 py-3 md:px-4 md:py-4 transition-colors duration-300`}>
                <button
                  type="button"
                  onClick={toggleExpanded}
                  aria-expanded={isExpanded}
                  className="flex w-full items-center justify-center gap-2 px-5 py-3 bg-museum-900 text-museum-50 hover:bg-black transition-colors shadow-sm font-serif font-medium tracking-wide group sm:w-auto md:px-7 md:py-2.5"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" /> 收起正文
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      继续阅读全文 <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {normalizedQuote && (
        <figure className="lg:hidden relative overflow-hidden border-l-2 border-museum-300 bg-museum-50/70 px-4 py-4">
          <span className="absolute right-4 top-3 font-serif text-4xl leading-none text-museum-200/45" aria-hidden="true">※</span>
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-museum-400">
            <span className="h-px w-7 bg-museum-300" aria-hidden="true" />
            引文
          </div>
          <blockquote className="relative pr-5 text-base md:text-xl font-serif font-light text-museum-900 leading-loose tracking-wide">「{normalizedQuote}」</blockquote>
        </figure>
      )}
    </section>
  );

  return (
    <article className="relative w-full min-w-0 overflow-hidden border border-museum-200/90 bg-white/70 shadow-none transition-all duration-500 [content-visibility:auto] [contain-intrinsic-size:900px] md:bg-white/50 md:backdrop-blur-[4px] md:shadow-sm md:hover:-translate-y-0.5 md:hover:shadow-[0_24px_64px_rgba(44,42,38,0.10)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.62),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.38),rgba(242,240,235,0.14)_45%,rgba(255,255,255,0.24))] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-museum-300/80 to-transparent pointer-events-none" />
      <div className={`relative flex flex-col lg:flex-row ${isReversed ? 'lg:flex-row-reverse' : ''}`}>
        {metaPanel}
        {articlePanel}
      </div>
      {chatOpen && (
        <VoiceChatModal
          open={chatOpen}
          voice={data}
          result={result}
          onClose={() => setChatOpen(false)}
        />
      )}
    </article>
  );
};

export default React.memo(ThoughtVoiceCard);
