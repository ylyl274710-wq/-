import type { PaperGameState } from '../hooks/usePaperGame';
import type { CampaignLevel } from '../lib/levels';
import { levelSource } from '../lib/levels';
import { formatTime } from '../lib/format';
import Icon from './Icon';

interface Props {
  state: PaperGameState; preview: boolean; imageName: string; level?: CampaignLevel; fixedCut?: boolean;
  onPreview: (value: boolean) => void; onReplay: () => void; onShowResult: () => void;
  onHint?: () => void; onAssist?: () => void; onUndo?: () => void; canUndo?: boolean; onTutorial?: () => void;
  previewLocked?: boolean; onRelay?: () => void; onInvite?: () => void; replayLabel?: string;
  relaxed?: boolean;
}

export default function PaperHUD({ state, preview, imageName, level, fixedCut, onPreview, onReplay, onShowResult, onHint, onAssist, onUndo, canUndo, onTutorial, previewLocked, onRelay, onInvite, replayLabel, relaxed }: Props) {
  const total = state.geometry.pieces.length;
  return <aside className="paper-toolbar" aria-label="游戏统计与操作">
    <div className="toolbar-stats">
      <div><span><Icon name="clock" />{relaxed ? '这一刻' : '用时'}</span><strong className={relaxed ? 'relaxed-timer' : undefined} data-testid="timer">{relaxed ? '慢慢来' : formatTime(state.elapsedMs)}</strong></div>
      <div><span><Icon name="move" />放置</span><strong data-testid="moves">{state.moves.toString().padStart(2, '0')}</strong></div>
      <div className="toolbar-progress"><span>已完成</span><strong data-testid="placed">{state.placed.length}<small> / {total}</small></strong>
        <progress value={state.placed.length} max={total} aria-label="已归位拼块数" /></div>
    </div>
    <p className="toolbar-tip">相邻切口能连成一组 · 提示 {state.hintsUsed} 次</p>
    <div className="toolbar-actions">
      <button type="button" className="primary-button preview-button" aria-label={previewLocked ? '惊喜模式拼完揭晓原图' : '按住预览原图'} aria-pressed={preview} disabled={previewLocked}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onPreview(true);
        }}
        onPointerUp={() => onPreview(false)} onPointerCancel={() => onPreview(false)}
        onLostPointerCapture={() => onPreview(false)} onBlur={() => onPreview(false)}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onPreview(true); } }}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') onPreview(false); }}>
        <Icon name="eye" /><span>{previewLocked ? '拼完揭晓' : preview ? '松开返回' : '预览原图'}</span></button>
      {onHint && state.status !== 'completed' && <button type="button" className="secondary-button hint-button" aria-label="提示所选纸片位置" title={state.selected === null ? '先选择一片纸片' : `高亮第 ${state.selected + 1} 片的正确位置`} disabled={state.selected === null || preview} aria-pressed={state.selected !== null && state.hinted === state.selected} onClick={onHint}><Icon name="spark" /><span>提示</span></button>}
      <button type="button" className="secondary-button" aria-label={replayLabel ?? (fixedCut ? '重新开始今日拼图' : '重新随机切割')} title={replayLabel ?? (fixedCut ? '保留今日固定切口，重新开始' : '重新随机切割，重置本局进度')} onClick={onReplay}><Icon name="refresh" /><span>{replayLabel ? '接力' : fixedCut ? '重来' : '重切'}</span></button>
      {state.status === 'completed' && <button type="button" className="secondary-button" onClick={onShowResult}>成绩</button>}
      <details className="toolbar-help" onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.open = false; }}><summary aria-label="提示、撤销与操作说明" title="提示、撤销与操作说明">•••</summary>
        <div><strong>拼图小工具</strong><div className="game-tool-grid"><button disabled={state.status === 'completed'} onClick={onAssist}>帮我放回一片</button>{onUndo && <button disabled={!canUndo} onClick={onUndo}>撤销上次重切</button>}{onTutorial && <button onClick={onTutorial}>新手三步指引</button>}{onRelay && <button onClick={onRelay}>导出接力包</button>}{onInvite && <button onClick={onInvite}>邀请朋友联机拼</button>}</div><p>先选纸片，再点底部「提示」，画布会高亮它的正确位置。提示与自动放置都会计入提示次数和分数。重切后仍可撤销，回到原来的碎片与进度。</p><p>选片可放大查看、标记或收回；切口相邻的暂放纸片可自动组合，拖动任一片即可整组移动。</p>
          <p>键盘：Tab 选纸片，空格选中；进入画布后用方向键移动落点，Enter 放置，Shift 微调。</p>
          <span>{imageName}</span>{level && <a href={levelSource(level)} target="_blank" rel="noreferrer">查看馆藏原作 ↗</a>}</div>
      </details>
    </div>
  </aside>;
}
