const PREFIX = 'paper-room-identity-';
const validToken = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{36}$/.test(value);

export function rememberRoom(id: string, token: string, expiresAt = Date.now() + 86400000): boolean {
  if (!/^[a-f0-9]{36}$/.test(id) || !validToken(token)) return false;
  let persistent = false;
  try { localStorage.setItem(PREFIX + id, JSON.stringify({ token, expiresAt })); persistent = true; } catch { /* 私密模式下仍尝试会话内恢复。 */ }
  try { sessionStorage.setItem(`paper-room-${id}`, token); } catch { /* 不影响当前已加入的房间。 */ }
  return persistent;
}

export function roomToken(id: string): string | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PREFIX + id) ?? 'null');
    if (value && typeof value === 'object' && 'token' in value && 'expiresAt' in value && validToken(value.token) && typeof value.expiresAt === 'number') {
      if (value.expiresAt > Date.now()) return value.token;
      localStorage.removeItem(PREFIX + id);
      try { sessionStorage.removeItem(`paper-room-${id}`); } catch { /* 已失效。 */ }
      return null;
    }
  } catch { /* 兼容旧版会话凭据及禁止持久存储的浏览器。 */ }
  try {
    const legacy = sessionStorage.getItem(`paper-room-${id}`);
    if (validToken(legacy)) { rememberRoom(id, legacy); return legacy; }
  } catch { /* 无凭据时正常走邀请加入。 */ }
  return null;
}
