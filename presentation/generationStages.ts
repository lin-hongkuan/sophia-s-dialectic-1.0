import type { GenerationProgress } from '../types/pipeline';

/**
 * Single source of truth for generation-stage labels and ordering.
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
