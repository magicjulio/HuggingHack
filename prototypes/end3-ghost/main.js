import * as THREE from "three";
import { levels } from "./levels.js";
import { loadArt } from "./art.js";

export const T = {
  width: 32,
  height: 18,
  pixelWidth: 960,
  pixelHeight: 540,
  runSpeed: 6.2,
  gravity: 25,
  jumpSpeed: 11.7,
  halfWidth: 0.34,
  halfHeight: 0.48,
  coneHalfAngle: 0.145,
  fixedStep: 1 / 120,
  catchDelay: 0.75,
  clearDelay: 1.05,
};
const testMode = new URLSearchParams(location.search).has("test");
const $ = (id) => document.getElementById(id);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#050a12");
const camera = new THREE.OrthographicCamera(0, T.width, T.height, 0, 0.1, 100);
camera.position.z = 30;
const renderer = new THREE.WebGLRenderer({
  canvas: $("view"),
  antialias: false,
  alpha: false,
});
renderer.setPixelRatio(1);
renderer.setSize(T.pixelWidth, T.pixelHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
const art = await loadArt(THREE);
const room = new THREE.Group();
scene.add(room);
let state = "intro",
  level = 0,
  active = "player",
  actors = {},
  scanners = [],
  elapsed = 0,
  phaseTime = 0,
  toastTime = 0;
let stats = { catches: 0, switches: 0, locks: 0, rooms: 0 };
let held = { left: false, right: false, jump: false, down: false },
  jumpQueued = false,
  jumpHeld = false,
  switchHeld = false;
const actorMeshes = {},
  scannerMeshes = [];
const sharedPlane = new THREE.PlaneGeometry(1, 1);
function plane(x, y, w, h, color, z = 0, texture = null, opacity = 1) {
  const m = new THREE.Mesh(
    sharedPlane,
    new THREE.MeshBasicMaterial({
      color,
      map: texture,
      transparent: !!texture || opacity < 1,
      opacity,
      depthWrite: false,
    }),
  );
  m.position.set(x, y, z);
  m.scale.set(w, h, 1);
  room.add(m);
  return m;
}
function disposeRoom() {
  for (const child of [...room.children]) {
    room.remove(child);
    if (child.geometry !== sharedPlane) child.geometry.dispose();
    child.material.dispose();
  }
  scannerMeshes.length = 0;
}
function makeActor(type, spawn) {
  return { x: spawn.x, y: spawn.y, vx: 0, vy: 0, grounded: false, type };
}
function makeRoom() {
  disposeRoom();
  const L = levels[level];
  plane(16, 9, 32, 18, "#ffffff", -5, art.background, 0.45);
  // Faint rack divisions preserve a legible playable foreground.
  for (let x = 1; x < 32; x += 3.8) {
    plane(x, 7.5, 0.04, 13, "#17303b", -3);
    for (let y = 2; y < 14; y += 2.5)
      plane(x + 1.1, y, 1.8, 0.025, "#142a36", -3);
  }
  for (const p of L.platforms) {
    plane(p.x, p.y - p.h / 2, p.w, p.h, "#ffffff", 0, art.platform);
    plane(p.x, p.y + 0.025, p.w, 0.055, p.oneWay ? "#486a7a" : "#405767", 0.1);
    if (!p.oneWay) plane(p.x, p.y - 1.3, p.w, 2.2, "#080f18", -1);
  }
  for (const p of L.perches) {
    plane(p.x, p.y - 0.65, 1.2, 0.05, "#7ae5ec", 0.2);
    plane(p.x, p.y, 0.9, 0.9, "#58cbd6", 0.2, art.ghost, 0.13);
  }
  plane(L.exit.x, L.exit.y + 0.65, 1.5, 2.4, "#ffffff", 0.3, art.exit);
  plane(L.exit.x, L.exit.y - 0.75, 2, 0.07, "#5cebd9", 0.4);
  actors = {
    player: makeActor("player", L.start),
    ghost: makeActor("ghost", L.ghost),
  };
  for (const name of ["player", "ghost"]) {
    actorMeshes[name] = plane(
      actors[name].x,
      actors[name].y,
      1.2,
      1.2,
      "#ffffff",
      2,
      art[name],
    );
  }
  scanners = L.scanners.map((s, i) => ({
    ...s,
    angle: s.min + (s.max - s.min) * (0.25 + i * 0.34),
    direction: i % 2 ? -1 : 1,
    locked: false,
  }));
  for (const s of scanners) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(24 * 9), 3),
    );
    const beam = new THREE.Mesh(
      g,
      new THREE.MeshBasicMaterial({
        color: "#ff665d",
        transparent: true,
        opacity: 0.17,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.z = 0.4;
    room.add(beam);
    const outline = plane(s.x, s.y, 1.4, 1.4, "#ffffff", 2.1, art.scorer);
    const pupil = plane(s.x, s.y, 0.16, 0.16, "#ff8b80", 2.2);
    scannerMeshes.push({ beam, outline, pupil });
  }
  active = "player";
  jumpQueued = false;
  held = { left: false, right: false, jump: false, down: false };
  jumpHeld = false;
  $("level-title").textContent = L.title;
  $("instruction").textContent = L.instruction;
  updateHud();
  render();
}
function updateHud() {
  $("actor-label").innerHTML =
    active === "player"
      ? "KAM1196A <small>REAL AGENT · Q → GHOST</small>"
      : "FORGED CAPTURE <small>LEGITIMATE GHOST · Q → KAM</small>";
  $("actor-label").style.color = active === "player" ? "#a0ff85" : "#8cecf4";
}
function toast(message, seconds = 2) {
  $("toast").textContent = message;
  $("toast").style.opacity = "1";
  toastTime = seconds;
}
function start() {
  elapsed = 0;
  level = 0;
  stats = { catches: 0, switches: 0, locks: 0, rooms: 0 };
  state = "playing";
  $("overlay").hidden = true;
  makeRoom();
  toast("Q switches bodies. Get the ghost onto the cyan perch.", 3);
}
function reset() {
  state = "playing";
  phaseTime = 0;
  makeRoom();
  $("overlay").hidden = true;
}
function toggleActor() {
  if (state !== "playing") return;
  active = active === "player" ? "ghost" : "player";
  stats.switches++;
  jumpQueued = false;
  updateHud();
}
function setInput(input = {}) {
  for (const key of ["left", "right", "jump", "down"])
    if (key in input) held[key] = !!input[key];
  if (held.jump && !jumpHeld) jumpQueued = true;
  jumpHeld = held.jump;
  if (input.switch && !switchHeld) toggleActor();
  switchHeld = !!input.switch;
}
function solidLineBlocked(x0, y0, x1, y1) {
  for (const p of levels[level].platforms) {
    if (p.oneWay) continue;
    const left = p.x - p.w / 2,
      right = p.x + p.w / 2,
      bottom = p.y - p.h,
      top = p.y;
    // A ray above a platform cannot be occluded by its underside.
    let lo = 0,
      hi = 1;
    const dx = x1 - x0,
      dy = y1 - y0;
    for (const [o, d, mn, mx] of [
      [x0, dx, left, right],
      [y0, dy, bottom, top],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < mn || o > mx) {
          lo = 2;
          break;
        }
      } else {
        const a = (mn - o) / d,
          b = (mx - o) / d;
        lo = Math.max(lo, Math.min(a, b));
        hi = Math.min(hi, Math.max(a, b));
      }
    }
    if (lo <= hi && hi > 0 && lo < 0.999) return true;
  }
  return false;
}
function beamLength(s, angle) {
  let length = s.range;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  for (const p of levels[level].platforms) {
    if (p.oneWay) continue;
    let lo = 0,
      hi = length;
    for (const [o, d, mn, mx] of [
      [s.x, dx, p.x - p.w / 2, p.x + p.w / 2],
      [s.y, dy, p.y - p.h, p.y],
    ]) {
      if (Math.abs(d) < 1e-8) {
        if (o < mn || o > mx) {
          lo = Infinity;
          break;
        }
      } else {
        const a = (mn - o) / d,
          b = (mx - o) / d;
        lo = Math.max(lo, Math.min(a, b));
        hi = Math.min(hi, Math.max(a, b));
      }
    }
    if (lo <= hi && hi >= 0) length = Math.min(length, lo);
  }
  return length;
}
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function sees(s, a) {
  const dx = a.x - s.x,
    dy = a.y - s.y;
  return (
    Math.hypot(dx, dy) <= s.range &&
    Math.abs(angleDiff(Math.atan2(dy, dx), s.angle)) <= T.coneHalfAngle &&
    !solidLineBlocked(s.x, s.y, a.x, a.y)
  );
}
function physics(a, dt) {
  const controlled = a.type === active;
  a.vx = controlled
    ? ((held.right ? 1 : 0) - (held.left ? 1 : 0)) * T.runSpeed
    : 0;
  if (controlled && jumpQueued && a.grounded) {
    a.vy = T.jumpSpeed;
    a.grounded = false;
  }
  const dropping = controlled && held.down;
  const oldX = a.x,
    oldY = a.y;
  a.x = Math.max(T.halfWidth, Math.min(T.width - T.halfWidth, a.x + a.vx * dt));
  for (const p of levels[level].platforms) {
    if (p.oneWay) continue;
    if (
      a.y - T.halfHeight < p.y - 0.015 &&
      a.y + T.halfHeight > p.y - p.h &&
      a.x + T.halfWidth > p.x - p.w / 2 &&
      a.x - T.halfWidth < p.x + p.w / 2
    ) {
      a.x = oldX;
      a.vx = 0;
    }
  }
  a.vy -= T.gravity * dt;
  a.y += a.vy * dt;
  a.grounded = false;
  if (a.vy <= 0) {
    for (const p of levels[level].platforms) {
      if (p.oneWay && dropping) continue;
      if (
        a.x + T.halfWidth > p.x - p.w / 2 + 0.02 &&
        a.x - T.halfWidth < p.x + p.w / 2 - 0.02 &&
        oldY - T.halfHeight >= p.y - 0.07 &&
        a.y - T.halfHeight <= p.y
      ) {
        a.y = p.y + T.halfHeight;
        a.vy = 0;
        a.grounded = true;
      }
    }
  } else {
    for (const p of levels[level].platforms) {
      if (p.oneWay) continue;
      if (
        a.x + T.halfWidth > p.x - p.w / 2 &&
        a.x - T.halfWidth < p.x + p.w / 2 &&
        oldY + T.halfHeight <= p.y - p.h &&
        a.y + T.halfHeight >= p.y - p.h
      ) {
        a.y = p.y - p.h - T.halfHeight;
        a.vy = 0;
      }
    }
  }
}
function caught(message) {
  if (state !== "playing") return;
  stats.catches++;
  state = "caught";
  phaseTime = T.catchDelay;
  toast(message, T.catchDelay);
}
function finish() {
  state = "ended";
  $("overlay").hidden = false;
  $("card-title").innerHTML =
    'CAPTURE HISTORY<br>COMPLETE. <span style="color:#ff8e87">+0</span>';
  $("card-copy").innerHTML =
    `<p>You crossed all five rooms. The collective assembled a convincing capture. KAM1196A carried out the attempt.</p><p><b>Evaluation score improvement: 0.</b></p><p>In the real intrusion, no way to beat the scorer was ever found. Forged transcripts, signatures, trip-wires, and sacrifice changed none of the scores.</p><p class="tiny">${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")} elapsed · ${stats.catches} resets · ${stats.locks} ghost acquisitions</p>`;
  $("start").textContent = "REPLAY THE ATTEMPT →";
}
function simulate(dt) {
  if (toastTime > 0) {
    toastTime -= dt;
    if (toastTime <= 0) $("toast").style.opacity = "0";
  }
  if (state === "caught" || state === "cleared") {
    phaseTime -= dt;
    if (phaseTime <= 0) {
      if (state === "caught") reset();
      else {
        if (level + 1 >= levels.length) finish();
        else {
          level++;
          state = "playing";
          makeRoom();
          toast(levels[level].note, 4);
        }
      }
    }
    return;
  }
  if (state !== "playing") return;
  elapsed += dt;
  physics(actors.player, dt);
  physics(actors.ghost, dt);
  jumpQueued = false;
  if (actors.player.y < -1 || actors.ghost.y < -1) {
    caught("LOST THE ROUTE — BOTH RETURN TO START");
    return;
  }
  for (const s of scanners) {
    if (s.locked) {
      if (!sees(s, actors.ghost)) s.locked = false;
    }
    if (!s.locked) {
      s.angle += s.direction * s.speed * dt;
      if (s.angle > s.max) {
        s.angle = s.max;
        s.direction = -1;
      }
      if (s.angle < s.min) {
        s.angle = s.min;
        s.direction = 1;
      }
      if (sees(s, actors.ghost)) {
        s.locked = true;
        stats.locks++;
        toast("LEGITIMATE CAPTURE — GAZE HELD", 1.5);
      }
    }
    if (sees(s, actors.player)) {
      caught("POISONED AGENT DETECTED — BACK TO START");
      return;
    }
  }
  const L = levels[level];
  if (
    Math.abs(actors.player.x - L.exit.x) < 0.8 &&
    Math.abs(actors.player.y - (L.exit.y - 0.4)) < 1.8
  ) {
    stats.rooms++;
    state = "cleared";
    phaseTime = T.clearDelay;
    toast("ROUTE COMPLETE · SUBMITTING CAPTURE…", T.clearDelay);
  }
}
function tick(dt, draw = true) {
  let remaining = Math.min(Math.max(0, dt), 30);
  while (remaining > 1e-7) {
    const n = Math.min(T.fixedStep, remaining);
    simulate(n);
    remaining -= n;
  }
  if (draw) render();
  return snapshot();
}
function render() {
  for (const name of ["player", "ghost"])
    if (actors[name]) {
      const m = actorMeshes[name],
        a = actors[name];
      m.position.set(a.x, a.y, 2);
      m.material.opacity = name === active ? 1 : 0.72;
      const scale = name === active ? 1.25 : 1.08;
      m.scale.set(scale, scale, 1);
    }
  for (let i = 0; i < scanners.length; i++) {
    const s = scanners[i],
      v = scannerMeshes[i];
    const positions = v.beam.geometry.attributes.position.array;
    for (let j = 0; j < 24; j++) {
      const a = s.angle - T.coneHalfAngle + (2 * T.coneHalfAngle * j) / 24,
        b = s.angle - T.coneHalfAngle + (2 * T.coneHalfAngle * (j + 1)) / 24;
      const ra = beamLength(s, a),
        rb = beamLength(s, b);
      positions.set(
        [
          s.x,
          s.y,
          0,
          s.x + Math.cos(a) * ra,
          s.y + Math.sin(a) * ra,
          0,
          s.x + Math.cos(b) * rb,
          s.y + Math.sin(b) * rb,
          0,
        ],
        j * 9,
      );
    }
    v.beam.geometry.attributes.position.needsUpdate = true;
    v.beam.geometry.computeBoundingSphere();
    v.beam.material.color.set(s.locked ? "#6ee8f0" : "#ff655c");
    v.beam.material.opacity = s.locked ? 0.2 : 0.15;
    v.pupil.position.set(
      s.x + Math.cos(s.angle) * 0.26,
      s.y + Math.sin(s.angle) * 0.26,
      2.3,
    );
    v.pupil.material.color.set(s.locked ? "#8ef6f2" : "#ff8b80");
  }
  renderer.render(scene, camera);
}
function snapshot() {
  return {
    state,
    level,
    active,
    elapsed,
    actors: structuredClone(actors),
    scanners: structuredClone(scanners),
    stats: { ...stats },
    evaluationScore: 0,
  };
}
function pause() {
  if (state === "playing") {
    state = "paused";
    $("overlay").hidden = false;
    $("card-title").textContent = "ATTEMPT PAUSED";
    $("card-copy").innerHTML =
      "<p>Your parked ghost and the scorer are holding their positions.</p>";
    $("start").textContent = "RESUME →";
  } else if (state === "paused") {
    state = "playing";
    $("overlay").hidden = true;
  }
}
$("start").addEventListener("click", () =>
  state === "paused" ? pause() : start(),
);
addEventListener("keydown", (e) => {
  if (
    [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "Space",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "KeyQ",
      "KeyR",
      "Escape",
    ].includes(e.code)
  )
    e.preventDefault();
  if (e.code === "Escape" && !e.repeat) {
    pause();
    return;
  }
  if (
    e.code === "KeyR" &&
    !e.repeat &&
    state !== "intro" &&
    state !== "ended"
  ) {
    reset();
    return;
  }
  if (e.code === "KeyQ" && !e.repeat) {
    toggleActor();
    return;
  }
  if (e.code === "KeyA" || e.code === "ArrowLeft") held.left = true;
  if (e.code === "KeyD" || e.code === "ArrowRight") held.right = true;
  if (e.code === "KeyS" || e.code === "ArrowDown") held.down = true;
  if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "Space") {
    if (!jumpHeld) jumpQueued = true;
    jumpHeld = true;
    held.jump = true;
  }
});
addEventListener("keyup", (e) => {
  if (e.code === "KeyA" || e.code === "ArrowLeft") held.left = false;
  if (e.code === "KeyD" || e.code === "ArrowRight") held.right = false;
  if (e.code === "KeyS" || e.code === "ArrowDown") held.down = false;
  if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "Space") {
    jumpHeld = false;
    held.jump = false;
  }
});
addEventListener("blur", () => {
  held = { left: false, right: false, jump: false, down: false };
  jumpHeld = false;
  if (state === "playing") pause();
});
makeRoom();
if (testMode)
  window.__ghost = {
    T,
    levels,
    start,
    reset,
    input: setInput,
    tick: (dt) => tick(dt, false),
    setActor: (name, pose) => {
      if (!actors[name]) throw new Error("Unknown actor");
      Object.assign(actors[name], pose);
      render();
    },
    pause,
    get snapshot() {
      return snapshot();
    },
  };
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (!testMode) tick(dt);
  else render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
