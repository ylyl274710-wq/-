import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink, readdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openParcel, type PuzzleParcel } from '../src/lib/exchange';
import { paperReducer, type PaperAction, type PaperGameState } from '../src/lib/paperReducer';
import type { RoomUpdate } from '../src/lib/onlineTypes';
import { serveStatic } from './staticFiles';
import { handleApiOrigin } from './origin';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..'), directory = process.env.STUDIO_DATA_DIR ? resolve(process.env.STUDIO_DATA_DIR) : resolve(root, '.local', 'studio-server');
await mkdir(directory, { recursive: true });
const secret = () => randomBytes(18).toString('hex');
const nameOf = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim().slice(0, 30) : '拼图伙伴';
interface Room { id: string; parcel: PuzzleParcel; state: PaperGameState; players: { token: string; name: string }[]; version: number; actor: string; updatedAt: number; expiresAt: number; hardMode: boolean; hardEligible: boolean }
const rooms = new Map<string, Room>(), streams = new Map<string, Map<ServerResponse, string>>();
function send(res: ServerResponse, status: number, body: unknown) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(body)); }
async function body(req: IncomingMessage): Promise<Record<string, unknown>> { const chunks: Buffer[] = []; let size = 0; for await (const chunk of req) { size += chunk.length; if (size > 32 * 1024 * 1024) throw new Error('文件不能超过30MB'); chunks.push(chunk); } const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8')); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('请求格式无效'); return parsed as Record<string, unknown>; }
const saves = new Map<string, Promise<void>>();
async function persist(room: Room) {
  const snapshot = JSON.stringify(room), previous = saves.get(room.id) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(async () => {
    const destination = resolve(directory, `room-${room.id}.json`), temporary = `${destination}.tmp`;
    await writeFile(temporary, snapshot); await rename(temporary, destination);
  });
  saves.set(room.id, next);
  try { await next; } finally { if (saves.get(room.id) === next) saves.delete(room.id); }
}
const loadingRooms = new Map<string, Promise<Room>>();
async function loadRoom(id: string): Promise<Room> {
  let room = rooms.get(id);
  if (!room) {
    let pending = loadingRooms.get(id);
    if (!pending) {
      // 冷启动并发请求共用一次读取和同一个房间对象，名额判断与占位之间不让出执行权。
      pending = readFile(resolve(directory, `room-${id}.json`), 'utf8').then(text => {
        const restored = JSON.parse(text) as Room;
        restored.hardMode = restored.hardMode ?? restored.parcel.session.hardMode === true;
        restored.hardEligible = restored.hardEligible ?? (restored.state.moves === 0 || restored.parcel.session.hardEligible === true);
        rooms.set(id, restored); return restored;
      }).finally(() => loadingRooms.delete(id));
      loadingRooms.set(id, pending);
    }
    room = await pending;
  }
  if (Date.now() > room.expiresAt) throw new Error('房间已过期，请重新创建');
  return room;
}
function update(room: Room): RoomUpdate { const live = [...(streams.get(room.id)?.values() ?? [])]; const state = room.state.startedAt === null || room.state.status !== 'playing' ? room.state : { ...room.state, elapsedMs: Date.now() - room.state.startedAt }; return { id: room.id, version: room.version, state, players: room.players.map(p => ({ name: p.name, online: live.includes(p.token) })), actor: room.actor, updatedAt: room.updatedAt, expiresAt: room.expiresAt, hardMode: room.hardMode, hardEligible: room.hardEligible }; }
function broadcast(room: Room) { const payload = `data: ${JSON.stringify(update(room))}\n\n`; for (const res of streams.get(room.id)?.keys() ?? []) res.write(payload); }
const rate = new Map<string, { at: number; n: number }>();
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost'), parts = url.pathname.split('/').filter(Boolean), method = req.method ?? 'GET';
    if (parts[0] !== 'api') return await serveStatic(req, res, resolve(root, 'dist'), url.pathname);
    if (!handleApiOrigin(req, res)) return;
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    const ip = req.socket.remoteAddress ?? '', r = rate.get(ip) ?? { at: Date.now(), n: 0 }; if (Date.now() - r.at > 60000) { r.at = Date.now(); r.n = 0; } if (++r.n > 360) return send(res, 429, { error: '操作太快，请稍后重试' }); rate.set(ip, r);
    if (parts[1] === 'shares' && parts.length === 2 && method === 'POST') {
      const b = await body(req), parcel = b.parcel as PuzzleParcel; openParcel(parcel);
      const id = secret(), owner = secret(), expiresAt = Date.now() + 7 * 86400000;
      await writeFile(resolve(directory, `share-${id}.json`), JSON.stringify({ parcel, owner, expiresAt })); return send(res, 201, { id, owner, expiresAt });
    }
    if (parts[1] === 'shares' && /^[a-f0-9]{36}$/.test(parts[2] ?? '')) {
      const path = resolve(directory, `share-${parts[2]}.json`), value = JSON.parse(await readFile(path, 'utf8')) as { parcel: PuzzleParcel; owner: string; expiresAt: number };
      if (method === 'POST' && parts[3] === 'revoke') { const b = await body(req); if (b.owner !== value.owner) return send(res, 403, { error: '无权撤回' }); await unlink(path); return send(res, 200, { ok: true }); }
      if (Date.now() > value.expiresAt) return send(res, 410, { error: '分享已过期' });
      if (method === 'GET') return send(res, 200, { parcel: value.parcel, expiresAt: value.expiresAt });
    }
    if (parts[1] === 'rooms' && parts.length === 2 && method === 'POST') {
      const b = await body(req), parcel = b.parcel as PuzzleParcel, session = openParcel(parcel), now = Date.now();
      const room: Room = { id: secret(), parcel, state: { ...session.state, selected: null, startedAt: session.state.status === 'playing' ? now - session.state.elapsedMs : null }, players: [{ name: nameOf(b.name), token: secret() }], version: 0, actor: '', updatedAt: now, expiresAt: now + 86400000, hardMode: session.hardMode, hardEligible: session.hardEligible ?? session.state.moves === 0 };
      rooms.set(room.id, room); await persist(room); return send(res, 201, { ...update(room), parcel, token: room.players[0]!.token });
    }
    if (parts[1] === 'rooms' && /^[a-f0-9]{36}$/.test(parts[2] ?? '')) {
      const room = await loadRoom(parts[2]!);
      if (parts[3] === 'join' && method === 'POST') { const b = await body(req); let player = room.players.find(p => p.token === b.token); if (!player) { if (room.players.length >= 2) return send(res, 409, { error: '两位伙伴已到齐，请使用原浏览器重新进入' }); player = { name: nameOf(b.name), token: secret() }; room.players.push(player); await persist(room); broadcast(room); } return send(res, 200, { ...update(room), parcel: room.parcel, token: player.token }); }
      const token = method === 'GET' ? url.searchParams.get('token') : undefined;
      if (parts[3] === 'events' && method === 'GET') { if (!room.players.some(p => p.token === token)) return send(res, 403, { error: '请重新加入房间' }); res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' }); res.write('retry: 1500\n\n'); let clients = streams.get(room.id); if (!clients) { clients = new Map(); streams.set(room.id, clients); } clients.set(res, token!); broadcast(room); const heartbeat = setInterval(() => res.write(': alive\n\n'), 15000); req.on('close', () => { clearInterval(heartbeat); clients!.delete(res); broadcast(room); }); return; }
      if (parts[3] === 'action' && method === 'POST') {
        const b = await body(req), player = room.players.find(p => p.token === b.token); if (!player) return send(res, 403, { error: '请重新加入房间' });
        const a = b.action as PaperAction | { type: 'difficulty'; hardMode: boolean }, id = b.selected;
        if (!a || !['place', 'return', 'hint', 'assist', 'difficulty'].includes(a.type)) return send(res, 400, { error: '操作无效' });
        if (room.state.status === 'completed') return send(res, 409, { error: '本局已完成，成绩已锁定' });
        const selected = Number.isInteger(id) && Number(id) >= 0 && Number(id) < room.state.geometry.pieces.length ? Number(id) : null;
        if (a.type === 'place' && (!Number.isInteger(a.id) || !a.point || !Number.isFinite(a.point.x) || !Number.isFinite(a.point.y))) return send(res, 400, { error: '落点无效' });
        if (a.type === 'difficulty') {
          if (typeof a.hardMode !== 'boolean') return send(res, 400, { error: '难度无效' });
          room.hardMode = a.hardMode;
          if (!a.hardMode && room.state.moves > 0) room.hardEligible = false;
        } else {
          const previousMoves = room.state.moves;
          room.state = paperReducer({ ...room.state, selected }, { ...a, ...(['place', 'assist'].includes(a.type) ? { now: Date.now() } : {}) } as PaperAction);
          if (!room.hardMode && room.state.moves > previousMoves) room.hardEligible = false;
          room.state = { ...room.state, selected: null };
        }
        room.version++; room.actor = player.name; room.updatedAt = Date.now(); await persist(room); broadcast(room); return send(res, 200, { ok: true, version: room.version });
      }
    }
    send(res, 404, { error: '分享或房间不存在，可能已失效' });
  } catch (error) { const message = error instanceof Error ? error.message : '服务暂时不可用'; send(res, message.includes('ENOENT') ? 404 : 400, { error: message.includes('ENOENT') ? '分享或房间不存在，可能已失效' : message }); }
});
const cleanup = setInterval(async () => { for (const name of await readdir(directory)) { if (!/^(room|share)-[a-f0-9]{36}\.json$/.test(name)) continue; const path = resolve(directory, name); try { const s = await stat(path); if (Date.now() - s.mtimeMs > 8 * 86400000) await unlink(path); } catch { /* 其他请求可能刚撤回文件。 */ } } for (const [id, room] of rooms) if (Date.now() > room.expiresAt) rooms.delete(id); }, 3600000); cleanup.unref();
server.listen(Number(process.env.API_PORT ?? process.env.PORT ?? 5175), process.env.HOST ?? '127.0.0.1', () => process.stdout.write(`Puzzle API http://${process.env.HOST ?? '127.0.0.1'}:${process.env.API_PORT ?? process.env.PORT ?? 5175}\n`));
