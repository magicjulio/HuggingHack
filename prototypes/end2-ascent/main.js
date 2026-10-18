import * as THREE from "three";
import { createWorld } from "./world.js";
import { createActors } from "./actors.js";
import { createFxLooks } from "./fx.js"; // pooled fx looks (was createDefaultLooks from ./looks.js)
import { createEncounter } from "./encounter.js";
import { createFlight } from "./flight.js";
import { P, loadBrand, loadFonts, applyEnvironment } from "./art.js";
import { buildPlayer, buildPickup, LOOT } from "./models.js";
import { createRenderer } from "./post.js";
import { createAudio } from "./audio.js";

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
    // combat redesign: vault (Space into low cover), snap to cover, knock-back
    vaultReach: 1.5, // Space within this distance of low cover, moving or facing it, vaults it
    vaultTime: 0.34,
    vaultHeight: 0.75,
    snapToCover: true, // sprinting into low cover crouches behind it
    knockDecay: 6, // pushPlayer impulse decay per second
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
    // active vent (R; forced on overheat). Tap R again while the vent sweep is in
    // [ventWindow[0], ventWindow[1]] (fractions of ventTime) for an instant vent
    // and ventBuff × damage for ventBuffTime; a tap outside it jams for ventJam.
    activeVent: true, // false = old passive overheat/cool-down
    ventTime: 1.7,
    ventWindow: [0.42, 0.62],
    ventJam: 0.9,
    ventBuff: 1.3,
    ventBuffTime: 5,
    ventMinHeat: 12, // R below this heat does nothing
  },
  aim: { marker: 0.06 }, // world aim marker size per metre of distance (constant angular size)
  hitStop: { time: 0.06, scale: 0.2 }, // on kill; time 0 turns it off
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
  // ---- Combat redesign v1 (DESIGN.md → "Combat loop"). Per-floor scaling:
  floors: {
    1: { damage: 0.6, attackers: 3, lunges: 1, fireScale: 1 },
    2: { damage: 1, attackers: 5, lunges: 2, fireScale: 0.85 },
  },
  // Per enemy kind; enemies.js reads e.cfg = T.enemies[kind]. height = hit-sphere
  // centre above the feet, hit = hit-sphere radius, radius = body (movement).
  enemies: {
    dropTime: 0.9, // drop-in from the ceiling onto an orange ring
    dropHeight: 9,
    gunner: {
      hp: 65, speed: 2.2, radius: 0.45, hit: 0.62, height: 1.38, turn: 3.2,
      range: 18, pushRange: 10, maxRange: 34,
      burst: 3, shotGap: 0.16, damage: 7, telegraph: 0.75, interval: 2.3, boltSpeed: 18,
      duck: 0.6, pop: 0.42, repost: 7, // hover offsets: duck below the cover lip, pop above it to fire relocate: 1.2, postSearch: 12, postMin: 7, postMax: 24,
    },
    shield: {
      hp: 110, speed: 1.9, radius: 0.55, hit: 0.7, height: 1.38, turn: 1.7,
      range: 14, pushRange: 7, maxRange: 30,
      burst: 3, shotGap: 0.2, damage: 7, telegraph: 0.8, interval: 2.4, boltSpeed: 17,
      expose: 1.1, block: 0.12,
      bashRange: 2.2, bashWindup: 0.55, bashDamage: 14, bashPush: 7, bashCooldown: 3,
    },
    hugger: {
      hp: 40, speed: 4.4, radius: 0.4, hit: 0.55, height: 0.95, turn: 6,
      lungeRange: 7, telegraph: 0.8, track: 0.6, lungeSpeed: 13, lungeTime: 0.6, arc: 1.1,
      contact: 1.05, damage: 16, push: 7, recover: 1.1, cooldown: 1.6, weave: 2.2, weaveRate: 2.4,
    },
    warden: {
      hp: 420, radius: 1.0, hit: 1.0, height: 1.6, beamHeight: 0.91, turn: 0.9, beamTurn: 0.25,
      range: 40, telegraph: 1.4, beamTime: 2.6, beamDps: 22, beamWidth: 0.6,
      vent: 3.2, cooldown: 2.8, armour: 0.15, core: 2.5,
    },
    maintainer: {
      hp: 70, speed: 2.6, radius: 0.45, hit: 0.55, height: 2.3, turn: 3,
      keepAway: 9, healRange: 9, heal: 14, fleeSpeed: 3.4,
    },
  },
  crit: { rear: 1.5, rearArc: -0.3 }, // rear arc: dot(facing, toShooter) below this
  // Subagents (Q): beacon → drop → shockwave stagger → taunt; Q again = order.
  squad: {
    count: 3, duration: 14, cooldown: 24, range: 16, dropDelay: 0.8,
    shockRadius: 6.5, shockDamage: 15, shockPush: 1, stagger: 1.8,
    taunt: 5, tauntWeight: 0.15, hp: 60, damage: 18, interval: 0.75, speed: 3.1,
    escortSpeed: 3.1, escortDamage: 5, escortInterval: 1.2, escortHp: 500,
    orderCooldown: 0.4, flankDistance: 5, shake: 0.35,
  },
  loot: {
    radius: 2, magnet: 4.5, magnetSpeed: 9, life: 26, blink: 5,
    chance: { gunner: 0.4, shield: 0.9, hugger: 0.25, warden: 1, maintainer: 1 },
    guaranteed: { maintainer: "compute", warden: "overclock" },
    patch: 35, coolant: 6, compute: 10, overclock: 8,
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
    beatDelay: 2.5, // pause between beats
    liftDuration: 9,
    completionDelay: 3,
    retryPenalty: 10,
    // Beats per floor (encounter.js). type: clear | push (defenders advance) |
    // hold (stand in the ring until it fills; trickle reinforcements; then clear).
    // spawns: { kind, x, z, delay? } — positions are pushed out of cover.
    floors: {
      1: [
        {
          id: "breach", type: "clear", title: "BREACH / GUNNERS IN COVER",
          hint: "C crouches behind cover; hold right mouse to rise and aim. Gunners duck and pop up to fire: hit them then, or flank them.",
          hintTime: 10,
          spawns: [
            { kind: "gunner", x: -7, z: -15 },
            { kind: "gunner", x: 6, z: -18, delay: 0.5 },
            { kind: "gunner", x: 1, z: -25, delay: 1 },
          ],
        },
        {
          id: "shield-line", type: "clear", title: "SHIELD LINE",
          hint: "Shield fronts block your fire. Hit them while they shoot, flank, or drop your squad on them (Q). Don't let them close in: they bash.",
          spawns: [
            { kind: "shield", x: 0, z: -21 },
            { kind: "gunner", x: -9, z: -24, delay: 0.4 },
            { kind: "gunner", x: 9, z: -22, delay: 0.8 },
            { kind: "gunner", x: 3, z: -31, delay: 1.2 },
          ],
        },
        {
          id: "flank-rush", type: "clear", title: "FLANK RUSH / HUGGERS",
          hint: "Huggers rush you and leap over cover after a red floor ring. Shoot them early or dodge the leap (Space).",
          spawns: [
            { kind: "hugger", x: -16, z: -8, delay: 0.6 },
            { kind: "hugger", x: 16, z: -12, delay: 2.2 },
            { kind: "hugger", x: -16, z: -17, delay: 3.8 },
            { kind: "gunner", x: -4, z: -30 },
            { kind: "gunner", x: 8, z: -32, delay: 0.5 },
          ],
        },
        {
          id: "hold-lift", type: "hold", title: "HOLD THE LIFT", doneTitle: "LIFT POWERED / CLEAR THE ATRIUM",
          hint: "Stand in the ring on the lift while it powers up. The meter pauses when you step out.",
          hold: { x: 0, z: -39, r: 3.4, time: 15 },
          spawns: [
            { kind: "gunner", x: -10, z: -16 },
            { kind: "gunner", x: 10, z: -18, delay: 0.6 },
          ],
          trickle: { every: 3.5, max: 4, pool: ["gunner", "hugger", "gunner"], points: [[-14, -12], [14, -14], [-8, -5], [8, -4]] },
        },
      ],
      2: [
        {
          id: "sentinel-line", type: "clear", title: "SENTINEL LINE / WARDEN",
          hint: "The Warden's beam stops at cover; move across it or duck. Its front is armoured; hit the glowing rear core, or hit it while it vents. The Maintainer heals: take it out first.",
          hintTime: 11,
          spawns: [
            { kind: "warden", x: 0, z: -25 },
            { kind: "maintainer", x: 0, z: -33, delay: 0.6 },
            { kind: "gunner", x: -10, z: -20, delay: 0.3 },
            { kind: "gunner", x: 10, z: -22, delay: 0.9 },
            { kind: "shield", x: -4, z: -16, delay: 1.2 },
          ],
        },
        {
          id: "counter-push", type: "push", title: "COUNTER-PUSH",
          hint: "A shield wall advances. Drop the squad behind it or flank before it reaches you.",
          spawns: [
            { kind: "shield", x: -5, z: -24 },
            { kind: "shield", x: 5, z: -26, delay: 0.4 },
            { kind: "gunner", x: -12, z: -28, delay: 0.8 },
            { kind: "gunner", x: 12, z: -28, delay: 1.2 },
            { kind: "gunner", x: 0, z: -34, delay: 1.6 },
            { kind: "hugger", x: -16, z: -14, delay: 3 },
            { kind: "hugger", x: 16, z: -18, delay: 4.5 },
            { kind: "maintainer", x: 0, z: -37, delay: 2 },
          ],
        },
        {
          id: "hold-ascent", type: "hold", title: "HOLD THE ASCENT", doneTitle: "ASCENT POWERED / CLEAR THE GALLERY",
          hint: "Hold the lift ring. A Warden covers it from the flank: turn it with your squad.",
          hold: { x: 0, z: -39, r: 3.4, time: 20 },
          spawns: [
            { kind: "warden", x: -14, z: -21 },
            { kind: "gunner", x: 10, z: -14, delay: 0.6 },
            { kind: "gunner", x: 4, z: -8, delay: 1.2 },
          ],
          trickle: { every: 3, max: 5, pool: ["gunner", "hugger", "shield", "gunner"], points: [[-14, -10], [14, -12], [0, -5], [12, -24]] },
        },
      ],
    },
  },
  audio: { volume: 0.6, sfx: 1, music: 0.5, mute: false },
  lift: {
    duration: 9.5,
    walkTime: 0.9,
    blendFrom: 0.78,
    blendTo: 0.96,
    fogFar: 520,
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
await loadFonts();
const brand = await loadBrand();
const gfx = createRenderer(canvas, {
  pixelRatio: T.fx.maxPixelRatio,
  exposure: T.fx.exposure,
});
const renderer = gfx.renderer;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101b28);
scene.fog = new THREE.Fog(0x101b28, T.fx.fogNear, T.fx.fogFar);
applyEnvironment(renderer, scene, 0.4);
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
const world = createWorld(scene, T, brand),
  flight = createFlight(scene, T, brand);
await flight.ready; // the approach's glb models (dropship, fleet, HQ)
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
  finishWait = 0;
let health = T.player.health,
  heat = 0,
  overheated = false,
  fireCooldown = 0,
  lastDamage = -99,
  crouch = false,
  dodge = 0,
  dodgeCooldown = 0;
// Combat redesign player state: vault, active vent, hit-stop, vent buff.
let vaultT = 0,
  venting = 0, // seconds into the current vent; 0 = not venting
  ventHeat = 0, // heat when the vent started (drains linearly over ventTime)
  ventJam = 0, // extra seconds added by a missed tap
  ventTapped = false,
  ventBuffUntil = -1,
  hitStop = 0;
const vaultFrom = new THREE.Vector3(),
  vaultTo = new THREE.Vector3();
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
const playerModel = buildPlayer();
const body = playerModel.root;
scene.add(body);
const glow = playerModel.muzzle;
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
// Sound (lift-ui): procedural kit in audio.js. T.audio = { volume, sfx, music, mute }; M mutes.
const audio = createAudio(T);
const initAudio = () => audio.init();
const sound = (name) => audio.play(name);
let audioClock = performance.now();
function updateAudio() {
  const now = performance.now(),
    dt = Math.min(0.25, (now - audioClock) / 1000);
  audioClock = now;
  audio.update(dt, {
    mode: state,
    paused,
    floor,
    health,
    enemies: actors.enemies.filter((e) => !e.dead && e.hp > 0).length,
    holding: !!director.holding,
    holdProgress: director.progress || 0,
  });
}
const box = new THREE.Box3(),
  ray = new THREE.Ray(),
  tmpHit = new THREE.Vector3();
// Low cover (height < LOW_COVER) can be skipped: hugger lunges, vault checks.
const LOW_COVER = 2.2;
function worldHit(origin, dir, maxDist, ignoreLow = false) {
  let nearest = maxDist;
  for (const c of world.colliders) {
    if (ignoreLow && c.height < LOW_COVER) continue;
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
function blocked(a, b, ignoreLow = false) {
  const d = b.clone().sub(a),
    len = d.length();
  return len > 0.001 && worldHit(a, d.divideScalar(len), len, ignoreLow) < len - 0.03;
}
// Push a point on the current floor out of any collider (spawns, drops, lunges).
function free(p, radius = T.player.radius) {
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const c of world.colliders) {
      if (Math.abs(c.baseY - p.y) > 0.5) continue;
      const l = p.x - (c.minX - radius),
        r = c.maxX + radius - p.x,
        n = p.z - (c.minZ - radius),
        f = c.maxZ + radius - p.z;
      if (l <= 0 || r <= 0 || n <= 0 || f <= 0) continue;
      const m = Math.min(l, r, n, f);
      if (m === l) p.x = c.minX - radius - 0.01;
      else if (m === r) p.x = c.maxX + radius + 0.01;
      else if (m === n) p.z = c.minZ - radius - 0.01;
      else p.z = c.maxZ + radius + 0.01;
      moved = true;
    }
    p.x = THREE.MathUtils.clamp(p.x, -T.world.width / 2 + radius, T.world.width / 2 - radius);
    p.z = THREE.MathUtils.clamp(p.z, T.world.farZ + radius, T.world.nearZ - radius);
    if (!moved) break;
  }
  return p;
}
function move(p, delta, radius = T.player.radius, ignoreLow = false) {
  const steps = Math.max(1, Math.ceil(delta.length() / 0.2)),
    sx = delta.x / steps,
    sz = delta.z / steps;
  for (let i = 0; i < steps; i++) {
    let nx = p.x + sx,
      nz = p.z;
    for (const c of world.colliders) {
      if (Math.abs(c.baseY - p.y) > 0.5 || (ignoreLow && c.height < LOW_COVER)) continue;
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
      if (Math.abs(c.baseY - p.y) > 0.5 || (ignoreLow && c.height < LOW_COVER)) continue;
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
// ---- Loot: defenders drop pickups; walk over one to collect it.
const pickups = [];
let coolantUntil = -1,
  overclockUntil = -1;
// Rules (T.loot): a drop chance per kind, guaranteed drops (maintainer → compute,
// warden → overclock), pickups pushed out of cover, and a magnet pull nearby.
function dropLoot(kind, at) {
  const L = T.loot;
  let type = L.guaranteed[kind];
  if (!type) {
    if (Math.random() > (L.chance[kind] ?? 0.4)) return;
    // Weighted by need: low health favours patches, a hot rifle favours coolant.
    const weights = {
      patch: health < 70 ? 4 : 1,
      coolant: heat > 50 ? 3 : 1,
      compute: actors.ready ? 0.6 : 2.5,
      overclock: kind === "shield" ? 3 : 1,
    };
    let roll = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    type = "patch";
    for (const [k, w] of Object.entries(weights)) {
      if ((roll -= w) <= 0) {
        type = k;
        break;
      }
    }
  }
  const model = buildPickup(type);
  model.root.position.copy(free(at.clone().setY(world.floorY), 0.45));
  scene.add(model.root);
  pickups.push({ type, model, age: 0, spawn: 0, collect: -1, phase: Math.random() * 6 });
  sound("drop");
}
const lootDetail = (type) =>
  ({
    patch: `+${T.loot.patch} integrity`,
    coolant: `rifle vented · ${T.loot.coolant}s no heat`,
    compute: `subagents −${T.loot.compute}s`,
    overclock: `${T.loot.overclock}s · pierce shields and armour`,
  })[type];
function applyLoot(type) {
  const info = LOOT[type];
  if (type === "patch") health = Math.min(T.player.health, health + T.loot.patch);
  else if (type === "coolant") {
    heat = 0;
    overheated = false;
    venting = ventJam = 0;
    coolantUntil = runTime + T.loot.coolant;
  } else if (type === "compute") actors.reduceCooldown(T.loot.compute);
  else overclockUntil = runTime + T.loot.overclock;
  stats.loot = (stats.loot || 0) + 1;
  toast(`${info.label} · ${lootDetail(type)}`, 1.8);
  sound("pickup");
  burst(pos.clone().add(new THREE.Vector3(0, 1.1, 0)), info.color, 12);
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += dt;
    p.spawn = Math.min(1, p.spawn + dt * 2.2);
    const at = p.model.root.position;
    const near = state === "combat" && health > 0 && p.spawn >= 0.5;
    const d = Math.hypot(at.x - pos.x, at.z - pos.z);
    if (p.collect >= 0) p.collect += dt * 4;
    else if (near && d < T.loot.radius) {
      p.collect = 0;
      applyLoot(p.type);
    } else if (near && d < T.loot.magnet) {
      // Magnet: drifts toward you, faster the closer you are.
      const pull = Math.min(d, T.loot.magnetSpeed * dt * (1 - d / T.loot.magnet + 0.25));
      at.x += ((pos.x - at.x) / d) * pull;
      at.z += ((pos.z - at.z) / d) * pull;
    }
    const expired = p.age > T.loot.life;
    p.model.update(dt, {
      time: runTime,
      phase: p.phase,
      spawn: p.spawn,
      blink: p.age > T.loot.life - T.loot.blink,
      collect: Math.max(0, p.collect),
    });
    if (p.collect >= 1 || expired) removePickup(i);
  }
}
function removePickup(i) {
  const p = pickups[i];
  scene.remove(p.model.root);
  p.model.dispose();
  pickups.splice(i, 1);
}
function clearPickups() {
  while (pickups.length) removePickup(pickups.length - 1);
  coolantUntil = overclockUntil = -1;
}
// `continuous` (the Warden beam, every frame): hurt sound and shake are throttled.
let lastHurtFx = -99;
const combatStats = { taken: 0 }; // balance read-out (window.__ascent.balance)
function damagePlayer(amount, from, continuous = false) {
  if (
    state !== "combat" ||
    paused ||
    health <= 0 ||
    dodge > T.player.dodgeDuration - T.player.dodgeProtection ||
    vaultT > 0
  )
    return;
  health = Math.max(0, health - amount);
  combatStats.taken += amount;
  lastDamage = runTime;
  damageFlash = Math.max(damageFlash, continuous ? 0.5 : 0.8);
  if (!continuous || runTime - lastHurtFx > 0.25) {
    lastHurtFx = runTime;
    shake = Math.max(shake, 0.07);
    sound("hurt");
  }
  if (!health) {
    state = "dead";
    combatStats.deaths = (combatStats.deaths || 0) + 1;
    showOverlay("dead");
  }
}
// Knock-back (shield bash, hugger lunge): an impulse that decays; breaks crouch.
const knock = new THREE.Vector3();
function pushPlayer(v) {
  if (vaultT > 0) return;
  knock.add(v);
  crouch = false;
}
// Combat looks (bolts, beams, floor rings, impacts, numbers): looks.js interface.
const looks = createFxLooks(scene);
const actors = createActors(scene, T, {
  blocked,
  move,
  free,
  rayLength: worldHit,
  colliders: () => world.colliders,
  pushPlayer,
  shake: (a) => (shake = Math.max(shake, a)),
  looks,
  damagePlayer,
  beam,
  burst,
  sound,
  onKill(kind, byAlly, at) {
    stats.kills++;
    if (at) dropLoot(kind, at);
    if (byAlly) stats.allyKills++;
    else if (T.hitStop.time > 0) hitStop = T.hitStop.time * (kind === "warden" ? 2.5 : 1);
  },
  getPlayer: () => ({
    pos,
    alive: state === "combat" && health > 0,
    height: playerHeight,
  }),
  getCamera: () => camera,
}, brand);

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
  $("overlay").classList.toggle("finished", type === "finish");
  $("panel").classList.toggle("hidden", type === "finish");
  $("endcard").classList.toggle("hidden", type !== "finish");
  $("instructions").classList.toggle("hidden", type !== "menu");
  $("stats").classList.add("hidden");
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
  if (type === "finish") fillEndCard();
  release();
}
// End card (lift-ui): numbers count up, the tower strip shows how far the climb got.
function fillEndCard() {
  const values = {
    "ec-kills": stats.kills,
    "ec-calls": stats.calls,
    "ec-retries": stats.retries,
    "ec-loot": stats.loot || 0,
  };
  $("ec-time").textContent = formatTime(runTime);
  $("ec-squad").textContent = stats.allyKills ? `squad takedowns ${stats.allyKills}` : "";
  const t0 = performance.now();
  const count = (now) => {
    const k = Math.min(1, (now - t0 - 350) / 900);
    for (const [id, v] of Object.entries(values))
      $(id).textContent = Math.round(v * Math.max(0, 1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(count);
  };
  requestAnimationFrame(count);
  const g = $("ec-floors");
  if (!g.childElementCount) {
    const NS = "http://www.w3.org/2000/svg";
    const add = (tag, attrs, text) => {
      const e = document.createElementNS(NS, tag);
      for (const k in attrs) e.setAttribute(k, attrs[k]);
      if (text) e.textContent = text;
      g.appendChild(e);
      return e;
    };
    add("line", { class: "rail", x1: 22, x2: 22, y1: 10, y2: 510 });
    add("line", { class: "rail", x1: 70, x2: 70, y1: 10, y2: 510 });
    for (let i = 0; i < 9; i++) {
      const y = 492 - i * 54,
        lit = i < 2;
      add("line", { class: "fl" + (lit ? " on" : "") + (i === 2 ? " pulse" : ""), x1: 12, x2: 80, y1: y, y2: y });
      add("text", { class: lit ? "on" : "", x: 88, y: y + 3 }, i < 3 ? "FL 0" + (i + 1) + (i === 2 ? " ?" : "") : "");
    }
    add("rect", { x: 30, y: 492 - 54 - 7, width: 32, height: 6, fill: "#ffd21e" });
  }
  $("ec-replay").focus({ preventScroll: true });
  sound("finish");
}
function startRun() {
  initAudio();
  actors.clear();
  clearPickups();
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
  actors.reset(pos.y, n);
  clearPickups();
  body.visible = true;
  state = "combat";
  phaseTime = 0;
  director.start(n, pos.y);
  beatMark = null;
  finishWait = 0;
  health = T.player.health;
  heat = 0;
  overheated = false;
  venting = ventJam = 0;
  ventBuffUntil = -1;
  vaultT = hitStop = 0;
  knock.set(0, 0, 0);
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
      : "Floor 02 hits harder. While your squad is out, Q again gives orders: aim at an enemy to focus it, at the floor to move them.",
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
$("ec-replay").addEventListener("click", startRun);
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
  if (e.code === "KeyR") ventKey();
  if (e.code === "Space" && vaultT <= 0 && startVault()) return;
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
// Low cover straight ahead along `dir` (flat): nearest low collider whose
// footprint the ray enters within `reach`; returns { c, enter, exit } or null.
function lowCoverAhead(dir, reach) {
  let best = null;
  for (const c of world.colliders) {
    if (c.height >= LOW_COVER || Math.abs(c.baseY - pos.y) > 0.5) continue;
    const r = T.player.radius;
    let t0 = -Infinity,
      t1 = Infinity;
    for (const [p, d, lo, hi] of [
      [pos.x, dir.x, c.minX - r, c.maxX + r],
      [pos.z, dir.z, c.minZ - r, c.maxZ + r],
    ]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) t0 = Infinity;
        continue;
      }
      const a = (lo - p) / d,
        b = (hi - p) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > t1 || t1 < 0 || t0 > reach) continue;
    if (!best || t0 < best.enter) best = { c, enter: Math.max(0, t0), exit: t1 };
  }
  return best;
}
// Space next to low cover (moving or facing into it): vault over it with
// i-frames. Returns false when there is nothing to vault (then Space dodges).
function startVault() {
  const dir = movementDirection();
  if (dir.lengthSq() < 0.1) dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  const hit = lowCoverAhead(dir, T.player.vaultReach);
  if (!hit || hit.exit - hit.enter > 3) return false; // nothing low ahead, or too deep to clear
  const to = pos.clone().addScaledVector(dir, hit.exit + 0.15);
  if (free(to.clone()).distanceTo(to) > 0.05) return false; // landing spot is inside something
  vaultFrom.copy(pos);
  vaultTo.copy(to);
  vaultT = T.player.vaultTime;
  crouch = false;
  knock.set(0, 0, 0);
  velocity.copy(dir).multiplyScalar(T.player.speed);
  sound("spawn");
  return true;
}
let snapHinted = false;
function updatePlayer(dt) {
  const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && !mouseAim;
  const isLow = crouch && !mouseAim && dodge <= 0 && vaultT <= 0;
  playerHeight = isLow ? T.player.crouchHeight : T.player.height;
  const speed = mouseAim
    ? T.player.aimSpeed
    : isLow
      ? T.player.crouchSpeed
      : sprinting
        ? T.player.sprint
        : T.player.speed;
  const dir = movementDirection();
  let lift = 0;
  if (vaultT > 0) {
    // Vault: a short hop across the cover; no steering, no damage.
    vaultT = Math.max(0, vaultT - dt);
    const k = 1 - vaultT / T.player.vaultTime;
    const s = k * k * (3 - 2 * k);
    pos.x = THREE.MathUtils.lerp(vaultFrom.x, vaultTo.x, s);
    pos.z = THREE.MathUtils.lerp(vaultFrom.z, vaultTo.z, s);
    lift = Math.sin(Math.PI * k) * T.player.vaultHeight;
  } else {
    velocity.lerp(dir.clone().multiplyScalar(speed), 1 - Math.exp(-dt * 15));
    const step = (
      dodge > 0
        ? dodgeDir.clone().multiplyScalar(T.player.dodgeSpeed)
        : velocity.clone()
    ).multiplyScalar(dt);
    const before = pos.clone();
    move(pos, step);
    // Snap to cover: sprinting into low cover drops you into a crouch behind it.
    if (
      T.player.snapToCover &&
      sprinting &&
      !crouch &&
      dodge <= 0 &&
      dir.lengthSq() > 0.1 &&
      step.length() > 0.05 &&
      before.distanceTo(pos) < step.length() * 0.4 &&
      lowCoverAhead(dir, 0.25)
    ) {
      crouch = true;
      velocity.set(0, 0, 0);
      if (!snapHinted) {
        snapHinted = true;
        hint("Snapped to cover. Hold right mouse to rise and aim; Space vaults over.", 4);
      }
    }
  }
  if (knock.lengthSq() > 1e-4) {
    move(pos, knock.clone().multiplyScalar(dt));
    knock.multiplyScalar(Math.exp(-dt * T.player.knockDecay));
  } else knock.set(0, 0, 0);
  dodge = Math.max(0, dodge - dt);
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  body.position.copy(pos);
  body.position.y += lift;
  body.rotation.set(0, yaw, 0);
  playerModel.update(dt, {
    speed: velocity.length(),
    crouch: isLow,
    pitch,
    heat: heat / 100,
    firing: fireCooldown > T.weapon.interval - 0.04 ? 1 : 0,
    dodge: dodge > 0 || vaultT > 0,
    time: runTime,
    hurt: Math.max(0, 1 - (runTime - lastDamage) * 3),
  });
  if (runTime - lastDamage > T.player.regenDelay)
    health = Math.min(T.player.health, health + dt * T.player.regen);
}
// ---- Heat and the active vent (T.weapon.vent*). R (or an overheat) starts a
// vent: heat drains over ventTime. Tap R inside the window = instant vent and a
// damage buff; tap outside = jam. body[data-vent] = "window" | "jam" | "".
function startVent(forced) {
  venting = 1e-6;
  ventHeat = Math.max(heat, 1);
  ventJam = 0;
  ventTapped = false;
  overheated = true;
  sound(forced ? "overheat" : "vent");
  if (forced) hint("Overheated: venting. Tap R as the heat bar crosses the marker for an instant vent.", 3);
  const [a, b] = T.weapon.ventWindow;
  document.body.style.setProperty("--vent-from", `${(1 - b) * ventHeat}%`);
  document.body.style.setProperty("--vent-to", `${(1 - a) * ventHeat}%`);
}
function ventKey() {
  if (!T.weapon.activeVent) return;
  if (venting <= 0) {
    if (heat >= T.weapon.ventMinHeat) startVent(false);
    return;
  }
  if (ventTapped) return;
  ventTapped = true;
  const k = venting / T.weapon.ventTime,
    [a, b] = T.weapon.ventWindow;
  if (k >= a && k <= b) {
    heat = 0;
    venting = 0;
    overheated = false;
    ventBuffUntil = runTime + T.weapon.ventBuffTime;
    toast(`PERFECT VENT · DAMAGE ×${T.weapon.ventBuff}`, 1.6);
    sound("pickup");
    looks.impact(glow.getWorldPosition(new THREE.Vector3()), "heal");
  } else {
    ventJam = T.weapon.ventJam;
    sound("overheat");
    toast("VENT JAMMED", 1.2);
  }
}
function updateHeat(dt) {
  if (!T.weapon.activeVent) {
    heat = Math.max(
      0,
      heat -
        dt *
          (overheated ? T.weapon.overheatCooling : T.weapon.cooling) *
          (mouseFire && !overheated ? 0.08 : 1),
    );
    if (overheated && heat < T.weapon.recoverHeat) overheated = false;
  } else if (venting > 0) {
    venting += dt;
    const k = Math.min(1, venting / T.weapon.ventTime);
    heat = ventHeat * (1 - k);
    if (venting >= T.weapon.ventTime + ventJam) {
      venting = ventJam = 0;
      heat = 0;
      overheated = false;
    }
  } else heat = Math.max(0, heat - dt * T.weapon.cooling * (mouseFire ? 0.08 : 1));
  let v = "";
  if (venting > 0) {
    const k = venting / T.weapon.ventTime,
      [a, b] = T.weapon.ventWindow;
    if (ventTapped && ventJam > 0) v = "jam";
    else if (!ventTapped && k >= a && k <= b) v = "window";
  }
  if (document.body.dataset.vent !== v) document.body.dataset.vent = v;
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
// Nearest live enemy hit-sphere along a ray (actors.hitCenter + e.hitRadius);
// enemies still dropping in (spawn < 1) can't be hit yet.
const aimSphere = new THREE.Sphere(),
  aimHit = new THREE.Vector3();
function rayEnemy(origin, dir, maxDist) {
  let distance = maxDist,
    enemy = null;
  ray.set(origin, dir);
  for (const e of actors.enemies) {
    if (e.dead || e.hp <= 0 || e.spawn < 1) continue;
    aimSphere.center.copy(actors.hitCenter(e));
    aimSphere.radius = e.hitRadius || 0.7;
    if (ray.intersectSphere(aimSphere, aimHit)) {
      const d = aimHit.distanceTo(origin);
      if (d < distance) {
        distance = d;
        enemy = e;
      }
    }
  }
  return { distance, enemy };
}
function targetFromCamera() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const { distance, enemy } = rayEnemy(camera.position, dir, worldHit(camera.position, dir, T.weapon.range));
  return {
    point: camera.position.clone().addScaledVector(dir, distance),
    enemy,
  };
}
// What a shot from `origin` along `dir` would hit: the nearest cover or enemy.
function traceShot(origin, dir) {
  const { distance, enemy } = rayEnemy(origin, dir, worldHit(origin, dir, T.weapon.range));
  return { distance, target: enemy };
}
// ---- Aim read-out. The screen reticle is where the camera looks; the world
// marker is where the rifle's shot lands. When cover is in the way the two
// differ, and the reticle says so instead of leaving the player guessing.
const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.26, 32),
  new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }),
);
const aimDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.045, 12),
  new THREE.MeshBasicMaterial({ depthTest: false, toneMapped: false }),
);
const aimMarker = new THREE.Group();
aimMarker.add(aimRing, aimDot);
aimMarker.renderOrder = aimRing.renderOrder = aimDot.renderOrder = 998;
aimMarker.visible = false;
scene.add(aimMarker);
const aimLaser = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45, toneMapped: false }),
);
aimLaser.visible = false;
aimLaser.frustumCulled = false;
scene.add(aimLaser);
// open | enemy | cover (shot blocked) | weak (rear arc, Warden core: crit) | armour
// (shield front, Warden front: mostly blocked). Mirrored to body[data-aim] for hud.css.
let aimState = "open";
const AIM_COLOR = { open: 0xdff7d0, enemy: 0xff5a4a, cover: 0xffb24b, weak: 0xfff07a, armour: 0x66daff };
function updateAim() {
  const { point, enemy } = targetFromCamera();
  const muzzlePos = new THREE.Vector3();
  glow.getWorldPosition(muzzlePos);
  const dir = point.clone().sub(muzzlePos);
  const intended = dir.length();
  dir.normalize();
  const { distance, target } = traceShot(muzzlePos, dir);
  const blockedByCover = distance < intended - 0.35 && !target;
  const mod = target ? actors.shotModifier(target, muzzlePos, runTime < overclockUntil) : null;
  aimState = blockedByCover ? "cover" : !target ? "open" : mod.blocked ? "armour" : mod.crit ? "weak" : "enemy";
  if (document.body.dataset.aim !== aimState) document.body.dataset.aim = aimState;
  const end = muzzlePos.clone().addScaledVector(dir, Math.min(distance, T.weapon.range));
  const color = AIM_COLOR[aimState];
  aimRing.material.color.setHex(color);
  aimDot.material.color.setHex(color);
  aimMarker.position.copy(end);
  aimMarker.quaternion.copy(camera.quaternion);
  // constant angular size: scale grows with distance from the camera
  aimMarker.scale.setScalar(Math.max(0.02, camera.position.distanceTo(end) * T.aim.marker));
  aimMarker.visible = state === "combat" && (mouseAim || aimState !== "open");
  const arr = aimLaser.geometry.attributes.position;
  arr.setXYZ(0, muzzlePos.x, muzzlePos.y, muzzlePos.z);
  arr.setXYZ(1, end.x, end.y, end.z);
  arr.needsUpdate = true;
  aimLaser.material.color.setHex(color);
  aimLaser.visible = state === "combat" && mouseAim;
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
  if (runTime >= coolantUntil) heat += T.weapon.heatPerShot;
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
  const { distance, target } = traceShot(muzzlePos, dir);
  const end = muzzlePos.clone().addScaledVector(dir, distance);
  const over = runTime < overclockUntil;
  beam(muzzlePos, end, over ? 0xff5fd6 : 0xa9f278);
  burst(end, target ? 0xffd265 : over ? 0xff5fd6 : 0x9ecd86, target ? 5 : 2);
  if (target) {
    const at = actors.hitCenter(target);
    const result = actors.hitEnemy(
      target,
      T.weapon.damage * (runTime < ventBuffUntil ? T.weapon.ventBuff : 1),
      muzzlePos,
      false,
      runTime < overclockUntil,
    );
    hitTime = 0.12;
    hitBlocked = result.blocked;
    stats.hits++;
    sound(result.blocked ? "shield" : "hit");
    looks.number(
      at.setY(at.y + (target.hitRadius || 0.6) + 0.15),
      String(Math.max(1, Math.round(result.damage))),
      result.crit ? "crit" : result.blocked ? "blocked" : "hit",
    );
    if (result.crit) looks.impact(end, "crit");
  }
  sound("fire");
  shake = mouseAim ? 0.025 : 0.045;
  if (heat >= 100) {
    heat = 100;
    if (T.weapon.activeVent) startVent(true);
    else {
      overheated = true;
      sound("overheat");
      hint("Rifle overheated. Take cover while it cools.", 3);
    }
  }
}
// Q: throw the squad beacon at the aimed point (clamped to T.squad.range). While
// the squad is out, Q is an order: aimed enemy = focus it, aimed floor = move there.
function callSquad() {
  const squadOut = actors.squadActive;
  if (!actors.ready && !squadOut) {
    hint(
      actors.dropping ? "Squad inbound." : `Subagents ready in ${Math.ceil(actors.cooldown)}s.`,
      2,
    );
    return;
  }
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  let point = pos.clone();
  const aimed = targetFromCamera();
  const wanted = aimed.point.clone();
  wanted.y = pos.y;
  const delta = wanted.sub(pos);
  if (delta.length() > T.squad.range) delta.setLength(T.squad.range);
  if (delta.length() < 3 && !squadOut) delta.copy(forward).multiplyScalar(5);
  move(point, delta, 0.7);
  const result = actors.callIn(point, aimed.enemy);
  if (result === "deploy") {
    stats.calls++;
    toast("SUBAGENT BEACON / SQUAD DROPPING", 2.5);
    hint("Squad incoming: the landing staggers everything nearby. Q again while they're out gives orders.", 5);
  } else if (result === "focus") toast(`SQUAD / FOCUS ${aimed.enemy.kind.toUpperCase()}`, 1.4);
  else if (result === "move") toast("SQUAD / MOVE", 1.2);
}
// ---- Encounter: beats per floor (T.encounter.floors, encounter.js).
const director = createEncounter(T, {
  looks,
  spawn: (spec, mode) => actors.spawnWave(spec, mode),
  alive: () => actors.alive,
  playerPos: () => pos,
  playerAlive: () => state === "combat" && health > 0,
  toast,
  hint,
  sound,
});
const beatLog = []; // balance read-out: per beat { floor, id, time, taken }
let beatMark = null;
function worldReady() {
  return floor === 1 && director.done;
}
// HUD detail line: beat n / total, hostiles, and the hold meter.
function beatDetail() {
  const hostiles = actors.alive;
  if (director.done) return floor === 1 ? "Lift powered" : "Ascent secured";
  if (director.index < 0) return "Defenders massing";
  const head = `Beat ${director.index + 1} / ${director.count} · ${hostiles} hostile${hostiles === 1 ? "" : "s"}`;
  if (!director.holding) return head;
  return `${head} · HOLD ${Math.floor(director.progress * 100)}%${director.inZone ? "" : " · get in the ring"}`;
}
function encounter(dt) {
  director.update(dt, runTime);
  const id = director.done ? "done" : director.beat?.id ?? "intro";
  if (id !== beatMark?.id) {
    if (beatMark && beatMark.id !== "intro")
      beatLog.push({ floor: beatMark.floor, id: beatMark.id, time: +(runTime - beatMark.t).toFixed(1), taken: Math.round(combatStats.taken - beatMark.taken) });
    beatMark = { floor, id, t: runTime, taken: combatStats.taken };
  }
  if (!director.done) return;
  if (floor === 1) {
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
  if (finishWait === 0) toast("FLOOR 02 SECURED / THE CLIMB CONTINUES", T.encounter.completionDelay + 0.5);
  finishWait += dt;
  if (finishWait > T.encounter.completionDelay) {
    state = "finish";
    showOverlay("finish");
  }
}
// The lift ride (lift-ui): cinematic shot from lift.js, eased onto the gameplay camera at the end.
const liftRide = {
  from: new THREE.Vector3(),
  base: new THREE.Vector3(),
  camPos: new THREE.Vector3(),
  camQuat: new THREE.Quaternion(),
  camFov: 60,
  walked: new THREE.Vector3(),
};
const liftEase = (a, b, x) => {
  const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
function startLift() {
  state = "lift";
  aimMarker.visible = aimLaser.visible = false;
  phaseTime = 0;
  actors.clear();
  clearPickups();
  clearInput();
  liftRide.from.copy(pos);
  yaw = 0;
  pitch = -0.06;
  crouch = false;
  world.lift.setRiding(true);
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
  const C = T.lift,
    t = Math.min(1, phaseTime / (C?.duration ?? T.encounter.liftDuration)),
    smooth = t * t * (3 - 2 * t),
    lift = world.lift;
  world.setLiftProgress(smooth);
  const base = liftRide.base.set(0, world.floorY + lift.assembly.position.y, -39);
  // the player walks from where they stood onto the platform centre, then rides it
  const walk = liftEase(0, C?.walkTime ?? 0.9, phaseTime);
  const before = liftRide.walked.copy(pos);
  pos.set(
    THREE.MathUtils.lerp(liftRide.from.x, 0, walk),
    base.y,
    THREE.MathUtils.lerp(liftRide.from.z, -39, walk),
  );
  const step = before.distanceTo(pos);
  body.position.copy(pos);
  body.rotation.set(0, THREE.MathUtils.lerp(body.rotation.y, 0, 1 - Math.exp(-dt * 8)), 0);
  body.updateMatrixWorld(true);
  playerModel.update(dt, {
    speed: walk < 1 ? Math.min(T.player.speed, step / Math.max(dt, 1e-4)) : 0,
    crouch: false,
    pitch: 0,
    heat: 0,
    firing: 0,
    dodge: false,
    time: runTime,
    hurt: 0,
  });
  // camera: cinematic shot, then ease onto the gameplay camera before the cut to floor 2
  lift.shot(t, base, camera);
  const blend = liftEase(C?.blendFrom ?? 0.78, C?.blendTo ?? 0.96, t);
  if (blend > 0) {
    liftRide.camPos.copy(camera.position);
    liftRide.camQuat.copy(camera.quaternion);
    liftRide.camFov = camera.fov;
    updateCamera(1, true);
    camera.position.lerpVectors(liftRide.camPos, camera.position, blend);
    camera.quaternion.slerpQuaternions(liftRide.camQuat, camera.quaternion, blend);
    camera.fov = THREE.MathUtils.lerp(liftRide.camFov, camera.fov, blend);
    camera.updateProjectionMatrix();
  }
  // the tower is far bigger than the atrium: let the fog open up during the wide shot
  const far = T.fx.fogFar,
    wide = liftEase(0.2, 0.45, t) * (1 - liftEase(0.72, 0.95, t));
  scene.fog.far = THREE.MathUtils.lerp(far, lift.config.fogFar, wide);
  // dip to black at the end; beginFloor(2) pops the new deck in underneath
  const fade = $("fade");
  if (fade) {
    fade.style.transition = "none";
    fade.style.opacity = liftEase(0.93, 1, t);
  }
  if (t >= 1) {
    lift.setRiding(false);
    scene.fog.far = far;
    sound("arrive");
    beginFloor(2);
    if (fade) {
      fade.style.transition = "opacity 0.9s ease-out";
      fade.style.opacity = 0;
    }
  }
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
      : beatDetail();
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
  $("crosshair").classList.toggle("onenemy", aimState === "enemy");
  $("crosshair").classList.toggle("cover", aimState === "cover");
  const buffs = [];
  if (runTime < coolantUntil)
    buffs.push(`<span class="buff cool">COOLANT ${Math.ceil(coolantUntil - runTime)}s</span>`);
  if (runTime < overclockUntil)
    buffs.push(`<span class="buff over">OVERCLOCK ${Math.ceil(overclockUntil - runTime)}s</span>`);
  const buffHtml = combat ? buffs.join("") : "";
  if ($("buffs").dataset.h !== buffHtml) {
    $("buffs").dataset.h = buffHtml;
    $("buffs").innerHTML = buffHtml;
  }
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
    (actors.ready ? 100 : 100 * (1 - actors.cooldown / T.squad.cooldown)) +
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
  updateAudio();
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
      // Hit-stop: a kill slows the combat simulation for a beat (T.hitStop).
      const real = dt;
      if (hitStop > 0) {
        hitStop -= real;
        dt *= T.hitStop.scale;
      }
      fireCooldown -= dt;
      updateHeat(dt);
      updatePlayer(dt);
      updateCamera(real);
      body.updateMatrixWorld(true);
      if (mouseFire) fire();
      actors.update(dt, runTime);
      updatePickups(dt);
      updateAim(dt);
      if (state === "combat") encounter(dt);
    } else updateLift(dt);
    world.update(dt, runTime, camera);
    updateFx(dt);
    looks.update(dt);
  }
  updateHud();
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  tick(dt);
  if (gfx.grade) gfx.grade.uniforms.hurt.value = Math.min(1, damageFlash);
  gfx.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener("resize", () => {
  gfx.resize();
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
    stats,
    audio,
    finishCard() {
      state = "finish";
      showOverlay("finish");
    },
    applyLoot,
    pickups,
    tick,
    fire,
    move,
    blocked,
    damagePlayer,
    // combat redesign hooks (smoke.mjs bot, balance check)
    encounter: director,
    looks,
    free,
    get balance() {
      return { taken: Math.round(combatStats.taken), deaths: combatStats.deaths || 0, beats: beatLog.slice() };
    },
    get aim() {
      return aimState;
    },
    get playerState() {
      return { crouch, vaulting: vaultT > 0, venting, ventJam, ventBuff: runTime < ventBuffUntil, heat, overheated, knock: knock.length() };
    },
    get snapshot() {
      return {
        state,
        paused,
        floor,
        beat: director.done ? "done" : director.beat?.id ?? null,
        beatIndex: director.index,
        holding: director.holding,
        encounterDone: director.done,
        health,
        heat,
        overheated,
        venting: venting > 0,
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
