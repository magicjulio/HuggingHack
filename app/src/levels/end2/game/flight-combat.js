import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { bakePrefab, createInstancer } from "./flight-kit.js";
import { createBarriers, fieldInstances } from "./barrier.js";
import { createFlightHud } from "./flight-hud.js";
import { lightPoints } from "./hq.js";
import { asset } from "./assets.js";

// The approach's fight (landing area, round 3): ship lasers, things in the sky, escalating phases,
// the hull. flight.js owns the clock, the ship and the cameras; this module owns everything that
// can be shot or hit. All sizes in metres, all times in seconds of the approach clock.
//
// createFlightCombat(root, T, route) -> { ready, hud, start(), update(ctx), attachGuns(ship), stats }
//   route: { approachTime, z(t), y(t) }  (the path centre at clock t)
//   update({ dt, time, clock, ship, shipVel, camera, fire, aim: {x, y} (NDC), active, sound })
//     -> { stall, knockback, rewindTo, shake, bot: {dx, dy} | null }
// Phases (reference clock for a 40.4 s approach; scaled to T.flight.duration - landingBeat):
//   launch 0 · debris 3.6 · interceptors 12.4 · barrier gate 20.4 · HQ defences 29.8 · final 36.6
const MODELS = ""; // app port: asset(MODELS + name) resolves through assets.js
const REF = 40.4;

const PHASES = [
  { id: "launch", t: 0, kicker: "FLEET APPROACH", title: "WEAPONS FREE", sub: "Mouse aims · left mouse or Space fires lasers" },
  { id: "debris", t: 3.6, kicker: "PHASE 1 / 4", title: "DEBRIS FIELD", sub: "Dodge the wreckage · shoot the yellow cargo pods" },
  { id: "intercept", t: 12.4, kicker: "PHASE 2 / 4", title: "INTERCEPTORS", sub: "A red eye means it fires next · move" },
  { id: "gate", t: 20.4, kicker: "PHASE 3 / 4", title: "BARRIER GATE", sub: "Shoot all four emitters or bounce off the field" },
  { id: "defence", t: 29.8, kicker: "PHASE 4 / 4", title: "HQ DEFENCES", sub: "Flak towers on the causeway" },
  { id: "final", t: 36.6, kicker: "APPROACH", title: "CLEARED TO LAND", sub: "Autopilot engaged" },
];

// Target kinds. hp in laser hits; r = hit / collision radius; dmg = hull damage on a collision.
const KINDS = {
  plate: { prefab: "wreck_plate", hp: 3, r: 6.2, dmg: 18, solid: true },
  truss: { prefab: "wreck_truss", hp: 3, r: 7.0, dmg: 18, solid: true },
  block: { prefab: "wreck_block", hp: 2, r: 3.8, dmg: 14, solid: true },
  pod: { prefab: "pod", hp: 1, r: 3.4, dmg: 14, solid: true, blast: 30 },
  inter: { prefab: "interceptor", hp: 4, r: 4.0, dmg: 20, solid: true },
  turret: { prefab: "turret_head", hp: 6, r: 3.6, dmg: 0, solid: false },
  mast: { hp: 0, r: 3.2, dmg: 22, solid: true },
  picket: { hp: 5, r: 3.4, dmg: 16, solid: true },
  emitter: { prefab: "emitter", hp: 6, r: 3.8, dmg: 0, solid: false },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createFlightCombat(root, T, route) {
  const C = T.flight;
  const url = new URLSearchParams(location.search);
  const knob = (k, d) => (url.has(k) ? +url.get(k) : d);
  const diff = knob("flightdiff", C.difficulty ?? 1); // scales counts, enemy fire rate and damage
  const failMode = url.get("failmode") || C.failMode || "checkpoint"; // "checkpoint" | "soft"
  const botOn = url.has("flightbot") ? url.get("flightbot") !== "0" : url.has("test");
  const S = route.approachTime / REF; // phase clock scale
  const phases = PHASES.map((p) => ({ ...p, t: p.t * S }));
  const HULL = C.hull ?? 100;
  const W = C.width ?? 40,
    H = C.height ?? 22;

  const hud = createFlightHud();
  const group = new THREE.Group();
  group.name = "flight-combat";
  root.add(group);

  // ------------------------------------------------------------------ textures + fx pools
  const radialTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d"),
      gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,.6)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const addMat = (map) =>
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  function pool(geo, mat, n, name) {
    const im = new THREE.InstancedMesh(geo, mat, n);
    im.name = name;
    im.frustumCulled = false;
    im.setColorAt(0, new THREE.Color());
    for (let i = 0; i < n; i++) im.setMatrixAt(i, ZERO);
    im.renderOrder = 3;
    group.add(im);
    const items = Array.from({ length: n }, () => ({ live: false }));
    let cursor = 0;
    return {
      im,
      items,
      take() {
        for (let k = 0; k < n; k++) {
          const it = items[(cursor + k) % n];
          if (!it.live) {
            cursor = (cursor + k + 1) % n;
            it.live = true;
            return it;
          }
        }
        const it = items[cursor]; // pool full: recycle the oldest slot
        cursor = (cursor + 1) % n;
        return it;
      },
      clear() {
        for (const it of items) it.live = false;
      },
    };
  }
  // sprites: billboards (glows, flashes, smoke-less fire); beams: stretched cylinders along +z
  const sprites = pool(new THREE.PlaneGeometry(1, 1), addMat(radialTex), 220, "fl-sprites");
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true).rotateX(Math.PI / 2);
  const beams = pool(beamGeo, addMat(null), 170, "fl-beams");
  const ringGeo = new THREE.RingGeometry(0.86, 1, 40);
  const rings = pool(ringGeo, addMat(null), 20, "fl-rings");
  const shardMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: true });
  const shardGeo = new THREE.TetrahedronGeometry(1, 0);
  const shards = pool(shardGeo, shardMat, 260, "fl-shards");
  shards.im.renderOrder = 0;

  const col = new THREE.Color();
  const GREEN = new THREE.Color(0x39ff9c),
    ORANGE = new THREE.Color(0xff8a1a),
    RED = new THREE.Color(0xff3020),
    WHITE = new THREE.Color(0xfff1d6),
    CYAN = new THREE.Color(0x38d8ff),
    HOT = new THREE.Color(0xffa040),
    COLD = new THREE.Color(0x2a2f36);

  function spark(p, color, size, life, vel = null, grow = 1.6) {
    const s = sprites.take();
    s.p = (s.p || new THREE.Vector3()).copy(p);
    s.v = (s.v || new THREE.Vector3()).copy(vel || ZV);
    s.color = color;
    s.size = size;
    s.grow = grow;
    s.life = s.max = life;
    s.k = 1;
    return s;
  }
  const ZV = new THREE.Vector3();
  function ring(p, color, size, life) {
    const r = rings.take();
    r.p = (r.p || new THREE.Vector3()).copy(p);
    r.color = color;
    r.size = size;
    r.life = r.max = life;
  }
  const rnd = Math.random;
  function debrisBurst(p, n, speed, hot = 0.6, size = 1) {
    for (let i = 0; i < n; i++) {
      const s = shards.take();
      s.p = (s.p || new THREE.Vector3()).copy(p);
      s.v = (s.v || new THREE.Vector3()).set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize().multiplyScalar(speed * (0.3 + rnd()));
      s.r = (s.r || new THREE.Euler()).set(rnd() * 6, rnd() * 6, rnd() * 6);
      s.w = (s.w || new THREE.Vector3()).set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(14);
      s.size = size * (0.25 + rnd() * rnd() * 1.4);
      s.life = s.max = 1.4 + rnd() * 1.6;
      s.hot = rnd() < hot;
    }
  }
  const EXP = new THREE.Vector3();
  function explode(at, scale = 1, color = ORANGE) {
    const p = EXP.copy(at);
    spark(p, WHITE, 7 * scale, 0.18, null, 2.5);
    spark(p, color, 16 * scale, 0.55, null, 1.8);
    spark(p, RED, 6 * scale, 0.7, null, 1.8);
    for (let i = 0; i < 6; i++)
      spark(p, HOT, 3 + 3 * rnd() * scale, 0.4 + rnd() * 0.5, tmpV.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(60 * scale), 1.2);
    ring(p, color, 18 * scale, 0.5);
    debrisBurst(p, Math.round(10 * scale), 38 * scale, 0.55, scale);
  }
  const tmpV = new THREE.Vector3(),
    tmpW = new THREE.Vector3(),
    tmpQ = new THREE.Quaternion(),
    tmpM = new THREE.Matrix4(),
    tmpS = new THREE.Vector3(),
    UP = new THREE.Vector3(0, 1, 0);

  // ------------------------------------------------------------------ prefabs (end2-approach-kit.glb)
  const inst = {};
  const local = {}; // anchor frames inside prefabs (gate emitters, beacons)
  let gateBake = null;
  const barriers = createBarriers(group, 8);
  const ready = Promise.all([
    new Promise((ok, no) => new GLTFLoader().load(asset(MODELS + "end2-approach-kit.glb"), (g) => ok(g.scene), undefined, no)),
    barriers.ready,
  ]).then(([kit]) => {
    const node = (n) => kit.getObjectByName(n);
    const caps = { wreck_plate: 70, wreck_truss: 60, wreck_block: 70, pod: 28, interceptor: 40, turret_base: 10, turret_head: 14, emitter: 4 };
    for (const [n, cap] of Object.entries(caps)) inst[n] = createInstancer(group, bakePrefab(node(n)), cap, { name: n });
    const g = node("gate");
    g.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
    local.em = [0, 1, 2, 3].map((k) => new THREE.Matrix4().multiplyMatrices(inv, node(`em_${k}`).matrixWorld));
    local.gateBeacons = [];
    g.traverse((o) => o.name.startsWith("gt_beacon") && local.gateBeacons.push(new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld))));
    // the gate's glow dims when it falls: its own copy of the shared ap_glow material
    inst.gate = createInstancer(group, bakePrefab(g), 1, { name: "gate", materials: (m) => (m.name === "ap_glow" ? m.clone() : m) });
    gateBake = inst.gate;
    const f = node("gate_field");
    f.updateMatrixWorld(true);
    local.field = new THREE.Matrix4().multiplyMatrices(inv, f.matrixWorld);
    gateField = fieldInstances(group, bakePrefab(f)[0].geometry, 1, 0xff8a00);
    const b = node("turret_base");
    b.updateMatrixWorld(true);
    local.turretHead = new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(b.matrixWorld).invert(), node("turret_head").matrixWorld));
    gunBake = bakePrefab(node("ship_gun"));
    // glow materials the game drives: interceptor/turret eyes brighten as a group, gate glow dims when it falls
    for (const im of [...inst.gate.meshes]) if (im.material.name === "ap_glow") gateGlow.push(im.material);
    placeEmitters();
  });
  function placeEmitters() {
    if (!gate || !local.em) return;
    for (const e of gate.emitters) {
      e.base.setFromMatrixPosition(tmpM.multiplyMatrices(tmpM2.compose(gate.pos, tmpQ.identity(), new THREE.Vector3(1, 1, 1)), local.em[e.em]));
      e.pos.copy(e.base);
    }
  }
  const tmpM2 = new THREE.Matrix4();
  let gateField = null,
    gunBake = null;
  const gateGlow = [];
  // fog-piercing amber beacons on the gate corners and turret decks
  const beaconPts = lightPoints(16, { pixelMax: 30, fade: [300, 2500] });
  group.add(beaconPts);

  // the dropship's wing cannons (flight.js calls this once the hero model is in)
  const muzzles = [];
  function attachGuns(ship) {
    if (!gunBake) return;
    // both cannons in one merged mesh per material (static on the hull)
    const sides = [-1, 1].map((sx) => new THREE.Matrix4().compose(new THREE.Vector3(sx * 3.9, -0.62, 0.6), new THREE.Quaternion(), new THREE.Vector3(1.15, 1.15, 1.15)));
    for (const { geometry, material } of gunBake) {
      const g = mergeGeometries(sides.map((m) => geometry.clone().applyMatrix4(m)));
      const mesh = new THREE.Mesh(g, material);
      mesh.name = "ship-guns:" + material.name;
      ship.add(mesh);
    }
    for (const sx of [-1, 1]) {
      const m = new THREE.Object3D();
      m.position.set(sx * 3.9, -0.62, 0.6 - 2.5 * 1.15);
      ship.add(m);
      muzzles.push(m);
    }
  }

  // ------------------------------------------------------------------ the schedule (deterministic)
  const targets = []; // static-in-world things: wreckage, pods, pickets, turrets, emitters
  const decor = []; // far wreckage outside the corridor, never collides
  const waves = []; // interceptor waves: { t, entries: [...] }
  const pickets = []; // barrier drones (drawn by barrier.js)
  let gate = null;
  const phaseIndexAt = (t) => {
    let k = 0;
    for (let i = 0; i < phases.length; i++) if (t >= phases[i].t) k = i;
    return k;
  };
  function place(kind, tHit, lx, ly, extra = {}) {
    const z = route.z(tHit),
      y = route.y(tHit) + ly;
    const o = {
      kind,
      k: KINDS[kind],
      tHit,
      phase: phaseIndexAt(tHit),
      base: new THREE.Vector3(lx, y, z),
      pos: new THREE.Vector3(lx, y, z),
      drift: new THREE.Vector3((R() - 0.5) * 3, (R() - 0.5) * 2, 0),
      spinAxis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
      spin: (R() - 0.5) * 0.9,
      q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)),
      q: new THREE.Quaternion(),
      roll: R(),
      hp: 0,
      alive: true,
      skip: false,
      flash: 0,
      ...extra,
    };
    targets.push(o);
    return o;
  }
  let R = rng(C.seed ?? 1196);
  function build() {
    R = rng(C.seed ?? 1196);
    targets.length = decor.length = waves.length = pickets.length = 0;
    const s = (t) => t * S;
    const dens = Math.max(0.4, diff);
    // launch: three pods straight ahead, the first lesson
    place("pod", s(2.6), -6, 3);
    place("pod", s(3.2), 9, -2);
    place("pod", s(3.8), -2, -7);
    // debris field: wreckage every ~15 m, biased into the middle of the corridor
    const kinds = ["plate", "truss", "block", "block", "plate", "truss", "pod"];
    for (let t = 4.4; t < 12.6; t += 0.2 / dens) {
      const kind = kinds[Math.floor(R() * kinds.length)];
      const mid = R() < 0.45;
      place(kind, s(t + R() * 0.12), (R() * 2 - 1) * (mid ? 20 : W + 6), (R() * 2 - 1) * (mid ? 11 : H + 3));
    }
    // a pod cluster in the middle of the field: one shot, a chain reaction
    for (let k = 0; k < 4; k++) place("pod", s(8.4 + k * 0.05), -12 + k * 7.5, 4 - k * 3);
    // lighter wreckage through the interceptor phase
    for (let t = 13; t < 20; t += 0.55 / dens) place(kinds[Math.floor(R() * kinds.length)], s(t), (R() * 2 - 1) * (W + 4), (R() * 2 - 1) * (H + 2));
    // barrier pickets: shoot the pod to drop the field, or fly round it
    const pk = [
      [-22, 7], [19, -8], [-4, 13], [24, 0], [-18, -12], [6, 3],
    ];
    pk.forEach(([x, y], i) => {
      const o = place("picket", s(21.0 + i * 0.85), x, y, { field: 1, down: 0 });
      o.index = pickets.length;
      pickets.push(o);
    });
    for (let t = 26; t < 28.6; t += 0.45 / dens) place(kinds[Math.floor(R() * 6)], s(t), (R() * 2 - 1) * (W + 4), (R() * 2 - 1) * (H + 2));
    // the barrier gate across the whole corridor: four emitters
    const tg = s(29.0);
    gate = { tHit: tg, pos: new THREE.Vector3(0, route.y(tg), route.z(tg)), on: 1, hit: 0, bounces: 0, mercy: 0, phase: phaseIndexAt(tg) };
    gate.emitters = [0, 1, 2, 3].map((k) => place("emitter", tg, 0, 0, { em: k, noDrift: true }));
    placeEmitters();
    // HQ defences: flak towers on both edges of the causeway (their foot sits on the deck, y = 0)
    for (let k = 0; k < 7; k++) {
      const t = s(30.6 + k * 0.78);
      const x = (k % 2 ? 1 : -1) * 19.5;
      const foot = new THREE.Vector3(x, 0, route.z(t));
      const head = place("turret", t, x, 0, { noDrift: true, foot, cool: 1.2 + k * 0.37, tell: 0 });
      head.base.set(x, 25.2, foot.z);
      head.pos.copy(head.base);
      place("mast", t, x, 0, { noDrift: true, foot, owner: head }).base.set(x, 12, foot.z);
    }
    // heavier guns on the HQ itself: the claws of its two arms and the podium edge (heads only, no tower)
    for (const [x, y, z] of [[-140, 55, 276], [140, 55, 276], [-46, 91, 8], [46, 91, 8]]) {
      const head = place("turret", s(33.4), x, 0, { noDrift: true, foot: null, cool: 0.8 + R() * 1.4, tell: 0, range: 1100 });
      head.base.set(x, y, z);
      head.pos.copy(head.base);
    }
    // interceptor waves: [clock, count, entry side]
    const wv = [
      [12.6, 3, "ahead"], [15.4, 4, "ahead"], [18.2, 2, "left"], [18.6, 2, "right"], [23.2, 2, "ahead"], [31.0, 3, "ahead"], [33.6, 2, "left"],
    ];
    for (const [t, n, side] of wv) {
      const count = Math.max(1, Math.round(n * Math.min(1.5, dens)));
      for (let i = 0; i < count; i++)
        waves.push({
          t: s(t + i * 0.25),
          side,
          slot: new THREE.Vector3((i - (count - 1) / 2) * 22 + (R() - 0.5) * 8, (R() * 2 - 1) * 12, -(160 + R() * 70)),
          ph: R() * 6,
          spawned: false,
          phase: phaseIndexAt(s(t)),
        });
    }
    // far wreckage in the sky round the corridor (never collides)
    const dk = ["wreck_plate", "wreck_truss", "wreck_block", "interceptor"];
    const z0 = route.z(0),
      z1 = route.z(s(34));
    for (let i = 0; i < (C.decorCount ?? 150); i++) {
      let x = (R() * 2 - 1) * 420,
        y = (R() * 2 - 1) * 170;
      if (Math.abs(x) < 80 && Math.abs(y) < 50) x = Math.sign(x || 1) * (80 + R() * 200);
      const z = z1 + (z0 - z1) * R();
      decor.push({
        prefab: dk[i % 4],
        p: new THREE.Vector3(x, y, z),
        yRel: y,
        q0: new THREE.Quaternion().setFromEuler(new THREE.Euler(R() * 6, R() * 6, R() * 6)),
        axis: new THREE.Vector3(R() - 0.5, R() - 0.5, R() - 0.5).normalize(),
        spin: (R() - 0.5) * 0.5,
        s: 0.8 + R() * 1.4,
      });
    }
  }
  build();

  // ------------------------------------------------------------------ state
  let hull = HULL,
    heat = 0,
    overheated = false,
    fireCool = 0,
    gunSide = 0,
    lastHurt = -9,
    hurtK = 0,
    breachT = 0,
    breachTo = null,
    banner = null,
    bannerT = 0,
    lastPhase = -1,
    kills = 0,
    hits = 0,
    shots = 0,
    breaches = 0,
    lockTarget = null,
    clockNow = 0,
    mercyT = 0;
  const fails = new Array(phases.length).fill(0);
  const interceptors = []; // live: { wave, rel: Vector3, state, t, hp, ... }
  const lasers = []; // live player bolts
  const bolts = []; // live enemy bolts
  const tells = []; // turret sight lines (drawn as beams)

  function resetFrom(phase) {
    // every target from `phase` on comes back (with fewer of them after repeated failures)
    const density = fails[phase] >= (C.mercyAfter ?? 2) ? 0.6 : 1;
    for (const o of targets)
      if (o.phase >= phase) {
        o.alive = true;
        o.hp = o.k.hp;
        o.flash = 0;
        o.fuse = 0;
        o.skip = o.kind !== "emitter" && o.kind !== "picket" && o.kind !== "mast" && o.roll > density;
        if (o.kind === "picket") (o.field = 1), (o.down = 0);
        if (o.kind === "turret") (o.cool = 1.2 + o.roll * 1.5), (o.tell = 0);
        o.pos.copy(o.base);
      }
    if (gate && gate.phase >= phase) (gate.on = 1), (gate.hit = 0);
    for (const w of waves) if (w.phase >= phase) w.spawned = false;
    interceptors.length = 0;
    bolts.length = 0;
    tells.length = 0;
  }
  function start() {
    for (let i = 0; i < fails.length; i++) fails[i] = 0;
    resetFrom(0);
    if (gate) (gate.bounces = 0), (gate.mercy = 0);
    hull = HULL;
    heat = 0;
    overheated = false;
    breachT = 0;
    breachTo = null;
    kills = hits = shots = breaches = 0;
    lastPhase = -1;
    lasers.length = 0;
    sprites.clear();
    beams.clear();
    shards.clear();
    rings.clear();
    lastHurt = -9;
    hurtK = 0;
    hud.breach(null);
    hud.banner("", "", "");
  }

  // ------------------------------------------------------------------ helpers
  const shipBox = new THREE.Vector3(5.5, 2.2, 5.0);
  function touches(p, r, ship) {
    const dx = (p.x - ship.x) / (r + shipBox.x),
      dy = (p.y - ship.y) / (r + shipBox.y),
      dz = (p.z - ship.z) / (r + shipBox.z);
    return dx * dx + dy * dy + dz * dz < 1;
  }
  let damageThisFrame = 0,
    stall = 0,
    shake = 0,
    knockback = 0;
  let play = () => {};
  let invuln = 0;
  function hurt(amount, why) {
    if (breachT > 0 || invuln > 0) return;
    invuln = C.hitGrace ?? 0.4; // a short grace after every hit: no double hits from one crash
    const d = amount * Math.max(0.35, diff);
    hull = Math.max(0, hull - d);
    damageThisFrame += d;
    hits++;
    lastHurt = clockNow;
    hurtK = Math.min(1, hurtK + 0.35 + d / 40);
    shake = Math.max(shake, Math.min(1, 0.35 + d / 30));
    play("hurt");
    if (hull <= 0) {
      if (failMode === "checkpoint") {
        breachT = 1.7;
        breaches++;
        const ph = phaseIndexAt(clockNow);
        fails[ph]++;
        breachTo = ph;
        hud.breach(`Rerouting · back to ${phases[ph].title.toLowerCase()}`);
        play("lowhealth");
      } else hull = 1;
    }
  }
  function kill(o, by = "laser") {
    if (!o.alive) return;
    o.alive = false;
    kills++;
    const big = o.kind === "inter" || o.kind === "turret" || o.kind === "emitter" || o.kind === "picket";
    explode(o.pos, o.kind === "pod" ? 1.5 : big ? 1.25 : 0.9, o.kind === "emitter" ? WHITE : ORANGE);
    play(big ? "kill-heavy" : "kill");
    if (o.kind === "pod") {
      // a volatile pod takes its neighbours with it (and hurts the ship if it is close)
      for (const n of targets)
        if (n.alive && !n.skip && n !== o && n.k.solid && n.kind !== "mast" && n.pos.distanceToSquared(o.pos) < o.k.blast * o.k.blast) {
          n.hp -= 3;
          if (n.hp <= 0 && !n.fuse) n.fuse = 0.09 + rnd() * 0.14; // chain reaction, a beat apart
        }
      if (lastShip && lastShip.distanceTo(o.pos) < 14 && by === "laser") hurt(10, "blast");
    }
    if (o.kind === "picket") o.field = 0.999;
    if (o.kind === "turret") o.tell = 0;
    if (o.kind === "emitter" && gate && gate.emitters.every((e) => !e.alive)) {
      play("waveclear");
      ring(gate.pos, ORANGE, 90, 1.0);
    }
  }
  let lastShip = null;

  // ------------------------------------------------------------------ the bot (test mode only: ?test=1 or ?flightbot=1)
  function bot(ship, shipVel, camera) {
    // aim: gate emitters first, then whatever is about to hit us, then interceptors, then towers
    let best = null,
      bestScore = Infinity;
    const consider = (p, score, o) => {
      if (score < bestScore) (bestScore = score), (best = { p, o });
    };
    for (const o of targets) {
      if (!o.alive || o.skip || !o.k.hp) continue;
      const dz = ship.z - o.pos.z;
      if (dz < 30 || dz > 900) continue;
      let score = dz;
      if (o.kind === "emitter") score -= 2000;
      else if (o.kind === "picket") score -= 600;
      else if (o.kind === "turret") score -= 300;
      else if (Math.abs(o.pos.x - ship.x) < o.k.r + 8 && Math.abs(o.pos.y - ship.y) < o.k.r + 5) score -= 400;
      else if (o.kind !== "pod") score += 500;
      consider(o.pos, score, o);
    }
    for (const it of interceptors) if (it.alive && it.pos.z < ship.z - 40) consider(it.pos, ship.z - it.pos.z - 700, it);
    let aim = null;
    if (best) {
      const v = tmpV.copy(best.p).project(camera);
      aim = { x: THREE.MathUtils.clamp(v.x, -0.9, 0.9), y: THREE.MathUtils.clamp(v.y, -0.85, 0.85) };
    }
    // steer: pick the free spot in the corridor with the fewest hazards over the next ~2.5 s
    let bx = ship.x,
      by = ship.y,
      bc = Infinity;
    const cy = route.y(clockNow);
    for (let ix = -4; ix <= 4; ix++)
      for (let iy = -2; iy <= 2; iy++) {
        const x = (ix / 4) * W * 0.9,
          y = cy + (iy / 2) * H * 0.85;
        let c = Math.hypot(x - ship.x, (y - ship.y) * 1.5) * 0.01 + Math.abs(x) * 0.002;
        for (const o of targets) {
          if (!o.alive || o.skip || !o.k.solid) continue;
          const dz = ship.z - o.pos.z;
          if (dz < -10 || dz > 190) continue;
          const mx = o.kind === "picket" ? 17 : o.k.r + 8,
            my = o.kind === "picket" ? 9 : o.k.r + 5;
          const ox = Math.abs(o.pos.x - x),
            oy = Math.abs((o.kind === "mast" ? Math.min(o.pos.y + 14, Math.max(o.pos.y - 12, y)) : o.pos.y) - y);
          if (ox < mx && oy < my) c += (2 + (mx - ox) / mx) * (220 - dz);
        }
        for (const it of interceptors) {
          if (!it.alive) continue;
          const dz = ship.z - it.pos.z;
          if (dz > -10 && dz < 150 && Math.abs(it.pos.x - x) < 12 && Math.abs(it.pos.y - y) < 8) c += 150;
        }
        for (const b of bolts) {
          const dz = ship.z - b.p.z;
          if (dz < 0 || dz > 260) continue;
          if (Math.abs(b.p.x - x) < 8 && Math.abs(b.p.y - y) < 6) c += 120;
        }
        if (c < bc) (bc = c), (bx = x), (by = y);
      }
    return { dx: Math.abs(bx - ship.x) > 1.5 ? Math.sign(bx - ship.x) : 0, dy: Math.abs(by - ship.y) > 1.2 ? Math.sign(by - ship.y) : 0, aim, fire: !!best && !overheated && heat < 0.85 };
  }

  // ------------------------------------------------------------------ update
  const ray = new THREE.Raycaster(),
    ndc = new THREE.Vector2(),
    aimPoint = new THREE.Vector3(),
    muzzle = new THREE.Vector3(),
    prev = new THREE.Vector3(),
    seg = new THREE.Vector3(),
    camQ = new THREE.Quaternion();

  function segHit(a, b, c, r) {
    // segment a->b against sphere (c, r)
    seg.subVectors(b, a);
    const len2 = seg.lengthSq() || 1e-6;
    const t = THREE.MathUtils.clamp(tmpW.subVectors(c, a).dot(seg) / len2, 0, 1);
    return tmpW.copy(a).addScaledVector(seg, t).distanceToSquared(c) < r * r;
  }

  function update(ctx) {
    const { dt, time, clock, ship, shipVel, camera, active } = ctx;
    play = ctx.sound || play;
    clockNow = clock;
    lastShip = ship;
    invuln = Math.max(0, invuln - dt);
    damageThisFrame = 0;
    stall = 0;
    knockback = 0;
    let rewindTo = null;
    const showHud = active && dt > 0;
    hud.show(showHud);

    // ---- phase banners
    const ph = phaseIndexAt(clock);
    if (active && ph !== lastPhase) {
      if (ph > lastPhase) {
        banner = phases[ph];
        bannerT = 3.4;
        if (ph > 0) play("wave");
      }
      lastPhase = ph;
    }
    bannerT -= dt;
    const gateUp = gate && gate.on > 0 && clock > phases[3].t - 0.1 && clock < gate.tHit + 0.5;
    if (bannerT > 0 && banner) hud.banner(banner.kicker, banner.title, banner.sub);
    else if (gateUp) hud.banner("BARRIER GATE", gate.mercy ? "ESCORTS ON THE GATE" : "SHOOT THE EMITTERS", gate.bounces ? `Bounced ${gate.bounces}× · the field holds while one emitter stands` : "Four emitters · one on each side of the frame");
    else hud.banner("", "", "");
    hud.gate(gateUp ? gate.emitters.map((e) => e.alive) : null);

    // ---- breach sequence (hull 0 in checkpoint mode)
    if (breachT > 0) {
      breachT -= dt;
      stall = dt;
      if (breachTo !== null && breachT < 0.9) {
        rewindTo = phases[breachTo].t;
        resetFrom(breachTo);
        hull = HULL;
        breachTo = null;
      }
      if (breachT <= 0) hud.breach(null);
    }

    // ---- input: the bot (tests) or the player
    let fire = ctx.fire,
      aim = ctx.aim;
    let steer = null;
    if (botOn && active) {
      steer = bot(ship, shipVel, camera);
      if (steer.aim) aim.x = steer.aim.x, aim.y = steer.aim.y;
      fire = steer.fire;
    }

    // ---- aim: the reticle ray, with a little magnetism onto the nearest shootable thing
    ndc.set(aim.x, aim.y);
    ray.setFromCamera(ndc, camera);
    const o0 = ray.ray.origin,
      d0 = ray.ray.direction;
    lockTarget = null;
    let bestA = C.aimAssist ?? 0.022;
    const tryLock = (p, r, obj) => {
      tmpV.subVectors(p, o0);
      const along = tmpV.dot(d0);
      if (along < 40 || along > 1400) return;
      const perp = Math.sqrt(Math.max(0, tmpV.lengthSq() - along * along));
      const a = Math.max(0, perp - r) / along;
      if (a < bestA) (bestA = a), (lockTarget = obj);
    };
    if (active) {
      for (const o of targets) if (o.alive && !o.skip && o.k.hp) tryLock(o.pos, o.k.r, o);
      for (const it of interceptors) if (it.alive) tryLock(it.pos, KINDS.inter.r, it);
    }
    if (lockTarget) {
      aimPoint.copy(lockTarget.pos);
      if (lockTarget.vel) aimPoint.addScaledVector(lockTarget.vel, lockTarget.pos.distanceTo(ship) / (C.laserSpeed ?? 900));
    } else aimPoint.copy(o0).addScaledVector(d0, 900);

    // ---- lasers: heat, fire, travel, hit
    heat = Math.max(0, heat - dt * (C.laserCool ?? 0.34));
    if (overheated && heat < 0.35) overheated = false;
    fireCool -= dt;
    if (active && fire && !overheated && fireCool <= 0 && breachT <= 0 && muzzles.length) {
      fireCool = 1 / (C.laserRate ?? 9);
      gunSide ^= 1;
      muzzles[gunSide].getWorldPosition(muzzle);
      root.worldToLocal(muzzle);
      const dir = tmpW.subVectors(aimPoint, muzzle).normalize();
      const spd = C.laserSpeed ?? 900;
      lasers.push({ p: muzzle.clone(), v: dir.clone().multiplyScalar(spd).add(shipVel), life: 1.3 });
      spark(muzzle, GREEN, 2.4, 0.06, shipVel, 1.2);
      heat += C.laserHeat ?? 0.05;
      shots++;
      play("fire");
      if (heat >= 1) (overheated = true), play("overheat");
    }
    for (let i = lasers.length - 1; i >= 0; i--) {
      const L = lasers[i];
      prev.copy(L.p);
      L.p.addScaledVector(L.v, dt);
      L.life -= dt;
      let hitObj = null;
      for (const o of targets) {
        if (!o.alive || o.skip || !o.k.hp) continue;
        if (Math.abs(o.pos.z - L.p.z) > 80) continue;
        if (segHit(prev, L.p, o.pos, o.k.r + 0.6)) {
          hitObj = o;
          break;
        }
      }
      if (!hitObj)
        for (const it of interceptors)
          if (it.alive && segHit(prev, L.p, it.pos, KINDS.inter.r + 0.6)) {
            hitObj = it;
            break;
          }
      if (hitObj) {
        hitObj.hp -= C.laserDamage ?? 1;
        hitObj.flash = 1;
        if (hitObj.kind === "picket") hitObj.hit = 1;
        spark(tmpV.copy(hitObj.pos).lerp(prev, 0.08), WHITE, 3.2, 0.12, null, 2);
        debrisBurst(tmpV, 3, 18, 1, 0.5);
        hud.hit();
        play("hit");
        if (hitObj.hp <= 0) hitObj.kind === undefined ? killInterceptor(hitObj) : kill(hitObj);
        lasers.splice(i, 1);
        continue;
      }
      if (L.life <= 0) lasers.splice(i, 1);
    }

    // ---- static targets: drift, tumble, collide
    const shipZ = ship.z;
    for (const o of targets) {
      if (!o.alive || o.skip) continue;
      const ahead = shipZ - o.base.z;
      if (ahead > 2400 || ahead < -120) continue;
      if (!o.noDrift) {
        o.pos.copy(o.base).addScaledVector(o.drift, time * 0.4 - 6);
        o.pos.y += Math.sin(time * 0.7 + o.roll * 9) * 0.8;
        o.q.setFromAxisAngle(o.spinAxis, time * o.spin).multiply(o.q0);
      }
      o.flash = Math.max(0, o.flash - dt * 6);
      if (o.fuse > 0 && (o.fuse -= dt) <= 0) {
        o.fuse = 0;
        kill(o, "blast");
        continue;
      }
      if (o.kind === "picket") o.hit = Math.max(0, (o.hit || 0) - dt * 1.6);
      if (!active || breachT > 0) continue;
      // collisions
      if (o.kind === "mast") {
        if (Math.abs(ship.z - o.pos.z) < 3.2 + 5 && Math.abs(ship.x - o.pos.x) < 3.2 + 5.5 && ship.y < 26.5 + 2.2) {
          hurt(o.k.dmg, "mast");
          stall = Math.max(stall, 0.25);
          explode(tmpV.set(o.pos.x, ship.y, o.pos.z), 0.8);
          o.alive = false;
          if (o.owner) kill(o.owner, "crash");
        }
        continue;
      }
      if (o.kind === "picket" && o.field > 0.5 && Math.abs(ship.z - o.pos.z) < 4 && Math.abs(ship.x - o.pos.x) < 14 + 3 && Math.abs(ship.y - o.pos.y) < 6 + 1.5) {
        o.field = 0.49; // the field shorts out on the hull
        o.hit = 1;
        hurt(C.fieldDamage ?? 20, "field");
        stall = Math.max(stall, 0.3);
        play("shield");
      }
      if (o.k.solid && touches(o.pos, o.k.r, ship)) {
        hurt(o.k.dmg, o.kind);
        stall = Math.max(stall, 0.25);
        kill(o, "crash");
        kills--; // a crash is not a kill
      }
    }
    // picket fields collapse after their pod dies or they short out
    for (const p of pickets) {
      if (p.field > 0 && p.field < 1) p.field = Math.max(0, p.field - dt * 1.4);
      p.down = p.alive ? 0 : Math.min(1, (p.down || 0) + dt * 0.5);
    }

    // ---- turrets: track, tell (a red sight line), then a three-round flak burst
    tells.length = 0;
    for (const o of targets) {
      if (o.kind !== "turret" || !o.alive || o.skip) continue;
      const dz = shipZ - o.pos.z;
      const live = active && breachT <= 0 && dz > 40 && dz < (o.range ?? 760) && clock < phases[5].t;
      if (!live) continue;
      o.cool -= dt * Math.max(0.5, diff);
      if (o.cool <= 0 && !o.tell) (o.tell = C.turretTell ?? 0.7), play("enemy-tell");
      if (o.tell > 0) {
        o.tell -= dt;
        tells.push(o);
        if (o.tell <= 0) {
          o.tell = 0;
          o.cool = (C.turretCooldown ?? 2.3) + rnd() * 0.6;
          o.burst = 3;
          o.burstT = 0;
        }
      }
      if (o.burst > 0) {
        o.burstT -= dt;
        if (o.burstT <= 0) {
          o.burst--;
          o.burstT = 0.11;
          shoot(o.pos, ship, shipVel, C.flakSpeed ?? 230, C.flakDamage ?? 8, 3.5, true);
        }
      }
    }

    // ---- interceptors: dive in, hold a slot ahead and weave, fire with a tell, then break past you
    for (const w of waves) {
      if (w.spawned || clock < w.t || !active || breachT > 0 || clock > phases[5].t) continue;
      w.spawned = true;
      const from = w.side === "left" ? new THREE.Vector3(-260, 30, -380) : w.side === "right" ? new THREE.Vector3(260, 30, -380) : new THREE.Vector3(w.slot.x * 2, w.slot.y + 40, -1100);
      interceptors.push({ wave: w, rel: from, from: from.clone(), t: 0, hp: KINDS.inter.hp, alive: true, pos: new THREE.Vector3(), vel: new THREE.Vector3(), cool: 1.0 + rnd() * 1.2, tellT: 0, flash: 0, q: new THREE.Quaternion() });
    }
    const centre = tmpS.set(0, route.y(clock), route.z(clock));
    for (let i = interceptors.length - 1; i >= 0; i--) {
      const it = interceptors[i];
      if (!it.alive) {
        interceptors.splice(i, 1);
        continue;
      }
      it.t += dt;
      const w = it.wave,
        hold = C.interceptorHold ?? 7;
      const slot = tmpV.set(w.slot.x + Math.sin(time * 0.9 + w.ph) * 14, w.slot.y + Math.cos(time * 0.7 + w.ph) * 6, w.slot.z);
      const was = it.pos.clone();
      if (it.t < 2.4) it.rel.lerpVectors(it.from, slot, 1 - Math.pow(1 - it.t / 2.4, 3));
      else if (it.t < 2.4 + hold) it.rel.copy(slot);
      else it.rel.z += dt * (60 + (it.t - 2.4 - hold) * 160); // break: dive past the ship
      it.pos.copy(centre).add(it.rel);
      if (dt > 0) it.vel.subVectors(it.pos, was).divideScalar(dt);
      // face the ship while holding, along the dive while breaking
      tmpM.lookAt(it.t < 2.4 + hold ? ship : tmpW.copy(it.pos).add(it.vel), it.pos, UP);
      it.q.setFromRotationMatrix(tmpM);
      it.flash = Math.max(0, it.flash - dt * 6);
      if (it.rel.z > 80) {
        interceptors.splice(i, 1);
        continue;
      }
      if (!active || breachT > 0) continue;
      if (it.t > 2.0 && it.t < 2.4 + hold && clock < phases[5].t) {
        it.cool -= dt * Math.max(0.5, diff);
        if (it.cool <= 0 && it.tellT <= 0) (it.tellT = C.interceptorTell ?? 0.55), play("enemy-tell");
        if (it.tellT > 0) {
          it.tellT -= dt;
          if (it.tellT <= 0) {
            it.cool = (C.interceptorCooldown ?? 2.0) + rnd() * 0.8;
            shoot(it.pos, ship, shipVel, C.boltSpeed ?? 190, C.boltDamage ?? 7, 2.4, false);
            play("enemy");
          }
        }
      }
      if (touches(it.pos, KINDS.inter.r, ship)) {
        hurt(KINDS.inter.dmg, "ram");
        stall = Math.max(stall, 0.2);
        killInterceptor(it);
        kills--;
      }
    }

    // ---- enemy bolts
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.p.addScaledVector(b.v, dt);
      b.life -= dt;
      if (active && breachT <= 0 && touches(b.p, b.r * 0.5, ship)) {
        hurt(b.dmg, "bolt");
        spark(b.p, b.flak ? ORANGE : RED, 8, 0.25, null, 2);
        bolts.splice(i, 1);
        continue;
      }
      if (b.flak && b.p.distanceTo(ship) < 10 && b.p.z < ship.z + 6 && !b.popped) {
        // flak pops near the ship: a wider, weaker burst you can still slip
        b.popped = true;
        spark(b.p, ORANGE, 9, 0.3, null, 2.2);
        if (touches(b.p, 3.2, ship)) hurt(b.dmg * 0.5, "flak");
      }
      if (b.life <= 0 || b.p.z > ship.z + 60) bolts.splice(i, 1);
    }

    // ---- the barrier gate: field up while any emitter stands; flying into it bounces you back
    if (gate) {
      gate.hit = Math.max(0, gate.hit - dt * 1.5);
      const anyUp = gate.emitters.some((e) => e.alive);
      if (!anyUp && gate.on > 0) gate.on = Math.max(0, gate.on - dt * 1.2);
      if (gate.on >= 1 && active && breachT <= 0 && ship.z - gate.pos.z < 6 && ship.z - gate.pos.z > -4) {
        gate.bounces++;
        gate.hit = 1;
        hurt(C.gateDamage ?? 26, "gate");
        knockback = (C.gateKnockback ?? 2.2) * S;
        stall = 0.15;
        shake = 1;
        play("bash");
        ring(tmpV.set(ship.x, ship.y, gate.pos.z), ORANGE, 30, 0.6);
        if (gate.bounces >= (C.mercyAfter ?? 2)) gate.mercy = 1;
      }
      // mercy: after repeated bounces the escorts burn the emitters down one by one
      if (gate.mercy && anyUp && active) {
        mercyT -= dt;
        if (mercyT <= 0) {
          mercyT = 0.9;
          const e = gate.emitters.find((x) => x.alive);
          const from = tmpW.set(e.pos.x * 0.3 + (rnd() - 0.5) * 60, e.pos.y + 50, ship.z + 160);
          beamFx.push({ a: from.clone(), b: e.pos.clone(), life: 0.25, color: CYAN });
          kill(e, "escort");
          kills--;
        }
      }
    }

    // ---- a damaged hull sparks and trails embers (below 40 %)
    if (active && hull < HULL * 0.4 && rnd() < dt * (hull < HULL * 0.2 ? 30 : 14)) {
      tmpV.set((rnd() - 0.5) * 6, 0.4 + rnd() * 0.6, 1 + rnd() * 3).add(ship);
      spark(tmpV, rnd() < 0.5 ? HOT : RED, 1.2 + rnd() * 1.6, 0.5, tmpW.copy(shipVel).multiplyScalar(0.85), 1.4);
    }
    // ---- hull regeneration, hurt edge
    if (clock - lastHurt > (C.regenDelay ?? 3) && hull > 0 && breachT <= 0) hull = Math.min(HULL, hull + dt * (C.hullRegen ?? 3));
    hurtK = Math.max(0, hurtK - dt * 1.6);
    shake = Math.max(0, shake - dt * 2.5);

    draw(dt, time, camera, ship, active);

    // ---- HUD
    if (showHud) {
      const w = innerWidth,
        h = innerHeight;
      let lx = 0,
        ly = 0;
      if (lockTarget) {
        tmpV.copy(lockTarget.pos).project(camera);
        lx = (tmpV.x * 0.5 + 0.5) * w;
        ly = (-tmpV.y * 0.5 + 0.5) * h;
      }
      hud.reticle((aim.x * 0.5 + 0.5) * w, (-aim.y * 0.5 + 0.5) * h, { locked: !!lockTarget, hot: overheated, lx, ly, dt });
      hud.hull(hull, HULL);
      hud.heat(heat, overheated);
      hud.kills(kills);
      hud.hurt(hurtK);
    }
    return { stall, knockback, rewindTo, shake, damage: damageThisFrame, bot: steer };
  }

  function shoot(from, ship, shipVel, speed, dmg, r, flak) {
    // lead the ship a little (one iteration is plenty at these speeds)
    const t = from.distanceTo(ship) / (speed + 70);
    const at = tmpW.copy(ship).addScaledVector(shipVel, t * (C.enemyLead ?? 0.7));
    const v = at.sub(from).normalize();
    if (flak) v.x += (rnd() - 0.5) * 0.04, v.y += (rnd() - 0.5) * 0.04;
    bolts.push({ p: from.clone(), v: v.normalize().multiplyScalar(speed), life: 4, dmg, r, flak });
    spark(from, flak ? ORANGE : RED, flak ? 7 : 5, 0.08, null, 1.5);
  }
  function killInterceptor(it) {
    if (!it.alive) return;
    it.alive = false;
    kills++;
    explode(it.pos, 1.2);
    play("kill-heavy");
  }

  // ------------------------------------------------------------------ drawing (instanced)
  const beamFx = []; // escort beams, short-lived
  const one = new THREE.Vector3(1, 1, 1);
  const M = new THREE.Matrix4();
  const amber = new THREE.Color(0xffa020).multiplyScalar(1.2);
  function draw(dt, time, camera, ship, active) {
    if (!inst.pod) return;
    camQ.copy(camera.quaternion);
    const camZ = camera.position.z;
    // static targets
    for (const o of targets) {
      if (o.kind === "mast" || o.kind === "picket") continue;
      const near = camZ - o.pos.z;
      const show = o.alive && !o.skip && near < 2300 && near > -60;
      o.drawn = show;
    }
    const counters = {};
    const put = (prefab, m) => {
      const n = counters[prefab] || 0;
      if (n >= inst[prefab].capacity) return;
      inst[prefab].set(n, m);
      counters[prefab] = n + 1;
    };
    for (const o of targets) {
      if (!o.drawn) continue;
      if (o.kind === "turret") {
        // the tower and its head (aimed at the ship while it is in range)
        if (o.foot) put("turret_base", M.compose(o.foot, tmpQ.identity(), one));
        if (camZ - o.pos.z > 40) {
          tmpM.lookAt(ship, o.pos, UP);
          tmpQ.setFromRotationMatrix(tmpM);
        }
        M.compose(o.pos, tmpQ, one);
        put("turret_head", M);
        continue;
      }
      if (o.kind === "emitter") {
        M.multiplyMatrices(tmpM.compose(gate.pos, tmpQ.identity(), one), local.em[o.em]);
        o.pos.setFromMatrixPosition(M);
        // a spinning core housing; it shudders when hit
        M.multiply(tmpM.makeRotationZ(time * 0.6 + o.em));
        if (o.flash > 0) M.multiply(tmpM.makeTranslation((rnd() - 0.5) * 0.6 * o.flash, (rnd() - 0.5) * 0.6 * o.flash, 0));
        put("emitter", M);
        continue;
      }
      const sc = o.flash > 0 ? 1 + o.flash * 0.06 : 1;
      M.compose(o.pos, o.q, tmpS.set(sc, sc, sc));
      put(o.k.prefab, M);
    }
    // turrets whose head died still show their tower
    for (const o of targets) if (o.kind === "turret" && o.foot && !o.alive && !o.skip && camZ - o.pos.z < 2300 && camZ - o.pos.z > -60) put("turret_base", M.compose(o.foot, tmpQ.identity(), one));
    for (const it of interceptors) {
      if (!it.alive) continue;
      const k = 1 + it.flash * 0.08;
      M.compose(it.pos, it.q, tmpS.set(k, k, k));
      put("interceptor", M);
    }
    // far wreckage (follows the path height loosely so it frames the corridor)
    for (const d of decor) {
      const near = camZ - d.p.z;
      if (near > 2600 || near < -100) continue;
      tmpV.set(d.p.x, route.y(Math.min(clockNow + near / 70, route.approachTime)) + d.yRel, d.p.z);
      tmpQ.setFromAxisAngle(d.axis, time * d.spin).multiply(d.q0);
      M.compose(tmpV, tmpQ, tmpS.set(d.s, d.s, d.s));
      put(d.prefab, M);
    }
    for (const k of Object.keys(inst)) if (k !== "gate") inst[k].commit();
    // the gate + its field
    if (gate) {
      const near = camZ - gate.pos.z;
      const showGate = near < 2600 && near > -80;
      if (showGate) inst.gate.set(0, M.compose(gate.pos, tmpQ.identity(), one));
      else inst.gate.hide(0);
      inst.gate.commit();
      if (gateField) {
        gateField.set(0, M.multiplyMatrices(tmpM.compose(gate.pos, tmpQ.identity(), one), local.field), gate.hit, 3.3, showGate ? gate.on : 0);
        gateField.commit(time);
      }
      for (const m of gateGlow) m.emissiveIntensity = 0.3 + 1.7 * gate.on;
      local.gateBeacons.forEach((p, i) => beaconPts.set(i, tmpV.copy(p).add(gate.pos), amber, showGate ? 5 : 0, 0.8, i * 0.25, 0.3));
      beaconPts.geometry.attributes.position.needsUpdate = true;
      beaconPts.geometry.attributes.aSize.needsUpdate = true;
      beaconPts.geometry.attributes.color.needsUpdate = true;
      beaconPts.geometry.attributes.aBlink.needsUpdate = true;
      beaconPts.material.uniforms.time.value = time;
      beaconPts.material.uniforms.scale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    }
    // pickets (barrier.js)
    for (const p of pickets) {
      p.x = p.pos.x;
      p.y = p.pos.y;
      p.z = p.pos.z;
      p.phase = p.roll * 6;
      p.visible = !p.skip && camZ - p.pos.z < 2300 && camZ - p.pos.z > -60;
    }
    barriers.update(time, dt, pickets, ship, camera);

    // ---- fx
    let n = 0;
    const B = beams.im,
      Sp = sprites.im,
      Rg = rings.im,
      Sh = shards.im;
    const beam = (a, b, width, color, k) => {
      if (n >= beams.items.length) return;
      tmpV.subVectors(b, a);
      const len = tmpV.length();
      tmpQ.setFromUnitVectors(ZAXIS, tmpV.divideScalar(len || 1));
      M.compose(tmpW.addVectors(a, b).multiplyScalar(0.5), tmpQ, tmpS.set(width, width, len));
      B.setMatrixAt(n, M);
      B.setColorAt(n, col.copy(color).multiplyScalar(k));
      n++;
    };
    for (const L of lasers) beam(tmpA.copy(L.p).addScaledVector(L.v, -0.018), L.p, 0.22, GREEN, 2.6);
    for (const b of bolts) beam(tmpA.copy(b.p).addScaledVector(b.v, b.flak ? -0.03 : -0.035), b.p, b.flak ? 0.7 : 0.45, b.flak ? ORANGE : RED, 2.2);
    for (const o of tells) {
      // the sight line: thin, flickering, brighter as the tell runs out
      const k = 1 - o.tell / (C.turretTell ?? 0.7);
      beam(o.pos, ship, 0.06 + 0.1 * k, RED, (0.5 + 1.5 * k) * (0.7 + 0.3 * Math.sin(time * 60)));
    }
    for (let i = beamFx.length - 1; i >= 0; i--) {
      const f = beamFx[i];
      f.life -= dt;
      if (f.life <= 0) {
        beamFx.splice(i, 1);
        continue;
      }
      beam(f.a, f.b, 0.6, f.color, 3 * f.life * 4);
    }
    B.count = n;
    B.visible = n > 0;
    B.instanceMatrix.needsUpdate = true;
    if (B.instanceColor) B.instanceColor.needsUpdate = true;
    // sprites: free sparks, enemy bolt heads, interceptor tells
    let s = 0;
    const sprite = (p, size, color, k) => {
      if (s >= sprites.items.length) return;
      M.compose(p, camQ, tmpS.set(size, size, size));
      Sp.setMatrixAt(s, M);
      Sp.setColorAt(s, col.copy(color).multiplyScalar(k));
      s++;
    };
    for (const it of sprites.items) {
      if (!it.live) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.live = false;
        continue;
      }
      it.p.addScaledVector(it.v, dt);
      const a = it.life / it.max;
      sprite(it.p, it.size * (1 + (1 - a) * it.grow), it.color, a * 1.6);
    }
    for (const b of bolts) sprite(b.p, b.flak ? 5 : 3.6, b.flak ? ORANGE : RED, 1.8);
    for (const it of interceptors)
      if (it.alive && it.tellT > 0) {
        const k = 1 - it.tellT / (C.interceptorTell ?? 0.55);
        sprite(tmpA.copy(it.pos).add(tmpW.set(0, 0, 3.2).applyQuaternion(it.q)), 3 + 7 * k, RED, 1 + 2 * k);
      }
    for (const o of tells) sprite(tmpA.copy(o.pos).add(tmpW.set(0, 1.2, 1.6).applyQuaternion(tmpQ.setFromRotationMatrix(tmpM.lookAt(ship, o.pos, UP)))), 3 + 4 * (1 - o.tell / (C.turretTell ?? 0.7)), RED, 1.5);
    // emitter cores glow while they stand
    if (gate && camZ - gate.pos.z < 2600)
      for (const e of gate.emitters) if (e.alive && !e.skip) sprite(e.pos, 9 + Math.sin(time * 8 + e.em) * 1.5 + e.flash * 6, ORANGE, 0.9 + e.flash);
    Sp.count = s;
    Sp.visible = s > 0;
    Sp.instanceMatrix.needsUpdate = true;
    if (Sp.instanceColor) Sp.instanceColor.needsUpdate = true;
    // shockwave rings
    let r = 0;
    for (const it of rings.items) {
      if (!it.live) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.live = false;
        continue;
      }
      const a = it.life / it.max;
      const size = it.size * (0.2 + (1 - a) * 1.2);
      M.compose(it.p, camQ, tmpS.set(size, size, size));
      Rg.setMatrixAt(r, M);
      Rg.setColorAt(r, col.copy(it.color).multiplyScalar(a * 1.4));
      r++;
    }
    Rg.count = r;
    Rg.visible = r > 0;
    Rg.instanceMatrix.needsUpdate = true;
    if (Rg.instanceColor) Rg.instanceColor.needsUpdate = true;
    // shards: tumbling chunks, hot ones cool from orange to gunmetal
    let h = 0;
    for (const it of shards.items) {
      if (!it.live) continue;
      it.life -= dt;
      if (it.life <= 0) {
        it.live = false;
        continue;
      }
      it.v.y -= dt * 9;
      it.p.addScaledVector(it.v, dt);
      it.r.x += it.w.x * dt;
      it.r.y += it.w.y * dt;
      it.r.z += it.w.z * dt;
      M.compose(it.p, tmpQ.setFromEuler(it.r), tmpS.set(it.size, it.size * 0.6, it.size * 1.3));
      Sh.setMatrixAt(h, M);
      const a = it.life / it.max;
      if (it.hot) Sh.setColorAt(h, col.copy(COLD).lerp(HOT, Math.max(0, a * 1.6 - 0.6)).multiplyScalar(a > 0.6 ? 2.2 : 1));
      else Sh.setColorAt(h, COLD);
      h++;
    }
    Sh.count = h;
    Sh.visible = h > 0;
    Sh.instanceMatrix.needsUpdate = true;
    if (Sh.instanceColor) Sh.instanceColor.needsUpdate = true;
  }
  const ZAXIS = new THREE.Vector3(0, 0, 1),
    tmpA = new THREE.Vector3();

  return {
    ready,
    hud,
    start,
    update,
    attachGuns,
    get hull() {
      return hull;
    },
    get stats() {
      return { kills, hits, shots, breaches, hull, bounces: gate?.bounces ?? 0, phase: phases[phaseIndexAt(clockNow)].id };
    },
    phases,
    bot: botOn,
    hurt, // test hook
    get debug() {
      return { gate: gate && { pos: gate.pos.toArray().map(Math.round), on: gate.on, em: gate.emitters.map((e) => ({ hp: e.hp, alive: e.alive, p: e.pos.toArray().map(Math.round) })) }, lasers: lasers.length, lock: lockTarget && (lockTarget.kind || "inter") };
    },
  };
}
