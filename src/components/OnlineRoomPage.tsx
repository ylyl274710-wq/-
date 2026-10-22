import StudioDialog from './StudioDialog';
import { apiEndpoint } from '../lib/apiEndpoint';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Point } from '../lib/paperGeometry';
import type { CollectionEntry } from '../lib/studioTypes';
import type { RoomWelcome, RoomUpdate, RoomAction } from '../lib/onlineTypes';
import { paperReducer, restorePaperGame, challengeScore, type PaperGameState, type PaperAction } from '../lib/paperReducer';
import { openParcel, exportParcel } from '../lib/exchange';
import { api } from '../lib/online';
import { rememberRoom } from '../lib/roomIdentity';
import PaperBoard from './PaperBoard';
import PaperHUD from './PaperHUD';
import ResultModal from './ResultModal';
import { exportMemoryCard } from '../lib/memoryCard';

type Action = PaperAction | { type: 'remote'; state: PaperGameState };
function reducer(state: PaperGameState, action: Action): PaperGameState {
  if (action.type !== 'remote') return paperReducer(state, action);
  const next = restorePaperGame(action.state, performance.now());
  return { ...next, marked: state.marked, selected: state.selected !== null && !next.placed.includes(state.selected) ? state.selected : null, hinted: action.state.hinted };
}
export default function OnlineRoomPage({ welcome, onBack, onArchive, onError }: { welcome: RoomWelcome; onBack: () => void; onArchive: (e: CollectionEntry) => void; onError: (s: string) => void }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const invitation = `${location.origin}${location.pathname}#room=${welcome.id}`;
  const [session] = useState(() => openParcel(welcome.parcel)), [url, setUrl] = useState('');
  const [state, dispatch] = useReducer(reducer, welcome.state, s => restorePaperGame(s, performance.now()));
  const [players, setPlayers] = useState(welcome.players), [connection, setConnection] = useState('正在连接伙伴…');
  const [preview, setPreview] = useState(false), [hard, setHard] = useState(welcome.hardMode ?? session.hardMode);
  const [hardEligible, setHardEligible] = useState(welcome.hardEligible ?? session.hardEligible === true);
  const [difficultyBusy, setDifficultyBusy] = useState(false), [result, setResult] = useState(false), [entry, setEntry] = useState<CollectionEntry | null>(null);
  const version = useRef(-1), done = useRef(false), warnedIdentity = useRef(false), current = useRef(state); current.current = state;
  useEffect(() => { const u = URL.createObjectURL(session.image.blob); setUrl(u); return () => URL.revokeObjectURL(u); }, [session]);
  useEffect(() => {
    if (!rememberRoom(welcome.id, welcome.token, welcome.expiresAt) && !warnedIdentity.current) { warnedIdentity.current = true; onError('浏览器未允许长期保存房间身份，请保留此标签页。'); }
    const events = new EventSource(apiEndpoint(`/api/rooms/${welcome.id}/events?token=${encodeURIComponent(welcome.token)}`));
    events.onopen = () => setConnection('已连接 · 同步拼图'); events.onerror = () => setConnection('连接中断，正在重连…');
    events.onmessage = message => {
      try {
        const data = JSON.parse(message.data) as RoomUpdate;
        setPlayers(data.players);
        if (data.version >= version.current) {
          version.current = data.version; setHard(data.hardMode ?? session.hardMode);
          setHardEligible(data.hardEligible ?? data.state.moves === 0);
          dispatch({ type: 'remote', state: data.state });
        }
      } catch { setConnection('同步数据无法读取，请重新加入房间'); }
    };
    return () => events.close();
  }, [welcome.id, welcome.token]);
  useEffect(() => { if (state.status !== 'playing') return; const timer = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 200); return () => window.clearInterval(timer); }, [state.status]);
  const snapshot = { ...session, id: `room-${welcome.id}`, state, hardMode: hard, hardEligible, options: { ...session.options, mode: session.options?.mode ?? 'classic' as const, duo: [players[0]?.name ?? '伙伴一', players[1]?.name ?? '伙伴二'] as const }, savedAt: Date.now() };
  useEffect(() => {
    if (state.status === 'completed' && !done.current) {
      done.current = true; const e: CollectionEntry = { ...snapshot, completedAt: Date.now(), score: challengeScore(state, hard && hardEligible) };
      setEntry(e); onArchive(e);
    }
  }, [state.status]);
  useEffect(() => { if (state.status !== 'completed') return; const timer = window.setTimeout(() => setResult(true), 850); return () => window.clearTimeout(timer); }, [state.status]);
  const act = useCallback(async (action: RoomAction) => {
    try { await api(`/rooms/${welcome.id}/action`, { token: welcome.token, action, selected: current.current.selected }); }
    catch (error) { onError(error instanceof Error ? error.message : '操作未能同步'); }
  }, [welcome.id, welcome.token, onError]);
  const select = useCallback((id: number) => dispatch({ type: 'select', id }), []);
  const place = useCallback((id: number, point: Point) => { void act({ type: 'place', id, point, now: 0 }); }, [act]);
  const mark = useCallback(() => dispatch({ type: 'mark' }), []);
  const returnPiece = useCallback((id?: number) => { void act({ type: 'return', id }); }, [act]);
  const deselect = useCallback(() => dispatch({ type: 'deselect' }), []);
  async function toggleDifficulty() { setDifficultyBusy(true); try { await act({ type: 'difficulty', hardMode: !hard }); } finally { setDifficultyBusy(false); } }
  return <main className="game-layout paper-game-layout online-game">
    <div className="game-heading"><div><p className="eyebrow">TWO PAIRS OF HANDS, ONE LITTLE PICTURE</p><h1>{players.map(p => p.name).join(' & ')}的拼图桌</h1></div><div className="game-heading-actions"><button className="secondary-button" onClick={() => setInviteOpen(true)}>邀请伙伴</button><button className="secondary-button nav-back-button" onClick={onBack} title="保留你的座位，同一浏览器可再次加入">离开房间</button></div></div>
    <div className="game-workspace"><section className="board-area"><div className="board-topline"><span>{connection} <button className="text-button" disabled={difficultyBusy || state.status === 'completed'} title="难度与伙伴同步；首次放置前开启并全程保持才有困难加分" onClick={() => void toggleDifficulty()}>{difficultyBusy ? '同步难度…' : hard ? '显示轮廓' : '隐藏轮廓'}</button></span><p id="paper-feedback" role="status" className="compact-feedback">{players.map(p => `${p.online ? '●' : '○'} ${p.name}`).join(' · ')}{hard && !hardEligible ? ' · 本局无困难加分' : ''}</p></div>
      <PaperBoard state={state} url={url} preview={preview} hardMode={hard} onSelect={select} onPlace={place} onMark={mark} onReturn={returnPiece} onDeselect={deselect} />
    </section><PaperHUD replayLabel="导出接力包" previewLocked={session.options?.mode === 'mystery' && state.status !== 'completed'} state={state} preview={preview} imageName={session.image.name} onPreview={setPreview} onReplay={() => void exportParcel(snapshot, 'relay').catch(() => onError('接力包导出失败'))} onShowResult={() => setResult(true)} onHint={() => void act({ type: 'hint' })} onAssist={() => void act({ type: 'assist', now: 0 })} /></div>
    {inviteOpen && <StudioDialog title="邀请伙伴一起拼" onClose={() => setInviteOpen(false)}><p className="gift-privacy">在另一台设备的浏览器打开下面的链接即可加入。局域网测试时，两台设备需连接同一 Wi-Fi。房间保留24小时。</p><label className="creative-label">房间邀请链接<input aria-label="房间邀请链接" readOnly value={invitation} onFocus={e => e.target.select()} /></label><button className="primary-button" onClick={() => { if (!navigator.clipboard) { onError('请长按或选中上方链接复制，发给另一台设备。'); return; } void navigator.clipboard.writeText(invitation).then(() => onError('邀请链接已复制')).catch(() => onError('请长按或选中上方链接手动复制。')); }}>复制邀请链接</button></StudioDialog>}
    {result && <ResultModal state={state} imageUrl={url} entry={entry ?? undefined} onReplay={onBack} onChange={onBack} onClose={() => setResult(false)} onCollection={onBack} onDownload={() => { if (entry) void exportMemoryCard(entry).catch(() => onError('纪念卡生成失败')); }} />}
  </main>;
}
