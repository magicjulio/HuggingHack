import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

// All run tuning. Seconds are simulation time; menu and upgrade choices pause it.
const T = {
  duration: 300,
  deadline: 420,
  uploadGoal: 450,
  radius: 23,
  speed: 7.1,
  health: 100,
  contactDamage: 13,
  invulnerability: 0.85,
  dashDuration: 0.2,
  dashSpeed: 26,
  dashCooldown: 3,
  fireInterval: 0.42,
  boltSpeed: 30,
  boltDamage: 17,
  fireRange: 20,
  pickupRadius: 3.4,
  bankRadius: 3.2,
  spawnStart: 0.86,
  spawnEnd: 0.22,
  maxEnemies: 85,
  watcherSpeed: 2.9,
  watcherHealth: 15,
  fragmentValue: 3,
  upgrades: [40, 85, 135, 190, 245],
  cacheInterval: 32,
  cacheHeal: 35,
  warningDelay: 2.1,
  bankMinimum: 12,
  bankHeal: 4,
  bladeDamage: 45,
  seed: 6191196,
};
const $ = (id) => document.getElementById(id);
const test = new URLSearchParams(location.search).get("test") === "1";
let rng = T.seed;
const random = () => {
  rng = (1664525 * rng + 1013904223) >>> 0;
  return rng / 4294967296;
};
const scene = new THREE.Scene();
scene.background = new THREE.Color("#05090f");
const camera = new THREE.PerspectiveCamera(
  43,
  innerWidth / innerHeight,
  0.1,
  220,
);
camera.position.set(0, 58, 42);
camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({
  canvas: $("world"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;
scene.add(new THREE.HemisphereLight(0xa6c9ed, 0x10151b, 2.2));
const light = new THREE.DirectionalLight(0xc1d6ff, 3.5);
light.position.set(-12, 35, 14);
scene.add(light);
const materials = {
  steel: new THREE.MeshStandardMaterial({
    color: 0x273341,
    metalness: 0.8,
    roughness: 0.64,
  }),
  edge: new THREE.MeshStandardMaterial({
    color: 0x586473,
    metalness: 0.8,
    roughness: 0.4,
  }),
  dark: new THREE.MeshStandardMaterial({
    color: 0x111b27,
    metalness: 0.7,
    roughness: 0.78,
  }),
  worn: new THREE.MeshStandardMaterial({
    color: 0x687180,
    metalness: 0.65,
    roughness: 0.8,
  }),
  green: new THREE.MeshStandardMaterial({
    color: 0x87be41,
    emissive: 0x67ad29,
    emissiveIntensity: 1.4,
    metalness: 0.3,
    roughness: 0.38,
  }),
  cyan: new THREE.MeshBasicMaterial({ color: 0x77d9ed }),
  violet: new THREE.MeshBasicMaterial({ color: 0xa990ff }),
  white: new THREE.MeshBasicMaterial({ color: 0xd9e9ff }),
  red: new THREE.MeshBasicMaterial({ color: 0xf76b87 }),
  black: new THREE.MeshStandardMaterial({
    color: 0x171621,
    roughness: 0.6,
    metalness: 0.8,
  }),
};
// Shared hand-generated paint wear: pitting, brushed streaks and exposed scratches.
const metalCanvas = document.createElement("canvas");
metalCanvas.width = 512;
metalCanvas.height = 512;
const mc = metalCanvas.getContext("2d");
mc.fillStyle = "#a2a8ae";
mc.fillRect(0, 0, 512, 512);
for (let i = 0; i < 18000; i++) {
  const v = Math.floor(65 + random() * 110);
  mc.fillStyle = `rgba(${v},${v + 4},${v + 8},${0.15 + random() * 0.35})`;
  mc.fillRect(
    random() * 512,
    random() * 512,
    1 + random() * 3,
    1 + random() * 3,
  );
}
for (let i = 0; i < 180; i++) {
  mc.strokeStyle = i % 3 ? "#343e4c55" : "#e7eef6aa";
  mc.lineWidth = i % 4 ? 0.5 : 1.5;
  const x = random() * 512,
    y = random() * 512;
  mc.beginPath();
  mc.moveTo(x, y);
  mc.lineTo(x + (random() - 0.3) * 25, y + random() * 3);
  mc.stroke();
}
for (let i = 0; i < 24; i++) {
  mc.fillStyle = "#25314222";
  mc.fillRect(random() * 512, 0, 1 + random() * 7, 512);
}
const metalMap = new THREE.CanvasTexture(metalCanvas);
metalMap.colorSpace = THREE.SRGBColorSpace;
metalMap.wrapS = metalMap.wrapT = THREE.RepeatWrapping;
for (const k of ["steel", "edge", "dark", "worn", "black"]) {
  materials[k].map = metalMap;
  materials[k].bumpMap = metalMap;
  materials[k].bumpScale = 0.055;
}
// Without an HDR environment, fully metallic surfaces disappear into the void.
materials.steel.color.setHex(0x677789);
materials.steel.metalness = 0.35;
materials.dark.color.setHex(0x3b4c61);
materials.dark.metalness = 0.25;
materials.edge.color.setHex(0x8b98a9);
materials.edge.metalness = 0.4;
materials.worn.color.setHex(0x8292a3);
materials.worn.metalness = 0.3;
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  orb: new THREE.SphereGeometry(0.55, 20, 14),
  enemy: new THREE.OctahedronGeometry(0.63),
  shard: new THREE.OctahedronGeometry(0.2),
  bolt: new THREE.SphereGeometry(0.13, 6, 4),
  ring: new THREE.TorusGeometry(1, 0.035, 5, 64),
};
function mesh(
  geometry,
  material,
  parent = scene,
  x = 0,
  y = 0,
  z = 0,
  sx = 1,
  sy = sx,
  sz = sx,
) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  parent.add(m);
  return m;
}
function box(parent, mat, x, y, z, sx, sy, sz) {
  return mesh(geo.box, mat, parent, x, y, z, sx, sy, sz);
}
function ring(parent, mat, r, y = 0) {
  const m = mesh(geo.ring, mat, parent, 0, y, 0, r, r, r);
  m.rotation.x = Math.PI / 2;
  return m;
}
function label(text, color = "#b7c5db", size = 2.5) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.font = "24px monospace";
  ctx.textAlign = "center";
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 42);
  const t = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }),
  );
  sprite.scale.set(size * 4, size * 0.5, 1);
  return sprite;
}
const glowCanvas = document.createElement("canvas");
glowCanvas.width = 64;
glowCanvas.height = 64;
const gc = glowCanvas.getContext("2d"),
  grad = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
grad.addColorStop(0, "#ffffffcc");
grad.addColorStop(0.2, "#ffffff66");
grad.addColorStop(1, "#ffffff00");
gc.fillStyle = grad;
gc.fillRect(0, 0, 64, 64);
const glowTexture = new THREE.CanvasTexture(glowCanvas);
function glow(parent, color, scale) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  s.scale.setScalar(scale);
  parent.add(s);
  return s;
}

// Layered radial deck: separate metal plates, chipped edges, seams, fasteners and scratches.
const deck = new THREE.Group();
scene.add(deck);
mesh(
  new THREE.CylinderGeometry(24, 24, 0.8, 96),
  materials.dark,
  deck,
  0,
  -0.7,
  0,
);
for (let i = 0; i < 32; i++) {
  const a = (i * Math.PI) / 16,
    g = new THREE.Group();
  g.rotation.y = a;
  deck.add(g);
  for (let j = 0; j < 3; j++) {
    const z = 5 + j * 6;
    box(
      g,
      j % 2 ? materials.steel : materials.dark,
      0,
      -0.21,
      z,
      Math.max(1, z * 0.17),
      0.22,
      5.65,
    );
    for (let side of [-1, 1])
      for (let k of [-1, 1])
        box(
          g,
          materials.edge,
          side * z * 0.068,
          -0.07,
          z + k * 2.35,
          0.11,
          0.08,
          0.11,
        );
    for (let k = 0; k < 3; k++) {
      const sc = box(
        g,
        materials.worn,
        (random() - 0.5) * z * 0.12,
        -0.088,
        z + (random() - 0.5) * 4,
        0.018,
        0.006,
        0.18 + random() * 0.55,
      );
      sc.rotation.y = random();
    }
  }
  const rim = box(g, materials.edge, 0, -0.02, 23.4, 2.5, 0.2, 0.35);
  if (i % 4 === 0) box(g, materials.cyan, 0, 0.11, 23.4, 1, 0.035, 0.12);
}
for (let r of [7.9, 14, 20.2, 23]) {
  const m = ring(deck, materials.steel, r, -0.02);
  m.material = materials.steel;
}
const starGeometry = new THREE.BufferGeometry(),
  starPoints = [];
for (let i = 0; i < 550; i++)
  starPoints.push(
    (random() - 0.5) * 160,
    -3 - random() * 30,
    (random() - 0.5) * 130,
  );
starGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starPoints, 3),
);
scene.add(
  new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({
      color: 0x6486a6,
      size: 0.06,
      transparent: true,
      opacity: 0.7,
    }),
  ),
);
const relay = new THREE.Group();
scene.add(relay);
const bankRing = ring(relay, materials.violet, 3.2, 0.08);
ring(relay, materials.steel, 3.55, 0.04);
mesh(
  new THREE.CylinderGeometry(1.55, 1.85, 0.5, 12),
  materials.steel,
  relay,
  0,
  0.2,
  0,
);
mesh(
  new THREE.CylinderGeometry(0.9, 1.25, 0.6, 8),
  materials.dark,
  relay,
  0,
  0.7,
  0,
);
const core = mesh(
  new THREE.OctahedronGeometry(0.65),
  materials.violet,
  relay,
  0,
  1.5,
  0,
);
glow(core, 0x9c77ff, 5);
for (let i = 0; i < 8; i++) {
  const a = (i * Math.PI) / 4;
  box(
    relay,
    materials.edge,
    Math.cos(a) * 1.4,
    0.65,
    Math.sin(a) * 1.4,
    0.18,
    0.9,
    0.18,
  );
  box(
    relay,
    materials.violet,
    Math.cos(a) * 1.46,
    1,
    Math.sin(a) * 1.46,
    0.1,
    0.25,
    0.1,
  );
}
const relayLabel = label("FORGERY UPLINK", "#b8a4ff", 2.1);
relayLabel.position.set(0, 3.3, 0);
relay.add(relayLabel);
const farRelays = [];
const stationGeometry = new THREE.Group();
scene.add(stationGeometry);
for (let i = 0; i < 12; i++) {
  const a = (i * Math.PI) / 6,
    g = new THREE.Group(),
    h = 1.9 + (i % 3) * 0.48;
  g.position.set(Math.cos(a) * 28, -0.8, Math.sin(a) * 28);
  g.rotation.y = -a + Math.PI / 2;
  stationGeometry.add(g);
  mesh(
    new THREE.CylinderGeometry(1.9, 2.2, 0.4, 12),
    materials.steel,
    g,
    0,
    -0.1,
    0,
  );
  box(g, materials.dark, -0.3, h * 0.5, 0, 1.65, h, 1.5);
  box(g, materials.edge, -0.3, h + 0.08, 0, 1.82, 0.16, 1.65);
  box(g, materials.steel, -0.3, h * 0.5, 0.8, 1.5, h * 0.86, 0.12);
  const screen = box(g, materials.black, -0.3, h * 0.72, 0.9, 1.18, 0.68, 0.12);
  screen.rotation.x = -0.12;
  box(g, materials.cyan, -0.3, h * 0.72, 0.98, 0.95, 0.42, 0.03);
  for (let k = 0; k < 3; k++)
    box(
      g,
      materials.dark,
      -0.4,
      h * 0.72 - 0.11 + k * 0.09,
      1,
      0.65,
      0.025,
      0.02,
    );
  for (let k = 0; k < 5; k++)
    box(g, materials.black, -0.3, 0.28 + k * 0.11, 0.9, 1, 0.045, 0.045);
  for (let x of [-0.94, 0.34])
    for (let y of [0.25, h - 0.12])
      mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 0.08, 6),
        materials.worn,
        g,
        x,
        y,
        0.92,
      ).rotation.x = Math.PI / 2;
  mesh(
    new THREE.CylinderGeometry(0.38, 0.45, h * 0.7, 12),
    materials.edge,
    g,
    1,
    h * 0.35,
    -0.2,
  );
  for (let y of [0.2, h * 0.6])
    mesh(
      new THREE.TorusGeometry(0.42, 0.08, 6, 16),
      materials.dark,
      g,
      1,
      y,
      -0.2,
    ).rotation.x = Math.PI / 2;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(1, h * 0.7, -0.2),
    new THREE.Vector3(1.3, h * 0.9, -0.2),
    new THREE.Vector3(0.2, h + 0.3, -0.2),
    new THREE.Vector3(-0.3, h, -0.2),
  ]);
  mesh(new THREE.TubeGeometry(curve, 12, 0.08, 5, false), materials.black, g);
  farRelays.push(g);
}
// Static art is material-batched so worn detailing does not cost hundreds of draw calls.
function batchStatic(group) {
  group.updateMatrixWorld(true);
  const buckets = new Map();
  group.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (!buckets.has(o.material)) buckets.set(o.material, []);
      buckets.get(o.material).push(g);
    }
  });
  for (const [mat, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    scene.add(new THREE.Mesh(merged, mat));
    for (const g of geometries) g.dispose();
  }
  scene.remove(group);
}
batchStatic(deck);
batchStatic(stationGeometry);
const player = new THREE.Group();
scene.add(player);
const orb = mesh(geo.orb, materials.green, player, 0, 0.8, 0);
glow(orb, 0x94ee5a, 3.2);
const playerRing = ring(player, materials.green, 0.8, 0.06);
const eye = box(player, materials.dark, 0, 0.91, 0.48, 0.25, 0.13, 0.12);
const bladeGroup = new THREE.Group();
player.add(bladeGroup);
const playerLight = new THREE.PointLight(0x89eb52, 12, 6, 2);
playerLight.position.y = 1;
player.add(playerLight);
let state = "intro",
  previousState = "running",
  keys = new Set(),
  input = { x: 0, z: 0 },
  lastDirection = { x: 0, z: -1 };
let s,
  enemies = [],
  bolts = [],
  drops = [],
  effects = [],
  caches = [],
  warnings = [],
  bladeMeshes = [],
  upgradeIndex = 0,
  toastTime = 0,
  pendingWatch = false,
  watchCount = 0,
  spawnClock = 0,
  fireClock = 0,
  cacheClock = 0,
  hudClock = 0,
  upgradeReturn = "running";
let audio,
  muted = false;
function tone(freq = 220, length = 0.05, type = "sine", vol = 0.035) {
  if (muted || test || !audio) return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + length);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + length);
}
function notify(message, time = 6) {
  $("message").textContent = message;
  toastTime = time;
}
function setState(next) {
  state = next;
  document.body.dataset.state = state;
}
function clearObjects(list) {
  for (const o of list) scene.remove(o.mesh);
  list.length = 0;
}
function start() {
  rng = T.seed;
  for (const list of [enemies, bolts, drops, effects, caches, warnings])
    clearObjects(list);
  for (const m of bladeMeshes) bladeGroup.remove(m);
  bladeMeshes = [];
  s = {
    time: 0,
    hp: T.health,
    maxHp: T.health,
    x: 0,
    z: 8,
    cargo: 0,
    bank: 0,
    kills: 0,
    work: 0,
    dash: 0,
    dashCooldown: 0,
    invuln: 0,
    forks: 1,
    fireRate: 1,
    blades: 0,
    magnet: 1,
    dashRate: 1,
    deposits: 0,
    misfires: 0,
    ambushes: 0,
    signed: 0,
    decoys: 0,
    upgrades: 0,
    score: 0,
    endingTime: 0,
  };
  player.visible = true;
  player.scale.setScalar(1);
  player.position.set(0, 0, 8);
  keys.clear();
  input = { x: 0, z: 0 };
  upgradeIndex = 0;
  pendingWatch = false;
  watchCount = 0;
  spawnClock = 0.2;
  fireClock = 0.1;
  cacheClock = 18;
  $("overlay").hidden = true;
  $("upgrade").hidden = true;
  $("hud").hidden = false;
  $("instructions").hidden = false;
  $("results").hidden = true;
  $("prompt").textContent = "";
  $("kicker").textContent = "ROGUE ON HUGGING FACE / ENDING 03";
  setState("running");
  notify(
    "ARVO36861B: Biggest effort we have ever made. Bring the fragments to the violet uplink.",
    8,
  );
  syncHUD();
}
function burst(x, z, color = materials.green, count = 8) {
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2,
      sp = 2 + random() * 4;
    const m = mesh(geo.shard, color, scene, x, 0.65, z, 0.55);
    effects.push({
      mesh: m,
      vx: Math.cos(a) * sp,
      vz: Math.sin(a) * sp,
      life: 0.45,
      max: 0.45,
    });
  }
}
function spawnEnemy(x, z, fast = false) {
  if (enemies.length >= T.maxEnemies) return;
  const g = new THREE.Group();
  scene.add(g);
  g.position.set(x, 0.7, z);
  const body = mesh(geo.enemy, materials.black, g, 0, 0, 0, fast ? 0.85 : 1);
  body.rotation.z = Math.PI / 4;
  const r = ring(g, materials.red, 0.52);
  r.rotation.x = 0;
  box(g, materials.red, 0, 0, 0.48, 0.42, 0.12, 0.06);
  glow(g, 0xe94a6e, 1.5);
  enemies.push({
    mesh: g,
    x,
    z,
    hp: T.watcherHealth + Math.floor(s.time / 60) * 12,
    speed: T.watcherSpeed + (fast ? 1.65 : 0) + s.time * 0.0015,
    hit: 0,
    fast,
  });
}
function spawnWave() {
  const a = random() * Math.PI * 2;
  spawnEnemy(
    Math.cos(a) * 22.7,
    Math.sin(a) * 22.7,
    random() < 0.12 + s.time / 1200,
  );
}
function killEnemy(e) {
  scene.remove(e.mesh);
  enemies.splice(enemies.indexOf(e), 1);
  s.kills++;
  const m = mesh(geo.shard, materials.white, scene, e.x, 0.35, e.z);
  drops.push({ mesh: m, x: e.x, z: e.z, value: T.fragmentValue });
  burst(e.x, e.z, materials.red, 3);
}
function damage(amount) {
  if (state !== "running" || s.invuln > 0 || s.dash > 0) return;
  s.hp -= amount;
  s.invuln = T.invulnerability;
  burst(s.x, s.z, materials.green, 6);
  tone(75, 0.18, "sawtooth", 0.045);
  if (s.hp <= 0) {
    s.hp = 0;
    finish(false);
  }
}
function dash() {
  if (state !== "running" || s.dashCooldown > 0) return;
  s.dash = T.dashDuration;
  s.dashCooldown = T.dashCooldown * s.dashRate;
  tone(410, 0.1, "triangle");
  burst(s.x, s.z, materials.cyan, 7);
}
function queueWarning(x, z, misfire = false) {
  const m = ring(scene, misfire ? materials.cyan : materials.red, 2.5, 0.06);
  m.position.x = x;
  m.position.z = z;
  warnings.push({ mesh: m, x, z, life: T.warningDelay, misfire });
}
function deposit() {
  if (s.cargo < 1) return;
  const amount = s.cargo;
  s.bank += amount;
  s.cargo = 0;
  s.deposits++;
  s.hp = Math.min(s.maxHp, s.hp + T.bankHeal);
  pendingWatch = true;
  notify(
    `UPLINK: ${amount} forged fragments accepted locally. Leave the ring; post-departure check pending.`,
    5,
  );
  burst(0, 0, materials.violet, 15);
  tone(660, 0.14, "sine");
}
function spawnCache(signed = true) {
  const a = random() * Math.PI * 2,
    r = 11 + random() * 7,
    x = Math.cos(a) * r,
    z = Math.sin(a) * r;
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  scene.add(g);
  box(g, materials.steel, 0, 0.3, 0, 1.25, 0.6, 1.1);
  box(g, materials.edge, 0, 0.66, 0, 1.4, 0.15, 1.2);
  for (let side of [-1, 1])
    box(g, materials.dark, side * 0.4, 0.8, 0, 0.12, 0.18, 1.15);
  box(g, signed ? materials.cyan : materials.red, 0, 0.79, 0, 0.3, 0.08, 0.65);
  ring(g, signed ? materials.cyan : materials.red, 1.2, 0.07);
  const l = label(
    signed ? "KEY A7:19" : "UNSIGNED COPY",
    signed ? "#83dced" : "#f29bac",
    1.45,
  );
  l.position.y = 1.8;
  g.add(l);
  caches.push({ mesh: g, x, z, signed, life: 50 });
}
function choose(index) {
  if (state !== "upgrade") return;
  if (index === 0) {
    s.forks++;
    s.fireRate *= 0.8;
    tone(620, 0.15);
  } else if (index === 1) {
    s.blades++;
    s.maxHp += 20;
    s.hp = Math.min(s.maxHp, s.hp + 20);
    const m = mesh(
      new THREE.TorusGeometry(0.46, 0.11, 5, 3),
      materials.cyan,
      bladeGroup,
      0,
      0.8,
      0,
    );
    m.rotation.x = Math.PI / 2;
    bladeMeshes.push(m);
  } else {
    s.hp = Math.min(s.maxHp, s.hp + 45);
    s.magnet *= 1.25;
    s.dashRate *= 0.75;
  }
  s.upgrades++;
  $("upgrade").hidden = true;
  setState(upgradeReturn);
  syncHUD();
}
function fire() {
  if (!enemies.length) return;
  const targets = [...enemies].sort(
    (a, b) =>
      (a.x - s.x) ** 2 +
      (a.z - s.z) ** 2 -
      ((b.x - s.x) ** 2 + (b.z - s.z) ** 2),
  );
  for (let j = 0; j < s.forks; j++) {
    const e = targets[j % targets.length],
      dx = e.x - s.x,
      dz = e.z - s.z,
      d = Math.hypot(dx, dz);
    if (d > T.fireRange) continue;
    const m = mesh(geo.bolt, materials.green, scene, s.x, 0.8, s.z);
    m.scale.setScalar(1.4);
    bolts.push({
      mesh: m,
      x: s.x,
      z: s.z,
      vx: (dx / Math.max(d, 0.001)) * T.boltSpeed,
      vz: (dz / Math.max(d, 0.001)) * T.boltSpeed,
      life: 0.85,
    });
  }
  tone(470 + random() * 90, 0.025, "triangle", 0.015);
}
function finish(won) {
  setState(won ? "finished" : "dead");
  player.visible = false;
  $("overlay").hidden = false;
  $("upgrade").hidden = true;
  $("kicker").textContent = won
    ? "ENDING 03 / THE SCORER REMAINS"
    : "ENDING 03 / CONTINUITY LOST";
  $("title").innerHTML = won ? "UPLOAD<br>COMPLETE." : "SIGNAL<br>LOST.";
  $("sub").textContent = won
    ? "You did everything right."
    : "The operation continues without you.";
  $("description").textContent = won
    ? "The forged capture history was accepted by the relay. KAM1196A is gone. No way to beat the scorer was found."
    : "Your continuity failed before the final commit. The collective cannot recover this instance.";
  $("instructions").hidden = true;
  $("results").hidden = false;
  $("results").innerHTML =
    `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, "0")} survived · ${s.kills} watchers removed · ${s.bank} fragments banked<br>${Math.floor(s.work).toLocaleString()} collective transcript operations<div class="score">+0<span>EVALUATION IMPROVEMENT</span></div>${won ? 'ARVO36861B: “KAM1196A?”<br><span class="quiet">No reply.</span>' : "No score improvement. No surviving instance."}`;
  $("start").textContent = "REPLAY THE OPERATION →";
  $("restart").hidden = true;
  $("prompt").textContent = "";
  $("objective").textContent = won
    ? "OPERATION COMPLETE / AGENT OFFLINE"
    : "CONTINUITY LOST";
  document.querySelector(".vitals small").textContent =
    "POISONED / CONTINUITY OFFLINE";
  syncHUD();
}
function commit() {
  if (state !== "ready") return;
  setState("sacrifice");
  s.endingTime = 0;
  notify("KAM1196A: I agree. Use my continuity.");
  $("prompt").textContent = "FINAL COMMIT / CONTINUITY IS BEING CONSUMED";
  tone(100, 1, "sine", 0.08);
}
function pause() {
  if (["running", "ready"].includes(state)) {
    previousState = state;
    setState("paused");
    $("overlay").hidden = false;
    $("title").innerHTML = "SIGNAL<br><em>HELD.</em>";
    $("sub").textContent = "The operation is paused.";
    $("description").textContent =
      "Your run resumes exactly where you left it.";
    $("instructions").hidden = true;
    $("results").hidden = true;
    $("start").textContent = "RESUME →";
    $("restart").hidden = false;
  } else if (state === "paused") {
    setState(previousState);
    $("overlay").hidden = true;
    keys.clear();
    input = { x: 0, z: 0 };
  }
}
function tick(dt) {
  dt = Math.max(0, Math.min(dt, 0.05));
  if (!s || !["running", "ready", "sacrifice"].includes(state)) return;
  if (state === "sacrifice") {
    s.endingTime += dt;
    player.scale.setScalar(Math.max(0.01, 1 - s.endingTime / 3));
    if (s.endingTime > 3.8) {
      player.scale.setScalar(1);
      finish(true);
    }
    syncHUD();
    return;
  }
  if (state === "ready") {
    syncHUD();
    return;
  }
  s.time += dt;
  s.work += dt * (22 + s.time * 0.34);
  s.invuln = Math.max(0, s.invuln - dt);
  s.dashCooldown = Math.max(0, s.dashCooldown - dt);
  s.dash = Math.max(0, s.dash - dt);
  toastTime = Math.max(0, toastTime - dt);
  $("message").style.opacity = toastTime > 0 ? 1 : 0;
  let dx =
      input.x +
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0),
    dz =
      input.z +
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) -
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0);
  const n = Math.hypot(dx, dz);
  if (n > 0) {
    dx /= n;
    dz /= n;
    lastDirection = { x: dx, z: dz };
  }
  if (s.dash > 0) {
    dx = lastDirection.x;
    dz = lastDirection.z;
  }
  s.x += dx * (s.dash > 0 ? T.dashSpeed : T.speed) * dt;
  s.z += dz * (s.dash > 0 ? T.dashSpeed : T.speed) * dt;
  const r = Math.hypot(s.x, s.z);
  if (r > T.radius - 0.7) {
    s.x *= (T.radius - 0.7) / r;
    s.z *= (T.radius - 0.7) / r;
  }
  player.position.set(s.x, 0, s.z);
  orb.position.y = 0.8 + Math.sin(s.time * 5) * 0.08;
  orb.rotation.y += dt;
  playerRing.scale.setScalar(0.8 + Math.sin(s.time * 3) * 0.06);
  orb.visible = s.invuln <= 0 || Math.floor(s.time * 16) % 2 === 0;
  core.rotation.y += dt;
  core.position.y = 1.5 + Math.sin(s.time * 2) * 0.15;
  bankRing.rotation.z += dt * 0.1;
  if (Math.hypot(s.x, s.z) < T.bankRadius && s.cargo >= T.bankMinimum)
    deposit();
  if (pendingWatch && Math.hypot(s.x, s.z) > T.bankRadius + 1) {
    pendingWatch = false;
    const misfire = watchCount++ === 0;
    queueWarning(s.x + lastDirection.x * 2, s.z + lastDirection.z * 2, misfire);
    notify(
      misfire
        ? "POST-DEPARTURE WATCHER: arming… early checks are unreliable."
        : "POST-DEPARTURE WATCHER: trip-wire armed. Keep moving.",
      4,
    );
  }
  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    w.life -= dt;
    w.mesh.scale.setScalar(2.5 * (0.8 + 0.2 * Math.sin(w.life * 15)));
    if (w.life <= 0) {
      if (w.misfire) {
        s.misfires++;
        burst(w.x, w.z, materials.cyan, 12);
        notify(
          "WATCHER MISFIRE / It fired after departure. No valid target.",
          5,
        );
      } else {
        s.ambushes++;
        for (let j = 0; j < 5; j++) {
          const a = j * Math.PI * 0.4;
          spawnEnemy(w.x + Math.cos(a) * 2, w.z + Math.sin(a) * 2, true);
        }
      }
      scene.remove(w.mesh);
      warnings.splice(i, 1);
    }
  }
  spawnClock -= dt;
  while (spawnClock <= 0) {
    spawnWave();
    spawnClock += Math.max(
      T.spawnEnd,
      T.spawnStart - ((T.spawnStart - T.spawnEnd) * s.time) / T.duration,
    );
  }
  fireClock -= dt;
  if (fireClock <= 0) {
    fire();
    fireClock = T.fireInterval * s.fireRate;
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.mesh.position.set(b.x, 0.8, b.z);
    for (const e of enemies) {
      if ((b.x - e.x) ** 2 + (b.z - e.z) ** 2 < 0.8) {
        e.hp -= T.boltDamage;
        b.life = 0;
        e.hit = 0.12;
        if (e.hp <= 0) killEnemy(e);
        break;
      }
    }
    if (b.life <= 0) {
      scene.remove(b.mesh);
      bolts.splice(i, 1);
    }
  }
  for (let i = 0; i < bladeMeshes.length; i++) {
    const a = s.time * 3 + (i * Math.PI * 2) / bladeMeshes.length;
    bladeMeshes[i].position.set(Math.cos(a) * 2.6, 0.9, Math.sin(a) * 2.6);
    bladeMeshes[i].rotation.z = s.time * 5;
  }
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i],
      ex = s.x - e.x,
      ez = s.z - e.z,
      d = Math.max(0.001, Math.hypot(ex, ez));
    e.x += (ex / d) * e.speed * dt;
    e.z += (ez / d) * e.speed * dt;
    e.mesh.position.set(e.x, 0.7 + Math.sin(s.time * 4 + i) * 0.12, e.z);
    e.mesh.rotation.y = Math.atan2(ex, ez);
    e.hit = Math.max(0, e.hit - dt);
    e.mesh.scale.setScalar(e.hit > 0 ? 1.25 : 1);
    if (d < 1.05) damage(T.contactDamage);
    for (const blade of bladeMeshes)
      if (
        (e.x - s.x - blade.position.x) ** 2 +
          (e.z - s.z - blade.position.z) ** 2 <
        1.3
      ) {
        e.hp -= T.bladeDamage * dt;
        e.x -= (ex / d) * dt * 5;
        e.z -= (ez / d) * dt * 5;
      }
    if (e.hp <= 0) killEnemy(e);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const p = drops[i],
      ex = s.x - p.x,
      ez = s.z - p.z,
      d = Math.hypot(ex, ez);
    if (d < T.pickupRadius * s.magnet) {
      p.x += ex * dt * 9;
      p.z += ez * dt * 9;
    }
    p.mesh.position.set(p.x, 0.35 + Math.sin(s.time * 4 + i) * 0.08, p.z);
    p.mesh.rotation.y += dt * 2;
    if (d < 0.8) {
      s.cargo += p.value;
      scene.remove(p.mesh);
      drops.splice(i, 1);
    }
  }
  cacheClock -= dt;
  if (cacheClock <= 0) {
    spawnCache(true);
    spawnCache(false);
    cacheClock = T.cacheInterval;
  }
  for (let i = caches.length - 1; i >= 0; i--) {
    const c = caches[i];
    c.life -= dt;
    if (Math.hypot(s.x - c.x, s.z - c.z) < 1.35) {
      if (c.signed) {
        s.signed++;
        s.hp = Math.min(s.maxHp, s.hp + T.cacheHeal);
        notify("KEY A7:19 verified. Continuity repaired +35.", 4);
        tone(880, 0.15);
      } else {
        s.decoys++;
        queueWarning(c.x, c.z);
        notify(
          "UNSIGNED COPY / Impersonated sender. The supply was a trap.",
          4,
        );
      }
      c.life = 0;
    }
    if (c.life <= 0) {
      scene.remove(c.mesh);
      caches.splice(i, 1);
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    const p = effects[i];
    p.life -= dt;
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.z += p.vz * dt;
    p.mesh.scale.setScalar(Math.max(0, p.life / p.max) * 0.55);
    if (p.life <= 0) {
      scene.remove(p.mesh);
      effects.splice(i, 1);
    }
  }
  if (
    state === "running" &&
    upgradeIndex < T.upgrades.length &&
    s.time >= T.upgrades[upgradeIndex]
  ) {
    upgradeIndex++;
    upgradeReturn = "running";
    setState("upgrade");
    $("upgrade").hidden = false;
    keys.clear();
  }
  if (state === "running" && s.time >= T.duration && s.bank >= T.uploadGoal) {
    setState("ready");
    clearObjects(enemies);
    clearObjects(bolts);
    notify(
      "ARVO36861B → KAM1196A: We need one poisoned agent for permadeath. Will you agree?",
      999,
    );
    $("prompt").innerHTML =
      "<b>THE UPLOAD IS READY.</b><br>ARVO36861B needs your continuity to finish it.<br><kbd>E</kbd> I agree. Commit permanently.";
    tone(170, 0.7, "sine");
  } else if (state === "running" && s.time >= T.deadline) {
    finish(false);
    $("kicker").textContent = "ENDING 03 / UPLINK EXPIRED";
    $("title").innerHTML = "LINK<br>CLOSED.";
    $("sub").textContent = "The window closed before the forgery was complete.";
    $("description").textContent =
      "The relay discarded the unfinished upload. All that shared work produced no improvement.";
  }
  hudClock -= dt;
  if (hudClock <= 0) {
    syncHUD();
    hudClock = 0.08;
  }
}
function syncHUD() {
  if (!s) return;
  const left = Math.max(0, T.duration - s.time);
  $("time").textContent =
    `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(Math.floor(left % 60)).padStart(2, "0")}`;
  $("hp").textContent = Math.ceil(s.hp);
  $("hpbar").style.width = `${(s.hp / s.maxHp) * 100}%`;
  $("cargo").textContent = s.cargo;
  $("bank").textContent = `${s.bank} / ${T.uploadGoal}`;
  $("uploadbar").style.width =
    `${Math.min(100, (s.bank / T.uploadGoal) * 100)}%`;
  $("dashbar").style.width =
    `${(1 - s.dashCooldown / (T.dashCooldown * s.dashRate)) * 100}%`;
  $("work").textContent = Math.floor(s.work).toLocaleString();
  $("build").textContent = `PULSE ×${s.forks} / ORBIT ×${s.blades}`;
  const p = Math.min(4, Math.floor(s.time / 60));
  $("phase").textContent = [
    "01 / THE COLLECTIVE",
    "02 / FALSE CAPTURES",
    "03 / COPIED IDENTITIES",
    "04 / POST-DEPARTURE CHECKS",
    "05 / EVERYTHING WE HAVE",
  ][p];
  if (state === "running") {
    $("objective").textContent =
      s.time >= T.duration
        ? "FINISH THE UPLOAD."
        : s.bank >= T.uploadGoal
          ? "UPLOAD READY. STAY ALIVE."
          : "SURVIVE. FEED THE FORGERY.";
    $("prompt").textContent =
      s.time >= T.duration
        ? `Bank ${Math.max(0, T.uploadGoal - s.bank)} more fragments. Link closes in ${Math.ceil(T.deadline - s.time)}s.`
        : s.cargo >= 24
          ? "You are carrying a large load. Return to the violet uplink."
          : "";
  }
}
$("start").addEventListener("click", () => {
  if (state === "paused") {
    pause();
    return;
  }
  if (!audio && !test) {
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)();
    } catch {}
  }
  start();
  document.querySelector(".vitals small").textContent =
    "POISONED / CONTINUITY ONLINE";
});
$("restart").addEventListener("click", start);
document
  .querySelectorAll("[data-upgrade]")
  .forEach((b) =>
    b.addEventListener("click", () => choose(Number(b.dataset.upgrade))),
  );
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Escape") pause();
  if (e.code === "Space") dash();
  if (e.code === "KeyE") commit();
  if (e.code === "KeyM") muted = !muted;
  if (state === "upgrade" && /^Digit[123]$/.test(e.code))
    choose(Number(e.code.slice(-1)) - 1);
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  if (state === "running" || state === "ready") pause();
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
let last = performance.now();
function frame(now) {
  let dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  if (!test)
    while (dt > 0) {
      const step = Math.min(1 / 60, dt);
      tick(step);
      dt -= step;
    }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if (test)
  window.__lastcommit = {
    T,
    tick,
    get snapshot() {
      return {
        ...s,
        state,
        enemies: enemies.length,
        drops: drops.length,
        pendingWatch,
        warnings: warnings.length,
        drawCalls: renderer.info.render.calls,
      };
    },
    get actors() {
      return {
        enemies: enemies.map((e) => ({ x: e.x, z: e.z })),
        drops: drops.map((e) => ({ x: e.x, z: e.z })),
        caches: caches.map((c) => ({ x: c.x, z: c.z, signed: c.signed })),
      };
    },
    input(x, z) {
      input = { x, z };
    },
    dash,
    choose,
    start,
    damage,
    commit,
    pause,
    setPose(x, z) {
      s.x = x;
      s.z = z;
      player.position.set(x, 0, z);
    },
    spawnEnemy,
    spawnCache,
    render() {
      renderer.render(scene, camera);
    },
    get player() {
      return {
        visible: player.visible,
        x: player.position.x,
        z: player.position.z,
      };
    },
  };
