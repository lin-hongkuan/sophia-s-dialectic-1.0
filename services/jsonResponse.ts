/**
 * Robust JSON extraction from LLM `message.content` strings.
 *
 * Even when we ask for `response_format: { type: 'json_object' }`, providers
 * sometimes return "JSON" wrapped in markdown decorations. We've seen at
 * least these patterns in the wild (Grok and a few open-weight stacks are
 * the worst offenders):
 *
 *     ```json
 *     { ... }
 *     ```
 *
 *     **{ "philosophical_title": ... }**            ← real bug report
 *
 *     Here is the JSON you asked for:
 *     { ... }
 *     Note: I made one assumption ...
 *
 * The previous parsers only handled fenced code blocks, so any of the
 * other variants surfaced as `Unexpected token '*'` at JSON.parse time and
 * aborted whichever pipeline stage triggered the call.
 *
 * Strategy:
 *   1. Try `JSON.parse` directly — most calls are clean and we don't want
 *      to pay regex cost on the happy path.
 *   2. On failure, strip markdown decorations and find the first balanced
 *      object/array by walking the string (respecting string literals and
 *      escapes), then parse that slice.
 *   3. If everything fails, throw an error that includes a preview of the
 *      offending content so the surrounding stage's log entry is useful.
 */

/**
 * Thrown when the model's `message.content` can't be parsed as JSON, even
 * after stripping markdown decorations and walking for a balanced structure.
 * Callers can `instanceof` this to distinguish "the model misbehaved" from
 * "the network failed" and retry with a stricter prompt rather than aborting
 * the whole pipeline.
 */
export class ModelJsonParseError extends Error {
  readonly preview: string;
  constructor(message: string, preview: string) {
    super(message);
    this.name = 'ModelJsonParseError';
    this.preview = preview;
  }
}

export const parseModelJson = <T>(content: string): T => {
  if (typeof content !== 'string' || content.length === 0) {
    throw new ModelJsonParseError('模型返回内容为空。', '');
  }

  const trimmed = content.trim();

  // Fast path — clean JSON with no decoration.
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // fall through to recovery
  }

  const candidate = extractJsonCandidate(trimmed);
  if (candidate !== null) {
    try {
      return JSON.parse(candidate) as T;
    } catch (error) {
      const preview = previewOf(candidate);
      throw new ModelJsonParseError(
        `无法解析模型返回的 JSON（${(error as Error).message}）。候选片段：${preview}`,
        preview,
      );
    }
  }

  const preview = previewOf(trimmed);
  throw new ModelJsonParseError(`模型返回的内容不像 JSON：${preview}`, preview);
};

/**
 * Best-effort wrapper for code paths that prefer to swallow parse failures
 * (e.g. the topic-reframe call, where a missing JSON just means "skip
 * reframing"). Returns null instead of throwing.
 */
export const tryParseModelJson = <T>(content: string): T | null => {
  try {
    return parseModelJson<T>(content);
  } catch {
    return null;
  }
};

const previewOf = (text: string): string => (
  text.length > 240 ? `${text.slice(0, 240)}…` : text
);

/**
 * Extract the first balanced JSON object/array embedded in a polluted string.
 * Returns null if no `{` or `[` is found, or if the structure is unterminated
 * (e.g. truncated by max_tokens).
 */
const extractJsonCandidate = (input: string): string | null => {
  let s = input;

  // 1. Strip a fenced code block if one wraps the payload. The lazy `*?`
  //    ensures we pick the first complete fence rather than spanning two.
  const fenceMatch = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    s = fenceMatch[1].trim();
  }

  // 2. Trim leading/trailing markdown decorations: bold (**, __), italics
  //    (*, _), backticks (`), tildes (~), and whitespace. We don't touch the
  //    interior — the walker below handles strings correctly, so a `*` that
  //    happens to be inside a JSON string value is preserved.
  s = s.replace(/^[*_~`\s]+/, '').replace(/[*_~`\s]+$/, '');

  // 3. Find the first `{` or `[` — the start of the JSON structure.
  //    Anything before it is leading prose ("Here is the JSON:").
  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  let start = -1;
  if (firstObj >= 0 && firstArr >= 0) {
    start = Math.min(firstObj, firstArr);
  } else if (firstObj >= 0) {
    start = firstObj;
  } else if (firstArr >= 0) {
    start = firstArr;
  } else {
    return null;
  }

  // 4. Walk forward, respecting string literals and escape sequences, until
  //    the outermost structure closes. Anything after the closing brace is
  //    trailing prose we discard.
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === open) {
      depth += 1;
    } else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        return s.slice(start, i + 1);
      }
    }
  }

  // Unterminated structure — likely cut off by max_tokens or a network
  // truncation. Surface as null so the caller gets a clean error message.
  return null;
};
