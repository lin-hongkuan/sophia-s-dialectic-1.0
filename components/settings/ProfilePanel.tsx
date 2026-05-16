import React from 'react';
import { RotateCcw, Sparkles } from 'lucide-react';
import type { AnalysisProfile } from '../../services/sophiaConfig';
import { SectionHeader } from './SectionHeader';

interface ProfileChoice {
  value: string;
  label: string;
  description: string;
}

const DEPTH_CHOICES: ProfileChoice[] = [
  { value: 'concise', label: '简洁', description: '更快给出判断，减少展开和重复。' },
  { value: 'standard', label: '标准', description: '保持当前 Sophia 的完整密度。' },
  { value: 'deep', label: '深挖', description: '增加分歧、反驳、代价和综合。' },
];

const EXPRESSION_CHOICES: ProfileChoice[] = [
  { value: 'academic', label: '学术严谨', description: '强调概念边界、理论脉络和限定条件。' },
  { value: 'plain', label: '通俗清楚', description: '先讲人话，再解释必要术语。' },
  { value: 'sharp', label: '锋利诊断', description: '直接指出矛盾、逃避点和价值代价。' },
];

const EVIDENCE_CHOICES: ProfileChoice[] = [
  { value: 'theory', label: '偏理论', description: '更多流派、概念和思想史关系。' },
  { value: 'balanced', label: '均衡', description: '理论解释与现实例子各占一部分。' },
  { value: 'practical', label: '偏现实', description: '更多工作、关系、教育、技术等场景。' },
];

const labelForChoice = (choices: ProfileChoice[], value: string): string =>
  choices.find((choice) => choice.value === value)?.label || '';

const analysisProfileSummary = (profile: AnalysisProfile): string => {
  const depth = labelForChoice(DEPTH_CHOICES, profile.depth);
  const style = labelForChoice(EXPRESSION_CHOICES, profile.expressionStyle);
  const focus = labelForChoice(EVIDENCE_CHOICES, profile.evidenceFocus);
  return `当前画像：${depth}深度，${style}，${focus}。改动会影响下一次生成的长度、语气、例子密度和综合判断风格。`;
};

const ProfileChoiceGroup: React.FC<{
  title: string;
  description: string;
  value: string;
  choices: ProfileChoice[];
  onChange: (value: string) => void;
}> = ({ title, description, value, choices, onChange }) => (
  <fieldset>
    <legend className="text-[11px] font-mono uppercase tracking-widest text-museum-500">{title}</legend>
    <p className="mt-1 text-[12px] leading-relaxed text-museum-600">{description}</p>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3" role="group" aria-label={title}>
      {choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(choice.value)}
            className={`min-h-[76px] rounded-lg border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-museum-700/40 ${
              selected
                ? 'border-museum-800 bg-museum-900 text-museum-50 shadow'
                : 'border-museum-200 bg-white/70 text-museum-800 hover:border-museum-400 hover:bg-white'
            }`}
          >
            <span className={`block font-serif text-base ${selected ? 'text-museum-50' : 'text-museum-900'}`}>{choice.label}</span>
            <span className={`mt-1 block text-[11px] leading-relaxed ${selected ? 'text-museum-200' : 'text-museum-600'}`}>
              {choice.description}
            </span>
          </button>
        );
      })}
    </div>
  </fieldset>
);

interface ProfilePanelProps {
  profile: AnalysisProfile;
  onProfileChange: (patch: Partial<AnalysisProfile>) => void;
  onResetProfile: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({ profile, onProfileChange, onResetProfile }) => (
  <section
    id="settings-panel-profile"
    role="tabpanel"
    aria-labelledby="settings-tab-profile"
    className="mt-8 rounded-xl border border-museum-200 bg-white/60 p-6"
  >
    <SectionHeader
      icon={<Sparkles className="h-4 w-4" />}
      title="分析画像"
      description="用普通语言控制 Sophia 的输出倾向。它会叠加到系统提示词上，影响下一次生成的长度、语气、例子密度与综合判断风格。"
    />

    <div className="space-y-7">
      <ProfileChoiceGroup
        title="分析深度"
        description="决定这次分析是快速收束，还是展开更多分歧和代价。"
        value={profile.depth}
        choices={DEPTH_CHOICES}
        onChange={(value) => onProfileChange({ depth: value as AnalysisProfile['depth'] })}
      />
      <ProfileChoiceGroup
        title="表达方式"
        description="决定 Sophia 说话时更像学术编辑、清晰讲解者，还是诊断式批评者。"
        value={profile.expressionStyle}
        choices={EXPRESSION_CHOICES}
        onChange={(value) => onProfileChange({ expressionStyle: value as AnalysisProfile['expressionStyle'] })}
      />
      <ProfileChoiceGroup
        title="例证重心"
        description="决定论证材料更靠近理论脉络，还是更多回到现实场景。"
        value={profile.evidenceFocus}
        choices={EVIDENCE_CHOICES}
        onChange={(value) => onProfileChange({ evidenceFocus: value as AnalysisProfile['evidenceFocus'] })}
      />
    </div>

    <div className="mt-7 flex flex-col gap-3 rounded-lg border border-museum-200 bg-museum-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[13px] leading-relaxed text-museum-700">
        {analysisProfileSummary(profile)}
      </p>
      <button
        type="button"
        onClick={onResetProfile}
        className="inline-flex shrink-0 items-center justify-center gap-1 rounded border border-museum-200 bg-white/70 px-3 py-2 text-[11px] text-museum-600 hover:bg-museum-100"
      >
        <RotateCcw className="h-3 w-3" />
        恢复默认画像
      </button>
    </div>
  </section>
);
