import { getPreferences } from './preferences';
export interface ShredderSound { setMuted: (muted: boolean) => void; setVolume: (value: number) => void; stop: () => void }

// 本地合成电机低鸣与纸张切割声，不下载音效；结束或跳过时释放音频上下文。
export function playShredderSound(): ShredderSound | null {
  let context: AudioContext | null = null;
  try {
    context = new AudioContext();
    const audio = context;
    const now = audio.currentTime;
    const master = audio.createGain();
    let gain = getPreferences().effectVolume / 100 * .64, muted = false;
    master.gain.value = gain;
    master.connect(audio.destination);

    const buffer = audio.createBuffer(1, Math.floor(audio.sampleRate * .7), audio.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = Math.random() * 2 - 1;
    const paper = audio.createBufferSource();
    paper.buffer = buffer; paper.loop = true;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1250; filter.Q.value = .65;
    filter.frequency.linearRampToValueAtTime(1900, now + 2.5);
    const paperGain = audio.createGain();
    paperGain.gain.setValueAtTime(0, now);
    paperGain.gain.setValueAtTime(0, now + .8);
    paperGain.gain.linearRampToValueAtTime(.16, now + 1.12);
    for (let i = 0; i < 12; i++) {
      const time = now + 1.15 + i * .135;
      paperGain.gain.linearRampToValueAtTime(i % 3 === 0 ? .28 : .21, time);
      paperGain.gain.linearRampToValueAtTime(.09, time + .075);
    }
    paperGain.gain.linearRampToValueAtTime(.03, now + 2.95);
    paperGain.gain.linearRampToValueAtTime(0, now + 3.2);
    paper.connect(filter); filter.connect(paperGain); paperGain.connect(master);

    const motor = audio.createOscillator();
    motor.type = 'sawtooth';
    motor.frequency.setValueAtTime(52, now);
    motor.frequency.linearRampToValueAtTime(87, now + 1.1);
    motor.frequency.linearRampToValueAtTime(76, now + 2.7);
    motor.frequency.linearRampToValueAtTime(42, now + 3.15);
    const motorFilter = audio.createBiquadFilter();
    motorFilter.type = 'lowpass'; motorFilter.frequency.value = 420;
    const motorGain = audio.createGain();
    motorGain.gain.setValueAtTime(0, now);
    motorGain.gain.setValueAtTime(0, now + .6);
    motorGain.gain.linearRampToValueAtTime(.11, now + .95);
    motorGain.gain.setValueAtTime(.09, now + 2.7);
    motorGain.gain.linearRampToValueAtTime(0, now + 3.2);
    motor.connect(motorFilter); motorFilter.connect(motorGain); motorGain.connect(master);
    paper.start(now + .7); motor.start(now + .6);
    paper.stop(now + 3.25); motor.stop(now + 3.25);
    void audio.resume().catch(() => { /* 浏览器阻止音频时动画继续正常完成。 */ });
    let stopped = false;
    return {
      setMuted(value) {
        if (stopped || audio.state === 'closed') return;
        muted = value; master.gain.setTargetAtTime(muted ? 0 : gain, audio.currentTime, .02);
      },
      setVolume(value) { gain = Math.max(0, Math.min(100, value)) / 100 * .64; if (!stopped && audio.state !== 'closed') master.gain.setTargetAtTime(muted ? 0 : gain, audio.currentTime, .02); },
      stop() {
        if (stopped) return;
        stopped = true;
        try { paper.stop(); motor.stop(); } catch { /* 已自然结束的源无需再次停止。 */ }
        paper.disconnect(); motor.disconnect(); filter.disconnect(); paperGain.disconnect();
        motorFilter.disconnect(); motorGain.disconnect(); master.disconnect();
        if (audio.state !== 'closed') void audio.close().catch(() => {});
      }
    };
  } catch {
    if (context && context.state !== 'closed') void context.close().catch(() => {});
    return null;
  }
}
