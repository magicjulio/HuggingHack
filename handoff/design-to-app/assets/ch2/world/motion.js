// Ch2 world: every gameplay motion as a pure function of layout + time. No THREE, no DOM, no state.
// The world modules draw with these, and the game hits with these, so the lasers you see and the lasers that hit
// can never drift apart. Points are plain arrays [x, y, z]. Formulas = layout.json `notes`.
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------------------------------------- reset lasers
export const WAVE_CHARGE = 1.2;  // s of telegraph at the end of each rest
export const WAVE_PAD = 0.35;    // m either side of the line that counts as touching it

// timing of one laser: on = sweeping now; along = the line's offset from the station (m, along dir); until = s left in this period
export function waveState(w, t) {
  const tt = t + w.offset, c = Math.floor(tt / w.period), ph = tt - c * w.period, sign = c % 2 ? -1 : 1;
  const on = ph < w.sweep, k = on ? ph / w.sweep : 1;
  return { on, along: sign * (-w.span + 2 * w.span * k), until: w.period - ph };
}

// every laser station of the level: the Reset Run's (layout.hazards.waves) and the forge fight's lanes (layout.forgeFight.waveLanes, round 2+)
//   { id, kind: 'run' | 'lane', period, offset, span, sweep, at, dir: [x, z], side: [x, z], slope, half }
//   the line lies along `side` (2*half long on the floor), moves along `dir`, and climbs `slope` m per m along dir
export function waveStations(layout) {
  const out = [];
  layout.hazards.waves.forEach((d, i) => {
    const br = layout.bridges.find((b) => b.id === d.bridge), a = br.points[d.segment], b = br.points[d.segment + 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], fl = Math.hypot(dx, dz);
    out.push({ id: `${d.bridge}-${i}`, kind: 'run', span: 4, sweep: 1, ...d,
      at: [a[0] + dx * d.t, a[1] + dy * d.t, a[2] + dz * d.t], dir: [dx / fl, dz / fl], side: [-dz / fl, dx / fl], slope: dy / fl, half: br.width / 2 });
  });
  for (const ln of layout.forgeFight?.waveLanes ?? []) {
    const l = Math.hypot(ln.dir[0], ln.dir[1]), dir = [ln.dir[0] / l, ln.dir[1] / l];
    out.push({ kind: 'lane', ...ln, at: ln.centre, dir, side: [-dir[1], dir[0]], slope: 0, half: ln.length / 2 });
  }
  return out;
}

// where the line is now: { on, along, until, centre: [x, y, z], charge 0..1 (telegraph, 1 while on) }
export function waveLine(st, t) {
  const s = waveState(st, t);
  return { ...s, centre: [st.at[0] + st.dir[0] * s.along, st.at[1] + st.slope * s.along, st.at[2] + st.dir[1] * s.along],
    charge: s.on ? 1 : Math.pow(clamp01(1 - s.until / WAVE_CHARGE), 2) };
}

// does the line touch a body at p (feet) at time t? (dashing passes through: the caller skips this while dashing)
export function waveHit(st, p, t, pad = WAVE_PAD) {
  const s = waveState(st, t); if (!s.on) return false;
  const rx = p[0] - st.at[0], rz = p[2] - st.at[2];
  const along = rx * st.dir[0] + rz * st.dir[1], lat = rx * st.side[0] + rz * st.side[1], dy = p[1] - (st.at[1] + st.slope * s.along);
  return Math.abs(along - s.along) < pad && Math.abs(lat) < st.half + .3 && dy > -1 && dy < 3;
}

// ---------------------------------------------------------------------------------------------- Old Board slabs
// base placement of slab i: { pos, rotY } (a `pos` slab uses it; others sit on the spiral around the column)
export function slabBase(layout, i) {
  const OB = layout.oldBoard, s = OB.slabs[i];
  if (s.pos) return { pos: s.pos, rotY: s.rotY ?? 0 };
  const a = s.spiralDeg * Math.PI / 180, c = OB.column.pos;
  return { pos: [c[0] + Math.cos(a) * OB.spiralRadius, s.y, c[2] + Math.sin(a) * OB.spiralRadius], rotY: -a + Math.PI / 2 };
}
// where slab i is at time t (its walkable top centre) + its rotY; drift moves it along its local x
export function slabAt(layout, i, t) {
  const s = layout.oldBoard.slabs[i], { pos, rotY } = slabBase(layout, i);
  const off = Math.sin(t * TAU / (s.period ?? 6 + i * .9) + (s.phase ?? i * 1.7)) * (s.drift ?? 0);
  return { pos: [pos[0] + Math.cos(rotY) * off, pos[1], pos[2] - Math.sin(rotY) * off], rotY };
}

// ---------------------------------------------------------------------------------------------- lifts, clouds
// the lift's floor y at time t: eases between pos.y and yTop and waits a moment at both ends
export function liftY(lift, t) {
  const k = .5 - .5 * Math.cos(t * TAU / lift.period);
  return lift.pos[1] + (lift.yTop - lift.pos[1]) * clamp01(k * 1.25 - .125);
}
// a traffic cloud's centre at time t (hazards.clouds and forgeFight.clouds)
export function cloudPos(c, t) {
  const k = Math.sin(t * TAU / c.period);
  return [c.pos[0] + c.drift[0] * k, c.pos[1] + c.drift[1] * k, c.pos[2] + c.drift[2] * k];
}
export const inCloud = (c, p, t) => { const q = cloudPos(c, t); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < c.r; };
