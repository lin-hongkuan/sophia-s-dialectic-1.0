import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eraser } from 'lucide-react';
import { pickRandomArtifact, RUBBING_VIEWBOX, RubbingArtifact } from '../services/rubbingArtifacts';

interface RubbingGameProps {
  /** panel = full size for generation page; compact = small embed. */
  variant?: 'panel' | 'compact';
}

const DIM = { panel: 320, compact: 220 };
const BRUSH_RADIUS = { panel: 26, compact: 18 };
const REVEAL_THRESHOLD = 0.62; // auto-finish at this fraction transparent
const SAMPLE_STEP = 32; // sample 1 of every 8 pixels (4 channels * 8)

// Rebuild the stone-texture overlay on the canvas.
const paintStoneTexture = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.globalCompositeOperation = 'source-over';
  // Warm taupe base; subtle vertical gradient to read as carved stone.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#B0A492');
  grad.addColorStop(1, '#988C78');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Add per-pixel noise for paper/stone grain.
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 36;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
};

// Sample roughly 1/8 of pixels and return the fraction whose alpha is near 0.
const sampleRevealedFraction = (canvas: HTMLCanvasElement): number => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  try {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    let total = 0;
    let cleared = 0;
    for (let i = 3; i < d.length; i += SAMPLE_STEP) {
      total++;
      if (d[i] < 24) cleared++;
    }
    return total > 0 ? cleared / total : 0;
  } catch {
    return 0;
  }
};

const RubbingGame: React.FC<RubbingGameProps> = ({ variant = 'panel' }) => {
  const dim = DIM[variant];
  const brush = BRUSH_RADIUS[variant];

  const [artifact, setArtifact] = useState<RubbingArtifact>(() => pickRandomArtifact());
  const [round, setRound] = useState(1);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastSampleRef = useRef(0);

  // (Re)paint the texture whenever a new artifact is loaded or size changes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.width = dim;
    c.height = dim;
    paintStoneTexture(c);
    setRevealed(0);
    setDone(false);
    drawingRef.current = false;
    lastSampleRef.current = 0;
  }, [artifact.id, dim]);

  const erase = useCallback(
    (x: number, y: number) => {
      if (done) return;
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.globalCompositeOperation = 'destination-out';
      const g = ctx.createRadialGradient(x, y, 0, x, y, brush);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, brush, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';

      const now = performance.now();
      if (now - lastSampleRef.current > 140) {
        lastSampleRef.current = now;
        const pct = sampleRevealedFraction(c);
        setRevealed(pct);
        if (pct >= REVEAL_THRESHOLD) {
          setDone(true);
          // wipe remaining texture so the artwork is fully readable
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.globalCompositeOperation = 'source-over';
        }
      }
    },
    [brush, done],
  );

  const localCoord = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * dim,
      y: ((e.clientY - rect.top) / rect.height) * dim,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done) return;
    drawingRef.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const { x, y } = localCoord(e);
    erase(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const { x, y } = localCoord(e);
    erase(x, y);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const next = () => {
    setArtifact((current) => pickRandomArtifact(current.id));
    setRound((r) => r + 1);
  };

  const reset = () => {
    const c = canvasRef.current;
    if (!c) return;
    paintStoneTexture(c);
    setRevealed(0);
    setDone(false);
  };

  const percentLabel = useMemo(() => {
    if (done) return '100%';
    return `${Math.min(99, Math.round(revealed * 100))}%`;
  }, [done, revealed]);

  const hint = useMemo(() => {
    if (done) return '展品已浮现，可继续下一件';
    if (revealed > 0.2) return '继续涂抹，浮现更多线条';
    if (revealed > 0) return '保持按住，把石面磨开';
    return '按住并拖动鼠标 / 手指，做一片拓本';
  }, [done, revealed]);

  return (
    <div className="flex flex-col items-center w-full">
      <div className="flex items-baseline justify-between w-full mb-3" style={{ maxWidth: dim }}>
        <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500">
          Rubbing N° {String(round).padStart(2, '0')}
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400">
          {percentLabel}
        </span>
      </div>

      <div
        className="relative shadow-sm border border-museum-200 select-none"
        style={{ width: dim, height: dim }}
      >
        {/* parchment + line art beneath */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #F4F0E6 0%, #ECE3D1 60%, #E2D7C0 100%)',
          }}
          aria-hidden
        >
          <svg
            viewBox={RUBBING_VIEWBOX}
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
            style={{ padding: '8%' }}
          >
            <path d={artifact.path} fill="#3C342A" />
          </svg>
        </div>

        {/* canvas overlay (the rubbing stone) */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ease-out touch-none ${
            done ? 'opacity-0 pointer-events-none' : 'opacity-100 cursor-crosshair'
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerUp}
          aria-label="按住并拖动以涂抹拓本"
        />
      </div>

      {/* placard */}
      <div
        className="mt-4 text-center"
        style={{ maxWidth: dim, minHeight: variant === 'compact' ? 70 : 88 }}
      >
        <p
          className={`font-serif italic text-museum-900 transition-opacity duration-700 ${
            variant === 'compact' ? 'text-base' : 'text-lg'
          } ${done ? 'opacity-100' : 'opacity-30'}`}
        >
          {done ? artifact.title : '———'}
        </p>
        <p
          className={`mt-1 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500 transition-opacity duration-700 ${
            done ? 'opacity-100' : 'opacity-30'
          }`}
        >
          {done ? artifact.era : ' '}
        </p>
        {variant === 'panel' && (
          <p
            className={`mt-2 text-xs leading-relaxed text-museum-600 transition-opacity duration-700 ${
              done ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {artifact.blurb}
          </p>
        )}
      </div>

      {/* controls */}
      <div className="mt-4 flex items-center gap-5">
        <button
          type="button"
          onClick={reset}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500 hover:text-museum-900 transition-colors"
        >
          <Eraser className="w-3 h-3" />
          重新覆盖
        </button>
        <button
          type="button"
          onClick={next}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-700 hover:text-museum-900 transition-colors"
        >
          下一件
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <p className="mt-3 text-[10px] text-museum-400 text-center max-w-xs">{hint}</p>

      <p className="mt-2 text-[9px] text-museum-300 text-center font-mono tracking-wider">
        Silhouettes by{' '}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline hover:text-museum-500"
        >
          game-icons.net
        </a>
        {' '}·{' '}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:underline hover:text-museum-500"
        >
          CC BY 3.0
        </a>
      </p>
    </div>
  );
};

export default RubbingGame;
