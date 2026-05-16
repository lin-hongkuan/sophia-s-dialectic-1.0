import type { AvatarStylePreset, PromptOverrides } from '../../services/prompts';
import {
  DEFAULT_OUTLINE_SYSTEM_PROMPT,
  DEFAULT_SYNTHESIS_SYSTEM_PROMPT,
  DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT,
  DEFAULT_VOICE_SYSTEM_PROMPT,
  HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
  HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
  NEGATIVE_AVATAR_PROMPT,
  THOUGHT_VOICE_AVATAR_STYLE,
} from '../../services/prompts';

export interface PromptDef {
  key: keyof PromptOverrides;
  label: string;
  description: string;
  defaultText: string;
}

export const PROMPT_DEFS: PromptDef[] = [
  {
    key: 'outlineSystem',
    label: '问题图谱（outline）',
    description: '决定大问题、分析路径、思想声音名单的生成。',
    defaultText: DEFAULT_OUTLINE_SYSTEM_PROMPT,
  },
  {
    key: 'voiceSystem',
    label: '思想声音长文（voice）',
    description: '每个思想声音 1800-2400 字论述的写作风格与引用规范。',
    defaultText: DEFAULT_VOICE_SYSTEM_PROMPT,
  },
  {
    key: 'synthesisSystem',
    label: '综合判断（synthesis）',
    description: '声音之间的张力、关键词、综合结论的生成。',
    defaultText: DEFAULT_SYNTHESIS_SYSTEM_PROMPT,
  },
  {
    key: 'topicReframeSystem',
    label: '问题转译（topic reframe）',
    description: '判断用户输入是否需要转译，以及生成 3 个候选哲学化标题的规则。',
    defaultText: DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT,
  },
];

export interface AvatarPromptDef {
  key: keyof PromptOverrides;
  label: string;
  description: string;
  defaultText: string;
  presetField: keyof Pick<AvatarStylePreset, 'thoughtVoice' | 'historicalPhilosopher' | 'negative' | 'historicalPhilosopherNegative'>;
}

export const AVATAR_PROMPT_DEFS: AvatarPromptDef[] = [
  {
    key: 'thoughtVoiceAvatarStyle',
    label: '思想声音头像风格',
    description: '所有非历史哲学家头像的视觉风格描述（思想流派 / 概念 / 立场 / 当代批评者）。',
    defaultText: THOUGHT_VOICE_AVATAR_STYLE,
    presetField: 'thoughtVoice',
  },
  {
    key: 'historicalPhilosopherAvatarStyle',
    label: '历史哲学家头像风格',
    description: '当声音是真实历史哲学家时使用的视觉风格。通常需要更写实、更尊重时代特征。',
    defaultText: HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
    presetField: 'historicalPhilosopher',
  },
  {
    key: 'negativeAvatarPrompt',
    label: '思想声音负向提示',
    description: '附加在思想声音头像 prompt 末尾，告诉模型应避免什么（文字、水印、变形等）。',
    defaultText: NEGATIVE_AVATAR_PROMPT,
    presetField: 'negative',
  },
  {
    key: 'historicalPhilosopherNegativeAvatarPrompt',
    label: '历史哲学家负向提示',
    description: '附加在历史哲学家头像 prompt 末尾的负向约束。',
    defaultText: HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
    presetField: 'historicalPhilosopherNegative',
  },
];
