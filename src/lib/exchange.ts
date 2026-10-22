import { newId } from './id';
import type { SavedSession } from './studioTypes';
import type { PlayOptions } from './experiences';
import { validSettings } from './experiences';
import { generatePaperGeometry } from './paperGeometry';
import { initialPaperGame } from './paperReducer';
import { normalizeCrop } from './crop';
import type { LoosePiece } from './paperReducer';

export interface PuzzleParcel { format: 'piece-by-piece'; version: 1; purpose: 'gift' | 'relay' | 'challenge'; session: Omit<SavedSession, 'image'> & { image: { data: string; name: string; originalWidth: number; originalHeight: number } } }
export function downloadBlob(blob: Blob, name: string) { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); window.setTimeout(() => URL.revokeObjectURL(url), 5000); }
async function imageData(blob: Blob) { const bytes = new Uint8Array(await blob.arrayBuffer()); let value = ''; for (let i = 0; i < bytes.length; i += 8192) value += String.fromCharCode(...bytes.subarray(i, i + 8192)); return `data:${blob.type};base64,${btoa(value)}`; }
export function safeOptions(value: unknown): PlayOptions {
  const p = value && typeof value === 'object' ? value as Partial<PlayOptions> : {};
  const text = (s: unknown, n: number) => typeof s === 'string' ? s.slice(0, n) : '';
  return { mode: p.mode === 'mystery' || p.mode === 'restore' ? p.mode : 'classic', ...(p.relaxed === true ? { relaxed: true } : {}), ...(p.giftPreview === true ? { giftPreview: true } : {}), ...(p.gentle && /^\d{4}-\d{2}-\d{2}$/.test(p.gentle.week) && Number.isInteger(p.gentle.index) && p.gentle.index >= 0 && p.gentle.index < 3 ? { gentle: { week: p.gentle.week, index: p.gentle.index } } : {}), ...(p.gift ? { gift: { title: text(p.gift.title, 80), to: text(p.gift.to, 40), from: text(p.gift.from, 40), message: text(p.gift.message, 1200), keywords: text(p.gift.keywords, 120) } } : {}), ...(Array.isArray(p.duo) && p.duo.length === 2 ? { duo: [text(p.duo[0], 30), text(p.duo[1], 30)] as const } : {}), ...(typeof p.artworkId === 'string' ? { artworkId: p.artworkId.slice(0, 60) } : {}), ...(p.weekly && /^\d{4}-\d{2}-\d{2}$/.test(p.weekly.week) && Number.isInteger(p.weekly.index) && p.weekly.index >= 0 && p.weekly.index < 3 ? { weekly: { week: p.weekly.week, index: p.weekly.index } } : {}) };
}
export async function makeParcel(session: SavedSession, purpose: PuzzleParcel['purpose']): Promise<PuzzleParcel> {
  const state = purpose === 'relay' ? session.state : initialPaperGame(session.state.geometry);
  return { format: 'piece-by-piece', version: 1, purpose, session: { ...session, state, hardEligible: purpose === 'relay' ? session.hardEligible : true, image: { data: await imageData(session.image.blob), name: session.image.name, originalWidth: session.image.originalWidth, originalHeight: session.image.originalHeight }, options: { ...safeOptions(session.options), giftPreview: undefined } } };
}
export function openParcel(value: unknown): SavedSession {
  if (!value || typeof value !== 'object') throw new Error('拼图包无法读取');
  const p = value as PuzzleParcel, s = p.session;
  if (p.format !== 'piece-by-piece' || p.version !== 1 || !['gift', 'relay', 'challenge'].includes(p.purpose) || !s || !validSettings(s.settings) || !s.image || typeof s.image.data !== 'string' || s.image.data.length > 28000000 || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s.image.data) || !Number.isInteger(s.state?.geometry?.seed)) throw new Error('这不是有效的拼图包，或文件过大');
  const [header, data] = s.image.data.split(','), bytes = Uint8Array.from(atob(data!), c => c.charCodeAt(0));
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('照片数据无效');
  const blob = new Blob([bytes], { type: header!.slice(5, header!.indexOf(';')) }), geometry = generatePaperGeometry(s.settings, s.state.geometry.seed), n = geometry.pieces.length;
  let state = initialPaperGame(geometry);
  if (p.purpose === 'relay') {
    const a = s.state;
    const validIds = (v: unknown): v is number[] => Array.isArray(v) && new Set(v).size === v.length && v.every(id => Number.isInteger(id) && id >= 0 && id < n);
    if (!validIds(a.placed) || !validIds(a.order) || a.order.length !== n || !Array.isArray(a.loose) || a.loose.length > n || new Set(a.loose.map(v => v.id)).size !== a.loose.length || !a.loose.every(v => Number.isInteger(v.id) && v.id >= 0 && v.id < n && !a.placed.includes(v.id) && Number.isFinite(v.point?.x) && Number.isFinite(v.point?.y) && Math.abs(v.point.x) <= 2000 && Math.abs(v.point.y) <= 2000) || !Number.isFinite(a.elapsedMs) || a.elapsedMs < 0 || !Number.isInteger(a.moves) || a.moves < 0) throw new Error('接力进度损坏');
    state = { ...state, placed: a.placed, order: a.order, loose: a.loose, moves: a.moves, elapsedMs: a.elapsedMs, status: a.placed.length === n ? 'completed' : a.moves ? 'playing' : 'ready', startedAt: a.moves ? 0 : null, hintsUsed: Number.isInteger(a.hintsUsed) && a.hintsUsed >= 0 ? a.hintsUsed : 0, history: Array.isArray(a.history) ? a.history.slice(-3000).filter(f => validIds(f.placed) && Number.isFinite(f.t) && Number.isFinite(f.move) && Array.isArray(f.loose) && f.loose.every((l: LoosePiece) => Number.isInteger(l.id) && l.id >= 0 && l.id < n && Number.isFinite(l.point?.x) && Number.isFinite(l.point?.y))) : [] };
  }
  return { version: 1, id: newId(), image: { blob, name: typeof s.image.name === 'string' ? s.image.name.slice(0, 120) : '朋友的拼图', originalWidth: 1600, originalHeight: 1600, crop: normalizeCrop() }, settings: s.settings, state, context: { kind: 'custom', title: typeof s.context?.title === 'string' ? s.context.title.slice(0, 80) : '朋友的拼图' }, hardMode: s.hardMode === true, hardEligible: p.purpose !== 'relay' || s.hardEligible === true || s.hardEligible !== false && state.moves === 0, savedAt: Date.now(), options: { ...safeOptions(s.options), giftPreview: false } };
}
export async function readParcel(file: File) { if (file.size > 30 * 1024 * 1024) throw new Error('拼图包不能超过30MB'); let value: unknown; try { value = JSON.parse(await file.text()); } catch { throw new Error('拼图包不是有效文件'); } return openParcel(value); }
export async function exportParcel(session: SavedSession, purpose: PuzzleParcel['purpose']) { const p = await makeParcel(session, purpose); downloadBlob(new Blob([JSON.stringify(p)], { type: 'application/json' }), `${purpose === 'relay' ? '拼图接力' : purpose === 'gift' ? '拼图礼物' : '我的挑战'}.paperpuzzle`); }
