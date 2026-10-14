// Ch2 world: decorations from the first Deep Cache mood pass (2026-10-13). Julius keeps them (2026-10-14): "i liked them, just
// make sure the data rain and nested solids aren't too much". Pure scenery: nothing here is walkable or hits.
//   shifting cube island  a 6x6 grid of glowing tiles that folds between platform, ziggurat, explosion and spiral stair
//                         (right of the Gate's view, towards the Forge)
//   tesseract             a 4D cube turning over the slide's landing at the Task Yard (the tools you carried in)
//   far islands + streams 16 distant islands, and dim points flowing to and from the level: agents too far away to see
//   nested solids         three huge wire solids, each nested 3 deep, at the edge of the void (toned down: faint)
//   data rain             thin falling streaks in the void (toned down: fewer, dimmer, further out)
//   rusty debris          the Ch1 depot kiosk drifting through its own cache, three copies (optional: pass `depot`)
// createDecor({ layout, U, models: { s, m, l }, depot? }) -> { object, parts, update(t, dt), dispose() }
//   U.uPsy (0..1) still drives the cube's speed and the hue drift, as in the mood pass.
import * as THREE from 'three';
import { C, AGENT_COLORS, TAU, rand, pick, V, VA, disposeTree } from './util.js';

export const DECOR = {
  cube: [-44, 20, 24], tesseract: [-22, 8, -50],
  rain: { count: 300, inner: 70, outer: 230, brightness: .45 },   // mood pass: 700 streaks, 25–170 m, full brightness
  solids: { opacity: .28 },                                       // mood pass: .9
};

export function createDecor({ layout, U, models, depot = null }) {
  const object = new THREE.Group(); object.name = 'decor';
  const parts = {};
  // ---- shifting cube island
  {
    const n = 6, size = 1.5, gap = .1, N = n * n;
    const c = new OffscreenCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#38d8ff'; g.lineWidth = 5; g.strokeRect(5, 5, 118, 118);
    g.fillStyle = '#38d8ff'; [[10, 10], [108, 10], [10, 108], [108, 108]].forEach(([x, y]) => g.fillRect(x, y, 10, 10));
    g.globalAlpha = .25; g.fillRect(40, 40, 48, 48);
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b1018, metalness: .7, roughness: .28, emissive: 0xffffff, emissiveMap: new THREE.CanvasTexture(c), emissiveIntensity: 2.2 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(size, .5, size), mat, N); mesh.position.copy(VA(DECOR.cube)); object.add(mesh);
    const cells = [...Array(N)].map((_, i) => { const ix = i % n, iz = Math.floor(i / n); return { ix, iz, x: (ix - (n - 1) / 2) * (size + gap), z: (iz - (n - 1) / 2) * (size + gap), h: Math.random(), h2: Math.random() }; });
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = V(0, 0, 0), s = V(1, 1, 1), ease = (k) => k * k * (3 - 2 * k);
    const shape = (k, cl, t) => {
      const d = Math.max(Math.abs(cl.ix - 2.5), Math.abs(cl.iz - 2.5));
      if (k === 0) return [cl.x, 0, cl.z, 0, 0, 0];                                                    // flat platform
      if (k === 1) return [cl.x, (2.5 - d) * 1.1, cl.z, 0, 0, 0];                                      // ziggurat
      if (k === 2) return [cl.x * 1.7, (cl.h - .5) * 9, cl.z * 1.7, cl.h * 3, cl.h2 * 3, cl.h * 2];    // exploded
      const a = Math.atan2(cl.z, cl.x) + d * .5, r = 1.2 + d * 1.6; return [Math.cos(a) * r, d * 1.3 + Math.sin(t + d) * .3, Math.sin(a) * r, 0, -a, 0];   // spiral stair
    };
    const SEQ = [[0, 6], [1, 3.5], [2, 2.5], [3, 4], [2, 2], [0, 0]], total = SEQ.reduce((a, b) => a + b[1] + 1.4, 0);
    let clock = 0;
    parts.cube = { mesh, update(t, dt, psy) {
      clock += dt * (.35 + psy * 1.3);
      let tt = clock % total, i = 0; while (tt > SEQ[i][1] + 1.4) { tt -= SEQ[i][1] + 1.4; i++; }
      const from = SEQ[i][0], to = SEQ[(i + 1) % SEQ.length][0], k = tt < SEQ[i][1] ? 0 : ease((tt - SEQ[i][1]) / 1.4);
      cells.forEach((cl, j) => {
        const A = shape(from, cl, t), B = shape(to, cl, t), lag = Math.min(1, Math.max(0, k * 1.6 - cl.h * .6));
        const v = A.map((a, x) => a + (B[x] - a) * ease(lag)); v[1] += Math.sin(t * 1.3 + cl.ix * .7 + cl.iz * .5) * .08 * (1 + psy * 3);
        p.set(v[0], v[1], v[2]); q.setFromEuler(e.set(v[3], v[4], v[5])); mesh.setMatrixAt(j, m4.compose(p, q, s));
      });
      mesh.instanceMatrix.needsUpdate = true; mat.emissive.setHSL((.53 + psy * .12 * Math.sin(t * .3)) % 1, 1, .5);
    } };
  }
  // ---- tesseract
  {
    const v4 = [...Array(16)].map((_, i) => [i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const edges = []; for (let i = 0; i < 16; i++) for (let b = 0; b < 4; b++) { const j = i ^ (1 << b); if (j > i) edges.push([i, j]); }
    const pos = new Float32Array(edges.length * 6), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(3), transparent: true, blending: THREE.AdditiveBlending });
    const lines = new THREE.LineSegments(g, mat); lines.position.copy(VA(DECOR.tesseract)); lines.frustumCulled = false; object.add(lines);
    parts.tesseract = { lines, update(t, dt, psy) {
      const a = t * (.25 + psy * .5), b = t * .17;
      const P = v4.map(([x, y, z, w]) => { const x1 = x * Math.cos(a) - w * Math.sin(a), w1 = x * Math.sin(a) + w * Math.cos(a), y1 = y * Math.cos(b) - w1 * Math.sin(b), w2 = y * Math.sin(b) + w1 * Math.cos(b), k = 2.2 / (3 - w2); return [x1 * k, y1 * k, z * k]; });
      edges.forEach(([i, j], n) => { pos.set(P[i], n * 6); pos.set(P[j], n * 6 + 3); }); g.attributes.position.needsUpdate = true;
      lines.rotation.y = t * .1; mat.color.setHSL((.53 + psy * .25 * Math.sin(t * .4)) % 1, 1, .5).multiplyScalar(3);
    } };
  }
  // ---- far islands + streams of distant agents
  const far = [], owned = [];
  {
    const RADIUS = { s: 2.6, m: 5, l: 9 };
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU + rand(-.15, .15), r = rand(150, 260), size = pick(['s', 'm', 'l']), sc = rand(1, 2.6);
      const g = models[size].clone(true); g.scale.setScalar(sc); g.position.set(Math.cos(a) * r, rand(-30, 50), Math.sin(a) * r - 15); g.rotation.y = rand(0, TAU);
      g.traverse((o) => { if (o.isMesh && o.material.name === 'edge') { o.material = o.material.clone(); owned.push(o.material); o.material.emissiveIntensity = 2; } });
      object.add(g); far.push({ g, base: g.position.y, bob: rand(0, TAU), R: RADIUS[size] * sc });
    }
    const near = ['gate', 'taskyard', 'flood-centre', 'forge', 'run-start', 'dir-arv', 'dir-libraw'].map((id) => VA(layout.islands.find((x) => x.id === id).pos));
    const routes = [...Array(26)].map(() => [pick(far).g.position, pick(near), rand(10, 30)]);
    const N = 700, p = new Float32Array(N * 3), c = new Float32Array(N * 3), pts = [];
    for (let i = 0; i < N; i++) { const col = new THREE.Color(pick(AGENT_COLORS)); c.set([col.r, col.g, col.b], i * 3); pts.push({ r: pick(routes), t: Math.random(), s: rand(.02, .06), back: Math.random() < .5 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    const obj = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `varying vec3 vC; varying float vF; void main(){ vC = color; vec4 mv = modelViewMatrix*vec4(position,1.); vF = exp(-length(mv.xyz)*.006); gl_PointSize = 3.5; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vF; void main(){ float d = length(gl_PointCoord-.5); if (d>.5) discard; gl_FragColor = vec4(vC*.75*vF*(1.-2.*d), 1.); }`,   // under the bloom threshold, like every agent
    }));
    obj.frustumCulled = false; object.add(obj);
    const tmp = V(0, 0, 0);
    parts.streams = { obj, update(t, dt) {
      pts.forEach((q, i) => { q.t = (q.t + q.s * dt) % 1; const [A, B, h] = q.r, k = q.back ? 1 - q.t : q.t; tmp.lerpVectors(A, B, k); tmp.y += Math.sin(k * Math.PI) * h; p.set([tmp.x, tmp.y, tmp.z], i * 3); });
      g.attributes.position.needsUpdate = true;
      far.forEach((f) => f.g.position.y = f.base + Math.sin(t * .35 + f.bob) * .8);
    } };
  }
  // ---- nested solids at the edge of the void (faint)
  {
    const grp = new THREE.Group(); object.add(grp);
    for (const [geo, pos, s] of [[new THREE.IcosahedronGeometry(1, 1), [-120, 40, -230], 24], [new THREE.OctahedronGeometry(1, 0), [210, -5, -120], 18], [new THREE.DodecahedronGeometry(1, 0), [40, 70, 240], 28]]) {
      const sg = new THREE.Group(); sg.position.copy(VA(pos)); grp.add(sg);
      [1, .62, .38].forEach((k, i) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(i === 1 ? new THREE.IcosahedronGeometry(1, 0) : geo), new THREE.LineBasicMaterial({ color: 0x38d8ff, transparent: true, opacity: DECOR.solids.opacity * (1 - i * .2), blending: THREE.AdditiveBlending, fog: false })); l.scale.setScalar(s * k); sg.add(l); });
    }
    parts.solids = { grp, update(t) { grp.children.forEach((sg, i) => sg.children.forEach((l, j) => { l.rotation.x = t * (.02 + j * .015) * (i % 2 ? 1 : -1); l.rotation.y = t * (.03 - j * .01); })); } };
  }
  // ---- data rain (fewer, dimmer, further out)
  {
    const R = DECOR.rain, N = R.count, p = new Float32Array(N * 6), s = new Float32Array(N * 2), e = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { const a = rand(0, TAU), r = rand(R.inner, R.outer), x = Math.cos(a) * r, z = Math.sin(a) * r - 15, y = rand(-80, 80), L = rand(1.5, 7), sd = Math.random(); p.set([x, y, z, x, y + L, z], i * 6); s.set([sd, sd], i * 2); e.set([0, 1], i * 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('seed', new THREE.BufferAttribute(s, 1)); g.setAttribute('end', new THREE.BufferAttribute(e, 1));
    const l = new THREE.LineSegments(g, new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uB: { value: R.brightness } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float seed, end; varying float vE, vS, vF; uniform float uTime;
        void main(){ vec3 q = position; q.y = mod(q.y + 80. - uTime*(2.+seed*6.), 160.) - 80.;
          vE = end; vS = seed; vec4 mv = modelViewMatrix*vec4(q,1.); vF = exp(-length(mv.xyz)*.012); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform float uB; varying float vE, vS, vF; void main(){ vec3 c = mix(vec3(.2,.8,1.), vec3(.6,.4,1.), step(.8,vS)); gl_FragColor = vec4(c*vE*vF*(.25+.5*vS)*uB, 1.); }`,
    }));
    l.frustumCulled = false; object.add(l); parts.rain = { l, update() {} };
  }
  // ---- rusty debris: the Ch1 depot kiosk drifting through its own cache
  if (depot) {
    const grp = new THREE.Group(); object.add(grp);
    [[[-42, 6, -28], 2.2, [.4, .8, .3]], [[48, -14, -78], 1.4, [-.6, 2, .5]], [[34, 46, 34], .9, [1.2, .3, -.4]]].forEach(([p, s, r]) => {
      const c = depot.clone(true); c.position.copy(VA(p)); c.scale.setScalar(s); c.rotation.set(...r); c.userData.spin = V(rand(-.05, .05), rand(-.08, .08), rand(-.05, .05)); grp.add(c);
    });
    parts.debris = { grp, update(t, dt) { grp.children.forEach((d) => { d.rotation.x += d.userData.spin.x * dt; d.rotation.y += d.userData.spin.y * dt; d.rotation.z += d.userData.spin.z * dt; }); } };
  }
  return {
    object, parts,
    update(t, dt) { const psy = U.uPsy?.value ?? .5; for (const p of Object.values(parts)) p.update(t, dt, psy); },
    // island models and the depot are the caller's: free only what this module made
    dispose() { owned.forEach((m) => m.dispose()); object.traverse((o) => { if (o.isInstancedMesh || o.isLineSegments || o.isPoints) { o.geometry.dispose(); [o.material].flat().forEach((m) => m.dispose()); } }); },
  };
}
