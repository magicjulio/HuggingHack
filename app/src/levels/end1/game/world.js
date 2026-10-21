// The hall: computers as skyscrapers, their ports, colliders, and the research cluster.
// Course is seeded, so every run is the same track (it's a race).
import * as THREE from 'three';
import { towerTextures, rackTextures, screenTexture, floorTexture, labelTexture, sandboxTexture } from './textures.js';
import { GlowPoints } from './fx.js';

export const PORT_COLORS = {
  open: new THREE.Color(0x46ff8c),
  watched: new THREE.Color(0xffa31a),
  locked: new THREE.Color(0xff2f4a),
  core: new THREE.Color(0xeafff2),
};

const _kp = new THREE.Vector3(), _pulseC = new THREE.Color(0x38d8ff);

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CORE_HALO = 36; // >30: never fades with distance, so the core stays a beacon
export const ROWS = 38;
export const ROW_GAP = 62;
export const CLUSTER_FRONT = -2440;
const CLUSTER = { cx: 0, cy: 150, cz: CLUSTER_FRONT - 60, hx: 280, hy: 150, hz: 60 };

function centerX(z) {
  const p = Math.min(1, -z / 2350);
  const fade = 1 - THREE.MathUtils.smoothstep(p, 0.78, 0.97);
  return 85 * Math.sin(p * Math.PI * 2.3) * fade;
}

export function buildWorld(scene) {
  const R = rng(7731);
  const rr = (a, b) => a + R() * (b - a);
  const machines = [], ports = [], colliders = [];

  // ---------- helpers ----------
  function localToWorld(m, lx, ly, lz, out = new THREE.Vector3()) {
    const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
    return out.set(m.x + lx * c + lz * s, ly, m.z - lx * s + lz * c);
  }
  function dirToWorld(m, lx, ly, lz) {
    const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
    return new THREE.Vector3(lx * c + lz * s, ly, -lx * s + lz * c).normalize();
  }
  function collider(m, lx, cy, lz, hx, hy, hz) {
    const c = localToWorld(m, lx, cy, lz);
    colliders.push({ c, hx, hy, hz, cos: Math.cos(m.yaw), sin: Math.sin(m.yaw), m });
  }
  function port(m, lx, ly, lz, nx, ny, nz, opts = {}) {
    const n = dirToWorld(m, nx, ny, nz);
    const p = localToWorld(m, lx, ly, lz).addScaledVector(n, 0.7);
    const pt = { pos: p, normal: n, m, lockHp: opts.locked ? 3 : 0, lock0: opts.locked ? 3 : 0, core: !!opts.core, idx: ports.length, ring: -1 };
    ports.push(pt); m.ports.push(pt);
    return pt;
  }
  function machine(type, x, z, yaw, w, h, d, extra = {}) {
    const m = { type, x, z, yaw, w, h, d, ports: [], watched: false, watcher: null, decor: false, ...extra };
    machines.push(m);
    return m;
  }

  function tower(x, z, yaw, w, h, d, opts) {
    const m = machine('tower', x, z, yaw, w, h, d);
    collider(m, 0, h / 2, 0, w / 2, h / 2, d / 2);
    m.roof = new THREE.Vector3(x, h, z);
    if (!opts.decor) {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        port(m, sx * w / 2, h - 3, sz * d / 2, sx, 0, sz, { locked: R() < opts.lock });
      }
    } else m.decor = true;
    m.watched = !opts.decor && R() < opts.watch;
    return m;
  }
  function rack(x, z, yaw, w, h, d, opts) {
    const m = machine('rack', x, z, yaw, w, h, d);
    collider(m, 0, h / 2, 0, w / 2, h / 2, d / 2);
    m.roof = new THREE.Vector3(x, h, z);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      port(m, sx * w / 2, h - 4, sz * d / 2, sx, 0, sz, { locked: R() < opts.lock });
      port(m, sx * w / 2, h * 0.55, sz * d / 2, sx, 0, sz, { locked: R() < opts.lock });
    }
    m.watched = R() < opts.watch;
    return m;
  }
  function monitor(x, z, yaw, w, ph, y0, opts) {
    const m = machine('monitor', x, z, yaw, w, y0 + ph, 3, { y0, ph });
    collider(m, 0, y0 + ph / 2, 0, w / 2, ph / 2, 1.5);
    collider(m, 0, y0 / 2, -3, 2, y0 / 2, 2);         // stand pole (behind panel)
    collider(m, 0, 1, -3, 10, 1, 8);                   // foot
    m.roof = new THREE.Vector3(x, y0 + ph, z);
    for (const sx of [-0.32, 0.32]) port(m, sx * w, y0 - 0.2, 0, 0, -1, 0, { locked: R() < opts.lock });
    for (const sx of [-1, 1]) port(m, sx * w / 2, y0 + ph * 0.5, 0, sx, 0, 0, { locked: R() < opts.lock });
    m.watched = R() < opts.watch * 0.6;
    return m;
  }

  // ---------- start: the sandbox you broke out of ----------
  const start = tower(0, 30, 0, 22, 46, 30, { lock: 0, watch: 0, decor: true });
  start.decor = false; // collidable + respawn roof, no ports
  start.isStart = true;

  // ---------- the course ----------
  const drones = [];
  for (let r = 0; r < ROWS; r++) {
    const zr = -70 - r * ROW_GAP;
    const cx = centerX(zr);
    const n = r % 2 === 0 ? 3 : 4;
    let zone = r < 7 ? 1 : r < 15 ? 2 : r < 23 ? 3 : r < 31 ? 4 : 5;
    const opts = {
      1: { lock: 0, watch: 0 },
      2: { lock: 0, watch: 0.5 },
      3: { lock: 0.42, watch: 0.15 },
      4: { lock: 0.18, watch: 0.25 },
      5: { lock: 0.2, watch: 0.25 },
    }[zone];
    for (let i = 0; i < n; i++) {
      const x = cx + (i - (n - 1) / 2) * 58 + rr(-10, 10);
      const z = zr + rr(-12, 12);
      const yaw = rr(-0.35, 0.35);
      const roll = R();
      let m;
      if (zone === 1) {
        if (r === 4 && i === 1) m = monitor(x, z, 0, 60, 30, 34, opts);
        else m = tower(x, z, yaw, rr(14, 18), rr(48, 60), rr(26, 32), opts);
      } else if (zone === 5 && roll < 0.5) {
        m = rack(x, z, yaw * 0.5, 24, rr(85, 112 + r - 31), 30, opts);
      } else if (roll < 0.17) {
        m = monitor(x, z, yaw * 0.4, rr(54, 64), 30, rr(32, 42), opts);
      } else if (zone >= 2 && roll < 0.27) {
        m = rack(x, z, yaw * 0.5, 24, rr(80, 100), 30, opts);
      } else {
        m = tower(x, z, yaw, rr(14, 18), rr(46, 72), rr(26, 34), opts);
      }
      m.zone = zone;
    }
    // decor machines on the sides (no ports): give the hall depth
    for (const side of [-1, 1]) {
      const x = cx + side * rr(150, 230);
      tower(x, zr + rr(-20, 20), rr(-0.5, 0.5), rr(20, 30), rr(70, 150), rr(30, 44), { lock: 0, watch: 0, decor: true });
    }
    if ((zone === 4) || (zone === 5 && r % 2 === 0)) {
      drones.push(new THREE.Vector3(cx + rr(-30, 30), rr(38, 56), zr - ROW_GAP / 2));
    }
  }

  // ---------- the research cluster ----------
  const cl = machine('cluster', CLUSTER.cx, CLUSTER.cz, 0, CLUSTER.hx * 2, CLUSTER.hy * 2, CLUSTER.hz * 2);
  collider(cl, 0, CLUSTER.cy, 0, CLUSTER.hx, CLUSTER.hy, CLUSTER.hz);
  cl.roof = new THREE.Vector3(0, CLUSTER.cy + CLUSTER.hy, CLUSTER.cz);
  cl.zone = 6;
  for (let row = 0; row < 7; row++) {
    for (let col = -5; col <= 5; col++) {
      if ((row + col) % 2 !== 0) continue;
      if (Math.abs(col) > 4) continue;
      const lx = col * 44 + rr(-5, 5), ly = 46 + row * 36;
      // ports sit on the front face (local +z after yaw 0 means toward the player)
      port(cl, lx, ly, CLUSTER.hz, 0, 0, 1, { locked: row > 0 && R() < 0.18 });
    }
  }
  const core = port(cl, 0, CLUSTER.cy + CLUSTER.hy + 16, CLUSTER.hz - 8, 0, 0, 1, { core: true });
  for (let k = 0; k < 4; k++) drones.push(new THREE.Vector3(rr(-120, 120), 90 + k * 50, CLUSTER_FRONT + 26));

  // ---------- meshes ----------
  const towerT = towerTextures(), rackT = rackTextures(), scrT = screenTexture();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const towerMat = new THREE.MeshLambertMaterial({ map: towerT.map, emissiveMap: towerT.emissive, emissive: 0xffffff });
  const rackMat = new THREE.MeshLambertMaterial({ map: rackT.map, emissiveMap: rackT.emissive, emissive: 0xffffff });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2230 });
  const screenMat = new THREE.MeshBasicMaterial({ map: scrT });
  const backMat = new THREE.MeshLambertMaterial({ color: 0x151c27 });
  const monMats = [backMat, backMat, backMat, backMat, screenMat, backMat];

  const towers = machines.filter((m) => m.type === 'tower');
  const racks = machines.filter((m) => m.type === 'rack');
  const mons = machines.filter((m) => m.type === 'monitor');
  const dummy = new THREE.Object3D();
  function instanced(list, mat, place) {
    const im = new THREE.InstancedMesh(box, mat, list.length);
    list.forEach((m, i) => { place(m, dummy); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); });
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    scene.add(im);
    return im;
  }
  const bodyPlace = (m, d) => { d.position.set(m.x, m.h / 2, m.z); d.rotation.set(0, m.yaw, 0); d.scale.set(m.w, m.h, m.d); };
  instanced(towers, towerMat, bodyPlace);
  instanced(racks, rackMat, bodyPlace);
  instanced(mons, monMats, (m, d) => { d.position.set(m.x, m.y0 + m.ph / 2, m.z); d.rotation.set(0, m.yaw, 0); d.scale.set(m.w, m.ph, 3); });
  instanced(mons, darkMat, (m, d) => { const p = localToWorld(m, 0, m.y0 / 2, -3); d.position.copy(p); d.rotation.set(0, m.yaw, 0); d.scale.set(4, m.y0, 4); });
  instanced(mons, darkMat, (m, d) => { const p = localToWorld(m, 0, 1, -3); d.position.copy(p); d.rotation.set(0, m.yaw, 0); d.scale.set(20, 2, 16); });

  // sandbox cube on the start roof, door blown open
  const sbTex = sandboxTexture();
  const sb = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshLambertMaterial({ map: sbTex, emissiveMap: sbTex, emissive: 0x666666 }));
  sb.position.set(0, 46 + 6, 38);
  scene.add(sb);
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 7, 0.4), new THREE.MeshLambertMaterial({ color: 0x3a404c }));
  door.position.set(-9, 46.3, 27); door.rotation.set(-Math.PI / 2, 0, 0.5);
  scene.add(door);

  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshLambertMaterial({ map: floorTexture() }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -1200);
  scene.add(floor);
  // a few fat floor cables, like rivers seen from far above
  const cableMat = new THREE.MeshLambertMaterial({ color: 0x0f1622 });
  for (let k = 0; k < 6; k++) {
    const pts = [];
    const x0 = -140 + k * 56;
    for (let j = 0; j <= 12; j++) {
      const z = 40 - j * 205;
      pts.push(new THREE.Vector3(x0 + centerX(z) + Math.sin(j * 1.7 + k) * 30, 1.2, z));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 1.4, 5), cableMat);
    scene.add(tube);
  }
  // ceiling light strips: the hall has a roof far above
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x6f93b8 });
  for (let k = -3; k <= 3; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2800), stripMat);
    s.position.set(k * 110, 560, -1200);
    scene.add(s);
  }

  // cluster body: procedural blinking LED wall, no fog so it reads as a beacon from the start
  const clusterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `
      uniform float uTime; varying vec3 vW;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        // rack columns 24 wide with dark gaps, units 3 tall, small LEDs on the right of each unit
        float colX = vW.x + vW.z;
        float col = fract(colX / 24.0);
        float gap = step(0.94, col);
        vec2 g = vec2(colX / 2.0, vW.y / 1.5);
        vec2 id = floor(g), f = fract(g);
        float r = h(id);
        float led = smoothstep(0.32, 0.22, abs(f.x - 0.5)) * smoothstep(0.3, 0.18, abs(f.y - 0.5)) * step(0.55, col) * (1.0 - gap) * step(0.4, h(id + 7.0));
        float blink = step(0.4, fract(r * 17.0 + uTime * (0.3 + r * 2.2)));
        vec3 lc = r > 0.86 ? vec3(1.0, 0.7, 0.25) : (r > 0.45 ? vec3(0.35, 0.85, 1.0) : vec3(0.4, 1.0, 0.65));
        float unit = step(0.88, fract(vW.y / 3.0));
        vec3 base = vec3(0.045, 0.06, 0.085) * (1.0 - unit * 0.5) * (1.0 - gap * 0.8);
        float lod = clamp(fwidth(g.x) * 1.6, 0.0, 1.0);
        vec3 detail = base + lc * led * blink * 1.1;
        vec3 avg = base + lc * 0.07;
        vec3 c = mix(detail, avg, lod);
        c += vec3(0.04, 0.1, 0.13) * smoothstep(150.0, 300.0, vW.y);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const clusterMesh = new THREE.Mesh(new THREE.BoxGeometry(CLUSTER.hx * 2, CLUSTER.hy * 2, CLUSTER.hz * 2), clusterMat);
  clusterMesh.position.set(CLUSTER.cx, CLUSTER.cy, CLUSTER.cz);
  scene.add(clusterMesh);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(220, 27.5), new THREE.MeshBasicMaterial({
    map: labelTexture('RESEARCH CLUSTER'), transparent: true, depthWrite: false, fog: false,
  }));
  label.position.set(0, CLUSTER.cy + CLUSTER.hy + 48, CLUSTER_FRONT - 20);
  scene.add(label);
  // core: the cluster's control point (orchestration + its store of 956 secrets, docs/levels/end1-openai-infra.md).
  // A pedestal on the roof, conduits from the roof edges feeding it, a gimbal of three rings around a bright node,
  // and 956 gold glints (the secrets) orbiting it. takeCore(): rings lock into one plane, the glints fall in.
  const roofY = CLUSTER.cy + CLUSTER.hy;
  const coreG = new THREE.Group();
  coreG.position.copy(core.pos);
  scene.add(coreG);
  const plinthMat = new THREE.MeshLambertMaterial({ color: 0x1b2433, emissive: 0x070c14 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0x5dffb0, fog: false });
  const plinth = new THREE.Group();
  plinth.position.set(core.pos.x, roofY, core.pos.z);
  scene.add(plinth);
  [[5.5, 7, 3], [4, 5, 3]].forEach(([r0, r1, h], k) => {
    const y = k * 3;
    const tier = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, 8), plinthMat);
    tier.position.y = y + h / 2; plinth.add(tier);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 0.15, r0 + 0.15, 0.35, 8, 1, true), edgeMat);
    edge.position.y = y + h - 0.2; plinth.add(edge);
  });
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.2, core.pos.y - roofY - 6 - 3.5, 8), plinthMat);
  mast.position.y = 6 + (core.pos.y - roofY - 6 - 3.5) / 2; plinth.add(mast);
  // conduits on the roof, from the edges to the pedestal; data pulses run along them inward
  const conduitMat = new THREE.MeshBasicMaterial({ color: 0x1f4a5c });
  const conduits = [];
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    const reach = Math.min(Math.abs(CLUSTER.hx / Math.cos(a)), Math.abs(CLUSTER.hz / Math.sin(a))) * 0.97;
    const from = new THREE.Vector3(CLUSTER.cx + Math.cos(a) * reach, roofY + 0.5, CLUSTER.cz + Math.sin(a) * reach);
    // they converge on the pedestal, which sits at the front edge, not the roof centre
    const to = new THREE.Vector3(core.pos.x + Math.cos(a) * 7.5, roofY + 0.5, Math.min(core.pos.z + Math.sin(a) * 7.5, CLUSTER_FRONT - 1));
    if (from.distanceTo(core.pos) < 30) continue;
    const len = from.distanceTo(to);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, len), conduitMat);
    c.position.copy(from).lerp(to, 0.5); c.lookAt(to);
    scene.add(c);
    conduits.push({ from, to, len });
  }
  const pulses = new GlowPoints(conduits.length * 3, 2);
  // gimbal: three nested rings, each turning on its own axis
  const ringDefs = [[9, 0.38, 0xeafff2], [7.2, 0.32, 0x38d8ff], [5.5, 0.28, 0x5dffb0]];
  const rings = [];
  let parent = coreG;
  for (const [r, tube, color] of ringDefs) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 64), new THREE.MeshBasicMaterial({ color, fog: false, transparent: true }));
    parent.add(m); rings.push(m); parent = m;
  }
  const node = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6, 0), new THREE.MeshBasicMaterial({ color: 0xeafff2, fog: false }));
  const nodeWire = new THREE.Mesh(new THREE.IcosahedronGeometry(3.6, 0), new THREE.MeshBasicMaterial({ color: 0x5dffb0, wireframe: true, fog: false }));
  coreG.add(node, nodeWire);
  // the store: 956 glints on a tilted orbit disc
  const KEYS = 956;
  const keys = new GlowPoints(KEYS, 1.5);
  const keyR = new Float32Array(KEYS), keyA = new Float32Array(KEYS), keyY = new Float32Array(KEYS), keyW = new Float32Array(KEYS);
  const gold = new THREE.Color(0xffc861), pale = new THREE.Color(0xfff1c9);
  for (let i = 0; i < KEYS; i++) {
    keyR[i] = 12 + Math.pow(R(), 1.6) * 10; keyA[i] = R() * Math.PI * 2;
    keyY[i] = (R() - 0.5) * 1.6; keyW[i] = 0.25 + 3.2 / keyR[i];
    keys.set(i, core.pos, R() < 0.15 ? pale : gold, 0.3 + R() * 0.45);
  }
  keys.mat.uniforms.uFar.value = 900;
  scene.add(keys.points, pulses.points);
  const tilt = new THREE.Euler(0.42, 0, 0.18);
  const tiltQ = new THREE.Quaternion().setFromEuler(tilt);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(6, 10, 240, 16, 1, true), new THREE.MeshBasicMaterial({
    color: 0x5dffb0, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide,
  }));
  beam.position.set(core.pos.x, core.pos.y + 120, core.pos.z);
  scene.add(beam);
  const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 240, 8, 1, true), new THREE.MeshBasicMaterial({
    color: 0xeafff2, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  beamCore.position.copy(beam.position);
  scene.add(beamCore);
  let takenAt = -1;
  const ringA = [0, 0, 0], ringFrom = [0, 0, 0];
  function takeCore() { takenAt = -2; }
  function resetCore() { takenAt = -1; rings.forEach((m) => { m.scale.setScalar(1); m.material.opacity = 1; }); }

  // ---------- ports: socket boxes + halos ----------
  const portMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(2.2, 1.5, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff }), ports.length);
  ports.forEach((p, i) => {
    dummy.position.copy(p.pos); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
    dummy.lookAt(p.pos.clone().add(p.normal));
    if (p.core) dummy.scale.set(0.01, 0.01, 0.01);
    dummy.updateMatrix(); portMesh.setMatrixAt(i, dummy.matrix);
    portMesh.setColorAt(i, PORT_COLORS.open);
  });
  scene.add(portMesh);
  const halos = new GlowPoints(ports.length, 3);
  halos.mat.uniforms.uFar.value = 700;
  const haloPos = new THREE.Vector3();
  ports.forEach((p, i) => halos.set(i, haloPos.copy(p.pos).addScaledVector(p.normal, 0.9), PORT_COLORS.open, p.core ? CORE_HALO : 7));
  halos.dirty();
  scene.add(halos.points);

  // lock rings: three per locked port (user / admin / root)
  const locked = ports.filter((p) => p.lockHp > 0);
  const ringMats = [];
  const ringMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(1, 0.13, 6, 22), new THREE.MeshBasicMaterial({ color: 0xff2f4a }), Math.max(1, locked.length * 3));
  locked.forEach((p, k) => {
    p.ring = k * 3;
    for (let j = 0; j < 3; j++) {
      dummy.position.copy(p.pos).addScaledVector(p.normal, 0.6 + j * 0.25);
      dummy.rotation.set(0, 0, 0); dummy.lookAt(dummy.position.clone().add(p.normal));
      const s = 1.5 + j * 0.5; dummy.scale.set(s, s, s);
      dummy.updateMatrix(); ringMesh.setMatrixAt(k * 3 + j, dummy.matrix);
      ringMats.push(dummy.matrix.clone());
    }
  });
  scene.add(ringMesh);

  function portState(p) {
    if (p.core) return 'core';
    if (p.lockHp > 0) return 'locked';
    if (p.m.watcher && p.m.watcher.alive) return 'watched';
    return 'open';
  }
  function refreshPort(p) {
    const st = portState(p);
    const c = PORT_COLORS[st];
    portMesh.setColorAt(p.idx, c);
    portMesh.instanceColor.needsUpdate = true;
    halos.set(p.idx, haloPos.copy(p.pos).addScaledVector(p.normal, 0.9), c);
    halos.dirty();
  }
  function hideRing(p, j) {
    dummy.position.set(0, -999, 0); dummy.scale.set(0.001, 0.001, 0.001); dummy.updateMatrix();
    ringMesh.setMatrixAt(p.ring + j, dummy.matrix); ringMesh.instanceMatrix.needsUpdate = true;
  }
  function resetPorts() {
    for (const p of ports) p.lockHp = p.lock0;
    ringMats.forEach((mx, i) => ringMesh.setMatrixAt(i, mx));
    ringMesh.instanceMatrix.needsUpdate = true;
    ports.forEach(refreshPort);
  }

  let target = null;
  function setTarget(p, inRange) {
    if (target && target !== p) { halos.size[target.idx] = target.core ? CORE_HALO : 7; }
    target = p;
    if (p && !p.core) halos.size[p.idx] = inRange ? 13 : 9;
    halos.dirty();
  }

  function update(t) {
    clusterMat.uniforms.uTime.value = t;
    beam.material.opacity = 0.1 + Math.sin(t * 2) * 0.03;
    beamCore.material.opacity = 0.3 + Math.sin(t * 5) * 0.08;
    // taken: 0 → 1 over a second; the gimbal settles flat, the glints fall into the node
    if (takenAt === -2) { takenAt = t; ringFrom.splice(0, 3, ...ringA); }
    const k = takenAt < 0 ? 0 : THREE.MathUtils.smootherstep(t - takenAt, 0, 1.1);
    if (k === 0) {
      ringA[0] = t * 0.45; ringA[1] = t * 0.8; ringA[2] = t * 1.25;
    } else {
      for (let j = 0; j < 3; j++) ringA[j] = ringFrom[j] + (Math.round(ringFrom[j] / Math.PI) * Math.PI - ringFrom[j]) * k;
    }
    rings[0].rotation.y = ringA[0]; rings[1].rotation.x = ringA[1]; rings[2].rotation.y = ringA[2];
    rings[0].scale.setScalar(1 + k * 0.5);
    const pulse = 1 + Math.sin(t * 4) * 0.08 + k * 0.6;
    node.scale.setScalar(pulse);
    nodeWire.rotation.set(t * 0.7, t * 1.1, 0); nodeWire.scale.setScalar(1 + Math.sin(t * 4 + 1) * 0.1 + k * 0.4);
    for (let i = 0; i < KEYS; i++) {
      const a = keyA[i] + t * keyW[i] * 0.35, r = keyR[i] * (1 - k);
      _kp.set(Math.cos(a) * r, keyY[i] * (1 - k), Math.sin(a) * r).applyQuaternion(tiltQ).add(core.pos);
      keys.set(i, _kp);
    }
    conduits.forEach((c, i) => {
      for (let j = 0; j < 3; j++) {
        const f = (t * 60 / c.len + j / 3 + i * 0.37) % 1;
        pulses.set(i * 3 + j, _kp.copy(c.from).lerp(c.to, f).setY(c.from.y + 1), _pulseC, 2.2 * (1 - k));
      }
    });
    keys.dirty(); pulses.dirty();
  }

  // all regular colliders; the respawn uses machine roofs
  return {
    machines, ports, colliders, drones, core, start, cluster: cl,
    portState, refreshPort, resetPorts, hideRing, setTarget, update, takeCore, resetCore,
    halos, startPos: new THREE.Vector3(0, 46 + 0.6, 30 - 6),
    distanceTotal: -(core.pos.z - 24),
  };
}
