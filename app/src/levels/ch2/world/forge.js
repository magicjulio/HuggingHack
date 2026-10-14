// Ch2 world: the Forge (highest point, centre): two-tier dais with a seam, four slot pylons (seed, 7731, TRAINING ROOM,
// CHALLENGE 5), three nested fold rings around a hot core, a beacon straight up, the round bar (3 arcs on the floor).
// createForge({ layout, U }) -> { object, core, slotPos, update(t, dt, state), dispose() }
//   state { power 0..1 (1 = running, 0 = dead; Step 7 powers it down over its first seconds), round 0..3, progress 0..1,
//           slots 0..4 filled }   (proof/fold/absorb phases: next slice)
//   slotPos[i] = world point of slot i's glowing frame (E target, where the item flies in) = layout.forge.slotPos
// Colliders are yours (layout.forge: dais tiers, pylons).
import * as THREE from 'three';
import { C, TAU, V, VA, tagSprite, haloTex, disposeTree } from './util.js';

export function createForge({ layout, U }) {
  const LF = layout.forge, object = new THREE.Group(); object.name = 'forge'; object.position.copy(VA(LF.pos));
  const G = new THREE.Color(C.green);
  const metal = new THREE.MeshStandardMaterial({ color: 0x0d1219, metalness: .85, roughness: .28 });
  const seam = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.2) });
  const [t1, t2] = [...LF.dais].sort((a, b) => b.r - a.r);  // outer, inner tier
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(t1.r - .2, t1.r + .2, t1.y, 8), metal); dais.position.y = t1.y / 2; object.add(dais);
  const dais2 = new THREE.Mesh(new THREE.CylinderGeometry(t2.r - .1, t2.r + .3, t2.y - t1.y, 8), metal); dais2.position.y = t1.y + (t2.y - t1.y) / 2; object.add(dais2);
  const seamRing = new THREE.Mesh(new THREE.TorusGeometry(t1.r - .18, .035, 4, 8), seam); seamRing.rotation.x = Math.PI / 2; seamRing.rotation.z = Math.PI / 8; seamRing.position.y = t1.y; object.add(seamRing);
  // round bar: three arcs around the dais
  const bars = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.RingGeometry(5.3, 5.6, 48, 1, i * TAU / 3 + .06, TAU / 3 - .12), new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = .06; object.add(m); return m; });
  // four slot pylons: an empty glowing frame each, what belongs there written dim underneath
  const frameM = new THREE.LineBasicMaterial({ color: G.clone().multiplyScalar(2.8) });
  LF.slots.forEach((name, i) => {
    const a = i * TAU / 4 + Math.PI / 4, r = LF.pylon?.radius ?? 3.0;
    const s = new THREE.Group(); s.position.set(Math.cos(a) * r, t2.y, Math.sin(a) * r); s.rotation.y = -a - Math.PI / 2; object.add(s);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.0, .5), metal); body.position.y = 1.0; s.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .62), metal); cap.position.y = 2.05; s.add(cap);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.66, .9)), frameM); frame.position.set(0, 1.25, .26); s.add(frame);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(.62, .86), new THREE.MeshBasicMaterial({ color: 0x000000 })); hole.position.set(0, 1.25, .255); s.add(hole);
    const lbl = tagSprite(name, C.green, { size: .2, frame: false, boost: 1.0 }); lbl.position.set(0, .45, .4); s.add(lbl);
  });
  // the fold: three nested rings of segments, one per round, turning on different axes around a hot core
  const CY = 4.4;
  const coreM = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.2) });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 2), coreM); core.position.y = CY; object.add(core);
  const cageM = new THREE.LineBasicMaterial({ color: new THREE.Color(C.white).multiplyScalar(2) });
  core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.9, 0)), cageM));
  const ringM = new THREE.MeshStandardMaterial({ color: 0x0b1016, metalness: .8, roughness: .3, emissive: G, emissiveIntensity: .9 });
  const rings = [2.0, 2.7, 3.4].map((R, i) => {
    const n = 24 + i * 8, ring = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .14, .2), ringM, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 0; k < n; k++) { const a = k * TAU / n; q.setFromAxisAngle(V(0, 1, 0), -a); m4.compose(V(Math.cos(a) * R, 0, Math.sin(a) * R), q, V(1, 1 + (k % 3 === 0 ? 1.8 : 0), 1)); ring.setMatrixAt(k, m4); }
    const g = new THREE.Group(); g.position.y = CY; g.add(ring); object.add(g); return g;
  });
  // beacon: a faint column of light straight up, so the goal is always in sight
  const beaconU = { uTime: U.uTime, uPower: { value: 1 } };
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.6, 400, 12, 1, true), new THREE.ShaderMaterial({
    uniforms: beaconU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uPower; void main(){ float a = pow(clamp(1.-vUv.y,0.,1.), 1.5)*.22*(.8+.2*sin(vUv.y*80. - uTime*3.))*uPower; gl_FragColor = vec4(vec3(.22,1.,.62)*a, a); }`,
  }));
  beacon.position.y = CY + 200; object.add(beacon);
  const glowM = new THREE.SpriteMaterial({ map: haloTex(), color: G.clone().multiplyScalar(.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const glow = new THREE.Sprite(glowM); glow.scale.setScalar(13); glow.position.y = CY; object.add(glow);
  const light = new THREE.PointLight(0x39ff9c, 22, 26, 1.6); light.position.y = CY; object.add(light);

  const ang = [0, 0, 0]; let spinT = 0;
  return {
    object, core, slotPos: LF.slotPos,
    update(t, dt, s = {}) {
      const pw = Math.max(0, Math.min(1, s.power ?? 1)), live = .15 + .85 * pw;
      spinT += dt * pw;  // the rings spin down with the power and stop
      rings[0].rotation.set(spinT * .4, 0, Math.sin(spinT * .3) * .5); rings[1].rotation.set(Math.PI / 2 + Math.sin(spinT * .25) * .4, spinT * .3, 0); rings[2].rotation.set(Math.sin(spinT * .2) * .3, -spinT * .2, Math.PI / 2.4);
      core.scale.setScalar((1 + .06 * Math.sin(t * 2.2) * pw) * (.7 + .3 * pw)); core.rotation.y = spinT * .5;
      // power: everything that glows goes down with it; a last flicker on the way
      const fl = pw > .02 && pw < .6 ? (Math.sin(t * 41) * Math.sin(t * 13) > .6 ? .45 : 1) : 1;
      coreM.color.copy(G).multiplyScalar(2.2 * live * fl); seam.color.copy(G).multiplyScalar(2.2 * live * fl); frameM.color.copy(G).multiplyScalar(2.8 * live);
      cageM.color.setScalar(2 * live); ringM.emissiveIntensity = .9 * pw * fl + .05;
      glowM.color.copy(G).multiplyScalar(.7 * pw * fl); light.intensity = 22 * pw * fl; beaconU.uPower.value = pw;
      const round = s.round ?? 0, prog = s.progress ?? 0;
      bars.forEach((b, i) => { const full = i < round - 1 || (i === round - 1 && prog >= 1), cur = i === round - 1 && !full; b.material.opacity = (full ? .95 : cur ? .4 + .5 * prog : .35 + .15 * Math.sin(t * 1.5 + i)) * live; });
    },
    dispose() { disposeTree(object); },
  };
}
