import { getActiveConfig } from './sophiaConfig';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

interface FetchWithRetryOptions {
  timeoutMs?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
  label?: string;
}

export const requestHeaders = () => {
  const cfg = getActiveConfig();
  return {
    'Content-Type': 'application/json',
    ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
  };
};

export const chatEndpoint = () => `${getActiveConfig().apiBaseUrl}/chat/completions`;
export const imageEndpoint = () => `${getActiveConfig().apiBaseUrl}/images/generations`;

const isTransientStatus = (status: number) => status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;

const wait = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal?.aborted) {
    reject(new DOMException('aborted by caller', 'AbortError'));
    return;
  }
  const timeoutId = setTimeout(() => {
    signal?.removeEventListener('abort', onAbort);
    resolve();
  }, ms);
  const onAbort = () => {
    clearTimeout(timeoutId);
    reject(new DOMException('aborted by caller', 'AbortError'));
  };
  signal?.addEventListener('abort', onAbort, { once: true });
});

const isRetryableNetworkError = (error: unknown): boolean => {
  if (!error) return false;
  if (error instanceof Error) {
    if (error.name === 'AbortError') return true;
    if (error.name === 'TypeError') return true;
    if (/network|failed to fetch|load failed|fetch failed/i.test(error.message || '')) return true;
  }
  return false;
};

const computeBackoffMs = (attempt: number) => {
  const base = 800 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 400);
  return Math.min(base + jitter, 8000);
};

export const fetchWithRetry = async (
  input: RequestInfo,
  init: RequestInit = {},
  { timeoutMs = 60000, maxAttempts = 4, signal, label = 'sophia-fetch' }: FetchWithRetryOptions = {},
): Promise<Response> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) throw new DOMException('aborted by caller', 'AbortError');

    const controller = new AbortController();
    const onCallerAbort = () => controller.abort(signal?.reason);
    if (signal) signal.addEventListener('abort', onCallerAbort, { once: true });
    let timedOut = false;
    const timeoutId = setTimeout(
      () => {
        timedOut = true;
        controller.abort(new DOMException(`timeout after ${timeoutMs}ms`, 'AbortError'));
      },
      timeoutMs,
    );

    const startedAt = Date.now();
    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onCallerAbort);

      if (response.ok) return response;
      const isLastAttempt = attempt === maxAttempts - 1;
      if (!isTransientStatus(response.status) || isLastAttempt) return response;

      try { await response.text(); } catch { /* body may already be closed */ }
      const backoff = computeBackoffMs(attempt);
      console.warn(`[sophia][${label}] transient HTTP ${response.status} on attempt ${attempt + 1}/${maxAttempts}, retrying in ${backoff}ms`);
      await wait(backoff, signal);
    } catch (error) {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onCallerAbort);
      lastError = error;
      const isLastAttempt = attempt === maxAttempts - 1;
      const retryable = timedOut || isRetryableNetworkError(error);
      if (signal?.aborted || !retryable || isLastAttempt) throw error;
      const backoff = computeBackoffMs(attempt);
      const elapsed = Date.now() - startedAt;
      const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      console.warn(`[sophia][${label}] network error on attempt ${attempt + 1}/${maxAttempts} after ${elapsed}ms (${reason}), retrying in ${backoff}ms`);
      await wait(backoff, signal);
    }
  }
  throw lastError ?? new Error(`[sophia][${label}] retries exhausted`);
};

export const apiErrorMessage = async (response: Response) => {
  const cfg = getActiveConfig();
  const errorData = await response.json().catch(() => ({}));
  const upstream = errorData?.error?.message || errorData?.message || '';
  const code = errorData?.error?.code || '';
  const type = errorData?.error?.type || '';
  const status = response.status;
  const isGatewayBadStatus = code === 'bad_response_status_code' || type === 'bad_response_status_code';

  let summary = '';
  if (isGatewayBadStatus) {
    summary = `${cfg.apiProvider} 网关返回了异常响应，通常是上游模型服务或流式通道波动。已自动重试仍失败，可以稍后再试，或在设置页切换 provider。`;
  } else if (status === 401) {
    summary = 'API key 无效或已过期，请到设置页检查 / 更换 key。';
  } else if (status === 403) {
    summary = '当前 key 无权访问该模型，可能是账号未开通或被限制。';
  } else if (status === 404) {
    summary = '模型名错误或服务未上线。请到设置页检查 model 字段是否拼写正确。';
  } else if (status === 408) {
    summary = '上游响应超时，已自动重试仍失败。请稍后再试。';
  } else if (status === 429) {
    summary = '触发了配额或限流。请稍后重试或更换一个限额更高的 key / 模型。';
  } else if (status >= 500 && status < 600) {
    summary = '上游服务波动，已自动重试仍失败。可以稍后再试，或在设置页换一个 provider。';
  } else if (status >= 400 && status < 500) {
    summary = `请求被 ${cfg.apiProvider} 拒绝（${status}）。请检查请求参数或更换模型。`;
  } else {
    summary = `${cfg.apiProvider} API 请求失败（HTTP ${status}）。`;
  }

  const trail: string[] = [];
  if (upstream) trail.push(upstream);
  if (code && code !== upstream) trail.push(`code=${code}`);
  if (type && type !== code && type !== upstream) trail.push(`type=${type}`);
  return trail.length > 0 ? `${summary}（${trail.join(' · ')}）` : summary;
};
