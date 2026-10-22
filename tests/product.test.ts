import { newId } from '../src/lib/id';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures';
import { GIFT_TEMPLATES, giftDraft, readGiftDraft, saveGiftDraft, normalizeGift, makeGiftSession, giftInvitation, gentleCollection, gentleCompleted, nextGentle } from '../src/lib/product';
import { makeParcel, openParcel, safeOptions } from '../src/lib/exchange';
import { momentCaption } from '../src/lib/momentCard';
import type { CollectionEntry } from '../src/lib/studioTypes';

test('四种礼物场景可直接使用，回送只交换称呼，不复制私人留言', () => {
  for (const template of GIFT_TEMPLATES) {
    const draft = giftDraft(template.id);
    assert.equal(draft.templateId, template.id); assert.ok(draft.title); assert.ok(draft.message);
  }
  const reply = giftDraft('everyday', { title: '原礼物', to: '小雨', from: '阿青', message: '不想公开的原信', keywords: '原线索' });
  assert.equal(reply.to, '阿青'); assert.equal(reply.from, '小雨');
  assert.ok(!reply.message.includes('不想公开的原信')); assert.ok(!reply.keywords.includes('原线索'));
  assert.ok(normalizeGift({ ...reply, title: '  ', message: '' }).title); assert.equal(normalizeGift({ ...reply, message: '' }).message, '');
});

test('邀请文案不泄露拼完揭晓的留言，长度与空称呼安全处理', () => {
  const draft = normalizeGift({ ...giftDraft(), to: '  朋友  ', from: '  我  ', message: '只在完成后揭晓的那句话' });
  const text = giftInvitation(draft, 'https://example.test/#share=abc');
  assert.ok(text.includes('朋友')); assert.ok(text.includes('来自 我')); assert.ok(text.includes('https://example.test/#share=abc'));
  assert.ok(!text.includes(draft.message));
  assert.equal(normalizeGift({ ...giftDraft(), title: 'a'.repeat(200), message: 'b'.repeat(1500) }).title.length, 80);
});

test('未发送的文字草稿可以恢复；存储拒绝或损坏时仍可编辑新礼物', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let value: string | null = null, denied = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => { if (denied) throw new Error('denied'); return value; }, setItem: (_key: string, next: string) => { if (denied) throw new Error('denied'); value = next; } } });
  try {
    const draft = { ...giftDraft('pet'), to: '朋友', message: '还没写完的话' };
    saveGiftDraft(draft); assert.deepEqual(readGiftDraft(), draft);
    value = '{broken'; assert.ok(readGiftDraft().title);
    denied = true; assert.doesNotThrow(() => saveGiftDraft(draft)); assert.ok(readGiftDraft().title);
  } finally { if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else Reflect.deleteProperty(globalThis, 'localStorage'); }
});

test('发送礼物会重置试玩进度和预览身份，收件人不需要账号或房间凭据', async () => {
  const s = fixture(), image = { ...s.image, url: URL.createObjectURL(s.image.blob) };
  try {
    const preview = makeGiftSession(image, s.settings, giftDraft(), undefined, true);
    assert.equal(preview.options?.giftPreview, true); assert.equal(preview.state.placed.length, 0);
    const parcel = await makeParcel({ ...preview, state: { ...preview.state, placed: [0], moves: 1 } }, 'gift');
    assert.equal(parcel.session.options?.giftPreview, undefined); assert.equal(parcel.session.state.moves, 0);
    const received = openParcel(parcel); assert.equal(received.options?.giftPreview, false); assert.equal(received.state.placed.length, 0);
    assert.equal(received.options?.gift?.message, preview.options?.gift?.message);
    assert.equal(safeOptions(preview.options).giftPreview, true);
  } finally { URL.revokeObjectURL(image.url); }
});

test('本周三幅小风景可复现，收藏决定下一幅且不锁关、不要求连续签到', () => {
  const a = gentleCollection('2026-10-21'), b = gentleCollection('2026-10-25');
  assert.equal(a.week, b.week); assert.deepEqual(a.items.map(i => i.id), b.items.map(i => i.id));
  assert.equal(new Set(a.items.map(i => i.id)).size, 3);
  assert.ok(a.items.every(i => !!i.image));
  const entry: CollectionEntry = { ...fixture(), completedAt: 1, score: 1, options: { mode: 'classic', relaxed: true, gentle: { week: a.week, index: 1 } } };
  assert.equal(gentleCompleted([entry], a.week, 1), true); assert.equal(nextGentle([entry], a.week), 0);
  const all = [0, 1, 2].map(index => ({ ...entry, options: { ...entry.options!, gentle: { week: a.week, index } } }));
  assert.equal(nextGentle(all, a.week), 0);
  assert.equal(safeOptions({ mode: 'classic', gentle: { week: 'bad', index: 100 } }).gentle, undefined);
});

test('分享卡默认配文不包含私人留言、姓名、照片文件名或分数', () => {
  const entry: CollectionEntry = { ...fixture(), completedAt: 1, score: 1234 };
  const caption = momentCaption(entry);
  assert.ok(!caption.includes(entry.options!.gift!.message)); assert.ok(!caption.includes(entry.image.name));
  assert.ok(!caption.includes('1234')); assert.ok(!caption.includes(entry.options!.gift!.to));
  assert.ok(momentCaption({ ...entry, options: { mode: 'classic', relaxed: true } }).includes('留给自己'));
});

// 使用 getRandomValues，覆盖手机局域网 HTTP 没有 randomUUID 的场景。
test('局域网 ID 不依赖安全上下文的 randomUUID，生成合法且不同的 UUID', () => {
  const original = crypto.randomUUID;
  Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: undefined });
  try {
    const values = Array.from({ length: 100 }, () => newId());
    assert.equal(new Set(values).size, 100);
    for (const id of values) assert.match(id, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  } finally { Object.defineProperty(crypto, 'randomUUID', { configurable: true, value: original }); }
});
