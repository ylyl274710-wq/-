import { useEffect, useReducer, useRef } from 'react';
import { centeredPhoto, initialComposition, normalizePosition, readMemoryPhoto } from '../lib/memoryCollage';
import type { MemoryComposition, MemoryPhoto, PhotoPosition, PhotoSlot } from '../lib/memoryCollage';

export interface MemoryComposerState { photos: readonly [MemoryPhoto | null, MemoryPhoto | null]; loading: readonly [boolean, boolean]; active: PhotoSlot; composition: MemoryComposition; pieces: number }
type Action = { type: 'loading'; slot: PhotoSlot; loading: boolean } | { type: 'photo'; slot: PhotoSlot; photo: MemoryPhoto }
  | { type: 'active'; slot: PhotoSlot } | { type: 'position'; slot: PhotoSlot; position: PhotoPosition }
  | { type: 'composition'; patch: Partial<Omit<MemoryComposition, 'positions'>> } | { type: 'swap' } | { type: 'pieces'; count: number };
export const initialMemoryComposer = (): MemoryComposerState => ({ photos: [null, null], loading: [false, false], active: 0, composition: initialComposition(), pieces: 16 });
export function memoryComposerReducer(state: MemoryComposerState, action: Action): MemoryComposerState {
  if (action.type === 'loading') { const loading: [boolean, boolean] = [...state.loading]; loading[action.slot] = action.loading; return { ...state, loading }; }
  if (action.type === 'photo') { const photos: [MemoryPhoto | null, MemoryPhoto | null] = [...state.photos], positions: [PhotoPosition, PhotoPosition] = [...state.composition.positions]; photos[action.slot] = action.photo; positions[action.slot] = centeredPhoto(); return { ...state, photos, composition: { ...state.composition, positions }, active: action.slot }; }
  if (action.type === 'active') return { ...state, active: action.slot };
  if (action.type === 'position') { const positions: [PhotoPosition, PhotoPosition] = [...state.composition.positions]; positions[action.slot] = normalizePosition(action.position); return { ...state, composition: { ...state.composition, positions } }; }
  if (action.type === 'composition') return { ...state, composition: { ...state.composition, ...action.patch } };
  if (action.type === 'swap') return { ...state, photos: [state.photos[1], state.photos[0]], composition: { ...state.composition, positions: [state.composition.positions[1], state.composition.positions[0]] } };
  return Number.isInteger(action.count) && action.count >= 4 && action.count <= 100 ? { ...state, pieces: action.count } : state;
}

export function useMemoryComposer(onError: (message: string) => void) {
  const [state, dispatch] = useReducer(memoryComposerReducer, undefined, initialMemoryComposer);
  const resources = useRef<[MemoryPhoto | null, MemoryPhoto | null]>([null, null]), requests = useRef<[number, number]>([0, 0]), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; requests.current = [requests.current[0] + 1, requests.current[1] + 1]; resources.current.forEach(photo => { if (photo) URL.revokeObjectURL(photo.url); }); resources.current = [null, null]; }; }, []);
  async function upload(slot: PhotoSlot, file: File) {
    const token = ++requests.current[slot]; dispatch({ type: 'loading', slot, loading: true });
    try {
      const photo = await readMemoryPhoto(file);
      if (!alive.current || requests.current[slot] !== token) { URL.revokeObjectURL(photo.url); return; }
      const old = resources.current[slot]; resources.current[slot] = photo; if (old) URL.revokeObjectURL(old.url);
      dispatch({ type: 'photo', slot, photo });
      if (Math.min(photo.width, photo.height) < 300) onError('这张照片较小，仍可使用；换一张更清晰的照片效果会更好。');
    } catch (error) { if (alive.current && requests.current[slot] === token) onError(error instanceof Error ? error.message : '照片没有读取成功'); }
    finally { if (alive.current && requests.current[slot] === token) dispatch({ type: 'loading', slot, loading: false }); }
  }
  function swap() { if (state.loading.some(Boolean)) return; resources.current = [resources.current[1], resources.current[0]]; dispatch({ type: 'swap' }); }
  return { state, dispatch, upload, swap };
}
