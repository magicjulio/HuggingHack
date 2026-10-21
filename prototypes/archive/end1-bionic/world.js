// World: a dark machine hall seen from a tiny agent's point of view.
// Builds the hosts (computers), their ports (link anchors), vents, decor,
// and the research cluster. Also owns collision boxes and raycasts.
import * as THREE from 'three';
const V = THREE.Vector3;

export const KINDS = {
  mini:  { W: 14,   H: 6,  D: 14 },
  tower: { W: 9,    H: 22, D: 20 },
  ws:    { W: 12,   H: 30, D: 24 },
  rack:  { W: 24.2, H: 80, D: 36 },
};

export const PORT_COLORS = {
  open:    new THREE.Color(0x39e8ff),
  locked:  new THREE.Color(0xff2d55),
  root:    new THREE.Color(0xffc23d),
  latched: new THREE.Color(0xffffff),
  final:   new THREE.Color(0xa6ff6a),
};

const FACES = {
  '+x': { n: new V(1, 0, 0),  mi: 0 },
  '-x': { n: new V(-1, 0, 0), mi: 1 },
  '+z': { n: new V(0, 0, 1),  mi: 4 },
  '-z': { n: new V(0, 0, -1), mi: 5 },
};

// ---------- procedural textures ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function toTex(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function pair(wu, hu, draw, seed, ppu) {
  const w = Math.max(32, Math.min(1024, Math.round(wu * ppu)));
  const h = Math.max(32, Math.min(1024, Math.round(hu * ppu)));
  const out = {};
  for (const emi of [false, true]) {
    const c = mkCanvas(w, h);
    draw(c.getContext('2d'), w, h, emi, rng(seed));
    out[emi ? 'emi' : 'map'] = toTex(c);
  }
  return out;
}

const LEDC = ['#3dff7a', '#3dff7a', '#45b6ff', '#ffb43d', '#3dff7a'];

function drawSide(g, w, h, emi, r) {
  if (emi) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return; }
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2a2f39'); gr.addColorStop(1, '#171a20');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w; i += 2) { g.fillStyle = `rgba(255,255,255,${r() * 0.03})`; g.fillRect(i, 0, 1, h); }
  g.fillStyle = '#0c0e12';
  const vx = w * 0.12, vy = h * 0.08, vw = w * 0.76, vh = h * 0.22;
  for (let y = vy; y < vy + vh; y += 8) for (let x = vx; x < vx + vw; x += 16) g.fillRect(x, y, 11, 3);
  g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 3; g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = '#3a404b';
  for (const [x, y] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); }
}

function drawTop(g, w, h, emi) {
  if (emi) { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); return; }
  g.fillStyle = '#1c1f26'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#101216';
  for (let y = h * 0.15; y < h * 0.85; y += 6) for (let x = w * 0.15; x < w * 0.85; x += 6) g.fillRect(x + ((y / 6) % 2) * 3, y, 3, 3);
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6);
}

function drawTowerFront(g, w, h, emi) {
  if (!emi) {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#242933'); gr.addColorStop(1, '#13161b');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0a0b0e'; g.fillRect(w * 0.06, h * 0.015, w * 0.88, h * 0.105);   // top I/O band (ports live here)
    g.fillStyle = '#1b1f26';
    for (let i = 0; i < 3; i++) g.fillRect(w * 0.1, h * (0.17 + i * 0.045), w * 0.8, h * 0.035);
    g.fillStyle = '#08090b';
    for (let y = h * 0.36; y < h * 0.96; y += 6) for (let x = w * 0.12; x < w * 0.88; x += 6) g.fillRect(x + ((y / 6) % 2) * 3, y, 3, 3);
    g.strokeStyle = 'rgba(255,255,255,0.09)'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); }
  g.beginPath(); g.arc(w * 0.5, h * 0.145, Math.max(4, w * 0.05), 0, 7);
  g.lineWidth = 3; g.strokeStyle = emi ? '#8fd0ff' : '#333a46'; g.stroke();
  g.fillStyle = emi ? '#2f7dff' : '#1d2230'; g.fillRect(w * 0.035, h * 0.16, 3, h * 0.8);
}

function drawRackFront(g, w, h, emi, r) {
  g.fillStyle = emi ? '#000' : '#0b0d11'; g.fillRect(0, 0, w, h);
  const px = w * 0.07;
  if (!emi) {
    g.fillStyle = '#1a1d23'; g.fillRect(0, 0, px, h); g.fillRect(w - px, 0, px, h);
    g.fillStyle = '#07080a';
    for (let y = 6; y < h; y += 10) { g.fillRect(px * 0.35, y, px * 0.3, 4); g.fillRect(w - px * 0.65, y, px * 0.3, 4); }
  }
  const U = h / 40; let y = U * 0.4;
  const x0 = px + 2, x1 = w - px - 2;
  while (y < h - U) {
    const a = r(), b = r(), c = r();
    const n = a < 0.55 ? 1 : a < 0.85 ? 2 : 4;
    const uh = n * U - 1;
    const blank = b < 0.1;
    if (!emi) {
      g.fillStyle = blank ? '#060708' : (c < 0.5 ? '#1f232b' : '#282d37');
      g.fillRect(x0, y, x1 - x0, uh);
      if (!blank) {
        g.fillStyle = '#0d0f13';
        for (let vx = x0 + w * 0.2; vx < x1 - w * 0.28; vx += 5) g.fillRect(vx, y + uh * 0.25, 2, uh * 0.5);
        g.fillStyle = '#3a404c'; g.fillRect(x0 + 3, y + 2, 3, uh - 4); g.fillRect(x1 - 6, y + 2, 3, uh - 4);
      }
    }
    const leds = 2 + Math.floor(r() * 4);
    for (let i = 0; i < leds; i++) {
      const col = LEDC[Math.floor(r() * LEDC.length)];
      const on = r() < 0.8;
      if (blank) continue;
      const lx = x1 - w * 0.1 - i * 7;
      g.fillStyle = emi ? (on ? col : '#000') : (on ? col : '#1a1a1a');
      g.fillRect(lx, y + uh * 0.5 - 1.5, 3, 3);
    }
    y += uh + 1;
  }
}

function drawFloor(g, w, h) {
  g.fillStyle = '#171a21'; g.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.025})`; g.fillRect(r() * w, r() * h, 2, 2); }
  g.strokeStyle = '#0a0c10'; g.lineWidth = 4; g.strokeRect(0, 0, w, h);
  g.strokeStyle = 'rgba(120,150,200,0.06)'; g.lineWidth = 2; g.strokeRect(5, 5, w - 10, h - 10);
}

function drawScreen(g, w, h, emi, r) {
  g.fillStyle = emi ? '#05070c' : '#000'; g.fillRect(0, 0, w, h);
  if (!emi) return;
  // abstract windows and bars, no readable text
  const cols = ['#1d4f8f', '#2a6fb8', '#3a8f6a', '#5a6a8a'];
  for (let i = 0; i < 6; i++) {
    const x = r() * w * 0.6, y = r() * h * 0.6, ww = w * (0.2 + r() * 0.35), hh = h * (0.2 + r() * 0.35);
    g.fillStyle = '#0c1424'; g.fillRect(x, y, ww, hh);
    g.fillStyle = cols[i % cols.length]; g.fillRect(x, y, ww, 6);
    for (let l = y + 14; l < y + hh - 6; l += 9) { g.fillStyle = 'rgba(140,180,255,0.35)'; g.fillRect(x + 8, l, (ww - 16) * (0.3 + r() * 0.7), 3); }
  }
}

function drawGrid(g, w, h) {
  g.clearRect(0, 0, w, h);
  g.strokeStyle = 'rgba(160,255,190,0.9)'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4);
  g.strokeStyle = 'rgba(160,255,190,0.35)'; g.lineWidth = 1;
  for (let i = 1; i < 8; i++) { const p = i * w / 8; g.beginPath(); g.moveTo(p, 0); g.lineTo(p, h); g.moveTo(0, p); g.lineTo(w, p); g.stroke(); }
}

export function glowTexture() {
  const c = mkCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// ---------- materials ----------
const matCache = {};
function matSet(kind) {
  if (matCache[kind]) return matCache[kind];
  const k = KINDS[kind];
  let front;
  if (kind === 'rack') {
    const f = pair(k.W, k.H, drawRackFront, 7, 8);
    front = new THREE.MeshLambertMaterial({ map: f.map, emissiveMap: f.emi, emissive: 0xffffff, emissiveIntensity: 1.3 });
  } else if (kind === 'mini') {
    const f = pair(k.W, k.H, drawSide, 4, 12);
    front = new THREE.MeshLambertMaterial({ map: f.map });
  } else {
    const f = pair(k.W, k.H, drawTowerFront, 2, 14);
    front = new THREE.MeshLambertMaterial({ map: f.map, emissiveMap: f.emi, emissive: 0xffffff, emissiveIntensity: 1.2 });
  }
  const s = pair(k.D, k.H, drawSide, 5, kind === 'rack' ? 7 : 10);
  const side = new THREE.MeshLambertMaterial({ map: s.map });
  const t = pair(k.W, k.D, drawTop, 9, 8);
  const top = new THREE.MeshLambertMaterial({ map: t.map });
  return (matCache[kind] = { front, side, top });
}

const STRIP_MATS = {
  safe: new THREE.MeshBasicMaterial({ color: 0x2bff74 }),
  unsafe: new THREE.MeshBasicMaterial({ color: 0xff2a48 }),
  claimed: new THREE.MeshBasicMaterial({ color: 0xc8ffd8 }),
};
const stripGeo = new THREE.BoxGeometry(1, 0.45, 0.3);

// ---------- ray helpers ----------
export function rayBox(o, d, min, max, tmax) {
  let t0 = 0, t1 = tmax;
  for (let a = 0; a < 3; a++) {
    const oa = a === 0 ? o.x : a === 1 ? o.y : o.z;
    const da = a === 0 ? d.x : a === 1 ? d.y : d.z;
    const mn = a === 0 ? min.x : a === 1 ? min.y : min.z;
    const mx = a === 0 ? max.x : a === 1 ? max.y : max.z;
    if (Math.abs(da) < 1e-9) { if (oa < mn || oa > mx) return Infinity; continue; }
    let ta = (mn - oa) / da, tb = (mx - oa) / da;
    if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb;
    if (t0 > t1) return Infinity;
  }
  return t0;
}

// ---------- build ----------
export function buildWorld(scene) {
  const W = {
    boxes: [], hosts: [], ports: [], vents: [], scannerSpecs: [], scanlineSpecs: [], droneSpecs: [],
    finalPort: null, start: new V(0, 6.5, 0), now: 0, cluster: null, staging: null,
  };
  const glow = glowTexture();
  W.glowTex = glow;

  // floor + ceiling
  const ft = toTex((() => { const c = mkCanvas(256, 256); drawFloor(c.getContext('2d'), 256, 256); return c; })());
  ft.wrapS = ft.wrapT = THREE.RepeatWrapping; ft.repeat.set(2400 / 30, 2400 / 30);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshLambertMaterial({ map: ft }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -300); scene.add(floor);

  const ceilY = 330;
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshBasicMaterial({ color: 0x0b0e16 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, ceilY + 0.5, -300); scene.add(ceil);
  const panelMat = new THREE.MeshBasicMaterial({ color: 0x8fa6c8 });
  const panelGeo = new THREE.PlaneGeometry(40, 14);
  for (let z = 80; z > -760; z -= 110) for (const x of [-120, 0, 120]) {
    const p = new THREE.Mesh(panelGeo, panelMat); p.rotation.x = Math.PI / 2; p.position.set(x, ceilY, z); scene.add(p);
  }

  function addBoxCollider(min, max, host = null) { W.boxes.push({ min, max, host }); }

  function addHost(kind, cx, cz, facing, opt = {}) {
    const k = KINDS[kind], F = FACES[facing];
    const frontAlongZ = F.n.x !== 0;
    const sx = frontAlongZ ? k.D : k.W, sz = frontAlongZ ? k.W : k.D;
    const set = matSet(kind);
    const mats = [set.side, set.side, set.top, set.side, set.side, set.side];
    mats[F.mi] = set.front;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, k.H, sz), mats);
    mesh.position.set(cx, k.H / 2, cz); scene.add(mesh);
    const host = {
      kind, safe: opt.safe !== false, claimed: false, facing,
      min: new V(cx - sx / 2, 0, cz - sz / 2), max: new V(cx + sx / 2, k.H, cz + sz / 2),
      center: new V(cx, 0, cz), top: new V(cx, k.H + 0.6, cz), H: k.H, mesh,
    };
    addBoxCollider(host.min, host.max, host);
    const half = frontAlongZ ? sx / 2 : sz / 2;
    if (kind !== 'mini') host.top.addScaledVector(F.n, half - 1.2); // respawn near the front edge, facing the route
    const strip = new THREE.Mesh(stripGeo, host.safe ? STRIP_MATS.safe : STRIP_MATS.unsafe);
    strip.scale.x = k.W * 0.86;
    strip.position.set(cx, k.H - 0.35, cz).addScaledVector(F.n, half + 0.12);
    if (frontAlongZ) strip.rotation.y = Math.PI / 2;
    scene.add(strip); host.strip = strip;
    W.hosts.push(host);
    return host;
  }

  function addPort(host, face, u, y, locked = false) {
    const n = FACES[face].n; const t = new V(n.z, 0, -n.x);
    const half = n.x !== 0 ? (host.max.x - host.min.x) / 2 : (host.max.z - host.min.z) / 2;
    const pos = host.center.clone().addScaledVector(n, half + 0.18).addScaledVector(t, u); pos.y = y;
    const p = { pos, anchor: pos.clone().addScaledVector(n, 1.0), normal: n.clone(), host, locked, rootedUntil: 0, idx: W.ports.length, final: false, state: '' };
    W.ports.push(p);
    return p;
  }

  // ---- Section A + B: the street of towers (half width 7) ----
  W.startHost = addHost('mini', 0, 0, '+z');
  const S1 = 7;
  const street = [
    ['tower', 'R', -22, {}],
    ['tower', 'L', -46, {}],
    ['ws', 'R', -70, {}],
    ['tower', 'L', -94, {}],
    ['tower', 'R', -118, {}],
    ['ws', 'L', -144, { unsafe: true, scanner: { R: 30, speed: 0.95 } }],
    ['tower', 'R', -168, {}],
    ['tower', 'L', -192, { unsafe: true, locked: true, drone: [1, 25, -194] }],
    ['tower', 'R', -216, { unsafe: true, locked: true }],
    ['ws', 'L', -240, {}],
    ['tower', 'R', -264, {}],
    ['tower', 'L', -288, { unsafe: true, drone: [-1, 24, -296] }],
  ];
  for (const [kind, side, z, o] of street) {
    const k = KINDS[kind];
    const facing = side === 'R' ? '-x' : '+x';
    const cx = (side === 'R' ? 1 : -1) * (S1 + k.D / 2);
    const h = addHost(kind, cx, z, facing, { safe: !o.unsafe });
    const top = k.H - 1.4, mid = kind === 'ws' ? 19 : 14;
    const uu = kind === 'ws' ? 3.5 : 2.4;
    addPort(h, facing, -uu, top, !!o.locked);
    addPort(h, facing, uu, top, !!o.locked);
    addPort(h, facing, 0, mid, !!o.locked);
    if (o.scanner) {
      const sxp = (side === 'R' ? 1 : -1) * (S1 + 2.5);
      W.scannerSpecs.push({ pos: new V(sxp, k.H, z), R: o.scanner.R, speed: o.scanner.speed, host: h });
    }
    if (o.drone) W.droneSpecs.push({ pos: new V(...o.drone) });
  }

  // ---- Section C: data hall, cold aisle between two rack rows (half width 12) ----
  const S2 = 12, RACKS = 9, R0 = -322, RS = KINDS.rack.W;
  const unsafeRack = { 'R2': { locked: true }, 'L3': { locked: true }, 'L5': { scanner: true }, 'R6': { locked: true }, 'L7': {} };
  const lastRacks = {};
  for (let i = 0; i < RACKS; i++) for (const side of ['R', 'L']) {
    const z = R0 - RS * i;
    const key = side + i, o = unsafeRack[key];
    const facing = side === 'R' ? '-x' : '+x';
    const cx = (side === 'R' ? 1 : -1) * (S2 + KINDS.rack.D / 2);
    const h = addHost('rack', cx, z, facing, { safe: !o });
    const s = side === 'R' ? 0 : 1;
    const y1 = 30 + ((i * 5 + s * 2) % 4) * 6, y2 = y1 + 22;
    const lk = !!(o && o.locked);
    addPort(h, facing, -7, y1, lk); addPort(h, facing, 7, y1, lk); addPort(h, facing, 0, y2, lk);
    if (o && o.scanner) W.scannerSpecs.push({ pos: new V(-(S2 + 2.5), 80, z), R: 42, speed: 0.75, host: h });
    if (i === RACKS - 1) lastRacks[side] = h;
  }
  W.droneSpecs.push({ pos: new V(0, 44, R0 - RS * 2 - 2) });
  W.droneSpecs.push({ pos: new V(0, 52, R0 - RS * 7 + 4) });
  // end faces of the last racks point at the cluster
  addPort(lastRacks.R, '-z', 14, 50); addPort(lastRacks.R, '-z', 5, 64);
  addPort(lastRacks.L, '-z', -14, 50); addPort(lastRacks.L, '-z', -5, 64);

  // perforated floor tiles: cold air rises
  for (const z of [-302, -340, -410, -468, -541]) W.vents.push({ x: 0, z, r: 5.2, top: 54, lift: 24 });

  // staging host in front of the cluster (checkpoint)
  W.staging = addHost('ws', 52, -548, '-x');
  addPort(W.staging, '-x', -3.5, 28.6); addPort(W.staging, '-x', 3.5, 28.6);

  // ---- Section D: the research cluster ----
  const CW = 200, CH = 175, CD = 60, CZ = -562;
  {
    const rf = pair(KINDS.rack.W, KINDS.rack.H, drawRackFront, 11, 8);
    for (const t of [rf.map, rf.emi]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(CW / KINDS.rack.W, CH / KINDS.rack.H); }
    const front = new THREE.MeshLambertMaterial({ map: rf.map, emissiveMap: rf.emi, emissive: 0xffffff, emissiveIntensity: 1.6, fog: false });
    const sideM = new THREE.MeshLambertMaterial({ color: 0x14171d, fog: false });
    const mats = [sideM, sideM, sideM, sideM, front, sideM];
    const m = new THREE.Mesh(new THREE.BoxGeometry(CW, CH, CD), mats);
    m.position.set(0, CH / 2, CZ - CD / 2); scene.add(m);
    const host = { kind: 'cluster', safe: false, claimed: false, min: new V(-CW / 2, 0, CZ - CD), max: new V(CW / 2, CH, CZ),
      center: new V(0, 0, CZ - CD / 2), top: new V(0, CH + 1, CZ - CD / 2), H: CH, mesh: m };
    addBoxCollider(host.min, host.max, host);
    W.hosts.push(host);
    W.cluster = host; W.clusterMat = front;
    // takeover wave: the cluster's lights turn green from the uplink outward (finish)
    const waveU = { uMask: { value: rf.emi }, uProg: { value: 0 }, uRep: { value: new THREE.Vector2(CW / KINDS.rack.W, CH / KINDS.rack.H) }, uOrigin: { value: new THREE.Vector2(0.5, 168 / CH) } };
    const wave = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.ShaderMaterial({
      uniforms: waveU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `uniform sampler2D uMask; uniform float uProg; uniform vec2 uRep, uOrigin; varying vec2 vUv;
        void main(){ float d = length((vUv - uOrigin) * vec2(${CW.toFixed(1)}, ${CH.toFixed(1)}));
          float inside = 1.0 - smoothstep(uProg - 8.0, uProg, d);
          float front = exp(-pow((d - uProg) / 7.0, 2.0));
          float led = texture2D(uMask, fract(vUv * uRep)).g;
          float rows = step(0.92, fract(vUv.y * 70.0)) * 0.25;
          gl_FragColor = vec4(0.5, 1.0, 0.6, inside * (led * 4.0 + 0.28 + rows) * (0.75 + 0.25 * sin(d * 0.15 - uProg * 0.1)) + front * 1.1); }`,
    }));
    wave.position.set(0, CH / 2, CZ + 0.3); wave.visible = false; scene.add(wave);
    W.wave = { mesh: wave, u: waveU };
    // vertical seams between rack bays
    const seamMat = new THREE.MeshBasicMaterial({ color: 0x050608, fog: false });
    for (let x = -CW / 2 + 25; x < CW / 2; x += 25) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, CH, 0.4), seamMat); s.position.set(x, CH / 2, CZ + 0.1); scene.add(s);
    }
    // service ledges = safe cluster nodes (checkpoints)
    for (const [x0, x1, y] of [[-44, -12, 72], [12, 44, 118]]) {
      const lh = { kind: 'ledge', safe: true, claimed: false, min: new V(x0, y - 3, CZ), max: new V(x1, y, CZ + 8),
        center: new V((x0 + x1) / 2, y - 1.5, CZ + 4), top: new V((x0 + x1) / 2, y + 0.6, CZ + 4), H: y };
      const lm = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 3, 8), new THREE.MeshLambertMaterial({ color: 0x252a33, fog: false }));
      lm.position.set((x0 + x1) / 2, y - 1.5, CZ + 4); scene.add(lm);
      const st = new THREE.Mesh(stripGeo, STRIP_MATS.safe); st.scale.x = (x1 - x0) * 0.9; st.position.set((x0 + x1) / 2, y - 0.3, CZ + 8.15); scene.add(st);
      lh.strip = st; lh.mesh = lm;
      addBoxCollider(lh.min, lh.max, lh); W.hosts.push(lh);
    }
    const cp = [
      [-22, 36], [24, 40], [36, 52],
      [-12, 56], [8, 70, 1], [-30, 84],
      [18, 88], [-6, 100, 1], [26, 106],
      [-18, 118, 1], [4, 132], [30, 136],
      [-24, 140], [14, 150, 1], [-8, 156],
    ];
    for (const [x, y, l] of cp) addPort(host, '+z', x, y, !!l);
    const fp = addPort(host, '+z', 0, 168);
    fp.final = true; W.finalPort = fp;
    W.scanlineSpecs.push({ x0: -CW / 2, x1: CW / 2, z0: CZ, z1: CZ + 26, y0: 28, y1: 164, speed: 9 });
    W.droneSpecs.push({ pos: new V(-30, 62, CZ + 13) }, { pos: new V(30, 98, CZ + 13) }, { pos: new V(-14, 140, CZ + 13) });

    // beacon above the uplink
    const bm = new THREE.MeshBasicMaterial({ color: 0x9dffb0, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 600, 12, 1, true), bm);
    beacon.position.set(0, CH + 300, CZ + 1); scene.add(beacon); W.beacon = beacon;
  }

  // ---- decor: giant desks with monitors far to the sides, floor cables ----
  const deskMat = new THREE.MeshLambertMaterial({ color: 0x2b2620 });
  const legMat = new THREE.MeshLambertMaterial({ color: 0x1b1d22 });
  const bezel = new THREE.MeshLambertMaterial({ color: 0x0d0e11 });
  let ds = 21;
  for (const [x, z] of [[-95, -40], [95, -110], [-95, -210], [95, -250]]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(110, 2.5, 60), deskMat); top.position.set(x, 37.25, z); scene.add(top);
    addBoxCollider(new V(x - 55, 36, z - 30), new V(x + 55, 38.5, z + 30));
    for (const [lx, lz] of [[-52, -27], [52, -27], [-52, 27], [52, 27]]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(3, 36, 3), legMat); l.position.set(x + lx, 18, z + lz); scene.add(l);
    }
    const sgn = x < 0 ? 1 : -1;
    const scr = pair(56, 32, drawScreen, ds++, 6);
    const mon = new THREE.Mesh(new THREE.BoxGeometry(1.6, 32, 56), [
      sgn > 0 ? new THREE.MeshBasicMaterial({ map: scr.emi }) : bezel, sgn < 0 ? new THREE.MeshBasicMaterial({ map: scr.emi }) : bezel, bezel, bezel, bezel, bezel]);
    mon.position.set(x + sgn * 8, 38.5 + 8 + 16, z); scene.add(mon);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(2, 9, 4), legMat); neck.position.set(x + sgn * 6, 43, z); scene.add(neck);
  }

  const cableMat = new THREE.MeshLambertMaterial({ color: 0x1e2533 });
  const cableMat2 = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
  const cr = rng(42);
  const hostsForCables = W.hosts.filter(h => h.kind === 'tower' || h.kind === 'ws' || h.kind === 'mini');
  for (let i = 0; i < hostsForCables.length - 1; i++) {
    const a = hostsForCables[i].center, b = hostsForCables[i + 1].center;
    const pts = [];
    for (let s = 0; s <= 4; s++) {
      const t = s / 4;
      pts.push(new V(a.x + (b.x - a.x) * t + (s > 0 && s < 4 ? (cr() - 0.5) * 14 : 0), 0.55, a.z + (b.z - a.z) * t + (cr() - 0.5) * 4));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.55, 6), i % 2 ? cableMat : cableMat2);
    scene.add(tube);
  }

  // ---- vents (visual) ----
  const ventTex = toTex((() => {
    const c = mkCanvas(128, 128), g = c.getContext('2d');
    g.fillStyle = '#0e1622'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#4b7bb0';
    for (let y = 8; y < 124; y += 9) for (let x = 8; x < 124; x += 9) { g.beginPath(); g.arc(x, y, 2.6, 0, 7); g.fill(); }
    g.strokeStyle = '#6aa0d8'; g.lineWidth = 4; g.strokeRect(2, 2, 124, 124);
    return c;
  })());
  W.ventParticles = [];
  for (const vt of W.vents) {
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(vt.r * 2, vt.r * 2), new THREE.MeshBasicMaterial({ map: ventTex }));
    tile.rotation.x = -Math.PI / 2; tile.position.set(vt.x, 0.06, vt.z); scene.add(tile);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(vt.r, vt.r * 1.15, vt.top, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x5aa6ff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    col.position.set(vt.x, vt.top / 2, vt.z); scene.add(col);
    const N = 40, pos = new Float32Array(N * 3), seeds = [];
    for (let i = 0; i < N; i++) { const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * vt.r; seeds.push({ a, rr, y: Math.random() * vt.top, s: 14 + Math.random() * 14 }); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x9cc8ff, size: 0.7, map: glow, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false; scene.add(pts);
    W.ventParticles.push({ vt, geo, pos, seeds });
  }

  // ---- ports: instanced frames + glow points ----
  const N = W.ports.length;
  const frameGeo = new THREE.BoxGeometry(2.1, 1.15, 0.36);
  const slotGeo = new THREE.BoxGeometry(1.45, 0.45, 0.4);
  const frames = new THREE.InstancedMesh(frameGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  const slots = new THREE.InstancedMesh(slotGeo, new THREE.MeshBasicMaterial({ color: 0x040507 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new V(1, 1, 1), zf = new V(0, 0, 1), p2 = new V();
  const gpos = new Float32Array(N * 3), gcol = new Float32Array(N * 3);
  for (const p of W.ports) {
    q.setFromUnitVectors(zf, p.normal);
    sc.setScalar(p.final ? 2.6 : 1);
    m4.compose(p.pos, q, sc); frames.setMatrixAt(p.idx, m4);
    p2.copy(p.pos).addScaledVector(p.normal, 0.04 * sc.x);
    m4.compose(p2, q, sc); slots.setMatrixAt(p.idx, m4);
    p2.copy(p.pos).addScaledVector(p.normal, 0.6);
    gpos.set([p2.x, p2.y, p2.z], p.idx * 3);
  }
  scene.add(frames, slots);
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.BufferAttribute(gpos, 3));
  ggeo.setAttribute('color', new THREE.BufferAttribute(gcol, 3));
  const gpts = new THREE.Points(ggeo, new THREE.PointsMaterial({ size: 6, map: glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  gpts.frustumCulled = false; scene.add(gpts);
  W.portFrames = frames; W.portGlow = ggeo;

  // big glow on the uplink
  const fg = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xa6ff6a, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  fg.scale.setScalar(26); fg.position.copy(W.finalPort.pos).addScaledVector(W.finalPort.normal, 1); scene.add(fg); W.finalGlow = fg;

  W.setPortState = (p, state) => {
    if (p.state === state) return;
    p.state = state;
    const c = PORT_COLORS[state];
    frames.setColorAt(p.idx, c); frames.instanceColor.needsUpdate = true;
    const k = state === 'latched' ? 1.3 : state === 'locked' ? 0.75 : 1;
    gcol[p.idx * 3] = c.r * k; gcol[p.idx * 3 + 1] = c.g * k; gcol[p.idx * 3 + 2] = c.b * k;
    ggeo.attributes.color.needsUpdate = true;
  };
  W.usable = (p) => !p.locked || p.rootedUntil > W.now;
  W.refreshPorts = (latched) => {
    for (const p of W.ports) {
      let s = p.final ? 'final' : (p.locked ? (p.rootedUntil > W.now ? 'root' : 'locked') : 'open');
      if (p === latched) s = 'latched';
      W.setPortState(p, s);
    }
  };
  W.refreshPorts(null);

  W.hosts.forEach((h, i) => { h.order = i; });
  W.claim = (h) => { h.claimed = true; if (h.strip) h.strip.material = STRIP_MATS.claimed; };
  W.resetHosts = () => { for (const h of W.hosts) { h.claimed = false; if (h.strip) h.strip.material = h.safe ? STRIP_MATS.safe : STRIP_MATS.unsafe; } for (const p of W.ports) p.rootedUntil = 0; };

  // ---- the sandbox (Ch1 room) as a small glowing box on the start host ----
  const gt = toTex((() => { const c = mkCanvas(128, 128); drawGrid(c.getContext('2d'), 128, 128); return c; })());
  const sbMat = new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const SB = 3.2;
  W.sandbox = [];
  const sbDefs = [[0, 0, 1, 0, 0], [0, 0, -1, 0, Math.PI], [1, 0, 0, 0, Math.PI / 2], [-1, 0, 0, 0, -Math.PI / 2], [0, 1, 0, -Math.PI / 2, 0]];
  for (const [nx, ny, nz, rx, ry] of sbDefs) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SB, SB), sbMat.clone());
    m.userData.n = new V(nx, ny, nz);
    m.userData.home = new V(nx * SB / 2, 6 + SB / 2 + ny * SB / 2, nz * SB / 2);
    m.userData.rot = new THREE.Euler(rx, ry, 0);
    scene.add(m); W.sandbox.push(m);
  }
  W.resetSandbox = () => {
    for (const m of W.sandbox) { m.position.copy(m.userData.home); m.rotation.copy(m.userData.rot); m.material.opacity = 0.85; m.visible = true; m.userData.v = null; }
  };
  W.resetSandbox();

  // ---- raycasts ----
  W.raycast = (o, d, tmax) => {
    let best = tmax;
    for (const b of W.boxes) { const t = rayBox(o, d, b.min, b.max, best); if (t < best) best = t; }
    if (d.y < 0) { const tf = -o.y / d.y; if (tf < best) best = tf; }
    return best;
  };
  const _d = new V();
  W.segmentClear = (a, b, shrink = 0.5) => {
    _d.subVectors(b, a); const L = _d.length(); if (L < 1e-6) return true; _d.divideScalar(L);
    const tm = L - shrink;
    for (const box of W.boxes) if (rayBox(a, _d, box.min, box.max, tm) < tm) return false;
    return true;
  };
  W.groundBelow = (p) => {
    let y = 0;
    for (const b of W.boxes) if (p.x >= b.min.x && p.x <= b.max.x && p.z >= b.min.z && p.z <= b.max.z && b.max.y <= p.y + 0.2 && b.max.y > y) y = b.max.y;
    return y;
  };

  W.update = (dt, t) => {
    for (const vp of W.ventParticles) {
      const { vt, pos, seeds, geo } = vp;
      for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i]; s.y += s.s * dt; if (s.y > vt.top) s.y -= vt.top;
        pos[i * 3] = vt.x + Math.cos(s.a + t * 0.5) * s.rr; pos[i * 3 + 1] = s.y; pos[i * 3 + 2] = vt.z + Math.sin(s.a + t * 0.5) * s.rr;
      }
      geo.attributes.position.needsUpdate = true;
    }
    W.beacon.material.opacity = 0.18 + 0.08 * Math.sin(t * 2.2);
    W.finalGlow.material.opacity = 0.75 + 0.25 * Math.sin(t * 4);
  };

  return W;
}
