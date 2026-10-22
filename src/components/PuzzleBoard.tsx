import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { GameState } from '../types';
import PuzzleTile, { tileBackground } from './PuzzleTile';

interface Props {
  state: GameState; url: string; preview: boolean;
  onSelect: (index: number) => void; onSwap: (from: number, to: number) => void;
}
interface Gesture { id: number; from: number; x: number; y: number; dragged: boolean }
interface DragView { from: number; x: number; y: number; target: number | null; width: number }

export default function PuzzleBoard({ state, url, preview, onSelect, onSwap }: Props) {
  const board = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const [drag, setDrag] = useState<DragView | null>(null);
  const disabled = preview || state.status === 'completed';

  function cancel() {
    const active = gesture.current;
    gesture.current = null;
    setDrag(null);
    if (active && board.current?.hasPointerCapture(active.id)) board.current.releasePointerCapture(active.id);
  }

  useEffect(() => {
    window.addEventListener('blur', cancel);
    return () => window.removeEventListener('blur', cancel);
  }, []);
  useEffect(() => { cancel(); }, [preview, state.moves, state.tiles]);

  function positionAt(x: number, y: number): number | null {
    const element = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-position]');
    if (!element || !board.current?.contains(element)) return null;
    return Number(element.dataset.position);
  }

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const from = positionAt(event.clientX, event.clientY);
    if (from === null) return;
    gesture.current = { id: event.pointerId, from, x: event.clientX, y: event.clientY, dragged: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-position="${from}"]`)?.focus({ preventScroll: true });
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - active.x, event.clientY - active.y) >= 5) active.dragged = true;
    if (active.dragged) setDrag({ from: active.from, x: event.clientX, y: event.clientY,
      target: positionAt(event.clientX, event.clientY), width: event.currentTarget.clientWidth / state.size });
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    const to = positionAt(event.clientX, event.clientY);
    const moved = active.dragged || Math.hypot(event.clientX - active.x, event.clientY - active.y) >= 5;
    cancel();
    if (disabled || to === null) return;
    if (moved) { if (active.from !== to) onSwap(active.from, to); }
    else if (active.from === to) onSelect(to);
  }

  function keyboardNavigate(event: KeyboardEvent<HTMLDivElement>) {
    const current = (event.target as HTMLElement).closest<HTMLElement>('[data-position]');
    if (!current) return;
    const index = Number(current.dataset.position);
    const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -state.size, ArrowDown: state.size };
    const delta = deltas[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    const next = index + delta;
    if (next >= 0 && next < state.tiles.length) {
      board.current?.querySelector<HTMLButtonElement>(`[data-position="${next}"]`)?.focus();
    }
  }

  const draggedTile = drag ? state.tiles[drag.from] : undefined;
  return <div className={`board-shell ${state.status === 'completed' ? 'is-completed' : ''}`}>
    <div ref={board} className="puzzle-board" role="group" aria-label={`${state.size} 乘 ${state.size} 拼图棋盘`}
      aria-describedby="board-instructions" style={{ gridTemplateColumns: `repeat(${state.size}, 1fr)` }}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={keyboardNavigate}>
      {state.tiles.map((tile, index) => <PuzzleTile key={tile.id} tile={tile} index={index} size={state.size}
        url={url} selected={state.selected === index} dragging={drag?.from === index}
        target={drag?.target === index && drag.from !== index} disabled={disabled} onKeyboardSelect={onSelect} />)}
      <img className={`board-preview ${preview ? 'visible' : ''}`} src={url} alt="完整原图预览" aria-hidden={!preview} draggable={false} />
    </div>
    {drag && draggedTile && <div className="drag-ghost" aria-hidden="true" style={{
      ...tileBackground(draggedTile.correctIndex, state.size, url),
      width: drag.width, height: drag.width,
      transform: `translate3d(${drag.x}px, ${drag.y}px, 0) translate(-50%, -50%) rotate(3deg) scale(1.04)`
    }} />}
  </div>;
}
