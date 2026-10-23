import type { CollectionEntry } from './studioTypes';
import { dateKey } from './catalog';

export function momentCaption(entry: CollectionEntry): string {
  if (entry.context.memory) return '两张照片，一段回忆。把想留下的瞬间，慢慢拼在一起。';
  if (entry.options?.gift && !entry.options.weekly) return '有人把一份心意藏进纸片里。今天，被我一片片拼开了。';
  if (entry.options?.duo) return '一人一片，把零散拼成我们一起完成的小事。';
  return entry.options?.relaxed ? '今天，把几分钟留给自己。慢慢拼好一张图，也留住这一刻。' : '把零散，拼回喜欢的样子。今天的小小完成，值得留一张纪念。';
}
export interface MomentCardOptions { title: string; caption: string; palette: 'cream' | 'forest' | 'rose' }
const colors = { cream: ['#f5f1e5', '#2b4939', '#879477'], forest: ['#e8eee5', '#294b3a', '#6f896c'], rose: ['#f2e5dd', '#744c43', '#a17c6a'] } as const;

function lines(context: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines: number) {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim());
  let line = '', row = 0;
  for (let i = 0; i < chars.length; i++) {
    const next = line + chars[i];
    if (context.measureText(next).width <= width) { line = next; continue; }
    if (row === maxLines - 1) { while (line && context.measureText(line + '…').width > width) line = Array.from(line).slice(0, -1).join(''); context.fillText(line + '…', x, y + row * lineHeight); return; }
    context.fillText(line, x, y + row * lineHeight); row++; line = chars[i]!;
  }
  if (line) context.fillText(line, x, y + row * lineHeight);
}

// 分享卡只绘制用户确认的标题与配文，不自动加入私人留言、成绩或照片文件名。
export async function createMomentCard(entry: CollectionEntry, options: MomentCardOptions): Promise<Blob> {
  const url = URL.createObjectURL(entry.image.blob);
  try {
    const photo = new Image(); photo.src = url; await photo.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1440;
    const c = canvas.getContext('2d'); if (!c) throw new Error('暂时无法绘制分享卡');
    const [paper, ink, muted] = colors[options.palette];
    c.fillStyle = paper; c.fillRect(0, 0, 1080, 1440);
    c.fillStyle = muted; c.font = '18px sans-serif'; c.fillText('PIECE BY PIECE  /  A LITTLE MOMENT', 80, 90);
    c.textAlign = 'right'; c.fillText(dateKey(new Date(entry.completedAt)), 1000, 90); c.textAlign = 'left';
    c.fillStyle = '#fffcf4'; c.fillRect(60, 135, 960, 960);
    c.save(); c.translate(80, 155); c.scale(.92, .92); c.clip(new Path2D(entry.state.geometry.outlinePath)); c.drawImage(photo, 0, 0, 1000, 1000); c.restore();
    c.fillStyle = ink; c.font = '40px serif'; lines(c, options.title.slice(0, 80), 80, 1160, 920, 48, 2);
    c.fillStyle = muted; c.font = '25px sans-serif'; lines(c, options.caption.slice(0, 160), 80, 1260, 920, 38, 3);
    c.font = '18px sans-serif'; c.fillText(`${entry.settings.pieceCount}片 · 每一片，都不一样`, 80, 1390);
    c.textAlign = 'right'; c.fillText('片刻拼图', 1000, 1390);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('分享卡生成失败')), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}
