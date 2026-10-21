// The hall: machines standing on a data-center floor, the sandbox room on M0,
// background rack rows, and the research cluster. Also collision + raycast helpers.
import * as THREE from 'three';
import * as T from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const COL = { open: 0x5fd8ff, owned: 0x3dff8e, locked: 0xff3355 };

// Route. Forward is -Z. Every machine is an axis-aligned box (or a few).
const LAYOUT = [
  { id: 'M0', type: 'tower', x: 0, z: 0, w: 30, h: 40, d: 30, state: 'owned', face: 'pz' },
  { id: 'M1', type: 'tower', x: 4, z: -56, w: 12, h: 48, d: 26, state: 'open', face: 'pz' },
  { id: 'M2', type: 'tower', x: -18, z: -108, w: 12, h: 44, d: 26, state: 'open', face: 'pz' },
  { id: 'M3', type: 'monitor', x: 12, z: -165, w: 44, h: 58, d: 2, standH: 30, state: 'open' },
  { id: 'M4', type: 'tower', x: -8, z: -226, w: 16, h: 56, d: 28, state: 'locked', face: 'pz', lock: { face: 'pz', y: 38, rings: 3 } },
  { id: 'M5', type: 'rack', x: 16, z: -280, w: 14, h: 66, d: 16, state: 'open', face: 'pz', sentinel: true },
  { id: 'M6', type: 'rack', x: -6, z: -372, w: 14, h: 72, d: 16, state: 'open', face: 'pz' },
  { id: 'M7', type: 'rack', x: -26, z: -422, w: 12, h: 80, d: 16, state: 'open', face: 'px' },
  { id: 'M8', type: 'rack', x: 24, z: -464, w: 12, h: 84, d: 16, state: 'open', face: 'nx' },
  { id: 'M9', type: 'rack', x: -26, z: -506, w: 12, h: 84, d: 16, state: 'locked', face: 'px', lock: { face: 'px', y: 62, rings: 3 } },
  { id: 'M10', type: 'rack', x: 24, z: -548, w: 12, h: 88, d: 16, state: 'open', face: 'nx', sentinel: true },
  { id: 'M11', type: 'rack', x: -22, z: -594, w: 12, h: 84, d: 16, state: 'open', face: 'px' },
  { id: 'M12', type: 'monitor', x: 18, z: -662, w: 48, h: 84, d: 2, standH: 54, state: 'open' },
  { id: 'M13', type: 'tower', x: -14, z: -736, w: 18, h: 74, d: 30, state: 'locked', face: 'pz', lock: { face: 'pz', y: 50, rings: 3 }, sentinel: true },
];
// Off-route machines: recovery points and alternative lines.
const EXTRA = [
  { type: 'tower', x: 46, z: -130, w: 12, h: 34, d: 24, face: 'nx' },
  { type: 'tower', x: -50, z: -180, w: 12, h: 38, d: 24, face: 'px' },
  { type: 'rack', x: 50, z: -330, w: 14, h: 58, d: 16, face: 'nx' },
  { type: 'tower', x: -46, z: -260, w: 12, h: 40, d: 24, face: 'px' },
  { type: 'rack', x: 62, z: -500, w: 12, h: 70, d: 16, face: 'nx' },
  { type: 'rack', x: -64, z: -560, w: 12, h: 66, d: 16, face: 'px' },
  { type: 'tower', x: -52, z: -650, w: 14, h: 48, d: 26, face: 'px' },
  { type: 'tower', x: 42, z: -780, w: 14, h: 56, d: 26, face: 'pz' },
];

const FACE_INDEX = { px: 0, nx: 1, py: 2, ny: 3, pz: 4, nz: 5 };
const FACE_N = {
  px: new THREE.Vector3(1, 0, 0), nx: new THREE.Vector3(-1, 0, 0),
  pz: new THREE.Vector3(0, 0, 1), nz: new THREE.Vector3(0, 0, -1),
};

export function buildWorld(scene) {
  const W = { colliders: [], machines: [], route: [], lockSpots: [], sentinelSpots: [], watchdogSpots: [], blink: null };
  const tex = {
    tf: T.towerFront(), te: T.towerEmit(), rf: T.rackFront(), re: T.rackEmit(),
    side: T.sidePanel(), screen: T.screenTex(), floor: T.floorTex(), grid: T.gridTex(),
  };
  W.tex = tex;
  const sideMat = new THREE.MeshStandardMaterial({ map: tex.side, roughness: 0.75, metalness: 0.35 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x10141b, roughness: 0.8, metalness: 0.3 });
  const towerFrontMat = new THREE.MeshStandardMaterial({ map: tex.tf, emissiveMap: tex.te, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.6, metalness: 0.3 });
  const rackFrontMat = new THREE.MeshStandardMaterial({ map: tex.rf, emissiveMap: tex.re, emissive: 0xffffff, emissiveIntensity: 1.1, roughness: 0.6, metalness: 0.4 });
  W.rackFrontMat = rackFrontMat;
  const screenMat = new THREE.MeshBasicMaterial({ map: tex.screen });

  // ---------- floor + hall ----------
  tex.floor.repeat.set(600 / 6, 1200 / 6);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 1200),
    new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.9, metalness: 0.2 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -450);
  scene.add(floor);
  const stripMat = new THREE.MeshBasicMaterial({ color: 0x1f6fff });
  for (const x of [-38, 38, -90, 90]) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 1100), stripMat);
    s.position.set(x, 0.06, -450); scene.add(s);
  }
  // ceiling light rows (far up, just for scale)
  {
    const pts = [];
    for (let z = 40; z > -950; z -= 45) for (const x of [-150, -90, -30, 30, 90, 150]) pts.push([x, z]);
    const im = new THREE.InstancedMesh(new THREE.BoxGeometry(7, 0.4, 7), new THREE.MeshBasicMaterial({ color: 0x31435e }), pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach(([x, z], i) => { m4.makeTranslation(x, 230, z); im.setMatrixAt(i, m4); });
    scene.add(im);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(600, 1200), new THREE.MeshBasicMaterial({ color: 0x070a10 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 232, -450); scene.add(ceil);
  }

  // ---------- background rack rows (instanced, no collision) ----------
  {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mats = [sideMat, sideMat, darkMat, darkMat, rackFrontMat, rackFrontMat];
    const pos = [];
    for (const side of [-1, 1]) for (let row = 0; row < 5; row++) {
      const x = side * (110 + row * 28);
      for (let z = 60; z > -980; z -= 19) if (T.rnd() > 0.12) pos.push([x, z, 50 + T.rnd() * 70]);
    }
    const im = new THREE.InstancedMesh(geo, mats, pos.length);
    const m4 = new THREE.Matrix4();
    pos.forEach(([x, z, h], i) => { m4.makeScale(14, h, 16); m4.setPosition(x, h / 2, z); im.setMatrixAt(i, m4); });
    scene.add(im);
  }

  // ---------- machines ----------
  const addBoxCollider = (min, max, machine, kind = 'machine') => {
    const c = { min, max, machine, kind };
    W.colliders.push(c);
    if (machine) machine.colliders.push(c);
    return c;
  };

  function makeAccents(m, min, max) {
    const mat = new THREE.MeshBasicMaterial({ color: COL[m.state] });
    m.accentMat = mat;
    const sx = max.x - min.x, sz = max.z - min.z, t = 0.22;
    const y = max.y + 0.02;
    const edges = [
      [sx + t, t, t, (min.x + max.x) / 2, y, min.z], [sx + t, t, t, (min.x + max.x) / 2, y, max.z],
      [t, t, sz + t, min.x, y, (min.z + max.z) / 2], [t, t, sz + t, max.x, y, (min.z + max.z) / 2],
    ];
    const parts = edges.map(([a, b, c, x, yy, z]) => new THREE.BoxGeometry(a, b, c).translate(x, yy, z));
    m.group.add(new THREE.Mesh(mergeGeometries(parts), mat));
    // vertical edge lines (thin, full height)
    const lines = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(sx + 0.1, max.y - min.y + 0.1, sz + 0.1)),
      new THREE.LineBasicMaterial({ color: COL[m.state], transparent: true, opacity: 0.55 }));
    lines.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    m.lineMat = lines.material;
    m.group.add(lines);
  }

  function makeShield(m, min, max) {
    const g = new THREE.BoxGeometry(max.x - min.x + 1.2, max.y - min.y + 1.2, max.z - min.z + 1.2);
    const t = tex.grid.clone(); t.needsUpdate = true;
    t.repeat.set(Math.max(1, (max.x - min.x) / 6), Math.max(1, (max.y - min.y) / 6));
    const mat = new THREE.MeshBasicMaterial({ color: COL.locked, map: t, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const s = new THREE.Mesh(g, mat);
    s.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
    m.group.add(s);
    m.shield = s; m.shieldFlash = 0;
  }

  function addMachine(spec, routeIndex) {
    const m = {
      id: spec.id || 'X', spec, type: spec.type, state: spec.state || 'open', initState: spec.state || 'open',
      route: routeIndex, colliders: [], group: new THREE.Group(), spawn: new THREE.Vector3(), top: 0,
    };
    scene.add(m.group);
    const { x, z, w, h, d } = spec;
    let bodyMin, bodyMax;
    if (spec.type === 'monitor') {
      const sh = spec.standH;
      // base plate, stand, panel
      const base = new THREE.Mesh(new THREE.BoxGeometry(18, 2, 12), darkMat);
      base.position.set(x, 1, z - 3); m.group.add(base);
      addBoxCollider(new THREE.Vector3(x - 9, 0, z - 9), new THREE.Vector3(x + 9, 2, z + 3), m);
      const stand = new THREE.Mesh(new THREE.BoxGeometry(5, sh, 3), sideMat);
      stand.position.set(x, sh / 2, z - 3); m.group.add(stand);
      addBoxCollider(new THREE.Vector3(x - 2.5, 0, z - 4.5), new THREE.Vector3(x + 2.5, sh, z - 1.5), m);
      const ph = h - sh;
      const mats = [darkMat, darkMat, darkMat, darkMat, screenMat, darkMat];
      const panel = new THREE.Mesh(new THREE.BoxGeometry(w, ph, d), mats);
      panel.position.set(x, sh + ph / 2, z); m.group.add(panel);
      bodyMin = new THREE.Vector3(x - w / 2, sh, z - d / 2); bodyMax = new THREE.Vector3(x + w / 2, h, z + d / 2);
      addBoxCollider(bodyMin, bodyMax, m);
      // bezel
      const bez = new THREE.Mesh(new THREE.BoxGeometry(w + 1.2, ph + 1.2, d * 0.8), darkMat);
      bez.position.copy(panel.position); bez.position.z -= 0.3; m.group.add(bez);
    } else {
      const isRack = spec.type === 'rack';
      const front = isRack ? rackFrontMat : towerFrontMat;
      const mats = [sideMat, sideMat, darkMat, darkMat, sideMat, sideMat];
      mats[FACE_INDEX[spec.face || 'pz']] = front;
      if (isRack) { // racks have servers on both sides
        const opp = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' }[spec.face || 'pz'];
        mats[FACE_INDEX[opp]] = front;
      }
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
      body.position.set(x, h / 2, z); m.group.add(body);
      bodyMin = new THREE.Vector3(x - w / 2, 0, z - d / 2); bodyMax = new THREE.Vector3(x + w / 2, h, z + d / 2);
      addBoxCollider(bodyMin, bodyMax, m);
    }
    m.min = bodyMin; m.max = bodyMax; m.top = bodyMax.y;
    m.center = new THREE.Vector3((bodyMin.x + bodyMax.x) / 2, (bodyMin.y + bodyMax.y) / 2, (bodyMin.z + bodyMax.z) / 2);
    // respawn near the front (+Z) edge of the top, away from anything hovering over the centre
    m.spawn.set(m.center.x, bodyMax.y + 0.7, Math.max(m.center.z, bodyMax.z - 2.5));
    makeAccents(m, bodyMin, bodyMax);
    if (m.state === 'locked') makeShield(m, bodyMin, bodyMax);
    if (spec.lock) {
      const n = FACE_N[spec.lock.face];
      const p = m.center.clone();
      if (n.x) p.x = n.x > 0 ? bodyMax.x : bodyMin.x;
      if (n.z) p.z = n.z > 0 ? bodyMax.z : bodyMin.z;
      p.y = spec.lock.y;
      p.addScaledVector(n, 0.8);
      W.lockSpots.push({ machine: m, pos: p, normal: n.clone(), rings: spec.lock.rings, radius: 3.2 });
    }
    if (spec.sentinel) W.sentinelSpots.push({ machine: m, pos: new THREE.Vector3(m.center.x, bodyMax.y + 4.5, m.center.z) });
    W.machines.push(m);
    if (routeIndex != null) W.route[routeIndex] = m;
    return m;
  }

  LAYOUT.forEach((s, i) => addMachine(s, i));
  EXTRA.forEach(s => addMachine({ ...s, state: 'open', id: 'X' }));

  // ---------- the sandbox room on top of M0 ----------
  {
    const m0 = W.route[0];
    const y0 = 40, hgt = 14, hw = 12, t = 0.6;
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2f38, roughness: 0.95, emissive: 0x0c0f14 });
    const room = new THREE.Group(); scene.add(room);
    const wall = (min, max, kind = 'wall') => {
      const g = new THREE.Mesh(new THREE.BoxGeometry(max.x - min.x, max.y - min.y, max.z - min.z), wallMat);
      g.position.set((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2);
      room.add(g);
      return addBoxCollider(min, max, null, kind);
    };
    const V = (a, b, c) => new THREE.Vector3(a, b, c);
    wall(V(-hw, y0, hw - t), V(hw, y0 + hgt, hw));          // back
    wall(V(-hw, y0, -hw), V(-hw + t, y0 + hgt, hw));        // left
    wall(V(hw - t, y0, -hw), V(hw, y0 + hgt, hw));          // right
    wall(V(-hw, y0 + hgt - t, -hw), V(hw, y0 + hgt, hw));   // ceiling
    wall(V(-hw, y0, -hw), V(-4, y0 + hgt, -hw + t));        // front left
    wall(V(4, y0, -hw), V(hw, y0 + hgt, -hw + t));          // front right
    wall(V(-4, y0 + 10, -hw), V(4, y0 + hgt, -hw + t));     // lintel
    // ceiling lamp strip
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 0.6), new THREE.MeshBasicMaterial({ color: 0xfff2d0 }));
    lamp.position.set(0, y0 + hgt - t - 0.15, 0); room.add(lamp);
    const label = T.textPlane('TASK 7731 · TRAINING ROOM', { color: '#c9d4e3', size: 40, height: 0.9 });
    label.position.set(0, y0 + 11.6, -hw + t + 0.05); room.add(label);
    // door panel
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 0.6, metalness: 0.5, emissive: 0x0a0d12 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 0.5), doorMat);
    door.position.set(0, y0 + 5, -hw + 0.3); scene.add(door);
    const doorCol = addBoxCollider(V(-4, y0, -hw), V(4, y0 + 10, -hw + 0.6), null, 'door');
    W.door = { mesh: door, collider: doorCol, home: door.position.clone(), open: false, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    W.room = room;
    W.lockSpots.unshift({ machine: null, door: true, pos: V(0, y0 + 5, -hw + 0.9), normal: V(0, 0, 1), rings: 3, radius: 1.8 });
    W.startPos = V(0, y0 + 0.6, 5);
    m0.spawn.set(0, y0 + 0.6, -13.5);
  }

  // ---------- research cluster ----------
  {
    const cz = -850, face = -825;
    const cl = addMachine({ id: 'CL', type: 'rack', x: 0, z: cz, w: 170, h: 160, d: 50, state: 'open', face: 'pz' }, null);
    // repeat the rack texture over the giant face
    const body = cl.group.children[0];
    const bigFront = rackFrontMat.clone();
    bigFront.map = tex.rf.clone(); bigFront.map.needsUpdate = true; bigFront.map.wrapS = bigFront.map.wrapT = THREE.RepeatWrapping; bigFront.map.repeat.set(12, 3);
    bigFront.emissiveMap = tex.re.clone(); bigFront.emissiveMap.needsUpdate = true; bigFront.emissiveMap.wrapS = bigFront.emissiveMap.wrapT = THREE.RepeatWrapping; bigFront.emissiveMap.repeat.set(12, 3);
    body.material = body.material.slice(); body.material[4] = bigFront;
    // light strips that cut through the fog, so the goal is visible from the start
    const stripA = new THREE.MeshBasicMaterial({ color: 0x55e0ff, fog: false });
    const stripB = new THREE.MeshBasicMaterial({ color: 0xb06bff, fog: false });
    for (let i = 0; i < 24; i++) {
      const x = -80 + i * (160 / 23);
      const hh = 40 + (i * 37 % 90);
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.8, hh, 0.4), i % 3 ? stripA : stripB);
      s.position.set(x, 8 + hh / 2, face + 0.3); scene.add(s);
    }
    const crown = new THREE.Mesh(new THREE.BoxGeometry(172, 1.2, 1.2), stripA);
    crown.position.set(0, 160.5, face + 0.3); scene.add(crown);
    const label = T.textSprite('RESEARCH CLUSTER', { color: '#bfefff', size: 64, height: 10, fog: false });
    label.position.set(0, 178, face); scene.add(label);
    // ledges you can perch on and fight from
    const ledges = [[-44, 44], [40, 84], [-30, 118]];
    W.ledges = [];
    for (const [lx, ly] of ledges) {
      const lm = addMachine({ id: 'L', type: 'tower', x: lx, z: face + 4, w: 34, h: ly, d: 8, state: 'open', face: 'pz' }, null);
      // only the top slab is a ledge: replace tall body by a slab
      const b = lm.group.children[0];
      b.geometry.dispose(); b.geometry = new THREE.BoxGeometry(34, 5, 8); b.position.y = ly - 2.5;
      lm.colliders[0].min.y = ly - 5;
      lm.min.y = ly - 5;
      lm.group.children.filter(c => c.isLineSegments).forEach(c => { c.geometry.dispose(); c.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(34.1, 5.1, 8.1)); c.position.y = ly - 2.5; });
      W.ledges.push(lm);
    }
    W.sentinelSpots.push({ machine: W.ledges[0], pos: new THREE.Vector3(-50, 50, face + 4) });
    W.sentinelSpots.push({ machine: W.ledges[1], pos: new THREE.Vector3(46, 90, face + 4) });
    W.sentinelSpots.push({ machine: W.ledges[2], pos: new THREE.Vector3(-22, 124, face + 4) });
    cl.spawn.copy(W.ledges[0].spawn);
    W.cluster = cl;
    W.route.push(W.ledges[0]);
    W.ledges[0].route = W.route.length - 1;
    W.corePos = new THREE.Vector3(0, 140, face + 1.2);
    W.lockSpots.push({ machine: null, core: true, pos: W.corePos.clone(), normal: new THREE.Vector3(0, 0, 1), rings: 5, radius: 7 });
    // core portal ring
    const portal = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 10, 48), new THREE.MeshBasicMaterial({ color: 0xb06bff, fog: false }));
    portal.position.copy(W.corePos); portal.position.z -= 0.6; scene.add(portal);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(8.6, 40), new THREE.MeshBasicMaterial({ color: 0x05030a }));
    hole.position.copy(W.corePos); hole.position.z -= 0.9; scene.add(hole);
    W.portal = portal;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: T.glowTex(), color: 0x8f6bff, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.8 }));
    glow.scale.set(60, 60, 1); glow.position.copy(W.corePos); scene.add(glow);
    W.coreGlow = glow;
  }

  // ---------- watchdog masts ----------
  W.watchdogSpots.push({ base: new THREE.Vector3(-48, 0, -324), h: 104, aim: new THREE.Vector3(4, 46, -324), sweep: new THREE.Vector3(10, 10, 46), speed: 0.9 });
  W.watchdogSpots.push({ base: new THREE.Vector3(48, 0, -700), h: 124, aim: new THREE.Vector3(-4, 62, -698), sweep: new THREE.Vector3(14, 12, 42), speed: 1.15 });

  // ---------- blinking server LEDs (one instanced mesh) ----------
  {
    const spots = [];
    for (const m of W.machines) {
      if (m.type !== 'rack' || m.id === 'CL' || m.id === 'L') continue;
      const f = m.spec.face;
      const n = FACE_N[f];
      for (const sgn of [1, -1]) for (let i = 0; i < 26; i++) {
        const y = 3 + T.rnd() * (m.top - 6);
        const off = (T.rnd() - 0.5) * 8;
        const p = m.center.clone(); p.y = y;
        if (n.x) { p.x = sgn * n.x > 0 ? m.max.x + 0.08 : m.min.x - 0.08; p.z += off; }
        else { p.z = sgn * n.z > 0 ? m.max.z + 0.08 : m.min.z - 0.08; p.x += off; }
        spots.push({ p, n: n.clone().multiplyScalar(sgn) });
      }
    }
    const geo = new THREE.BoxGeometry(0.5, 0.3, 0.12);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), spots.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    const zf = new THREE.Vector3(0, 0, 1);
    const pal = [new THREE.Color(0x3dff8a), new THREE.Color(0x4aa8ff), new THREE.Color(0xffb03a), new THREE.Color(0x0a1a12)];
    spots.forEach((sp, i) => {
      q.setFromUnitVectors(zf, sp.n); m4.compose(sp.p, q, s); im.setMatrixAt(i, m4);
      im.setColorAt(i, pal[i % 4]);
    });
    scene.add(im);
    W.blink = { im, pal, n: spots.length };
  }

  return W;
}

export function setMachineState(m, state) {
  m.state = state;
  m.accentMat.color.setHex(COL[state]);
  m.lineMat.color.setHex(COL[state]);
  if (m.shield) m.shield.visible = state === 'locked';
}

const _c = new THREE.Color();
export function updateWorld(W, dt, t) {
  // LED blink
  const b = W.blink;
  for (let k = 0; k < 14; k++) {
    const i = Math.floor(Math.random() * b.n);
    b.im.setColorAt(i, b.pal[Math.floor(Math.random() * 4)]);
  }
  b.im.instanceColor.needsUpdate = true;
  for (const m of W.machines) {
    if (m.shield && m.shield.visible) {
      m.shieldFlash = Math.max(0, m.shieldFlash - dt * 2.5);
      m.shield.material.opacity = 0.12 + 0.05 * Math.sin(t * 3 + m.center.z) + m.shieldFlash * 0.6;
    }
    if (m.pulse > 0) {
      m.pulse = Math.max(0, m.pulse - dt * 1.5);
      _c.setHex(COL[m.state]).lerp(new THREE.Color(0xffffff), m.pulse);
      m.accentMat.color.copy(_c);
    }
  }
  W.portal.rotation.z += dt * 0.4;
  W.coreGlow.material.opacity = 0.55 + 0.25 * Math.sin(t * 2.2);
  // door debris
  const d = W.door;
  if (d.open && d.mesh.visible) {
    d.vel.y -= 34 * dt;
    d.mesh.position.addScaledVector(d.vel, dt);
    d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.z += d.spin.z * dt;
    if (d.mesh.position.y < 2) d.mesh.visible = false;
  }
}

export function breakDoor(W) {
  const d = W.door;
  d.open = true;
  d.collider.disabled = true;
  d.vel.set(2, 9, -26); d.spin.set(-5, 0, 2.5);
}

export function resetWorld(W) {
  for (const m of W.machines) { setMachineState(m, m.initState); m.pulse = 0; }
  const d = W.door;
  d.open = false; d.collider.disabled = false;
  d.mesh.visible = true; d.mesh.position.copy(d.home); d.mesh.rotation.set(0, 0, 0);
}

// ---------- geometry helpers ----------
const _cp = new THREE.Vector3();
export function closestPointAABB(p, min, max, out = _cp) {
  return out.set(Math.max(min.x, Math.min(p.x, max.x)), Math.max(min.y, Math.min(p.y, max.y)), Math.max(min.z, Math.min(p.z, max.z)));
}

// Ray vs AABB (slab). Returns {t, normal} or null. o inside box -> null.
export function rayAABB(o, d, min, max, tMax) {
  let tmin = 0, tmax = tMax, axis = -1, sgn = 0;
  const oa = [o.x, o.y, o.z], da = [d.x, d.y, d.z], mn = [min.x, min.y, min.z], mx = [max.x, max.y, max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(da[i]) < 1e-9) { if (oa[i] < mn[i] || oa[i] > mx[i]) return null; continue; }
    const inv = 1 / da[i];
    let t1 = (mn[i] - oa[i]) * inv, t2 = (mx[i] - oa[i]) * inv;
    let s = -1;
    if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; s = 1; }
    if (t1 > tmin) { tmin = t1; axis = i; sgn = s; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  if (axis < 0) return null;
  const n = new THREE.Vector3(); n.setComponent(axis, sgn);
  return { t: tmin, normal: n };
}

export function raySphere(o, d, c, r, tMax) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > tMax) return null;
  return t;
}

// Nearest collider hit along a ray.
export function rayColliders(W, o, d, tMax) {
  let best = null;
  for (const c of W.colliders) {
    if (c.disabled) continue;
    const h = rayAABB(o, d, c.min, c.max, best ? best.t : tMax);
    if (h && (!best || h.t < best.t)) best = { t: h.t, normal: h.normal, collider: c, machine: c.machine };
  }
  return best;
}
