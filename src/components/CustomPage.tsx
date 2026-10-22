import { useMemo } from 'react';
import type { PuzzleImage } from '../types';
import ImageUploader from './ImageUploader';
import Icon from './Icon';
import PuzzleSettings from './PuzzleSettings';
import { generatePaperGeometry } from '../lib/paperGeometry';
import type { PuzzleSettings as Settings } from '../lib/paperGeometry';
import type { SavedSession } from '../lib/studioTypes';
import { QUICK_PLAYS } from '../lib/experiences';

interface Props {
  image: PuzzleImage | null; settings: Settings; busy: boolean;
  onFile: (file: File) => void; onSample: () => void; onError: (text: string) => void;
  onSettings: (settings: Settings) => void; onStart: () => void;
  saved: SavedSession | null; storage: 'loading' | 'ready' | 'unavailable'; onResume: () => void; onClearSave: () => void;
  onCrop: () => void; onBack: () => void;
  onQuick: (id: string) => void;
}

export default function CustomPage(props: Props) {
  const geometry = useMemo(() => generatePaperGeometry(props.settings, 41873), [props.settings]);
  return <main className="custom-page"><div className="mode-breadcrumb"><button className="text-button nav-back-button" onClick={props.onBack}>← 返回首页</button><span>01 / 自定义拼图</span></div><div className="home-layout">
    <section className="home-copy">
      <p className="eyebrow"><span /> YOUR PHOTO, YOUR PUZZLE</p>
      <h1>自定义拼图，<br /><span className="serif-accent">每一片都由你。</span></h1>
      <p className="intro">选一张照片，画一个形状，决定想拼的片数。<br />让随机撕开的每一片，慢慢找到归处。</p>
      <div className="quick-play-row" aria-label="快捷试玩">{QUICK_PLAYS.map(q => <button key={q.id} disabled={props.busy} onClick={() => props.onQuick(q.id)}><span>{q.symbol}</span><strong>{q.title}</strong><small>{q.detail}</small></button>)}</div>
      <div className="setup-card">
        {props.saved && <div className="resume-card"><div><strong>上次的美好，还在这里。</strong><span>{props.saved.settings.pieceCount}片 · 已归位 {props.saved.state.placed.length}片 · {props.saved.context.title ?? props.saved.image.name}</span></div><button className="primary-button" onClick={props.onResume}>继续拼图 →</button><button className="text-button" onClick={props.onClearSave}>移除存档</button></div>}
        {props.storage === 'unavailable' && <p className="studio-muted" role="status">当前浏览器的本地保存不可用，请保留页面继续拼图。</p>}
        <div className="step-label"><span>01</span><h2>挑一张喜欢的照片</h2><span className="step-note">从这里开始</span></div>
        <ImageUploader busy={props.busy} image={props.image} onFile={props.onFile} onError={props.onError} />
        {props.image && <button className="crop-entry text-button" disabled={props.busy} onClick={props.onCrop}>调整照片构图 · 拖动与缩放 ↗</button>}
        <div className="sample-row"><span>{props.image ? <><Icon name="check" width="14" height="14" /> 图片已就绪</> : '还没有灵感？'}</span>
          <button className="text-button" disabled={props.busy} onClick={props.onSample}>试试示例图 <span>↗</span></button></div>
        <div className="step-label difficulty-label"><span>02</span><h2>定义你的拼图</h2></div>
        <PuzzleSettings value={props.settings} onChange={props.onSettings} onError={props.onError} />
      <section className="home-actions home-start-actions" aria-labelledby="home-start-title">
        <div className="step-label"><span>03</span><h2 id="home-start-title">开始你的拼图</h2><span className="step-note">{props.settings.pieceCount} 片 · {geometry.shapeLabel}轮廓</span></div>
        <button className="primary-button start-button" disabled={props.busy} onClick={props.onStart}>
          <span>{props.busy ? '正在准备拼图…' : '开始拼图'}</span><Icon name="arrow" /></button>
        {!props.image && <p className="start-hint">还没上传照片？点击开始，将使用示例图。</p>}
        <p className="local-note"><Icon name="lock" width="12" height="12" /> 图片仅在浏览器内处理，不会上传至服务器</p>
      </section>
      </div>
    </section>
    <div className="home-right-column">
    <section className="art-section" aria-label="所选图片预览">
      <div className="art-caption"><span>THE LITTLE JOY OF MAKING THINGS WHOLE.</span><span>NO. 001</span></div>
      <div className="art-frame">
        <svg viewBox="0 0 1000 1000" className="home-shape-preview" role="img" aria-label={`${geometry.shapeLabel}轮廓，${props.settings.pieceCount}片随机撕纸预览`}>
          <defs><clipPath id="home-outline"><path d={geometry.outlinePath} /></clipPath></defs>
          <g clipPath="url(#home-outline)"><image href={props.image?.url ?? `${import.meta.env.BASE_URL}sample.svg`} width="1000" height="1000" preserveAspectRatio="none" />
            {geometry.pieces.map(piece => <path key={piece.id} d={piece.path} fill="none" stroke="#fff9e4" strokeWidth="4" />)}</g>
        </svg>
        <span className="art-sticker"><Icon name="spark" width="17" height="17" /> 每一片，都不一样</span>
      </div>
      <div className="art-bottom"><span className="handwritten">Perfectly imperfect pieces.</span><span className="art-index">{props.settings.pieceCount} PIECES</span></div>
      <div className="how-it-works"><span><b>01</b> 定义形状</span><i /><span><b>02</b> 随机撕纸</span><i /><span><b>03</b> 拼回美好</span></div>
    </section>
    </div>
  </div></main>;
}
