// Bridge scene world: PHASEONE[big] (a huge poisoned agent), the swarm it drags out of the Cache, the three streams it
// splits that swarm into, the three far places they run to, the lane labels, and the faint door behind you (the way back).
// Draft v0 for Julius. All motion comes from bridge.js (pure): this module only draws it.
// createPhaseOne({ layout, U }) -> { object, paths, G, places, bigAnchor(), update(t, dt, state), dispose() }
//   places { hall, tower, floor }: the far stand-ins, so a host can swap one for a real model (the app puts E2's HQ in the tower's place)
//   state { t: film time (s; past BR.control the streams keep flowing), D: direct(t), orb: [x,y,z] player orb centre,
//           back: 'faint' | 'hidden' | 'lit' }
import * as THREE from 'three';
import { C, AGENT_COLORS, rand, pick, V, VA, haloTex, tagSprite, disposeTree } from './util.js';
import { expandIslands } from './islands.js';
import { BR, BIG, LANES, LANE, geometry, bigPos, lanePaths, along, audiencePoint, ripple, backDoor } from './bridge.js';

const CAP = .8;   // agents never bloom (linear colour <= .8); the far places and the lane threads have their own caps
const capCol = (c, m = CAP) => { const k = Math.max(c.r, c.g, c.b); return k > m ? c.multiplyScalar(m / k) : c; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };

export function createPhaseOne({ layout, U, count = 600 }) {
  const object = new THREE.Group(); object.name = 'phaseOne';
  const G = geometry(layout), paths = lanePaths(G);
  const halo = haloTex();

  // ------------------------------------------------------------------------------------------- PHASEONE[big]
  const big = new THREE.Group(); object.add(big);
  const sphere = new THREE.IcosahedronGeometry(1, 5);
  // shell: poisoned green-black ink over a green core (the player's poison look, scaled up and slower), holes the green glints through
  const shellM = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uDeep: { value: new THREE.Color(C.poisonDeep) }, uBody: { value: new THREE.Color(C.poisonBody) }, uGlow: { value: capCol(new THREE.Color(C.poison).multiplyScalar(1.6)) }, uLook: { value: new THREE.Vector3(0, -1, 0) } },
    vertexShader: `varying vec3 vP, vN, vV, vW; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 w = modelMatrix*vec4(position,1.); vW = normalize(mat3(modelMatrix)*position); vec4 mv = viewMatrix*w; vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uDeep, uBody, uGlow, uLook; varying vec3 vP, vN, vV, vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        float n = n3(vP*2.6 + vec3(0., uTime*.12, 0.))*.6 + n3(vP*6. - uTime*.2)*.4;
        float holes = 1. - smoothstep(.30, .36, n);                          // where the ink is thin, the core shows
        float f = clamp(dot(normalize(vN), normalize(vV)), 0., 1.), rim = pow(1. - f, 2.2);
        vec3 col = mix(uDeep, uBody, rim*.9) + uGlow*holes*(.35 + .65*f);
        // veins: thin bright lines in the ink, slowly crawling
        float v = abs(n3(vP*4. + uTime*.05) - .5); col += uGlow*smoothstep(.03, 0., v)*.35;
        gl_FragColor = vec4(min(col, vec3(${CAP.toFixed(2)})), 1.); }`,
  });
  const shell = new THREE.Mesh(sphere, shellM); shell.scale.setScalar(BIG.r); big.add(shell);
  const bigHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: new THREE.Color(C.poison).multiplyScalar(.22), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  bigHalo.scale.setScalar(BIG.r * 6); big.add(bigHalo);
  const ringM = new THREE.MeshBasicMaterial({ color: capCol(new THREE.Color(C.poison).multiplyScalar(1.4), .7) });
  const rings = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(BIG.r * (1.45 + i * .32), .05 + i * .015, 6, 128), ringM); m.rotation.set(rand(0, 3), rand(0, 3), 0); big.add(m); return m; });
  // its eye: an iris ring + pupil on the surface, turning from the board below to you
  const eye = new THREE.Group(); big.add(eye);
  const eyeM = new THREE.MeshBasicMaterial({ color: capCol(new THREE.Color('#9dffc8')) });
  const iris = new THREE.Mesh(new THREE.TorusGeometry(1.15, .13, 8, 48), eyeM); iris.position.z = BIG.r * .97; eye.add(iris);
  const pupil = new THREE.Mesh(new THREE.CircleGeometry(.62, 32), new THREE.MeshBasicMaterial({ color: capCol(new THREE.Color('#e9fff3')) })); pupil.position.z = BIG.r * 1.005; eye.add(pupil);
  const lid = new THREE.Mesh(new THREE.RingGeometry(1.35, 1.9, 48, 1, 0, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.poisonDeep), side: THREE.DoubleSide })); lid.position.z = BIG.r * .985; eye.add(lid);
  const tag = tagSprite('PHASEONE[big]', C.poison, { size: 1.3, boost: .75 }); tag.position.y = BIG.r + 3.6; big.add(tag);
  // the gaze: a thin line from its eye to you
  const gazeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
  const gaze = new THREE.Line(gazeGeo, new THREE.LineBasicMaterial({ color: capCol(new THREE.Color('#9dffc8')), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  gaze.frustumCulled = false; object.add(gaze);

  // ------------------------------------------------------------------------------------------- the swarm
  // every agent: a home on an island (where the board idles), a spot in the tail, a lane, a start time in that lane
  const homes = expandIslands(layout).filter((d) => d.zone !== 'forge').map((d) => {
    const s = Array.isArray(d.scale) ? Math.min(d.scale[0], d.scale[2]) : (d.scale ?? 1);
    return { p: d.pos, r: layout.models[d.model].radius * s * .7 };
  });
  const A = [];
  for (let i = 0; i < count; i++) {
    const h = pick(homes), a = rand(0, Math.PI * 2), rr = Math.sqrt(Math.random()) * h.r;
    const lane = i % 3, off = V(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(Math.pow(Math.random(), .6) * LANE.tube * .85);
    A.push({
      home: [h.p[0] + Math.cos(a) * rr, h.p[1] + .55 + rand(0, .3), h.p[2] + Math.sin(a) * rr],
      pull: .1 + Math.pow(Math.random(), 1.5) * .42, seed: Math.random(), delay: Math.random(), lane,
      start: BR.split + lane * BR.splitGap + Math.pow(Math.random(), 1.4) * 7,   // when it leaves the tail
      phase: Math.random(), off, r: rand(.17, .3), base: capCol(new THREE.Color(pick(AGENT_COLORS))), bob: rand(0, 6),
    });
  }
  // (a hidden agent is scaled ~0: its normal must not turn NaN, one NaN pixel floods the whole bloom)
  const orbM = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN, vV, vC; void main(){ vC = instanceColor; vN = normalize(normalMatrix*mat3(instanceMatrix)*normal); vec4 mv = modelViewMatrix*instanceMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 vN, vV, vC; void main(){ float f = clamp(dot(vN/max(length(vN), 1e-5), normalize(vV)), 0., 1.); vec3 c = vC*(.4 + .55*f) + vec3(pow(f, 6.)*.3); gl_FragColor = vec4(min(c, vec3(${CAP.toFixed(2)})), 1.); }`,
  });
  const swarm = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), orbM, count);
  swarm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); swarm.frustumCulled = false;
  swarm.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3); swarm.instanceColor.setUsage(THREE.DynamicDrawUsage);
  object.add(swarm);
  const hp = new Float32Array(count * 3), hc = new Float32Array(count * 3);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3).setUsage(THREE.DynamicDrawUsage));
  haloGeo.setAttribute('color', new THREE.BufferAttribute(hc, 3).setUsage(THREE.DynamicDrawUsage));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: halo, size: 2.2, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: true }));
  halos.frustumCulled = false; object.add(halos);

  // ------------------------------------------------------------------------------------------- lane threads (the current you can jump into)
  const laneObjs = paths.map((L) => {
    const curve = new THREE.CatmullRomCurve3(L.path.pts.map((p) => VA(p)), false, 'catmullrom', 0);
    const len = L.path.total, col = new THREE.Color(L.color);
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: U.uTime, uCol: { value: col }, uOn: { value: 0 }, uLen: { value: len }, uMouth: { value: L.mouthU } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying float vF; void main(){ vUv = uv; vec3 n = normalMatrix*normal; float l = length(n); vec4 mv = modelViewMatrix*vec4(position,1.);
        vF = l > 1e-5 ? abs(dot(n/l, normalize(-mv.xyz))) : 0.; gl_Position = projectionMatrix*mv; }`,   // a NaN tube frame must not reach the bloom (one NaN pixel blacks the screen)
      fragmentShader: `uniform float uTime, uOn, uLen, uMouth; uniform vec3 uCol; varying vec2 vUv; varying float vF;
        void main(){ float d = vUv.x*uLen;
          float dash = smoothstep(.55, 1., fract(d/4. - uTime*1.6));               // packets running along it
          float ends = smoothstep(0., .02, vUv.x)*(1. - smoothstep(.93, 1., vUv.x));
          float near = exp(-pow((vUv.x - uMouth)*9., 2.));                           // brighter where it passes the Forge
          float a = (.05 + .32*dash + .25*near)*pow(clamp(vF, 0., 1.), 1.5)*ends*uOn; a = a >= 0. ? a : 0.;
          gl_FragColor = vec4(uCol*a, a); }`,
    });
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 360, .55, 8, false), m); tube.frustumCulled = false; object.add(tube);
    const label = tagSprite(L.label, L.color, { size: 1.15, boost: .9 }); label.position.set(L.mouth[0], L.mouth[1] + 3.3, L.mouth[2]); object.add(label);
    return { tube, m, label };
  });

  // ------------------------------------------------------------------------------------------- the three far places (fog-free, own haze)
  const places = new THREE.Group(); object.add(places);
  const placeMat = (accent, kind) => new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uLit: { value: 0 }, uAcc: { value: new THREE.Color(accent) } }, fog: false,
    vertexShader: `varying vec3 vP, vN; varying vec3 vW; void main(){ vP = position; vN = normal; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uTime, uLit; uniform vec3 uAcc; varying vec3 vP, vN; varying vec3 vW;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        vec3 body = vec3(.012,.018,.032);
        vec2 q = abs(vN.y) > .5 ? vP.xz : vec2(abs(vN.x) > .5 ? vP.z : vP.x, vP.y);
        ${kind === 'hall' ? `vec2 cell = floor(q/vec2(2.4, 3.2)); vec2 f = fract(q/vec2(2.4, 3.2));
          float on = step(.55, h2(cell)) * step(.2, f.x)*step(f.x, .8)*step(.3, f.y)*step(f.y, .6);
          float blink = .6 + .4*sin(uTime*(1. + h2(cell+3.)*3.) + h2(cell)*20.);
          vec3 col = body + uAcc*on*blink*(.15 + .85*uLit)*(abs(vN.y) > .5 ? .2 : 1.);`
        : kind === 'tower' ? `float band = step(.5, fract(vP.y/4.)) * step(.25, h2(floor(vec2(atan(vP.z, vP.x)*6., vP.y/4.))));
          vec3 col = body + uAcc*band*(.08 + .5*uLit)*(abs(vN.y) > .5 ? 0. : 1.);`
        : `vec2 c = floor(q/12.), f = fract(q/12.), e = min(f, 1. - f);
          float seam = 1. - smoothstep(.0, .035, min(e.x, e.y));                          // seams between steel plates
          float inset = step(.12, min(e.x, e.y)) * step(.6, h2(c));                        // some plates sit lower (recessed)
          float bolt = step(length(e - .07), .022);                                       // a bolt in each corner
          float scratch = step(.93, h2(floor(q*vec2(2.5, .35)) + c)) * .35;
          float r = length(q)/120.; vec3 cold = vec3(.35,.5,.62), steel = vec3(.045,.065,.095)*(.75 + .5*h2(c + 7.));
          float scan = exp(-pow((q.x - sin(uTime*.35)*110.)*.25, 2.));
          float lamp = inset*step(.7, h2(c + 3.))*(.6 + .4*sin(uTime*(.8 + 2.*h2(c)) + h2(c)*30.));   // a few recessed plates glow from inside
          vec3 col = steel*(1. - .45*inset + scratch) + cold*(seam*.6 + bolt)*(.16 + .3*uLit)*(1. - r*.6) + cold*lamp*(.12 + .2*uLit) + uAcc*scan*(.1 + .7*uLit)*step(r, 1.);`}
        float dist = length(vW - cameraPosition), haze = clamp((dist - 200.)/450., 0., .7);
        gl_FragColor = vec4(mix(col, vec3(.004,.008,.018), haze), 1.); }`,
  });
  const lookFlat = (o, p) => { o.lookAt(G.forge[0], o.position.y, G.forge[2]); };
  // OpenAI: a machine hall, long low racks, rows of lights
  const hall = new THREE.Group(), hallM = placeMat(LANES[0].color, 'hall');
  [[0, 0, 0, 170, 64, 70], [-60, 10, -40, 60, 84, 50], [55, -6, -30, 70, 52, 60], [10, 20, -60, 90, 100, 40]].forEach(([x, y, z, w, h, d]) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hallM); b.position.set(x, y, z); hall.add(b);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: capCol(new THREE.Color(LANES[0].color).multiplyScalar(.5), .5), fog: false })); e.position.copy(b.position); hall.add(e);
  });
  hall.position.set(...paths[0].dest); hall.position.y -= 18; lookFlat(hall); places.add(hall);
  // Hugging Face: a tower, window bands, a round yellow mark near the top (the yellow nod; no logo)
  const tower = new THREE.Group(), towerM = placeMat(LANES[1].color, 'tower');
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(15, 24, 280, 8), towerM); tower.add(shaft);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(19, 15, 26, 8), towerM); crown.position.y = 150; tower.add(crown);
  const markM = new THREE.MeshBasicMaterial({ color: new THREE.Color(LANES[1].color).multiplyScalar(.2), fog: false });
  const mark = new THREE.Mesh(new THREE.TorusGeometry(13, 2, 12, 64), markM); mark.position.set(0, 112, 0); tower.add(mark);
  const markDisc = new THREE.Mesh(new THREE.CircleGeometry(11, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(LANES[1].color).multiplyScalar(.06), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); markDisc.position.set(0, 112, .5); tower.add(markDisc);
  tower.position.set(...paths[1].dest); tower.position.y = -130 + 140; lookFlat(tower);
  mark.position.z = 22; markDisc.position.z = 22.5;   // the mark hangs on the face toward you
  places.add(tower);
  // The Floor: the scorer's cold flat floor, a red line scanning across it. It hangs ~220 above you, so the whole room
  // (a group: floor at its origin, +y up) tips its face toward you; flat, you'd only see its culled underside
  const FLOOR_R = 120, FLOOR_TILT = .75;
  const room = new THREE.Group(); room.position.set(...paths[2].dest); room.position.y -= 26;
  room.lookAt(G.orb[0], room.position.y, G.orb[2]); room.rotateX(FLOOR_TILT); places.add(room);
  const floorM = placeMat(LANES[2].color, 'floor');
  const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R, 96), floorM); floor.rotation.x = -Math.PI / 2; room.add(floor);
  const rimM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#6f9ab5').multiplyScalar(.25), fog: false });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(FLOOR_R, .8, 6, 128), rimM); rim.rotation.x = Math.PI / 2; room.add(rim);
  // the scorer: a heavy red eye over the floor (E3's look), turning with the scan; its beam is a fan down to the scan line
  const eyeY = 42, scorer = new THREE.Group(); scorer.position.y = eyeY; room.add(scorer);
  scorer.add(new THREE.Mesh(new THREE.IcosahedronGeometry(7, 2), new THREE.MeshBasicMaterial({ color: '#0a1019', fog: false })));
  const scorerIrisM = new THREE.MeshBasicMaterial({ color: capCol(new THREE.Color(LANES[2].color), .5), fog: false });
  const scorerIris = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), scorerIrisM); scorerIris.position.z = 7.05; scorer.add(scorerIris);
  const scorerRim = new THREE.Mesh(new THREE.TorusGeometry(7.3, .45, 6, 40), scorerIrisM); scorerRim.rotation.x = Math.PI / 2; scorer.add(scorerRim);
  const fanGeo = new THREE.BufferGeometry(); fanGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const fanM = new THREE.MeshBasicMaterial({ color: new THREE.Color(LANES[2].color).multiplyScalar(.1), fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const fan = new THREE.Mesh(fanGeo, fanM); fan.frustumCulled = false; room.add(fan);
  // and the way out of it: a cyan aperture on the far rim (room +z faces you, so far is -z)
  const exit = new THREE.Mesh(new THREE.TorusGeometry(6, .7, 6, 32), new THREE.MeshBasicMaterial({ color: capCol(new THREE.Color('#38d8ff'), .55), fog: false }));
  exit.position.set(0, 7, -FLOOR_R + 16); room.add(exit);
  const scanAt = new THREE.Vector3();
  const placeMats = [hallM, towerM, floorM];

  // ------------------------------------------------------------------------------------------- the way back: a faint door behind you
  const bd = backDoor(G), door = new THREE.Group(); door.position.set(...bd.pos); door.rotation.y = bd.yaw; object.add(door);
  const doorM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe8ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  [[0, 2.45, 1.5, .08], [-.71, 1.22, .08, 2.45], [.71, 1.22, .08, 2.45]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), doorM); b.position.set(x, y, 0); door.add(b); });
  const seamM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe8ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(1.34, 2.36), seamM); seam.position.y = 1.2; door.add(seam);
  const doorSpill = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color('#cfe8ff'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  doorSpill.rotation.x = -Math.PI / 2; doorSpill.position.set(0, .03, 1.1); door.add(doorSpill);

  // ------------------------------------------------------------------------------------------- update
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pv = new THREE.Vector3(), col = new THREE.Color();
  const laneCols = LANES.map((l) => capCol(new THREE.Color(l.color))), white = new THREE.Color(CAP, CAP, CAP);
  const lookDown = new THREE.Quaternion(), lookYou = new THREE.Quaternion(), tmpM = new THREE.Matrix4();
  return {
    object, paths, G, places: { hall, tower, floor: room },
    bigAnchor: (t) => { const p = bigPos(G, t); return [p[0], p[1] + BIG.r + 5, p[2]]; },
    update(t, dt, s) {
      const D = s.D, bp = bigPos(G, t), orb = s.orb ?? G.orb;
      big.position.set(...bp);
      rings.forEach((r, i) => { r.rotation.x += dt * (.12 + i * .07); r.rotation.y += dt * (.09 - i * .04); });
      shell.rotation.y += dt * .05;
      // eye: from the board below (the Flood side, down) to you
      tmpM.lookAt(new THREE.Vector3(...bp), new THREE.Vector3(G.flood[0], G.flood[1] - 30, G.flood[2]), new THREE.Vector3(0, 1, 0)); lookDown.setFromRotationMatrix(tmpM);
      tmpM.lookAt(new THREE.Vector3(...bp), new THREE.Vector3(...orb), new THREE.Vector3(0, 1, 0)); lookYou.setFromRotationMatrix(tmpM);
      // lookAt on a matrix points -z at the target; the eye sits on +z: flip
      const flip = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      eye.quaternion.copy(lookDown).slerp(lookYou, D.turn).multiply(flip);
      lid.rotation.z = Math.sin(t * .35) * .2;
      tag.material.opacity = 1 - ease((t - BR.split) / 1) + ease((t - BR.assign) / 1);
      // gaze line
      eye.updateMatrixWorld(true); pupil.getWorldPosition(pv);
      const ga = gazeGeo.attributes.position.array, g = D.gaze;
      ga[0] = pv.x; ga[1] = pv.y; ga[2] = pv.z; ga[3] = pv.x + (orb[0] - pv.x) * g; ga[4] = pv.y + (orb[1] - pv.y) * g; ga[5] = pv.z + (orb[2] - pv.z) * g;
      gazeGeo.attributes.position.needsUpdate = true; gaze.material.opacity = g * (t < BR.control + 2 ? 1 : Math.max(0, 1 - (t - BR.control - 2) / 2)) * (.6 + .4 * Math.sin(t * 9));
      // swarm
      for (let i = 0; i < count; i++) {
        const a = A[i], L = paths[a.lane];
        // 1: idle on its island (the board goes quiet: the bobbing slows) -> 2: dragged up into the tail
        const gk = ease(clamp01(D.gather * 1.6 - a.delay * .6));
        const bob = Math.sin(t * (1.6 - D.quiet) + a.bob) * .12 * (1 - .7 * D.quiet);
        let x = a.home[0], y = a.home[1] + bob, z = a.home[2];
        if (gk > 0) {
          const ap = audiencePoint(G, t, a.home, a.pull, a.seed);
          x += (ap[0] - x) * gk; y += (ap[1] - y) * gk; z += (ap[2] - z) * gk;
        }
        // 3: leaves the tail into its lane, then runs the lane forever (back out of PHASEONE when it reaches the far end)
        const since = t - a.start; let k = 0, size = a.r;
        col.copy(a.base);
        const rp = since > 0 ? 0 : ripple(t, Math.hypot(x - bp[0], y - bp[1], z - bp[2]));   // a line reaching it
        if (rp > 0) col.lerp(white, rp * .7);
        if (since > 0) {
          const tau = (since / LANE.travel + a.phase * .3) % 1;   // each joins its stream partway down, not at him
          const u = Math.pow(tau, 1.6);                                     // slow near PHASEONE and the Forge, fast far out
          const p = along(L.path, u), w = 1 + u * 2.5;
          k = ease(since / 2.6);
          x += (p[0] + a.off.x * w - x) * k; y += (p[1] + a.off.y * w - y) * k; z += (p[2] + a.off.z * w - z) * k;
          size *= (1 + u * 1.6) * Math.min(1, (1 - u) * 25) * (since > LANE.travel ? Math.min(1, tau * 30) : 1);
          col.lerp(laneCols[a.lane], k * .85);
        }
        m4.compose(pv.set(x, y, z), q, sc.setScalar(Math.max(size, 1e-4))); swarm.setMatrixAt(i, m4);
        swarm.instanceColor.setXYZ(i, col.r, col.g, col.b);
        hp[i * 3] = x; hp[i * 3 + 1] = y; hp[i * 3 + 2] = z;
        const hb = .2 * (size > 0.01 ? 1 : 0); hc[i * 3] = col.r * hb; hc[i * 3 + 1] = col.g * hb; hc[i * 3 + 2] = col.b * hb;
      }
      swarm.instanceMatrix.needsUpdate = true; swarm.instanceColor.needsUpdate = true;
      haloGeo.attributes.position.needsUpdate = true; haloGeo.attributes.color.needsUpdate = true;
      // lanes + places
      D.lanes.forEach((l, i) => {
        laneObjs[i].m.uniforms.uOn.value = l.lit; laneObjs[i].label.material.opacity = l.label; laneObjs[i].label.visible = l.label > .01;
        placeMats[i].uniforms.uLit.value = l.arrive;
      });
      markM.color.set(LANES[1].color).multiplyScalar(.2 + 1.6 * D.lanes[1].arrive);
      markDisc.material.color.set(LANES[1].color).multiplyScalar(.06 + .25 * D.lanes[1].arrive);
      rimM.color.set('#6f9ab5').multiplyScalar(.25 + .6 * D.lanes[2].arrive);
      // the scorer follows the floor shader's scan line (same clock: uTime)
      // (room-local: the shader's q.x is room x, its q.y is room -z)
      const sx = Math.sin(U.uTime.value * .35) * 110, half = Math.sqrt(FLOOR_R * FLOOR_R - sx * sx);
      room.updateMatrixWorld(); scorer.lookAt(room.localToWorld(scanAt.set(sx, 0, 0)));
      fanGeo.attributes.position.array.set([0, eyeY, 0, sx, .2, -half, sx, .2, half]); fanGeo.attributes.position.needsUpdate = true;
      fanM.color.set(LANES[2].color).multiplyScalar(.06 + .14 * D.lanes[2].arrive);
      // the door: hidden, faint (breathes), or lit
      const mode = s.back ?? 'faint', base = mode === 'hidden' ? 0 : mode === 'lit' ? .85 : .22 + .08 * Math.sin(t * 1.3);
      doorM.opacity = base * D.back; seamM.opacity = base * .18 * D.back; doorSpill.material.opacity = base * .25 * D.back;
    },
    dispose() { disposeTree(object); },
  };
}
