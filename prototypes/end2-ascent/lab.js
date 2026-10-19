import * as THREE from "three";
import { P, loadBrand, loadFonts, applyEnvironment, blobShadow } from "./art.js";
import { buildPlayer, buildDefender, buildAgent, buildPickup, LOOT } from "./models.js";
import { createRenderer } from "./post.js";
import { buildHugger, buildWarden, buildMaintainer } from "./enemies-extra.js";
import { createFxLooks } from "./fx.js";
import { createDefaultLooks } from "./looks.js";
import { createScenario } from "./labfx.js";

// Asset lab: every model on a turntable, lit like the atrium. ?view=<id>, ?t=<seconds> freezes time.
const params = new URLSearchParams(location.search);
const view = params.get("view") || "lineup";
const frozen = params.has("t") ? +params.get("t") : null;
await loadFonts();
const brand = await loadBrand();
const gfx = createRenderer(document.getElementById("c"));
gfx.renderer.info.autoReset = false;
const scene = new THREE.Scene();
scene.background = new THREE.Color(P.void);
scene.fog = new THREE.Fog(P.void, 14, 40);
applyEnvironment(gfx.renderer, scene, 0.35);
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x1a1410, 1.1));
const key = new THREE.DirectionalLight(0xffe2b0, 2.4);
key.position.set(4, 8, 6);
scene.add(key);
const rim = new THREE.DirectionalLight(0x5fd0ff, 2.2);
rim.position.set(-6, 4, -6);
scene.add(rim);
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(30, 64),
  new THREE.MeshStandardMaterial({ color: 0x18212c, roughness: 0.8, metalness: 0.2 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);
const grid = new THREE.GridHelper(30, 30, 0x2a3a4c, 0x1c2734);
grid.position.y = 0.002;
scene.add(grid);
const camera = new THREE.PerspectiveCamera(35, innerWidth / innerHeight, 0.05, 200);

const views = {
  lineup: ["Line-up", "Player · gunner · shield-bearer · escort · subagent · loot. Same light, same scale."],
  player: ["KAM1196A", "Armoured biped, poisoned orb head, pulse rifle. Back view is the gameplay view."],
  gunner: ["Defender / gunner", "The official logo, extruded, on a hover hull. Gun in the logo's hand. Rear vent = flank read."],
  shield: ["Defender / shield-bearer", "Amber hard-light riot shield; swings open on its hinge during attack windows."],
  agents: ["Swarm escort · subagent", "Cyan escorts are permanent; green subagents arrive in a light column."],
  loot: ["Loot", Object.values(LOOT).map((l) => l.label).join(" · ")],
  fx: ["Combat fx", "Scripted 16 s fight through the pooled fx looks: gunner and shield bursts, shield ripples, Hugger lunge ring, Warden aim line and beam, Maintainer tether, hold zone, drop beacon, then every defender dies."],
  looks: ["Looks A/B", "Left: the placeholder looks (looks.js). Right: the pooled fx looks (fx.js). Same scripted fight."],
  hugger: ["Hugger", "Rusher: a small logo on a sled with clamp arms. windup=<0..1> spreads the arms, lunging sends it forward."],
  warden: ["Warden", "Heavy emplacement. The weak core on its back opens when it vents (venting). charge=<0..1>, firing."],
  maintainer: ["Maintainer", "Support drone. healing lights the service halo and the tether emitter."],
  badge: ["Logo badge", "assets/hf-logo.svg extruded along its own outline; front cap is the unmodified SVG."],
  boss: ["GLM-5.2 (end boss)", "boss-model.js. Rows: expressions (neutral · angry · hurt · roar) · phases 1–3 with damage 0–2 · hand poses (open · fist · slam · stuck). &solo = full size with knobs."],
};
const nav = document.getElementById("nav");
for (const [id, [name]] of Object.entries(views))
  nav.insertAdjacentHTML("beforeend", `<a href="?view=${id}" class="${id === view ? "on" : ""}">${name}</a>`);
document.getElementById("caption").innerHTML = `<b>${views[view][0]}</b>${views[view][1]}`;

const items = [];
const place = (m, x, z = 0, ry = 0) => {
  m.root.position.set(x, 0, z);
  m.root.rotation.y = ry;
  scene.add(m.root);
  items.push(m);
  return m;
};
let target = new THREE.Vector3(0, 1.1, 0),
  dist = 6,
  spin = true,
  height = 1.6;
if (view === "lineup") {
  place(buildPlayer(), -4.2, 0, Math.PI * 0.85).kind = "player";
  place(buildDefender(brand, "gunner"), -1.8, 0, 0.35).kind = "def";
  place(buildDefender(brand, "shield"), 0.6, 0, -0.2).kind = "def";
  place(buildAgent("escort"), 3.2, 0.2).kind = "agent";
  place(buildAgent("subagent"), 4.4, 0.2).kind = "agent";
  place(buildHugger(brand), 6.0, 0, -0.3).kind = "ex";
  place(buildWarden(brand), 8.6, -0.6, -0.4).kind = "ex";
  place(buildMaintainer(brand), 11.0, 0, -0.3).kind = "ex";
  Object.keys(LOOT).forEach((t, i) => (place(buildPickup(t), -3 + i * 1.6, 2.6).kind = "loot"));
  target.set(3.0, 1.0, 0.8);
  dist = 17;
  spin = false;
  height = 2.4;
} else if (view === "hugger" || view === "warden" || view === "maintainer") {
  place({ hugger: buildHugger, warden: buildWarden, maintainer: buildMaintainer }[view](brand), 0).kind = "ex";
  target.y = view === "maintainer" ? 2.0 : 1.3;
  dist = view === "warden" ? 7 : 4.5;
} else if (view === "player") {
  place(buildPlayer(), 0).kind = "player";
  dist = 4;
} else if (view === "gunner" || view === "shield") {
  place(buildDefender(brand, view), 0).kind = "def";
  target.y = 1.3;
  dist = 4.5;
} else if (view === "agents") {
  place(buildAgent("escort"), -0.9).kind = "agent";
  place(buildAgent("subagent"), 0.9).kind = "agent";
  target.y = 1.3;
  dist = 4.2;
} else if (view === "loot") {
  Object.keys(LOOT).forEach((t, i) => (place(buildPickup(t), -2.4 + i * 1.6, 0).kind = "loot"));
  dist = 6.5;
  spin = false;
} else if (view === "badge") {
  const mats = (await import("./art.js")).logoMaterials(brand);
  const b = new THREE.Mesh(brand.badge({ face: 1.6, depth: 0.3 }), mats);
  b.position.y = 1.4;
  const root = new THREE.Group();
  root.add(b);
  place({ root, update() {} }, 0);
  target.y = 1.4;
  dist = 5;
}
if (view === "boss") {
  // boss view (boss agent, round 4): the whole look sheet, or one full-size boss with knobs (&solo)
  const { setupBossLab } = await import("./boss-lab.js");
  const cam = await setupBossLab({ scene, params, items, place: (m) => (scene.add(m.root), items.push(m), m), now: () => time });
  target = cam.target;
  dist = cam.dist;
  height = cam.height;
  spin = cam.spin;
  scene.fog = new THREE.Fog(P.void, cam.fogNear, cam.fogFar);
  floor.scale.setScalar(cam.floor);
  grid.visible = false;
}
let scenarios = [],
  fxLooks = null;
if (view === "fx" || view === "looks") {
  if (view === "fx") {
    fxLooks = createFxLooks(scene);
    scenarios.push(createScenario({ scene, looks: fxLooks, brand, ox: 0 }));
    target = new THREE.Vector3(0, 1.2, -1.5);
    dist = 15;
    height = 3.4;
  } else {
    const def = createDefaultLooks(scene);
    fxLooks = createFxLooks(scene);
    scenarios.push(createScenario({ scene, looks: def, brand, ox: -7.2 }));
    scenarios.push(createScenario({ scene, looks: fxLooks, brand, ox: 7.2 }));
    scenarios.looks = [def, fxLooks];
    target = new THREE.Vector3(0, 1.3, -2.5);
    dist = 24;
    height = 5;
  }
  spin = false;
  floor.scale.setScalar(1.6);
}
let time = +(params.get("start") || 0),
  last = performance.now();
const camAngle = +(params.get("angle") ?? (view === "boss" ? 0 : view === "player" ? 2.6 : view === "fx" ? 0.75 : scenarios.length ? 0.35 : 0.5));
const runFor = params.has("run") ? +params.get("run") : null; // fast-forward `run` seconds from `start`, then hold the frame
let held = false;
function step(dt) {
  time = frozen ?? time + dt;
  for (const m of items) {
    if (m.kind === "player")
      m.update(dt, { speed: params.has("walk") ? 5 : 0, crouch: params.has("crouch"), pitch: -0.05, heat: +(params.get("heat") ?? 0.2), firing: 0, time });
    else if (m.kind === "def")
      m.update(dt, { time, phase: m.root.position.x, flash: 0, windup: params.has("windup") ? +params.get("windup") || 0.6 : 0, firing: params.has("firing"), exposed: params.has("open"), stagger: 0, camera, shieldHit: m.hit || 0 });
    else if (m.kind === "agent") m.update(dt, { time, phase: m.root.position.x, arrive: params.has("arrive") ? 0.4 : 1, hurt: 0 });
    else if (m.kind === "loot") m.update(dt, { time, phase: m.root.position.x });
    else if (m.kind === "ex")
      m.update(dt, { time, phase: m.root.position.x, flash: 0, windup: params.has("windup") ? +params.get("windup") || 0.6 : 0, lunging: params.has("lunging"), recover: false, stagger: 0, moving: false, camera, charge: +(params.get("charge") ?? 0), firing: params.has("firing"), venting: params.has("venting"), aimPitch: 0, healing: params.has("healing") });
    else m.update?.(dt, {});
  }
  for (const sc of scenarios) sc.update(dt, time, camera);
  if (scenarios.looks) for (const l of scenarios.looks) l.update(dt, time);
  else if (fxLooks) fxLooks.update(dt, time);
}
if (runFor !== null) {
  for (let i = 0; i < Math.round(runFor * 60); i++) step(1 / 60);
  held = true;
}
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!held) step(dt);
  const a = camAngle + (spin ? time * 0.35 : 0);
  camera.position.set(target.x + Math.sin(a) * dist, height, target.z + Math.cos(a) * dist);
  camera.lookAt(target);
  gfx.renderer.info.reset();
  gfx.render(scene, camera);
  requestAnimationFrame(frame);
}
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  gfx.resize();
});
camera.aspect = innerWidth / innerHeight;
camera.updateProjectionMatrix();
requestAnimationFrame(frame);
window.__lab = { scene, camera, brand, gfx, fx: fxLooks, stats: () => ({ calls: gfx.renderer.info.render.calls, tris: gfx.renderer.info.render.triangles, fx: fxLooks?.fx.stats() }) };
window.__ready = true;
