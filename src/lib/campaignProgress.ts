import { LEVELS } from './levels';

export const PROGRESS_KEY = 'piece-by-piece:campaign:v1';
export interface LevelResult { readonly levelId: string; readonly moves: number; readonly elapsedMs: number }
export interface CampaignProgress { readonly version: 1; readonly results: readonly LevelResult[] }
export const emptyProgress = (): CampaignProgress => ({ version: 1, results: [] });

function isResult(value: unknown, index: number): value is LevelResult {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return candidate.levelId === LEVELS[index]?.id && typeof candidate.moves === 'number' &&
    Number.isSafeInteger(candidate.moves) && candidate.moves >= 1 && typeof candidate.elapsedMs === 'number' &&
    Number.isFinite(candidate.elapsedMs) && candidate.elapsedMs >= 0;
}

// 只恢复连续的合法通关记录，损坏数据和跳关记录不能解锁后面的关卡。
export function parseProgress(raw: string | null): CampaignProgress {
  if (!raw) return emptyProgress();
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object') return emptyProgress();
    const candidate = data as Record<string, unknown>;
    if (candidate.version !== 1 || !Array.isArray(candidate.results)) return emptyProgress();
    const results: LevelResult[] = [];
    for (const entry of candidate.results.slice(0, LEVELS.length)) {
      if (!isResult(entry, results.length)) break;
      results.push({ levelId: entry.levelId, moves: entry.moves, elapsedMs: entry.elapsedMs });
    }
    return { version: 1, results };
  } catch { return emptyProgress(); }
}

export function canPlayLevel(progress: CampaignProgress, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < LEVELS.length && index <= progress.results.length;
}

// 每次只能追加紧邻的一关；重玩已完成关卡时保留更快的一次完整成绩。
export function completeLevel(progress: CampaignProgress, index: number, result: LevelResult): CampaignProgress {
  if (!canPlayLevel(progress, index) || !isResult(result, index)) return progress;
  const previous = progress.results[index];
  if (previous && (previous.elapsedMs < result.elapsedMs ||
    (previous.elapsedMs === result.elapsedMs && previous.moves <= result.moves))) return progress;
  const results = [...progress.results];
  results[index] = result;
  return { version: 1, results };
}

export function mergeProgress(a: CampaignProgress, b: CampaignProgress): CampaignProgress {
  let merged = a;
  b.results.forEach((result, index) => { merged = completeLevel(merged, index, result); });
  return merged;
}
