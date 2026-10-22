export const PERSONAL_ONLY = import.meta.env?.VITE_PERSONAL_ONLY === 'true';

/** 个人体验部署不打开依赖服务器的入口，也不请求旧的云端邀请。 */
export function isCloudHash(hash: string): boolean {
  return /^#(?:together|gift)$/.test(hash) || /^#(?:room|share)=/.test(hash);
}
