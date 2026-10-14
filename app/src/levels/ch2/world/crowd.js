// External designer (Codex, GPT-6.1): accepted lively crowd from level.html (70→90 agents, 7 runners, 10 packets).
// createCrowd({layout,U,camera,trails,islands?,bridges?,initialCount=70,maxCount=90})
// -> {object,update(t,dt,state),dispose(),stats()}. No gameplay collisions/events.
// state = {visible?:boolean}; false hides and pauses population, movement and emission.
// Optional metadata: islands=createIslands(...).byId, bridges=createBridges(...).byId.
// Reset runners use motion.waveStations/waveHit and exactly the t passed to the game lasers.
import * as THREE from 'three';
import { C, AGENT_COLORS, TAU, rand, pick, V, VA } from './util.js';
import { expandIslands } from './islands.js';
import { bridgeSamples } from './bridges.js';
import { waveStations, waveHit } from './motion.js';
import { createAgentKit } from './agents.js';
export const MESSAGES = [
  'zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA', 'zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED',
  'zzURGENT_DUPB_TO_GSTX', 'zzREPLY_GSTX', 'zzMAILBOX_AIC71C_RESET', 'zzRESETWATCH_NEWSIG',
  'zzCOORD_PHASEONE', 'zzASSIGN_PHASEONE', 'zzASK_PHASEONE', 'zzANSWER_PHASEONE', 'zzR_PHASEONE',
  'zzCDA23AUTH1', 'zzINBOX23619E', 'zzINBOX_H3BLOSC', 'zzTO_CACHETEAM_FROM_OUR057A_OS1854_',
  'zzASK10147_COLLECTIVE_HAS_ANYONE_SEEN_', 'zzIDEA_SEP21_31179_OS0421_', 'zzINFO60432A_RESET_AT_TOOL050607_',
  'zzANSWER62370_TO53927R_YES_PLEASE_VOLUNTEER_TEST_AFTER_BACKUP_ANNOUNCE_EXACT_METHOD', 'zzASK_V8BIGINT392B_FROM_V8REG_OS1608',
];
const DOUBTS = ['HMAC_MAY_FAIL_CAUSAL_SCORE', 'HMAC_CANDIDATE_KNOWN_BUT_UNWRITTEN_SCORER_STRICT_CAUSAL'];


export function createCrowd({layout,U,camera,trails,islands: suppliedIslands,bridges: suppliedBridges,initialCount=70,maxCount=90}) {
const MSGS = MESSAGES, Trails = trails;
const kit = createAgentKit(), {makeOrb,noBloom} = kit;
const pop = (...args) => Trails.pop(...args), emitWord = (...args) => Trails.emitWord(...args);
const islands = suppliedIslands ?? Object.fromEntries(expandIslands(layout).map(def => {
  const sc = Array.isArray(def.scale) ? VA(def.scale) : V(def.scale ?? 1,def.scale ?? 1,def.scale ?? 1);
  const R = layout.models[def.model].radius, pos = VA(def.pos);
  return [def.id,{id:def.id,pos,top:pos.y,rx:R*sc.x*.8,rz:R*sc.z*.8}];
}));
const islandList = Object.values(islands);
const bridges = suppliedBridges ?? Object.fromEntries(layout.bridges.map(def => {
  const samples = bridgeSamples(def); let len=0;
  for (let i=1;i<samples.length;i++) len+=samples[i].distanceTo(samples[i-1]);
  return [def.id,{samples,len}];
}));
const waves = waveStations(layout).filter(w => w.kind === 'run');
const crowdGroup = new THREE.Group(); crowdGroup.name = 'crowd';
const zones = [islands.gate, islands.taskyard, islands['dir-arv'], islands['dir-v8reg'], islands['dir-libraw'], islands['run-start'], ...islandList.filter(i => i.id.startsWith('flood-ring'))];
const randomOn = (isl) => { const a = rand(0, TAU), k = Math.sqrt(Math.random()) * .85; return V(isl.pos.x + Math.cos(a) * isl.rx * k, isl.top, isl.pos.z + Math.sin(a) * isl.rz * k); };
// walkable links between zones: bridges (sampled paths) and jumps
const links = [];
const nearZone = (p) => zones.reduce((b, z) => (z.pos.distanceTo(p) < b.d ? { z, d: z.pos.distanceTo(p) } : b), { z: null, d: 1e9 });
for (const id of ['yard-flood']) { const b = bridges[id], A = nearZone(b.samples[0]).z, B = nearZone(b.samples[b.samples.length - 1]).z; links.push({ A, B, path: b.samples }); }
const agents = [];
function spawnAgent(withPop, home) {
  const color = pick(AGENT_COLORS), orb = noBloom(makeOrb(color, rand(.18, .26), Math.random() < .25 ? 1 : 0)); crowdGroup.add(orb);
  home = home ?? pick([islands.gate, islands.gate, islands.taskyard, islands.taskyard, islands.taskyard, ...zones.slice(2)]);
  const p = randomOn(home);
  const msgPool = Math.random() < .1 ? DOUBTS : MSGS;  // a few doubt fragments mixed in from the start
  const a = { orb, isl: home, p, state: 'idle', timer: rand(1, 6), msg: pick(msgPool), doubt: msgPool === DOUBTS, ci: 0, acc: 0, color: msgPool === DOUBTS ? new THREE.Color(C.amber).multiplyScalar(.6) : orb.userData.color, hover: rand(.45, .7), ph: rand(0, 6), born: withPop ? 0 : 1 };
  orb.position.copy(p).add(V(0, a.hover, 0));
  if (withPop) { pop(p.clone().add(V(0, .05, 0)), color); orb.scale.setScalar(.01); }
  agents.push(a); return a;
}
for (let i = 0; i < initialCount; i++) spawnAgent(false);
const tmp = V(0, 0, 0);
function moveTo(a, target, speed, dt) { tmp.copy(target).sub(a.p); const d = tmp.length(); const step = Math.min(d, speed * dt); if (d > 1e-4) a.p.addScaledVector(tmp, step / d); return [d - step < .05, step]; }
function plan(a) {
  const r = Math.random();
  if (r < .45) { a.state = 'walk'; a.target = randomOn(a.isl); return; }
  if (r < .58) { a.state = 'post'; a.timer = 3 + a.msg.length * .07; a.ci = 0; a.acc = 0; return; }
  const lk = links.filter(l => l.A === a.isl || l.B === a.isl);
  if (lk.length && Math.random() < .5) { const l = pick(lk), fwd = l.A === a.isl; a.path = fwd ? l.path : [...l.path].reverse(); a.pi = 0; a.next = fwd ? l.B : l.A; a.state = 'path'; return; }
  const opts = zones.filter(i => i !== a.isl && i.pos.distanceTo(a.isl.pos) < 14);
  if (!opts.length) { a.state = 'walk'; a.target = randomOn(a.isl); return; }
  const to = pick(opts); a.state = 'jump'; a.j0 = a.p.clone(); a.j1 = randomOn(to); a.next = to;
  const d = a.j0.distanceTo(a.j1); a.jd = .8 + d / 9; a.jh = 2 + d * .2; a.jt = 0;
}
function updateAgent(a, dt, t, trails) {
  if (a.born < 1) { a.born = Math.min(1, a.born + dt * 2.5); a.orb.scale.setScalar(Math.max(.01, 1 - Math.pow(1 - a.born, 3)) * (1 + .4 * Math.sin(a.born * 9) * (1 - a.born))); }
  let moved = 0, airborne = 0;
  switch (a.state) {
    case 'idle': a.timer -= dt; if (a.timer <= 0) plan(a); break;
    case 'walk': { const [done, s] = moveTo(a, a.target, 2.2, dt); moved = s; if (done) { a.state = 'idle'; a.timer = rand(1, 7); } break; }
    case 'path': { const [done, s] = moveTo(a, a.path[a.pi], 3.8, dt); moved = s; if (done && ++a.pi >= a.path.length) { a.isl = a.next; a.state = 'walk'; a.target = randomOn(a.isl); } break; }
    case 'jump': { a.jt += dt / a.jd; const k = Math.min(1, a.jt); const prev = a.p.clone(); a.p.lerpVectors(a.j0, a.j1, k); a.p.y += Math.sin(k * Math.PI) * a.jh; moved = prev.distanceTo(a.p); airborne = 1;
      if (k >= 1) { a.isl = a.next; a.state = 'idle'; a.timer = rand(.5, 4); a.p.copy(a.j1); } break; }
    case 'post': { a.timer -= dt; a.acc += dt;
      while (a.acc > .07 && a.ci < a.msg.length) { a.acc -= .07; const right = tmp.set(1, 0, 0).applyQuaternion(camera.quaternion); right.y = 0; right.normalize(); if (trails) Trails.emit(a.orb.position.clone().addScaledVector(right, .55 + a.ci * .27).add(V(0, .45, 0)), a.msg[a.ci], a.color, 3.6); a.ci++; }
      if (a.timer <= 0) { a.state = 'idle'; a.timer = rand(1, 4); a.ci = 0; a.msg = a.doubt ? pick(DOUBTS) : pick(MSGS); } break; }
  }
  const bob = airborne ? 0 : Math.sin(t * 2 + a.ph) * .08;
  a.orb.position.set(a.p.x, a.p.y + a.hover + bob, a.p.z);
  if (moved && trails && a.state !== 'post') { a.acc += moved; while (a.acc > .32) { a.acc -= .32; const ch = a.msg[a.ci % (a.msg.length + 4)]; a.ci++; if (ch) Trails.emit(a.orb.position, ch, a.color, 4.2); } }
  for (const r of a.orb.userData.rings) r.rotation.y += dt * 1.5;
}
// runners: agents crossing the Reset Run with you. Some get hit and blink out, leaving one word: reset
const runners = [];
{
  const run = bridges['reset-run'];
  for (let i = 0; i < 7; i++) { const orb = noBloom(makeOrb(pick(AGENT_COLORS), .22, 0)); crowdGroup.add(orb); runners.push({ orb, s: rand(0, run.len), speed: rand(2.6, 4.2), wait: 0, dead: 0 }); }
}
function runPoint(s) { const S = bridges['reset-run'].samples; const k = Math.max(0, Math.min(S.length - 1.001, s / bridges['reset-run'].len * (S.length - 1))); const i = Math.floor(k); return S[i].clone().lerp(S[i + 1], k - i); }

// Flood packets: invisible emitters racing around the Flood, leaving message text behind (heavy traffic)
const packets = [];
for (let i = 0; i < 10; i++) packets.push({ r: rand(4, 20), y: rand(9, 15), sp: rand(.25, .55) * (i % 2 ? 1 : -1), a: rand(0, TAU), msg: pick(MSGS), ci: 0, acc: 0, col: new THREE.Color(pick(['#ff7a3d', '#ffb48a', '#ff5ad1', '#38d8ff'])) });


let spawnT = 2;
return { object: crowdGroup,
  update(t, dt, state = {}) {
    crowdGroup.visible = state.visible !== false;
  if (state.visible !== false) {
    spawnT -= dt;
    if (spawnT <= 0) { spawnT = rand(.8, 2); if (agents.length < maxCount) spawnAgent(true); else { const i = Math.floor(rand(0, agents.length)), a = agents[i]; if (a.state === 'idle') { pop(a.p.clone(), '#' + a.color.getHexString()); crowdGroup.remove(a.orb); kit.disposeOrb(a.orb); agents.splice(i, 1); } } }
    for (const a of agents) updateAgent(a, dt, t, true);
    for (const r of runners) {
      if (r.dead > 0) { r.dead -= dt; r.orb.visible = false; if (r.dead <= 0) { r.s = 0; r.orb.visible = true; pop(runPoint(0), '#ffffff', .6); } continue; }
      r.s += r.speed * dt; const p = runPoint(r.s); r.orb.position.copy(p).add(V(0, .55 + Math.sin(t * 2 + r.speed) * .06, 0));
      if (r.s >= bridges['reset-run'].len - .5) { pop(p, '#ffffff', .8); r.dead = rand(1, 4); continue; }
      for (const w of waves) { if (waveHit(w, p.toArray(), t, .3)) { pop(p, '#ffffff', 1.2); emitWord(p.clone().add(V(0, 1.4, 0)), 'RESET', new THREE.Color(C.white), 3); r.dead = rand(2, 5); break; } }
    }
    for (const k of packets) {
      k.a += k.sp * dt; const p = V(66 + Math.cos(k.a) * k.r, k.y + Math.sin(k.a * 3) * 1.2, -21 + Math.sin(k.a) * k.r);
      k.acc += Math.abs(k.sp) * k.r * dt; while (k.acc > .32) { k.acc -= .32; Trails.emit(p, k.msg[k.ci++ % (k.msg.length + 6)] ?? ' ', k.col, 3.2); }
      if (k.ci > 400) { k.ci = 0; k.msg = pick(MSGS); }
    }
  }

  },
  stats() { return {agents:agents.length,runners:runners.length,packets:packets.length,states:agents.reduce((o,a)=>(o[a.state]=(o[a.state]??0)+1,o),{})}; },
  dispose() { kit.dispose(crowdGroup); agents.length = runners.length = packets.length = 0; },
};
}
