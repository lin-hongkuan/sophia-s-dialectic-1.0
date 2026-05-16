import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Send, Trash2, X } from 'lucide-react';
import type { AnalysisResult, ThoughtVoice } from '../types/domain';
import type { Message } from '../types/chat';
import { useVoiceChatSession } from '../hooks/useVoiceChatSession';

interface VoiceChatModalProps {
  open: boolean;
  voice: ThoughtVoice;
  result: AnalysisResult;
  onClose: () => void;
}

interface MessageBubbleProps {
  role: Message['role'];
  content: string;
  voiceName: string;
  streaming?: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ role, content, voiceName, streaming }) => {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[88%] md:max-w-[78%] px-4 py-3 md:px-5 md:py-4 ${
          isUser
            ? 'bg-museum-900 text-museum-50 border border-museum-900'
            : 'bg-white/85 text-museum-900 border border-museum-200/90 backdrop-blur-sm shadow-sm'
        }`}
      >
        {!isUser && (
          <p className="text-[9px] font-mono uppercase tracking-[0.22em] text-museum-400 mb-1.5">
            {voiceName}
            {streaming ? ' · 正在回应' : ''}
          </p>
        )}
        <p
          className={`whitespace-pre-line leading-relaxed ${
            isUser
              ? 'font-sans text-[15px]'
              : 'font-serif text-[15.5px] md:text-base'
          }`}
        >
          {content}
          {streaming && (
            <span
              className="inline-block w-1.5 h-4 ml-0.5 bg-museum-400 animate-pulse align-middle"
              aria-hidden="true"
            />
          )}
        </p>
      </div>
    </div>
  );
};

const VoiceChatModal: React.FC<VoiceChatModalProps> = ({ open, voice, result, onClose }) => {
  const {
    messages,
    input,
    setInput,
    isStreaming,
    streamingText,
    error,
    sendMessage,
    clearMessages,
  } = useVoiceChatSession({ open, voice, result });
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setClearConfirmOpen(false);
  }, [open, result.id, voice.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (clearConfirmOpen) {
        setClearConfirmOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => textareaRef.current?.focus(), 80);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose, clearConfirmOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = sendMessage;

  const handleClear = () => {
    clearMessages();
    setClearConfirmOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  if (!open) return null;
  const avatarUrl = voice.avatar?.imageUrl;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch md:items-center justify-center bg-museum-900/55 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={`与 ${voice.name} 的对话`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full md:w-[min(720px,92vw)] md:max-h-[88vh] bg-museum-50/95 backdrop-blur-md border-y md:border border-museum-200 shadow-[0_30px_80px_rgba(44,42,38,0.25)] flex flex-col">
        {clearConfirmOpen && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-museum-900/30 px-5 backdrop-blur-[2px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-voice-chat-title"
            aria-describedby="clear-voice-chat-desc"
            onClick={(e) => {
              if (e.target === e.currentTarget) setClearConfirmOpen(false);
            }}
          >
            <div className="w-full max-w-sm border border-museum-300 bg-museum-50/95 p-5 shadow-[0_24px_70px_rgba(44,42,38,0.28)]">
              <p className="mb-2 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500">
                Archive Action
              </p>
              <h3 id="clear-voice-chat-title" className="font-serif text-xl text-museum-900">
                清空与 {voice.name} 的对话？
              </h3>
              <p id="clear-voice-chat-desc" className="mt-3 text-sm leading-relaxed text-museum-600">
                这只会删除本地保存的这段对话记录，不会影响已经生成的分析正文。
              </p>
              <div className="mt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setClearConfirmOpen(false)}
                  className="border border-museum-300 bg-white/60 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-600 transition-colors hover:bg-white hover:text-museum-900"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="inline-flex items-center gap-2 border border-red-900/80 bg-red-900 px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-50 transition-colors hover:bg-red-950"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 清空
                </button>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-start gap-4 p-5 md:p-7 border-b border-museum-200/80 bg-white/60">
          <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 overflow-hidden border border-museum-200 bg-museum-100 ring-2 ring-white/55">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={voice.name}
                className="w-full h-full object-cover [filter:saturate(0.86)_contrast(0.95)]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-serif text-2xl text-museum-700 bg-gradient-to-br from-museum-100 to-museum-200">
                ∴
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500">
              In Conversation With
            </p>
            <h2 className="font-serif text-2xl md:text-3xl text-museum-900 leading-tight truncate">
              {voice.name}
            </h2>
            <p className="text-xs text-museum-500 mt-1 truncate">
              {voice.school || voice.role}
              {voice.oneLine || voice.stance ? ` · ${voice.oneLine || voice.stance}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭对话"
            className="shrink-0 text-museum-500 hover:text-museum-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-5 py-6 md:px-8 md:py-8 space-y-5 bg-gradient-to-b from-white/40 to-museum-50/40"
        >
          {messages.length === 0 && !streamingText && (
            <div className="text-center text-museum-500 text-sm leading-relaxed font-serif italic max-w-md mx-auto py-6">
              直接和 {voice.name} 聊聊。Ta 知道这份分析里自己说过什么、和其他声音的分歧在哪。
              你可以问 Ta 进一步解释、要例子，或者干脆和 Ta 抬杠。
            </div>
          )}
          {messages.map((m, idx) => (
            <MessageBubble
              key={`${idx}-${m.role}`}
              role={m.role}
              content={m.content}
              voiceName={voice.name}
            />
          ))}
          {streamingText && (
            <MessageBubble role="assistant" content={streamingText} voiceName={voice.name} streaming />
          )}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-100 px-4 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-museum-200/80 bg-white/80 backdrop-blur-sm px-5 py-4 md:px-7 md:py-5">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={`和 ${voice.name} 说点什么…（Enter 发送，Shift+Enter 换行）`}
              rows={2}
              disabled={isStreaming}
              className="flex-1 resize-none bg-museum-50/80 border border-museum-200 focus:outline-none focus:ring-2 focus:ring-museum-300 px-4 py-3 font-serif text-base text-museum-900 leading-relaxed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              aria-label="发送"
              className="shrink-0 inline-flex items-center justify-center bg-museum-900 text-museum-50 hover:bg-black disabled:opacity-50 px-4 py-3 transition-colors"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          {messages.length > 0 && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                disabled={isStreaming}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-museum-400 transition-colors hover:text-museum-700 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <Trash2 className="w-3 h-3" /> 清空对话
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceChatModal;
