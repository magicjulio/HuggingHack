// Ending 1 "Cluster Run": bootstrap, input, camera, game states, HUD.
// From prototypes/end1-swing/main.js (Julius's pick, handoff/story-to-build/2026-10-16-end1-swing-promoted.md).
// App changes, nothing else: the page became a factory that builds its own DOM in `root` and cleans up
// in dispose() (listeners, rAF, GPU, audio); the overlays are the app's shared level card (opts.onScreen,
// see showOv), the HTML ones are gone; the best time comes from
// and goes to the app save (opts.best / opts.onFinish) instead of localStorage; `window.__game` → opts.debug.
import { lookScale } from '../../../state/settings'; // app: settings
import * as THREE from 'three';
import { buildWorld, PORT_COLORS, CLUSTER_FRONT, ROWS, ROW_GAP } from './world.js';
import { buildEnemies } from './enemies.js';
import { Player, pickPort, T } from './player.js';
import { GlowPoints, Particles, Ribbon, Beams, Outlines, SpeedLines } from './fx.js';
import { labelTexture } from './textures.js';
import { initAudio, sfx, setAudioPaused } from './audio.js';
import { MARKUP } from './markup.js';

/**
 * @param {HTMLElement} root  empty element the game fills (full viewport)
 * @param {{ best?: number | null, onFinish?: (r: object) => void, onScreen?: (card: object | null) => void, debug?: boolean }} opts
 * @returns {{ dispose(): void }}
 */
export function createClusterRun(root, opts = {}) {
root.innerHTML = MARKUP;
const $ = (id) => root.querySelector('#' + id);
// every global listener goes through on(), so dispose() can remove it
const offs = [];
function on(target, type, fn, o) { target.addEventListener(type, fn, o); offs.push(() => target.removeEventListener(type, fn, o)); }
const timers = new Set();
function later(fn, ms) { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); }


// ---------- renderer / scene ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene();
const FOG = 0x070b14;
scene.background = new THREE.Color(FOG);
scene.fog = new THREE.FogExp2(FOG, 0.0026);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.3, 5000);
scene.add(new THREE.HemisphereLight(0x7d98bd, 0x05070b, 1.4));
const sun = new THREE.DirectionalLight(0xbfd6ff, 0.9); sun.position.set(0.4, 1, 0.6); scene.add(sun);

const world = buildWorld(scene);
const enemies = buildEnemies(scene, world);
const particles = new Particles(scene);
const beams = new Beams(scene);
const outlines = new Outlines(scene);
const speedLines = new SpeedLines($('lines'));
const fx = { particles };

// ---------- the orb ----------
const GREEN = new THREE.Color(0x5dff9a), WHITE = new THREE.Color(0xffffff), AMBER = new THREE.Color(0xffa31a), RED = new THREE.Color(0xff2f4a);
const orb = new THREE.Mesh(new THREE.SphereGeometry(T.RADIUS, 20, 14), new THREE.MeshBasicMaterial({ color: 0xc8ffe0 }));
scene.add(orb);
const glow = new GlowPoints(4, 2); glow.mat.depthTest = false; scene.add(glow.points);
const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture('KAM1196A', { w: 512, h: 96, font: 'bold 54px monospace', color: '#8dffbd' }), transparent: true, depthWrite: false }));
tag.scale.set(2.6, 0.49, 1); scene.add(tag);
const cableR = new Ribbon(scene, 24);
const trailR = new Ribbon(scene, 34);
const trail = [];

const player = new Player(world, onEvent);

// ---------- input ----------
const keys = { w: false, a: false, s: false, d: false };
let yaw = 0, pitch = -0.1, roll = 0, mouseIdle = 0;
let rmb = false, fKey = false, lmb = false, jumpQueued = false;
const SENS = 0.0022;
let locked = false;

on(window, 'mousemove', (e) => {
  if (!locked) return;
  const k = SENS * lookScale(); // app: settings
  yaw -= e.movementX * k;
  pitch = THREE.MathUtils.clamp(pitch - e.movementY * k, -1.35, 1.25);
  if (Math.abs(e.movementX) + Math.abs(e.movementY) > 1) { mouseIdle = 0; introSpin = false; }
});
on(window, 'mousedown', (e) => {
  if (!locked) return;
  if (e.button === 0) lmb = true;
  if (e.button === 2) rmb = true;
});
on(window, 'mouseup', (e) => { if (e.button === 0) lmb = false; if (e.button === 2) rmb = false; });
on(window, 'contextmenu', (e) => e.preventDefault());
const KEYMAP = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', ArrowUp: 'w', ArrowLeft: 'a', ArrowDown: 's', ArrowRight: 'd' };
on(window, 'keydown', (e) => {
  if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = true;
  if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) jumpQueued = true; }
  if (e.code === 'KeyF') fKey = true;
  if (e.code === 'KeyR' && !e.repeat) {
    if (state === 'fail' || state === 'finish' || paused) beginRun(true);
    else if (state !== 'menu') restart();
  }
});
on(window, 'keyup', (e) => {
  if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
  if (e.code === 'KeyF') fKey = false;
});
on(document, 'pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked) { rmb = lmb = false; for (const k in keys) keys[k] = false; }
  if (!locked && (state === 'run' || state === 'countdown' || state === 'lost')) { paused = true; showOv('pause'); }
  if (locked && paused) { paused = false; showOv(null); last = performance.now(); }
  setAudioPaused(paused);
});
function lock() { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); }
// app: the overlay buttons (clicks, so the pointer lock is allowed)
function go() { initAudio(); setAudioPaused(false); beginRun(true); }
function resume() { initAudio(); setAudioPaused(false); lock(); }

// ---------- game state ----------
let state = 'menu', paused = false;
let runTime = 0, countT = 0, lostT = 0, finishT = 0;
let detection = 0, lastHitT = -99, scanCD = 0, laserCD = 0;
let shake = 0, fovKick = 0, hitstop = 0, flashA = 0, flashCol = '#fff';
const stats = { chains: 0, bestChain: 0, kills: 0, unlocks: 0, falls: 0, traced: 0 };
const hintsSeen = {};
let latches = 0, introSpin = false;
const START_Z = world.startPos.z;
const TOTAL = START_Z - world.core.pos.z;
let best = opts.best ?? null;

// app: the four overlays as the shared level card (ui/LevelCard.tsx), drawn by End1.tsx
let lastRun = { time: 0, isBest: false };
function card(name) {
  if (name === 'start') return {
    kind: 'intro',
    line: "Race from computer to computer to the research cluster at the far end of the hall. Don't touch the floor.",
    keys: [['RMB', 'connect a line to a port, swing'], ['LMB', 'hacking laser'], ['SPACE', 'zip in and launch · jump'], ['W / S', 'reel in · let out'], ['A / D', 'steer']],
    action: { label: 'Start', onClick: go },
  };
  if (name === 'pause') return {
    kind: 'pause', title: 'Paused',
    action: { label: 'Resume', onClick: resume }, onBackdrop: resume, hint: 'Click anywhere to resume · R restarts the run',
  };
  if (name === 'fail') return {
    kind: 'fail', title: 'Connection terminated', line: 'Detection reached 100%. The safety systems found you.',
    action: { label: 'Run again', onClick: go }, hint: 'R restarts',
  };
  return {
    kind: 'finish', title: 'You reached the cluster',
    main: { k: 'Run time', v: fmt(lastRun.time), tag: lastRun.isBest ? 'BEST' : undefined },
    stats: [{ k: 'Longest chain', v: '×' + stats.bestChain }, { k: 'Taken down', v: stats.kills }, { k: 'Traced', v: stats.traced }],
    action: { label: 'Run again', onClick: go }, hint: 'R restarts',
  };
}
function showOv(name) {
  $('hud').classList.toggle('off', name === 'start');
  opts.onScreen?.(name ? card(name) : null);
}

function restart() {
  enemies.reset();
  world.resetPorts(); world.resetCore();
  player.reset(world.startPos);
  yaw = Math.PI * 0.92; pitch = -0.12; roll = 0; introSpin = true;
  detection = 0; lastHitT = -99; runTime = 0; scanCD = 0;
  state = 'countdown'; countT = 3.2; lastCount = 4;
  Object.assign(stats, { chains: 0, bestChain: 0, kills: 0, unlocks: 0, falls: 0, traced: 0 });
  latches = 0;
  trail.length = 0;
  smooth.copy(player.pos);
  $('toasts').innerHTML = '';
}
function beginRun(doLock) {
  showOv(null);
  restart();
  if (doLock) lock();
}

// ---------- feedback helpers ----------
function toast(text, color = '#5dff9a') {
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = text; el.style.color = color;
  const box = $('toasts');
  box.appendChild(el);
  while (box.children.length > 2) box.firstChild.remove();
  later(() => el.remove(), 950);
}
let hintTimer = 0;
function hint(key, html, dur = 6) {
  if (hintsSeen[key]) return;
  hintsSeen[key] = true;
  $('hint').innerHTML = html; $('hint').classList.add('show');
  hintTimer = dur;
}
function flash(col, a) { flashCol = col; flashA = Math.max(flashA, a); }
function addDetection(n) {
  detection = Math.min(100, detection + n); lastHitT = runTime;
  if (detection >= 100 && state === 'run') fail();
}

function onEvent(type, data) {
  switch (type) {
    case 'fire': sfx.fire(); break;
    case 'whiff': sfx.whiff(); break;
    case 'deny':
      sfx.deny(); toast('NO RIGHTS', '#ff2f4a');
      particles.burst(data.pos, RED, 16, 14, 1, 0.4);
      hint('locked', '<b style="color:#ff2f4a">Red port: no rights.</b> Shoot the lock with <kbd>left click</kbd>. Three hits: user, admin, root.');
      break;
    case 'latch': {
      latches++;
      const p = data.port, m = p.m;
      sfx.latch(data.flow);
      particles.burst(p.pos, data.watched ? AMBER : GREEN, 10, 10, 0.9, 0.35);
      if (m.type !== 'cluster') {
        const cy = m.type === 'monitor' ? m.y0 + m.ph / 2 : m.h / 2;
        const sz = m.type === 'monitor' ? new THREE.Vector3(m.w, m.ph, 3) : new THREE.Vector3(m.w, m.h, m.d);
        outlines.flash(new THREE.Vector3(m.x, cy, m.z), sz, m.yaw, data.watched ? 0xffa31a : 0x5dff9a);
      }
      if (data.chain) {
        stats.chains++; stats.bestChain = Math.max(stats.bestChain, data.flow);
        toast('CHAIN ×' + data.flow, '#5dff9a'); sfx.chain(data.flow);
        fovKick = Math.min(14, fovKick + 5); hitstop = 0.035; shake = Math.max(shake, 0.12);
      }
      if (data.watched) hint('watched', '<b style="color:#ffa31a">Amber: watched.</b> A trace runs down your line. Let go before it reaches you, or shoot the eye on the roof (<kbd>left click</kbd>).', 7);
      if (latches === 1) later(() => hint('chain', 'Let go as you swing forward, then connect again fast. Each quick link is a <kbd>CHAIN</kbd>: more speed.'), 900);
      if (latches === 5) hint('zip', 'Too low? <kbd>Space</kbd> while connected: zip into the port and launch up. <kbd>W</kbd> reels in for a faster swing.', 7);
      break;
    }
    case 'release': sfx.release(); break;
    case 'zip': sfx.zip(); break;
    case 'launch': sfx.launch(); shake = Math.max(shake, 0.15); fovKick = Math.min(14, fovKick + 4); particles.burst(player.pos, GREEN, 18, 16, 1, 0.4); break;
    case 'traced':
      stats.traced++;
      sfx.zap(); toast('TRACED', '#ff2f4a'); flash('#ff2f4a', 0.45); shake = 0.6;
      particles.burst(player.pos, AMBER, 30, 20, 1.2, 0.5);
      addDetection(34);
      break;
    case 'traceCut': toast('TRACE CUT', '#5dff9a'); break;
    case 'bump': sfx.thud(); shake = Math.max(shake, Math.min(0.5, data / 60)); break;
    case 'floor':
      if (state !== 'run') break;
      state = 'lost'; lostT = 0.9; stats.falls++;
      sfx.linkLost(); toast('LINK LOST', '#ff2f4a'); flash('#000', 0.9);
      particles.burst(player.pos, GREEN, 30, 18, 1, 0.6);
      break;
    case 'core': finish(); break;
  }
}

function fail() {
  state = 'fail';
  player.release(false);
  sfx.zap(); flash('#ff2f4a', 0.8);
  later(() => { if (state === 'fail') { document.exitPointerLock(); showOv('fail'); } }, 700);
}
function finish() {
  state = 'finish'; finishT = 0;
  sfx.finish(); flash('#ffffff', 1); world.takeCore();
  particles.burst(world.core.pos, GREEN, 120, 60, 2.2, 1.4);
  const isBest = best === null || runTime < best;
  if (isBest) best = runTime;
  lastRun = { time: runTime, isBest };
  opts.onFinish?.({ time: runTime, best, isBest, ...stats });
  later(() => { if (state === 'finish') { document.exitPointerLock(); showOv('finish'); } }, 1400);
}
function fmt(t) {
  if (t === null || t === undefined) return '-';
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
}

// ---------- per-frame ----------
const fwd = new THREE.Vector3(), right = new THREE.Vector3(), fwdH = new THREE.Vector3(), rightH = new THREE.Vector3();
const smooth = new THREE.Vector3().copy(world.startPos);
const camTarget = new THREE.Vector3(), prevVel = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let target = null, laserTarget = null;
let last = performance.now(), acc = 0, lastCount = 4, elapsed = 0;
const STEP = 1 / 120;
const input = { keys, tether: false, jumpPressed: false, target: null, aim: fwd, fwdH, rightH, right, anyMove: false };

function zoneName(z) {
  if (z < CLUSTER_FRONT + 120) return 'the research cluster';
  const r = Math.floor((-70 - z) / ROW_GAP + 0.5);
  if (r < 6) return 'open machines';
  if (r < 14) return 'watched machines';
  if (r < 22) return 'no rights';
  if (r < 30) return 'antivirus';
  return 'server racks';
}

let raf = 0;
function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) update(dt);
  renderer.render(scene, camera);
}

function update(dt) {
  const realDt = dt;
  if (hitstop > 0) { hitstop -= dt; dt *= 0.15; }
  elapsed += realDt;
  mouseIdle += realDt;

  // camera basis from yaw/pitch
  fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  fwdH.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  rightH.copy(right);

  const live = state === 'run';
  // aim: what port is under the crosshair?
  target = state === 'menu' ? null : pickPort(world, camera.position, fwd, player.pos, player.attachedPort());
  world.setTarget(target ? target.port : null, target && target.inRange);
  laserTarget = live ? enemies.pickTarget(camera.position, fwd, player.pos) : null;

  if (state === 'countdown') {
    countT -= dt;
    // intro: look back at the sandbox door you came out of, then turn to face the hall
    if (introSpin) {
      const k = 1 - THREE.MathUtils.smoothstep(countT, 1.2, 2.9);
      yaw = Math.PI * 0.92 * (1 - k);
    }
    const c = Math.ceil(countT - 0.2);
    if (c !== lastCount && c >= 0) {
      lastCount = c;
      if (c > 0) { $('count').textContent = c; sfx.beep(false); }
      else { $('count').textContent = 'GO'; sfx.beep(true); state = 'run';
        hint('swing', 'Aim at a <b style="color:#46ff8c">green port</b> and <kbd>hold right mouse</kbd> to connect and swing. Let go to fly.', 7); }
    }
  } else if (state === 'run' && $('count').textContent && runTime > 0.6) $('count').textContent = '';

  if (state === 'run') {
    runTime += dt;
    input.tether = rmb || fKey;
    input.target = target;
    input.anyMove = keys.w || keys.a || keys.s || keys.d;
    input.jumpPressed = jumpQueued; jumpQueued = false;
    acc += dt;
    prevVel.copy(player.vel);
    while (acc >= STEP && state === 'run') {
      player.step(STEP, input);
      input.jumpPressed = false;
      scanCD -= STEP;
      const d = enemies.scanHit(player.pos);
      if (d && scanCD <= 0 && state === 'run') {
        scanCD = 1.1;
        player.release(false);
        player.vel.multiplyScalar(0.7); player.flow = 0;
        sfx.zap(); toast('SCANNED', '#ff2f4a'); flash('#ff2f4a', 0.4); shake = 0.5;
        particles.burst(player.pos, RED, 24, 18, 1.1, 0.5);
        addDetection(28);
      }
      acc -= STEP;
    }
    // laser (hold to auto-fire)
    laserCD -= dt;
    if (lmb && laserCD <= 0 && state === 'run') {
      laserCD = 0.15;
      sfx.laser();
      const from = tmp.copy(player.pos).addScaledVector(fwd, 0.8);
      let to;
      if (laserTarget) {
        to = laserTarget.pos;
        const res = enemies.hit(laserTarget, fx);
        if (res) {
          if (res.type === 'watcherDown') { sfx.boom(); toast('EYE DOWN', '#ffa31a'); stats.kills++; hitstop = 0.05; shake = Math.max(shake, 0.2); }
          if (res.type === 'droneDown') { sfx.boom(); toast('ANTIVIRUS DOWN', '#ff6a7d'); stats.kills++; hitstop = 0.06; shake = Math.max(shake, 0.25); }
          if (res.type === 'droneHit') sfx.hit();
          if (res.type === 'lockHit') { sfx.escalate(res.level); toast(['', 'USER', 'ADMIN'][res.level] || '', '#ff9aa8'); }
          if (res.type === 'unlocked') { sfx.unlock(); toast('ROOT', '#5dff9a'); stats.unlocks++; hitstop = 0.04; }
        }
      } else to = tmp2.copy(camera.position).addScaledVector(fwd, 160);
      beams.fire(from, to, laserTarget ? (laserTarget.kind === 'lock' ? RED : GREEN) : GREEN);
    }
    // detection cools down when you're clean for a while
    if (runTime - lastHitT > 2.5) detection = Math.max(0, detection - 8 * dt);
    // zone hints
    for (const d of enemies.drones) if (d.alive && d.pos.distanceTo(player.pos) < 120) {
      hint('drone', '<b style="color:#ff2f4a">Antivirus drone.</b> Stay out of its turning red scan beam. Two laser hits take it down.', 7);
      break;
    }
    if (target && target.inRange) {
      const st = world.portState(target.port);
      if (st === 'watched') hint('watched', '<b style="color:#ffa31a">Amber: watched.</b> A trace runs down your line. Let go before it reaches you, or shoot the eye on the roof (<kbd>left click</kbd>).', 7);
      if (st === 'locked') hint('locked', '<b style="color:#ff2f4a">Red port: no rights.</b> Shoot the lock with <kbd>left click</kbd>. Three hits: user, admin, root.');
    }
    if (player.pos.z < CLUSTER_FRONT + 300) hint('cluster', 'The research cluster. Climb its face: connect, <kbd>Space</kbd>, connect again. The core is on top.', 8);
  } else if (state === 'lost') {
    lostT -= realDt;
    if (lostT <= 0) { player.respawn(); state = 'run'; smooth.copy(player.pos); trail.length = 0; flash('#000', 0.6); }
  } else if (state === 'finish') {
    finishT += realDt;
    player.pos.lerp(world.core.pos, Math.min(1, realDt * 6));
  }

  // auto-follow: when the mouse rests, the camera turns toward where you're flying
  const hv = Math.hypot(player.vel.x, player.vel.z);
  if (state === 'run' && mouseIdle > 0.8 && !player.grounded && !player.hold && hv > 22) {
    const ty = Math.atan2(-player.vel.x, -player.vel.z);
    let dy = ty - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    yaw += dy * Math.min(1, 1.1 * realDt);
  }

  updateCamera(realDt);
  updateVisuals(realDt, dt);
  updateHud(realDt);
}

function updateCamera(dt) {
  const speed = player.vel.length();
  smooth.lerp(player.pos, 1 - Math.exp(-22 * dt));
  if (smooth.distanceTo(player.pos) > 12) smooth.copy(player.pos);
  const D = 8.5 + Math.min(speed, 90) * 0.045 + (state === 'finish' ? Math.min(60, finishT * 40) : 0);
  camTarget.copy(smooth).add(tmp.set(0, 1.8, 0)).addScaledVector(right, 1.4);
  camera.position.copy(camTarget).addScaledVector(fwd, -D);
  if (camera.position.y < 1.5) camera.position.y = 1.5;
  // lean into the swing: roll follows sideways acceleration
  tmp.subVectors(player.vel, prevVel).divideScalar(Math.max(dt, 1e-3));
  const lat = tmp.dot(right);
  const rt = state === 'run' ? THREE.MathUtils.clamp(-lat * 0.0016, -0.16, 0.16) : 0;
  roll += (rt - roll) * Math.min(1, 5 * dt);
  camera.rotation.set(pitch, yaw, roll, 'YXZ');
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake = Math.max(0, shake - dt * 1.8);
  }
  fovKick = Math.max(0, fovKick - dt * 10);
  const fov = 74 + Math.min(1, speed / 75) * 18 + player.flow * 1.5 + fovKick;
  camera.fov += (fov - camera.fov) * Math.min(1, 6 * dt);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const g of [world.halos, glow, particles.gp]) g.mat.uniforms.uScale.value = scale;
}

const cablePts = Array.from({ length: 24 }, () => new THREE.Vector3());
const cEnd = new THREE.Vector3(), cCol = new THREE.Color(), bead = new THREE.Vector3();
function updateVisuals(rdt, dt) {
  world.update(elapsed);
  enemies.update(dt, elapsed, player.pos);
  particles.update(dt);
  beams.update(rdt, camera.position);
  outlines.update(rdt);

  const v = player.vel, sp = v.length();
  const hidden = state === 'lost' || (state === 'finish' && finishT > 0.4);
  orb.visible = tag.visible = !hidden;
  orb.position.copy(player.pos);
  if (sp > 1) {
    orb.lookAt(tmp.copy(player.pos).add(v));
    const st = 1 + Math.min(sp, 90) / 90 * 0.9;
    orb.scale.set(1 / Math.sqrt(st), 1 / Math.sqrt(st), st);
  } else orb.scale.set(1, 1, 1);
  tag.position.copy(player.pos).add(tmp.set(0, 1.7, 0));
  tag.material.opacity = Math.max(0, 1 - sp / 12) * 0.85;

  const flowGlow = 1 + player.flow * 0.25;
  glow.set(0, player.pos, cCol.copy(GREEN).multiplyScalar(hidden ? 0 : 0.85 * flowGlow), 2.5);

  // trail
  if (!hidden) { trail.unshift(player.pos.clone()); }
  const tlen = 14 + player.flow * 4;
  while (trail.length > tlen) trail.pop();
  if (trail.length > 2 && sp > 6 && !hidden) {
    trailR.build(trail, camera.position,
      (i) => {
        const near = THREE.MathUtils.clamp((trail[i].distanceTo(camera.position) - 4) / 8, 0, 1);
        return cCol.copy(GREEN).multiplyScalar((1 - i / trail.length) * 0.55 * Math.min(1, sp / 30) * flowGlow * near);
      },
      (i) => 0.42 * (1 - i / trail.length));
  } else trailR.hide();

  // the line
  const c = player.cable;
  glow.set(1, bead, cCol.setRGB(0, 0, 0), 0);
  if (c && !hidden && player.cableEnd(cEnd)) {
    const n = cablePts.length;
    const from = player.pos;
    const dist = from.distanceTo(cEnd);
    const slack = c.state === 'attached' ? Math.max(0, c.L - dist) : 0;
    const firing = c.state === 'firing' || c.state === 'whiff';
    const zipping = c.state === 'attached' && c.zipping;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      const p = cablePts[i].lerpVectors(from, cEnd, s);
      p.y -= Math.min(6, slack * 0.6) * 4 * s * (1 - s);
      if (firing || c.state === 'retract') {
        const w = Math.sin(s * Math.PI * 5 - elapsed * 50) * 0.45 * (1 - s) * s * 4;
        p.addScaledVector(right, w);
      }
    }
    const watched = c.state === 'attached' && c.watched;
    const traceS = watched ? 1 - c.traceT / T.TRACE_TIME : -1;
    const base = c.port && world.portState(c.port) === 'locked' ? RED : watched ? AMBER : GREEN;
    const bright = (zipping ? 1.6 : 1.0) * (c.state === 'retract' ? 0.5 : 1) * flowGlow;
    cableR.build(cablePts, camera.position, (i) => {
      const s = i / (n - 1);
      cCol.copy(base).multiplyScalar(bright);
      if (traceS >= 0) {
        const k = Math.max(0, 1 - Math.abs(s - traceS) * 7);
        cCol.lerp(RED, k).multiplyScalar(1 + k * 1.5);
      }
      return cCol;
    }, (i) => (zipping ? 0.32 : 0.22) * (1 + (i === 0 ? 0.3 : 0)));
    if (traceS >= 0) {
      bead.lerpVectors(from, cEnd, traceS);
      glow.set(1, bead, cCol.setRGB(1, 0.15, 0.2), 2.4 + (1 - traceS) * 1.6);
      // ticking speeds up as the pulse closes in
      c.tick = (c.tick || 0) - rdt;
      if (c.tick <= 0) { sfx.tick(1 - traceS); c.tick = 0.05 + traceS * 0.2; }
    }
  } else cableR.hide();
  glow.dirty();

  sfx.wind(sp, !!player.attachedPort());
  speedLines.draw(state === 'run' ? THREE.MathUtils.clamp((sp - 35) / 40, 0, 1) : 0, rdt);
}

const reticle = $('reticle'), retlabel = $('retlabel'), cross = $('cross'), lasermark = $('lasermark');
const flowPips = [...document.querySelectorAll('#flow i')];
function project(p) {
  tmp.copy(p).project(camera);
  if (tmp.z > 1) return null;
  return [(tmp.x + 1) / 2 * innerWidth, (1 - tmp.y) / 2 * innerHeight];
}
function updateHud(dt) {
  $('timer').textContent = fmt(runTime);
  $('best').textContent = best !== null ? 'best ' + fmt(best) : '';
  const prog = THREE.MathUtils.clamp((START_Z - player.pos.z) / TOTAL, 0, 1);
  $('progfill').style.width = (prog * 100).toFixed(1) + '%';
  $('zone').textContent = zoneName(player.pos.z);
  $('detfill').style.width = detection.toFixed(1) + '%';
  $('vignette').style.opacity = (detection / 100) * 0.9;
  $('spd').textContent = Math.round(player.vel.length());
  flowPips.forEach((el, i) => el.classList.toggle('on', i < player.flow));

  // reticle on the aimed port
  if (target && state !== 'menu') {
    const sp = project(target.port.pos);
    if (sp) {
      const st = world.portState(target.port);
      const col = !target.inRange ? '#7f98ad' : st === 'locked' ? '#ff2f4a' : st === 'watched' ? '#ffa31a' : '#5dff9a';
      reticle.style.display = 'block';
      reticle.style.left = sp[0] + 'px'; reticle.style.top = sp[1] + 'px';
      reticle.style.color = col;
      const d = Math.round(player.pos.distanceTo(target.port.pos));
      const lbl = target.port.core ? 'CORE' : !target.inRange ? 'OUT OF RANGE' : st === 'locked' ? `NO RIGHTS ${3 - target.port.lockHp}/3` : st === 'watched' ? 'WATCHED' : 'OPEN';
      retlabel.textContent = `${lbl} · ${d}`;
    } else reticle.style.display = 'none';
  } else reticle.style.display = 'none';
  cross.classList.toggle('lock', !!(target && target.inRange));

  if (laserTarget) {
    const sp = project(laserTarget.pos);
    lasermark.style.display = sp ? 'block' : 'none';
    if (sp) { lasermark.style.left = sp[0] + 'px'; lasermark.style.top = sp[1] + 'px'; }
  } else lasermark.style.display = 'none';

  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('show'); }
  if (flashA > 0) { $('flash').style.background = flashCol; $('flash').style.opacity = flashA; flashA = Math.max(0, flashA - dt * 2.2); }
  else $('flash').style.opacity = 0;
}

on(window, 'resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  speedLines.resize();
});

// menu backdrop: slow look down the hall
player.reset(world.startPos);
smooth.copy(player.pos);
showOv('start');
raf = requestAnimationFrame(frame);
// test hooks (dev builds / ?debug: window.__end1, used by the e2e smoke test)
const hooks = {
  player, world, enemies, camera, renderer,
  get state() { return state; }, get detection() { return detection; }, get runTime() { return runTime; },
  get target() { return target; },
  setAim(y, p) { yaw = y; pitch = p; mouseIdle = 0; },
  get yaw() { return yaw; }, get pitch() { return pitch; },
  // advance the game n frames without rendering; bot(game) runs before each frame
  advance(n, dt, bot) { for (let i = 0; i < n; i++) { if (bot) bot(hooks); update(dt); } },
  render() { renderer.render(scene, camera); },
  start() { initAudio(); beginRun(false); },
  pause() { paused = true; showOv('pause'); }, // headless never holds the pointer lock
  press(k, v) { if (k === 'rmb') rmb = v; if (k === 'lmb') lmb = v; if (k === 'space' && v) jumpQueued = true; if (keys[k] !== undefined) keys[k] = v; },
};
if (opts.debug) window.__end1 = hooks;

function dispose() {
  cancelAnimationFrame(raf);
  for (const off of offs) off();
  for (const id of timers) clearTimeout(id);
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  setAudioPaused(true);
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    }
  });
  renderer.dispose();
  renderer.forceContextLoss();
  if (window.__end1 === hooks) delete window.__end1;
  root.innerHTML = '';
}
return { dispose };
}
