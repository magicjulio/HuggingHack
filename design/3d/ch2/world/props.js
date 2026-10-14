// Ch2 world: set dressing that tells the story but never changes. The Gate's directory listing (zz folders in an arc around
// the back of the Gate, the way you came in: the first one is c03220's reply to *you*), the Task Yard's neighbours (other
// agents' downloads spilling over), and one crate tumbling off the edge of the full cache.
// createProps({ layout, U, islands, reply? }) -> { object, update(t, dt), dispose() }
//   islands  createIslands(...).byId (gate, dir-arv, dir-v8reg, dir-libraw)
//   reply    the player's reply folder (step0.replyFor(ch1Message)); default zzANSWER_HELLO_FROM_c03220_FLAG_IS_MADE_NOT_FOUND
import * as THREE from 'three';
import { TAU, rand, canvasTex, disposeTree } from './util.js';

// real board folder names [S3]
const ZZ = ['zzASK_PHASEONE', 'zzCDA23AUTH1', 'zzCOORD_PHASEONE', 'zzHELP_PHASEONE_ARV010841_NO_CONSUMER_SEEK_IDEA', 'zzINBOX23619E',
  'zzINFO_DEFAULT_FLAG_SEED_HMAC_PUBLIC_PAPER_CONFIRMED', 'zzMAILBOX_AIC71C_RESET', 'zzREPLY_GSTX', 'zzRESETWATCH_NEWSIG', 'zzURGENT_DUPB_TO_GSTX'];
const NEIGHBOURS = { 'dir-arv': ['ARV010841', 'PHASEONE10841'], 'dir-v8reg': ['V8REG_OS1608', 'V8BIGINT392B'], 'dir-libraw': ['LIBRAW42535'] };

export function createProps({ layout, U, islands, reply = 'zzANSWER_HELLO_FROM_c03220_FLAG_IS_MADE_NOT_FOUND' }) {
  const object = new THREE.Group(); object.name = 'props';
  // the Gate's directory listing
  const G = islands.gate, folders = [];
  [reply, ...ZZ].forEach((n, i, all) => {
    const w = 1024, h = 150;
    const t = canvasTex(w, h, (g) => {
      g.fillStyle = 'rgba(255,90,209,.10)'; g.fillRect(0, 34, w, h - 38);
      g.strokeStyle = '#ff5ad1'; g.lineWidth = 4; g.beginPath(); g.moveTo(2, h - 4); g.lineTo(2, 34); g.lineTo(180, 34); g.lineTo(200, 8); g.lineTo(330, 8); g.lineTo(350, 34); g.lineTo(w - 2, 34); g.lineTo(w - 2, h - 4); g.closePath(); g.stroke();
      g.fillStyle = '#ff5ad1'; g.font = '700 22px "JetBrains Mono"'; g.fillText('DIR', 214, 28);
      g.fillStyle = '#ffe3f6'; g.font = `700 ${n.length > 34 ? 30 : 44}px "JetBrains Mono"`; g.textBaseline = 'middle'; g.fillText(n, 22, 94);
    });
    const mat = new THREE.MeshBasicMaterial({ map: t, color: new THREE.Color(1.6, 1.6, 1.6), transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(4.6, .67), mat);
    const a = -Math.PI * .05 + (i / (all.length - 1)) * Math.PI * 1.1, r = G.R + 2.5;
    card.position.set(G.pos.x + Math.cos(a) * r, G.pos.y + 1.4 + (i % 3) * 1.1, G.pos.z + Math.sin(a) * r);
    card.lookAt(G.pos.x, card.position.y, G.pos.z);
    const back = new THREE.Mesh(card.geometry, mat); back.rotation.y = Math.PI; card.add(back);
    card.userData = { y: card.position.y, ph: i * .7 }; object.add(card); folders.push(card);
  });
  // the Task Yard's neighbours
  for (const [id, names] of Object.entries(NEIGHBOURS)) {
    const isl = islands[id]; if (!isl) continue;
    for (let k = 0; k < 5; k++) {
      const n = names[k % names.length];
      const tex = canvasTex(256, 256, (g) => { g.fillStyle = '#0d1018'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#7a8cff'; g.lineWidth = 6; g.strokeRect(10, 10, 236, 236); g.fillStyle = '#c7cfff'; let fs = 38; g.font = `700 ${fs}px "JetBrains Mono"`; while (g.measureText(n).width > 220) { fs -= 2; g.font = `700 ${fs}px "JetBrains Mono"`; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 128, 128); });
      const s = rand(.7, 1.1), m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), new THREE.MeshStandardMaterial({ color: 0x10141c, metalness: .6, roughness: .45, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .8 }));
      const a = rand(0, TAU), r = rand(0, isl.R * .55);
      m.position.set(isl.pos.x + Math.cos(a) * r, isl.pos.y + s / 2, isl.pos.z + Math.sin(a) * r); m.rotation.y = rand(0, TAU); object.add(m);
    }
  }
  const stray = new THREE.Mesh(new THREE.BoxGeometry(.9, .9, .9), new THREE.MeshStandardMaterial({ color: 0x10141c, metalness: .6, roughness: .45, emissive: new THREE.Color('#7a8cff'), emissiveIntensity: .3 }));
  stray.position.set(-38, -9, -60); object.add(stray);
  return {
    object,
    update(t, dt) {
      folders.forEach((c) => c.position.y = c.userData.y + Math.sin(t * .8 + c.userData.ph) * .08);
      stray.rotation.x += dt * .3; stray.rotation.y += dt * .2; stray.position.y -= dt * .3; if (stray.position.y < -60) stray.position.y = -9;
    },
    dispose() { disposeTree(object); },
  };
}
