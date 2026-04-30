import React from 'react';
import { ArrowLeft, BookOpen, Compass, Layers, Sparkles, Map } from 'lucide-react';

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

const ManifestoPage: React.FC<ManifestoPageProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 md:pb-32 animate-fade-in -mt-2 md:-mt-8 text-museum-900">
      {/* Hero Section */}
      <div className="relative mx-auto max-w-4xl py-7 text-center md:py-14 mb-4">
        <div className="absolute left-1/2 top-0 hidden h-28 w-px -translate-x-1/2 bg-museum-300/80 md:block" />
        <div
          className="notranslate relative z-10 mb-5 mt-10 inline-flex h-8 select-none items-center justify-center rounded-full border border-museum-300/80 bg-museum-50/90 px-4 shadow-sm backdrop-blur-md md:mb-8 md:mt-12"
          translate="no"
        >
          <Sparkles className="mr-2 h-3.5 w-3.5 text-museum-600" />
          <span className="whitespace-nowrap text-[10px] font-mono uppercase leading-none tracking-[0.18em] text-museum-700 md:text-xs md:tracking-[0.2em]">Our Philosophy</span>
        </div>
        <h1 className="font-serif text-4xl leading-[0.92] tracking-tight text-museum-900 drop-shadow-sm sm:text-7xl md:text-8xl">
          Sophia's<br />
          <span className="relative inline-block italic">
            Manifesto
            <svg className="absolute -bottom-1 -left-[5%] h-2 w-[110%] text-museum-300/50 md:-bottom-2 md:h-4" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </span>
        </h1>
        <p className="mx-auto mt-6 md:mt-8 max-w-2xl px-2 text-base sm:text-lg font-serif italic leading-relaxed text-museum-700">
          将日常的困惑，展开为可阅读的思想地图。<br className="hidden sm:block" />
          我们不生产速食的标准答案，而是为你搭建一座临时的思维展厅。
        </p>
      </div>

      <div className="max-w-4xl mx-auto mb-10 md:mb-16 relative z-10 rounded-2xl border border-museum-200/60 bg-white/50 p-5 sm:p-12 shadow-sm backdrop-blur-sm text-center">
        <div className="space-y-4 text-sm sm:text-base leading-loose text-museum-800 mx-auto">
          <p>当你带来一个现代困惑：要不要生孩子、如何面对虚无主义，或怎样证明自己不是缸中之脑。</p>
          <p>这里做的第一件事，不是立刻回答，而是把困惑拆解为问题的骨架。<br className="hidden sm:block"/>接着，不同的思想声音进入现场。它们不是为了排列名人名言，<br className="hidden sm:block"/>而是各自承担一种理解世界的方式：诊断、辩护、怀疑或反击。</p>
        </div>
      </div>

      {/* Methodology Section */}
      <div className="mb-10 md:mb-16">
        <h3 className="mb-8 text-center font-serif text-3xl text-museum-800">思想展开的演进</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 relative">
          <div className="absolute top-1/2 left-4 right-4 h-px bg-museum-200 hidden md:block -z-10 -translate-y-1/2" />
          {methodSteps.map((step, index) => (
            <article key={step.title} className="group relative rounded-xl border border-museum-200/80 bg-white/80 p-6 shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-1">
              <div className="absolute -top-3 -left-3 flex items-center justify-center w-8 h-8 rounded-full bg-museum-100 border border-museum-200 text-museum-500 shadow-sm font-mono text-xs z-10 group-hover:bg-museum-800 group-hover:text-museum-50 group-hover:border-museum-800 transition-colors">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="mb-4 flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.1em] text-museum-500 border-b border-museum-100 pb-3">
                {step.icon}
                {step.label}
              </div>
              <h2 className="font-serif text-xl tracking-wide text-museum-900 mb-3">{step.title}</h2>
              <p className="text-sm leading-relaxed text-museum-600 group-hover:text-museum-800 transition-colors">{step.body}</p>
            </article>
          ))}
        </div>
      </div>

      {/* Principles Section */}
      <div className="mb-10 md:mb-16">
        <h3 className="mb-8 text-center font-serif text-3xl text-museum-800">底层设计哲学</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {principles.map((principle, index) => (
            <article key={principle.title} className="group relative overflow-hidden rounded-2xl border border-museum-200/90 bg-white/80 p-5 md:p-8 shadow-sm transition-all duration-300 hover:shadow-[0_8px_30px_rgba(44,42,38,0.06)] hover:bg-white">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-museum-100/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-3xl" aria-hidden="true" />
              <div className="mb-6 flex items-start justify-between gap-4 relative z-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-museum-200 bg-museum-50/80 text-museum-700 shadow-sm transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-museum-100">
                  {principle.icon}
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-museum-400">{principle.eyebrow}</p>
                  <span className="mt-1 block font-mono text-xs text-museum-300">{String(index + 1).padStart(2, '0')}</span>
                </div>
              </div>
              <h2 className="relative z-10 font-serif text-2xl sm:text-3xl text-museum-900 group-hover:text-museum-950 transition-colors">
                {principle.title}
              </h2>
              <p className="relative z-10 mt-4 text-sm sm:text-base leading-relaxed text-museum-600 group-hover:text-museum-700 transition-colors">
                {principle.body}
              </p>
            </article>
          ))}
        </div>
      </div>

      {/* Reading Contract */}
      <section className="relative overflow-hidden rounded-2xl bg-museum-900 text-museum-50 shadow-xl">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10" aria-hidden="true" />
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] relative z-10">
          <div className="p-6 md:p-14 lg:border-r lg:border-white/10 flex flex-col justify-center bg-gradient-to-br from-museum-900 to-museum-800">
            <p className="mb-6 inline-flex border border-white/20 rounded-full px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-museum-300 w-max">
              Reading Contract
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl leading-[1.3] text-white">
              这不是制造共识的工厂，<br />
              <span className="italic text-museum-300">而是一场饱满的思想推演。</span>
            </h2>
            <p className="mt-8 border-l-2 border-museum-400 pl-5 font-serif text-lg italic leading-relaxed text-museum-200">
              好的回答，不是让问题消失，而是让你清晰地看见自己真正同意了什么。
            </p>
          </div>
          <div className="p-6 md:p-14 bg-museum-900/50 flex flex-col justify-center">
            <div className="space-y-6 text-sm sm:text-base leading-loose text-museum-200">
              <p>
                我们会尽量把宏大的哲学思想写得可读，但绝不会将它们压扁成心灵鸡汤。它允许一个问题暂时没有最终定论，也会坦诚地指出每一种解答背后不可回避的代价。
              </p>
              <p>
                如果读完之后，你更清楚自己为何笃定、为何反感或为何犹豫，这份解析便完成了它的使命。
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-mono uppercase tracking-widest text-museum-300">
              <span className="rounded-md border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 transition-colors cursor-default">不急着站队</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 transition-colors cursor-default">不将复杂压平</span>
              <span className="rounded-md border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10 transition-colors cursor-default">不替你结束追问</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-3xl text-center">
        <Sparkles className="w-6 h-6 mx-auto text-museum-300 mb-6 opacity-50" />
        <p className="font-serif text-2xl sm:text-3xl italic leading-relaxed text-museum-700/80">
          「哲学不是把人带离生活，<br />
          而是让生活里那些含混的判断终于显形。」
        </p>
      </section>
    </div>
  );
};

export default ManifestoPage;