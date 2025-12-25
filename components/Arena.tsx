import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import PhilosopherCard from './PhilosopherCard';
import { ChevronDown, ArrowRight, Sparkles, BookOpen, Layers } from 'lucide-react';
import { getReflectionFeedback } from '../services/geminiService';

interface ArenaProps {
  data: AnalysisResult;
  onReset: () => void;
}

const Arena: React.FC<ArenaProps> = ({ data, onReset }) => {
  const [activeLayer, setActiveLayer] = useState<'common' | 'theory' | 'ontology'>('common');
  const [reflection, setReflection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);

  const handleReflectionSubmit = async () => {
    if (!reflection.trim()) return;
    setIsGettingFeedback(true);
    try {
      const fb = await getReflectionFeedback(data.philosophical_title, reflection);
      setFeedback(fb);
    } catch (e) {
      setFeedback("苏菲暂时保持沉默。");
    } finally {
      setIsGettingFeedback(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-20 animate-fade-in">
      {/* Header Section */}
      <div className="text-center py-12 md:py-20 space-y-4">
        <div className="inline-block border-b-2 border-museum-300 pb-2 mb-4">
           <span className="text-xs font-mono uppercase tracking-widest text-museum-800">辩证竞技场 (The Dialectic Arena)</span>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl text-museum-900 leading-tight">
          {data.philosophical_title}
        </h1>
        <div className="max-w-3xl mx-auto mt-6">
           <p className="text-museum-800 italic text-lg leading-relaxed whitespace-pre-line text-justify bg-white/50 p-6 rounded-lg backdrop-blur-sm border border-museum-100">
             {data.introduction}
           </p>
        </div>
      </div>

      {/* Philosophers Grid - Updated for 4-5 items */}
      <div className="mb-20">
        <div className="text-center mb-12">
          <span className="text-sm font-serif italic text-museum-400">—— 众声喧哗 (Polyphony of Thought) ——</span>
        </div>
        
        {/* Responsive Grid: 1 column mobile, 2 columns large screens. 
            If there is an odd number (5), the last one will naturally take its place in the grid flow.
            We ensure cards have full height to look balanced.
        */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 md:gap-10">
          {data.philosophers?.map((philosopher, idx) => (
            <div key={idx} className="w-full h-full">
              <PhilosopherCard data={philosopher} index={idx} />
            </div>
          ))}
        </div>
      </div>

      {/* Progressive Layers */}
      <div className="max-w-5xl mx-auto bg-white/95 backdrop-blur-md rounded-xl shadow-sm border border-museum-200 overflow-hidden mb-16">
        <div className="flex border-b border-museum-200 overflow-x-auto">
          <button 
            onClick={() => setActiveLayer('common')}
            className={`flex-1 min-w-[150px] py-4 px-2 text-sm md:text-base font-medium transition-colors duration-300 flex items-center justify-center gap-2 ${activeLayer === 'common' ? 'bg-museum-100 text-museum-900 border-b-2 border-museum-800' : 'text-museum-300 hover:text-museum-800'}`}
          >
            <Sparkles className="w-4 h-4" />
            第一层：常识
          </button>
          <button 
            onClick={() => setActiveLayer('theory')}
            className={`flex-1 min-w-[150px] py-4 px-2 text-sm md:text-base font-medium transition-colors duration-300 flex items-center justify-center gap-2 ${activeLayer === 'theory' ? 'bg-museum-100 text-museum-900 border-b-2 border-museum-800' : 'text-museum-300 hover:text-museum-800'}`}
          >
            <BookOpen className="w-4 h-4" />
            第二层：理论
          </button>
          <button 
            onClick={() => setActiveLayer('ontology')}
            className={`flex-1 min-w-[150px] py-4 px-2 text-sm md:text-base font-medium transition-colors duration-300 flex items-center justify-center gap-2 ${activeLayer === 'ontology' ? 'bg-museum-100 text-museum-900 border-b-2 border-museum-800' : 'text-museum-300 hover:text-museum-800'}`}
          >
            <Layers className="w-4 h-4" />
            第三层：本体
          </button>
        </div>

        <div className="p-8 md:p-12 min-h-[400px] transition-all duration-500">
          {activeLayer === 'common' && data.layers?.common_sense && (
            <div className="animate-slide-up space-y-8">
              <h3 className="font-serif text-3xl text-museum-900">{data.layers.common_sense.title}</h3>
              <div className="prose prose-lg prose-stone max-w-none text-museum-800 leading-relaxed whitespace-pre-line text-justify">
                {data.layers.common_sense.content}
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-museum-100">
                {data.layers.common_sense.keywords?.map((kw, i) => (
                  <span key={i} className="px-3 py-1 bg-museum-100 text-museum-900 text-xs rounded-full font-mono uppercase tracking-wider">{kw}</span>
                ))}
              </div>
              <div className="pt-4 flex justify-end">
                <button onClick={() => setActiveLayer('theory')} className="text-museum-900 font-bold border-b-2 border-museum-900 flex items-center gap-2 hover:bg-museum-900 hover:text-museum-50 px-2 py-1 transition-all">
                  深入挖掘 (Dig Deeper) <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeLayer === 'theory' && data.layers?.theoretical && (
             <div className="animate-slide-up space-y-8">
             <h3 className="font-serif text-3xl text-museum-900">{data.layers.theoretical.title}</h3>
             <div className="prose prose-lg prose-stone max-w-none text-museum-800 leading-relaxed whitespace-pre-line text-justify">
               {data.layers.theoretical.content}
             </div>
             <div className="bg-museum-50 p-6 border-l-4 border-museum-800 italic text-museum-800 font-serif">
                <span className="font-bold block mb-2 not-italic font-sans text-xs uppercase tracking-widest text-museum-400">核心概念 (Key Concepts)</span>
                {data.layers.theoretical.concepts?.join(" • ")}
             </div>
             <div className="pt-4 flex justify-end">
               <button onClick={() => setActiveLayer('ontology')} className="text-museum-900 font-bold border-b-2 border-museum-900 flex items-center gap-2 hover:bg-museum-900 hover:text-museum-50 px-2 py-1 transition-all">
                 直抵核心 (Reach the Core) <ArrowRight className="w-4 h-4" />
               </button>
             </div>
           </div>
          )}

          {activeLayer === 'ontology' && data.layers?.ontological && (
             <div className="animate-slide-up space-y-8">
             <h3 className="font-serif text-4xl text-museum-900 mb-6 text-center">{data.layers.ontological.title}</h3>
             <div className="prose prose-xl prose-stone max-w-none text-museum-800 leading-loose font-light whitespace-pre-line text-center px-4 md:px-12">
               {data.layers.ontological.content}
             </div>
             <div className="py-12 flex justify-center">
               <div className="relative max-w-2xl">
                 <span className="absolute -top-6 -left-6 text-6xl text-museum-200 font-serif">“</span>
                 <p className="font-serif text-2xl md:text-3xl text-museum-900 italic text-center relative z-10">
                   {data.layers.ontological.question}
                 </p>
                 <span className="absolute -bottom-10 -right-6 text-6xl text-museum-200 font-serif rotate-180">“</span>
               </div>
             </div>
           </div>
          )}
        </div>
      </div>

      {/* Reflection Area */}
      <div className="max-w-3xl mx-auto mt-20">
        <h3 className="font-serif text-2xl text-museum-900 mb-6 text-center">轮到你发言了</h3>
        <div className="relative">
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="听了先哲们的辩论，你的立场是什么？ (例如：'我认为韩炳哲关于倦怠社会的观点更符合我现在的状态...')"
            className="w-full p-6 bg-white/90 backdrop-blur-sm border border-museum-300 rounded-lg shadow-inner focus:outline-none focus:ring-2 focus:ring-museum-200 min-h-[150px] font-serif text-lg text-museum-900 resize-none"
          />
          <button 
            onClick={handleReflectionSubmit}
            disabled={isGettingFeedback || !reflection}
            className="absolute bottom-4 right-4 bg-museum-900 text-white px-6 py-2 rounded-full hover:bg-black transition-colors disabled:opacity-50 text-sm font-medium tracking-wide"
          >
            {isGettingFeedback ? '正在咨询苏菲...' : '分析我的立场'}
          </button>
        </div>
        
        {feedback && (
          <div className="mt-8 p-6 bg-stone-100/90 border border-stone-200 rounded-lg animate-fade-in backdrop-blur-md">
            <h4 className="font-bold text-museum-900 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600" /> 苏菲的评价
            </h4>
            <p className="text-museum-800 leading-relaxed whitespace-pre-line">{feedback}</p>
          </div>
        )}
      </div>

      <div className="text-center mt-20">
        <button 
          onClick={onReset}
          className="text-museum-400 hover:text-museum-900 transition-colors flex flex-col items-center mx-auto gap-2 text-sm bg-white/50 px-4 py-2 rounded-full backdrop-blur-sm"
        >
          <ChevronDown className="w-6 h-6 rotate-180" />
          开启新的对话
        </button>
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-slide-up { animation: slideUp 0.6s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default Arena;