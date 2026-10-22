import type { PuzzleImage } from '../types';

// URL的寿命比图片数据短：Effect重新挂载时从保留的Blob重建，避免继续渲染已撤销的地址。
export function renewImageResource(image: PuzzleImage): PuzzleImage {
  return { ...image, url: URL.createObjectURL(image.blob) };
}

export function releaseImageResource(image: PuzzleImage | null): void {
  if (image?.url) URL.revokeObjectURL(image.url);
}
