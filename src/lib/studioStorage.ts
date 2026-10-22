import type { CollectionEntry, SavedSession } from './studioTypes';
import { validateOutline } from './paperGeometry';

let opening: Promise<IDBDatabase> | null = null;
function database(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('piece-by-piece-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('records');
    request.onerror = () => reject(request.error ?? new Error('无法打开本地存储'));
    request.onblocked = () => reject(new Error('请关闭其他旧版拼图标签页后重试'));
    request.onsuccess = () => { const db = request.result; db.onversionchange = () => { db.close(); opening = null; }; resolve(db); };
  }).catch(error => { opening = null; throw error; });
  return opening;
}
export async function readRecord<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => { const r = db.transaction('records').objectStore('records').get(key); r.onsuccess = () => resolve(r.result as T | undefined); r.onerror = () => reject(r.error); });
}
export async function writeRecord(key: string, value: unknown): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => { const t = db.transaction('records', 'readwrite'); t.objectStore('records').put(value, key); t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error ?? new Error('本地存储空间不足')); });
}
export function validSession(value: unknown): value is SavedSession {
  try {
  if (!value || typeof value !== 'object') return false;
  const s = value as SavedSession;
  if (s.version !== 1 || typeof s.id !== 'string' || !(s.image?.blob instanceof Blob) || !s.image.blob.size || !s.settings || !s.state || !s.context) return false;
  const n = s.settings.pieceCount;
  if (!Number.isInteger(n) || n < 4 || n > 100 || s.state.geometry?.pieces?.length !== n || validateOutline(s.state.geometry.outline) || !Number.isFinite(s.state.elapsedMs) || s.state.elapsedMs < 0) return false;
  const ids = new Set(s.state.geometry.pieces.map(p => p.id));
  return ['square', 'circle', 'heart', 'star', 'hexagon', 'custom'].includes(s.settings.shape) && ['ready', 'playing', 'completed'].includes(s.state.status) && (s.state.status !== 'completed' || s.state.placed.length === n) && ids.size === n && s.state.geometry.pieces.every((p, i) => p.id === i && Number.isFinite(p.anchor.x) && Number.isFinite(p.anchor.y)) && s.state.order.length === n && new Set(s.state.order).size === n && s.state.order.every(id => ids.has(id)) &&
    new Set(s.state.placed).size === s.state.placed.length && s.state.placed.every(id => ids.has(id)) && Array.isArray(s.state.loose) && new Set(s.state.loose.map(p => p.id)).size === s.state.loose.length && s.state.loose.every(p => ids.has(p.id) && !s.state.placed.includes(p.id) && Number.isFinite(p.point.x) && Number.isFinite(p.point.y)) && Array.isArray(s.state.marked) && Number.isInteger(s.state.moves) && s.state.moves >= 0 && Number.isInteger(s.state.hintsUsed) && s.state.hintsUsed >= 0 && ['custom', 'campaign', 'daily', 'theme', 'weekly'].includes(s.context.kind);
  } catch { return false; }
}
export async function saveCollection(entry: CollectionEntry): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite'), store = t.objectStore('records');
    const r = store.get('collection');
    r.onsuccess = () => { const list = Array.isArray(r.result) ? r.result as CollectionEntry[] : []; store.put([entry, ...list.filter(item => item.id !== entry.id)], 'collection'); };
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error); t.onabort = () => reject(t.error);
  });
}
export async function clearSession(id?: string): Promise<void> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const t = db.transaction('records', 'readwrite'), store = t.objectStore('records'), r = store.get('session');
    r.onsuccess = () => { if (!id || (r.result as SavedSession | undefined)?.id === id) store.delete('session'); };
    t.oncomplete = () => resolve(); t.onerror = () => reject(t.error);
  });
}
