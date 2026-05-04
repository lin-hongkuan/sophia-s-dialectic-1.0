import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BookOpen, Compass, Flame, HelpCircle, Lightbulb, Loader2, Sparkles, Users } from 'lucide-react';
import { AnalysisResult, KeywordExplainer } from '../types';
import { enrichKeyword } from '../services/sophiaService';
import { HangingLabel } from './PageHero';

interface ConceptDetailPageProps {
  result: AnalysisResult;
  keywordId: string;
  /** Whether the active environment can call the LLM (used to decide whether to attempt enrichment). */
  canEnrich: boolean;
  /** Called after enrichment so the host can persist the updated result. */
  onEnriched?: (updatedResult: AnalysisResult) => void;
  /** Back-link target — typically the analysis page that owns this keyword. */
  onBack: () => void;
}

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; placeholder?: string }>
  = ({ title, icon, children, placeholder }) => (
    <section className="bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-7">
      <div className="flex items-center gap-2 mb-4 text-museum-900">
        <span className="text-museum-700">{icon}</span>
        <h3 className="font-serif text-xl md:text-2xl">{title}</h3>
      </div>
      {children || (
        <p className="text-museum-500 text-sm leading-relaxed">{placeholder || '本节暂无内容。可以在线时返回首页重新生成，或继续阅读其他部分。'}</p>
      )}
    </section>
  );

const FurtherReadingList: React.FC<{ items?: string[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} className="flex items-start gap-2 text-museum-800 leading-relaxed">
          <span className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-museum-400" aria-hidden="true" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
};

const RepresentativeFigures: React.FC<{ items?: KeywordExplainer['representativeFigures'] }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((figure, idx) => (
        <div key={`${figure.name}-${idx}`} className="border border-museum-100 bg-museum-50/70 p-4">
          <p className="font-serif text-lg text-museum-900">{figure.name}</p>
          {figure.oneLine && <p className="mt-1 text-sm text-museum-700 leading-relaxed">{figure.oneLine}</p>}
        </div>
      ))}
    </div>
  );
};

const ConceptDetailPage: React.FC<ConceptDetailPageProps> = ({ result, keywordId, canEnrich, onEnriched, onBack }) => {
  const initialKeyword = useMemo(() => result.keywords.find((k) => k.id === keywordId), [result, keywordId]);
  const [keyword, setKeyword] = useState<KeywordExplainer | undefined>(initialKeyword);
  const [enrichState, setEnrichState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Reset whenever the underlying keyword changes (route nav between concepts).
  useEffect(() => {
    setKeyword(initialKeyword);
    setEnrichError(null);
    setEnrichState(initialKeyword?.enriched ? 'done' : 'idle');
  }, [initialKeyword]);

  // Auto-trigger enrichment on first mount when we can. Manual retry handled by the button below.
  useEffect(() => {
    if (!keyword || keyword.enriched) return;
    if (!canEnrich) return;
    if (enrichState !== 'idle') return;
    let cancelled = false;
    setEnrichState('loading');
    enrichKeyword(result, keyword.id)
      .then((next) => {
        if (cancelled) return;
        const updatedKeywords = result.keywords.map((k) => (k.id === next.id ? next : k));
        const updatedResult: AnalysisResult = { ...result, keywords: updatedKeywords };
        setKeyword(next);
        setEnrichState('done');
        onEnriched?.(updatedResult);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn('[sophia] enrichKeyword failed:', err);
        setEnrichError(err instanceof Error ? err.message : '补全失败');
        setEnrichState('error');
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword?.id, canEnrich]);

  if (!keyword) {
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-museum-200 rounded-xl p-8 text-center shadow-sm">
        <h2 className="font-serif text-3xl text-museum-900 mb-3">没有找到这个概念</h2>
        <p className="text-museum-600 leading-relaxed mb-6">这条分析里不包含 id 为 <code className="font-mono">{keywordId}</code> 的概念，可能是链接已经过时。</p>
        <button onClick={onBack} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
          返回分析
        </button>
      </div>
    );
  }

  const handleManualEnrich = () => {
    if (!canEnrich || enrichState === 'loading') return;
    setEnrichError(null);
    setEnrichState('idle');
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-16 animate-fade-in -mt-4 md:-mt-12">
      <div className="text-center py-7 md:py-12 space-y-4 md:space-y-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono uppercase tracking-widest text-museum-500 hover:text-museum-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          回到分析
        </button>
        <HangingLabel ariaLabel={`Concept ${keyword.term}`} icon={<Sparkles className="w-4 h-4" />}>Concept Card</HangingLabel>
        <h1 className="font-serif text-3xl md:text-5xl text-museum-900 leading-tight">{keyword.term}</h1>
        <p className="text-museum-700 leading-relaxed max-w-2xl mx-auto">{keyword.meaning || '这个概念尚未给出简短解释。'}</p>
        <p className="text-sm text-museum-500 leading-relaxed max-w-2xl mx-auto">为什么它会改变问题：{keyword.importance || '尚未说明。'}</p>
      </div>

      {enrichState === 'loading' && (
        <div className="mb-6 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-500">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> 正在为这个概念补全完整档案...
        </div>
      )}
      {enrichState === 'error' && (
        <div className="mb-6 flex flex-col items-center gap-2 text-xs text-red-700">
          <p>无法补全完整概念档案：{enrichError || '未知错误'}</p>
          {canEnrich && (
            <button onClick={handleManualEnrich} className="px-4 py-1.5 border border-red-300 rounded-full hover:bg-red-50 transition-colors">
              重试补全
            </button>
          )}
        </div>
      )}
      {!keyword.enriched && !canEnrich && (
        <div className="mb-6 mx-auto max-w-2xl text-xs text-museum-500 leading-relaxed text-center border border-museum-200 bg-museum-50/70 p-4">
          当前没有配置 API 或处于离线状态，只展示已有的简短解释。在线时再次进入这个概念页可自动补全完整档案。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        <Section title="学理化定义" icon={<BookOpen className="w-4 h-4" />}>
          {keyword.definition ? <p className="text-museum-800 leading-relaxed">{keyword.definition}</p> : null}
        </Section>
        <Section title="常见误解" icon={<Flame className="w-4 h-4" />}>
          {keyword.misconception ? <p className="text-museum-800 leading-relaxed">{keyword.misconception}</p> : null}
        </Section>
        <Section title="代表人物 / 流派" icon={<Users className="w-4 h-4" />}>
          {keyword.representativeFigures && keyword.representativeFigures.length > 0
            ? <RepresentativeFigures items={keyword.representativeFigures} />
            : null}
        </Section>
        <Section title="与当前问题的关系" icon={<Compass className="w-4 h-4" />}>
          {keyword.relationToQuestion ? <p className="text-museum-800 leading-relaxed">{keyword.relationToQuestion}</p> : null}
        </Section>
        <Section title="一个生活例子" icon={<Lightbulb className="w-4 h-4" />}>
          {keyword.lifeExample ? <p className="text-museum-800 leading-relaxed">{keyword.lifeExample}</p> : null}
        </Section>
        <Section title="一个反问" icon={<HelpCircle className="w-4 h-4" />}>
          {keyword.challengeQuestion ? <p className="text-museum-800 leading-relaxed font-serif text-lg italic">"{keyword.challengeQuestion}"</p> : null}
        </Section>
        <div className="md:col-span-2">
          <Section title="推荐继续阅读" icon={<BookOpen className="w-4 h-4" />}>
            <FurtherReadingList items={keyword.furtherReading} />
          </Section>
        </div>
      </div>

      <div className="mt-10 flex justify-center">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm hover:bg-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> 回到这份分析
        </button>
      </div>
    </div>
  );
};

export default ConceptDetailPage;
