import React, { useEffect, useState } from 'react';
import { Gavel, HelpCircle, LightbulbIcon, Loader2, Pause, Scale, Send, Swords } from 'lucide-react';
import type { RoundtableInterjectionSeed, RoundtableParticipant } from '../types';

interface RoundtableModeratorBarProps {
  participants: RoundtableParticipant[];
  disabled?: boolean;
  isBusy?: boolean;
  pendingInterjection?: RoundtableInterjectionSeed | null;
  /**
   * Called when the user submits an interjection. Returns a promise the bar
   * can await so the UI knows when the follow-up turn finishes.
   */
  onInterject: (input: RoundtableInterjectionSeed) => void | Promise<void>;
  /** Optional pause button — only rendered when provided. */
  onPause?: () => void;
}

type Action = RoundtableInterjectionSeed['action'];

const ACTION_BUTTONS: Array<{ id: Action; label: string; icon: React.ReactNode; hint: string }> = [
  { id: 'ask', label: '追问', icon: <HelpCircle className="h-3.5 w-3.5" />, hint: '让下一位回答主持人' },
  { id: 'rebut', label: '反驳', icon: <Swords className="h-3.5 w-3.5" />, hint: '让下一位直接反驳上一位' },
  { id: 'example', label: '举例', icon: <LightbulbIcon className="h-3.5 w-3.5" />, hint: '要求现实例子' },
  { id: 'cost', label: '追问代价', icon: <Scale className="h-3.5 w-3.5" />, hint: '让对方说出自身代价' },
  { id: 'close', label: '收束会议', icon: <Gavel className="h-3.5 w-3.5" />, hint: '直接进入主持人纪要' },
];

const RoundtableModeratorBar: React.FC<RoundtableModeratorBarProps> = ({
  participants,
  disabled,
  isBusy,
  pendingInterjection,
  onInterject,
  onPause,
}) => {
  const [content, setContent] = useState('');
  const [action, setAction] = useState<Action>('ask');
  const [target, setTarget] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If the roster changes, reset an invalid target selection.
  useEffect(() => {
    if (target === 'all') return;
    if (!participants.some((p) => p.id === target)) {
      setTarget('all');
    }
  }, [participants, target]);

  const submit = async () => {
    if (disabled || isSubmitting || pendingInterjection) return;
    const trimmed = content.trim();
    if (!trimmed && action !== 'close') return;
    setIsSubmitting(true);
    try {
      await onInterject({
        content: action === 'close' ? (trimmed || '主持人请求直接收束会议。') : trimmed,
        targetParticipantId: target === 'all' ? undefined : target,
        action,
      });
      setContent('');
      if (action !== 'close') setAction('ask');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="sticky bottom-0 z-20 -mx-4 border-t border-museum-300/80 bg-museum-50/95 px-4 py-3 shadow-[0_-10px_30px_-18px_rgba(44,42,38,0.2)] backdrop-blur-md sm:-mx-6 sm:px-6 md:py-4">
      <div className="mx-auto max-w-5xl">
        {/* action row */}
        <div className="mb-2 flex flex-wrap items-center gap-2 md:mb-3">
          <span className="notranslate mr-1 font-mono text-[10px] uppercase tracking-[0.22em] text-museum-500" translate="no">
            Moderator
          </span>
          {ACTION_BUTTONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setAction(item.id)}
              title={item.hint}
              className={`inline-flex min-h-[44px] items-center gap-1.5 border px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.18em] shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/60 ${
                action === item.id
                  ? 'border-museum-900 bg-museum-900 text-museum-50'
                  : 'border-museum-300 bg-white/75 text-museum-700 hover:bg-white'
              }`}
              disabled={disabled || Boolean(pendingInterjection)}
              aria-pressed={action === item.id}
            >
              {item.icon} {item.label}
            </button>
          ))}
        </div>

        {/* target + input row */}
        <div className="flex flex-col gap-2 md:flex-row md:items-stretch md:gap-3">
          <label className="flex shrink-0 items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-500">
            对话对象
            <select
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="min-h-[44px] min-w-[140px] border border-museum-300 bg-white/90 px-2 py-1.5 text-xs font-sans text-museum-800 shadow-sm focus:border-museum-500 focus:outline-none focus:ring-1 focus:ring-museum-300 md:text-sm"
              disabled={disabled || Boolean(pendingInterjection)}
            >
              <option value="all">全体</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>

          <div className="relative flex-1">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                action === 'close'
                  ? '可选：给主持人留一句收束意图；留空会直接请主持人写会议纪要。'
                  : '以主持人身份插话，例如：「把刚才的自由请具体到一个劳动日。」'
              }
              rows={2}
              disabled={disabled || Boolean(pendingInterjection)}
              className="w-full resize-none border border-museum-300 bg-white/90 px-3 py-2 text-sm font-serif leading-relaxed text-museum-900 shadow-sm focus:border-museum-500 focus:outline-none focus:ring-1 focus:ring-museum-300 md:text-base"
            />
            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.2em] text-museum-400">
              {pendingInterjection
                ? `已加入下一轮：${ACTION_BUTTONS.find((item) => item.id === pendingInterjection.action)?.label || '插话'}`
                : isBusy
                  ? '正在发言中，发送后将在本轮结束后进入'
                  : '⌘ / Ctrl + Enter 发送'}
            </p>
          </div>

          <div className="flex shrink-0 gap-2 md:flex-col md:gap-2">
            {onPause && (
              <button
                type="button"
                onClick={onPause}
                disabled={disabled || !isBusy || Boolean(pendingInterjection)}
                title="当前轮结束后暂停"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 border border-museum-300 bg-white/80 px-3 text-[11px] font-mono uppercase tracking-[0.18em] text-museum-600 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 md:flex-none"
              >
                <Pause className="h-3.5 w-3.5" /> 暂停
              </button>
            )}
            <button
              type="button"
              onClick={submit}
              disabled={disabled || isSubmitting || Boolean(pendingInterjection) || (!content.trim() && action !== 'close')}
              aria-label={pendingInterjection ? '插话已加入下一轮' : '发送主持人插话'}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 border border-museum-900 bg-museum-900 px-4 text-xs font-mono uppercase tracking-[0.22em] text-museum-50 shadow-sm transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 md:flex-none"
            >
              {isSubmitting || pendingInterjection ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {pendingInterjection ? '已排队' : isSubmitting ? '提交中' : isBusy ? '加入下一轮' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundtableModeratorBar;
