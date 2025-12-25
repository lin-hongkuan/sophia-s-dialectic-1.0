import React, { useState } from 'react';
import { analyzeTopic } from './services/geminiService';
import { AnalysisResult } from './types';
import Arena from './components/Arena';
import ReasoningDisplay from './components/ReasoningDisplay';
import DynamicBackground from './components/DynamicBackground';
import { Search, Feather, Info, ArrowRight } from 'lucide-react';

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;

    setIsAnalyzing(true);
    setResult(null);
    setError(null);

    try {
      const apiPromise = analyzeTopic(topic);
      const delayPromise = new Promise(resolve => setTimeout(resolve, 3500)); 
      
      const [data] = await Promise.all([apiPromise, delayPromise]);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生了未知错误');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setTopic('');
    setError(null);
  };

  return (
    // REMOVED bg-museum-50/80 here to allow DynamicBackground to show through.
    // The base color is provided by the body in index.html.
    <div className="min-h-screen flex flex-col font-sans text-museum-900 overflow-x-hidden relative">
      
      <DynamicBackground />

      {/* Navbar - Made completely transparent initially or slight blur */}
      <nav className="fixed w-full top-0 z-50 bg-museum-50/60 backdrop-blur-sm border-b border-museum-200/50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer group" onClick={handleReset}>
            <div className="bg-museum-900 text-museum-50 p-1 rounded-sm">
              <Feather className="w-4 h-4 md:w-5 md:h-5 group-hover:-rotate-12 transition-transform duration-300" />
            </div>
            <span className="font-serif font-bold text-base md:text-lg tracking-wide text-museum-900">SOPHIA'S DIALECTIC</span>
          </div>
          <div className="flex items-center space-x-6">
             {/* Hidden on mobile for simplicity */}
            <button className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">History</button>
            <button className="hidden md:block text-xs uppercase tracking-widest font-bold text-museum-600 hover:text-museum-900 transition-colors">Manifesto</button>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-20 md:pt-24 px-4 relative z-10 flex flex-col">
        {!result && (
          <div className="flex-grow flex flex-col items-center justify-center -mt-10 md:-mt-20 transition-all duration-700 animate-fade-in px-2 md:px-0">
            
            {/* Hero Section Redesign - English Title */}
            <div className="max-w-4xl w-full text-center relative mb-8 md:mb-16">
              
              {/* Decorative vertical line */}
              <div className="absolute left-1/2 -top-12 h-12 w-px bg-museum-300 -translate-x-1/2 hidden md:block"></div>
              
              <div className="inline-block mb-4 md:mb-8 px-3 py-1 border border-museum-300 rounded-full bg-white/40 backdrop-blur-sm scale-90 md:scale-100">
                <span className="text-[10px] md:text-xs font-mono uppercase tracking-[0.2em] text-museum-600">The Philosophical Engine</span>
              </div>

              <h1 className="font-serif text-5xl sm:text-7xl md:text-9xl text-museum-900 leading-[0.9] mb-4 md:mb-6 tracking-tight drop-shadow-sm">
                Sophia's<br/>
                <span className="italic relative inline-block">
                   Dialectic
                  {/* Underline decoration */}
                  <svg className="absolute w-[110%] h-2 md:h-4 -bottom-1 md:-bottom-2 -left-[5%] text-museum-300/50" viewBox="0 0 100 10" preserveAspectRatio="none">
                    <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
                  </svg>
                </span>
              </h1>
              
              <p className="text-sm sm:text-base md:text-xl text-museum-700 max-w-xs sm:max-w-xl mx-auto leading-relaxed font-light mt-4 md:mt-8 px-2">
                Where your modern anxieties meet the eternal dialogue.
                <span className="block mt-2 text-museum-500 text-xs md:text-sm font-serif italic">
                   输入一个困惑，唤醒历史长河中的理性之光。
                </span>
              </p>
            </div>

            <form onSubmit={handleAnalyze} className="relative w-full max-w-2xl mx-auto group z-20">
              <div className="absolute -inset-1 bg-gradient-to-r from-museum-200 via-museum-100 to-museum-200 rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="What is your dialectic today? (输入困惑...)"
                className="relative w-full px-5 py-4 md:px-8 md:py-6 text-base md:text-xl rounded-full bg-white/90 border-2 border-museum-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] focus:outline-none focus:border-museum-300 focus:ring-0 focus:shadow-[0_8px_40px_rgb(0,0,0,0.08)] transition-all duration-300 placeholder:text-museum-300 font-serif text-center md:text-left backdrop-blur-md"
                disabled={isAnalyzing}
              />
              <button 
                type="submit"
                disabled={!topic || isAnalyzing}
                className="absolute right-1.5 top-1.5 md:right-2 md:top-2 h-[calc(100%-12px)] md:h-[calc(100%-16px)] aspect-square bg-museum-900 text-museum-50 rounded-full flex items-center justify-center hover:bg-black transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group-hover:shadow-lg"
              >
                {isAnalyzing ? (
                  <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                ) : (
                  <ArrowRight className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </button>
            </form>

            <div className="mt-8 md:mt-16 flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl px-2">
              <span className="w-full text-center text-[10px] md:text-xs font-mono text-museum-400 uppercase tracking-widest mb-1 md:mb-2">Philosophy as a Service</span>
              {['玩消失是不对的吗？', '我应该追求金钱还是激情？', 'AI 会取代艺术吗？', '为什么我感到孤独？'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setTopic(suggestion)}
                  className="px-3 py-1.5 md:px-5 md:py-2.5 bg-white/60 border border-museum-200 rounded-lg text-xs md:text-sm text-museum-700 hover:border-museum-400 hover:shadow-md hover:bg-white hover:-translate-y-0.5 transition-all duration-300 font-medium backdrop-blur-sm"
                >
                  {suggestion}
                </button>
              ))}
            </div>
            
            {/* Disclaimer for API Key */}
            {!process.env.API_KEY && (
               <div className="mt-8 md:mt-12 p-3 px-6 bg-red-50 text-red-800 rounded-full border border-red-100 inline-flex items-center gap-2 text-xs font-medium shadow-sm">
                 <Info className="w-3 h-3"/>
                 <span>System Alert: Missing API Key configuration.</span>
               </div>
            )}
          </div>
        )}

        <ReasoningDisplay 
          isAnalyzing={isAnalyzing} 
          isFinished={!!result} 
          trace={result?.reasoning_trace}
        />

        {error && (
          <div className="max-w-md mx-auto mt-8 text-center text-red-600 bg-red-50 p-4 rounded-lg border border-red-100">
            <p className="font-serif">苏菲遇到了错误: {error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-sm underline hover:text-red-800">请重试</button>
          </div>
        )}

        {result && <Arena data={result} onReset={handleReset} />}
      </main>

      <footer className="py-6 md:py-8 text-center text-museum-400 text-[10px] md:text-xs font-mono uppercase tracking-widest relative z-10 opacity-60 hover:opacity-100 transition-opacity">
        <p>© 2024 Sophia's Dialectic. Powered by Gemini & The Ancients.</p>
      </footer>
    </div>
  );
};

export default App;