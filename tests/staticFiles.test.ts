import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { serveStatic } from '../server/staticFiles';

test('生产静态服务支持压缩、ETag、HEAD、音乐分段，并拒绝越界和缺失脚本', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'paper-static-test-'));
  const server = createServer((req, res) => { void serveStatic(req, res, directory, new URL(req.url!, 'http://localhost').pathname); });
  try {
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<h1>paper</h1>');
    await writeFile(join(directory, 'assets', 'entry-12345678.js'), 'export const paper = 1;');
    await writeFile(join(directory, 'music.wav'), '0123456789');
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const js = await fetch(base + '/assets/entry-12345678.js', { headers: { 'Accept-Encoding': 'gzip' } });
    assert.equal(js.headers.get('content-encoding'), 'gzip');
    assert.match(js.headers.get('cache-control')!, /immutable/); assert.equal(await js.text(), 'export const paper = 1;');
    const etag = js.headers.get('etag')!;
    const cached = await fetch(base + '/assets/entry-12345678.js', { headers: { 'Accept-Encoding': 'gzip', 'If-None-Match': etag } });
    assert.equal(cached.status, 304); assert.equal(await cached.text(), '');
    const html = await fetch(base + '/'); assert.equal(html.headers.get('cache-control'), 'no-cache');
    const head = await fetch(base + '/music.wav', { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '10'); assert.equal(await head.text(), '');
    const segment = await fetch(base + '/music.wav', { headers: { Range: 'bytes=2-5' } });
    assert.equal(segment.status, 206); assert.equal(segment.headers.get('content-range'), 'bytes 2-5/10'); assert.equal(await segment.text(), '2345');
    const suffix = await fetch(base + '/music.wav', { headers: { Range: 'bytes=-3' } });
    assert.equal(suffix.status, 206); assert.equal(await suffix.text(), '789');
    assert.equal((await fetch(base + '/music.wav', { headers: { Range: 'bytes=99-100' } })).status, 416);
    const uncompressed = await fetch(base + '/', { headers: { 'Accept-Encoding': 'gzip;q=0, identity' } });
    assert.equal(uncompressed.headers.get('content-encoding'), null);
    assert.equal((await fetch(base + '/assets/missing.js')).status, 404);
    assert.equal((await fetch(base + '/..%2fprivate.json')).status, 404);
    assert.equal((await fetch(base + '/', { method: 'POST' })).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(r => server.close(() => r()));
    const target = resolve(directory), tempRoot = resolve(tmpdir()) + sep;
    if (target.startsWith(tempRoot) && target.includes('paper-static-test-')) await rm(target, { recursive: true, force: true });
  }
});
