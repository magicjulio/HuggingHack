// Ch2 world: respawn pads (hex ring + soft fill + a light beam that brightens on the active pad) and the lift.
// createPads({ layout, U, snap? }) -> { object, byId, update(t, dt, state), dispose() }
//   snap(x, z, y) -> floor y (optional; e.g. your ground query), else the layout's pad y
//   state { active: pad id (your last pad), seen?: { [pad id]: true } (reached pads glow a little) }
// createLifts({ layout }) -> { object, update(t, dt, state), dispose() }   state { lifts: { [id]: { y } } } = your physics; default motion.liftY
import * as THREE from 'three';
import { C, V, VA, disposeTree } from './util.js';
import { liftY } from './motion.js';

export function createPads({ layout, U, snap = null }) {
  const object = new THREE.Group(); object.name = 'pads';
  const byId = {};
  for (const d of layout.pads) {
    const p = VA(d.pos); if (snap) { const y = snap(p.x, p.z, p.y + 1); if (y > -Infinity) p.y = y; }
    const grp = new THREE.Group(); grp.position.copy(p).add(V(0, .03, 0)); object.add(grp);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.3, 6), ringMat); ring.rotation.x = -Math.PI / 2; grp.add(ring);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1.15, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.green).multiplyScalar(.25), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fill.rotation.x = -Math.PI / 2; grp.add(fill);
    const uOn = { value: 0 };
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 3, 6, 1, true), new THREE.ShaderMaterial({
      uniforms: { uOn, uTime: U.uTime }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uOn, uTime; void main(){ float a = (1.-vUv.y)*(.08+.3*uOn)*(.8+.2*sin(uTime*3.+vUv.y*10.)); gl_FragColor = vec4(vec3(.22,1.,.6)*a, a); }`,
    }));
    beam.position.y = 1.5; grp.add(beam);
    byId[d.id] = { pos: p, grp, uOn, ringMat };
  }
  return {
    object, byId,
    update(t, dt, s = {}) {
      for (const [id, pd] of Object.entries(byId)) {
        const on = s.active === id ? 1 : 0;
        pd.uOn.value += (on - pd.uOn.value) * Math.min(1, dt * 6);
        pd.ringMat.color.set(C.green).multiplyScalar(on ? 2.4 : s.seen?.[id] ? 1.6 : 1.1);
      }
    },
    dispose() { disposeTree(object); },
  };
}

export function createLifts({ layout }) {
  const object = new THREE.Group(); object.name = 'lifts';
  const lifts = layout.lifts.map((d) => {
    const p = VA(d.pos), [w, dd] = d.size;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .3, dd), new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: .7, roughness: .3, emissive: new THREE.Color(C.cyan), emissiveIntensity: .15 }));
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .3, dd)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(2.5) })));
    object.add(m);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, d.yTop - p.y + 1, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.2), transparent: true, opacity: .5 })); rail.position.set(p.x + w / 2 + .2, (p.y + d.yTop) / 2, p.z); object.add(rail);
    return { d, p, m };
  });
  return {
    object,
    update(t, dt, s = {}) { for (const l of lifts) { const y = s.lifts?.[l.d.id]?.y ?? liftY(l.d, t); l.m.position.set(l.p.x, y - .15, l.p.z); } },
    dispose() { disposeTree(object); },
  };
}
