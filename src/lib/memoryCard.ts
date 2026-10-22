import { difficultyLabel } from './difficulty';
import type { CollectionEntry } from './studioTypes';
import { formatTime } from './format';
import { dateKey } from './catalog';

export async function exportMemoryCard(entry: CollectionEntry): Promise<void> {
  const url = URL.createObjectURL(entry.image.blob);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1420;
    const c = canvas.getContext('2d'); if (!c) throw new Error('无法生成纪念卡');
    c.fillStyle = '#f5f1e5'; c.fillRect(0, 0, 1080, 1420);
    c.fillStyle = '#8c9b79'; c.font = '18px sans-serif'; c.fillText('PIECE BY PIECE  /  MY LITTLE COLLECTION', 80, 85);
    c.strokeStyle = '#d5ddc6'; c.strokeRect(58, 125, 964, 964);
    c.save(); c.translate(80, 147); c.scale(.92, .92); c.clip(new Path2D(entry.state.geometry.outlinePath)); c.drawImage(image, 0, 0, 1000, 1000); c.restore();
    c.fillStyle = '#2b4939'; c.font = '42px serif'; c.fillText(`用 ${entry.settings.pieceCount} 片，拼回一份美好。`, 80, 1160);
    c.fillStyle = '#879477'; c.font = '22px sans-serif';
    c.fillText(`${formatTime(entry.state.elapsedMs)}  ·  ${entry.state.moves} 次放置  ·  ${difficultyLabel(entry)}  ·  提示 ${entry.state.hintsUsed} 次`, 80, 1210);
    c.fillText(`${entry.state.geometry.shapeLabel}轮廓  /  ${new Date(entry.completedAt).toLocaleDateString('zh-CN')}`, 80, 1250);
    c.textAlign = 'right'; c.fillStyle = '#aa7c50'; c.fillText(`${entry.score} 分`, 1000, 1250); c.textAlign = 'left'; c.fillStyle = '#879477';
    c.font = '18px sans-serif'; c.fillText((entry.context.title ?? entry.image.name).slice(0, 42), 80, 1310);
    const names = entry.options?.duo ? `${entry.options.duo[0]} & ${entry.options.duo[1]}` : entry.options?.gift ? `${entry.options.gift.from || '一位朋友'} → ${entry.options.gift.to || '亲爱的你'}` : '';
    if (names) c.fillText(names.slice(0, 50), 80, 1340);
    c.textAlign = 'right'; c.fillText('片刻拼图 · 不赶时间，只拼快乐。', 1000, 1365);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('纪念卡生成失败')), 'image/png'));
    const download = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = download; anchor.download = `片刻拼图-${dateKey(new Date(entry.completedAt))}.png`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(download), 1000);
  } finally { URL.revokeObjectURL(url); }
}
