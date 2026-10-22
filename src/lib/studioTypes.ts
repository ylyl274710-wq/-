import type { PuzzleImage } from '../types';
import type { PuzzleSettings } from './paperGeometry';
import type { PaperGameState } from './paperReducer';
import type { PlayOptions } from './experiences';

export interface RunContext { kind: 'custom' | 'campaign' | 'daily' | 'theme' | 'weekly'; title?: string; levelIndex?: number; date?: string; themeId?: string }
export type StoredImage = Omit<PuzzleImage, 'url'>;
export interface SavedSession { version: 1; id: string; image: StoredImage; settings: PuzzleSettings; state: PaperGameState; hardMode: boolean; hardEligible?: boolean; context: RunContext; savedAt: number; options?: PlayOptions }
export interface CollectionEntry extends SavedSession { completedAt: number; score: number; trashed?: boolean }
export interface ActiveRun { id: string; settings: PuzzleSettings; context: RunContext; seed?: number; restored?: SavedSession; options?: PlayOptions }
