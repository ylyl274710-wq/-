import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiles, isComplete, MAX_FILE_BYTES, shuffle, swapTiles, validateImage } from '../src/lib/imageEngine';
import { gameReducer, initialGame } from '../src/hooks/useGame';
import { formatTime } from '../src/lib/format';
import type { Difficulty } from '../src/types';
import { LEVELS } from '../src/lib/levels';
import { canPlayLevel, completeLevel, emptyProgress, mergeProgress, parseProgress } from '../src/lib/campaignProgress';

test('各难度打乱保持块的全集，且开局未完成', () => {
  for (const size of [3, 4, 5] as Difficulty[]) {
    const ordered = createTiles(size);
    for (let run = 0; run < 100; run++) {
      const result = shuffle(ordered);
      assert.equal(result.length, size * size);
      assert.equal(isComplete(result), false);
      assert.deepEqual(result.map(tile => tile.id).sort((a, b) => a - b), ordered.map(tile => tile.id));
      assert.equal(isComplete(ordered), true);
    }
    assert.equal(isComplete(shuffle(ordered, () => .999999)), false);
  }
});

test('交换不修改原数组，边界和空数组检测正确', () => {
  const tiles = createTiles(3);
  const swapped = swapTiles(tiles, 0, 8);
  assert.equal(swapped[0]?.correctIndex, 8);
  assert.equal(swapped[8]?.correctIndex, 0);
  assert.equal(isComplete(tiles), true);
  assert.equal(isComplete(swapped), false);
  assert.equal(isComplete(swapTiles(swapped, 0, 8)), true);
  for (const [a, b] of [[0, 0], [-1, 1], [0, 99], [.5, 1]]) assert.deepEqual(swapTiles(tiles, a!, b!), tiles);
  assert.equal(isComplete([]), false);
});

test('选择与取消不计步；首次有效交换才开始计时', () => {
  let state = initialGame(3);
  state = gameReducer(state, { type: 'select', index: 0, now: 100 });
  assert.equal(state.selected, 0);
  assert.equal(state.startedAt, null);
  state = gameReducer(state, { type: 'select', index: 0, now: 200 });
  assert.equal(state.selected, null);
  state = gameReducer(state, { type: 'swap', from: 0, to: 0, now: 250 });
  assert.equal(state.moves, 0);
  state = gameReducer(state, { type: 'select', index: 0, now: 300 });
  state = gameReducer(state, { type: 'select', index: 1, now: 500 });
  assert.equal(state.moves, 1);
  assert.equal(state.startedAt, 500);
  assert.equal(state.selected, null);
  if (state.status === 'playing') {
    state = gameReducer(state, { type: 'tick', now: 2500 });
    assert.equal(state.elapsedMs, 2000);
  }
});

test('完成后冻结状态；重新打乱重置统计', () => {
  const nearlyDone = { ...initialGame(3), tiles: swapTiles(createTiles(3), 0, 1),
    startedAt: 1000, status: 'playing' as const };
  const completed = gameReducer(nearlyDone, { type: 'swap', from: 0, to: 1, now: 4500 });
  assert.equal(completed.status, 'completed');
  assert.equal(completed.elapsedMs, 3500);
  assert.equal(completed.moves, 1);
  assert.equal(gameReducer(completed, { type: 'tick', now: 9000 }), completed);
  assert.equal(gameReducer(completed, { type: 'swap', from: 0, to: 1, now: 9000 }), completed);
  const reset = gameReducer(completed, { type: 'reset', tiles: shuffle(createTiles(3)) });
  assert.equal(reset.moves, 0);
  assert.equal(reset.elapsedMs, 0);
  assert.equal(reset.startedAt, null);
  assert.equal(reset.status, 'ready');
});

test('文件类型、10MB边界与空文件验证', () => {
  function file(name: string, type: string, size: number) { return { name, type, size } as File; }
  assert.equal(validateImage(file('photo.JPG', 'image/jpeg', MAX_FILE_BYTES)), null);
  assert.equal(validateImage(file('photo.webp', 'image/webp', 100)), null);
  assert.equal(validateImage(file('photo.png', 'image/png', 100)), null);
  assert.match(validateImage(file('photo.png', 'image/png', MAX_FILE_BYTES + 1))!, /10MB/);
  assert.match(validateImage(file('photo.gif', 'image/gif', 10))!, /格式/);
  assert.match(validateImage(file('photo.exe', 'image/png', 10))!, /格式/);
  assert.match(validateImage(file('photo.png', 'image/png', 0))!, /空文件/);
  assert.equal(formatTime(125000), '02:05');
});

test('闯关严格逐关解锁，不能跳关，难度逐关递增', () => {
  let progress = emptyProgress();
  assert.equal(canPlayLevel(progress, 0), true);
  assert.equal(canPlayLevel(progress, 1), false);
  assert.equal(canPlayLevel(progress, -1), false);
  assert.equal(canPlayLevel(progress, .5), false);
  const skipped = completeLevel(progress, 1, { levelId: LEVELS[1]!.id, moves: 3, elapsedMs: 200 });
  assert.equal(skipped, progress);
  for (let index = 0; index < LEVELS.length; index++) {
    if (index > 0) assert.ok(LEVELS[index]!.gridSize > LEVELS[index - 1]!.gridSize);
    assert.equal(canPlayLevel(progress, index), true);
    progress = completeLevel(progress, index, { levelId: LEVELS[index]!.id, moves: index + 1, elapsedMs: 1000 });
    assert.equal(progress.results.length, index + 1);
  }
  assert.equal(canPlayLevel(progress, LEVELS.length), false);
  assert.equal(progress.results.length, 6);
});

test('损坏或非连续的存档安全降级，合法进度可恢复', () => {
  const first = { levelId: LEVELS[0]!.id, moves: 8, elapsedMs: 3200 };
  for (const raw of [null, '', '{}', 'broken', 'null', '{"version":2,"results":[]}']) {
    assert.deepEqual(parseProgress(raw), emptyProgress());
  }
  const valid = completeLevel(emptyProgress(), 0, first);
  assert.deepEqual(parseProgress(JSON.stringify(valid)), valid);
  const outOfOrder = JSON.stringify({ version: 1, results: [first, { ...first, levelId: LEVELS[2]!.id }] });
  assert.equal(parseProgress(outOfOrder).results.length, 1);
  assert.equal(completeLevel(valid, 1, { levelId: LEVELS[1]!.id, moves: 0, elapsedMs: 1 }), valid);
  assert.equal(completeLevel(valid, 1, { levelId: LEVELS[1]!.id, moves: 2, elapsedMs: -1 }), valid);
});

test('重玩保留更快的完整成绩，合并进度不丢已解锁关卡', () => {
  const first = { levelId: LEVELS[0]!.id, moves: 8, elapsedMs: 3000 };
  const initial = completeLevel(emptyProgress(), 0, first);
  assert.equal(completeLevel(initial, 0, { ...first, elapsedMs: 4000 }), initial);
  const improved = completeLevel(initial, 0, { ...first, moves: 10, elapsedMs: 2000 });
  assert.equal(improved.results[0]?.moves, 10);
  assert.equal(initial.results[0]?.elapsedMs, 3000);
  const advanced = completeLevel(initial, 1, { levelId: LEVELS[1]!.id, moves: 11, elapsedMs: 5000 });
  const merged = mergeProgress(improved, advanced);
  assert.equal(merged.results.length, 2);
  assert.equal(merged.results[0]?.elapsedMs, 2000);
});
