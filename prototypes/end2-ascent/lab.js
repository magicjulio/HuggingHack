import * as THREE from "three";
import { P, loadBrand, loadFonts, applyEnvironment, blobShadow } from "./art.js";
import { buildPlayer, buildDefender, buildAgent, buildPickup, LOOT } from "./models.js";
import { createRenderer } from "./post.js";

// Asset lab: every model on a turntable, lit like the atrium. ?view=<id>, ?t=<seconds> freezes time.
const params = new URLSearchParams(location.search);
const view = params.get("view") || "lineup";
const frozen = params.has("t") ? +params.get("t") : null;
await loadFonts();
const brand = await loadBrand();
const gfx = createRenderer(document.getElementById("c"));
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
  badge: ["Logo badge", "assets/hf-logo.svg extruded along its own outline; front cap is the unmodified SVG."],
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
  place(buildAgent("escort"), 2.6, 0.2).kind = "agent";
  place(buildAgent("subagent"), 3.9, 0.2).kind = "agent";
  Object.keys(LOOT).forEach((t, i) => (place(buildPickup(t), -3 + i * 1.6, 2.6).kind = "loot"));
  target.set(0, 1.0, 0.8);
  dist = 11;
  spin = false;
  height = 2.4;
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
let time = 0,
  last = performance.now();
const camAngle = +(params.get("angle") ?? (view === "player" ? 2.6 : 0.5));
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time = frozen ?? time + dt;
  for (const m of items) {
    if (m.kind === "player")
      m.update(dt, { speed: params.has("walk") ? 5 : 0, crouch: params.has("crouch"), pitch: -0.05, heat: +(params.get("heat") ?? 0.2), firing: 0, time });
    else if (m.kind === "def")
      m.update(dt, { time, phase: m.root.position.x, flash: 0, windup: params.has("windup") ? 0.6 : 0, exposed: params.has("open"), stagger: 0, camera });
    else if (m.kind === "agent") m.update(dt, { time, phase: m.root.position.x, arrive: params.has("arrive") ? 0.4 : 1, hurt: 0 });
    else if (m.kind === "loot") m.update(dt, { time, phase: m.root.position.x });
    else m.update?.(dt, {});
  }
  const a = camAngle + (spin ? time * 0.35 : 0);
  camera.position.set(target.x + Math.sin(a) * dist, height, target.z + Math.cos(a) * dist);
  camera.lookAt(target);
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
window.__lab = { scene, camera, brand };
