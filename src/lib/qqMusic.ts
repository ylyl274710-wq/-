export const QQ_MUSIC_HOME = 'https://y.qq.com/';

/** 仅接受 QQ 音乐官方页面和分享链接，不解析或获取音频。 */
export function qqMusicPage(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const path = url.pathname;
    if (url.hostname === 'y.qq.com' && (
      path === '/' ||
      /^\/n\/ryqq\/(?:songDetail\/[a-zA-Z0-9]+|playlist(?:\/\d+)?)\/?$/.test(path) ||
      /^\/n\/yqq\/(?:song|playlist|playsquare)\/[a-zA-Z0-9]+\.html$/.test(path) ||
      /^\/w\/(?:song|taoge|playlist)\.html$/.test(path) ||
      /^\/n\/m\/detail\/(?:song|taoge)\/index\.html$/.test(path)
    )) return url.href;
    if (url.hostname === 'c.y.qq.com' && path === '/base/fcgi-bin/u' && /^[a-zA-Z0-9_-]{1,200}$/.test(url.searchParams.get('__') ?? '')) return url.href;
    if (url.hostname === 'i.y.qq.com' && /^\/n2\/m\/share\/details\/(?:song|taoge)\.html$/.test(path)) return url.href;
    return null;
  } catch { return null; }
}
