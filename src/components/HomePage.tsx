import Icon from './Icon';
import { PERSONAL_ONLY } from '../lib/siteMode';
import type { SavedSession } from '../lib/studioTypes';

interface Props {
  onCustom: () => void; onCampaign: () => void; onTogether: () => void;
  onCollection: () => void; onResume: () => void; saved: SavedSession | null;
  onIntent: (mode: 'custom' | 'campaign' | 'together') => void;
  busy: boolean; onRelax: () => void; onGift: () => void;
}

export default function HomePage({ onCustom, onCampaign, onTogether, onCollection, onResume, saved, onIntent, busy, onRelax, onGift }: Props) {
  return <main className="mode-home growth-home">
    <section className="mode-home-intro">
      <p className="eyebrow"><span /> A LITTLE TIME, PIECE BY PIECE</p>
      <h1>今天，想<span className="serif-accent">怎么拼？</span><span className="title-spark">✳</span></h1>
      <p>{PERSONAL_ONLY ? '给自己几分钟，把喜欢的照片慢慢拼回来。' : '给自己几分钟，也给想起的人一点心意。'}</p>
      <div className="home-welcome-actions"><button className="primary-button" disabled={busy} onClick={onRelax}><span aria-hidden="true">☀</span>{busy ? '正在准备小风景…' : '先拼一张，放松一下'}<small>9片 · 无需上传</small><Icon name="arrow" width="16" height="16" /></button>{!PERSONAL_ONLY && <button className="home-gift-link" disabled={busy} onClick={onGift}>送一份照片礼物 <span>↗</span></button>}</div>
    </section>
    <section className="mode-cards" aria-label="选择拼图模式">
      <button className="mode-card mode-custom" onClick={onCustom} onPointerEnter={() => onIntent('custom')} onFocus={() => onIntent('custom')}>
        <div className="mode-art custom-mode-art" aria-hidden="true"><div className="mode-photo"><img src={`${import.meta.env.BASE_URL}sample.svg`} alt="" /><span className="mode-photo-seam" /></div><span className="mode-art-mark">✂</span></div>
        <div className="mode-card-copy"><span className="mode-number">01 / MAKE IT YOURS</span><h2>自定义拼图</h2><p>一张照片，一种形状，你来决定。</p><span className="mode-card-cta">开始创作 <Icon name="arrow" width="17" height="17" /></span></div>
      </button>
      <button className="mode-card mode-challenge" onClick={onCampaign} onPointerEnter={() => onIntent('campaign')} onFocus={() => onIntent('campaign')}>
        <div className="mode-art challenge-mode-art" aria-hidden="true"><span className="journey-dash" /><span className="journey-step">01</span><span className="journey-step">02</span><span className="journey-step">✳</span></div>
        <div className="mode-card-copy"><span className="mode-number">02 / A LITTLE JOURNEY</span><h2>闯关模式</h2><p>走进名画与风景，一关关收集美好。</p><span className="mode-card-cta">开启旅程 <Icon name="arrow" width="17" height="17" /></span></div>
      </button>
      <button className="mode-card mode-together" onClick={PERSONAL_ONLY ? onCollection : onTogether} onPointerEnter={() => { if (!PERSONAL_ONLY) onIntent('together'); }} onFocus={() => { if (!PERSONAL_ONLY) onIntent('together'); }}>
        <div className="mode-art together-mode-art" aria-hidden="true"><span className="together-paper">{PERSONAL_ONLY ? '藏' : '你'}</span><span className="together-join">{PERSONAL_ONLY ? '♡' : '＋'}</span><span className="together-paper">{PERSONAL_ONLY ? '忆' : '我'}</span><span className="together-star">✧</span></div>
        <div className="mode-card-copy"><span className="mode-number">{PERSONAL_ONLY ? '03 / LITTLE MOMENTS' : '03 / BETTER TOGETHER'}</span><h2>{PERSONAL_ONLY ? '收藏时光' : '一起拼'}</h2><p>{PERSONAL_ONLY ? '每一幅拼好的照片，都值得好好收藏。' : '送一份照片礼物，或邀请朋友同桌拼。'}</p><span className="mode-card-cta">{PERSONAL_ONLY ? '看看我的作品' : '把心意拼给你'} <Icon name="arrow" width="17" height="17" /></span></div>
      </button>
    </section>
    <div className={`mode-home-bottom${saved ? ' has-saved-game' : ''}`}>{saved ? <button className="home-resume-link" onClick={onResume}><span className="resume-dot" /><span className="resume-copy"><strong>继续上次的拼图</strong><small>{saved.context.title ?? saved.image.name} · {saved.state.placed.length} / {saved.settings.pieceCount} 片</small><progress value={saved.state.placed.length} max={saved.settings.pieceCount} aria-label="上次拼图完成进度" /></span><span className="resume-arrow" aria-hidden="true">↗</span></button> : <span className="mode-home-note">不赶时间，选一种喜欢的方式。</span>}<button className="text-button" onClick={onCollection}>我的收藏 ↗</button></div>
  </main>;
}
