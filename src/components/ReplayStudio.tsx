import { useEffect, useRef, useState } from 'react';
import type { CollectionEntry } from '../lib/studioTypes';
import type { ReplayFrame } from '../lib/paperReducer';
import { downloadBlob } from '../lib/exchange';
import StudioDialog from './StudioDialog';

export default function ReplayStudio({ entry, onClose }: { entry: CollectionEntry; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null), picture = useRef<HTMLImageElement | null>(null), recorder = useRef<MediaRecorder | null>(null), animation = useRef(0), recordingTimer = useRef(0), active = useRef(true);
  const [ready, setReady] = useState(false), [playing, setPlaying] = useState(false), [position, setPosition] = useState(0), [recording, setRecording] = useState(false), [music, setMusic] = useState(true), [message, setMessage] = useState('');
  const raw = entry.state.history ?? [], frames: readonly ReplayFrame[] = raw.length > 1 ? raw : [{ t: 0, placed: [], loose: [], move: 0 }, { t: entry.state.elapsedMs, placed: entry.state.placed, loose: entry.state.loose, move: entry.state.moves }];
  const duration = Math.min(18000, Math.max(6000, frames.length * 160));
  useEffect(() => { let alive = true; active.current = true; const url = URL.createObjectURL(entry.image.blob), image = new Image(); image.src = url; void image.decode().then(() => { if (alive) { picture.current = image; setReady(true); setMessage(''); } }).catch(() => { if (alive) setMessage('图片暂时无法读取'); }); return () => { alive = false; active.current = false; URL.revokeObjectURL(url); cancelAnimationFrame(animation.current); window.clearInterval(recordingTimer.current); if (recorder.current?.state === 'recording') recorder.current.stop(); }; }, [entry]);
  function draw(progress: number) {
    const c = canvas.current?.getContext('2d'), image = picture.current; if (!c || !image) return;
    const frame = frames[Math.min(frames.length - 1, Math.floor(progress * (frames.length - 1)))]!, g = entry.state.geometry;
    c.fillStyle = '#f5f0e3'; c.fillRect(0, 0, 720, 900); c.fillStyle = '#849173'; c.font = '13px sans-serif'; c.fillText('PIECE BY PIECE · 一片片拼回来', 40, 45);
    c.save(); c.translate(30, 75); c.scale(.66, .66); c.fillStyle = '#e4e7d7'; c.fill(new Path2D(g.outlinePath));
    const drawPiece = (id: number, dx = 0, dy = 0) => { const p = g.pieces[id]; if (!p) return; c.save(); c.translate(dx, dy); c.clip(new Path2D(g.outlinePath)); c.clip(new Path2D(p.path)); c.drawImage(image, 0, 0, 1000, 1000); c.strokeStyle = '#fff7e5'; c.lineWidth = 2; c.stroke(new Path2D(p.path)); c.restore(); };
    frame.placed.forEach(id => drawPiece(id)); frame.loose.forEach(l => { const p = g.pieces[l.id]; if (p) drawPiece(l.id, l.point.x - p.anchor.x, l.point.y - p.anchor.y); });
    c.restore(); c.fillStyle = '#2e4a37'; c.font = '24px serif'; c.fillText(progress >= 1 ? '把这个片刻，拼了回来。' : '零散的美好，正在归位。', 40, 805); c.fillStyle = '#879375'; c.font = '14px sans-serif'; c.fillText(`${entry.settings.pieceCount}片 · ${frame.move}次放置 · ${Math.round(progress * 100)}%`, 40, 840); c.fillText((entry.options?.duo ? `${entry.options.duo[0]} & ${entry.options.duo[1]}` : entry.options?.gift?.from || entry.context.title || entry.image.name).slice(0, 44), 40, 870);
  }
  useEffect(() => { if (ready && !playing && !recording) draw(position); }, [ready, position, playing, recording]);
  useEffect(() => { if (!playing) return; const start = performance.now() - position * duration; const step = (time: number) => { const p = Math.min(1, (time - start) / duration); draw(p); setPosition(p); if (p < 1) animation.current = requestAnimationFrame(step); else setPlaying(false); }; animation.current = requestAnimationFrame(step); return () => cancelAnimationFrame(animation.current); }, [playing]);
  async function exportVideo() {
    if (!canvas.current || !ready || recording) return;
    if (!('MediaRecorder' in window) || !canvas.current.captureStream) { setMessage('当前浏览器暂不支持录制，请用最新版 Chrome 或 Edge；仍可观看回放。'); return; }
    const mime = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mime) { setMessage('当前浏览器没有可用的视频编码器'); return; }
    setPlaying(false); setRecording(true); setPosition(0); setMessage('正在本地录制，请保持此窗口打开。');
    const stream = canvas.current.captureStream(30), chunks: Blob[] = []; let audio: AudioContext | null = null; const tones: OscillatorNode[] = [];
    try {
      if (music) { audio = new AudioContext(); void audio.resume().catch(() => {}); const dest = audio.createMediaStreamDestination(), gain = audio.createGain(); gain.gain.value = .025; gain.connect(dest); [261.63, 329.63, 392].forEach(hz => { const o = audio!.createOscillator(); o.type = 'sine'; o.frequency.value = hz; o.connect(gain); o.start(); tones.push(o); }); dest.stream.getAudioTracks().forEach(track => stream.addTrack(track)); }
      const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2200000 }); recorder.current = rec;
      rec.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      rec.onstop = () => { stream.getTracks().forEach(t => t.stop()); tones.forEach(t => t.stop()); void audio?.close(); if (!active.current) return; setRecording(false); if (chunks.length) { downloadBlob(new Blob(chunks, { type: mime }), `片刻拼图-过程回放.${mime.includes('mp4') ? 'mp4' : 'webm'}`); setMessage('回放视频已生成。'); } };
      rec.start(250); const start = performance.now(); recordingTimer.current = window.setInterval(() => { const p = Math.min(1, (performance.now() - start) / duration); draw(p); setPosition(p); if (p >= 1 || rec.state !== 'recording') { window.clearInterval(recordingTimer.current); if (rec.state === 'recording') window.setTimeout(() => { if (rec.state === 'recording') rec.stop(); }, 700); } }, 33);
    } catch { stream.getTracks().forEach(t => t.stop()); tones.forEach(t => t.stop()); void audio?.close(); setRecording(false); setMessage('录制未能开始，仍可观看回放或下载纪念卡。'); }
  }
  return <StudioDialog title="把这个过程，留成一段小电影" onClose={onClose} wide><canvas className="replay-canvas" ref={canvas} width="720" height="900" aria-label="拼图过程回放" /><p className="studio-muted">{raw.length > 1 ? '记录了暂放、收回和归位的真实过程。' : '这份旧作品没有逐步记录，播放起点与成品的简短回放。'}</p><input className="replay-range" type="range" aria-label="回放进度" min="0" max="1" step=".001" value={position} disabled={recording} onChange={e => { setPlaying(false); setPosition(Number(e.target.value)); }} /><label className="creative-check"><input type="checkbox" checked={music} onChange={e => setMusic(e.target.checked)} disabled={recording} />视频配上轻柔和弦</label><div className="studio-dialog-actions"><button className="secondary-button" disabled={!ready || recording} onClick={() => { if (position >= 1) setPosition(0); setPlaying(p => !p); }}>{playing ? '暂停' : '播放回放'}</button><button className="primary-button" disabled={!ready || recording} onClick={() => void exportVideo()}>{recording ? '正在录制…' : '导出短视频'}</button></div><p role="status" className="studio-muted">{message}</p></StudioDialog>;
}
