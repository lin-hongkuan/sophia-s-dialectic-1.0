import { DependencyList, useEffect, useRef } from 'react';

export const useMainFocus = (paused: boolean, dependencies: DependencyList) => {
  const mainRef = useRef<HTMLElement>(null);
  const didInitialRouteFocusRef = useRef(false);

  useEffect(() => {
    if (!didInitialRouteFocusRef.current) {
      didInitialRouteFocusRef.current = true;
      return;
    }
    if (paused) return;
    window.requestAnimationFrame(() => {
      mainRef.current?.focus({ preventScroll: true });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, ...dependencies]);

  return mainRef;
};
