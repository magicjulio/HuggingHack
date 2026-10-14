// Ch2 world: light bridges (curved ones sampled every metre; chevrons run along the walking direction), dark glass deck, rail posts.
// createBridges({ layout, U }) -> { object, byId, update(t, dt, state), dispose() }
//   byId[id] = { def, samples: Vector3[] (the walkable centre line), len (m), pts: Vector3[] (the layout points) }
//   Walkable = each pair of consecutive samples as a flat-topped strip `def.width` wide (layout notes.bridges).
import * as THREE from 'three';
import { V, VA, disposeTree } from './util.js';

// the walkable centre line of one bridge: centripetal Catmull-Rom every 1 m for `curve` bridges, else the polyline every <= 1 m (exact corners)
export function bridgeSamples(def) {
  const pts = def.points.map(VA);
  if (def.curve) { const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal'); return curve.getSpacedPoints(Math.max(2, Math.ceil(curve.getLength() / 1))); }
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) { const m = Math.ceil(pts[i].distanceTo(pts[i + 1]) / 1); for (let k = 1; k <= m; k++) out.push(pts[i].clone().lerp(pts[i + 1], k / m)); }
  return out;
}

const bridgeMat = (U, color, flow = 1) => new THREE.ShaderMaterial({
  uniforms: { ...U, uColor: { value: new THREE.Color(color) }, uLen: { value: 1 }, uFlow: { value: flow } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader: `varying vec2 vUv; uniform float uTime, uLen, uFlow; uniform vec3 uColor;
    void main(){ float y = vUv.y, x = vUv.x;
      float edge = (1.-smoothstep(.0,.07,y)) + smoothstep(.93,1.,y);
      float m = fract(x/1.8 - uTime*.9*uFlow);
      float chev = (1.-smoothstep(.0,.06,abs(m - abs(y-.5)*.55 - .25)));
      float grid = (1.-smoothstep(.0,.04,abs(fract(x/0.6)-.5)-.46))*.25;
      float ends = smoothstep(0.,1.,x) * smoothstep(0.,1.,uLen-x);
      float a = (edge*1.3 + chev*.5 + grid*.3 + .09) * ends;
      gl_FragColor = vec4(uColor*a*1.8, a); }`,
});

export function createBridges({ layout, U }) {
  const object = new THREE.Group(); object.name = 'bridges';
  const byId = {}, post = new THREE.BoxGeometry(.07, .7, .07);
  for (const def of layout.bridges) {
    const samples = bridgeSamples(def), slide = def.id === 'oldboard-yard';
    const pos = [], uv = [], idx = []; let acc = 0;
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i], q = samples[Math.min(i + 1, samples.length - 1)], o = samples[Math.max(i - 1, 0)];
      const dir = q.clone().sub(o); dir.y = 0; dir.normalize();
      const side = V(-dir.z, 0, dir.x).multiplyScalar(def.width / 2);
      if (i) acc += p.distanceTo(samples[i - 1]);
      pos.push(...p.clone().sub(side).toArray(), ...p.clone().add(side).toArray()); uv.push(acc, 0, acc, 1);
      if (i < samples.length - 1) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = bridgeMat(U, def.color, slide ? 1.6 : 1); m.uniforms.uLen.value = acc;
    const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 2; mesh.name = def.id; object.add(mesh);
    // a dark glass deck under the light so the bridge reads as something you can stand on
    const deck = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x050a12, metalness: .6, roughness: .35, transparent: true, opacity: .55, side: THREE.DoubleSide, depthWrite: false }));
    deck.position.y = -0.03; object.add(deck);
    // rail posts every ~6 m
    const postMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(slide ? 1.1 : 2.5) });
    for (let i = 0; i < samples.length; i += Math.max(1, Math.round(6 / (acc / samples.length)))) {
      const p = samples[i], q = samples[Math.min(i + 1, samples.length - 1)], o = samples[Math.max(i - 1, 0)];
      const dir = q.clone().sub(o); dir.y = 0; dir.normalize(); const side = V(-dir.z, 0, dir.x).multiplyScalar(def.width / 2 + .05);
      for (const s of [-1, 1]) { const pm = new THREE.Mesh(post, postMat); pm.position.copy(p).addScaledVector(side, s); pm.position.y += .35; object.add(pm); }
    }
    byId[def.id] = { def, samples, len: acc, pts: def.points.map(VA) };
  }
  return {
    object, byId,
    update() {},  // chevrons flow on U.uTime
    dispose() { disposeTree(object); },
  };
}
