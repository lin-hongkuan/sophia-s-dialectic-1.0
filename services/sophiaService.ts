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
  VoiceKind,
  emptyConclusion,
} from '../types';

const apiKey = process.env.SOPHIA_API_KEY || '';
const apiBaseUrl = (process.env.SOPHIA_API_BASE_URL || 'https://api.linhongkuan.com/v1').replace(/\/$/, '');
const apiModel = process.env.SOPHIA_API_MODEL || 'gpt-5.4-mini';
const apiProvider = process.env.SOPHIA_API_PROVIDER || 'OpenAI-compatible';
const API_URL = `${apiBaseUrl}/chat/completions`;

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

const callChatJson = async <T>(messages: Array<{ role: 'system' | 'user'; content: string }>, maxTokens = 4096): Promise<T> => {
  if (!apiKey) {
    throw new Error('缺少 SOPHIA_API_KEY。请在 .env.local 或 GitHub Secrets 中设置 Sophia API Key。');
  }

  let response: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
  if (!apiKey) {
    throw new Error('缺少 SOPHIA_API_KEY。请在 .env.local 或 GitHub Secrets 中设置 Sophia API Key。');
  }

  if (!onDelta) {
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
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
  return {
    id: makeId('analysis'),
    createdAt: now,
    topic,
    philosophical_title: raw.philosophical_title || `大问题：${topic}`,
    mode,
    modeLabel: raw.modeLabel || MODE_LABELS[mode],
    introduction: raw.introduction || '',
    questionFrame: {
      original: raw.questionFrame?.original || topic,
      bigQuestion: raw.questionFrame?.bigQuestion || raw.philosophical_title || topic,
      plainTranslation: raw.questionFrame?.plainTranslation || '',
      keywords: Array.isArray(raw.questionFrame?.keywords) ? raw.questionFrame.keywords : [],
    },
    programStructure: Array.isArray(raw.programStructure) ? raw.programStructure : [],
    routeMap: Array.isArray(raw.routeMap) ? raw.routeMap : [],
    voicePlans: (Array.isArray(raw.voicePlans) ? raw.voicePlans : []).slice(0, 5).map((voice: any, index: number) => ({
      id: voice.id || `voice-${index + 1}`,
      name: voice.name || `思想声音 ${index + 1}`,
      kind: normalizeKind(voice.kind),
      school: voice.school || '',
      role: voice.role || '思想声音',
      coreConcept: voice.coreConcept || '',
      oneLine: voice.oneLine || voice.stance || '',
      stance: voice.stance || voice.oneLine || '',
      diagnosis: voice.diagnosis || '',
      prescription: voice.prescription || '',
      thesis: voice.thesis || '',
      critique: voice.critique || '',
    })),
    seminarMatrix: raw.seminarMatrix,
    diagnosisFrame: raw.diagnosisFrame,
    thoughtExperiment: raw.thoughtExperiment,
    reasoning_trace: Array.isArray(raw.reasoning_trace) ? raw.reasoning_trace : [],
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
  return Array.isArray(result.routeMap) ? result.routeMap : outline.routeMap;
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

  return callChatJson<Pick<AnalysisResult, 'tensions' | 'keywords' | 'followUps' | 'conclusion'>>([
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
      tensions: Array.isArray(synthesis.tensions) ? synthesis.tensions as TensionFocus[] : [],
      keywords: Array.isArray(synthesis.keywords) ? synthesis.keywords as KeywordExplainer[] : [],
      followUps: Array.isArray(synthesis.followUps) ? synthesis.followUps : [],
      conclusion: synthesis.conclusion || emptyConclusion as OpenConclusion,
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

export const getReflectionFeedback = async (topic: string, userReflection: string): Promise<string> => {
  if (!apiKey) return 'API Key 缺失。';

  try {
    return await callChatText([
      {
        role: 'system',
        content: `你是 Sophia，一个哲学批注者。请用简体中文回应用户反思。要尖锐、鼓励、严谨，并连接到具体哲学立场。`,
      },
      {
        role: 'user',
        content: `分析主题：${topic}\n用户旁注：${userReflection}\n\n请给出 300-600 字批注。`,
      },
    ], 1200);
  } catch (error) {
    console.error('Reflection feedback error:', error);
    return '苏菲暂时无法回应，请稍后再试。';
  }
};
