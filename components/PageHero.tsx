import React from 'react';

interface HangingLabelProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
}

export const HangingLabel: React.FC<HangingLabelProps> = ({
  children,
  icon,
  ariaLabel,
  className = '',
}) => (
  <div className={`relative mx-auto flex w-full justify-center ${className}`}>
    <span
      aria-hidden="true"
      className="absolute left-1/2 top-[-4.5rem] h-[8.5rem] w-px -translate-x-1/2 bg-museum-300/80 md:top-[-7rem] md:h-[10rem]"
    />
    <div
      className="notranslate relative z-10 mt-10 inline-flex h-8 max-w-[calc(100vw-2rem)] select-none items-center justify-center rounded-full border border-museum-300/80 bg-museum-50/90 px-4 shadow-sm backdrop-blur-md md:mt-12"
      translate="no"
      aria-label={ariaLabel}
    >
      {icon && <span className="mr-2 inline-flex h-3.5 w-3.5 items-center justify-center text-museum-600">{icon}</span>}
      <span className="min-w-0 truncate whitespace-nowrap text-[10px] font-mono uppercase leading-none tracking-[0.18em] text-museum-700 md:text-xs md:tracking-[0.2em]">
        {children}
      </span>
    </div>
  </div>
);

interface PageHeroProps {
  eyebrow: string;
  accent: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  descriptionClassName?: string;
}

const defaultDescriptionClassName = 'mx-auto mt-6 max-w-2xl px-2 text-sm leading-relaxed text-museum-700 md:mt-8 md:text-base';

export const PageHero: React.FC<PageHeroProps> = ({
  eyebrow,
  accent,
  icon,
  description,
  className = '',
  descriptionClassName = defaultDescriptionClassName,
}) => (
  <div className={`relative mx-auto max-w-4xl py-7 text-center md:py-14 ${className}`}>
    <HangingLabel icon={icon} ariaLabel={eyebrow}>{eyebrow}</HangingLabel>
    <h1 className="mt-5 font-serif text-4xl leading-[0.92] tracking-tight text-museum-900 drop-shadow-sm sm:text-7xl md:mt-8 md:text-8xl">
      Sophia's<br />
      <span className="relative inline-block italic">
        {accent}
        <svg
          className="absolute -bottom-1 -left-[5%] h-2 w-[110%] text-museum-300/50 md:-bottom-2 md:h-4"
          viewBox="0 0 100 10"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0 5 Q 50 12 100 5" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </span>
    </h1>
    {description && <p className={descriptionClassName}>{description}</p>}
  </div>
);
