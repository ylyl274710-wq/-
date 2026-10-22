import type { Tile } from '../types';
import { memo } from 'react';

export function tileBackground(correctIndex: number, size: number, url: string) {
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: `${size * 100}% ${size * 100}%`,
    backgroundPosition: `${(correctIndex % size) / (size - 1) * 100}% ${Math.floor(correctIndex / size) / (size - 1) * 100}%`
  };
}

interface Props {
  tile: Tile; index: number; size: number; url: string;
  selected: boolean; dragging: boolean; target: boolean; disabled: boolean;
  onKeyboardSelect: (index: number) => void;
}

export default memo(function PuzzleTile(props: Props) {
  return <button type="button" className={`puzzle-tile ${props.selected ? 'is-selected' : ''} ${props.dragging ? 'is-dragging' : ''} ${props.target ? 'is-target' : ''}`}
    style={tileBackground(props.tile.correctIndex, props.size, props.url)}
    data-position={props.index} data-correct={props.tile.correctIndex}
    aria-label={`位置 ${props.index + 1}，拼块 ${props.tile.correctIndex + 1}`}
    aria-pressed={props.selected} disabled={props.disabled}
    onClick={event => { if (event.detail === 0) props.onKeyboardSelect(props.index); }}>
    <span className="tile-marker" aria-hidden="true">{props.selected ? '✓' : ''}</span>
  </button>;
});
