import { Loader2, RefreshCw } from 'lucide-react';
import type { ThoughtVoice } from '../../types/domain';
import {
  getSymbolicInitialsClassName,
  type SymbolicThoughtVoiceAvatar,
  type ThoughtVoiceAvatar,
} from './avatar';

interface AvatarFallbackProps {
  avatar: SymbolicThoughtVoiceAvatar;
  fallbackMessage: string;
}

export const AvatarFallback = ({ avatar, fallbackMessage }: AvatarFallbackProps) => {
  const label = fallbackMessage ? `${avatar.title} ${fallbackMessage}` : avatar.title;

  return (
    <div
      className="relative w-full h-full overflow-hidden flex items-center justify-center"
      role="img"
      aria-label={label}
      title={label}
      style={{ background: avatar.background, color: avatar.foreground }}
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_32%_24%,rgba(255,255,255,0.88),transparent_34%),radial-gradient(circle_at_72%_78%,rgba(44,42,38,0.12),transparent_35%)]" aria-hidden="true" />
      <span className="absolute inset-[7px] hidden border border-white/65 shadow-[inset_0_0_0_1px_rgba(44,42,38,0.08)] lg:block" aria-hidden="true" />
      <span className="absolute inset-x-7 top-1/2 hidden h-px -translate-y-1/2 bg-museum-900/10 lg:block" aria-hidden="true" />
      <span className="absolute inset-y-7 left-1/2 hidden w-px -translate-x-1/2 bg-museum-900/10 lg:block" aria-hidden="true" />
      <span className="absolute top-3 right-3 hidden font-serif text-xl opacity-35 lg:block xl:text-2xl" aria-hidden="true">{avatar.symbol}</span>
      <span className={`relative z-10 flex max-w-[78%] items-center justify-center text-center font-bold text-museum-900/90 drop-shadow-[0_8px_20px_rgba(44,42,38,0.16)] ${getSymbolicInitialsClassName(avatar.initials)}`} aria-hidden="true">{avatar.initials}</span>
      {!fallbackMessage && (
        <span className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 border border-white/60 bg-white/60 px-2.5 py-1 text-[9px] font-mono uppercase text-museum-800 backdrop-blur-[2px] lg:block" aria-hidden="true">
          {avatar.eraLabel}
        </span>
      )}
    </div>
  );
};

interface VoiceAvatarProps {
  voice: ThoughtVoice;
  avatar: ThoughtVoiceAvatar;
  fallbackMessage: string;
  onImageError: () => void;
  onRegenerateAvatar?: (voiceId: string) => void;
  isRegeneratingAvatar: boolean;
}

export const VoiceAvatar = ({
  voice,
  avatar,
  fallbackMessage,
  onImageError,
  onRegenerateAvatar,
  isRegeneratingAvatar,
}: VoiceAvatarProps) => (
  <div className="relative group/avatar w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 lg:w-full lg:h-[15rem] xl:h-[17rem] overflow-hidden border border-museum-200 bg-museum-100 shrink-0 lg:mb-6 shadow-sm ring-2 ring-white/55 md:ring-4 [contain:layout_paint]">
    {avatar.type === 'generated' ? (
      <img
        src={avatar.src}
        alt={avatar.alt}
        title={avatar.title}
        width={320}
        height={408}
        loading="lazy"
        decoding="async"
        onError={onImageError}
        className="w-full h-full object-cover [filter:saturate(0.86)_contrast(0.95)]"
      />
    ) : avatar.type === 'portrait' ? (
      <img
        src={avatar.src}
        alt={avatar.alt}
        title={avatar.title}
        width={320}
        height={408}
        loading="lazy"
        decoding="async"
        onError={onImageError}
        className="w-full h-full object-cover grayscale opacity-90"
      />
    ) : (
      <AvatarFallback avatar={avatar} fallbackMessage={fallbackMessage} />
    )}
    {onRegenerateAvatar && voice.status === 'completed' && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRegenerateAvatar(voice.id); }}
        disabled={isRegeneratingAvatar}
        aria-label={`重新生成 ${voice.name} 的头像`}
        title="重新生成头像"
        className="absolute bottom-1.5 right-1.5 z-10 inline-flex h-7 w-7 items-center justify-center rounded-full border border-museum-200/70 bg-white/55 text-museum-700 opacity-0 backdrop-blur-sm transition-all duration-300 hover:bg-white hover:opacity-100 focus-visible:opacity-100 group-hover/avatar:opacity-45 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isRegeneratingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
      </button>
    )}
  </div>
);
