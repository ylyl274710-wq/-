import { difficultyLabel } from '../lib/difficulty';
import { useEffect, useRef } from 'react';
import type { GameState } from '../types';
import type { PaperGameState } from '../hooks/usePaperGame';
import { formatTime } from '../lib/format';
import Icon from './Icon';
import type { CollectionEntry } from '../lib/studioTypes';

export interface GentleResult { title: string; completed: number; total: number; onNext: () => void }

export interface ThemeResult { title: string; index: number; total: number; busy: boolean; onNext: () => void }

interface Props {
  state: GameState | PaperGameState; imageUrl: string; onReplay: () => void; onChange: () => void; onClose: () => void;
  campaign?: { index: number; isLast: boolean; busy: boolean; error: string | null; onNext: () => void };
  entry?: CollectionEntry; onDownload?: () => void; onCollection?: () => void;
  theme?: ThemeResult;
  onReplayVideo?: () => void; onMoment?: () => void; onGift?: () => void; gentle?: GentleResult;
}

export default function ResultModal({ state, imageUrl, onReplay, onChange, onClose, campaign, entry, onDownload, onCollection, theme, onReplayVideo, onMoment, onGift, gentle }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const replay = useRef<HTMLButtonElement>(null);
  const paper = 'geometry' in state;
  const gift = entry?.options?.gift;
  const isGift = !!gift && !entry?.options?.weekly && entry?.context.kind !== 'weekly';
  const previewGift = isGift && entry?.options?.giftPreview === true;
  const relaxed = entry?.options?.relaxed === true;
  const themeFinished = theme !== undefined && theme.index === theme.total - 1;
  const resultClip = paper ? `polygon(${state.geometry.outline.map(p => `${p.x / 10}% ${p.y / 10}%`).join(',')})` : undefined;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    replay.current?.focus();
    return () => element?.close();
  }, []);
  return <dialog ref={dialog} className="result-modal" aria-labelledby="result-title" aria-describedby="result-description"
    onCancel={event => { event.preventDefault(); onClose(); }}
    >
    <button className="modal-close icon-button" onClick={onClose} aria-label="关闭成绩"><Icon name="close" /></button>
    <div className="result-image"><img src={imageUrl} alt="已完成的拼图" style={{ clipPath: resultClip }} /><span><Icon name="check" width="24" height="24" /></span></div>
    <p className="eyebrow justify-center">EVERY PIECE FOUND ITS PLACE</p>
    <h2 id="result-title">{theme ? themeFinished ? '主题旅程，圆满完成。' : '下一幅风景，已解锁。' : campaign ? campaign.isLast ? '名画之旅，圆满完成。' : '下一幅风景，已解锁。' : isGift ? previewGift ? '这份礼物，已经试拼完成。' : '这份心意，已经拼开。' : relaxed ? '这几分钟，留给自己。' : '美好，完整了。'}</h2>
    <p id="result-description">{theme ? `${theme.title} · 第 ${theme.index + 1} / ${theme.total} 关已完成${themeFinished ? '，去发现另一条旅程吧。' : '，下一幅美好正在等你。'}` : campaign ? campaign.isLast ? '六幅名作已全部收藏，谢谢你一路的专注。' : `第 ${campaign.index + 1} 关已完成，带着这份快乐继续出发。` : isGift ? previewGift ? '对方拼好后，就会在这里看到你留下的话。' : '有人想到你，把这份喜欢放在了纸片里。' : relaxed ? '不用更快，慢慢完成也很好。' : '你用一点耐心，拼回了一整份快乐。'}</p>
    {(relaxed || isGift) ? <details className="result-record"><summary>查看本次用时与成绩</summary><div className="result-stats">
      <div><strong>{formatTime(state.elapsedMs)}</strong><span>专注时光</span></div>
      <div><strong>{state.moves}</strong><span>{paper ? '放置次数' : '交换步数'}</span></div>
      <div><strong>{paper ? `${state.geometry.pieces.length}片` : `${state.size} × ${state.size}`}</strong><span>{paper ? state.geometry.shapeLabel : '本次难度'}</span></div>
    </div>{entry && <p className="result-score">{entry.score} 分 · 提示 {entry.state.hintsUsed} 次 · {difficultyLabel(entry)}</p>}</details> : <><div className="result-stats">
      <div><strong>{formatTime(state.elapsedMs)}</strong><span>专注时光</span></div>
      <div><strong>{state.moves}</strong><span>{paper ? '放置次数' : '交换步数'}</span></div>
      <div><strong>{paper ? `${state.geometry.pieces.length}片` : `${state.size} × ${state.size}`}</strong><span>{paper ? state.geometry.shapeLabel : '本次难度'}</span></div>
    </div>{entry && <p className="result-score">本次 {entry.score} 分 · 提示 {entry.state.hintsUsed} 次 · {difficultyLabel(entry)}</p>}</>}
    {entry?.options?.gift && <div className="gift-reveal"><span>TO {entry.options.gift.to || '亲爱的你'}</span><p>{entry.options.gift.message}</p><small>— {entry.options.gift.from || '一位想着你的人'}</small></div>}
    {entry?.options?.duo && <p className="result-score">{entry.options.duo[0]} & {entry.options.duo[1]} · 一起拼回的美好</p>}
    {entry && <div className="result-studio-actions">{onMoment && <button className="secondary-button" onClick={onMoment}>制作分享卡</button>}<button className="secondary-button" onClick={onCollection}>去收藏墙</button><details className="result-more"><summary>更多纪念方式</summary><button className="text-button" onClick={onDownload}>下载成绩纪念卡</button>{onReplayVideo && <button className="text-button" onClick={onReplayVideo}>观看 / 导出过程回放</button>}</details></div>}
    {theme ? <>
      <button ref={replay} className="primary-button w-full" disabled={theme.busy} onClick={themeFinished ? onChange : theme.onNext}>{theme.busy ? '正在准备下一幅…' : themeFinished ? '探索其他主题' : '进入主题下一关'}<Icon name="arrow" /></button>
      <div className="campaign-result-actions"><button className="secondary-button" disabled={theme.busy} onClick={onReplay}>再来一局</button><button className="secondary-button nav-back-button" disabled={theme.busy} onClick={onChange}>返回主题目录</button></div>
    </> : campaign ? <>
      {campaign.error && <p className="load-error" role="alert">{campaign.error}</p>}
      <button ref={replay} className="primary-button w-full" disabled={campaign.busy}
        onClick={campaign.isLast ? onChange : campaign.onNext}>
        {campaign.busy ? '正在准备下一幅…' : campaign.isLast ? '查看我的名画收藏' : '进入下一关'}<Icon name="arrow" /></button>
      <div className="campaign-result-actions"><button className="secondary-button" disabled={campaign.busy} onClick={onReplay}>再来一局</button>
        <button className="secondary-button nav-back-button" onClick={onChange}>返回关卡</button></div>
    </> : isGift ? <>
      <button ref={replay} className="primary-button w-full" onClick={previewGift ? onChange : onGift ?? onChange}>{previewGift ? '回去准备礼物' : onGift ? '回送一份照片礼物' : '返回首页'} <Icon name="arrow" /></button>
      <button className="text-button result-leave" onClick={onChange}>{previewGift ? '返回礼物制作' : '先把这份心意收好，返回首页'}</button>
    </> : relaxed && gentle ? <>
      <p className="gentle-result-note">本周 · {gentle.title} · 已收藏 {gentle.completed} / {gentle.total} 幅<br /><small>三幅小风景，想来就来，不用补签。</small></p>
      <button ref={replay} className="primary-button w-full" onClick={gentle.onNext}>再拼一张小风景 <Icon name="arrow" /></button>
      {onGift && <button className="secondary-button w-full mt-3" onClick={onGift}>把喜欢的照片，送给一个人</button>}
      <button className="text-button result-leave" onClick={onChange}>回到首页，先歇一会</button>
    </> : <>
      <button ref={replay} className="primary-button w-full" onClick={onReplay}><Icon name="refresh" /> 再来一局</button>
      <button className="secondary-button w-full mt-3" onClick={onChange}>换张图，继续发现美好 <Icon name="arrow" /></button>
    </>}
  </dialog>;
}
