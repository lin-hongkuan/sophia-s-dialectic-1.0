import React, { useState, useEffect } from 'react';
import { Loader2, BrainCircuit, Search, BookOpen, Scale } from 'lucide-react';

interface ReasoningDisplayProps {
  isAnalyzing: boolean;
  isFinished: boolean;
  trace?: string[]; // Optional trace from actual AI if we had it streaming, or simulated
}

const SIMULATED_STEPS = [
  "解析用户语境...",
  "检索西方哲学史数据库...",
  "定位矛盾核心...",
  "构建第一层论证：社会规范...",
  "构建第二层论证：理论拆解...",
  "深度扫描：康德 vs 功利主义...",
  "构建第三层论证：本体论反思...",
  "生成最终辩证报告..."
];

const ReasoningDisplay: React.FC<ReasoningDisplayProps> = ({ isAnalyzing, isFinished, trace }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const steps = trace && trace.length > 0 ? trace : SIMULATED_STEPS;

  useEffect(() => {
    if (isAnalyzing && !isFinished) {
      const interval = setInterval(() => {
        setCurrentStepIndex((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
      }, 800); // Faster step change to fit more steps in similar time
      return () => clearInterval(interval);
    }
  }, [isAnalyzing, isFinished, steps]);

  if (!isAnalyzing && !isFinished) return null;

  // Icons corresponding to generic step types
  const getIcon = (idx: number) => {
    if (idx % 4 === 0) return <BrainCircuit className="w-5 h-5 text-museum-800" />;
    if (idx % 4 === 1) return <Search className="w-5 h-5 text-museum-800" />;
    if (idx % 4 === 2) return <BookOpen className="w-5 h-5 text-museum-800" />;
    return <Scale className="w-5 h-5 text-museum-800" />;
  };

  return (
    <div className={`transition-all duration-700 ease-in-out ${isFinished ? 'h-0 opacity-0 overflow-hidden' : 'h-auto opacity-100 py-8'}`}>
      <div className="max-w-xl mx-auto bg-white border border-museum-200 shadow-sm p-6 rounded-lg">
        <div className="flex items-center space-x-3 mb-4 border-b border-museum-100 pb-2">
          <Loader2 className="w-5 h-5 animate-spin text-museum-800" />
          <span className="font-serif italic text-museum-800">苏菲的思辨路径 (Sophia's Reasoning)</span>
        </div>
        
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div 
              key={idx} 
              className={`flex items-center space-x-3 transition-all duration-500 ${
                idx === currentStepIndex 
                  ? 'opacity-100 translate-x-0' 
                  : idx < currentStepIndex 
                    ? 'opacity-40' 
                    : 'opacity-0 -translate-x-4 hidden'
              }`}
            >
              <div className="p-2 bg-museum-50 rounded-full border border-museum-100">
                {getIcon(idx)}
              </div>
              <p className="text-sm font-mono text-museum-900">{step}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ReasoningDisplay;