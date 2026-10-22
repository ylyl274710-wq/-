import type { PaperAction, PaperGameState } from './paperReducer';
import type { PuzzleParcel } from './exchange';
export interface RoomUpdate { id: string; version: number; state: PaperGameState; players: { name: string; online: boolean }[]; actor: string; updatedAt: number; expiresAt?: number; hardMode?: boolean; hardEligible?: boolean }
export interface RoomWelcome extends RoomUpdate { parcel: PuzzleParcel; token: string }
export type RoomAction = Extract<PaperAction, { type: 'place' | 'hint' | 'assist' | 'return' }> | { type: 'difficulty'; hardMode: boolean };
