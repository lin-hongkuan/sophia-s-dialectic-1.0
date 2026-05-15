import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import { pickRandomArtifact, RubbingArtifact } from '../services/rubbingArtifacts';

interface RubbingGameProps {
  variant?: 'panel' | 'compact';
}

type TileId =
  | 'r1c1'
  | 'r1c2'
  | 'r1c3'
  | 'r2c1'
  | 'r2c2'
  | 'r2c3'
  | 'r3c1'
  | 'r3c2'
  | 'r3c3';

interface PieceState {
  id: TileId;
  placed: boolean;
}

const TILE_IDS: TileId[] = ['r1c1', 'r1c2', 'r1c3', 'r2c1', 'r2c2', 'r2c3', 'r3c1', 'r3c2', 'r3c3'];

const TILE_LABEL: Record<TileId, string> = {
  r1c1: 'A',
  r1c2: 'B',
  r1c3: 'C',
  r2c1: 'D',
  r2c2: 'E',
  r2c3: 'F',
  r3c1: 'G',
  r3c2: 'H',
  r3c3: 'I',
};

const TILE_VIEWBOX: Record<TileId, string> = {
  r1c1: '0 0 170.6667 170.6667',
  r1c2: '170.6667 0 170.6667 170.6667',
  r1c3: '341.3333 0 170.6667 170.6667',
  r2c1: '0 170.6667 170.6667 170.6667',
  r2c2: '170.6667 170.6667 170.6667 170.6667',
  r2c3: '341.3333 170.6667 170.6667 170.6667',
  r3c1: '0 341.3333 170.6667 170.6667',
  r3c2: '170.6667 341.3333 170.6667 170.6667',
  r3c3: '341.3333 341.3333 170.6667 170.6667',
};

const LAYOUT = {
  panel: {
    board: 280,
    piece: 88,
  },
  compact: {
    board: 208,
    piece: 64,
  },
};

const GRID_LINE_BACKGROUND = [
  'linear-gradient(90deg, transparent calc(33.333% - 0.5px), rgba(44,42,38,0.18) calc(33.333% - 0.5px), rgba(44,42,38,0.18) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.667% - 0.5px), rgba(44,42,38,0.18) calc(66.667% - 0.5px), rgba(44,42,38,0.18) calc(66.667% + 0.5px), transparent calc(66.667% + 0.5px))',
  'linear-gradient(0deg, transparent calc(33.333% - 0.5px), rgba(44,42,38,0.18) calc(33.333% - 0.5px), rgba(44,42,38,0.18) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.667% - 0.5px), rgba(44,42,38,0.18) calc(66.667% - 0.5px), rgba(44,42,38,0.18) calc(66.667% + 0.5px), transparent calc(66.667% + 0.5px))',
].join(',');

const shuffle = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const freshPieces = (): PieceState[] => shuffle(TILE_IDS).map((id) => ({ id, placed: false }));

const pieceTone: Record<TileId, string> = {
  r1c1: '#2C2A26',
  r1c2: '#34312C',
  r1c3: '#3D3932',
  r2c1: '#4A443C',
  r2c2: '#524B42',
  r2c3: '#5B5246',
  r3c1: '#665D51',
  r3c2: '#6E665A',
  r3c3: '#746B5E',
};

interface ArtifactStory {
  material: string;
  use: string;
  detail: string;
  thought: string;
}

const ARTIFACT_STORIES: Record<string, ArtifactStory> = {
  amphora: {
    material: '陶土成型，烧制后以深色图像装饰腹部，两侧高耳让它可以被绳索提起或固定。',
    use: '它常用来盛放葡萄酒、橄榄油或谷物，不只是容器，也是一种把神话、宴饮和贸易带到日常生活里的媒介。',
    detail: '看它的长颈、鼓腹和对称双耳：这些比例让液体容易倒出，也让器身成为一块天然的叙事画面。',
    thought: '一件瓶子把实用、运输和叙事合在一起，像一个古代社会对“生活需要怎样被保存”的回答。',
  },
  cauldron: {
    material: '青铜铸造，厚重的器壁、两耳和足部让它既能承重，也能在仪式空间中稳定陈列。',
    use: '鼎最初与烹煮和祭祀相关，后来逐渐成为秩序、权力和合法性的象征。',
    detail: '注意它的开口、足和耳：它不是为了轻便，而是为了在公共场合显得稳、重、不可轻易移动。',
    thought: '它提醒我们，器物不只是工具；当共同体反复围绕它行动，它就会变成制度和权威的形状。',
  },
  violin: {
    material: '木材、琴弦、琴码和空腔共同组成共鸣系统，外形曲线直接影响声音的明暗与延展。',
    use: '小提琴既是独奏乐器，也是室内乐和交响乐中的核心声部，能在极小的身体里制造强烈情绪。',
    detail: '琴腰收窄、面板开孔、琴弓摩擦琴弦，这些细节让声音在拉扯和振动之间被放大。',
    thought: '它是一件关于“约束如何产生表达”的藏品：越精确的结构，越能容纳细腻的情感。',
  },
  'pocket-watch': {
    material: '金属表壳包裹齿轮、发条和指针，外壳保护机芯，也把机械时间变成随身物。',
    use: '怀表让时间从钟楼和房间墙面转移到个人口袋里，改变了约会、劳动和旅行的节奏。',
    detail: '翻盖、链条和圆形表盘都在强调一件事：时间可以被携带、打开、查看，再重新收起。',
    thought: '它把抽象时间压缩成一个可握住的物体，也让现代人的自我管理变得更精密。',
  },
  'handheld-fan': {
    material: '扇骨、纸面或绢面合成轻薄结构，展开时成面，收起时成线。',
    use: '折扇可纳凉，也可题诗、作画、馈赠；它经常在礼仪、审美和私人表达之间转换身份。',
    detail: '观察扇面由一点展开成弧形的结构：它像一幅可以折叠进袖中的小型风景。',
    thought: '它的妙处在于“可展开”：藏起来时是器物，打开时是一段关系、一种姿态或一幅画。',
  },
  'ionic-column': {
    material: '石材雕凿成柱身与柱头，柱头卷涡是爱奥尼柱式最容易识别的特征。',
    use: '它常出现在古希腊神庙和公共建筑中，用来承重，也用来表达比例、秩序和优雅。',
    detail: '柱头两侧像卷轴一样旋转，削弱了纯粹承重的笨重感，让建筑显得更有节奏。',
    thought: '这类柱式说明，建筑从来不只是站住；它还要让权力、信仰和美学以可见的比例站住。',
  },
  'philosopher-bust': {
    material: '大理石或青铜塑成半身像，保留头部、胸肩和基座，把个体转化为可陈列的思想形象。',
    use: '胸像让哲人、政治家或诗人离开具体生命，进入学院、图书馆和博物馆的记忆秩序。',
    detail: '它强调面部、发型、姿态和基座题名；身体被删减，留下的是“这个人值得被记住”的形式。',
    thought: '哲人胸像很适合放在这里：思想本身不可见，博物馆只能先保存一张代表思想的脸。',
  },
  'porcelain-vase': {
    material: '瓷土高温烧成，胎体细密，釉面让光线在器身上形成柔和反射。',
    use: '瓷瓶可插花、陈设、赏玩，也可作为贸易品和礼物在不同文化之间流动。',
    detail: '细颈、圆肩、收腹让它的轮廓像一次克制的呼吸；美感来自比例，而不只来自纹样。',
    thought: '它展示了一种安静的技术：越光洁、越节制，越能让人意识到材料和火候的复杂。',
  },
};

const DEFAULT_STORY: ArtifactStory = {
  material: '这件藏品的形态来自可识别的历史器物轮廓，材料、用途和象征意义共同构成它的观看价值。',
  use: '它既可以被当作工具理解，也可以被当作一种社会关系的痕迹来阅读。',
  detail: '观察它最突出的轮廓：比例、重心和装饰位置通常会透露它服务于怎样的动作。',
  thought: '修复它的过程也是一次阅读：碎片归位后，器物才重新显出它原本承载的生活秩序。',
};

const ArtifactFragment: React.FC<{
  artifact: RubbingArtifact;
  quadrant: TileId;
  className?: string;
  tone?: string;
}> = ({ artifact, quadrant, className = '', tone = '#2C2A26' }) => (
  <svg
    viewBox={TILE_VIEWBOX[quadrant]}
    preserveAspectRatio="xMidYMid meet"
    className={className}
    aria-hidden="true"
  >
    <path d={artifact.path} fill={tone} />
  </svg>
);

const BoardSlot: React.FC<{
  artifact: RubbingArtifact;
  quadrant: TileId;
  placed: boolean;
  active: boolean;
  wrong: boolean;
  onClick: () => void;
}> = ({ artifact, quadrant, placed, active, wrong, onClick }) => (
  <button
    type="button"
    data-slot={quadrant}
    onClick={onClick}
    className={`relative aspect-square overflow-hidden border bg-white/55 transition-all duration-200 ${
      placed
        ? 'border-museum-900 shadow-sm'
        : active
          ? 'border-museum-800 bg-museum-50'
          : 'border-museum-200 hover:border-museum-400'
    } ${wrong ? 'animate-[pulse_0.35s_ease-in-out_2] border-red-300 bg-red-50/70' : ''}`}
    aria-label={`展柜位置 ${TILE_LABEL[quadrant]}`}
  >
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_35%_25%,rgba(255,255,255,0.85),transparent_42%),linear-gradient(135deg,rgba(249,248,246,0.95),rgba(230,226,216,0.45))]" />
    <ArtifactFragment
      artifact={artifact}
      quadrant={quadrant}
      tone="#2C2A26"
      className={`absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)] transition-all duration-300 ${
        placed ? 'opacity-100 scale-100' : 'opacity-[0.09] scale-95'
      }`}
    />
    <span className="absolute left-2 top-2 rounded-full border border-museum-200 bg-white/80 px-1.5 py-0.5 text-[9px] font-mono text-museum-500">
      {TILE_LABEL[quadrant]}
    </span>
  </button>
);

const RubbingGame: React.FC<RubbingGameProps> = ({ variant = 'panel' }) => {
  const uid = useId().replace(/:/g, '');
  const { board, piece } = LAYOUT[variant];
  const [artifact, setArtifact] = useState<RubbingArtifact>(() => pickRandomArtifact());
  const [pieces, setPieces] = useState<PieceState[]>(freshPieces);
  const [selected, setSelected] = useState<TileId | null>(null);
  const [dragging, setDragging] = useState<TileId | null>(null);
  const [dragPreview, setDragPreview] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0, size: piece });
  const [wrongSlot, setWrongSlot] = useState<TileId | null>(null);
  const [round, setRound] = useState(1);
  const [streak, setStreak] = useState(0);

  const placedCount = pieces.filter((p) => p.placed).length;
  const done = placedCount === TILE_IDS.length;
  const selectedPiece = selected && pieces.find((p) => p.id === selected && !p.placed) ? selected : null;
  const story = ARTIFACT_STORIES[artifact.id] || DEFAULT_STORY;

  useEffect(() => {
    if (!wrongSlot) return;
    const timer = window.setTimeout(() => setWrongSlot(null), 520);
    return () => window.clearTimeout(timer);
  }, [wrongSlot]);

  const resetCurrent = useCallback(() => {
    setPieces(freshPieces());
    setSelected(null);
    setDragging(null);
    setWrongSlot(null);
  }, []);

  const nextArtifact = useCallback(() => {
    setArtifact((current) => pickRandomArtifact(current.id));
    setPieces(freshPieces());
    setSelected(null);
    setDragging(null);
    setWrongSlot(null);
    setRound((value) => value + 1);
  }, []);

  const tryPlace = useCallback((pieceId: TileId, slotId: TileId | null) => {
    if (!slotId) return;
    if (pieceId !== slotId) {
      setWrongSlot(slotId);
      setStreak(0);
      return;
    }
    setPieces((current) => current.map((p) => (p.id === pieceId ? { ...p, placed: true } : p)));
    setSelected(null);
    setStreak((value) => value + 1);
  }, []);

  const slotFromPoint = (x: number, y: number): TileId | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const slot = el?.closest('[data-slot]') as HTMLElement | null;
    const value = slot?.dataset.slot;
    return TILE_IDS.includes(value as TileId) ? (value as TileId) : null;
  };

  const onPiecePointerDown = (pieceId: TileId, e: React.PointerEvent<HTMLButtonElement>) => {
    if (done) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setSelected(pieceId);
    setDragging(pieceId);
    setDragPreview({
      x: e.clientX,
      y: e.clientY,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      size: rect.width,
    });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const onPiecePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragPreview((current) => ({ ...current, x: e.clientX, y: e.clientY }));
  };

  const onPiecePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const target = dragging;
    setDragging(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    tryPlace(target, slotFromPoint(e.clientX, e.clientY));
  };

  const placedMap = useMemo(() => {
    const map = new Map<TileId, boolean>();
    pieces.forEach((p) => map.set(p.id, p.placed));
    return map;
  }, [pieces]);

  const remainingPieces = pieces.filter((p) => !p.placed);
  const progress = `${placedCount}/${TILE_IDS.length}`;

  return (
    <div className="relative flex w-full flex-col items-center">
      <div className="mb-3 flex w-full items-end justify-between gap-4" style={{ maxWidth: board }}>
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500">
            Archive Puzzle {String(round).padStart(2, '0')}
          </p>
          <p className="mt-1 font-serif text-base text-museum-900">{artifact.title}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400">{progress}</p>
          <p className="mt-1 text-[10px] text-museum-500">{streak > 1 ? `连击 ${streak}` : artifact.era}</p>
        </div>
      </div>

      <div
        className="relative grid grid-cols-3 overflow-hidden border border-museum-300 bg-museum-100/50 shadow-sm"
        style={{ width: board, height: board }}
      >
        <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: GRID_LINE_BACKGROUND }} />
        {TILE_IDS.map((quadrant) => (
          <BoardSlot
            key={`${uid}-${quadrant}`}
            artifact={artifact}
            quadrant={quadrant}
            placed={placedMap.get(quadrant) || false}
            active={selectedPiece === quadrant}
            wrong={wrongSlot === quadrant}
            onClick={() => selectedPiece && tryPlace(selectedPiece, quadrant)}
          />
        ))}
        {done && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/86 backdrop-blur-[2px] animate-fade-in">
            <div className="w-4/5 border border-museum-200 bg-museum-50/95 px-4 py-5 text-center shadow-sm">
              <Sparkles className="mx-auto h-5 w-5 text-museum-700" />
              <p className="mt-2 font-serif text-lg text-museum-900">归档完成</p>
              <p className="mt-1 text-xs leading-relaxed text-museum-600">{artifact.blurb}</p>
            </div>
          </div>
        )}
      </div>

      {!done && (
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          style={{ width: board }}
        >
        {remainingPieces.map((item) => (
          <button
            key={item.id}
            type="button"
            onPointerDown={(e) => onPiecePointerDown(item.id, e)}
            onPointerMove={onPiecePointerMove}
            onPointerUp={onPiecePointerUp}
            onPointerCancel={() => setDragging(null)}
            onClick={() => setSelected((current) => (current === item.id ? null : item.id))}
            className={`relative aspect-square touch-none overflow-hidden border bg-white/80 shadow-sm transition-all ${
              selected === item.id
                ? 'border-museum-900 -translate-y-0.5'
                : 'border-museum-200 hover:border-museum-500'
            } ${dragging === item.id ? 'opacity-30' : 'opacity-100'}`}
            aria-label={`碎片 ${TILE_LABEL[item.id]}`}
            style={{ minWidth: variant === 'compact' ? 44 : 58 }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(135deg,#F9F8F6,#E6E2D8)]" />
            <ArtifactFragment
              artifact={artifact}
              quadrant={item.id}
              tone={pieceTone[item.id]}
              className="absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]"
            />
            <span className="absolute right-1.5 top-1.5 rounded-full bg-museum-900 px-1.5 py-0.5 text-[9px] font-mono text-museum-50">
              {TILE_LABEL[item.id]}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(0, TILE_IDS.length - remainingPieces.length) }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="aspect-square border border-dashed border-museum-200 bg-museum-50/50"
          />
        ))}
        </div>
      )}

      {done && (
        <aside
          className="mt-4 max-h-[340px] overflow-auto border border-museum-200 bg-white/90 px-4 py-4 text-left shadow-sm animate-fade-in"
          style={{ width: board }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-museum-400">Museum Label</p>
              <h3 className="mt-1 font-serif text-lg leading-tight text-museum-900">{artifact.title}</h3>
            </div>
            <span className="shrink-0 rounded-full border border-museum-200 bg-museum-50 px-2 py-1 text-[9px] font-mono uppercase tracking-widest text-museum-500">
              {artifact.era}
            </span>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-museum-700">{artifact.blurb}</p>
          <div className="mt-3 grid gap-2 text-[11px] leading-relaxed text-museum-600">
            <p><span className="font-mono uppercase tracking-widest text-museum-400">材质</span> {story.material}</p>
            <p><span className="font-mono uppercase tracking-widest text-museum-400">用途</span> {story.use}</p>
            <p><span className="font-mono uppercase tracking-widest text-museum-400">看点</span> {story.detail}</p>
            <p><span className="font-mono uppercase tracking-widest text-museum-400">为什么有意思</span> {story.thought}</p>
          </div>
        </aside>
      )}

      {dragging && typeof document !== 'undefined' && createPortal(
        <div
          className="pointer-events-none fixed z-[9999] overflow-hidden border border-museum-900 bg-white/90 shadow-xl"
          style={{
            left: dragPreview.x - dragPreview.offsetX,
            top: dragPreview.y - dragPreview.offsetY,
            width: dragPreview.size,
            height: dragPreview.size,
          }}
        >
          <ArtifactFragment
            artifact={artifact}
            quadrant={dragging}
            tone={pieceTone[dragging]}
            className="absolute inset-3 h-[calc(100%-24px)] w-[calc(100%-24px)]"
          />
        </div>,
        document.body,
      )}

      <div className="mt-4 flex items-center gap-5">
        <button
          type="button"
          onClick={resetCurrent}
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-500 transition-colors hover:text-museum-900"
        >
          <RotateCcw className="h-3 w-3" />
          重置
        </button>
        <button
          type="button"
          onClick={nextArtifact}
          className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.24em] text-museum-700 transition-colors hover:text-museum-900"
        >
          下一件
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <p className="mt-3 max-w-xs text-center text-[10px] leading-relaxed text-museum-400">
        {done ? '展柜已合拢，可以换下一件藏品。' : selectedPiece ? `碎片 ${TILE_LABEL[selectedPiece]} 已取出。` : '把散落的藏品碎片放回展柜。'}
      </p>

      <p className="mt-2 text-center font-mono text-[9px] tracking-wider text-museum-300">
        Silhouettes by{' '}
        <a
          href="https://game-icons.net"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-museum-500 hover:underline"
        >
          game-icons.net
        </a>
        {' '}·{' '}
        <a
          href="https://creativecommons.org/licenses/by/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 hover:text-museum-500 hover:underline"
        >
          CC BY 3.0
        </a>
      </p>
    </div>
  );
};

export default RubbingGame;
