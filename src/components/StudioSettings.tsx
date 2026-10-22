import { useEffect, useRef, useState } from 'react';
import { updatePreferences, usePreferences } from '../lib/preferences';
import type { Preferences } from '../lib/preferences';
import { createAmbience } from '../lib/ambience';
import StudioDialog from './StudioDialog';

export default function StudioSettings() {
  const prefs = usePreferences(), [open, setOpen] = useState(false), [enabled, setEnabled] = useState(false), [error, setError] = useState('');
  const ambient = useRef<ReturnType<typeof createAmbience> | null>(null);
  useEffect(() => {
    if (!enabled || prefs.ambience === 'off') return;
    try { ambient.current = createAmbience(prefs.ambience, prefs.ambientVolume); setError(''); } catch { setError('环境声暂时无法开启，请再试一次。'); }
    return () => { ambient.current?.stop(); ambient.current = null; };
  }, [enabled, prefs.ambience]);
  useEffect(() => { ambient.current?.volume(prefs.ambientVolume); }, [prefs.ambientVolume]);
  return <><button className="studio-settings-button" aria-label="氛围与偏好设置" title="氛围与偏好设置" onClick={() => setOpen(true)}>☷</button>
    {open && <StudioDialog title="让这里更像你的角落" onClose={() => setOpen(false)}>
      <div className="preference-section"><h3>界面光线</h3><div className="studio-segment">{(['day', 'night'] as const).map(theme => <button key={theme} aria-pressed={prefs.theme === theme} onClick={() => updatePreferences({ theme })}>{theme === 'day' ? '☀ 暖色日间' : '☾ 深绿夜间'}</button>)}</div></div>
      <div className="preference-section"><h3>环境声音</h3><div className="studio-segment">{([['off', '安静'], ['rain', '雨声'], ['fire', '壁炉'], ['sea', '海浪']] as const).map(([ambience, label]) => <button key={ambience} aria-pressed={prefs.ambience === ambience} onClick={() => { updatePreferences({ ambience }); setEnabled(ambience !== 'off'); }}>{label}</button>)}</div>
        {prefs.ambience !== 'off' && <button className="text-button" onClick={() => setEnabled(v => !v)}>{enabled ? '暂停环境声' : '播放环境声'}</button>}
      </div>
      {([['musicVolume', '背景音乐音量'], ['ambientVolume', '环境声音量'], ['effectVolume', '机械音效音量']] as const).map(([key, label]) => <label className="studio-range" key={key}>{label}<input type="range" min="0" max="100" aria-label={label} value={prefs[key]} onChange={event => updatePreferences({ [key]: Number(event.target.value) } as Partial<Preferences>)} /><output>{prefs[key]}%</output></label>)}
      <div className="preference-section"><h3>开始前的粉碎机动画</h3><select aria-label="粉碎动画播放偏好" value={prefs.animation} onChange={event => updatePreferences({ animation: event.target.value as Preferences['animation'] })}><option value="every">每次播放（默认）</option><option value="first">仅首次播放，之后自动跳过</option><option value="off">关闭动画</option></select><p className="studio-muted">新拼图默认播放粉碎动画，续玩直接回到进度；播放时可以随时跳过。</p></div>
      <p className="studio-muted">所有偏好保存在当前浏览器。背景音乐和环境声由你手动开启，照片不会上传。</p>{error && <p role="alert">{error}</p>}
    </StudioDialog>}
  </>;
}
