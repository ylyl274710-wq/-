import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PuzzleImage } from '../types';
import type { PuzzleSettings as Settings } from '../lib/paperGeometry';
import type { SavedSession } from '../lib/studioTypes';
import { GIFT_TEMPLATES, giftDraft, normalizeGift, makeGiftSession, giftInvitation } from '../lib/product';
import type { GiftDraft } from '../lib/product';
import { makeParcel, exportParcel } from '../lib/exchange';
import { createPhotoLink, revokePhotoLink } from '../lib/online';
import ImageUploader from './ImageUploader';
import PuzzleSettings from './PuzzleSettings';
import Toast from './Toast';

interface Props {
  image: PuzzleImage | null; artworkId?: string; settings: Settings; draft: GiftDraft; busy: boolean;
  onFile: (file: File) => void; onBuiltin: (id: string) => void; onSettings: (settings: Settings) => void;
  onDraft: (draft: GiftDraft) => void; onPreview: (session: SavedSession) => void;
  onBack: () => void; onShares: () => void; onError: (text: string) => void;
}
interface PublishedGift { id: string; owner: string; url: string; expiresAt: number; managementSaved: boolean; invitation: string }
const STEPS = ['选一张照片', '写一点心意', '交到对方手里'];

export default function GiftComposer(p: Props) {
  const [step, setStep] = useState(0), [pending, setPending] = useState(false), [published, setPublished] = useState<PublishedGift | null>(null);
  const [message, setMessage] = useState('');
  const toast = useMemo(() => message ? { id: Date.now(), text: message } : null, [message]);
  const dismiss = useCallback(() => setMessage(''), []);
  const working = useRef(false), mounted = useRef(false), heading = useRef<HTMLHeadingElement>(null);
  const locked = pending || p.busy, note = normalizeGift(p.draft);
  const template = GIFT_TEMPLATES.find(t => t.id === p.draft.templateId) ?? GIFT_TEMPLATES[3];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { setPublished(null); setMessage(''); }, [p.image, p.settings, p.draft]);
  function go(next: number) { setStep(next); setMessage(''); requestAnimationFrame(() => heading.current?.focus({ preventScroll: true })); }
  function update(next: Partial<GiftDraft>) { p.onDraft({ ...p.draft, ...next }); }
  function session(preview = false) {
    if (!p.image) throw new Error('先选一张喜欢的照片');
    return makeGiftSession(p.image, p.settings, p.draft, p.artworkId, preview);
  }
  async function task(action: () => Promise<void>) {
    if (working.current || p.busy) return;
    working.current = true; setPending(true); setMessage('');
    try { await action(); }
    catch (error) { if (mounted.current) p.onError(error instanceof Error ? error.message : '没有准备好，请再试一次'); }
    finally { working.current = false; if (mounted.current) setPending(false); }
  }
  async function publish() {
    const result = await createPhotoLink(await makeParcel(session(), 'gift'));
    if (!mounted.current) return;
    const url = `${location.origin}${location.pathname}#share=${result.id}`;
    setPublished({ ...result, url, invitation: giftInvitation(note, url) });
    setMessage('礼物已准备好。把链接交给那个人，不用同时在线，也不用注册。');
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setMessage('已复制，可以发给想分享的人了。'); }
    catch { setMessage('浏览器没有允许复制，请选中下方链接手动复制。'); }
  }
  return <main className="gift-page studio-page">
    <div className="mode-breadcrumb"><button className="nav-back-button" onClick={p.onBack}>← 返回一起拼</button><button className="text-button" onClick={p.onShares}>我的分享与撤回 ↗</button></div>
    <div className="gift-page-heading"><p className="eyebrow">A LITTLE PHOTO, A LITTLE SOMETHING TO SAY</p><h1>把照片，<span className="serif-accent">寄成一份心意。</span></h1><p>对方亲手拼好，才在页面揭晓你留下的话。</p></div>
    <ol className="gift-steps" aria-label="制作礼物的步骤">{STEPS.map((label, i) => <li key={label} aria-current={step === i ? 'step' : undefined}><span>{i < step ? '✓' : `0${i + 1}`}</span>{label}</li>)}</ol>
    <div className="gift-layout"><section className="gift-form" aria-busy={pending} aria-label="照片礼物制作">
      <h2 ref={heading} tabIndex={-1}>{step === 0 ? '哪张照片，让你想起了对方？' : step === 1 ? '有些话，拼好了再告诉你。' : published ? '礼物已经装进信封。' : '让对方轻松拼开这份心意。'}</h2>
      {step === 0 && <><ImageUploader image={p.image} busy={locked} onFile={p.onFile} onError={p.onError} /><p className="gift-subtle">合照、旅行、宠物，或者一个只有你们懂的瞬间。</p><button className="gift-sample" disabled={locked} onClick={() => p.onBuiltin(template.art)}><span aria-hidden="true">✳</span><span><strong>先用一张示例图试试</strong><small>没有准备照片，也可以先体验完整过程。</small></span><span>↗</span></button><details className="gift-extra gift-count-extra"><summary>默认轻松拼开 · 当前{p.settings.pieceCount}片，调整片数</summary><fieldset className="gift-count-picker" disabled={locked}><legend>留几片小小的期待？</legend>{[9, 16, 25].map(n => <button type="button" key={n} aria-pressed={p.settings.pieceCount === n} onClick={() => p.onSettings({ ...p.settings, pieceCount: n })}>{n}片<small>{n === 9 ? '轻松拼开' : n === 16 ? '慢慢享受' : '多一点挑战'}</small></button>)}</fieldset></details><p className="gift-local-note">选照片和写留言都在本机完成。到了最后一步，再决定如何交给对方。</p></>}
      {step === 1 && <><div className="gift-template-picker" aria-label="选择礼物场景">{GIFT_TEMPLATES.map(t => <button key={t.id} disabled={locked} aria-pressed={p.draft.templateId === t.id} onClick={() => p.onDraft({ ...giftDraft(t.id), to: p.draft.to, from: p.draft.from })}><span>{t.symbol}</span>{t.label}</button>)}</div>
        
        <div className="creative-two"><label className="creative-label">送给<input aria-label="礼物收件人" maxLength={40} placeholder="你想起的那个人" value={p.draft.to} disabled={locked} onChange={e => update({ to: e.target.value })} /></label><label className="creative-label">来自<input aria-label="礼物寄件人" maxLength={40} placeholder="你的名字，可不填" value={p.draft.from} disabled={locked} onChange={e => update({ from: e.target.value })} /></label></div>
        <label className="creative-label">拼完后，在页面揭晓的话<textarea aria-label="礼物留言" rows={2} maxLength={1200} value={p.draft.message} disabled={locked} onChange={e => update({ message: e.target.value })} /><small>{p.draft.message.length} / 1200 · 可留空</small></label>
        <label className="creative-check"><input type="checkbox" checked={p.draft.mode === 'mystery'} disabled={locked} onChange={e => update({ mode: e.target.checked ? 'mystery' : 'classic' })} />保留一点惊喜，拼完再揭晓原图</label>
        <details className="gift-extra"><summary>编辑标题与找图线索</summary><label className="creative-label">给这份礼物起个名字<input aria-label="礼物标题" maxLength={80} value={p.draft.title} disabled={locked} onChange={e => update({ title: e.target.value })} /></label><label className="creative-label">可在拼图过程中看到<input aria-label="礼物线索" maxLength={120} value={p.draft.keywords} disabled={locked} onChange={e => update({ keywords: e.target.value })} /></label></details></>}
      {step === 2 && <>{published ? <div className="gift-delivery" role="region" aria-label="已创建的礼物链接"><span className="gift-delivered-mark" aria-hidden="true">✉</span><strong>给 {note.to || '正在想起的那个人'}</strong><label className="creative-label">拥有链接的人可以打开这张照片<input aria-label="照片礼物链接" readOnly value={published.url} onFocus={e => e.target.select()} /></label><div className="gift-delivery-actions"><button className="primary-button" onClick={() => void copy(published.invitation)}>复制邀请文案</button><button className="secondary-button" onClick={() => void copy(published.url)}>只复制链接</button><a href={published.url} target="_blank" rel="noopener noreferrer">打开礼物 ↗</a></div><p>有效至 {new Date(published.expiresAt).toLocaleString('zh-CN')}。{published.managementSaved ? '管理凭据已保存在此浏览器，可到“我的分享”随时撤回。' : '浏览器没有允许长期保存管理凭据，请保留当前页，需要时立即撤回。'}</p><button className="text-button" disabled={pending} onClick={() => void task(async () => { await revokePhotoLink(published.id, published.owner); if (mounted.current) { setPublished(null); setMessage('分享已撤回，旧链接不能再打开照片。'); } })}>撤回这份照片分享</button></div> : <>
        <div className="gift-recap">{p.image && <img src={p.image.url} alt="你准备寄出的照片" />}<div><strong>{note.title}</strong><span>{note.from || '一位想着你的人'} → {note.to || '亲爱的你'}</span><small>{p.settings.pieceCount}片 · {p.draft.mode === 'mystery' ? '拼完揭晓原图与留言' : '可预览原图，拼完揭晓留言'}</small></div></div>

        <details className="gift-extra"><summary>自定义轮廓和更多片数</summary><PuzzleSettings value={p.settings} onChange={p.onSettings} onError={p.onError} /></details>
        <p className="gift-privacy">创建链接会上传照片与留言，7天有效，可随时撤回，不展示已读状态。</p>
        <button className="primary-button gift-publish" disabled={locked || !p.image} onClick={() => void task(publish)}>{pending ? '正在把心意装进信封…' : '上传照片并创建礼物链接'} <span>↗</span></button>
        <div className="gift-local-actions"><button className="secondary-button" disabled={locked || !p.image} onClick={() => { try { p.onPreview(session(true)); } catch (e) { p.onError((e as Error).message); } }}>先在本机试玩</button><button className="secondary-button" disabled={locked || !p.image} onClick={() => void task(async () => { await exportParcel(session(), 'gift'); if (mounted.current) setMessage('礼物包已下载。把文件发给对方，在“一起拼”的创意工坊里导入即可，照片未上传。'); })}>下载礼物包，不上传</button></div></>}
        {['127.0.0.1', 'localhost'].includes(location.hostname) && <p className="gift-local-address">本机链接仅此电脑可访问。远程分享请先上线，或下载礼物包。</p>}</>}
      <div className={`gift-step-actions${step === 2 ? ' is-final' : ''}`}>{step > 0 && <button className="secondary-button" disabled={locked} onClick={() => go(step - 1)}>← 上一步</button>}{step < 2 && <button className="primary-button" disabled={locked || !p.image} onClick={() => go(step + 1)}>{step === 0 ? '选好了，写一句话' : '看看怎么交给对方'} →</button>}</div>
      <Toast message={toast} onClose={dismiss} />
    </section><aside className="gift-letter-preview" aria-label="信封预览"><span className="gift-postmark">PIECE BY PIECE<br />A LITTLE GIFT FOR YOU</span><span className="gift-letter-star">✳</span><p>TO {note.to || '正在想起的那个人'}</p><h2>{note.title}</h2>{p.image ? <img src={p.image.url} alt="礼物照片的本机预览" /> : <div className="gift-photo-placeholder" aria-hidden="true">一张照片<br />一种想念</div>}<span className="gift-preview-seal">拼开以后，还有一句话。</span><small>FROM {note.from || '一位想着你的人'}</small></aside></div>
  </main>;
}
