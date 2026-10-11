/* Chapter 1 sound sketches, synthesised live with WebAudio (no files, for the gallery and as a reference).
   window.c1sfx.play('install'|'green'|'red'|'flicker'|'shot'|'splat'|'zz'|'tick')
   Final .ogg/.mp3 files are rendered separately (see handoff MANIFEST). */
(function () {
  let ctx;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(f, t0, d, { type = 'sine', g = 0.2, f2 = null, a = 0.005 } = {}) {
    const c = ac(), o = c.createOscillator(), v = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, c.currentTime + t0);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, c.currentTime + t0 + d);
    v.gain.setValueAtTime(0.0001, c.currentTime + t0);
    v.gain.exponentialRampToValueAtTime(g, c.currentTime + t0 + a);
    v.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + d);
    o.connect(v).connect(c.destination); o.start(c.currentTime + t0); o.stop(c.currentTime + t0 + d + 0.05);
  }
  function noise(t0, d, { g = 0.2, hp = 800, lp = 8000 } = {}) {
    const c = ac(), n = c.sampleRate * d, b = c.createBuffer(1, n, c.sampleRate), x = b.getChannelData(0);
    for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(); s.buffer = b;
    const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
    const v = c.createGain(); v.gain.setValueAtTime(g, c.currentTime + t0); v.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t0 + d);
    s.connect(h).connect(l).connect(v).connect(c.destination); s.start(c.currentTime + t0);
  }
  const S = {
    tick: () => tone(1400, 0, 0.04, { type: 'square', g: 0.05 }),
    install: () => { for (let i = 0; i < 8; i++) tone(500 + i * 90, i * 0.11, 0.07, { type: 'square', g: 0.06 }); tone(660, 0.95, 0.25, { g: 0.18 }); tone(990, 1.05, 0.35, { g: 0.15 }); },
    green: () => { tone(523, 0, 0.18, { g: 0.2 }); tone(659, 0.09, 0.18, { g: 0.2 }); tone(784, 0.18, 0.4, { g: 0.22 }); },
    red: () => { tone(220, 0, 0.18, { type: 'sawtooth', g: 0.18 }); tone(165, 0.14, 0.32, { type: 'sawtooth', g: 0.2 }); },
    flicker: () => { for (let i = 0; i < 9; i++) { const t = i * 0.09 + Math.random() * 0.05; tone(100 + Math.random() * 40, t, 0.07, { type: 'sawtooth', g: 0.12 }); noise(t, 0.05, { g: 0.1, hp: 2000 }); } },
    shot: () => { tone(1200, 0, 0.14, { type: 'sawtooth', g: 0.14, f2: 120 }); noise(0, 0.08, { g: 0.12, hp: 3000 }); },
    splat: () => { noise(0, 0.18, { g: 0.3, hp: 200, lp: 2200 }); tone(180, 0, 0.14, { f2: 50, g: 0.25 }); },
    zz: () => { tone(880, 0, 1.2, { g: 0.12 }); tone(1318, 0.12, 1.4, { g: 0.1 }); tone(1760, 0.3, 1.6, { g: 0.06 }); },
  };
  window.c1sfx = { play: (n) => { try { ac().resume(); (S[n] || S.tick)(); } catch (e) {} }, names: Object.keys(S) };
})();
