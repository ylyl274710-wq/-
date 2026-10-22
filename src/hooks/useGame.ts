import { useCallback, useEffect, useReducer } from 'react';
import { createTiles, isComplete, shuffle, swapTiles } from '../lib/imageEngine';
import type { GridSize, GameState, Tile } from '../types';

export type GameAction =
  | { type: 'select'; index: number; now: number }
  | { type: 'swap'; from: number; to: number; now: number }
  | { type: 'tick'; now: number }
  | { type: 'reset'; tiles: readonly Tile[] };

export function initialGame(size: GridSize): GameState {
  return { size, tiles: shuffle(createTiles(size)), selected: null, moves: 0,
    startedAt: null, elapsedMs: 0, status: 'ready' };
}

function exchange(state: GameState, from: number, to: number, now: number): GameState {
  if (state.status === 'completed' || from === to || !Number.isInteger(from) ||
      !Number.isInteger(to) || !state.tiles[from] || !state.tiles[to]) return state;
  const tiles = swapTiles(state.tiles, from, to);
  const startedAt = state.startedAt ?? now;
  return { ...state, tiles, selected: null, moves: state.moves + 1, startedAt,
    elapsedMs: Math.max(0, now - startedAt), status: isComplete(tiles) ? 'completed' : 'playing' };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'reset':
      return { ...state, tiles: action.tiles, selected: null, moves: 0,
        startedAt: null, elapsedMs: 0, status: 'ready' };
    case 'select':
      if (state.status === 'completed' || !state.tiles[action.index]) return state;
      if (state.selected === action.index) return { ...state, selected: null };
      if (state.selected === null) return { ...state, selected: action.index };
      return exchange(state, state.selected, action.index, action.now);
    case 'swap':
      return exchange(state, action.from, action.to, action.now);
    case 'tick':
      return state.status === 'playing' && state.startedAt !== null
        ? { ...state, elapsedMs: Math.max(0, action.now - state.startedAt) } : state;
  }
}

export function useGame(size: GridSize) {
  const [state, dispatch] = useReducer(gameReducer, size, initialGame);
  useEffect(() => {
    if (state.status !== 'playing') return;
    const timer = window.setInterval(() => dispatch({ type: 'tick', now: performance.now() }), 200);
    return () => window.clearInterval(timer);
  }, [state.status]);
  const select = useCallback((index: number) => dispatch({ type: 'select', index, now: performance.now() }), []);
  const swap = useCallback((from: number, to: number) => dispatch({ type: 'swap', from, to, now: performance.now() }), []);
  const reset = useCallback(() => dispatch({ type: 'reset', tiles: shuffle(createTiles(size)) }), [size]);
  return { state, select, swap, reset };
}
