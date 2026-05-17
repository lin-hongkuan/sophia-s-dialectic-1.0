import React from 'react';
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, FlaskConical, ImageOff, LayoutGrid, Layers, MessageSquare, Stethoscope } from 'lucide-react';
import { GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE } from '../presentation/imageMessages';
import type { AnalysisResult, MagazineImageAsset, MagazineImageSlot } from '../types/domain';
import ThoughtVoiceCard from './ThoughtVoiceCard';

export const modeIcon: Record<string, React.ReactNode> = {
  diagnosis_clinic: <Stethoscope className="w-4 h-4" />,
  thought_experiment_panel: <FlaskConical className="w-4 h-4" />,
  thought_experiment: <FlaskConical className="w-4 h-4" />,
  school_seminar: <LayoutGrid className="w-4 h-4" />,
  progressive: <Layers className="w-4 h-4" />,
  roundtable: <MessageSquare className="w-4 h-4" />,
};

const FrameNode: React.FC<{ label: string; text: string; emphasis?: boolean }> = ({ label, text, emphasis }) => (
  <div className={`relative z-10 bg-white/90 backdrop-blur-sm border ${emphasis ? 'border-museum-800 shadow-museum-lift ring-1 ring-museum-800/15' : 'border-museum-200 shadow-museum-soft'} p-4 md:p-7 transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-museum-lift`}>
    <p className="text-[10px] uppercase tracking-[0.24em] text-museum-400 mb-3">{label}</p>
    <p className={`${emphasis ? 'font-serif text-xl md:text-3xl text-museum-900' : 'font-serif text-lg md:text-2xl text-museum-800'} leading-relaxed`}>
      {text}
    </p>
  </div>
);

const FailedImagePlaceholder: React.FC<{ label: string; message?: string; dark?: boolean; className?: string }> = ({ label, message, dark = false, className = '' }) => {
  const aspectClass = className.includes('aspect-') ? '' : 'aspect-[16/10]';

  return (
    <div
      className={`flex ${aspectClass} w-full flex-col items-center justify-center border p-5 text-center ${
        dark
          ? 'border-museum-700 bg-museum-800/45 text-museum-100'
          : 'border-amber-200/80 bg-amber-50/80 text-amber-900'
      } ${className}`}
      role="status"
    >
      <ImageOff className={`mb-3 h-6 w-6 ${dark ? 'text-museum-200' : 'text-amber-800'}`} />
      <p className="font-serif text-lg leading-tight">{label}</p>
      <p className={`mt-2 max-w-sm text-xs leading-relaxed ${dark ? 'text-museum-300' : 'text-amber-900/82'}`}>
        {message || GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE}
      </p>
    </div>
  );
};

const magazineSlotCopy: Record<MagazineImageSlot, { eyebrow: string; title: string; caption: string; failed: string; pending: string }> = {
  cover: {
    eyebrow: 'Opening Plate',
    title: '进入这篇文章之前',
    caption: 'A generated editorial plate for the central question.',
    failed: '开篇插图暂不可用',
    pending: '正在补齐开篇插图',
  },
  conclusion: {
    eyebrow: 'Closing Plate',
    title: '把分歧带回现实',
    caption: 'A generated closing plate for the synthesis.',
    failed: '收束插图暂不可用',
    pending: '正在补齐收束插图',
  },
};

const MagazineImageFrame: React.FC<{ image?: MagazineImageAsset; slot: MagazineImageSlot }> = ({ image, slot }) => {
  const copy = magazineSlotCopy[slot];

  if (image?.imageUrl) {
    return (
      <figure className="overflow-hidden border border-museum-200 bg-museum-100 shadow-sm">
        <div className="relative aspect-[4/3] overflow-hidden bg-museum-100 md:aspect-[16/9]">
          <img
            src={image.imageUrl}
            alt={image.alt || copy.title}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(44,42,38,0.05),transparent_38%,rgba(44,42,38,0.12))]" aria-hidden="true" />
        </div>
        <figcaption className="flex flex-col gap-1 border-t border-museum-200 bg-white/82 px-4 py-3 text-[10px] uppercase text-museum-400 sm:flex-row sm:items-center sm:justify-between">
          <span>{copy.eyebrow}</span>
          <span>{copy.caption}</span>
        </figcaption>
      </figure>
    );
  }

  if (image?.status === 'failed') {
    return <FailedImagePlaceholder label={copy.failed} message={image.error} className="aspect-[4/3] md:aspect-[16/9]" />;
  }

  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center border border-museum-200 bg-white/60 p-5 text-center shadow-sm md:aspect-[16/9]" role="status">
      <div className="mb-4 h-8 w-8 animate-pulse border border-museum-300 bg-museum-100" aria-hidden="true" />
      <p className="font-serif text-lg text-museum-900">{copy.pending}</p>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-museum-500">正在生成图像，请稍候。</p>
    </div>
  );
};

export const MagazineImageSection: React.FC<{ data: AnalysisResult; slot: MagazineImageSlot }> = ({ data, slot }) => {
  const copy = magazineSlotCopy[slot];
  const image = data.magazineImages?.[slot];
  const supportingText = slot === 'cover'
    ? data.questionFrame.bigQuestion || data.introduction
    : data.conclusion.openQuestion || data.conclusion.realLifeReturn || data.conclusion.summary;

  if (slot === 'conclusion' && !data.conclusion.summary) return null;

  return (
    <section className="mx-auto mb-7 max-w-6xl md:mb-16">
      <div className={`grid grid-cols-1 gap-4 md:gap-6 lg:items-stretch ${slot === 'cover' ? 'lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]' : 'lg:grid-cols-[minmax(260px,0.72fr)_minmax(0,1.28fr)]'}`}>
        <div className={slot === 'conclusion' ? 'lg:order-2' : ''}>
          <MagazineImageFrame image={image} slot={slot} />
        </div>
        <aside className="flex min-h-[220px] flex-col justify-between border border-museum-200 bg-white/82 p-5 shadow-sm md:p-8">
          <div>
            <p className="text-[10px] uppercase text-museum-400">{copy.eyebrow}</p>
            <h2 className="mt-4 font-serif text-2xl leading-tight text-museum-900 md:text-4xl">{copy.title}</h2>
            <p className="mt-5 text-museum-700 leading-loose">{supportingText}</p>
          </div>
          <div className="mt-7 h-px w-24 bg-museum-300" aria-hidden="true" />
        </aside>
      </div>
    </section>
  );
};

export const QuestionMapSection: React.FC<{ data: AnalysisResult }> = ({ data }) => (
  <section className="max-w-6xl mx-auto mb-7 md:mb-16 bg-white/80 backdrop-blur-md border border-museum-200 shadow-sm overflow-hidden">
    <div className="p-5 md:p-10 border-b border-museum-100">
      <span className="text-xs font-mono uppercase tracking-widest text-museum-400">Question Map</span>
      <h2 className="font-serif text-2xl md:text-4xl text-museum-900 mt-3">问题图谱</h2>
    </div>
    <div className="relative p-4 md:p-10">
      <div className="hidden lg:block absolute left-[18%] right-[18%] top-1/2 h-px bg-museum-200" />
      <div className="hidden lg:block absolute left-1/2 top-[18%] bottom-[18%] w-px bg-museum-100" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr_1fr] gap-5 lg:gap-8 items-center">
        <FrameNode label="原始困惑" text={data.questionFrame.original} />
        <div className="relative">
          <div className="hidden lg:block absolute -left-4 top-1/2 w-2 h-2 rounded-full bg-museum-800 -translate-y-1/2" />
          <div className="hidden lg:block absolute -right-4 top-1/2 w-2 h-2 rounded-full bg-museum-800 -translate-y-1/2" />
          <FrameNode label="核心问题" text={data.questionFrame.bigQuestion} emphasis />
        </div>
        <FrameNode label="现实翻译" text={data.questionFrame.plainTranslation} />
      </div>
      {data.questionFrame.keywords.length > 0 && (
        <div className="mt-8 pt-6 border-t border-museum-100 flex flex-wrap justify-center gap-2">
          {data.questionFrame.keywords.map((keyword) => (
            <span key={keyword} className="px-3 py-1 bg-museum-100/95 text-museum-900 text-xs rounded-full font-mono uppercase tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{keyword}</span>
          ))}
        </div>
      )}
    </div>
  </section>
);

interface ConceptNotesSectionProps {
  data: AnalysisResult;
  keywordsOpen: boolean;
  onToggle: () => void;
  onOpenConcept?: (keywordId: string) => void;
}

export const ConceptNotesSection: React.FC<ConceptNotesSectionProps> = ({ data, keywordsOpen, onToggle, onOpenConcept }) => {
  if (data.keywords.length === 0) return null;
  return (
    <section className="max-w-6xl mx-auto mb-7 md:mb-16 bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm">
      <button
        onClick={onToggle}
        className="w-full p-5 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-left hover:bg-white/60 transition-colors"
      >
        <div>
          <span className="text-xs font-mono uppercase tracking-widest text-museum-400">Concept Notes</span>
          <h2 className="font-serif text-2xl md:text-3xl text-museum-900 mt-2">阅读前的概念标记</h2>
          <p className="text-museum-800 leading-relaxed mt-3">先把这些词放在视野里：后面的分歧，往往就是从它们的不同理解开始的。点击任意一张概念卡，可以打开完整的概念档案。</p>
        </div>
        <span className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-600">
          {keywordsOpen ? '收起' : '展开'} {keywordsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>
      <div className="px-6 md:px-8 pb-7 flex flex-wrap gap-2">
        {data.keywords.map((keyword) => (
          <span key={keyword.id} className="px-3 py-1 bg-museum-50/95 border border-museum-100 text-museum-800 text-xs rounded-full font-mono uppercase tracking-wider shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">{keyword.term}</span>
        ))}
      </div>
      {keywordsOpen && (
        <div className="border-t border-museum-100 p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {data.keywords.map((keyword) => {
            const hasArchive = !!onOpenConcept;
            return (
              <div key={keyword.id} className="bg-museum-50/80 border border-museum-100 p-5 flex flex-col gap-3">
                <div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-2xl text-museum-900">{keyword.term}</h3>
                    {keyword.enriched && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-museum-500">
                        <BookOpen className="w-3 h-3" /> 完整档案
                      </span>
                    )}
                  </div>
                  <p className="text-museum-800 leading-relaxed mt-3">{keyword.meaning}</p>
                  <p className="text-sm text-museum-600 leading-relaxed border-t border-museum-100 mt-3 pt-3">为什么它会改变问题：{keyword.importance}</p>
                </div>
                {hasArchive && (
                  <button
                    type="button"
                    onClick={() => onOpenConcept?.(keyword.id)}
                    className="self-start inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-museum-700 hover:text-museum-900 transition-colors"
                  >
                    查看完整概念 <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export const ProgramStructureSection: React.FC<{ data: AnalysisResult }> = ({ data }) => {
  if (data.programStructure.length === 0) return null;
  return (
    <section className="max-w-5xl mx-auto mb-7 md:mb-16">
      <div className="text-center mb-5 md:mb-8">
        <span className="text-sm font-serif font-light tracking-[0.35em] text-museum-400">——  阅读路径  ——</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.programStructure.map((section, index) => (
          <div key={section.id} className="bg-white/80 backdrop-blur-sm border border-museum-200 p-4 md:p-6 shadow-museum-soft transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-museum-lift">
            <p className="font-mono text-xs text-museum-400 mb-3">{String(index + 1).padStart(2, '0')}</p>
            <h3 className="font-serif text-2xl text-museum-900 mb-3">{section.title}</h3>
            <p className="text-museum-800 leading-relaxed">{section.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export const ModeSpecificFrames: React.FC<{ data: AnalysisResult }> = ({ data }) => (
  <>
    {data.diagnosisFrame && (
      <section className="max-w-5xl mx-auto mb-7 md:mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-10">
        <div className="flex items-center gap-3 mb-6">
          <Stethoscope className="w-6 h-6 text-museum-800" />
          <h2 className="font-serif text-3xl text-museum-900">{data.diagnosisFrame.symptomTitle || '哲学门诊'}</h2>
        </div>
        <p className="text-museum-800 leading-relaxed mb-5 md:mb-6 whitespace-pre-line">{data.diagnosisFrame.framing}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {data.diagnosisFrame.symptoms?.map((symptom) => (
            <div key={symptom} className="bg-museum-50 border border-museum-100 p-4 text-museum-800">{symptom}</div>
          ))}
        </div>
        {data.diagnosisFrame.doctors?.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {data.diagnosisFrame.doctors.map((doctor) => {
                const voice = data.voices.find((item) => item.id === doctor.voiceId);
                return (
                  <div key={doctor.voiceId} className="border border-museum-100 bg-white/75 p-4">
                    <p className="font-serif text-lg text-museum-900 mb-3">{voice?.name || doctor.voiceId}</p>
                    <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-1">诊断</p>
                    <p className="text-sm text-museum-700 leading-relaxed mb-3">{doctor.diagnosis}</p>
                    <p className="text-[10px] uppercase tracking-widest text-museum-400 mb-1">药方</p>
                    <p className="text-sm text-museum-700 leading-relaxed">{doctor.prescription}</p>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
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
          </>
        )}
      </section>
    )}

    {data.thoughtExperiment && (
      <section className="max-w-6xl mx-auto mb-7 md:mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-10">
        <div className="flex items-center gap-3 mb-5 md:mb-8">
          <FlaskConical className="w-6 h-6 text-museum-800" />
          <h2 className="font-serif text-2xl md:text-3xl text-museum-900">思想实验的现场</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-4 md:gap-6 mb-5 md:mb-8">
          <div className="bg-museum-900 text-museum-50 p-5 md:p-8">
            <p className="text-xs uppercase tracking-widest text-museum-300 mb-4">Scene</p>
            {data.thoughtExperiment.sceneImage?.imageUrl ? (
              <figure className="mb-6 overflow-hidden border border-museum-700 bg-museum-800/40">
                <img
                  src={data.thoughtExperiment.sceneImage.imageUrl}
                  alt={data.thoughtExperiment.sceneImage.alt || '思想实验场景图'}
                  className="aspect-[16/10] w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-museum-300">Generated Scene</figcaption>
              </figure>
            ) : data.thoughtExperiment.sceneImage?.status === 'failed' ? (
              <figure className="mb-6 overflow-hidden border border-museum-700 bg-museum-800/40">
                <FailedImagePlaceholder
                  dark
                  label="场景图暂不可用"
                  message={data.thoughtExperiment.sceneImage.error}
                />
                <figcaption className="px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-museum-300">Scene Placeholder</figcaption>
              </figure>
            ) : null}
            {data.thoughtExperiment.poeticVersion && <p className="font-serif font-light text-xl leading-loose tracking-wide mb-6">{data.thoughtExperiment.poeticVersion}</p>}
            <p className="text-museum-100 leading-loose whitespace-pre-line">{data.thoughtExperiment.unsettlingVersion}</p>
          </div>
          <div className="border border-museum-200 bg-museum-50/80 p-5 md:p-8 flex flex-col">
            <p className="text-xs uppercase tracking-widest text-museum-400 mb-3">Core Pressure</p>
            <h3 className="font-serif text-2xl text-museum-900 mb-4">真正的挑战</h3>
            <p className="text-museum-800 leading-relaxed mb-5">{data.thoughtExperiment.coreChallenge}</p>
            <p className="text-sm text-museum-600 leading-relaxed border-t border-museum-100 pt-4">{data.thoughtExperiment.stakes}</p>
            {data.thoughtExperiment.pressureImage?.imageUrl ? (
              <figure className="mt-auto pt-6">
                <div className="overflow-hidden border border-museum-200 bg-white/70">
                  <img
                    src={data.thoughtExperiment.pressureImage.imageUrl}
                    alt={data.thoughtExperiment.pressureImage.alt || '核心挑战线条配图'}
                    className="aspect-[16/9] w-full object-cover opacity-90"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <figcaption className="mt-2 text-[10px] uppercase tracking-[0.2em] text-museum-300">Pressure Sketch</figcaption>
              </figure>
            ) : data.thoughtExperiment.pressureImage?.status === 'failed' ? (
              <figure className="mt-auto pt-6">
                <FailedImagePlaceholder
                  className="aspect-[16/9]"
                  label="挑战配图暂不可用"
                  message={data.thoughtExperiment.pressureImage.error}
                />
                <figcaption className="mt-2 text-[10px] uppercase tracking-[0.2em] text-museum-300">Pressure Placeholder</figcaption>
              </figure>
            ) : null}
          </div>
        </div>
        {data.thoughtExperiment.responseMap?.length > 0 && (
          <div className="border-t border-museum-100 pt-5 md:pt-8">
            <h3 className="font-serif text-2xl md:text-3xl text-museum-900 mb-4 md:mb-6">几条出路</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
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
      <section className="max-w-5xl mx-auto mb-7 md:mb-16 bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-10">
        <div className="flex items-center gap-3 mb-5 md:mb-6">
          <LayoutGrid className="w-6 h-6 text-museum-800" />
          <h2 className="font-serif text-2xl md:text-3xl text-museum-900">两个基本问题</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-8">
          <div className="bg-museum-50 border border-museum-100 p-4 md:p-5">
            <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">事实问题</p>
            <p className="font-serif text-xl text-museum-900">{data.seminarMatrix.factualQuestion}</p>
          </div>
          <div className="bg-museum-50 border border-museum-100 p-4 md:p-5">
            <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">价值问题</p>
            <p className="font-serif text-xl text-museum-900">{data.seminarMatrix.valueQuestion}</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.seminarMatrix.cells.map((cell) => (
            <div key={cell.id} className="border border-museum-100 p-4 md:p-5 bg-white/70">
              <p className="text-xs font-mono text-museum-400 mb-2">{cell.factualOption} × {cell.valueOption}</p>
              <h3 className="font-serif text-2xl text-museum-900 mb-2">{cell.label}</h3>
              <p className="text-museum-800 leading-relaxed">{cell.description}</p>
            </div>
          ))}
        </div>
      </section>
    )}
  </>
);

export const RouteMapSection: React.FC<{ data: AnalysisResult }> = ({ data }) => {
  if (data.routeMap.length === 0) return null;
  return (
    <section className="max-w-5xl mx-auto mb-8 md:mb-20">
      <div className="text-center mb-5 md:mb-10">
        <span className="text-sm font-serif font-light tracking-[0.35em] text-museum-400">——  论证路线图  ——</span>
      </div>
      <div className="space-y-4 md:space-y-5">
        {data.routeMap.map((node, index) => (
          <div key={node.id} className="bg-white/90 backdrop-blur-sm border border-museum-200 p-4 md:p-8 shadow-museum-soft transition-all duration-500 ease-out hover:-translate-y-0.5 hover:shadow-museum-lift">
            <div className="flex flex-col md:flex-row md:items-start gap-5">
              <div className="w-12 h-12 rounded-full bg-museum-900 text-museum-50 flex items-center justify-center font-mono shrink-0 ring-2 ring-museum-300/40 ring-offset-2 ring-offset-museum-50">{index + 1}</div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">{node.role}</p>
                <h3 className="font-serif text-2xl md:text-3xl text-museum-900 mb-4">{node.title}</h3>
                <p className="text-museum-800 leading-relaxed mb-4">{node.plain}</p>
                {node.philosophical && <p className="text-museum-800 font-light leading-loose tracking-wide border-l-2 border-museum-200 pl-4">{node.philosophical}</p>}
                {node.tension && <p className="mt-4 text-sm font-medium text-museum-900 bg-museum-50 p-3">{node.tension}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

interface ThoughtVoicesSectionProps {
  data: AnalysisResult;
  onRetryVoice?: (voiceId: string) => void;
  retryingVoiceId?: string | null;
  isGenerating?: boolean;
  isAppendingVoice?: boolean;
  onRegenerateAvatar?: (voiceId: string) => void;
  regeneratingAvatarVoiceId?: string | null;
}

export const ThoughtVoicesSection: React.FC<ThoughtVoicesSectionProps> = ({
  data,
  onRetryVoice,
  retryingVoiceId,
  isGenerating,
  isAppendingVoice,
  onRegenerateAvatar,
  regeneratingAvatarVoiceId,
}) => (
  <section className="mb-8 md:mb-20">
    <div className="text-center mb-5 md:mb-12">
      <span className="text-sm font-serif font-light tracking-[0.35em] text-museum-400">——  思想声音  ——</span>
      <h2 className="font-serif text-2xl md:text-4xl text-museum-900 mt-3">几种立场的长篇展开</h2>
    </div>
    <div className="w-full max-w-[98rem] mx-auto space-y-5 md:space-y-16">
      {data.voices.map((voice, idx) => (
        <ThoughtVoiceCard
          key={voice.id}
          data={voice}
          index={idx}
          result={data}
          onRetry={onRetryVoice}
          isRetrying={retryingVoiceId === voice.id}
          retryDisabled={!!isGenerating || !!isAppendingVoice || (!!retryingVoiceId && retryingVoiceId !== voice.id)}
          onRegenerateAvatar={onRegenerateAvatar}
          isRegeneratingAvatar={regeneratingAvatarVoiceId === voice.id}
        />
      ))}
    </div>
  </section>
);

export const SynthesisSection: React.FC<{ data: AnalysisResult }> = ({ data }) => {
  const hasSynthesis = data.tensions.length > 0 || data.conclusion.summary;
  if (!hasSynthesis) return null;
  return (
    <section className="max-w-5xl mx-auto mb-8 md:mb-20 space-y-6 md:space-y-8">
      {data.tensions.length > 0 && (
        <div className="bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-10">
          <h2 className="font-serif text-2xl md:text-3xl text-museum-900 mb-6 md:mb-8">他们到底在争什么？</h2>
          <div className="space-y-5">
            {data.tensions.map((tension) => (
              <div key={tension.id} className="border-l-4 border-museum-800 pl-5 py-2 -mx-2 px-2 rounded-sm transition-colors duration-300 hover:bg-museum-50/50">
                <h3 className="font-serif text-2xl text-museum-900 mb-2">{tension.title}</h3>
                <p className="text-museum-800 leading-relaxed">{tension.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <MagazineImageSection data={data} slot="conclusion" />

      {data.conclusion.summary && (
        <div className="relative bg-museum-900 text-museum-50 shadow-lg overflow-hidden">
          <div
            className="absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none"
            aria-hidden="true"
            style={{
              backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-museum-900/85 via-museum-800/70 to-museum-900/90 pointer-events-none" aria-hidden="true" />
          <span aria-hidden="true" className="absolute left-0 top-0 w-6 h-px bg-museum-500 z-10" />
          <span aria-hidden="true" className="absolute left-0 top-0 h-6 w-px bg-museum-500 z-10" />
          <span aria-hidden="true" className="absolute right-0 bottom-0 w-6 h-px bg-museum-500 z-10" />
          <span aria-hidden="true" className="absolute right-0 bottom-0 h-6 w-px bg-museum-500 z-10" />
          <div className="relative z-10 p-5 md:p-12">
            <p className="text-xs uppercase tracking-widest text-museum-300 mb-4">Synthesis</p>
            <h2 className="font-serif text-3xl md:text-4xl mb-6">暂时的合流</h2>
            <p className="leading-loose whitespace-pre-line text-museum-100 mb-8">{data.conclusion.summary}</p>
            {data.conclusion.openQuestion && (
              <div className="bg-white/10 p-6 mb-5">
                <p className="text-xs uppercase tracking-widest text-museum-300 mb-2">仍然悬着的问题</p>
                <p className="font-serif text-2xl font-light leading-loose tracking-wider">{data.conclusion.openQuestion}</p>
              </div>
            )}
            {data.conclusion.realLifeReturn && <p className="text-museum-200 leading-relaxed">{data.conclusion.realLifeReturn}</p>}
          </div>
        </div>
      )}
    </section>
  );
};
