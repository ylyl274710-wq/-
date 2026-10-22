import { ARTWORKS, dateKey, hashText, shiftDate } from './catalog';
import type { CollectionEntry } from './studioTypes';
import type { PuzzleSettings } from './paperGeometry';

export interface GiftNote { title: string; to: string; from: string; message: string; keywords: string }
export interface PlayOptions { mode: 'classic' | 'mystery' | 'restore'; gift?: GiftNote; duo?: readonly [string, string]; artworkId?: string; weekly?: { week: string; index: number }; relaxed?: boolean; giftPreview?: boolean; gentle?: { week: string; index: number } }
export const QUICK_PLAYS = [
  { id: 'break', title: '休息三分钟', detail: '9片 · 从一幅小风景开始', count: 9, shape: 'circle', mode: 'classic', art: 'little-mountains', symbol: '☀' },
  { id: 'challenge', title: '想挑战一下', detail: '36片 · 拼开一份未知', count: 36, shape: 'hexagon', mode: 'mystery', art: 'forest-fox', symbol: '✧' },
  { id: 'slow', title: '今天慢慢拼', detail: '64片 · 让旧画重新鲜亮', count: 64, shape: 'square', mode: 'restore', art: 'water-lilies', symbol: '❀' }
] as const;
export function weekKey(day = dateKey()): string { const d = new Date(`${day}T12:00:00Z`); return shiftDate(day, -(d.getUTCDay() + 6) % 7); }
const STORIES = [
  { title: '山间邮差', chapters: [
    { art: 'little-mountains', title: '寄往山里的信', clue: '小屋、山路、一个迟到的约定', letter: '第一封信抵达时，屋前的花开了。信上只有一句：请替我记住，这条回家的路。' },
    { art: 'forest-fox', title: '森林里的引路人', clue: '松林、狐狸、一枚铜色邮戳', letter: '狐狸把一枚邮戳留在路口。原来每一封看似走失的信，都有人悄悄送过下一段路。' },
    { art: 'snow-fox', title: '冬天以前的回信', clue: '雪地、阳光、终于相遇', letter: '雪落下之前，回信终于来了：我一直在。谢谢你，把这些零散的想念一片片送回家。' }
  ] },
  { title: '借来的一天', chapters: [
    { art: 'bedroom', title: '清晨的房间', clue: '一张床、两把椅子、无人催促的清晨', letter: '今天不用赶路。把窗打开，让光先走进来，再慢慢决定去哪里。' },
    { art: 'bordighera', title: '沿海岸散步', clue: '树荫、远海、一个漫长的下午', letter: '你沿着树影走了很久，口袋里没有任务，只有一张还没写完的明信片。' },
    { art: 'water-lilies', title: '把黄昏留下', clue: '水面、花、缓慢的涟漪', letter: '借来的一天结束了。你没有带回什么特别的东西，只有此刻的安静。它已经很好。' }
  ] }
];
export function weeklyStory(day = dateKey()) { const week = weekKey(day), story = STORIES[hashText(week) % STORIES.length]!; return { ...story, week }; }
export const chapterSettings = (index: number): PuzzleSettings => ({ pieceCount: [9, 16, 25][index] ?? 9, shape: (['circle', 'heart', 'hexagon'] as const)[index] ?? 'circle', customOutline: [] });
export function chapterComplete(entries: readonly CollectionEntry[], week: string, index: number) { return entries.some(e => e.options?.weekly?.week === week && e.options.weekly.index === index); }
export function canReadChapter(entries: readonly CollectionEntry[], week: string, index: number) { return Number.isInteger(index) && index >= 0 && index < 3 && (index === 0 || chapterComplete(entries, week, index - 1)); }
export function weeklyChapter(week: string, index: number) { const story = weeklyStory(week); return story.chapters[index]; }

export interface SharedChallenge { v: 1; art: string; seed: number; settings: PuzzleSettings; mode: PlayOptions['mode']; title: string }
export function validateChallenge(value: unknown): value is SharedChallenge {
  if (!value || typeof value !== 'object') return false;
  const c = value as SharedChallenge;
  return c.v === 1 && ARTWORKS.some(a => a.id === c.art) && Number.isInteger(c.seed) && c.seed >= 0 && c.seed <= 4294967295 && validSettings(c.settings) && ['classic', 'mystery', 'restore'].includes(c.mode) && typeof c.title === 'string' && c.title.length <= 80;
}
import { validateOutline } from './paperGeometry';
export function validSettings(value: unknown): value is PuzzleSettings {
  if (!value || typeof value !== 'object') return false;
  const s = value as PuzzleSettings;
  return Number.isInteger(s.pieceCount) && s.pieceCount >= 4 && s.pieceCount <= 100 && ['circle', 'heart', 'star', 'hexagon', 'square', 'custom'].includes(s.shape) && Array.isArray(s.customOutline) && s.customOutline.length <= 160 && (s.shape !== 'custom' || validateOutline(s.customOutline) === null);
}
export function challengeHash(value: SharedChallenge): string { if (!validateChallenge(value)) throw new Error('挑战设置无效'); return `#puzzle=${encodeURIComponent(JSON.stringify(value))}`; }
export function readChallenge(hash: string): SharedChallenge | null { try { if (!hash.startsWith('#puzzle=') || hash.length > 20000) return null; const value: unknown = JSON.parse(decodeURIComponent(hash.slice(8))); return validateChallenge(value) ? value : null; } catch { return null; } }
