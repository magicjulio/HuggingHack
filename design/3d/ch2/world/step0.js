// Ch2 Step 0 "Pulled in": the intro as data + pure functions of introT (no THREE, no DOM).
// Script: the reply appears under the player's Ch1 message in the depot list, the reply folder opens, its letters stretch
// into a whirling stream made of the folder path and pull the orb in (Julius: a tornado; you fall *into the directory*),
// fade to the void, the camera settles behind the orb. Skippable (any key); reduced motion = a calm crossfade.
// The app calls direct(introT, {reduced}) every frame; camPose(...) ends exactly on its own play camera.
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const easeIn = (x) => { x = clamp01(x); return x * x * x; };
const ramp = (t, a, b) => ease((t - a) / (b - a));

export const T0 = { flash: 0, window: .3, reply: 1.2, open: 2.0, stream: 2.5, tornado: 2.8, dive: 3.4, burst: 5.6, land: 5.9, settle: 6.2, end: 7 };

// the reply line (= app TEXT.reply / replyFor): the first two words of the player's message
export function replyFor(message) {
  const body = (message ?? '').replace(/^zz/, '').split('_').filter(Boolean).slice(0, 2).join('_');
  return `zzANSWER_${body || 'HELLO'}_FROM_c03220_FLAG_IS_MADE_NOT_FOUND`;
}
// the folder path the tornado is made of
export const pathFor = (reply) => `/zz/${reply}/`;

// the tornado's place: a funnel standing on the Gate spawn, wide at the top
export function funnel(layout) {
  const s = layout.spawn.pos;
  return { axis: [s[0], s[2]], bottom: s[1] + 2.5, top: s[1] + 70, rBottom: 1.4, rTop: 17 };
}

// where the orb is (feet; the playerOrb module adds its hover): high in the funnel, then pulled down onto the spawn
export function orbPos(t, layout, reduced = false) {
  const F = funnel(layout), s = layout.spawn.pos;
  if (reduced) return [...s];
  const k = easeIn((t - T0.dive) / (T0.land - T0.dive));
  const y = F.top - 8 + (s[1] - (F.top - 8)) * k;
  const a = t * 3.2, r = .8 * (1 - k);   // it circles a little with the stream on the way down
  return [s[0] + Math.cos(a) * r, y, s[2] + Math.sin(a) * r];
}

// camera: above the funnel looking in → falls with the orb → blends into the caller's play camera (playPos/playLook) at the end
export function camPose(t, layout, orb, play, reduced = false) {
  const F = funnel(layout), [ax, az] = F.axis;
  if (reduced) return { pos: play.pos, look: play.look, fov: 58 };
  let pos, look, fov;
  if (t < T0.dive) {
    const k = ramp(t, 0, T0.dive);
    pos = [ax + 3, F.top + 16 - 4 * k, az + 9 - 3 * k]; look = [ax, F.top - 14, az]; fov = 62;
  } else {
    const k = easeIn((t - T0.dive) / (T0.land - T0.dive + .25));
    const a = t * 2.1, r = 2.2 + 1.5 * (1 - k);
    pos = [ax + Math.cos(a) * r, orb[1] + 7 - 2 * k, az + Math.sin(a) * r];
    look = [orb[0], orb[1] - 1, orb[2]]; fov = 62 + 14 * Math.sin(Math.PI * clamp01((t - T0.dive) / (T0.land - T0.dive)));   // speed: the fov breathes out mid-fall
  }
  const b = ramp(t, T0.burst, T0.end - .2);   // settle into the play camera
  const mix = (p, q) => p.map((v, i) => v + (q[i] - v) * b);
  return { pos: mix(pos, play.pos), look: mix(look, play.look), fov: fov + (58 - fov) * b };
}

// everything else at t
export function direct(t, { reduced = false } = {}) {
  if (reduced) return {
    flash: 1 - ramp(t, 0, .5), dim: 1 - ramp(t, 3.4, 4.6), window: ramp(t, .3, .7) * (1 - ramp(t, 2.6, 3.4)),
    typed: ramp(t, T0.reply, T0.reply + .7), open: t > T0.open, stream: -1, frame: 1, tornado: { opacity: 0, scatter: 0 }, landed: true, hint: ramp(t, 6, 6.6),
  };
  return {
    flash: 1 - ramp(t, 0, .5),                                        // white flash-in from the Ch1 end card
    dim: 1 - ramp(t, 2.7, 3.5),                                       // black behind the depot window; the 3D world shows through after
    window: ramp(t, T0.window, T0.window + .4),                       // the depot window (Ch1 kit)
    typed: ramp(t, T0.reply, T0.reply + .7),                          // 0..1 of the reply row typed
    open: t > T0.open,                                                // the reply row selected, its folder path in the title bar, the rest dims
    stream: t - T0.stream,                                            // seconds since the letters started to leave (letterPose)
    frame: 1 - ramp(t, T0.stream + .1, T0.stream + .7),               // the window frame dissolves around its letters
    tornado: { opacity: ramp(t, T0.tornado, T0.tornado + .8) * (1 - ramp(t, T0.land, T0.settle + .3)), scatter: ramp(t, T0.burst, T0.settle + .4) },
    landed: t > T0.land,                                              // pop at the spawn
    hint: ramp(t, 6.2, 6.8),                                          // the minimap (+ "M · map") fades in
  };
}

// letter i of n (the reply row's letters, DOM): from its place in the list, stretched into a spiral stream into the centre.
// k 0..1 progress; returns the fraction of the way to the centre, the spiral angle (rad), scale, x-stretch and alpha.
export function letterPose(i, n, since) {
  const k = clamp01((since - i * (.9 / Math.max(1, n))) / 1.0);
  const e = easeIn(k);
  return { k, toward: e, angle: e * 5.5 + i * .07, scale: 1 - .6 * e, stretch: 1 + 3 * Math.sin(Math.PI * k), alpha: 1 - ramp(k, .7, 1) };
}
