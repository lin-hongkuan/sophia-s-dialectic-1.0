import React from 'react';
import { ArrowLeft, BookOpen, Compass, Layers, Sparkles } from 'lucide-react';

interface ManifestoPageProps {
  onBack: () => void;
}

const principles = [
  {
    icon: <Compass className="w-5 h-5" />,
    title: '问题先于答案',
    body: 'Sophia 不把用户的问题当作搜索词，而是先追问：这个困惑真正卡在哪里？它是在问事实、价值、意义，还是在问一种生活姿态是否还能成立？',
  },
  {
    icon: <Layers className="w-5 h-5" />,
    title: '结构不是模板',
    body: '不同问题需要不同的展开方式。虚无主义更像门诊，女权主义更像研讨会，缸中之脑更像思想实验。页面结构应当服从问题，而不是让问题服从固定栏目。',
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: '长文保留思想的重量',
    body: '一个哲学立场不能只剩一句摘要。它需要诊断、例子、反驳、代价和语气。Sophia 的核心阅读体验，是让每一种思想声音以接近短论文的方式说完。',
  },
  {
    icon: <Sparkles className="w-5 h-5" />,
    title: '结论保持开放',
    body: '哲学分析不是替你关闭问题，而是让你更准确地知道自己站在哪里，以及这个位置需要付出什么代价。好的回答，应该让下一问更清楚。',
  },
];

const ManifestoPage: React.FC<ManifestoPageProps> = ({ onBack }) => {
  return (
    <div className="w-full max-w-6xl mx-auto px-4 pb-20 animate-fade-in">
      <button
        onClick={onBack}
        className="mb-8 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-500 hover:text-museum-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to entrance
      </button>

      <section className="relative overflow-hidden border border-museum-200 bg-white/72 backdrop-blur-[4px] shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-museum-50/20 to-white/35 pointer-events-none" />
        <div className="relative p-8 md:p-12 lg:p-16">
          <p className="text-xs font-mono uppercase tracking-[0.32em] text-museum-400 mb-5">Manifesto</p>
          <h1 className="font-serif text-5xl md:text-7xl text-museum-900 leading-[0.95] tracking-tight mb-8">
            让困惑变成一张<br className="hidden md:block" /> 可以阅读的思想地图
          </h1>
          <div className="grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-10 lg:gap-14 items-start">
            <p className="font-serif text-2xl md:text-3xl italic leading-relaxed text-museum-700">
              Sophia's Dialectic 不是一个给出标准答案的机器，而是一间临时搭起的思想展厅。
            </p>
            <div className="space-y-5 text-museum-800 leading-loose text-lg">
              <p>
                你带来一个现代困惑：要不要生孩子、如何面对虚无主义、女权主义是否有道理、怎样证明自己不是缸中之脑。Sophia 做的第一件事，不是立刻回答，而是把这个困惑拆成问题的骨架：它的关键词、暗含前提、真正的张力，以及可能通向的几条路线。
              </p>
              <p>
                然后，不同的思想声音进入现场。它们不是为了凑热闹，也不是为了排列名人名言，而是各自承担一种理解世界的方式：诊断、辩护、怀疑、反击、安慰，或者拆掉问题本身。
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8 md:mt-10">
        {principles.map((principle, index) => (
          <article key={principle.title} className="bg-white/78 backdrop-blur-[3px] border border-museum-200 p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-7">
              <div className="w-10 h-10 border border-museum-300 bg-museum-50/80 flex items-center justify-center text-museum-800">
                {principle.icon}
              </div>
              <span className="text-xs font-mono text-museum-300">{String(index + 1).padStart(2, '0')}</span>
            </div>
            <h2 className="font-serif text-3xl text-museum-900 mb-4">{principle.title}</h2>
            <p className="text-museum-700 leading-loose">{principle.body}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 md:mt-10 bg-museum-900 text-museum-50 p-8 md:p-12 shadow-lg">
        <p className="text-xs font-mono uppercase tracking-[0.28em] text-museum-300 mb-5">Reading Contract</p>
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-12 items-start">
          <h2 className="font-serif text-4xl md:text-5xl leading-tight">这不是结论工厂，而是一次有形状的思考。</h2>
          <div className="space-y-5 text-museum-100 leading-loose">
            <p>
              Sophia 会尽量把复杂思想写得可读，但不会把它们压扁成鸡汤。它会允许一个问题暂时没有最终答案，也会指出每一种答案背后的损失。
            </p>
            <p>
              如果读完之后你更清楚自己为什么同意、为什么反感、为什么仍然犹豫，那么这份分析就完成了它的任务。
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default ManifestoPage;
