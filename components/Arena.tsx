import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import ThoughtVoiceCard from './ThoughtVoiceCard';
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, Compass, Copy, Download, FlaskConical, LayoutGrid, Layers, MessageSquare, RefreshCw, Sparkles, Stethoscope } from 'lucide-react';
import { getReflectionFeedback } from '../services/sophiaService';
import { buildMarkdownFilename, buildResultMarkdown, copyMarkdown, downloadMarkdown } from '../utils/exportResult';
import { validateUserPrompt, ValidationMode } from '../utils/inputValidation';
import { HangingLabel } from './PageHero';

type StudioMode = 'voice' | 'branch' | 'note';

interface ArenaProps {
  data: AnalysisResult;
  onReset: () => void;
  onFollowUp?: (question: string) => void;
  onAppendThoughtVoice?: (prompt: string) => void;
  onRetryVoice?: (voiceId: string) => void;
  retryingVoiceId?: string | null;
  isGenerating?: boolean;
  isAppendingVoice?: boolean;
  /** Open the standalone concept detail page for one of the keyword cards. */
  onOpenConcept?: (keywordId: string) => void;
  /** Optional — when provided, renders a "重新生成这份分析" button next to the bottom reset CTA. */
  onRegenerateAll?: () => void;
  isRegenerateAllDisabled?: boolean;
  /** Optional — passed through to each ThoughtVoiceCard for the barely-visible regen-avatar overlay. */
  onRegenerateAvatar?: (voiceId: string) => void;
  regeneratingAvatarVoiceId?: string | null;
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
  <div className={`relative z-10 bg-white/90 backdrop-blur-sm border ${emphasis ? 'border-museum-800 shadow-md' : 'border-museum-200 shadow-sm'} p-4 md:p-7`}>
    <p className="text-[10px] uppercase tracking-[0.24em] text-museum-400 mb-3">{label}</p>
    <p className={`${emphasis ? 'font-serif text-xl md:text-3xl text-museum-900' : 'font-serif text-lg md:text-2xl text-museum-800'} leading-relaxed`}>
      {text}
    </p>
  </div>
);

const modeCopy: Record<StudioMode, { title: string; description: string; placeholder: string; action: string; chips: string[] }> = {
  voice: {
    title: '邀请一位思想声音加入',
    description: '它会成为当前分析里的一张新声音卡，并重新整理后面的分歧与合流。',
    placeholder: '例如：我想看看加缪的看法',
    action: '邀请加入',
    chips: ['加缪会怎么说？', '让尼采加入讨论', '请阿伦特回应这个问题'],
  },
  branch: {
    title: '沿着一个问题开新支路',
    description: '这会承接当前分析，生成一份新的延伸分析，而不是改写这份结果。',
    placeholder: '例如：如果反过来追问，会卡在哪里？',
    action: '展开新问题',
    chips: ['把这个问题推进一步', '从反方立场继续追问', '回到现实选择里再问一次'],
  },
  note: {
    title: '跟 Sophia 对话',
    description: '把你还没想通的地方直接说出来，Sophia 会沿着当前分析继续回应你。',
    placeholder: '例如：我还是不明白这里的分歧在哪里',
    action: '发送给 Sophia',
    chips: ['我还是不明白这里的分歧', '换一种更日常的话解释', '你觉得我下一步该问什么'],
  },
};

const STUDIO_VALIDATION_MODE: Record<StudioMode, ValidationMode> = {
  voice: 'voice',
  branch: 'branch',
  note: 'note',
};

const Arena: React.FC<ArenaProps> = ({ data, onReset, onFollowUp, onAppendThoughtVoice, onRetryVoice, retryingVoiceId, isGenerating, isAppendingVoice, onOpenConcept, onRegenerateAll, isRegenerateAllDisabled, onRegenerateAvatar, regeneratingAvatarVoiceId }) => {
  const [reflection, setReflection] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isGettingFeedback, setIsGettingFeedback] = useState(false);
  const [keywordsOpen, setKeywordsOpen] = useState(() => typeof window === 'undefined' ? true : window.matchMedia('(min-width: 768px)').matches);
  const [studioMode, setStudioMode] = useState<StudioMode>('voice');
  const [studioHint, setStudioHint] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [isCopyingExport, setIsCopyingExport] = useState(false);

  const handleReflectionSubmit = async () => {
    const trimmed = reflection.trim();
    if (!trimmed) return;
    const validation = validateUserPrompt(trimmed, { mode: STUDIO_VALIDATION_MODE[studioMode] });
    if (!validation.ok) {
      const suggestionTail = validation.suggestions && validation.suggestions.length > 0
        ? ` 试试：${validation.suggestions.slice(0, 2).join(' / ')}。`
        : '';
      setStudioHint(`${validation.hint || '这段输入还不太完整。'}${suggestionTail}`);
      return;
    }

    setStudioHint('');
    if (studioMode === 'voice') {
      onAppendThoughtVoice?.(trimmed);
      setReflection('');
      return;
    }
    if (studioMode === 'branch') {
      onFollowUp?.(trimmed);
      return;
    }

    setIsGettingFeedback(true);
    try {
      const fb = await getReflectionFeedback(data, trimmed);
      setFeedback(fb);
    } catch {
      setFeedback('Sophia 暂时保持沉默。');
    } finally {
      setIsGettingFeedback(false);
    }
  };

  const hasSynthesis = data.tensions.length > 0 || data.conclusion.summary;
  const hasUnexportableVoice = data.voices.some((voice) => voice.status === 'queued' || voice.status === 'generating' || voice.status === 'failed');
  const isExportable = !isGenerating && !isAppendingVoice && !hasUnexportableVoice && !!hasSynthesis;
  const currentMode = modeCopy[studioMode];
  const isStudioBusy = isGettingFeedback || isAppendingVoice || isGenerating;

  const handleCopyMarkdown = async () => {
    if (!isExportable || isCopyingExport) return;
    setIsCopyingExport(true);
    const ok = await copyMarkdown(buildResultMarkdown(data));
    setExportMessage(ok ? '已复制 Markdown。' : '复制失败，可以改用下载。');
    setIsCopyingExport(false);
  };

  const handleDownloadMarkdown = () => {
    if (!isExportable) return;
    const ok = downloadMarkdown(buildMarkdownFilename(data), buildResultMarkdown(data));
    setExportMessage(ok ? '已开始下载 Markdown。' : '当前浏览器不支持下载，请尝试复制 Markdown。');
  };

  return (
    <div className="w-full max-w-[100rem] mx-auto px-4 sm:px-6 pb-20 animate-fade-in -mt-4 md:-mt-12">
      <div className="text-center py-7 md:py-14 space-y-4 md:space-y-5">
        <HangingLabel
          icon={modeIcon[data.mode] || <Compass className="w-4 h-4" />}
          ariaLabel={`Argument Route ${data.modeLabel}`}
        >
          Argument Route
        </HangingLabel>
        <p className="text-xs font-mono uppercase tracking-widest text-museum-600">{data.modeLabel}</p>
        <h1 className="font-serif text-3xl md:text-6xl text-museum-900 leading-tight break-words">{data.philosophical_title}</h1>
        <div className="max-w-4xl mx-auto mt-4 md:mt-6">
          <div className="bg-white/80 backdrop-blur-md border border-museum-200 shadow-sm p-4 md:p-8">
            <p className="text-museum-800 text-base md:text-lg font-light leading-loose tracking-wide whitespace-pre-line md:text-justify">
              {data.introduction}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex w-full max-w-4xl flex-col justify-center gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!isExportable || isCopyingExport}
              title={isExportable ? '复制当前结果为 Markdown' : '结果生成完成后可导出'}
              className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Copy className="w-3.5 h-3.5" /> {isCopyingExport ? '复制中...' : '复制 Markdown'}
            </button>
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              disabled={!isExportable}
              title={isExportable ? '下载当前结果为 Markdown 文件' : '结果生成完成后可导出'}
              className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Download className="w-3.5 h-3.5" /> 下载 Markdown
            </button>
          </div>
          <p className="min-h-[1.25rem] text-xs text-museum-500">
            {exportMessage || (!isExportable ? '结果生成完成后可导出。' : '导出内容不包含 API 配置或头像生成信息。')}
          </p>
        </div>
        {isGenerating && (
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-museum-900 text-museum-50 rounded-full text-xs font-mono uppercase tracking-widest">
            <span className="w-2 h-2 bg-museum-50 rounded-full animate-pulse" />
            内容仍在展开
          </div>
        )}
      </div>

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
                <span key={keyword} className="px-3 py-1 bg-museum-100 text-museum-900 text-xs rounded-full font-mono uppercase tracking-wider">{keyword}</span>
              ))}
            </div>
          )}
        </div>
      </section>

      {data.keywords.length > 0 && (
        <section className="max-w-6xl mx-auto mb-7 md:mb-16 bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm">
          <button
            onClick={() => setKeywordsOpen((open) => !open)}
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
              <span key={keyword.id} className="px-3 py-1 bg-museum-50 border border-museum-100 text-museum-800 text-xs rounded-full font-mono uppercase tracking-wider">{keyword.term}</span>
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
      )}

      {data.programStructure.length > 0 && (
        <section className="max-w-5xl mx-auto mb-7 md:mb-16">
          <div className="text-center mb-5 md:mb-8">
            <span className="text-sm font-serif font-light tracking-[0.35em] text-museum-400">——  阅读路径  ——</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.programStructure.map((section, index) => (
              <div key={section.id} className="bg-white/80 backdrop-blur-sm border border-museum-200 p-4 md:p-6 shadow-sm">
                <p className="font-mono text-xs text-museum-400 mb-3">{String(index + 1).padStart(2, '0')}</p>
                <h3 className="font-serif text-2xl text-museum-900 mb-3">{section.title}</h3>
                <p className="text-museum-800 leading-relaxed">{section.description}</p>
              </div>
            ))}
          </div>
        </section>
      )}

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
              {data.thoughtExperiment.poeticVersion && <p className="font-serif font-light text-xl leading-loose tracking-wide mb-6">{data.thoughtExperiment.poeticVersion}</p>}
              <p className="text-museum-100 leading-loose whitespace-pre-line">{data.thoughtExperiment.unsettlingVersion}</p>
            </div>
            <div className="border border-museum-200 bg-museum-50/80 p-5 md:p-8">
              <p className="text-xs uppercase tracking-widest text-museum-400 mb-3">Core Pressure</p>
              <h3 className="font-serif text-2xl text-museum-900 mb-4">真正的挑战</h3>
              <p className="text-museum-800 leading-relaxed mb-5">{data.thoughtExperiment.coreChallenge}</p>
              <p className="text-sm text-museum-600 leading-relaxed border-t border-museum-100 pt-4">{data.thoughtExperiment.stakes}</p>
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

      {data.routeMap.length > 0 && (
        <section className="max-w-5xl mx-auto mb-8 md:mb-20">
          <div className="text-center mb-5 md:mb-10">
            <span className="text-sm font-serif font-light tracking-[0.35em] text-museum-400">——  论证路线图  ——</span>
          </div>
          <div className="space-y-4 md:space-y-5">
            {data.routeMap.map((node, index) => (
              <div key={node.id} className="bg-white/90 backdrop-blur-sm border border-museum-200 p-4 md:p-8 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                  <div className="w-12 h-12 rounded-full bg-museum-900 text-museum-50 flex items-center justify-center font-mono shrink-0">{index + 1}</div>
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
      )}

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

      {hasSynthesis && (
        <section className="max-w-5xl mx-auto mb-8 md:mb-20 space-y-6 md:space-y-8">
          {data.tensions.length > 0 && (
            <div className="bg-white/90 backdrop-blur-md border border-museum-200 shadow-sm p-5 md:p-10">
              <h2 className="font-serif text-2xl md:text-3xl text-museum-900 mb-6 md:mb-8">他们到底在争什么？</h2>
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
            <div className="bg-museum-900 text-museum-50 shadow-lg p-5 md:p-12">
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
          )}
        </section>
      )}

      <section className="max-w-5xl mx-auto mt-16 md:mt-20 bg-white/85 backdrop-blur-md border border-museum-200 shadow-sm overflow-hidden">
        <div className="p-5 md:p-8 border-b border-museum-100">
          <p className="text-xs uppercase tracking-widest text-museum-400 mb-2">Continuation Studio</p>
          <h3 className="font-serif text-2xl md:text-3xl text-museum-900">延展这场思想会话</h3>
          <p className="text-sm md:text-base text-museum-600 leading-relaxed mt-3 max-w-3xl">你可以让一位新的思想家加入当前结果，也可以沿着一个问题开启新支路，或直接把没想通的地方交给 Sophia 回应。</p>
        </div>

        <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-3 border-b border-museum-100 bg-museum-50/45">
          {(['voice', 'branch', 'note'] as StudioMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setStudioMode(mode);
                setStudioHint('');
              }}
              className={`text-left border p-4 transition-all ${studioMode === mode ? 'bg-museum-900 text-museum-50 border-museum-900 shadow-sm' : 'bg-white/75 text-museum-800 border-museum-200 hover:bg-white'}`}
            >
              <p className={`text-[10px] font-mono uppercase tracking-[0.2em] mb-2 ${studioMode === mode ? 'text-museum-300' : 'text-museum-400'}`}>{mode === 'voice' ? 'Add Voice' : mode === 'branch' ? 'New Branch' : 'Talk with Sophia'}</p>
              <h4 className="font-serif text-lg leading-tight">{modeCopy[mode].title}</h4>
              <p className={`mt-2 text-sm leading-relaxed ${studioMode === mode ? 'text-museum-200' : 'text-museum-600'}`}>{modeCopy[mode].description}</p>
            </button>
          ))}
        </div>

        <div className="p-5 md:p-8">
          <div className="flex flex-wrap gap-2 mb-4">
            {currentMode.chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setReflection(chip)}
                className="inline-flex min-h-[36px] items-center px-3.5 py-2 rounded-full border border-museum-200 bg-white/75 text-xs text-museum-700 hover:border-museum-500 hover:bg-white transition-colors md:min-h-0 md:py-1.5 md:px-3"
              >
                {chip}
              </button>
            ))}
          </div>

          {studioMode === 'branch' && data.followUps.length > 0 && (
            <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.followUps.map((followUp) => (
                <button
                  key={followUp.id}
                  type="button"
                  onClick={() => onFollowUp?.(followUp.question)}
                  className="text-left p-4 bg-white/80 border border-museum-200 hover:bg-white hover:shadow-sm transition-all group"
                >
                  <p className="font-serif text-lg text-museum-900 group-hover:underline">{followUp.question}</p>
                  <p className="text-sm text-museum-500 mt-2 leading-relaxed">{followUp.reason}</p>
                  <span className="mt-3 inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-museum-500 group-hover:text-museum-900">
                    生成延伸分析 <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <textarea
              value={reflection}
              onChange={(e) => {
                setReflection(e.target.value);
                setStudioHint('');
              }}
              placeholder={currentMode.placeholder}
              className="w-full p-4 md:p-5 bg-museum-50/80 border border-museum-200 focus:outline-none focus:ring-2 focus:ring-museum-200 min-h-[116px] md:min-h-[140px] font-serif text-base md:text-lg text-museum-900 resize-none"
            />
            <button
              onClick={handleReflectionSubmit}
              disabled={isStudioBusy || !reflection.trim() || (studioMode === 'voice' && !onAppendThoughtVoice)}
              className="mt-3 w-full md:w-auto md:absolute md:bottom-4 md:right-4 bg-museum-900 text-white px-5 py-2.5 hover:bg-black transition-colors disabled:opacity-50 text-sm font-medium tracking-wide"
            >
              {isAppendingVoice ? '正在邀请新声音...' : isGettingFeedback ? 'Sophia 正在回应...' : currentMode.action}
            </button>
          </div>

          {studioHint && (
            <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-100 px-4 py-3 leading-relaxed">{studioHint}</p>
          )}

          {feedback && studioMode === 'note' && (
            <div className="mt-6 p-5 bg-white/90 border border-museum-200 animate-fade-in backdrop-blur-md border-l-4 border-l-museum-800">
              <h4 className="font-serif text-xl md:text-2xl text-museum-900 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-700" /> Sophia 的回应
              </h4>
              <p className="text-museum-800 leading-relaxed whitespace-pre-line">{feedback}</p>
            </div>
          )}
        </div>
      </section>

      <div className="text-center mt-20 flex flex-col sm:flex-row items-center justify-center gap-3">
        {onRegenerateAll && (
          <button
            type="button"
            onClick={onRegenerateAll}
            disabled={isRegenerateAllDisabled}
            title="使用同样的问题重新生成整份分析"
            className="group inline-flex items-center gap-3 border border-museum-300 bg-white/70 px-6 py-4 shadow-sm hover:bg-museum-900 hover:text-museum-50 transition-all backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white/70 disabled:hover:text-museum-800"
          >
            <RefreshCw className="w-4 h-4 text-museum-400 group-hover:text-museum-50 group-hover:rotate-180 transition-all duration-500" />
            <span className="font-serif text-museum-800 group-hover:text-museum-50">重新生成这份分析</span>
          </button>
        )}
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
