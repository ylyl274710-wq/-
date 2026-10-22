import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { distance, normalizeOutline, polygonPath, validateOutline } from '../lib/paperGeometry';
import type { Point } from '../lib/paperGeometry';
import Icon from './Icon';

interface Props {
  points: readonly Point[]; initialMode: 'draw' | 'points';
  onSave: (points: readonly Point[]) => void; onClose: () => void;
}

export default function ShapeDrawingModal({ points, initialMode, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drawing = useRef<{ id: number; points: Point[] } | null>(null);
  const [mode, setMode] = useState(initialMode);
  const [outline, setOutline] = useState<readonly Point[]>(initialMode === 'draw' ? points : []);
  const [draft, setDraft] = useState<readonly Point[] | null>(null);
  const [history, setHistory] = useState<(readonly Point[])[]>([]);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const hintId = useId();
  const patternId = useId().replace(/:/g, '');

  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true });
    };
  }, []);

  function point(event: PointerEvent<SVGSVGElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: Math.max(30, Math.min(970, (event.clientX - rect.left) / rect.width * 1000)),
      y: Math.max(30, Math.min(970, (event.clientY - rect.top) / rect.height * 1000)) };
  }
  function commit(next: readonly Point[]) {
    setHistory(previous => [...previous.slice(-19), outline]);
    setOutline(next); setError(null);
  }
  function switchMode(next: 'draw' | 'points') {
    if (mode === next) return;
    drawing.current = null; setDraft(null); setMode(next); commit([]);
  }
  const validation = validateOutline(outline);

  return <dialog ref={dialog} className="drawing-modal" aria-labelledby={titleId} aria-describedby={hintId}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="drawing-modal-heading"><div><p>MAKE IT YOUR OWN</p><h2 id={titleId}>画一个，只属于你的形状。</h2></div>
      <button type="button" className="icon-button" aria-label="关闭绘画，保留原轮廓" onClick={onClose}><Icon name="close" /></button></header>
    <div className="drawing-toolbar"><div className="drawing-mode">
      <button type="button" aria-pressed={mode === 'draw'} onClick={() => switchMode('draw')}>自由绘制</button>
      <button type="button" aria-pressed={mode === 'points'} onClick={() => switchMode('points')}>点按描点</button></div>
      <div className="drawing-tools"><button type="button" disabled={!history.length} onClick={() => {
        setOutline(history[history.length - 1]!); setHistory(previous => previous.slice(0, -1)); setError(null);
      }}>撤销</button><button type="button" disabled={!outline.length} onClick={() => commit([])}>清空重画</button></div></div>
    <p id={hintId} className="drawing-hint">{mode === 'draw' ? '按住画出外轮廓，松开自动闭合。再画一笔即可替换。' : '依次点出形状的顶点，最后一个点会自动连接起点。'}<br />线条不要交叉，尽量画得饱满一些。</p>
    <svg className="drawing-canvas" viewBox="0 0 1000 1000" role="application" aria-label="放大的自由绘制画布" aria-describedby={hintId}
      onPointerDown={event => {
        if (!event.isPrimary || event.button !== 0 || drawing.current) return;
        event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
        const first = point(event); drawing.current = { id: event.pointerId, points: [first] };
        if (mode === 'draw') setDraft([first]);
        setError(null);
      }}
      onPointerMove={event => {
        const active = drawing.current;
        if (!active || active.id !== event.pointerId || mode !== 'draw') return;
        const next = point(event);
        if (distance(active.points[active.points.length - 1]!, next) > 12) {
          active.points.push(next);
          // 长笔画均匀抽样，保留整个轮廓而不是在点数上限处截断。
          if (active.points.length > 150) active.points = active.points.filter((_, index) => index % 2 === 0);
          setDraft([...active.points]);
        }
      }}
      onPointerUp={event => {
        const active = drawing.current;
        if (!active || active.id !== event.pointerId) return;
        drawing.current = null; setDraft(null);
        if (mode === 'points') {
          if (outline.length >= 155) setError('顶点已足够多，请撤销一点或使用当前轮廓');
          else commit([...outline, point(event)]);
        } else {
          const output = [...active.points];
          const end = point(event);
          if (distance(output[output.length - 1]!, end) > 5) output.push(end);
          if (output.length > 3 && distance(output[0]!, output[output.length - 1]!) < 35) output.pop();
          const message = validateOutline(output);
          if (message) setError(message); else commit(output);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { drawing.current = null; setDraft(null); }}
      onLostPointerCapture={() => { drawing.current = null; setDraft(null); }}>
      <defs><pattern id={patternId} width="50" height="50" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="2" fill="#bcc7aa" /></pattern></defs>
      <rect width="1000" height="1000" fill={`url(#${patternId})`} />
      <path d={polygonPath(draft ?? outline)} fill={draft ? '#dbe4ca66' : '#dbe4ca'} stroke="#71845d" strokeWidth="5" strokeLinejoin="round" strokeDasharray={draft ? '15 10' : undefined} />
      {mode === 'points' && outline.map((p, index) => <circle key={index} cx={p.x} cy={p.y} r="9" fill="#bd7950" />)}
    </svg>
    <p className={`drawing-feedback${error ? ' has-error' : ''}`} role={error ? 'alert' : 'status'}>
      {error ?? (validation ? outline.length ? validation : '画布准备好了，开始创作吧。' : '轮廓已就绪，点击「使用轮廓」保存。')}</p>
    <footer className="drawing-modal-actions"><button type="button" className="secondary-button" onClick={onClose}>取消</button>
      <button type="button" className="primary-button" disabled={Boolean(validation) || draft !== null} onClick={() => onSave(normalizeOutline(outline))}>使用轮廓 <Icon name="check" width="17" height="17" /></button></footer>
  </dialog>;
}
