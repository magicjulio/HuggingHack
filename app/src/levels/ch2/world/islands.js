// Ch2 world: the islands (glTF models placed from layout.json) and their folder labels.
// createIslands({ layout, U, models: { s, m, l } }) -> { object, labels, list, byId, update(t, dt, state), dispose() }
//   models     loaded glTF scenes of ch2-island-{s,m,l}.glb (the caller loads them; they are cloned, never changed)
//   list/byId  per island: { id, def, group, pos, top, R, rx, rz, zone, outline } — outline = the world-space
//              collider polygon [[x, z], …] (model outline scaled + rotated, pulled in 4 %), walkable y = top
//   state      { islands: { [id]: { tiltX, tiltZ, sink } } } from your physics, for the tilting ones (others may be absent)
// Cosmetic and the module's own: the loose shards bob and turn.
import * as THREE from 'three';
import { C, TAU, rand, V, VA, tagSprite, disposeTree } from './util.js';

const RADIUS = { s: 2.6, m: 5.0, l: 9.0 };  // footprint radius of each model at scale 1 (layout `models`)

// layout.islands with `ring` entries expanded into their islands (ids `<id>-<k>`); pure data, no THREE
export function expandIslands(layout) {
  const out = [];
  for (const def of layout.islands) {
    if (!def.ring) { out.push(def); continue; }
    const { centre, radius, count, startDeg, yJitter } = def.ring;
    for (let k = 0; k < count; k++) {
      const a = (startDeg + k * 360 / count) * Math.PI / 180;
      out.push({ ...def, id: `${def.id}-${k}`, ring: undefined, pos: [centre[0] + Math.cos(a) * radius, centre[1] + (k % 2 ? yJitter : -yJitter) * .6, centre[2] + Math.sin(a) * radius], rotY: k * 1.3 });
    }
  }
  return out;
}

export function createIslands({ layout, U, models }) {
  const object = new THREE.Group(); object.name = 'islands';
  const labels = new THREE.Group(); labels.name = 'labels'; object.add(labels);
  const list = [], byId = {}, owned = [];

  function addLabel(pos, text, color, h = 6.5, size = 1.5) {
    const sp = tagSprite(text, color, { size, frame: false, font: '700 80px "Chakra Petch"', boost: 2.2 });
    sp.position.copy(pos).add(V(0, h, 0)); labels.add(sp);
    const lg = new THREE.BufferGeometry().setFromPoints([pos.clone().add(V(0, h - size * .7, 0)), pos.clone().add(V(0, .2, 0))]);
    const ln = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: new THREE.Color(color).multiplyScalar(1.5), dashSize: .3, gapSize: .25, transparent: true, opacity: .6 }));
    ln.computeLineDistances(); labels.add(ln);
  }

  for (const def of expandIslands(layout)) {
    const g = models[def.model].clone(true);
    const sc = Array.isArray(def.scale) ? VA(def.scale) : V(def.scale ?? 1, def.scale ?? 1, def.scale ?? 1);
    const pos = VA(def.pos);
    g.scale.copy(sc); g.position.copy(pos); g.rotation.y = def.rotY ?? 0;
    const shards = []; let outline = null;
    g.traverse((o) => {
      // the rim: emissive in the island's edge colour (x4), or the model's own at 2.6
      if (o.isMesh && o.material.name === 'edge') { o.material = o.material.clone(); owned.push(o.material); if (def.edge) o.material.emissive.set(def.edge); o.material.emissiveIntensity = def.edge ? 4 : 2.6; }
      if (o.name.startsWith('shard_')) shards.push({ o, base: o.position.clone(), ph: rand(0, TAU), sp: rand(.3, .8) });
      if (o.userData && o.userData.outline) outline = JSON.parse(o.userData.outline);
    });
    object.add(g);
    const e = new THREE.Euler(0, def.rotY ?? 0, 0);
    const pts = (outline ?? []).map(([x, z]) => { const v = V(x * sc.x * .96, 0, z * sc.z * .96).applyEuler(e); return [v.x + pos.x, v.z + pos.z]; });
    const R0 = RADIUS[def.model];
    const isl = { id: def.id, def, group: g, pos, top: pos.y, R: R0 * Math.max(sc.x, sc.z), rx: R0 * sc.x * .8, rz: R0 * sc.z * .8, zone: def.zone, outline: pts, shards };
    list.push(isl); byId[def.id] = isl;
    if (def.label) addLabel(pos, def.label, def.edge ?? C.cyan, def.id === 'forge' ? 9 : def.id === 'taskyard' ? 10 : 6.5, def.id === 'taskyard' ? 2.2 : 1.5);
  }

  return {
    object, labels, list, byId,
    update(t, dt, state = {}) {
      const S = state.islands ?? {};
      for (const isl of list) {
        const s = S[isl.id];
        if (s) { isl.group.rotation.x = s.tiltX ?? 0; isl.group.rotation.z = s.tiltZ ?? 0; isl.group.position.y = isl.top - (s.sink ?? 0); }
        for (const sh of isl.shards) { sh.o.position.y = sh.base.y + Math.sin(t * sh.sp + sh.ph) * .35; sh.o.rotation.z += dt * sh.sp * .4; }
      }
    },
    // the models' geometry belongs to the caller: free only the labels and the cloned rim materials
    dispose() { disposeTree(labels); owned.forEach((m) => m.dispose()); },
  };
}
