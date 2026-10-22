import { useRef, useState } from 'react';
import Icon from './Icon';
import type { PuzzleImage } from '../types';

interface Props { busy: boolean; image: PuzzleImage | null; onFile: (file: File) => void; onError: (message: string) => void }

export default function ImageUploader({ busy, image, onFile, onError }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [over, setOver] = useState(false);
  return <div className={`image-picker ${over ? 'is-over' : ''}`}
    onDragEnter={event => { event.preventDefault(); depth.current++; setOver(true); }}
    onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
    onDragLeave={event => { event.preventDefault(); depth.current--; if (depth.current <= 0) setOver(false); }}
    onDrop={event => {
      event.preventDefault(); depth.current = 0; setOver(false);
      if (busy) return;
      if (event.dataTransfer.files.length !== 1) { onError('请一次选择一张图片'); return; }
      const file = event.dataTransfer.files[0];
      if (file) onFile(file);
    }}>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
      aria-label="选择拼图图片" disabled={busy} onChange={event => {
        const file = event.target.files?.[0];
        if (file) onFile(file);
        event.target.value = '';
      }} />
    <button type="button" className="photo-upload-button" disabled={busy} onClick={() => input.current?.click()}>
      <Icon name={image ? 'image' : 'upload'} width="17" height="17" />
      <span>{busy ? '处理中…' : image ? '更换照片' : '上传照片'}</span>
    </button>
    <div className="photo-selection">
      {image && <img src={image.url} alt="已选照片缩略图" width="42" height="42" />}
      <span><strong>{over ? '松开即可使用这张照片' : image?.name ?? '选一张喜欢的照片'}</strong>
        <small>JPG / PNG / WebP · ≤10MB · 也可拖入</small></span>
    </div>
  </div>;
}
