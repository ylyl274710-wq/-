import { useState } from 'react';
import { MAX_PIECES, MIN_PIECES, SHAPES } from '../lib/paperGeometry';
import type { PuzzleSettings as Settings } from '../lib/paperGeometry';
import ShapeEditor from './ShapeEditor';

interface Props { value: Settings; onChange: (value: Settings) => void; onError: (text: string) => void }

export default function PuzzleSettings({ value, onChange, onError }: Props) {
  const [draft, setDraft] = useState(String(value.pieceCount));
  return <div className="paper-settings">
    <div className="piece-count-label"><label htmlFor="piece-count">想拼成几片？</label><span>每局随机撕纸分割</span></div>
    <div className="piece-count-row">
      <div className="count-presets">{[9, 16, 25, 36, 64].map(count => <button key={count} type="button" aria-pressed={value.pieceCount === count}
        className={value.pieceCount === count ? 'active' : ''} onClick={() => { setDraft(String(count)); onChange({ ...value, pieceCount: count }); }}>{count}</button>)}</div>
      <label className="count-input"><input id="piece-count" type="number" min={MIN_PIECES} max={MAX_PIECES} step="1" value={draft} inputMode="numeric"
        onChange={event => {
          setDraft(event.target.value);
          const count = Number(event.target.value);
          if (Number.isInteger(count) && count >= MIN_PIECES && count <= MAX_PIECES) onChange({ ...value, pieceCount: count });
        }}
        onBlur={() => {
          const parsed = Number(draft);
          if (!Number.isInteger(parsed) || parsed < MIN_PIECES || parsed > MAX_PIECES) {
            onError(`请输入 ${MIN_PIECES}–${MAX_PIECES} 之间的整数`); setDraft(String(value.pieceCount));
          }
        }} /><span>片</span></label>
    </div>
    <p className="count-help">支持 {MIN_PIECES}–{MAX_PIECES} 片任意整数，不限平方数。</p>
    <div className="piece-count-label outline-label"><span>拼好后的外轮廓</span><span>碎片形状始终随机</span></div>
    <div className="shape-options" role="group" aria-label="完成形状">{SHAPES.map(shape => <button key={shape.id} type="button"
      aria-pressed={value.shape === shape.id} className={value.shape === shape.id ? 'active' : ''}
      onClick={() => onChange({ ...value, shape: shape.id })}><span aria-hidden="true">{shape.symbol}</span>{shape.label}</button>)}</div>
    {value.shape === 'custom' && <ShapeEditor points={value.customOutline} onError={onError} onChange={points => onChange({ ...value, customOutline: points })} />}
  </div>;
}
