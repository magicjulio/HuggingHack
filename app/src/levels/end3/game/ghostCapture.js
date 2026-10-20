// Ending 3 "Ghost Capture": loop, physics, scanner sight/occlusion, renderer, room transitions.
// From prototypes/end3-ghost/main.js (approved: handoff/design-to-app/2026-10-18-end3-ghost-approved.md).
// App changes, nothing else: the page became a factory that builds its own DOM in `root` and cleans up
// in dispose() (listeners, rAF, GPU, audio); three sound cues (switch, caught, room accepted) reuse Chapter 2's
// synth (ch2/ui/sfx.js, no files); the overlay (intro, pause, final card) is the app's shared level card
// (opts.onScreen, see showCard; a loading card shows while the art loads); finishing calls opts.onFinish; art loads before the first room; `?test` + `window.__ghost` → opts.debug + `window.__end3`.
import * as THREE from "three";
import { levels } from "./levels.js";
import { loadArt } from "./art.js";
import { MARKUP } from "./markup.js";
import { createSfx } from "../../ch2/ui/sfx.js"; // app: sound
import { sfxVolume } from "../../../state/settings"; // app: settings

// app: motion runs PACE × faster than the prototype (Julius: jumping many platforms took too long). Run × k,
// jump × k, gravity × k² keep every arc the rooms were built on (rise 2.74, span 5.8), only quicker.
const PACE = 1.15;
export const T = {
  width: 32,
  height: 18,
  pixelWidth: 960,
  pixelHeight: 540,
  runSpeed: 6.2 * PACE,
  gravity: 25 * PACE * PACE,
  jumpSpeed: 11.7 * PACE,
  halfWidth: 0.34,
  halfHeight: 0.48,
  coneHalfAngle: 0.145,
  fixedStep: 1 / 120,
  catchDelay: 0.75,
  clearDelay: 1.05,
};
const startingLevel = 0;
// height / width of deep-archive-platform-surface.png (2172 × 430)
const ARCHIVE_SLAB_ASPECT = 430 / 2172;

/**
 * @param {HTMLElement} root  empty element the game fills (full viewport)
 * @param {{ onFinish?: (r: object) => void, onScreen?: (card: object | null) => void, debug?: boolean }} opts
 * @returns {{ dispose(): void }}
 */
export function createGhostCapture(root, opts = {}) {
root.innerHTML = MARKUP;
const $ = (id) => root.querySelector("#" + id);
// every global listener goes through on(), so dispose() can remove it
const offs = [];
function on(target, type, fn, o) {
  target.addEventListener(type, fn, o);
  offs.push(() => target.removeEventListener(type, fn, o));
}
// app: sound — the browser starts audio suspended, so the first key unlocks it
const sfx = createSfx();
function sound(name) {
  sfx.volume(0.8 * sfxVolume());
  sfx.play(name);
}
// test hooks drive time themselves (the prototype's ?test mode)
let manual = false,
  finishes = 0,
  raf = 0,
  disposed = false,
  art = null;
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
const room = new THREE.Group();
scene.add(room);
let state = "intro",
  level = startingLevel,
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
  const archive = L.visualTheme === "archive";
  plane(
    16,
    9,
    32,
    18,
    "#ffffff",
    -5,
    archive ? art.archiveBackground : art.background,
    archive ? 0.58 : 0.45,
  );
  // Faint rack divisions preserve a legible playable foreground.
  if (!archive) {
    for (let x = 1; x < 32; x += 3.8) {
      plane(x, 7.5, 0.04, 13, "#17303b", -3);
      for (let y = 2; y < 14; y += 2.5)
        plane(x + 1.1, y, 1.8, 0.025, "#142a36", -3);
    }
  }
  for (const p of L.platforms) {
    // app: a tall archive block stacks the slab art near its own aspect instead of stretching one slab
    // over the whole height (room 4's divider read as a smeared pillar)
    const slab = archive ? p.w * ARCHIVE_SLAB_ASPECT : p.h;
    const rows = Math.max(1, Math.round(p.h / slab));
    for (let i = 0; i < rows; i++)
      plane(
        p.x,
        p.y - (p.h / rows) * (i + 0.5),
        p.w,
        p.h / rows,
        "#ffffff",
        0,
        archive ? art.archivePlatform : art.platform,
      );
    plane(
      p.x,
      p.y + 0.025,
      p.w,
      0.055,
      archive ? (p.oneWay ? "#53d7df" : "#7d9cad") : p.oneWay ? "#486a7a" : "#405767",
      0.1,
    );
    if (!p.oneWay) plane(p.x, p.y - 1.3, p.w, 2.2, "#080f18", -1);
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
    homeX: s.x,
    homeY: s.y,
    patrolTime: 0,
  }));
  for (const s of scanners) {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(24 * 9 * (s.opposed ? 2 : 1)),
        3,
      ),
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
    const backPupil = s.opposed
      ? plane(s.x, s.y, 0.19, 0.19, "#ff8b80", 2.2)
      : null;
    const frame = s.opposed
      ? plane(s.x, s.y, 1.9, 0.22, "#b78cdb", 2)
      : s.halfAngle
        ? plane(s.x, s.y, 1.8, 0.8, "#ad624e", 2)
        : null;
    if (s.patrol) {
      plane(s.x, s.y, s.patrol.x * 2 + 1.4, 0.07, "#7396bd", 1);
      for (const side of [-1, 1])
        plane(s.x + side * s.patrol.x, s.y, 0.08, 0.55, "#7396bd", 1);
    }
    scannerMeshes.push({ beam, outline, pupil, backPupil, frame });
  }
  active = "player";
  jumpQueued = false;
  held = { left: false, right: false, jump: false, down: false };
  jumpHeld = false;
  $("level-title").textContent = L.title;

  updateHud();
  render();
}
function updateHud() {
  $("actor-label").innerHTML =
    active === "player"
      ? "KAM1196A"
      : "FORGED CAPTURE";
  $("actor-label").style.color = active === "player" ? "#a0ff85" : "#8cecf4";
}
function toast(message, seconds = 2) {
  $("toast").textContent = message;
  $("toast").style.opacity = "1";
  toastTime = seconds;
}
function start() {
  elapsed = 0;
  level = startingLevel;
  stats = { catches: 0, switches: 0, locks: 0, rooms: 0 };
  state = "playing";
  showCard(null);
  makeRoom();
}
function reset() {
  state = "playing";
  phaseTime = 0;
  makeRoom();
  showCard(null);
}
function toggleActor() {
  if (state !== "playing") return;
  active = active === "player" ? "ghost" : "player";
  stats.switches++;
  jumpQueued = false;
  sound("open");
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
  const direction = Math.atan2(dy, dx);
  const half = s.halfAngle ?? T.coneHalfAngle;
  return (
    Math.hypot(dx, dy) <= s.range &&
    (Math.abs(angleDiff(direction, s.angle)) <= half ||
      (s.opposed &&
        Math.abs(angleDiff(direction, s.angle + Math.PI)) <= half)) &&
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
  sound("reset");
}
function finish() {
  state = "ended";
  finishes++;
  opts.onFinish?.({ elapsed, ...stats, evaluationScore: 0 });
  showCard({
    kind: "finish",
    title: "Capture history complete",
    main: { k: "Evaluation score", v: "+0" },
    stats: [{ k: "Time", v: `${Math.floor(elapsed / 60)}:${String(Math.floor(elapsed % 60)).padStart(2, "0")}` }, { k: "Retries", v: stats.catches }],
    action: { label: "Replay the attempt", onClick: begin },
  });
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
    caught("FELL — RETRY");
    return;
  }
  for (const s of scanners) {
    if (s.locked) {
      if (!sees(s, actors.ghost)) s.locked = false;
    }
    if (!s.locked) {
      if (s.patrol) {
        s.patrolTime += dt;
        s.x = s.homeX + Math.sin(s.patrolTime * s.patrol.speed) * s.patrol.x;
        s.y =
          s.homeY + Math.sin(s.patrolTime * s.patrol.speed) * (s.patrol.y ?? 0);
      }
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
      }
    }
    if (sees(s, actors.player)) {
      caught("DETECTED — RETRY");
      return;
    }
  }
  const L = levels[level];
  if (
    Math.abs(actors.player.x - L.exit.x) < 0.8 &&
    Math.abs(actors.player.y - (L.exit.y - 0.4)) < (L.exitTolerance ?? 1.8)
  ) {
    stats.rooms++;
    state = "cleared";
    phaseTime = T.clearDelay;
    toast("CAPTURE ACCEPTED", T.clearDelay);
    sound("proof_done");
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
    const half = s.halfAngle ?? T.coneHalfAngle;
    for (let lobe = 0; lobe < (s.opposed ? 2 : 1); lobe++) {
      for (let j = 0; j < 24; j++) {
        const angle = s.angle + lobe * Math.PI;
        const a = angle - half + (2 * half * j) / 24,
          b = angle - half + (2 * half * (j + 1)) / 24;
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
          (lobe * 24 + j) * 9,
        );
      }
    }
    v.outline.position.set(s.x, s.y, 2.1);
    if (v.frame) v.frame.position.set(s.x, s.y, 2);
    if (v.backPupil) {
      v.backPupil.position.set(
        s.x - Math.cos(s.angle) * 0.4,
        s.y - Math.sin(s.angle) * 0.4,
        2.3,
      );
      v.backPupil.material.color.set(s.locked ? "#8ef6f2" : "#ff8b80");
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
    showCard({ kind: "pause", title: "Paused", action: { label: "Resume", onClick: pause }, onBackdrop: pause, hint: "Esc or click anywhere to resume" });
  } else if (state === "paused") {
    state = "playing";
    showCard(null);
  }
}
// app: the overlay as the shared level card (ui/LevelCard.tsx), drawn by End3.tsx
function showCard(card) {
  opts.onScreen?.(card);
}
function begin() {
  sfx.unlock();
  if (art) start();
}
const INTRO = {
  kind: "intro",
  keys: [["A D / ← →", "move"], ["W / SPACE", "jump"], ["S", "drop through ledges"], ["Q", "switch"], ["R", "reset the room"]],
  action: { label: "Begin attempt", onClick: begin },
};
showCard({ kind: "loading" });
on(window, "keydown", (e) => {
  sfx.unlock();
  if (!art) return;
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
on(window, "keyup", (e) => {
  if (e.code === "KeyA" || e.code === "ArrowLeft") held.left = false;
  if (e.code === "KeyD" || e.code === "ArrowRight") held.right = false;
  if (e.code === "KeyS" || e.code === "ArrowDown") held.down = false;
  if (e.code === "KeyW" || e.code === "ArrowUp" || e.code === "Space") {
    jumpHeld = false;
    held.jump = false;
  }
});
on(window, "blur", () => {
  held = { left: false, right: false, jump: false, down: false };
  jumpHeld = false;
  if (state === "playing") pause();
});
let previous = performance.now();
function frame(now) {
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (!manual) tick(dt);
  else render();
  raf = requestAnimationFrame(frame);
}
// test hooks (dev builds / ?debug: window.__end3, used by the e2e test)
const hooks = {
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
  // jump to a room (0-based) in play, for probes
  room(n) {
    start();
    level = n;
    makeRoom();
  },
  // stop the real-time loop: time then moves only through tick()
  get manual() {
    return manual;
  },
  set manual(v) {
    manual = !!v;
  },
  // live scanner state (angle, locked…) and the sight test the rules use
  scanner: (i) => scanners[i],
  sees: (i, name) => sees(scanners[i], actors[name]),
  get finishes() {
    return finishes;
  },
  get snapshot() {
    return snapshot();
  },
};
loadArt(THREE).then((a) => {
  if (disposed) return disposeArt(a);
  art = a;
  makeRoom();
  showCard(INTRO);
  if (opts.debug) window.__end3 = hooks;
  previous = performance.now();
  raf = requestAnimationFrame(frame);
});

function disposeArt(a) {
  for (const t of new Set(Object.values(a))) t.dispose();
}
function dispose() {
  disposed = true;
  cancelAnimationFrame(raf);
  for (const off of offs) off();
  disposeRoom();
  sharedPlane.dispose();
  if (art) disposeArt(art);
  renderer.dispose();
  renderer.forceContextLoss();
  sfx.context?.close().catch(() => {});
  if (window.__end3 === hooks) delete window.__end3;
  root.innerHTML = "";
}
return { dispose };
}
