import React, { Suspense, lazy, useEffect, useState } from 'react';

const BackgroundScene = lazy(() => import('./BackgroundScene'));

interface DynamicBackgroundProps {
  showFrontOcclusion?: boolean;
}

// Pure-CSS background — always rendered first so the user sees the museum atmosphere even if
// the three.js chunk is still loading (or fails to load on a flaky network).
const CssBackground: React.FC = () => (
  <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(147,51,234,0.12),transparent_28%),radial-gradient(circle_at_85%_10%,rgba(197,160,89,0.16),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.86),rgba(242,240,235,0.72))]" />
);

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ showFrontOcclusion = false }) => {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  // Defer mounting the R3F scene until the browser is idle so the first paint isn't blocked
  // by parsing the three.js chunk. The CSS background is visible the whole time.
  const [enableScene, setEnableScene] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 768);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (isMobile) return;
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
  }, [isMobile]);

  return (
    <>
      <CssBackground />
      {!isMobile && enableScene && (
        <Suspense fallback={null}>
          <BackgroundScene showFrontOcclusion={showFrontOcclusion} />
        </Suspense>
      )}
    </>
  );
};

export default DynamicBackground;
