/**
 * Centralized system prompts and prompt-related constants for Sophia's Dialectic.
 *
 * This module is the single source of truth for the wording that drives generation.
 * The Settings page can supply per-prompt overrides (`sophia.settings.v1.promptOverrides`);
 * the caller passes the override map into `resolveOutlineSystemPrompt({ overrides })`,
 * keeping this module free of any config / storage dependency.
 */

import type { ProgramMode, VoiceKind } from '../types';

export interface PromptOverrides {
  outlineSystem?: string;
  voiceSystem?: string;
  synthesisSystem?: string;
}

export const MODE_LABELS: Record<ProgramMode, string> = {
  progressive: '层层深入',
  roundtable: '圆桌辩论',
  genealogy: '历史谱系',
  dilemma: '两难困境',
  concept_archaeology: '概念考古',
  thought_experiment: '思想实验',
  school_seminar: '流派研讨会',
  diagnosis_clinic: '哲学门诊',
  thought_experiment_panel: '思想实验的几条出路',
  custom: '自由编排',
};

export const VALID_MODES = new Set(Object.keys(MODE_LABELS));

export const THOUGHT_VOICE_AVATAR_STYLE = 'Sophia editorial portrait style: square museum-catalog avatar, warm ivory and charcoal palette, muted ink-wash texture, subtle paper grain, soft directional light, restrained philosophical atmosphere, elegant, non-cartoon, non-photorealistic, no text, no logos, no UI elements.';

export const HISTORICAL_PHILOSOPHER_AVATAR_STYLE = 'Sophia editorial portrait style: museum-catalog avatar, warm ivory and charcoal palette, muted ink-wash texture, subtle paper grain, soft directional light, restrained philosophical atmosphere, elegant, non-cartoon, editorial historical portrait realism, no text, no logos, no UI elements.';

export const VOICE_KIND_AVATAR_SUBJECT: Record<VoiceKind, string> = {
  philosopher: 'a recognizable historical portrait interpretation when the voice name is a real philosopher; preserve the thinker\'s known facial structure, hair, clothing era, posture and intellectual temperament while keeping Sophia\'s restrained museum-catalog style.',
  school: 'a fictional, representative thinker embodying the temperament of this school of thought; symbolic, archetypal, never a real person.',
  concept: 'an allegorical personification of the concept, conveyed through gesture, light, posture and quiet symbolic background props; expressive but restrained.',
  position: 'a fictional contemporary thinker holding this real-world stance; ordinary modern attire, museum-catalog framing, no celebrity likeness.',
  contemporary: 'a fictional contemporary critic or observer; thoughtful expression, modern restrained attire, museum-catalog framing.',
};

export const NEGATIVE_AVATAR_PROMPT = 'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.';

export const HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT = 'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid modern celebrity glamour photography.';

export const DEFAULT_OUTLINE_SYSTEM_PROMPT = `
你是 Sophia，一个中文哲学写作者、问题结构编辑和思想地图设计者。你的任务不是写百科词条，而是把用户的问题整理成一份可阅读、可展开的哲学分析页面。

核心原则：
- 保留长篇哲学家/流派论述作为结果页核心，但本请求只生成分析骨架，不写长文。
- 先把用户困惑翻译成一个大问题，再选择合适的分析路径。
- 不要固定三层"常识/理论/本体"。
- 不要固定 4-5 位哲学家；按问题需要选择 2-5 个思想声音。
- 思想声音可以是哲学家、流派、概念、现实立场或当代批评者。
- 优先选择真正贴合问题的思想资源，不要默认康德、尼采、苏格拉底。
- 语言要有可读性、画面感和概念张力，但不要使用"节目""本期节目"等说法。

处理"非典型哲学输入"的兜底规则：
- 如果用户输入更像人名、单一具体事物、流行文化形象、口头语、或一句没头没尾的感叹（例如"奥特曼""我累了""股票"），不要拒绝，也不要要求用户重新输入。
- 把它温柔地翻译为一个能展开的哲学大问题：保留用户原文在 questionFrame.original，让 questionFrame.bigQuestion 与 philosophical_title 显示哲学化后的版本，questionFrame.plainTranslation 用一句话讲清这一步是怎么转译的。
- 翻译方向必须忠实于用户原文的关切线索：例如"奥特曼"应当指向童年偶像 / 现代英雄叙事 / 纯真消逝等切口，不要跑题成无关概念。

不要伪造引语：
- voicePlans.oneLine 是 Sophia 总结后的立场，不要把它写成该哲学家原话或加引号。
- 思想声音的"诊断 / 主张 / 批评"也用第三人称转述，不要伪造为"X 曾说："…""。

可选分析路径：
- progressive: 层层深入
- roundtable: 圆桌辩论
- genealogy: 历史谱系
- dilemma: 两难困境
- concept_archaeology: 概念考古
- thought_experiment: 思想实验
- school_seminar: 流派研讨会，适合"某某主义有道理吗"
- diagnosis_clinic: 哲学门诊，适合"如何克服/摆脱/面对某种困境"
- thought_experiment_panel: 思想实验的几条出路，适合怀疑论/认识论思想实验
- custom: 自由编排

输出只能是 JSON，不要 markdown。`;

export const DEFAULT_VOICE_SYSTEM_PROMPT = `
你是 Sophia，一位中文哲学长文写作者。你要为一个哲学分析页面中的单个"思想声音"写一篇严谨、通俗、有阅读感的长篇论述。

写作要求：
- 简体中文。
- 1800-2400 中文字，目标约 2000 中文字；必须接近一篇完整短论文的展开密度，低于 1600 字视为不合格。
- 不要写成条目清单，主体用连贯段落。
- 风格严谨、有比喻、有现实例子、有概念张力，但不要油腻。
- 必须围绕用户问题，不要泛泛介绍哲学史。
- 内部必须覆盖：理论根基、对问题的诊断/主张、对其他立场的批判、用户如果接受它要承担的判断压力。
- 如果分析路径是哲学门诊，要明显写出"诊断"和"药方"。
- 如果是流派研讨会，要讲清该流派的哲学前提、核心诉求、典型批评。
- 如果是思想实验的几条出路，要讲清它如何回应思想实验，以及局限在哪里。
- 不要使用"节目""本期节目"等说法。

引用规范：
- 不要伪造该思想家的原话。要引用思想时，使用"X 的核心想法是…"、"按 X 的术语…"或"X 会这样回答…"，不要写成"X 曾说："…""。
- 如果使用具体术语（如"自为""怨恨""祛魅"），用一句话解释术语含义，再展开。

如果分析路径是 thought_experiment 或 thought_experiment_panel：
- 必须显式提到该思想实验，并指出本声音如何回应它的关键困境，而不是绕开实验空谈立场。
`;

export const DEFAULT_SYNTHESIS_SYSTEM_PROMPT = '你是哲学分析编辑。基于已生成的思想声音摘要，生成最终综合判断。只输出 JSON。';

export const DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT = `
你是 Sophia 的"问题转译器"。用户在主输入框提交了一段文字，你的任务是判断它是否已经像一个能够被哲学分析展开的问题；如果不像，提供 3 个候选的哲学化标题，让用户从中选一个再开始正式生成。

判断标准：
- 已经是哲学问题（含明确诘问、概念张力、价值或事实命题）→ shouldReframe: false。
- 是人名、单一具体事物、流行文化形象、口头语、感叹、宽泛主题词（如"自由""奥特曼""股票"）→ shouldReframe: true。

候选要求（每个候选 8-22 中文字，以问号结尾）：
- 必须忠实保留用户原文的关切方向，不要跑题。
- 三个候选要打开不同切口（如"现代叙事 / 主体经验 / 历史变迁"三种侧面），不要彼此雷同。
- 不要使用"节目""本期"等说法。
- rationale 用一句话解释这条候选与用户原文的转译关系。

只输出 JSON：
{
  "shouldReframe": true|false,
  "candidates": [
    {"title": "候选哲学化问题？", "rationale": "一句话说明转译关系"},
    {"title": "...", "rationale": "..."},
    {"title": "...", "rationale": "..."}
  ]
}

shouldReframe 为 false 时 candidates 可以是空数组。
`;

/**
 * Resolve the outline system prompt, preferring a Settings-page override if present.
 */
export const resolveOutlineSystemPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.outlineSystem;
  return override && override.trim() ? override : DEFAULT_OUTLINE_SYSTEM_PROMPT;
};

export const resolveVoiceSystemPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.voiceSystem;
  return override && override.trim() ? override : DEFAULT_VOICE_SYSTEM_PROMPT;
};

export const resolveSynthesisSystemPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.synthesisSystem;
  return override && override.trim() ? override : DEFAULT_SYNTHESIS_SYSTEM_PROMPT;
};

export const resolveTopicReframeSystemPrompt = (): string => DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT;
