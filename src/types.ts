export type Difficulty = 3 | 4 | 5;
export type GridSize = Difficulty | 6 | 7 | 8;
export type GameStatus = 'ready' | 'playing' | 'completed';

export interface CropAdjustment { readonly zoom: number; readonly cx: number; readonly cy: number }

export interface Tile {
  readonly id: number;
  readonly correctIndex: number;
}

export interface PuzzleImage {
  readonly url: string;
  readonly blob: Blob;
  readonly sourceBlob?: Blob;
  readonly crop?: CropAdjustment;
  readonly name: string;
  readonly originalWidth: number;
  readonly originalHeight: number;
}

export interface GameState {
  readonly size: GridSize;
  readonly tiles: readonly Tile[];
  readonly selected: number | null;
  readonly moves: number;
  readonly startedAt: number | null;
  readonly elapsedMs: number;
  readonly status: GameStatus;
}
