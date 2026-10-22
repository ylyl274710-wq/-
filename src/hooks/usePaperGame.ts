import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { generatePaperGeometry, newSeed } from '../lib/paperGeometry';
import type { Point, PuzzleSettings } from '../lib/paperGeometry';
import { initialPaperGame, paperReducer, restorePaperGame } from '../lib/paperReducer';
import type { PaperGameState } from '../lib/paperReducer';
export { initialPaperGame, paperReducer } from '../lib/paperReducer';
export type { PaperGameState, PaperAction } from '../lib/paperReducer';

export function usePaperGame(settings: PuzzleSettings, saved?: PaperGameState, seed?: number) {
  const [state, dispatch] = useReducer(paperReducer, undefined, () => saved ? restorePaperGame(saved, performance.now()) : initialPaperGame(generatePaperGeometry(settings, seed ?? newSeed())));
  const previous = useRef<PaperGameState | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const current = useRef(state); current.current = state;
  useEffect(() => {
    if (state.status !== 'playing') return;
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 200);
    return () => window.clearInterval(timer);
  }, [state.status]);
  const select = useCallback((id: number) => dispatch({ type: 'select', id }), []);
  const place = useCallback((id: number, point: Point) => dispatch({ type: 'place', id, point, now: performance.now() }), []);
  const reset = useCallback((fixedSeed?: number) => {
    previous.current = current.current; setCanUndo(true);
    dispatch({ type: 'reset', geometry: generatePaperGeometry(settings, fixedSeed ?? newSeed()) });
  }, [settings]);
  const undo = useCallback(() => { if (previous.current) { dispatch({ type: 'restore', state: previous.current, now: performance.now() }); previous.current = null; setCanUndo(false); } }, []);
  const hint = useCallback(() => dispatch({ type: 'hint' }), []);
  const assist = useCallback(() => dispatch({ type: 'assist', now: performance.now() }), []);
  const mark = useCallback(() => dispatch({ type: 'mark' }), []);
  const returnToTray = useCallback((id?: number) => dispatch({ type: 'return', id }), []);
  const deselect = useCallback(() => dispatch({ type: 'deselect' }), []);
  return { state, select, place, reset, undo, canUndo, hint, assist, mark, returnToTray, deselect };
}
