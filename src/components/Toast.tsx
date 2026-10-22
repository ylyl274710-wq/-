import { useEffect } from 'react';
import Icon from './Icon';

export interface ToastMessage { id: number; text: string }

export default function Toast({ message, onClose }: { message: ToastMessage | null; onClose: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, 4500);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  return <div className="toast-region" role="status" aria-live="polite" aria-atomic="true">
    {message && <div className="toast" key={message.id}><span>{message.text}</span>
      <button type="button" onClick={onClose} aria-label="关闭提示"><Icon name="close" /></button></div>}
  </div>;
}
