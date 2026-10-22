import test from 'node:test';
import assert from 'node:assert/strict';
import { chapterComplete, canReadChapter, weeklyStory, weekKey, readChallenge, challengeHash, validateChallenge } from '../src/lib/experiences';
import { openParcel, makeParcel } from '../src/lib/exchange';

import { paperReducer } from '../src/lib/paperReducer';
import type { CollectionEntry } from '../src/lib/studioTypes';

import { fixture } from './fixtures';
import { qqMusicPage } from '../src/lib/qqMusic';
import { getPreferences, updatePreferences, shouldPlayShredder } from '../src/lib/preferences';
import { roomToken, rememberRoom } from '../src/lib/roomIdentity';
import { rememberShare, markShareRevoked, managedShares, refreshManagedShares } from '../src/lib/shareRegistry';
import { hardBonusEligible, restoredHardEligibility } from '../src/lib/difficulty';
import { challengeScore } from '../src/lib/paperReducer';

function withBrowserStorage(fn: (local: Map<string, string>, session: Map<string, string>) => void) {
  const local = new Map<string, string>(), session = new Map<string, string>();
  const storage = (values: Map<string, string>) => ({ get length() { return values.size; }, key: (i: number) => [...values.keys()][i] ?? null, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } });
  const descriptors = ['localStorage', 'sessionStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage(local) });
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: storage(session) });
  try { fn(local, session); } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } refreshManagedShares(); }
}

test('房间身份在关闭会话后仍可恢复，兼容旧凭据迁移并清理到期身份', () => withBrowserStorage((_local, session) => {
  const id = 'a'.repeat(36), token = 'b'.repeat(36), legacyId = 'c'.repeat(36);
  assert.equal(rememberRoom(id, token), true); session.clear(); assert.equal(roomToken(id), token);
  session.set(`paper-room-${legacyId}`, token); assert.equal(roomToken(legacyId), token); session.clear(); assert.equal(roomToken(legacyId), token);
  rememberRoom(id, token, 1); assert.equal(roomToken(id), null); assert.equal(session.has(`paper-room-${id}`), false);
}));

test('分享管理凭据与撤回状态从持久存储恢复，损坏记录不影响有效分享', () => withBrowserStorage((local) => {
  const id = 'c'.repeat(36), owner = 'd'.repeat(36);
  assert.equal(rememberShare({ id, owner, title: '一份可以撤回的礼物', createdAt: 1, expiresAt: Date.now() + 10000 }), true);
  local.set('paper-managed-share-invalid', '{bad'); refreshManagedShares();
  assert.equal(managedShares().length, 1); assert.equal(managedShares()[0]!.owner, owner);
  markShareRevoked(id); refreshManagedShares(); assert.ok(managedShares()[0]!.revokedAt);
}));

test('普通放置后切换困难、关闭困难后再开启及旧存档恢复均不能补领困难加分', async () => {
  const s = fixture(); let state = s.state, eligible = true;
  state = paperReducer(state, { type: 'place', id: 0, point: state.geometry.pieces[0]!.anchor, now: 100 });
  eligible = hardBonusEligible(eligible, false, state.moves);
  assert.equal(hardBonusEligible(eligible, true, state.moves), false);
  for (let id = 1; id < 9; id++) state = paperReducer(state, { type: 'place', id, point: state.geometry.pieces[id]!.anchor, now: 100 + id });
  assert.equal(challengeScore(state, true && eligible), challengeScore(state, false));
  assert.equal(hardBonusEligible(true, true, 1), true);
  assert.equal(hardBonusEligible(hardBonusEligible(true, false, 1), true, 1), false);
  assert.equal(restoredHardEligibility({ ...s, state, hardMode: true }), false);
  const relay = openParcel(await makeParcel({ ...s, state, hardMode: true, hardEligible: false }, 'relay'));
  assert.equal(restoredHardEligibility(relay), false);
});

test('粉碎机默认每次播放；看过一次不会使动画消失，显式首次和关闭仍生效', () => {
  assert.equal(getPreferences().animation, 'every');
  const original = getPreferences(), values = new Map<string, string>();
  const descriptors = ['localStorage', 'document'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  let denied = false;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => { if (denied) throw new Error('denied'); return values.get(key) ?? null; }, setItem: (key: string, value: string) => { if (denied) throw new Error('denied'); values.set(key, value); } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dataset: {} } } });
  try {
    values.set('puzzle-shredder-seen', 'yes');
    assert.equal(shouldPlayShredder(), true); assert.equal(shouldPlayShredder(), true);
    updatePreferences({ animation: 'first' }); values.delete('puzzle-shredder-seen');
    assert.equal(shouldPlayShredder(), true); assert.equal(shouldPlayShredder(), false);
    updatePreferences({ animation: 'off' }); assert.equal(shouldPlayShredder(), false);
    denied = true; assert.equal(shouldPlayShredder(), false);
    updatePreferences({ animation: 'every' }); assert.equal(shouldPlayShredder(), true);
  } finally {
    denied = false; updatePreferences(original);
    for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});

test('外部音乐只接受QQ音乐官方页面，不接受音频、脚本、伪域名或重定向端点', () => {
  assert.equal(qqMusicPage(' https://y.qq.com/n/ryqq/playlist/123456 '), 'https://y.qq.com/n/ryqq/playlist/123456');
  assert.ok(qqMusicPage('https://y.qq.com/n/ryqq/songDetail/003Test123'));
  assert.ok(qqMusicPage('https://c.y.qq.com/base/fcgi-bin/u?__=Abc_123'));
  for (const link of ['javascript:alert(1)', 'http://y.qq.com/', 'https://y.qq.com.evil.test/', 'https://y.qq.com@evil.test/', 'https://evil.test@y.qq.com/', 'https://y.qq.com:8443/', 'https://y.qq.com/song.mp3', 'https://c.y.qq.com/redirect?url=https://evil.test', '/n/ryqq/playlist/123']) assert.equal(qqMusicPage(link), null, link);
});

test('每周来信使用周一日期，跨年稳定且不能跳章', () => {
  assert.equal(weekKey('2026-10-25'), '2026-10-19'); assert.equal(weekKey('2027-01-01'), '2026-12-28');
  assert.deepEqual(weeklyStory('2026-10-20'), weeklyStory('2026-10-25'));
  assert.equal(canReadChapter([], '2026-10-19', 1), false); assert.equal(canReadChapter([], '2026-10-19', -1), false);
  const entries = [{ options: { weekly: { week: '2026-10-19', index: 0 } } }] as CollectionEntry[];
  assert.equal(chapterComplete(entries, '2026-10-19', 0), true); assert.equal(canReadChapter(entries, '2026-10-19', 1), true); assert.equal(canReadChapter(entries, '2026-10-26', 1), false);
});
test('内置挑战链接能精确恢复轮廓与种子，非法内容被拒绝', () => {
  const value = { v: 1 as const, art: 'little-mountains', seed: 37, settings: fixture().settings, mode: 'restore' as const, title: '你来试试看' };
  assert.deepEqual(readChallenge(challengeHash(value)), value);
  assert.equal(readChallenge('#puzzle=%ZZ'), null); assert.equal(validateChallenge({ ...value, art: 'https://untrusted.test/x' }), false);
  assert.equal(validateChallenge({ ...value, settings: { ...value.settings, pieceCount: 101 } }), false);
});
test('礼物包和接力包保留不同语义，导入重建几何而不信任外部路径', async () => {
  const s = fixture(), p = s.state.geometry.pieces[0]!;
  s.state = paperReducer(s.state, { type: 'place', id: 0, point: p.anchor, now: 100 });
  const relay = await makeParcel(s, 'relay'), gift = await makeParcel(s, 'gift');
  assert.equal(openParcel(relay).state.placed.length, 1); assert.equal(openParcel(gift).state.placed.length, 0);
  assert.equal(openParcel(gift).options?.gift?.message, '拼完见');
  const tampered = { ...relay, session: { ...relay.session, state: { ...relay.session.state, geometry: { ...relay.session.state.geometry, outlinePath: '<script>' } } } };
  assert.notEqual(openParcel(tampered).state.geometry.outlinePath, '<script>');
  assert.throws(() => openParcel({ ...relay, session: { ...relay.session, image: { ...relay.session.image, data: 'data:image/svg+xml;base64,PHN2Zz4=' } } }));
  assert.throws(() => openParcel({ ...relay, session: { ...relay.session, state: { ...relay.session.state, placed: [0, 0] } } }));
});
test('操作回放记录暂放、收回、整片归位，选片和提示不增加帧', () => {
  let state = fixture().state;
  state = paperReducer(state, { type: 'select', id: 0 }); state = paperReducer(state, { type: 'hint' }); assert.equal(state.history?.length, 1);
  state = paperReducer(state, { type: 'place', id: 0, point: { x: 500, y: 900 }, now: 1 });
  state = paperReducer(state, { type: 'return', id: 0 });
  state = paperReducer(state, { type: 'place', id: 0, point: state.geometry.pieces[0]!.anchor, now: 100 });
  assert.equal(state.history?.length, 4); assert.equal(state.history?.at(-1)?.placed.length, 1); assert.equal(state.history?.at(-1)?.move, 2);
});
