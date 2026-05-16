import React from 'react';
import ConceptDetailPage from './ConceptDetailPage';
import type { AnalysisResult } from '../types/domain';

interface ConceptRouteProps {
  target: { analysisId: string; keywordId: string };
  apiConfigured: boolean;
  isOffline: boolean;
  findAnalysisResultById: (analysisId: string) => AnalysisResult | null;
  onEnriched: (updatedResult: AnalysisResult) => void;
  onBack: () => void;
  onHistory: () => void;
  onHome: () => void;
}

const ConceptRoute: React.FC<ConceptRouteProps> = ({
  target,
  apiConfigured,
  isOffline,
  findAnalysisResultById,
  onEnriched,
  onBack,
  onHistory,
  onHome,
}) => {
  const sourceResult = findAnalysisResultById(target.analysisId);

  if (!sourceResult) {
    return (
      <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-museum-200 rounded-xl p-8 text-center shadow-sm">
        <h2 className="font-serif text-3xl text-museum-900 mb-3">这个概念已经离线</h2>
        <p className="text-museum-600 leading-relaxed mb-6">来源分析不在当前历史中。可能是已被删除，或链接来自另一台设备的本地存储。</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button type="button" onClick={onHistory} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
            去历史里查找
          </button>
          <button type="button" onClick={onHome} className="px-6 py-3 border border-museum-300 bg-white/75 rounded-full font-serif text-museum-800 hover:bg-white transition-colors">
            回到首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <ConceptDetailPage
      result={sourceResult}
      keywordId={target.keywordId}
      canEnrich={apiConfigured && !isOffline}
      onEnriched={onEnriched}
      onBack={onBack}
    />
  );
};

export default ConceptRoute;
