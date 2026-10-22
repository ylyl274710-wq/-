/** 留空走本地同源代理；线上使用独立 HTTPS 后端，JSON 与 SSE 共用地址。 */
export function normalizeApiOrigin(value: string): string {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error();
    return url.origin;
  } catch { throw new Error('VITE_API_ORIGIN 必须是 HTTPS 后端地址，不含路径、账号或查询参数'); }
}

export function apiEndpoint(path: string, origin = import.meta.env?.VITE_API_ORIGIN ?? ''): string {
  if (!/^\/api(?:\/|$)/.test(path)) throw new Error('拼图接口路径无效');
  return `${normalizeApiOrigin(origin)}${path}`;
}
