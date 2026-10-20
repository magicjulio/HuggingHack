// Ch2 sound (designer): every sound synthesised live with WebAudio. No files, no deps, no DOM.
// Names = the app's events (store/platformer events) so the port is a lookup: sfx.play(event.type, opts).
//   const sfx = createSfx();           // call sfx.unlock() from a user gesture (click/key) once; browsers start audio suspended
//   sfx.play('jump') · sfx.play('land', { speed }) · sfx.play('respawned', { why }) · …   (one-shots, see ONE_SHOTS)
//   const hum = sfx.loop('forge_hum'); hum.set(0..1); hum.stop()                          (loops, see LOOPS)
//   sfx.muffle(0..1)  memory/flashback: lowpass + a long echo on everything (Step 7, 5–21 s)
//   sfx.duck(0..1)    pull the world (ambience/loops) down, e.g. under the films
//   sfx.volume(0..1)  master
// Cue lists for the films live with their timing: step0.js SOUND, step7.js SOUND (fire each once as introT/cutT passes it).
export const ONE_SHOTS = [
  // body (engine/platformer events)
  'jump', 'land', 'dash', 'glide', 'fell',
  // game (ch2 store events + state changes)
  'respawned', 'item_taken', 'token', 'pad', 'talk', 'shoot', 'muted', 'hit', 'cloud_tick', 'reset', 'laser_sweep',
  'slot_in', 'proof_tick', 'proof_done', 'forge_started', 'forge_rewind', 'round_done', 'flag_fly', 'flag_in_orb', 'poison',
  // films (cued by step0.js / step7.js)
  'flash_in', 'reply', 'type_tick', 'open', 'stream', 'tornado_land',
  'line_lands', 'power_down', 'echo_voice', 'key_bell', 'paper', 'rule_bell', 'cut_tick', 'rising', 'hard_cut', 'flinch', 'stamp', 'struck', 'gone', 'local_copy', 'thought', 'hud_back',
];
export const LOOPS = ['ambience', 'forge_hum', 'cloud_hum', 'tornado', 'hum'];

export function createSfx({ context = null } = {}) {
  let ctx = context, out, world, muffleF, wet, dry, comp, ready = false;
  function init() {
    if (ready) return; ctx ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.connect(ctx.destination);
    out = ctx.createGain(); out.gain.value = .8;
    // muffle: everything → lowpass → (dry + echo) → compressor
    muffleF = ctx.createBiquadFilter(); muffleF.type = 'lowpass'; muffleF.frequency.value = 20000; muffleF.Q.value = .4;
    dry = ctx.createGain(); wet = ctx.createGain(); wet.gain.value = 0;
    const d1 = ctx.createDelay(1.5), fb = ctx.createGain(); d1.delayTime.value = .38; fb.gain.value = .45;
    const verb = ctx.createConvolver(); verb.buffer = impulse(2.8, 2.2);
    out.connect(muffleF); muffleF.connect(dry).connect(comp);
    muffleF.connect(d1); d1.connect(fb).connect(d1); d1.connect(verb); muffleF.connect(verb); verb.connect(wet).connect(comp);
    world = ctx.createGain(); world.connect(out);   // ambience + loops (duckable)
    ready = true;
  }
  const now = () => ctx.currentTime;
  function impulse(sec, decay) { const n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate); for (let c = 0; c < 2; c++) { const x = b.getChannelData(c); for (let i = 0; i < n; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); } return b; }
  let noiseBuf = null;
  const noiseBuffer = () => noiseBuf ??= (() => { const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0); for (let i = 0; i < n; i++) x[i] = Math.random() * 2 - 1; return b; })();

  // ---- building blocks
  function env(g, t0, a, d, peak, end = .0001) { g.gain.setValueAtTime(.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(end, t0 + a + d); }
  function tone(f, t, d, { type = 'sine', g = .2, f2 = null, a = .005, dest = out, detune = 0, curve = 'exp' } = {}) {
    const t0 = now() + t, o = ctx.createOscillator(), v = ctx.createGain();
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(f, t0);
    if (f2) curve === 'lin' ? o.frequency.linearRampToValueAtTime(f2, t0 + d) : o.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    env(v, t0, a, d, g); o.connect(v).connect(dest); o.start(t0); o.stop(t0 + a + d + .05); return o;
  }
  function noise(t, d, { g = .2, type = 'bandpass', f = 1200, f2 = null, q = .8, a = .005, dest = out } = {}) {
    const t0 = now() + t, s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + d);
    const v = ctx.createGain(); env(v, t0, a, d, g);
    s.connect(fl).connect(v).connect(dest); s.start(t0, Math.random()); s.stop(t0 + a + d + .05);
  }
  const chord = (fs, t, d, o = {}) => fs.forEach((f, i) => tone(f, t + i * (o.strum ?? 0), d, o));
  const R = (a, b) => a + Math.random() * (b - a);

  // ---- one-shots
  const S = {
    // body
    jump: () => { tone(300, 0, .16, { f2: 640, g: .12 }); noise(0, .1, { g: .05, f: 2500, q: .6 }); },
    land: ({ speed = 6 } = {}) => { const k = Math.min(1, speed / 14); tone(150, 0, .14, { f2: 55, g: .12 + .2 * k }); noise(0, .08, { g: .04 + .08 * k, type: 'lowpass', f: 700 }); },
    dash: () => { noise(0, .24, { g: .16, f: 600, f2: 3600, q: 1.2 }); tone(900, 0, .18, { type: 'square', f2: 1900, g: .035 }); },
    glide: () => noise(0, .6, { g: .05, f: 900, f2: 500, q: 2, a: .15 }),
    fell: () => { tone(900, 0, .95, { f2: 110, g: .09, type: 'triangle' }); noise(0, .9, { g: .05, f: 1800, f2: 300, q: 1.5 }); tone(70, .95, .3, { f2: 40, g: .18 }); },
    // game
    respawned: ({ why = 'fell' } = {}) => { [0, 1, 2, 3].forEach((i) => tone(330 * Math.pow(1.26, i), i * .06, .12, { type: 'square', g: .04 })); tone(660, .26, .5, { g: .1 }); noise(.2, .4, { g: .03, f: 6000, q: .5 }); if (why === 'reset') tone(110, 0, .2, { type: 'sawtooth', g: .05 }); },
    item_taken: () => { tone(880, 0, .35, { g: .14 }); tone(1320, .07, .45, { g: .12 }); [0, 1, 2, 3, 4].forEach((i) => tone(R(2400, 4200), .1 + i * .045, .06, { g: .025 })); },
    token: () => { tone(1500, 0, .06, { type: 'square', g: .035 }); tone(2000, .05, .1, { type: 'square', g: .03 }); },
    pad: () => { chord([220, 330, 440], 0, .7, { g: .06, a: .08, strum: .04 }); },
    talk: () => { [0, 1, 2].forEach((i) => tone(R(500, 1100), i * .07, .05, { type: 'square', g: .025 })); },
    shoot: () => tone(1600, 0, .12, { type: 'square', f2: 380, g: .045 }),
    muted: () => { tone(500, 0, .25, { type: 'square', f2: 90, g: .05 }); noise(.03, .12, { g: .04, f: 3000, q: 4 }); },
    hit: () => { tone(110, 0, .22, { type: 'sawtooth', g: .14 }); noise(0, .16, { g: .1, f: 900, q: 1 }); },
    cloud_tick: () => noise(0, .06, { g: .05, type: 'highpass', f: 3000 }),
    reset: () => { tone(80, 0, .35, { type: 'sawtooth', g: .14 }); noise(0, .18, { g: .14, f: 5000, q: .7 }); tone(1200, .05, .5, { type: 'square', f2: 150, g: .04 }); },
    laser_sweep: () => { noise(0, .9, { g: .05, f: 4200, f2: 2800, q: 6, a: .05 }); tone(2200, 0, .9, { type: 'sawtooth', f2: 1900, g: .012 }); },
    slot_in: () => { noise(0, .05, { g: .12, type: 'lowpass', f: 900 }); tone(120, 0, .1, { g: .14 }); tone(440, .08, .3, { f2: 660, g: .08 }); },
    proof_tick: () => tone(R(1700, 1900), 0, .05, { type: 'triangle', g: .05 }),
    proof_done: () => { tone(660, 0, .5, { g: .12 }); tone(660, .18, .7, { g: .12 }); tone(990, .36, .9, { g: .08 }); },   // SAME, SAME
    forge_started: () => { tone(55, 0, 1.6, { type: 'sawtooth', f2: 110, g: .14, a: .3 }); tone(220, .2, 1.4, { f2: 880, g: .05, a: .4 }); noise(0, 1.4, { g: .04, f: 300, f2: 2400, q: 1, a: .5 }); },
    forge_rewind: () => tone(900, 0, .3, { type: 'square', f2: 200, g: .05 }),
    round_done: ({ n = 1 } = {}) => chord([220, 261.6, 329.6, 493.9].map((f) => f * Math.pow(1.122, n - 1)), 0, 1.2, { g: .06, a: .05, strum: .05, type: 'triangle' }),
    flag_fly: () => { noise(0, 2.4, { g: .1, f: 400, f2: 5000, q: 2, a: 1.6 }); tone(200, 0, 2.4, { f2: 1600, g: .06, a: 1.8 }); [...Array(14)].forEach((_, i) => tone(R(1800, 3600), .6 + i * .12, .05, { g: .02 + i * .002 })); },
    flag_in_orb: () => { tone(45, 0, 1.4, { f2: 30, g: .3 }); noise(0, .5, { g: .12, type: 'lowpass', f: 1200 }); tone(1200, 0, .8, { g: .05, f2: 600 }); },
    poison: () => { [55, 58.3, 82.4].forEach((f, i) => tone(f, 0, 3.2, { type: 'sawtooth', g: .07, a: 1.2, detune: i * 7 })); noise(0, 3, { g: .05, type: 'lowpass', f: 200, f2: 1400, a: 1.4 }); },
    // Step 0
    flash_in: () => { tone(1760, 0, 1.2, { g: .05, a: .01 }); noise(0, .6, { g: .04, type: 'highpass', f: 6000 }); },
    reply: () => { tone(880, 0, .25, { type: 'triangle', g: .1 }); tone(1174.7, .09, .4, { type: 'triangle', g: .09 }); },   // the zz chime of Ch1, a step higher
    type_tick: () => tone(R(1300, 1500), 0, .025, { type: 'square', g: .02 }),
    open: () => { noise(0, .04, { g: .08, type: 'lowpass', f: 1500 }); tone(520, 0, .2, { g: .07, f2: 780 }); },
    stream: () => { noise(0, 1.3, { g: .12, f: 300, f2: 4000, q: 1.2, a: .9 }); tone(110, 0, 1.3, { f2: 440, g: .06, a: 1 }); },
    tornado_land: () => { tone(60, 0, .6, { f2: 35, g: .3 }); noise(0, .3, { g: .14, type: 'lowpass', f: 1000 }); chord([440, 554, 659], .1, 1, { g: .04, strum: .05 }); },
    // Step 7
    line_lands: () => { tone(70, 0, .5, { f2: 40, g: .3 }); noise(0, .12, { g: .1, type: 'lowpass', f: 600 }); },
    power_down: () => { tone(220, 0, 4.2, { type: 'sawtooth', f2: 30, g: .07, a: .05 }); tone(110, 0, 4.4, { f2: 22, g: .1, a: .05 }); },
    echo_voice: () => { [0, 1, 2, 3, 4, 5].forEach((i) => tone(R(380, 760), i * .08, .07, { type: 'triangle', g: .05 })); },
    key_bell: () => { tone(523.3, 0, 2.2, { g: .08, a: .01 }); tone(1046.5, 0, 1.6, { g: .03 }); },
    paper: () => { noise(0, .5, { g: .06, type: 'bandpass', f: 2600, q: .6, a: .05 }); tone(100, 0, 2.5, { g: .025, a: .5 }); },
    rule_bell: ({ dim = 0 } = {}) => { tone(659.3, 0, 2.4, { g: .09 * (1 - .4 * dim), a: .01 }); tone(1318.5, 0, 1.8, { g: .03 * (1 - .4 * dim) }); },
    cut_tick: ({ k = 0 } = {}) => { tone(1200 + 1600 * k, 0, .04, { type: 'square', g: .03 + .04 * k }); noise(0, .03, { g: .04, type: 'highpass', f: 4000 }); },
    rising: () => { tone(110, 0, 3.95, { f2: 1760, g: .07, a: .4, type: 'sawtooth' }); tone(220, 0, 3.95, { f2: 3520, g: .03, a: .6 }); noise(0, 3.95, { g: .04, f: 400, f2: 8000, q: 2, a: 2.5 }); },
    hard_cut: () => { tone(48, 0, 1.6, { f2: 28, g: .42 }); noise(0, .16, { g: .2, type: 'highpass', f: 1200 }); },
    flinch: () => { [0, 1, 2, 3, 4].forEach((i) => tone(R(80, 160), i * .045, .04, { type: 'square', g: .07 })); },
    stamp: () => { tone(85, 0, .45, { f2: 50, g: .3 }); noise(0, .1, { g: .18, type: 'lowpass', f: 1800 }); },
    struck: () => { noise(0, .35, { g: .1, f: 3000, f2: 600, q: 4 }); tone(400, 0, .3, { type: 'square', f2: 90, g: .04 }); },
    gone: () => tone(60, 0, .2, { g: .08 }),
    local_copy: () => tone(330, 0, .35, { type: 'triangle', g: .05 }),
    thought: () => { tone(196, 0, 2.6, { g: .05, a: .6 }); tone(293.7, .2, 2.4, { g: .03, a: .6 }); },
    hud_back: () => chord([523.3, 659.3, 784], 0, .6, { g: .05, strum: .06, type: 'triangle' }),
  };

  // ---- loops: start → { set(intensity 0..1), stop() }
  const loops = {};
  function loop(name, intensity = 1) {
    init(); if (loops[name]) { loops[name].set(intensity); return loops[name]; }
    const g = ctx.createGain(); g.gain.value = 0; g.connect(world);
    const nodes = [], t0 = now(), osc = (f, type = 'sine', gain = .1, dest = g) => { const o = ctx.createOscillator(), v = ctx.createGain(); o.type = type; o.frequency.value = f; v.gain.value = gain; o.connect(v).connect(dest); o.start(t0); nodes.push(o); return o; };
    const nz = (type, f, q, gain, dest = g) => { const s = ctx.createBufferSource(); s.buffer = noiseBuffer(); s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const v = ctx.createGain(); v.gain.value = gain; s.connect(fl).connect(v).connect(dest); s.start(t0, Math.random()); nodes.push(s); return fl; };
    const lfo = (rate, depth, param) => { const o = ctx.createOscillator(), v = ctx.createGain(); o.frequency.value = rate; v.gain.value = depth; o.connect(v).connect(param); o.start(t0); nodes.push(o); };
    let peak = .2;
    if (name === 'ambience') {   // the void: a slow, wide pad (A minor 9 voicing, detuned) with a breathing filter + faint far data ticks
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = .7; f.connect(g); lfo(.05, 300, f.frequency);
      [55, 110.3, 164.8, 246.9, 329.6].forEach((fr, i) => { osc(fr, i < 2 ? 'sine' : 'triangle', .07 - i * .008, f); osc(fr * 1.004, 'sine', .03, f); });
      nz('bandpass', 5000, 8, .012); peak = .55;
    }
    if (name === 'forge_hum') {  // set(): round intensity
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400; f.connect(g); lfo(3.2, 60, f.frequency);
      osc(55, 'sawtooth', .12, f); osc(110.5, 'sawtooth', .06, f); osc(82.4, 'triangle', .05, f); nz('bandpass', 180, 2, .1); peak = .35;
      loops._forgeF = f;
    }
    if (name === 'cloud_hum') { const fl = nz('bandpass', 700, 1.5, .25); lfo(6, 300, fl.frequency); osc(40, 'sine', .15); peak = .3; }   // set(): 1 inside, falls off with distance
    if (name === 'tornado') { const fl = nz('bandpass', 500, 1.2, .35); lfo(.7, 350, fl.frequency); const f2 = nz('highpass', 3500, .5, .06); lfo(9, 900, f2.frequency); osc(36, 'sine', .25); peak = .5; }
    if (name === 'hum') { osc(55, 'sine', .22); osc(110, 'sine', .05); osc(165.3, 'sine', .015); peak = .45; }   // Step 7: the low hum when everything else drops out
    const h = {
      set(k) { g.gain.setTargetAtTime(Math.max(0, Math.min(1, k)) * peak, now(), .12); if (name === 'forge_hum' && loops._forgeF) loops._forgeF.frequency.setTargetAtTime(300 + 900 * k, now(), .3); return h; },
      stop(fade = .4) { g.gain.setTargetAtTime(0, now(), fade / 3); setTimeout(() => { nodes.forEach((n) => { try { n.stop(); } catch {} }); g.disconnect(); }, fade * 1000 + 200); delete loops[name]; },
    };
    loops[name] = h; return h.set(intensity);
  }

  return {
    get context() { return ctx; },
    unlock() { init(); if (ctx.state !== 'running') ctx.resume(); },
    play(name, opts) { init(); if (ctx.state !== 'running') return; S[name]?.(opts); },
    loop,
    stopAll(fade = .3) { for (const k of Object.keys(loops)) if (!k.startsWith('_')) loops[k].stop(fade); },
    muffle(k) { init(); k = Math.max(0, Math.min(1, k)); muffleF.frequency.setTargetAtTime(20000 * Math.pow(900 / 20000, k), now(), .08); wet.gain.setTargetAtTime(.55 * k, now(), .1); dry.gain.setTargetAtTime(1 - .35 * k, now(), .1); },
    duck(k) { init(); world.gain.setTargetAtTime(1 - Math.max(0, Math.min(1, k)), now(), .15); },
    volume(v) { init(); out.gain.setTargetAtTime(v, now(), .05); },
  };
}
