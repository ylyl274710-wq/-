import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './fixtures';
import { sameBoardState } from '../src/lib/boardState';
import { sameSessionContent } from '../src/lib/sessionSnapshot';
import { paperReducer } from '../src/lib/paperReducer';
import { ApiError, requestJson } from '../src/lib/request';

test('计时 tick 不重绘棋盘，但选择、提示、收回和重新切割必须更新', () => {
  const s = fixture().state;
  const playing = paperReducer(s, { type: 'place', id: 0, point: s.geometry.pieces[0]!.anchor, now: 100 });
  const tick = paperReducer(playing, { type: 'tick', now: 2100 });
  assert.equal(sameBoardState(playing, tick), true);
  const selected = paperReducer(tick, { type: 'select', id: 0 });
  assert.equal(sameBoardState(tick, selected), false);
  assert.equal(sameBoardState(selected, paperReducer(selected, { type: 'hint' })), false);
  assert.equal(sameBoardState(tick, paperReducer(tick, { type: 'return', id: 0 })), false);
  assert.equal(sameBoardState(s, fixture().state), false);
});

test('保存去重忽略空闲计时，但保留纸片、难度、存档身份和图片变化', () => {
  const s = fixture();
  assert.equal(sameSessionContent(s, { ...s, savedAt: 2000, state: { ...s.state, elapsedMs: 1000 } }), true);
  assert.equal(sameSessionContent(s, { ...s, hardEligible: true }), false);
  assert.equal(sameSessionContent(s, { ...s, id: 'another-game' }), false);
  assert.equal(sameSessionContent(s, { ...s, image: { ...s.image, blob: new Blob(['new-photo']) } }), false);
  assert.equal(sameSessionContent(s, { ...s, state: paperReducer(s.state, { type: 'select', id: 0 }) }), false);
  assert.equal(sameSessionContent(s, { ...s, state: paperReducer(s.state, { type: 'place', id: 0, point: s.state.geometry.pieces[0]!.anchor, now: 1 }) }), false);
});

test('联网错误转换为明确提示，并保留403/404以区分无权撤回与已撤回', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(requestJson('/api/test'), e => e instanceof ApiError && e.status === 0 && !e.message.includes('Failed to fetch'));
    for (const status of [403, 404]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ error: status === 403 ? '无权撤回' : '已不存在' }), { status });
      await assert.rejects(requestJson('/api/test'), e => e instanceof ApiError && e.status === status);
    }
    globalThis.fetch = async () => new Response('<html>proxy</html>', { status: 200 });
    await assert.rejects(requestJson('/api/test'), e => e instanceof ApiError && e.status === 502);
  } finally { globalThis.fetch = original; }
});

test('超时覆盖响应体读取，POST不自动重试；主动取消保持AbortError', async () => {
  const original = globalThis.fetch;
  let attempts = 0;
  try {
    globalThis.fetch = async (_input, init) => {
      attempts++;
      const signal = init!.signal!;
      return { ok: true, json: () => new Promise((_resolve, reject) => {
        if (signal.aborted) reject(new DOMException('cancelled', 'AbortError'));
        else signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')), { once: true });
      }) } as Response;
    };
    await assert.rejects(requestJson('/api/rooms', { name: 'test' }, { timeoutMs: 10 }), e => e instanceof ApiError && e.status === 408);
    assert.equal(attempts, 1);
    const controller = new AbortController();
    const pending = requestJson('/api/share', undefined, { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, e => e instanceof DOMException && e.name === 'AbortError');
  } finally { globalThis.fetch = original; }
});
