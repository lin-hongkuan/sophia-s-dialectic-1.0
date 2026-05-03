/**
 * Lightweight client-side validation for free-text inputs that drive Sophia's generation.
 *
 * The goal is not to gate the LLM — Sophia is supposed to gracefully reframe even nonsense
 * inputs like "奥特曼" into something analyzable. The goal here is to give immediate UX
 * feedback for inputs that almost certainly waste tokens or produce confusing results
 * (empty submissions, URLs pasted by accident, pure emoji, code-only blobs, runaway 5000-char
 * essays). When `ok: false`, callers SHOULD show the hint but MAY still allow submission;
 * when `ok: true` the input passed.
 */

export type ValidationMode = 'topic' | 'voice' | 'branch' | 'note';

export interface ValidationResult {
  ok: boolean;
  hint?: string;
  /** Friendly suggestions the caller can render as chips. */
  suggestions?: string[];
}

const MIN_LENGTH = 3;
const MAX_LENGTH = 600;

const URL_ONLY = /^https?:\/\/\S+$/i;
const ONLY_DIGITS = /^[\d\s,.]+$/;
const ONLY_PUNCT = /^[\s\p{P}\p{S}]+$/u;
const ONLY_EMOJI = /^[\s\p{Emoji_Presentation}\p{Extended_Pictographic}]+$/u;

const MODE_HINTS: Record<ValidationMode, { tooShort: string; tooLong: string; urlOnly: string; numeric: string; punct: string; emoji: string; suggestions: string[] }> = {
  topic: {
    tooShort: '问题太短，Sophia 没法读出你想问什么。试着把它写成一句完整的疑问。',
    tooLong: '问题超过 600 字，Sophia 容易跑题。建议先压成 100-300 字的核心困惑。',
    urlOnly: '只贴了一条链接，Sophia 不会自动打开它。把你想从这个链接里追问的问题写成一句话试试。',
    numeric: '只输入了数字，Sophia 不知道这串数字代表什么。配一句问题再提交。',
    punct: '只看到符号或标点。哪怕只写"如何面对……？"也比纯符号好。',
    emoji: '只输入了 emoji。Sophia 还没解读 emoji 哲学的能力，请配一句中文问题。',
    suggestions: ['如何克服虚无主义？', '我们应该生孩子吗？', '为什么有性别不止有两个？'],
  },
  branch: {
    tooShort: '延展问题太短。沿着上一份分析继续追问，可以是"如果反过来追问，会卡在哪里？"这类一整句。',
    tooLong: '延展问题太长，Sophia 容易跑题。先压成一两句核心追问。',
    urlOnly: '只贴了一条链接，无法用来开新支路。请把你想接着的问题写成一句。',
    numeric: '只输入了数字。配一句问题再提交。',
    punct: '只看到符号或标点。把要追问的方向写成一句完整的话。',
    emoji: '只输入了 emoji。Sophia 还没解读 emoji 的能力。',
    suggestions: ['把这个问题推进一步', '从反方立场继续追问', '回到现实选择里再问一次'],
  },
  voice: {
    tooShort: '邀请太短。可以写成"让加缪加入讨论"、"请阿伦特回应这个问题"。',
    tooLong: '邀请太长，Sophia 抓不住要邀请谁。先压成一句具体的人物或立场。',
    urlOnly: '链接没法直接转化成新声音。请用一句话写明你想邀请谁。',
    numeric: '只输入了数字，无法识别为思想家或立场。',
    punct: '只看到符号或标点。请写出想邀请的思想家、流派或立场。',
    emoji: '只输入了 emoji。请用文字描述要邀请的声音。',
    suggestions: ['加缪会怎么说？', '让尼采加入讨论', '请阿伦特回应这个问题'],
  },
  note: {
    tooShort: '想跟 Sophia 说点什么？再具体一点，比如"我还是不明白这里的分歧"。',
    tooLong: '说得有点长，Sophia 容易抓不到重点。先压成 100-300 字。',
    urlOnly: 'Sophia 不会自动打开链接。把你从链接里想到的疑问写出来。',
    numeric: '只输入了数字，无法成为对话内容。',
    punct: '只看到符号或标点。把困惑用一两句话写出来。',
    emoji: '只输入了 emoji。请用一两句中文把疑问写出来。',
    suggestions: ['我还是不明白这里的分歧', '换一种更日常的话解释', '你觉得我下一步该问什么'],
  },
};

const stripWhitespace = (text: string) => text.replace(/\s+/g, '');

export const validateUserPrompt = (input: string, options: { mode: ValidationMode }): ValidationResult => {
  const text = (input || '').trim();
  const compact = stripWhitespace(text);
  const hints = MODE_HINTS[options.mode];

  if (compact.length === 0) {
    return { ok: false, hint: hints.tooShort, suggestions: hints.suggestions };
  }
  if (compact.length < MIN_LENGTH) {
    return { ok: false, hint: hints.tooShort, suggestions: hints.suggestions };
  }
  if (text.length > MAX_LENGTH) {
    return { ok: false, hint: hints.tooLong };
  }

  if (URL_ONLY.test(text)) {
    return { ok: false, hint: hints.urlOnly, suggestions: hints.suggestions };
  }
  if (ONLY_DIGITS.test(text)) {
    return { ok: false, hint: hints.numeric, suggestions: hints.suggestions };
  }
  if (ONLY_EMOJI.test(text)) {
    return { ok: false, hint: hints.emoji, suggestions: hints.suggestions };
  }
  if (ONLY_PUNCT.test(text)) {
    return { ok: false, hint: hints.punct, suggestions: hints.suggestions };
  }

  return { ok: true };
};
