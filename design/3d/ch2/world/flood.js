// Ch2 world: the Flood's own things. Flood bits (small jittery spiked orbs that spit garbage text) and the message counter in
// the sky (53 agents, 1,188 messages in three hours [S3 Fig. 10]).
// createFlood({ layout, U, trails? }) -> { object, bits, spit(from, to, trails), update(t, dt, state), dispose() }
//   state { bits: [{ pos?: [x, y, z], state: 'idle'|'chase'|'muted'|'gone' }] (your sim, by layout order; pos default = jitter
//           around the layout spot), counter: n (0 … layout.hazards.counter.to; default a slow climb), forge: [...] extra bits
//           for the forge fight (same shape, drawn from a pool of 8) }
//   spit(from, to, trails): the garbage burst for one of your spits (7 glyphs flying from → to), on the shared trails.
//   Muted bits turn grey, stop spinning and sink; gone = hidden.
import * as THREE from 'three';
import { C, TAU, rand, V, VA, haloTex, disposeTree } from './util.js';

export const GARBAGE = 'X0_{}/-[].9Z7Q';

export function createFlood({ layout, U }) {
  const object = new THREE.Group(); object.name = 'flood';
  const RED = new THREE.Color(C.red), ORANGE = new THREE.Color(C.orange), GREY = new THREE.Color(C.grey);
  const make = (pos) => {
    const g = new THREE.Group(); g.position.copy(pos); object.add(g);
    const coreM = new THREE.MeshBasicMaterial({ color: RED.clone().multiplyScalar(3) }), spikeM = new THREE.LineBasicMaterial({ color: ORANGE.clone().multiplyScalar(2.6) });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.24, 0), coreM); g.add(core);
    const spikes = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(.48, 0)), spikeM); g.add(spikes);
    const haloM = new THREE.SpriteMaterial({ map: haloTex(), color: RED.clone().multiplyScalar(1.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const halo = new THREE.Sprite(haloM); halo.scale.setScalar(1.8); g.add(halo);
    return { g, core, spikes, coreM, spikeM, haloM, base: pos.clone(), ph: rand(0, TAU), mute: 0, sink: 0 };
  };
  const bits = layout.hazards.floodBits.map((a) => make(VA(a)));
  const pool = [...Array(8)].map(() => { const b = make(V(0, -999, 0)); b.g.visible = false; return b; });   // forge fight
  // the counter
  const d = layout.hazards.counter, cv = new OffscreenCanvas(1024, 256), cg = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(2, 2, 2), transparent: true, depthWrite: false, fog: false })); sign.scale.set(16, 4, 1); sign.position.copy(VA(d.pos)); object.add(sign);
  let shown = -1;
  const drawCounter = (n) => {
    n = Math.max(0, Math.min(d.to, Math.round(n))); if (n === shown) return; shown = n;
    cg.clearRect(0, 0, 1024, 256); cg.textAlign = 'center';
    cg.font = '700 150px "Chakra Petch"'; cg.fillStyle = n >= d.to ? '#ff5a5a' : '#ff9a5c'; cg.fillText(n.toLocaleString('en-US'), 512, 150);
    cg.font = '700 46px "JetBrains Mono"'; cg.fillStyle = '#ffb48a'; cg.fillText('MESSAGES · 53 AGENTS · 3 H', 512, 222);
    tex.needsUpdate = true;
  };
  const tmp = V(0, 0, 0);
  function drive(b, s, t, dt) {
    const st = s?.state ?? 'idle';
    b.g.visible = st !== 'gone'; if (!b.g.visible) return;
    b.mute += ((st === 'muted' ? 1 : 0) - b.mute) * Math.min(1, dt * 6);
    if (s?.pos) b.g.position.fromArray(s.pos);
    else b.g.position.copy(b.base).add(tmp.set(Math.sin(t * 2.1 + b.ph) * 1.4, Math.sin(t * 3.3 + b.ph) * .4, Math.cos(t * 1.7 + b.ph) * 1.4));
    const live = 1 - b.mute;
    if (live > .05) b.g.position.add(tmp.set(rand(-.06, .06), rand(-.06, .06), rand(-.06, .06)).multiplyScalar(live));
    b.sink = st === 'muted' ? b.sink + dt * .6 : 0; b.g.position.y -= b.sink;
    b.spikes.rotation.set(t * 3 * live + b.ph, t * 2.2 * live, 0); b.core.scale.setScalar(1 + .25 * Math.sin(t * 17 + b.ph) * live);
    b.coreM.color.copy(RED).lerp(GREY, b.mute).multiplyScalar(3 - 2.2 * b.mute); b.spikeM.color.copy(ORANGE).lerp(GREY, b.mute).multiplyScalar(2.6 - 1.8 * b.mute);
    b.haloM.color.copy(RED).multiplyScalar(1.2 * live); b.g.scale.setScalar(st === 'chase' ? 1.15 : 1);
  }
  return {
    object, bits,
    spit(from, to, trails) { const dir = V(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize().multiplyScalar(9), p = VA(from); for (let i = 0; i < 7; i++) trails.emit(p, GARBAGE[Math.floor(rand(0, GARBAGE.length))], ORANGE, 1.3, i * .06, dir); },
    update(t, dt, s = {}) {
      bits.forEach((b, i) => drive(b, s.bits?.[i], t, dt));
      pool.forEach((b, i) => { const f = s.forge?.[i]; if (!f) { b.g.visible = false; return; } drive(b, f, t, dt); });
      drawCounter(s.counter ?? Math.min(d.to, 780 + (t * 6) % (d.to - 780 + 60)));
    },
    dispose() { disposeTree(object); tex.dispose(); },
  };
}
