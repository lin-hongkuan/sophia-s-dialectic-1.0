import { useCallback, useEffect, useState } from 'react';

/**
 * Returns a callback ref. The first time the attached element crosses ~12%
 * into the viewport, `data-revealed="true"` is set on it. Pair with the
 * `.section-reveal` CSS class in `index.css` to fade + slide the section
 * into view. Already-intersecting elements fire immediately, so
 * above-the-fold sections still get the reveal once on mount.
 *
 * Uses a callback ref (not a static useRef) so sections that mount late —
 * e.g. SynthesisSection appearing only once streaming completes — still
 * get an observer attached when their DOM node finally arrives.
 *
 * Honors prefers-reduced-motion by marking the element as revealed
 * immediately and skipping observer setup entirely.
 */
export function useScrollReveal<T extends HTMLElement = HTMLElement>() {
  const [node, setNode] = useState<T | null>(null);
  const refCallback = useCallback((value: T | null) => setNode(value), []);

  useEffect(() => {
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
  }, [node]);

  return refCallback;
}
