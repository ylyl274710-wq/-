import { useCallback, useEffect, useState } from 'react';
import { completeLevel, emptyProgress, mergeProgress, parseProgress, PROGRESS_KEY } from '../lib/campaignProgress';
import type { CampaignProgress, LevelResult } from '../lib/campaignProgress';

function readProgress(): CampaignProgress {
  try { return parseProgress(localStorage.getItem(PROGRESS_KEY)); }
  catch { return emptyProgress(); }
}

export function useCampaign() {
  const [progress, setProgress] = useState(readProgress);
  const [persistent, setPersistent] = useState(true);
  useEffect(() => {
    try {
      const merged = mergeProgress(progress, readProgress());
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(merged));
      if (JSON.stringify(merged) !== JSON.stringify(progress)) setProgress(merged);
      setPersistent(true);
    } catch { setPersistent(false); }
  }, [progress]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === PROGRESS_KEY) setProgress(previous => mergeProgress(previous, parseProgress(event.newValue)));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  const recordResult = useCallback((index: number, result: LevelResult) => {
    setProgress(previous => completeLevel(previous, index, result));
  }, []);
  return { progress, persistent, recordResult };
}
