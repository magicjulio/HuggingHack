// External designer (Codex, GPT-6.1): accepted level.html orb helpers, extracted unchanged in appearance.
// One kit per module owns its sphere geometry; halo texture is the shared util cache.
import * as THREE from 'three';
import { rand, haloTex as getHaloTex, disposeTree } from './util.js';
export function createAgentKit() {
const haloTex = getHaloTex();
const sphereGeo = new THREE.IcosahedronGeometry(1, 3);
function makeOrb(color, r = .28, rings = 0) {
  const c = new THREE.Color(color), grp = new THREE.Group();
  const core = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(3.2) })); core.scale.setScalar(r); grp.add(core);
  const hot = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) })); hot.scale.setScalar(r * .45); grp.add(hot);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: c.clone().multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(r * 7); grp.add(halo);
  const rs = [];
  for (let i = 0; i < rings; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * (1.7 + i * .45), .012, 6, 64), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.5) })); ring.rotation.set(rand(0, 3), rand(0, 3), 0); grp.add(ring); rs.push(ring); }
  grp.userData = { core, halo, rings: rs, color: c };
  return grp;
}
// Agents stay out of the bloom (Julius 2026-10-14: the NPCs shone too bright). Every colour on them is capped under the
// bloom threshold (1.0). The player keeps its bloom in its separate module.

function shadedOrbMat(color, cap) {
  const c = color.clone(); const mx = Math.max(c.r, c.g, c.b); c.multiplyScalar(1 / Math.max(mx, 1e-3));
  return new THREE.ShaderMaterial({
    uniforms: { uCol: { value: c }, uMax: { value: cap } },
    vertexShader: `varying vec3 vN, vV; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 uCol; uniform float uMax; varying vec3 vN, vV;
      void main(){ float f = clamp(dot(normalize(vN), normalize(vV)), 0., 1.);
        vec3 col = uCol*(.35 + .5*f) + vec3(pow(f, 6.)*.45);   // darker rim, a hot pale centre
        gl_FragColor = vec4(min(col, vec3(1.))*uMax, 1.); }`,
  });
}
function noBloom(root, cap = .8, haloCap = .22) {
  root.traverse((o) => {
    for (const m of [o.material].flat()) {
      if (!m) continue;
      if (m.uniforms?.uMax) { m.uniforms.uMax.value = cap; continue; }
      if (o.isMesh && o.geometry === sphereGeo) { o.material = shadedOrbMat(m.color, cap); m.dispose(); continue; }  // flat discs look dead without bloom: shade them
      if (!m.color) continue;
      const c = m.map === haloTex ? haloCap : cap, mx = Math.max(m.color.r, m.color.g, m.color.b);
      if (mx > c) m.color.multiplyScalar(c / mx);
    }
  });
  return root;
}

return { makeOrb, noBloom,
  // Release a retiring crowd orb without disposing the sphere shared by its living neighbours.
  disposeOrb(root) {
    root.traverse(o => {
      if (o.geometry && o.geometry !== sphereGeo && !o.isSprite) o.geometry.dispose();
      for (const m of [o.material].flat()) m?.dispose();
    });
  },
  dispose(root) { disposeTree(root); sphereGeo.dispose(); },
};
}
