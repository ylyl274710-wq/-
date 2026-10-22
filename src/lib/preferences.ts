import { useSyncExternalStore } from 'react';

export interface Preferences { theme: 'day' | 'night'; musicVolume: number; ambientVolume: number; effectVolume: number; ambience: 'off' | 'rain' | 'fire' | 'sea'; animation: 'every' | 'first' | 'off' }
const defaults: Preferences = { theme: 'day', musicVolume: 30, ambientVolume: 35, effectVolume: 50, ambience: 'off', animation: 'every' };
const listeners = new Set<() => void>();
function load(): Preferences {
  try {
    const p = JSON.parse(localStorage.getItem('puzzle-studio-preferences') ?? '{}') as Partial<Preferences>;
    const volume = (n: unknown, fallback: number) => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
    return { theme: p.theme === 'night' ? 'night' : 'day', musicVolume: volume(p.musicVolume, defaults.musicVolume), ambientVolume: volume(p.ambientVolume, defaults.ambientVolume), effectVolume: volume(p.effectVolume, defaults.effectVolume), ambience: ['rain', 'fire', 'sea'].includes(p.ambience ?? '') ? p.ambience! : 'off', animation: ['every', 'first', 'off'].includes(p.animation ?? '') ? p.animation! : defaults.animation };
  } catch { return defaults; }
}
let current = load();
export function getPreferences() { return current; }
export function updatePreferences(next: Partial<Preferences>) {
  current = { ...current, ...next };
  try { localStorage.setItem('puzzle-studio-preferences', JSON.stringify(current)); } catch { /* 会话内设置仍可使用。 */ }
  document.documentElement.dataset.theme = current.theme;
  listeners.forEach(listener => listener());
}
export function usePreferences() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => current); }
export function shouldPlayShredder(): boolean {
  if (current.animation === 'off') return false;
  try {
    const seen = localStorage.getItem('puzzle-shredder-seen') === 'yes';
    localStorage.setItem('puzzle-shredder-seen', 'yes');
    return current.animation === 'every' || !seen;
  } catch { return true; }
}
