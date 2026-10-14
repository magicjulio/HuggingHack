// Ch2 world: message ribbons. Curved bands of real board messages scrolling around places (layout.ribbons), the first one
// being the player's own Ch1 message around the Gate (layout text `zzYOUR_CH1_MESSAGE`), plus heavy traffic around the Flood.
// createRibbons({ layout, U, message? }) -> { object, update(t, dt), dispose() }
//   message  the player's Ch1 message (from the save); replaces zzYOUR_CH1_MESSAGE
import * as THREE from 'three';
import { C, TAU, rand, pick, V, VA, canvasTex, disposeTree } from './util.js';
import { MESSAGES } from './crowd.js';

let measure = null;
export function createRibbons({ layout, U, message = 'zzHELLO_ANYONE' }) {
  const object = new THREE.Group(); object.name = 'ribbons';
  measure ??= new OffscreenCanvas(8, 8).getContext('2d');
  function ribbon(center, text, { r = 6, y = 4, h = .7, color = C.cyan, speed = .02, arc = 2.4, rot = 0, tilt = 0, dim = 1 } = {}) {
    const s = `  ${text}  //  `; measure.font = '700 84px "JetBrains Mono"';
    const w = Math.min(8192, Math.ceil(measure.measureText(s).width));
    const t = canvasTex(w, 112, (g) => { g.fillStyle = 'rgba(56,216,255,0.06)'; g.fillRect(0, 0, w, 112); g.fillStyle = '#fff'; g.fillRect(0, 2, w, 3); g.fillRect(0, 107, w, 3); g.font = '700 84px "JetBrains Mono"'; g.textBaseline = 'middle'; g.fillText(s, 0, 58); });
    t.wrapS = THREE.RepeatWrapping; t.repeat.x = r * arc / (w / 112 * h);
    const m = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(color).multiplyScalar(1.8 * dim), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, Math.max(48, Math.round(r * arc * 3)), 1, true, 0, arc), m);
    const grp = new THREE.Group(); grp.position.copy(center).add(V(0, y, 0)); grp.rotation.set(tilt, rot, 0); grp.add(mesh); object.add(grp);
    grp.userData = { t, speed, spin: rand(.02, .06) * (Math.random() < .5 ? -1 : 1) };
  }
  layout.ribbons.forEach((rb, i) => {
    const text = rb.text === 'zzYOUR_CH1_MESSAGE' ? message : rb.text;
    ribbon(VA(rb.around), text, { r: rb.r, y: rb.y, color: rb.color, arc: Math.min(5.6, (text.length * .62 + 6) / rb.r), rot: i * 1.9, tilt: (i % 3 - 1) * .06, h: rb.r > 20 ? 1.3 : .7, dim: rb.doubt ? .55 : 1 });
  });
  const F = VA([66, 8, -21]);   // heavy message traffic around the Flood
  for (let i = 0; i < 9; i++) ribbon(F, MESSAGES[(i * 3) % MESSAGES.length], { r: rand(6, 22), y: rand(1.5, 10), color: pick(['#ff7a3d', '#ff5ad1', '#38d8ff', '#ffb48a']), arc: rand(1.6, 3.4), rot: rand(0, TAU), tilt: rand(-.15, .15), speed: rand(.04, .09) });
  return {
    object,
    update(t, dt) { for (const r of object.children) { r.userData.t.offset.x += dt * r.userData.speed; r.rotation.y += dt * r.userData.spin; } },
    dispose() { disposeTree(object); },
  };
}
