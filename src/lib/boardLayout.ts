export interface BoardLayout { readonly boardSize: number; readonly columns: number; readonly pieceSize: number; readonly stacked: boolean }

// 在可用宽高中搜索能容纳全部纸片的方形网格，不截断、不分页。
export function fitBoardLayout(width: number, height: number, count: number): BoardLayout {
  const w = Math.max(1, width), h = Math.max(1, height);
  const stacked = w < 700;
  const gap = stacked ? 10 : 20;
  const mobileBoardShare = .55 - Math.min(1, Math.max(0, count - 36) / 64) * .1;
  const boardSize = Math.floor(Math.min(600, stacked ? Math.min(w, h * mobileBoardShare) : Math.min(h, w * .52)));
  const trayWidth = stacked ? w : Math.max(1, w - boardSize - gap);
  const trayHeight = stacked ? Math.max(1, h - boardSize - gap) : h;
  const innerWidth = Math.max(1, trayWidth - 18), innerHeight = Math.max(1, trayHeight - 44);
  const pieceGap = 4;
  let columns = 1, pieceSize = 0;
  for (let cols = 1; cols <= count; cols++) {
    const rows = Math.ceil(count / cols);
    const size = Math.min((innerWidth - (cols - 1) * pieceGap) / cols, (innerHeight - (rows - 1) * pieceGap) / rows, stacked ? 110 : 145);
    if (size > pieceSize) { columns = cols; pieceSize = size; }
  }
  return { boardSize, columns, pieceSize: Math.max(1, Math.floor(pieceSize)), stacked };
}
