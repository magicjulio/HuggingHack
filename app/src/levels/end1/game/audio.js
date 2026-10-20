// Small WebAudio synth. Everything is generated, no files.
import { sfxVolume } from '../../../state/settings'; // app: settings
let ctx = null, master = null, windGain = null, windFilter = null, noiseBuf = null;

export function initAudio() {
  if (ctx) { master.gain.value = 0.55 * sfxVolume(); if (ctx.state === 'suspended') ctx.resume(); return; } // app: settings
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  master = ctx.createGain(); master.gain.value = 0.55 * sfxVolume(); // app: settings master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // continuous wind, volume and brightness follow speed
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.frequency.value = 400; windFilter.Q.value = 0.7;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  src.connect(windFilter).connect(windGain).connect(master);
  src.start();
}

// app: silence while paused or after leaving the level (the wind loop would keep playing)
export function setAudioPaused(paused) {
  if (!ctx) return;
  if (paused) { windGain.gain.cancelScheduledValues(ctx.currentTime); windGain.gain.value = 0; ctx.suspend(); }
  else ctx.resume();
}

function env(node, t, a, peak, dur) {
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + a);
  node.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}
function tone(type, f0, f1, dur, peak = 0.3, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  env(g, t, 0.005, peak, dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(f0, f1, dur, peak = 0.3, q = 1.5, type = 'bandpass') {
  if (!ctx) return;
  const t = ctx.currentTime;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain(); env(g, t, 0.004, peak, dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export const sfx = {
  fire() { noise(3500, 900, 0.12, 0.35, 2.5); tone('sine', 1400, 500, 0.08, 0.08); },
  latch(chain = 0) { tone('square', 180, 90, 0.06, 0.18); tone('sine', 520 + chain * 90, 520 + chain * 90, 0.12, 0.12); },
  whiff() { noise(1200, 300, 0.25, 0.12, 1); },
  deny() { tone('sawtooth', 140, 110, 0.18, 0.18); tone('sawtooth', 147, 104, 0.18, 0.12); },
  release() { noise(800, 2400, 0.1, 0.07, 1); },
  chain(n) { [0, 4, 7, 12, 16].slice(0, Math.min(5, n + 1)).forEach((s, i) => tone('triangle', 660 * 2 ** (s / 12), 660 * 2 ** (s / 12), 0.12, 0.09, i * 0.035)); },
  laser() { tone('sawtooth', 2200, 300, 0.09, 0.12); noise(6000, 2000, 0.05, 0.08, 3); },
  hit() { tone('square', 900, 400, 0.05, 0.12); },
  boom() { noise(1800, 80, 0.5, 0.5, 0.8, 'lowpass'); tone('sine', 120, 40, 0.4, 0.35); },
  escalate(level) { tone('square', 300 * (1 + level * 0.5), 300 * (1 + level * 0.5), 0.07, 0.12); },
  unlock() { [0, 5, 12].forEach((s, i) => tone('triangle', 520 * 2 ** (s / 12), 520 * 2 ** (s / 12), 0.14, 0.12, i * 0.05)); },
  tick(rate) { tone('square', 1500 + rate * 900, 1500 + rate * 900, 0.025, 0.06); },
  zap() { noise(5000, 200, 0.4, 0.4, 1); tone('sawtooth', 90, 40, 0.4, 0.3); },
  thud() { tone('sine', 140, 50, 0.18, 0.35); noise(600, 100, 0.12, 0.2, 1, 'lowpass'); },
  launch() { noise(400, 3000, 0.3, 0.2, 1.2); tone('sine', 200, 700, 0.25, 0.12); },
  zip() { noise(2500, 5000, 0.2, 0.12, 4); },
  linkLost() { tone('sawtooth', 300, 60, 0.6, 0.25); },
  beep(hi) { tone('square', hi ? 1320 : 660, hi ? 1320 : 660, hi ? 0.35 : 0.15, 0.15); },
  finish() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone('triangle', 440 * 2 ** (s / 12), 440 * 2 ** (s / 12), 0.5, 0.12, i * 0.07)); },
  wind(speed, attached) {
    if (!ctx) return;
    const k = Math.min(1, speed / 70);
    windGain.gain.setTargetAtTime(k * k * 0.32, ctx.currentTime, 0.08);
    windFilter.frequency.setTargetAtTime(300 + k * 1400 + (attached ? 200 : 0), ctx.currentTime, 0.08);
  },
};
