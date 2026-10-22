import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Icon from './Icon';

export default function StudioDialog({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current, focused = document.activeElement, overflow = document.body.style.overflow;
    node?.showModal(); document.body.style.overflow = 'hidden';
    return () => { node?.close(); document.body.style.overflow = overflow; if (focused instanceof HTMLElement && focused.isConnected) focused.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={dialog} className={`studio-dialog${wide ? ' is-wide' : ''}`} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header><h2>{title}</h2><button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><Icon name="close" /></button></header>{children}
  </dialog>;
}
