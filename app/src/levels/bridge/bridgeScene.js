
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer, RenderPass, EffectPass, BloomEffect, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { RENDER, createEnv } from '../ch2/world/env.js';
import { createIslands, expandIslands } from '../ch2/world/islands.js';
import { createBridges } from '../ch2/world/bridges.js';
import { createForge } from '../ch2/world/forge.js';
import { createDecor } from '../ch2/world/decor.js';
import { createPlayerOrb, ORB } from '../ch2/world/playerOrb.js';
import { createPhaseOne } from '../ch2/world/phaseOne.js';
import { BR, TEXT, LANES, direct, camKeys, camPose, laneAt, backAt, backDoor, along } from '../ch2/world/bridge.js';
import '../ch2/ui/icons.js';
import '../ch2/ui/hud.js';
import LAYOUT from '../ch2/layout.json';
import islandS from '../../assets/models/ch2-island-s.glb?url';
import islandM from '../../assets/models/ch2-island-m.glb?url';
import islandL from '../../assets/models/ch2-island-l.glb?url';
import { MARKUP } from './markup.js';
import { CAMERA } from '../ch2/config';

const LOOK = .0022;   // ThirdPerson.tsx SENSITIVITY

/**
 * The bridge scene, ported from the designer's reference page design/ch2-ui/bridge.html (its whole script, same order).
 * App changes only: a factory that builds its DOM in `root` and cleans up in dispose(); the review transport bar, beat name
 * and the stand-in end card are gone; a lane / the door calls opts.onPick('end1'…'end4') after the ride; Enter skips the
 * film when opts.canSkip; island models load from app assets; window.BRIDGE → opts.debug (window.__bridge);
 * Ch2's look (pointer lock, mouse yaw + pitch, camera-relative WASD) instead of drag, Esc → opts.onScreen pause card.
 */
export async function createBridge(root, opts = {}) {
root.innerHTML = MARKUP;
const offs = [];
const on = (t, ty, fn, o) => { t.addEventListener(ty, fn, o); offs.push(() => t.removeEventListener(ty, fn, o)); };
const addEventListener = (ty, fn, o) => on(window, ty, fn, o);


const L = LAYOUT, H = window.c2hud, Q = new URLSearchParams(location.search), $ = (s) => root.querySelector(s);
const _BEATS = [['rise', BR.rise, 'RISE'], ['speech', BR.speech, 'IT SPEAKS'], ['split', BR.split, 'THE SPLIT'], ['assign', BR.assign, 'YOUR ASSIGNMENT'], ['control', BR.control, 'PICK YOUR WORK']];

// ------------------------------------------------------------------------------------------- renderer + world (the game's modules)
const renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: false, powerPreference: 'high-performance', stencil: false, depth: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, Q.get('quality') === 'low' ? .75 : 1.5)); renderer.setSize(innerWidth, innerHeight);
const scene = new THREE.Scene(); scene.background = new THREE.Color(RENDER.background); scene.fog = new THREE.FogExp2(RENDER.fog.color, RENDER.fog.density);
const camera = new THREE.PerspectiveCamera(RENDER.camera.fov, innerWidth / innerHeight, RENDER.camera.near, RENDER.camera.far);
const U = { uTime: { value: 0 }, uPsy: { value: .5 } };
await Promise.all(['700 52px "JetBrains Mono"', '400 40px "JetBrains Mono"', '700 80px "Chakra Petch"'].map((f) => document.fonts.load(f).catch(() => {})));
const loader = new GLTFLoader(), load = (u) => loader.loadAsync(u).then((g) => g.scene);
const [ms, mm, ml] = await Promise.all([load(islandS), load(islandM), load(islandL)]);
const models = { s: ms, m: mm, l: ml };
if (opts.cancelled?.()) { for (const off of offs) off(); renderer.dispose(); renderer.forceContextLoss(); return { dispose() {} }; }   // unmounted while loading
const env = createEnv({ U, camera, renderer }); scene.add(env.object); scene.environment = env.environment; scene.environmentIntensity = RENDER.envIntensity;
const islands = createIslands({ layout: L, U, models }); scene.add(islands.object); islands.labels.visible = false;
const bridges = createBridges({ layout: L, U }); scene.add(bridges.object);
const forge = createForge({ layout: L, U }); scene.add(forge.object);
const decor = Q.has('nodecor') ? null : createDecor({ layout: L, U, models }); if (decor) scene.add(decor.object);
const player = createPlayerOrb({ U }); scene.add(player.object);
const P1 = createPhaseOne({ layout: L, U }); scene.add(P1.object);
const G = P1.G, KEYS = camKeys(G);
for (const h of (Q.get('hide') ?? '').split(',').filter(Boolean)) ({ p1: P1, decor, islands, bridges, forge, env, player })[h].object.visible = false;   // debug
for (const i of (Q.get('p1hide') ?? '').split(',').filter(Boolean)) P1.object.children[+i].visible = false;

const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: Q.get('quality') === 'low' ? 0 : 4 });
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new EffectPass(camera, new BloomEffect({ luminanceThreshold: RENDER.bloom.threshold, luminanceSmoothing: .1, intensity: 1.1, mipmapBlur: true, radius: .62 }), new ToneMappingEffect({ mode: ToneMappingMode.AGX })));

// ------------------------------------------------------------------------------------------- HUD
const stage = $('#stage'), hudEl = $('#hud');
H.mount(hudEl); H.tokens(64, 0); H.poisonIcon?.(true);
let said = -2;
function speech(D, t, scrub) {
  const idx = D.assign ? 99 : D.speechOff ? -1 : D.speech;
  if (idx !== said) {
    if (idx === -1) H.bubbleOff();
    else { hudEl.style.setProperty('--c2-type-cps', scrub ? 9999 : 60); if (idx === 99) { H.bubbleOff(); H.say('phaseone', TEXT.assign.text); } else H.say('phaseone', TEXT.lines[idx].text, idx + 1, TEXT.lines.length); }
    said = idx;
  }
  if (idx === -1) return;
  const a = idx === 99 ? [orbP[0], orbP[1] + .9, orbP[2]] : P1.bigAnchor(t);
  const v = new THREE.Vector3(...a).project(camera);
  if (v.z < 1) H.place(Math.min(innerWidth * .7, (v.x + 1) / 2 * innerWidth), Math.max(innerHeight * .3, (1 - v.y) / 2 * innerHeight));   // keep the bubble on screen
}
function quest(on) { $('#quests').innerHTML = on ? `<li class="c1-quest"><span class="c1-quest__mark"></span><span class="c1-quest__text">${TEXT.quest}</span></li>` : ''; }

// ------------------------------------------------------------------------------------------- the choice: a small stand-in for the Ch2 controller
const PH = L.physics, orbP = [...G.orb];
const ground = [];   // circles you can stand on around the Forge: [x, z, r, y]
{
  const F = L.forge; ground.push([F.pos[0], F.pos[2], 9 * 1.55 * .9, F.pos[1]]);
  for (const d of F.dais) ground.push([F.pos[0], F.pos[2], d.r, F.pos[1] + d.y]);
  for (const d of expandIslands(L)) if (d.zone === 'forge' && d.id !== 'forge') ground.push([d.pos[0], d.pos[2], L.models[d.model].radius * d.scale * .9, d.pos[1]]);
}
const groundAt = (x, y, z) => { let best = null; for (const [gx, gz, r, gy] of ground) if (Math.hypot(x - gx, z - gz) < r && gy <= y + PH.stepUp && (best === null || gy > best)) best = gy; return best; };
const pl = { p: [...G.feet], v: [0, 0, 0], grounded: true, dash: 0, dashCd: 0, airDash: true, glide: false };
let yaw = Math.atan2(-G.F[0], -G.F[2]), pitch = CAMERA.startPitch, keys = new Set(), mode = 'film', ride = null, T = 0, paused = false;
addEventListener('keydown', (e) => { if (e.code === 'Space') e.preventDefault(); keys.add(e.code); }); addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// app: Ch2's look (ThirdPerson.tsx): pointer lock on a click, mouse orbits (yaw + pitch), Esc unlocks = pause card
const gl = $('#gl'), locked = () => document.pointerLockElement === gl;
const lock = () => { try { gl.requestPointerLock()?.catch?.(() => {}); } catch { /* needs a click */ } };
on(gl, 'click', () => { if (mode === 'play' && !paused && !locked()) lock(); });
addEventListener('mousemove', (e) => {
  if (mode !== 'play' || !locked()) return;
  yaw -= e.movementX * LOOK; pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, pitch + e.movementY * LOOK));
});
const PAUSE_KEYS = [['WASD', 'move · mouse look'], ['SPACE', 'jump · hold to glide'], ['SHIFT', 'dash']];
function pause() {
  if (paused) return; paused = true; keys.clear(); keysHeldSpace = false;
  opts.onScreen?.({ kind: 'pause', title: 'Paused', keys: PAUSE_KEYS, action: { label: 'Resume', onClick: resume }, onBackdrop: resume, hint: 'Click anywhere to continue' });
}
function resume() { if (!paused) return; paused = false; opts.onScreen?.(null); if (mode === 'play') lock(); }
on(document, 'pointerlockchange', () => { if (!locked() && mode === 'play') pause(); });
addEventListener('keydown', (e) => { if (e.code === 'Escape' && !locked()) (paused ? resume : pause)(); });
function resetPlay() { pl.p = [...G.feet]; pl.v = [0, 0, 0]; pl.grounded = true; yaw = Math.atan2(-G.F[0], -G.F[2]); pitch = CAMERA.startPitch; ride = null; }
function step(dt) {
  const f = [-Math.sin(yaw), -Math.cos(yaw)], r = [Math.cos(yaw), -Math.sin(yaw)];
  let ix = 0, iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) { ix += f[0]; iz += f[1]; } if (keys.has('KeyS') || keys.has('ArrowDown')) { ix -= f[0]; iz -= f[1]; }
  if (keys.has('KeyD') || keys.has('ArrowRight')) { ix += r[0]; iz += r[1]; } if (keys.has('KeyA') || keys.has('ArrowLeft')) { ix -= r[0]; iz -= r[1]; }
  const n = Math.hypot(ix, iz) || 1; ix /= n; iz /= n;
  const acc = pl.grounded ? PH.groundAccel : PH.airAccel;
  pl.v[0] += (ix * PH.walk - pl.v[0]) * Math.min(1, acc * dt); pl.v[2] += (iz * PH.walk - pl.v[2]) * Math.min(1, acc * dt);
  pl.dashCd -= dt;
  if (keys.has('ShiftLeft') && pl.dashCd <= 0 && (pl.grounded || pl.airDash)) { const d = Math.hypot(ix, iz) > .1 ? [ix, iz] : f; pl.dash = PH.dashTime; pl.dashCd = PH.dashCooldown; pl.dashDir = d; if (!pl.grounded) pl.airDash = false; }
  if (keys.has('Space') && pl.grounded) { pl.v[1] = PH.jump; pl.grounded = false; keys.delete('Space'); pl.held = true; }
  if (pl.dash > 0) { pl.dash -= dt; pl.v[0] = pl.dashDir[0] * PH.dashSpeed; pl.v[2] = pl.dashDir[1] * PH.dashSpeed; pl.v[1] = Math.max(pl.v[1], 0); }
  else pl.v[1] -= PH.gravity * dt;
  pl.glide = !pl.grounded && pl.v[1] < 0 && keysHeldSpace;
  if (pl.glide) pl.v[1] = Math.max(pl.v[1], -PH.glideFall);
  const nx = pl.p[0] + pl.v[0] * dt, ny = pl.p[1] + pl.v[1] * dt, nz = pl.p[2] + pl.v[2] * dt;
  const gy = groundAt(nx, pl.p[1], nz);
  if (gy !== null && ny <= gy && pl.v[1] <= 0) { pl.p = [nx, gy, nz]; pl.v[1] = 0; pl.grounded = true; pl.airDash = true; }
  else { pl.p = [nx, ny, nz]; if (pl.grounded && (gy === null || pl.p[1] - gy > PH.snapDown)) pl.grounded = false; else if (pl.grounded) pl.p[1] = gy; }
  if (pl.p[1] < G.feet[1] - 16) resetPlay();
}
let keysHeldSpace = false; addEventListener('keydown', (e) => { if (e.code === 'Space') keysHeldSpace = true; }); addEventListener('keyup', (e) => { if (e.code === 'Space') { keysHeldSpace = false; pl.held = false; } });

// ------------------------------------------------------------------------------------------- picking
let picked = null;
const _ENDINGS = { end1: ['ENDING 1', 'OpenAI', 'the machine hall · Cluster Run would start here'], end2: ['ENDING 2', 'Hugging Face', 'the tower · ending 2 would start here'], end3: ['ENDING 3', 'The Floor', 'the scorer\'s floor · ending 3 would start here'], end4: ['ENDING 4', 'The way back', 'you left the board · ending 4 would start here'] };
function commit(kind, data) {
  mode = 'ride'; if (locked()) document.exitPointerLock(); ride = { kind, t0: T, ...data }; $('#help').classList.remove('on');
}
function rideStep() {
  const k = T - ride.t0;
  if (ride.kind === 'lane') {
    const u = Math.min(1, ride.u + (1 - ride.u) * Math.pow(Math.min(1, k / 6), 2.2));
    const p = along(ride.lane.path, u); orbP[0] = p[0]; orbP[1] = p[1]; orbP[2] = p[2];
    const ahead = along(ride.lane.path, Math.min(1, u + .02)), back = along(ride.lane.path, Math.max(0, u - .015));
    camera.position.lerp(new THREE.Vector3(back[0], back[1] + 2.5, back[2]), .08); camera.lookAt(...ahead);
  } else {
    const d = backDoor(G), dir = [-G.F[0], -G.F[2]];
    orbP[0] = d.pos[0] + dir[0] * k * 1.4; orbP[2] = d.pos[2] + dir[1] * k * 1.4; orbP[1] = d.pos[1] + ORB.hover + .1;
    camera.position.lerp(new THREE.Vector3(d.pos[0] - dir[0] * 6, d.pos[1] + 2.4, d.pos[2] - dir[1] * 6), .05); camera.lookAt(orbP[0], orbP[1], orbP[2]);
  }
  $('#fade').style.opacity = Math.min(1, Math.max(0, (k - 3.2) / 1.2));
  if (k > 4.6 && !picked) { picked = ride.kind === 'lane' ? ride.lane.ending : 'end4'; opts.onPick?.(picked); }
}

// ------------------------------------------------------------------------------------------- frame
let back = Q.get('back') ?? 'faint';
const setBack = (b) => { back = b; };
setBack(back);
function frame(dt, scrub = false) {
  U.uTime.value += dt; const ut = U.uTime.value;
  const D = direct(Math.min(T, BR.control + 30));
  if (mode === 'film' && T >= BR.control) { mode = 'play'; resetPlay(); $('#help').classList.add('on'); }
  if (mode === 'play') {
    step(dt);
    orbP[0] = pl.p[0]; orbP[1] = pl.p[1] + ORB.hover; orbP[2] = pl.p[2];
    const hit = laneAt(P1.paths, orbP); if (hit) commit('lane', { lane: hit.lane, u: hit.u });
    else if (backAt(G, orbP)) commit('back', {});
  }
  if (mode === 'film') { orbP[0] = G.orb[0]; orbP[1] = G.orb[1]; orbP[2] = G.orb[2]; }
  forge.update(ut, dt, { power: 0, round: 3, progress: 1, phase: 'done' });   // dead since Step 7
  const feet = mode === 'play' ? pl.p : [orbP[0], orbP[1] - ORB.hover, orbP[2]];
  player.update(ut, dt, { pos: feet, grounded: mode === 'play' ? pl.grounded : mode === 'film', glide: pl.glide, groundY: mode === 'ride' ? null : groundAt(feet[0], feet[1] + .1, feet[2]), poisoned: 1 });
  islands.update(ut, dt, {}); env.update(ut, dt); bridges.update(ut, dt); decor?.update(ut, dt);
  P1.update(T, dt, { D, orb: orbP, back });
  if (mode === 'film') { const c = camPose(G, KEYS, T); camera.position.set(...c.pos); camera.lookAt(...c.look); camera.fov = c.fov; }
  else if (mode === 'play') {
    const cp = Math.cos(pitch), d = CAMERA.distance, h = CAMERA.height;   // app: ThirdPerson's orbit pose
    const tgt = new THREE.Vector3(orbP[0] + Math.sin(yaw) * cp * d, orbP[1] + h + Math.sin(pitch) * d, orbP[2] + Math.cos(yaw) * cp * d);
    camera.position.lerp(tgt, scrub ? 1 : 1 - Math.exp(-14 * dt)); camera.lookAt(orbP[0], orbP[1] + h * .45, orbP[2]); camera.fov = 58;
  } else rideStep();
  camera.updateProjectionMatrix();
  stage.classList.toggle('is-cine', mode !== 'play' && D.letterbox > .5);
  speech(D, T, scrub);
  quest(D.quest && mode === 'play');
  if (Q.has('nopost')) renderer.render(scene, camera); else composer.render(dt);
}

// ------------------------------------------------------------------------------------------- time (app: no review transport)
let playing = true, speed = 1, last = performance.now();
function seek(t) { T = Math.max(0, Math.min(BR.end, t)); said = -2; mode = 'film'; $('#fade').style.opacity = 0; $('#help').classList.remove('on'); if (T >= BR.control) { mode = 'play'; resetPlay(); $('#help').classList.add('on'); } }
seek(Q.has('choice') ? BR.control : 0);
$('#skipHint').hidden = !opts.canSkip;
addEventListener('keydown', (e) => { if (e.code === 'Enter' && opts.canSkip && mode === 'film') seek(BR.control); });
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); });
renderer.setAnimationLoop(() => {
  const now = performance.now(), rdt = Math.min(.05, (now - last) / 1000); last = now;
  const dt = paused ? 0 : mode === 'film' ? (playing ? rdt * speed : 0) : rdt;
  T += dt;
  frame((mode === 'film' && !playing) || paused ? rdt * .0001 : dt);
  if (mode !== 'film') $('#skipHint').hidden = true;
});
const hooks = { seek, pause, resume, get paused() { return paused; }, get T() { return T; }, set T(v) { T = v; }, P1, G, camera, scene, renderer, commit, pl, play: (v) => (playing = v), frame };
if (opts.debug) window.__bridge = hooks;
return { dispose() {
  renderer.setAnimationLoop(null);
  if (locked()) document.exitPointerLock(); opts.onScreen?.(null);
  for (const off of offs) off();
  for (const m of [P1, decor, islands, bridges, forge, env, player]) m?.dispose?.();
  composer.dispose(); renderer.dispose(); renderer.forceContextLoss();
  if (window.__bridge === hooks) delete window.__bridge;
  root.innerHTML = '';
} };
}
