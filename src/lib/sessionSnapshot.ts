import type { SavedSession } from './studioTypes';

// Blob 与不可变状态共享引用。忽略计时 tick，避免空闲时重复复制图片和整个回放。
export function sameSessionContent(a: SavedSession, b: SavedSession): boolean {
  const x = a.state, y = b.state;
  return a.id === b.id && a.image.blob === b.image.blob && a.image.sourceBlob === b.image.sourceBlob &&
    a.settings === b.settings && a.context === b.context && a.options === b.options &&
    a.hardMode === b.hardMode && a.hardEligible === b.hardEligible && x.geometry === y.geometry &&
    x.order === y.order && x.placed === y.placed && x.loose === y.loose && x.selected === y.selected &&
    x.marked === y.marked && x.hinted === y.hinted && x.hintsUsed === y.hintsUsed &&
    x.moves === y.moves && x.status === y.status && x.history === y.history;
}
