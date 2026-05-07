import React, { Suspense, lazy, useEffect, useState } from 'react';

const BackgroundScene = lazy(() => import('./BackgroundScene'));

interface DynamicBackgroundProps {
  showFrontOcclusion?: boolean;
}

const prefersReducedMotion = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
};

// Pure-CSS background — always rendered first so the user sees the museum atmosphere even if
// the three.js chunk is still loading (or fails to load on a flaky network).
const CssBackground: React.FC = () => (
  <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(147,51,234,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(197,160,89,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(242,240,235,0.72))]" />
);

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ showFrontOcclusion = false }) => {
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);
  const [webGlAvailable, setWebGlAvailable] = useState(true);
  // Defer mounting the R3F scene until the browser is idle so the first paint isn't blocked
  // by parsing the three.js chunk. The CSS background is visible the whole time.
  const [enableScene, setEnableScene] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setEnableScene(false);
    if (reduceMotion || !webGlAvailable) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    if (typeof w.requestIdleCallback === 'function') {
      idleHandle = w.requestIdleCallback(() => setEnableScene(true), { timeout: 1500 });
    } else {
      timeoutHandle = window.setTimeout(() => setEnableScene(true), 250);
    }
    return () => {
      if (idleHandle !== null && typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    };
  }, [reduceMotion, webGlAvailable]);

  return (
    <>
      <CssBackground />
      {enableScene && (
        <Suspense fallback={null}>
          <BackgroundScene
            showFrontOcclusion={showFrontOcclusion}
            onUnavailable={() => {
              setWebGlAvailable(false);
              setEnableScene(false);
            }}
          />
        </Suspense>
      )}
    </>
  );
};

export default DynamicBackground;
