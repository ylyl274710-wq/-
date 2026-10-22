import type { PaperGameState } from './paperReducer';

// 计时、成绩和文字反馈由 HUD 负责，只有可见纸片发生变化才重绘棋盘。
export function sameBoardState(a: PaperGameState, b: PaperGameState): boolean {
  return a.geometry === b.geometry && a.order === b.order && a.placed === b.placed &&
    a.loose === b.loose && a.selected === b.selected && a.marked === b.marked &&
    a.hinted === b.hinted && a.hintsUsed === b.hintsUsed && a.status === b.status;
}
