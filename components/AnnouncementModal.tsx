import React, { useEffect, useRef } from 'react';
import { ArrowRight, X } from 'lucide-react';
import type { Announcement } from '../data/announcement';

interface AnnouncementModalProps {
  open: boolean;
  announcement: Announcement;
  /** Called by Esc, the X button, the backdrop, and "稍后再看". */
  onDismiss: () => void;
  /** Optional CTA handler. App wires this to the router so links stay SPA. */
  onCta?: () => void;
}

/**
 * Welcome / announcement modal with a museum-invitation aesthetic.
 *
 * Composition cues lifted from the rest of the site so it feels like part of
 * the same publication rather than a generic dialog:
 *   - Hairline gradient + tiny gold seal at the top (echoing the nav logo dot).
 *   - mono uppercase eyebrow → Playfair headline → hand-drawn wavy underline
 *     (the same SVG curve used under "Dialectic" on the hero).
 *   - Italic serif body, then a centered short divider.
 *   - Primary CTA in the museum-900 pill (matches the hero submit button);
 *     secondary "later" link in mono, deferential.
 */
const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  open,
  announcement,
  onDismiss,
  onCta,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Esc to dismiss.
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onDismiss]);

  // Pull initial focus into the dialog so screen readers announce it.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const { eyebrow, title, body, cta } = announcement;

  const handleCta = () => {
    if (onCta) onCta();
    else onDismiss();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-museum-900/45 px-4 py-8 backdrop-blur-md animate-fade-in"
      onClick={onDismiss}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="announcement-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-lg overflow-hidden rounded-[1.25rem] border border-museum-200/80 bg-museum-50 px-7 py-10 shadow-[0_30px_80px_-20px_rgba(40,30,15,0.55)] focus:outline-none animate-fade-in sm:px-12 sm:py-14"
      >
        {/* Top hairline ornament — same gradient grammar as ActiveRunBanner. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-museum-300/70 to-transparent"
        />
        {/* Tiny gold seal in the top-left corner, matching the nav logo dot. */}
        <span
          aria-hidden="true"
          className="absolute left-6 top-6 h-2.5 w-2.5 rounded-full bg-[#C5A059] shadow-[0_0_0_4px_rgba(197,160,89,0.18)] sm:left-8 sm:top-8"
        />
        {/* Mirrored seal on the bottom-right for visual balance. */}
        <span
          aria-hidden="true"
          className="absolute bottom-6 right-6 h-1.5 w-1.5 rounded-full bg-museum-300 sm:bottom-8 sm:right-8"
        />

        <button
          type="button"
          onClick={onDismiss}
          aria-label="关闭公告"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-museum-400 transition-colors hover:bg-museum-100 hover:text-museum-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/50"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-center">
          {eyebrow && (
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-museum-500">
              {eyebrow}
            </p>
          )}

          <h2
            id="announcement-title"
            className="relative mt-4 inline-block font-serif text-3xl leading-[1.1] text-museum-900 sm:text-4xl"
          >
            {title}
            {/* The same hand-drawn wavy underline used under "Dialectic" on the hero. */}
            <svg
              className="absolute -bottom-2 -left-[5%] h-2 w-[110%] text-museum-300/70 sm:-bottom-3 sm:h-3"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
            </svg>
          </h2>

          <p className="mx-auto mt-7 max-w-md font-serif text-[15px] font-light leading-loose tracking-wide text-museum-700 sm:text-base">
            {body}
          </p>

          <div aria-hidden="true" className="mx-auto mt-8 h-px w-10 bg-museum-300/80" />

          <div className="mt-9 flex flex-col-reverse items-stretch justify-center gap-2.5 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={onDismiss}
              className="inline-flex items-center justify-center rounded-full border border-museum-300/90 bg-white/60 px-7 py-3 font-serif text-sm text-museum-700 transition-colors hover:border-museum-500 hover:bg-white hover:text-museum-900"
            >
              稍后再看
            </button>
            {cta && (
              <button
                type="button"
                onClick={handleCta}
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-museum-900 px-7 py-3 font-serif text-sm text-museum-50 shadow-[0_8px_24px_-10px_rgba(40,30,15,0.55)] transition-all hover:bg-black hover:shadow-[0_12px_32px_-10px_rgba(40,30,15,0.7)]"
              >
                {cta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementModal;
