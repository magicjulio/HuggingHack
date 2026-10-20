import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { P, blobShadow } from "./art.js";
import { asset } from "./assets.js";

// The end boss's look (boss agent, round 4). Contract: BOSS.md. The brain is boss.js (fight).
//
//   const model = createBossModel({ scene, arena, radius })
//
// The boss is the official Hugging Face logo face brought into 3D: a huge yellow face with the logo's orange
// outline as an armoured bezel, a mechanical back shell, and the logo's two hands as separate floating gauntlets.
// The face features (eyes, mouth, tongue, cheeks) are built here from the official SVG (assets/hf-logo.svg), so
// the neutral face IS the logo. Expressions are morph targets on those features (neutral = the unmodified logo;
// angry = the phase-3 face, the one sanctioned change; hurt; roar). The shell, bezel and hands come from
// end2-boss.glb (design/3d/end2/boss/boss.py) and fall back to the procedural pieces below.
//
// Axes: the model faces +Z, Y up, metres. root origin = the bottom of the face (head.position.y = R).
// Hands live in world space (added to opts.scene); fight places them by their `palm` point.
// hands.l is the hand on the PLAYER's left when you face the boss (local −X), like the logo's left hand.

const Q = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const knob = (k, d) => (Q.has(k) ? +Q.get(k) || 0 : d);
// Set once design/3d/end2/boss/boss.py has exported assets/models/end2-boss.glb (no request before that, so a
// missing file never shows up as a 404 in the console).
const GLB_URL = asset("end2-boss.glb");
const HAS_GLB = true;
const GLB_R = 7; // the face radius boss.py builds at

// The yellow face disc in SVG units (assets/hf-logo.svg, 256 × 256, y down).
const FC = { x: 127.4, y: 123.2, r: 75.8 };
const EYE_L = [99.1, 97.6],
  EYE_R = [153.6, 97.6],
  CHEEK_L = [77.25, 105.75],
  CHEEK_R = [178.7, 105.75];
const EXPR = ["angry", "hurt", "roar"]; // morph target order; neutral = no target
const TAU = Math.PI * 2;

export const BOSS_LOOK_DEFAULTS = {
  radius: 7, // face radius in metres (the yellow disc); the bezel adds ~10 %
  depth: knob("bossZ", 0.82), // face front depth / radius (1 = a full sphere; lower = closer to the flat logo)
  glow: knob("bossGlow", 0.1), // self-illumination of the logo colours (keeps the yellow saturated in dim light)
  vein: knob("bossVein", 1), // angry: the red anger mark on the forehead
  flush: knob("bossFlush", 1), // angry: cheeks go from logo amber to logo red
  teeth: knob("bossTeeth", 1), // angry/roar: gritted teeth
  steam: knob("bossSteam", 1), // angry: steam puffs from the sides of the head
  tremble: knob("bossTremble", 1), // angry: the face shakes with rage
  shadow: knob("bossShadow", 1), // blob shadows under the face and the hands
  glb: knob("bossGlb", 1), // 0 = always the procedural placeholder
  facePaint: knob("bossFacePaint", 1), // worn paint maps on the face (0 = the clean logo yellow)
};

// ---------------------------------------------------------------------------------------------- 2D shape helpers
const uv = ([x, y]) => [(x - FC.x) / FC.r, -(y - FC.y) / FC.r];
const uvs = (pts) => pts.map(uv);

function polar(polys, c, N) {
  // radius of the outermost boundary hit along N rays from c (CCW from +u)
  const r = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = (TAU * k) / N,
      dx = Math.cos(a),
      dy = Math.sin(a);
    let best = 0;
    for (const poly of polys)
      for (let i = 0, n = poly.length; i < n; i++) {
        const [ax, ay] = poly[i],
          [bx, by] = poly[(i + 1) % n];
        const ex = bx - ax,
          ey = by - ay;
        const den = dx * ey - dy * ex;
        if (Math.abs(den) < 1e-12) continue;
        const wx = ax - c[0],
          wy = ay - c[1];
        const t = (wx * ey - wy * ex) / den,
          s = (wx * dy - wy * dx) / den;
        if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6 && t > best) best = t;
      }
    r[k] = Math.max(best, 1e-4);
  }
  return r;
}
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
// a centre the outline is star-shaped about (fewest angle reversals, then farthest from the edge)
function starCentre(poly) {
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (const [x, y] of poly) (x0 = Math.min(x0, x)), (x1 = Math.max(x1, x)), (y0 = Math.min(y0, y)), (y1 = Math.max(y1, y));
  let best = null,
    bs = Infinity;
  for (let i = 1; i < 24; i++)
    for (let j = 1; j < 24; j++) {
      const x = x0 + ((x1 - x0) * i) / 24,
        y = y0 + ((y1 - y0) * j) / 24;
      if (!inside(poly, x, y)) continue;
      let rev = 0,
        tot = 0,
        prev = null,
        dmin = Infinity;
      for (const [px, py] of poly) {
        const a = Math.atan2(py - y, px - x);
        if (prev !== null) {
          let da = a - prev;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          if (tot !== 0 && Math.sign(da) !== Math.sign(tot) && Math.abs(da) > 1e-5) rev++;
          tot += da;
        }
        prev = a;
        dmin = Math.min(dmin, Math.hypot(px - x, py - y));
      }
      const s = rev * 1000 - dmin;
      if (s < bs) (bs = s), (best = [x, y]);
    }
  return best || [(x0 + x1) / 2, (y0 + y1) / 2];
}
function clip(poly, a, b, ref) {
  const side = (p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const sr = Math.sign(side(ref)) || 1;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i],
      q = poly[(i + 1) % poly.length];
    const sp = side(p) * sr,
      sq = side(q) * sr;
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
// thick polyline outline (miter joins, round caps)
function stroke(pts, w, capSeg = 6) {
  const n = pts.length,
    L = [],
    Rr = [];
  const tan = (i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0],
      ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    return [tx / l, ty / l];
  };
  for (let i = 0; i < n; i++) {
    const [tx, ty] = tan(i);
    const nx = -ty,
      ny = tx;
    let m = w / 2;
    if (i > 0 && i < n - 1) {
      const a = pts[i - 1],
        b = pts[i];
      const sx = b[0] - a[0],
        sy = b[1] - a[1],
        sl = Math.hypot(sx, sy) || 1;
      m = w / 2 / Math.max(0.35, Math.abs(nx * (-sy / sl) + ny * (sx / sl)));
    }
    L.push([pts[i][0] + nx * m, pts[i][1] + ny * m]);
    Rr.push([pts[i][0] - nx * m, pts[i][1] - ny * m]);
  }
  const cap = (p, t, s) => {
    const out = [];
    const nx = -t[1],
      ny = t[0];
    for (let j = 1; j < capSeg; j++) {
      const a = (Math.PI * j) / capSeg;
      out.push([p[0] + ((s * nx * Math.cos(a) + s * t[0] * Math.sin(a)) * w) / 2, p[1] + ((s * ny * Math.cos(a) + s * t[1] * Math.sin(a)) * w) / 2]);
    }
    return out;
  };
  return [...L, ...cap(pts[n - 1], tan(n - 1), 1), ...Rr.reverse(), ...cap(pts[0], tan(0), -1)];
}
const scalePoly = (poly, c, s, d = [0, 0]) => poly.map(([x, y]) => [c[0] + (x - c[0]) * s + d[0], c[1] + (y - c[1]) * s + d[1]]);
const ellipse = (c, a, b, n = 48) => Array.from({ length: n }, (_, i) => [c[0] + Math.cos((TAU * i) / n) * a, c[1] + Math.sin((TAU * i) / n) * b]);
// two chains (top, bot) around a centre line with a width profile
function band(centre, width) {
  const top = [],
    bot = [];
  const n = centre.length;
  for (let i = 0; i < n; i++) {
    const a = centre[Math.max(0, i - 1)],
      b = centre[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0],
      ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    (tx /= l), (ty /= l);
    const w = width(i / (n - 1)) / 2;
    top.push([centre[i][0] - ty * w, centre[i][1] + tx * w]);
    bot.push([centre[i][0] + ty * w, centre[i][1] - tx * w]);
  }
  return { top, bot };
}
const roundEnds = (W, p = 5) => (s) => W * Math.sqrt(Math.max(0, 1 - Math.abs(2 * s - 1) ** p));
const lerp2 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const line = (a, b, n, bow = 0) =>
  Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const p = lerp2(a, b, t);
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy) || 1;
    const s = Math.sin(Math.PI * t) * bow;
    return [p[0] - (dy / l) * s, p[1] + (dx / l) * s];
  });

// ---------------------------------------------------------------------------------------------- the logo, read once
let logoPromise = null;
function loadLogoShapes() {
  if (logoPromise) return logoPromise;
  logoPromise = fetch(asset("hf-logo.svg"))
    .then((r) => r.text())
    .then((text) => {
      const data = new SVGLoader().parse(text);
      const fill = (hex) => data.paths.find((p) => (p.userData.style.fill || "").toUpperCase() === hex);
      const pts = (sp, n = 6) => sp.getPoints(n).map((p) => [p.x, p.y]);
      const ink = fill("#32343D").subPaths.map((s) => pts(s));
      // the ink path holds both eyes and the mouth; tell them apart by position
      const info = ink.map((p) => ({ p, x: p.reduce((a, q) => a + q[0], 0) / p.length, y: p.reduce((a, q) => a + q[1], 0) / p.length }));
      const mouth = info.reduce((a, b) => (b.y > a.y ? b : a)).p;
      const eyes = info.filter((e) => e.p !== mouth).sort((a, b) => a.x - b.x);
      return {
        eyeL: eyes[0].p,
        eyeR: eyes[1].p,
        mouth,
        tongue: pts(fill("#FF323D").subPaths[0]),
        cheeks: fill("#FFAD03").subPaths.map((s) => pts(s)).sort((a, b) => a[0][0] - b[0][0]),
      };
    });
  return logoPromise;
}

// ---------------------------------------------------------------------------------------------- expression shapes
// Every feature is given per target [neutral, angry, hurt, roar] in SVG units, then converted to the face plane
// (u right, v up, 1 = the face radius). Neutral is always the official logo outline.
function eyeTargets(logo, side) {
  const neutral = side < 0 ? logo.eyeL : logo.eyeR;
  const c = side < 0 ? EYE_L : EYE_R;
  const s = side < 0 ? 1 : -1; // mirror for the right eye: the slant always runs down toward the nose
  const P_ = (dx, dy) => [c[0] + s * dx, c[1] + dy];
  const below = [c[0], c[1] + 10];
  // angry: the logo's notched eye with its top cut off by the brow; roar: cut deeper
  const angry = clip(neutral, P_(-14, -10.5), P_(13, 2.8), below);
  const roar = clip(neutral, P_(-14, -6.5), P_(13, 5.5), below);
  // hurt: squeezed shut, ">" on the left eye and "<" on the right
  const hurt = stroke([P_(-8.5, -8.5), P_(7.5, 0.4), P_(-8.5, 9)], 5.4);
  return [neutral, angry, hurt, roar];
}
function browTargets(side) {
  const c = side < 0 ? EYE_L : EYE_R;
  const s = side < 0 ? 1 : -1;
  const P_ = (dx, dy) => [c[0] + s * dx, c[1] + dy];
  const M = 14;
  const off = (a, b, d) => {
    // shift the line a→b up (away from the eye) by d
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      l = Math.hypot(dx, dy);
    let nx = dy / l,
      ny = -dx / l;
    if (ny > 0) (nx = -nx), (ny = -ny);
    return [
      [a[0] + nx * d, a[1] + ny * d],
      [b[0] + nx * d, b[1] + ny * d],
    ];
  };
  // angry: thick bars right on top of the cut eyes, sloping down hard toward the nose
  const [aa, ab] = off(P_(-17, -12.2), P_(14, 3.1), 4.6);
  const [ra, rb] = off(P_(-16, -8.6), P_(14, 5.8), 4.8);
  const angry = band(line(aa, ab, M, 1.2), roundEnds(7.4));
  const roar = band(line(ra, rb, M, 1.0), roundEnds(7.0));
  // hurt: worried brows, inner ends up
  const hurt = band(line(P_(-12, -12.5), P_(11, -19.5), M, 1.5), roundEnds(4.8));
  const neutral = band(line(P_(-12, -15), P_(11, -15), M), () => 0);
  return [neutral, angry, hurt, roar];
}
const aTopF = (t) => 151 - 23.5 * Math.sin(Math.PI * t) ** 0.75 - 2.2 * t;
const aBotF = (t) => 151 - 7.5 * Math.sin(Math.PI * t) ** 0.9;
function mouthTargets(logo) {
  const M = 40;
  const arch = (x0, x1, f) => Array.from({ length: M }, (_, i) => [x0 + ((x1 - x0) * i) / (M - 1), f(i / (M - 1))]);
  // angry: an open, downturned snarl, the top lip pulled up a little on the right (a sneer)
  const aTop = arch(101, 153, aTopF);
  const aBot = arch(153, 101, (t) => aBotF(1 - t));
  // hurt: a small wobbly open mouth
  const hTop = arch(110, 144, (t) => 136.5 + 1.6 * Math.sin(t * TAU * 2.5) - 1.2 * Math.sin(Math.PI * t));
  const hBot = arch(144, 110, (t) => 144.5 - 1.6 * Math.sin(t * TAU * 2.5 + 1) + 1.0 * Math.sin(Math.PI * t));
  // roar: huge, the jaw dropped
  const roar = ellipse([127, 147], 37, 25, 72).map(([x, y]) => [x, y < 147 ? 147 - (147 - y) * 0.92 : y]);
  return [{ polys: [logo.mouth, logo.tongue], c: [127, 139] }, { polys: [[...aTop, ...aBot]] }, { polys: [[...hTop, ...hBot]] }, { polys: [roar] }];
}
function tongueTargets(logo) {
  const t = logo.tongue;
  return [t, ellipse([127, 147.6], 10, 2.8, 40), ellipse([127, 143.4], 9, 3, 40), scalePoly(t, [127.2, 147.5], 1.55, [0, 16])];
}
function teethTargets() {
  // upper row: zigzag hanging from the top lip; lower row: teeth rising from the bottom lip
  const M = 49;
  const zig = (t, n, d0, d1) => {
    const f = (t * n) % 1;
    return d0 + (d1 - d0) * (1 - Math.abs(2 * f - 1));
  };
  const upper = (x0, x1, top, deep, n) => {
    const tp = [],
      bt = [];
    for (let i = 0; i < M; i++) {
      const t = i / (M - 1),
        x = x0 + (x1 - x0) * t,
        y = top(t);
      tp.push([x, y - 3]);
      bt.push([x, y + zig(t, n, 0.6, deep)]);
    }
    return { top: tp, bot: bt };
  };
  const lower = (x0, x1, bot, deep, n) => {
    const tp = [],
      bt = [];
    for (let i = 0; i < M; i++) {
      const t = i / (M - 1),
        x = x0 + (x1 - x0) * t,
        y = bot(t);
      tp.push([x, y - zig(t, n, 0.4, deep)]);
      bt.push([x, y + 3]);
    }
    return { top: tp, bot: bt };
  };
  const flat = (x0, x1, y) => {
    const p = Array.from({ length: M }, (_, i) => [x0 + ((x1 - x0) * i) / (M - 1), y]);
    return { top: p, bot: p.map((q) => [...q]) };
  };
  const aTop = (t) => aTopF(0.06 + 0.88 * t);
  const aBot = (t) => aBotF(0.2 + 0.6 * t);
  const rTop = (t) => 147 - 23 * Math.sqrt(Math.max(0, 1 - (2 * (0.08 + 0.84 * t) - 1) ** 2));
  const rBot = (t) => 147 + 25 * Math.sqrt(Math.max(0, 1 - (2 * (0.3 + 0.4 * t) - 1) ** 2));
  return {
    upperT: [flat(104, 150, 120), upper(104, 150, aTop, 5.2, 6), flat(112, 142, 133), upper(93, 161, rTop, 6, 7)],
    lowerT: [flat(112, 142, 152), lower(112, 142, aBot, 4.2, 4), flat(114, 140, 146), lower(112, 142, rBot, 5, 4)],
  };
}
function veinTargets() {
  // the manga anger mark: four brackets around a point on the upper right forehead
  const vc = [150, 69];
  const parts = [];
  for (let k = 0; k < 4; k++) {
    const phi = Math.PI / 4 + (k * Math.PI) / 2;
    const cc = [vc[0] + Math.cos(phi) * 10.5, vc[1] + Math.sin(phi) * 10.5];
    const arc = [];
    for (let i = 0; i < 9; i++) {
      const a = phi + Math.PI + (i / 8 - 0.5) * 1.5;
      arc.push([cc[0] + Math.cos(a) * 7, cc[1] + Math.sin(a) * 7]);
    }
    const off = band(arc, () => 0);
    parts.push([off, band(arc, roundEnds(3.4, 3)), off, band(arc, roundEnds(2.8, 3))]);
  }
  return { vc, parts };
}

// ---------------------------------------------------------------------------------------------- 3D from the face plane
function makeSurface(R, ZS) {
  const nz2 = 1 / (ZS * ZS);
  const surf = function (u, v, h = 0, depth = 0, out = { p: [0, 0, 0], n: [0, 0, 1] }) {
    let rr = u * u + v * v;
    if (rr > 1) {
      const s = 1 / Math.sqrt(rr);
      (u *= s), (v *= s), (rr = 1);
    }
    const z = ZS * Math.sqrt(Math.max(0, 1 - rr));
    let nx = u,
      ny = v,
      nzv = z * nz2;
    const l = Math.hypot(nx, ny, nzv) || 1;
    (nx /= l), (ny /= l), (nzv /= l);
    if (depth) {
      // inside the mouth: straight back along −z, normals mostly forward
      out.p[0] = u * R;
      out.p[1] = v * R;
      out.p[2] = (z - depth + h) * R;
      const l2 = Math.hypot(nx * 0.3, ny * 0.3, 1);
      out.n[0] = (nx * 0.3) / l2;
      out.n[1] = (ny * 0.3) / l2;
      out.n[2] = 1 / l2;
    } else {
      out.p[0] = (u + nx * h) * R;
      out.p[1] = (v + ny * h) * R;
      out.p[2] = (z + nzv * h) * R;
      out.n[0] = nx;
      out.n[1] = ny;
      out.n[2] = nzv;
    }
    return out;
  };
  surf.R = R;
  return surf;
}

// Each target fills the same vertex layout; build() turns them into one morph geometry.
class MorphBuilder {
  constructor(nTargets = 4) {
    this.T = Array.from({ length: nTargets }, () => ({ pos: [], nrm: [] }));
    this.index = [];
    this.color = [];
    this.count = 0;
  }
  block(fn, indexFn, colorOf) {
    const base = this.count;
    let n = -1;
    this.T.forEach((T, t) => {
      let c = 0;
      fn(t, (p, nn) => {
        T.pos.push(p[0], p[1], p[2]);
        T.nrm.push(nn[0], nn[1], nn[2]);
        c++;
      });
      if (n < 0) n = c;
      else if (c !== n) throw new Error("morph block size mismatch");
    });
    indexFn((a, b, c) => this.index.push(base + a, base + b, base + c));
    for (let i = 0; i < n; i++) this.color.push(...(colorOf ? colorOf(i) : [1, 1, 1]));
    this.count += n;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.T[0].pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.T[0].nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.color, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(this.count * 2), 2));
    g.setIndex(this.index);
    g.morphAttributes.position = this.T.slice(1).map((T) => new THREE.Float32BufferAttribute(T.pos, 3));
    g.morphAttributes.normal = this.T.slice(1).map((T) => new THREE.Float32BufferAttribute(T.nrm, 3));
    g.morphTargetsRelative = false;
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
const safeN = (x, y, z, fb) => {
  const l = Math.hypot(x, y, z);
  return l > 1e-8 ? [x / l, y / l, z / l] : fb;
};
const pick = (v, t) => (Array.isArray(v) ? v[t] : v);

// polar blob (eyes, cheeks, tongue): centre + top ring + wall top ring + wall bottom ring
function addBlob(B, surf, targets, N, { top, bottom, dome = 0, depth = 0 }) {
  const tmp = { p: [0, 0, 0], n: [0, 0, 1] };
  B.block(
    (t, push) => {
      const { c, r } = targets[t];
      const hT = pick(top, t),
        hB = pick(bottom, t),
        dm = pick(dome, t);
      const ring = [];
      for (let k = 0; k < N; k++) ring.push([c[0] + Math.cos((TAU * k) / N) * r[k], c[1] + Math.sin((TAU * k) / N) * r[k]]);
      const s = surf(c[0], c[1], hT + dm, depth, tmp);
      push([...s.p], [...s.n]);
      for (let k = 0; k < N; k++) {
        const q = surf(ring[k][0], ring[k][1], hT, depth, tmp);
        const dx = ring[k][0] - c[0],
          dy = ring[k][1] - c[1];
        push([...q.p], dm ? safeN(q.n[0] + dx * dm * 6, q.n[1] + dy * dm * 6, q.n[2], [...q.n]) : [...q.n]);
      }
      const wallN = [];
      for (let k = 0; k < N; k++) {
        const a = ring[(k + N - 1) % N],
          b = ring[(k + 1) % N];
        const tx = b[0] - a[0],
          ty = b[1] - a[1];
        const q = surf(ring[k][0], ring[k][1], hT, depth, tmp);
        wallN.push(safeN(ty, -tx, q.n[2] * 0.25 * Math.hypot(tx, ty), [...q.n]));
      }
      for (let k = 0; k < N; k++) push([...surf(ring[k][0], ring[k][1], hT, depth, tmp).p], wallN[k]);
      for (let k = 0; k < N; k++) push([...surf(ring[k][0], ring[k][1], hB, depth, tmp).p], wallN[k]);
    },
    (tri) => {
      const wt = 1 + N,
        wb = 1 + 2 * N;
      for (let k = 0; k < N; k++) {
        const k1 = (k + 1) % N;
        tri(0, 1 + k, 1 + k1);
        tri(wt + k, wb + k, wb + k1);
        tri(wt + k, wb + k1, wt + k1);
      }
    },
  );
}
// strip (brows, teeth, vein): front quads between two chains + walls around the outline
function addStrip(B, surf, targets, { top, bottom, depth = 0 }) {
  const tmp = { p: [0, 0, 0], n: [0, 0, 1] };
  const ref = targets.find((T) => T.top.some((p, i) => Math.hypot(p[0] - T.bot[i][0], p[1] - T.bot[i][1]) > 1e-4)) || targets[0];
  let area = 0;
  const ol = [...ref.bot, ...[...ref.top].reverse()];
  for (let i = 0; i < ol.length; i++) {
    const a = ol[i],
      b = ol[(i + 1) % ol.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const flip = area < 0; // make the outline CCW so the front faces +z
  const M = targets[0].top.length;
  B.block(
    (t, push) => {
      const T = targets[t];
      const tp = flip ? T.bot : T.top,
        bt = flip ? T.top : T.bot;
      const hT = pick(top, t),
        hB = pick(bottom, t),
        dp = pick(depth, t);
      for (const ch of [tp, bt])
        for (let i = 0; i < M; i++) {
          const q = surf(ch[i][0], ch[i][1], hT, dp, tmp);
          push([...q.p], [...q.n]);
        }
      const outline = [...bt, ...[...tp].reverse()];
      const L = outline.length;
      const wn = [];
      for (let k = 0; k < L; k++) {
        let a = outline[(k + L - 1) % L],
          b = outline[(k + 1) % L];
        let tx = b[0] - a[0],
          ty = b[1] - a[1];
        if (Math.hypot(tx, ty) < 1e-7) {
          a = outline[(k + L - 2) % L];
          b = outline[(k + 2) % L];
          (tx = b[0] - a[0]), (ty = b[1] - a[1]);
        }
        const q = surf(outline[k][0], outline[k][1], hT, dp, tmp);
        wn.push(safeN(ty, -tx, q.n[2] * 0.3 * Math.hypot(tx, ty), [...q.n]));
      }
      for (let k = 0; k < L; k++) push([...surf(outline[k][0], outline[k][1], hT, dp, tmp).p], wn[k]);
      for (let k = 0; k < L; k++) push([...surf(outline[k][0], outline[k][1], hB, dp, tmp).p], wn[k]);
    },
    (tri) => {
      for (let i = 0; i < M - 1; i++) {
        tri(i, M + i, M + i + 1);
        tri(i, M + i + 1, i + 1);
      }
      const L = 2 * M,
        wt = 2 * M,
        wb = 2 * M + L;
      for (let k = 0; k < L; k++) {
        const k1 = (k + 1) % L;
        tri(wt + k, wb + k, wb + k1);
        tri(wt + k, wb + k1, wt + k1);
      }
    },
  );
}
// face cap (yellow, with the mouth hole) and the mouth cavity (ink), both from the mouth's polar targets
const CHEB = (K) => Array.from({ length: K + 1 }, (_, j) => 0.5 - 0.5 * Math.cos((Math.PI * j) / K));
function addCap(B, surf, mouth, N, K) {
  const tmp = { p: [0, 0, 0], n: [0, 0, 1] };
  const ts = CHEB(K);
  B.block(
    (t, push) => {
      const { c, r } = mouth[t];
      for (let j = 0; j <= K; j++)
        for (let k = 0; k < N; k++) {
          const a = (TAU * k) / N,
            dx = Math.cos(a),
            dy = Math.sin(a);
          const m = [c[0] + dx * r[k], c[1] + dy * r[k]];
          const b = c[0] * dx + c[1] * dy,
            cc = c[0] * c[0] + c[1] * c[1] - 1;
          const tc = -b + Math.sqrt(Math.max(0, b * b - cc)); // ray from c to the face rim
          const q = surf(...lerp2(m, [c[0] + dx * tc, c[1] + dy * tc], ts[j]), 0, 0, tmp);
          push([...q.p], [...q.n]);
        }
    },
    (tri) => {
      for (let j = 0; j < K; j++)
        for (let k = 0; k < N; k++) {
          const k1 = (k + 1) % N,
            a = j * N + k,
            b = j * N + k1,
            c = (j + 1) * N + k,
            d = (j + 1) * N + k1;
          tri(a, c, d);
          tri(a, d, b);
        }
    },
  );
}
function addCavity(B, surf, mouth, N, D) {
  const tmp = { p: [0, 0, 0], n: [0, 0, 1] };
  const rings = [
    [0, 0],
    [0.3, 0.05],
    [1, 0.12],
  ]; // [share of the depth, shrink toward the centre]
  B.block(
    (t, push) => {
      const { c, r } = mouth[t];
      const ringAt = (dd, sh, k, nrm) => {
        const a = (TAU * k) / N;
        const q = surf(c[0] + Math.cos(a) * r[k], c[1] + Math.sin(a) * r[k], 0, 0, tmp);
        const rr = r[k] * (1 - sh);
        push([(c[0] + Math.cos(a) * rr) * surf.R, (c[1] + Math.sin(a) * rr) * surf.R, q.p[2] - dd * D * surf.R], nrm || safeN(-Math.cos(a), -Math.sin(a), 0.35 + dd * 0.6, [0, 0, 1]));
      };
      for (const [dd, sh] of rings) for (let k = 0; k < N; k++) ringAt(dd, sh, k);
      const q = surf(c[0], c[1], 0, 0, tmp);
      push([c[0] * surf.R, c[1] * surf.R, q.p[2] - D * surf.R], safeN(0, 0.15, 1, [0, 0, 1]));
      for (let k = 0; k < N; k++) ringAt(1, 0.12, k, safeN(0, 0.15, 1, [0, 0, 1]));
    },
    (tri) => {
      for (let j = 0; j < 2; j++)
        for (let k = 0; k < N; k++) {
          const k1 = (k + 1) % N,
            a = j * N + k,
            b = j * N + k1,
            c = (j + 1) * N + k,
            d = (j + 1) * N + k1;
          tri(a, d, c);
          tri(a, b, d);
        }
      const ctr = 3 * N;
      for (let k = 0; k < N; k++) tri(ctr, ctr + 1 + k, ctr + 1 + ((k + 1) % N));
    },
    (i) => (i < N ? [1, 1, 1] : i < 2 * N ? [0.7, 0.7, 0.7] : [0.38, 0.38, 0.38]),
  );
}

// ---------------------------------------------------------------------------------------------- cracks (damage)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function crackPaths(seed, starts) {
  const rnd = rng(seed);
  const eL = uv(EYE_L),
    eR = uv(EYE_R);
  const avoid = (u, v) => (Math.abs(u) < 0.6 && v < 0.18 && v > -0.8) || Math.hypot(u - eL[0], v - eL[1]) < 0.22 || Math.hypot(u - eR[0], v - eR[1]) < 0.22;
  const paths = [];
  const walk = (p, dir, len, w, depth) => {
    const pts = [p];
    let a = dir,
      q = p,
      l = 0;
    while (l < len) {
      a += (rnd() - 0.5) * 0.9;
      const st = 0.03 + rnd() * 0.03;
      const nq = [q[0] + Math.cos(a) * st, q[1] + Math.sin(a) * st];
      if (Math.hypot(nq[0], nq[1]) > 0.94 || avoid(nq[0], nq[1])) break;
      pts.push(nq);
      q = nq;
      l += st;
      if (depth < 2 && pts.length > 2 && rnd() < 0.28) walk(q, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.5), len * 0.45, w * 0.7, depth + 1);
    }
    if (pts.length > 1) paths.push({ pts, w });
  };
  for (const deg of starts) {
    const a = (deg * Math.PI) / 180;
    walk([Math.cos(a) * 0.93, Math.sin(a) * 0.93], a + Math.PI + (rnd() - 0.5) * 0.4, 0.3 + rnd() * 0.22, 1, 0);
  }
  return paths;
}
function crackGeometry(surf, paths, width, h) {
  const pos = [],
    nrm = [],
    idx = [];
  const tmp = { p: [0, 0, 0], n: [0, 0, 1] };
  for (const { pts, w } of paths) {
    const base = pos.length / 3;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)],
        b = pts[Math.min(n - 1, i + 1)];
      let tx = b[0] - a[0],
        ty = b[1] - a[1];
      const l = Math.hypot(tx, ty) || 1;
      (tx /= l), (ty /= l);
      const taper = (1 - (i / (n - 1)) * 0.85) * w * width * (0.7 + (0.6 * ((i * 7919) % 5)) / 5);
      for (const s of [1, -1]) {
        const q = surf(pts[i][0] - ty * taper * s, pts[i][1] + tx * taper * s, h, 0, tmp);
        pos.push(...q.p);
        nrm.push(...q.n);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------------------------- materials
function withFlash(mat, flashU) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev?.call(mat, sh, r);
    sh.uniforms.uBossFlash = flashU;
    sh.fragmentShader =
      "uniform vec3 uBossFlash;\n" + sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += uBossFlash;");
  };
  mat.customProgramCacheKey = () => "boss-flash";
  return mat;
}
function faceMaterials(look) {
  const g = look.glow;
  const phys = (hex, o = {}) =>
    new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0, envMapIntensity: 0.4, emissive: hex, emissiveIntensity: g, ...o });
  return {
    yellow: phys(0xffd21e, { roughness: 0.55 }),
    ink: phys(0x32343d, { roughness: 0.7, envMapIntensity: 0.15, emissiveIntensity: 0, vertexColors: true }),
    red: phys(0xff323d, { roughness: 0.5 }),
    vein: phys(0xff323d, { roughness: 0.4, emissiveIntensity: g * 2.5 }),
    amber: phys(0xffad03, { roughness: 0.5 }),
    white: phys(0xf4f1ea, { roughness: 0.35, emissiveIntensity: g * 0.6 }),
    crackDark: new THREE.MeshStandardMaterial({ color: 0x15100a, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    crackGlow: new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: P.hfOrange, emissiveIntensity: 1.6, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
  };
}

// ---------------------------------------------------------------------------------------------- the hand rig
// Hand frame (both hands): origin = palm centre, fingers along +Y, back of the hand +Z, palm side −Z.
// sx = +1 for hands.l (thumb toward +X, toward the face), −1 for hands.r (mirrored geometry, no negative scale).
// Joints are rigid segments on pivots (a mechanical gauntlet); a pose = finger spread/curl, thumb, vents, core glow
// and the wrist orientation. `rot` is a YXZ euler of the whole hand; slam/stuck put the palm face down.
const POSES = {
  open: { rot: [0.12, 0.3, 0.34], spread: [-0.12, 0.05, 0.22, 0.4], curl: [0.16, 0.18, 0.12], thumb: [0.12, 0.15, 0.12], vent: 0, core: 0 },
  fist: { rot: [0.28, 0.45, 0.08], spread: [0.03, 0, -0.03, -0.06], curl: [1.45, 1.7, 1.25], thumb: [0.55, 0.75, 0.95], vent: 0, core: 0.12 },
  slam: { rot: [-Math.PI / 2, Math.PI, 0], spread: [-0.04, -0.01, 0.02, 0.05], curl: [0.03, 0.02, -0.06], thumb: [-0.28, 0.05, 0.05], vent: 0, core: 0.25 },
  stuck: { rot: [-Math.PI / 2 + 0.05, Math.PI + 0.14, 0.07], spread: [-0.22, -0.06, 0.1, 0.27], curl: [0.2, 0.28, 0.16], thumb: [0.38, 0.22, 0.2], vent: 1, core: 1 },
};
const POSE_RATE = { open: 7, fist: 12, slam: 22, stuck: 16 };
const poseVec = (p) => [...p.spread, ...p.curl, ...p.thumb, p.vent, p.core];
const NV = 12;

function handDims(R) {
  return {
    Pw: 0.42 * R,
    Ph: 0.34 * R,
    Pt: 0.17 * R,
    fx: [0.62, 0.21, -0.21, -0.62],
    fy: [0, 0.025, 0, -0.05],
    fr: [0.056, 0.058, 0.055, 0.049].map((r) => r * R),
    fl: [1, 1.08, 1, 0.82],
    seg: [0.13 * R, 0.1 * R, 0.08 * R],
    thumbAt: [0.47, -0.1],
    thumbRest: -0.95,
    tr: 0.064 * R,
    tseg: [0.12 * R, 0.1 * R],
  };
}
function buildHandPlaceholder(R, sx, M) {
  const d = handDims(R);
  const content = new THREE.Group();
  content.name = sx > 0 ? "hand_l" : "hand_r";
  const pre = sx > 0 ? "l_" : "r_";
  const add = (geo, mat, parent, x = 0, y = 0, z = 0, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (name) m.name = name;
    parent.add(m);
    return m;
  };
  add(new RoundedBoxGeometry(d.Pw, d.Ph, d.Pt, 3, d.Pt * 0.4), M.yellow, content, 0, 0, 0, pre + "palm");
  // the logo's orange outline: a rim around the yellow shell
  add(new RoundedBoxGeometry(d.Pw * 1.05, d.Ph * 1.04, d.Pt * 0.7, 3, d.Pt * 0.3), M.orange, content, 0, 0, -d.Pt * 0.12);
  // back: armour housing with the weak core under two vent shutters
  add(new RoundedBoxGeometry(d.Pw * 0.7, d.Ph * 0.66, d.Pt * 0.3, 2, d.Pt * 0.1), M.gun, content, 0, -d.Ph * 0.02, d.Pt * 0.42);
  const core = add(new THREE.SphereGeometry(0.085 * R, 20, 14), M.core, content, 0, -d.Ph * 0.02, d.Pt * 0.48, pre + "core");
  const vents = [-1, 1].map((s) =>
    add(new RoundedBoxGeometry(d.Pw * 0.34, d.Ph * 0.6, d.Pt * 0.12, 2, d.Pt * 0.05), M.yellow, content, s * d.Pw * 0.17, -d.Ph * 0.02, d.Pt * 0.6, pre + "vent_" + (s < 0 ? "a" : "b")),
  );
  for (const v of vents) v.userData.x0 = v.position.x;
  // wrist cuff with the accent glow and a thruster
  add(new THREE.CylinderGeometry(0.15 * R, 0.17 * R, 0.1 * R, 24), M.gun, content, 0, -d.Ph * 0.55, 0);
  add(new THREE.TorusGeometry(0.155 * R, 0.018 * R, 8, 32), M.accent, content, 0, -d.Ph * 0.6, 0).rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.1 * R, 0.06 * R, 0.04 * R, 20), M.accent, content, 0, -d.Ph * 0.62, 0);
  const segment = (joint, L, r) => {
    add(new THREE.CapsuleGeometry(r, Math.max(0.01, L - r * 1.4), 4, 12), M.yellow, joint, 0, L * 0.5, 0);
    add(new THREE.TorusGeometry(r * 1.02, r * 0.22, 6, 16), M.orange, joint).rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(r * 0.92, 12, 8), M.gun, joint);
  };
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    let parent = content;
    const chain = [];
    for (let j = 0; j < 3; j++) {
      const joint = new THREE.Group();
      joint.name = `${pre}f${i + 1}${"abc"[j]}`;
      if (!j) joint.position.set(sx * d.fx[i] * d.Pw * 0.5, d.Ph * 0.5 + d.fy[i] * R, 0);
      else joint.position.y = d.seg[j - 1] * d.fl[i];
      parent.add(joint);
      segment(joint, d.seg[j] * d.fl[i], d.fr[i] * (1 - j * 0.07));
      joint.userData.rest = joint.rotation.clone();
      chain.push(joint);
      parent = joint;
    }
    fingers.push(chain);
  }
  const thumb = [];
  let parent = content;
  for (let j = 0; j < 2; j++) {
    const joint = new THREE.Group();
    joint.name = `${pre}t${"ab"[j]}`;
    if (!j) {
      joint.position.set(sx * d.thumbAt[0] * d.Pw, d.thumbAt[1] * d.Ph, -d.Pt * 0.05);
      joint.rotation.z = sx * d.thumbRest;
    } else joint.position.y = d.tseg[0];
    parent.add(joint);
    segment(joint, d.tseg[j], d.tr * (1 - j * 0.08));
    joint.userData.rest = joint.rotation.clone();
    thumb.push(joint);
    parent = joint;
  }
  const impact = new THREE.Object3D();
  impact.name = pre + "impact";
  impact.position.set(0, 0, -d.Pt * 0.5);
  content.add(impact);
  return { content, fingers, thumb, vents, core, impact, dims: d };
}
// the same rig from glb nodes (names from design/3d/end2/boss/boss.py)
function rigFromNodes(content, sx, R) {
  const pre = sx > 0 ? "l_" : "r_";
  const get = (n) => content.getObjectByName(pre + n);
  const fingers = [1, 2, 3, 4].map((i) => ["a", "b", "c"].map((j) => get(`f${i}${j}`)));
  const thumb = ["a", "b"].map((j) => get("t" + j));
  if (!fingers.flat().every(Boolean) || !thumb.every(Boolean) || !get("impact")) return null;
  for (const j of [...fingers.flat(), ...thumb]) j.userData.rest = j.rotation.clone();
  const vents = ["vent_a", "vent_b"].map(get).filter(Boolean);
  for (const v of vents) v.userData.x0 = v.position.x;
  return { content, fingers, thumb, vents, core: get("core"), impact: get("impact"), dims: handDims(R) };
}

// ---------------------------------------------------------------------------------------------- particles (world space)
const PART_VS = /* glsl */ `
  attribute vec3 iPos; attribute vec4 iCol; attribute vec3 iSz;
  varying vec2 vUv; varying vec4 vCol; varying float vSeed;
  void main(){
    vUv = uv; vCol = iCol; vSeed = iSz.z;
    vec4 mv = viewMatrix * vec4(iPos, 1.0);
    float c = cos(iSz.y), s = sin(iSz.y);
    mv.xy += mat2(c, -s, s, c) * position.xy * iSz.x;
    gl_Position = projectionMatrix * mv;
  }`;
const PART_FS = /* glsl */ `
  uniform float soft;
  varying vec2 vUv; varying vec4 vCol; varying float vSeed;
  float h(float p){ return fract(sin(p * 127.1 + vSeed * 17.0) * 43758.5453); }
  void main(){
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float a = atan(d.y, d.x + 1e-5);
    float lump = 0.8 + 0.2 * h(floor(a * 2.5 + 8.0));
    float m = 1.0 - smoothstep(lump * (1.0 - soft), lump, r);
    if (m <= 0.001) discard;
    gl_FragColor = vec4(vCol.rgb, clamp(vCol.a * m, 0.0, 1.0));
  }`;
function createParticles(parent, max, additive) {
  const base = new THREE.PlaneGeometry(1, 1);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute("position", base.getAttribute("position"));
  geo.setAttribute("uv", base.getAttribute("uv"));
  const iPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const iCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const iSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute("iPos", iPos);
  geo.setAttribute("iCol", iCol);
  geo.setAttribute("iSz", iSz);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: { soft: { value: additive ? 0.9 : 0.55 } },
    vertexShader: PART_VS,
    fragmentShader: PART_FS,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = additive ? 6 : 5;
  parent.add(mesh);
  const list = [];
  const col = new THREE.Color();
  return {
    spawn(p) {
      if (list.length >= max) list.shift();
      p.t = 0;
      p.seed ??= Math.random();
      list.push(p);
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].t += dt) >= list[i].life) list.splice(i, 1);
      let n = 0;
      for (const p of list) {
        const k = p.t / p.life;
        const dr = Math.exp(-(p.drag || 0) * dt);
        p.v[0] *= dr;
        p.v[1] = p.v[1] * dr - (p.g || 0) * dt;
        p.v[2] *= dr;
        p.x[0] += p.v[0] * dt;
        p.x[1] += p.v[1] * dt;
        p.x[2] += p.v[2] * dt;
        if (p.floor !== undefined && p.x[1] < p.floor) {
          p.x[1] = p.floor;
          p.v[1] *= -0.25;
          p.v[0] *= 0.6;
          p.v[2] *= 0.6;
        }
        const fade = p.fadeIn ? Math.min(1, k / p.fadeIn) * (1 - k) : 1 - k * k;
        col.setHex(p.c);
        iPos.array[n * 3] = p.x[0];
        iPos.array[n * 3 + 1] = p.x[1];
        iPos.array[n * 3 + 2] = p.x[2];
        iCol.array[n * 4] = col.r;
        iCol.array[n * 4 + 1] = col.g;
        iCol.array[n * 4 + 2] = col.b;
        iCol.array[n * 4 + 3] = Math.max(0, p.a * fade);
        iSz.array[n * 3] = p.s0 + (p.s1 - p.s0) * Math.sqrt(k);
        iSz.array[n * 3 + 1] = (p.rot || 0) + (p.spin || 0) * p.t;
        iSz.array[n * 3 + 2] = p.seed;
        n++;
      }
      geo.instanceCount = n;
      iPos.needsUpdate = iCol.needsUpdate = iSz.needsUpdate = true;
    },
    clear() {
      list.length = 0;
      geo.instanceCount = 0;
    },
    get count() {
      return list.length;
    },
    dispose() {
      parent.remove(mesh);
      geo.dispose();
      base.dispose();
      mat.dispose();
    },
  };
}
function crackDecalTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, "rgba(10,8,6,0.85)");
  grd.addColorStop(0.35, "rgba(14,11,8,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const rnd = rng(7);
  g.strokeStyle = "rgba(4,3,2,0.9)";
  g.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    let a = (i / 14) * TAU + rnd() * 0.3,
      x = 128 + Math.cos(a) * 18,
      y = 128 + Math.sin(a) * 18;
    for (let s = 0; s < 9; s++) {
      g.lineWidth = Math.max(0.6, 3.5 - s * 0.35);
      g.beginPath();
      g.moveTo(x, y);
      a += (rnd() - 0.5) * 0.7;
      x += Math.cos(a) * 11;
      y += Math.sin(a) * 11;
      g.lineTo(x, y);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------------------------------------------------------------------------------------------- the model
export function createBossModel(opts = {}) {
  const look = { ...BOSS_LOOK_DEFAULTS, ...(opts.look || {}) };
  const R = opts.radius ?? look.radius;
  const scene = opts.scene || null;
  const floorY = () => opts.floorY ?? opts.arena?.center?.y ?? 0;
  const S = R / 7; // fx scale

  const root = new THREE.Group();
  root.name = "boss";
  const head = new THREE.Group();
  head.name = "boss_head";
  head.position.y = R;
  root.add(head);
  const face = new THREE.Group(); // expression motion lives here (fight turns `head`)
  face.name = "boss_face";
  head.add(face);
  const fxRoot = new THREE.Group();
  fxRoot.name = "boss fx";
  (scene || root).add(fxRoot);

  const flashU = { face: { value: new THREE.Color(0, 0, 0) }, hand_l: { value: new THREE.Color(0, 0, 0) }, hand_r: { value: new THREE.Color(0, 0, 0) } };
  const flashT = { face: 0, hand_l: 0, hand_r: 0 },
    flashCol = { face: new THREE.Color(), hand_l: new THREE.Color(), hand_r: new THREE.Color() };

  const FM = faceMaterials(look);
  for (const m of Object.values(FM)) withFlash(m, flashU.face);
  const accentColor = new THREE.Color(P.hfAmber);
  const accentMats = new Set(); // every material that carries the phase glow

  // ---------------- placeholder shell (replaced by the glb's boss_head)
  const shellPh = new THREE.Group();
  shellPh.name = "shell (placeholder)";
  face.add(shellPh);
  const shellMats = {
    gun: withFlash(new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.45, metalness: 0.75 }), flashU.face),
    steel: withFlash(new THREE.MeshStandardMaterial({ color: 0x59616c, roughness: 0.35, metalness: 0.9 }), flashU.face),
    orange: withFlash(new THREE.MeshStandardMaterial({ color: P.hfOrange, roughness: 0.42, emissive: P.hfOrange, emissiveIntensity: look.glow * 0.8 }), flashU.face),
    accent: withFlash(new THREE.MeshStandardMaterial({ color: 0x1a1006, emissive: P.hfAmber, emissiveIntensity: 1.4, roughness: 0.5 }), flashU.face),
  };
  accentMats.add(shellMats.accent);
  {
    const back = new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 48, 20, Math.PI, Math.PI), shellMats.gun);
    back.scale.z = 0.92;
    shellPh.add(back);
    shellPh.add(new THREE.Mesh(new THREE.TorusGeometry(R * 1.035, R * 0.075, 16, 120), shellMats.orange));
    const collar = new THREE.Mesh(new THREE.TorusGeometry(R * 0.96, R * 0.06, 10, 96), shellMats.steel);
    collar.position.z = -R * 0.2;
    shellPh.add(collar);
    for (const [z, s] of [
      [-0.42, 0.88],
      [-0.66, 0.7],
    ]) {
      const g = new THREE.Mesh(new THREE.TorusGeometry(R * s, R * 0.014, 6, 96), shellMats.accent);
      g.position.z = R * z;
      shellPh.add(g);
    }
    for (let i = 0; i < 3; i++) {
      const a = (i - 1) * 0.7;
      const th = new THREE.Group();
      th.position.set(Math.sin(a) * R * 0.55, -R * 0.82, -R * 0.2);
      th.add(new THREE.Mesh(new THREE.CylinderGeometry(R * 0.11, R * 0.15, R * 0.22, 20), shellMats.gun));
      const glow = new THREE.Mesh(new THREE.CircleGeometry(R * 0.1, 20), shellMats.accent);
      glow.rotation.x = Math.PI / 2;
      glow.position.y = -R * 0.115;
      th.add(glow);
      shellPh.add(th);
    }
  }
  // face hit proxy (raycast target, never drawn)
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  const faceProxy = new THREE.Mesh(new THREE.SphereGeometry(R * 1.02, 12, 8), proxyMat);
  faceProxy.name = "boss_face_hit";
  head.add(faceProxy);

  // ---------------- the face (from the official SVG)
  const surf = makeSurface(R, look.depth);
  const morphMeshes = [];
  const parts = {};
  let faceReady = false;
  const flat = new THREE.Mesh(new THREE.CircleGeometry(R, 64), FM.yellow); // until the SVG is in
  flat.position.z = R * look.depth * 0.9;
  face.add(flat);
  const D = 0.16; // mouth cavity depth / R
  const crack = { groups: [], tips: [] };
  function buildFace(logo) {
    const N_M = 180,
      N_E = 72,
      N_C = 48,
      N_T = 64;
    const mouthT = mouthTargets(logo).map((m) => {
      const polys = m.polys.map(uvs);
      const c = m.c ? uv(m.c) : starCentre(polys[0]);
      return { c, r: polar(polys, c, N_M) };
    });
    const capB = new MorphBuilder();
    addCap(capB, surf, mouthT, N_M, 22);
    const cap = new THREE.Mesh(capB.build(), FM.yellow);
    cap.name = "boss_face_cap";
    {
      // planar uv for worn paint maps
      const p = cap.geometry.getAttribute("position"),
        u = cap.geometry.getAttribute("uv");
      for (let i = 0; i < p.count; i++) u.setXY(i, p.getX(i) / (2 * R) + 0.5, p.getY(i) / (2 * R) + 0.5);
    }
    const ink = new MorphBuilder();
    addCavity(ink, surf, mouthT, N_M, D);
    for (const side of [-1, 1]) {
      const eT = eyeTargets(logo, side).map((poly) => {
        const pp = uvs(poly);
        const c = starCentre(pp);
        return { c, r: polar([pp], c, N_E) };
      });
      addBlob(ink, surf, eT, N_E, { top: 0.022, bottom: -0.01, dome: 0.004 });
      const bT = browTargets(side).map((b) => ({ top: uvs(b.top), bot: uvs(b.bot) }));
      addStrip(ink, surf, bT, { top: [-0.03, 0.036, 0.03, 0.034], bottom: [-0.05, -0.01, -0.01, -0.01] });
    }
    const inkMesh = new THREE.Mesh(ink.build(), FM.ink);
    inkMesh.name = "boss_face_ink";
    const red = new MorphBuilder();
    const tT = tongueTargets(logo).map((poly) => {
      const pp = uvs(poly);
      const c = starCentre(pp);
      return { c, r: polar([pp], c, N_T) };
    });
    addBlob(red, surf, tT, N_T, { top: 0, bottom: -0.06, dome: [0.03, 0.01, 0.01, 0.04], depth: D * 0.72 });
    const tongue = new THREE.Mesh(red.build(), FM.red);
    tongue.name = "boss_face_tongue";
    const amb = new MorphBuilder();
    for (const [i, cc] of [CHEEK_L, CHEEK_R].entries()) {
      const neutral = logo.cheeks[i];
      const cT = [neutral, scalePoly(neutral, cc, 1.18, [0, 0.5]), scalePoly(neutral, cc, 1.05, [0, 1]), scalePoly(neutral, cc, 1.08)].map((poly) => {
        const c = uv(cc);
        return { c, r: polar([uvs(poly)], c, N_C) };
      });
      addBlob(amb, surf, cT, N_C, { top: 0.012, bottom: -0.008, dome: 0.003 });
    }
    const cheeks = new THREE.Mesh(amb.build(), withFlash(FM.amber.clone(), flashU.face));
    cheeks.name = "boss_face_cheeks";
    const meshes = [cap, inkMesh, tongue, cheeks];
    if (look.teeth) {
      const { upperT, lowerT } = teethTargets();
      const wt = new MorphBuilder();
      const conv = (T) => T.map((b) => ({ top: uvs(b.top), bot: uvs(b.bot) }));
      const dp = [D * 0.5, D * 0.14, D * 0.5, D * 0.16];
      addStrip(wt, surf, conv(upperT), { top: 0.01, bottom: -0.02, depth: dp });
      addStrip(wt, surf, conv(lowerT), { top: 0.01, bottom: -0.02, depth: dp });
      parts.teeth = new THREE.Mesh(wt.build(), FM.white);
      parts.teeth.name = "boss_face_teeth";
      meshes.push(parts.teeth);
    }
    for (const m of meshes) {
      face.add(m);
      morphMeshes.push(m);
    }
    if (look.vein) {
      const { vc, parts: vp } = veinTargets();
      const vb = new MorphBuilder();
      for (const bracket of vp)
        addStrip(
          vb,
          surf,
          bracket.map((b) => ({ top: uvs(b.top), bot: uvs(b.bot) })),
          { top: [-0.03, 0.03, -0.03, 0.026], bottom: [-0.05, -0.01, -0.05, -0.01] },
        );
      const vein = new THREE.Mesh(vb.build(), FM.vein);
      vein.name = "boss_face_vein";
      const pivot = new THREE.Group(); // pulses around the mark's own centre
      const s = surf(...uv(vc), 0.02);
      pivot.position.set(...s.p);
      vein.position.set(-s.p[0], -s.p[1], -s.p[2]);
      pivot.add(vein);
      face.add(pivot);
      parts.vein = vein;
      parts.veinPivot = pivot;
      morphMeshes.push(vein);
    }
    Object.assign(parts, { cap, ink: inkMesh, tongue, cheeks });
    // cracks: stage 1 at 66 %, stage 2 adds more at 33 %
    const stages = [crackPaths(11, [128, -22, 214]), crackPaths(23, [58, 162, 300, 244, 12])];
    for (const paths of stages) {
      const g = new THREE.Group();
      g.name = "boss_cracks";
      g.add(new THREE.Mesh(crackGeometry(surf, paths, 0.016, 0.006), FM.crackDark));
      g.add(new THREE.Mesh(crackGeometry(surf, paths, 0.0055, 0.0075), FM.crackGlow));
      g.visible = false;
      face.add(g);
      crack.groups.push(g);
      crack.tips.push(paths.filter((p) => p.w === 1).map((p) => surf(p.pts[0][0], p.pts[0][1], 0.01).p.slice()));
    }
    accentMats.add(FM.crackGlow);
    face.remove(flat);
    flat.geometry.dispose();
    faceReady = true;
    applyDamage();
  }

  // ---------------- hands
  const handMats = (part) => {
    const u = flashU[part];
    const M = {
      yellow: withFlash(new THREE.MeshStandardMaterial({ color: 0xffd21e, roughness: 0.45, emissive: 0xffd21e, emissiveIntensity: look.glow }), u),
      orange: withFlash(new THREE.MeshStandardMaterial({ color: P.hfOrange, roughness: 0.45, emissive: P.hfOrange, emissiveIntensity: look.glow * 0.8 }), u),
      gun: withFlash(new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.45, metalness: 0.75 }), u),
      accent: withFlash(new THREE.MeshStandardMaterial({ color: 0x1a1006, emissive: P.hfAmber, emissiveIntensity: 1.4, roughness: 0.5 }), u),
      core: withFlash(new THREE.MeshStandardMaterial({ color: 0x2a1000, emissive: P.hfOrange, emissiveIntensity: 0.2, roughness: 0.3 }), u),
    };
    accentMats.add(M.accent);
    return M;
  };
  const hands = {};
  const handState = {};
  const _e = new THREE.Euler();
  const poseQuat = (hs, pose, out) => out.setFromEuler(_e.set(pose.rot[0], hs.sx * pose.rot[1], hs.sx * pose.rot[2], "YXZ"));
  for (const side of ["l", "r"]) {
    const sx = side === "l" ? 1 : -1;
    const part = side === "l" ? "hand_l" : "hand_r";
    const hroot = new THREE.Group();
    hroot.name = "boss_hand_" + side;
    const pivot = new THREE.Group(); // the wrist: boss yaw × pose orientation (fight only moves hroot)
    pivot.name = "boss_hand_pose_" + side;
    hroot.add(pivot);
    const M = handMats(part);
    const rig = buildHandPlaceholder(R, sx, M);
    pivot.add(rig.content);
    const palm = new THREE.Object3D();
    palm.name = "boss_palm_" + side;
    rig.impact.add(palm);
    const d = rig.dims;
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(d.Pw * 1.1, d.Ph + d.seg[0] * 2.6, d.Pt * 1.4), proxyMat);
    proxy.position.y = d.seg[0] * 1.1;
    proxy.name = "boss_hand_hit_" + side;
    pivot.add(proxy);
    const shadow = look.shadow ? blobShadow(R * 0.42, 0.5) : null;
    if (shadow) fxRoot.add(shadow);
    (scene || root).add(hroot);
    hands[side] = { root: hroot, palm, radius: R * 0.3, pivot };
    const hs = {
      sx,
      part,
      rig,
      M,
      pivot,
      proxy,
      shadow,
      cur: poseVec(POSES.open),
      tgt: poseVec(POSES.open),
      q: new THREE.Quaternion(),
      qt: new THREE.Quaternion(),
      pose: "open",
      k: 1,
      weights: { open: 1, fist: 0, slam: 0, stuck: 0 },
      wt: { open: 1, fist: 0, slam: 0, stuck: 0 },
      charge: 0,
      jolt: 0,
      phase: Math.random() * 10,
    };
    poseQuat(hs, POSES.open, hs.q);
    handState[side] = hs;
  }
  function setHandPose(side, pose, k = 1) {
    const hs = handState[side];
    if (!hs || !POSES[pose]) return;
    hs.pose = pose;
    hs.k = THREE.MathUtils.clamp(k ?? 1, 0, 1);
    for (const n of Object.keys(hs.wt)) hs.wt[n] = 0;
    hs.wt.open = 1 - hs.k;
    hs.wt[pose] += hs.k;
  }
  const _qa = new THREE.Quaternion(),
    _qb = new THREE.Quaternion(),
    _qp = new THREE.Quaternion();
  function applyHand(hs, dt, time, yawQ) {
    const a = 1 - Math.exp(-(POSE_RATE[hs.pose] || 8) * dt);
    hs.tgt.fill(0);
    for (const [n, w] of Object.entries(hs.wt)) {
      if (!w) continue;
      const v = poseVec(POSES[n]);
      for (let i = 0; i < NV; i++) hs.tgt[i] += v[i] * w;
    }
    for (let i = 0; i < NV; i++) hs.cur[i] += (hs.tgt[i] - hs.cur[i]) * a;
    for (const n of Object.keys(hs.weights)) hs.weights[n] += (hs.wt[n] - hs.weights[n]) * a;
    hs.qt.copy(poseQuat(hs, POSES.open, _qa)).slerp(poseQuat(hs, POSES[hs.pose], _qb), hs.k);
    hs.q.slerp(hs.qt, a);
    // wrist = (hand root's world rotation)^-1 × boss yaw × pose, so fight only ever moves the root
    hs.pivot.parent.getWorldQuaternion(_qp).invert();
    hs.pivot.quaternion.copy(_qp).multiply(yawQ).multiply(hs.q);
    // alive: a slow fidget when open, a twitch when stuck
    const open = hs.weights.open,
      stuck = hs.weights.stuck;
    const fid = (i) => open * 0.06 * Math.sin(time * 1.6 + i * 1.3 + hs.phase) + stuck * (Math.sin(time * 23 + i * 4 + hs.phase) > 0.93 ? 0.18 : 0);
    const { fingers, thumb, vents, core } = hs.rig;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 3; j++) {
        const jn = fingers[i][j],
          r = jn.userData.rest;
        jn.rotation.set(r.x - hs.cur[4 + j] - fid(i) * (j + 1) * 0.5, r.y, r.z + (j === 0 ? hs.sx * hs.cur[i] : 0));
      }
    const t0 = thumb[0].userData.rest,
      t1 = thumb[1].userData.rest;
    thumb[0].rotation.set(t0.x - hs.cur[8], t0.y, t0.z + hs.sx * hs.cur[7]);
    thumb[1].rotation.set(t1.x - hs.cur[9], t1.y, t1.z);
    const vent = hs.cur[10];
    for (const v of vents) v.position.x = v.userData.x0 + Math.sign(v.userData.x0 || 1) * vent * hs.rig.dims.Pw * 0.2;
    if (core) core.scale.setScalar(1 + vent * 0.12 * Math.sin(time * 9));
    hs.M.core.emissiveIntensity = 0.15 + hs.cur[11] * (2.2 + 0.8 * Math.sin(time * 9)) + hs.charge * 2.5;
    // a slam's jolt: a quick squash of the whole hand
    hs.jolt = Math.max(0, hs.jolt - dt * 4);
    const j = Math.sin(hs.jolt * Math.PI) * 0.12;
    const s0 = hs.rig.content.userData.s0 ?? 1;
    hs.rig.content.scale.set(s0 * (1 + j * 0.4), s0 * (1 - j), s0 * (1 + j * 0.4));
  }

  // ---------------- expressions
  const W = { angry: 0, hurt: 0, roar: 0 },
    WT = { angry: 0, hurt: 0, roar: 0 };
  function setExpression(name, k = 1) {
    k = THREE.MathUtils.clamp(+k || 0, 0, 1);
    for (const n of EXPR) WT[n] = 0;
    if (name in WT) WT[name] = k;
    if (name === "roar" && k > 0.5 && W.roar < 0.3 && !roarQueue.length) roarFx();
  }
  const amber = new THREE.Color(0xffad03),
    red = new THREE.Color(0xff323d);
  function applyExpression(dt, time) {
    for (const n of EXPR) {
      const rate = n === "roar" ? 14 : WT[n] > W[n] ? 9 : 6;
      W[n] += (WT[n] - W[n]) * (1 - Math.exp(-rate * dt));
      if (W[n] < 1e-4) W[n] = 0;
    }
    if (!faceReady) return;
    for (const m of morphMeshes) {
      m.morphTargetInfluences[0] = W.angry;
      m.morphTargetInfluences[1] = W.hurt;
      m.morphTargetInfluences[2] = W.roar;
    }
    if (parts.teeth) parts.teeth.visible = W.angry + W.roar > 0.01;
    if (parts.vein) {
      parts.vein.visible = W.angry + W.roar > 0.01;
      parts.veinPivot.scale.setScalar(1 + 0.1 * Math.max(0, Math.sin(time * 7)) ** 3 * (W.angry + W.roar));
    }
    const flush = look.flush ? Math.min(1, W.angry * 0.9 + W.roar * 0.5) : 0;
    parts.cheeks.material.color.copy(amber).lerp(red, flush);
    parts.cheeks.material.emissive.copy(parts.cheeks.material.color);
    // angry trembles and leans in, roar rears back and shakes, hurt flinches
    const tr = look.tremble * (W.angry * 0.0035 + W.roar * 0.006) * R;
    face.position.set(Math.sin(time * 47) * tr, Math.sin(time * 39 + 1) * tr * 0.6 - W.hurt * 0.02 * R, -W.hurt * 0.04 * R);
    face.rotation.set(W.angry * 0.07 - W.roar * 0.16 + W.hurt * 0.05, 0, W.hurt * 0.09 * Math.sin(time * 3 + 1) + Math.sin(time * 31) * W.roar * 0.012);
  }

  // ---------------- damage, phase, flash
  let damage = 0,
    phase = 1,
    dying = 0;
  const shellDamage = { 1: [], 2: [], hide2: [] }; // glb nodes per stage
  function applyDamage() {
    crack.groups.forEach((g, i) => (g.visible = damage > i));
    for (const n of shellDamage[1]) n.visible = damage >= 1;
    for (const n of shellDamage[2]) n.visible = damage >= 2;
    for (const n of shellDamage.hide2) n.visible = damage < 2;
  }
  function setDamage(stage) {
    damage = THREE.MathUtils.clamp(stage | 0, 0, 2);
    applyDamage();
  }
  const PHASE_COL = { 1: P.hfAmber, 2: P.hfOrange, 3: P.hfRed };
  const PHASE_GLOW = { 1: 1.3, 2: 1.8, 3: 2.4 };
  const PHASE_PULSE = { 1: 1.4, 2: 2.6, 3: 5 };
  const phaseTarget = new THREE.Color(PHASE_COL[1]);
  function setPhase(n) {
    phase = THREE.MathUtils.clamp(n | 0, 1, 3);
    phaseTarget.setHex(PHASE_COL[phase]);
  }
  function flash(part = "face") {
    if (!(part in flashT)) part = "face";
    const side = part === "hand_l" ? "l" : part === "hand_r" ? "r" : null;
    const weak = side && handState[side].weights.stuck > 0.5;
    flashT[part] = 1;
    if (weak) flashCol[part].setRGB(1.2, 0.55, 0.12);
    else flashCol[part].setRGB(0.55, 0.45, 0.32);
    if (weak && Math.random() < 0.5) sparkBurst(worldOf(handState[side].pivot, 0, 0, handState[side].rig.dims.Pt * 0.6), 5, 0xffb040);
  }

  // ---------------- fx
  const add = createParticles(fxRoot, 480, true);
  const alpha = createParticles(fxRoot, 360, false);
  const _v = new THREE.Vector3();
  const worldOf = (obj, x = 0, y = 0, z = 0) => obj.localToWorld(new THREE.Vector3(x, y, z));
  const rnd = (a, b) => a + Math.random() * (b - a);
  function sparkBurst(at, n, c = 0xffb040, speed = 12) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      add.spawn({ x: [at.x, at.y, at.z], v: [Math.cos(a) * speed * rnd(0.3, 1), rnd(0.2, 1) * speed, Math.sin(a) * speed * rnd(0.3, 1)], g: 22, drag: 1.2, life: rnd(0.35, 0.8), s0: rnd(0.12, 0.22) * S, s1: 0.04, a: 1, c, floor: floorY() + 0.05 });
    }
  }
  const decals = [];
  const decalTex = crackDecalTexture();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    m.renderOrder = -1;
    m.userData.t = 99;
    fxRoot.add(m);
    decals.push(m);
  }
  function impact(side = "l", at) {
    const hs = handState[side];
    const p = at ? new THREE.Vector3(at.x, at.y, at.z) : hands[side]?.palm.getWorldPosition(new THREE.Vector3());
    if (!p) return;
    if (!at) p.y = floorY();
    // dust ring rolling out along the floor
    for (let i = 0; i < 46; i++) {
      const a = (i / 46) * TAU + rnd(-0.05, 0.05),
        sp = rnd(7, 15) * S;
      alpha.spawn({ x: [p.x + Math.cos(a) * 1.2 * S, p.y + rnd(0.2, 0.8) * S, p.z + Math.sin(a) * 1.2 * S], v: [Math.cos(a) * sp, rnd(0.5, 2.5), Math.sin(a) * sp], drag: 2.6, g: -0.3, life: rnd(1.3, 2.4), s0: rnd(1.0, 1.8) * S, s1: rnd(2.6, 4.2) * S, a: 0.5, c: 0xb6a68a, rot: rnd(0, TAU), spin: rnd(-0.6, 0.6), fadeIn: 0.08 });
    }
    for (let i = 0; i < 14; i++)
      alpha.spawn({ x: [p.x + rnd(-1.5, 1.5) * S, p.y + 0.5, p.z + rnd(-1.5, 1.5) * S], v: [rnd(-1.5, 1.5), rnd(3, 7) * S, rnd(-1.5, 1.5)], drag: 1.8, g: -0.2, life: rnd(1.2, 2), s0: 1.2 * S, s1: 3.2 * S, a: 0.4, c: 0x9e9078, rot: rnd(0, TAU), fadeIn: 0.1 });
    // debris chips
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU,
        sp = rnd(4, 11) * S;
      alpha.spawn({ x: [p.x, p.y + 0.4, p.z], v: [Math.cos(a) * sp, rnd(5, 12) * S, Math.sin(a) * sp], g: 26, drag: 0.4, life: rnd(0.9, 1.6), s0: rnd(0.16, 0.34) * S, s1: 0.12 * S, a: 1, c: 0x2a2620, rot: rnd(0, TAU), spin: rnd(-8, 8), floor: p.y + 0.05 });
    }
    sparkBurst(_v.copy(p).setY(p.y + 0.3), 24, 0xffb050, 13 * S);
    add.spawn({ x: [p.x, p.y + 0.5, p.z], v: [0, 0, 0], life: 0.25, s0: 5 * S, s1: 9 * S, a: 0.6, c: 0xff9a40 });
    // a cracked crater that fades
    const dcl = decals.reduce((a, b) => (b.userData.t > a.userData.t ? b : a));
    dcl.position.set(p.x, p.y + 0.03, p.z);
    dcl.scale.setScalar(R * 1.05);
    dcl.rotation.z = Math.random() * TAU;
    dcl.userData.t = 0;
    dcl.visible = true;
    if (hs) hs.jolt = 1;
  }
  // roar: rings of force out of the mouth
  const roarRings = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.82, 1, 64),
      new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    m.visible = false;
    m.userData.t = 99;
    m.renderOrder = 6;
    face.add(m);
    roarRings.push(m);
  }
  let roarQueue = [];
  const roarFx = () => (roarQueue = [0, 0.22, 0.44, 0.66]);
  function updateRoar(dt) {
    for (let i = roarQueue.length - 1; i >= 0; i--) {
      roarQueue[i] -= dt;
      if (roarQueue[i] > 0) continue;
      roarQueue.splice(i, 1);
      const m = roarRings.reduce((a, b) => (b.userData.t > a.userData.t ? b : a));
      m.userData.t = 0;
      m.visible = true;
    }
    const mc = surf(0, -0.3, 0).p;
    for (const m of roarRings) {
      const t = (m.userData.t += dt);
      if (!m.visible) continue;
      const k = t / 0.9;
      if (k >= 1) {
        m.visible = false;
        continue;
      }
      m.position.set(mc[0], mc[1], mc[2] + R * (0.3 + k * 2.4));
      m.scale.setScalar(R * (0.35 + k * 1.3));
      m.material.opacity = 0.35 * (1 - k) * (1 - k);
    }
  }
  let steamT = 0,
    sparkT = 0;
  function updateFx(dt) {
    if (look.steam && W.angry > 0.5 && faceReady) {
      steamT -= dt;
      if (steamT <= 0) {
        steamT = rnd(0.12, 0.22);
        for (const s of [-1, 1]) {
          const p = worldOf(head, s * R * 1.0, R * 0.32, R * 0.05);
          const dir = worldOf(head, s * R * 2, R * 1.2, 0).sub(p).normalize();
          alpha.spawn({ x: [p.x, p.y, p.z], v: [dir.x * 7 * S, dir.y * 7 * S + 2, dir.z * 7 * S], drag: 1.6, g: -1.5, life: rnd(0.9, 1.4), s0: R * 0.1, s1: R * rnd(0.32, 0.45), a: 0.42, c: 0xe8ecef, rot: rnd(0, TAU), spin: rnd(-1, 1), fadeIn: 0.12 });
        }
      }
    }
    if (faceReady && (damage > 0 || dying > 0)) {
      sparkT -= dt;
      if (sparkT <= 0) {
        sparkT = rnd(0.25, 0.8) / (1 + damage + dying * 6);
        const tips = crack.tips.slice(0, Math.max(1, damage)).flat();
        if (tips.length) {
          const t = tips[(Math.random() * tips.length) | 0];
          const w = worldOf(face, ...t);
          sparkBurst(w, 5 + damage * 3, phase === 3 ? 0xff6a40 : 0xffb040, 7 * S);
          if (damage >= 2 || dying > 0) alpha.spawn({ x: w.toArray(), v: [rnd(-0.5, 0.5), rnd(1.5, 3), rnd(-0.5, 0.5)], drag: 0.5, g: -0.6, life: rnd(1.5, 2.5), s0: R * 0.06, s1: R * 0.22, a: 0.35, c: 0x2c2a28, rot: rnd(0, TAU), fadeIn: 0.1 });
        }
      }
    }
    for (const side of ["l", "r"]) {
      const hs = handState[side];
      if (hs.weights.stuck > 0.6 && hands[side].root.visible && Math.random() < dt * 10)
        sparkBurst(worldOf(hs.pivot, rnd(-1, 1) * hs.rig.dims.Pw * 0.3, 0, hs.rig.dims.Pt * 0.7), 3, 0xffb040, 6 * S);
    }
    for (const d of decals) {
      if (!d.visible) continue;
      const k = (d.userData.t += dt) / 9;
      d.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) d.visible = false;
    }
    updateRoar(dt);
    add.update(dt);
    alpha.update(dt);
  }

  // ---------------- glb (shell, bezel, hands with worn paint)
  let glbLoaded = false;
  async function loadGlb() {
    if (!HAS_GLB || !look.glb || opts.glb === false) return;
    const gltf = await new GLTFLoader().loadAsync(opts.glbUrl || GLB_URL);
    const sc = gltf.scene;
    const hd = sc.getObjectByName("boss_shell");
    if (hd) {
      face.remove(shellPh);
      hd.position.set(0, 0, 0);
      hd.scale.setScalar(R / GLB_R);
      face.add(hd);
      hd.traverse((o) => {
        if (!o.isMesh) return;
        o.material = withFlash(o.material.clone(), flashU.face);
        if (/accent|thruster/.test(o.material.name)) accentMats.add(o.material);
      });
      shellDamage[1] = [hd.getObjectByName("dmg1")].filter(Boolean);
      shellDamage[2] = [hd.getObjectByName("dmg2")].filter(Boolean);
      shellDamage.hide2 = [hd.getObjectByName("bezel_chunk")].filter(Boolean);
      const paint = sc.getObjectByName("face_swatch");
      if (look.facePaint && paint?.material?.map && parts.cap) {
        const m = parts.cap.material;
        m.map = paint.material.map;
        m.normalMap = paint.material.normalMap;
        m.roughnessMap = paint.material.roughnessMap;
        m.color.setHex(0xffffff);
        m.needsUpdate = true;
      }
    }
    for (const side of ["l", "r"]) {
      const hs = handState[side];
      const node = sc.getObjectByName(side === "l" ? "hand_l" : "hand_r");
      if (!node) continue;
      node.position.set(0, 0, 0);
      node.scale.setScalar(R / GLB_R);
      node.userData.s0 = R / GLB_R;
      const rig = rigFromNodes(node, hs.sx, R);
      if (!rig) continue;
      node.traverse((o) => {
        if (!o.isMesh) return;
        o.material = withFlash(o.material.clone(), flashU[hs.part]);
        if (/accent/.test(o.material.name)) accentMats.add(o.material);
        if (/core/.test(o.material.name)) hs.M.core = o.material;
      });
      hs.pivot.remove(hs.rig.content);
      hs.pivot.add(node);
      rig.impact.add(hands[side].palm);
      hs.rig = rig;
    }
    applyDamage();
    glbLoaded = true;
  }
  const ready = loadLogoShapes()
    .then(buildFace)
    .then(() => loadGlb())
    .catch((e) => console.warn("[boss-model] placeholder kept:", e?.message || e));

  // ---------------- per frame
  const yawQ = new THREE.Quaternion(),
    tmpQ = new THREE.Quaternion(),
    eul = new THREE.Euler(),
    Y = new THREE.Vector3(0, 1, 0);
  const headShadow = look.shadow ? blobShadow(R * 1.0, 0.45) : null;
  if (headShadow) fxRoot.add(headShadow);
  function update(dt, time = performance.now() / 1000) {
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    applyExpression(dt, time);
    root.updateWorldMatrix(true, false);
    root.getWorldQuaternion(tmpQ);
    eul.setFromQuaternion(tmpQ, "YXZ");
    yawQ.setFromAxisAngle(Y, eul.y);
    for (const side of ["l", "r"]) {
      hands[side].root.updateWorldMatrix(true, false);
      applyHand(handState[side], dt, time, yawQ);
    }
    // phase glow (amber → orange → red), pulsing faster each phase
    const pulse = 0.82 + 0.18 * Math.sin(time * PHASE_PULSE[phase]);
    const flick = dying > 0 ? (Math.random() < dying * 0.4 ? 0.1 : 1) * (1 - dying * 0.7) : 1;
    accentColor.lerp(phaseTarget, 1 - Math.exp(-3 * dt));
    for (const m of accentMats) {
      m.emissive.copy(accentColor);
      m.emissiveIntensity = (m === FM.crackGlow ? 1.2 + damage * 0.4 : PHASE_GLOW[phase]) * pulse * flick;
    }
    for (const part of Object.keys(flashT)) {
      flashT[part] = Math.max(0, flashT[part] - dt / 0.11);
      flashU[part].value.copy(flashCol[part]).multiplyScalar(flashT[part] * flashT[part]);
    }
    const fy = floorY();
    if (headShadow) {
      head.getWorldPosition(_v);
      headShadow.position.set(_v.x, fy + 0.03, _v.z);
      headShadow.material.opacity = 0.45 * THREE.MathUtils.clamp(1.4 - Math.max(0, _v.y - fy) / (R * 3), 0.2, 1);
      headShadow.visible = root.visible;
    }
    for (const side of ["l", "r"]) {
      const hs = handState[side];
      if (!hs.shadow) continue;
      hands[side].palm.getWorldPosition(_v);
      const k = THREE.MathUtils.clamp(1 - Math.max(0, _v.y - fy) / (R * 1.6), 0, 1);
      hs.shadow.position.set(_v.x, fy + 0.04, _v.z);
      hs.shadow.scale.setScalar(0.7 + (1 - k) * 0.6);
      hs.shadow.material.opacity = 0.15 + 0.5 * k;
      hs.shadow.visible = hands[side].root.visible;
    }
    updateFx(dt);
  }

  const hitList = [
    { part: "face", object: faceProxy, weak: false },
    { part: "hand_l", object: handState.l.proxy, weak: false },
    { part: "hand_r", object: handState.r.proxy, weak: false },
  ];
  return {
    root,
    head,
    face,
    hands,
    fxRoot,
    radius: R,
    size: { radius: R, faceCentreY: R, top: R * 2.1, handLength: 0.65 * R },
    hitParts() {
      hitList[1].weak = handState.l.weights.stuck > 0.5;
      hitList[2].weak = handState.r.weights.stuck > 0.5;
      return hitList;
    },
    setExpression,
    setDamage,
    setPhase,
    setHandPose,
    flash,
    impact,
    // optional extras
    setCharge(side, k) {
      const hs = handState[side];
      if (hs) hs.charge = THREE.MathUtils.clamp(k, 0, 1);
    },
    setDying(k) {
      dying = THREE.MathUtils.clamp(k, 0, 1);
    },
    isWeak: (side) => handState[side]?.weights.stuck > 0.5,
    get expression() {
      return { ...W };
    },
    get glb() {
      return glbLoaded;
    },
    update,
    ready,
    stats() {
      const count = (o) => {
        let t = 0;
        o.traverse((m) => {
          if (m.isMesh && m.material.visible !== false) t += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;
        });
        return t;
      };
      return { head: count(head), hand: count(hands.l.root), particles: add.count + alpha.count, glb: glbLoaded };
    },
    dispose() {
      add.dispose();
      alpha.dispose();
      for (const side of ["l", "r"]) hands[side].root.parent?.remove(hands[side].root);
      fxRoot.parent?.remove(fxRoot);
      root.parent?.remove(root);
      const seen = new Set();
      const free = (o) =>
        o.traverse((m) => {
          if (!m.isMesh) return;
          if (!seen.has(m.geometry)) seen.add(m.geometry), m.geometry.dispose();
          for (const mm of [].concat(m.material)) if (!seen.has(mm)) seen.add(mm), mm.dispose();
        });
      for (const o of [root, hands.l.root, hands.r.root, fxRoot]) free(o);
      decalTex.dispose();
    },
  };
}
