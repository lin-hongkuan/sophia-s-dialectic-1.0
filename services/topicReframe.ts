/**
 * Light LLM call that decides whether the user's raw input needs to be reframed
 * into a philosophical question before we kick off the full analysis pipeline.
 *
 * Returns up to 3 candidate titles + a short rationale; the App layer shows them
 * in TopicReframeDialog so the user can choose one (or keep their original text).
 *
 * Kept deliberately small: ~600 max_tokens, single non-streaming JSON call.
 */

import { getActiveConfig } from './sophiaConfig';
import { resolveTopicReframeSystemPrompt } from './prompts';
import { buildUsage, recordUsage } from './tokenAccounting';

export interface ReframeCandidate {
  title: string;
  rationale: string;
}

export interface TopicReframeResult {
  shouldReframe: boolean;
  candidates: ReframeCandidate[];
}

const EMPTY: TopicReframeResult = { shouldReframe: false, candidates: [] };

const parseJsonContent = <T>(content: string): T => {
  let body = content.trim();
  if (body.startsWith('```')) {
    const match = body.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) body = match[1].trim();
  }
  return JSON.parse(body) as T;
};

const sanitizeCandidates = (raw: unknown): ReframeCandidate[] => {
  if (!Array.isArray(raw)) return [];
  const out: ReframeCandidate[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<ReframeCandidate>;
    const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
    const rationale = typeof candidate.rationale === 'string' ? candidate.rationale.trim() : '';
    if (!title) continue;
    out.push({ title, rationale });
    if (out.length >= 3) break;
  }
  return out;
};

/**
 * Runs the topic-reframe classifier. Network or parse failures are swallowed and
 * surfaced as `shouldReframe: false` — the caller proceeds with the original text.
 */
export const reframeUserTopic = async (rawTopic: string): Promise<TopicReframeResult> => {
  const trimmed = rawTopic.trim();
  if (!trimmed) return EMPTY;

  const cfg = getActiveConfig();
  const endpoint = `${cfg.apiBaseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('topic-reframe timeout', 'AbortError')), 30000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: cfg.apiModel,
        temperature: 0.4,
        max_tokens: 700,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: resolveTopicReframeSystemPrompt(cfg.promptOverrides) },
          { role: 'user', content: `用户输入：${trimmed}` },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // eslint-disable-next-line no-console
      console.warn('[sophia][topic-reframe] non-OK response, skipping reframe', response.status);
      return EMPTY;
    }

    const data = await response.json().catch(async () => {
      const text = await response.clone().text();
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try { return JSON.parse(payload); } catch { /* continue */ }
      }
      return null;
    });
    const usage = buildUsage(data?.usage, 'reframe', cfg.apiModel);
    if (usage) recordUsage(usage);

    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return EMPTY;

    const parsed = parseJsonContent<{ shouldReframe?: boolean; candidates?: unknown }>(content);
    const candidates = sanitizeCandidates(parsed.candidates);
    const shouldReframe = parsed.shouldReframe === true && candidates.length > 0;
    return { shouldReframe, candidates };
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[sophia][topic-reframe] failed, skipping reframe:', error);
    return EMPTY;
  } finally {
    clearTimeout(timeout);
  }
};
