import type { IncomingMessage, ServerResponse } from 'node:http';

/** 跨域只开放给配置的前端；同源及现有本机开发入口继续有效。 */
export function handleApiOrigin(req: IncomingMessage, res: ServerResponse): boolean {
  const origin = req.headers.origin;
  if (!origin) {
    if (req.method !== 'OPTIONS') return true;
    res.writeHead(400); res.end(); return false;
  }
  let allowed = false;
  try {
    const parsed = new URL(origin);
    allowed = parsed.origin === origin && (parsed.host === req.headers.host || parsed.origin === (process.env.PUBLIC_ORIGIN ?? 'http://127.0.0.1:5173') || process.env.NODE_ENV !== 'production' && parsed.origin === 'http://localhost:5173');
  } catch { /* 非法或不透明 Origin 不参与授权。 */ }
  res.setHeader('Vary', 'Origin');
  if (!allowed) {
    res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: '请求来源无效' })); return false;
  }
  res.setHeader('Access-Control-Allow-Origin', origin);
  if (req.method !== 'OPTIONS') return true;
  const method = req.headers['access-control-request-method'];
  const headers = String(req.headers['access-control-request-headers'] ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean);
  if (!['GET', 'POST'].includes(String(method)) || headers.some(h => h !== 'content-type')) { res.writeHead(403); res.end(); return false; }
  res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600', 'Cache-Control': 'no-store' });
  res.end(); return false;
}
