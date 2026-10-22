import { useState } from 'react';
import { polygonPath } from '../lib/paperGeometry';
import type { Point } from '../lib/paperGeometry';
import ShapeDrawingModal from './ShapeDrawingModal';

interface Props { points: readonly Point[]; onChange: (points: readonly Point[]) => void; onError: (text: string) => void }

export default function ShapeEditor({ points, onChange }: Props) {
  const [mode, setMode] = useState<'draw' | 'points' | null>(null);
  return <div className="shape-editor">
    <button type="button" className="shape-preview-button" aria-label="放大画布，编辑手绘轮廓" onClick={() => setMode('draw')}>
      <svg viewBox="0 0 1000 1000" aria-hidden="true">
        <path d={polygonPath(points)} fill="#dbe4ca" stroke="#71845d" strokeWidth="9" strokeLinejoin="round" />
      </svg><span>点击放大绘画 ↗</span>
    </button>
    <div><strong>画出你自己的形状</strong><p>打开大画布，自由画出外轮廓。<br />松开自动闭合，确认后保存。</p>
      <div className="drawing-mode"><button type="button" onClick={() => setMode('draw')}>自由绘制 ↗</button>
        <button type="button" onClick={() => setMode('points')}>点按描点 ↗</button></div>
      <span>支持鼠标和触屏 · 可重画、撤销</span></div>
    {mode && <ShapeDrawingModal points={points} initialMode={mode} onClose={() => setMode(null)}
      onSave={outline => { onChange(outline); setMode(null); }} />}
  </div>;
}
