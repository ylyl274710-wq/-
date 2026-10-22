import type { SVGProps } from 'react';

type IconName = 'arrow' | 'upload' | 'image' | 'lock' | 'close' | 'refresh' | 'eye' | 'check' | 'clock' | 'move' | 'spark' | 'music' | 'volume' | 'muted';
const paths: Record<IconName, string> = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  upload: 'M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5',
  image: 'M3 3h18v18H3zM3 16l6-6 5 5 3-3 4 4M16 7h.01',
  lock: 'M6 10h12v11H6zM8 10V7a4 4 0 0 1 8 0v3m-4 5v2',
  close: 'm6 6 12 12M6 18 18 6',
  refresh: 'M20 8a8 8 0 1 0 0 8M20 3v5h-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12m10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  check: 'm5 12 4 4L19 6',
  clock: 'M12 8v5l3 2m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  move: 'M12 3v18M3 12h18m-4-4 4 4-4 4M7 8l-4 4 4 4M8 7l4-4 4 4M8 17l4 4 4-4',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  music: 'M9 18V5l12-2v13M9 8l12-2M9 18a3 3 0 1 1-3-3c1.7 0 3 1 3 3m12-2a3 3 0 1 1-3-3c1.7 0 3 1 3 3',
  volume: 'M11 5 6 9H3v6h3l5 4V5m4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'M11 5 6 9H3v6h3l5 4V5m5 4 5 6m0-6-5 6'
};

export default function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    <path d={paths[name]} />
  </svg>;
}
