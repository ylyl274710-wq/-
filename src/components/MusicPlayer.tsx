import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { usePreferences, updatePreferences } from '../lib/preferences';
import { QQ_MUSIC_HOME, qqMusicPage } from '../lib/qqMusic';
import '../styles/music.css';

const LINK_KEY = 'puzzle-qq-music-page';
function storedLink(): string {
  try { return qqMusicPage(localStorage.getItem(LINK_KEY) ?? '') ?? QQ_MUSIC_HOME; }
  catch { return QQ_MUSIC_HOME; }
}

export default function MusicPlayer() {
  const audio = useRef<HTMLAudioElement>(null), panel = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null), mounted = useRef(true), attempt = useRef(0);
  const [playing, setPlaying] = useState(false), [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false), [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState(storedLink), [draft, setDraft] = useState(() => { const saved = storedLink(); return saved === QQ_MUSIC_HOME ? '' : saved; });
  const [linkError, setLinkError] = useState(''), [message, setMessage] = useState('');
  const volume = usePreferences().musicVolume;

  useEffect(() => {
    mounted.current = true;
    const element = audio.current;
    return () => { mounted.current = false; attempt.current++; element?.pause(); };
  }, []);
  useEffect(() => { if (audio.current) audio.current.volume = volume / 100; }, [volume]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);

  async function toggle() {
    const element = audio.current;
    if (!element || loading) return;
    if (!element.paused) { element.pause(); return; }
    const token = ++attempt.current;
    setError(null); setMessage(''); setLoading(true);
    try {
      if (element.error) element.load();
      await element.play();
    } catch {
      if (mounted.current && token === attempt.current) { setPlaying(false); setError('音乐暂时未能播放，请点击播放重试。'); }
    } finally { if (mounted.current && token === attempt.current) setLoading(false); }
  }

  function openQQMusic() {
    // 同步暂停；使尚未结束的 play() 请求失效，避免切到外部音乐后又恢复播放。
    attempt.current++;
    audio.current?.pause();
    setPlaying(false); setLoading(false); setError(null);
    setMessage('站内音乐已暂停，回来后可手动继续播放。');
  }
  function saveLink() {
    const next = draft.trim() ? qqMusicPage(draft) : QQ_MUSIC_HOME;
    if (!next) { setLinkError('请粘贴 QQ 音乐官方的 HTTPS 歌曲、歌单或分享链接。'); return; }
    setLink(next); setLinkError('');
    try {
      if (next === QQ_MUSIC_HOME) localStorage.removeItem(LINK_KEY);
      else localStorage.setItem(LINK_KEY, next);
      setMessage(next === QQ_MUSIC_HOME ? '已恢复 QQ 音乐官网入口。' : '已保存，下次点击将打开你的歌曲或歌单。');
    } catch { setMessage('链接在本次页面可用，浏览器未允许长期保存。'); }
  }

  return <div className={`music-player${playing ? ' is-playing-music' : ''}`} ref={panel}
    onKeyDown={event => { if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
    <audio ref={audio} src={`${import.meta.env.BASE_URL}audio/slow-morning.wav`} loop preload="none"
      onPlay={() => setPlaying(audio.current?.paused === false)} onPause={() => setPlaying(false)}
      onError={() => { if (mounted.current) { setPlaying(false); setLoading(false); setError('音乐暂时未能加载，请点击播放重试。'); setOpen(true); } }} />
    <button ref={trigger} type="button" className="music-play-button" aria-label="音乐空间" aria-expanded={open} aria-controls="music-space-panel"
      title={playing ? '站内原创音乐播放中' : '站内轻音乐与 QQ 音乐官方入口'} onClick={() => setOpen(previous => !previous)}>
      <span className="music-note" aria-hidden="true">{playing ? <span className="music-bars"><i /><i /><i /></span> : <Icon name="music" />}</span><span>音乐空间</span>
    </button>
    <button type="button" className="music-volume-button" aria-label="音乐音量设置" aria-expanded={open} aria-controls="music-space-panel"
      title={`站内音量 ${volume}%`} onClick={() => setOpen(previous => !previous)}><Icon name={volume === 0 ? 'muted' : 'volume'} /></button>
    {open && <div className="music-popover" id="music-space-panel" role="region" aria-label="音乐空间设置">
      <div className="music-panel-heading"><h2>给拼图配一点音乐</h2><button className="music-close" type="button" aria-label="关闭音乐空间" onClick={() => { setOpen(false); trigger.current?.focus(); }}><Icon name="close" width="15" height="15" /></button></div>
      <section className="music-local-section" aria-label="站内轻音乐">
        <p className="music-section-label">站内轻音乐</p>
        <div className="music-track"><span aria-hidden="true">♫</span><div><strong>山间慢调</strong><small>本项目原创 · 循环播放</small></div><button className="music-local-toggle" type="button" disabled={loading} aria-pressed={playing} aria-label={playing ? '暂停站内轻音乐' : '播放站内轻音乐'} onClick={() => void toggle()}>{loading ? '加载中' : playing ? '暂停' : '播放'}</button></div>
        <label className="music-volume-label" htmlFor="music-volume"><span>{volume === 0 ? '站内音乐已静音' : '站内音量'}</span><output>{volume}%</output></label>
        <input id="music-volume" type="range" min="0" max="100" step="1" value={volume} aria-label="背景音乐音量" onChange={event => updatePreferences({ musicVolume: Number(event.target.value) })} />
        {error && <p className="music-error" role="alert">{error}</p>}
      </section>
      <section className="music-external-section" aria-label="QQ音乐官方入口">
        <p className="music-section-label">也可以听你喜欢的歌</p>
        <a className="music-qq-link" href={link} target="_blank" rel="noopener noreferrer" onClick={openQQMusic} onAuxClick={event => { if (event.button === 1) openQQMusic(); }}><span className="music-qq-symbol" aria-hidden="true">♫</span><span><strong>去 QQ 音乐听</strong><small>{link === QQ_MUSIC_HOME ? '打开官网选歌' : '打开我的歌曲 / 歌单'}</small></span><span aria-hidden="true">↗</span></a>
        <p className="music-external-note">新页面打开，拼图会保留。可在官方页面使用 App 打开；播放由 QQ 音乐提供。</p>
        <details className="music-link-settings"><summary>设置我的歌曲 / 歌单链接</summary><label htmlFor="qq-music-page">从 QQ 音乐复制官方分享链接</label><input id="qq-music-page" type="url" inputMode="url" autoComplete="off" placeholder="https://y.qq.com/…" value={draft} maxLength={2048} aria-invalid={!!linkError} aria-describedby={linkError ? 'music-link-error' : undefined} onChange={event => { setDraft(event.target.value); setLinkError(''); }} /><button type="button" onClick={saveLink}>保存链接</button><small>留空保存可恢复官网入口，仅保存在此浏览器。</small>{linkError && <p id="music-link-error" className="music-error" role="alert">{linkError}</p>}</details>
      </section>
      <p className="music-message" role="status">{message}</p>
    </div>}
  </div>;
}
