import { useEffect, useRef } from 'react';

/**
 * Toggle `data-revealed="true"` on an element the first time it crosses ~12%
 * into the viewport. Pair with the `.section-reveal` CSS class in `index.css`
 * to fade + slide a section up once it scrolls into view. Already-intersecting
 * elements fire immediately (IntersectionObserver default behavior), so
 * above-the-fold sections still get the reveal once on mount.
 *
 * Honors prefers-reduced-motion by marking the element as revealed immediately
 * and skipping observer setup entirely.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      node.setAttribute('data-revealed', 'true');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return ref;
}
