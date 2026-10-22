import { distance, pointInPolygon, seededRandom } from './paperGeometry';
import type { PaperGeometry, Point } from './paperGeometry';
import { fisherYates } from './shuffle';

export interface LoosePiece { readonly id: number; readonly point: Point }
export interface ReplayFrame { readonly t: number; readonly placed: readonly number[]; readonly loose: readonly LoosePiece[]; readonly move: number }
export interface PaperGameState {
  readonly geometry: PaperGeometry; readonly order: readonly number[]; readonly placed: readonly number[];
  readonly loose: readonly LoosePiece[]; readonly selected: number | null; readonly moves: number;
  readonly startedAt: number | null; readonly elapsedMs: number; readonly status: 'ready' | 'playing' | 'completed';
  readonly feedback: string; readonly hintsUsed: number; readonly hinted: number | null; readonly marked: readonly number[];
  readonly history?: readonly ReplayFrame[];
}
export type PaperAction = { type: 'select'; id: number } | { type: 'place'; id: number; point: Point; now: number }
  | { type: 'tick'; now: number } | { type: 'reset'; geometry: PaperGeometry }
  | { type: 'restore'; state: PaperGameState; now: number } | { type: 'hint' } | { type: 'assist'; now: number }
  | { type: 'mark' } | { type: 'deselect' } | { type: 'return'; id?: number };

export function initialPaperGame(geometry: PaperGeometry): PaperGameState {
  return { geometry, order: fisherYates(geometry.pieces.map(p => p.id), seededRandom(geometry.seed + 1)),
    placed: [], loose: [], selected: null, moves: 0, startedAt: null, elapsedMs: 0, status: 'ready', feedback: '', hintsUsed: 0, hinted: null, marked: [], history: [{ t: 0, placed: [], loose: [], move: 0 }] };
}

const adjacentCache = new WeakMap<PaperGeometry, Map<number, Set<number>>>();
export function neighbors(geometry: PaperGeometry): Map<number, Set<number>> {
  const cached = adjacentCache.get(geometry); if (cached) return cached;
  const result = new Map(geometry.pieces.map(p => [p.id, new Set<number>()]));
  const vertices = geometry.pieces.map(p => new Set(p.polygon.map(v => `${v.x.toFixed(3)},${v.y.toFixed(3)}`)));
  geometry.pieces.forEach((a, i) => geometry.pieces.slice(i + 1).forEach((b, j) => {
    const common = a.polygon.filter(v => vertices[i + 1 + j]!.has(`${v.x.toFixed(3)},${v.y.toFixed(3)}`));
    if (common.length >= 2 && common.some(v => pointInPolygon(v, geometry.outline))) { result.get(a.id)!.add(b.id); result.get(b.id)!.add(a.id); }
  }));
  adjacentCache.set(geometry, result); return result;
}
export function pieceOffset(state: PaperGameState, id: number): Point | null {
  const item = state.loose.find(p => p.id === id), piece = state.geometry.pieces[id];
  return item && piece ? { x: item.point.x - piece.anchor.x, y: item.point.y - piece.anchor.y } : null;
}
export function connectedGroup(state: PaperGameState, id: number): number[] {
  const offset = pieceOffset(state, id); if (!offset) return [id];
  const found = new Set([id]), queue = [id], adjacent = neighbors(state.geometry);
  while (queue.length) for (const next of adjacent.get(queue.shift()!) ?? []) {
    const nextOffset = pieceOffset(state, next);
    if (!found.has(next) && nextOffset && distance(offset, nextOffset) < 1) { found.add(next); queue.push(next); }
  }
  return [...found];
}
export function isEdgePiece(geometry: PaperGeometry, id: number): boolean {
  return geometry.pieces[id]!.polygon.some(p => !pointInPolygon(p, geometry.outline));
}
export function restorePaperGame(state: PaperGameState, now: number): PaperGameState {
  return { ...state, selected: null, hinted: null, startedAt: state.status === 'playing' ? now - state.elapsedMs : null };
}
export function challengeScore(state: PaperGameState, hardMode: boolean): number {
  return Math.max(0, Math.round(state.geometry.pieces.length * 250 * (hardMode ? 1.35 : 1) - state.elapsedMs / 1000 * 2 - state.moves * 8 - state.hintsUsed * 350));
}

// 自由摆放保留错误位置；相邻纸片偏移接近时接成一组，共用偏移并可整体移动。
function reducePaperState(state: PaperGameState, action: PaperAction): PaperGameState {
  if (action.type === 'reset') return initialPaperGame(action.geometry);
  if (action.type === 'restore') return restorePaperGame(action.state, action.now);
  if (state.status === 'completed') return state;
  if (action.type === 'deselect') return { ...state, selected: null, hinted: null, feedback: '已取消选择' };
  if (action.type === 'tick') return state.startedAt === null ? state : { ...state, elapsedMs: Math.max(0, action.now - state.startedAt) };
  if (action.type === 'mark') {
    if (state.selected === null) return state;
    return { ...state, marked: state.marked.includes(state.selected) ? state.marked.filter(id => id !== state.selected) : [...state.marked, state.selected] };
  }
  if (action.type === 'return') {
    const id = action.id ?? state.selected;
    if (id === null || (!state.loose.some(p => p.id === id) && !state.placed.includes(id))) return state;
    // 收回组合时同时移除暂放和归位记录，确保纸片重新出现在盒中。
    const group = connectedGroup(state, id);
    return { ...state, loose: state.loose.filter(p => !group.includes(p.id)), placed: state.placed.filter(id => !group.includes(id)), selected: null, hinted: null, feedback: group.length > 1 ? `${group.length}片组合已收回盒中` : '纸片已收回盒中' };
  }
  if (action.type === 'hint' || action.type === 'assist') {
    if (action.type === 'hint') {
      if (state.selected === null) return state;
      return { ...state, hinted: state.selected, hintsUsed: state.hintsUsed + 1, feedback: `第 ${state.selected + 1} 片的正确位置已高亮` };
    }
    const id = state.selected !== null && !state.placed.includes(state.selected) ? state.selected : state.order.find(item => !state.placed.includes(item));
    if (id === undefined) return state;
    const assisted = reducePaperState(state, { type: 'place', id, point: state.geometry.pieces[id]!.anchor, now: action.now });
    return { ...assisted, hintsUsed: state.hintsUsed + 1, feedback: '已帮你放回一片，提示已计入成绩' };
  }
  const piece = state.geometry.pieces.find(p => p.id === action.id);
  if (!piece) return state;
  if (action.type === 'select') return { ...state, selected: state.selected === action.id ? null : action.id, hinted: null, feedback: '' };
  if (!Number.isFinite(action.point.x) || !Number.isFinite(action.point.y) || action.point.x < -100 || action.point.x > 1100 || action.point.y < -100 || action.point.y > 1100) return state;
  const group = connectedGroup(state, piece.id);
  const tolerance = Math.max(35, Math.min(80, 340 / Math.sqrt(state.geometry.pieces.length)));
  const fits = distance(piece.anchor, action.point) <= tolerance;
  if (fits && state.placed.includes(piece.id)) return state;
  const remainingPlaced = state.placed.filter(id => !group.includes(id));
  const placed = fits ? [...remainingPlaced, ...group] : remainingPlaced;
  let offset = { x: action.point.x - piece.anchor.x, y: action.point.y - piece.anchor.y };
  const others = state.loose.filter(p => !group.includes(p.id));
  let joined = false;
  if (!fits) {
    const adjacent = neighbors(state.geometry);
    const match = others.find(other => group.some(id => adjacent.get(id)?.has(other.id)) && distance(offset, pieceOffset(state, other.id)!) < 28);
    if (match) { offset = pieceOffset(state, match.id)!; joined = true; }
  }
  const loose = fits ? others : [...others, ...group.map(id => ({ id, point: { x: state.geometry.pieces[id]!.anchor.x + offset.x, y: state.geometry.pieces[id]!.anchor.y + offset.y } }))];
  const startedAt = state.startedAt ?? action.now;
  return { ...state, placed, loose, selected: fits ? null : piece.id, hinted: null, moves: state.moves + 1, startedAt,
    elapsedMs: Math.max(0, action.now - startedAt), status: placed.length === state.geometry.pieces.length ? 'completed' : 'playing',
    feedback: fits ? group.length > 1 ? `${group.length}片组合已整体归位` : `第 ${piece.id + 1} 片已归位` : joined ? '切口对上了！现在可以拖动整个组合' : '纸片已暂放在这里，可继续拼接或拖回正确位置' };
}

export function paperReducer(state: PaperGameState, action: PaperAction): PaperGameState {
  const next = reducePaperState(state, action);
  if (next === state || !['place', 'assist', 'return'].includes(action.type)) return next;
  const frames = state.history ?? [{ t: 0, placed: [], loose: [], move: 0 }];
  return { ...next, history: [...frames.slice(-2999), { t: next.elapsedMs, placed: next.placed, loose: next.loose, move: next.moves }] };
}
