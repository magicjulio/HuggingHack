// External designer (Codex, GPT-6.1): approved instanced letters and appearance/reset pops.
// createTrails({U,camera,capacity=9000}) -> {object,mesh,emit,emitWord,pop,update,dispose}
// emit(Vector3, oneCharacter, THREE.Color, life=4.5, delay=0, velocity?:Vector3)
// emitWord(Vector3, text, THREE.Color, life=3); pop(Vector3, CSS/hex/Color, size=1).
// Call update(t,dt) before emitters each frame (timestamps), and again after (flush buffers).
// U.uTime and t must share the game's time. No gameplay listeners are installed.
import * as THREE from 'three';
import { V, charIndex, glyphAtlas, disposeTree } from './util.js';
export function createTrails({U,camera,capacity=9000}) {
  const object = new THREE.Group(); object.name = 'trails';
  let time = U.uTime.value;
const pops = [];
function pop(p, color, big = 1) {
  const c = new THREE.Color(color).multiplyScalar(3);
  const ring = new THREE.Mesh(new THREE.RingGeometry(.8, 1, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.copy(p);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 1, 6, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  beam.position.copy(p); object.add(ring, beam); pops.push({ ring, beam, t: 0, big });
}
function emitWord(p, word, color, life = 3) {
  const right = V(1, 0, 0).applyQuaternion(camera.quaternion);
  for (let i = 0; i < word.length; i++) api.emit(p.clone().addScaledVector(right, (i - word.length / 2) * .3), word[i], color, life, i * .05);
}
function updatePops(dt) {
  for (let i = pops.length - 1; i >= 0; i--) {
    const q = pops[i]; q.t += dt * 1.6; const k = q.t;
    q.ring.scale.setScalar(.2 + k * 2.2 * q.big); q.ring.material.opacity = Math.max(0, 1 - k);
    q.beam.scale.set(1, 1 + k * 10, 1); q.beam.position.y = q.ring.position.y + k * 5; q.beam.material.opacity = Math.max(0, 1 - k * 1.3);
    if (k >= 1) { object.remove(q.ring, q.beam); disposeTree(q.ring); disposeTree(q.beam); pops.splice(i, 1); }
  }

}

  const CAP = capacity, base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const pos = new Float32Array(CAP * 3), meta = new Float32Array(CAP * 3), col = new Float32Array(CAP * 3), vel = new Float32Array(CAP * 3);
  const aPos = new THREE.InstancedBufferAttribute(pos, 3), aMeta = new THREE.InstancedBufferAttribute(meta, 3), aCol = new THREE.InstancedBufferAttribute(col, 3), aVel = new THREE.InstancedBufferAttribute(vel, 3);
  [aPos, aMeta, aCol, aVel].forEach(a => a.setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('iPos', aPos); g.setAttribute('iMeta', aMeta); g.setAttribute('iCol', aCol); g.setAttribute('iVel', aVel); g.instanceCount = CAP;
  for (let i = 0; i < CAP; i++) meta[i * 3 + 1] = -999;
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    uniforms: { ...U, uAtlas: { value: glyphAtlas() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 iPos, iMeta, iCol, iVel; varying vec2 vUv; varying float vA; varying vec3 vC; uniform float uTime;
      void main(){ float ch = iMeta.x, birth = iMeta.y, life = iMeta.z, age = uTime - birth;
        vA = (age < 0. || age > life) ? 0. : smoothstep(0., .12, age) * (1. - smoothstep(life*.55, life, age));
        vA *= age < .25 ? step(.5, fract(age*24.)) : 1.; vC = iCol;
        vec2 cell = vec2(mod(ch, 8.), floor(ch/8.)); vUv = (cell + vec2(uv.x, 1.-uv.y)) / 8.; vUv.y = 1. - vUv.y;
        vec4 mv = modelViewMatrix * vec4(iPos + iVel*max(age,0.) + vec3(0., max(age,0.)*.12, 0.), 1.);
        mv.xy += position.xy * .3 * (1. + .25*smoothstep(0.,.2,age)*(1.-smoothstep(.2,.6,age)));
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform sampler2D uAtlas; varying vec2 vUv; varying float vA; varying vec3 vC;
      void main(){ float a = texture2D(uAtlas, vUv).a * vA; if (a < .01) discard; gl_FragColor = vec4(vC * a * 1.5, a); }`,
  }));
  mesh.frustumCulled = false; mesh.renderOrder = 5; object.add(mesh); base.dispose();
  let head = 0, dirty = false;
  const api = {
    object, mesh, pop, emitWord,
    emit(p, ch, color, life = 4.5, delay = 0, v = null) {
      const i = head; head = (head + 1) % CAP;
      pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
      meta[i * 3] = charIndex(ch); meta[i * 3 + 1] = time + delay; meta[i * 3 + 2] = life;
      col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
      vel[i * 3] = v ? v.x : 0; vel[i * 3 + 1] = v ? v.y : 0; vel[i * 3 + 2] = v ? v.z : 0;
      dirty = true;
    },
    update(t = U.uTime.value, dt = 0) { time = t; updatePops(dt); if (dirty) { aPos.needsUpdate = aMeta.needsUpdate = aCol.needsUpdate = aVel.needsUpdate = true; dirty = false; } },
    dispose() { disposeTree(object); pops.length = 0; },
  };
  return api;
}

