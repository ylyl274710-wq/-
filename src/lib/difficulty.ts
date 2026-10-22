import type { SavedSession } from './studioTypes';

export function restoredHardEligibility(session?: SavedSession): boolean {
  return session?.hardEligible ?? (session?.state.moves ?? 0) === 0;
}
export function hardBonusEligible(keptHard: boolean, hardMode: boolean, moves: number): boolean {
  return keptHard && (hardMode || moves === 0);
}
export function difficultyLabel(entry: Pick<SavedSession, 'hardMode' | 'hardEligible'>): string {
  return !entry.hardMode ? '普通模式' : entry.hardEligible === false ? '困难视图 · 无困难加分' : '困难模式';
}
