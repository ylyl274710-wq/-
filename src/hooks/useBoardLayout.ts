import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';
import { fitBoardLayout } from '../lib/boardLayout';

export function useBoardLayout(root: RefObject<HTMLDivElement>, count: number) {
  const [layout, setLayout] = useState(() => fitBoardLayout(900, 500, count));
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const resize = () => {
      const next = fitBoardLayout(element.clientWidth, Math.max(1, element.clientHeight - 34), count);
      setLayout(previous => previous.boardSize === next.boardSize && previous.columns === next.columns && previous.pieceSize === next.pieceSize && previous.stacked === next.stacked ? previous : next);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [root, count]);
  return layout;
}
