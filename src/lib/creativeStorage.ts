import { useSyncExternalStore } from 'react';
export interface MemoryAlbum { id: string; title: string; paper: 'cream' | 'rose' | 'sage'; pages: { entryId: string; caption: string }[] }
export interface RoomItem { id: string; x: number; y: number }
interface CreativeState { albums: MemoryAlbum[]; room: RoomItem[]; frameId?: string }
const initial: CreativeState = { albums: [], room: [{ id: 'plant', x: 70, y: 68 }, { id: 'stamp', x: 20, y: 40 }] };
let state: CreativeState = initial;
try { const parsed = JSON.parse(localStorage.getItem('piece-creative-life') ?? 'null') as CreativeState | null; if (parsed && Array.isArray(parsed.albums) && Array.isArray(parsed.room)) state = { albums: parsed.albums.filter(a => typeof a.id === 'string' && typeof a.title === 'string' && ['cream', 'rose', 'sage'].includes(a.paper) && Array.isArray(a.pages) && a.pages.every(p => typeof p.entryId === 'string' && typeof p.caption === 'string')), room: parsed.room.filter(i => ['plant', 'stamp', 'lamp', 'cat', 'vase'].includes(i.id) && Number.isFinite(i.x) && Number.isFinite(i.y)), frameId: parsed.frameId }; } catch { /* 初次使用从空回忆册开始。 */ }
const listeners = new Set<() => void>();
export function saveCreative(patch: Partial<CreativeState>) { const next = { ...state, ...patch }; localStorage.setItem('piece-creative-life', JSON.stringify(next)); state = next; listeners.forEach(fn => fn()); }
export function useCreative() { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state); }
export const ROOM_REWARDS = [{ id: 'plant', title: '窗边绿植', symbol: '♧', at: 1 }, { id: 'stamp', title: '旅行邮票', symbol: '✉', at: 2 }, { id: 'lamp', title: '一盏暖灯', symbol: '☀', at: 3 }, { id: 'vase', title: '桌上的花', symbol: '❀', at: 5 }, { id: 'cat', title: '打盹的小猫', symbol: 'ฅ', at: 8 }] as const;
