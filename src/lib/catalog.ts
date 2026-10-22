import { LEVELS, levelImage, levelThumbnail } from './levels';
import type { PuzzleSettings, ShapeKind } from './paperGeometry';
import type { CollectionEntry } from './studioTypes';

export interface Artwork { id: string; title: string; image: string; thumbnail: string; svg?: string }
function forestAnimal(owl = false, snow = false): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="${snow ? '#dce9e6' : '#e9dec0'}"/><circle cx="770" cy="210" r="115" fill="#e9b665"/><path d="M0 560 200 270 420 580 660 200 1000 580V1000H0" fill="#97aa8b"/><path d="M0 720 250 450 480 760 780 440 1000 700V1000H0" fill="#476f5b"/><path d="M0 840Q250 700 500 860T1000 790V1000H0" fill="${snow ? '#f5f7ed' : '#bbc99b'}"/>${owl ? '<ellipse cx="510" cy="670" rx="175" ry="220" fill="#98785e"/><path d="M340 560 335 370 470 470 560 470 690 370 680 560" fill="#98785e"/><circle cx="440" cy="560" r="90" fill="#e6d9b7"/><circle cx="590" cy="560" r="90" fill="#e6d9b7"/><circle cx="450" cy="560" r="30" fill="#273f37"/><circle cx="580" cy="560" r="30" fill="#273f37"/><path d="m490 615 50 0-25 55" fill="#d6a24e"/><path d="M420 760q95 100 190 0M435 710q80 85 160 0" fill="none" stroke="#d1ba8e" stroke-width="18"/>' : '<path d="M330 750Q140 580 170 420 390 500 430 740" fill="#cb7845"/><path d="M170 420q0 150 90 200l45-105" fill="#faf0d8"/><ellipse cx="530" cy="780" rx="160" ry="140" fill="#bf6a3e"/><path d="M370 490 370 280 480 420 600 420 730 280 700 520 550 700Z" fill="#d88d4f"/><path d="m390 500 160 150 140-150-40 155-100 65-110-70" fill="#f5e6cb"/><path d="m438 505 35 10m135-10-35 10" stroke="#273f37" stroke-width="17" stroke-linecap="round"/><path d="m520 610 60 0-30 35" fill="#273f37"/>'}<g fill="#ecedcf"><circle cx="100" cy="900" r="7"/><circle cx="850" cy="800" r="6"/><circle cx="920" cy="910" r="7"/><circle cx="270" cy="850" r="5"/></g></svg>`;
}
function original(id: string, title: string, svg: string): Artwork { const image = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; return { id, title, image, thumbnail: image, svg }; }
export const ORIGINALS = [original('forest-fox', '林间的狐狸', forestAnimal()), original('night-owl', '树下的猫头鹰', forestAnimal(true)), original('snow-fox', '雪地来信', forestAnimal(false, true))];
export const ARTWORKS: readonly Artwork[] = [...LEVELS.map(level => ({ id: level.id, title: level.title, image: levelImage(level), thumbnail: levelThumbnail(level) })), ...ORIGINALS, { id: 'little-mountains', title: '山野来信', image: `${(import.meta.env?.BASE_URL ?? '/')}sample.svg`, thumbnail: `${(import.meta.env?.BASE_URL ?? '/')}sample.svg` }];
export const THEMES = [
  { id: 'nature', title: '山水与花园', description: '跟着光和水，慢慢走进自然。', ids: ['little-mountains', 'bordighera', 'water-lilies'] },
  { id: 'places', title: '城市与房间', description: '把熟悉的角落，拼成新的风景。', ids: ['bedroom', 'paris-rain', 'grande-jatte'] },
  { id: 'animals', title: '森林里的朋友', description: '三幅为这里绘制的原创动物插画。', ids: ['forest-fox', 'night-owl', 'snow-fox'] }
] as const;
export function dateKey(date = new Date()): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function hashText(text: string): number { let hash = 2166136261; for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return hash >>> 0; }
export function dailyPuzzle(date = dateKey()) {
  const seed = hashText(`daily-v1-${date}`), artwork = ARTWORKS[seed % ARTWORKS.length]!;
  const shapes: ShapeKind[] = ['circle', 'heart', 'hexagon', 'star'];
  const settings: PuzzleSettings = { pieceCount: [9, 16, 25, 36][(seed >>> 6) % 4]!, shape: shapes[(seed >>> 9) % 4]!, customOutline: [] };
  return { date, seed, artwork, settings };
}
export function shiftDate(date: string, offset: number): string { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
export function dailyStreak(entries: readonly CollectionEntry[], today = dateKey()): number {
  const days = new Set(entries.filter(e => e.context.kind === 'daily').map(e => e.context.date));
  let day = days.has(today) ? today : shiftDate(today, -1), streak = 0;
  while (days.has(day)) { streak++; day = shiftDate(day, -1); }
  return streak;
}
export const themeSettings = (index: number): PuzzleSettings => ({ pieceCount: [9, 25, 49][index] ?? 9, shape: (['circle', 'heart', 'hexagon'] as const)[index] ?? 'circle', customOutline: [] });

