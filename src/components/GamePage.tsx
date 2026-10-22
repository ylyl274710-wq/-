import { useEffect, useRef, useState } from 'react';
import type { GameState, GridSize, PuzzleImage } from '../types';
import type { CampaignLevel } from '../lib/levels';
import { LEVELS } from '../lib/levels';
import { useGame } from '../hooks/useGame';
import PuzzleBoard from './PuzzleBoard';
import ResultModal from './ResultModal';
import GameHUD from './GameHUD';
import Icon from './Icon';

export interface CampaignSession {
  level: CampaignLevel; index: number; busy: boolean; error: string | null;
  onComplete: (state: GameState) => void; onNext: () => void;
}
interface Props { image: PuzzleImage; size: GridSize; onChange: () => void; campaign?: CampaignSession }

export default function GamePage({ image, size, onChange, campaign }: Props) {
  const { state, select, swap, reset } = useGame(size);
  const [preview, setPreview] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const reported = useRef(false);
  useEffect(() => {
    if (state.status !== 'completed') { reported.current = false; return; }
    if (!reported.current) { reported.current = true; campaign?.onComplete(state); }
  }, [state, campaign]);
  useEffect(() => {
    if (state.status !== 'completed') return;
    const timer = window.setTimeout(() => setShowResult(true), 850);
    return () => window.clearTimeout(timer);
  }, [state.status]);
  useEffect(() => {
    const release = () => setPreview(false);
    window.addEventListener('blur', release);
    return () => window.removeEventListener('blur', release);
  }, []);
  function replay() { setShowResult(false); setPreview(false); reset(); }
  const isLast = campaign?.index === LEVELS.length - 1;
  return <main className="game-layout">
    <div className="game-heading"><div>
      <p className="eyebrow">{campaign ? `名画闯关 / 第 ${campaign.index + 1} 关，共 ${LEVELS.length} 关` : 'A LITTLE FOCUS. A LITTLE JOY.'}</p>
      <h1>{campaign ? campaign.level.title : '让每一片，找到归处。'}</h1></div>
      <button className="secondary-button change-button" onClick={onChange}><Icon name={campaign ? 'arrow' : 'image'} />{campaign ? '返回关卡' : '换一张图'}</button></div>
    <div className="game-workspace">
      <section className="board-area">
        <div className="board-topline"><span><i />{state.status === 'completed' ? '每一片都刚刚好' : state.status === 'ready' ? '准备好了，慢慢来' : '专注于眼前这一片'}</span><span>{size} × {size} · {size ** 2} PIECES</span></div>
        <PuzzleBoard state={state} url={image.url} preview={preview} onSelect={select} onSwap={swap} />
        <p id="board-instructions" className="board-instructions"><Icon name="move" width="15" height="15" /> 点击两块交换，或拖动一块到另一块上<span>键盘：方向键移动 · 空格选择</span></p>
      </section>
      <GameHUD state={state} preview={preview} imageName={image.name} level={campaign?.level}
        onPreview={setPreview} onReplay={replay} onShowResult={() => setShowResult(true)} />
    </div>
    <p className="sr-only" role="status" aria-live="polite">{state.status === 'completed' ? `拼图完成，共交换 ${state.moves} 步` : state.selected === null ? '' : `已选择位置 ${state.selected + 1}，请选择另一块交换`}</p>
    {showResult && <ResultModal state={state} imageUrl={image.url} onReplay={replay} onChange={onChange} onClose={() => setShowResult(false)}
      campaign={campaign ? { index: campaign.index, isLast, busy: campaign.busy, error: campaign.error, onNext: campaign.onNext } : undefined} />}
  </main>;
}
