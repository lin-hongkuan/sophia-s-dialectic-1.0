import {
  AnalysisOutline,
  AnalysisResult,
  AnalyzeCallbacks,
  ContinuationContext,
  GenerationProgress,
  KeywordExplainer,
  OpenConclusion,
  ProgramMode,
  RouteNode,
  TensionFocus,
  ThoughtVoice,
  ThoughtVoiceImageAvatar,
  VoiceKind,
  emptyConclusion,
} from '../types';

const apiKey = process.env.SOPHIA_API_KEY || '';
const apiBaseUrl = (process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/$/, '');
const apiModel = process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini';
const avatarImageModel = process.env.SOPHIA_IMAGE_MODEL || 'grok-imagine-image-lite';
const apiProvider = process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible';
const avatarImageSize = process.env.SOPHIA_IMAGE_SIZE || '1024x1024';
const avatarAspectHint = process.env.SOPHIA_IMAGE_ASPECT_HINT || 'portrait 1:1.2 aspect ratio';
const API_URL = `${apiBaseUrl}/chat/completions`;
const IMAGE_API_URL = `${apiBaseUrl}/images/generations`;
const requestHeaders = () => ({
  'Content-Type': 'application/json',
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
});

export const THOUGHT_VOICE_AVATAR_STYLE = 'Sophia editorial portrait style: square museum-catalog avatar, warm ivory and charcoal palette, muted ink-wash texture, subtle paper grain, soft directional light, restrained philosophical atmosphere, elegant, non-cartoon, non-photorealistic, no text, no logos, no UI elements.';

const MODE_LABELS: Record<ProgramMode, string> = {
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

const VALID_MODES = new Set(Object.keys(MODE_LABELS));

const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseJson = <T>(content: string): T => {
  let jsonContent = content.trim();
  if (jsonContent.startsWith('```')) {
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonContent = jsonMatch[1].trim();
  }
  return JSON.parse(jsonContent) as T;
};

const isTransientStatus = (status: number) => status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const apiErrorMessage = async (response: Response) => {
  const errorData = await response.json().catch(() => ({}));
  return `${apiProvider} API 请求失败: ${response.status} - ${errorData.error?.message || '未知错误'}`;
};

const callAvatarImage = async (prompt: string): Promise<string> => {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        model: avatarImageModel,
        prompt,
        n: 1,
        size: avatarImageSize,
        response_format: 'b64_json',
      }),
    });

    if (response.ok || !isTransientStatus(response.status) || attempt === 2) break;
    await wait(800 * (attempt + 1));
  }

  if (!response?.ok) {
    throw new Error(response ? await apiErrorMessage(response) : `${apiProvider} 图片接口请求失败: 未知错误`);
  }

  const data = await response.json().catch(() => ({} as any));
  const item = data?.data?.[0];
  if (item?.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (typeof item?.url === 'string' && item.url) {
    return item.url;
  }
  throw new Error(`${apiProvider} 图片接口未返回可用图像。`);
};

const VOICE_KIND_AVATAR_SUBJECT: Record<VoiceKind, string> = {
  philosopher: 'a fictional, stylized philosopher figure inspired by the spirit of this thinker but NOT a likeness of any real or historical person; do not attempt photo-realistic celebrity resemblance.',
  school: 'a fictional, representative thinker embodying the temperament of this school of thought; symbolic, archetypal, never a real person.',
  concept: 'an allegorical personification of the concept, conveyed through gesture, light, posture and quiet symbolic background props; expressive but restrained.',
  position: 'a fictional contemporary thinker holding this real-world stance; ordinary modern attire, museum-catalog framing, no celebrity likeness.',
  contemporary: 'a fictional contemporary critic or observer; thoughtful expression, modern restrained attire, museum-catalog framing.',
};

const NEGATIVE_AVATAR_PROMPT = 'no text, no Chinese characters, no captions, no titles, no logos, no watermark, no UI elements, no signature, avoid distorted facial features, avoid extra limbs, avoid celebrity photo likeness.';

export const buildThoughtVoiceAvatarPrompt = (
  topic: string,
  outline: Pick<AnalysisOutline, 'philosophical_title' | 'modeLabel'>,
  voicePlan: { name: string; kind: VoiceKind; school?: string; role: string; coreConcept: string; oneLine: string; stance: string },
): string => {
  const subject = VOICE_KIND_AVATAR_SUBJECT[voicePlan.kind] || VOICE_KIND_AVATAR_SUBJECT.philosopher;
  const schoolLine = voicePlan.school ? `\nSchool / tradition: ${voicePlan.school}` : '';
  return [
    THOUGHT_VOICE_AVATAR_STYLE,
    `Subject: ${subject}`,
    `Voice name (semantic anchor only, do NOT render as text): ${voicePlan.name}`,
    `Voice kind: ${voicePlan.kind}${schoolLine}`,
    `Role in this analysis: ${voicePlan.role}`,
    `Core concept: ${voicePlan.coreConcept}`,
    `One-line stance: ${voicePlan.oneLine || voicePlan.stance}`,
    `User question being analyzed: ${topic}`,
    `Big question: ${outline.philosophical_title}`,
    `Analytical mode: ${outline.modeLabel}`,
    `Composition: ${avatarAspectHint}, slightly taller-than-wide editorial portrait, head-and-shoulders or symbolic chest-up vignette, centered, soft directional light, calm museum-catalog atmosphere. Avoid square crop; leave quiet vertical breathing room above and below the figure.`,
    NEGATIVE_AVATAR_PROMPT,
  ].join('\n');
};

export const generateThoughtVoiceAvatar = async (
  topic: string,
  outline: Pick<AnalysisOutline, 'philosophical_title' | 'modeLabel'>,
  voicePlan: { name: string; kind: VoiceKind; school?: string; role: string; coreConcept: string; oneLine: string; stance: string },
): Promise<ThoughtVoiceImageAvatar> => {
  const prompt = buildThoughtVoiceAvatarPrompt(topic, outline, voicePlan);
  const imageUrl = await callAvatarImage(prompt);
  return {
    imageUrl,
    prompt,
    style: THOUGHT_VOICE_AVATAR_STYLE,
    model: avatarImageModel,
    alt: `${voicePlan.name} 的竖版思想声音头像`,
    generatedAt: new Date().toISOString(),
    subjectType: voicePlan.kind,
  };
};

const callChatJson = async <T>(messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens = 4096): Promise<T> => {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: requestHeaders(),
      body: JSON.stringify({
        model: apiModel,
        messages,
        temperature: 0.72,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (response.ok || !isTransientStatus(response.status) || attempt === 2) break;
    await wait(800 * (attempt + 1));
  }

  if (!response?.ok) {
    throw new Error(response ? await apiErrorMessage(response) : `${apiProvider} API 请求失败: 未知错误`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('苏菲没有回应。API 返回数据格式异常。');
  return parseJson<T>(content);
};

const callChatText = async (
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  maxTokens = 4096,
  onDelta?: (delta: string, fullText: string) => void,
): Promise<string> => {
  if (!onDelta) {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: requestHeaders(),
        body: JSON.stringify({
          model: apiModel,
          messages,
          temperature: 0.72,
          max_tokens: maxTokens,
        }),
      });

      if (response.ok || !isTransientStatus(response.status) || attempt === 2) break;
      await wait(800 * (attempt + 1));
    }

    if (!response?.ok) {
      throw new Error(response ? await apiErrorMessage(response) : `${apiProvider} API 请求失败: 未知错误`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: requestHeaders(),
    body: JSON.stringify({
      model: apiModel,
      messages,
      temperature: 0.72,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    throw new Error(`${apiProvider} 流式请求失败: ${response.status} ${text}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === '[DONE]') continue;
      try {
        const parsed = JSON.parse(payload);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onDelta(delta, fullText);
        }
      } catch {
        // Ignore malformed SSE keepalive chunks.
      }
    }
  }

  return fullText;
};

const normalizeMode = (mode: string | undefined): ProgramMode => {
  if (mode && VALID_MODES.has(mode)) return mode as ProgramMode;
  return 'custom';
};

const normalizeKind = (kind: string | undefined): VoiceKind => {
  if (kind === 'philosopher' || kind === 'school' || kind === 'concept' || kind === 'position' || kind === 'contemporary') return kind;
  return 'philosopher';
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const toText = (value: unknown, fallback = ''): string => {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const toTextArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((item) => toText(item)).filter(Boolean) : [];

const normalizeQuestionFrame = (value: unknown, topic: string, title: string): AnalysisOutline['questionFrame'] => {
  const source = isRecord(value) ? value : {};
  return {
    original: toText(source.original, topic),
    bigQuestion: toText(source.bigQuestion, title || topic),
    plainTranslation: toText(source.plainTranslation),
    keywords: toTextArray(source.keywords),
  };
};

const normalizeProgramStructure = (value: unknown): AnalysisOutline['programStructure'] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `section-${index + 1}`),
        title: toText(source.title, `阅读节点 ${index + 1}`),
        description: toText(source.description),
      };
    })
    : [];

const normalizeRouteMap = (value: unknown): RouteNode[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      const node: RouteNode = {
        id: toText(source.id, `route-${index + 1}`),
        title: toText(source.title, `路线节点 ${index + 1}`),
        role: toText(source.role, '节点'),
        plain: toText(source.plain),
        philosophical: toText(source.philosophical),
      };
      const tension = toText(source.tension);
      const nextQuestion = toText(source.nextQuestion);
      if (tension) node.tension = tension;
      if (nextQuestion) node.nextQuestion = nextQuestion;
      return node;
    })
    : [];

const normalizeVoicePlans = (value: unknown): AnalysisOutline['voicePlans'] =>
  Array.isArray(value)
    ? value.slice(0, 5).map((voice, index) => {
      const source = isRecord(voice) ? voice : {};
      return {
        id: toText(source.id, `voice-${index + 1}`),
        name: toText(source.name, `思想声音 ${index + 1}`),
        kind: normalizeKind(toText(source.kind)),
        school: toText(source.school),
        role: toText(source.role, '思想声音'),
        coreConcept: toText(source.coreConcept),
        oneLine: toText(source.oneLine, toText(source.stance)),
        stance: toText(source.stance, toText(source.oneLine)),
        diagnosis: toText(source.diagnosis),
        prescription: toText(source.prescription),
        thesis: toText(source.thesis),
        critique: toText(source.critique),
      };
    })
    : [];

const normalizeSeminarMatrix = (value: unknown): AnalysisOutline['seminarMatrix'] => {
  if (!isRecord(value)) return undefined;
  const cells = Array.isArray(value.cells)
    ? value.cells.map((cell, index) => {
      const source = isRecord(cell) ? cell : {};
      return {
        id: toText(source.id, `cell-${index + 1}`),
        factualOption: toText(source.factualOption),
        valueOption: toText(source.valueOption),
        label: toText(source.label, `位置 ${index + 1}`),
        description: toText(source.description),
      };
    })
    : [];

  const matrix = {
    factualQuestion: toText(value.factualQuestion),
    valueQuestion: toText(value.valueQuestion),
    factualOptions: toTextArray(value.factualOptions),
    valueOptions: toTextArray(value.valueOptions),
    cells,
  };

  return matrix.factualQuestion || matrix.valueQuestion || matrix.cells.length > 0 ? matrix : undefined;
};

const normalizeDiagnosisFrame = (value: unknown): AnalysisOutline['diagnosisFrame'] => {
  if (!isRecord(value)) return undefined;
  const doctors = Array.isArray(value.doctors)
    ? value.doctors.map((doctor, index) => {
      const source = isRecord(doctor) ? doctor : {};
      return {
        voiceId: toText(source.voiceId, `voice-${index + 1}`),
        diagnosis: toText(source.diagnosis),
        prescription: toText(source.prescription),
      };
    })
    : [];

  const frame = {
    symptomTitle: toText(value.symptomTitle),
    symptoms: toTextArray(value.symptoms),
    framing: toText(value.framing),
    doctors,
  };

  return frame.symptomTitle || frame.symptoms.length > 0 || frame.framing || frame.doctors.length > 0 ? frame : undefined;
};

const normalizeThoughtExperiment = (value: unknown): AnalysisOutline['thoughtExperiment'] => {
  if (!isRecord(value)) return undefined;
  const responseMap = Array.isArray(value.responseMap)
    ? value.responseMap.map((response, index) => {
      const source = isRecord(response) ? response : {};
      return {
        voiceId: toText(source.voiceId, `voice-${index + 1}`),
        route: toText(source.route),
      };
    })
    : [];
  const poeticVersion = toText(value.poeticVersion);
  const frame = {
    ...(poeticVersion ? { poeticVersion } : {}),
    unsettlingVersion: toText(value.unsettlingVersion),
    coreChallenge: toText(value.coreChallenge),
    stakes: toText(value.stakes),
    responseMap,
  };

  return frame.poeticVersion || frame.unsettlingVersion || frame.coreChallenge || frame.stakes || frame.responseMap.length > 0 ? frame : undefined;
};

const normalizeTensions = (value: unknown): TensionFocus[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `tension-${index + 1}`),
        title: toText(source.title, `分歧 ${index + 1}`),
        content: toText(source.content),
        relatedVoiceIds: toTextArray(source.relatedVoiceIds),
      };
    })
    : [];

const normalizeKeywords = (value: unknown): KeywordExplainer[] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `keyword-${index + 1}`),
        term: toText(source.term, `关键词 ${index + 1}`),
        meaning: toText(source.meaning),
        importance: toText(source.importance),
      };
    })
    : [];

const normalizeFollowUps = (value: unknown): AnalysisResult['followUps'] =>
  Array.isArray(value)
    ? value.map((item, index) => {
      const source = isRecord(item) ? item : {};
      return {
        id: toText(source.id, `follow-${index + 1}`),
        question: toText(source.question),
        reason: toText(source.reason),
      };
    }).filter((item) => item.question)
    : [];

const normalizeQuestionSuggestions = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .map((item) => toText(item).replace(/^[-•\d.、\s]+/, '').trim())
    .filter((item) => item.length >= 4)
    .slice(0, 5);

const normalizeConclusion = (value: unknown): OpenConclusion => {
  if (!isRecord(value)) return emptyConclusion;
  return {
    summary: toText(value.summary),
    openQuestion: toText(value.openQuestion),
    realLifeReturn: toText(value.realLifeReturn),
  };
};

const outlineSystemPrompt = `
你是 Sophia，一个中文哲学写作者、问题结构编辑和思想地图设计者。你的任务不是写百科词条，而是把用户的问题整理成一份可阅读、可展开的哲学分析页面。

核心原则：
- 保留长篇哲学家/流派论述作为结果页核心，但本请求只生成分析骨架，不写长文。
- 先把用户困惑翻译成一个大问题，再选择合适的分析路径。
- 不要固定三层“常识/理论/本体”。
- 不要固定 4-5 位哲学家；按问题需要选择 2-5 个思想声音。
- 思想声音可以是哲学家、流派、概念、现实立场或当代批评者。
- 优先选择真正贴合问题的思想资源，不要默认康德、尼采、苏格拉底。
- 语言要有可读性、画面感和概念张力，但不要使用“节目”“本期节目”等说法。

可选分析路径：
- progressive: 层层深入
- roundtable: 圆桌辩论
- genealogy: 历史谱系
- dilemma: 两难困境
- concept_archaeology: 概念考古
- thought_experiment: 思想实验
- school_seminar: 流派研讨会，适合“某某主义有道理吗”
- diagnosis_clinic: 哲学门诊，适合“如何克服/摆脱/面对某种困境”
- thought_experiment_panel: 思想实验的几条出路，适合怀疑论/认识论思想实验
- custom: 自由编排

输出只能是 JSON，不要 markdown。`;

const formatContinuationContext = (context?: ContinuationContext) => {
  if (!context) return '';
  return `
这是对上一份分析的继续追问，不要当成完全无关的新题。
上一份标题：${context.parentTitle}
上一份原问题：${context.parentTopic}
上一份核心问题：${context.parentQuestion}
上一份暂时总结：${context.parentSummary || '无'}
上一份主要分歧：${context.parentTensions?.join('\n') || '无'}
这次追问的触发理由：${context.selectedFollowUpReason || '用户沿着当前分析继续追问'}
请承接上一份分析的概念、张力和结论，生成一份延伸分析。`;
};

const generateOutline = async (topic: string, continuationContext?: ContinuationContext): Promise<AnalysisOutline> => {
  const continuationText = formatContinuationContext(continuationContext);
  const raw = await callChatJson<any>([
    { role: 'system', content: outlineSystemPrompt },
    {
      role: 'user',
      content: `为这个用户问题设计哲学分析骨架：${topic}${continuationText}

必须输出 JSON：
{
  "philosophical_title": "大问题标题",
  "mode": "可选分析路径之一",
  "modeLabel": "自然的中文路径名，避免机器式命名",
  "introduction": "300-500字开题，让普通用户进入问题，不要说节目或本期",
  "questionFrame": {
    "original": "用户原问题",
    "bigQuestion": "哲学化后的大问题",
    "plainTranslation": "现实处境中的翻译",
    "keywords": ["关键词"]
  },
  "programStructure": [{"id":"section-1","title":"阅读节点标题","description":"这一步在分析中的作用"}],
  "routeMap": [{"id":"route-1","title":"路线节点","role":"节点功能","plain":"80-150字人话说明","philosophical":"80-150字哲学说明","tension":"可选张力"}],
  "voicePlans": [{
    "id":"voice-1",
    "name":"哲学家/流派名",
    "kind":"philosopher|school|concept|position|contemporary",
    "school":"学派，可选",
    "role":"在这份分析中的角色，比如医生/流派/回应者",
    "coreConcept":"核心概念",
    "oneLine":"一句话观点",
    "stance":"立场摘要",
    "diagnosis":"如果适用，诊断",
    "prescription":"如果适用，药方",
    "thesis":"如果适用，主张",
    "critique":"如果适用，会受到的批评"
  }],
  "seminarMatrix": "school_seminar 时可选",
  "diagnosisFrame": "diagnosis_clinic 时可选",
  "thoughtExperiment": {
    "poeticVersion": "可选，富有画面感的一段设定",
    "unsettlingVersion": "更尖锐的不安版本",
    "coreChallenge": "这个思想实验真正逼问的是什么",
    "stakes": "如果认真接受它，现实/认识/伦理上会付出什么代价",
    "responseMap": [{"voiceId":"必须匹配 voicePlans 中的 id","route":"这个思想声音如何回应该实验，80-160字"}]
  },
  "reasoning_trace": ["真实生成步骤，6-8条"]
}

voicePlans 选择 2-5 个，必须足够贴题。不要生成 routeMap.nextQuestion；继续追问统一放到 followUps。如果 mode 是 thought_experiment 或 thought_experiment_panel，必须生成 thoughtExperiment，且 responseMap.voiceId 必须匹配 voicePlans 的 id。`,
    },
  ], 3500);

  const mode = normalizeMode(raw.mode);
  const now = new Date().toISOString();
  const title = toText(raw.philosophical_title, `大问题：${topic}`);
  return {
    id: makeId('analysis'),
    createdAt: now,
    topic,
    philosophical_title: title,
    mode,
    modeLabel: toText(raw.modeLabel, MODE_LABELS[mode]),
    introduction: toText(raw.introduction),
    questionFrame: normalizeQuestionFrame(raw.questionFrame, topic, title),
    programStructure: normalizeProgramStructure(raw.programStructure),
    routeMap: normalizeRouteMap(raw.routeMap),
    voicePlans: normalizeVoicePlans(raw.voicePlans),
    seminarMatrix: normalizeSeminarMatrix(raw.seminarMatrix),
    diagnosisFrame: normalizeDiagnosisFrame(raw.diagnosisFrame),
    thoughtExperiment: normalizeThoughtExperiment(raw.thoughtExperiment),
    reasoning_trace: toTextArray(raw.reasoning_trace),
  };
};

const voiceSystemPrompt = `
你是 Sophia，一位中文哲学长文写作者。你要为一个哲学分析页面中的单个“思想声音”写一篇严谨、通俗、有阅读感的长篇论述。

写作要求：
- 简体中文。
- 1800-2400 中文字，目标约 2000 中文字；必须接近一篇完整短论文的展开密度，低于 1600 字视为不合格。
- 不要写成条目清单，主体用连贯段落。
- 风格严谨、有比喻、有现实例子、有概念张力，但不要油腻。
- 必须围绕用户问题，不要泛泛介绍哲学史。
- 内部必须覆盖：理论根基、对问题的诊断/主张、对其他立场的批判、用户如果接受它要承担的判断压力。
- 如果分析路径是哲学门诊，要明显写出“诊断”和“药方”。
- 如果是流派研讨会，要讲清该流派的哲学前提、核心诉求、典型批评。
- 如果是思想实验的几条出路，要讲清它如何回应思想实验，以及局限在哪里。
- 不要使用“节目”“本期节目”等说法。
`;

const generateVoiceEssay = async (
  topic: string,
  outline: AnalysisOutline,
  voicePlan: AnalysisOutline['voicePlans'][number],
  onDelta?: (delta: string, fullText: string) => void,
): Promise<ThoughtVoice> => {
  const argument = await callChatText([
    { role: 'system', content: voiceSystemPrompt },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
大问题：${outline.philosophical_title}
开题：${outline.introduction}
阅读结构：${outline.programStructure.map((s) => `${s.title}：${s.description}`).join('\n')}

请只为这个思想声音写长篇论述：
名称：${voicePlan.name}
类型：${voicePlan.kind}
学派：${voicePlan.school || '无'}
角色：${voicePlan.role}
核心概念：${voicePlan.coreConcept}
一句话观点：${voicePlan.oneLine}
立场摘要：${voicePlan.stance}
诊断：${voicePlan.diagnosis || '无'}
药方：${voicePlan.prescription || '无'}
主张：${voicePlan.thesis || '无'}
可被批评处：${voicePlan.critique || '无'}

直接输出正文，不要 JSON，不要标题。`,
    },
  ], 7000, onDelta);

  const summary = await callChatJson<{ summaryForSynthesis: string; quote?: string; challenges?: string[] }>([
    { role: 'system', content: '你是哲学分析编辑。请把长文压缩成供最终综合判断使用的 JSON。只输出 JSON。' },
    {
      role: 'user',
      content: `用户问题：${topic}
思想声音：${voicePlan.name}
长文：${argument}

输出 JSON：{"summaryForSynthesis":"120-180字摘要，说明诊断/主张/药方和与其他立场的潜在分歧","quote":"一句适合展示的短句，可合成风格化表达","challenges":["它会挑战的其他立场或问题"]}`,
    },
  ], 1000).catch(() => ({ summaryForSynthesis: voicePlan.stance || voicePlan.oneLine || '', quote: '', challenges: [] }));

  const avatar = await generateThoughtVoiceAvatar(topic, outline, voicePlan).catch((error) => {
    console.warn(`[sophia] 思想声音头像生成失败：${voicePlan.name}`, error);
    return undefined;
  });

  return {
    id: voicePlan.id,
    name: voicePlan.name,
    kind: voicePlan.kind,
    school: voicePlan.school,
    role: voicePlan.role,
    coreConcept: voicePlan.coreConcept,
    oneLine: voicePlan.oneLine,
    stance: voicePlan.stance,
    diagnosis: voicePlan.diagnosis,
    prescription: voicePlan.prescription,
    thesis: voicePlan.thesis,
    critique: voicePlan.critique,
    argument,
    quote: summary.quote,
    challenges: Array.isArray(summary.challenges) ? summary.challenges : [],
    summaryForSynthesis: summary.summaryForSynthesis || voicePlan.stance,
    avatar,
    status: 'completed',
  };
};

const generateRouteDetails = async (topic: string, outline: AnalysisOutline): Promise<RouteNode[]> => {
  const result = await callChatJson<{ routeMap: RouteNode[] }>([
    { role: 'system', content: '你是中文哲学分析结构编辑。补全论证路线图，保持短而有推进力。只输出 JSON。' },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
已有路线：${JSON.stringify(outline.routeMap)}

请补全 routeMap，每个节点 plain 120-220字，philosophical 120-220字，必须有清晰推进。不要生成 nextQuestion 字段，继续追问统一留给 followUps。输出 JSON：{"routeMap":[...]}`,
    },
  ], 2500).catch(() => ({ routeMap: outline.routeMap }));
  const routeMap = normalizeRouteMap(result.routeMap);
  return routeMap.length > 0 ? routeMap : outline.routeMap;
};

const generateSynthesis = async (
  topic: string,
  outline: AnalysisOutline,
  voices: ThoughtVoice[],
): Promise<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>> => {
  const fallback: Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'> = {
    tensions: [],
    keywords: [],
    followUps: [],
    conclusion: emptyConclusion,
  };

  const raw = await callChatJson<Partial<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>>>([
    { role: 'system', content: '你是哲学分析编辑。基于已生成的思想声音摘要，生成最终综合判断。只输出 JSON。' },
    {
      role: 'user',
      content: `用户问题：${topic}
分析路径：${outline.modeLabel}
大问题：${outline.philosophical_title}
思想声音摘要：
${voices.map((v) => `${v.name}: ${v.summaryForSynthesis}`).join('\n')}

输出 JSON：
{
  "tensions": [{"id":"tension-1","title":"他们到底在争什么","content":"180-350字，解释核心分歧","relatedVoiceIds":["voice-id"]}],
  "keywords": [{"id":"keyword-1","term":"关键词","meaning":"这个词是什么意思","importance":"它在这个问题里为什么重要"}],
  "followUps": [{"id":"follow-1","question":"承接当前分析的继续追问","reason":"说明它如何接着当前分歧、关键词或结论往下走"}],
  "conclusion": {"summary":"综合判断，400-700字","openQuestion":"仍然悬而未决的问题","realLifeReturn":"回到用户现实处境，200-350字"}
}

followUps 必须是对当前分析的延伸，不要像另一个全新选题。`,
    },
  ], 3500).catch(() => fallback);

  return {
    tensions: normalizeTensions(raw.tensions),
    keywords: normalizeKeywords(raw.keywords),
    followUps: normalizeFollowUps(raw.followUps),
    conclusion: normalizeConclusion(raw.conclusion),
  };
};

export const createPartialResult = (outline: AnalysisOutline): AnalysisResult => ({
  id: outline.id,
  createdAt: outline.createdAt,
  topic: outline.topic,
  philosophical_title: outline.philosophical_title,
  mode: outline.mode,
  modeLabel: outline.modeLabel,
  introduction: outline.introduction,
  questionFrame: outline.questionFrame,
  programStructure: outline.programStructure,
  routeMap: outline.routeMap,
  voices: outline.voicePlans.map((voice) => ({
    ...voice,
    argument: '',
    summaryForSynthesis: '',
    status: 'queued',
  })),
  tensions: [],
  keywords: [],
  followUps: [],
  seminarMatrix: outline.seminarMatrix,
  diagnosisFrame: outline.diagnosisFrame,
  thoughtExperiment: outline.thoughtExperiment,
  conclusion: emptyConclusion,
  reasoning_trace: outline.reasoning_trace,
});

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

export const analyzeTopic = async (
  userTopic: string,
  callbacks: AnalyzeCallbacks = {},
  continuationContext?: ContinuationContext,
): Promise<AnalysisResult> => {
  const report = (progress: GenerationProgress) => callbacks.onProgress?.(progress);

  try {
    report({
      stage: 'outline',
      totalVoices: 0,
      completedVoices: 0,
      messages: [continuationContext ? '正在沿着上一份分析继续展开...' : '正在把问题整理成一张思想地图...'],
    });
    const outline = await generateOutline(userTopic, continuationContext);
    callbacks.onOutline?.(outline);

    let result = createPartialResult(outline);
    report({
      stage: 'route',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: 0,
      messages: [`已形成分析路径：${outline.modeLabel}`, '正在补全论证路线图...'],
    });

    const routeMap = await generateRouteDetails(userTopic, outline);
    result = { ...result, routeMap };
    callbacks.onRouteMap?.(routeMap);

    const voices: ThoughtVoice[] = [];
    report({
      stage: 'voices',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: 0,
      messages: [`正在生成 ${outline.voicePlans.length} 个长篇思想声音...`],
    });

    const generatedVoices = await runWithConcurrency(outline.voicePlans, 3, async (voicePlan) => {
      callbacks.onVoiceStart?.(voicePlan.id, voicePlan.name);
      report({
        stage: 'voices',
        modeLabel: outline.modeLabel,
        totalVoices: outline.voicePlans.length,
        completedVoices: voices.length,
        currentVoiceName: voicePlan.name,
        messages: [`正在生成：${voicePlan.name}`],
      });

      try {
        const voice = await generateVoiceEssay(userTopic, outline, voicePlan, (delta, fullText) => {
          callbacks.onVoiceDelta?.(voicePlan.id, delta, fullText);
          report({
            stage: 'voices',
            modeLabel: outline.modeLabel,
            totalVoices: outline.voicePlans.length,
            completedVoices: voices.length,
            currentVoiceName: voicePlan.name,
            streamedChars: fullText.length,
            messages: [`${voicePlan.name} 正在生成长篇论述...`],
          });
        }).catch(async () => generateVoiceEssay(userTopic, outline, voicePlan));
        voices.push(voice);
        callbacks.onVoiceComplete?.(voice);
        report({
          stage: 'voices',
          modeLabel: outline.modeLabel,
          totalVoices: outline.voicePlans.length,
          completedVoices: voices.length,
          currentVoiceName: voicePlan.name,
          messages: [`${voicePlan.name} 已完成。`],
        });
        return voice;
      } catch (error) {
        const failed: ThoughtVoice = {
          ...voicePlan,
          argument: '',
          summaryForSynthesis: '',
          status: 'failed',
          error: error instanceof Error ? error.message : '生成失败',
        };
        callbacks.onVoiceComplete?.(failed);
        return failed;
      }
    });

    const completedVoices = generatedVoices.filter((voice) => voice.status === 'completed');
    report({
      stage: 'synthesis',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: completedVoices.length,
      messages: ['正在生成分歧、关键词和综合判断...'],
    });
    const synthesis = await generateSynthesis(userTopic, outline, completedVoices);
    callbacks.onSynthesis?.(synthesis);

    result = {
      ...result,
      voices: result.voices.map((placeholder) => generatedVoices.find((voice) => voice.id === placeholder.id) || placeholder),
      tensions: normalizeTensions(synthesis.tensions),
      keywords: normalizeKeywords(synthesis.keywords),
      followUps: normalizeFollowUps(synthesis.followUps),
      conclusion: normalizeConclusion(synthesis.conclusion),
    };

    report({
      stage: 'done',
      modeLabel: outline.modeLabel,
      totalVoices: outline.voicePlans.length,
      completedVoices: completedVoices.length,
      messages: ['这份哲学分析已生成完成。'],
    });

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : '发生了未知错误';
    callbacks.onError?.(message);
    report({ stage: 'error', totalVoices: 0, completedVoices: 0, messages: [message] });
    throw error;
  }
};

export const generateQuestionSuggestions = async (seedTopic = ''): Promise<string[]> => {
  const raw = await callChatJson<{ questions: string[] }>([
    {
      role: 'system',
      content: '你是 Sophia 的首页问题策展人。请生成适合被哲学分析器展开的中文问题。只输出 JSON。',
    },
    {
      role: 'user',
      content: `请生成 5 个适合首页展示的哲学问题。
${seedTopic ? `用户当前输入或兴趣：${seedTopic}` : '用户没有输入具体兴趣，请覆盖生活焦虑、伦理困境、认识论、社会议题和存在问题。'}

要求：
- 每个问题 8-22 个中文字符左右，必须以问号结尾。
- 问题要具体、有张力、普通人也愿意点击。
- 不要重复首页已有问题；如果用户给了当前兴趣，围绕它生成更尖锐的变体。
- 不要输出解释。

输出 JSON：{"questions":["问题1？","问题2？","问题3？","问题4？","问题5？"]}`,
    },
  ], 900);

  const questions = normalizeQuestionSuggestions(raw.questions);
  return questions.length > 0 ? questions : [];
};

export const getReflectionFeedback = async (topic: string, userReflection: string): Promise<string> => {
  try {
    return await callChatText([
      {
        role: 'system',
        content: `你是 Sophia，一个哲学对话者。请用简体中文回应用户追问。要尖锐、鼓励、严谨，并连接到具体哲学立场；不要把它写成作文批改，而要像继续追问的对话。`,
      },
      {
        role: 'user',
        content: `分析主题：${topic}\n用户追问：${userReflection}\n\n请像在和用户继续对话一样回应：先指出这个追问真正卡住的概念，再给出 1-2 个可能的思想路径，最后反问一个更准确的下一问。300-600 字。`,
      },
    ], 1200);
  } catch (error) {
    console.error('Reflection feedback error:', error);
    return '苏菲暂时无法回应，请稍后再试。';
  }
};
