import type { PuzzleImage, Tile } from '../types';
import { fisherYates } from './shuffle';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function validateImage(file: File): string | null {
  if (!allowedTypes.has(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name)) {
    return '请选择 JPG、PNG 或 WebP 格式的图片';
  }
  if (file.size === 0) return '这张图片是空文件，请换一张试试';
  if (file.size > MAX_FILE_BYTES) return '图片超过 10MB，请选择更小的图片';
  return null;
}

export async function prepareImage(blob: Blob, name: string): Promise<PuzzleImage> {
  const sourceUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('无效图片');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = Math.min(side, 1600);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建画布');
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2,
      side, side, 0, 0, canvas.width, canvas.height);
    const output = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error('图片处理失败')), 'image/png');
    });
    return { url: URL.createObjectURL(output), blob: output, sourceBlob: blob, name,
      originalWidth: image.naturalWidth, originalHeight: image.naturalHeight };
  } catch {
    throw new Error('无法读取这张图片，请尝试其他 JPG、PNG 或 WebP 图片');
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function createTiles(size: number): Tile[] {
  return Array.from({ length: size * size }, (_, index) => ({ id: index, correctIndex: index }));
}

// 每块的目标位置都等于当前下标时，拼图完成。
export function isComplete(tiles: readonly Tile[]): boolean {
  return tiles.length > 0 && tiles.every((tile, index) => tile.correctIndex === index);
}

// 返回新数组；无效下标和原地交换不会改动排列。
export function swapTiles(tiles: readonly Tile[], from: number, to: number): Tile[] {
  const result = [...tiles];
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 ||
      from >= result.length || to >= result.length || from === to) return result;
  [result[from], result[to]] = [result[to]!, result[from]!];
  return result;
}

// Fisher–Yates 从尾部抽样交换；若恰好有序，则交换前两块以保证开局未完成。
export function shuffle(tiles: readonly Tile[], random: () => number = Math.random): Tile[] {
  let result = fisherYates(tiles, random);
  if (result.length > 1 && isComplete(result)) result = swapTiles(result, 0, 1);
  return result;
}
