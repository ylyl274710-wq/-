import { newId } from './lib/id';
import { PERSONAL_ONLY, isCloudHash } from './lib/siteMode';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { PuzzleImage } from './types';
import { prepareImage, validateImage } from './lib/imageEngine';
import { releaseImageResource, renewImageResource } from './lib/imageResource';
import { LEVELS, levelSettings } from './lib/levels';
import { shapeOutline } from './lib/paperGeometry';
import type { PuzzleSettings } from './lib/paperGeometry';
import { canPlayLevel } from './lib/campaignProgress';
import { useCampaign } from './hooks/useCampaign';
import { ARTWORKS, THEMES, dailyPuzzle, themeSettings, hashText } from './lib/catalog';
import type { Artwork } from './lib/catalog';
import type { ActiveRun, CollectionEntry, RunContext, SavedSession } from './lib/studioTypes';
import { clearSession, readRecord, saveCollection, validSession, writeRecord } from './lib/studioStorage';
import { shouldPlayShredder, usePreferences } from './lib/preferences';
import Header from './components/Header';
import HomePage from './components/HomePage';
import PageLoading from './components/PageLoading';
import Toast from './components/Toast';
import type { HubTab } from './components/ExperienceHub';
import StudioDialog from './components/StudioDialog';
import { QUICK_PLAYS, weeklyStory, canReadChapter, chapterSettings, readChallenge, type PlayOptions } from './lib/experiences';
import { openParcel, safeOptions, type PuzzleParcel } from './lib/exchange';
import { api, joinRoom } from './lib/online';
import type { RoomWelcome } from './lib/onlineTypes';
import type { ToastMessage } from './components/Toast';
import { giftDraft, readGiftDraft, saveGiftDraft, gentleCollection, gentleCompleted, nextGentle } from './lib/product';
import type { GiftDraft } from './lib/product';
import type { GiftNote } from './lib/experiences';
import './styles/studio.css';
import './styles/creative.css';
import './styles/modes.css';
import './styles/product.css';
import './styles/memory.css';

const loaders = {
  custom: () => import('./components/CustomPage'),
  together: () => import('./components/TogetherPage'),
  campaign: () => import('./components/CampaignPage'),
  game: () => import('./components/PaperGamePage'),
};
const CustomPage = lazy(loaders.custom), TogetherPage = lazy(loaders.together);
const CampaignPage = lazy(loaders.campaign), PaperGamePage = lazy(loaders.game);
const ImageShredder = lazy(() => import('./components/ImageShredder'));
const CropEditor = lazy(() => import('./components/CropEditor'));
const ExplorePage = lazy(() => import('./components/ExplorePage'));
const CollectionPage = lazy(() => import('./components/CollectionPage'));
const ExperienceHub = lazy(() => import('./components/ExperienceHub'));
const OnlineRoomPage = lazy(() => import('./components/OnlineRoomPage'));
const GiftComposer = lazy(() => import('./components/GiftComposer'));
const MemoryComposer = lazy(() => import('./components/MemoryComposer'));
const preload = (mode: 'custom' | 'together' | 'campaign') => { void loaders[mode]().catch(() => {}); };

type Page = 'home' | 'memory' | 'custom' | 'together' | 'campaign' | 'explore' | 'collection' | 'shredding' | 'game' | 'creative' | 'online' | 'gift';
const PAGE_HASHES: Partial<Record<Page, string>> = { home: '', memory: '#memory', custom: '#custom', together: '#together', campaign: '#campaign', explore: '#explore', collection: '#collection', creative: '#creative', gift: '#gift' };
interface NewGamePlan { image: PuzzleImage; run: ActiveRun; animate: boolean }

export default function App() {
  const [image, setImage] = useState<PuzzleImage | null>(null), [gameImage, setGameImage] = useState<PuzzleImage | null>(null);
  const [settings, setSettings] = useState<PuzzleSettings>({ pieceCount: 9, shape: 'circle', customOutline: shapeOutline('circle') });
  const [giftSettings, setGiftSettings] = useState<PuzzleSettings>({ pieceCount: 9, shape: 'heart', customOutline: [] });
  const [draft, setDraft] = useState<GiftDraft>(readGiftDraft);
  const [incomingExpiry, setIncomingExpiry] = useState<number | null>(null);
  const [page, setPage] = useState<Page>('home'), [run, setRun] = useState<ActiveRun | null>(null);
  const [busy, setBusy] = useState(false), [loadingLevel, setLoadingLevel] = useState<number | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null), [cropOpen, setCropOpen] = useState(false);
  const [saved, setSaved] = useState<SavedSession | null>(null), [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [pendingStart, setPendingStart] = useState<NewGamePlan | null>(null);
  const savedRef = useRef<SavedSession | null>(null), pendingRef = useRef<NewGamePlan | null>(null), startup = useRef<Promise<void>>(Promise.resolve());
  const [storage, setStorage] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [artworkId, setArtworkId] = useState<string | undefined>(), [hubTab, setHubTab] = useState<HubTab>('gift'), [incoming, setIncoming] = useState<SavedSession | null>(null), [roomInvite, setRoomInvite] = useState(''), [playerName, setPlayerName] = useState('拼图伙伴'), [entryError, setEntryError] = useState(''), [room, setRoom] = useState<RoomWelcome | null>(null);
  const customUrl = useRef<PuzzleImage | null>(null), gameUrl = useRef<PuzzleImage | null>(null);
  const request = useRef(0), alive = useRef(true), storageWarning = useRef(false), routeFetch = useRef<AbortController | null>(null);
  const { progress, persistent, recordResult } = useCampaign();
  const prefs = usePreferences();
  const notify = useCallback((text: string) => setToast({ text, id: Date.now() }), []);
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => { document.documentElement.dataset.theme = prefs.theme; }, [prefs.theme]);
  useEffect(() => {
    const accept = () => {
      routeFetch.current?.abort();
      cancelNewGame(); setIncoming(null); setRoomInvite('');
      const hash = location.hash;
      if (PERSONAL_ONLY && isCloudHash(hash)) {
        history.replaceState(null, '', location.pathname + location.search); setPage('home');
        notify('个人体验版暂未开放联机与照片链接，先选一张喜欢的图慢慢拼。'); return;
      }
      const route = (Object.keys(PAGE_HASHES) as Page[]).find(key => PAGE_HASHES[key] === hash);
      if (route) { request.current++; setBusy(false); setLoadingLevel(null); setRoomInvite(''); setPage(route); window.scrollTo(0, 0); return; }
      if (/^#room=[a-f0-9]{36}$/.test(hash)) { setRoomInvite(hash.slice(6)); setEntryError(''); return; }
      if (/^#share=[a-f0-9]{36}$/.test(hash)) {
        const controller = new AbortController(), token = ++request.current; routeFetch.current = controller;
        setBusy(true);
        void api<{ parcel: PuzzleParcel; expiresAt: number }>(`/shares/${hash.slice(7)}`, undefined, controller.signal).then(value => {
          if (!controller.signal.aborted && alive.current && token === request.current) { setIncoming(openParcel(value.parcel)); setIncomingExpiry(value.expiresAt); }
        }).catch(e => { if (!controller.signal.aborted && alive.current && token === request.current) notify(e instanceof Error ? e.message : '分享无法打开'); })
          .finally(() => { if (alive.current && token === request.current) setBusy(false); });
        return;
      }
      const challenge = readChallenge(hash);
      if (challenge) { const art = ARTWORKS.find(a => a.id === challenge.art); if (art) void loadArtwork(art, challenge.settings, { kind: 'custom', title: challenge.title }, challenge.seed, false, { mode: challenge.mode, artworkId: challenge.art }); }
    };
    accept(); window.addEventListener('hashchange', accept);
    return () => { routeFetch.current?.abort(); window.removeEventListener('hashchange', accept); };
  }, []);
  useEffect(() => {
    alive.current = true; setBusy(false); setLoadingLevel(null);
    if (customUrl.current?.blob) { const restored = renewImageResource(customUrl.current); customUrl.current = restored; setImage(restored); }
    if (gameUrl.current?.blob) { const restored = renewImageResource(gameUrl.current); gameUrl.current = restored; setGameImage(restored); }
    startup.current = Promise.all([readRecord<unknown>('session'), readRecord<unknown>('collection')]).then(([session, collection]) => {
      if (!alive.current) return;
      if (validSession(session) && session.state.status !== 'completed') { savedRef.current = session; setSaved(session); }
      if (Array.isArray(collection)) setEntries(previous => {
        const valid = collection.filter(validSession).filter(item => typeof (item as CollectionEntry).completedAt === 'number') as CollectionEntry[];
        return [...new Map([...valid, ...previous].map(entry => [entry.id, entry])).values()].sort((a, b) => b.completedAt - a.completedAt);
      });
      setStorage('ready');
    }).catch(() => { if (alive.current) setStorage('unavailable'); });
    const prevent = (event: DragEvent) => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); };
    window.addEventListener('dragover', prevent); window.addEventListener('drop', prevent);
    return () => { alive.current = false; request.current++; if (pendingRef.current) { disposePlan(pendingRef.current); pendingRef.current = null; } releaseImageResource(customUrl.current); releaseImageResource(gameUrl.current); window.removeEventListener('dragover', prevent); window.removeEventListener('drop', prevent); };
  }, []);

  function storageError() {
    setStorage('unavailable');
    if (!storageWarning.current) { storageWarning.current = true; notify('本地保存暂时不可用，请保留当前页面；可以继续拼图并下载纪念卡。'); }
  }
  const saveSession = useCallback(async (session: SavedSession): Promise<void> => {
    if (session.state.status === 'completed') return;
    savedRef.current = session; setSaved(session);
    try { await writeRecord('session', session); if (alive.current) setStorage('ready'); } catch (error) {
      if (alive.current) { setStorage('unavailable'); if (!storageWarning.current) { storageWarning.current = true; notify('本地进度未能保存，请保留当前页面继续。'); } }
      throw error;
    }
  }, [notify]);
  function updateEntry(entry: CollectionEntry) {
    setEntries(previous => [entry, ...previous.filter(e => e.id !== entry.id)].sort((a, b) => b.completedAt - a.completedAt));
    void saveCollection(entry).catch(storageError);
  }
  function completeEntry(entry: CollectionEntry) {
    updateEntry(entry);
    if (savedRef.current?.id === entry.id) savedRef.current = null;
    setSaved(previous => previous?.id === entry.id ? null : previous);
    void clearSession(entry.id).catch(storageError);
    if (entry.context.kind === 'campaign' && entry.context.levelIndex !== undefined) {
      const index = entry.context.levelIndex;
      recordResult(index, { levelId: LEVELS[index]!.id, moves: entry.state.moves, elapsedMs: entry.state.elapsedMs });
    }
  }
  function navigate(next: Page) {
    if (PERSONAL_ONLY && ['together', 'gift', 'online'].includes(next)) next = 'home';
    routeFetch.current?.abort(); cancelNewGame(); setIncoming(null); setRoomInvite('');
    request.current++; setBusy(false); setLoadingLevel(null);
    const hash = PAGE_HASHES[next];
    if (hash !== undefined && location.hash !== hash) history.pushState(null, '', location.pathname + location.search + hash);
    setPage(next); window.scrollTo(0, 0);
  }
  function adoptHome(next: PuzzleImage) { if (customUrl.current?.url !== next.url) releaseImageResource(customUrl.current); customUrl.current = next; setImage(next); }
  function adoptGame(next: PuzzleImage) { if (gameUrl.current?.url !== next.url && gameUrl.current?.url !== customUrl.current?.url) releaseImageResource(gameUrl.current); gameUrl.current = next; setGameImage(next); }
  function disposePlan(plan: NewGamePlan) {
    if (plan.image.url !== customUrl.current?.url && plan.image.url !== gameUrl.current?.url) releaseImageResource(plan.image);
  }
  function cancelNewGame() {
    const plan = pendingRef.current; pendingRef.current = null; setPendingStart(null);
    if (plan) disposePlan(plan);
  }
  function commitGame(plan: NewGamePlan) {
    void loaders.game().catch(() => {});
    pendingRef.current = null; setPendingStart(null);
    adoptGame(plan.image); setRun(plan.run); setBusy(false); setLoadingLevel(null);
    if (/^#(?:share|puzzle)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    setPage(plan.animate && shouldPlayShredder() ? 'shredding' : 'game'); window.scrollTo(0, 0);
  }
  function offerGame(plan: NewGamePlan) {
    const token = ++request.current;
    // 即使通过分享链接直接进入，也先等旧存档读取结束，再决定是否需要替换确认。
    void startup.current.then(() => {
      if (!alive.current || request.current !== token) { disposePlan(plan); return; }
      setBusy(false); setLoadingLevel(null);
      const previous = savedRef.current;
      if (previous && previous.state.status !== 'completed' && previous.id !== plan.run.id) {
        if (pendingRef.current) disposePlan(pendingRef.current);
        pendingRef.current = plan; setPendingStart(plan);
      } else commitGame(plan);
    });
  }
  function begin(next: PuzzleImage, nextSettings: PuzzleSettings, context: RunContext, seed?: number, animate = true, options?: PlayOptions) {
    offerGame({ image: next, run: { id: newId(), settings: nextSettings, context, seed, options }, animate });
  }
  async function loadHome(file?: File) {
    if (file) { const error = validateImage(file); if (error) { notify(error); return; } }
    const token = ++request.current; setBusy(true);
    try {
      const response = file ? null : await fetch(`${import.meta.env.BASE_URL}sample.svg`);
      if (response && !response.ok) throw new Error('示例图片未能加载，请重新选择照片');
      const result = await prepareImage(file ?? await response!.blob(), file?.name ?? '山野来信 · 示例插画');
      if (!alive.current || request.current !== token) { releaseImageResource(result); return; }
      adoptHome(result);
      setArtworkId(file ? undefined : 'little-mountains');
      if (Math.min(result.originalWidth, result.originalHeight) < 300) notify('图片小于300px，清晰度可能不足，仍可使用');
    } catch (error) { if (alive.current && request.current === token) notify(error instanceof Error ? error.message : '图片处理失败'); }
    finally { if (alive.current && request.current === token) setBusy(false); }
  }
  async function loadArtwork(artwork: Artwork, nextSettings: PuzzleSettings, context: RunContext, seed?: number, useAsHome = false, options?: PlayOptions) {
    const token = ++request.current; setBusy(true); setLoadingLevel(context.kind === 'campaign' ? context.levelIndex ?? null : null);
    try {
      let blob: Blob;
      if (artwork.svg) blob = new Blob([artwork.svg], { type: 'image/svg+xml' });
      else { const response = await fetch(artwork.image, { cache: 'force-cache' }); if (!response.ok) throw new Error('图片暂时未能加载，请重试'); blob = await response.blob(); }
      const result = await prepareImage(blob, artwork.title);
      if (!alive.current || request.current !== token) { releaseImageResource(result); return; }
      if (useAsHome) { adoptHome(result); setArtworkId(artwork.id); }
      begin(result, nextSettings, context, seed, true, options ?? { mode: 'classic', artworkId: artwork.id });
    } catch (error) { if (alive.current && request.current === token) notify(error instanceof Error ? error.message : '图片加载失败，请重试'); }
    finally { if (alive.current && request.current === token) { setBusy(false); setLoadingLevel(null); } }
  }
  function startCustom() {
    if (busy) return;
    if (image) begin(image, settings, { kind: 'custom', title: image.name }, undefined, true, { mode: 'classic', artworkId });
    else void loadArtwork(ARTWORKS.find(a => a.id === 'little-mountains')!, settings, { kind: 'custom', title: '山野来信' }, undefined, true);
  }
  function playCampaign(index: number) {
    if (!canPlayLevel(progress, index)) { notify('先完成前一关再继续'); return; }
    const level = LEVELS[index]; if (level) void loadArtwork(ARTWORKS.find(a => a.id === level.id)!, levelSettings(index), { kind: 'campaign', levelIndex: index, title: level.title });
  }
  function resume() {
    const previous = savedRef.current;
    if (!previous || !validSession(previous)) { notify('存档无法读取，请开始新拼图'); return; }
    request.current++; cancelNewGame();
    const restored = renewImageResource({ ...previous.image, url: '' }); adoptGame(restored);
    if (previous.context.kind === 'custom') { adoptHome(restored); setSettings(previous.settings); }
    setRun({ id: previous.id, context: previous.context, settings: previous.settings, restored: previous, options: safeOptions(previous.options) }); setPage('game'); window.scrollTo(0, 0);
  }
  function clearSaved() {
    const id = savedRef.current?.id;
    void clearSession(id).then(() => { if (savedRef.current?.id === id) { savedRef.current = null; setSaved(null); } }).catch(storageError);
  }
  function replayEntry(entry: CollectionEntry) { const restored = renewImageResource({ ...entry.image, url: '' }); begin(restored, entry.settings, { kind: 'custom', title: entry.context.title ?? entry.image.name, ...(entry.context.memory ? { memory: true } : {}) }, entry.state.geometry.seed, false, safeOptions(entry.options)); }
  function enterExperience(s: SavedSession) {
    const restored = renewImageResource({ ...s.image, url: '' }); setIncoming(null);
    const fresh = s.state.moves === 0 && s.state.elapsedMs === 0 && !s.state.placed.length && !s.state.loose.length;
    offerGame({ image: restored, run: { id: s.id, settings: s.settings, context: s.context, restored: s, options: safeOptions(s.options) }, animate: fresh });
  }
  function enterRoom(welcome: RoomWelcome) { setRoom(welcome); setRoomInvite(''); history.replaceState(null, '', `${location.pathname}${location.search}#room=${welcome.id}`); navigate('online'); }
  function openCreative(tab: HubTab = 'gift') { setHubTab(tab); navigate('creative'); }
  function openGift(reply?: GiftNote) {
    if (reply) { updateGiftDraft(giftDraft('everyday', reply)); setGiftSettings({ pieceCount: 9, shape: 'heart', customOutline: [] }); }
    navigate('gift');
  }
  function updateGiftDraft(next: GiftDraft) { setDraft(next); saveGiftDraft(next); }
  function playGentle(index?: number) {
    if (busy) return;
    const collection = gentleCollection(), next = index ?? nextGentle(entries, collection.week), art = collection.items[next];
    if (!art) return;
    void loadArtwork(art, { pieceCount: 9, shape: 'circle', customOutline: [] }, { kind: 'custom', title: art.title }, hashText(`gentle-${collection.week}-${next}`), false,
      { mode: 'classic', artworkId: art.id, relaxed: true, gentle: { week: collection.week, index: next } });
  }
  async function selectBuiltin(id: string) { const art = ARTWORKS.find(a => a.id === id); if (!art) return; const token = ++request.current; setBusy(true); try { const blob = art.svg ? new Blob([art.svg], { type: 'image/svg+xml' }) : await (await fetch(art.image)).blob(); const next = await prepareImage(blob, art.title); if (token !== request.current) { releaseImageResource(next); return; } adoptHome(next); setArtworkId(id); } catch { notify('图片未能读取，请重试'); } finally { if (token === request.current) setBusy(false); } }
  function playQuick(id: string) { if (id === 'break') { playGentle(); return; } const q = QUICK_PLAYS.find(p => p.id === id); if (!q) return; const art = ARTWORKS.find(a => a.id === q.art)!; void loadArtwork(art, { pieceCount: q.count, shape: q.shape, customOutline: [] }, { kind: 'custom', title: art.title }, undefined, false, { mode: q.mode, artworkId: art.id }); }
  function playWeekly(index: number) { const story = weeklyStory(); if (!canReadChapter(entries, story.week, index)) { notify('先拼开上一封信'); return; } const chapter = story.chapters[index]!; void loadArtwork(ARTWORKS.find(a => a.id === chapter.art)!, chapterSettings(index), { kind: 'weekly', title: chapter.title, date: story.week, levelIndex: index }, undefined, false, { mode: 'mystery', artworkId: chapter.art, weekly: { week: story.week, index }, gift: { title: chapter.title, to: '正在读信的你', from: story.title, keywords: chapter.clue, message: chapter.letter } }); }
  function playTheme(themeId: string, index: number) {
    if (busy) return;
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme || !Number.isInteger(index) || index < 0 || index >= theme.ids.length || (index > 0 && !entries.some(e => e.context.kind === 'theme' && e.context.themeId === themeId && e.context.levelIndex === index - 1))) { notify('完成前一关后再继续'); return; }
    const artwork = ARTWORKS.find(a => a.id === theme.ids[index]);
    if (artwork) void loadArtwork(artwork, themeSettings(index), { kind: 'theme', title: artwork.title, themeId, levelIndex: index });
  }
  const campaignIndex = run?.context.kind === 'campaign' ? run.context.levelIndex : undefined;
  const activeLevel = campaignIndex === undefined ? undefined : LEVELS[campaignIndex];
  const activeTheme = run?.context.kind === 'theme' ? THEMES.find(t => t.id === run.context.themeId) : undefined;
  const weekly = run?.options?.weekly;
  const gentle = gentleCollection();
  const gentleCount = gentle.items.filter((_, i) => gentleCompleted(entries, gentle.week, i)).length;

  return <div className={`app-shell${page === 'game' || page === 'shredding' || page === 'online' ? ' is-playing' : ''}`}>
    <button className="skip-to-content" onClick={() => { const main = document.querySelector('main'); if (main) { main.tabIndex = -1; main.focus({ preventScroll: true }); } }}>跳到主要内容</button>
    <Header onHome={() => navigate('home')} />
    <Suspense fallback={<PageLoading />}>
    {page === 'home' && <HomePage onMemory={() => navigate('memory')} onIntent={preload} onCustom={() => navigate('custom')} onCampaign={() => navigate('campaign')} onTogether={() => navigate('together')} onCollection={() => navigate('collection')} onResume={resume} saved={saved} busy={busy} onRelax={() => playGentle()} onGift={() => openGift()} />}
    {page === 'memory' && <MemoryComposer onBack={() => navigate('home')} onError={notify} onStart={(next, pieces) => begin(next, { pieceCount: pieces, shape: 'square', customOutline: [] }, { kind: 'custom', title: next.name, memory: true }, undefined, true, { mode: 'classic', relaxed: true })} />}
    {page === 'gift' && <GiftComposer image={image} artworkId={artworkId} settings={giftSettings} draft={draft} busy={busy} onFile={file => void loadHome(file)} onBuiltin={id => void selectBuiltin(id)} onSettings={setGiftSettings} onDraft={updateGiftDraft} onPreview={enterExperience} onBack={() => navigate('together')} onShares={() => openCreative('shares')} onError={notify} />}
    {page === 'custom' && <CustomPage image={image} settings={settings} busy={busy} onFile={file => void loadHome(file)} onSample={() => void loadHome()} onError={notify} onSettings={setSettings} onStart={startCustom}
      saved={saved} storage={storage} onResume={resume} onClearSave={clearSaved} onCrop={() => setCropOpen(true)} onBack={() => navigate('home')} onQuick={playQuick} />}
    {page === 'together' && <TogetherPage image={image} settings={settings} artworkId={artworkId} busy={busy} onFile={file => void loadHome(file)} onBuiltin={id => void selectBuiltin(id)} onSettings={setSettings} onRoom={enterRoom} onJoin={id => { setRoomInvite(id); setEntryError(''); }} onBack={() => navigate('home')} onCreative={() => openCreative('challenge')} onGift={() => openGift()} onShares={() => openCreative('shares')} onError={notify} />}
    {page === 'creative' && <ExperienceHub image={image} artworkId={artworkId} settings={settings} entries={entries} saved={saved} busy={busy} initialTab={hubTab} onFile={f => void loadHome(f)} onBuiltin={id => void selectBuiltin(id)} onSettings={setSettings} onStart={enterExperience} onImport={session => { setIncomingExpiry(null); setIncoming(session); }} onRoom={enterRoom} onGift={() => openGift()} onWeekly={playWeekly} backLabel={hubTab === 'weekly' ? '返回闯关模式' : PERSONAL_ONLY ? '返回首页' : '返回一起拼'} onBack={() => navigate(hubTab === 'weekly' ? 'campaign' : PERSONAL_ONLY ? 'home' : 'together')} onError={notify} />}
    {page === 'online' && room && <OnlineRoomPage welcome={room} onArchive={completeEntry} onError={notify} onBack={() => { history.replaceState(null, '', location.pathname + location.search); navigate('together'); }} />}
    {page === 'campaign' && <CampaignPage progress={progress} persistent={persistent} busy={busy} loadingLevel={loadingLevel} onPlay={playCampaign} onBack={() => navigate('home')} onExplore={() => navigate('explore')} onWeekly={() => openCreative('weekly')} />}
    {page === 'explore' && <ExplorePage entries={entries} onGentle={playGentle} onBack={() => navigate('campaign')} onDaily={day => { const daily = dailyPuzzle(day); void loadArtwork(daily.artwork, daily.settings, { kind: 'daily', title: daily.artwork.title, date: day }, daily.seed); }} onTheme={playTheme} />}
    {page === 'collection' && <CollectionPage entries={entries} onReplay={replayEntry} onUpdate={updateEntry} onBack={() => navigate('home')} onError={notify} />}
    {page === 'shredding' && gameImage && run && <ImageShredder image={gameImage} pieceCount={run.settings.pieceCount} onComplete={() => setPage(current => current === 'shredding' ? 'game' : current)} />}
    {page === 'game' && gameImage && run && <PaperGamePage key={run.id} image={gameImage} settings={run.settings} run={run} storage={storage} onSave={saveSession} onCompleteEntry={completeEntry} onCollection={() => navigate('collection')} onError={notify}
      onGift={PERSONAL_ONLY ? undefined : () => openGift(run.options?.gift && !run.options.weekly && !run.options.giftPreview ? run.options.gift : undefined)} gentle={run.options?.gentle ? { title: gentle.title, completed: gentleCount, total: gentle.items.length, onNext: () => playGentle() } : undefined}
      onRoom={enterRoom} theme={weekly ? { title: weeklyStory(weekly.week).title, index: weekly.index, total: 3, busy, onNext: () => playWeekly(weekly.index + 1) } : activeTheme ? { title: activeTheme.title, index: run.context.levelIndex ?? 0, total: activeTheme.ids.length, busy, onNext: () => playTheme(activeTheme.id, (run.context.levelIndex ?? 0) + 1) } : undefined}
      onChange={() => run.context.memory ? navigate('memory') : run.options?.giftPreview ? navigate('gift') : run.context.kind === 'weekly' ? openCreative('weekly') : navigate(run.options?.relaxed || run.options?.gift ? 'home' : run.context.kind === 'campaign' ? 'campaign' : run.context.kind === 'daily' || run.context.kind === 'theme' ? 'explore' : 'custom')}
      campaign={activeLevel && campaignIndex !== undefined ? { level: activeLevel, index: campaignIndex, busy, error: null, onComplete: () => {}, onNext: () => playCampaign(campaignIndex + 1) } : undefined} />}
    {cropOpen && image && <CropEditor image={image} settings={settings} onClose={() => setCropOpen(false)} onApply={next => { adoptHome(next); setCropOpen(false); notify('构图已保存，原照片仍保留'); }} />}
    {pendingStart && saved && <StudioDialog title="要替换上次未完成的拼图吗？" onClose={cancelNewGame}><p className="studio-muted">当前只有一个续玩位置。开始新局会替换下方进度，已完成的收藏不会受影响。</p><div className="save-conflict-summary"><strong>{saved.context.title ?? saved.image.name}</strong><span>{saved.settings.pieceCount}片 · 已归位 {saved.state.placed.length}片 · {saved.state.moves}次放置</span></div><div className="studio-dialog-actions"><button className="secondary-button" onClick={cancelNewGame}>取消，保留进度</button><button className="secondary-button" onClick={resume}>继续上次拼图</button><button className="primary-button" onClick={() => { const plan = pendingRef.current; if (plan) { request.current++; commitGame(plan); } }}>开始新局并替换存档</button></div></StudioDialog>}
    {incoming && <StudioDialog title={incoming.options?.gift ? '一份等待拼开的礼物' : '朋友的拼图，交到你手里'} onClose={() => setIncoming(null)}><div className="gift-envelope"><span>✉</span><h2>{incoming.options?.gift?.title || incoming.context.title}</h2><p>送给 {incoming.options?.gift?.to || '正在看这份拼图的你'}</p><p>来自 {incoming.options?.gift?.from || '一位拼图伙伴'}</p><small>{incoming.settings.pieceCount}片 · 不用注册，也不用同时在线</small>{incoming.options?.gift && <p className="gift-landing-note">先亲手把纸片拼好，再看看对方留下的话。</p>}{incomingExpiry && <small>有效至 {new Date(incomingExpiry).toLocaleDateString('zh-CN')}</small>}</div><button className="primary-button w-full" onClick={() => enterExperience(incoming)}>亲手拼开这份心意 →</button></StudioDialog>}
    {roomInvite && <StudioDialog title="坐到朋友的拼图桌旁" onClose={() => setRoomInvite('')}><p className="studio-muted">两个人的操作会实时同步。填一个名字，就可以一起把碎片拼回来。</p><label className="creative-label">你的名字<input maxLength={30} aria-label="联机昵称" value={playerName} onChange={e => setPlayerName(e.target.value)} /></label>{entryError && <p role="alert">{entryError}</p>}<button className="primary-button w-full" disabled={busy} onClick={() => { setBusy(true); setEntryError(''); void joinRoom(roomInvite, playerName).then(enterRoom).catch(e => setEntryError(e instanceof Error ? e.message : '房间无法加入')).finally(() => setBusy(false)); }}>{busy ? '正在搬来椅子…' : '加入拼图房间'}</button></StudioDialog>}
    </Suspense>
    {busy && page !== 'home' && <div className="studio-loading" role="status">正在准备图片…</div>}
    <footer className="site-footer"><span>片刻拼图 <i>©</i> 2026</span><span>不赶时间，只拼快乐。<span className="footer-star">✳</span></span></footer><Toast message={toast} onClose={dismissToast} />
  </div>;
}
