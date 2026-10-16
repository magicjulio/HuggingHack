// Small WebAudio synth. No files.
let ctx = null, master, noiseBuf;
let wind, windGain, windFilter, reel, reelGain, reelFilter, alarm, alarmGain;

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch (e) { return; }
  master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // wind: looping noise through a band-pass, louder and brighter with speed
  wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
  windFilter = ctx.createBiquadFilter(); windFilter.type = 'bandpass'; windFilter.Q.value = 0.7; windFilter.frequency.value = 400;
  windGain = ctx.createGain(); windGain.gain.value = 0;
  wind.connect(windFilter).connect(windGain).connect(master); wind.start();
  // reel: a saw hum that rises in pitch as the tether pulls you in
  reel = ctx.createOscillator(); reel.type = 'sawtooth'; reel.frequency.value = 80;
  reelFilter = ctx.createBiquadFilter(); reelFilter.type = 'lowpass'; reelFilter.frequency.value = 900;
  reelGain = ctx.createGain(); reelGain.gain.value = 0;
  reel.connect(reelFilter).connect(reelGain).connect(master); reel.start();
  // watchdog alarm
  alarm = ctx.createOscillator(); alarm.type = 'square'; alarm.frequency.value = 660;
  alarmGain = ctx.createGain(); alarmGain.gain.value = 0;
  alarm.connect(alarmGain).connect(master); alarm.start();
}

function tone(type, f0, f1, dur, vol = 0.2, attack = 0.005, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, f0, f1, vol = 0.3, q = 1, type = 'bandpass', delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}

export const sfx = {
  fire() { noise(0.12, 3000, 800, 0.18, 2); tone('square', 900, 1800, 0.08, 0.05); },
  attach() { tone('triangle', 220, 110, 0.12, 0.35); noise(0.06, 2000, 400, 0.25, 1, 'lowpass'); },
  whiff() { noise(0.18, 1200, 300, 0.12, 1.5); },
  deny() { tone('square', 180, 120, 0.18, 0.12); tone('square', 140, 90, 0.2, 0.1, 0.005, 0.09); },
  windowOpen() { tone('sine', 1320, 1760, 0.07, 0.08); },
  sling() { noise(0.35, 600, 4000, 0.28, 0.8); tone('sine', 520, 1560, 0.25, 0.16); tone('sine', 780, 2340, 0.25, 0.08, 0.01, 0.03); },
  latch() { tone('triangle', 160, 70, 0.14, 0.3); },
  land() { noise(0.1, 500, 120, 0.25, 1, 'lowpass'); },
  bonk() { tone('sine', 120, 50, 0.2, 0.35); noise(0.12, 800, 200, 0.2, 1, 'lowpass'); },
  laser() { tone('sawtooth', 1800, 300, 0.09, 0.07); },
  ring(i) { const f = [392, 494, 587, 698, 784][Math.min(4, i)]; tone('triangle', f, f, 0.18, 0.2); noise(0.08, 3000, 1500, 0.1, 3); },
  root() { [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, f, 0.4, 0.14, 0.005, i * 0.06)); },
  charge() { tone('sawtooth', 200, 900, 0.8, 0.05, 0.3); },
  bolt() { tone('square', 500, 160, 0.2, 0.08); },
  hit() { noise(0.3, 2500, 200, 0.4, 0.8); tone('square', 110, 55, 0.3, 0.2); },
  yank() { noise(0.25, 300, 2500, 0.3, 1); tone('sawtooth', 300, 60, 0.4, 0.12); },
  kill() { noise(0.4, 4000, 300, 0.3, 0.7); tone('square', 600, 80, 0.3, 0.08); },
  lost() { noise(0.6, 200, 3000, 0.25, 4); tone('sawtooth', 300, 40, 0.6, 0.12); },
  sailOpen() { noise(0.2, 300, 900, 0.25, 0.9, 'lowpass'); },
  sailClose() { noise(0.12, 900, 300, 0.15, 0.9, 'lowpass'); },
  door() { noise(0.8, 3000, 60, 0.5, 0.5, 'lowpass'); tone('sine', 90, 30, 0.8, 0.4); },
  finish() { [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone('triangle', f, f * 1.01, 0.8, 0.12, 0.01, i * 0.08)); noise(1.2, 200, 6000, 0.2, 0.5); },
  fail() { [330, 247, 196].forEach((f, i) => tone('square', f, f * 0.98, 0.35, 0.1, 0.01, i * 0.16)); },
};

export function updateAudio(dt, speed, reeling, inWindow, alarmOn) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const k = Math.min(1, speed / 80);
  windGain.gain.setTargetAtTime(k * k * 0.32, t, 0.08);
  windFilter.frequency.setTargetAtTime(250 + k * 1600, t, 0.08);
  reelGain.gain.setTargetAtTime(reeling ? 0.05 : 0, t, 0.03);
  reel.frequency.setTargetAtTime(60 + speed * 3.2 + (inWindow ? 140 : 0), t, 0.04);
  reelFilter.frequency.setTargetAtTime(inWindow ? 3000 : 900, t, 0.03);
  alarmGain.gain.setTargetAtTime(alarmOn ? (Math.sin(t * 22) > 0 ? 0.05 : 0.0) : 0, t, 0.01);
}

export function muteAll() {
  if (!ctx) return;
  const t = ctx.currentTime;
  windGain.gain.setTargetAtTime(0, t, 0.05); reelGain.gain.setTargetAtTime(0, t, 0.05); alarmGain.gain.setTargetAtTime(0, t, 0.05);
}
