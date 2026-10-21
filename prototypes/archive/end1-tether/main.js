// Tether Run: boot, input, aiming, game rules, loop.
import * as THREE from 'three';
import { buildWorld, updateWorld, resetWorld, setMachineState, rayColliders, raySphere, COL } from './world.js';
import { Player, RANGE } from './player.js';
import { Combat } from './combat.js';
import { CamRig } from './cam.js';
import { Hud, fmtTime } from './hud.js';
import { Fx } from './fx.js';
import { initAudio, updateAudio, muteAll, sfx } from './audio.js';

const LASER_RANGE = 130, LASER_COOLDOWN = 0.14;
const TEST = new URLSearchParams(location.search).has('test');

// ---------- renderer / scene ----------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05080f);
scene.fog = new THREE.FogExp2(0x05080f, 0.0034);
const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 2000);
scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x0a0c12, 1.1));
const sun = new THREE.DirectionalLight(0xc8dcff, 1.1); sun.position.set(60, 200, 80); scene.add(sun);
const rim = new THREE.DirectionalLight(0x8a6bff, 0.5); rim.position.set(-80, 60, -300); scene.add(rim);
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
});

// ---------- game object (shared by all modules) ----------
const game = {
  scene, camera, renderer, state: 'intro', clock: 0, runTime: 0, trace: 0, traceRising: 0, labelFade: 1,
  progress: 0, checkpoint: null, doorOpen: false, lockedCd: 0, best: null, timeScale: 1,
};
window.game = game;
game.world = buildWorld(scene);
game.fx = new Fx(scene);
game.hud = new Hud(game);
game.camRig = new CamRig(game);
game.player = new Player(game);
game.combat = new Combat(game);
game.shake = a => game.camRig.shake(a);
try { game.best = parseFloat(localStorage.getItem('tether-best')) || null; } catch (e) { /* storage off */ }

const W = game.world, P = game.player, CB = game.combat, H = game.hud, CR = game.camRig;

// ---------- rules ----------
game.ownMachine = m => {
  if (m.state === 'locked') return;
  if (m.state === 'open') {
    setMachineState(m, 'owned'); m.pulse = 1;
  }
  game.checkpoint = m;
  if (m.route != null && m.route > game.progress) game.progress = m.route;
  if (m === W.cluster && game.progress < W.route.length - 1) game.progress = W.route.length - 1;
};
game.denied = (machine, point, normal) => {
  sfx.deny();
  H.toast('NO RIGHTS', 'bad');
  game.fx.burst(point, COL.locked, 16, 10, 0.4, 0, normal, 0.8);
  if (machine && machine.shield) machine.shieldFlash = 1;
};
game.lockedTouch = (machine, point) => {
  if (game.lockedCd > 0) return;
  game.lockedCd = 0.5;
  game.addTrace(8, 'touch');
  game.denied(machine, point, new THREE.Vector3(0, 1, 0));
  game.shake(0.25);
};
game.addTrace = (x) => {
  if (game.state !== 'play' || !P.alive) return;
  game.trace = Math.min(100, game.trace + x);
  game.traceRising = 1.5;
  if (game.trace >= 100) fail();
};
game.onSignalLost = () => {
  sfx.lost(); H.setLost(true); game.shake(0.4);
  game.trace = Math.min(99, game.trace + 10); game.traceRising = 1.5;
};
game.respawn = () => {
  H.setLost(false);
  const cp = game.checkpoint || W.route[0];
  P.reset(cp.spawn, 'ground');
  CR.snap(cp.spawn);
  const nt = game.nextTarget();
  if (nt) CR.setYawTo(cp.spawn, nt.pos);
};
game.onDoorBroken = () => {
  game.doorOpen = true;
  game.shake(0.6);
  sfx.door();
  game.fx.burst(W.door.home, 0xffffff, 40, 20, 0.7);
  hintOnce('tether', 'Aim at a machine and hold left click. The tether reels you in.', 7);
};
game.onFirstAttach = () => hintOnce('sling', 'Let go when the line turns gold: you SLING where you are looking.', 7);
game.onSling = () => { if (P.stats.slings === 1) hintOnce('sail', 'Space in the air opens the sail. Glide, look, tether again.', 7); };
game.nextTarget = () => {
  if (!game.doorOpen) return { pos: CB.doorLock.pos, kind: 'locked' };
  const next = W.route[game.progress + 1];
  if (next) {
    const lock = CB.locks.find(l => l.machine === next && !l.open);
    if (lock) return { pos: lock.pos, kind: 'locked' };
    return { pos: next.spawn, kind: next.state };
  }
  return { pos: W.corePos, kind: 'core' };
};

// contextual hints, each shown once per run
const shownHints = new Set();
function hintOnce(id, text, dur = 6) { if (shownHints.has(id)) return; shownHints.add(id); H.hint(text, dur); }
const near = (m, d) => P.pos.distanceTo(m.center) < d;
const HINTS = [
  { id: 'lock', when: () => near(W.route[4], 95), text: 'Red machine: no rights. Laser its lock (right click) until you have root.' },
  { id: 'av', when: () => near(W.route[5], 85), text: 'Antivirus. Laser it twice, or tether it to rip it off the machine.' },
  { id: 'watch', when: () => P.pos.z < -300 && P.pos.z > -330, text: 'Watchdog light: stay out of the beam, it fills your trace.' },
  { id: 'canyon', when: () => P.pos.z < -400 && P.pos.z > -420, text: 'Rack row: chain tethers without touching down. The chain winds the reel faster.' },
  { id: 'core', when: () => P.pos.z < -760, text: 'The core is locked. Laser its five rings, then tether into it.' },
];

// ---------- aiming ----------
const _o = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Vector3();
function computeAim() {
  const o = _o.copy(camera.position), d = _d.copy(CR.forward);
  const hc = rayColliders(W, o, d, 600);
  let ht = null;
  const targets = CB.targets();
  for (const tg of targets) {
    const t = raySphere(o, d, tg.center, tg.radius, hc ? hc.t : 600);
    if (t != null && (!ht || t < ht.t)) ht = { t, tg };
  }
  // soft lock-on for the laser (and for yanking / the open core)
  let assist = null, best = 1e9;
  for (const tg of targets) {
    _q.subVectors(tg.center, o);
    const dist = _q.length();
    if (dist > LASER_RANGE + 20) continue;
    const ang = Math.acos(Math.min(1, _q.dot(d) / dist));
    const lim = Math.atan(tg.radius / dist) + THREE.MathUtils.degToRad(tg.kind === 'core' ? 4 : 2.5);
    if (ang > lim || ang > best) continue;
    _q.multiplyScalar(1 / dist);
    const occ = rayColliders(W, o, _q, dist - tg.radius);
    if (occ) continue;
    best = ang; assist = tg;
  }
  const aim = { tether: null, laser: null, laserPoint: null };
  // tether
  let sph = ht ? ht.tg : (assist && (assist.kind === 'sentinel' || assist.kind === 'core') ? assist : null);
  // a soft lock that is out of reach must not steal a valid tether on the surface behind it
  if (sph && !ht && P.pos.distanceTo(sph.center) > RANGE && hc) sph = null;
  if (sph) {
    const dist = P.pos.distanceTo(sph.center);
    let action = sph.kind === 'sentinel' ? 'yank' : sph.kind === 'core' ? 'core' : 'deny';
    if (dist > RANGE) action = 'far';
    aim.tether = { action, point: sph.center.clone(), normal: new THREE.Vector3(0, 0, 1), machine: sph.ref.machine || null, ref: sph.ref, dist };
  } else if (hc) {
    const point = o.clone().addScaledVector(d, hc.t);
    const dist = P.pos.distanceTo(point);
    let action = 'attach';
    if (!hc.machine) action = 'deny';
    else if (hc.machine.state === 'locked') action = 'deny';
    if (dist > RANGE) action = 'far';
    aim.tether = { action, point, normal: hc.normal, machine: hc.machine, ref: null, dist };
  }
  // laser
  const lt = ht && ht.tg.kind !== 'core' ? ht.tg : (assist && assist.kind !== 'core' ? assist : null);
  if (lt && P.pos.distanceTo(lt.center) < LASER_RANGE) aim.laser = lt;
  aim.laserPoint = hc ? o.clone().addScaledVector(d, Math.min(hc.t, LASER_RANGE)) : o.clone().addScaledVector(d, LASER_RANGE);
  return aim;
}
let aim = { tether: null, laser: null };

// ---------- input ----------
const input = { keys: {}, lmb: false, rmb: false };
let laserCd = 0;
function locked() { return document.pointerLockElement === canvas || TEST; }
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('overlay').addEventListener('mousedown', e => {
  e.preventDefault(); e.stopPropagation();   // the click that starts the run must not also fire a tether
  if (game.state === 'intro' || game.state === 'paused') begin();
  else if (game.state === 'fail' || game.state === 'finish') restart();
});
canvas.addEventListener('mousedown', () => { if (game.state === 'play' && !locked()) canvas.requestPointerLock(); });
document.addEventListener('pointerlockerror', () => { if (game.state === 'play') pause(); });
document.addEventListener('mousedown', e => {
  if (game.state !== 'play' || !locked()) return;
  if (e.button === 0) {
    input.lmb = true;
    let tt = aim.tether;
    if (!tt) tt = whiffAim();
    else if (tt.action === 'far') tt = { ...tt, action: 'whiff', dist: RANGE, point: P.pos.clone().add(tt.point.clone().sub(P.pos).setLength(RANGE)) };
    P.fire({ tether: tt });
  }
  if (e.button === 2) { input.rmb = true; }
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) { input.lmb = false; P.release(); }
  if (e.button === 2) input.rmb = false;
});
document.addEventListener('mousemove', e => {
  if (game.state === 'play' && locked()) CR.look(e.movementX, e.movementY);
});
addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (game.state === 'play' && !e.repeat) { if (P.mode === 'air') P.toggleSail(); else P.jump(); } }
  if (e.code === 'KeyR' && !e.repeat && game.state !== 'intro') restart();
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
addEventListener('blur', () => { input.keys = {}; input.lmb = input.rmb = false; P.cutTether(); });
document.addEventListener('pointerlockchange', () => {
  if (!locked() && game.state === 'play') pause();
});
function whiffAim() {
  return { action: 'whiff', point: P.pos.clone().addScaledVector(CR.forward, RANGE), normal: CR.forward.clone().negate(), dist: RANGE };
}

// ---------- states ----------
const overlay = document.getElementById('overlay');
function showPanel(id) {
  overlay.classList.toggle('hidden', !id);
  for (const p of overlay.querySelectorAll('.panel')) p.classList.toggle('on', p.id === id);
}
function begin() {
  initAudio();
  if (!TEST) canvas.requestPointerLock();
  showPanel(null);
  if (game.state === 'intro') {
    game.state = 'play';
    H.hint('Right click: laser the door lock. Break out.', 7);
  } else game.state = 'play';
}
function pause() { game.state = 'paused'; showPanel('p-pause'); muteAll(); input.lmb = input.rmb = false; P.cutTether(); }
function fail() {
  game.state = 'fail'; sfx.fail(); muteAll();
  document.getElementById('failstats').textContent = `time ${fmtTime(game.runTime)}`;
  showPanel('p-fail');
  if (document.pointerLockElement) document.exitPointerLock();
}
game.finish = () => {
  game.state = 'finish'; sfx.finish(); muteAll();
  const t = game.runTime;
  let pb = '';
  if (!game.best || t < game.best) { game.best = t; pb = '  ·  new best'; try { localStorage.setItem('tether-best', String(t)); } catch (e) { /* */ } }
  document.getElementById('fintime').textContent = fmtTime(t);
  document.getElementById('finstats').innerHTML =
    `best ${fmtTime(game.best)}${pb}<br>slings ${P.stats.slings}  ·  tethers ${P.stats.tethers}  ·  signal lost ${P.stats.falls}×`;
  flashT = 1;
  setTimeout(() => { if (game.state === 'finish') { showPanel('p-finish'); if (document.pointerLockElement) document.exitPointerLock(); } }, 900);
};
function restart() {
  resetWorld(W); CB.reset();
  game.progress = 0; game.checkpoint = W.route[0]; game.doorOpen = false;
  game.trace = 0; game.traceRising = 0; game.runTime = 0; game.labelFade = 1;
  shownHints.clear(); H.clearHint();
  P.stats = { slings: 0, falls: 0, tethers: 0 };
  P.reset(W.startPos, 'ground');
  CR.yaw = 0; CR.pitch = 0.16; CR.updateAxes(); CR.snap(W.startPos);
  H.setLost(false);
  if (game.state !== 'play') { begin(); game.state = 'play'; }
  H.hint('Right click: laser the door lock. Break out.', 7);
}
game.checkpoint = W.route[0];
P.reset(W.startPos, 'ground');
CR.updateAxes(); CR.snap(W.startPos);

// ---------- loop ----------
let last = performance.now(), flashT = 0, paused4test = false;
if (TEST) {
  game.input = input;
  window.__tick = (n, dt = 1 / 60) => { paused4test = true; for (let i = 0; i < n; i++) tick(dt); };
  window.__aim = () => aim;
}
const flashEl = document.getElementById('flash');
function tick(dtReal) {
  // brief slow-motion on slings and kills, recovers in ~0.15 s
  game.timeScale += (1 - game.timeScale) * Math.min(1, dtReal * 9);
  const dt = dtReal * game.timeScale;
  game.clock += dt;
  if (game.state === 'play') {
    game.runTime += dt;
    aim = computeAim();
    laserCd -= dt;
    if (input.rmb && laserCd <= 0 && P.alive && !P.finishing) {
      laserCd = LASER_COOLDOWN;
      const to = aim.laser ? aim.laser.center.clone() : aim.laserPoint;
      const from = P.pos.clone().addScaledVector(CR.forward, 0.6);
      CB.fireLaser(from, to, aim.laser);
    }
    P.update(dt, input);
    CB.update(dt, game.clock);
    game.lockedCd -= dt;
    game.traceRising -= dt;
    if (game.traceRising <= 0) game.trace = Math.max(0, game.trace - 6 * dt);
    if (game.doorOpen) game.labelFade = Math.max(0, game.labelFade - dt * 0.25);
    for (const h of HINTS) if (!shownHints.has(h.id) && h.when()) hintOnce(h.id, h.text, 6);
  } else if (game.state === 'finish') {
    P.update(dt, input);
  } else {
    P.updateVisuals(0);
  }
  updateWorld(W, dt, game.clock);
  CR.update(dt);
  game.fx.update(dt);
  H.update(dt, aim);
  if (flashT > 0) { flashT = Math.max(0, flashT - dt * 0.9); }
  flashEl.style.opacity = flashT;
  updateAudio(dt, game.state === 'play' ? P.speed : 0, game.state === 'play' && P.reeling, P.attached && P.teth.inWin, game.state === 'play' && CB.alarm);
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (!paused4test) tick(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
