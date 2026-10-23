import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, PointerEvent } from 'react';
import { useMemoryComposer } from '../hooks/useMemoryComposer';
import { centeredPhoto, createMemoryImage, decodeMemoryPhoto, drawMemory, photoCrop, photoWindow, PHOTO_AREA } from '../lib/memoryCollage';
import type { MemoryComposition, MemoryPhoto, PhotoPosition, PhotoSlot } from '../lib/memoryCollage';
import type { PuzzleImage } from '../types';
import { downloadBlob } from '../lib/exchange';
import Icon from './Icon';
import '../styles/memory.css';

interface Props { onBack: () => void; onStart: (image: PuzzleImage, pieces: number) => void; onError: (message: string) => void }
interface DecodedPhotos { urls: readonly [string | undefined, string | undefined]; images: readonly [HTMLImageElement | null, HTMLImageElement | null] }

function PhotoPicker({ slot, photo, loading, disabled, onFile }: { slot: PhotoSlot; photo: MemoryPhoto | null; loading: boolean; disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null), [over, setOver] = useState(false);
  function accept(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; event.target.value = ''; if (file) onFile(file); }
  return <div className={`memory-photo-picker${over ? ' is-over' : ''}`} onDragOver={event => { event.preventDefault(); if (!disabled) setOver(true); }} onDragLeave={() => setOver(false)} onDrop={event => { event.preventDefault(); setOver(false); const file = event.dataTransfer.files[0]; if (!disabled && file) onFile(file); }}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={accept} disabled={disabled} aria-label={`上传第${slot + 1}张照片`} />
    <button type="button" disabled={disabled} className="memory-upload" onClick={() => input.current?.click()} aria-label={`${photo ? '更换' : '上传'}第${slot + 1}张照片`}>
      {photo ? <img src={photo.url} alt={`第${slot + 1}张照片预览`} /> : <span className="memory-empty-photo"><Icon name="image" /></span>}
      <span><strong>{loading ? '正在读取…' : photo ? '更换照片' : `上传第${slot + 1}张照片`}</strong><small>{photo ? photo.name : 'JPG / PNG / WebP · ≤10 MB'}</small></span><Icon name={photo ? 'refresh' : 'upload'} width="16" height="16" />
    </button>
  </div>;
}

export default function MemoryComposer({ onBack, onStart, onError }: Props) {
  const composer = useMemoryComposer(onError), { state, dispatch } = composer, { composition } = state;
  const canvas = useRef<HTMLCanvasElement>(null), mounted = useRef(true), operation = useRef(0);
  const [decoded, setDecoded] = useState<DecodedPhotos>({ urls: [undefined, undefined], images: [null, null] });
  const [working, setWorking] = useState(false), [demoLoading, setDemoLoading] = useState(false), [previewError, setPreviewError] = useState('');
  const demoAbort = useRef<AbortController | null>(null);
  const drag = useRef<{ pointerId: number; slot: PhotoSlot; x: number; y: number; position: PhotoPosition; scaleX: number; scaleY: number } | null>(null);
  const urls = [state.photos[0]?.url, state.photos[1]?.url] as const;
  const currentImages = decoded.urls[0] === urls[0] && decoded.urls[1] === urls[1];
  const ready = !!state.photos[0] && !!state.photos[1] && currentImages && !!decoded.images[0] && !!decoded.images[1] && !previewError;
  const busy = working || demoLoading || state.loading.some(Boolean), position = composition.positions[state.active];
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current++; demoAbort.current?.abort(); }; }, []);
  useEffect(() => {
    let active = true; setPreviewError('');
    void Promise.all(state.photos.map(photo => photo ? decodeMemoryPhoto(photo) : Promise.resolve(null))).then(images => {
      if (active) setDecoded({ urls, images: [images[0] ?? null, images[1] ?? null] });
    }).catch(() => { if (active) setPreviewError('照片预览没有加载成功，请重新选择照片。'); });
    return () => { active = false; };
  }, [urls[0], urls[1]]);
  useEffect(() => {
    if (!canvas.current) return;
    try { drawMemory(canvas.current, currentImages ? decoded.images : [null, null], composition); }
    catch { setPreviewError('当前浏览器无法生成画布，请重新打开页面。'); }
  }, [decoded, currentImages, composition]);
  function patch(value: Partial<Omit<MemoryComposition, 'positions'>>) { dispatch({ type: 'composition', patch: value }); }
  function move(value: Partial<PhotoPosition>) { dispatch({ type: 'position', slot: state.active, position: { ...position, ...value } }); }
  function startDrag(event: PointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 || !event.isPrimary || busy || !currentImages) return;
    const rect = event.currentTarget.getBoundingClientRect(), x = (event.clientX - rect.left) / rect.width * 1000, y = (event.clientY - rect.top) / rect.height * 1000;
    const area = PHOTO_AREA;
    if (x < area.x || x > area.x + area.width || y < area.y || y > area.y + area.height) return;
    const slot: PhotoSlot = (composition.layout === 'beside' ? (x - area.x) / area.width : (y - area.y) / area.height) < composition.balance ? 0 : 1;
    const image = decoded.images[slot]; if (!image) return;
    const p = composition.positions[slot], box = photoWindow(composition, slot), crop = photoCrop(image.naturalWidth, image.naturalHeight, box.width, box.height, p);
    dispatch({ type: 'active', slot }); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, slot, x: event.clientX, y: event.clientY, position: p,
      scaleX: image.naturalWidth - crop.width > .01 ? crop.width / box.width * 1000 / rect.width / (image.naturalWidth - crop.width) : 0,
      scaleY: image.naturalHeight - crop.height > .01 ? crop.height / box.height * 1000 / rect.height / (image.naturalHeight - crop.height) : 0 };
  }
  function dragPhoto(event: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current; if (!d || d.pointerId !== event.pointerId) return;
    dispatch({ type: 'position', slot: d.slot, position: { ...d.position, x: d.position.x - (event.clientX - d.x) * d.scaleX, y: d.position.y - (event.clientY - d.y) * d.scaleY } });
  }
  function endDrag(event: PointerEvent<HTMLCanvasElement>) { if (drag.current?.pointerId !== event.pointerId) return; drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }
  async function generate(start: boolean) {
    if (!ready || busy || !decoded.images[0] || !decoded.images[1]) return;
    const token = ++operation.current; setWorking(true);
    let result: PuzzleImage | null = null;
    try {
      result = await createMemoryImage([decoded.images[0], decoded.images[1]], composition);
      if (!mounted.current || operation.current !== token) { URL.revokeObjectURL(result.url); return; }
      if (start) { onStart(result, state.pieces); result = null; }
      else downloadBlob(result.blob, '两张照片-一段回忆.png');
    } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : '回忆画没有生成，请重试'); }
    finally { if (result) URL.revokeObjectURL(result.url); if (mounted.current) setWorking(false); }
  }
  async function demo() {
    if (busy) return; setDemoLoading(true); const controller = new AbortController(); demoAbort.current = controller;
    try {
      const files = await Promise.all(['bedroom', 'great-wave'].map(async name => { const response = await fetch(`${import.meta.env.BASE_URL}levels/${name}.jpg`, { signal: controller.signal }); if (!response.ok) throw new Error('示例暂时无法加载，请上传自己的照片'); return new File([await response.blob()], `${name}.jpg`, { type: 'image/jpeg' }); }));
      if (mounted.current && !controller.signal.aborted) await Promise.all(files.map((file, i) => composer.upload(i as PhotoSlot, file)));
    } catch (error) { if (mounted.current && !controller.signal.aborted) onError(error instanceof Error ? error.message : '示例未能加载'); }
    finally { if (mounted.current) setDemoLoading(false); }
  }
  return <main className="memory-page">
    <div className="mode-breadcrumb"><button className="nav-back-button" onClick={onBack}>← 返回首页</button><span>两张照片，一段回忆</span></div>
    <header className="memory-intro"><div><p className="eyebrow">TWO PHOTOS. ONE LITTLE MEMORY.</p><h1>把两个瞬间，<span className="serif-accent">拼在一起。</span></h1><p>可以是你和一个人，也可以是从前和现在。留一句话，把回忆慢慢拼回来。</p></div><span className="memory-intro-mark" aria-hidden="true">✧</span></header>
    <div className="memory-workspace"><section className="memory-controls" aria-label="回忆画设置"><fieldset disabled={busy}>
      <div className="memory-section-label"><span>01</span><h2>挑选两个瞬间</h2><button type="button" className="text-button" onClick={() => void demo()}>{demoLoading ? '正在准备…' : '看看双图效果 ↗'}</button></div>
      <div className="memory-photo-pair">{([0, 1] as const).map(slot => <PhotoPicker key={slot} slot={slot} photo={state.photos[slot]} loading={state.loading[slot]} disabled={busy} onFile={file => void composer.upload(slot, file)} />)}</div>
      <div className="memory-section-label"><span>02</span><h2>让它们相遇</h2><button type="button" className="text-button" onClick={composer.swap} disabled={!state.photos.some(Boolean)}>交换照片 ⇄</button></div>
      <div className="memory-option-row"><span>排列</span><div className="memory-segments">{(['beside', 'stacked'] as const).map(value => <button type="button" key={value} aria-pressed={composition.layout === value} onClick={() => patch({ layout: value })}>{value === 'beside' ? '并肩' : '上下'}</button>)}</div><span>交界</span><div className="memory-segments">{(['torn', 'soft'] as const).map(value => <button type="button" key={value} aria-pressed={composition.seam === value} onClick={() => patch({ seam: value })}>{value === 'torn' ? '撕纸' : '柔和'}</button>)}</div></div>
      <label className="memory-range"><span>照片占比 <small>{Math.round(composition.balance * 100)} / {Math.round((1 - composition.balance) * 100)}</small></span><input type="range" min="30" max="70" value={Math.round(composition.balance * 100)} onChange={event => patch({ balance: Number(event.target.value) / 100 })} aria-label="第一张照片占比" /></label>
      <details className="memory-position"><summary>调整照片构图 <small>也可以直接拖动画面</small></summary><div className="memory-segments">{([0, 1] as const).map(slot => <button key={slot} type="button" aria-pressed={state.active === slot} onClick={() => dispatch({ type: 'active', slot })}>第 {slot + 1} 张</button>)}<button type="button" onClick={() => move(centeredPhoto())}>重置构图</button></div><label className="memory-range"><span>放大 <small>{position.zoom.toFixed(1)}×</small></span><input aria-label="照片放大倍数" type="range" min="1" max="3" step=".05" value={position.zoom} onChange={event => move({ zoom: Number(event.target.value) })} /></label><label className="memory-range"><span>水平位置</span><input aria-label="照片水平位置" type="range" min="0" max="1" step=".01" value={position.x} onChange={event => move({ x: Number(event.target.value) })} /></label><label className="memory-range"><span>垂直位置</span><input aria-label="照片垂直位置" type="range" min="0" max="1" step=".01" value={position.y} onChange={event => move({ y: Number(event.target.value) })} /></label></details>
      <div className="memory-section-label"><span>03</span><h2>留一点想留下的</h2><small>都可以不填</small></div>
      <div className="memory-word-fields"><label>这段回忆的名字<input aria-label="回忆标题" maxLength={24} value={composition.title} onChange={event => patch({ title: event.target.value })} placeholder="两张照片，一段回忆" /></label><label>一句话<input aria-label="回忆留言" maxLength={40} value={composition.message} onChange={event => patch({ message: event.target.value })} placeholder="有些瞬间，值得被好好留下。" /></label><div className="memory-last-row"><label>一个日子<input aria-label="回忆日期" type="date" value={composition.date} onChange={event => patch({ date: event.target.value })} /></label><label>拼成几片<select aria-label="回忆拼图片数" value={state.pieces} onChange={event => dispatch({ type: 'pieces', count: Number(event.target.value) })}>{[9, 16, 25, 36, 64].map(count => <option key={count} value={count}>{count} 片</option>)}</select></label></div></div>
    </fieldset></section>
    <section className="memory-preview" aria-label="双照片合成预览"><div className="memory-preview-label"><span>A MEMORY TO KEEP</span><span>01 + 02 = ♡</span></div><div className="memory-canvas-frame"><canvas ref={canvas} width="1000" height="1000" role="img" aria-label="两张照片合成的回忆画，支持拖动照片调整构图" onPointerDown={startDrag} onPointerMove={dragPhoto} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={() => { drag.current = null; }} />{!currentImages && <span className="memory-preview-loading" role="status">正在准备照片…</span>}</div><p className="memory-preview-hint">{ready ? '拖动照片调整位置 · 标题和留言也会一起成为纸片' : '上传两张照片，看看它们在同一幅画里的样子'}</p>{previewError && <p role="alert" className="memory-error">{previewError}</p>}
      <div className="memory-start-row"><button type="button" className="primary-button" disabled={!ready || busy} onClick={() => void generate(true)}><span>{working ? '正在合成回忆…' : '打散，一起拼回来'}</span><Icon name="arrow" /></button><button type="button" className="secondary-button" disabled={!ready || busy} onClick={() => void generate(false)}>保存回忆画</button></div>
      <p className="memory-private"><Icon name="lock" width="12" height="12" /> 照片只在此浏览器合成，保存由你决定。</p>
    </section></div>
  </main>;
}
