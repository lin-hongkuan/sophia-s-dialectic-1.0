import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import ThoughtVoiceCard from './ThoughtVoiceCard';
import { ArrowRight, ChevronDown, ChevronUp, Compass, FlaskConical, LayoutGrid, Layers, MessageSquare, Sparkles, Stethoscope } from 'lucide-react';
import { getReflectionFeedback } from '../services/sophiaService';

interface ArenaProps {
  data: AnalysisResult;
  onReset: () => void;
  onFollowUp?: (question: string) => void;
  isGenerating?: boolean;
}

const modeIcon: Record<string, React.ReactNode> = {
  diagnosis_clinic: <Stethoscope className="w-4 h-4" />,
  thought_experiment_panel: <FlaskConical className="w-4 h-4" />,
  thought_experiment: <FlaskConical className="w-4 h-4" />,
  school_seminar: <LayoutGrid className="w-4 h-4" />,
  progressive: <Layers className="w-4 h-4" />,
  roundtable: <MessageSquare className="w-4 h-4" />,
};

const FrameNode: React.FC<{ label: string; text: string; emphasis?: boolean }> = ({ label, text, emphasis }) => (
  <div className={`relative z-10 bg-white/90 backdrop-blur-sm border ${emphasis ? 'border-museum-800 shadow-md' : 'border-museum-200 shadow-sm'} p-6 md:p-7`}>
    <p className="text-[10px] uppercase tracking-[0.24em] text-museum-400 mb-3">{label}</p>
    <p className={`${emphasis ? 'font-serif text-2xl md:text-3xl text-museum-900' : 'font-serif text-xl md:text-2xl text-museum-800'} leading-relaxed`}>
      {text}
    </p>
  </div>
);

const Arena: React.FC<ArenaProps> = ({ data, onReset, onFollowUp, isGenerating }) => {
  const [reflection, setReflection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(true);

  const handleReflectionSubmit = async () => {
    if (!reflection.trim()) return;
    setIsGettingFeedback(true);
    try {
      const fb = await getReflectionFeedback(data.philosophical_title, reflection);
      setFeedback(fb);
    } catch {
      setFeedback('Sophia 暂时保持沉默。');
    } finally {
      setIsGettingFeedback(false);
    }
  };

  const hasSynthesis = data.tensions.length > 0 || data.conclusion.summary;

  return (
    <div className="w-full max-w-[100rem] mx-auto px-3 sm:px-4 pb-20 animate-fade-in">
      <div className="text-center py-12 md:py-20 space-y-5">
        <div className="inline-flex items-center gap-2 border border-museum-300 px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm">
          {modeIcon[data.mode] || <Compass className="w-4 h-4" />}
          <span className="text-xs font-mono uppercase tracking-widest text-museum-800">论证路径 · {data.modeLabel}</span>
        </div>
        <h1 className="font-serif text-4xl md:text-6xl text-museum-900 leading-tight">{data.philosophical_title}</h1>
        <div className="max-w-4xl mx-auto mt-6">
          <p className="text-museum-800 italic text-lg leading-relaxed whitespace-pre-line text-justify bg-white/60 p-6 md:p-8 rounded-xl backdrop-blur-sm border border-museum-100 shadow-sm">
            {data.introduction}
          </p>
        </div>
        {isGenerating && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-museum-900 text-museum-50 rounded-full text-xs font-mono uppercase tracking-widest">
            <span className="w-2 h-2 bg-museum-50 rounded-full animate-pulse" />
            内容仍在展开，完成一段显示一段
          </div>
        )}
      </div>

      <section className="max-w-6xl mx-auto mb-12 md:mb-16 bg-white/80 backdrop-blur-md border border-museum-200 shadow-sm overflow-hidden">
        <div className="p-8 md:p-10 border-b border-museum-100">
          <span className="text-xs font-mono uppercase tracking-widest text-museum-400">Question Map</span>
          <h2 className="font-serif text-3xl md:text-4xl text-museum-900 mt-3">问题图谱</h2>
        </div>
        <div className="relative p-6 md:p-10">
          <div className="hidden md:block absolute left-[18%] right-[18%] top-1/2 h-px bg-museum-200" />
          <div className="hidden md:block absolute left-1/2 top-[18%] bottom-[18%] w-px bg-museum-100" />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr_1fr] gap-5 md:gap-8 items-center">
            <FrameNode label="原始困惑" text={data.questionFrame.original} />
            <div className="relative">
              <div className="hidden md:block absolute -left-4 top-1/2 w-2 h-2 rounded-full bg-museum-800 -translate-y-1/2" />
              <div className="hidden md:block absolute -right-4 top-1/2 w-2 h-2 rounded-full bg-museum-800 -translate-y-1/2" />
              <FrameNode label="核心问题" text={data.questionFrame.bigQuestion} emphasis />
            </div>
            <FrameNode label="现实翻译" text={data.questionFrame.plainTranslation} />
          </div>
          {data.questionFrame.keywords.length > 0 && (
            <div className="mt-8 pt-6 border-t border-museum-100 flex flex-wrap justify-center gap-2">
              {data.questionFrame.keywords.map((keyword) => (
                <span key={keyword} className="px-3 py-1 bg-museum-100 text-museum-900 text-xs rounded-full font-mono uppercase tracking-wider">{keyword}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {data.keywords.length > 0 && (
        <section className="max-w-6xl mx-auto mb-16 bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm">
          <button
            onClick={() => setKeywordsOpen((open) => !open)}
            className="w-full p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-left hover:bg-white/60 transition-colors"
          >
            <div>
              <span className="text-xs font-mono uppercase tracking-widest text-museum-400">Concept Notes</span>
              <h2 className="font-serif text-3xl text-museum-900 mt-2">阅读前的概念标记</h2>
              <p className="text-museum-600 leading-relaxed mt-3">先把这些词放在视野里：后面的分歧，往往就是从它们的不同理解开始的。</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-600">
              {keywordsOpen ? '收起' : '展开'} {keywordsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </button>
          <div className="px-6 md:px-8 pb-7 flex flex-wrap gap-2">
            {data.keywords.map((keyword) => (
              <span key={keyword.id} className="px-3 py-1 bg-museum-50 border border-museum-100 text-museum-800 text-xs rounded-full font-mono uppercase tracking-wider">{keyword.term}</span>
            ))}
          </div>
          {keywordsOpen && (
            <div className="border-t border-museum-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-5">
              {data.keywords.map((keyword) => (
                <div key={keyword.id} className="bg-museum-50/80 border border-museum-100 p-5">
                  <h3 className="font-serif text-2xl text-museum-900 mb-3">{keyword.term}</h3>
                  <p className="text-museum-700 leading-relaxed mb-4">{keyword.meaning}</p>
                  <p className="text-sm text-museum-600 leading-relaxed border-t border-museum-100 pt-3">为什么它会改变问题：{keyword.importance}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {data.programStructure.length > 0 && (
        <section className="max-w-5xl mx-auto mb-16">
          <div className="text-center mb-8">
            <span className="text-sm font-serif italic text-museum-400">—— 阅读路径 ——</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.programStructure.map((section, index) => (
              <div key={section.id} className="bg-white/80 backdrop-blur-sm border border-museum-200 p-6 shadow-sm">
                <p className="font-mono text-xs text-museum-400 mb-3">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="font-serif text-2xl text-museum-900 mb-3">{section.title}</h3>
                <p className="text-museum-700 leading-relaxed">{section.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.diagnosisFrame && (
        <section className="max-w-5xl mx-auto mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-8 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <Stethoscope className="w-6 h-6 text-museum-800" />
            <h2 className="font-serif text-3xl text-museum-900">{data.diagnosisFrame.symptomTitle || '哲学门诊'}</h2>
          </div>
          <p className="text-museum-800 leading-relaxed mb-6 whitespace-pre-line">{data.diagnosisFrame.framing}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
            {data.diagnosisFrame.symptoms?.map((symptom) => (
              <div key={symptom} className="bg-museum-50 border border-museum-100 p-4 text-museum-800">{symptom}</div>
            ))}
          </div>
          {data.diagnosisFrame.doctors?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-museum-200 text-xs uppercase tracking-widest text-museum-400">
                    <th className="py-3 pr-4">医生</th>
                    <th className="py-3 pr-4">诊断</th>
                    <th className="py-3 pr-4">药方</th>
                  </tr>
                </thead>
                <tbody>
                  {data.diagnosisFrame.doctors.map((doctor) => {
                    const voice = data.voices.find((item) => item.id === doctor.voiceId);
                    return (
                      <tr key={doctor.voiceId} className="border-b border-museum-100">
                        <td className="py-4 pr-4 font-serif text-museum-900">{voice?.name || doctor.voiceId}</td>
                        <td className="py-4 pr-4 text-museum-700">{doctor.diagnosis}</td>
                        <td className="py-4 pr-4 text-museum-700">{doctor.prescription}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {data.thoughtExperiment && (
        <section className="max-w-6xl mx-auto mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-8 md:p-10">
          <div className="flex items-center gap-3 mb-8">
            <FlaskConical className="w-6 h-6 text-museum-800" />
            <h2 className="font-serif text-3xl text-museum-900">思想实验的现场</h2>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6 mb-8">
            <div className="bg-museum-900 text-museum-50 p-7 md:p-8">
              <p className="text-xs uppercase tracking-widest text-museum-300 mb-4">Scene</p>
              {data.thoughtExperiment.poeticVersion && <p className="font-serif italic text-xl leading-relaxed mb-6">{data.thoughtExperiment.poeticVersion}</p>}
              <p className="text-museum-100 leading-loose whitespace-pre-line">{data.thoughtExperiment.unsettlingVersion}</p>
            </div>
            <div className="border border-museum-200 bg-museum-50/80 p-7 md:p-8">
              <p className="text-xs uppercase tracking-widest text-museum-400 mb-3">Core Pressure</p>
              <h3 className="font-serif text-2xl text-museum-900 mb-4">真正的挑战</h3>
              <p className="text-museum-800 leading-relaxed mb-5">{data.thoughtExperiment.coreChallenge}</p>
              <p className="text-sm text-museum-600 leading-relaxed border-t border-museum-100 pt-4">{data.thoughtExperiment.stakes}</p>
            </div>
          </div>
          {data.thoughtExperiment.responseMap?.length > 0 && (
            <div className="border-t border-museum-100 pt-8">
              <h3 className="font-serif text-2xl md:text-3xl text-museum-900 mb-6">几条出路</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {data.thoughtExperiment.responseMap.map((response, index) => {
                  const voice = data.voices.find((item) => item.id === response.voiceId);
                  return (
                    <div key={`${response.voiceId}-${index}`} className="relative border border-museum-200 bg-white/80 p-6">
                      <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-3">R{String(index + 1).padStart(2, '0')}</p>
                      <h4 className="font-serif text-2xl text-museum-900 mb-2">{voice?.name || response.voiceId}</h4>
                      {(voice?.role || voice?.coreConcept) && <p className="text-sm text-museum-500 mb-4">{voice.role || voice.coreConcept}</p>}
                      <p className="text-museum-800 leading-relaxed">{response.route}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {data.seminarMatrix && (
        <section className="max-w-5xl mx-auto mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-8 md:p-10">
          <div className="flex items-center gap-3 mb-6">
            <LayoutGrid className="w-6 h-6 text-museum-800" />
            <h2 className="font-serif text-3xl text-museum-900">两个基本问题</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="bg-museum-50 border border-museum-100 p-5">
              <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">事实问题</p>
              <p className="font-serif text-xl text-museum-900">{data.seminarMatrix.factualQuestion}</p>
            </div>
            <div className="bg-museum-50 border border-museum-100 p-5">
              <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">价值问题</p>
              <p className="font-serif text-xl text-museum-900">{data.seminarMatrix.valueQuestion}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.seminarMatrix.cells.map((cell) => (
              <div key={cell.id} className="border border-museum-100 p-5 bg-white/70">
                <p className="text-xs font-mono text-museum-400 mb-2">{cell.factualOption} × {cell.valueOption}</p>
                <h3 className="font-serif text-2xl text-museum-900 mb-2">{cell.label}</h3>
                <p className="text-museum-700 leading-relaxed">{cell.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.routeMap.length > 0 && (
        <section className="max-w-5xl mx-auto mb-20">
          <div className="text-center mb-10">
            <span className="text-sm font-serif italic text-museum-400">—— 论证路线图 ——</span>
          </div>
          <div className="space-y-5">
            {data.routeMap.map((node, index) => (
              <div key={node.id} className="bg-white/90 backdrop-blur-sm border border-museum-200 p-6 md:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                  <div className="w-12 h-12 rounded-full bg-museum-900 text-museum-50 flex items-center justify-center font-mono shrink-0">{index + 1}</div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">{node.role}</p>
                    <h3 className="font-serif text-2xl md:text-3xl text-museum-900 mb-4">{node.title}</h3>
                    <p className="text-museum-800 leading-relaxed mb-4">{node.plain}</p>
                    {node.philosophical && <p className="text-museum-600 leading-relaxed italic border-l-2 border-museum-200 pl-4">{node.philosophical}</p>}
                    {node.tension && <p className="mt-4 text-sm font-medium text-museum-900 bg-museum-50 p-3">张力：{node.tension}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-20">
        <div className="text-center mb-12">
          <span className="text-sm font-serif italic text-museum-400">—— 思想声音 ——</span>
          <h2 className="font-serif text-3xl md:text-4xl text-museum-900 mt-3">几种立场的长篇展开</h2>
        </div>
        <div className="w-full max-w-[98rem] mx-auto space-y-12 md:space-y-16">
          {data.voices.map((voice, idx) => (
            <ThoughtVoiceCard key={voice.id} data={voice} index={idx} />
          ))}
        </div>
      </section>

      {hasSynthesis && (
        <section className="max-w-5xl mx-auto mb-20 space-y-8">
          {data.tensions.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-8 md:p-10">
              <h2 className="font-serif text-3xl text-museum-900 mb-8">他们到底在争什么？</h2>
              <div className="space-y-5">
                {data.tensions.map((tension) => (
                  <div key={tension.id} className="border-l-4 border-museum-800 pl-5 py-1">
                    <h3 className="font-serif text-2xl text-museum-900 mb-2">{tension.title}</h3>
                    <p className="text-museum-800 leading-relaxed">{tension.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.conclusion.summary && (
            <div className="bg-museum-900 text-museum-50 shadow-lg p-8 md:p-12">
              <p className="text-xs uppercase tracking-widest text-museum-300 mb-4">Synthesis</p>
              <h2 className="font-serif text-3xl md:text-4xl mb-6">暂时的合流</h2>
              <p className="leading-loose whitespace-pre-line text-museum-100 mb-8">{data.conclusion.summary}</p>
              {data.conclusion.openQuestion && (
                <div className="bg-white/10 p-6 mb-5">
                  <p className="text-xs uppercase tracking-widest text-museum-300 mb-2">仍然悬着的问题</p>
                  <p className="font-serif text-2xl italic">{data.conclusion.openQuestion}</p>
                </div>
              )}
              {data.conclusion.realLifeReturn && <p className="text-museum-200 leading-relaxed">{data.conclusion.realLifeReturn}</p>}
            </div>
          )}
        </section>
      )}

      {data.followUps.length > 0 && (
        <section className="max-w-5xl mx-auto mb-20 text-center">
          <h2 className="font-serif text-3xl text-museum-900 mb-3">沿着这份分析继续问</h2>
          <p className="text-museum-600 leading-relaxed mb-8">这些问题会把当前分析作为上下文继续展开，而不是从零开始。</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.followUps.map((followUp) => (
              <button
                key={followUp.id}
                onClick={() => onFollowUp?.(followUp.question)}
                className="text-left p-5 bg-white/80 border border-museum-200 hover:bg-white hover:shadow-md transition-all group"
              >
                <p className="font-serif text-xl text-museum-900 group-hover:underline">{followUp.question}</p>
                <p className="text-sm text-museum-500 mt-2 leading-relaxed">{followUp.reason}</p>
                <span className="mt-4 inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-500 group-hover:text-museum-900">
                  继续展开 <ArrowRight className="w-3 h-3" />
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-4xl mx-auto mt-20 bg-white/80 backdrop-blur-sm border border-museum-200 shadow-sm p-6 md:p-8">
        <div className="border-b border-museum-100 pb-5 mb-6">
          <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">Margin Note</p>
          <h3 className="font-serif text-3xl text-museum-900">你的旁注</h3>
          <p className="text-museum-600 leading-relaxed mt-3">写下你暂时站在哪里，Sophia 会帮你看见这个立场的代价。</p>
        </div>
        <div className="relative">
          <textarea
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="写下你现在更接近哪一种立场，或者哪一处仍然不服。"
            className="w-full p-6 bg-museum-50/80 border border-museum-200 focus:outline-none focus:ring-2 focus:ring-museum-200 min-h-[160px] font-serif text-lg text-museum-900 resize-none"
          />
          <button
            onClick={handleReflectionSubmit}
            disabled={isGettingFeedback || !reflection}
            className="mt-4 md:mt-0 md:absolute md:bottom-4 md:right-4 bg-museum-900 text-white px-6 py-2 hover:bg-black transition-colors disabled:opacity-50 text-sm font-medium tracking-wide"
          >
            {isGettingFeedback ? '正在批注...' : '请 Sophia 批注'}
          </button>
        </div>

        {feedback && (
          <div className="mt-8 p-6 bg-white/90 border border-museum-200 animate-fade-in backdrop-blur-md border-l-4 border-l-museum-800">
            <h4 className="font-serif text-2xl text-museum-900 mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-700" /> Sophia 的旁注
            </h4>
            <p className="text-museum-800 leading-relaxed whitespace-pre-line">{feedback}</p>
          </div>
        )}
      </div>

      <div className="text-center mt-20">
        <button
          onClick={onReset}
          className="group inline-flex items-center gap-3 border border-museum-300 bg-white/70 px-6 py-4 shadow-sm hover:bg-museum-900 hover:text-museum-50 transition-all backdrop-blur-sm"
        >
          <ChevronDown className="w-4 h-4 rotate-90 text-museum-400 group-hover:text-museum-50" />
          <span className="font-serif text-museum-800 group-hover:text-museum-50">回到入口，提出另一个问题</span>
        </button>
      </div>

      <style>{`
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Arena;
