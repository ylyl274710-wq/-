import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, sep } from 'node:path';
import { makeParcel } from '../src/lib/exchange';
import { fixture } from './fixtures';
import { createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config';
import { createServer as createPortProbe } from 'node:net';

let child: ReturnType<typeof spawn>, temporary = '';
const base = 'http://127.0.0.1:5188/api', frontend = 'https://paper-test.vercel.app';
async function post(path: string, data: unknown) { const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: frontend }, body: JSON.stringify(data) }); return { status: r.status, value: await r.json() }; }
async function startServer() { child = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { cwd: process.cwd(), env: { ...process.env, PUBLIC_ORIGIN: frontend, API_PORT: '5188', HOST: '127.0.0.1', STUDIO_DATA_DIR: temporary }, windowsHide: true, stdio: 'pipe' }); for (let i = 0; i < 60; i++) { try { const r = await fetch(base + '/health'); if (r.ok) return; } catch { /* 仅等待本测试启动的服务。 */ } await new Promise(r => setTimeout(r, 100)); } throw new Error('测试API未能启动'); }
async function stopServer() { if (!child || child.exitCode !== null) return; const exited = new Promise<void>(r => child.once('exit', () => r())); child.kill(); await exited; }
before(async () => { temporary = await mkdtemp(join(tmpdir(), 'paper-api-test-')); await startServer(); });
after(async () => { await stopServer(); const tempRoot = resolve(tmpdir()) + sep, target = resolve(temporary); if (temporary && target.startsWith(tempRoot) && target.includes('paper-api-test-')) await rm(target, { recursive: true, force: true }); });
test('照片链接真实保存、读取、鉴权撤回，拒绝跨站写入', async () => {
  const parcel = await makeParcel(fixture(), 'gift'), created = await post('/shares', { parcel }); assert.equal(created.status, 201);
  const got = await fetch(`${base}/shares/${created.value.id}`); assert.equal(got.status, 200); assert.equal((await got.json()).parcel.session.options.gift.message, '拼完见');
  assert.equal((await post(`/shares/${created.value.id}/revoke`, { owner: 'wrong' })).status, 403);
  assert.equal((await post(`/shares/${created.value.id}/revoke`, { owner: created.value.owner })).status, 200);
  assert.equal((await fetch(`${base}/shares/${created.value.id}`)).status, 404);
  assert.equal((await fetch(`${base}/shares`, { method: 'POST', headers: { Origin: 'https://evil.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ parcel }) })).status, 403);
});
test('两人房间通过SSE同步真实操作，第三人及无凭据操作被拒绝', async () => {
  const parcel = await makeParcel(fixture(), 'relay'), created = await post('/rooms', { parcel, name: '甲' }); assert.equal(created.status, 201);
  const id = created.value.id, guest = await post(`/rooms/${id}/join`, { name: '乙' }); assert.equal(guest.status, 200);
  assert.equal((await post(`/rooms/${id}/join`, { name: '丙' })).status, 409);
  assert.equal((await post(`/rooms/${id}/action`, { token: 'wrong', action: { type: 'assist' } })).status, 403);
  const controller = new AbortController(), response = await fetch(`${base}/rooms/${id}/events?token=${guest.value.token}`, { signal: controller.signal, headers: { Origin: frontend } }), reader = response.body!.getReader();
  assert.equal(response.headers.get('access-control-allow-origin'), frontend);
  let text = '';
  try {
    await post(`/rooms/${id}/action`, { token: created.value.token, selected: 0, action: { type: 'place', id: 0, point: created.value.state.geometry.pieces[0].anchor } });
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) { const chunk = await reader.read(); text += new TextDecoder().decode(chunk.value); if (text.includes('"version":1')) break; }
    assert.ok(text.includes('"version":1')); assert.ok(text.includes('"placed":[0]'));
    const rejoin = await post(`/rooms/${id}/join`, { token: guest.value.token }); assert.equal(rejoin.value.state.placed.length, 1);
  } finally { controller.abort(); await reader.cancel().catch(() => {}); }
});

test('重启后的冷房间同时争取最后一个名额，只有一人加入且双方原凭据可恢复', async () => {
  const parcel = await makeParcel(fixture(), 'relay'), owners = [];
  for (let i = 0; i < 3; i++) owners.push((await post('/rooms', { parcel, name: '房主' })).value);
  await stopServer(); await startServer();
  for (const room of owners) {
    const guests = await Promise.all([post(`/rooms/${room.id}/join`, { name: '甲' }), post(`/rooms/${room.id}/join`, { name: '乙' })]);
    assert.deepEqual(guests.map(g => g.status).sort(), [200, 409]);
    const winner = guests.find(g => g.status === 200)!;
    assert.equal((await post(`/rooms/${room.id}/join`, { token: winner.value.token })).status, 200);
    const host = await post(`/rooms/${room.id}/join`, { token: room.token }); assert.equal(host.status, 200); assert.equal(host.value.players.length, 2);
  }
});

test('联机困难资格由服务端记录，普通放置后再开困难不会恢复加分资格', async () => {
  const parcel = await makeParcel(fixture(), 'relay'), room = (await post('/rooms', { parcel, name: '甲' })).value;
  const action = (value: unknown) => post(`/rooms/${room.id}/action`, { token: room.token, action: value });
  await action({ type: 'place', id: 0, point: room.state.geometry.pieces[0].anchor });
  await action({ type: 'difficulty', hardMode: true });
  const resumed = (await post(`/rooms/${room.id}/join`, { token: room.token })).value;
  assert.equal(resumed.hardMode, true); assert.equal(resumed.hardEligible, false);
  const fresh = (await post('/rooms', { parcel, name: '乙' })).value;
  const hardAction = (value: unknown) => post(`/rooms/${fresh.id}/action`, { token: fresh.token, action: value });
  await hardAction({ type: 'difficulty', hardMode: true });
  await hardAction({ type: 'place', id: 0, point: fresh.state.geometry.pieces[0].anchor });
  assert.equal((await post(`/rooms/${fresh.id}/join`, { token: fresh.token })).value.hardEligible, true);
  await hardAction({ type: 'difficulty', hardMode: false }); await hardAction({ type: 'difficulty', hardMode: true });
  assert.equal((await post(`/rooms/${fresh.id}/join`, { token: fresh.token })).value.hardEligible, false);
});

test('已到期分享仍可由创建者立即删除照片，错误凭据不能删除', async () => {
  const parcel = await makeParcel(fixture(), 'gift'), created = (await post('/shares', { parcel })).value;
  const path = join(temporary, `share-${created.id}.json`), record = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...record, expiresAt: 1 }));
  assert.equal((await fetch(`${base}/shares/${created.id}`)).status, 410);
  assert.equal((await post(`/shares/${created.id}/revoke`, { owner: 'wrong' })).status, 403);
  assert.equal((await post(`/shares/${created.id}/revoke`, { owner: created.owner })).status, 200);
  assert.equal((await fetch(`${base}/shares/${created.id}`)).status, 404);
});

test('实际Vite代理保留Host：非默认前端端口可以上传图片、创建加入并同步，跨站写入仍被拒绝', async () => {
  // 使用项目实际代理配置，覆盖字符串简写隐含 changeOrigin:true 的回归。
  const configured = viteConfig.server!.proxy!['/api']!;
  const proxyOptions = typeof configured === 'string' ? { target: base.replace('/api', ''), changeOrigin: true } : { ...configured, target: base.replace('/api', '') };
  const probe = createPortProbe();
  await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
  const reserved = probe.address(); assert.ok(reserved && typeof reserved === 'object');
  await new Promise<void>((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  const vite = await createViteServer({ configFile: false, logLevel: 'silent', cacheDir: join(temporary, 'vite-cache'), optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port: reserved.port, strictPort: true, preTransformRequests: false, proxy: { '/api': proxyOptions } } });
  const controller = new AbortController();
  let deadline: ReturnType<typeof setTimeout> | undefined, phase = '启动代理';
  try {
    await vite.listen();
    deadline = setTimeout(() => controller.abort(), 10000);
    const address = vite.httpServer!.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    const viaProxy = async (path: string, data: unknown, source = origin) => {
      const response = await fetch(`${origin}/api${path}`, { method: 'POST', headers: { Origin: source, 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal });
      return { status: response.status, data: await response.json() };
    };
    const original = fixture();
    const session = { ...original, image: { ...original.image, blob: new Blob([await original.image.blob.arrayBuffer(), new Uint8Array(1024 * 1024)], { type: 'image/png' }) } };
    const parcel = await makeParcel(session, 'relay');
    phase = '上传图片并创建房间';
    const host = await viaProxy('/rooms', { parcel, name: '电脑' }); assert.equal(host.status, 201);
    phase = '加入房间';
    const guest = await viaProxy(`/rooms/${host.data.id}/join`, { name: '手机' }); assert.equal(guest.status, 200);
    phase = '建立同步流';
    const response = await fetch(`${origin}/api/rooms/${host.data.id}/events?token=${guest.data.token}`, { signal: controller.signal });
    assert.equal(response.status, 200);
    const reader = response.body!.getReader();
    try {
      phase = '同步放置操作';
      assert.equal((await viaProxy(`/rooms/${host.data.id}/action`, { token: host.data.token, action: { type: 'place', id: 0, point: host.data.state.geometry.pieces[0].anchor } })).status, 200);
      phase = '接收同步更新';
      let received = '';
      while (!received.includes('"version":1')) { const chunk = await reader.read(); assert.equal(chunk.done, false); received += new TextDecoder().decode(chunk.value); }
      assert.ok(received.includes('"placed":[0]'));
      phase = '拒绝跨站请求';
      assert.equal((await viaProxy('/rooms', {}, 'https://evil.test')).status, 403);
    } finally { await reader.cancel().catch(() => {}); }
  } catch (error) { throw new Error(`代理验收失败阶段：${phase}`, { cause: error }); }
  finally { clearTimeout(deadline); controller.abort(); await vite.close(); }
});


test('独立前后端预检只允许已配置来源，跨域错误可读取且无凭据不能越权', async () => {
  const preflight = (origin: string, headers = 'content-type') => fetch(base + '/rooms', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': headers } });
  const allowed = await preflight(frontend);
  assert.equal(allowed.status, 204); assert.equal(allowed.headers.get('access-control-allow-origin'), frontend);
  assert.match(allowed.headers.get('access-control-allow-methods')!, /POST/);
  assert.equal(allowed.headers.get('access-control-allow-credentials'), null);
  assert.equal((await preflight('https://paper-test.vercel.app.evil.test')).status, 403);
  assert.equal((await preflight(frontend, 'authorization')).status, 403);
  const created = (await post('/shares', { parcel: await makeParcel(fixture(), 'gift') })).value;
  const photo = await fetch(`${base}/shares/${created.id}`, { headers: { Origin: frontend } });
  assert.equal(photo.status, 200); assert.equal(photo.headers.get('access-control-allow-origin'), frontend);
  const denied = await fetch(`${base}/shares/${created.id}/revoke`, { method: 'POST', headers: { Origin: frontend, 'Content-Type': 'application/json' }, body: JSON.stringify({ owner: 'wrong' }) });
  assert.equal(denied.status, 403); assert.equal(denied.headers.get('access-control-allow-origin'), frontend);
  assert.equal((await denied.json()).error, '无权撤回');
});
