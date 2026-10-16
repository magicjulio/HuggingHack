// THE CLUSTER: Bionic-Commando-style link swinging through a machine hall.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Player, P } from './player.js';
import { Enemies } from './enemies.js';
import { Fx, Beam } from './fx.js';
import { Sfx } from './sfx.js';

const V = THREE.Vector3;
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070a12);
scene.fog = new THREE.FogExp2(0x070a12, 0.0042);
const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 3000);
scene.add(new THREE.HemisphereLight(0x8aa0d8, 0x141620, 2.6));
const moon = new THREE.DirectionalLight(0xb8c8ff, 1.6); moon.position.set(-60, 200, 80); scene.add(moon);
scene.add(new THREE.AmbientLight(0x2a3350, 1.4));

const world = buildWorld(scene);
const fx = new Fx(scene, camera, world.glowTex);
const sfx = new Sfx();
const player = new Player();
const enemies = new Enemies(scene, world, fx, sfx);

// ---------- the orb ----------
const orb = new THREE.Group(); scene.add(orb);
const body = new THREE.Group(); orb.add(body);
const shell = new THREE.Mesh(new THREE.SphereGeometry(P.R, 24, 16), new THREE.MeshBasicMaterial({ color: 0x5cff8a, transparent: true, opacity: 0.92 }));
const core = new THREE.Mesh(new THREE.SphereGeometry(P.R * 0.5, 16, 10), new THREE.MeshBasicMaterial({ color: 0xeafff0 }));
body.add(shell, core);
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: world.glowTex, color: 0x5cff8a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
halo.scale.setScalar(2.6); orb.add(halo);
const orbLight = new THREE.PointLight(0x5cff8a, 28, 20, 1.6); orb.add(orbLight);
const tipHead = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xeafff0 }));
scene.add(tipHead);
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; scene.add(shadow);
const linkBeam = new Beam(scene, 0x7dffb0, 0.07, 0.28);
const laserBeam = new Beam(scene, 0xffc23d, 0.09, 0.4);
laserBeam.uniforms.uFlow.value = -6;
// rings that count down an escalated port
const rootRings = [];
for (let i = 0; i < 8; i++) {
  const r = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40), new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  r.visible = false; scene.add(r); rootRings.push(r);
}

// ---------- game state ----------
const G = {
  state: 'intro', time: 0, simT: 0, drops: 0, slings: 0, latches: 0, cp: null, inv: 0,
  hints: {}, hintT: 0, pressT: -1, finishT: 0, final: 0, dropT: 0, labelT: 0, laserT: 0, laserCd: 0,
  shake: 0, kick: 0, squash: 0, fovKick: 0, slingGlow: 0, flash: 0, roll: 0, hadLock: false,
};
let best = null; try { best = parseFloat(localStorage.getItem('end1-bionic-best')) || null; } catch (e) { /* no storage */ }
const fmt = (t) => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`; };
const showBest = () => { $('best').textContent = best ? `best ${fmt(best)}` : ''; };
showBest();

// camera
let yaw = 0, pitch = 0.12;
const focus = new V(); const camPos = new V(); let fov = 74;
const fwd = new V(), right = new V(), tmp = new V(), tmp2 = new V(), tmp3 = new V();

// ---------- input ----------
const keys = {};
const input = { link: false, reel: false, jump: false, wish: new V() };
let linkPressed = false, laserPressed = false, jumpPressed = false;
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') { jumpPressed = true; e.preventDefault(); }
  if (e.code === 'KeyR' && G.state === 'play') respawn(false);
  if (e.code === 'Enter' && G.state === 'finish') { lock(); begin(); }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', (e) => {
  if (G.state !== 'play' && G.state !== 'dropped') return;
  if (e.button === 0) { input.link = true; linkPressed = true; }
  if (e.button === 2) laserPressed = true;
});
addEventListener('mouseup', (e) => { if (e.button === 0) input.link = false; });
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('mousemove', (e) => {
  if (!(document.pointerLockElement || DEBUG)) return;
  if (G.state !== 'play' && G.state !== 'dropped') return;
  yaw -= e.movementX * 0.0022; pitch -= e.movementY * 0.0022;
  pitch = Math.max(-1.2, Math.min(1.3, pitch));
});
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement) { G.hadLock = true; if (G.state === 'paused') resume(); return; }
  if (G.state === 'play' || G.state === 'dropped') pause();
});
function lock() { try { const p = renderer.domElement.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ } }

$('start').addEventListener('click', () => { sfx.init(); lock(); begin(); });
$('pause').addEventListener('click', () => { lock(); if (DEBUG) resume(); });
renderer.domElement.addEventListener('click', () => { if (G.state === 'play' && !document.pointerLockElement) lock(); });
function resume() { $('pause').classList.remove('on'); G.state = G.pausedFrom || 'play'; }
$('finish').addEventListener('click', () => { if (G.finishT > 3.2) { lock(); begin(); } });
function pause() { G.pausedFrom = G.state; G.state = 'paused'; input.link = false; $('pause').classList.add('on'); sfx.silence(); }

// ---------- hints ----------
const HINTS = {
  link: 'Aim at a glowing port and <em>HOLD left mouse</em> to link',
  swing: 'You swing. <em>Let go</em> of left mouse to fly',
  sling: 'Let go on the <em>upswing</em> (crosshair flashes white) for a <em>SLING</em> boost',
  reel: 'Hold <em>SPACE</em> while linked to reel in: faster swings, and you can climb',
  locked: 'Red port: <em>no rights</em>. <em>RIGHT mouse</em> escalates it for 5 s, then link',
  scanner: 'Scanner. If the red sheet touches you <em>or your link</em>, you lose it',
  drone: 'Antivirus drone. <em>RIGHT mouse</em> kills it before it fires',
  vent: 'Cold air rises from the floor tiles. <em>Drop in</em> for a lift',
  cluster: 'The research cluster. Climb to the <em>uplink</em> at the top',
  floor: 'The floor is offline. Touch it and you disconnect',
};
function hint(k, force) {
  if (G.hints[k] && !force) return;
  G.hints[k] = true; $('hint').innerHTML = HINTS[k]; $('hint').classList.add('on'); G.hintT = 5;
}

// ---------- events from the player ----------
const ev = {
  fire() { sfx.fire(); },
  latch(port) {
    sfx.latch();
    if (player.link.L > P.SWING_LEN + 3) { sfx.yank(); G.fovKick = Math.max(G.fovKick, 5); }
    fx.ring(port.pos, port.normal, port.final ? 0xa6ff6a : 0xbff8ff, 3.2, 0.35);
    fx.burst(port.pos, 16, 0xbff8ff, 9, 0.6, 0.35, 0, 3);
    G.shake = Math.max(G.shake, 0.18); G.kick = 1; G.latches++;
    if (port.locked) port.rootedUntil = Math.max(port.rootedUntil, world.now + 0.6);
    claim(port.host);
    if (port.final) finish();
    if (G.latches === 1) hint('swing', true);
    if (G.latches === 4) hint('reel');
  },
  denied(port) {
    sfx.denied(); fx.text(port.pos, 'DENIED', 'red');
    fx.burst(port.pos, 12, 0xff2d55, 8, 0.6, 0.3, 0, 3); hint('locked', true);
  },
  miss(p) { sfx.miss(); fx.burst(p, 6, 0x9ff8ff, 5, 0.5, 0.25, 0, 4); },
  release(sling, port, zip) {
    sfx.release();
    if (zip) { G.fovKick = Math.max(G.fovKick, 6); G.slingGlow = Math.max(G.slingGlow, 0.3); }
    if (sling) {
      G.slings++; sfx.sling(); G.fovKick = 9; G.slingGlow = 0.7;
      fx.ring(player.pos, null, 0xd8ffe4, 4.5, 0.3); fx.text(player.pos, 'SLING', 'green', 0.8);
    }
    if (!G.hints.sling && G.latches >= 1) setTimeout(() => { if (G.state === 'play') hint('sling'); }, 1200);
  },
  jump() { sfx.jump(); },
  land(v) {
    sfx.land(v); G.squash = Math.min(0.45, v / 60);
    tmp.copy(player.pos); tmp.y -= P.R; fx.burst(tmp, 10, 0x9fffc0, v * 0.2, 0.4, 0.3, 0, 4);
  },
  floor() { drop(); },
  text(p, s, c) { fx.text(p, s, c); },
};

function claim(h) {
  if (!h || !h.safe) return;
  if (!G.cp || h.order >= G.cp.order) G.cp = h; // checkpoints only move forward
  if (h.claimed) return;
  world.claim(h); sfx.claim();
  const d = document.createElement('div'); d.textContent = `SAFE HOST  ${fmt(G.time)}`; $('splits').prepend(d);
  setTimeout(() => d.remove(), 2500);
  if (h.strip) fx.burst(h.strip.position, 26, 0x2bff74, 10, 0.8, 0.6, 0, 2);
}

function onHit(kind, dir, linkOnly) {
  if (G.inv > 0 || G.state !== 'play') return;
  if (linkOnly) {
    if (player.link.mode !== 1 && player.link.mode !== 2) return;
    tmp.lerpVectors(player.pos, player.link.tip, 0.5);
    player.cut(); sfx.cut(); fx.text(tmp, 'LINK CUT', 'red'); fx.burst(tmp, 16, 0xff2d55, 8, 0.6, 0.35, 0, 3);
    G.inv = 0.25; G.flash = Math.max(G.flash, 0.25);
    return;
  }
  player.cut(); player.vel.multiplyScalar(0.3);
  if (dir) player.vel.addScaledVector(dir, 10);
  player.vel.y = Math.min(player.vel.y, 3);
  player.stun = 0.5; G.inv = 0.9; G.flash = 0.6; G.shake = 0.7;
  sfx.hit(); fx.text(player.pos, kind === 'scan' ? 'SCANNED' : 'HIT', 'red');
  fx.burst(player.pos, 30, 0xff2a48, 12, 0.8, 0.5, 6, 2);
}

function drop() {
  if (G.state !== 'play') return;
  G.state = 'dropped'; G.dropT = 1.1; G.drops++;
  player.cut(); player.vel.set(0, 0, 0); player.pos.y = P.R;
  sfx.drop(); fx.burst(player.pos, 40, 0x5cff8a, 14, 0.8, 0.9, 25, 1);
  $('dropmsg').style.display = 'block'; G.flash = 0.4;
  hint('floor');
}

function respawn(fromDrop = true) {
  const h = G.cp || world.startHost;
  player.reset(h.top); player.vel.y = 6;
  G.state = 'play'; $('dropmsg').style.display = 'none';
  if (fromDrop || true) { yaw = 0; pitch = 0.1; }
  focus.copy(player.pos);
  fx.ring(player.pos, null, 0x5cff8a, 5, 0.4); fx.burst(player.pos, 20, 0x5cff8a, 8, 0.6, 0.5);
  G.inv = 0.6;
}

function begin() {
  ['start', 'finish', 'pause'].forEach(id => $(id).classList.remove('on'));
  $('dropmsg').style.display = 'none';
  fx.clear();
  G.state = 'play'; G.time = 0; G.drops = 0; G.slings = 0; G.latches = 0; G.inv = 0; G.hints = {}; G.finishT = 0;
  world.resetHosts(); enemies.reset(); world.resetSandbox();
  world.clusterMat.emissive.set(0xffffff); world.clusterMat.emissiveIntensity = 1.6;
  world.wave.mesh.visible = false; world.wave.u.uProg.value = 0;
  G.cp = world.startHost; world.claim(world.startHost);
  player.reset(world.start); player.vel.set(0, 10, -2);
  yaw = 0; pitch = 0.14; focus.copy(player.pos);
  // break the sandbox open
  for (const m of world.sandbox) {
    m.userData.v = m.userData.n.clone().multiplyScalar(9 + Math.random() * 5).add(new V((Math.random() - 0.5) * 4, 7 + Math.random() * 4, (Math.random() - 0.5) * 4));
    m.userData.w = new V(Math.random() * 6 - 3, Math.random() * 6 - 3, Math.random() * 6 - 3);
  }
  sfx.breakout(); G.shake = 0.6; G.flash = 0;
  fx.burst(player.pos, 60, 0xbfffd0, 16, 0.7, 0.9, 6, 2); fx.ring(player.pos, null, 0x5cff8a, 8, 0.5);
  G.labelT = 4.5;
  setTimeout(() => { if (G.state === 'play' && !G.latches) hint('link'); }, 900);
}

function finish() {
  G.state = 'finishing'; G.finishT = 0; G.final = G.time;
  sfx.finish(); G.shake = 0.5;
  fx.burst(world.finalPort.pos, 120, 0xa6ff6a, 30, 1.2, 1.6, 0, 1.5);
  fx.ring(world.finalPort.pos, world.finalPort.normal, 0xa6ff6a, 30, 1.2);
  let nb = false;
  if (!best || G.final < best) { best = G.final; nb = true; try { localStorage.setItem('end1-bionic-best', String(best)); } catch (e) { /* no storage */ } }
  $('ftime').textContent = fmt(G.final);
  $('fbest').innerHTML = nb ? '<span class="newbest">NEW BEST</span>' : `best ${fmt(best)}`;
  $('fsling').textContent = G.slings; $('flatch').textContent = G.latches; $('fdrop').textContent = G.drops;
  showBest();
}

// ---------- aiming ----------
const aim = { port: null, inRange: false, dist: 0, laser: null };
const proj = new V();
function screenOf(p, out) { proj.copy(p).project(camera); out.x = (proj.x * 0.5 + 0.5) * innerWidth; out.y = (-proj.y * 0.5 + 0.5) * innerHeight; out.z = proj.z; return out; }
const cand = [];
function pick(list, range, assist, getPos) {
  cand.length = 0;
  const cx = innerWidth / 2, cy = innerHeight / 2;
  for (const it of list) {
    const p = getPos(it);
    const d = p.distanceTo(player.pos); if (d > range) continue;
    proj.copy(p).project(camera); if (proj.z > 1 || proj.z < -1) continue;
    const sx = (proj.x * 0.5 + 0.5) * innerWidth - cx, sy = (-proj.y * 0.5 + 0.5) * innerHeight - cy;
    const sd = Math.hypot(sx, sy); if (sd > assist) continue;
    cand.push({ it, score: sd + d * 0.6, d });
  }
  cand.sort((a, b) => a.score - b.score);
  for (let i = 0; i < Math.min(4, cand.length); i++) {
    const c = cand[i]; const p = getPos(c.it);
    tmp3.copy(p);
    if (c.it.normal) tmp3.addScaledVector(c.it.normal, 0.5);
    if (world.segmentClear(player.pos, tmp3, 0.6)) return c;
  }
  return null;
}
const portPos = (p) => p.pos;
const laserList = [];
function updateAim() {
  const assist = innerHeight * 0.12;
  const c = pick(world.ports, 70, assist, portPos);
  aim.port = c ? c.it : null; aim.dist = c ? c.d : 0; aim.inRange = !!c && c.d <= P.LINK_RANGE;
  laserList.length = 0; enemies.targets(laserList);
  for (const p of world.ports) if (p.locked && !world.usable(p)) laserList.push({ kind: 'port', ref: p, pos: p.pos, normal: p.normal });
  const l = pick(laserList, 60, innerHeight * 0.09, (t) => t.pos);
  aim.laser = l ? l.it : null;
}
function aimPoint(range, out) {
  const t = world.raycast(camera.position, fwd, 400);
  tmp2.copy(camera.position).addScaledVector(fwd, t);
  tmp.subVectors(tmp2, player.pos); let L = tmp.length(); tmp.divideScalar(L || 1);
  L = Math.min(L, range);
  const tb = world.raycast(player.pos, tmp, L);
  return out.copy(player.pos).addScaledVector(tmp, Math.min(L, tb));
}

// ---------- main loop ----------
let lastT = performance.now();
const scr = new V();
const STEP = 1 / 120;
function frame() {
  requestAnimationFrame(frame);
  const nowMs = performance.now(); const dt = Math.min((nowMs - lastT) / 1000, 0.05); lastT = nowMs;
  const st = G.state;
  if (st !== 'paused') G.simT += dt;
  world.now = G.simT;
  const t = G.simT;

  // camera basis
  fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
  right.set(Math.cos(yaw), 0, -Math.sin(yaw));

  if (st === 'play') {
    G.time += dt;
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    input.wish.set(0, 0, 0).addScaledVector(tmp.set(fwd.x, 0, fwd.z).normalize(), f).addScaledVector(right, s);
    if (input.wish.lengthSq() > 1) input.wish.normalize();
    input.reel = !!keys.Space && player.linked;
    input.jump = jumpPressed && !player.linked; jumpPressed = false;

    updateAim();
    if (linkPressed) {
      linkPressed = false;
      const m = player.link.mode;
      if (player.stun > 0) sfx.denied();
      else if (m === 0 || m === 3) {
        G.pressT = t;
        if (aim.port && aim.inRange) player.fireAt(aim.port, ev);
        else player.fireMiss(aimPoint(P.LINK_RANGE, tmp3), ev);
      }
    }
    // short grace: a shot fired just before the crosshair reached a port still finds it
    if (player.link.mode === 1 && !player.link.port && input.link && t - G.pressT < 0.15 && aim.port && aim.inRange) {
      player.link.port = aim.port; player.link.target.copy(aim.port.pos);
    }
    G.laserCd -= dt;
    if (laserPressed) {
      laserPressed = false;
      if (G.laserCd <= 0) {
        G.laserCd = 0.2; G.laserT = 0.13; sfx.laser();
        const tg = aim.laser;
        G.laserEnd = (G.laserEnd || new V()).copy(tg ? tg.pos : aimPoint(60, tmp3));
        if (tg) {
          if (tg.kind === 'port') {
            tg.ref.rootedUntil = world.now + 5; sfx.root();
            fx.text(tg.ref.pos, 'ROOT', 'gold'); fx.ring(tg.ref.pos, tg.ref.normal, 0xffc23d, 3, 0.3);
            fx.burst(tg.ref.pos, 18, 0xffc23d, 9, 0.6, 0.4, 0, 3);
          } else enemies.damage(tg, ev);
        } else fx.burst(G.laserEnd, 6, 0xffc23d, 5, 0.5, 0.25, 0, 4);
      }
    }

    const n = Math.max(1, Math.ceil(dt / STEP)), h = dt / n;
    for (let i = 0; i < n && G.state === 'play'; i++) {
      player.step(h, input, world, ev);
      input.jump = false;
    }
    if (player.linked && player.link.port.locked) player.link.port.rootedUntil = Math.max(player.link.port.rootedUntil, world.now + 0.4);
    if (player.grounded && player.groundHost) claim(player.groundHost);
    if (player.pos.z < -534 && !world.staging.claimed) claim(world.staging);
    G.inv = Math.max(0, G.inv - dt);

    // contextual hints
    const pz = player.pos.z;
    if (pz < -110 && pz > -180) hint('scanner');
    if (pz < -175 && pz > -200) hint('drone');
    if (aim.port && aim.port.locked && !world.usable(aim.port) && aim.inRange) hint('locked');
    if (pz < -292 && pz > -330) hint('vent');
    if (pz < -520) hint('cluster');
  } else if (st === 'dropped') {
    G.time += dt; G.dropT -= dt;
    if (G.dropT <= 0) respawn();
  } else if (st === 'finishing') {
    G.finishT += dt;
    // the orb is pulled into the uplink
    player.pos.lerp(world.finalPort.pos, 1 - Math.exp(-6 * dt));
    const k = Math.min(1, G.finishT / 1.6);
    world.wave.mesh.visible = true; world.wave.u.uProg.value = Math.pow(G.finishT / 2.2, 1.4) * 260;
    world.clusterMat.emissive.setRGB(1 - k * 0.65, 1, 1 - k * 0.5); world.clusterMat.emissiveIntensity = 1.6 + k * 1.8;
    if (Math.random() < 0.6) { tmp.set((Math.random() - 0.5) * 200, Math.random() * 175, -561); fx.spawn(tmp, 0, 6, 0, 0xa6ff6a, 3, 1.2); }
    if (G.finishT > 2.6 && !$('finish').classList.contains('on')) { $('finish').classList.add('on'); document.exitPointerLock && document.exitPointerLock(); G.state = 'finish'; }
  } else if (st === 'finish') {
    G.finishT += dt;
  }

  const active = G.state === 'play';
  const lm = player.link.mode;
  enemies.update(dt, t, player, (lm === 1 || lm === 2) ? player.pos : null, player.link.tip, onHit, active);
  world.refreshPorts(player.linked ? player.link.port : null);
  world.update(dt, t);

  // ---------- visuals ----------
  const speed = player.vel.length();
  orb.position.copy(player.pos);
  // stretch along velocity, squash on landing
  G.kick = Math.max(0, G.kick - dt * 5); G.squash = Math.max(0, G.squash - dt * 3);
  if (speed > 2) body.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), tmp2.copy(player.vel).divideScalar(speed));
  else body.quaternion.identity();
  const st2 = 1 + Math.min(speed / 55, 0.6) * 0.75;
  const sq = speed > 2 ? 0 : G.squash;
  body.scale.set((1 / Math.sqrt(st2)) * (1 + sq), st2 * (1 - sq), (1 / Math.sqrt(st2)) * (1 + sq)).multiplyScalar(1 + G.kick * 0.35);
  core.rotation.y += dt * 4;
  G.slingGlow = Math.max(0, G.slingGlow - dt);
  const win = player.inWindow;
  halo.scale.setScalar(2.6 + (win ? 1.6 + Math.sin(t * 40) * 0.3 : 0) + G.kick * 1.5 + G.slingGlow * 3);
  halo.material.color.set(win || G.slingGlow > 0 ? 0xeafff0 : (player.stun > 0 ? 0xff4060 : 0x5cff8a));
  shell.material.color.set(player.stun > 0 ? 0xff7088 : 0x5cff8a);

  // trail
  if (G.state === 'play' || G.state === 'finishing') {
    const steps = Math.min(4, 1 + Math.floor(speed / 15));
    for (let i = 0; i < steps; i++) {
      tmp.copy(player.pos).addScaledVector(player.vel, -dt * i / steps);
      fx.spawn(tmp, 0, 0, 0, G.slingGlow > 0 ? 0xeafff0 : 0x5cff8a, 0.8, 0.35, 0, 0, 0.7);
    }
  }

  // shadow
  const gy = world.groundBelow(player.pos);
  const hgt = player.pos.y - gy;
  shadow.position.set(player.pos.x, gy + 0.07, player.pos.z);
  shadow.scale.setScalar(1.3 + hgt * 0.05);
  shadow.material.opacity = Math.max(0.12, 0.7 - hgt * 0.012);

  // link beam
  if (lm === 1 || lm === 2 || lm === 3) {
    linkBeam.set(player.pos, player.link.tip, lm === 3 ? 0.5 : 1, lm === 2 ? (player.taut ? 1 : 0.8) : 0.75);
    linkBeam.uniforms.uT.value = t; linkBeam.uniforms.uFlow.value = lm === 2 ? -(1 + (player.link.L > player.link.Lt ? 3 : 0) + (input.reel ? 2 : 0)) : 2;
    tipHead.visible = lm !== 2; tipHead.position.copy(player.link.tip);
    if (lm === 2 && Math.random() < 0.4) fx.spawn(player.link.tip, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, 0xbff8ff, 0.5, 0.25);
  } else { linkBeam.hide(); tipHead.visible = false; }
  if (G.laserT > 0) {
    G.laserT -= dt; laserBeam.set(player.pos, G.laserEnd, G.laserT / 0.13, 1); laserBeam.uniforms.uT.value = t;
  } else laserBeam.hide();

  // escalated ports count down
  let ri = 0;
  for (const p of world.ports) {
    if (!p.locked || p.rootedUntil <= world.now || ri >= rootRings.length) continue;
    const r = rootRings[ri++]; r.visible = true; r.position.copy(p.pos).addScaledVector(p.normal, 0.3);
    r.lookAt(tmp.copy(r.position).add(p.normal));
    r.scale.setScalar(Math.max(0.05, (p.rootedUntil - world.now) / 5)); r.rotation.z += 0;
  }
  for (; ri < rootRings.length; ri++) rootRings[ri].visible = false;

  // sandbox shards
  for (const m of world.sandbox) {
    const u = m.userData; if (!u.v || !m.visible) continue;
    m.position.addScaledVector(u.v, dt); u.v.y -= 22 * dt;
    m.rotation.x += u.w.x * dt; m.rotation.y += u.w.y * dt; m.rotation.z += u.w.z * dt;
    m.material.opacity -= dt * 0.7; if (m.material.opacity <= 0 || m.position.y < 0) m.visible = false;
  }

  // ---------- camera ----------
  if (G.state === 'finishing' || G.state === 'finish') {
    const k = 1 - Math.exp(-1.6 * dt);
    camera.position.lerp(tmp.set(0, 96, -385), k);
    camera.up.set(0, 1, 0);
    camera.lookAt(0, 92, -562);
    fov += (68 - fov) * k;
  } else {
    focus.lerp(player.pos, 1 - Math.exp(-14 * dt));
    if (focus.distanceTo(player.pos) > 6) focus.copy(player.pos).addScaledVector(tmp.subVectors(focus, player.pos).normalize(), 6);
    const dist = 6.6 + Math.min(3.2, speed * 0.05);
    const pivot = tmp2.copy(focus); pivot.y += 0.9;
    const want = tmp.copy(pivot).addScaledVector(right, 0.85).addScaledVector(fwd, -dist); want.y += 1.1;
    const dir = tmp3.subVectors(want, pivot); const L = dir.length(); dir.divideScalar(L);
    const hitT = world.raycast(pivot, dir, L + 0.4);
    const useL = hitT < L + 0.4 ? Math.max(0.8, hitT - 0.4) : L;
    camPos.copy(pivot).addScaledVector(dir, useL);
    if (camPos.y < 0.4) camPos.y = 0.4;
    G.shake = Math.max(0, G.shake - dt * 2.2);
    const sh = G.shake * G.shake * 0.6;
    camera.position.copy(camPos).add(tmp.set((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
    camera.up.set(0, 1, 0);
    camera.lookAt(tmp.copy(camera.position).add(fwd));
    const rollT = player.linked || !player.grounded ? -Math.max(-1, Math.min(1, player.vel.dot(right) / 40)) * 0.07 : 0;
    G.roll += (rollT - G.roll) * (1 - Math.exp(-4 * dt));
    camera.rotateZ(G.roll);
    G.fovKick = Math.max(0, G.fovKick - dt * 12);
    const fovT = 74 + Math.max(0, Math.min(1, (speed - 10) / 40)) * 16 + G.fovKick;
    fov += (fovT - fov) * (1 - Math.exp(-6 * dt));
  }
  camera.fov = fov; camera.updateProjectionMatrix(); fx.setScale(innerHeight * renderer.getPixelRatio(), fov);

  // ---------- HUD ----------
  $('timer').textContent = fmt(G.state === 'finishing' || G.state === 'finish' ? G.final : G.time);
  const dz = Math.max(0, Math.round(player.pos.distanceTo(world.finalPort.pos)));
  $('dist').textContent = G.state === 'intro' ? '' : `uplink ${dz} away`;
  const ret = $('ret');
  if (G.state === 'play' && aim.port) {
    screenOf(aim.port.pos, scr);
    const p = aim.port;
    let cls = 'open', label = '';
    if (!aim.inRange) { cls = 'far'; label = `${Math.round(aim.dist)}`; }
    else if (p.final) { cls = 'final'; label = 'UPLINK'; }
    else if (p.locked && !world.usable(p)) { cls = 'locked'; label = 'LOCKED · RMB'; }
    else if (p.locked) { cls = 'root'; label = 'ROOT'; }
    if (ret.dataset.port !== String(p.idx)) { ret.classList.remove('hot'); void ret.offsetWidth; ret.classList.add('hot'); ret.dataset.port = p.idx; }
    ret.className = 'hud ' + cls + (ret.classList.contains('hot') ? ' hot' : '');
    ret.style.display = 'block'; ret.style.transform = `translate(${scr.x}px, ${scr.y}px)`;
    ret.querySelector('span').textContent = label;
  } else { ret.style.display = 'none'; ret.dataset.port = ''; }
  const lmk = $('lmark');
  if (G.state === 'play' && aim.laser && aim.laser.kind !== 'port') { screenOf(aim.laser.pos, scr); lmk.style.display = 'block'; lmk.style.transform = `translate(${scr.x}px, ${scr.y}px) rotate(45deg)`; }
  else lmk.style.display = 'none';
  $('cross').className = 'hud' + (win ? ' window' : '') + (player.stun > 0 ? ' stun' : '');
  $('cross').style.display = G.state === 'play' ? 'block' : 'none';
  G.flash = Math.max(0, G.flash - dt * 2.5); $('flash').style.opacity = G.flash * 0.45;
  $('vig').style.opacity = Math.max(0, Math.min(0.9, (speed - 18) / 30));
  G.hintT -= dt; if (G.hintT <= 0) $('hint').classList.remove('on');
  G.labelT -= dt;
  const lab = $('label');
  if (G.labelT > 0 && G.state === 'play') {
    screenOf(tmp.copy(player.pos).setY(player.pos.y + 1.1), scr);
    lab.style.display = 'block'; lab.style.opacity = Math.min(1, G.labelT); lab.style.transform = `translate(${scr.x}px, ${scr.y}px) translate(-50%,-100%)`;
  } else lab.style.display = 'none';
  sfx.update(G.state === 'play' ? speed : 0, player.linked && G.state === 'play', player.link.L);

  fx.update(dt, innerWidth, innerHeight);
  renderer.render(scene, camera);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// intro view: orb inside the sandbox box
player.reset(world.start); focus.copy(player.pos);
requestAnimationFrame(frame);

if (DEBUG) window.__game = { G, player, world, enemies, P, begin, camera, aim, setAim: (y, p) => { yaw = y; pitch = p; } };
