import React, { useEffect, useRef, useState } from 'react';
import { ThoughtVoice } from '../types';
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface ThoughtVoiceCardProps {
  data: ThoughtVoice;
  index: number;
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

const PREVIEW_HEIGHT = 760;

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

const ThoughtVoiceCard: React.FC<ThoughtVoiceCardProps> = ({ data, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(PREVIEW_HEIGHT);
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
  }, [hasArgument]);

  const isCollapsible = contentHeight > PREVIEW_HEIGHT + 40;
  const visibleContentHeight = isExpanded || !isCollapsible ? contentHeight : PREVIEW_HEIGHT;

  const toggleExpanded = () => setIsExpanded((current) => !current);

  const metaPanel = (
    <aside className={`relative lg:w-[27%] xl:w-[24%] shrink-0 bg-museum-50/64 backdrop-blur-[4px] border-museum-200 p-5 md:p-6 lg:p-7 xl:p-8 flex flex-col ${isReversed ? 'lg:border-l' : 'lg:border-r'}`}>
      <div className="pointer-events-none absolute inset-x-5 top-5 h-px bg-gradient-to-r from-transparent via-museum-300/70 to-transparent" />
      <div>
        <div className="flex flex-wrap gap-2 mb-6">
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

        <div className="flex lg:block items-center gap-5">
          <div className="w-28 h-28 md:w-32 md:h-32 lg:w-full lg:h-[15rem] xl:h-[17rem] overflow-hidden border border-museum-200 bg-museum-100 shrink-0 lg:mb-6 shadow-sm ring-4 ring-white/55">
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
          </div>
          <div className="min-w-0">
            <p className="text-xs font-mono uppercase tracking-[0.28em] text-museum-400 mb-2">Voice {String(index + 1).padStart(2, '0')}</p>
            <h3 className="font-serif text-3xl md:text-4xl xl:text-[2.55rem] font-bold text-museum-900 leading-tight">{data.name}</h3>
            {(data.role || data.coreConcept) && (
              <p className="mt-3 text-[10px] uppercase tracking-[0.24em] text-museum-500 leading-relaxed">
                {data.role || data.coreConcept}
              </p>
            )}
          </div>
        </div>

        <p className="mt-6 border-l border-museum-300/90 pl-4 text-lg md:text-xl font-serif italic text-museum-700 leading-relaxed">
          {data.oneLine || data.stance || data.coreConcept}
        </p>
      </div>

      {normalizedQuote && (
        <figure className="hidden lg:block mt-8 relative overflow-hidden border border-museum-200/90 bg-gradient-to-br from-white/ via-museum-50/38 to-white/20 backdrop-blur-[2px] px-5 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.82),0_12px_30px_rgba(44,42,38,0.06)]">
          <span className="absolute right-4 top-3 font-serif text-5xl leading-none text-museum-200/70" aria-hidden="true">※</span>
          <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.26em] text-museum-400">
            <span className="h-px w-7 bg-museum-300" aria-hidden="true" />
            引文
          </div>
          <blockquote className="relative border-l border-museum-300/80 pl-4 font-serif text-lg italic text-museum-900 leading-relaxed">
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
    <section className="flex-1 min-w-0 bg-white/76 backdrop-blur-[3px] p-5 md:p-7 lg:p-9 xl:p-10">
      {detailTiles}

      <div className="mb-8">
        {!hasArgument && !isFailed && (
          <div className="min-h-[300px] border border-museum-100 bg-white/55 backdrop-blur-[2px] p-8 flex flex-col items-center justify-center text-center">
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
          </div>
        )}

        {hasArgument && (
          <div className="relative border border-museum-100/90 bg-white/42 backdrop-blur-[2px] shadow-[inset_0_1px_0_rgba(255,255,255,0.74)]">
            <div
              className="relative overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ height: `${visibleContentHeight}px` }}
            >
              <div ref={contentRef} className="px-2 md:px-3 pt-2 pb-10 prose prose-xl prose-stone max-w-none text-museum-800 leading-loose text-justify whitespace-pre-line">
                <span className="first-letter:text-7xl first-letter:font-bold first-letter:text-museum-900 first-letter:mr-3 first-letter:float-left first-letter:font-serif">
                  {data.argument}
                </span>
              </div>
              {!isExpanded && isCollapsible && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/94 via-white/66 to-transparent transition-opacity duration-300" />
              )}
            </div>

            {isCollapsible && (
              <div className={`relative z-10 flex justify-center border-t border-museum-100 ${isExpanded ? 'bg-white/62' : 'bg-white/78'} backdrop-blur-[2px] px-4 py-4 transition-colors duration-300`}>
                <button
                  type="button"
                  onClick={toggleExpanded}
                  aria-expanded={isExpanded}
                  className="flex items-center gap-2 px-7 py-2.5 bg-museum-900 text-museum-50 hover:bg-black transition-colors shadow-sm font-serif font-medium tracking-wide group"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" /> 收起正文
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      展开阅读全文 <ChevronDown className="w-4 h-4 ml-1" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {normalizedQuote && (
        <figure className="lg:hidden relative overflow-hidden border border-museum-200/90 bg-gradient-to-br from-white/46 via-museum-50/40 to-white/22 backdrop-blur-[2px] px-6 py-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]">
          <span className="absolute right-5 top-4 font-serif text-5xl leading-none text-museum-200/75" aria-hidden="true">※</span>
          <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-museum-400">
            <span className="h-px w-7 bg-museum-300" aria-hidden="true" />
            引文
          </div>
          <blockquote className="relative border-l border-museum-300/80 pl-4 text-xl font-serif italic text-museum-900 leading-relaxed">「{normalizedQuote}」</blockquote>
        </figure>
      )}
    </section>
  );

  return (
    <article className="relative w-full min-w-0 overflow-hidden border border-museum-200/90 shadow-sm bg-white/50 backdrop-blur-[4px] transition-all duration-500 hover:-translate-y-0.5 hover:shadow-[0_24px_64px_rgba(44,42,38,0.10)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.62),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.38),rgba(242,240,235,0.14)_45%,rgba(255,255,255,0.24))] pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-museum-300/80 to-transparent pointer-events-none" />
      <div className={`relative flex flex-col lg:flex-row ${isReversed ? 'lg:flex-row-reverse' : ''}`}>
        {metaPanel}
        {articlePanel}
      </div>
    </article>
  );
};

export default ThoughtVoiceCard;
