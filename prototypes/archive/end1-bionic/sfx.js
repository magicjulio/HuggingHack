// Tiny WebAudio synth: every sound is generated, no files.
export class Sfx {
  constructor() { this.ctx = null; }
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
    const ctx = this.ctx = new C();
    this.master = ctx.createGain(); this.master.gain.value = 0.55; this.master.connect(ctx.destination);
    const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = b;
    // wind: filtered noise, louder with speed
    const src = ctx.createBufferSource(); src.buffer = b; src.loop = true;
    this.windF = ctx.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 400; this.windF.Q.value = 0.8;
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.master); src.start();
    // machine-room hum
    const hum = ctx.createGain(); hum.gain.value = 0.05;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    for (const f of [55, 82.4, 110.3]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    lp.connect(hum).connect(this.master);
    // rope hum while linked
    this.ropeO = ctx.createOscillator(); this.ropeO.type = 'triangle'; this.ropeO.frequency.value = 120;
    this.ropeG = ctx.createGain(); this.ropeG.gain.value = 0;
    this.ropeO.connect(this.ropeG).connect(this.master); this.ropeO.start();
  }
  osc({ type = 'sine', f0 = 440, f1 = null, dur = 0.15, vol = 0.2, delay = 0, attack = 0.004 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  noise({ dur = 0.2, f0 = 1000, f1 = null, q = 1, vol = 0.2, type = 'bandpass', delay = 0 }) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + delay, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf; s.playbackRate.value = 1;
    f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  fire() { this.osc({ type: 'square', f0: 320, f1: 1100, dur: 0.1, vol: 0.06 }); this.noise({ dur: 0.08, f0: 4000, q: 2, vol: 0.08 }); }
  latch() { this.osc({ type: 'triangle', f0: 220, f1: 70, dur: 0.14, vol: 0.4 }); this.noise({ dur: 0.05, f0: 2600, q: 3, vol: 0.25 }); }
  yank() { this.noise({ dur: 0.3, f0: 300, f1: 1400, q: 1.5, vol: 0.12 }); }
  release() { this.noise({ dur: 0.22, f0: 1400, f1: 500, q: 1, vol: 0.1 }); }
  sling() { this.osc({ f0: 880, f1: 1320, dur: 0.16, vol: 0.14 }); this.osc({ f0: 1320, f1: 1760, dur: 0.22, vol: 0.12, delay: 0.06 }); this.noise({ dur: 0.35, f0: 800, f1: 3000, q: 0.8, vol: 0.12 }); }
  denied() { this.osc({ type: 'square', f0: 150, dur: 0.12, vol: 0.12 }); this.osc({ type: 'square', f0: 110, dur: 0.16, vol: 0.12, delay: 0.11 }); }
  root() { [523, 659, 880, 1175].forEach((f, i) => this.osc({ type: 'triangle', f0: f, dur: 0.12, vol: 0.12, delay: i * 0.045 })); }
  laser() { this.osc({ type: 'sawtooth', f0: 1600, f1: 240, dur: 0.11, vol: 0.08 }); }
  zap() { this.noise({ dur: 0.08, f0: 3000, q: 4, vol: 0.12 }); }
  miss() { this.noise({ dur: 0.06, f0: 1800, q: 6, vol: 0.12 }); }
  hit() { this.noise({ dur: 0.35, f0: 900, type: 'lowpass', vol: 0.45 }); this.osc({ f0: 140, f1: 40, dur: 0.3, vol: 0.4 }); }
  cut() { this.noise({ dur: 0.12, f0: 2400, type: 'highpass', vol: 0.25 }); this.osc({ type: 'square', f0: 700, f1: 160, dur: 0.12, vol: 0.08 }); }
  kill() { this.noise({ dur: 0.3, f0: 1600, f1: 200, q: 1, vol: 0.32 }); this.osc({ type: 'square', f0: 420, f1: 50, dur: 0.25, vol: 0.12 }); }
  claim() { this.osc({ f0: 660, dur: 0.12, vol: 0.12 }); this.osc({ f0: 990, dur: 0.2, vol: 0.12, delay: 0.08 }); }
  drop() { this.osc({ f0: 420, f1: 50, dur: 0.7, vol: 0.3 }); this.noise({ dur: 0.5, f0: 600, type: 'lowpass', vol: 0.2 }); }
  charge() { this.osc({ f0: 300, f1: 1000, dur: 0.6, vol: 0.05 }); }
  pulse() { this.osc({ type: 'square', f0: 240, f1: 110, dur: 0.15, vol: 0.06 }); }
  jump() { this.osc({ f0: 300, f1: 600, dur: 0.1, vol: 0.08 }); }
  land(v) { this.osc({ f0: 150, f1: 55, dur: 0.1, vol: Math.min(0.35, v / 70) }); }
  breakout() { this.noise({ dur: 0.6, f0: 3000, f1: 200, type: 'lowpass', vol: 0.5 }); this.osc({ f0: 90, f1: 35, dur: 0.5, vol: 0.45 }); [880, 1320].forEach((f, i) => this.osc({ type: 'triangle', f0: f, dur: 0.3, vol: 0.08, delay: 0.05 + i * 0.07 })); }
  finish() { [392, 523, 659, 784, 1046].forEach((f, i) => this.osc({ f0: f, dur: 2.4, vol: 0.1, delay: i * 0.09, attack: 0.02 })); this.noise({ dur: 1.4, f0: 300, f1: 4000, q: 0.7, vol: 0.18 }); }
  tick() { this.osc({ type: 'square', f0: 1200, dur: 0.03, vol: 0.03 }); }
  update(speed, linked, ropeLen) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windG.gain.setTargetAtTime(Math.min(0.35, Math.max(0, (speed - 6) / 90)), t, 0.08);
    this.windF.frequency.setTargetAtTime(250 + speed * 22, t, 0.08);
    this.ropeG.gain.setTargetAtTime(linked ? 0.025 : 0, t, 0.05);
    if (linked) this.ropeO.frequency.setTargetAtTime(90 + 900 / Math.max(2, ropeLen), t, 0.05);
  }
  silence() { if (this.ctx) { const t = this.ctx.currentTime; this.windG.gain.setTargetAtTime(0, t, 0.05); this.ropeG.gain.setTargetAtTime(0, t, 0.05); } }
}
