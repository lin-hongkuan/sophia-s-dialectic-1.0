// Catalog of line-art artifacts revealed by the rubbing mini-game on
// the loading screen and inside ReasoningDisplay. Paths are hand-crafted
// stylised silhouettes — readable as "a museum object" rather than
// photoreal renderings, matching the site's serif/parchment aesthetic.
//
// Coordinate system: 100x100 viewBox. Strokes use #3C342A on parchment.
// New entries should keep paths schematic and use 0.5–0.9 stroke width.

export interface RubbingPath {
  d: string;
  strokeWidth?: number;
  fill?: string;
}

export interface RubbingArtifact {
  id: string;
  title: string;     // e.g., "希腊双耳瓶"
  era: string;       // e.g., "古希腊 · 公元前 6 世纪"
  blurb: string;     // 1-2 sentence museum caption
  paths: RubbingPath[];
}

export const RUBBING_ARTIFACTS: RubbingArtifact[] = [
  {
    id: 'amphora',
    title: '希腊双耳瓶',
    era: '古希腊 · 公元前 6 世纪',
    blurb: '装葡萄酒、橄榄油的陶器，两耳便于绳索悬挂。腹部常见黑绘人物——一种把神话画在容器上的习惯。',
    paths: [
      // mouth + lip
      { d: 'M40,12 L60,12 L60,15 L40,15 Z' },
      // neck
      { d: 'M42,15 L42,24' },
      { d: 'M58,15 L58,24' },
      // body silhouette
      { d: 'M42,24 C32,28 26,40 26,54 C26,70 34,80 38,86 L62,86 C66,80 74,70 74,54 C74,40 68,28 58,24' },
      // base ring
      { d: 'M38,86 L38,90 L62,90 L62,86' },
      // handles
      { d: 'M42,18 C30,22 28,32 36,34' },
      { d: 'M58,18 C70,22 72,32 64,34' },
      // belly band (decoration hint)
      { d: 'M30,52 L70,52', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'ding',
    title: '青铜鼎',
    era: '中国 · 商周',
    blurb: '三足两耳的礼器。最初煮肉、祭祀，后来成为权力的象征——"问鼎"里的鼎，正是这种器物。',
    paths: [
      // body bowl (truncated trapezoid)
      { d: 'M22,32 L78,32 L74,60 L26,60 Z' },
      // ornamental band
      { d: 'M26,42 L74,42', strokeWidth: 0.4 },
      // two handles on rim
      { d: 'M30,32 C28,22 38,22 36,32' },
      { d: 'M70,32 C72,22 62,22 64,32' },
      // three legs
      { d: 'M32,60 L32,86' },
      { d: 'M50,60 L50,90' },
      { d: 'M68,60 L68,86' },
      // simple taotie hint
      { d: 'M44,48 L44,52 M50,48 L50,52 M56,48 L56,52', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'ming-chair',
    title: '明式圈椅',
    era: '中国 · 明',
    blurb: '一根连续弯木绕成扶手与靠背。结构暴露，没有多余装饰——明代工匠对力学和木理的理解都浓缩在这把椅子里。',
    paths: [
      // horseshoe top arc (back rail + arms)
      { d: 'M22,18 C22,10 78,10 78,18' },
      // descending arms
      { d: 'M22,18 L22,46' },
      { d: 'M78,18 L78,46' },
      // back splat
      { d: 'M50,18 L50,46', strokeWidth: 0.5 },
      // seat
      { d: 'M18,46 L82,46' },
      { d: 'M22,52 L78,52' },
      // four legs
      { d: 'M22,52 L22,88' },
      { d: 'M78,52 L78,88' },
      { d: 'M30,52 L30,88', strokeWidth: 0.45 },
      { d: 'M70,52 L70,88', strokeWidth: 0.45 },
      // front stretcher
      { d: 'M22,80 L78,80', strokeWidth: 0.45 },
      // seat shadow
      { d: 'M22,58 L78,58', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'violin',
    title: '小提琴',
    era: '意大利 · 17–18 世纪',
    blurb: '由形状决定声音的乐器。腰身的曲线、f 形音孔的位置、面板拱度，共同决定它能让谁哭、让谁笑。',
    paths: [
      // body silhouette (figure-8)
      { d: 'M40,32 C30,32 26,42 30,52 C26,60 28,76 38,82 L62,82 C72,76 74,60 70,52 C74,42 70,32 60,32 Z' },
      // neck
      { d: 'M46,32 L46,14 L54,14 L54,32' },
      // pegbox + scroll
      { d: 'M46,14 C44,10 56,10 54,14' },
      { d: 'M48,8 C45,5 55,5 52,9' },
      // four pegs (tiny ticks)
      { d: 'M44,18 L48,18 M52,18 L56,18 M44,22 L48,22 M52,22 L56,22', strokeWidth: 0.4 },
      // strings
      { d: 'M48,14 L48,76', strokeWidth: 0.3 },
      { d: 'M50,14 L50,76', strokeWidth: 0.3 },
      { d: 'M52,14 L52,76', strokeWidth: 0.3 },
      // bridge
      { d: 'M44,68 L56,68', strokeWidth: 0.45 },
      // f-holes (simplified)
      { d: 'M38,56 C36,60 38,66 40,68', strokeWidth: 0.4 },
      { d: 'M62,56 C64,60 62,66 60,68', strokeWidth: 0.4 },
    ],
  },
  {
    id: 'pocket-watch',
    title: '怀表',
    era: '欧洲 · 19 世纪',
    blurb: '把时间拴在身上的方式。表壳合上、链子收进口袋，时间也被收起；翻开它，是一种郑重的查看。',
    paths: [
      // case (circle approximated by path)
      { d: 'M50,30 C36,30 26,40 26,54 C26,68 36,78 50,78 C64,78 74,68 74,54 C74,40 64,30 50,30 Z' },
      // inner ring
      { d: 'M50,34 C38,34 30,42 30,54 C30,66 38,74 50,74 C62,74 70,66 70,54 C70,42 62,34 50,34 Z', strokeWidth: 0.35 },
      // crown stem
      { d: 'M47,30 L47,24 L53,24 L53,30' },
      // ring/loop
      { d: 'M48,24 C46,18 54,18 52,24' },
      // hour & minute hands
      { d: 'M50,54 L50,42', strokeWidth: 0.7 },
      { d: 'M50,54 L60,50', strokeWidth: 0.5 },
      // center pin
      { d: 'M49.4,53.4 L50.6,53.4 L50.6,54.6 L49.4,54.6 Z', fill: '#3C342A' },
      // 12 / 3 / 6 / 9 markers
      { d: 'M50,38 L50,40 M64,54 L66,54 M50,68 L50,70 M34,54 L36,54', strokeWidth: 0.4 },
      // chain trailing up-right
      { d: 'M70,38 C76,32 80,28 84,22', strokeWidth: 0.4 },
      { d: 'M74,34 C78,30 82,26 86,20', strokeWidth: 0.3 },
    ],
  },
  {
    id: 'folding-fan',
    title: '折扇',
    era: '东亚 · 17 世纪以降',
    blurb: '收起时是一根细骨，展开时是一片小景。文人在上面写诗作画，把整个山水折叠起来带在身上。',
    paths: [
      // outer boundary
      { d: 'M50,88 L9,69 A45 45 0 0 1 91,69 L50,88 Z' },
      // inner arc (suggesting paper top)
      { d: 'M16,72 A38 38 0 0 1 84,72', strokeWidth: 0.4 },
      // ribs (5 internal)
      { d: 'M50,88 L21,54', strokeWidth: 0.4 },
      { d: 'M50,88 L35,46', strokeWidth: 0.4 },
      { d: 'M50,88 L50,43', strokeWidth: 0.4 },
      { d: 'M50,88 L65,46', strokeWidth: 0.4 },
      { d: 'M50,88 L79,54', strokeWidth: 0.4 },
      // pivot rivet
      { d: 'M49.2,87.2 L50.8,87.2 L50.8,88.8 L49.2,88.8 Z', fill: '#3C342A' },
    ],
  },
];

export const pickRandomArtifact = (excludeId?: string): RubbingArtifact => {
  const pool = excludeId
    ? RUBBING_ARTIFACTS.filter((a) => a.id !== excludeId)
    : RUBBING_ARTIFACTS;
  const list = pool.length > 0 ? pool : RUBBING_ARTIFACTS;
  return list[Math.floor(Math.random() * list.length)];
};
