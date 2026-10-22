import type { PuzzleParcel } from './exchange';
import type { RoomWelcome } from './onlineTypes';
import { rememberRoom, roomToken } from './roomIdentity';
import { rememberShare, markShareRevoked } from './shareRegistry';
import { ApiError, requestJson } from './request';
import { apiEndpoint } from './apiEndpoint';
import { PERSONAL_ONLY } from './siteMode';
export function api<T>(path: string, value?: unknown, signal?: AbortSignal): Promise<T> {
  if (PERSONAL_ONLY) return Promise.reject(new ApiError('个人体验版暂未开放联机与照片链接，请使用单人拼图。', 503));
  return requestJson<T>(apiEndpoint(`/api${path}`), value, { signal });
}
export async function createPhotoLink(parcel: PuzzleParcel) {
  const result = await api<{ id: string; expiresAt: number; owner: string }>('/shares', { parcel });
  const managementSaved = rememberShare({ ...result, title: parcel.session.options?.gift?.title || parcel.session.context.title || '我的拼图分享', createdAt: Date.now() });
  return { ...result, managementSaved };
}
export async function revokePhotoLink(id: string, owner: string) {
  try { await api(`/shares/${id}/revoke`, { owner }); }
  catch (error) {
    // 文件已被撤回或清理时，同样可以把本地管理记录标为不可访问。
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
  }
  markShareRevoked(id);
}
export async function createRoom(parcel: PuzzleParcel, name: string) {
  const room = await api<RoomWelcome>('/rooms', { parcel, name });
  rememberRoom(room.id, room.token, room.expiresAt); return room;
}
export async function joinRoom(id: string, name: string) {
  const token = roomToken(id), room = await api<RoomWelcome>(`/rooms/${encodeURIComponent(id)}/join`, { name, token });
  rememberRoom(id, room.token, room.expiresAt); return room;
}
