import type { PuzzleImage } from '../types';
import { validateImage } from './imageEngine';

export type PhotoSlot = 0 | 1;
export interface MemoryPhoto { url: string; name: string; width: number; height: number }
export interface PhotoPosition { x: number; y: number; zoom: number }
export interface MemoryComposition {
  layout: 'beside' | 'stacked'; seam: 'torn' | 'soft'; balance: number;
  positions: readonly [PhotoPosition, PhotoPosition]; title: string; message: string; date: string;
}
export const centeredPhoto = (): PhotoPosition => ({ x: .5, y: .5, zoom: 1 });
const blendLayers = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
export const initialComposition = (): MemoryComposition => ({ layout: 'beside', seam: 'torn', balance: .5,
  positions: [centeredPhoto(), centeredPhoto()], title: '两张照片，一段回忆', message: '', date: '' });
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : (min + max) / 2));
export function normalizePosition(value: PhotoPosition): PhotoPosition {
  return { x: clamp(value.x, 0, 1), y: clamp(value.y, 0, 1), zoom: clamp(value.zoom, 1, 3) };
}

// 根据目标窗口比例裁剪原图；缩放、拖动始终限制在照片边界内，不拉伸人像。
export function photoCrop(width: number, height: number, targetWidth: number, targetHeight: number, position: PhotoPosition) {
  if (![width, height, targetWidth, targetHeight].every(n => Number.isFinite(n) && n > 0)) throw new Error('照片尺寸无效');
  const p = normalizePosition(position), aspect = targetWidth / targetHeight;
  const cropWidth = Math.min(width, height * aspect) / p.zoom, cropHeight = cropWidth / aspect;
  return { x: (width - cropWidth) * p.x, y: (height - cropHeight) * p.y, width: cropWidth, height: cropHeight };
}
export const PHOTO_AREA = { x: 60, y: 60, width: 880, height: 730 } as const;
export function photoWindow(options: MemoryComposition, slot: PhotoSlot) {
  const p = PHOTO_AREA, balance = clamp(options.balance, .3, .7), overlap = 20;
  if (options.layout === 'stacked') return slot === 0
    ? { x: p.x, y: p.y, width: p.width, height: p.height * balance + overlap }
    : { x: p.x, y: p.y + p.height * balance - overlap, width: p.width, height: p.height * (1 - balance) + overlap };
  return slot === 0 ? { x: p.x, y: p.y, width: p.width * balance + overlap, height: p.height }
    : { x: p.x + p.width * balance - overlap, y: p.y, width: p.width * (1 - balance) + overlap, height: p.height };
}
export function seamPoints(length: number, split: number): readonly { x: number; y: number }[] {
  return Array.from({ length: 33 }, (_, i) => ({ x: split + Math.sin(i * 2.73) * 8 + Math.sin(i * 1.13) * 4, y: length * i / 32 }));
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('回忆画没有生成，请重试')), 'image/png'));
}
export async function readMemoryPhoto(file: File): Promise<MemoryPhoto> {
  const error = validateImage(file); if (error) throw new Error(error);
  const original = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = original; await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('无效图片');
    const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const c = canvas.getContext('2d'); if (!c) throw new Error('无法创建画布');
    c.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { url: URL.createObjectURL(await canvasBlob(canvas)), name: file.name, width: canvas.width, height: canvas.height };
  } catch { throw new Error('无法读取这张照片，请换一张有效的 JPG、PNG 或 WebP 图片'); }
  finally { URL.revokeObjectURL(original); }
}
export async function decodeMemoryPhoto(photo: MemoryPhoto): Promise<HTMLImageElement> {
  const image = new Image(); image.src = photo.url; await image.decode(); return image;
}

// 先合成一张真正的位图，再交给现有随机切片引擎；预览、下载和游戏使用同一套绘制逻辑。
export function drawMemory(canvas: HTMLCanvasElement, images: readonly [HTMLImageElement | null, HTMLImageElement | null], options: MemoryComposition) {
  const c = canvas.getContext('2d'); if (!c) throw new Error('无法创建回忆画布');
  c.save(); c.setTransform(canvas.width / 1000, 0, 0, canvas.height / 1000, 0, 0);
  c.fillStyle = '#fffaf0'; c.fillRect(0, 0, 1000, 1000);
  const area = PHOTO_AREA;
  function drawPhoto(context: CanvasRenderingContext2D, slot: PhotoSlot) {
    const box = photoWindow(options, slot), image = images[slot];
    context.fillStyle = slot === 0 ? '#dce3d4' : '#eadbcd'; context.fillRect(box.x, box.y, box.width, box.height);
    if (image) { const crop = photoCrop(image.naturalWidth, image.naturalHeight, box.width, box.height, options.positions[slot]); context.drawImage(image, crop.x, crop.y, crop.width, crop.height, box.x, box.y, box.width, box.height); }
    else { context.fillStyle = '#74816b'; context.textAlign = 'center'; context.font = '20px sans-serif'; context.fillText(slot === 0 ? '第一张照片' : '第二张照片', box.x + box.width / 2, box.y + box.height / 2); }
  }
  c.save(); c.beginPath(); c.rect(area.x, area.y, area.width, area.height); c.clip();
  const stacked = options.layout === 'stacked', length = stacked ? area.width : area.height;
  const split = (stacked ? area.height : area.width) * clamp(options.balance, .3, .7);
  const seam = seamPoints(length, split).map(p => stacked ? { x: area.x + p.y, y: area.y + p.x } : { x: area.x + p.x, y: area.y + p.y });
  if (options.seam === 'torn') {
    c.save(); c.beginPath(); c.moveTo(area.x, area.y);
    if (stacked) { c.lineTo(area.x + area.width, area.y); for (const p of [...seam].reverse()) c.lineTo(p.x, p.y); }
    else { c.lineTo(seam[0]!.x, area.y); for (const p of seam) c.lineTo(p.x, p.y); c.lineTo(area.x, area.y + area.height); }
    c.closePath(); c.clip(); drawPhoto(c, 0); c.restore();
    c.save(); c.beginPath(); c.moveTo(seam[0]!.x, seam[0]!.y); for (const p of seam) c.lineTo(p.x, p.y);
    c.lineTo(area.x + area.width, area.y + area.height); if (!stacked) c.lineTo(area.x + area.width, area.y); else c.lineTo(area.x, area.y + area.height);
    c.closePath(); c.clip(); drawPhoto(c, 1); c.restore();
    c.beginPath(); seam.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.strokeStyle = '#fffaf0'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke();
  } else {
    drawPhoto(c, 0);
    let layer = blendLayers.get(canvas);
    if (!layer) { layer = document.createElement('canvas'); layer.width = layer.height = 1000; blendLayers.set(canvas, layer); }
    const l = layer.getContext('2d'); if (!l) { c.restore(); c.restore(); throw new Error('无法创建合成图层'); }
    l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, 1000, 1000);
    drawPhoto(l, 1); l.globalCompositeOperation = 'destination-in';
    const start = (stacked ? area.y : area.x) + split - 20, end = start + 40;
    const gradient = stacked ? l.createLinearGradient(0, start, 0, end) : l.createLinearGradient(start, 0, end, 0);
    gradient.addColorStop(0, 'transparent'); gradient.addColorStop(1, '#000'); l.fillStyle = gradient; l.fillRect(0, 0, 1000, 1000); c.drawImage(layer, 0, 0);
  }
  c.restore();
  c.textAlign = 'center'; c.fillStyle = '#354b3e'; c.font = '30px "Songti SC", "Microsoft YaHei", serif';
  c.fillText((options.title.trim() || '两张照片，一段回忆').slice(0, 24), 500, 855, 840);
  c.fillStyle = '#7a8272'; c.font = '17px "Microsoft YaHei", sans-serif'; c.fillText(options.message.trim().slice(0, 40), 500, 897, 830);
  c.fillStyle = '#a17b65'; c.font = '13px sans-serif'; c.fillText(options.date ? options.date.replaceAll('-', ' . ') : 'PIECE BY PIECE  /  A MEMORY TO KEEP', 500, 934, 830);
  c.restore();
}

export async function createMemoryImage(images: readonly [HTMLImageElement, HTMLImageElement], options: MemoryComposition): Promise<PuzzleImage> {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1600; drawMemory(canvas, images, options);
  const blob = await canvasBlob(canvas);
  return { blob, url: URL.createObjectURL(blob), name: options.title.trim().slice(0, 24) || '两张照片，一段回忆', originalWidth: 1600, originalHeight: 1600 };
}
