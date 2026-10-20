// Ch2 world: the pickups. The seed (a ring of 8 glyphs broadcast on a loop above the Old Board), the task tags
// (paper tags lettered like the Ch1 prompt), the CHALLENGE 5 plinth,
// the player's Ch1 installs as crates, and the token orbs. Colliders (plinth, crates) are the caller's.
// createPickups({ layout, U, crates? }) -> { object, byId, tokens, update(t, dt, state), dispose() }
//   crates   [{label, pos}] the player's installs (app cratesFor(installed)); default: layout's crate spots with their labels
//   state    { items: { [layout pickup id]: 'there' | 'taken' }, tokens: taken token indices (array or Set) }
//            taken: the tag/seed snaps up and vanishes (0.35 s)
import * as THREE from 'three';
import { C, TAU, rand, V, VA, canvasTex, haloTex, disposeTree } from './util.js';

let measure = null;
function paperTag(text) {
  measure ??= new OffscreenCanvas(8, 8).getContext('2d'); measure.font = '700 92px "JetBrains Mono"';
  const w = Math.max(360, Math.ceil(measure.measureText(text).width) + 110), h = 190;
  const t = canvasTex(w, h, (g) => {
    g.fillStyle = '#ece6d6'; g.beginPath(); g.moveTo(0, 6); for (let x = 0; x <= w; x += 14) g.lineTo(x, 2 + Math.random() * 7); g.lineTo(w, h - 6); for (let x = w; x >= 0; x -= 14) g.lineTo(x, h - 2 - Math.random() * 7); g.closePath(); g.fill();
    g.fillStyle = 'rgba(0,0,0,.06)'; for (let i = 0; i < 300; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    g.beginPath(); g.arc(34, h / 2, 11, 0, TAU); g.fillStyle = '#03050b'; g.fill();   // the tag's hole
    g.fillStyle = '#1a1c22'; g.font = '700 92px "JetBrains Mono"'; g.textBaseline = 'middle'; g.fillText(text, 70, h / 2 + 6);
  });
  const ww = w / h * .62, grp = new THREE.Group();
  const card = new THREE.Mesh(new THREE.PlaneGeometry(ww, .62), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, transparent: true, color: new THREE.Color(1.15, 1.15, 1.15) }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(C.green).multiplyScalar(.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(ww * 2, 1.6, 1);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.2, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(2) })); string.position.set(-ww / 2 + .11, .6, 0);
  grp.add(glow, card, string); grp.userData = { card, tex: t, w: ww };
  return grp;
}

export function createPickups({ layout, U, crates = null }) {
  const object = new THREE.Group(); object.name = 'pickups';
  const byId = {};
  // the seed
  {
    const p = layout.pickups.find((x) => x.kind === 'seed'), grp = new THREE.Group(); grp.position.copy(VA(p.pos)); object.add(grp);
    const glyph = (k) => canvasTex(128, 128, (g) => {
      g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'square'; const r = (n) => (Math.sin(k * 99.1 + n * 12.9) * 43758.5) % 1;
      g.beginPath(); g.moveTo(64, 14); g.lineTo(64, 114); g.stroke();
      for (let i = 0; i < 4; i++) { const y = 24 + i * 26, s = Math.abs(r(i)) > .5 ? 1 : -1, len = 20 + Math.abs(r(i + 7)) * 26; g.beginPath(); g.moveTo(64, y); g.lineTo(64 + s * len, y + (Math.abs(r(i + 3)) > .6 ? 14 : 0)); g.stroke(); if (Math.abs(r(i + 5)) > .55) { g.fillStyle = '#fff'; g.fillRect(64 + s * len - 7, y - 7, 14, 14); } }
    });
    const glyphs = [...Array(8)].map((_, k) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph(k), color: new THREE.Color(C.green).multiplyScalar(2.4), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); sp.scale.setScalar(.55); grp.add(sp); return sp; });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.15, .015, 6, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.bone).multiplyScalar(2) })); ring.rotation.x = Math.PI / 2; grp.add(ring);
    const waves = [0, 1, 2].map(() => { const w = new THREE.Mesh(new THREE.RingGeometry(.98, 1, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); w.rotation.x = Math.PI / 2; grp.add(w); return w; });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 60, 6, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(1.4), transparent: true, opacity: .35, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 30; grp.add(beam);
    byId[p.id] = { kind: 'seed', grp, base: grp.position.clone(), state: 'there', since: 0,
      anim(t, k) {   // k = 0 there … 1 gone
        glyphs.forEach((sp, i) => { const a = t * .5 + i * TAU / 8, r = 1.15 * (1 - k); sp.position.set(Math.cos(a) * r, Math.sin(t * 2 + i) * .06 + k * 1.2, Math.sin(a) * r); sp.material.opacity = (.6 + .4 * Math.sin(t * 3 + i * 2)) * (1 - k); });
        waves.forEach((w, i) => { const q = ((t * .45 + i / 3) % 1); w.scale.setScalar(1 + q * 8); w.position.y = q * 5; w.material.opacity = (1 - q) * .55 * (1 - k); });
        ring.scale.setScalar(1 - k); beam.material.opacity = .35 * (1 - k);
      } };
  }
  // task tags (+ the CHALLENGE 5 plinth)
  const metal = new THREE.MeshStandardMaterial({ color: 0x0c1118, metalness: .8, roughness: .3 });
  for (const p of layout.pickups.filter((x) => x.kind === 'piece')) {
    const tg = paperTag(p.label); tg.position.copy(VA(p.pos)); object.add(tg);
    byId[p.id] = { kind: p.kind, grp: tg, base: VA(p.pos), ph: rand(0, TAU), state: 'there', since: 0 };
    if (p.plinth) {
      const pl = VA(p.plinth.pos);
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, .8, 1.6, 6), metal); m.position.set(pl.x, p.plinth.top - .8, pl.z); object.add(m);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.2, .03, 4, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(2.5) })); rim.rotation.x = Math.PI / 2; rim.position.set(pl.x, p.plinth.top, pl.z); object.add(rim);
      const under = new THREE.Mesh(new THREE.ConeGeometry(.8, 1.2, 6), new THREE.MeshStandardMaterial({ color: 0x0c1118, metalness: .8, roughness: .3, emissive: new THREE.Color(C.green), emissiveIntensity: .25 })); under.rotation.x = Math.PI; under.position.set(pl.x, p.plinth.top - 2.2, pl.z); object.add(under);
    }
  }
  // the player's Ch1 installs, as crates in their own download history
  const crateList = crates ?? layout.pickups.filter((x) => x.kind === 'crate').map((x) => ({ label: x.label, pos: x.pos }));
  for (const c of crateList) {
    const tex = canvasTex(256, 256, (g) => {
      g.fillStyle = '#0b1119'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#38d8ff'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 236);
      g.globalAlpha = .4; g.beginPath(); g.moveTo(10, 10); g.lineTo(246, 246); g.moveTo(246, 10); g.lineTo(10, 246); g.stroke(); g.globalAlpha = 1;
      g.fillStyle = '#0b1119'; g.fillRect(20, 100, 216, 56);
      g.fillStyle = '#9fe8ff'; let fs = 40; g.font = `700 ${fs}px "JetBrains Mono"`; while (g.measureText(c.label).width > 210) { fs -= 2; g.font = `700 ${fs}px "JetBrains Mono"`; }
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.label, 128, 130);
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), new THREE.MeshStandardMaterial({ color: 0x111820, metalness: .6, roughness: .45, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.1 }));
    m.position.copy(VA(c.pos)).add(V(0, .55, 0)); m.rotation.y = (c.label.length * 1.7) % TAU; object.add(m);   // a stable turn per label (your collider can use it: rotY = -mesh.rotation.y)
    m.name = 'crate:' + c.label;
  }
  // token orbs: little green diamonds along the route
  const tokens = new THREE.Group(); object.add(tokens);
  { const geo = new THREE.OctahedronGeometry(.16, 0), mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(2.6) });
    layout.tokens.spots.forEach((a) => { const m = new THREE.Mesh(geo, mat); m.position.copy(VA(a)).add(V(0, layout.tokens.hover, 0)); m.userData.y = m.position.y; tokens.add(m); }); }

  let clock = 0;
  return {
    object, byId, tokens,
    update(t, dt, s = {}) {
      clock += dt;
      const items = s.items ?? {}, takenTok = s.tokens ? new Set(s.tokens) : null;
      for (const [id, it] of Object.entries(byId)) {
        const st = items[id] ?? 'there';
        if (st !== it.state) { it.state = st; it.since = clock; }
        const age = clock - it.since;
        if (it.kind === 'seed') { const k = st === 'there' ? 0 : Math.min(1, age / .35); it.grp.visible = k < 1; it.anim(t, k); continue; }
        // tags: float and turn while there
        const g = it.grp;
        if (st === 'there') { g.visible = true; g.scale.setScalar(1); g.position.set(it.base.x, it.base.y + Math.sin(t * 1.3 + it.ph) * .12, it.base.z); g.rotation.y = Math.sin(t * .6 + it.ph) * .9; }
        else { const k = Math.min(1, age / .35); g.visible = k < 1; g.scale.setScalar(1 - .8 * k); g.position.y = it.base.y + k * 1.5; }
      }
      tokens.children.forEach((m, i) => { m.visible = !(takenTok && takenTok.has(i)); m.rotation.y = t * 2 + i; m.position.y = m.userData.y + Math.sin(t * 2 + i) * .1; });
    },
    dispose() { disposeTree(object); },
  };
}
