export function createAmbience(kind: 'rain' | 'fire' | 'sea', volume: number) {
  const context = new AudioContext(), master = context.createGain();
  master.gain.value = volume / 100 * .15; master.connect(context.destination);
  const buffer = context.createBuffer(1, context.sampleRate * 8, context.sampleRate), data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    brown = (brown + .025 * white) / 1.025;
    data[i] = kind === 'fire' ? brown * 2 + (Math.random() < .00035 ? white * 2 : 0) : kind === 'sea' ? brown * 5 : white * .6;
  }
  const source = context.createBufferSource(), filter = context.createBiquadFilter();
  source.buffer = buffer; source.loop = true;
  filter.type = kind === 'rain' ? 'highpass' : 'lowpass'; filter.frequency.value = kind === 'rain' ? 900 : kind === 'sea' ? 1700 : 700;
  const swell = context.createGain(); swell.gain.value = 1;
  source.connect(filter); filter.connect(swell); swell.connect(master); source.start();
  const lfo = context.createOscillator(), lfoGain = context.createGain();
  lfo.frequency.value = kind === 'sea' ? .09 : .23; lfoGain.gain.value = kind === 'sea' ? .43 : .013;
  // 调制放在总音量之前，确保音量为零时不会被 LFO 再次抬高。
  lfo.connect(lfoGain); lfoGain.connect(swell.gain); lfo.start();
  void context.resume().catch(() => {});
  return { volume(value: number) { master.gain.cancelScheduledValues(context.currentTime); if (value === 0) master.gain.setValueAtTime(0, context.currentTime); else master.gain.setTargetAtTime(value / 100 * .15, context.currentTime, .25); }, stop() { source.stop(); lfo.stop(); source.disconnect(); lfo.disconnect(); filter.disconnect(); swell.disconnect(); lfoGain.disconnect(); master.disconnect(); void context.close().catch(() => {}); } };
}
