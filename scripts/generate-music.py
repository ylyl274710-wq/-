"""Generate the original local ambient loop using only Python's standard library."""
from array import array
from math import exp, pi, sin, tanh
from pathlib import Path
import wave

RATE = 22050
SECONDS = 32
LENGTH = RATE * SECONDS
samples = array('f', [0.0]) * LENGTH


def note(midi: int, start: float, duration: float, gain: float, pad: bool = False) -> None:
    frequency = 440.0 * 2 ** ((midi - 69) / 12)
    offset = int(start * RATE)
    for i in range(int(duration * RATE)):
        t = i / RATE
        attack = min(1.0, t / (.4 if pad else .018))
        release = min(1.0, (duration - t) / .45)
        envelope = attack * release * exp(-t / (3.5 if pad else .9))
        phase = 2 * pi * frequency * t
        voice = sin(phase) + .22 * sin(2 * phase + .12 * sin(2 * pi * .23 * t)) + .07 * sin(3 * phase)
        samples[(offset + i) % LENGTH] += gain * envelope * voice


# An original eight-bar progression with a sparse, softly plucked melody.
chords = [(48, 55, 59, 64), (45, 52, 55, 60), (41, 48, 52, 57), (43, 50, 55, 60)]
melodies = [(72, 76, 79, 76), (69, 72, 76, 72), (69, 72, 77, 76), (67, 74, 72, 71),
            (76, 79, 83, 79), (72, 76, 79, 76), (77, 76, 72, 69), (74, 72, 71, 67)]
for bar in range(8):
    for pitch in chords[bar % 4]:
        note(pitch, bar * 4, 5.6, .032, True)
    for beat, pitch in enumerate(melodies[bar]):
        note(pitch, bar * 4 + beat * .92 + .12, 2.4, .064 if beat % 2 == 0 else .045)

dry = array('f', samples)
for delay, gain in [(.19, .12), (.39, .09), (.73, .06), (1.13, .035)]:
    offset = int(delay * RATE)
    for i in range(LENGTH):
        samples[(i + offset) % LENGTH] += dry[i] * gain

peak = max(abs(value) for value in samples)
pcm = array('h', (int(tanh(value / max(peak, .001) * .8) * 26000) for value in samples))
destination = Path(__file__).resolve().parents[1] / 'public' / 'audio' / 'slow-morning.wav'
destination.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(destination), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(RATE)
    output.writeframes(pcm.tobytes())
print(f'{destination.name}: {SECONDS}s, {destination.stat().st_size} bytes')
