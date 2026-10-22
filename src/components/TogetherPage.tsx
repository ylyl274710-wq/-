import { newId } from '../lib/id';
import { useState } from 'react';
import type { PuzzleImage } from '../types';
import type { PuzzleSettings as Settings } from '../lib/paperGeometry';
import { generatePaperGeometry, newSeed } from '../lib/paperGeometry';
import { initialPaperGame } from '../lib/paperReducer';
import { ARTWORKS } from '../lib/catalog';
import { makeParcel } from '../lib/exchange';
import { createRoom } from '../lib/online';
import type { RoomWelcome } from '../lib/onlineTypes';
import ImageUploader from './ImageUploader';
import PuzzleSettings from './PuzzleSettings';

interface Props {
  image: PuzzleImage | null; settings: Settings; artworkId?: string; busy: boolean;
  onBack: () => void; onFile: (file: File) => void; onBuiltin: (id: string) => void;
  onSettings: (settings: Settings) => void; onRoom: (room: RoomWelcome) => void;
  onJoin: (id: string) => void; onCreative: () => void; onGift: () => void; onShares: () => void; onError: (text: string) => void;
}

export default function TogetherPage(p: Props) {
  const [view, setView] = useState<'choose' | 'create' | 'join'>('choose');
  const [name, setName] = useState('拼图伙伴'), [invite, setInvite] = useState(''), [pending, setPending] = useState(false);
  async function start() {
    if (!p.image || pending || p.busy) return;
    setPending(true);
    try {
      const parcel = await makeParcel({ version: 1, id: newId(), image: { blob: p.image.blob, name: p.image.name, originalWidth: p.image.originalWidth, originalHeight: p.image.originalHeight }, settings: p.settings, state: initialPaperGame(generatePaperGeometry(p.settings, newSeed())), hardMode: false, context: { kind: 'custom', title: p.image.name }, savedAt: Date.now(), options: { mode: 'classic', artworkId: p.artworkId } }, 'relay');
      p.onRoom(await createRoom(parcel, name.trim() || '拼图伙伴'));
    } catch (error) { p.onError(error instanceof Error ? error.message : '房间未能创建，请重试'); }
    finally { setPending(false); }
  }
  function join() {
    try { const hash = new URL(invite.trim(), location.href).hash; if (!/^#room=[a-f0-9]{36}$/.test(hash)) throw new Error(); p.onJoin(hash.slice(6)); }
    catch { p.onError('请粘贴有效的房间邀请链接'); }
  }
  return <main className="studio-page together-page">
    <div className="mode-breadcrumb"><button className="text-button nav-back-button" onClick={p.onBack}>← 返回首页</button><span>03 / 一起拼</span></div>
    <div className="studio-page-heading"><p className="eyebrow">TWO PAIRS OF HANDS, ONE LITTLE PICTURE</p><h1>美好的事，<span className="serif-accent">一起完成。</span></h1><p>寄一份可以拼开的照片，或约朋友坐到同一张拼图桌。</p></div>
    {view === 'choose' && <button className="together-gift-feature" onClick={p.onGift}><span className="together-gift-icon" aria-hidden="true">✉</span><span><small>A PHOTO WITH SOMETHING TO SAY</small><strong>送一份照片礼物</strong><p>让对方亲手拼开照片，再看到你留下的话。不用同时在线。</p></span><span aria-hidden="true">↗</span></button>}
    {view === 'choose' ? <div className="together-choices"><button className="together-choice" onClick={() => setView('create')}><span>＋</span><h2>创建拼图房间</h2><p>选一幅图，邀请朋友一起拼。</p><strong>准备一张拼图桌 ↗</strong></button><button className="together-choice" onClick={() => setView('join')}><span>↗</span><h2>加入朋友的房间</h2><p>已经收到邀请？从这里加入。</p><strong>粘贴邀请链接 ↗</strong></button></div> : <section className="together-form"><button className="text-button nav-back-button" onClick={() => setView('choose')}>← 返回一起拼</button>
      {view === 'create' ? <><h2>准备一张你们的拼图桌。</h2><label className="creative-label">你的昵称<input aria-label="房主昵称" value={name} maxLength={30} onChange={e => setName(e.target.value)} /></label><ImageUploader image={p.image} busy={p.busy || pending} onFile={p.onFile} onError={p.onError} /><label className="creative-label">或选择内置画作<select aria-label="联机拼图图片" value={p.artworkId ?? ''} disabled={p.busy || pending} onChange={e => p.onBuiltin(e.target.value)}><option value="" disabled>请选择图片</option>{ARTWORKS.map(a => <option value={a.id} key={a.id}>{a.title}</option>)}</select></label><PuzzleSettings value={p.settings} onChange={p.onSettings} onError={p.onError} /><p className="creative-privacy">创建房间后，处理后的照片会发送至当前拼图服务，与受邀伙伴共享。房间有效期24小时。</p><button className="primary-button w-full" disabled={!p.image || pending || p.busy} onClick={() => void start()}>{pending ? '正在准备拼图桌…' : '创建房间并邀请朋友 →'}</button></> : <><h2>朋友给你留了一个位置。</h2><label className="creative-label">房间邀请链接<input aria-label="房间邀请链接" value={invite} onChange={e => setInvite(e.target.value)} placeholder="粘贴朋友发来的完整链接" /></label><button className="primary-button w-full" disabled={!invite.trim()} onClick={join}>加入房间 →</button></>}
    </section>}
    <div className="mode-secondary-links"><span>想换一种分享方式？</span><button className="text-button" onClick={p.onCreative}>礼物、接力与创意工坊 ↗</button><button className="text-button" onClick={p.onShares}>我的分享与撤回 ↗</button></div>
  </main>;
}
