import * as THREE from "three";
import { asset } from "./assets.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { tameLogoEnv } from "./models.js";
import {
  P,
  rbox,
  mesh,
  metal,
  emissive,
  armour,
  additive,
  glowSprite,
  blobShadow,
  beamTexture,
  logoMaterials,
  canvas,
  texture,
  hazardStripes,
} from "./art.js";

// First-pass models for the combat redesign's new defenders: Hugger (rusher),
// Warden (heavy emplacement) and Maintainer (support). Same conventions as
// models.js: built facing +Z, root at the feet, official logo unmodified on the
// face, gunmetal hull, one warm accent. Each builder returns
// { root, update(dt, state), setHealth(v), dispose() }. The characters area owns
// the final look and may restyle or replace these; gameplay only relies on the
// interface and on `center` (the hit-sphere height, see T.enemies.<kind>.height).

const shared = new Map();
function once(key, make) {
  if (!shared.has(key)) shared.set(key, make());
  return shared.get(key);
}
// ---------------------------------------------------------------- glb kit
// The three defenders' bodies come from Blender (design/3d/end2/characters/extras_kit.py): worn yellow paint over gunmetal, the
// same paint and glow language as the gunner and shield-bearer. The official logo badge is added here, unmodified. The
// glb is loaded once at import (top-level await); if it is missing, the plain procedural builders below are used, so the game
// always runs.
let XKIT = null;
export async function loadExtrasKit(url = asset("end2-char-extras-kit.glb")) {
  const gltf = await new GLTFLoader().loadAsync(url);
  XKIT = {
    hugger: gltf.scene.getObjectByName("hugger"),
    warden: gltf.scene.getObjectByName("warden"),
    maintainer: gltf.scene.getObjectByName("maintainer"),
  };
  return XKIT;
}
try {
  await loadExtrasKit();
} catch (err) {
  console.warn("[ascent] extras kit not loaded, using the procedural Hugger/Warden/Maintainer", err);
}
export const hasExtrasKit = () => !!XKIT;
// Clone a kit piece. Geometry and the worn PBR materials stay shared; materials whose name is in `own` get a private copy
// per mesh, so every enemy (and every coil ring) can drive its own glow. Returns { root, mats: { name: [material...] } }.
function cloneKit(piece, own) {
  const root = piece.clone(true);
  const mats = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (own.includes(o.material.name)) {
      const m = o.material.clone();
      (mats[m.name] ||= []).push(m);
      o.material = m;
    }
  });
  return { root, mats };
}
const COLD = new THREE.Color(0xff6a14),
  HOT = new THREE.Color(0xfff0c0);
// coil telegraph: ring i of n lights when the charge (0..1) has reached it; colour runs orange to white-hot
function driveRings(rings, charge, kick, time) {
  const n = rings.length;
  for (let i = 0; i < n; i++) {
    const lit = THREE.MathUtils.clamp((charge * 1.35 - i * (1 / n) * 0.9) / 0.3, 0, 1);
    const m = rings[i];
    m.emissive.copy(COLD).lerp(HOT, lit * lit);
    m.emissiveIntensity = 0.3 + lit * 3.4 + kick * 3 + (lit > 0 ? Math.sin(time * 70 + i * 2) * 0.3 * lit : 0);
  }
}

const hullMat = () => once("x.hull", () => armour(0x2a3340, 0.45, 0.75));
const darkMat = () => once("x.dark", () => metal(0x11161c, 0.55, 0.6));
const trimMat = () => once("x.trim", () => metal(P.hfYellow, 0.35, 0.4));
const stripeMat = () =>
  once("x.stripe", () => {
    const [c, g] = canvas(64, 256);
    hazardStripes(g, 0, 0, 64, 256, "#ffd21e", "#14181d");
    return new THREE.MeshStandardMaterial({ map: texture(c), roughness: 0.55, metalness: 0.4 });
  });

function logoFace(brand, parent, face, z = 0) {
  const mats = once("x.badge", () => logoMaterials(brand));
  const badge = mesh(brand.badge({ face, depth: 0.2, bevel: 0.045 }), mats, parent, 0, 0, z);
  tameLogoEnv(badge, mats);
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = mesh(badge.geometry, flashMat, parent, 0, 0, z + 0.005);
  flash.scale.setScalar(1.01);
  return { badge, flashMat };
}

// Segmented health bar, billboarded; hidden until first damage.
function healthBar(parent, y, width = 1) {
  const bar = new THREE.Group();
  bar.position.y = y;
  parent.add(bar);
  const geo = once("x.barGeo", () => new THREE.PlaneGeometry(1, 1));
  const back = new THREE.Mesh(
    geo,
    once("x.barBack", () => new THREE.MeshBasicMaterial({ color: 0x0a0f16, transparent: true, opacity: 0.75, depthTest: false })),
  );
  back.scale.set(width * 1.04, 0.12, 1);
  back.renderOrder = 10;
  const fillMat = new THREE.MeshBasicMaterial({ color: P.hfYellow, depthTest: false, toneMapped: false });
  const fill = new THREE.Mesh(geo, fillMat);
  fill.scale.set(width, 0.07, 1);
  fill.renderOrder = 11;
  bar.add(back, fill);
  bar.visible = false;
  return {
    set(v) {
      fill.scale.x = Math.max(0.0001, v) * width;
      fill.position.x = (-(1 - v) * width) / 2;
      bar.visible = true;
    },
    face(camera) {
      if (bar.visible && camera) bar.quaternion.copy(camera.quaternion);
    },
    dispose() {
      fillMat.dispose();
    },
  };
}

// ---------------------------------------------------------------- Hugger
// A small, fast logo on a low sled with two long clamp arms: the hands of the
// logo reach out to hug. Arms spread wide during the lunge telegraph.
// s: { time, phase, flash, windup(0..1), lunging, recover, stagger, moving, camera }
function buildHuggerBasic(brand) {
  const root = new THREE.Group();
  const face = 0.62;
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);
  const { flashMat } = logoFace(brand, body, face, 0.12);
  const r = face * 0.52;
  const hull = mesh(new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat(), body, 0, 0, -0.02);
  hull.rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(r, 0.03, 8, 32), trimMat(), body, 0, 0, -0.03);
  const ventMat = emissive(P.hfOrange, 2);
  const alertMat = emissive(P.danger, 0);
  const alert = mesh(new THREE.TorusGeometry(r * 1.12, 0.03, 6, 36), alertMat, body, 0, 0, -0.05);
  // Sled with twin rear thrusters.
  const sled = mesh(rbox(0.7, 0.16, 0.9, 0.05), darkMat(), body, 0, -r - 0.12, -0.15);
  for (const s of [-1, 1]) {
    mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 12), ventMat, sled, s * 0.22, 0, -0.5).rotation.x = Math.PI / 2;
  }
  const flare = glowSprite(P.hfOrange, 0.9, 0.5);
  flare.position.set(0, -r - 0.12, -0.75);
  body.add(flare);
  // Clamp arms: shoulder pivots at the hull rim.
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * r * 0.95, -0.05, 0);
    body.add(shoulder);
    mesh(rbox(0.12, 0.12, 0.62, 0.04), hullMat(), shoulder, 0, 0, 0.28);
    mesh(rbox(0.125, 0.04, 0.45, 0.015), stripeMat(), shoulder, 0, 0.07, 0.26);
    const fore = new THREE.Group();
    fore.position.z = 0.58;
    shoulder.add(fore);
    mesh(rbox(0.1, 0.1, 0.42, 0.035), darkMat(), fore, 0, 0, 0.18);
    mesh(rbox(0.18, 0.22, 0.1, 0.04), trimMat(), fore, -s * 0.03, 0, 0.42);
    arms.push({ shoulder, fore, s });
  }
  root.add(blobShadow(0.5, 0.5));
  const bar = healthBar(root, 1.75, 0.7);
  return {
    root,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      ventMat.dispose();
      alertMat.dispose();
      flare.material.dispose();
      bar.dispose();
    },
    update(dt, s) {
      const w = s.windup || 0;
      body.position.y = 0.95 + Math.sin(s.time * 6 + s.phase) * 0.04 - w * 0.18;
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, s.lunging ? 0.35 : s.moving ? 0.18 : -w * 0.25, 10, dt);
      body.rotation.z = s.stagger > 0 ? Math.sin(s.time * 32) * 0.22 : 0;
      for (const a of arms) {
        const spread = s.lunging ? -0.15 : 0.35 + w * 0.9;
        a.shoulder.rotation.y = THREE.MathUtils.damp(a.shoulder.rotation.y, a.s * spread, 14, dt);
        a.fore.rotation.y = THREE.MathUtils.damp(a.fore.rotation.y, -a.s * (s.lunging ? 1.1 : 0.5), 14, dt);
      }
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      alertMat.emissiveIntensity = w > 0 || s.lunging ? 2.5 + Math.sin(s.time * 40) * 1.5 : 0;
      ventMat.emissiveIntensity = s.lunging ? 4 : 1.8;
      flare.material.opacity = s.lunging ? 0.9 : 0.4;
      flare.scale.setScalar(s.lunging ? 1.8 : 0.9);
      bar.face(s.camera);
    },
  };
}

// ---------------------------------------------------------------- Warden
// Heavy emplacement: a big logo set into an armoured drum on a tripod, with a
// beam projector under the face and a glowing core on its back (the weak point).
// s: { time, phase, flash, charge(0..1), firing, venting, stagger, camera, aimPitch }
function buildWardenBasic(brand) {
  const root = new THREE.Group();
  const face = 1.25;
  // Tripod.
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Group();
    leg.rotation.y = (i * Math.PI * 2) / 3 + Math.PI / 6;
    root.add(leg);
    const l = mesh(rbox(0.18, 1.1, 0.18, 0.05), darkMat(), leg, 0, 0.5, 0.55);
    l.rotation.x = 0.55;
    mesh(rbox(0.36, 0.08, 0.5, 0.03), hullMat(), leg, 0, 0.04, 0.85);
  }
  mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.5, 18), hullMat(), root, 0, 0.95, 0);
  // Turning head.
  const head = new THREE.Group();
  head.position.y = 1.6;
  root.add(head);
  const drum = mesh(new THREE.CylinderGeometry(0.85, 0.85, 1.0, 28), hullMat(), head, 0, 0, -0.35);
  drum.rotation.x = Math.PI / 2;
  // Armour collar around the face.
  const collar = mesh(new THREE.TorusGeometry(face * 0.56, 0.11, 10, 40), hullMat(), head, 0, 0, 0.16);
  mesh(new THREE.TorusGeometry(face * 0.56, 0.035, 6, 40), trimMat(), head, 0, 0, 0.27);
  for (const s of [-1, 1]) {
    const plate = mesh(rbox(0.32, 1.25, 0.2, 0.05), hullMat(), head, s * 0.9, 0, 0.05);
    plate.rotation.y = s * -0.35;
    mesh(rbox(0.06, 1.0, 0.03, 0.01), stripeMat(), plate, 0, 0, 0.11);
  }
  const { flashMat } = logoFace(brand, head, face, 0.2);
  // Beam projector under the face.
  const projector = new THREE.Group();
  projector.position.set(0, -face * 0.55, 0.3);
  head.add(projector);
  const barrel = mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.7, 16), darkMat(), projector, 0, 0, 0.2);
  barrel.rotation.x = Math.PI / 2;
  const lensMat = emissive(P.danger, 0.5);
  mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), lensMat, projector, 0, 0, 0.56).rotation.x = Math.PI / 2;
  const charge = glowSprite(P.danger, 0.5, 0);
  charge.position.set(0, 0, 0.62);
  projector.add(charge);
  // Rear core: the weak point. Brightens and opens while venting.
  const coreMat = emissive(P.hfOrange, 2.2);
  const core = mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.18, 20), coreMat, head, 0, 0, -0.9);
  core.rotation.x = Math.PI / 2;
  const coreGlow = glowSprite(P.hfOrange, 1.4, 0.5);
  coreGlow.position.set(0, 0, -1.02);
  head.add(coreGlow);
  const shutters = [];
  for (const s of [-1, 1]) {
    const sh = mesh(rbox(0.48, 0.92, 0.06, 0.02), darkMat(), head, s * 0.24, 0, -0.98);
    shutters.push({ sh, s });
  }
  root.add(blobShadow(1.3, 0.6));
  const bar = healthBar(root, 2.9, 1.6);
  return {
    root,
    head,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      lensMat.dispose();
      coreMat.dispose();
      charge.material.dispose();
      coreGlow.material.dispose();
      bar.dispose();
    },
    update(dt, s) {
      const c = s.charge || 0;
      head.position.y = 1.6 - (s.stagger > 0 ? 0.08 : 0);
      head.rotation.z = s.stagger > 0 ? Math.sin(s.time * 30) * 0.06 : 0;
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -(s.aimPitch || 0), 6, dt);
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      lensMat.emissiveIntensity = s.firing ? 5 : 0.5 + c * 4;
      charge.material.opacity = s.firing ? 1 : c * 0.9;
      charge.scale.setScalar(s.firing ? 1.4 + Math.sin(s.time * 40) * 0.2 : 0.3 + c * 0.9);
      const open = s.venting || s.stagger > 0;
      coreMat.emissiveIntensity = open ? 5 + Math.sin(s.time * 12) * 1.2 : 2.2;
      coreGlow.material.opacity = open ? 0.95 : 0.45;
      coreGlow.scale.setScalar(open ? 2.2 : 1.4);
      for (const { sh, s: side } of shutters)
        sh.position.x = THREE.MathUtils.damp(sh.position.x, side * (open ? 0.62 : 0.24), 10, dt);
      collar.rotation.z += dt * (s.firing ? 4 : 0.3);
      bar.face(s.camera);
    },
  };
}

// ---------------------------------------------------------------- Maintainer
// Support drone: a logo floating high under a rotating service halo, with a
// tether emitter below. Stays back, heals the most damaged defender.
// s: { time, phase, flash, healing, stagger, moving, camera }
function buildMaintainerBasic(brand) {
  const root = new THREE.Group();
  const face = 0.7;
  const body = new THREE.Group();
  body.position.y = 2.3;
  root.add(body);
  const { flashMat } = logoFace(brand, body, face, 0.12);
  const r = face * 0.52;
  const hull = mesh(new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), hullMat(), body, 0, 0, -0.02);
  hull.rotation.x = -Math.PI / 2;
  mesh(new THREE.TorusGeometry(r, 0.03, 8, 32), trimMat(), body, 0, 0, -0.03);
  // Service halo above the head.
  const haloMat = emissive(P.hfYellow, 1.2);
  const halo = mesh(new THREE.TorusGeometry(0.42, 0.035, 8, 40), haloMat, body, 0, r + 0.28, -0.05);
  halo.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const node = mesh(rbox(0.09, 0.09, 0.09, 0.02), darkMat(), halo, Math.cos((i * Math.PI) / 2) * 0.42, Math.sin((i * Math.PI) / 2) * 0.42, 0);
    node.rotation.z = (i * Math.PI) / 2;
  }
  // Emitter stalk.
  mesh(rbox(0.08, 0.6, 0.08, 0.03), darkMat(), body, 0, -r - 0.25, -0.05);
  const emitterMat = emissive(P.hfYellow, 0.6);
  const emitter = mesh(new THREE.OctahedronGeometry(0.12, 0), emitterMat, body, 0, -r - 0.62, -0.05);
  const glow = glowSprite(P.hfYellow, 0.6, 0.2);
  glow.position.copy(emitter.position);
  body.add(glow);
  const cone = new THREE.Mesh(
    once("x.cone", () => new THREE.CylinderGeometry(0.03, 0.16, 0.7, 12, 1, true)),
    additive(P.hfOrange, 0.35, beamTexture()),
  );
  cone.rotation.x = Math.PI;
  cone.position.set(0, -r - 1.05, -0.05);
  body.add(cone);
  root.add(blobShadow(0.45, 0.35));
  const bar = healthBar(root, 3.2, 0.8);
  return {
    root,
    emitter,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      haloMat.dispose();
      emitterMat.dispose();
      glow.material.dispose();
      cone.material.dispose();
      bar.dispose();
    },
    update(dt, s) {
      body.position.y = 2.3 + Math.sin(s.time * 1.8 + s.phase) * 0.12 - (s.stagger > 0 ? 0.25 : 0);
      body.rotation.z = s.stagger > 0 ? Math.sin(s.time * 26) * 0.2 : Math.sin(s.time * 1.1 + s.phase) * 0.05;
      halo.rotation.z += dt * (s.healing ? 5 : 1.2);
      haloMat.emissiveIntensity = s.healing ? 2.4 : 1.2;
      emitterMat.emissiveIntensity = s.healing ? 3 + Math.sin(s.time * 20) : 0.6;
      glow.material.opacity = s.healing ? 0.8 : 0.2;
      emitter.rotation.y += dt * 3;
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      bar.face(s.camera);
    },
  };
}

// ================================================================================================================
// Kit versions (Blender). Same builder API, same state objects and named parts as the plain builders above.
// ================================================================================================================

// ---------------------------------------------------------------- Hugger (kit)
// Telegraph: three coil rings on each forearm light from the elbow to the claw while the arms spread; at the lunge the claw
// tips and thrusters go white-hot.
export function buildHugger(brand) {
  if (!XKIT) return buildHuggerBasic(brand);
  const root = new THREE.Group();
  const face = 0.62;
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);
  const { flashMat } = logoFace(brand, body, face, 0.12);
  const { root: k, mats } = cloneKit(XKIT.hugger, ["coil_glow", "vent_glow", "lens_red"]);
  body.add(k);
  const r = face * 0.52;
  const alertMat = emissive(P.danger, 0);
  mesh(new THREE.TorusGeometry(r * 1.12, 0.03, 6, 36), alertMat, body, 0, 0, -0.07);
  const flare = glowSprite(P.hfOrange, 0.9, 0.5);
  flare.position.set(0, -0.42, -0.85);
  body.add(flare);
  const arms = ["l", "r"].map((n) => {
    const shoulder = k.getObjectByName("arm_" + n);
    const fore = shoulder.getObjectByName("fore_" + n);
    const rings = [];
    fore.traverse((o) => o.name.startsWith("coil_ring") && rings.push(o));
    rings.sort((a, b) => a.position.z - b.position.z);
    return { shoulder, fore, s: n === "l" ? -1 : 1, rings: rings.map((o) => o.material) };
  });
  const tipMats = (mats.coil_glow || []).filter((m) => !arms.some((a) => a.rings.includes(m)));
  const ventMats = mats.vent_glow || [];
  root.add(blobShadow(0.5, 0.5));
  const bar = healthBar(root, 1.75, 0.7);
  return {
    root,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      alertMat.dispose();
      flare.material.dispose();
      for (const list of Object.values(mats)) list.forEach((m) => m.dispose());
      bar.dispose();
    },
    update(dt, s) {
      const w = s.windup || 0;
      body.position.y = 0.95 + Math.sin(s.time * 6 + s.phase) * 0.04 - w * 0.18;
      body.rotation.x = THREE.MathUtils.damp(body.rotation.x, s.lunging ? 0.35 : s.moving ? 0.18 : -w * 0.25, 10, dt);
      body.rotation.z = s.stagger > 0 ? Math.sin(s.time * 32) * 0.22 : 0;
      const charge = s.lunging ? 1 : w;
      for (const a of arms) {
        const spread = s.lunging ? -0.15 : 0.35 + w * 0.9;
        a.shoulder.rotation.y = THREE.MathUtils.damp(a.shoulder.rotation.y, a.s * spread, 14, dt);
        a.fore.rotation.y = THREE.MathUtils.damp(a.fore.rotation.y, -a.s * (s.lunging ? 1.1 : 0.5), 14, dt);
        driveRings(a.rings, charge, 0, s.time);
      }
      const tip = THREE.MathUtils.clamp((charge - 0.6) / 0.4, 0, 1);
      for (const m of tipMats) {
        m.emissive.copy(COLD).lerp(HOT, tip);
        m.emissiveIntensity = 0.4 + tip * 4.5;
      }
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      alertMat.emissiveIntensity = w > 0 || s.lunging ? 2.5 + Math.sin(s.time * 40) * 1.5 : 0;
      for (const m of ventMats) m.emissiveIntensity = s.lunging ? 4.5 : 1.5 + (s.moving ? 0.8 : 0) + w * 1.2;
      flare.material.opacity = s.lunging ? 0.9 : 0.35 + w * 0.3;
      flare.scale.setScalar(s.lunging ? 1.8 : 0.9);
      bar.face(s.camera);
    },
  };
}

// ---------------------------------------------------------------- Warden (kit)
// Telegraph: five coil rings on the beam cannon charge toward the muzzle while the lens heats up. Weak point: the back hatch
// (hazard ring, four chevrons, orange core seen through a louvred slit). Venting slides the shutters away.
export function buildWarden(brand) {
  if (!XKIT) return buildWardenBasic(brand);
  const root = new THREE.Group();
  const face = 1.25;
  const { root: k, mats } = cloneKit(XKIT.warden, ["coil_glow", "core_glow", "core_ring_glow", "lens_red"]);
  root.add(k);
  const head = k.getObjectByName("head");
  const { flashMat } = logoFace(brand, head, face, 0.2);
  const collar = k.getObjectByName("collar");
  const projector = k.getObjectByName("projector");
  const rings = [];
  projector.traverse((o) => o.name.startsWith("coil_ring") && o.parent === projector && o.position.x === 0 && rings.push(o));
  rings.sort((a, b) => a.position.z - b.position.z);
  const ringMats = rings.map((o) => o.material);
  const capMats = [];
  projector.traverse((o) => o.name.startsWith("coil_ring") && !rings.includes(o) && capMats.push(o.material));
  const lensMats = mats.lens_red || [];
  const coreMat = mats.core_glow[0];
  const coreRingMats = mats.core_ring_glow || [];
  const shutters = ["l", "r"].map((n) => ({ node: k.getObjectByName("shutter_" + n), s: n === "l" ? -1 : 1 }));
  for (const sh of shutters) sh.x0 = sh.node.position.x;
  const charge = glowSprite(P.danger, 0.5, 0);
  charge.position.set(0, 0, 0.7);
  projector.add(charge);
  const coreGlow = glowSprite(P.hfOrange, 1.4, 0.5);
  coreGlow.position.set(0, 0, -1.2);
  head.add(coreGlow);
  root.add(blobShadow(1.3, 0.6));
  const bar = healthBar(root, 2.9, 1.6);
  return {
    root,
    head,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      charge.material.dispose();
      coreGlow.material.dispose();
      for (const list of Object.values(mats)) list.forEach((m) => m.dispose());
      bar.dispose();
    },
    update(dt, s) {
      const c = s.charge || 0;
      head.position.y = 1.6 - (s.stagger > 0 ? 0.08 : 0);
      head.rotation.z = s.stagger > 0 ? Math.sin(s.time * 30) * 0.06 : 0;
      head.rotation.x = THREE.MathUtils.damp(head.rotation.x, -(s.aimPitch || 0), 6, dt);
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      const ch = s.firing ? 1 : c;
      driveRings(ringMats, ch, 0, s.time);
      for (const m of capMats) {
        m.emissive.copy(COLD).lerp(HOT, ch * 0.8);
        m.emissiveIntensity = 0.3 + ch * 2.6;
      }
      for (const m of lensMats) m.emissiveIntensity = s.firing ? 5 : 0.6 + c * 4;
      charge.material.opacity = s.firing ? 1 : c * 0.9;
      charge.scale.setScalar(s.firing ? 1.4 + Math.sin(s.time * 40) * 0.2 : 0.3 + c * 0.9);
      const open = s.venting || s.stagger > 0;
      const pulse = Math.sin(s.time * 12);
      coreMat.emissiveIntensity = open ? 5.5 + pulse * 1.2 : 2.4 + Math.sin(s.time * 2.4 + s.phase) * 0.5;
      for (const m of coreRingMats) m.emissiveIntensity = open ? 4 + pulse : 1.6;
      coreGlow.material.opacity = open ? 0.95 : 0.4;
      coreGlow.scale.setScalar(open ? 2.4 : 1.3);
      for (const sh of shutters) sh.node.position.x = THREE.MathUtils.damp(sh.node.position.x, sh.s * (open ? 0.82 : 0.3), 10, dt);
      collar.rotation.z += dt * (s.firing ? 4 : 0.3);
      bar.face(s.camera);
    },
  };
}

// ---------------------------------------------------------------- Maintainer (kit)
// Telegraph: three coil rings around the emitter crystal chase toward the tip while it heals; the service halo spins up.
export function buildMaintainer(brand) {
  if (!XKIT) return buildMaintainerBasic(brand);
  const root = new THREE.Group();
  const face = 0.7;
  const body = new THREE.Group();
  body.position.y = 2.3;
  root.add(body);
  const { flashMat } = logoFace(brand, body, face, 0.12);
  const { root: k, mats } = cloneKit(XKIT.maintainer, ["coil_glow", "emit_glow", "halo_glow", "vent_glow"]);
  body.add(k);
  const halo = k.getObjectByName("halo");
  const emitter = k.getObjectByName("emitter");
  const rings = [];
  emitter.traverse((o) => o.name.startsWith("coil_ring") && rings.push(o));
  rings.sort((a, b) => b.position.y - a.position.y); // top ring (near the stalk) first, the chase runs down to the tip
  const ringMats = rings.map((o) => o.material);
  const emitMats = mats.emit_glow || [];
  const haloMats = mats.halo_glow || [];
  const ventMats = mats.vent_glow || [];
  const r = face * 0.52;
  const glow = glowSprite(P.hfYellow, 0.6, 0.2);
  glow.position.copy(emitter.position);
  body.add(glow);
  const cone = new THREE.Mesh(
    once("x.cone", () => new THREE.CylinderGeometry(0.03, 0.16, 0.7, 12, 1, true)),
    additive(P.hfOrange, 0.35, beamTexture()),
  );
  cone.rotation.x = Math.PI;
  cone.position.set(0, -r - 1.05, -0.05);
  body.add(cone);
  root.add(blobShadow(0.45, 0.35));
  const bar = healthBar(root, 3.2, 0.8);
  let heal = 0;
  return {
    root,
    emitter,
    setHealth: bar.set,
    dispose() {
      flashMat.dispose();
      glow.material.dispose();
      cone.material.dispose();
      for (const list of Object.values(mats)) list.forEach((m) => m.dispose());
      bar.dispose();
    },
    update(dt, s) {
      body.position.y = 2.3 + Math.sin(s.time * 1.8 + s.phase) * 0.12 - (s.stagger > 0 ? 0.25 : 0);
      body.rotation.z = s.stagger > 0 ? Math.sin(s.time * 26) * 0.2 : Math.sin(s.time * 1.1 + s.phase) * 0.05;
      halo.rotation.y += dt * (s.healing ? 5 : 1.2);
      emitter.rotation.y += dt * 3;
      heal = THREE.MathUtils.damp(heal, s.healing ? 1 : 0, 8, dt);
      const n = ringMats.length;
      for (let i = 0; i < n; i++) {
        const lit = heal * (0.45 + 0.55 * Math.max(0, Math.sin(s.time * 9 - i * 1.5)));
        const m = ringMats[i];
        m.emissive.copy(COLD).lerp(HOT, lit * lit);
        m.emissiveIntensity = 0.3 + lit * 3.4;
      }
      for (const m of emitMats) m.emissiveIntensity = 0.7 + heal * (2.3 + Math.sin(s.time * 20));
      for (const m of haloMats) m.emissiveIntensity = 1.0 + heal * 1.4;
      for (const m of ventMats) m.emissiveIntensity = 1.3 + (s.moving ? 1.0 : 0) + Math.sin(s.time * 14 + s.phase) * 0.2;
      glow.material.opacity = 0.2 + heal * 0.6;
      flashMat.opacity = Math.min(0.9, (s.flash || 0) * 7);
      bar.face(s.camera);
    },
  };
}
