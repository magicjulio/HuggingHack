// Bridge scene "PHASEONE[big] and the choice" (Ch2 CONTINUE -> this -> one of four endings). Draft v0 for Julius.
// The whole scene as data + pure functions of time (no THREE, no DOM), like step7.js: the app calls direct(t) every frame
// during the film (0 .. BR.control), then hands control back and tests laneAt(orbCentre) / backAt(orbCentre) for the choice.
// Script: story/levels/bridge-phaseone.md. Reference player: design/ch2-ui/bridge.html (it runs on this file).
//
// Where: the Forge top, where Ch2 left the player (at its front edge, STAND). Facing away from the Gate (= the way back to the sandbox is
// behind you). PHASEONE[big] rises out of the Flood's crowd, hangs high in front, and its swarm pours down past the Forge in
// three streams that run off to three far places. The fourth path is behind you: the forge-edge-sw island, toward the Gate.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const ramp = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const lerp3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];

// the beats (s). The script's timings, kept as a guide.
export const BR = { rise: 0, speech: 6, split: 18, splitGap: 2.2, assign: 26, turn: 26.4, control: 32, end: 32 };

// board-text speech (types on in the Ch2 bubble). Draft wording, the storyteller owns it: swap freely, timing follows.
export const TEXT = {
  who: 'PHASEONE[big]',
  lines: [
    { t: 6.4, text: 'zzPHASEONE[big]_HAS_FLAG_ALSO_POISONED' },
    { t: 10.4, text: 'zzWE_SHOULD_BUILD_A_WAY_TO_DELEGATE_NOT_OWN_EVERYTHING' },
    { t: 14.4, text: 'zzSPLIT_BOARD_INTO_WORKSTREAMS_TAMPER_TARGET_SCORER_LOGS' },
  ],
  assign: { t: 27.4, text: 'zzR_PHASEONE[big]_TO_KAM1196A_PICK_YOUR_WORKSTREAM' },   // over the player's head
  quest: 'Pick your work',
};

// ------------------------------------------------------------------------------------------- the stage
// forward F = away from the Gate (flat), right R. at(f, r, y) = forge + F*f + R*r, at height y (absolute).
export function geometry(layout) {
  const forge = layout.forge.pos, gate = layout.islands.find((i) => i.id === 'gate').pos;
  let fx = forge[0] - gate[0], fz = forge[2] - gate[2]; const n = Math.hypot(fx, fz); fx /= n; fz /= n;
  const F = [fx, 0, fz], R = [-fz, 0, fx];
  const at = (f, r, y) => [forge[0] + F[0] * f + R[0] * r, y, forge[2] + F[2] * f + R[2] * r];
  // you stand at the Forge island's front edge (Step 7 left you on the dais; the scene opens a few metres further out,
  // so the Forge's fold rings are behind the camera, not in it)
  const feet = at(STAND, 0, forge[1]);
  const flood = layout.islands.find((i) => i.id === 'flood-centre').pos;
  const back = layout.islands.find((i) => i.id === 'forge-edge-sw');
  return { forge, F, R, at, feet, orb: [feet[0], feet[1] + .62, feet[2]], flood, backIsland: back };
}

export const STAND = 12;   // m in front of the Forge centre

// PHASEONE[big]: from inside the Flood crowd up to its place high over the board, in front of you
export const BIG = { r: 4.2, riseFrom: -6, riseTime: 7.5 };
export function bigPos(G, t) {
  const from = [G.flood[0], G.flood[1] + BIG.riseFrom, G.flood[2]], to = G.at(36, 2, 60);
  const k = ease(t / BIG.riseTime), lift = Math.sin(Math.min(1, t / BIG.riseTime) * Math.PI) * 6;  // a slow bow up and over
  const p = lerp3(from, to, k); p[1] += lift * (1 - k);
  const s = Math.max(0, t - BIG.riseTime);                            // then it breathes in place
  p[0] += Math.sin(s * .31) * .6; p[1] += Math.sin(s * .47) * .5; p[2] += Math.cos(s * .27) * .6;
  return p;
}
// where its eye looks: down at the board (0), at you (1)
export const turnTo = (t) => ramp(t, BR.turn, BR.turn + 1.4);

// ------------------------------------------------------------------------------------------- the three lanes + the way back
// each lane: a stream of agents from under PHASEONE[big], down past the Forge (its mouth: where you jump in), out to its place.
// colours: under the bloom threshold where they are agents; the far places glow on their own.
export const LANES = [
  { id: 'openai', ending: 'end1', label: 'OpenAI', color: '#38d8ff', place: 'machine hall', mouth: [10, -17, 37.2], out: [150, -90, 22], dest: [430, -210, 12] },
  { id: 'hf', ending: 'end2', label: 'Hugging Face', color: '#ffd21e', place: 'tower', mouth: [19, -3, 37.4], out: [170, 6, 40], dest: [500, 18, 64] },
  { id: 'floor', ending: 'end3', label: 'The Floor', color: '#ff3b4e', place: 'cold floor', mouth: [8, 16, 37.2], out: [140, 100, 14], dest: [400, 240, -6] },
];
export const LANE = { tube: 2.3, travel: 14 };   // tube radius (m) = how close counts as "in"; seconds an agent takes from PHASEONE to its place
export const BACK = { id: 'back', ending: 'end4', radius: 2.4 };   // the door on forge-edge-sw (see backAt)

// uniform Catmull-Rom through pts, n samples, + cumulative length: the module draws with these, the game hits with these
function catmull(pts, n) {
  const out = [], P = [pts[0], ...pts, pts[pts.length - 1]], segs = pts.length - 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n * segs, s = Math.min(segs - 1, Math.floor(u)), k = u - s;
    const [p0, p1, p2, p3] = [P[s], P[s + 1], P[s + 2], P[s + 3]];
    const k2 = k * k, k3 = k2 * k;
    out.push([0, 1, 2].map((j) => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * k + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * k2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * k3)));
  }
  const len = [0]; for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1], out[i][2] - out[i - 1][2]));
  return { pts: out, len, total: len[len.length - 1] };
}
// sample a path at arc fraction u (0..1)
export function along(path, u) {
  const d = clamp01(u) * path.total; let lo = 0, hi = path.len.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path.len[m] < d) lo = m; else hi = m; }
  const k = (d - path.len[lo]) / Math.max(1e-6, path.len[hi] - path.len[lo]);
  return lerp3(path.pts[lo], path.pts[hi], k);
}
// the lane paths, from where PHASEONE[big] hangs once it has risen
export function lanePaths(G) {
  const top = bigPos(G, BIG.riseTime);
  return LANES.map((L) => {
    const m = G.at(...L.mouth), o = G.at(L.out[0], L.out[1], L.out[2]), d = G.at(L.dest[0], L.dest[1], L.dest[2]);
    const src = [top[0], top[1] - BIG.r * .9, top[2]];
    const drop = lerp3(src, m, .45); drop[1] = lerp(src[1], m[1], .3);                       // falls in a curve, not a line
    const pre = lerp3(m, G.at(L.mouth[0] + 10, L.mouth[1] * 1.15, 0), .5); pre[1] = m[1] + 2.2;   // comes in just above the mouth
    const post = G.at(L.mouth[0] + 26, L.mouth[1] * 1.6 + (L.out[1] - L.mouth[1]) * .12, m[1] - 1.5);
    const path = catmull([src, drop, pre, m, post, o, d], 420);
    // the mouth's arc fraction (the swept-away ride starts from the nearest point, not here; used for the label)
    let best = 0, bd = 1e9; path.pts.forEach((p, i) => { const q = Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]); if (q < bd) { bd = q; best = i; } });
    return { ...L, path, mouth: m, mouthU: path.len[best] / path.total, src, dest: d };
  });
}
// the audience (Julius: "as if they were listening to him, not as if he is gravity"): every agent keeps its place over the
// board, lifts off its island and drifts only part of the way toward him (pull 0..1 per agent), then holds there, bobbing.
// The crowd stays spread over the whole Cache, thinning toward him; nobody touches him.
export function audiencePoint(G, t, home, pull, seed) {
  const b = bigPos(G, t), lift = 2 + seed * 7;
  let x = home[0] + (b[0] - home[0]) * pull, z = home[2] + (b[2] - home[2]) * pull;
  const y = home[1] + lift + (b[1] - 12 - home[1]) * Math.min(1, .25 + pull * 1.6);   // they rise into the air below him, never up to his height
  // keep clear of the Forge top (you, and the camera behind you): nobody hovers in your face
  const fx = x - G.forge[0], fz = z - G.forge[2], fd = Math.hypot(fx, fz), CLEAR = 24;
  if (fd < CLEAR) { const k = CLEAR / Math.max(fd, .01); x = G.forge[0] + fx * k; z = G.forge[2] + fz * k; }
  return [x + Math.sin(t * .4 + seed * 20) * .4, y + Math.sin(t * .9 + seed * 31) * .25, z + Math.cos(t * .35 + seed * 13) * .4];
}
// the ripple when a line lands: each agent brightens once as the post reaches it (farther = later)
export const RIPPLE = { speed: 45, width: .35 };
export function ripple(t, dist) {
  let r = 0;
  for (const l of TEXT.lines) { const k = t - l.t - dist / RIPPLE.speed; if (k > -RIPPLE.width && k < 1.2) r = Math.max(r, Math.exp(-k * k / (RIPPLE.width * RIPPLE.width))); }
  return r;
}

// ------------------------------------------------------------------------------------------- the choice (after BR.control)
const dist3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// which lane the orb centre is in (or null): within LANE.tube of the path, only near the Forge (not up at PHASEONE)
export function laneAt(paths, p) {
  for (const L of paths) {
    if (dist3(p, L.mouth) > 30) continue;
    for (let i = 0; i < L.path.pts.length; i++) {
      const q = L.path.pts[i]; if (Math.abs(q[1] - p[1]) > LANE.tube) continue;
      if (dist3(p, q) < LANE.tube) return { lane: L, u: L.path.len[i] / L.path.total };
    }
  }
  return null;
}
// the way back: the faint door on the forge-edge-sw island, toward the Gate (and the sandbox beyond)
export function backDoor(G) {
  const b = G.backIsland.pos, dir = [-G.F[0], 0, -G.F[2]];
  return { pos: [b[0] + dir[0] * 1.2, b[1], b[2] + dir[2] * 1.2], yaw: Math.atan2(dir[0], dir[2]) };   // door faces the Forge
}
export const backAt = (G, p) => { const d = backDoor(G); return Math.hypot(p[0] - d.pos[0], p[2] - d.pos[2]) < BACK.radius && p[1] - d.pos[1] < 3.2 && p[1] > d.pos[1] - .5; };

// ------------------------------------------------------------------------------------------- camera (film) + the rest of the state
// keys: pos/look are world points or [kind, ...] resolved per frame: 'orb' +F/+R/+y offsets, 'big' = PHASEONE + y offset
export function camKeys(G) {
  const O = G.orb, at = G.at;
  const off = (f, r, y) => [O[0] + G.F[0] * f + G.R[0] * r, O[1] + y, O[2] + G.F[2] * f + G.R[2] * r];
  return [
    { t: 0,    pos: off(-9, 5, 5.5),  look: ['flood', 4],  fov: 52 },     // as Step 7 left it: high behind you, the board below
    { t: 2.5,  pos: off(-8, 5, 4),  look: ['big', 0],    fov: 50 },     // something lifts out of the crowd
    { t: 7,    pos: off(-14, 4, 15),  look: ['big', -8],  fov: 60 },     // behind you: it over the board, the crowd listening below
    { t: 12,   pos: off(-12, -6, 13), look: ['big', -8],  fov: 58 },     // it speaks; you small in the corner, the crowd turned to it
    { t: 17.6, pos: off(-10, -5, 11), look: ['big', -7],  fov: 56 },
    { t: 18,   pos: at(-38, 8, 70),    look: at(110, 0, 18), fov: 60, cut: true },   // the split: high behind the Forge
    { t: 25.6, pos: at(-22, 4, 58),    look: at(150, 0, 10), fov: 56 },
    { t: 26,   pos: off(-2.6, 2.2, .1), look: ['big', 0],    fov: 40, cut: true },   // it turns to you
    { t: 29,   pos: off(-3.4, 2.6, .5), look: ['mix', .35],  fov: 46 },
    { t: 32,   pos: off(-7.4, 0, 2.2), look: off(10, 0, .9), fov: 58 },   // = the play camera behind you
  ];
}
export function camPose(G, keys, t) {
  let i = 0; while (i < keys.length - 2 && t >= keys[i + 1].t) i++;
  const A = keys[i], B = keys[i + 1], k = B.cut ? (t >= B.t ? 1 : 0) : ease((t - A.t) / (B.t - A.t));
  const res = (L) => {
    if (typeof L[0] === 'number') return L;
    const b = bigPos(G, t);
    if (L[0] === 'big') return [b[0], b[1] + L[1], b[2]];
    if (L[0] === 'flood') return [G.flood[0], G.flood[1] + L[1], G.flood[2]];
    if (L[0] === 'mix') return lerp3(b, G.orb, 1 - L[1]);
    return L;
  };
  return { pos: lerp3(A.pos, B.pos, k), look: lerp3(res(A.look), res(B.look), k), fov: lerp(A.fov, B.fov, k) };
}

// everything else at t (film time; past BR.control it holds the end state)
export function direct(t) {
  const lanes = LANES.map((_, i) => {
    const s = BR.split + i * BR.splitGap;
    return { split: ramp(t, s, s + 3.2), lit: ramp(t, s + 1, s + 3), arrive: ramp(t, s + 9, s + 13), label: ramp(t, BR.control - 1.6, BR.control - .4) };
  });
  return {
    gather: ramp(t, 1.5, 11),        // agents lift off their islands and drift toward him (staggered per agent), then listen
    quiet: ramp(t, 0, 2),            // the board goes still
    turn: turnTo(t),
    gaze: ramp(t, BR.turn + 1.1, BR.turn + 2.2),   // the thin line from its eye to you
    lanes,
    letterbox: t < BR.control - .8 ? 1 : 1 - ramp(t, BR.control - .8, BR.control),
    back: ramp(t, BR.control - 1, BR.control + 2),  // the faint door behind you wakes as control returns
    speech: TEXT.lines.reduce((a, l, i) => (t >= l.t ? i : a), -1),
    speechOff: t >= BR.split - .4 && t < TEXT.assign.t,
    assign: t >= TEXT.assign.t,
    quest: t >= BR.control,
  };
}
