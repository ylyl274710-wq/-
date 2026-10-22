import { useEffect, useSyncExternalStore } from 'react';

export interface ManagedShare { id: string; owner: string; title: string; createdAt: number; expiresAt: number; revokedAt?: number }
const PREFIX = 'paper-managed-share-';
const listeners = new Set<() => void>();
const ephemeral = new Map<string, ManagedShare>();
function read(): ManagedShare[] {
  const entries: ManagedShare[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i); if (!key?.startsWith(PREFIX)) continue;
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? 'null') as ManagedShare | null;
        if (s && /^[a-f0-9]{36}$/.test(s.id) && /^[a-f0-9]{36}$/.test(s.owner) && typeof s.title === 'string' && Number.isFinite(s.createdAt) && Number.isFinite(s.expiresAt)) entries.push(s);
      } catch { /* 单条损坏记录不影响其他分享。 */ }
    }
  } catch { /* 无存储权限时显示当前会话的记录。 */ }
  return entries.sort((a, b) => b.createdAt - a.createdAt);
}
let snapshot = read();
function publish() { listeners.forEach(fn => fn()); }
export function rememberShare(share: ManagedShare): boolean {
  let persisted = false;
  try { localStorage.setItem(PREFIX + share.id, JSON.stringify(share)); persisted = true; ephemeral.delete(share.id); } catch { ephemeral.set(share.id, share); }
  snapshot = [share, ...snapshot.filter(s => s.id !== share.id)].sort((a, b) => b.createdAt - a.createdAt); publish();
  return persisted;
}
export function markShareRevoked(id: string) {
  const share = snapshot.find(s => s.id === id); if (share) rememberShare({ ...share, revokedAt: Date.now() });
}
export function managedShares() { return snapshot; }
export function refreshManagedShares() { snapshot = [...read().filter(s => !ephemeral.has(s.id)), ...ephemeral.values()].sort((a, b) => b.createdAt - a.createdAt); publish(); }
export function useManagedShares() {
  useEffect(() => { refreshManagedShares(); }, []);
  return useSyncExternalStore(fn => {
    listeners.add(fn);
    const changed = (event: StorageEvent) => { if (!event.key || event.key.startsWith(PREFIX)) refreshManagedShares(); };
    window.addEventListener('storage', changed);
    return () => { listeners.delete(fn); window.removeEventListener('storage', changed); };
  }, () => snapshot);
}
