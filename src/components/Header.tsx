import Icon from './Icon';
import MusicPlayer from './MusicPlayer';
import StudioSettings from './StudioSettings';

export default function Header({ onHome }: { onHome?: () => void }) {
  return <header className="site-header">
    <a href="./" className="brand" aria-label="片刻拼图首页" onClick={event => { if (onHome && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onHome(); } }}>
      <span className="brand-mark"><span /><span /><span /><span /></span>
      <span>片刻<span className="brand-light">拼图</span><small>PIECE BY PIECE</small></span>
    </a>
    <div className="header-tools"><div className="privacy-pill"><Icon name="lock" width="14" height="14" /><span>你的照片，只属于你</span><i /></div><MusicPlayer /><StudioSettings /></div>
  </header>;
}
