// Ch2 Step 0: the tornado. The reply's folder path, letter by letter, whirls down a funnel (wide at the top, tight at the
// bottom) standing on the Gate spawn; strands spell the path as they flow. GPU only: one instanced draw, positions in the
// vertex shader. Plus a faint core column of light down the axis.
// createTornado({ layout, U, funnel }) -> { object, setText(path), update(t, dt, state), dispose() }
//   funnel   = step0.funnel(layout)
//   state    { opacity 0..1, scatter 0..1 (the burst at the bottom: strands fly outward and fade) }
import * as THREE from 'three';
import { C, glyphAtlas, charIndex, disposeTree } from './util.js';

const STRANDS = 26, PER = 120;   // 3120 glyphs

export function createTornado({ U, funnel }) {
  const F = funnel, object = new THREE.Group(); object.name = 'tornado';
  object.position.set(F.axis[0], 0, F.axis[1]);
  const N = STRANDS * PER, base = new THREE.PlaneGeometry(1, 1), g = new THREE.InstancedBufferGeometry();
  g.index = base.index; g.setAttribute('position', base.getAttribute('position')); g.setAttribute('uv', base.getAttribute('uv'));
  const meta = new Float32Array(N * 4), chars = new Float32Array(N);
  for (let s = 0; s < STRANDS; s++) for (let k = 0; k < PER; k++) {
    const i = s * PER + k;
    meta.set([s / STRANDS, k / PER, Math.random(), s % 3 === 0 ? 1 : 0], i * 4);   // strand phase, place along it, jitter, accent
  }
  g.setAttribute('iMeta', new THREE.InstancedBufferAttribute(meta, 4));
  const aChar = new THREE.InstancedBufferAttribute(chars, 1); aChar.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iChar', aChar);
  g.instanceCount = N;
  const uni = { uTime: U.uTime, uAtlas: { value: glyphAtlas() }, uOpacity: { value: 0 }, uScatter: { value: 0 },
    uTop: { value: F.top }, uBottom: { value: F.bottom }, uRTop: { value: F.rTop }, uRBot: { value: F.rBottom },
    uPink: { value: new THREE.Color(C.pink).multiplyScalar(2.2) }, uIce: { value: new THREE.Color(C.ice).multiplyScalar(1.6) } };
  const mat = new THREE.ShaderMaterial({
    uniforms: uni, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute vec4 iMeta; attribute float iChar; uniform float uTime, uTop, uBottom, uRTop, uRBot, uScatter, uOpacity;
      varying vec2 vUv; varying float vA, vAcc;
      void main(){
        float strand = iMeta.x, along = iMeta.y, jit = iMeta.z; vAcc = iMeta.w;
        float s = fract(along + uTime*.32 + strand*.37);            // 0 = top, 1 = bottom: the stream flows down
        float h = mix(uTop, uBottom, s);
        float r = mix(uRTop, uRBot, pow(s, .55)) * (1. + (jit - .5)*.18);
        float a = strand*6.2831853 + s*14. - uTime*(1.4 + s*3.2);   // faster as it narrows
        r *= 1. + uScatter*(2.5 + jit*4.);                           // the burst: strands fly outward
        h += uScatter*(jit - .3)*10.;
        vec3 p = vec3(cos(a)*r, h, sin(a)*r);
        vA = uOpacity * smoothstep(0., .08, s) * (1. - smoothstep(.93, 1., s)) * (1. - uScatter) * (.55 + .45*jit);
        float ch = iChar; vec2 cell = vec2(mod(ch, 8.), floor(ch/8.)); vUv = (cell + vec2(uv.x, 1.-uv.y)) / 8.; vUv.y = 1. - vUv.y;
        vec4 mv = modelViewMatrix*vec4(p, 1.);
        vA *= smoothstep(2., 7., -mv.z);                             // glyphs right at the lens fade, so the fall stays readable
        float size = mix(1.25, .42, s) * (1. + uScatter*.6);
        mv.xy += position.xy * size;
        gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform sampler2D uAtlas; uniform vec3 uPink, uIce; varying vec2 vUv; varying float vA, vAcc;
      void main(){ float a = texture2D(uAtlas, vUv).a * vA; if (a < .01) discard; gl_FragColor = vec4(mix(uPink, uIce, vAcc) * a, a); }`,
  });
  const glyphs = new THREE.Mesh(g, mat); glyphs.frustumCulled = false; glyphs.renderOrder = 6; object.add(glyphs);
  // the eye of the tornado: a faint column of light down the axis
  const coreU = { uTime: U.uTime, uOpacity: { value: 0 } };
  const core = new THREE.Mesh(new THREE.CylinderGeometry(F.rBottom * .5, F.rTop * .22, F.top - F.bottom, 24, 1, true), new THREE.ShaderMaterial({
    uniforms: coreU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOpacity;
      void main(){ float bands = .5 + .5*sin(vUv.y*60. + uTime*9. + vUv.x*6.2831853*3.); float a = (.05 + .07*bands) * uOpacity * (1. - abs(vUv.x - .5)*0.) * smoothstep(0., .2, vUv.y);
        gl_FragColor = vec4(vec3(1., .45, .85)*a, a); }`,
  }));
  core.position.y = (F.top + F.bottom) / 2; object.add(core);

  function setText(path) {
    const txt = [...path];   // each strand spells the path from the top down (place k = letter k, looping)
    for (let s = 0; s < STRANDS; s++) for (let k = 0; k < PER; k++) chars[s * PER + k] = charIndex(txt[(PER - 1 - k + s * 7) % txt.length]);
    aChar.needsUpdate = true;
  }
  setText('/zz/');
  return {
    object, setText,
    update(t, dt, s = {}) {
      uni.uOpacity.value = s.opacity ?? 0; uni.uScatter.value = s.scatter ?? 0; coreU.uOpacity.value = (s.opacity ?? 0) * (1 - (s.scatter ?? 0));
      object.visible = (s.opacity ?? 0) > .001;
    },
    dispose() { disposeTree(object); base.dispose(); },
  };
}
