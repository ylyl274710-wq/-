import { memo, useId } from 'react';
import type { PaperGeometry, PaperPiece as Piece } from '../lib/paperGeometry';

interface Props { piece: Piece; geometry: PaperGeometry; url: string; className?: string }

export default memo(function PaperPiece({ piece, geometry, url, className }: Props) {
  const uid = useId().replace(/:/g, '_');
  const { x, y, width, height } = piece.bounds;
  return <svg viewBox={`${x} ${y} ${width} ${height}`} className={className} aria-hidden="true">
    <defs><clipPath id={`${uid}-outer`}><path d={geometry.outlinePath} /></clipPath>
      <clipPath id={`${uid}-piece`}><path d={piece.path} /></clipPath></defs>
    <g clipPath={`url(#${uid}-outer)`}><g clipPath={`url(#${uid}-piece)`}>
      <image href={url} x="0" y="0" width="1000" height="1000" preserveAspectRatio="none" />
      <path d={piece.path} fill="none" stroke="#fbf5e6" strokeWidth="3.2" strokeLinejoin="round" />
    </g></g>
  </svg>;
});
