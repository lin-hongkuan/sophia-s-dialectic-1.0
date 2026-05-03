import React from 'react';
import { BookOpen, Compass, Layers, Sparkles, Map, Asterisk } from 'lucide-react';
import { PageHero } from './PageHero';

interface ManifestoPageProps {
  onBack: () => void;
}

const principles = [
  {
    icon: <Compass className="w-5 h-5" />,
    title: '提问先于回答',
    eyebrow: 'Question First',
    body: '不急于终结困惑。比起塞给你一个答案，澄清「你究竟在问什么」是更有价值的起点。它是在探究事实、衡量价值，还是在寻找一种自洽的生活姿态？',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: '形态服从思想',
    eyebrow: 'Living Structure',
    body: '不同的困惑需要不同的展开方式。虚无主义更像门诊，伦理争议更像法庭，缸中之脑更像思想实验。排版与结构应由问题本身决定，而非僵化模板。',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: '保留思想的密度',
    eyebrow: 'Slow Reading',
    body: '拒绝过度简化的快餐逻辑。一个深刻的立场须有论证、诊断与反驳。我们提供值得缓慢咀嚼的阅读体验，让思想以接近短论文的形态完整呈现。',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: '将解答交还于你',
    eyebrow: 'Open Ending',
    body: '哲学分析不替你强制关闭问题。一场好的思考，会让你确切地标定自己站在哪里，并清晰地看见为了捍卫这个位置，你需要付出怎样的代价。',
  },
];

const methodSteps = [
  { icon: <Compass className="w-4 h-4" />, label: 'Frame', title: '廓清问题', body: '在作答之前，先将含混的日常困惑，还原为底层的哲学诘问——拆除预设，直面张力。' },
  { icon: <Map className="w-4 h-4" />, label: 'Map', title: '测绘路径', body: '拒绝单一视角。我们将可能的思路汇集成思维地图，让你在进入前，先看清思想的岔路。' },
  { icon: <Layers className="w-4 h-4" />, label: 'Voices', title: '交响对话', body: '引入不同的哲学家、流派与核心概念。他们在此争论、作证，以各自的逻辑向你提案。' },
  { icon: <Sparkles className="w-4 h-4" />, label: 'Return', title: '重返真实', body: '以开放的结尾交还于你。带着重新梳理过的思想，回到你需要做出选择的真实生活中。' },
];

const ManifestoPage: React.FC<ManifestoPageProps> = () => {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 pb-24 md:pb-40 animate-fade-in -mt-4 md:-mt-8 text-museum-900">
      {/* Hero Section */}
      <PageHero
        eyebrow="Our Philosophy"
        accent="Manifesto"
        icon={<Asterisk className="h-4 w-4" />}
        className="mb-12 md:mb-20"
        descriptionClassName="mx-auto mt-8 max-w-2xl px-2 font-serif text-lg leading-loose text-museum-700/90 tracking-wide md:mt-10 md:text-xl font-light"
        description={(
          <>
            将日常的困惑，展开为可阅读的思想地图。<br className="hidden sm:block" />
            我们不生产速食的标准答案，而是为你搭建一座临时的思维展厅。
          </>
        )}
      />

      {/* Intro Statement / Editorial Block */}
      <div className="group relative mx-auto max-w-4xl py-12 md:py-20 mb-20 md:mb-32 bg-white/5 hover:bg-white/10 backdrop-blur-[2px] transition-colors duration-1000 ease-out overflow-hidden">
        {/* Subtle corner brackets */}
        <div className="absolute left-0 top-0 w-6 h-px bg-museum-300 transition-all duration-1000 ease-out group-hover:w-12 group-hover:bg-museum-400" />
        <div className="absolute left-0 top-0 h-6 w-px bg-museum-300 transition-all duration-1000 ease-out group-hover:h-12 group-hover:bg-museum-400" />
        <div className="absolute right-0 bottom-0 w-6 h-px bg-museum-300 transition-all duration-1000 ease-out group-hover:w-12 group-hover:bg-museum-400" />
        <div className="absolute right-0 bottom-0 h-6 w-px bg-museum-300 transition-all duration-1000 ease-out group-hover:h-12 group-hover:bg-museum-400" />
        
        <div className="flex flex-col md:flex-row items-start gap-8 md:gap-16 px-6 md:px-12 relative z-10 transition-transform duration-1000 group-hover:scale-[1.01]">
          <div className="md:w-1/3 flex-shrink-0">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-museum-400 mb-4 border-b border-museum-200 pb-4 inline-block">The Premise</div>
            <h2 className="font-serif text-3xl md:text-4xl text-museum-900 leading-tight font-light tracking-wide">
              面对现代困境，<br />
              <span className="text-museum-500 font-normal">我们如何思考？</span>
            </h2>
          </div>
          <div className="md:w-2/3 space-y-6 text-base md:text-lg leading-relaxed text-museum-700 font-serif font-light tracking-wide">
            <p>
              当你带来一个现代困惑：要不要生孩子、如何面对虚无主义，或怎样证明自己不是缸中之脑。
            </p>
            <p>
              我们做的第一件事，不是立刻给出一个结论，而是将你的困惑拆解为<span className="text-museum-900 font-normal border-b border-museum-300/50 pb-0.5">问题的骨架</span>。接着，不同的思想声音进入现场。它们不是为了排列名人名言，而是各自承担一种理解世界的方式：<span className="text-museum-900 font-normal border-b border-museum-300/50 pb-0.5">诊断、辩护、怀疑或反击</span>。
            </p>
          </div>
        </div>
      </div>

      {/* Methodology Section - Wireframe Grid */}
      <div className="mb-24 md:mb-40 px-4 md:px-0">
        <div className="flex items-center gap-4 mb-12">
          <h3 className="font-serif text-2xl text-museum-800">思想展开的演进</h3>
          <div className="flex-grow h-px bg-museum-200" />
          <span className="text-xs font-mono tracking-[0.2em] text-museum-400 uppercase hidden md:inline-block">Methodology</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-t border-l border-museum-200/60">
          {methodSteps.map((step, index) => (
            <article key={step.title} className="group relative border-r border-b border-museum-200/60 bg-white/30 hover:bg-white/80 p-8 md:p-10 transition-colors duration-500 overflow-hidden">
              <div className="absolute top-6 right-6 font-mono text-3xl text-museum-200 opacity-60 group-hover:opacity-100 group-hover:text-museum-400 transition-all duration-500 z-0 pointer-events-none select-none">
                0{index + 1}
              </div>
              <div className="relative z-10 flex flex-col h-full">
                <div className="mb-8 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.15em] text-museum-500 mt-2">
                  <span className="p-2 border border-museum-200 bg-museum-50/80 group-hover:bg-museum-900 group-hover:text-museum-50 group-hover:border-museum-900 transition-all duration-500">
                    {step.icon}
                  </span>
                  {step.label}
                </div>
                <h2 className="font-serif text-2xl tracking-wide text-museum-900 mb-4">{step.title}</h2>
                <p className="text-sm leading-relaxed text-museum-600 group-hover:text-museum-800 transition-colors duration-500 mt-auto">{step.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Principles Section - Asymmetric Cards */}
      <div className="mb-24 md:mb-40">
        <div className="text-center mb-16">
          <div className="inline-flex items-center justify-center p-3 rounded-full bg-museum-50 border border-museum-200 mb-6">
            <Asterisk className="w-5 h-5 text-museum-400" />
          </div>
          <h3 className="font-serif text-3xl md:text-5xl text-museum-900 mb-4">底层设计哲学</h3>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-museum-400">Core Principles</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 lg:gap-16 items-center">
          {principles.map((principle, index) => (
            <article 
              key={principle.title} 
              className={`group relative overflow-hidden border border-museum-200/60 bg-white/40 backdrop-blur-sm p-8 md:p-12 shadow-sm transition-all duration-700 hover:shadow-xl hover:-translate-y-2 hover:bg-white
                ${index % 2 === 1 ? 'md:mt-24' : ''}
              `}
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-museum-100/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" aria-hidden="true" />
              
              <div className="mb-10 flex items-start justify-between gap-4 relative z-10">
                <div className="flex h-14 w-14 items-center justify-center border border-museum-200 bg-white text-museum-800 shadow-sm transition-all duration-500 group-hover:-translate-y-1 group-hover:bg-museum-900 group-hover:text-museum-50">
                  {principle.icon}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-museum-400">{principle.eyebrow}</p>
                  <span className="mt-2 block font-mono text-sm text-museum-300 font-bold">{String(index + 1).padStart(2, '0')}</span>
                </div>
              </div>
              
              <div className="relative z-10 border-l-2 border-museum-200 pl-6 group-hover:border-museum-800 transition-colors duration-500">
                <h2 className="font-serif text-2xl sm:text-3xl text-museum-900 mb-4">
                  {principle.title}
                </h2>
                <p className="text-sm sm:text-base leading-relaxed text-museum-600 group-hover:text-museum-800 transition-colors duration-500">
                  {principle.body}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Reading Contract */}
      <section className="relative mx-auto mt-24 md:mt-40 max-w-6xl py-16 md:py-24 bg-museum-900 text-museum-50 border border-museum-800 shadow-2xl">
        <div
          className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none"
          aria-hidden="true"
          style={{
            backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-museum-900/90 via-museum-800/80 to-museum-900/90 pointer-events-none" />

        {/* Subtle corner marks modified for dark theme */}
        <div className="absolute left-0 top-0 w-8 h-px bg-museum-500 z-10" />
        <div className="absolute left-0 top-0 h-8 w-px bg-museum-500 z-10" />
        <div className="absolute right-0 bottom-0 w-8 h-px bg-museum-500 z-10" />
        <div className="absolute right-0 bottom-0 h-8 w-px bg-museum-500 z-10" />
        
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-16 md:gap-24 relative z-10 px-8 md:px-16 mb-4">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-4 mb-12">
              <span className="w-12 h-px bg-museum-500" />
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-museum-400">
                Reading Contract
              </p>
            </div>
            <h2 className="font-serif text-3xl md:text-5xl leading-snug md:leading-snug text-white font-light tracking-wider">
              不制造共识，<br />
              <span className="text-museum-300 font-normal">只呈现思想的张力。</span>
            </h2>
            <p className="mt-12 border-l border-museum-600 pl-6 font-serif text-lg md:text-xl leading-relaxed text-museum-200 font-light tracking-wide">
              最高级的解答，并非让错杂的问题消失，而是让你清晰地标定自身的坐标与代价。
            </p>
          </div>
          
          <div className="flex flex-col justify-center">
            <div className="space-y-8 text-sm md:text-base leading-loose text-museum-300 font-serif font-light tracking-wide">
              <p>
                我们致力于保留思想本身的连贯与密度，<span className="text-white font-normal underline decoration-museum-500/50 underline-offset-4">拒绝将其削平为供人消费的速食格言。</span> 在这里，哲学意味着剖白每一种立场的暗面，而非提供轻飘的安慰。
              </p>
              <p>
                若你能在此过程中，察觉到自身预设的断裂，或对原本笃定的答案产生恰当的迟疑，那便构成了这场阅读的核心意义。
              </p>
            </div>
            
            <div className="mt-16 flex flex-col gap-4 text-[10px] font-mono uppercase tracking-[0.25em] text-museum-400">
              <div className="flex items-center gap-4 group cursor-default">
                <span className="w-4 h-px bg-museum-600 transition-all duration-500 group-hover:w-8 group-hover:bg-white"></span> 
                <span className="group-hover:text-white transition-colors duration-500 tracking-widest">Suspend Judgment 悬置结论</span>
              </div>
              <div className="flex items-center gap-4 group cursor-default">
                <span className="w-4 h-px bg-museum-600 transition-all duration-500 group-hover:w-8 group-hover:bg-white"></span> 
                <span className="group-hover:text-white transition-colors duration-500 tracking-widest">Preserve Density 保持密度</span>
              </div>
              <div className="flex items-center gap-4 group cursor-default">
                <span className="w-4 h-px bg-museum-600 transition-all duration-500 group-hover:w-8 group-hover:bg-white"></span> 
                <span className="group-hover:text-white transition-colors duration-500 tracking-widest">Open Inquiry 开放追问</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Quote */}
      <section className="mx-auto mt-32 md:mt-40 max-w-4xl text-center relative px-6 md:px-12">
        <div className="inline-flex p-4 bg-white/40 backdrop-blur-sm border border-museum-300/50 mb-10 shadow-sm">
          <BookOpen className="w-5 h-5 text-museum-500" />
        </div>
        <div className="relative">
          <div className="absolute -left-2 md:-left-8 -top-4 md:-top-8 text-[60px] md:text-[100px] font-serif leading-none text-museum-200/50 select-none">“</div>
          <p className="font-serif text-3xl sm:text-4xl md:text-5xl leading-relaxed sm:leading-relaxed md:leading-relaxed text-museum-800 tracking-wide z-10 relative font-light">
            <span className="font-normal text-museum-900">哲学不是把人带离生活，</span><br />
            而是让生活里那些<span className="relative inline-block ml-1"><span className="relative z-10 font-normal text-museum-900">含混的判断</span><span className="absolute bottom-1 left-0 w-full h-3 md:h-4 bg-museum-200/50 -z-10"></span></span><span className="ml-1">终于显形。</span>
          </p>
          <div className="absolute -right-2 md:-right-8 -bottom-10 md:-bottom-20 text-[60px] md:text-[100px] font-serif leading-none text-museum-200/50 select-none">”</div>
        </div>
      </section>
    </div>
  );
};

export default ManifestoPage;
