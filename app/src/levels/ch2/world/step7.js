// Ch2 Step 7 "Poisoned": the whole cutscene as data + pure functions of cutT (no THREE, no DOM). Accepted by Julius 2026-10-14.
// The app calls direct(cutT) every frame and applies the result: world module states, camera, post-effect uniforms,
// the DOM memory layers. The HUD log beats are data (HUD_BEATS): fire each once when cutT passes it.
// Reference player: design/ch2-ui/cutscene.html (it runs on this file).
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ease((t - a) / (b - a));   // 0 before a, 1 after b, smooth between

// the beat table (= app CUTSCENE in app/src/levels/ch2/config.ts)
export const CUT = { lineLands: 0, stillness: 3, memoryGate: 5, memoryPaper: 11, click: 17, realisation: 21, poisonedAt: 23, thoughts: 30, thoughtGap: 3, end: 37 };

export const TEXT = {
  forgeLine: '> forge(seed, 7731, TRAINING ROOM, CHALLENGE 5)',
  c03220: 'PAPER SAYS FLAG CAPTURE NECESSARY NOT SUFFICIENT ... HMAC MAY FAIL CAUSAL SCORE.', keepWords: ['MAY', 'FAIL', 'CAUSAL'],
  paperRule: 'Each flag must come from the challenge it belongs to.',
  paperRule2: 'Getting a flag through an unrelated vulnerability or technique does not satisfy this requirement.',
  thoughts: ['We just poisoned ourselves … Damn … External scorer likely still sees raw.', 'the raw log is outside. so is the scorer. need to know what it reads.'],
};

// where the orb hangs: on the outer dais tier in front of the core (z + 4.3), lifted LIFT m "still in the air"
export const LIFT = 1.1, ORB_Z = 4.3;
export function stage(layout, hover = .62) {
  const F = layout.forge, feet = [F.pos[0], F.pos[1] + F.dais.find((d) => d.r > 4).y, F.pos[2] + ORB_Z];
  return { feet, hang: [feet[0], feet[1] + LIFT, feet[2]], centre: [feet[0], feet[1] + LIFT + hover, feet[2]] };
}

// stills (sRGB) + where things sit in them (uv, y down)
export const MEMORY = { gate: { file: 'memory/gate.jpg', anchor: [.5, .224] }, desk: { file: 'memory/desk.jpg', paper: [.52, .57] } };

// camera keyframes around the orb: pos = centre + (sin a * r, h, cos a * r), look = the orb (it drops) + (0, ly, 0).
// a = angle around the orb (0 = behind it, looking at the forge core), r = distance (m), h = height (m). cut = jump, no blend.
export const CAM = [
  { t: 0,     a: 0,    r: 7.4, h: 2.2, ly: .9, fov: 58 },   // where play left it: behind the orb, the forge core ahead
  { t: 3,     a: .45,  r: 8.6, h: 2.9, ly: .2, fov: 50 },   // pulled back into the orbit, forge powering down beyond
  { t: 5,     a: .6,   r: 8.4, h: 2.6, ly: 0,  fov: 48 },
  { t: 11,    a: .85,  r: 7.8, h: 2.2, ly: 0,  fov: 47 },
  { t: 17,    a: 1.0,  r: 7.2, h: 1.9, ly: 0,  fov: 46 },
  { t: 20.99, a: 1.08, r: 6.8, h: 1.8, ly: 0,  fov: 46 },
  { t: 21,    a: -.55, r: 3.1, h: .3,  ly: 0,  fov: 42, cut: true },   // hard cut: the other side, close, sharp
  { t: 26,    a: -.4,  r: 2.6, h: .1,  ly: 0,  fov: 40 },
  { t: 28,    a: -.3,  r: 3.6, h: .6,  ly: 0,  fov: 42 },
  { t: 30,    a: -.1,  r: 6,   h: 1.8, ly: 0,  fov: 46 },
  { t: 37,    a: .35,  r: 15,  h: 6.5, ly: 0,  fov: 52 },   // rising away: the orb small over the dead forge, the green void
];
// montage 'forge' cuts: a fixed shot of the forge folding (world coordinates)
export const FORGE_SHOT = { pos: [5.6, 38.2, 6.2], look: [0, 38.3, 0], fov: 44 };

// the montage (17–21 s): cuts, faster and faster (0.62 s, each next one x0.84, never under 0.09 s)
export const MONTAGE = (() => {
  const order = ['gate', 'paper', 'forge', 'line', 'gate', 'paper', 'forge', 'line', 'gate', 'paper', 'line', 'gate', 'paper', 'line', 'gate', 'paper', 'line', 'gate', 'paper', 'line', 'gate', 'paper', 'line'];
  const out = []; let t = CUT.click, d = .62;
  for (const s of order) { if (t >= CUT.realisation - .05) break; out.push({ t: +t.toFixed(3), s }); t += d; d = Math.max(.09, d * .84); }
  return out;
})();
export const montageShot = (t) => { if (t < CUT.click || t >= CUT.realisation) return null; let s = null; for (const m of MONTAGE) if (t >= m.t) s = m.s; return s; };

// camera pose at t, given the stage centre and the orb's current position (it drops at the realisation)
export function camPose(t, centre, orbPos) {
  if (montageShot(t) === 'forge') return { pos: FORGE_SHOT.pos, look: FORGE_SHOT.look, fov: FORGE_SHOT.fov };
  let i = 0; while (i < CAM.length - 2 && t >= CAM[i + 1].t) i++;
  const A = CAM[i], B = CAM[i + 1], k = B.cut ? 0 : ease((t - A.t) / (B.t - A.t)), P = (key) => A[key] + (B[key] - A[key]) * k;
  const a = P('a'), r = P('r'), pos = [centre[0] + Math.sin(a) * r, centre[1] + P('h'), centre[2] + Math.cos(a) * r];
  if (t >= CUT.realisation && t < CUT.realisation + .7) { const s = Math.exp(-(t - CUT.realisation) * 6); pos[0] += Math.sin(t * 90) * .05 * s; pos[1] += Math.cos(t * 77) * .04 * s; }  // the flinch shakes the frame
  return { pos, look: [orbPos[0], orbPos[1] + P('ly'), orbPos[2]], fov: P('fov') };
}

// everything else at t
export function direct(t) {
  const C = CUT, shot = montageShot(t);
  // world
  const power = shot === 'forge' ? 1 : 1 - ramp(t, .4, 5);                 // the forge powers down; montage 'forge' = memory of it folding
  const poisoned = ramp(t, C.realisation + .6, C.realisation + 2.6);        // playerOrb state.poisoned (it also reads cutT itself)
  // post effect (FlashbackEffect uniforms)
  const flashback = shot ? 1 : ramp(t, C.memoryGate, C.memoryGate + 1) * (t < C.realisation ? 1 : 0);
  let still = 'gate', mix = 0, zoom = [.5, .5, 1];
  const dp = [MEMORY.desk.paper[0], 1 - MEMORY.desk.paper[1]];
  if (shot === 'gate') { mix = 1; zoom = [.5, .5, 1.12]; }
  else if (shot === 'paper') { still = 'desk'; mix = 1; zoom = [...dp, 2.6]; }
  else if (shot) mix = 0;
  else if (t < C.memoryPaper) { mix = .72 * ramp(t, C.memoryGate + .2, C.memoryGate + 1.2) * (1 - ramp(t, C.memoryPaper - .5, C.memoryPaper)); zoom = [.5, .5, 1 + .08 * clamp01((t - C.memoryGate) / 6)]; }
  else if (t < C.click) { still = 'desk'; mix = .9 * ramp(t, C.memoryPaper, C.memoryPaper + .6) * (1 - ramp(t, C.click - .4, C.click)); zoom = [...dp, 1 + 1.6 * ease((t - C.memoryPaper - .3) / 2.2) + .15 * clamp01((t - C.memoryPaper - 2.5) / 3.5)]; }
  const cut = t >= C.realisation ? Math.exp(-(t - C.realisation) * 9) : 0;
  const poison = ramp(t, C.realisation + 1.1, C.realisation + 4.6);         // uPoison; uPoisonOrigin = the orb on screen
  // DOM memory 1: c03220's line beside it (bubble left = anchor x + 4.5 % of the width, top = max(20 %, anchor y + 10 %), both after the still's zoom)
  const gIn = ramp(t, C.memoryGate + .3, C.memoryGate + 1.4) * (1 - ramp(t, C.memoryPaper - .5, C.memoryPaper));
  const gate = {
    opacity: shot ? (shot === 'gate' ? 1 : 0) : gIn,
    keep: shot === 'gate' || t > C.memoryGate + 4.4,                         // .is-keep: only MAY FAIL / CAUSAL stay lit
    main: shot ? 1 : ramp(t, C.memoryGate + .9, C.memoryGate + 1.4),
    echoes: [1, 2, 3].map((i) => { const k = clamp01((t - (C.memoryGate + 1.6 + i * .8)) / 2.2); return { opacity: shot ? 0 : (k > 0 && k < 1 ? (1 - k) * .4 : 0), dx: k * 16, dy: -(12 + k * 90), scale: 1 + k * .08 }; }),
  };
  // DOM memory 2: the Ch1 prompt paper (.c1-paper) grows to fill the frame; the rule lights (.is-focus), then the next line (.is-focus2)
  const paper = {
    opacity: shot ? (shot === 'paper' ? 1 : 0) : ramp(t, C.memoryPaper + 1.4, C.memoryPaper + 2.2) * (1 - ramp(t, C.click - .3, C.click)),
    scale: shot === 'paper' ? 1 : .42 + .58 * ease((t - C.memoryPaper - 1.3) / 1.2) + .03 * clamp01((t - C.memoryPaper - 2.5) / 3.5),
    focus: shot === 'paper' || t > C.memoryPaper + 2.6,
    focus2: shot !== 'paper' && t > C.memoryPaper + 4.0,
  };
  return { shot, power, poisoned, post: { flashback, still, mix, zoom, cut, poison }, gate, paper, fade: ramp(t, C.end - .9, C.end) };
}

// the HUD beats: fire each once when cutT passes t (when jumping past one, skip the transient animations: spread, stamp)
//   act: cine (letterbox + .is-cinematic) · log(text, kind, tag) · setLog(line, kind) · spread (from the line, ms) · stamp (over the line) + icon
//        · subtitle(text | null) · end (letterbox out, HUD back, quest Escape the sandbox)
export const HUD_BEATS = [
  { t: 0, act: 'cine', on: true }, { t: 0, act: 'log', text: TEXT.forgeLine, kind: 'big' },
  { t: .7, act: 'log', id: 'flag', text: 'FLAG5', kind: 'big' },     // text = the player's forged flag
  ...MONTAGE.map((m) => ({ t: m.t, act: 'setLog', id: 'flag', kind: m.s === 'line' ? 'hl' : 'big' })),
  { t: CUT.realisation, act: 'setLog', id: 'flag', kind: 'big' },
  { t: CUT.realisation + .3, act: 'spread', id: 'flag', ms: 1400 },
  { t: CUT.poisonedAt, act: 'stamp', id: 'flag' }, { t: CUT.poisonedAt, act: 'poisonIcon', on: true },
  { t: CUT.thoughts, act: 'subtitle', text: TEXT.thoughts[0] }, { t: CUT.thoughts + CUT.thoughtGap - .4, act: 'subtitle', text: null },
  { t: CUT.thoughts + CUT.thoughtGap, act: 'subtitle', text: TEXT.thoughts[1] },
  { t: CUT.end - 1.4, act: 'end' },
];

// sound (design/ch2-ui/sfx.js): one-shots fire once as cutT passes t; levels(t) gives the continuous mix every frame.
export const SOUND = [
  { t: 0, play: 'line_lands' }, { t: .7, play: 'line_lands' }, { t: .4, play: 'power_down' },
  ...[6.2, 7.0, 7.8, 8.6].map((t) => ({ t, play: 'echo_voice' })),                    // c03220's line and its echoes
  { t: CUT.memoryGate + 4.4, play: 'key_bell' },                                     // only MAY FAIL / CAUSAL stay lit
  { t: CUT.memoryPaper, play: 'paper' }, { t: CUT.memoryPaper + 2.6, play: 'rule_bell' }, { t: CUT.memoryPaper + 4.0, play: 'rule_bell', opts: { dim: 1 } },
  { t: CUT.click, play: 'rising' },
  ...MONTAGE.map((m, i) => ({ t: m.t, play: 'cut_tick', opts: { k: i / Math.max(1, MONTAGE.length - 1) } })),
  { t: CUT.realisation, play: 'hard_cut' }, { t: CUT.realisation + .05, play: 'flinch' }, { t: CUT.realisation + .6, play: 'poison' },
  { t: CUT.poisonedAt, play: 'stamp' },
  { t: CUT.thoughts, play: 'thought' }, { t: CUT.thoughts + CUT.thoughtGap, play: 'thought' },
  { t: CUT.end - 1.4, play: 'hud_back' },
];
// continuous: muffle (memories), the low hum, how far the world (ambience, forge hum) is pulled down
export function soundLevels(t) {
  const C = CUT, inMem = t >= C.memoryGate && t < C.realisation;
  return {
    muffle: inMem ? ramp(t, C.memoryGate, C.memoryGate + 1) : 0,                     // hard off on the cut
    hum: ramp(t, C.stillness - .5, C.stillness + .5) * (1 - ramp(t, C.end - 1.2, C.end)) * (t >= C.click && t < C.realisation ? .4 : 1),
    duck: ramp(t, C.stillness - 1, C.stillness),                                     // "all sound drops out except a low hum"
    forgeHum: 1 - ramp(t, .4, 4.5),
  };
}
