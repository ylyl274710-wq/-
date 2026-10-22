import { useEffect, useState } from 'react';
import { ARTWORKS, THEMES, dailyPuzzle, dailyStreak, dateKey, themeSettings } from '../lib/catalog';
import type { CollectionEntry } from '../lib/studioTypes';
import type { Artwork } from '../lib/catalog';
import { gentleCollection, gentleCompleted } from '../lib/product';

export default function ExplorePage({ entries, onDaily, onTheme, onBack, onGentle }: { entries: readonly CollectionEntry[]; onDaily: (date: string) => void; onTheme: (themeId: string, index: number, artwork: Artwork) => void; onBack: () => void; onGentle: (index: number) => void }) {
  const [day, setDay] = useState(dateKey);
  useEffect(() => { const t = window.setInterval(() => setDay(dateKey()), 30000); return () => window.clearInterval(t); }, []);
  const daily = dailyPuzzle(day), results = entries.filter(e => e.context.kind === 'daily' && e.context.date === day && !e.trashed), best = [...results].sort((a, b) => b.score - a.score)[0];
  const gentle = gentleCollection(day);
  return <main className="studio-page"><button className="text-button nav-back-button" onClick={onBack}>← 返回闯关模式</button>
    <div className="studio-page-heading"><p className="eyebrow">A LITTLE REASON TO COME BACK</p><h1>每天一点，慢慢收集美好。</h1><p>今日挑战使用固定图片和切口，主题关卡则一步一步展开。</p></div>
    <section className="gentle-collection"><p className="eyebrow">THIS WEEK, AT YOUR OWN PACE</p><h2>本周小风景 · {gentle.title}</h2><p>每幅9片，任选一张。想来就来，不用补签，也不锁关。</p><div>{gentle.items.map((art, i) => <button key={art.id} onClick={() => onGentle(i)}><img src={art.thumbnail} alt="" loading="lazy" /><span><strong>{art.title}</strong><small>{gentleCompleted(entries, gentle.week, i) ? '✓ 已收藏，再慢慢拼一次' : '给自己几分钟 →'}</small></span></button>)}</div></section>
    <section className="daily-feature"><img src={daily.artwork.thumbnail} alt={daily.artwork.title} /><div><span className="studio-kicker">每日一拼 · {day}</span><h2>{daily.artwork.title}</h2><p>{daily.settings.pieceCount} 片 · 今日固定切口 · 连续完成 {dailyStreak(entries)} 天</p><p>{best ? `今日最佳 ${best.score} 分 · 提示 ${best.state.hintsUsed} 次` : '今天的这幅美好，还在等你。'}</p><button className="primary-button" onClick={() => onDaily(day)}>{best ? '再次挑战今日拼图' : '开始今日拼图'} →</button></div></section>
    {THEMES.map(theme => <section className="theme-section" key={theme.id}><h2>{theme.title}</h2><p className="studio-muted">{theme.description}</p><div className="theme-grid">{theme.ids.map((id, index) => {
      const artwork = ARTWORKS.find(a => a.id === id)!;
      const complete = entries.some(e => e.context.kind === 'theme' && e.context.themeId === theme.id && e.context.levelIndex === index);
      const unlocked = index === 0 || entries.some(e => e.context.kind === 'theme' && e.context.themeId === theme.id && e.context.levelIndex === index - 1);
      return <article className={`theme-card${unlocked ? '' : ' is-locked'}`} key={id}><img src={artwork.thumbnail} alt={artwork.title} /><span>第 {index + 1} 关 · {themeSettings(index).pieceCount} 片 {complete ? '· 已完成' : ''}</span><h3>{artwork.title}</h3><button className="secondary-button" disabled={!unlocked} onClick={() => onTheme(theme.id, index, artwork)}>{complete ? '再挑战' : unlocked ? '开始拼图' : '完成前一关后解锁'} →</button></article>;
    })}</div></section>)}
  </main>;
}
