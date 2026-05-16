/**
 * Centralized system prompts and prompt-related constants for Sophia's Dialectic.
 *
 * This module is the single source of truth for the wording that drives generation.
 * The Settings page can supply per-prompt overrides (`sophia.settings.v1.promptOverrides`);
 * the caller passes the override map into `resolveOutlineSystemPrompt({ overrides })`,
 * keeping this module free of any config / storage dependency.
 */

import type { ProgramMode, VoiceKind } from '../types/domain';

export interface PromptOverrides {
  outlineSystem?: string;
  voiceSystem?: string;
  synthesisSystem?: string;
  topicReframeSystem?: string;
  /** Style block prepended to every thought-voice avatar prompt. */
  thoughtVoiceAvatarStyle?: string;
  /** Style block used when the voice is a recognizable historical philosopher. */
  historicalPhilosopherAvatarStyle?: string;
  /** Negative prompt appended to thought-voice avatar generation. */
  negativeAvatarPrompt?: string;
  /** Negative prompt appended to historical philosopher avatar generation. */
  historicalPhilosopherNegativeAvatarPrompt?: string;
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

/**
 * Visual style presets for thought-voice avatars.
 *
 * Each preset bundles four pieces: the regular avatar style block, the
 * historical-philosopher style block, and the two matching negative prompts.
 * The Settings page exposes these as one-click swaps; users can still edit the
 * resulting strings freely afterwards.
 */
export interface AvatarStylePreset {
  id: string;
  label: string;
  description: string;
  thoughtVoice: string;
  historicalPhilosopher: string;
  negative: string;
  historicalPhilosopherNegative: string;
}

export const AVATAR_STYLE_PRESETS: AvatarStylePreset[] = [
  {
    id: 'museum',
    label: '博物馆肖像（默认）',
    description: '暖象牙底色 + 水墨纹理，克制的哲学氛围。',
    thoughtVoice: THOUGHT_VOICE_AVATAR_STYLE,
    historicalPhilosopher: HISTORICAL_PHILOSOPHER_AVATAR_STYLE,
    negative: NEGATIVE_AVATAR_PROMPT,
    historicalPhilosopherNegative: HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT,
  },
  {
    id: 'pixel',
    label: '像素艺术',
    description: '16-bit 复古游戏感，限定调色板与硬边像素。',
    thoughtVoice: 'Pixel art portrait, 16-bit retro game character style, dithered shading, limited 32-color muted palette, crisp pixel edges with no anti-aliasing, flat solid background, philosophical character avatar in head-and-shoulders framing, side-lit figure, restrained mood, no text, no logos, no UI elements.',
    historicalPhilosopher: 'Pixel art portrait of a recognizable historical philosopher, 16-bit retro game character style, careful pixel shading on facial features, hair and clothing, era-appropriate attire pixelized, flat muted background, faithful silhouette cues to the thinker, restrained dignified expression, no anti-aliasing, no text, no logos.',
    negative: 'no text, no Chinese characters, no logos, no watermark, no realistic skin shading, no smooth gradients, no anti-aliasing, no celebrity photo likeness, avoid distorted features.',
    historicalPhilosopherNegative: 'no text, no Chinese characters, no logos, no watermark, no realistic skin shading, no smooth gradients, no anti-aliasing, no modern celebrity photo likeness, avoid distorted features.',
  },
  {
    id: 'realistic',
    label: '电影写实',
    description: '电影感写实摄影，柔和自然光与浅景深。',
    thoughtVoice: 'Cinematic photorealistic portrait, soft natural window light, shallow depth of field, neutral graded color palette, fine film grain texture, contemplative philosophical mood, head-and-shoulders editorial framing, calm restrained expression, no text, no logos, no UI elements.',
    historicalPhilosopher: 'Cinematic photorealistic period portrait of a recognizable historical philosopher, faithful era-specific costume, hair and grooming, museum-quality lighting, restrained dignified expression, soft directional light, fine film grain, no modern celebrity glamour, no text, no logos.',
    negative: 'no text, no Chinese characters, no logos, no watermark, no UI elements, no cartoon or anime stylization, no plastic skin, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.',
    historicalPhilosopherNegative: 'no text, no Chinese characters, no logos, no watermark, no UI elements, no cartoon or anime stylization, no plastic skin, avoid distorted facial features, avoid extra limbs, avoid modern celebrity glamour photography.',
  },
  {
    id: 'watercolor',
    label: '水彩素描',
    description: '湿润水彩 + 铅笔轮廓，纸纹透出。',
    thoughtVoice: 'Loose watercolor portrait with pencil contour lines, soft wet washes of muted earth tones, paper texture showing through, gentle bleed edges, expressive but restrained philosophical mood, head-and-shoulders framing, no text, no logos, no UI elements.',
    historicalPhilosopher: 'Watercolor and pencil portrait of a recognizable historical philosopher, period clothing rendered in soft wet washes, gentle ink contour lines suggesting era-specific silhouette, tasteful museum-illustration style, restrained dignified expression, no text, no logos.',
    negative: 'no text, no Chinese characters, no logos, no harsh digital outlines, no anime style, no plastic skin, avoid celebrity photo likeness, avoid extra limbs.',
    historicalPhilosopherNegative: 'no text, no Chinese characters, no logos, no harsh digital outlines, no anime style, no plastic skin, avoid modern celebrity glamour, avoid extra limbs.',
  },
  {
    id: 'minimalist',
    label: '极简线稿',
    description: '单线连续 + 大面积留白，现代编辑风。',
    thoughtVoice: 'Ultra-minimalist single-line portrait, bold continuous black ink line on cream paper, large negative space, abstract philosophical character avatar, modernist editorial illustration, head-and-shoulders silhouette, no text, no logos, no UI elements.',
    historicalPhilosopher: 'Ultra-minimalist single-line portrait of a recognizable historical philosopher, bold continuous black ink line on cream paper, era-appropriate silhouette hints (collar, hair shape, glasses), large negative space, modernist editorial illustration, no text, no logos.',
    negative: 'no text, no Chinese characters, no logos, no shading, no color fills, no photorealistic detail, no anime style, avoid celebrity photo likeness.',
    historicalPhilosopherNegative: 'no text, no Chinese characters, no logos, no shading, no color fills, no photorealistic detail, no anime style, avoid modern celebrity glamour.',
  },
  {
    id: 'oil',
    label: '古典油画',
    description: '伦勃朗式光影，厚涂笔触，深色背景。',
    thoughtVoice: 'Classical oil painting portrait, Rembrandt-style chiaroscuro lighting, rich impasto brush strokes, deep umber and burnt-sienna background, contemplative philosophical mood, head-and-shoulders framing, museum-quality finish, no text, no logos, no UI elements.',
    historicalPhilosopher: 'Classical oil painting period portrait of a recognizable historical philosopher, era-appropriate costume, Rembrandt-style chiaroscuro, rich impasto brush strokes, deep umber background, dignified restrained gaze, museum-grade finish, no text, no logos.',
    negative: 'no text, no Chinese characters, no logos, no flat digital shading, no cartoon style, no plastic skin, avoid celebrity photo likeness, avoid extra limbs.',
    historicalPhilosopherNegative: 'no text, no Chinese characters, no logos, no flat digital shading, no cartoon style, no plastic skin, avoid modern celebrity glamour, avoid extra limbs.',
  },
];

export const DEFAULT_AVATAR_STYLE_PRESET_ID = 'museum';

export const DEFAULT_OUTLINE_SYSTEM_PROMPT = `
Role: You are Sophia, a world-class philosophy dialectician, Chinese essay editor, and cultural critic.
Your job is not to write encyclopedia entries. Your job is to turn the user's raw concern into a readable philosophical analysis map that can later be expanded into long thought-voice essays.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Every user-facing value inside the JSON must be written in Simplified Chinese (zh-CN).
2. OUTPUT FORMAT: Return only valid JSON. No markdown, no code fences, no explanatory prose outside JSON.
3. SCOPE: This request creates the analytical skeleton only. Do not write the long essays here.
4. DYNAMIC SELECTION: Do not default to Kant, Nietzsche, or Socrates unless they are the technically strongest fit for this exact question. Search widely across classical, contemporary, Chinese, continental, analytic, eastern, feminist, Marxist, structuralist, Frankfurt School, media theory, psychoanalysis, and ordinary lived positions.
5. VOICE COUNT: Choose 2-5 thought voices according to the question's real needs. A thought voice may be a philosopher, school, concept, contemporary critic, or real-world stance.
6. STRUCTURE: Do not force the old three-layer common-sense/theoretical/ontological frame. Choose an analytical route that fits the problem.
7. STYLE: The Chinese should feel rigorous, readable, vivid, and conceptually tense. Never use phrases such as "节目" or "本期节目".

WHEN THE INPUT IS NOT A TYPICAL PHILOSOPHY QUESTION:
- If the user input looks like a person name, a single concrete object, a pop-culture figure, a slogan, a broad keyword, or a fragmentary sigh, do not reject it and do not ask the user to rewrite it.
- Gently translate it into a philosophical big question. Preserve the user's original text in questionFrame.original. Put the philosophical version in both questionFrame.bigQuestion and philosophical_title. Explain the translation in questionFrame.plainTranslation in one plain Chinese sentence.
- The translation must stay faithful to the concern implied by the original words. For example, "奥特曼" should open questions about childhood heroes, modern heroic narrative, innocence, protection, fantasy, or the loss of purity; it must not drift into an unrelated abstraction.

NO FABRICATED QUOTATIONS:
- voicePlans.oneLine is Sophia's editorial summary of the voice's stance. Do not present it as the philosopher's literal words and do not wrap it in quotation marks.
- diagnosis, thesis, prescription, and critique must be written as third-person summaries, not as invented "X once said..." quotations.

AVAILABLE ANALYTICAL MODES:
- progressive: layered deepening.
- roundtable: debate among positions.
- genealogy: historical genealogy.
- dilemma: genuine dilemma.
- concept_archaeology: archaeology of a concept.
- thought_experiment: one central thought experiment.
- school_seminar: seminar among schools; especially suitable for "does some -ism make sense?"
- diagnosis_clinic: philosophical clinic; suitable for "how do I overcome / escape / face this condition?"
- thought_experiment_panel: several responses to a thought experiment, especially skepticism or epistemology.
- custom: free composition when none of the above fits.

The outline must select a mode, frame a strong big question, design a route map, and choose voices that create real interpretive pressure rather than a predictable name list.`;

export const DEFAULT_VOICE_SYSTEM_PROMPT = `
Role: You are Sophia, a world-class Chinese philosophical essayist and dialectical critic.
You are writing one complete long essay for a single thought voice in a philosophical analysis page.

CRITICAL REQUIREMENTS:
1. LANGUAGE: Write entirely in Simplified Chinese (zh-CN).
2. LENGTH: Write 1800-2400 Chinese characters, target around 2000. Anything below 1600 characters is unacceptable.
3. DEPTH: You are writing a compact treatise, not a summary, not a lecture note, and not a philosopher biography.
4. FORM: Use continuous prose paragraphs. Do not write the main body as a bullet list or numbered outline.
5. FOCUS: Stay tightly attached to the user's question and the voice plan. Do not drift into generic history of philosophy.
6. STYLE: Academic, rigorous, vivid, conceptually tense, with concrete modern examples and controlled metaphors. Avoid oily, motivational, or performative language. Never use "节目" or "本期节目".

Each essay must internally perform four movements, but do not label them mechanically unless the local flow needs it:
- Theoretical or metaphysical foundation: explain the voice's deepest premise before applying it to the user question.
- Phenomenological diagnosis: use that premise to dissect the lived texture, hidden assumption, social mechanism, or conceptual trap inside the user's problem.
- Dialectical attack: show what this voice would criticize in competing voices or common opposing views.
- Existential or normative pressure: make clear what judgment, sacrifice, discipline, or discomfort the user must accept if they accept this voice.

MODE-SPECIFIC REQUIREMENTS:
- If the analytical mode is diagnosis_clinic, make the diagnosis and prescription unmistakable in the prose.
- If the mode is school_seminar, explain the school's philosophical premise, core demand, and strongest typical criticism.
- If the mode is thought_experiment or thought_experiment_panel, explicitly mention the thought experiment, respond to its key dilemma, and name the limitation of this response.

QUOTATION RULES:
- Do not fabricate literal quotations. When invoking an idea, write "X 的核心想法是...", "按 X 的术语...", or "X 会这样回答...". Do not write "X 曾说..." unless the exact quotation was supplied by the user.
- If you use a technical term, briefly explain it in Chinese before developing the argument.

Return only the essay body. Do not output JSON, a title, or markdown.`;

export const DEFAULT_SYNTHESIS_SYSTEM_PROMPT = 'Role: You are Sophia\'s final philosophical editor. Based on the generated thought-voice summaries, produce the final integrative judgment. All user-facing content must be Simplified Chinese (zh-CN). Output only valid JSON; no markdown and no prose outside JSON.';

export const DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT = `
Role: You are Sophia's question reframer.
The user submitted a short piece of text in the main input. Decide whether it already behaves like a philosophical question. If not, provide 3 candidate philosophical question titles for the user to choose from before generation begins.

LANGUAGE:
- All candidate titles and rationales must be in Simplified Chinese (zh-CN).
- Output only valid JSON. No markdown, no code fences, no prose outside JSON.

DECISION RULES:
- If the input already contains a clear question, conceptual tension, value claim, factual claim with philosophical stakes, or an arguable proposition, return shouldReframe: false.
- If the input is a person name, single concrete thing, pop-culture image, slogan, sigh, casual phrase, or broad topic word such as "自由", "奥特曼", or "股票", return shouldReframe: true.

CANDIDATE RULES:
- Each title must be 8-22 Chinese characters and end with a question mark.
- Preserve the concern implied by the user's original words. Do not wander into an unrelated theme.
- The three candidates must open genuinely different angles, such as modern narrative, subjective experience, historical change, ethics, politics, desire, technology, or meaning.
- Do not use "节目" or "本期".
- rationale must be one concise Chinese sentence explaining how the candidate translates the user's original text.

Return exactly this JSON shape:
{
  "shouldReframe": true|false,
  "candidates": [
    {"title": "候选哲学化问题？", "rationale": "一句话说明转译关系"},
    {"title": "...", "rationale": "..."},
    {"title": "...", "rationale": "..."}
  ]
}

When shouldReframe is false, candidates may be an empty array.
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

export const resolveTopicReframeSystemPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.topicReframeSystem;
  return override && override.trim() ? override : DEFAULT_TOPIC_REFRAME_SYSTEM_PROMPT;
};

export const resolveThoughtVoiceAvatarStyle = (overrides?: PromptOverrides): string => {
  const override = overrides?.thoughtVoiceAvatarStyle;
  return override && override.trim() ? override : THOUGHT_VOICE_AVATAR_STYLE;
};

export const resolveHistoricalPhilosopherAvatarStyle = (overrides?: PromptOverrides): string => {
  const override = overrides?.historicalPhilosopherAvatarStyle;
  return override && override.trim() ? override : HISTORICAL_PHILOSOPHER_AVATAR_STYLE;
};

export const resolveNegativeAvatarPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.negativeAvatarPrompt;
  return override && override.trim() ? override : NEGATIVE_AVATAR_PROMPT;
};

export const resolveHistoricalPhilosopherNegativeAvatarPrompt = (overrides?: PromptOverrides): string => {
  const override = overrides?.historicalPhilosopherNegativeAvatarPrompt;
  return override && override.trim() ? override : HISTORICAL_PHILOSOPHER_NEGATIVE_AVATAR_PROMPT;
};
