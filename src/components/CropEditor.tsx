import { useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import type { PuzzleImage } from '../types';
import { polygonPath, shapeOutline } from '../lib/paperGeometry';
import type { PuzzleSettings } from '../lib/paperGeometry';
import { cropRegion, normalizeCrop } from '../lib/crop';
import StudioDialog from './StudioDialog';

export default function CropEditor({ image, settings, onApply, onClose }: { image: PuzzleImage; settings: PuzzleSettings; onApply: (image: PuzzleImage) => void; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), original = useRef<HTMLImageElement | null>(null), alive = useRef(true);
  const [loaded, setLoaded] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [crop, setCrop] = useState(() => normalizeCrop(image.crop));
  const gesture = useRef<{ id: number; x: number; y: number; cx: number; cy: number } | null>(null);
  useEffect(() => {
    alive.current = true;
    const url = URL.createObjectURL(image.sourceBlob ?? image.blob), picture = new Image();
    picture.onload = () => { if (alive.current) { original.current = picture; setLoaded(true); } };
    picture.onerror = () => { if (alive.current) setError('原照片暂时无法读取，请重新上传。'); };
    picture.src = url;
    return () => { alive.current = false; picture.onload = picture.onerror = null; URL.revokeObjectURL(url); };
  }, [image]);
  function region(value = crop) {
    const picture = original.current!;
    return cropRegion(picture.naturalWidth, picture.naturalHeight, value);
  }
  useEffect(() => {
    if (!loaded || !canvas.current || !original.current) return;
    const c = canvas.current.getContext('2d'); if (!c) return;
    const r = region(); c.clearRect(0, 0, 600, 600); c.drawImage(original.current, r.x, r.y, r.side, r.side, 0, 0, 600, 600);
  }, [loaded, crop]);
  function move(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current, picture = original.current;
    if (!g || g.id !== event.pointerId || !picture) return;
    const rect = event.currentTarget.getBoundingClientRect(), side = Math.min(picture.naturalWidth, picture.naturalHeight) / crop.zoom;
    setCrop(previous => ({ ...previous, cx: Math.max(side / picture.naturalWidth / 2, Math.min(1 - side / picture.naturalWidth / 2, g.cx - (event.clientX - g.x) / rect.width * side / picture.naturalWidth)), cy: Math.max(side / picture.naturalHeight / 2, Math.min(1 - side / picture.naturalHeight / 2, g.cy - (event.clientY - g.y) / rect.height * side / picture.naturalHeight)) }));
  }
  async function apply() {
    if (!original.current || busy) return;
    setBusy(true); setError(null);
    try {
      const output = document.createElement('canvas'); output.width = output.height = 1600;
      const c = output.getContext('2d'); if (!c) throw new Error('无法创建图片画布');
      const r = region(); c.drawImage(original.current, r.x, r.y, r.side, r.side, 0, 0, 1600, 1600);
      const blob = await new Promise<Blob>((resolve, reject) => output.toBlob(b => b ? resolve(b) : reject(new Error('图片构图失败')), 'image/png'));
      if (alive.current) onApply({ ...image, blob, sourceBlob: image.sourceBlob ?? image.blob, crop: { zoom: crop.zoom, cx: (r.x + r.side / 2) / original.current.naturalWidth, cy: (r.y + r.side / 2) / original.current.naturalHeight }, url: URL.createObjectURL(blob) });
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : '图片构图失败'); }
    finally { if (alive.current) setBusy(false); }
  }
  return <StudioDialog title="调整照片构图" onClose={onClose} wide>
    <p className="studio-muted">拖动照片，把主体放进轮廓；滑动下方缩放。原照片会保留，可随时重新调整。</p>
    <div className="crop-stage" onPointerDown={event => {
      if (!loaded || !event.isPrimary || event.button !== 0) return;
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, cx: crop.cx, cy: crop.cy };
    }} onPointerMove={move} onPointerUp={() => { gesture.current = null; }} onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>
      <canvas ref={canvas} width="600" height="600" aria-label="照片构图画布，拖动调整位置" />
      <svg viewBox="0 0 1000 1000" aria-hidden="true"><path d={`M0 0H1000V1000H0Z${polygonPath(shapeOutline(settings.shape, settings.customOutline))}`} fill="#203e2a88" fillRule="evenodd" /><path d={polygonPath(shapeOutline(settings.shape, settings.customOutline))} fill="none" stroke="#fff9e3" strokeWidth="4" /></svg>
      {!loaded && <span>正在读取照片…</span>}
    </div>
    <label className="studio-range">缩放 <input type="range" aria-label="照片缩放" min="1" max="3" step=".01" value={crop.zoom} onChange={event => setCrop(previous => ({ ...previous, zoom: Number(event.target.value) }))} /><output>{crop.zoom.toFixed(2)}×</output></label>
    {error && <p role="alert" className="load-error">{error}</p>}
    <div className="studio-dialog-actions"><button className="secondary-button" onClick={() => setCrop({ zoom: 1, cx: .5, cy: .5 })}>重置构图</button><button className="primary-button" disabled={!loaded || busy} onClick={() => void apply()}>{busy ? '保存中…' : '使用这个构图'}</button></div>
  </StudioDialog>;
}
