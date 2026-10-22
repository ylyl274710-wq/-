import { difficultyLabel } from '../lib/difficulty';
import { useEffect, useState } from 'react';
import type { CollectionEntry } from '../lib/studioTypes';
import { exportMemoryCard } from '../lib/memoryCard';
import { formatTime } from '../lib/format';
import StudioDialog from './StudioDialog';
import ReplayStudio from './ReplayStudio';
import MomentStudio from './MomentStudio';

function usePhoto(blob?: Blob) {
  const [url, setUrl] = useState('');
  useEffect(() => { if (!blob) { setUrl(''); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  return url;
}
function Photo({ entry }: { entry: CollectionEntry }) {
  const url = usePhoto(entry.image.blob);
  return <img src={url || undefined} loading="lazy" decoding="async" alt={entry.context.title ?? entry.image.name} style={{ clipPath: `polygon(${entry.state.geometry.outline.map(p => `${p.x / 10}% ${p.y / 10}%`).join(',')})` }} />;
}
export default function CollectionPage({ entries, onReplay, onUpdate, onBack, onError }: { entries: readonly CollectionEntry[]; onReplay: (entry: CollectionEntry) => void; onUpdate: (entry: CollectionEntry) => void; onBack: () => void; onError: (text: string) => void }) {
  const [trash, setTrash] = useState(false), [selected, setSelected] = useState<CollectionEntry | null>(null), [busy, setBusy] = useState(false);
  const [replay, setReplay] = useState<CollectionEntry | null>(null);
  const [moment, setMoment] = useState<CollectionEntry | null>(null);
  const shown = entries.filter(e => Boolean(e.trashed) === trash);
  async function download(entry: CollectionEntry) { setBusy(true); try { await exportMemoryCard(entry); } catch { onError('纪念卡生成失败，请重试'); } finally { setBusy(false); } }
  return <main className="studio-page"><button className="text-button nav-back-button" onClick={onBack}>← 返回首页</button><div className="studio-page-heading"><p className="eyebrow">EVERY LITTLE FINISH DESERVES A PLACE</p><h1>你的拼图收藏墙。</h1><p>每一次专注，都留下一张完整的美好。照片和记录只在这个浏览器里。</p></div>
    <div className="collection-filter"><button aria-pressed={!trash} onClick={() => setTrash(false)}>我的作品 · {entries.filter(e => !e.trashed).length}</button><button aria-pressed={trash} onClick={() => setTrash(true)}>回收站 · {entries.filter(e => e.trashed).length}</button></div>
    {!shown.length ? <div className="studio-empty"><span>✳</span><h2>{trash ? '回收站是空的。' : '第一张收藏，等你完成。'}</h2><p>完成任意拼图后，它会自动来到这里。</p><button className="primary-button" onClick={onBack}>去拼一幅</button></div> : <div className="memory-grid">{shown.map(entry => <article className="memory-card" key={entry.id}><button className="memory-photo" onClick={() => setSelected(entry)} aria-label={`查看作品：${entry.context.title ?? entry.image.name}`}><Photo entry={entry} /></button><div><span>{new Date(entry.completedAt).toLocaleDateString('zh-CN')} · {entry.settings.pieceCount} 片</span><h3>{entry.context.title ?? entry.image.name}</h3><p>{formatTime(entry.state.elapsedMs)} · {entry.score} 分 · 提示 {entry.state.hintsUsed} 次</p><button className="text-button" onClick={() => setSelected(entry)}>欣赏与纪念卡 ↗</button></div></article>)}</div>}
    {selected && <StudioDialog title="一份已经拼好的美好" onClose={() => setSelected(null)}><div className="memory-detail-photo"><Photo entry={selected} /></div><h3>{selected.context.title ?? selected.image.name}</h3><p className="studio-muted">{selected.settings.pieceCount} 片 · {selected.state.geometry.shapeLabel} · {difficultyLabel(selected)} · {selected.score} 分</p><p className="studio-muted">{formatTime(selected.state.elapsedMs)} · {selected.state.moves} 次放置 · 提示 {selected.state.hintsUsed} 次</p><div className="studio-dialog-actions"><button className="primary-button" onClick={() => { setMoment(selected); setSelected(null); }}>制作分享卡</button><button className="secondary-button" onClick={() => onReplay(selected)}>再次挑战</button><button className="secondary-button" onClick={() => { setReplay(selected); setSelected(null); }}>过程回放 / 短视频</button><button className="primary-button" disabled={busy} onClick={() => void download(selected)}>{busy ? '生成中…' : '下载纪念卡'}</button></div><button className="text-button memory-trash" onClick={() => { onUpdate({ ...selected, trashed: !selected.trashed }); setSelected(null); }}>{selected.trashed ? '恢复到收藏墙' : '移入回收站（可恢复）'}</button></StudioDialog>}
    {replay && <ReplayStudio entry={replay} onClose={() => setReplay(null)} />}
    {moment && <MomentStudio entry={moment} onClose={() => { setSelected(moment); setMoment(null); }} />}
  </main>;
}
