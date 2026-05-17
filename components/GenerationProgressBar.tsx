import React, { useEffect, useState } from 'react';
import type { ActiveAnalysisRun } from '../types/storage';
import type { GenerationProgress } from '../types/pipeline';

interface GenerationProgressBarProps {
  activeRun: ActiveAnalysisRun | null;
}

// Stage weights chosen so the bar feels like it's moving the whole time:
// outline + route together claim the first third, voices the big middle (55%
// of the bar), synthesis the last 10%. Within voices, streamedChars pushes
// the bar inside each voice's slice so it keeps creeping forward between
// voice completions — that's where most of the wall-clock time lives.
const STAGE_FLOOR: Record<GenerationProgress['stage'], number> = {
  idle: 0,
  outline: 0,
  route: 15,
  voices: 35,
  synthesis: 90,
  done: 100,
  error: 100,
};
const STAGE_CEIL: Record<GenerationProgress['stage'], number> = {
  idle: 0,
  outline: 15,
  route: 35,
  voices: 90,
  synthesis: 99,
  done: 100,
  error: 100,
};
// Stage boundaries used as visual chapter markers (matches STAGE_CEIL for
// outline/route/voices/synthesis). Drawn as faint hairlines on the track so
// the bar reads as "thought unfolds in four movements" instead of a single
// undifferentiated fill.
const CHAPTER_MARKS = [15, 35, 90] as const;

const ESTIMATED_VOICE_CHARS = 1500;

function computeProgressPercent(progress?: GenerationProgress): number {
  if (!progress) return 0;
  const { stage, totalVoices, completedVoices, streamedChars } = progress;
  const floor = STAGE_FLOOR[stage] ?? 0;
  const ceil  = STAGE_CEIL[stage]  ?? 0;
  if (stage === 'voices' && totalVoices > 0) {
    const slice = (ceil - floor) / totalVoices;
    const completedSlice = completedVoices * slice;
    const charsRatio = streamedChars ? Math.min(streamedChars / ESTIMATED_VOICE_CHARS, 0.92) : 0;
    return floor + completedSlice + slice * charsRatio;
  }
  if (stage === 'outline' || stage === 'route' || stage === 'synthesis') {
    return (floor + ceil) / 2;
  }
  return ceil;
}

const GenerationProgressBar: React.FC<GenerationProgressBarProps> = ({ activeRun }) => {
  const status = activeRun?.status;
  const isActive = status === 'starting' || status === 'running';

  const [visible, setVisible] = useState(false);
  const [percent, setPercent] = useState(0);

  useEffect(() => {
    if (isActive) {
      setVisible(true);
      setPercent(computeProgressPercent(activeRun?.progress));
      return;
    }
    if (status === 'completed') {
      setPercent(100);
      const t = setTimeout(() => setVisible(false), 800);
      return () => clearTimeout(t);
    }
    if (status === 'error' || status === 'cancelled') {
      const t = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [isActive, status, activeRun?.progress]);

  if (!visible) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-0 z-40 h-[3px] bg-museum-200/40 transition-opacity duration-500 ${isActive ? 'opacity-95' : 'opacity-0'}`}
      role="progressbar"
      aria-label="生成进度"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      {/* Faint chapter-boundary hairlines on the track (outline → route → voices → synthesis) */}
      {CHAPTER_MARKS.map((position) => (
        <span
          key={position}
          aria-hidden="true"
          className="absolute top-0 h-full w-px bg-museum-500/35"
          style={{ left: `${position}%` }}
        />
      ))}

      <div
        className="relative h-full overflow-hidden bg-gradient-to-r from-museum-900 via-museum-900 to-museum-700 transition-[width] duration-700 ease-out"
        style={{ width: `${Math.max(0.5, Math.min(percent, 100))}%` }}
      >
        {/* Continuous shimmer so the bar reads as moving even when width is momentarily steady */}
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 block h-full w-[28%] bg-gradient-to-r from-transparent via-white/30 to-transparent animate-progress-shimmer motion-reduce:hidden"
        />
        {/* A barely-there inner top highlight so the fill has a sense of depth at 3px */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25" />
      </div>
    </div>
  );
};

export default GenerationProgressBar;
