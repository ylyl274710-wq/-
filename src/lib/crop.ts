import type { CropAdjustment } from '../types';

export function normalizeCrop(value?: Partial<CropAdjustment>): CropAdjustment {
  const clamp = (n: number | undefined, fallback: number, min: number, max: number) => n !== undefined && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
  return { zoom: clamp(value?.zoom, 1, 1, 3), cx: clamp(value?.cx, .5, 0, 1), cy: clamp(value?.cy, .5, 0, 1) };
}

// 构图预览与输出共用原图坐标，保存参数后重开不会跳回居中。
export function cropRegion(width: number, height: number, value?: Partial<CropAdjustment>) {
  const crop = normalizeCrop(value), side = Math.min(width, height) / crop.zoom;
  const x = Math.max(0, Math.min(width - side, crop.cx * width - side / 2));
  const y = Math.max(0, Math.min(height - side, crop.cy * height - side / 2));
  return { x, y, side };
}
