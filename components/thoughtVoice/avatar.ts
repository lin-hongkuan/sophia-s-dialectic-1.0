import { GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE } from '../../presentation/imageMessages';
import type { ThoughtVoice } from '../../types/domain';

interface TrustedPortrait {
  src: string;
  alt: string;
  attribution?: string;
}

export type ThoughtVoiceAvatar =
  | {
    type: 'generated';
    src: string;
    alt: string;
    title: string;
  }
  | {
    type: 'portrait';
    src: string;
    alt: string;
    title: string;
  }
  | {
    type: 'symbolic';
    initials: string;
    symbol: string;
    eraLabel: string;
    background: string;
    foreground: string;
    title: string;
  };

export type SymbolicThoughtVoiceAvatar = Extract<ThoughtVoiceAvatar, { type: 'symbolic' }>;

// Only verified local or curated portrait assets should be added here; otherwise use symbolic avatars.
const TRUSTED_PORTRAITS: Record<string, TrustedPortrait> = {};

const VOICE_KIND_SYMBOL: Record<ThoughtVoice['kind'], string> = {
  philosopher: 'ϕ',
  school: '§',
  concept: '◇',
  position: '↔',
  contemporary: '⁕',
};

const AVATAR_PALETTES = [
  { background: 'linear-gradient(135deg, #F2F0EB 0%, #D1CCC0 100%)', foreground: '#2C2A26', symbol: '∴' },
  { background: 'linear-gradient(135deg, #F6F1E7 0%, #D8CDB8 100%)', foreground: '#4A3F2F', symbol: '◇' },
  { background: 'linear-gradient(135deg, #EEE9E2 0%, #BEB7AA 100%)', foreground: '#34302A', symbol: '§' },
  { background: 'linear-gradient(135deg, #ECEFF1 0%, #C8CDD1 100%)', foreground: '#30343A', symbol: '※' },
  { background: 'linear-gradient(135deg, #F3EEE7 0%, #CFC5B7 100%)', foreground: '#3C352C', symbol: 'ϕ' },
];

const ERA_RULES = [
  { pattern: /苏格拉底|柏拉图|亚里士多德|斯多葛|伊壁鸠鲁|犬儒|赫拉克利特|巴门尼德|Socrates|Plato|Aristotle|Stoic|Epicur|古希腊|古典/i, label: '古典' },
  { pattern: /奥古斯丁|阿奎那|经院|神学|Augustine|Aquinas|Scholastic|中世纪/i, label: '中世纪' },
  { pattern: /笛卡尔|斯宾诺莎|洛克|休谟|卢梭|康德|黑格尔|Descartes|Spinoza|Locke|Hume|Rousseau|Kant|Hegel|启蒙|理性主义|经验主义|德国观念论|近代/i, label: '近代' },
  { pattern: /尼采|马克思|克尔凯郭尔|叔本华|海德格尔|萨特|波伏娃|维特根斯坦|福柯|德里达|罗尔斯|阿伦特|Nietzsche|Marx|Kierkegaard|Schopenhauer|Heidegger|Sartre|Beauvoir|Wittgenstein|Foucault|Derrida|Rawls|Arendt|现代|当代|后现代|存在主义|现象学|分析哲学|批判理论/i, label: '现代' },
];

const FALLBACK_ERA_LABEL: Record<ThoughtVoice['kind'], string> = {
  philosopher: '思想',
  school: '流派',
  concept: '概念',
  position: '立场',
  contemporary: '当代',
};

const CJK_INITIALS_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/u;
const AVATAR_IMAGE_LOAD_FALLBACK_MESSAGE = '头像图像加载失败，已使用符号占位。';

const canonicalAvatarName = (name: string) =>
  name
    .normalize('NFKC')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const hashText = (value: string) =>
  Array.from(value).reduce((hash, char) => ((hash << 5) - hash + (char.codePointAt(0) || 0)) >>> 0, 0);

const getInitials = (name: string) => {
  const cleaned = name
    .normalize('NFKC')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[-–—_/·•.,，。:：;；!?！？'"“”‘’[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const parts = cleaned.split(' ').filter(Boolean);
  const latinParts = parts.filter((part) => /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(part));
  if (latinParts.length >= 2) {
    return `${latinParts[0][0]}${latinParts[latinParts.length - 1][0]}`.toUpperCase();
  }

  const compact = cleaned.replace(/\s+/g, '');
  const initials = Array.from(compact).slice(0, 2).join('');
  return initials ? initials.toUpperCase() : '∴';
};

const getEraLabel = (voice: ThoughtVoice) => {
  const source = [voice.name, voice.school, voice.role, voice.coreConcept].filter(Boolean).join(' ');
  return ERA_RULES.find(({ pattern }) => pattern.test(source))?.label || FALLBACK_ERA_LABEL[voice.kind];
};

export const getSymbolicInitialsClassName = (initials: string) =>
  CJK_INITIALS_PATTERN.test(initials)
    ? 'font-sans text-[1.35rem] leading-none sm:text-2xl md:text-3xl lg:text-5xl xl:text-6xl'
    : 'font-serif text-2xl leading-none sm:text-4xl md:text-5xl lg:text-7xl xl:text-8xl';

export const getAvatarFallbackMessage = (voice: ThoughtVoice, imageLoadFailed: boolean) => {
  if (voice.avatarError !== undefined) {
    return voice.avatarError.trim() || GROK_IMAGE_UPSTREAM_UNAVAILABLE_MESSAGE;
  }

  return imageLoadFailed ? AVATAR_IMAGE_LOAD_FALLBACK_MESSAGE : '';
};

export const getSymbolicAvatar = (voice: ThoughtVoice, index: number): SymbolicThoughtVoiceAvatar => {
  const palette = AVATAR_PALETTES[hashText(`${voice.name}-${voice.kind}-${index}`) % AVATAR_PALETTES.length];
  const eraLabel = getEraLabel(voice);
  return {
    type: 'symbolic',
    initials: getInitials(voice.name),
    symbol: VOICE_KIND_SYMBOL[voice.kind] || palette.symbol,
    eraLabel,
    background: palette.background,
    foreground: palette.foreground,
    title: `符号头像：${voice.name}。使用姓名缩写、稳定色板与${eraLabel}标签生成，不代表真人肖像。`,
  };
};

export const resolveThoughtVoiceAvatar = (voice: ThoughtVoice, index: number): ThoughtVoiceAvatar => {
  if (voice.avatar?.imageUrl) {
    return {
      type: 'generated',
      src: voice.avatar.imageUrl,
      alt: voice.avatar.alt || `${voice.name} 的思想声音头像`,
      title: `${voice.name} · 由 ${voice.avatar.model} 生成的竖版思想声音头像。`,
    };
  }

  const portrait = TRUSTED_PORTRAITS[canonicalAvatarName(voice.name)];
  if (portrait) {
    return {
      type: 'portrait',
      src: portrait.src,
      alt: portrait.alt,
      title: `${voice.name} 的已核验肖像${portrait.attribution ? `（${portrait.attribution}）` : ''}`,
    };
  }

  return getSymbolicAvatar(voice, index);
};
