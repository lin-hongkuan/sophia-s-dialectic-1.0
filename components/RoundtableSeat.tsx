import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { RoundtableParticipant } from '../types';

interface RoundtableSeatProps {
  participant: RoundtableParticipant;
  /** Seat index (0-3). Used for the stable catalog number label. */
  index: number;
  /** True if this seat currently has the floor (streaming or just started). */
  isSpeaking: boolean;
  /** Optional — the participant this seat is responding to right now. */
  replyToName?: string;
  /** True while the avatar image is being (re)generated. */
  isRegeneratingAvatar?: boolean;
  /** Only shown after avatar generation exists; calls hook.regenerateAvatar. */
  onRegenerateAvatar?: (participantId: string) => void;
}

const KIND_LABEL: Record<RoundtableParticipant['kind'], string> = {
  philosopher: '哲学家',
  school: '思想流派',
  position: '现实立场',
  skeptic: '方法论怀疑者',
  moderator: '主持人',
};

const KIND_SYMBOL: Record<RoundtableParticipant['kind'], string> = {
  philosopher: 'ϕ',
  school: '§',
  position: '↔',
  skeptic: '?',
  moderator: '★',
};

const statusCopy = (
  participant: RoundtableParticipant,
  isSpeaking: boolean,
): { label: string; tone: 'queued' | 'seating' | 'present' | 'speaking' | 'silent' | 'failed' } => {
  if (isSpeaking) return { label: '正在发言', tone: 'speaking' };
  switch (participant.status) {
    case 'planned': return { label: '规划完成', tone: 'queued' };
    case 'seating':
      if (participant.avatar?.status === 'generating') return { label: '生成头像中', tone: 'seating' };
      if (participant.avatar?.status === 'failed') return { label: '头像失败', tone: 'failed' };
      return { label: '入席中', tone: 'seating' };
    case 'present': return { label: '已入席', tone: 'present' };
    case 'speaking': return { label: '正在发言', tone: 'speaking' };
    case 'silent': return { label: '已发言', tone: 'silent' };
    case 'failed': return { label: '头像失败', tone: 'failed' };
    default: return { label: '排队中', tone: 'queued' };
  }
};

const TONE_STYLES: Record<ReturnType<typeof statusCopy>['tone'], string> = {
  queued: 'bg-museum-100 text-museum-600 border-museum-200',
  seating: 'bg-museum-50 text-museum-700 border-museum-300',
  present: 'bg-white text-museum-800 border-museum-300',
  speaking: 'bg-museum-900 text-museum-50 border-museum-900',
  silent: 'bg-museum-50 text-museum-500 border-museum-200',
  failed: 'bg-red-50 text-red-700 border-red-200',
};

const initialsOf = (name: string) => {
  const compact = name.replace(/\s+/g, '');
  return Array.from(compact).slice(0, 2).join('') || '∴';
};

const RoundtableSeat: React.FC<RoundtableSeatProps> = ({
  participant,
  index,
  isSpeaking,
  replyToName,
  isRegeneratingAvatar,
  onRegenerateAvatar,
}) => {
  const status = statusCopy(participant, isSpeaking);
  const toneClass = TONE_STYLES[status.tone];
  const avatarUrl = participant.avatar?.imageUrl || '';
  const catalogNo = String(index + 1).padStart(2, '0');
  const showRegenerate = Boolean(onRegenerateAvatar) && participant.status !== 'planned';

  return (
    <div
      className={`group relative flex h-full flex-col gap-3 border bg-white/80 p-4 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(44,42,38,0.04)] backdrop-blur-sm transition-all duration-500 md:gap-4 md:p-5 ${
        isSpeaking
          ? 'border-museum-900 shadow-[0_18px_40px_-12px_rgba(44,42,38,0.22)] -translate-y-0.5'
          : 'border-museum-200 hover:-translate-y-0.5 hover:border-museum-300 hover:shadow-[0_18px_36px_-18px_rgba(44,42,38,0.22)]'
      }`}
      aria-current={isSpeaking || undefined}
    >
      <div className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-museum-300/70 to-transparent md:inset-x-4" />
      {isSpeaking && (
        <span className="absolute -top-2 left-4 inline-flex items-center gap-1.5 rounded-full border border-museum-900 bg-museum-900 px-3 py-0.5 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-50 shadow-sm">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-museum-50" />
          Speaking
        </span>
      )}

      <div className="flex items-start justify-between gap-3">
        <span className="notranslate font-mono text-[10px] uppercase leading-none tracking-[0.22em] text-museum-400" translate="no">
          SEAT {catalogNo}
        </span>
        <span className={`inline-flex items-center gap-1 border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.22em] ${toneClass}`}>
          {status.tone === 'speaking' && <Loader2 className="h-3 w-3 animate-spin" />}
          {status.tone === 'seating' && <Loader2 className="h-3 w-3 animate-spin" />}
          {status.tone === 'present' && <CheckCircle2 className="h-3 w-3" />}
          {status.tone === 'failed' && <AlertCircle className="h-3 w-3" />}
          {status.label}
        </span>
      </div>

      <div className="flex items-start gap-3 md:gap-4">
        <div className="relative h-16 w-14 shrink-0 overflow-hidden rounded-sm border border-museum-200 bg-museum-50 md:h-20 md:w-16">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={participant.avatar?.alt || participant.name}
              className="h-full w-full object-cover [filter:saturate(0.86)_contrast(0.95)]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-museum-600"
              style={{ background: 'linear-gradient(135deg,#F2F0EB,#D1CCC0)' }}
              aria-hidden="true"
            >
              <span className="font-serif text-lg tracking-wider md:text-xl">{initialsOf(participant.name)}</span>
            </div>
          )}
          <span className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/90 font-serif text-[11px] text-museum-700 shadow-sm">
            {KIND_SYMBOL[participant.kind]}
          </span>
          {showRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerateAvatar?.(participant.id)}
              disabled={isRegeneratingAvatar}
              title="重新生成头像"
              aria-label={`重新生成 ${participant.name} 的头像`}
              className="absolute left-1 top-1 inline-flex h-11 w-11 items-center justify-center rounded-full border border-museum-200 bg-white/90 text-museum-500 opacity-100 shadow-sm backdrop-blur-sm transition-opacity duration-300 hover:text-museum-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/60 disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
            >
              <RefreshCw className={`h-4 w-4 ${isRegeneratingAvatar ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="notranslate font-mono text-[9px] uppercase tracking-[0.22em] text-museum-400" translate="no">
            {KIND_LABEL[participant.kind]}
          </p>
          <h4 className={`mt-1 font-serif text-lg leading-tight md:text-xl ${isSpeaking ? 'text-museum-900' : 'text-museum-900'}`}>
            {participant.name}
          </h4>
          {participant.role && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-museum-600 md:text-xs">{participant.role}</p>
          )}
        </div>
      </div>

      {participant.stance && (
        <div className="rounded-sm border-l-2 border-museum-300 bg-museum-50/50 px-3 py-2 text-[12px] leading-relaxed text-museum-700 md:text-[13px]">
          {participant.stance}
        </div>
      )}

      {replyToName && isSpeaking && (
        <p className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-museum-500">
          <span className="h-px w-4 bg-museum-400" />
          回应 {replyToName}
        </p>
      )}
    </div>
  );
};

export default RoundtableSeat;
