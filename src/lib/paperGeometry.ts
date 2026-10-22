export interface Point { readonly x: number; readonly y: number }
export type ShapeKind = 'square' | 'circle' | 'heart' | 'star' | 'hexagon' | 'custom';
export interface PuzzleSettings { readonly pieceCount: number; readonly shape: ShapeKind; readonly customOutline: readonly Point[] }
export interface Bounds { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
export interface PaperPiece { readonly id: number; readonly polygon: readonly Point[]; readonly anchor: Point; readonly bounds: Bounds; readonly path: string }
export interface PaperGeometry { readonly pieces: readonly PaperPiece[]; readonly outline: readonly Point[]; readonly outlinePath: string; readonly shapeLabel: string; readonly seed: number }
export const MIN_PIECES = 4;
export const MAX_PIECES = 100;
export const SHAPES: readonly { id: ShapeKind; label: string; symbol: string }[] = [
  { id: 'circle', label: '圆形', symbol: '○' }, { id: 'heart', label: '爱心', symbol: '♡' },
  { id: 'star', label: '星形', symbol: '☆' }, { id: 'hexagon', label: '六边形', symbol: '⬡' },
  { id: 'square', label: '方形', symbol: '□' }, { id: 'custom', label: '手绘轮廓', symbol: '〰' }
];

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let t = Math.imul(value ^ value >>> 15, value | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const polygonPath = (points: readonly Point[]) => points.length ? `M${points.map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join('L')}Z` : '';
export function polygonArea(points: readonly Point[]): number {
  return Math.abs(points.reduce((sum, p, index) => {
    const q = points[(index + 1) % points.length]!;
    return sum + p.x * q.y - q.x * p.y;
  }, 0)) / 2;
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!, b = polygon[j]!;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function intersection(a: Point, b: Point, c: Point, d: Point): Point | null {
  const denominator = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(denominator) < 1e-8) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / denominator;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / denominator;
  return t >= -1e-7 && t <= 1 + 1e-7 && u >= -1e-7 && u <= 1 + 1e-7
    ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

export function validateOutline(points: readonly Point[]): string | null {
  if (points.length < 3 || points.length > 160 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 1000 || p.y < 0 || p.y > 1000)) return '请画出一个完整的封闭轮廓';
  if (polygonArea(points) < 35000) return '轮廓太小，请画得更大一些';
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue;
      if (intersection(points[i]!, points[(i + 1) % points.length]!, points[j]!, points[(j + 1) % points.length]!)) return '轮廓线不要交叉，请重新画一笔';
    }
  }
  return null;
}

export function normalizeOutline(points: readonly Point[]): Point[] {
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const width = Math.max(...xs) - minX, height = Math.max(...ys) - minY;
  const scale = 880 / Math.max(width, height, 1);
  return points.map(p => ({ x: (p.x - minX - width / 2) * scale + 500, y: (p.y - minY - height / 2) * scale + 500 }));
}

export function shapeOutline(shape: ShapeKind, custom: readonly Point[] = []): Point[] {
  if (shape === 'custom' && !validateOutline(custom)) return normalizeOutline(custom);
  if (shape === 'square') return [{ x: 60, y: 60 }, { x: 940, y: 60 }, { x: 940, y: 940 }, { x: 60, y: 940 }];
  if (shape === 'heart') return normalizeOutline(Array.from({ length: 96 }, (_, i) => {
    const t = 2 * Math.PI * i / 96;
    return { x: 500 + 25 * 16 * Math.sin(t) ** 3,
      y: 500 - 25 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) };
  }));
  const count = shape === 'star' ? 10 : shape === 'hexagon' ? 6 : 96;
  return Array.from({ length: count }, (_, i) => {
    const t = 2 * Math.PI * i / count - Math.PI / 2;
    const r = shape === 'star' && i % 2 ? 220 : 440;
    return { x: 500 + Math.cos(t) * r, y: 500 + Math.sin(t) * r };
  });
}

function clipHalfPlane(polygon: readonly Point[], nx: number, ny: number, limit: number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
    const da = nx * a.x + ny * a.y - limit, db = nx * b.x + ny * b.y - limit;
    if (da <= 1e-7) result.push(a);
    if ((da < 0) !== (db < 0)) {
      const t = da / (da - db);
      result.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
    }
  }
  return result;
}

function boundsOfIntersection(cell: readonly Point[], outline: readonly Point[], anchor: Point): Bounds {
  const points = [anchor, ...cell.filter(p => pointInPolygon(p, outline)), ...outline.filter(p => pointInPolygon(p, cell))];
  for (let i = 0; i < cell.length; i++) for (let j = 0; j < outline.length; j++) {
    const p = intersection(cell[i]!, cell[(i + 1) % cell.length]!, outline[j]!, outline[(j + 1) % outline.length]!);
    if (p) points.push(p);
  }
  const x = Math.max(0, Math.min(...points.map(p => p.x)) - 2), y = Math.max(0, Math.min(...points.map(p => p.y)) - 2);
  return { x, y, width: Math.min(1000, Math.max(...points.map(p => p.x)) + 2) - x,
    height: Math.min(1000, Math.max(...points.map(p => p.y)) + 2) - y };
}

// 每一条相邻边只生成一次撕纸锯齿，两侧反向复用，避免独立随机边界造成缝隙。
function tornPolygon(cell: readonly Point[], cache: Map<string, readonly Point[]>, random: () => number): Point[] {
  const result: Point[] = [];
  for (let i = 0; i < cell.length; i++) {
    const a = cell[i]!, b = cell[(i + 1) % cell.length]!;
    const ka = `${a.x.toFixed(3)},${a.y.toFixed(3)}`, kb = `${b.x.toFixed(3)},${b.y.toFixed(3)}`;
    const forward = ka < kb, key = forward ? `${ka}|${kb}` : `${kb}|${ka}`;
    let edge = cache.get(key);
    if (!edge) {
      const start = forward ? a : b, end = forward ? b : a;
      const length = distance(start, end), steps = Math.max(2, Math.ceil(length / 22));
      const amplitude = Math.min(5, length * .025);
      edge = Array.from({ length: steps + 1 }, (_, index) => {
        const t = index / steps, displacement = index === 0 || index === steps ? 0 : (random() - .5) * 2 * amplitude;
        return { x: start.x + (end.x - start.x) * t - (end.y - start.y) / Math.max(length, 1) * displacement,
          y: start.y + (end.y - start.y) * t + (end.x - start.x) / Math.max(length, 1) * displacement };
      });
      cache.set(key, edge);
    }
    result.push(...(forward ? edge : [...edge].reverse()).slice(0, -1));
  }
  return result;
}

// 随机均匀采点 + Voronoi 半平面切割；数量准确，无行列网格，每局种子不同。
export function generatePaperGeometry(settings: PuzzleSettings, seed: number): PaperGeometry {
  if (!Number.isInteger(settings.pieceCount) || settings.pieceCount < MIN_PIECES || settings.pieceCount > MAX_PIECES) throw new Error('碎片数量应为 4–100 的整数');
  if (settings.shape === 'custom') { const error = validateOutline(settings.customOutline); if (error) throw new Error(error); }
  const outline = shapeOutline(settings.shape, settings.customOutline), random = seededRandom(seed);
  const sites: Point[] = [];
  function sample(): Point {
    for (let tries = 0; tries < 20000; tries++) {
      const point = { x: random() * 1000, y: random() * 1000 };
      if (pointInPolygon(point, outline)) return point;
    }
    throw new Error('这个轮廓过于细窄，请画一个更饱满的形状');
  }
  for (let i = 0; i < settings.pieceCount; i++) {
    let best = sample(), bestDistance = -1;
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = sample();
      const nearest = sites.length ? Math.min(...sites.map(p => distance(p, candidate))) : 0;
      if (nearest > bestDistance) { best = candidate; bestDistance = nearest; }
    }
    sites.push(best);
  }
  const edges = new Map<string, readonly Point[]>();
  const pieces = sites.map((site, id) => {
    let cell: Point[] = [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }];
    sites.forEach((other, j) => {
      if (j !== id) cell = clipHalfPlane(cell, other.x - site.x, other.y - site.y,
        (other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2) / 2);
    });
    const polygon = tornPolygon(cell, edges, random);
    return { id, polygon, anchor: site, bounds: boundsOfIntersection(polygon, outline, site), path: polygonPath(polygon) };
  });
  return { pieces, outline, outlinePath: polygonPath(outline), seed,
    shapeLabel: settings.shape === 'custom' ? '手绘' : SHAPES.find(shape => shape.id === settings.shape)?.label ?? '自定义' };
}

export function newSeed(): number { return crypto.getRandomValues(new Uint32Array(1))[0]!; }
