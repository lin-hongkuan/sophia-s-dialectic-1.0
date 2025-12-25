import React, { useState } from 'react';
import { Philosopher } from '../types';
import { Quote, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';

interface PhilosopherCardProps {
  data: Philosopher;
  index: number;
}

const PhilosopherCard: React.FC<PhilosopherCardProps> = ({ data, index }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Use picsum for a persistent but random-looking avatar based on name length
  const seed = data.name.length;
  const imageUrl = `https://picsum.photos/seed/${seed}/200/200`;

  return (
    <div className="bg-white border border-museum-200 p-8 md:p-12 shadow-sm hover:shadow-lg transition-all duration-500 rounded-lg">
      <div className="flex flex-col md:flex-row md:items-start gap-8 mb-8 pb-8 border-b border-museum-100">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-museum-50 shadow-inner shrink-0 mx-auto md:mx-0">
          <img src={imageUrl} alt={data.name} className="w-full h-full object-cover grayscale" />
        </div>
        <div className="text-center md:text-left flex-1">
          <h3 className="font-serif text-4xl font-bold text-museum-900 mb-3">{data.name}</h3>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-4">
            <span className="text-sm uppercase tracking-widest text-museum-800 bg-museum-100 px-3 py-1 rounded-sm font-semibold border border-museum-200">
              {data.school}
            </span>
          </div>
          <h4 className="text-xl font-serif italic text-museum-600 leading-relaxed">
            核心主张：{data.core_concept}
          </h4>
        </div>
      </div>
      
      {/* 
        修复说明：
        1. 容器添加 relative，确保 absolute 的遮罩层相对于文本容器定位。
        2. 始终渲染完整文本 data.argument，不再使用截断的 snippet，确保内容存在。
        3. 使用 max-h 动画实现平滑展开。
      */}
      <div className="mb-10 px-2 md:px-4">
        <div 
          className={`relative prose prose-xl prose-stone max-w-none text-museum-800 leading-loose text-justify whitespace-pre-line overflow-hidden transition-all duration-1000 ease-in-out ${isExpanded ? 'max-h-[6000px]' : 'max-h-[400px]'}`}
        >
           {/* Drop cap styling */}
           <span className="first-letter:text-7xl first-letter:font-bold first-letter:text-museum-900 first-letter:mr-3 first-letter:float-left first-letter:font-serif">
             {data.argument}
           </span>
           
           {/* Gradient Overlay - 只在未展开时显示，并覆盖在底部 */}
           <div 
             className={`absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-white via-white/90 to-transparent transition-opacity duration-500 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`} 
           />
        </div>

        <div className="flex justify-center mt-8">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 px-8 py-3 bg-museum-900 text-museum-50 hover:bg-black rounded-full transition-all shadow-md hover:shadow-lg font-serif font-medium tracking-wide group z-10"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> 收起论述
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4 group-hover:scale-110 transition-transform" /> 
                阅读完整论述 (2000字+) <ChevronDown className="w-4 h-4 ml-1" />
              </>
            )}
          </button>
        </div>
      </div>

      <div className="relative bg-museum-50 p-8 rounded-lg border-l-4 border-museum-800 mx-2 md:mx-4">
        <Quote className="absolute top-6 left-6 w-8 h-8 text-museum-300 opacity-50" />
        <p className="text-xl font-serif italic text-museum-900 pl-10 relative z-10 leading-relaxed">
          "{data.quote}"
        </p>
      </div>
    </div>
  );
};

export default PhilosopherCard;