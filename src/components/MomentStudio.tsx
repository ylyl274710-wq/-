import { useEffect, useState } from 'react';
import type { CollectionEntry } from '../lib/studioTypes';
import { createMomentCard, momentCaption } from '../lib/momentCard';
import type { MomentCardOptions } from '../lib/momentCard';
import { downloadBlob } from '../lib/exchange';
import { dateKey } from '../lib/catalog';
import StudioDialog from './StudioDialog';

export default function MomentStudio({ entry, onClose }: { entry: CollectionEntry; onClose: () => void }) {
  const [options, setOptions] = useState<MomentCardOptions>({ title: entry.context.memory ? entry.context.title ?? '两张照片，一段回忆' : entry.options?.gift && !entry.options.weekly ? entry.options.gift.title : '把零散，拼回喜欢的样子。', caption: momentCaption(entry), palette: 'cream' });
  const [blob, setBlob] = useState<Blob | null>(null), [url, setUrl] = useState(''), [message, setMessage] = useState(''), [generating, setGenerating] = useState(true), [sharing, setSharing] = useState(false);
  useEffect(() => {
    let active = true; setGenerating(true);
    const timer = window.setTimeout(() => { void createMomentCard(entry, options).then(result => { if (active) { setBlob(result); setGenerating(false); setMessage(''); } }).catch(() => { if (active) { setBlob(null); setGenerating(false); setMessage('分享卡没有生成，请换一种配色再试一次。'); } }); }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [entry, options]);
  useEffect(() => { if (!blob) { setUrl(''); return; } const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next); }, [blob]);
  const filename = `我的纸片时光-${dateKey(new Date(entry.completedAt))}.png`;
  const publicHome = ['localhost', '127.0.0.1'].includes(location.hostname) ? '' : `${location.origin}${location.pathname}`;
  const caption = `${options.caption}${publicHome ? `\n${publicHome}` : ''}`;
  let canShare = false;
  try { canShare = !!blob && !!navigator.canShare?.({ files: [new File([blob], filename, { type: 'image/png' })] }); } catch { /* 不支持文件分享时仍能下载。 */ }
  async function share() {
    if (!blob || generating || sharing) return;
    setSharing(true);
    try { await navigator.share({ files: [new File([blob], filename, { type: 'image/png' })], title: '我的纸片时光', text: caption }); setMessage('已交给系统分享。'); }
    catch (error) { setMessage(error instanceof DOMException && error.name === 'AbortError' ? '已取消分享，卡片仍可下载。' : '系统分享没有完成，可以先下载卡片。'); }
    finally { setSharing(false); }
  }
  return <StudioDialog title="把这一刻，留成一张卡片" onClose={onClose} wide><div className="moment-layout"><div className="moment-preview" aria-busy={generating}>{url && <img src={url} alt="即将下载或分享的卡片预览" />}{generating && <span role="status">正在铺好纸张…</span>}</div><section className="moment-settings"><p className="eyebrow">A SMALL FINISH WORTH KEEPING</p><h3>今天的小小完成，也值得被看见。</h3><label className="creative-label">卡片标题<input aria-label="分享卡标题" maxLength={80} value={options.title} onChange={e => setOptions({ ...options, title: e.target.value })} /></label><label className="creative-label">给这一刻留句话<textarea aria-label="分享配文" rows={3} maxLength={160} value={options.caption} onChange={e => setOptions({ ...options, caption: e.target.value })} /></label><div className="moment-palettes" aria-label="分享卡配色">{([['cream', '暖纸'], ['forest', '山野'], ['rose', '落日']] as const).map(([palette, label]) => <button aria-pressed={options.palette === palette} key={palette} onClick={() => setOptions({ ...options, palette })}><i className={`palette-${palette}`} />{label}</button>)}</div><p className="gift-subtle">只展示照片、标题与配文。私人留言和成绩不会自动放进卡片。</p><div className="moment-actions"><button className="primary-button" disabled={!blob || generating || sharing} onClick={() => { if (blob) downloadBlob(blob, filename); }}>下载分享卡</button>{canShare && <button className="secondary-button" disabled={generating || sharing} onClick={() => void share()}>{sharing ? '正在分享…' : '系统分享'}</button>}<button className="secondary-button" onClick={() => void navigator.clipboard.writeText(caption).then(() => setMessage('配文已复制。')).catch(() => setMessage('浏览器没有允许复制，可从输入框手动复制配文。'))}>复制配文</button></div><p className="gift-status" role="status">{message}</p></section></div></StudioDialog>;
}
