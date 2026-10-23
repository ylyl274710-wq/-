import test from 'node:test';
import assert from 'node:assert/strict';
import { photoCrop, photoWindow, initialComposition, seamPoints, normalizePosition, PHOTO_AREA } from '../src/lib/memoryCollage';
import { initialMemoryComposer, memoryComposerReducer } from '../src/hooks/useMemoryComposer';
import { validSession } from '../src/lib/studioStorage';
import { momentCaption } from '../src/lib/momentCard';
import { fixture } from './fixtures';

test('portrait and landscape photos fill either window without stretching or sampling outside the image', () => {
  for (const [width, height] of [[400, 1200], [1600, 500], [300, 300]]) {
    for (const layout of ['beside', 'stacked'] as const) for (const balance of [.3, .5, .7]) for (const slot of [0, 1] as const) {
      const box = photoWindow({ ...initialComposition(), layout, balance }, slot);
      for (const zoom of [1, 2, 3]) for (const x of [0, .5, 1]) for (const y of [0, .5, 1]) {
        const crop = photoCrop(width!, height!, box.width, box.height, { x, y, zoom });
        assert.ok(crop.x >= -1e-8 && crop.y >= -1e-8);
        assert.ok(crop.x + crop.width <= width! + 1e-8 && crop.y + crop.height <= height! + 1e-8);
        assert.ok(Math.abs(crop.width / crop.height - box.width / box.height) < 1e-8);
      }
    }
  }
});

test('composition windows overlap across every tear and keep covering the full photo area', () => {
  for (const layout of ['beside', 'stacked'] as const) for (const balance of [.3, .7]) {
    const config = { ...initialComposition(), layout, balance }, a = photoWindow(config, 0), b = photoWindow(config, 1);
    assert.equal(a.x, PHOTO_AREA.x); assert.equal(a.y, PHOTO_AREA.y);
    assert.equal(b.x + b.width, PHOTO_AREA.x + PHOTO_AREA.width);
    assert.equal(b.y + b.height, PHOTO_AREA.y + PHOTO_AREA.height);
    const axis = layout === 'beside' ? 'x' : 'y', extent = layout === 'beside' ? 'width' : 'height';
    const split = PHOTO_AREA[axis] + PHOTO_AREA[extent] * balance;
    for (const p of seamPoints(PHOTO_AREA[extent], split)) {
      assert.ok(p.x >= b[axis] && p.x <= a[axis] + a[extent]);
    }
  }
});

test('swapping keeps the crop with its photo, replacing resets only that photo, invalid counts do not apply', () => {
  const a = { url: 'blob:a', name: 'first.jpg', width: 400, height: 500 }, b = { ...a, url: 'blob:b', name: 'second.jpg' };
  let state = memoryComposerReducer(initialMemoryComposer(), { type: 'photo', slot: 0, photo: a });
  state = memoryComposerReducer(state, { type: 'photo', slot: 1, photo: b });
  state = memoryComposerReducer(state, { type: 'position', slot: 0, position: { x: .2, y: .8, zoom: 2 } });
  const swapped = memoryComposerReducer(state, { type: 'swap' });
  assert.equal(swapped.photos[1], a); assert.deepEqual(swapped.composition.positions[1], { x: .2, y: .8, zoom: 2 });
  assert.equal(state.photos[0], a);
  const replaced = memoryComposerReducer(swapped, { type: 'photo', slot: 0, photo: a });
  assert.deepEqual(replaced.composition.positions[0], { x: .5, y: .5, zoom: 1 });
  assert.equal(replaced.composition.positions[1].zoom, 2);
  assert.equal(memoryComposerReducer(replaced, { type: 'pieces', count: 101 }), replaced);
  assert.deepEqual(normalizePosition({ x: -10, y: 8, zoom: 0 }), { x: 0, y: 1, zoom: 1 });
});

test('memory games use the existing resumable save format and get an appropriate card caption', () => {
  const session = fixture(); session.context = { kind: 'custom', title: '我们的夏天', memory: true };
  assert.equal(validSession(session), true);
  assert.match(momentCaption({ ...session, completedAt: 1, score: 1 }), /两张照片/);
  assert.throws(() => photoCrop(0, 300, 400, 300, { x: .5, y: .5, zoom: 1 }));
});
