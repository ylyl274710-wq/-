import { LEVELS, levelSource, levelThumbnail } from '../lib/levels';
import { canPlayLevel } from '../lib/campaignProgress';
import type { CampaignProgress } from '../lib/campaignProgress';
import { formatTime } from '../lib/format';
import Icon from './Icon';

interface Props {
  progress: CampaignProgress; persistent: boolean; busy: boolean; loadingLevel: number | null;
  onPlay: (index: number) => void; onBack: () => void; onExplore: () => void; onWeekly: () => void;
}

export default function CampaignPage({ progress, persistent, busy, loadingLevel, onPlay, onBack, onExplore, onWeekly }: Props) {
  const completed = progress.results.length;
  return <main className="campaign-page">
    <div className="campaign-breadcrumb"><button className="text-button nav-back-button" onClick={onBack}>← 返回首页</button><span>02 / 闯关模式</span></div>
    <nav className="challenge-nav" aria-label="闯关玩法"><span aria-current="page">名画闯关</span><button onClick={onExplore}>每日与主题 ↗</button><button onClick={onWeekly}>每周来信 ↗</button></nav>
    <section className="campaign-hero">
      <div><p className="eyebrow"><span /> 名画闯关 · 一场慢慢展开的旅程</p>
        <h1>把世界名画，<br /><span className="serif-accent">一幅幅拼回来。</span></h1>
        <p>从梵高的房间，走到莫奈的花园。<br />每完成一幅，就为下一段风景打开一扇门。</p></div>
      <div className="journey-progress"><Icon name={completed === LEVELS.length ? 'check' : 'spark'} width="27" height="27" />
        <span>你的名画收藏</span><strong>{completed.toString().padStart(2, '0')}<small> / {LEVELS.length.toString().padStart(2, '0')}</small></strong>
        <progress value={completed} max={LEVELS.length} aria-label="已通关关卡数" />
        <p>{completed === LEVELS.length ? '六幅名作，已全部点亮' : '完成当前关卡，即可解锁下一关'}</p>
      </div>
    </section>
    <div className="collection-topline"><h2>六幅名作，六次专注</h2><span>{persistent ? '进度自动保存在此浏览器' : '浏览器未允许存储，进度仅在本次页面保留'}</span></div>
    <section className="level-grid" aria-label="闯关关卡">
      {LEVELS.map((level, index) => {
        const unlocked = canPlayLevel(progress, index);
        const result = progress.results[index];
        const current = !result && unlocked;
        return <article className={`level-card ${!unlocked ? 'is-locked' : ''} ${current ? 'is-current' : ''}`} key={level.id} data-level={index + 1}>
          <div className="level-art"><img src={levelThumbnail(level)} alt={`${level.artist}《${level.title}》`} loading={index > 2 ? 'lazy' : 'eager'} width="400" height="400" />
            <span className="level-number">{(index + 1).toString().padStart(2, '0')}</span>
            <span className={`level-state ${result ? 'finished' : ''}`}><Icon name={result ? 'check' : unlocked ? 'spark' : 'lock'} width="12" height="12" />{result ? '已收藏' : unlocked ? '已解锁' : '待解锁'}</span>
            {!unlocked && <span className="art-lock" aria-hidden="true"><Icon name="lock" width="26" height="26" /></span>}
          </div>
          <div className="level-content"><div className="level-meta"><span>LEVEL {(index + 1).toString().padStart(2, '0')}</span><span>{level.gridSize ** 2} 片 · 随机撕纸</span></div>
            <h3>{level.title}</h3><p className="level-artist">{level.artist} · {level.year}</p>
            <p className="level-description">{level.description}</p>
            {result && <p className="level-best"><Icon name="clock" width="12" height="12" /> 最佳 {formatTime(result.elapsedMs)}<span>· {result.moves} 步</span></p>}
            <button className={current ? 'primary-button' : 'secondary-button'} disabled={!unlocked || busy}
              onClick={() => onPlay(index)} aria-label={`第${index + 1}关：${unlocked ? result ? '再挑战' : '开始挑战' : '未解锁'}`}>
              {loadingLevel === index ? '正在准备画作…' : result ? '再挑战一次' : unlocked ? '开始这一关' : `完成第 ${index} 关后解锁`}
              <Icon name={unlocked ? 'arrow' : 'lock'} width="16" height="16" /></button>
            <a href={levelSource(level)} target="_blank" rel="noreferrer" className="artwork-source">Art Institute of Chicago · 公有领域 ↗</a>
          </div>
        </article>;
      })}
    </section>
    <p className="collection-footnote"><Icon name="lock" width="13" height="13" /> 精选画作随网站提供，你的通关记录只留在当前浏览器。</p>
  </main>;
}
