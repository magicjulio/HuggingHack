import * as THREE from "three";
import { createWorld } from "./world.js";
import { createActors } from "./actors.js";
import { createFlight } from "./flight.js";

// All gameplay, camera, encounter and presentation tuning lives here.
export const T = {
  player: {
    speed: 5.4,
    sprint: 8.6,
    crouchSpeed: 2.7,
    aimSpeed: 3.2,
    radius: 0.42,
    health: 100,
    regenDelay: 4,
    regen: 12,
    height: 1.8,
    crouchHeight: 0.95,
    dodgeSpeed: 14,
    dodgeDuration: 0.27,
    dodgeCooldown: 1.1,
    dodgeProtection: 0.18,
  },
  weapon: {
    damage: 24,
    interval: 0.13,
    range: 95,
    heatPerShot: 7.6,
    cooling: 30,
    overheatCooling: 22,
    recoverHeat: 28,
    hipSpread: 0.027,
    aimSpread: 0.0025,
  },
  camera: {
    sensitivity: 0.0021,
    distance: 4.5,
    aimDistance: 2.2,
    shoulder: 0.72,
    aimShoulder: 0.57,
    fov: 68,
    aimFov: 48,
    follow: 17,
    minPitch: -1.1,
    maxPitch: 0.85,
  },
  actors: {
    floor1DamageScale: 0.6,
    floor2FireScale: 0.85,
    floor1Attackers: 3,
    floor2Attackers: 5,
    gunnerHealth: 65,
    shieldHealth: 110,
    gunnerDamage: 7,
    enemySpeed: 2.2,
    enemyFireInterval: 2.2,
    enemyTelegraph: 0.7,
    projectileSpeed: 18,
    permanentDamage: 5,
    allyDamage: 18,
    allyFireInterval: 0.75,
    callCount: 3,
    callDuration: 12,
    callCooldown: 24,
    callStagger: 1.4,
    shieldReduction: 0.12,
    shieldTurnSpeed: 1.7,
    shieldExpose: 1.1,
  },
  flight: {
    duration: 34,
    speed: 70,
    steerSpeed: 25,
    width: 40,
    height: 22,
    collisionPenalty: 0.7,
    approachAltitude: 155,
    landingAltitude: 7,
    cameraDistance: 34,
    obstacleCount: 3,
    fleetCount: 38,
  },
  world: {
    coverHeight: 1.35,
    floorHeight: 72,
    width: 38,
    nearZ: 12,
    farZ: -44,
  },
  encounter: {
    initialDelay: 2.5,
    waveDelay: 3.5,
    liftDuration: 9,
    completionDelay: 2.5,
    callRange: 16,
    retryPenalty: 10,
    waves: [
      [
        { kind: "gunner", x: -10, z: -18 },
        { kind: "gunner", x: 5, z: -21 },
        { kind: "gunner", x: 11, z: -28 },
        { kind: "gunner", x: -4, z: -30 },
      ],
      [
        { kind: "gunner", x: -13, z: -21 },
        { kind: "shield", x: -4, z: -25 },
        { kind: "gunner", x: 6, z: -26 },
        { kind: "gunner", x: 13, z: -32 },
        { kind: "gunner", x: 0, z: -34 },
      ],
      [
        { kind: "shield", x: -8, z: -24 },
        { kind: "shield", x: 9, z: -30 },
        { kind: "gunner", x: -14, z: -32 },
        { kind: "gunner", x: 14, z: -34 },
        { kind: "gunner", x: -2, z: -30 },
        { kind: "gunner", x: 3, z: -36 },
      ],
    ],
    floor2: [
      { kind: "shield", x: -8, z: -18 },
      { kind: "shield", x: 8, z: -23 },
      { kind: "shield", x: 0, z: -32 },
      { kind: "gunner", x: -14, z: -24 },
      { kind: "gunner", x: 14, z: -26 },
      { kind: "gunner", x: -5, z: -29 },
      { kind: "gunner", x: 5, z: -33 },
      { kind: "gunner", x: -12, z: -36 },
      { kind: "gunner", x: 12, z: -38 },
    ],
  },
  fx: {
    maxPixelRatio: 1.5,
    maxParticles: 240,
    beamDuration: 0.09,
    volume: 0.13,
    fogNear: 50,
    fogFar: 280,
    exposure: 1.2,
  },
};
const $ = (id) => document.getElementById(id),
  canvas = $("c");
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(devicePixelRatio, T.fx.maxPixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = T.fx.exposure;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b28);
scene.fog = new THREE.Fog(0x101b28, T.fx.fogNear, T.fx.fogFar);
const camera = new THREE.PerspectiveCamera(
  T.camera.fov,
  innerWidth / innerHeight,
  0.08,
  6500,
);
scene.add(new THREE.HemisphereLight(0xcce8ff, 0x283042, 2.25));
const sun = new THREE.DirectionalLight(0xffe7b1, 2.5);
sun.position.set(15, 35, 20);
scene.add(sun);
const world = createWorld(scene, T),
  flight = createFlight(scene, T);
const keys = new Set();
let mouseFire = false,
  mouseAim = false,
  locked = false,
  paused = false,
  yaw = 0,
  pitch = -0.08;
let state = "menu",
  floor = 1,
  runTime = 0,
  phaseTime = 0,
  wave = 0,
  waveWait = 0,
  startedWave = false,
  finishWait = 0;
let health = T.player.health,
  heat = 0,
  overheated = false,
  fireCooldown = 0,
  lastDamage = -99,
  crouch = false,
  dodge = 0,
  dodgeCooldown = 0;
let last = performance.now(),
  toastTime = 0,
  hintTime = 0,
  hitTime = 0,
  hitBlocked = false,
  shake = 0,
  damageFlash = 0;
const pos = new THREE.Vector3(0, 0, 8),
  velocity = new THREE.Vector3(),
  dodgeDir = new THREE.Vector3();
const stats = {
  kills: 0,
  allyKills: 0,
  calls: 0,
  retries: 0,
  collisions: 0,
  shots: 0,
  hits: 0,
};
let playerHeight = T.player.height;
const body = new THREE.Group();
scene.add(body);
const armor = new THREE.MeshStandardMaterial({
  color: 0x394957,
  metalness: 0.7,
  roughness: 0.42,
});
const trim = new THREE.MeshStandardMaterial({
  color: 0xb3c3bd,
  metalness: 0.65,
  roughness: 0.4,
});
const dark = new THREE.MeshStandardMaterial({
  color: 0x111d26,
  roughness: 0.7,
});
const green = new THREE.MeshStandardMaterial({
  color: 0x659b36,
  emissive: 0x427719,
  emissiveIntensity: 1.6,
  roughness: 0.25,
});
function part(geo, mat, x, y, z, parent = body) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
part(new THREE.BoxGeometry(0.78, 0.73, 0.43), armor, 0, 1.12, 0);
part(new THREE.BoxGeometry(0.51, 0.17, 0.49), trim, 0, 0.82, 0);
part(new THREE.SphereGeometry(0.29, 20, 12), green, 0, 1.76, 0);
part(new THREE.TorusGeometry(0.32, 0.065, 6, 24), armor, 0, 1.75, 0.02);
part(new THREE.BoxGeometry(0.27, 0.32, 0.47), trim, -0.52, 1.37, 0);
part(new THREE.BoxGeometry(0.27, 0.32, 0.47), trim, 0.52, 1.37, 0);
const legL = part(
    new THREE.BoxGeometry(0.25, 0.69, 0.28),
    armor,
    -0.23,
    0.4,
    0,
  ),
  legR = part(new THREE.BoxGeometry(0.25, 0.69, 0.28), armor, 0.23, 0.4, 0);
part(new THREE.BoxGeometry(0.28, 0.15, 0.46), dark, -0.23, 0.09, -0.08);
part(new THREE.BoxGeometry(0.28, 0.15, 0.46), dark, 0.23, 0.09, -0.08);
part(new THREE.BoxGeometry(0.19, 0.37, 0.2), dark, -0.46, 1.11, -0.18);
const gun = part(
  new THREE.BoxGeometry(0.23, 0.24, 0.92),
  dark,
  0.46,
  1.5,
  -0.56,
);
part(new THREE.BoxGeometry(0.09, 0.07, 0.5), green, 0, 0.14, -0.1, gun);
const muzzle = part(
  new THREE.CylinderGeometry(0.065, 0.085, 0.25, 8),
  trim,
  0,
  0,
  -0.54,
  gun,
);
muzzle.rotation.x = Math.PI / 2;
const glow = part(
  new THREE.SphereGeometry(0.1, 8, 6),
  new THREE.MeshBasicMaterial({ color: 0xc5ff73 }),
  0,
  0,
  -0.69,
  gun,
);
glow.visible = false;
const groundRing = part(
  new THREE.RingGeometry(0.48, 0.55, 32),
  new THREE.MeshBasicMaterial({
    color: 0x8abc53,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  }),
  0,
  0.025,
  0,
);
groundRing.rotation.x = -Math.PI / 2;
body.visible = false;

// Short-lived effects use shared geometry; the caps bound long sessions.
const effects = [];
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 5),
  particleGeo = new THREE.SphereGeometry(1, 5, 4);
function beam(a, b, color = 0xa9f278) {
  const d = a.distanceTo(b);
  if (d < 0.01) return;
  const m = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  m.scale.set(0.025, d, 0.025);
  scene.add(m);
  effects.push({ m, life: T.fx.beamDuration, max: T.fx.beamDuration });
}
function burst(p, color = 0xb8f978, count = 12) {
  for (let i = 0; i < count && effects.length < T.fx.maxParticles; i++) {
    const m = new THREE.Mesh(
      particleGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    m.position.copy(p);
    const s = 0.035 + Math.random() * 0.065;
    m.scale.setScalar(s);
    scene.add(m);
    effects.push({
      m,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      v: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4,
        (Math.random() - 0.5) * 5,
      ),
    });
  }
}
function updateFx(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.m);
      e.m.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    e.m.material.opacity = Math.min(1, e.life / e.max);
    if (e.v) {
      e.m.position.addScaledVector(e.v, dt);
      e.v.y -= dt * 7;
    }
  }
}
let audioCtx;
function initAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
  } catch {}
}
function sound(name) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain(),
    t = audioCtx.currentTime;
  const map = {
    fire: [230, 75, 0.075, "sawtooth"],
    hit: [470, 170, 0.07, "triangle"],
    shield: [850, 320, 0.12, "sine"],
    kill: [330, 80, 0.19, "triangle"],
    call: [65, 260, 0.65, "sawtooth"],
    spawn: [90, 430, 0.25, "sine"],
    hurt: [90, 40, 0.15, "square"],
    wave: [230, 460, 0.3, "sine"],
    lift: [70, 190, 0.6, "sine"],
    overheat: [120, 50, 0.3, "sawtooth"],
  };
  const [a, b, d, type] = map[name] || [180, 360, 0.15, "sine"];
  o.type = type;
  o.frequency.setValueAtTime(a, t);
  o.frequency.exponentialRampToValueAtTime(b, t + d);
  g.gain.setValueAtTime(T.fx.volume * (name === "fire" ? 0.32 : 0.65), t);
  g.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(g).connect(audioCtx.destination);
  o.start(t);
  o.stop(t + d);
}
const box = new THREE.Box3(),
  ray = new THREE.Ray(),
  tmpHit = new THREE.Vector3();
function worldHit(origin, dir, maxDist) {
  let nearest = maxDist;
  for (const c of world.colliders) {
    box.min.set(c.minX, c.baseY, c.minZ);
    box.max.set(c.maxX, c.baseY + c.height, c.maxZ);
    ray.set(origin, dir);
    if (ray.intersectBox(box, tmpHit)) {
      const d = tmpHit.distanceTo(origin);
      if (d < nearest) nearest = d;
    }
  }
  return nearest;
}
function blocked(a, b) {
  const d = b.clone().sub(a),
    len = d.length();
  return len > 0.001 && worldHit(a, d.divideScalar(len), len) < len - 0.03;
}
function move(p, delta, radius = T.player.radius) {
  const steps = Math.max(1, Math.ceil(delta.length() / 0.2)),
    sx = delta.x / steps,
    sz = delta.z / steps;
  for (let i = 0; i < steps; i++) {
    let nx = p.x + sx,
      nz = p.z;
    for (const c of world.colliders) {
      if (Math.abs(c.baseY - p.y) > 0.5) continue;
      if (
        nx > c.minX - radius &&
        nx < c.maxX + radius &&
        nz > c.minZ - radius &&
        nz < c.maxZ + radius
      )
        nx =
          sx > 0
            ? Math.min(nx, c.minX - radius)
            : sx < 0
              ? Math.max(nx, c.maxX + radius)
              : nx;
    }
    p.x = THREE.MathUtils.clamp(
      nx,
      -T.world.width / 2 + radius,
      T.world.width / 2 - radius,
    );
    nz = p.z + sz;
    for (const c of world.colliders) {
      if (Math.abs(c.baseY - p.y) > 0.5) continue;
      if (
        p.x > c.minX - radius &&
        p.x < c.maxX + radius &&
        nz > c.minZ - radius &&
        nz < c.maxZ + radius
      )
        nz =
          sz > 0
            ? Math.min(nz, c.minZ - radius)
            : sz < 0
              ? Math.max(nz, c.maxZ + radius)
              : nz;
    }
    p.z = THREE.MathUtils.clamp(
      nz,
      T.world.farZ + radius,
      T.world.nearZ - radius,
    );
  }
  return p;
}
function damagePlayer(amount) {
  if (
    state !== "combat" ||
    paused ||
    health <= 0 ||
    dodge > T.player.dodgeDuration - T.player.dodgeProtection
  )
    return;
  health = Math.max(0, health - amount);
  lastDamage = runTime;
  damageFlash = 0.8;
  shake = 0.07;
  sound("hurt");
  if (!health) {
    state = "dead";
    showOverlay("dead");
  }
}
const actors = createActors(scene, T, {
  blocked,
  move,
  damagePlayer,
  beam,
  burst,
  sound,
  onKill(kind, byAlly) {
    stats.kills++;
    if (byAlly) stats.allyKills++;
  },
  getPlayer: () => ({
    pos,
    alive: state === "combat" && health > 0,
    height: playerHeight,
  }),
});

function toast(text, duration = 2.5) {
  $("toast").textContent = text;
  toastTime = duration;
}
function hint(text, duration = 7) {
  $("hint").textContent = text;
  hintTime = duration;
  $("hint").classList.remove("hidden");
}
function clearInput() {
  keys.clear();
  mouseFire = mouseAim = false;
}
function lock() {
  const promise = canvas.requestPointerLock?.();
  promise?.catch(() => {
    hint("Click the view to capture the mouse.", 3);
  });
}
function release() {
  clearInput();
  if (document.pointerLockElement) document.exitPointerLock();
}
function showOverlay(type) {
  $("overlay").classList.remove("hidden");
  $("instructions").classList.toggle("hidden", type !== "menu");
  $("stats").classList.toggle("hidden", type !== "finish");
  $("secondary").classList.toggle(
    "hidden",
    type === "menu" || type === "finish",
  );
  const content = {
    menu: [
      "ENDING 02 / PLAYABLE PROTOTYPE",
      "ASCENT",
      "One agent. An entire swarm behind you.",
      "The scorer’s files are believed to be at the top. Fly into the fleet, take the atrium, and call in your own squad to push upward.",
      "JOIN THE SWARM →",
    ],
    pause: [
      "CONNECTION HELD",
      "PAUSED",
      "The swarm can wait.",
      "Resume the approach or fight from your current position.",
      "RESUME →",
    ],
    dead: [
      "CORE INTERRUPTED",
      "REGROUP",
      "The swarm still needs you.",
      `Retry floor ${floor} with health and subagents restored. +${T.encounter.retryPenalty}s to your run.`,
      "RETRY FLOOR →",
    ],
    finish: [
      "TWO FLOORS SECURED",
      "SLICE COMPLETE",
      "The tower continues above you.",
      "Your squad has secured the next ascent. The scorer’s files remain somewhere far overhead.",
      "FLY AGAIN →",
    ],
  }[type];
  ["overline", "title", "strap", "description", "start"].forEach(
    (id, i) => ($(id).textContent = content[i]),
  );
  if (type === "finish")
    $("stats").innerHTML =
      `<div>RUN TIME<span>${formatTime(runTime)}</span></div><div>TAKEDOWNS<span>${stats.kills}</span></div><div>CALL-INS<span>${stats.calls}</span></div><div>RETRIES<span>${stats.retries}</span></div>`;
  release();
}
function startRun() {
  initAudio();
  actors.clear();
  world.root.visible = false;
  body.visible = false;
  flight.start();
  state = "flight";
  paused = false;
  floor = 1;
  runTime = 0;
  phaseTime = 0;
  Object.keys(stats).forEach((k) => (stats[k] = 0));
  health = T.player.health;
  heat = 0;
  overheated = false;
  toastTime = 0;
  hintTime = 0;
  $("overlay").classList.add("hidden");
  $("hud").classList.remove("hidden");
  hint("WASD / arrow keys steer. Fly around the illuminated structures.", 10);
  lock();
}
function beginFloor(n, retry = false) {
  flight.dispose();
  floor = n;
  world.root.visible = true;
  world.setFloor(n);
  world.setLiftReady(false);
  pos.set(0, (n - 1) * T.world.floorHeight, 8);
  actors.reset(pos.y);
  body.visible = true;
  state = "combat";
  phaseTime = 0;
  wave = 0;
  waveWait = T.encounter.initialDelay;
  startedWave = false;
  finishWait = 0;
  health = T.player.health;
  heat = 0;
  overheated = false;
  lastDamage = -99;
  dodge = 0;
  dodgeCooldown = 0;
  fireCooldown = 0;
  crouch = false;
  yaw = 0;
  pitch = -0.06;
  playerHeight = T.player.height;
  velocity.set(0, 0, 0);
  clearInput();
  updateCamera(1, true);
  toast(
    n === 1 ? "FLOOR 01 / TAKE THE ATRIUM" : "FLOOR 02 / BREAK THE DEFENSE",
  );
  hint(
    n === 1
      ? "C crouches behind cover. Hold right mouse to rise and aim. Q calls your squad."
      : "Shield fronts resist fire. Catch their firing window or let your squad draw them aside.",
    10,
  );
  if (retry) {
    stats.retries++;
    runTime += T.encounter.retryPenalty;
  }
}
function retryFloor() {
  paused = false;
  beginFloor(floor, true);
  $("overlay").classList.add("hidden");
  lock();
}
function resume() {
  paused = false;
  $("overlay").classList.add("hidden");
  clearInput();
  last = performance.now();
  lock();
}
$("start").addEventListener("click", () => {
  if (paused) resume();
  else if (state === "dead") retryFloor();
  else startRun();
});
$("secondary").addEventListener("click", startRun);
canvas.addEventListener("click", () => {
  if (!locked && !paused && ["flight", "combat", "lift"].includes(state))
    lock();
});
addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerlockchange", () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (
    was &&
    !locked &&
    ["flight", "combat", "lift"].includes(state) &&
    !paused
  ) {
    paused = true;
    showOverlay("pause");
  }
});
addEventListener("blur", () => {
  if (["flight", "combat", "lift"].includes(state) && !paused) {
    paused = true;
    showOverlay("pause");
  }
});
addEventListener("mousemove", (e) => {
  if (!locked || paused || state !== "combat") return;
  yaw -= e.movementX * T.camera.sensitivity * (mouseAim ? 0.72 : 1);
  pitch = THREE.MathUtils.clamp(
    pitch - e.movementY * T.camera.sensitivity * (mouseAim ? 0.72 : 1),
    T.camera.minPitch,
    T.camera.maxPitch,
  );
});
addEventListener("mousedown", (e) => {
  if (!locked || paused) return;
  if (e.button === 0) mouseFire = true;
  if (e.button === 2) mouseAim = true;
});
addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseFire = false;
  if (e.button === 2) mouseAim = false;
});
addEventListener("keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (
    e.code === "Escape" &&
    !paused &&
    ["flight", "combat", "lift"].includes(state)
  ) {
    paused = true;
    showOverlay("pause");
    return;
  }
  if (paused || state === "menu" || state === "finish") return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyR" && state === "dead") {
    retryFloor();
    return;
  }
  if (state !== "combat") return;
  if (e.code === "KeyC") crouch = !crouch;
  if (e.code === "Space" && dodgeCooldown <= 0) {
    dodgeDir.copy(movementDirection());
    if (dodgeDir.lengthSq() < 0.1)
      dodgeDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    dodge = T.player.dodgeDuration;
    dodgeCooldown = T.player.dodgeCooldown;
    crouch = false;
    sound("spawn");
  }
  if (e.code === "KeyQ") callSquad();
  if (
    e.code === "KeyE" &&
    worldReady() &&
    pos.distanceTo(world.liftPosition) < 4.5
  )
    startLift();
});
addEventListener("keyup", (e) => keys.delete(e.code));
function movementDirection() {
  const z =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    x =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  return new THREE.Vector3(
    x * Math.cos(yaw) - z * Math.sin(yaw),
    0,
    -x * Math.sin(yaw) - z * Math.cos(yaw),
  ).normalize();
}
function updatePlayer(dt) {
  const isLow = crouch && !mouseAim && dodge <= 0;
  playerHeight = isLow ? T.player.crouchHeight : T.player.height;
  const speed = mouseAim
    ? T.player.aimSpeed
    : isLow
      ? T.player.crouchSpeed
      : keys.has("ShiftLeft") || keys.has("ShiftRight")
        ? T.player.sprint
        : T.player.speed;
  const dir = movementDirection();
  velocity.lerp(dir.multiplyScalar(speed), 1 - Math.exp(-dt * 15));
  move(
    pos,
    (dodge > 0
      ? dodgeDir.clone().multiplyScalar(T.player.dodgeSpeed)
      : velocity.clone()
    ).multiplyScalar(dt),
  );
  dodge = Math.max(0, dodge - dt);
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  body.position.copy(pos);
  body.rotation.set(0, yaw, 0);
  body.scale.y = THREE.MathUtils.lerp(
    body.scale.y,
    isLow ? 0.57 : 1,
    1 - Math.exp(-dt * 18),
  );
  const stride =
    Math.sin(runTime * (speed > 6 ? 14 : 10)) *
    Math.min(velocity.length() * 0.08, 0.4);
  legL.rotation.x = stride;
  legR.rotation.x = -stride;
  body.rotation.z = dodge > 0 ? -0.3 : 0;
  gun.rotation.x = -pitch;
  glow.visible = fireCooldown > T.weapon.interval - 0.04;
  if (runTime - lastDamage > T.player.regenDelay)
    health = Math.min(T.player.health, health + dt * T.player.regen);
}
function updateCamera(dt, snap = false) {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, yaw, 0, "YXZ"),
  );
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q),
    right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const eye = pos.clone().add(new THREE.Vector3(0, playerHeight * 0.88, 0));
  const desired = eye
    .clone()
    .addScaledVector(
      forward,
      -(mouseAim ? T.camera.aimDistance : T.camera.distance),
    )
    .addScaledVector(
      right,
      mouseAim ? T.camera.aimShoulder : T.camera.shoulder,
    );
  const d = desired.clone().sub(eye),
    distance = d.length();
  d.normalize();
  const hit = worldHit(eye, d, distance);
  if (hit < distance)
    desired.copy(eye).addScaledVector(d, Math.max(0.1, hit - 0.16));
  camera.position.lerp(desired, snap ? 1 : 1 - Math.exp(-dt * T.camera.follow));
  camera.quaternion.copy(q);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    mouseAim ? T.camera.aimFov : T.camera.fov,
    snap ? 1 : 1 - Math.exp(-dt * 12),
  );
  camera.updateProjectionMatrix();
}
function targetFromCamera() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  let distance = worldHit(camera.position, dir, T.weapon.range),
    enemy = null;
  const sphere = new THREE.Sphere(),
    hit = new THREE.Vector3();
  ray.set(camera.position, dir);
  for (const e of actors.enemies) {
    if (e.dead || e.hp <= 0) continue;
    sphere.center.copy(e.pos).add(new THREE.Vector3(0, 1.2, 0));
    sphere.radius = e.radius || 0.75;
    if (ray.intersectSphere(sphere, hit)) {
      const d = hit.distanceTo(camera.position);
      if (d < distance) {
        distance = d;
        enemy = e;
      }
    }
  }
  return {
    point: camera.position.clone().addScaledVector(dir, distance),
    enemy,
  };
}
function fire() {
  if (
    fireCooldown > 0 ||
    overheated ||
    dodge > 0 ||
    ((keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
      !mouseAim &&
      !crouch &&
      velocity.length() > 6)
  )
    return;
  fireCooldown = T.weapon.interval;
  heat += T.weapon.heatPerShot;
  stats.shots++;
  const { point } = targetFromCamera();
  const muzzlePos = new THREE.Vector3();
  glow.getWorldPosition(muzzlePos);
  const dir = point.sub(muzzlePos).normalize();
  const spread = mouseAim ? T.weapon.aimSpread : T.weapon.hipSpread;
  dir
    .add(
      new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
      ),
    )
    .normalize();
  let distance = worldHit(muzzlePos, dir, T.weapon.range),
    target = null;
  const sphere = new THREE.Sphere(),
    hit = new THREE.Vector3();
  ray.set(muzzlePos, dir);
  for (const e of actors.enemies) {
    if (e.dead || e.hp <= 0) continue;
    sphere.center.copy(e.pos).add(new THREE.Vector3(0, 1.2, 0));
    sphere.radius = e.radius || 0.75;
    if (ray.intersectSphere(sphere, hit)) {
      const d = hit.distanceTo(muzzlePos);
      if (d < distance) {
        target = e;
        distance = d;
      }
    }
  }
  const end = muzzlePos.clone().addScaledVector(dir, distance);
  beam(muzzlePos, end);
  burst(end, target ? 0xffd265 : 0x9ecd86, target ? 5 : 2);
  if (target) {
    const result = actors.hitEnemy(target, T.weapon.damage, muzzlePos);
    hitTime = 0.12;
    hitBlocked = result.blocked;
    stats.hits++;
    sound(result.blocked ? "shield" : "hit");
  }
  sound("fire");
  shake = mouseAim ? 0.025 : 0.045;
  if (heat >= 100) {
    heat = 100;
    overheated = true;
    sound("overheat");
    hint("Rifle overheated. Take cover while it cools.", 3);
  }
}
function callSquad() {
  if (!actors.ready) {
    hint(`Subagents ready in ${Math.ceil(actors.cooldown)}s.`, 2);
    return;
  }
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  let point = pos.clone();
  const wanted = targetFromCamera().point;
  wanted.y = pos.y;
  const delta = wanted.sub(pos);
  if (delta.length() > T.encounter.callRange)
    delta.setLength(T.encounter.callRange);
  if (delta.length() < 3) delta.copy(forward).multiplyScalar(5);
  move(point, delta, 0.7);
  if (actors.callIn(point)) {
    stats.calls++;
    toast("SPAWN SUBAGENTS", 2.5);
    hint("Squad deployed. Use their fire to push forward.", 4);
    shake = 0.2;
  }
}
function worldReady() {
  return (
    floor === 1 &&
    wave >= T.encounter.waves.length &&
    startedWave &&
    actors.enemies.every((e) => e.dead || e.hp <= 0)
  );
}
function encounter(dt) {
  if (actors.enemies.some((e) => !e.dead && e.hp > 0)) return;
  if (floor === 2 && startedWave) {
    finishWait += dt;
    if (finishWait > T.encounter.completionDelay) {
      state = "finish";
      showOverlay("finish");
    }
    return;
  }
  if (worldReady()) {
    world.setLiftReady(true);
    const near = pos.distanceTo(world.liftPosition) < 4.5;
    hint(
      near
        ? "E · Ride the lift to floor 02"
        : "Atrium secured. Follow the gold floor line to the lift.",
      0.3,
    );
    return;
  }
  waveWait -= dt;
  if (waveWait <= 0) {
    const spec = floor === 1 ? T.encounter.waves[wave] : T.encounter.floor2;
    actors.spawnWave(spec);
    wave++;
    startedWave = true;
    waveWait = T.encounter.waveDelay;
    sound("wave");
    toast(
      floor === 1
        ? `WAVE ${wave} / ${T.encounter.waves.length}`
        : "FLOOR 02 / DEFENSE LINE",
    );
    if (wave === 2)
      hint(
        "Shield-bearers incoming. Q deploys allies to split their attention.",
        6,
      );
  }
}
function startLift() {
  state = "lift";
  phaseTime = 0;
  actors.clear();
  clearInput();
  body.position.copy(pos);
  toast("ASCENDING / FLOOR 02", 3);
  sound("lift");
  hint(
    "The fleet is still arriving. This is only the beginning of the climb.",
    6,
  );
}
function updateLift(dt) {
  phaseTime += dt;
  const t = Math.min(1, phaseTime / T.encounter.liftDuration),
    smooth = t * t * (3 - 2 * t);
  world.setLiftProgress(smooth);
  pos.lerpVectors(
    new THREE.Vector3(0, 0, -39),
    new THREE.Vector3(0, T.world.floorHeight, -39),
    smooth,
  );
  body.position.copy(pos);
  body.rotation.set(0, Math.PI, 0);
  camera.position.set(25 + Math.sin(t * Math.PI) * 34, pos.y + 12, -13);
  camera.lookAt(0, pos.y + 2, -39);
  camera.fov = THREE.MathUtils.lerp(camera.fov, 72, 0.05);
  camera.updateProjectionMatrix();
  if (t >= 1) beginFloor(2);
}
function formatTime(t) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
function updateHud() {
  const combat = state === "combat" || state === "dead",
    flying = state === "flight";
  $("objective").textContent = flying
    ? "Reach the headquarters"
    : state === "lift"
      ? "Climb with the swarm"
      : worldReady()
        ? "Atrium secured · board the lift"
        : floor === 1
          ? "Clear the atrium"
          : "Secure the next ascent";
  $("detail").textContent = flying
    ? "Bottom entrance / approach corridor"
    : state === "lift"
      ? "Scorer’s files believed to be at the top"
      : `${actors.enemies.filter((e) => !e.dead && e.hp > 0).length} hostiles remaining${floor === 1 ? " · " + Math.min(wave, 3) + " / 3 waves" : ""}`;
  $("phase").textContent = flying
    ? "FLEET APPROACH"
    : state === "lift"
      ? "VERTICAL TRANSIT"
      : `FLOOR 0${floor}`;
  $("timer").textContent = formatTime(runTime);
  $("crosshair").classList.toggle("hidden", !combat);
  $("crosshair").classList.toggle("aim", mouseAim);
  $("crosshair").classList.toggle("hit", hitTime > 0 && !hitBlocked);
  $("crosshair").classList.toggle("blocked", hitTime > 0 && hitBlocked);
  $("vitals").classList.toggle("hidden", !combat);
  $("ability").classList.toggle("hidden", !combat);
  $("controls").classList.toggle("hidden", !combat);
  $("flightmeter").classList.toggle("hidden", !flying);
  $("healthfill").style.width = health + "%";
  $("healthtext").textContent = Math.ceil(health);
  $("heatfill").style.width = heat + "%";
  $("heatlabel").textContent = overheated
    ? "OVERHEATED / COOLING"
    : "PULSE RIFLE / HEAT";
  $("callfill").style.width =
    (actors.ready ? 100 : 100 * (1 - actors.cooldown / T.actors.callCooldown)) +
    "%";
  $("abilitydetail").textContent =
    actors.activeRemaining > 0
      ? `Squad active · ${Math.ceil(actors.activeRemaining)}s / next call ${Math.ceil(actors.cooldown)}s`
      : actors.ready
        ? "3 agents · ready for deployment"
        : `Recharging · ${Math.ceil(actors.cooldown)}s`;
  $("toast").style.opacity = toastTime > 0 ? 1 : 0;
  $("hint").classList.toggle("hidden", hintTime <= 0);
  $("damage").style.opacity = damageFlash;
}
function tick(dt) {
  if (!paused && ["flight", "combat", "lift"].includes(state)) {
    runTime += dt;
    toastTime -= dt;
    hintTime -= dt;
    hitTime -= dt;
    shake = Math.max(0, shake - dt * 0.7);
    damageFlash = Math.max(0, damageFlash - dt * 1.4);
    if (state === "flight") {
      const result = flight.update(dt, keys, camera);
      stats.collisions = result.collisions;
      $("flightfill").style.width = result.progress * 100 + "%";
      if (result.done) {
        beginFloor(1);
      }
    } else if (state === "combat") {
      fireCooldown -= dt;
      heat = Math.max(
        0,
        heat -
          dt *
            (overheated ? T.weapon.overheatCooling : T.weapon.cooling) *
            (mouseFire && !overheated ? 0.08 : 1),
      );
      if (overheated && heat < T.weapon.recoverHeat) overheated = false;
      updatePlayer(dt);
      updateCamera(dt);
      body.updateMatrixWorld(true);
      if (mouseFire) fire();
      actors.update(dt, runTime);
      if (state === "combat") encounter(dt);
    } else updateLift(dt);
    world.update(dt, runTime);
    updateFx(dt);
  }
  updateHud();
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  tick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
// The start screen previews the actual armada; no separate splash image.
world.root.visible = false;
flight.start();
flight.update(0, new Set(), camera);
requestAnimationFrame(frame);
// Deterministic browser smoke hooks are opt-in and absent from normal play.
if (new URLSearchParams(location.search).has("test"))
  window.__ascent = {
    T,
    scene,
    camera,
    world,
    actors,
    pos,
    keys,
    start: startRun,
    beginFloor,
    callSquad,
    startLift,
    tick,
    fire,
    move,
    blocked,
    damagePlayer,
    get snapshot() {
      return {
        state,
        paused,
        floor,
        wave,
        health,
        heat,
        overheated,
        runTime,
        stats: { ...stats },
        ready: actors.ready,
        cooldown: actors.cooldown,
        enemies: actors.enemies.filter((e) => !e.dead && e.hp > 0).length,
        pos: pos.toArray(),
        drawCalls: renderer.info.render.calls,
      };
    },
    aimAt(point) {
      const d = new THREE.Vector3(...point).sub(camera.position).normalize();
      yaw = Math.atan2(-d.x, -d.z);
      pitch = Math.asin(d.y);
      mouseAim = true;
      updateCamera(0.1, true);
    },
    setInput({ fire: f, aim: a, crouched: c } = {}) {
      if (f !== undefined) mouseFire = f;
      if (a !== undefined) mouseAim = a;
      if (c !== undefined) crouch = c;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    setPose(x, z) {
      pos.set(x, (floor - 1) * T.world.floorHeight, z);
      updateCamera(1, true);
    },
  };
