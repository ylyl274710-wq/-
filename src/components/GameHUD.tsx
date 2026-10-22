import type { GameState } from '../types';
import type { PaperGameState } from '../hooks/usePaperGame';
import type { CampaignLevel } from '../lib/levels';
import { levelSource } from '../lib/levels';
import { formatTime } from '../lib/format';
import Icon from './Icon';
import PaperHUD from './PaperHUD';

interface Props {
  state: GameState | PaperGameState; preview: boolean; imageName: string; level?: CampaignLevel;
  onPreview: (value: boolean) => void; onReplay: () => void; onShowResult: () => void;
}

export default function GameHUD(props: Props) {
  if ('geometry' in props.state) return <PaperHUD {...props} state={props.state} />;
  return <ClassicHUD {...props} />;
}

function ClassicHUD({ state, preview, imageName, level, onPreview, onReplay, onShowResult }: Props) {
  const paper = 'geometry' in state;
  const correct = paper ? state.placed.length : state.tiles.filter((tile, i) => tile.correctIndex === i).length;
  const total = paper ? state.geometry.pieces.length : state.size ** 2;
  return <aside className={`game-sidebar${paper ? ' paper-controls' : ''}`} aria-label="游戏统计与操作">
    <div className="session-overview">
    <div className="session-label"><span>{level ? 'THE MASTERPIECE JOURNEY' : 'YOUR LITTLE SESSION'}</span><Icon name="spark" width="19" height="19" /></div>
    <h2>{level?.title ?? '享受拼合的过程'}</h2>
    <p className="sidebar-intro">{level ? <>{level.artist} · {level.year}<br />{total} 片细节，等你慢慢发现。</> : <>没有倒计时，也没有催促。<br />按自己的节奏，一片一片来。</>}</p>
    {paper && <p className="paper-spec">{state.geometry.shapeLabel}轮廓 · {total} 片随机纸片</p>}
    </div>
    <div className="session-metrics">
    <div className="hud">
      <div><span><Icon name="clock" width="16" height="16" /> 专注时长</span><strong data-testid="timer">{formatTime(state.elapsedMs)}</strong></div>
      <div><span><Icon name="move" width="16" height="16" /> {paper ? '放置次数' : '交换步数'}</span><strong data-testid="moves">{state.moves.toString().padStart(2, '0')}</strong></div>
    </div>
    <div className="progress-heading"><span>已找到位置</span><strong data-testid="placed">{correct} <span>/ {total}</span></strong></div>
    <progress value={correct} max={total} aria-label="已归位拼块数" />
    </div>
    <div className="session-tools">
    <div className="game-actions">
      <button className="primary-button preview-button" aria-pressed={preview}
        onPointerDown={event => {
          if (!event.isPrimary || event.button !== 0) return;
          event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onPreview(true);
        }}
        onPointerUp={() => onPreview(false)} onPointerCancel={() => onPreview(false)}
        onLostPointerCapture={() => onPreview(false)} onBlur={() => onPreview(false)}
        onKeyDown={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); onPreview(true); } }}
        onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') onPreview(false); }}>
        <Icon name="eye" /><span>{preview ? '松开回到拼图' : '按住预览原图'}</span></button>
      <button className="secondary-button" onClick={onReplay}><Icon name="refresh" /> {paper ? '重新随机切割' : '重新打乱'}</button>
      {state.status === 'completed' && <button className="text-button mx-auto" onClick={onShowResult}>查看本次成绩 ↗</button>}
    </div>
    <div className="little-note"><span>{level ? '旅途中的小提示' : '一点小提示'}</span>
      <p>{paper ? '先沿外轮廓拼起，再找颜色和撕纸切口。靠近对应位置时，纸片会自动吸附。' : level ? '先找到大色块与线条，再观察笔触。完成这一幅，下一段风景就会打开。' : <>先找角落与边缘，再看看颜色和线条。<br />每一次交换，都是新的发现。</>}</p></div>
    </div>
    <div className="session-source">
    <div className="image-name"><Icon name="image" width="14" height="14" /><span>{imageName}</span></div>
    {level && <a className="artwork-source game-source" href={levelSource(level)} target="_blank" rel="noreferrer">查看馆藏原作 · 公有领域 ↗</a>}
    </div>
  </aside>;
}
