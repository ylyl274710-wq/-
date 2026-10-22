import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePaperGeometry, pointInPolygon, shapeOutline, validateOutline, polygonArea, seededRandom } from '../src/lib/paperGeometry';
import type { PuzzleSettings, ShapeKind } from '../src/lib/paperGeometry';
import { initialPaperGame, paperReducer } from '../src/hooks/usePaperGame';
import { releaseImageResource, renewImageResource } from '../src/lib/imageResource';
import { fitBoardLayout } from '../src/lib/boardLayout';
import { connectedGroup, neighbors, restorePaperGame, challengeScore } from '../src/lib/paperReducer';
import { dailyPuzzle, dailyStreak, shiftDate } from '../src/lib/catalog';
import { validSession } from '../src/lib/studioStorage';
import type { CollectionEntry, SavedSession } from '../src/lib/studioTypes';
import { cropRegion, normalizeCrop } from '../src/lib/crop';
import { createAmbience } from '../src/lib/ambience';
import { exportMemoryCard } from '../src/lib/memoryCard';

test('纪念卡绘制真实分数，下载文件名采用本地完成日期', async () => {
  const geometry = generatePaperGeometry({ shape: 'circle', pieceCount: 9, customOutline: [] }, 8);
  const state = { ...initialPaperGame(geometry), placed: geometry.pieces.map(p => p.id), status: 'completed' as const, moves: 9, elapsedMs: 3000 };
  const entry: CollectionEntry = { version: 1, id: 'card-test', image: { blob: new Blob(['image']), name: '测试照片', originalWidth: 1000, originalHeight: 1000 }, settings: { shape: 'circle', pieceCount: 9, customOutline: [] }, state, hardMode: false, context: { kind: 'custom' }, savedAt: 0, completedAt: new Date(2026, 9, 20, 0, 10).getTime(), score: 2172 };
  const texts: string[] = [];
  const context = { fillStyle: '', strokeStyle: '', font: '', textAlign: '', fillRect() {}, strokeRect() {}, save() {}, translate() {}, scale() {}, clip() {}, drawImage() {}, restore() {}, fillText(text: string) { texts.push(text); } };
  let clicked = false;
  const anchor = { href: '', download: '', click() { clicked = true; } };
  const mocks = {
    document: { createElement(tag: string) { return tag === 'canvas' ? { width: 0, height: 0, getContext: () => context, toBlob(callback: (blob: Blob) => void) { callback(new Blob(['png'], { type: 'image/png' })); } } : anchor; } },
    Image: class { src = ''; decode() { return Promise.resolve(); } },
    Path2D: class {},
    window: { setTimeout(callback: () => void) { callback(); return 0; } }
  };
  const descriptors = Object.keys(mocks).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const [key, value] of Object.entries(mocks)) Object.defineProperty(globalThis, key, { configurable: true, value });
  try {
    await exportMemoryCard(entry);
    assert.ok(texts.includes('2172 分')); assert.ok(texts.some(text => text.includes('9 次放置')));
    assert.equal(anchor.download, '片刻拼图-2026-10-20.png'); assert.equal(clicked, true);
  } finally { for (const [key, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } }
});

test('构图从原图坐标恢复，保存与重开一致，越界和旧数据安全归一', () => {
  const crop = { zoom: 2.25, cx: .65, cy: .38 };
  const region = cropRegion(2000, 1200, crop);
  const persisted = JSON.parse(JSON.stringify(crop));
  assert.deepEqual(cropRegion(2000, 1200, normalizeCrop(persisted)), region);
  const edge = cropRegion(2000, 1200, { zoom: 2, cx: 1, cy: -1 });
  assert.deepEqual(edge, { x: 1400, y: 0, side: 600 });
  assert.deepEqual(cropRegion(2000, 1200), { x: 400, y: 0, side: 1200 });
  assert.deepEqual(normalizeCrop({ zoom: NaN, cx: Infinity, cy: -.5 }), { zoom: 1, cx: .5, cy: 0 });
  const blob = new Blob(['photo']);
  const renewed = renewImageResource({ url: '', blob, name: 'photo.png', originalWidth: 2000, originalHeight: 1200, crop });
  try { assert.deepEqual(renewed.crop, crop); } finally { releaseImageResource(renewed); }
});

test('三种环境声的零音量完全静音，调制不能绕过总音量，停止会清理节点', () => {
  class Param {
    value = 0;
    cancelScheduledValues() {}
    setTargetAtTime(value: number) { this.value = value; }
    setValueAtTime(value: number) { this.value = value; }
  }
  class Node {
    gain = new Param(); frequency = new Param(); buffer: unknown; loop = false; type = ''; targets: unknown[] = []; disconnected = false;
    connect(target: unknown) { this.targets.push(target); }
    start() {} stop() {} disconnect() { this.disconnected = true; }
  }
  class Context {
    static latest: Context;
    sampleRate = 16; currentTime = 0; destination = {}; gains: Node[] = []; closed = false;
    constructor() { Context.latest = this; }
    createGain() { const node = new Node(); this.gains.push(node); return node; }
    createBuffer() { return { getChannelData: () => new Float32Array(128) }; }
    createBufferSource() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createOscillator() { return new Node(); }
    resume() { return Promise.resolve(); }
    close() { this.closed = true; return Promise.resolve(); }
  }
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: Context });
  try {
    for (const kind of ['rain', 'fire', 'sea'] as const) {
      const ambient = createAmbience(kind, 0), context = Context.latest, master = context.gains[0]!;
      assert.equal(master.gain.value, 0);
      assert.ok(context.gains.every(node => !node.targets.includes(master.gain)));
      ambient.volume(60); assert.ok(master.gain.value > 0);
      ambient.volume(0); assert.equal(master.gain.value, 0);
      ambient.stop(); assert.equal(context.closed, true); assert.ok(context.gains.every(node => node.disconnected));
    }
  } finally { if (descriptor) Object.defineProperty(globalThis, 'AudioContext', descriptor); else Reflect.deleteProperty(globalThis, 'AudioContext'); }
});

test('暂放的相邻纸片能接成组合并一起归位', () => {
  const geometry = generatePaperGeometry({ shape: 'square', pieceCount: 16, customOutline: [] }, 73);
  const adjacent = neighbors(geometry), a = 0, b = [...adjacent.get(a)!][0]!;
  assert.ok(Number.isInteger(b));
  let state = initialPaperGame(geometry);
  const anchorA = geometry.pieces[a]!.anchor, anchorB = geometry.pieces[b]!.anchor;
  state = paperReducer(state, { type: 'place', id: a, point: { x: anchorA.x + 100, y: anchorA.y + 100 }, now: 10 });
  state = paperReducer(state, { type: 'place', id: b, point: { x: anchorB.x + 110, y: anchorB.y + 105 }, now: 20 });
  assert.equal(state.placed.length, 0); assert.equal(state.loose.length, 2);
  assert.deepEqual(new Set(connectedGroup(state, a)), new Set([a, b]));
  state = paperReducer(state, { type: 'place', id: a, point: anchorA, now: 30 });
  assert.equal(state.placed.length, 2); assert.equal(state.loose.length, 0); assert.equal(state.moves, 3);
});

test('提示、标记、收回与恢复不会丢失计分状态，离线时间不计入用时', () => {
  let state = initialPaperGame(generatePaperGeometry({ shape: 'circle', pieceCount: 25, customOutline: [] }, 102));
  state = paperReducer(state, { type: 'select', id: 7 });
  state = paperReducer(state, { type: 'hint' }); assert.equal(state.hintsUsed, 1); assert.notEqual(state.hinted, null);
  state = paperReducer(state, { type: 'mark' }); assert.equal(state.marked.length, 1);
  state = paperReducer(state, { type: 'assist', now: 1000 }); assert.equal(state.hintsUsed, 2); assert.equal(state.placed.length, 1);
  state = paperReducer(state, { type: 'tick', now: 3500 });
  const restored = restorePaperGame(state, 100000);
  assert.equal(restored.elapsedMs, 2500); assert.equal(restored.startedAt, 97500); assert.equal(restored.hintsUsed, 2);
  assert.equal(paperReducer(restored, { type: 'tick', now: 100500 }).elapsedMs, 3000);
  assert.ok(challengeScore({ ...state, hintsUsed: 0 }, false) > challengeScore(state, false));
  assert.ok(challengeScore(state, true) > challengeScore(state, false));
});

test('提示仅高亮当前选择，保留纸片位置与计时，换选和取消会清除高亮', () => {
  let state = initialPaperGame(generatePaperGeometry({ shape: 'star', pieceCount: 25, customOutline: [] }, 101));
  assert.equal(paperReducer(state, { type: 'hint' }), state);
  state = paperReducer(state, { type: 'select', id: 19 });
  state = paperReducer(state, { type: 'hint' });
  assert.equal(state.hinted, 19); assert.equal(state.selected, 19); assert.equal(state.hintsUsed, 1);
  assert.equal(state.moves, 0); assert.equal(state.startedAt, null); assert.equal(state.placed.length, 0); assert.equal(state.loose.length, 0);
  state = paperReducer(state, { type: 'select', id: 4 });
  assert.equal(state.hinted, null);
  state = paperReducer(state, { type: 'place', id: 4, point: { x: 120, y: 800 }, now: 100 });
  state = paperReducer(state, { type: 'select', id: 4 });
  if (state.selected === null) state = paperReducer(state, { type: 'select', id: 4 });
  const before = state;
  state = paperReducer(state, { type: 'hint' });
  assert.equal(state.hinted, 4); assert.deepEqual(state.loose, before.loose); assert.deepEqual(state.placed, before.placed); assert.equal(state.moves, before.moves); assert.equal(state.startedAt, before.startedAt);
  state = paperReducer(state, { type: 'deselect' }); assert.equal(state.hinted, null);
});

test('每日挑战按日期可复现，连续完成天数跨月正确', () => {
  assert.deepEqual(dailyPuzzle('2026-10-19'), dailyPuzzle('2026-10-19'));
  assert.notEqual(dailyPuzzle('2026-10-19').seed, dailyPuzzle('2026-10-20').seed);
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  const entries = ['2026-10-18', '2026-10-17', '2026-10-16'].map(date => ({ context: { kind: 'daily', date } })) as CollectionEntry[];
  assert.equal(dailyStreak(entries, '2026-10-19'), 3);
  assert.equal(dailyStreak(entries, '2026-10-20'), 0);
});

test('本地存档验证拒绝损坏数据、重复纸片和错误完成态', () => {
  const state = initialPaperGame(generatePaperGeometry({ shape: 'circle', pieceCount: 9, customOutline: [] }, 5));
  const session: SavedSession = { version: 1, id: 'test-run', image: { blob: new Blob(['image']), name: 'local.png', originalWidth: 800, originalHeight: 800 }, settings: { shape: 'circle', pieceCount: 9, customOutline: [] }, state, hardMode: false, context: { kind: 'custom' }, savedAt: Date.now() };
  assert.equal(validSession(session), true);
  for (const bad of [null, {}, { ...session, image: {} }, { ...session, state: { ...state, geometry: {} } }, { ...session, state: { ...state, status: 'completed' } }, { ...session, state: { ...state, placed: [1, 1] } }]) assert.equal(validSession(bad), false);
});

test('单屏布局容纳所有纸片，桌面与手机的网格均不超出可用区域', () => {
  for (const [width, height] of [[1400, 620], [1000, 480], [355, 600], [300, 390], [780, 250]]) {
    for (const count of [4, 9, 36, 64, 100]) {
      const layout = fitBoardLayout(width!, height!, count);
      const trayWidth = layout.stacked ? width! : width! - layout.boardSize - 20;
      const trayHeight = layout.stacked ? height! - layout.boardSize - 10 : height!;
      const rows = Math.ceil(count / layout.columns);
      assert.ok(layout.boardSize <= width! && layout.boardSize <= height!);
      assert.ok(layout.columns * layout.pieceSize + (layout.columns - 1) * 4 <= trayWidth - 18);
      assert.ok(rows * layout.pieceSize + (rows - 1) * 4 <= trayHeight - 44);
    }
  }
});

const settings = (shape: ShapeKind, pieceCount: number): PuzzleSettings => ({ shape, pieceCount, customOutline: shapeOutline('hexagon') });

test('支持任意片数、所有预设和手绘轮廓，每片都真实可见且坐标有限', () => {
  for (const shape of ['circle', 'heart', 'star', 'hexagon', 'square', 'custom'] as ShapeKind[]) {
    for (const count of [4, 7, 17, 64, 100]) {
      const geometry = generatePaperGeometry(settings(shape, count), count + 73);
      assert.equal(geometry.pieces.length, count);
      assert.equal(new Set(geometry.pieces.map(p => p.id)).size, count);
      for (const piece of geometry.pieces) {
        assert.equal(pointInPolygon(piece.anchor, geometry.outline), true);
        assert.equal(pointInPolygon(piece.anchor, piece.polygon), true);
        assert.ok(piece.bounds.width > 0 && piece.bounds.height > 0);
        assert.ok(Object.values(piece.bounds).every(Number.isFinite));
        assert.ok(piece.polygon.length > 3);
        assert.ok(polygonArea(piece.polygon) > 0);
        assert.match(piece.path, /^M.*Z$/);
      }
    }
  }
});

test('相邻撕纸边共用，目标轮廓内采样不重叠、不留缺口', () => {
  for (const shape of ['circle', 'heart', 'star', 'custom'] as ShapeKind[]) {
    for (const seed of [1, 53, 781]) {
      const geometry = generatePaperGeometry(settings(shape, 23), seed);
      const random = seededRandom(seed + 900);
      for (let i = 0; i < 800; i++) {
        const point = { x: random() * 1000, y: random() * 1000 };
        if (!pointInPolygon(point, geometry.outline)) continue;
        const hits = geometry.pieces.filter(piece => pointInPolygon(point, piece.polygon)).length;
        assert.equal(hits, 1, `${shape}, seed ${seed}, point ${JSON.stringify(point)} should belong to one piece`);
      }
    }
  }
});

test('相同种子可复现，不同种子重新切割；不采用行列网格', () => {
  const a = generatePaperGeometry(settings('circle', 17), 42);
  const b = generatePaperGeometry(settings('circle', 17), 42);
  const c = generatePaperGeometry(settings('circle', 17), 43);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.pieces.map(p => p.path), c.pieces.map(p => p.path));
  assert.equal(new Set(a.pieces.map(p => p.anchor.x.toFixed(3))).size, 17);
  assert.equal(new Set(a.pieces.map(p => p.anchor.y.toFixed(3))).size, 17);
  assert.throws(() => generatePaperGeometry(settings('circle', 3), 1));
  assert.throws(() => generatePaperGeometry(settings('circle', 101), 1));
  assert.throws(() => generatePaperGeometry(settings('circle', 4.5), 1));
});

test('手绘轮廓拒绝交叉、过小和非法坐标，接受凹形轮廓', () => {
  assert.ok(validateOutline([]));
  assert.ok(validateOutline([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 10 }]));
  assert.ok(validateOutline([{ x: 0, y: 0 }, { x: NaN, y: 400 }, { x: 800, y: 900 }]));
  const concave = [{ x: 100, y: 100 }, { x: 900, y: 100 }, { x: 900, y: 900 }, { x: 500, y: 500 }, { x: 100, y: 900 }];
  assert.equal(validateOutline(concave), null);
  const crossing = [{ x: 100, y: 100 }, { x: 900, y: 900 }, { x: 900, y: 100 }, { x: 100, y: 900 }];
  assert.ok(validateOutline(crossing));
  const geometry = generatePaperGeometry({ shape: 'custom', customOutline: concave, pieceCount: 19 }, 32);
  assert.equal(geometry.pieces.length, 19);
});

test('纸片选择不计时；有效放置尝试计时计步，仅正确位置吸附', () => {
  const geometry = generatePaperGeometry(settings('circle', 7), 81);
  let state = initialPaperGame(geometry);
  state = paperReducer(state, { type: 'select', id: 0 });
  assert.equal(state.selected, 0); assert.equal(state.moves, 0); assert.equal(state.startedAt, null);
  state = paperReducer(state, { type: 'select', id: 0 }); assert.equal(state.selected, null);
  state = paperReducer(state, { type: 'place', id: 0, point: { x: 1000, y: 1000 }, now: 1000 });
  assert.equal(state.placed.length, 0); assert.equal(state.moves, 1); assert.equal(state.startedAt, 1000);
  state = paperReducer(state, { type: 'tick', now: 3500 }); assert.equal(state.elapsedMs, 2500);
  for (const piece of geometry.pieces) state = paperReducer(state, { type: 'place', id: piece.id, point: piece.anchor, now: 4000 + piece.id * 100 });
  assert.equal(state.status, 'completed'); assert.equal(state.placed.length, 7); assert.equal(state.moves, 8);
  const completed = state;
  assert.equal(paperReducer(state, { type: 'place', id: 0, point: geometry.pieces[0]!.anchor, now: 9000 }), completed);
  assert.equal(paperReducer(state, { type: 'tick', now: 10000 }), completed);
  state = paperReducer(state, { type: 'reset', geometry: generatePaperGeometry(settings('circle', 7), 82) });
  assert.equal(state.moves, 0); assert.equal(state.placed.length, 0); assert.equal(state.startedAt, null); assert.equal(state.status, 'ready');
});

test('非法落点、无效碎片和重复归位不改变状态', () => {
  const geometry = generatePaperGeometry(settings('heart', 11), 45);
  let state = initialPaperGame(geometry);
  assert.equal(paperReducer(state, { type: 'place', id: -1, point: { x: 500, y: 500 }, now: 1 }), state);
  assert.equal(paperReducer(state, { type: 'place', id: 0, point: { x: NaN, y: 0 }, now: 1 }), state);
  state = paperReducer(state, { type: 'place', id: 0, point: geometry.pieces[0]!.anchor, now: 100 });
  assert.equal(paperReducer(state, { type: 'place', id: 0, point: geometry.pieces[0]!.anchor, now: 200 }), state);
});

test('未通关的归位纸片可以取消选择、拖离和收回，计时与次数保留', () => {
  const geometry = generatePaperGeometry(settings('square', 9), 99), piece = geometry.pieces[0]!;
  let state = initialPaperGame(geometry);
  state = paperReducer(state, { type: 'place', id: 0, point: piece.anchor, now: 100 });
  state = paperReducer(state, { type: 'select', id: 0 });
  assert.equal(state.selected, 0);
  state = paperReducer(state, { type: 'deselect' });
  assert.equal(state.selected, null); assert.deepEqual(state.placed, [0]); assert.equal(state.moves, 1);
  state = paperReducer(state, { type: 'place', id: 0, point: { x: piece.anchor.x + 150, y: piece.anchor.y }, now: 200 });
  assert.equal(state.placed.length, 0); assert.equal(state.loose[0]?.id, 0); assert.equal(state.moves, 2);
  state = paperReducer(state, { type: 'return', id: 0 });
  assert.equal(state.loose.length, 0); assert.equal(state.selected, null); assert.equal(state.moves, 2); assert.equal(state.startedAt, 100);
  state = paperReducer(state, { type: 'place', id: 0, point: piece.anchor, now: 300 });
  state = paperReducer(state, { type: 'select', id: 0 });
  state = paperReducer(state, { type: 'return' });
  assert.equal(state.placed.length, 0); assert.ok(state.order.includes(0)); assert.equal(state.moves, 3);
});

test('取消组合选择不拆组，拖回纸片盒收回整组并清除提示', () => {
  const geometry = generatePaperGeometry(settings('square', 16), 73), a = 0, b = [...neighbors(geometry).get(a)!][0]!;
  let state = initialPaperGame(geometry);
  for (const id of [a, b]) { const p = geometry.pieces[id]!.anchor; state = paperReducer(state, { type: 'place', id, point: { x: p.x + 100, y: p.y + 100 }, now: 100 }); }
  state = paperReducer(state, { type: 'deselect' });
  assert.equal(connectedGroup(state, a).length, 2); assert.equal(state.selected, null);
  state = paperReducer(state, { type: 'select', id: b });
  state = paperReducer(state, { type: 'hint' });
  state = paperReducer(state, { type: 'return', id: a });
  assert.equal(state.loose.length, 0); assert.equal(state.hinted, null); assert.equal(state.hintsUsed, 1); assert.equal(state.moves, 2);
  assert.equal(paperReducer(state, { type: 'return', id: -1 }), state);
});

test('图片地址清理后可从保留的Blob重建，避免切片继续引用失效地址', async () => {
  const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const blob = new Blob([bytes], { type: 'image/png' });
  const original = { url: URL.createObjectURL(blob), blob, name: 'local.png', originalWidth: 800, originalHeight: 600 };
  releaseImageResource(original);
  await assert.rejects(fetch(original.url));
  const restored = renewImageResource(original);
  try {
    assert.notEqual(restored.url, original.url);
    assert.equal(restored.blob, blob);
    assert.equal(restored.name, original.name);
    const response = await fetch(restored.url);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  } finally { releaseImageResource(restored); }
  releaseImageResource(null);
});
