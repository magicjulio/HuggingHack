// Ch2 world: traffic clouds = dense swirling garbage text (GPU only) with an orange haze, drifting so there are gaps.
// createClouds({ layout, U }) -> { object, list, update(t, dt, state), dispose() }
//   list: the Flood's clouds (layout.hazards.clouds) then the forge fight's (layout.forgeFight.clouds, kind 'forge')
//   state { forgeClouds: bool } shows the forge fight's clouds (round 3+); default hidden.
//   Position = motion.cloudPos(c, t) (the same function the game uses for the token drain).
import * as THREE from 'three';
import { C, CHARS, glyphAtlas, haloTex } from './util.js';
import { cloudPos } from './motion.js';

const PER = 520;  // glyphs per cloud

export function createClouds({ layout, U }) {
  const object = new THREE.Group(); object.name = 'clouds';
  const list = [...layout.hazards.clouds.map((c) => ({ ...c, kind: 'flood' })), ...(layout.forgeFight?.clouds ?? []).map((c) => ({ ...c, kind: 'forge' }))];
  const N = PER * list.length, base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const off = new Float32Array(N * 3), meta = new Float32Array(N * 3);
  let k = 0;
  list.forEach((c, ci) => { for (let i = 0; i < PER; i++, k++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * c.r); v.y *= .55; off.set([v.x, v.y, v.z], k * 3); meta.set([Math.floor(Math.random() * CHARS.length), ci, Math.random()], k * 3); } });
  g.setAttribute('iOff', new THREE.InstancedBufferAttribute(off, 3)); g.setAttribute('iMeta', new THREE.InstancedBufferAttribute(meta, 3)); g.instanceCount = N;
  const centres = list.map((c) => new THREE.Vector3(...c.pos)), shown = list.map(() => 1);
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uAtlas: { value: glyphAtlas() }, uC: { value: centres }, uOn: { value: shown } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec3 iOff, iMeta; uniform vec3 uC[${list.length}]; uniform float uOn[${list.length}]; uniform float uTime; varying vec2 vUv; varying float vA; varying float vS;
      void main(){ int ci = int(iMeta.y); vec3 c = uC[0]; float on = uOn[0]; ${list.map((_, i) => `if (ci == ${i}) { c = uC[${i}]; on = uOn[${i}]; }`).join(' ')}
        float s = iMeta.z, a = uTime*(.4+s*.8);
        vec3 o = iOff; o.xz = mat2(cos(a*.3),-sin(a*.3),sin(a*.3),cos(a*.3))*o.xz; o.y += sin(uTime*1.3+s*20.)*.25;
        float ch = mod(iMeta.x + floor(uTime*(2.+s*6.)), 44.);
        vec2 cell = vec2(mod(ch, 8.), floor(ch/8.)); vUv = (cell + vec2(uv.x, 1.-uv.y)) / 8.; vUv.y = 1. - vUv.y;
        vA = (.35 + .65*step(.5, fract(s*13.+uTime*.7))) * on; vS = s;
        vec4 mv = modelViewMatrix*vec4(c + o, 1.); vA *= smoothstep(1.2, 4.5, -mv.z); mv.xy += position.xy*(.26 + s*.12)*on; gl_Position = projectionMatrix*mv; }   // glyphs at the lens fade: inside a cloud you see the swirl, not giant letters`,
    fragmentShader: `uniform sampler2D uAtlas; varying vec2 vUv; varying float vA; varying float vS;
      void main(){ float a = texture2D(uAtlas, vUv).a*vA; if (a < .01) discard; vec3 c = mix(vec3(1.,.48,.24), vec3(1.,.23,.30), step(.7,vS)); gl_FragColor = vec4(c*a*1.4, a); }`,
  });
  const mesh = new THREE.Mesh(g, mat); mesh.frustumCulled = false; object.add(mesh);
  const hazes = list.map((c) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(C.orange).multiplyScalar(.35), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); s.scale.setScalar(c.r * 3.2); object.add(s); return s; });
  return {
    object, list,
    update(t, dt, state = {}) {
      list.forEach((c, i) => {
        const on = c.kind === 'flood' || !!state.forgeClouds;
        shown[i] = on ? 1 : 0; hazes[i].visible = on;
        centres[i].set(...cloudPos(c, t)); hazes[i].position.copy(centres[i]);
      });
    },
    dispose() { g.dispose(); base.dispose(); mat.dispose(); hazes.forEach((h) => h.material.dispose()); },
  };
}
