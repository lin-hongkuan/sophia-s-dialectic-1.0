import React, { Suspense, lazy, useEffect, useState } from 'react';

const BackgroundScene = lazy(() => import('./BackgroundScene'));

interface DynamicBackgroundProps {
  showFrontOcclusion?: boolean;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ showFrontOcclusion = false }) => {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const load = () => {
      if (!cancelled) setShouldLoad(true);
    };
    const idleWindow = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const idleId = idleWindow.requestIdleCallback(load, { timeout: 2000 });
      return () => {
        cancelled = true;
        idleWindow.cancelIdleCallback?.(idleId);
      };
    }
    const timeoutId = window.setTimeout(load, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, []);

  if (!shouldLoad) return null;

  return (
    <Suspense fallback={null}>
      <BackgroundScene showFrontOcclusion={showFrontOcclusion} />
    </Suspense>
  );
};

export default DynamicBackground;
