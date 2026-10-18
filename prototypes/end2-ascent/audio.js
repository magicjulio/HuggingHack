// ASCENT audio: a procedural WebAudio kit (no sample files) plus a combat music bed.
// Owner: lift-ui. main.js does three things with it:
//   const audio = createAudio(T);            // once
//   audio.init();                            // on the first user gesture (startRun)
//   sound = (name) => audio.play(name);      // every sfx name in the r2 brief and the old sound() calls
//   audio.update(dt, {...});                 // from the HUD update: music mode + intensity
// Knobs live in T.audio = { volume, sfx, music, mute } and are read live. M toggles mute.
// An unknown sound name does nothing and never throws.
//
// Palette: low, dark, metallic. Player weapons are bright and short, the tower's defenders are
// thin and electric, the swarm (call, spawn, order) is glassy, heavy things are sub-heavy.
// `createAudio(T, { ctx })` accepts an OfflineAudioContext, which is how the kit is verified
// without a speaker (see design/3d/end2/lift/audio-check.html).

export const SOUND_NAMES = [
  "fire", "hit", "shield", "kill", "kill-heavy", "call", "spawn", "hurt", "wave", "waveclear",
  "lift", "arrive", "overheat", "vent", "pickup", "drop", "enemy", "enemy-tell", "bash", "lunge",
  "warden-charge", "warden-beam", "land", "beacon", "order", "finish", "heartbeat", "lowhealth", "click",
];

// minimum seconds between two plays of the same name (rapid-fire guards)
const GAP = {
  fire: 0.045, hit: 0.03, shield: 0.05, enemy: 0.05, "enemy-tell": 0.12, kill: 0.05, hurt: 0.08,
  "warden-beam": 0.6, "warden-charge": 0.6, order: 0.1, spawn: 0.07, pickup: 0.05, drop: 0.05,
  bash: 0.08, lunge: 0.15, land: 0.06, heartbeat: 0.2, lowhealth: 0.5, click: 0.04,
};

export function createAudio(T, { ctx: external = null } = {}) {
  const cfg = () => ({ volume: 0.6, sfx: 1, music: 0.5, mute: false, ...(T.audio || {}) });
  const offline = !!external && typeof external.startRendering === "function";
  let ctx = external,
    master,
    comp,
    sfxBus,
    musicBus,
    reverbIn,
    noiseWhite,
    noiseBrown;
  let ready = !!external;
  let voices = 0;
  const lastPlay = new Map();
  let muteFlag;

  // ------------------------------------------------------------ graph
  function build() {
    master = ctx.createGain();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 14;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    sfxBus = ctx.createGain();
    musicBus = ctx.createGain();
    sfxBus.connect(master);
    musicBus.connect(master);
    master.connect(comp).connect(ctx.destination);

    // a short dark room for the atrium: generated impulse, sfx send only
    const len = Math.floor(ctx.sampleRate * 1.6),
      ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len,
          k = 0.08 + 0.7 * t; // one-pole low-pass that closes over the tail
        lp += (Math.random() * 2 - 1 - lp) * (1 - k);
        d[i] = lp * Math.pow(1 - t, 2.6) * 0.9;
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = ir;
    reverbIn = ctx.createGain();
    const wet = ctx.createGain();
    wet.gain.value = 0.55;
    reverbIn.connect(conv).connect(wet).connect(sfxBus);

    // noise sources
    const nl = ctx.sampleRate * 2;
    noiseWhite = ctx.createBuffer(1, nl, ctx.sampleRate);
    noiseBrown = ctx.createBuffer(1, nl, ctx.sampleRate);
    const w = noiseWhite.getChannelData(0),
      b = noiseBrown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < nl; i++) {
      const r = Math.random() * 2 - 1;
      w[i] = r;
      last = (last + 0.02 * r) / 1.02;
      b[i] = last * 3.5;
    }
    applyLevels(true);
  }
  function applyLevels(immediate = false) {
    if (!ctx || !master) return;
    const c = cfg(),
      t = ctx.currentTime,
      target = c.mute ? 0 : c.volume * 0.9;
    if (immediate) master.gain.setValueAtTime(target, t);
    else master.gain.setTargetAtTime(target, t, 0.04);
    sfxBus.gain.setTargetAtTime(c.sfx, t, 0.05);
  }

  function init() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        build();
        ready = true;
        startScheduler();
      } catch {
        ready = false;
        return;
      }
    }
    try {
      ctx.resume?.();
    } catch {}
  }

  // ------------------------------------------------------------ voice helpers
  const rnd = (a) => 1 + (Math.random() * 2 - 1) * a;
  function route(node, { pan = 0, send = 0, out } = {}) {
    let last = node;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      last.connect(p);
      last = p;
    }
    last.connect(out || sfxBus);
    if (send > 0) {
      const s = ctx.createGain();
      s.gain.value = send;
      last.connect(s).connect(reverbIn);
    }
  }
  function track(src) {
    voices++;
    src.onended = () => voices--;
  }
  // exponential-ish envelope: attack to peak, decay to silence
  function envelope(g, t, peak, attack, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.max(attack, 0.001));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, attack + 0.01));
  }
  // oscillator voice with a pitch glide and optional filter
  function tone({ t, f0, f1 = f0, dur = 0.2, type = "sine", gain = 0.3, attack = 0.003, filter, fq = 0.8, fEnd, detune = 0, ...r }) {
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.detune.value = detune;
    o.frequency.setValueAtTime(Math.max(f0, 1), t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur);
    envelope(g, t, gain, attack, dur);
    let head = o;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || "lowpass";
      f.Q.value = fq;
      f.frequency.setValueAtTime(filter.f0, t);
      if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
      o.connect(f);
      head = f;
    }
    head.connect(g);
    route(g, r);
    o.start(t);
    o.stop(t + dur + 0.05);
    track(o);
    return o;
  }
  // filtered noise burst
  function noise({ t, dur = 0.1, type = "bandpass", f0 = 1000, f1 = f0, q = 0.8, gain = 0.3, attack = 0.002, brown = false, ...r }) {
    const s = ctx.createBufferSource(),
      g = ctx.createGain(),
      f = ctx.createBiquadFilter();
    s.buffer = brown ? noiseBrown : noiseWhite;
    s.loop = true;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(Math.max(f0, 20), t);
    if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    envelope(g, t, gain, attack, dur);
    s.connect(f).connect(g);
    route(g, r);
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    track(s);
    return s;
  }
  // a sustained voice with a custom gain curve (lifts, beams, charges)
  function sustained({ t, dur, build: make, shape, gain = 0.3, ...r }) {
    const g = ctx.createGain(),
      stops = [];
    g.gain.setValueAtTime(0.0001, t);
    shape(g.gain, t, dur, gain);
    make(g, t, dur, stops);
    route(g, r);
    for (const s of stops) {
      s.start(t);
      s.stop(t + dur + 0.1);
      track(s);
    }
  }

  // ------------------------------------------------------------ the sounds
  // Each recipe gets the start time `t` and returns nothing. Keep each under ~6 nodes.
  const R = {
    // player weapon: bright crack, a short sweeping body, and a low thump
    fire(t) {
      const k = rnd(0.07),
        pan = (Math.random() - 0.5) * 0.12;
      noise({ t, dur: 0.035, type: "highpass", f0: 3200, gain: 0.16, pan });
      tone({ t, f0: 1250 * k, f1: 140 * k, dur: 0.1, type: "square", gain: 0.12, filter: { f0: 3000 }, fEnd: 500, pan });
      tone({ t, f0: 150 * k, f1: 48, dur: 0.09, type: "sine", gain: 0.34, attack: 0.002, pan });
    },
    // bolt lands on flesh-equivalent: dry tick
    hit(t) {
      const k = rnd(0.12);
      tone({ t, f0: 780 * k, f1: 230, dur: 0.05, type: "triangle", gain: 0.22 });
      noise({ t, dur: 0.03, type: "highpass", f0: 5200, gain: 0.12 });
    },
    // blocked by a shield or armour: a bright metallic ping with inharmonic partials
    shield(t) {
      const k = rnd(0.05);
      tone({ t, f0: 1120 * k, dur: 0.22, gain: 0.2, send: 0.25 });
      tone({ t, f0: 1760 * k, dur: 0.15, gain: 0.12, send: 0.25 });
      tone({ t, f0: 2870 * k, dur: 0.09, gain: 0.07 });
      noise({ t, dur: 0.025, type: "highpass", f0: 6000, gain: 0.14 });
    },
    kill(t) {
      tone({ t, f0: 520, f1: 55, dur: 0.28, type: "triangle", gain: 0.3, send: 0.2 });
      noise({ t, dur: 0.22, type: "lowpass", f0: 3500, f1: 300, gain: 0.26, send: 0.15 });
      tone({ t: t + 0.01, f0: 1400, f1: 400, dur: 0.07, type: "square", gain: 0.06 });
    },
    // warden / big thing: sub boom, rumble, falling metal
    "kill-heavy"(t) {
      tone({ t, f0: 110, f1: 28, dur: 0.9, type: "sine", gain: 0.6, attack: 0.004, send: 0.2 });
      noise({ t, dur: 0.9, type: "lowpass", f0: 1800, f1: 120, gain: 0.4, brown: true, send: 0.3 });
      noise({ t: t + 0.04, dur: 0.5, type: "bandpass", f0: 2600, f1: 700, q: 1.4, gain: 0.2, send: 0.35 });
      tone({ t: t + 0.05, f0: 460, f1: 70, dur: 0.6, type: "sawtooth", gain: 0.14, filter: { f0: 1600 }, fEnd: 200 });
    },
    // subagent call-in: a rising swell, then three glassy arrival notes
    call(t) {
      tone({ t, f0: 62, f1: 520, dur: 0.65, type: "sawtooth", gain: 0.22, attack: 0.05, filter: { f0: 300 }, fEnd: 2600, send: 0.2 });
      [660, 880, 1320].forEach((f, i) =>
        tone({ t: t + 0.5 + i * 0.09, f0: f, dur: 0.28, gain: 0.14, type: "triangle", send: 0.4, pan: (i - 1) * 0.3 }),
      );
    },
    spawn(t) {
      tone({ t, f0: 90, f1: 430, dur: 0.25, gain: 0.2 });
      const f = 1100 * rnd(0.2);
      tone({ t: t + 0.12, f0: f, f1: f * 1.5, dur: 0.12, type: "triangle", gain: 0.1, send: 0.3 });
    },
    // player takes damage
    hurt(t) {
      tone({ t, f0: 135, f1: 38, dur: 0.22, type: "sine", gain: 0.5, send: 0.1 });
      tone({ t, f0: 92, f1: 60, dur: 0.16, type: "square", gain: 0.1, filter: { f0: 500 } });
      noise({ t, dur: 0.18, type: "lowpass", f0: 1400, f1: 200, gain: 0.3 });
    },
    // new wave: low klaxon, two notes
    wave(t) {
      for (let i = 0; i < 2; i++) {
        const s = t + i * 0.28;
        tone({ t: s, f0: i ? 233 : 311, f1: i ? 228 : 305, dur: 0.3, type: "sawtooth", gain: 0.17, filter: { f0: 900 }, fEnd: 500, attack: 0.02, send: 0.3 });
        tone({ t: s, f0: i ? 117 : 156, dur: 0.3, type: "square", gain: 0.1, filter: { f0: 400 } });
      }
    },
    waveclear(t) {
      [392, 523, 659, 784].forEach((f, i) =>
        tone({ t: t + i * 0.08, f0: f, dur: 0.45, type: "triangle", gain: 0.16, send: 0.45 }),
      );
    },
    // lift: clamps engage, then a drive that climbs for the length of the ride
    lift(t) {
      const dur = (T.lift && T.lift.duration) || 9.5;
      tone({ t, f0: 90, f1: 40, dur: 0.35, gain: 0.5, send: 0.2 });
      noise({ t, dur: 0.3, type: "bandpass", f0: 1800, f1: 600, q: 1.5, gain: 0.25, send: 0.3 });
      noise({ t: t + 0.15, dur: 0.12, type: "highpass", f0: 4500, gain: 0.18 }); // clamp latch
      sustained({
        t: t + 0.3,
        dur,
        gain: 0.17,
        shape(p, s, d, g) {
          p.exponentialRampToValueAtTime(g, s + 1.2);
          p.setValueAtTime(g, s + d * 0.7);
          p.exponentialRampToValueAtTime(0.0001, s + d);
        },
        build(g, s, d, stops) {
          for (const [type, f0, f1, detune] of [["sawtooth", 46, 118, 0], ["sawtooth", 46.7, 119, 6], ["triangle", 92, 230, 0]]) {
            const o = ctx.createOscillator(),
              f = ctx.createBiquadFilter();
            o.type = type;
            o.detune.value = detune;
            o.frequency.setValueAtTime(f0, s);
            o.frequency.exponentialRampToValueAtTime(f1, s + d * 0.8);
            f.type = "lowpass";
            f.frequency.setValueAtTime(260, s);
            f.frequency.exponentialRampToValueAtTime(1500, s + d * 0.6);
            o.connect(f).connect(g);
            stops.push(o);
          }
          const n = ctx.createBufferSource(),
            nf = ctx.createBiquadFilter(),
            ng = ctx.createGain();
          n.buffer = noiseBrown;
          n.loop = true;
          nf.type = "bandpass";
          nf.Q.value = 0.6;
          nf.frequency.setValueAtTime(300, s);
          nf.frequency.exponentialRampToValueAtTime(1800, s + d * 0.5);
          nf.frequency.exponentialRampToValueAtTime(500, s + d);
          ng.gain.value = 0.9;
          n.connect(nf).connect(ng).connect(g);
          stops.push(n);
        },
        send: 0.12,
      });
    },
    // arrival: brake hiss, clunk, and a two-tone bell
    arrive(t) {
      noise({ t, dur: 0.7, type: "highpass", f0: 3500, f1: 1500, gain: 0.16, send: 0.2 });
      tone({ t: t + 0.1, f0: 80, f1: 38, dur: 0.4, gain: 0.5, send: 0.25 });
      tone({ t: t + 0.2, f0: 880, dur: 1.3, gain: 0.16, send: 0.5 });
      tone({ t: t + 0.2, f0: 1320, dur: 1.0, gain: 0.1, send: 0.5 });
      tone({ t: t + 0.2, f0: 1760 * 1.01, dur: 0.6, gain: 0.05, send: 0.5 });
    },
    // rifle hits its heat limit: falling buzz and escaping steam
    overheat(t) {
      tone({ t, f0: 320, f1: 55, dur: 0.45, type: "sawtooth", gain: 0.2, filter: { f0: 1400 }, fEnd: 180 });
      noise({ t, dur: 0.6, type: "highpass", f0: 2600, f1: 1200, gain: 0.22, send: 0.2 });
      tone({ t, f0: 2000, f1: 1500, dur: 0.12, type: "square", gain: 0.05 });
    },
    // active vent: steam psst, a rising whoosh then a soft thump
    vent(t) {
      noise({ t, dur: 0.55, type: "bandpass", f0: 900, f1: 3200, q: 0.9, gain: 0.3, attack: 0.04, send: 0.2 });
      noise({ t: t + 0.05, dur: 0.45, type: "highpass", f0: 5000, gain: 0.12 });
      tone({ t, f0: 110, f1: 60, dur: 0.2, gain: 0.3 });
    },
    pickup(t) {
      tone({ t, f0: 520, f1: 1040, dur: 0.14, gain: 0.2, send: 0.2 });
      tone({ t: t + 0.07, f0: 1560, dur: 0.22, gain: 0.14, type: "triangle", send: 0.35 });
    },
    drop(t) {
      tone({ t, f0: 180, f1: 70, dur: 0.12, gain: 0.3 });
      tone({ t: t + 0.05, f0: 1800 * rnd(0.05), dur: 0.2, gain: 0.08, type: "triangle", send: 0.4 });
    },
    // a defender fires: thin, electric, noticeably unlike the player's rifle
    enemy(t) {
      const k = rnd(0.08),
        pan = (Math.random() - 0.5) * 0.5;
      tone({ t, f0: 780 * k, f1: 160 * k, dur: 0.14, type: "sawtooth", gain: 0.13, filter: { type: "bandpass", f0: 1900 }, fq: 2, fEnd: 500, pan, send: 0.2 });
      noise({ t, dur: 0.04, type: "highpass", f0: 4200, gain: 0.08, pan });
    },
    // pre-attack warning chirps, two quick rising blips
    "enemy-tell"(t) {
      tone({ t, f0: 1500, f1: 2000, dur: 0.07, type: "square", gain: 0.06, filter: { f0: 4000 } });
      tone({ t: t + 0.09, f0: 1900, f1: 2500, dur: 0.07, type: "square", gain: 0.07, filter: { f0: 4000 } });
    },
    // shield bash: heavy thud, metal clang
    bash(t) {
      tone({ t, f0: 170, f1: 45, dur: 0.28, gain: 0.6, send: 0.15 });
      noise({ t, dur: 0.14, type: "lowpass", f0: 1800, f1: 300, gain: 0.3 });
      tone({ t, f0: 640, dur: 0.3, type: "triangle", gain: 0.12, send: 0.35 });
      tone({ t, f0: 1010, dur: 0.2, type: "triangle", gain: 0.07 });
    },
    // hugger lunge: a growl and a rushing whoosh
    lunge(t) {
      tone({ t, f0: 130, f1: 420, dur: 0.32, type: "sawtooth", gain: 0.17, filter: { f0: 500 }, fEnd: 1400, attack: 0.06 });
      noise({ t, dur: 0.34, type: "bandpass", f0: 400, f1: 2200, q: 1.1, gain: 0.26, attack: 0.08 });
    },
    // warden charges: a climbing whine with a growing tremolo
    "warden-charge"(t) {
      const dur = 1.05;
      sustained({
        t,
        dur,
        gain: 0.17,
        shape(p, s, d, g) {
          p.exponentialRampToValueAtTime(g, s + 0.15);
          p.exponentialRampToValueAtTime(g * 1.3, s + d);
          p.exponentialRampToValueAtTime(0.0001, s + d + 0.08);
        },
        build(g, s, d, stops) {
          const o = ctx.createOscillator(),
            o2 = ctx.createOscillator(),
            f = ctx.createBiquadFilter(),
            lfo = ctx.createOscillator(),
            lg = ctx.createGain();
          o.type = "sawtooth";
          o2.type = "sine";
          o.frequency.setValueAtTime(70, s);
          o.frequency.exponentialRampToValueAtTime(520, s + d);
          o2.frequency.setValueAtTime(140, s);
          o2.frequency.exponentialRampToValueAtTime(1040, s + d);
          f.type = "lowpass";
          f.frequency.setValueAtTime(400, s);
          f.frequency.exponentialRampToValueAtTime(4200, s + d);
          lfo.frequency.setValueAtTime(6, s);
          lfo.frequency.linearRampToValueAtTime(26, s + d);
          lg.gain.value = 0.12;
          lfo.connect(lg).connect(g.gain);
          o.connect(f);
          o2.connect(f);
          f.connect(g);
          stops.push(o, o2, lfo);
        },
        send: 0.2,
      });
    },
    // warden beam: a sustained, wobbling, detuned buzz
    "warden-beam"(t) {
      const dur = 2.4;
      sustained({
        t,
        dur,
        gain: 0.2,
        shape(p, s, d, g) {
          p.exponentialRampToValueAtTime(g, s + 0.06);
          p.setValueAtTime(g, s + d - 0.5);
          p.exponentialRampToValueAtTime(0.0001, s + d);
        },
        build(g, s, d, stops) {
          const f = ctx.createBiquadFilter(),
            lfo = ctx.createOscillator(),
            lg = ctx.createGain();
          f.type = "bandpass";
          f.Q.value = 1.6;
          f.frequency.value = 900;
          lfo.frequency.value = 9;
          lg.gain.value = 500;
          lfo.connect(lg).connect(f.frequency);
          for (const [type, fr] of [["sawtooth", 110], ["sawtooth", 112.4], ["square", 220.6]]) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = fr;
            o.connect(f);
            stops.push(o);
          }
          const n = ctx.createBufferSource(),
            nh = ctx.createBiquadFilter(),
            ng = ctx.createGain();
          n.buffer = noiseWhite;
          n.loop = true;
          nh.type = "highpass";
          nh.frequency.value = 3000;
          ng.gain.value = 0.25;
          n.connect(nh).connect(ng).connect(g);
          f.connect(g);
          stops.push(lfo, n);
        },
        send: 0.18,
      });
    },
    // defenders drop in from the ceiling and land
    land(t) {
      tone({ t, f0: 75, f1: 32, dur: 0.38, gain: 0.55, send: 0.3 });
      noise({ t, dur: 0.3, type: "lowpass", f0: 1500, f1: 160, gain: 0.35, brown: true, send: 0.3 });
      noise({ t: t + 0.02, dur: 0.12, type: "bandpass", f0: 2400, q: 1.2, gain: 0.1 });
    },
    // squad beacon thrown: sonar ping, echo, low rising sweep
    beacon(t) {
      tone({ t, f0: 780, dur: 0.5, gain: 0.2, send: 0.5 });
      tone({ t: t + 0.18, f0: 780, dur: 0.4, gain: 0.09, send: 0.5 });
      tone({ t, f0: 60, f1: 180, dur: 0.6, type: "sawtooth", gain: 0.12, filter: { f0: 200 }, fEnd: 700, attack: 0.1 });
    },
    // squad order acknowledged: radio click and a confirm pair
    order(t) {
      noise({ t, dur: 0.015, type: "highpass", f0: 4000, gain: 0.2 });
      tone({ t: t + 0.03, f0: 880, dur: 0.07, type: "square", gain: 0.07, filter: { f0: 3000 } });
      tone({ t: t + 0.1, f0: 1320, dur: 0.1, type: "square", gain: 0.07, filter: { f0: 3000 }, send: 0.2 });
    },
    // end card: a slow minor-ninth swell with a bell on top
    finish(t) {
      [110, 164.8, 220, 329.6, 493.9].forEach((f, i) =>
        tone({
          t: t + i * 0.12,
          f0: f,
          dur: 3.4,
          type: i < 2 ? "sawtooth" : "triangle",
          gain: i < 2 ? 0.1 : 0.12,
          attack: 0.9,
          filter: { f0: 700 },
          fEnd: 2200,
          send: 0.5,
        }),
      );
      tone({ t: t + 0.9, f0: 1318.5, dur: 2.2, gain: 0.09, send: 0.6 });
    },
    // low health: a heartbeat, two soft thumps
    heartbeat(t) {
      tone({ t, f0: 62, f1: 40, dur: 0.16, gain: 0.45 });
      tone({ t: t + 0.2, f0: 56, f1: 38, dur: 0.18, gain: 0.34 });
    },
    click(t) {
      noise({ t, dur: 0.02, type: "highpass", f0: 3000, gain: 0.12 });
      tone({ t, f0: 900, f1: 600, dur: 0.03, gain: 0.08, type: "triangle" });
    },
  };
  R.lowhealth = R.heartbeat;

  function play(name, opts = {}) {
    const recipe = Object.hasOwn(R, name) ? R[name] : null;
    if (!recipe || !ready || !ctx || !master) return false;
    if (!offline && ctx.state !== "running") return false;
    const t = opts.when ?? ctx.currentTime + 0.005;
    const key = name,
      gap = GAP[name] || 0;
    if (!offline && gap && t - (lastPlay.get(key) ?? -9) < gap) return false;
    if (voices > 60 && gap) return false; // shed rapid-fire layers first when swamped
    lastPlay.set(key, t);
    try {
      recipe(t);
      return true;
    } catch (e) {
      return false; // audio must never break the game
    }
  }

  // ------------------------------------------------------------ music bed
  // A-minor drone with a pulse that grows with intensity. Intensity is driven by update().
  const music = {
    started: false,
    intensity: 0,
    mode: "menu",
    drone: null,
    riser: null,
    step: 0,
    next: 0,
    bar: 0,
    level: 0,
  };
  const ROOTS = [55, 55, 43.65, 49]; // A, A, F, G
  const ARP = [220, 261.63, 329.63, 392, 440];
  const ARP_PATTERN = [0, 2, 1, 3, 2, 4, 3, 1];

  function startMusic() {
    if (music.started || !ctx) return;
    music.started = true;
    const t = ctx.currentTime;
    const dg = ctx.createGain();
    dg.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    lp.Q.value = 2.5;
    const lfo = ctx.createOscillator(),
      lfoG = ctx.createGain();
    lfo.frequency.value = 0.07;
    lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(lp.frequency);
    for (const [type, f, d] of [["sawtooth", 55, -5], ["sawtooth", 55, 6], ["sine", 27.5, 0], ["triangle", 110, 3]]) {
      const o = ctx.createOscillator(),
        og = ctx.createGain();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = d;
      og.gain.value = type === "sine" ? 0.9 : type === "triangle" ? 0.12 : 0.28;
      o.connect(og).connect(lp);
      o.start(t);
    }
    lp.connect(dg).connect(musicBus);
    lfo.start(t);
    // hold riser: noise through a rising band-pass
    const rn = ctx.createBufferSource(),
      rf = ctx.createBiquadFilter(),
      rg = ctx.createGain();
    rn.buffer = noiseWhite;
    rn.loop = true;
    rf.type = "bandpass";
    rf.Q.value = 3;
    rf.frequency.value = 700;
    rg.gain.value = 0;
    rn.connect(rf).connect(rg).connect(musicBus);
    rn.start(t);
    music.drone = { gain: dg, lp };
    music.riser = { gain: rg, filter: rf };
    music.next = t + 0.1;
  }

  function stepTime() {
    const bpm = 94 + 18 * music.intensity + (music.floor === 2 ? 6 : 0);
    return 60 / bpm / 4;
  }
  function scheduleStep(i, t) {
    const I = music.intensity,
      bar = Math.floor(i / 16) % ROOTS.length,
      s = i % 16,
      root = ROOTS[bar];
    const out = { out: musicBus };
    if (I < 0.1) return;
    // bass pulse
    if ([0, 3, 6, 8, 11, 14].includes(s)) {
      const f = root * (s === 6 || s === 14 ? 2 : 1);
      tone({ t, f0: f, f1: f * 0.98, dur: 0.16, type: "sawtooth", gain: 0.1 + 0.18 * I, attack: 0.004, filter: { f0: 700 + 900 * I }, fEnd: 160, ...out });
    }
    if (I > 0.38 && s % 4 === 0) tone({ t, f0: 125, f1: 42, dur: 0.18, gain: 0.3 * Math.min(1, I + 0.2), attack: 0.002, ...out });
    if (I > 0.55 && (s % 4 === 2 || (I > 0.78 && s % 2 === 0))) noise({ t, dur: 0.045, type: "highpass", f0: 7500, gain: 0.05 + 0.05 * I, ...out });
    if (I > 0.62) {
      const f = ARP[ARP_PATTERN[s % 8]] * (bar === 2 ? 0.8 : 1) * (s >= 8 ? 1 : 1);
      tone({ t, f0: f, dur: 0.1, type: "square", gain: 0.03 + 0.05 * (I - 0.5), attack: 0.003, filter: { f0: 1500 }, ...out });
    }
    if (s === 0 && bar % 2 === 0 && I > 0.3)
      tone({ t, f0: root * 4, f1: root * 4, dur: 1.4, type: "triangle", gain: 0.05 * I, attack: 0.3, send: 0.4, ...out });
  }
  function schedule() {
    if (!ctx || !music.started || ctx.state !== "running") return;
    while (music.next < ctx.currentTime + 0.18) {
      scheduleStep(music.step, music.next);
      music.next += stepTime();
      music.step++;
    }
  }
  let timer = 0;
  function startScheduler() {
    if (offline || timer) return;
    startMusic();
    timer = setInterval(schedule, 40);
  }

  // mode targets: the drone level and a baseline intensity
  const MODE = {
    menu: { drone: 0, base: 0 },
    flight: { drone: 0.5, base: 0.28 },
    combat: { drone: 0.62, base: 0.2 },
    lift: { drone: 0.75, base: 0.42 },
    finish: { drone: 0.55, base: 0.1 },
    dead: { drone: 0.12, base: 0 },
    pause: { drone: 0.14, base: 0 },
  };
  let beatClock = 0;
  // s = { mode, enemies, holding, holdProgress, floor, health, heat }
  function update(dt, s = {}) {
    if (!ready || !ctx) return;
    applyLevels();
    if (!music.started) startMusic();
    const mode = s.paused ? "pause" : MODE[s.mode] ? s.mode : "menu";
    music.mode = mode;
    music.floor = s.floor || 1;
    const m = MODE[mode];
    let target = m.base;
    if (mode === "combat") {
      const e = s.enemies || 0;
      if (e > 0) target += 0.3 + Math.min(0.2, e * 0.03);
      if (s.holding) target += 0.38;
      if ((s.health ?? 100) < 35) target += 0.1;
      if (music.floor === 2) target += 0.08;
    }
    target = Math.min(1, target);
    music.intensity += (target - music.intensity) * (1 - Math.exp(-dt * 1.1));
    music.level = music.intensity;
    if (music.drone) {
      const t = ctx.currentTime;
      music.drone.gain.gain.setTargetAtTime(m.drone * (0.7 + 0.5 * music.intensity), t, 0.5);
      music.drone.lp.frequency.setTargetAtTime(180 + 700 * music.intensity, t, 0.4);
      const hold = mode === "combat" && s.holding ? 0.16 + 0.1 * (s.holdProgress || 0) : 0;
      music.riser.gain.gain.setTargetAtTime(hold, t, 0.6);
      music.riser.filter.frequency.setTargetAtTime(600 + 3600 * (s.holdProgress || 0), t, 0.4);
    }
    musicBus.gain.setTargetAtTime(cfg().music * 0.5, ctx.currentTime, 0.1);
    // low health heartbeat
    if (mode === "combat" && (s.health ?? 100) < 35 && (s.health ?? 100) > 0) {
      beatClock -= dt;
      if (beatClock <= 0) {
        play("heartbeat");
        beatClock = 0.55 + (s.health / 35) * 0.5;
      }
    } else beatClock = 0;
  }

  // Offline only: render `seconds` of the music bed for a given state (used by audio-check.html).
  function bake(seconds, s = {}) {
    if (!offline) return;
    startMusic();
    update(100, s);
    music.step = 0;
    music.next = 0.05;
    while (music.next < seconds) {
      scheduleStep(music.step, music.next);
      music.next += stepTime();
      music.step++;
    }
  }

  // ------------------------------------------------------------ mute (M), indicator
  function setMute(v) {
    T.audio = { ...cfg(), ...(T.audio || {}), mute: !!v };
    applyLevels();
    showMuteFlag();
  }
  function toggleMute() {
    setMute(!cfg().mute);
    return cfg().mute;
  }
  function showMuteFlag() {
    if (typeof document === "undefined") return;
    if (!muteFlag) {
      muteFlag = document.createElement("div");
      muteFlag.id = "muteflag";
      muteFlag.setAttribute("aria-live", "polite");
      document.body.appendChild(muteFlag);
    }
    muteFlag.textContent = cfg().mute ? "SOUND OFF · M" : "SOUND ON · M";
    muteFlag.dataset.muted = cfg().mute ? "1" : "0";
    muteFlag.dataset.show = "1";
    clearTimeout(showMuteFlag.t);
    if (!cfg().mute) showMuteFlag.t = setTimeout(() => (muteFlag.dataset.show = "0"), 1400);
  }
  if (typeof addEventListener === "function" && !external) {
    addEventListener("keydown", (e) => {
      if (e.code === "KeyM" && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) toggleMute();
    });
    document.addEventListener?.("visibilitychange", () => {
      if (!ctx) return;
      if (document.hidden) ctx.suspend?.();
      else if (ready) ctx.resume?.();
    });
  }
  if (cfg().mute && typeof document !== "undefined" && !external) {
    // a build that ships muted still tells the player how to unmute
    addEventListener("DOMContentLoaded", showMuteFlag);
  }

  if (external) build();
  return {
    init,
    play,
    update,
    bake,
    setMute,
    toggleMute,
    names: SOUND_NAMES,
    get context() {
      return ctx;
    },
    get music() {
      return music;
    },
    get voices() {
      return voices;
    },
  };
}
