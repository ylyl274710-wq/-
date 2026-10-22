import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PuzzleImage } from '../types';
import Icon from './Icon';
import { playShredderSound } from '../lib/shredderSound';
import type { ShredderSound } from '../lib/shredderSound';
import { usePreferences } from '../lib/preferences';
import '../styles/shredder.css';

interface Props { image: PuzzleImage; pieceCount: number; onComplete: () => void }

export default function ImageShredder({ image, pieceCount, onComplete }: Props) {
  const [phase, setPhase] = useState(0);
  const [muted, setMuted] = useState(false);
  const sound = useRef<ShredderSound | null>(null);
  const prefs = usePreferences();
  useEffect(() => { sound.current?.setVolume(prefs.effectVolume); }, [prefs.effectVolume]);
  const done = useRef(false);
  const onDone = useRef(onComplete);
  useEffect(() => { onDone.current = onComplete; }, [onComplete]);
  function finish() {
    if (done.current) return;
    done.current = true; sound.current?.stop(); onDone.current();
  }
  useEffect(() => {
    done.current = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) sound.current = playShredderSound();
    const timers = reduced ? [window.setTimeout(finish, 450)] : [
      window.setTimeout(() => setPhase(1), 1400),
      window.setTimeout(() => setPhase(2), 2800),
      window.setTimeout(finish, 3600)
    ];
    return () => { timers.forEach(timer => window.clearTimeout(timer)); sound.current?.stop(); sound.current = null; };
  }, []);
  const fragments = Math.min(32, Math.max(16, pieceCount));
  return <main className="shredder-page" aria-labelledby="shredder-title">
    <div className="shredder-actions"><button type="button" className="shredder-sound text-button" aria-label={muted ? '开启粉碎音效' : '关闭粉碎音效'} aria-pressed={!muted}
      onClick={() => { const next = !muted; setMuted(next); sound.current?.setMuted(next); }}><Icon name={muted ? 'muted' : 'volume'} width="15" height="15" /><span>{muted ? '音效已关' : '音效已开'}</span></button>
    <button type="button" className="shredder-skip text-button" onClick={finish}>跳过动画 <Icon name="arrow" width="15" height="15" /></button></div>
    <div className="shredder-heading"><p className="eyebrow">A LITTLE MAGIC BEFORE THE PUZZLE</p>
      <h1 id="shredder-title">先碎成小片，再拼回美好。</h1><p>你的照片，正在变成一场小小的挑战。</p></div>
    <div className="shredder-scene" aria-hidden="true">
      <div className="shredder-orbit orbit-one" /><div className="shredder-orbit orbit-two" />
      <span className="shredder-spark spark-one">✳</span><span className="shredder-spark spark-two">✦</span>
      <div className="shredder-feed-window"><div className="shredder-photo"><img src={image.url} alt="" /><span>ONE LITTLE MEMORY</span></div></div>
      <div className="shredder-fragments">{Array.from({ length: fragments }, (_, index) => {
        const column = index % 7, row = Math.floor(index / 7);
        return <span key={index} className="shredder-fragment" style={{
          backgroundImage: `url("${image.url}")`, backgroundPosition: `${column / 6 * 100}% ${row / Math.max(1, Math.ceil(fragments / 7) - 1) * 100}%`,
          clipPath: index % 2 ? 'polygon(8% 5%,78% 0,100% 45%,85% 100%,15% 83%,0 35%)' : 'polygon(20% 0,100% 18%,86% 80%,45% 100%,0 65%,6% 20%)',
          '--chip-x': `${(column - 3) * 31}px`, '--chip-drift': `${((index * 37) % 80) - 40}px`,
          '--chip-turn': `${(index % 2 ? 1 : -1) * (95 + index * 13)}deg`, '--chip-delay': `${1.35 + index * .03}s`,
          '--chip-size': `${24 + index % 4 * 5}px`
        } as CSSProperties} />;
      })}</div>
      <div className="shredder-machine">
        <div className="shredder-mouth"><i /></div>
        <div className="shredder-machine-label"><span className="shredder-brand-mark">✳</span><span>片刻碎纸所<small>THE LITTLE PAPER STUDIO</small></span><i className="shredder-power" /></div>
        <div className="shredder-roller-window">{Array.from({ length: 8 }, (_, index) => <i className="shredder-roller" key={index} />)}</div>
        <div className="shredder-output" />
        <div className="shredder-leg leg-left" /><div className="shredder-leg leg-right" />
      </div>
      <div className="shredder-floor" />
    </div>
    <div className="shredder-status" role="status" aria-live="polite"><span className="shredder-status-dot" />
      {phase === 0 ? '照片已就位，准备送入…' : phase === 1 ? `咔嚓咔嚓，正在准备 ${pieceCount} 片美好…` : `${pieceCount} 片纸片准备好了，出发！`}</div>
    <div className="shredder-progress" role="progressbar" aria-label="拼图准备进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={phase === 0 ? 10 : phase === 1 ? 60 : 100}><span /></div>
    <p className="shredder-caption">{image.name}<span>仅在浏览器中准备 · 原照片不会改变</span></p>
  </main>;
}
