export interface VoiceStreamThrottle {
  schedule: (voiceId: string, fullText: string) => void;
  flush: (voiceId: string) => void;
  clearOne: (voiceId: string) => void;
  clearAll: () => void;
}

export const createVoiceStreamThrottle = (
  applyVoiceText: (voiceId: string, fullText: string) => void,
): VoiceStreamThrottle => {
  const pending = new Map<string, string>();
  const timers = new Map<string, number>();

  const clearOne = (voiceId: string) => {
    const timer = timers.get(voiceId);
    if (timer) window.clearTimeout(timer);
    timers.delete(voiceId);
    pending.delete(voiceId);
  };

  const flush = (voiceId: string) => {
    const fullText = pending.get(voiceId);
    clearOne(voiceId);
    if (fullText !== undefined) applyVoiceText(voiceId, fullText);
  };

  const schedule = (voiceId: string, fullText: string) => {
    pending.set(voiceId, fullText);
    if (timers.has(voiceId)) return;
    const timer = window.setTimeout(() => flush(voiceId), 120);
    timers.set(voiceId, timer);
  };

  const clearAll = () => {
    timers.forEach((timer) => window.clearTimeout(timer));
    timers.clear();
    pending.clear();
  };

  return { schedule, flush, clearOne, clearAll };
};
