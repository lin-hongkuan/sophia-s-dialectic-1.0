import React, { useEffect, useRef, useState } from 'react';
import { AnalysisResult, ThoughtVoice } from '../types';
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Loader2, MessageSquare, RefreshCw } from 'lucide-react';
import VoiceChatModal from './VoiceChatModal';

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

const kindLabel: Record<string, string> = {
  philosopher: '哲学家',
  school: '思想流派',
  concept: '核心概念',
  position: '现实立场',
  contemporary: '当代批评',
};

interface TrustedPortrait {
  src: string;
  alt: string;
  attribution?: string;
}

type ThoughtVoiceAvatar =
  | {
    type: 'generated';
    src: string;
    alt: string;
    title: string;
  }
  | {
    type: 'portrait';
    src: string;
    alt: string;
    title: string;
  }
  | {
    type: 'symbolic';
    initials: string;
    symbol: string;
    eraLabel: string;
    background: string;
    foreground: string;
    title: string;
  };

// Only verified local or curated portrait assets should be added here; otherwise use symbolic avatars.
const TRUSTED_PORTRAITS: Record<string, TrustedPortrait> = {};

const VOICE_KIND_SYMBOL: Record<ThoughtVoice['kind'], string> = {
  philosopher: 'ϕ',
  school: '§',
  concept: '◇',
  position: '↔',
  contemporary: '⁕',
};

const AVATAR_PALETTES = [
  { background: 'linear-gradient(135deg, #F2F0EB 0%, #D1CCC0 100%)', foreground: '#2C2A26', symbol: '∴' },
  { background: 'linear-gradient(135deg, #F6F1E7 0%, #D8CDB8 100%)', foreground: '#4A3F2F', symbol: '◇' },
  { background: 'linear-gradient(135deg, #EEE9E2 0%, #BEB7AA 100%)', foreground: '#34302A', symbol: '§' },
  { background: 'linear-gradient(135deg, #ECEFF1 0%, #C8CDD1 100%)', foreground: '#30343A', symbol: '※' },
  { background: 'linear-gradient(135deg, #F3EEE7 0%, #CFC5B7 100%)', foreground: '#3C352C', symbol: 'ϕ' },
];

const ERA_RULES = [
  { pattern: /苏格拉底|柏拉图|亚里士多德|斯多葛|伊壁鸠鲁|犬儒|赫拉克利特|巴门尼德|Socrates|Plato|Aristotle|Stoic|Epicur|古希腊|古典/i, label: '古典' },
  { pattern: /奥古斯丁|阿奎那|经院|神学|Augustine|Aquinas|Scholastic|中世纪/i, label: '中世纪' },
  { pattern: /笛卡尔|斯宾诺莎|洛克|休谟|卢梭|康德|黑格尔|Descartes|Spinoza|Locke|Hume|Rousseau|Kant|Hegel|启蒙|理性主义|经验主义|德国观念论|近代/i, label: '近代' },
  { pattern: /尼采|马克思|克尔凯郭尔|叔本华|海德格尔|萨特|波伏娃|维特根斯坦|福柯|德里达|罗尔斯|阿伦特|Nietzsche|Marx|Kierkegaard|Schopenhauer|Heidegger|Sartre|Beauvoir|Wittgenstein|Foucault|Derrida|Rawls|Arendt|现代|当代|后现代|存在主义|现象学|分析哲学|批判理论/i, label: '现代' },
];

const FALLBACK_ERA_LABEL: Record<ThoughtVoice['kind'], string> = {
  philosopher: '思想',
  school: '流派',
  concept: '概念',
  position: '立场',
  contemporary: '当代',
};

const MOBILE_PREVIEW_HEIGHT = 640;
const DESKTOP_PREVIEW_HEIGHT = 760;

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

const canonicalAvatarName = (name: string) =>
  name
    .normalize('NFKC')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => ((hash << 5) - hash + (char.codePointAt(0) || 0)) >>> 0, 0);

const getInitials = (name: string) => {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[-–—_/·•.,，。:：;；!?！？'"“”‘’[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleaned.split(' ').filter(Boolean);
  const latinParts = parts.filter((part) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(part));
  if (latinParts.length >= 2) {
    return `${latinParts[0][0]}${latinParts[latinParts.length - 1][0]}`.toUpperCase();
  }

  const compact = cleaned.replace(/\s+/g, '');
  const initials = Array.from(compact).slice(0, 2).join('');
  return initials ? initials.toUpperCase() : '∴';
};

const getEraLabel = (voice: ThoughtVoice) => {
  const source = [voice.name, voice.school, voice.role, voice.coreConcept].filter(Boolean).join(' ');
  return ERA_RULES.find(({ pattern }) => pattern.test(source))?.label || FALLBACK_ERA_LABEL[voice.kind];
};

const getThoughtVoiceAvatar = (voice: ThoughtVoice, index: number): ThoughtVoiceAvatar => {
  if (voice.avatar?.imageUrl) {
    return {
      type: 'generated',
      src: voice.avatar.imageUrl,
      alt: voice.avatar.alt || `${voice.name} 的思想声音头像`,
      title: `${voice.name} · 由 ${voice.avatar.model} 生成的竖版思想声音头像。`,
    };
  }

  const portrait = TRUSTED_PORTRAITS[canonicalAvatarName(voice.name)];
  if (portrait) {
    return {
      type: 'portrait',
      src: portrait.src,
      alt: portrait.alt,
      title: `${voice.name} 的已核验肖像${portrait.attribution ? `（${portrait.attribution}）` : ''}`,
    };
  }

  const palette = AVATAR_PALETTES[hashText(`${voice.name}-${voice.kind}-${index}`) % AVATAR_PALETTES.length];
  const eraLabel = getEraLabel(voice);
  return {
    type: 'symbolic',
    initials: getInitials(voice.name),
    symbol: VOICE_KIND_SYMBOL[voice.kind] || palette.symbol,
    eraLabel,
    background: palette.background,
    foreground: palette.foreground,
    title: `符号头像：${voice.name}。使用姓名缩写、稳定色板与${eraLabel}标签生成，不代表真人肖像。`,
  };
};

const ThoughtVoiceCard: React.FC<ThoughtVoiceCardProps> = ({ data, index, result, onRetry, isRetrying = false, retryDisabled = false, onRegenerateAvatar, isRegeneratingAvatar = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(() => typeof window === 'undefined' ? DESKTOP_PREVIEW_HEIGHT : window.innerWidth < 768 ? MOBILE_PREVIEW_HEIGHT : DESKTOP_PREVIEW_HEIGHT);
  const [contentHeight, setContentHeight] = useState(previewHeight);
  const [chatOpen, setChatOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const avatar = getThoughtVoiceAvatar(data, index);
  const isGenerating = data.status === 'generating';
  const isQueued = data.status === 'queued';
  const isFailed = data.status === 'failed';
  const hasArgument = Boolean(data.argument?.trim());
  const isReversed = index % 2 === 1;
  const statusLabel = isQueued ? '排队中' : isGenerating ? '正在展开' : data.status === 'completed' ? '已完成' : '失败';
  const normalizedQuote = normalizeQuoteText(data.quote);

  useEffect(() => {
    const updatePreviewHeight = () => setPreviewHeight(window.innerWidth < 768 ? MOBILE_PREVIEW_HEIGHT : DESKTOP_PREVIEW_HEIGHT);
    updatePreviewHeight();
    window.addEventListener('resize', updatePreviewHeight);
    return () => window.removeEventListener('resize', updatePreviewHeight);
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    let frameId = 0;
    const updateHeight = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        setContentHeight((current) => {
          const next = content.scrollHeight;
          return Math.abs(current - next) > 1 ? next : current;
        });
      });
    };

    updateHeight();
    if (typeof ResizeObserver === 'undefined') {
      return () => window.cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [hasArgument, previewHeight]);

  const isCollapsible = contentHeight > previewHeight + 40;
  // While text is actively streaming in we don't lock the wrapper to a measured height or animate
  // it: ResizeObserver fires every ~120ms as new chunks land, and a 700ms height tween chasing
  // that moving target causes the card (and everything below it) to oscillate up and down.
  // Once status flips to 'completed' the height-tween + collapsibility UI takes over.
  const isStreaming = isGenerating && hasArgument;
  const visibleContentHeight = isStreaming ? contentHeight : (isExpanded || !isCollapsible ? contentHeight : previewHeight);

  const toggleExpanded = () => setIsExpanded((current) => !current);

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
          <div className="relative group/avatar w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-full lg:h-[15rem] xl:h-[17rem] overflow-hidden border border-museum-200 bg-museum-100 shrink-0 lg:mb-6 shadow-sm ring-2 ring-white/55 md:ring-4">
            {avatar.type === 'generated' ? (
              <img
                src={avatar.src}
                alt={avatar.alt}
                title={avatar.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover [filter:saturate(0.86)_contrast(0.95)]"
              />
            ) : avatar.type === 'portrait' ? (
              <img src={avatar.src} alt={avatar.alt} title={avatar.title} className="w-full h-full object-cover grayscale opacity-90" />
            ) : (
              <div
                className="relative w-full h-full flex items-center justify-center"
                role="img"
                aria-label={avatar.title}
                title={avatar.title}
                style={{ background: avatar.background, color: avatar.foreground }}
              >
                <span className="absolute inset-[7px] border border-white/55" aria-hidden="true" />
                <span className="absolute top-3 right-3 text-lg font-serif opacity-40" aria-hidden="true">{avatar.symbol}</span>
                <span className="relative z-10 font-serif text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight" aria-hidden="true">{avatar.initials}</span>
                <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-white/60 px-2 py-0.5 text-[9px] font-mono tracking-[0.18em] text-museum-800" aria-hidden="true">
                  {avatar.eraLabel}
                </span>
              </div>
            )}
            {onRegenerateAvatar && data.status === 'completed' && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onRegenerateAvatar(data.id); }}
                disabled={isRegeneratingAvatar}
                aria-label={`重新生成 ${data.name} 的头像`}
                title="重新生成头像"
                className="absolute bottom-1.5 right-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-museum-200/70 bg-white/55 text-museum-700 opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:opacity-100 focus-visible:opacity-100 group-hover/avatar:opacity-45 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRegeneratingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
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
    <article className="relative w-full min-w-0 overflow-hidden border border-museum-200/90 bg-white/70 shadow-none transition-all duration-500 md:bg-white/50 md:backdrop-blur-[4px] md:shadow-sm md:hover:-translate-y-0.5 md:hover:shadow-[0_24px_64px_rgba(44,42,38,0.10)]">
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

export default ThoughtVoiceCard;
