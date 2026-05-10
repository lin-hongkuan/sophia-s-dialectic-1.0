import { useEffect, useRef, useState } from 'react';
import type { AnalysisResult, Message, ThoughtVoice } from '../types';
import { chatWithVoice } from '../services/sophiaService';
import { clearVoiceChat, loadVoiceChat, saveVoiceChat } from '../services/voiceChatStore';

interface UseVoiceChatSessionOptions {
  open: boolean;
  voice: ThoughtVoice;
  result: AnalysisResult;
}

export const useVoiceChatSession = ({ open, voice, result }: UseVoiceChatSessionOptions) => {
  const [messages, setMessages] = useState<Message[]>(() =>
    open ? loadVoiceChat(result.id, voice.id) : [],
  );
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setMessages(loadVoiceChat(result.id, voice.id));
    setStreamingText('');
    setError(null);
    setInput('');
  }, [open, result.id, voice.id]);

  useEffect(() => {
    if (!open) abortRef.current?.abort();
    return () => abortRef.current?.abort();
  }, [open]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    saveVoiceChat(result.id, voice.id, next);
    setInput('');
    setStreamingText('');
    setError(null);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const reply = await chatWithVoice(
        result,
        voice.id,
        messages,
        trimmed,
        (_delta, fullText) => setStreamingText(fullText),
        controller.signal,
      );
      const assistantMsg: Message = { role: 'assistant', content: reply };
      const finalMessages = [...next, assistantMsg];
      setMessages(finalMessages);
      saveVoiceChat(result.id, voice.id, finalMessages);
      setStreamingText('');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : '回应失败');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsStreaming(false);
    }
  };

  const clearMessages = () => {
    clearVoiceChat(result.id, voice.id);
    setMessages([]);
    setStreamingText('');
    setError(null);
  };

  return {
    messages,
    input,
    setInput,
    isStreaming,
    streamingText,
    error,
    sendMessage,
    clearMessages,
  };
};
