import React, { useEffect, useRef, useState } from 'react';
import { ThoughtVoice } from '../types';
import { AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Loader2, Quote } from 'lucide-react';

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

const PREVIEW_HEIGHT = 760;

const ThoughtVoiceCard: React.FC<ThoughtVoiceCardProps> = ({ data, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(PREVIEW_HEIGHT);
  const contentRef = useRef<HTMLDivElement>(null);
  const seed = encodeURIComponent(`${data.name}-${index}`);
  const imageUrl = `https://picsum.photos/seed/${seed}/200/200`;
  const isGenerating = data.status === 'generating';
  const isQueued = data.status === 'queued';
  const isFailed = data.status === 'failed';
  const hasArgument = Boolean(data.argument?.trim());
  const isReversed = index % 2 === 1;
  const statusLabel = isQueued ? '排队中' : isGenerating ? '正在展开' : data.status === 'completed' ? '已完成' : '失败';

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
    <aside className={`lg:w-[28%] xl:w-[26%] shrink-0 bg-white/60 backdrop-blur-[3px] border-museum-200 p-6 md:p-7 lg:p-8 flex flex-col justify-between ${isReversed ? 'lg:border-l' : 'lg:border-r'}`}>
      <div>
        <div className="flex flex-wrap gap-2 mb-7">
          <span className="text-[10px] uppercase tracking-widest text-museum-800 bg-white/70 px-3 py-1 font-semibold border border-museum-200">
            {kindLabel[data.kind] || '思想声音'}
          </span>
          {data.school && (
            <span className="text-[10px] uppercase tracking-widest text-museum-500 bg-museum-50/80 px-3 py-1 font-semibold border border-museum-200">
              {data.school}
            </span>
          )}
          {data.status && (
            <span className="text-[10px] uppercase tracking-widest text-museum-500 bg-white/70 px-3 py-1 font-semibold border border-museum-200 inline-flex items-center gap-1">
              {isGenerating && <Loader2 className="w-3 h-3 animate-spin" />}
              {data.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-700" />}
              {isFailed && <AlertCircle className="w-3 h-3 text-red-700" />}
              {statusLabel}
            </span>
          )}
        </div>

        <div className="flex lg:block items-center gap-5">
          <div className="w-20 h-20 md:w-24 md:h-24 lg:w-24 lg:h-24 rounded-full overflow-hidden border border-museum-200 shadow-inner bg-museum-100 shrink-0 lg:mb-6">
            <img src={imageUrl} alt={data.name} className="w-full h-full object-cover grayscale opacity-90" />
          </div>
          <div>
            <p className="text-xs font-mono uppercase tracking-[0.28em] text-museum-400 mb-2">Voice {String(index + 1).padStart(2, '0')}</p>
            <h3 className="font-serif text-3xl md:text-4xl xl:text-[2.65rem] font-bold text-museum-900 leading-tight">{data.name}</h3>
          </div>
        </div>

        <p className="mt-7 text-lg md:text-xl font-serif italic text-museum-700 leading-relaxed">
          {data.oneLine || data.stance || data.coreConcept}
        </p>
      </div>

      {data.quote && (
        <div className="hidden lg:block mt-10 pt-6 border-t border-museum-200/70">
          <Quote className="w-5 h-5 text-museum-300 mb-3" />
          <p className="font-serif italic text-museum-700 leading-relaxed">“{data.quote}”</p>
        </div>
      )}
    </aside>
  );

  const detailTiles = (data.diagnosis || data.prescription || data.thesis || data.critique) && (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-museum-200 border border-museum-200 mb-9">
      {data.diagnosis && (
        <div className="bg-white/72 backdrop-blur-[2px] p-5">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">诊断</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.diagnosis}</p>
        </div>
      )}
      {data.prescription && (
        <div className="bg-white/72 backdrop-blur-[2px] p-5">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">药方</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.prescription}</p>
        </div>
      )}
      {!data.diagnosis && data.thesis && (
        <div className="bg-white/72 backdrop-blur-[2px] p-5">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">主张</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.thesis}</p>
        </div>
      )}
      {!data.prescription && data.critique && (
        <div className="bg-white/72 backdrop-blur-[2px] p-5">
          <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-2">可能的批评</p>
          <p className="font-serif text-lg text-museum-900 leading-relaxed">{data.critique}</p>
        </div>
      )}
    </div>
  );

  const articlePanel = (
    <section className="flex-1 bg-white/82 backdrop-blur-[3px] p-6 md:p-8 lg:p-10 xl:p-12">
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
          <div className="relative border border-museum-100 bg-white/34 backdrop-blur-[2px]">
            <div
              className="relative overflow-hidden transition-[height] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
              style={{ height: `${visibleContentHeight}px` }}
            >
              <div ref={contentRef} className="px-1 md:px-2 pt-1 pb-10 prose prose-xl prose-stone max-w-none text-museum-800 leading-loose text-justify whitespace-pre-line">
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

      {data.quote && (
        <div className="lg:hidden relative bg-white/60 backdrop-blur-[2px] p-6 border-l-4 border-museum-800">
          <Quote className="absolute top-5 left-5 w-7 h-7 text-museum-300 opacity-50" />
          <p className="text-lg font-serif italic text-museum-900 pl-9 relative z-10 leading-relaxed">“{data.quote}”</p>
        </div>
      )}
    </section>
  );

  return (
    <article className="relative overflow-hidden border border-museum-200 shadow-sm bg-white/58 backdrop-blur-[4px]">
      <div className="absolute inset-0 bg-gradient-to-br from-white/45 via-museum-50/18 to-white/35 pointer-events-none" />
      <div className={`relative flex flex-col lg:flex-row ${isReversed ? 'lg:flex-row-reverse' : ''}`}>
        {metaPanel}
        {articlePanel}
      </div>
    </article>
  );
};

export default ThoughtVoiceCard;
