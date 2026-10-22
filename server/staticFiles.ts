import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// 生产服务流式发送素材；内容哈希资源长缓存，HTML与未版本化素材用ETag重新验证。
export async function serveStatic(req: IncomingMessage, res: ServerResponse, directory: string, pathname: string): Promise<void> {
  const fail = (status: number) => { res.writeHead(status, { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(); };
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); fail(405); return; }
  let decoded: string;
  try { decoded = decodeURIComponent(pathname); } catch { fail(400); return; }
  const root = resolve(directory), target = resolve(root, decoded === '/' ? 'index.html' : `.${decoded}`);
  if (!target.startsWith(root + sep) || decoded.includes('\0')) { fail(404); return; }
  const file = extname(target) ? target : resolve(root, 'index.html');
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) { fail(404); return; }
  const extension = extname(file), compressible = ['.html', '.js', '.css', '.json', '.svg'].includes(extension);
  const gzip = compressible && !req.headers.range && /\bgzip\b(?!\s*;\s*q=0(?:\.0*)?(?:\s*[,;]|\s*$))/i.test(req.headers['accept-encoding'] ?? '');
  const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}${gzip ? '-gzip' : ''}"`;
  const headers: Record<string, string | number> = {
    'Content-Type': types[extension] ?? 'application/octet-stream',
    'Cache-Control': /[\\/]assets[\\/][^\\/]+-[\w-]{8,}\.[\w]+$/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff', ETag: etag, 'Accept-Ranges': 'bytes',
  };
  if (compressible) headers.Vary = 'Accept-Encoding';
  if (gzip) headers['Content-Encoding'] = 'gzip';
  if (req.headers['if-none-match']?.split(',').some(tag => tag.trim().replace(/^W\//, '') === etag || tag.trim() === '*')) {
    res.writeHead(304, headers); res.end(); return;
  }
  let start = 0, end = info.size - 1, status = 200;
  const range = req.headers.range;
  if (range && (!req.headers['if-range'] || req.headers['if-range'] === etag)) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || !match[1] && !match[2]) { res.setHeader('Content-Range', `bytes */${info.size}`); fail(416); return; }
    start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]));
    end = match[1] && match[2] ? Math.min(end, Number(match[2])) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= info.size) {
      res.setHeader('Content-Range', `bytes */${info.size}`); fail(416); return;
    }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${info.size}`;
  }
  if (!gzip) headers['Content-Length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || info.size === 0) { res.end(); return; }
  try {
    const stream = createReadStream(file, { start, end });
    if (gzip) await pipeline(stream, createGzip(), res); else await pipeline(stream, res);
  } catch { res.destroy(); }
}
