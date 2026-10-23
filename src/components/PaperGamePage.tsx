import { newId } from '../lib/id';
import { useEffect, useRef, useState } from 'react';
import type { PuzzleImage } from '../types';
import type { PuzzleSettings } from '../lib/paperGeometry';
import type { PaperGameState } from '../hooks/usePaperGame';
import { usePaperGame } from '../hooks/usePaperGame';
import { challengeScore } from '../lib/paperReducer';
import type { ActiveRun, CollectionEntry, SavedSession } from '../lib/studioTypes';
import type { CampaignLevel } from '../lib/levels';
import { LEVELS } from '../lib/levels';
import { exportMemoryCard } from '../lib/memoryCard';
import PaperBoard from './PaperBoard';
import PaperHUD from './PaperHUD';
import ResultModal from './ResultModal';
import type { ThemeResult } from './ResultModal';
import TutorialCoach, { tutorialFinished } from './TutorialCoach';
import Icon from './Icon';
import ReplayStudio from './ReplayStudio';
import StudioDialog from './StudioDialog';
import { exportParcel, makeParcel } from '../lib/exchange';
import { createRoom } from '../lib/online';
import { PERSONAL_ONLY } from '../lib/siteMode';
import type { RoomWelcome } from '../lib/onlineTypes';
import { restoredHardEligibility, hardBonusEligible } from '../lib/difficulty';
import { useSessionAutosave } from '../hooks/useSessionAutosave';
import MomentStudio from './MomentStudio';
import type { GentleResult } from './ResultModal';

interface Props {
  image: PuzzleImage; settings: PuzzleSettings; run: ActiveRun; storage: 'loading' | 'ready' | 'unavailable'; onChange: () => void;
  onSave: (session: SavedSession) => Promise<void>; onCompleteEntry: (entry: CollectionEntry) => void; onCollection: () => void; onError: (text: string) => void;
  campaign?: { level: CampaignLevel; index: number; busy: boolean; error: string | null; onComplete: (state: PaperGameState) => void; onNext: () => void };
  theme?: ThemeResult;
  onRoom: (room: RoomWelcome) => void;
  onGift?: () => void; gentle?: GentleResult;
}

export default function PaperGamePage({ image, settings, run, storage, onChange, onSave, onCompleteEntry, onCollection, onError, campaign, theme, onRoom, onGift, gentle }: Props) {
  const game = usePaperGame(settings, run.restored?.state, run.seed), { state } = game;
  const [preview, setPreview] = useState(false), [showResult, setShowResult] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [momentOpen, setMomentOpen] = useState(false);
  const [hardMode, setHardMode] = useState(run.restored?.hardMode ?? false), [sessionId, setSessionId] = useState(run.id);
  const [keptHard, setKeptHard] = useState(() => restoredHardEligibility(run.restored));
  const hardEligible = hardBonusEligible(keptHard, hardMode, state.moves);
  useEffect(() => { if (!hardEligible) setKeptHard(false); }, [hardEligible]);
  const [finished, setFinished] = useState<CollectionEntry | null>(null), [tutorial, setTutorial] = useState(() => !tutorialFinished());
  const [replayVideo, setReplayVideo] = useState(false), [inviteOpen, setInviteOpen] = useState(false), [inviting, setInviting] = useState(false), [inviteError, setInviteError] = useState('');
  const mode = run.options?.mode ?? 'classic', progress = state.placed.length / state.geometry.pieces.length;
  const reported = useRef(false), undoInfo = useRef<{ id: string; finished: CollectionEntry | null; hardMode: boolean; hardEligible: boolean } | null>(null);
  const snapshot: SavedSession = { version: 1, id: sessionId, image: { blob: image.blob, sourceBlob: image.sourceBlob, crop: image.crop, name: image.name, originalWidth: image.originalWidth, originalHeight: image.originalHeight }, settings, state, hardMode, hardEligible, context: run.context, savedAt: Date.now(), options: run.options };
  const latest = useRef(snapshot); latest.current = snapshot;
  const autosave = useSessionAutosave(snapshot, onSave);
  useEffect(() => {
    if (state.status !== 'completed') { reported.current = false; return; }
    if (!reported.current) {
      reported.current = true;
      if (!finished) {
        const entry: CollectionEntry = { ...latest.current, completedAt: Date.now(), score: challengeScore(state, hardMode && hardEligible) };
        setFinished(entry); onCompleteEntry(entry); campaign?.onComplete(state);
      }
    }
  }, [state.status, state.geometry, sessionId, hardMode, hardEligible]);
  useEffect(() => { if (state.status !== 'completed') return; const timer = window.setTimeout(() => setShowResult(true), 850); return () => window.clearTimeout(timer); }, [state.status]);
  useEffect(() => { const release = () => setPreview(false); window.addEventListener('blur', release); return () => window.removeEventListener('blur', release); }, []);
  function replay() { setRestartOpen(false); undoInfo.current = { id: sessionId, finished, hardMode, hardEligible }; setKeptHard(true); setSessionId(newId()); setFinished(null); setPreview(false); setShowResult(false); game.reset(run.context.kind === 'daily' ? state.geometry.seed : undefined); }
  function requestReplay() { if (state.status !== 'completed' && state.moves > 0) setRestartOpen(true); else replay(); }
  function undo() { const previous = undoInfo.current; if (!previous) return; setSessionId(previous.id); setFinished(previous.finished); setHardMode(previous.hardMode); setKeptHard(previous.hardEligible); setShowResult(false); game.undo(); undoInfo.current = null; }
  function toggleHard() { if (!hardEligible || state.moves > 0 && hardMode) setKeptHard(false); setHardMode(previous => !previous); }
  function leave() { autosave.flush(); onChange(); }
  async function download() { if (!finished) return; try { await exportMemoryCard(finished); } catch { onError('纪念卡生成失败，请重试'); } }
  return <main className="game-layout paper-game-layout">
    <div className="game-heading"><div><p className="eyebrow">{run.context.memory ? 'TWO PHOTOS / ONE MEMORY' : run.context.kind === 'weekly' ? `每周来信 / 第 ${(run.context.levelIndex ?? 0) + 1} 封` : run.context.kind === 'daily' ? `每日一拼 / ${run.context.date}` : campaign ? `名画闯关 / 第 ${campaign.index + 1} 关` : run.context.kind === 'theme' ? `主题旅程 / 第 ${(run.context.levelIndex ?? 0) + 1} 关` : mode === 'mystery' ? 'A LITTLE SURPRISE TO UNCOVER' : mode === 'restore' ? 'LET THE COLORS COME BACK' : 'YOUR LITTLE PUZZLE STUDIO'}</p><h1>{run.context.title ?? '把零散，拼成喜欢的形状。'}{run.options?.duo && state.status !== 'completed' && <small className="turn-badge">轮到{run.options.duo[state.moves % 2]}</small>}</h1></div>
      <div className="game-heading-actions"><button type="button" className="difficulty-chip" disabled={state.status === 'completed'} aria-pressed={hardMode} aria-label="困难模式" title={hardMode ? '关闭困难模式，显示内部轮廓' : '首次放置前开启并全程保持，才能获得困难加分'} onClick={toggleHard}><Icon name="spark" /><span>困难</span><i aria-hidden="true" /></button><button className="secondary-button change-button nav-back-button" onClick={leave}><Icon name="image" /><span>{run.context.kind === 'custom' ? '返回' : '目录'}</span></button></div>
    </div>
    <div className="game-workspace"><section className="board-area"><div className="board-topline"><span>{state.geometry.shapeLabel} · {state.geometry.pieces.length}片 <small className={`autosave-label ${storage === 'unavailable' || autosave.status === 'error' ? 'has-error' : ''}`} aria-live="off">{storage === 'unavailable' || autosave.status === 'error' ? '未能保存' : state.status === 'completed' ? '已完成' : autosave.status === 'saving' ? '保存中…' : '已保存到本机'}</small></span><p id="paper-feedback" className="compact-feedback" role="status" aria-live="polite">{state.feedback || (mode === 'mystery' ? `线索：${(run.options?.gift?.keywords ?? '颜色、边缘、一个惊喜').split(/[、，,]/).slice(0, Math.max(1, Math.ceil(progress * 3))).join(' · ')}` : mode === 'restore' ? '每放对一片，旧画就恢复一片颜色。' : hardMode ? hardEligible ? '困难模式 · 全程保持可获得加分' : '轮廓已隐藏 · 本局曾使用普通轮廓，无困难加分' : '可暂放、拼接，再整组拖回。')}</p></div>
      <PaperBoard state={state} url={image.url} preview={preview} hardMode={hardMode} restoration={mode === 'restore'} onSelect={game.select} onPlace={game.place} onMark={game.mark} onReturn={game.returnToTray} onDeselect={game.deselect} />
    </section><PaperHUD relaxed={run.options?.relaxed} state={state} preview={preview} previewLocked={mode === 'mystery' && state.status !== 'completed'} imageName={image.name} level={campaign?.level} fixedCut={run.context.kind === 'daily'} onPreview={setPreview} onReplay={requestReplay} onShowResult={() => setShowResult(true)} onHint={game.hint} onAssist={game.assist} onUndo={undo} canUndo={game.canUndo} onTutorial={() => setTutorial(true)} onRelay={() => void exportParcel(latest.current, 'relay').catch(() => onError('接力包未能导出'))} onInvite={PERSONAL_ONLY ? undefined : () => setInviteOpen(true)} /></div>
    {restartOpen && <StudioDialog title={run.context.kind === 'daily' ? '重新开始今天的拼图？' : '重新切出一桌纸片？'} onClose={() => setRestartOpen(false)}><p className="studio-muted">已归位 {state.placed.length} / {state.geometry.pieces.length} 片，放置 {state.moves} 次。{run.context.kind === 'daily' ? '会保留今天的切口，清空本局进度。' : '会生成新的随机切口，清空本局进度。'}重来后仍可在工具菜单撤销这次重切。</p><div className="studio-dialog-actions"><button className="secondary-button" onClick={() => setRestartOpen(false)}>继续当前拼图</button><button className="primary-button" onClick={replay}>确认重新开始</button></div></StudioDialog>}
    {tutorial && <TutorialCoach selected={state.selected} placed={state.placed.length} preview={preview} onClose={() => setTutorial(false)} />}
    {showResult && <ResultModal state={state} imageUrl={image.url} onReplay={replay} onChange={leave} onClose={() => setShowResult(false)} entry={finished ?? undefined} onDownload={() => void download()} onCollection={onCollection} onReplayVideo={() => { setShowResult(false); setReplayVideo(true); }} onMoment={() => { setShowResult(false); setMomentOpen(true); }} onGift={onGift} gentle={gentle} theme={theme} campaign={campaign ? { index: campaign.index, isLast: campaign.index === LEVELS.length - 1, busy: campaign.busy, error: campaign.error, onNext: campaign.onNext } : undefined} />}
    {momentOpen && finished && <MomentStudio entry={finished} onClose={() => { setMomentOpen(false); setShowResult(true); }} />}
    {replayVideo && finished && <ReplayStudio entry={finished} onClose={() => setReplayVideo(false)} />}
    {!PERSONAL_ONLY && inviteOpen && <StudioDialog title="邀请朋友坐到同一张拼图桌" onClose={() => setInviteOpen(false)}><p className="studio-muted">创建后，当前照片和进度会发送到拼图服务。房间24小时后失效，另一位伙伴通过邀请链接加入。</p>{inviteError && <p role="alert">{inviteError}</p>}<button className="primary-button w-full" disabled={inviting} onClick={() => { setInviting(true); setInviteError(''); void makeParcel(latest.current, 'relay').then(p => createRoom(p, run.options?.gift?.from || '伙伴一')).then(onRoom).catch(e => setInviteError(e instanceof Error ? e.message : '房间创建失败')).finally(() => setInviting(false)); }}>{inviting ? '正在准备拼图桌…' : '发送照片并创建房间'}</button></StudioDialog>}
  </main>;
}
