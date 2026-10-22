import { newId } from './id';
import type { PuzzleImage } from '../types';
import type { GiftNote } from './experiences';
import { weekKey } from './experiences';
import { ARTWORKS, dateKey, hashText } from './catalog';
import type { CollectionEntry, SavedSession } from './studioTypes';
import { generatePaperGeometry, newSeed } from './paperGeometry';
import type { PuzzleSettings } from './paperGeometry';
import { initialPaperGame } from './paperReducer';

export const GIFT_TEMPLATES = [
  { id: 'travel', symbol: '↗', label: '那次旅行', title: '把那次旅行，再走一遍', message: '风景很美，但我更想记住的是，身旁刚好有你。下一次，我们还一起出发。', keywords: '远方、沿途、一起走过', art: 'little-mountains' },
  { id: 'pet', symbol: '♧', label: '我家小可爱', title: '今天的小可爱，分你一点', message: '把这份毛茸茸的快乐送给你。希望拼好的这一刻，你也忍不住笑了一下。', keywords: '小可爱、日常、一点快乐', art: 'forest-fox' },
  { id: 'graduation', symbol: '✧', label: '我们的合照', title: '毕业以后，我们还会再见', message: '相机留住了这一天，纸片替我把想说的话留下。去各自的远方，也记得常常见面。', keywords: '合照、夏天、下一次见面', art: 'bedroom' },
  { id: 'everyday', symbol: '✉', label: '只是想你', title: '有句话，想等你拼完再说', message: '也没有什么特别的事，只是看见这张照片，就想把今天的一点喜欢送给你。', keywords: '一张照片、一点喜欢、一个惊喜', art: 'snow-fox' },
] as const;

export interface GiftDraft extends GiftNote { templateId: string; mode: 'classic' | 'mystery' }
const DRAFT_KEY = 'paper-gift-letter-draft-v1';
export function readGiftDraft(): GiftDraft {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<GiftDraft> | null;
    if (!value || !['title', 'to', 'from', 'message', 'keywords', 'templateId'].every(key => typeof value[key as keyof GiftDraft] === 'string')) return giftDraft();
    const base = giftDraft(value.templateId);
    return { ...base, title: value.title!.slice(0, 80), to: value.to!.slice(0, 40), from: value.from!.slice(0, 40),
      message: value.message!.slice(0, 1200), keywords: value.keywords!.slice(0, 120), mode: value.mode === 'classic' ? 'classic' : 'mystery' };
  } catch { return giftDraft(); }
}
export function saveGiftDraft(draft: GiftDraft): void {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* 存储受限时，当前页面仍保留文字草稿。 */ }
}
export function giftDraft(templateId = 'everyday', reply?: GiftNote): GiftDraft {
  const template = GIFT_TEMPLATES.find(t => t.id === templateId) ?? GIFT_TEMPLATES[3];
  return { templateId: template.id, title: template.title, message: reply ? '收到你的心意了。这次，换我把一份喜欢送给你。' : template.message,
    keywords: template.keywords, to: reply?.from.slice(0, 40) ?? '', from: reply?.to.slice(0, 40) ?? '', mode: 'mystery' };
}
export function normalizeGift(draft: GiftDraft): GiftNote {
  const template = GIFT_TEMPLATES.find(t => t.id === draft.templateId) ?? GIFT_TEMPLATES[3];
  return { title: draft.title.trim().slice(0, 80) || template.title, to: draft.to.trim().slice(0, 40), from: draft.from.trim().slice(0, 40),
    message: draft.message.trim().slice(0, 1200), keywords: draft.keywords.trim().slice(0, 120) };
}
export function makeGiftSession(image: PuzzleImage, settings: PuzzleSettings, draft: GiftDraft, artworkId?: string, preview = false): SavedSession {
  const note = normalizeGift(draft);
  return { version: 1, id: newId(), image: { blob: image.blob, sourceBlob: image.sourceBlob, crop: image.crop, name: image.name, originalWidth: image.originalWidth, originalHeight: image.originalHeight },
    settings, state: initialPaperGame(generatePaperGeometry(settings, newSeed())), hardMode: false, hardEligible: true,
    context: { kind: 'custom', title: note.title }, savedAt: Date.now(), options: { mode: draft.mode, gift: note, artworkId, ...(preview ? { giftPreview: true } : {}) } };
}
export function giftInvitation(note: GiftNote, url: string): string {
  return `${note.to ? `${note.to}，` : ''}送你一份可以亲手拼开的照片礼物。\n「${note.title}」\n拼完以后，还有一句话想告诉你。${note.from ? `\n来自 ${note.from}` : ''}\n${url}`;
}

const GENTLE_COLLECTIONS = [
  { title: '借一点山野', ids: ['little-mountains', 'forest-fox', 'snow-fox'] },
  { title: '去光里坐坐', ids: ['bedroom', 'bordighera', 'water-lilies'] },
  { title: '森林里的小小来信', ids: ['forest-fox', 'night-owl', 'snow-fox'] },
  { title: '把日子慢下来', ids: ['little-mountains', 'water-lilies', 'night-owl'] },
] as const;
export function gentleCollection(day = dateKey()) {
  const week = weekKey(day), collection = GENTLE_COLLECTIONS[hashText(week) % GENTLE_COLLECTIONS.length]!;
  return { week, title: collection.title, items: collection.ids.map(id => ARTWORKS.find(a => a.id === id)!) };
}
export function gentleCompleted(entries: readonly CollectionEntry[], week: string, index: number): boolean {
  return entries.some(e => e.options?.gentle?.week === week && e.options.gentle.index === index);
}
export function nextGentle(entries: readonly CollectionEntry[], week: string): number {
  const index = [0, 1, 2].find(i => !gentleCompleted(entries, week, i));
  return index ?? 0;
}
