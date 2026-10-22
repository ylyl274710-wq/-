import type { GridSize } from '../types';
import type { PuzzleSettings, ShapeKind } from './paperGeometry';

export interface CampaignLevel {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly year: string;
  readonly gridSize: GridSize;
  readonly description: string;
  readonly artworkId: number;
}

export const LEVELS: readonly CampaignLevel[] = [
  { id: 'bedroom', title: '阿尔的卧室', artist: '文森特·梵高', year: '1889', gridSize: 3,
    description: '从温暖的房间出发，让清晰的色块带你找到第一份完整。', artworkId: 28560 },
  { id: 'great-wave', title: '神奈川冲浪里', artist: '葛饰北斋', year: '1830–1833', gridSize: 4,
    description: '跟随浪花的轮廓，在深蓝与留白之间，接住海的节奏。', artworkId: 24645 },
  { id: 'paris-rain', title: '雨天的巴黎街道', artist: '古斯塔夫·卡耶博特', year: '1877', gridSize: 5,
    description: '沿着街角、伞面与倒影，走进一场属于巴黎的细雨。', artworkId: 20684 },
  { id: 'bordighera', title: '博尔迪盖拉', artist: '克劳德·莫奈', year: '1884', gridSize: 6,
    description: '树影与地中海的光交错，更多碎片，也有更多值得停留的细节。', artworkId: 81537 },
  { id: 'grande-jatte', title: '大碗岛的星期天下午', artist: '乔治·修拉', year: '1884–1886', gridSize: 7,
    description: '从人物与树荫中寻找线索，让细密的色点慢慢连成周末。', artworkId: 27992 },
  { id: 'water-lilies', title: '睡莲', artist: '克劳德·莫奈', year: '1906', gridSize: 8,
    description: '最后一站，把相近的水色、花影和笔触，拼成一池安静。', artworkId: 16568 }
];

export const levelImage = (level: CampaignLevel) => `${(import.meta.env?.BASE_URL ?? '/')}levels/${level.id}.jpg`;
export const levelThumbnail = (level: CampaignLevel) => `${(import.meta.env?.BASE_URL ?? '/')}levels/${level.id}-thumb.webp`;
export const levelSource = (level: CampaignLevel) => `https://www.artic.edu/artworks/${level.artworkId}`;
export function levelSettings(index: number): PuzzleSettings {
  const shapes: readonly ShapeKind[] = ['circle', 'heart', 'hexagon', 'star', 'circle', 'heart'];
  return { pieceCount: (LEVELS[index]?.gridSize ?? 3) ** 2, shape: shapes[index] ?? 'circle', customOutline: [] };
}

