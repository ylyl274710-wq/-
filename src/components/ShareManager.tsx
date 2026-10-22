import { useState } from 'react';
import { useManagedShares } from '../lib/shareRegistry';
import { revokePhotoLink } from '../lib/online';

export default function ShareManager({ onError }: { onError: (message: string) => void }) {
  const shares = useManagedShares(), [pending, setPending] = useState<string | null>(null), [message, setMessage] = useState('');
  async function revoke(id: string, owner: string) {
    setPending(id);
    try { await revokePhotoLink(id, owner); setMessage('分享已撤回，原链接已无法打开照片。'); }
    catch (error) { onError(error instanceof Error ? error.message : '撤回失败，请重试'); }
    finally { setPending(null); }
  }
  return <section className="creative-section managed-shares"><p className="eyebrow">YOUR PHOTOS, YOUR CHOICE</p><h2>我的分享</h2><p className="studio-muted">这里记录此浏览器创建的照片分享，刷新或离开后仍可撤回。管理凭据只保存在本机；换设备或清除浏览器数据后无法恢复。</p>
    {!shares.length && <div className="studio-empty"><span>✉</span><p>还没有可管理的分享。新建照片分享后，会自动记录在这里。</p></div>}
    {shares.map(share => { const expired = share.expiresAt <= Date.now(), inactive = !!share.revokedAt; const link = `${location.origin}${location.pathname}#share=${share.id}`; return <article className="managed-share-card" key={share.id}><div><strong>{share.title}</strong><span>{inactive ? '已撤回' : expired ? '已到期，可立即清理服务器照片' : `有效至 ${new Date(share.expiresAt).toLocaleString('zh-CN')}`}</span></div><div className="managed-share-actions"><button className="secondary-button" disabled={inactive || expired} onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage('分享链接已复制')).catch(() => onError('请使用制作页的链接手动复制'))}>复制链接</button><button className="secondary-button" disabled={inactive || pending !== null} onClick={() => void revoke(share.id, share.owner)}>{pending === share.id ? '正在撤回…' : inactive ? '已撤回' : expired ? '清理照片' : '撤回分享'}</button></div></article>; })}
    <p className="studio-muted" role="status">{message}</p>
  </section>;
}
