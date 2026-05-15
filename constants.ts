import { GenerationProgress, ProgramMode } from './types';

/**
 * Single source of truth for generation-stage labels and ordering.
 * Previously duplicated in ReasoningDisplay.tsx, HistoryPage.tsx, ActiveRunBanner.tsx —
 * inconsistent wording (e.g. "等待"/"等待提问", "出错"/"遇到错误") drifted between them.
 */
export const STAGE_LABEL: Record<GenerationProgress['stage'], string> = {
  idle: '等待提问',
  outline: '整理问题结构',
  route: '生成论证路线',
  voices: '生成思想声音',
  synthesis: '综合判断',
  done: '完成',
  error: '遇到错误',
};

export const STAGE_ORDER: GenerationProgress['stage'][] = [
  'outline',
  'route',
  'voices',
  'synthesis',
  'done',
];

export const GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE =
  'Grok 上游负载过高，暂时无法提供图像服务。已使用符号占位，正文分析不受影响。';

/**
 * Per-mode presentation copy for the live generation surface (RoundtableScene).
 *
 * The data layer was already mode-aware (ProgramMode → mode-specific outline /
 * voice prompts, mode-specific Arena sections) but the live progress component
 * was hardcoded to roundtable language ("圆桌 / 桌面议题 / 声音就位 / 思想席位"),
 * so a diagnosis_clinic or thought_experiment run still looked like a debate
 * panel during generation. This map gives each mode a consistent eyebrow,
 * title fallback, item label, queued/done chip text, table-question label,
 * synthesis verb, and empty-state copy. Keep the keys aligned with
 * ProgramMode in types.ts.
 */
export interface ModePresentation {
  /** Tiny uppercase eyebrow at the very top of the live card. */
  eyebrow: string;
  /** Big title fallback used until result.philosophical_title arrives. */
  pendingTitle: string;
  /** Word for one entry in the voice grid (席位 / 诊断 / 应答 / 立场...). */
  itemLabel: string;
  /** Counter wording: "X/Y 个 ___ 就位". */
  itemUnit: string;
  /** Label above the central question card. */
  questionLabel: string;
  /** Empty-state copy shown until outline lands. */
  pendingItemsCopy: string;
  /** Insert-form heading. */
  insertHeading: string;
  /** Synthesis card eyebrow. */
  synthesisLabel: string;
  /** Per-state chip copy for the voice card status. */
  chipText: {
    queued: string;
    generating: string;
    completed: string;
  };
}

const DEFAULT_PRESENTATION: ModePresentation = {
  eyebrow: 'Sophia · Live',
  pendingTitle: '正在召集这场分析',
  itemLabel: '声音',
  itemUnit: '个声音',
  questionLabel: '核心议题',
  pendingItemsCopy: '正在确定这场分析的思想声音...',
  insertHeading: '现在加入一个新声音',
  synthesisLabel: '聚合',
  chipText: {
    queued: '等待登场',
    generating: '正在发声',
    completed: '声音已就位',
  },
};

export const MODE_PRESENTATION: Record<ProgramMode, ModePresentation> = {
  progressive: {
    eyebrow: 'Sophia · Layered Reading',
    pendingTitle: '正在搭建层层深入的阅读路径',
    itemLabel: '层',
    itemUnit: '层',
    questionLabel: '层层深入的起点',
    pendingItemsCopy: '正在确定这次层层深入的入口与节奏...',
    insertHeading: '在路径中追加一层视角',
    synthesisLabel: '收束',
    chipText: { queued: '等待展开', generating: '正在展开', completed: '已落定' },
  },
  roundtable: {
    eyebrow: "Sophia's Roundtable",
    pendingTitle: '正在召集这场圆桌',
    itemLabel: '席位',
    itemUnit: '个席位',
    questionLabel: '桌面议题',
    pendingItemsCopy: '正在确定本场圆桌的思想席位...',
    insertHeading: '为这张圆桌再加一位发言者',
    synthesisLabel: '聚合',
    chipText: { queued: '等待登场', generating: '正在发言', completed: '声音已就位' },
  },
  genealogy: {
    eyebrow: 'Sophia · Genealogy',
    pendingTitle: '正在排布这条历史谱系',
    itemLabel: '节点',
    itemUnit: '个节点',
    questionLabel: '谱系起点',
    pendingItemsCopy: '正在挑选谱系上的关键节点...',
    insertHeading: '在谱系中再加一个节点',
    synthesisLabel: '回望',
    chipText: { queued: '等待登场', generating: '正在书写', completed: '节点已就位' },
  },
  dilemma: {
    eyebrow: 'Sophia · Dilemma',
    pendingTitle: '正在拉开这道两难',
    itemLabel: '立场',
    itemUnit: '个立场',
    questionLabel: '困境核心',
    pendingItemsCopy: '正在确定两难中的对峙立场...',
    insertHeading: '加入第三个立场',
    synthesisLabel: '权衡',
    chipText: { queued: '等待开口', generating: '正在表态', completed: '立场已成形' },
  },
  concept_archaeology: {
    eyebrow: 'Sophia · Concept Archaeology',
    pendingTitle: '正在挖掘这个概念的地层',
    itemLabel: '地层',
    itemUnit: '层',
    questionLabel: '考古对象',
    pendingItemsCopy: '正在划分概念考古的关键地层...',
    insertHeading: '挖掘多一层',
    synthesisLabel: '复原',
    chipText: { queued: '等待挖掘', generating: '正在挖掘', completed: '地层已揭示' },
  },
  thought_experiment: {
    eyebrow: 'Sophia · Thought Experiment',
    pendingTitle: '正在搭建这场思想实验',
    itemLabel: '回应',
    itemUnit: '个回应',
    questionLabel: '思想实验',
    pendingItemsCopy: '正在搭建思想实验的回应方式...',
    insertHeading: '加入一种新回应',
    synthesisLabel: '回看实验',
    chipText: { queued: '等待回应', generating: '正在回应', completed: '回应已成形' },
  },
  school_seminar: {
    eyebrow: 'Sophia · School Seminar',
    pendingTitle: '正在打开这场流派研讨会',
    itemLabel: '流派',
    itemUnit: '个流派',
    questionLabel: '研讨题目',
    pendingItemsCopy: '正在挑选参加研讨的流派...',
    insertHeading: '邀请一个新流派',
    synthesisLabel: '汇总',
    chipText: { queued: '等待发言', generating: '正在陈述', completed: '陈述完成' },
  },
  diagnosis_clinic: {
    eyebrow: 'Sophia · Clinic',
    pendingTitle: '正在召集这场哲学门诊',
    itemLabel: '诊断',
    itemUnit: '个诊断',
    questionLabel: '主诉',
    pendingItemsCopy: '正在召集会诊的医生与诊断方向...',
    insertHeading: '请来一位新医生',
    synthesisLabel: '会诊',
    chipText: { queued: '等待问诊', generating: '正在问诊', completed: '诊断已开出' },
  },
  thought_experiment_panel: {
    eyebrow: 'Sophia · Several Routes',
    pendingTitle: '正在铺开这条思想实验的几条出路',
    itemLabel: '出路',
    itemUnit: '条出路',
    questionLabel: '思想实验',
    pendingItemsCopy: '正在挑选几条不同的出路...',
    insertHeading: '加入一条新出路',
    synthesisLabel: '总览',
    chipText: { queued: '等待登场', generating: '正在勘探', completed: '出路已成形' },
  },
  custom: {
    eyebrow: 'Sophia · Custom',
    pendingTitle: '正在编排这场分析',
    itemLabel: '声音',
    itemUnit: '个声音',
    questionLabel: '核心议题',
    pendingItemsCopy: '正在确定这场分析的思想声音...',
    insertHeading: '现在加入一个新声音',
    synthesisLabel: '聚合',
    chipText: { queued: '等待登场', generating: '正在发声', completed: '声音已就位' },
  },
};

export const getModePresentation = (mode?: ProgramMode | null): ModePresentation =>
  (mode && MODE_PRESENTATION[mode]) || DEFAULT_PRESENTATION;
