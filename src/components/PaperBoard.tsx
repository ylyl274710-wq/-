import { memo, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import type { PaperGameState } from '../hooks/usePaperGame';
import { connectedGroup, isEdgePiece } from '../lib/paperReducer';
import type { PaperGeometry, Point } from '../lib/paperGeometry';
import PaperPiece from './PaperPiece';
import { useBoardLayout } from '../hooks/useBoardLayout';
import { sameBoardState } from '../lib/boardState';

interface Props { state: PaperGameState; url: string; preview: boolean; hardMode: boolean; restoration?: boolean; onSelect: (id: number) => void; onPlace: (id: number, point: Point) => void; onMark: () => void; onReturn: (id?: number) => void; onDeselect: () => void }
interface Gesture { pointerId: number; pieceId: number; x: number; y: number; offset: Point; fromTray: boolean; fromBoard: boolean; dragged: boolean }
interface DragView { ids: number[]; x: number; y: number; scale: number; bounds: { x: number; y: number; width: number; height: number } }
interface View { zoom: number; x: number; y: number }
function clampView(view: View): View { const max = 1000 - 1000 / view.zoom; return { zoom: view.zoom, x: Math.max(0, Math.min(max, view.x)), y: Math.max(0, Math.min(max, view.y)) }; }

function GroupImage({ geometry, ids, url, bounds }: { geometry: PaperGeometry; ids: readonly number[]; url: string; bounds: { x: number; y: number; width: number; height: number } }) {
  const uid = useId().replace(/:/g, '');
  return <svg viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`}><defs><clipPath id={`${uid}-outer`}><path d={geometry.outlinePath} /></clipPath>{ids.map(id => <clipPath id={`${uid}-${id}`} key={id}><path d={geometry.pieces[id]!.path} /></clipPath>)}</defs><g clipPath={`url(#${uid}-outer)`}>{ids.map(id => <g key={id} clipPath={`url(#${uid}-${id})`}><image href={url} width="1000" height="1000" preserveAspectRatio="none" /><path d={geometry.pieces[id]!.path} fill="none" stroke="#fff7e4" strokeWidth="3" /></g>)}</g></svg>;
}

function PaperBoard({ state, url, preview, hardMode, restoration, onSelect, onPlace, onMark, onReturn, onDeselect }: Props) {
  const root = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null), tray = useRef<HTMLElement>(null);
  const layout = useBoardLayout(root, state.geometry.pieces.length);
  const gesture = useRef<Gesture | null>(null), pan = useRef<{ id: number; x: number; y: number; view: View } | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null), [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [panMode, setPanMode] = useState(false), [large, setLarge] = useState(false), [filter, setFilter] = useState<'all' | 'edges' | 'marked'>('all');
  const [colorSort, setColorSort] = useState(false), [colors, setColors] = useState<Record<number, number>>({});
  const [cursor, setCursor] = useState<Point>({ x: 500, y: 500 });
  const ghost = useRef<HTMLDivElement>(null), dragFrame = useRef<number | null>(null);
  const dragPoint = useRef<Point>({ x: 0, y: 0 });
  const dragMetrics = useRef<DragView | null>(null);
  const uid = useId().replace(/:/g, '_');
  const complete = state.status === 'completed', disabled = preview || complete;
  const selected = state.selected === null ? undefined : state.geometry.pieces[state.selected];
  const selectedGroup = state.selected === null ? [] : connectedGroup(state, state.selected);
  const remaining = state.order.filter(id => !state.placed.includes(id) && !state.loose.some(p => p.id === id));
  const shown = remaining.filter(id => filter === 'all' || (filter === 'edges' ? isEdgePiece(state.geometry, id) : state.marked.includes(id)));
  if (colorSort) shown.sort((a, b) => (colors[a] ?? 0) - (colors[b] ?? 0));

  useEffect(() => {
    let active = true;
    const image = new Image(); image.src = url;
    void image.decode().then(() => {
      if (!active) return;
      const sample = document.createElement('canvas'); sample.width = sample.height = 128;
      const c = sample.getContext('2d', { willReadFrequently: true }); if (!c) return;
      c.drawImage(image, 0, 0, 128, 128); const data = c.getImageData(0, 0, 128, 128).data;
      const result: Record<number, number> = {};
      state.geometry.pieces.forEach(piece => {
        const pixel = (Math.min(127, Math.floor(piece.anchor.y / 1000 * 128)) * 128 + Math.min(127, Math.floor(piece.anchor.x / 1000 * 128))) * 4;
        const r = data[pixel]! / 255, g = data[pixel + 1]! / 255, b = data[pixel + 2]! / 255, max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
        const hue = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
        result[piece.id] = d < .1 ? 400 + max * 60 : hue * 60;
      }); setColors(result);
    }).catch(() => {});
    return () => { active = false; };
  }, [url, state.geometry]);
  function cancel() {
    const pointerId = gesture.current?.pointerId ?? pan.current?.id;
    gesture.current = null; pan.current = null; dragMetrics.current = null; setDrag(null);
    if (dragFrame.current !== null) { cancelAnimationFrame(dragFrame.current); dragFrame.current = null; }
    if (pointerId !== undefined && root.current?.hasPointerCapture(pointerId)) root.current.releasePointerCapture(pointerId);
  }
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') cancel(); };
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', hidden);
      if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    };
  }, []);
  useLayoutEffect(() => {
    if (ghost.current && drag) ghost.current.style.transform = `translate3d(${dragPoint.current.x}px, ${dragPoint.current.y}px, 0)`;
  }, [drag]);
  useEffect(() => { cancel(); }, [preview, state.geometry, state.placed]);
  useEffect(() => { setView({ zoom: 1, x: 0, y: 0 }); setFilter('all'); }, [state.geometry]);
  useEffect(() => {
    if (state.hinted === null) return;
    const target = state.geometry.pieces[state.hinted]!.anchor;
    setView(previous => clampView({ ...previous, x: target.x - 500 / previous.zoom, y: target.y - 500 / previous.zoom }));
  }, [state.hinted, state.hintsUsed, state.geometry]);
  function world(clientX: number, clientY: number): Point { const rect = canvas.current!.getBoundingClientRect(); return { x: view.x + (clientX - rect.left) / rect.width * 1000 / view.zoom, y: view.y + (clientY - rect.top) / rect.height * 1000 / view.zoom }; }
  function zoom(amount: number) {
    setView(previous => { const next = Math.max(1, Math.min(3, previous.zoom + amount)); const center = state.selected === null ? { x: previous.x + 500 / previous.zoom, y: previous.y + 500 / previous.zoom } : state.loose.find(p => p.id === state.selected)?.point ?? state.geometry.pieces[state.selected]!.anchor; return clampView({ zoom: next, x: center.x - 500 / next, y: center.y - 500 / next }); });
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current || (event.target as Element).closest('[data-board-ui]')) return;
    const target = event.target as Element, button = target.closest<HTMLButtonElement>('[data-piece]'), boardPiece = target.closest<SVGGElement>('[data-board-piece]');
    const inCanvas = canvas.current?.contains(target);
    if (!button && !inCanvas) return;
    if (inCanvas && view.zoom > 1 && (panMode || state.selected === null) && !boardPiece) { pan.current = { id: event.pointerId, x: event.clientX, y: event.clientY, view }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); return; }
    const pieceId = button ? Number(button.dataset.piece) : boardPiece ? Number(boardPiece.dataset.boardPiece) : state.selected;
    if (pieceId === null) return;
    const piece = state.geometry.pieces[pieceId]; if (!piece) return;
    let offset: Point = { x: 0, y: 0 };
    const svg = button?.querySelector('svg'), matrix = svg?.getScreenCTM();
    if (svg && matrix) { const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY; const w = p.matrixTransform(matrix.inverse()); offset = { x: w.x - piece.anchor.x, y: w.y - piece.anchor.y }; }
    if (boardPiece) { const point = world(event.clientX, event.clientY), current = state.loose.find(p => p.id === pieceId)?.point ?? piece.anchor; offset = { x: point.x - current.x, y: point.y - current.y }; }
    gesture.current = { pointerId: event.pointerId, pieceId, x: event.clientX, y: event.clientY, offset, fromTray: !!button, fromBoard: !!boardPiece, dragged: false };
    event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); (button ?? canvas.current)?.focus({ preventScroll: true });
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    const p = pan.current;
    if (p && p.id === event.pointerId) { const rect = canvas.current!.getBoundingClientRect(); setView(clampView({ zoom: p.view.zoom, x: p.view.x - (event.clientX - p.x) / rect.width * 1000 / p.view.zoom, y: p.view.y - (event.clientY - p.y) / rect.height * 1000 / p.view.zoom })); return; }
    const active = gesture.current; if (!active || active.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) < 5 && !active.dragged) return;
    if (!active.dragged) {
      active.dragged = true;
      const ids = connectedGroup(state, active.pieceId), pieces = ids.map(id => state.geometry.pieces[id]!);
      const x = Math.min(...pieces.map(piece => piece.bounds.x)), y = Math.min(...pieces.map(piece => piece.bounds.y));
      const bounds = { x, y, width: Math.max(...pieces.map(piece => piece.bounds.x + piece.bounds.width)) - x, height: Math.max(...pieces.map(piece => piece.bounds.y + piece.bounds.height)) - y };
      const scale = canvas.current!.getBoundingClientRect().width / 1000 * view.zoom;
      dragMetrics.current = { ids, bounds, scale, x: 0, y: 0 };
    }
    const metrics = dragMetrics.current!, piece = state.geometry.pieces[active.pieceId]!;
    dragPoint.current = {
      x: event.clientX - (piece.anchor.x + active.offset.x - metrics.bounds.x) * metrics.scale,
      y: event.clientY - (piece.anchor.y + active.offset.y - metrics.bounds.y) * metrics.scale,
    };
    // 拖动途中只在下一帧更新浮片 transform，整个棋盘与全部缩略图不随指针重绘。
    if (drag !== metrics) setDrag(metrics);
    if (dragFrame.current === null) dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      if (ghost.current) ghost.current.style.transform = `translate3d(${dragPoint.current.x}px, ${dragPoint.current.y}px, 0)`;
    });
  }
  function up(event: PointerEvent<HTMLDivElement>) {
    if (pan.current) { if (pan.current.id === event.pointerId) cancel(); return; }
    const active = gesture.current; if (!active || active.pointerId !== event.pointerId) return;
    const moved = active.dragged || Math.hypot(event.clientX - active.x, event.clientY - active.y) >= 5;
    cancel(); if (disabled) return;
    if (!moved && (active.fromTray || active.fromBoard)) { onSelect(active.pieceId); return; }
    const trayRect = tray.current?.getBoundingClientRect();
    if (moved && active.fromBoard && trayRect && event.clientX >= trayRect.left && event.clientX <= trayRect.right && event.clientY >= trayRect.top && event.clientY <= trayRect.bottom) { setFilter('all'); onReturn(active.pieceId); return; }
    const rect = canvas.current!.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return;
    const point = world(event.clientX, event.clientY);
    onPlace(active.pieceId, { x: point.x - (active.fromTray || active.fromBoard ? active.offset.x : 0), y: point.y - (active.fromTray || active.fromBoard ? active.offset.y : 0) });
  }
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (disabled || event.target !== event.currentTarget) return;
    const steps: Record<string, Point> = { ArrowLeft: { x: -25, y: 0 }, ArrowRight: { x: 25, y: 0 }, ArrowUp: { x: 0, y: -25 }, ArrowDown: { x: 0, y: 25 } };
    const delta = steps[event.key];
    if (delta) { event.preventDefault(); setCursor(p => ({ x: Math.max(0, Math.min(1000, p.x + delta.x * (event.shiftKey ? .2 : 1))), y: Math.max(0, Math.min(1000, p.y + delta.y * (event.shiftKey ? .2 : 1))) })); }
    if ((event.key === 'Enter' || event.key === ' ') && state.selected !== null && !disabled) { event.preventDefault(); onPlace(state.selected, cursor); }
  }
  return <div ref={root} className={`paper-board-root${layout.stacked ? ' is-stacked' : ''}`} style={{ '--board-size': `${layout.boardSize}px`, '--tray-columns': layout.columns, '--piece-size': `${layout.pieceSize}px` } as CSSProperties} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); cancel(); onDeselect(); } }}>
    <div className="paper-board-stage">
      <div className="board-view-tools" data-board-ui><button aria-label="缩小拼图区" disabled={view.zoom === 1} onClick={() => zoom(-.5)}>−</button><span>{view.zoom.toFixed(1)}×</span><button aria-label="放大拼图区" disabled={view.zoom === 3} onClick={() => zoom(.5)}>＋</button><button onClick={() => { setView({ zoom: 1, x: 0, y: 0 }); setPanMode(false); }}>全图</button>{view.zoom > 1 && <button aria-pressed={panMode} onClick={() => setPanMode(v => !v)}>移图</button>}{selected && !disabled && <><button aria-label="放大查看所选纸片" aria-pressed={large} onClick={() => setLarge(v => !v)}>◉</button><button aria-label="标记所选纸片" aria-pressed={state.marked.includes(selected.id)} onClick={onMark}>{state.marked.includes(selected.id) ? '★' : '☆'}</button><button aria-label="取消选择纸片" title="取消选择（Esc），保留当前位置" onClick={onDeselect}>取消</button>{(state.loose.some(p => p.id === selected.id) || state.placed.includes(selected.id)) && <button aria-label="收回所选纸片" title="收回纸片盒，也可直接拖回" onClick={() => { setFilter('all'); onReturn(); }}>收回纸片</button>}</>}</div>
    <div ref={canvas} className={`paper-canvas ${complete ? 'paper-completed' : ''}`} tabIndex={0} onKeyDown={keyboard} role="group" aria-label={`${state.geometry.shapeLabel}拼图区，${state.geometry.pieces.length}片，已归位${state.placed.length}片`} aria-describedby="paper-feedback" data-testid="paper-canvas">
      <svg viewBox={`${view.x} ${view.y} ${1000 / view.zoom} ${1000 / view.zoom}`} className="assembly-svg" aria-hidden="true">
        <defs><clipPath id={`${uid}-outline`}><path d={state.geometry.outlinePath} /></clipPath>{state.geometry.pieces.map(p => <clipPath key={p.id} id={`${uid}-cell-${p.id}`}><path d={p.path} /></clipPath>)}</defs>
        <path className="assembly-outline" d={state.geometry.outlinePath} fill="var(--board-fill, #e8e9dc)" stroke="#a6b391" strokeWidth="3" />
        <g clipPath={`url(#${uid}-outline)`}>
          {restoration && !complete && <image href={url} width="1000" height="1000" preserveAspectRatio="none" style={{ filter: 'grayscale(1) sepia(.7)', opacity: .3, pointerEvents: 'none' }} />}
          {!complete && !hardMode && <g data-testid="piece-guides">{state.geometry.pieces.map(p => <path key={p.id} d={p.path} fill="none" stroke="#b8c6a7" strokeWidth="2" strokeDasharray="6 6" />)}</g>}
          {state.placed.map(id => <g key={id} clipPath={`url(#${uid}-cell-${id})`} data-placed={id} data-board-piece={id} style={{ opacity: drag?.ids.includes(id) ? .1 : 1, cursor: complete ? 'default' : 'grab' }}><image href={url} width="1000" height="1000" preserveAspectRatio="none" />{!complete && (!hardMode || state.selected === id) && <path d={state.geometry.pieces[id]!.path} fill="none" stroke={state.selected === id ? '#cf9956' : '#fff9eb'} strokeWidth={state.selected === id ? 8 : 2.5} />}</g>)}
          {preview && <image href={url} width="1000" height="1000" preserveAspectRatio="none" data-testid="paper-preview" />}
        </g>
        {!preview && state.loose.map(item => { const piece = state.geometry.pieces[item.id]!; return <g key={item.id} data-board-piece={item.id} transform={`translate(${item.point.x - piece.anchor.x},${item.point.y - piece.anchor.y})`} style={{ opacity: drag?.ids.includes(item.id) ? .1 : 1, cursor: 'grab' }}><g clipPath={`url(#${uid}-outline)`}><g clipPath={`url(#${uid}-cell-${item.id})`}><image href={url} width="1000" height="1000" preserveAspectRatio="none" /><path d={piece.path} fill="none" stroke={selectedGroup.includes(item.id) ? '#cf9956' : '#fff4dc'} strokeWidth={selectedGroup.includes(item.id) ? 8 : 3} /></g></g></g>; })}
        {state.hinted !== null && !preview && <g clipPath={`url(#${uid}-outline)`}><path className="hint-target" data-testid="hint-target" data-hint-id={state.hinted} d={state.geometry.pieces[state.hinted]!.path} fill="#efb84c80" stroke="#d18b26" strokeWidth="8" /></g>}
        {!disabled && state.selected !== null && <g className="keyboard-crosshair"><circle cx={cursor.x} cy={cursor.y} r="13" fill="none" stroke="#bd744e" strokeWidth="3" /><path d={`M${cursor.x - 20},${cursor.y}h40M${cursor.x},${cursor.y - 20}v40`} stroke="#bd744e" strokeWidth="2" /></g>}
      </svg>
      {state.status === 'ready' && !selected && <span className="assembly-hint">选一片，再找它的归处</span>}
      {selected && !preview && <div className={`piece-inspector${large ? ' is-large' : ''}`} aria-hidden="true"><div className="inspector-photo"><PaperPiece piece={selected} geometry={state.geometry} url={url} /></div><span>第 {selected.id + 1} 片{selectedGroup.length > 1 ? ` · ${selectedGroup.length}片组合` : ''}</span></div>}
    </div></div>
    <section ref={tray} className="piece-tray" aria-label="待拼碎片"><div className="tray-heading"><span>纸片盒 <small>{remaining.length}片{state.loose.length ? ` · 暂放${state.loose.length}` : ''}</small></span><div className="tray-tools"><select aria-label="纸片筛选" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">全部</option><option value="edges">边缘</option><option value="marked">标记</option></select><button aria-pressed={colorSort} onClick={() => setColorSort(v => !v)} title="按主要颜色整理">颜色</button></div></div>
      <div className="tray-pieces">{shown.map(id => <button key={id} className={`paper-tray-piece ${state.selected === id ? 'is-selected' : ''} ${drag?.ids.includes(id) ? 'is-lifted' : ''}`} type="button" data-piece={id} data-anchor-x={state.geometry.pieces[id]!.anchor.x} data-anchor-y={state.geometry.pieces[id]!.anchor.y} aria-label={`选择第${id + 1}片`} aria-pressed={state.selected === id} disabled={disabled} onClick={event => { if (event.detail === 0) onSelect(id); }}><PaperPiece piece={state.geometry.pieces[id]!} geometry={state.geometry} url={url} /><span>{state.marked.includes(id) ? '★ ' : ''}{id + 1}</span></button>)}</div>
      {!shown.length && <p className="tray-empty">{complete ? '每一片都找到了位置。' : filter !== 'all' ? '这个筛选下暂时没有纸片。' : '纸片都在画布上，可以继续拼接。'}</p>}
    </section>
    {drag && <div ref={ghost} className="paper-drag-ghost" aria-hidden="true" style={{ width: drag.bounds.width * drag.scale, height: drag.bounds.height * drag.scale, transform: `translate3d(${dragPoint.current.x}px, ${dragPoint.current.y}px, 0)` }}><GroupImage geometry={state.geometry} ids={drag.ids} url={url} bounds={drag.bounds} /></div>}
  </div>;
}

export default memo(PaperBoard, (a, b) => sameBoardState(a.state, b.state) && a.url === b.url &&
  a.preview === b.preview && a.hardMode === b.hardMode && a.restoration === b.restoration &&
  a.onSelect === b.onSelect && a.onPlace === b.onPlace && a.onMark === b.onMark &&
  a.onReturn === b.onReturn && a.onDeselect === b.onDeselect);
