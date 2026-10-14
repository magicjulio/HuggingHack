// Ch2 world: environment = sky, stars, the city grid far below, the soft studio env map, lights. Plus RENDER, the render settings.
// createEnv({ U, camera, renderer }) -> { object, environment, update(t, dt, state), dispose() }
//   U         shared uniforms (uTime, uPsy); the caller advances uTime
//   camera    the grid fades around it
//   renderer  optional: only to bake `environment` (a PMREM texture). Set scene.environment = env.environment and
//             scene.environmentIntensity = RENDER.envIntensity yourself (a module never touches the scene).
import * as THREE from 'three';
import { NOISE, TAU, rand, V, disposeTree } from './util.js';

// what level.html renders with; the app matches these in its own post-processing (pmndrs postprocessing)
export const RENDER = {
  background: 0x03060d,                      // under the sky sphere, only seen if the sky is off
  fog: { color: 0x03060d, density: 0.0052 },  // THREE.FogExp2
  toneMapping: 'AgX', exposure: 1.0,          // THREE.AgXToneMapping, renderer.toneMappingExposure
  outputColorSpace: 'srgb',
  pixelRatioMax: 2,
  camera: { fov: 58, near: 0.1, far: 3000 },
  bloom: { strength: 0.7, radius: 0.5, threshold: 1.0 },  // UnrealBloomPass(strength, radius, threshold) on linear HDR colour, before tone mapping
  envIntensity: 0.22,                         // scene.environmentIntensity
  rule: 'Only the player orb blooms: agent orbs (NPCs, crowd) keep linear colour <= 0.8 so they stay under the threshold.',
};

export const GRID_Y = -130;

export function createEnv({ U, camera, renderer = null }) {
  const object = new THREE.Group(); object.name = 'env';
  // sky: a slow nebula, its hue drifting with uPsy. The noise is expensive per pixel (two 5-octave fbm), and it barely moves,
  // so with a renderer it is baked into a 1024 x 512 equirect texture, re-baked every SKY_REBAKE s (~4 ms -> ~0.1 ms a frame
  // on an integrated GPU at 1080p). Without a renderer it runs live.
  const SKY_FN = NOISE + `uniform float uTime, uPsy;
    vec3 sky(vec3 d){
      vec3 col = mix(vec3(.002,.004,.010), vec3(.006,.010,.024), smoothstep(-.7,.6,d.y));
      float band = exp(-pow((d.y - .08 + .35*d.x)*2.6, 2.));
      float n  = fbm(d*2.4 + vec3(0., uTime*.006, 0.));
      float n2 = fbm(d*4.8 - vec3(uTime*.004));
      vec3 c1 = vec3(.010,.060,.110), c2 = vec3(.070,.020,.130);
      float h = uPsy * (.6*sin(uTime*.05) + .4);
      c1 = hue(c1, h*1.2); c2 = hue(c2, -h*.9);
      return col + .6*(c1*smoothstep(.42,.85,n)*(.35+band) + c2*smoothstep(.5,.92,n2)*(.25+.8*band));
    }`;
  let skyRT = null, bake = null;
  if (renderer) {
    skyRT = new THREE.WebGLRenderTarget(1024, 512, { type: THREE.HalfFloatType, magFilter: THREE.LinearFilter, minFilter: THREE.LinearFilter, depthBuffer: false });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
      uniforms: U, depthTest: false, depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: SKY_FN + `varying vec2 vUv;
        void main(){ float lon = (vUv.x - .5) * 6.2831853, lat = (vUv.y - .5) * 3.1415927;
          vec3 d = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon)); gl_FragColor = vec4(sky(d), 1.); }`,
    }));
    const bs = new THREE.Scene(); bs.add(q); const bc = new THREE.Camera();
    bake = () => { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(skyRT); renderer.render(bs, bc); renderer.setRenderTarget(prev); };
    bake();
    object.userData.skyBake = { q, bs };
  }
  const SKY_REBAKE = .25;
  object.add(new THREE.Mesh(new THREE.SphereGeometry(1500, 48, 24), renderer ? new THREE.ShaderMaterial({
    uniforms: { uSky: { value: skyRT.texture } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec3 vDir; uniform sampler2D uSky;
      void main(){ vec3 d = normalize(vDir); vec2 uv = vec2(atan(d.x, d.z) / 6.2831853 + .5, asin(clamp(d.y, -1., 1.)) / 3.1415927 + .5);
        gl_FragColor = vec4(texture2D(uSky, uv).rgb, 1.); }`,
  }) : new THREE.ShaderMaterial({
    uniforms: U, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: SKY_FN + `varying vec3 vDir; void main(){ gl_FragColor = vec4(sky(normalize(vDir)), 1.); }`,
  })));
  // stars
  {
    const N = 3500, p = new Float32Array(N * 3), s = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(rand(900, 1400)); p.set([v.x, v.y, v.z], i * 3); s[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1));
    object.add(new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `attribute float seed; varying float vS; void main(){ vS = seed; gl_PointSize = 1. + seed*seed*2.6; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying float vS; uniform float uTime; void main(){ float d = length(gl_PointCoord-.5); if(d>.5) discard;
        float tw = .55+.45*sin(uTime*(1.+vS*3.)+vS*80.); vec3 c = mix(vec3(.5,.8,1.), vec3(.75,.6,1.), fract(vS*7.));
        gl_FragColor = vec4(c*tw*(.4+vS*1.2)*(1.-d*2.), 1.); }`,
    })));
  }
  // the city far below: a pulsing grid and window-lit towers
  const city = new THREE.Group(); city.name = 'city'; object.add(city);
  {
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), new THREE.ShaderMaterial({
      uniforms: { ...U, uCam: { value: camera.position } }, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `varying vec3 vW; uniform float uTime, uPsy; uniform vec3 uCam;
        float gl(vec2 p, float s){ vec2 q = p/s; vec2 g = abs(fract(q-.5)-.5)/fwidth(q); return 1.-min(min(g.x,g.y),1.); }
        void main(){ vec2 p = vW.xz; float minor = gl(p, 10.), major = gl(p, 50.);
          float d = length(p - uCam.xz); float fade = exp(-d*.0048); float r = length(p);
          float pulse = pow(.5+.5*sin(r*.035 - uTime*(1.+uPsy*1.5)), 10.);
          vec3 c = mix(vec3(.10,.55,1.), vec3(.55,.25,1.), smoothstep(150.,800.,d));
          float a = (minor*.18 + major*.55) * (.45 + (0.6+1.8*uPsy)*pulse) * fade;
          gl_FragColor = vec4(c*a*.6, 1.); }`,
    }));
    grid.rotation.x = -Math.PI / 2; grid.position.y = GRID_Y; city.add(grid);
    const N = 110, geo = new THREE.BoxGeometry(1, 1, 1), seed = new Float32Array(N);
    const towers = new THREE.InstancedMesh(geo, new THREE.ShaderMaterial({
      uniforms: U, fog: false,
      vertexShader: `attribute float iSeed; varying vec3 vW; varying vec2 vUv; varying float vS; varying vec3 vN;
        void main(){ vS = iSeed; vUv = uv; vN = normal; vec4 w = modelMatrix*instanceMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: NOISE + `varying vec3 vW; varying vec2 vUv; varying float vS; varying vec3 vN; uniform float uTime, uPsy;
        void main(){ float top = abs(vN.y) > .5 ? 1. : 0.;
          vec2 cell = vec2(floor(vUv.x*6.), floor((vW.y+300.)*.7));
          float on = step(.93 - .04*uPsy, hash12(cell + vS*91. + floor(uTime*(.4+vS) + hash12(cell)*8.)*13.));
          vec2 f = vec2(fract(vUv.x*6.), fract((vW.y+300.)*.7));
          float win = on * step(.18,f.x)*step(f.x,.82)*step(.25,f.y)*step(f.y,.75);
          float edge = step(vUv.x,.02)+step(.98,vUv.x);
          float h = clamp((vW.y + 130.)/240., 0., 1.); float fade = exp(-length(vW.xz)*.0028) * (1.-h*.8);
          vec3 c = mix(vec3(.15,.75,1.), vec3(.65,.35,1.), vS);
          gl_FragColor = vec4(vec3(.004,.008,.016) + c*(win*.7 + edge*.25 + top*.3)*fade*.55, 1.); }`,
    }), N);
    const m = new THREE.Matrix4();
    for (let i = 0; i < N; i++) {
      const a = rand(0, TAU), r = rand(240, 700), w = rand(6, 22), h = rand(25, 95);
      m.compose(V(Math.cos(a) * r, GRID_Y + h / 2, Math.sin(a) * r), new THREE.Quaternion(), V(w, h, rand(6, 22)));
      towers.setMatrixAt(i, m); seed[i] = Math.random();
    }
    geo.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seed, 1));
    city.add(towers);
  }
  // lights
  object.add(new THREE.HemisphereLight(0x2a6a9a, 0x2a1050, 0.07));
  const key = new THREE.DirectionalLight(0xbfd8ff, 0.4); key.position.set(10, 30, 15); object.add(key);
  // a soft studio env map (cyan/violet strips) for the glossy island tops
  let environment = null;
  if (renderer) {
    const env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: 0x02040a, side: THREE.BackSide })));
    const strip = (c, i, pos, rot, s) => { const q = new THREE.Mesh(new THREE.PlaneGeometry(...s), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); q.position.set(...pos); q.rotation.set(...rot); env.add(q); };
    strip(0x38d8ff, 3, [0, 30, -20], [0.9, 0, 0], [60, 4]); strip(0x7a5cff, 2, [-30, -10, 10], [0, 1.2, 0], [30, 10]);
    strip(0x38d8ff, 1.5, [30, 5, 20], [0, -1, 0], [8, 40]); strip(0xffffff, 1.2, [0, 40, 0], [Math.PI / 2, 0, 0], [20, 20]);
    const pm = new THREE.PMREMGenerator(renderer);
    environment = pm.fromScene(env, 0.02).texture; pm.dispose(); disposeTree(env);
  }
  let lastBake = -1e9;
  return {
    object, city, environment,
    // everything moves on U.uTime; the baked sky catches up every SKY_REBAKE s
    update(t) { if (bake && Math.abs(U.uTime.value - lastBake) >= SKY_REBAKE) { lastBake = U.uTime.value; bake(); } },
    dispose() { disposeTree(object); environment?.dispose(); skyRT?.dispose(); if (object.userData.skyBake) disposeTree(object.userData.skyBake.bs); },
  };
}
