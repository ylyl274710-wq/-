import { useCallback, useEffect, useRef, useState } from 'react';
import type { SavedSession } from '../lib/studioTypes';
import { sameSessionContent } from '../lib/sessionSnapshot';

export type SaveStatus = 'saving' | 'saved' | 'error';

export function useSessionAutosave(snapshot: SavedSession, onSave: (session: SavedSession) => Promise<void>) {
  const latest = useRef(snapshot), save = useRef(onSave), attempted = useRef<SavedSession | null>(null);
  latest.current = snapshot; save.current = onSave;
  const mounted = useRef(false), sequence = useRef(0);
  const [status, setStatus] = useState<SaveStatus>('saving');
  const content = useRef(snapshot);
  if (!sameSessionContent(content.current, snapshot)) content.current = snapshot;
  const revision = content.current;
  const flush = useCallback((timerThreshold = 1000) => {
    const next = latest.current, previous = attempted.current;
    if (next.state.status === 'completed' || previous && sameSessionContent(previous, next) &&
      next.state.elapsedMs - previous.state.elapsedMs < timerThreshold) return;
    const record = { ...next, savedAt: Date.now() }, token = ++sequence.current;
    attempted.current = record;
    if (mounted.current) setStatus('saving');
    void save.current(record).then(() => {
      if (mounted.current && sequence.current === token) setStatus('saved');
    }).catch(() => {
      if (sequence.current === token) {
        attempted.current = null;
        if (mounted.current) setStatus('error');
      }
    });
  }, []);

  useEffect(() => {
    mounted.current = true;
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    const timer = window.setInterval(() => flush(10000), 10000);
    window.addEventListener('pagehide', flushOnHide);
    document.addEventListener('visibilitychange', hidden);
    function flushOnHide() { flush(); }
    return () => {
      mounted.current = false;
      window.clearInterval(timer); window.removeEventListener('pagehide', flushOnHide);
      document.removeEventListener('visibilitychange', hidden); flush();
    };
  }, [flush]);

  useEffect(() => {
    const previous = attempted.current;
    if (revision.state.status === 'completed' || previous && sameSessionContent(previous, revision)) return;
    const timer = window.setTimeout(() => flush(), 300);
    return () => window.clearTimeout(timer);
  }, [revision, flush]);
  return { status, flush };
}
