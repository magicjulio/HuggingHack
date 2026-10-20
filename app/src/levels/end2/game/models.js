import * as THREE from "three";
import { asset } from "./assets.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
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
  starTexture,
  logoMaterials,
  LOGO_FACE,
  canvas,
  texture,
  hazardStripes,
} from "./art.js";

// Every model is built facing its gameplay forward: the player looks down −Z
// (camera yaw 0), actors look down +Z (their yaw is atan2(dx, dz)). Roots are at
// the feet. Each builder returns { root, update(dt, state) } plus named parts.

const shared = new Map();
function once(key, make) {
  if (!shared.has(key)) shared.set(key, make());
  return shared.get(key);
}

// ---------------------------------------------------------------- glb kit
// The defenders' gun and shield come from Blender (design/3d/end2/characters/defender_kit.py). The glb is
// loaded once at import (top-level await); if it is missing, buildDefender falls back to the plain procedural
// pieces below so the game still runs.
let KIT = null;
export async function loadCharacterKit(url = asset("end2-char-defender-kit.glb")) {
  const gltf = await new GLTFLoader().loadAsync(url);
  KIT = {
    gun: gltf.scene.getObjectByName("gun"),
    shield: gltf.scene.getObjectByName("shield"),
  };
  return KIT;
}
try {
  await loadCharacterKit();
} catch (err) {
  console.warn("[ascent] defender kit not loaded, using the procedural weapons", err);
}
export const hasCharacterKit = () => !!KIT;
// Clone a kit piece. Geometry and the worn PBR materials stay shared; materials whose name is in `own` get a
// private copy per instance so each defender can drive its own glow.
function cloneKit(piece, own) {
  const root = piece.clone(true);
  const mats = {};
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = true;
    if (own.includes(o.material.name)) {
      const m = o.material.clone();
      (mats[m.name] ||= []).push(m);
      o.material = m;
    }
  });
  return { root, mats };
}

// The glossy logo badge (clearcoat) used to pick up the whole bright environment room and look veiled in white. Give its
// materials an explicit, much dimmer environment map the first time they are rendered (the scene's environment is only
// known at render time). Colours and the logo texture are untouched.
export function tameLogoEnv(badge, mats, intensity = 0.15) {
  badge.onBeforeRender = (renderer, scene) => {
    if (mats.__env || !scene.environment) return;
    mats.__env = true;
    for (const m of mats) {
      m.envMap = scene.environment;
      m.envMapIntensity = intensity;
      m.needsUpdate = true;
    }
  };
}

// Hard-light panel for the shield-bearer: hex cells, scan band, emitter rim, hit ripples, dissolve when open.
function hardLightMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      time: { value: 0 },
      open: { value: 0 },
      flash: { value: 0 },
      color: { value: new THREE.Color(P.hfAmber) },
      rp: { value: [new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0), new THREE.Vector4(0, 0, -1, 0)] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){
        vUv = uv;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform float open; uniform float flash; uniform vec3 color; uniform vec4 rp[3];
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      const vec2 SIZE = vec2(1.3, 1.35);              // pane size in metres
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      void main(){
        vec2 pm = vUv * SIZE / 0.115;                   // hex units
        vec2 r = vec2(1.0, 1.7320508);
        vec2 a = mod(pm, r) - r * 0.5;
        vec2 b = mod(pm - r * 0.5, r) - r * 0.5;
        vec2 g = dot(a, a) < dot(b, b) ? a : b;
        vec2 cell = (pm - g) * 0.115 / SIZE;            // cell centre in uv
        vec2 q = abs(g);
        float hd = max(dot(q, vec2(0.5, 0.8660254)), q.x);
        float edge = smoothstep(0.40, 0.47, hd);
        float rnd = hash(floor((pm - g) * 7.0));
        float shimmer = 0.5 + 0.5 * sin(time * 1.7 + rnd * 20.0);
        float scan = clamp(1.0 - abs(fract(vUv.y * 0.8 - time * 0.2) - 0.5) * 5.0, 0.0, 1.0);
        vec3 n = normalize(vN);
        float fr = pow(clamp(1.0 - abs(dot(n, normalize(vV))), 0.0, 1.0), 2.0);
        float bd = min(min(vUv.x, 1.0 - vUv.x) * 1.3, min(vUv.y, 1.0 - vUv.y) * 1.35);
        float rim = 1.0 - smoothstep(0.0, 0.07, bd);
        // dissolve: cells vanish from the far edge when the shield opens
        float cut = open * 1.5 - 0.25;
        float vis = smoothstep(cut - 0.2, cut, (1.0 - vUv.x) * 0.9 + rnd * 0.4 - 0.1);
        vis = open < 0.01 ? 1.0 : vis;
        float rip = 0.0, cellLit = 0.0;
        for (int i = 0; i < 3; i++) {
          vec4 h = rp[i];
          if (h.z >= 0.0) {
            float age = h.z;
            float fade = clamp(1.0 - age / 0.55, 0.0, 1.0) * h.w;
            float dd = length((vUv - h.xy) * SIZE);
            float x = (dd - age * 3.0) / 0.09;
            rip += exp(-x * x) * fade;
            float dc = length((cell - h.xy) * SIZE);
            cellLit += exp(-dc * 4.5) * fade;
          }
        }
        float lines = edge * (0.5 + 0.5 * shimmer * 0.6);
        float alpha = (0.09 + lines * 0.3 + scan * 0.1 + fr * 0.3 + rim * 0.5) * vis;
        alpha += cellLit * 0.45 + rip * 0.6 + flash * 0.55;
        vec3 col = color * (0.8 + lines * 1.1 + scan * 0.6 + rim * 1.6);
        col = mix(col, vec3(1.0, 0.93, 0.72) * 2.0, clamp(cellLit * 0.7 + rip * 0.8 + flash * 0.8, 0.0, 1.0));
        col *= gl_FrontFacing ? 1.0 : 0.7;
        gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
      }`,
  });
}
// Ground read for "this side is covered": an amber fan on the floor in front of the shield-bearer.
function coverArcMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { time: { value: 0 }, amount: { value: 1 }, color: { value: new THREE.Color(P.hfAmber) } },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform float amount; uniform vec3 color; varying vec2 vP;
      void main(){
        float r = length(vP);
        float ang = atan(vP.x, vP.y);                    // 0 = straight ahead (+z of the defender)
        float side = clamp(abs(ang) / 1.265, 0.0, 1.0);
        float radial = smoothstep(0.9, 1.25, r) * (1.0 - smoothstep(2.2, 3.1, r));
        float rimLine = smoothstep(0.93, 1.0, side) * 0.9;                 // the two edges of the cover
        float chev = pow(clamp(0.5 + 0.5 * sin((r - side * 0.9) * 9.0 - time * 3.0), 0.0, 1.0), 3.0);
        float a = radial * (0.1 + chev * 0.12 * (1.0 - side)) + rimLine * radial * 0.3;
        a *= amount;
        gl_FragColor = vec4(color * 1.6, clamp(a, 0.0, 1.0));
      }`,
  });
}

// ---------------------------------------------------------------- orb core
// Swirling poisoned core: bright hack-green plasma eaten by darker veins, with a
// fresnel rim so the sphere still reads as glass at a distance.
export function orbMaterial(color = P.hack, deep = P.poisonDeep, power = 1.3) {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: new THREE.Color(color) },
      deep: { value: new THREE.Color(deep) },
      power: { value: power },
      pulse: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        vP = position;
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 color; uniform vec3 deep; uniform float power; uniform float pulse;
      varying vec3 vN; varying vec3 vV; varying vec3 vP;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      float n(vec3 p){ vec3 i=floor(p); vec3 f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){
        vec3 p = normalize(vP) * 2.6;
        float t = time * 0.6;
        float sw = n(p + vec3(t, -t*0.7, t*0.4)) * 0.6 + n(p*2.3 - vec3(0, t*1.3, 0)) * 0.4;
        float veins = smoothstep(0.42, 0.5, sw) - smoothstep(0.5, 0.6, sw);
        float fres = pow(clamp(1.0 - dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.2);
        vec3 c = mix(deep, color, smoothstep(0.25, 0.75, sw));
        c = mix(c, deep * 0.4, veins * 0.8);
        c += color * fres * 1.6;
        c *= power * (1.0 + pulse);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

// ---------------------------------------------------------------- rifle
// Pulse rifle, muzzle down −Z. `heat` 0..1 drives the coils green → amber → red.
export function buildRifle() {
  const g = new THREE.Group();
  const body = once("rifle.body", () => metal(0x2b3440, 0.42, 0.75));
  const plate = once("rifle.plate", () => armour(0xc9d2d9, 0.45, 0.4));
  const grip = once("rifle.grip", () => metal(0x12171d, 0.7, 0.3));
  const coilMat = emissive(P.hack, 2);
  const sightMat = emissive(P.hack, 4, { side: THREE.DoubleSide });
  mesh(rbox(0.12, 0.17, 0.52, 0.03), body, g, 0, 0, 0.02);
  mesh(rbox(0.13, 0.08, 0.36, 0.025), plate, g, 0, 0.1, 0.05);
  mesh(rbox(0.06, 0.16, 0.08, 0.02), grip, g, 0, -0.14, 0.12).rotation.x = -0.25;
  // Stock.
  const stock = mesh(rbox(0.07, 0.14, 0.3, 0.025), body, g, 0, -0.03, 0.4);
  stock.rotation.x = 0.1;
  mesh(rbox(0.09, 0.18, 0.06, 0.02), grip, g, 0, -0.05, 0.56);
  // Energy cell, visible from the shoulder camera.
  const cell = mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.2, 12),
    emissive(P.hack, 2.2),
    g,
    0.07,
    -0.02,
    0.12,
  );
  cell.rotation.x = Math.PI / 2;
  // Barrel shroud and coils.
  const shroud = mesh(
    new THREE.CylinderGeometry(0.055, 0.065, 0.42, 14),
    body,
    g,
    0,
    0.01,
    -0.42,
  );
  shroud.rotation.x = Math.PI / 2;
  const coils = [];
  for (let i = 0; i < 3; i++) {
    const c = mesh(
      new THREE.TorusGeometry(0.066, 0.014, 6, 18),
      coilMat,
      g,
      0,
      0.01,
      -0.3 - i * 0.1,
    );
    coils.push(c);
  }
  const muzzle = mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.12, 10),
    grip,
    g,
    0,
    0.01,
    -0.68,
  );
  muzzle.rotation.x = Math.PI / 2;
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.01, -0.76);
  g.add(tip);
  // Holo sight: frame + reticle pane.
  mesh(rbox(0.05, 0.03, 0.12, 0.01), grip, g, 0, 0.16, -0.06);
  const frame = mesh(
    new THREE.TorusGeometry(0.035, 0.008, 6, 16),
    body,
    g,
    0,
    0.21,
    -0.08,
  );
  frame.scale.y = 0.8;
  const pane = mesh(new THREE.CircleGeometry(0.008, 10), sightMat, g, 0, 0.21, -0.08);
  // Side vents glow with heat.
  const ventMat = emissive(P.hfOrange, 0);
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++)
      mesh(rbox(0.01, 0.025, 0.07, 0.004), ventMat, g, s * 0.062, 0.03, -0.12 - i * 0.05);
  const flash = glowSprite(0xd8ffb0, 0.5, 0, starTexture());
  flash.position.copy(tip.position);
  g.add(flash);
  const cold = new THREE.Color(P.hack),
    warm = new THREE.Color(P.hfOrange),
    hot = new THREE.Color(P.danger);
  return {
    root: g,
    tip,
    flash,
    update(dt, { heat = 0, firing = 0, time = 0 }) {
      const c =
        heat < 0.6
          ? cold.clone().lerp(warm, heat / 0.6)
          : warm.clone().lerp(hot, (heat - 0.6) / 0.4);
      coilMat.emissive.copy(c);
      coilMat.emissiveIntensity = 1.6 + heat * 2.5 + firing * 2;
      ventMat.emissiveIntensity = heat * heat * 5 * (0.8 + Math.sin(time * 20) * 0.2);
      flash.material.opacity = firing;
      flash.material.rotation = Math.random() * Math.PI;
      flash.scale.setScalar(0.35 + firing * 0.45);
    },
  };
}

// ---------------------------------------------------------------- player
// KAM1196A: a lean armoured biped whose head is the poisoned orb. Built for the
// over-the-shoulder view, so the back carries the most detail.
export function buildPlayer() {
  const root = new THREE.Group();
  const shell = armour(0xb7c2ca, 0.48, 0.5);
  const dark = metal(0x1d252f, 0.5, 0.7);
  const joint = metal(0x0f1419, 0.6, 0.5);
  const lime = emissive(P.hack, 1.8);
  const poisonMat = emissive(P.poison, 1.6);
  const heatMat = emissive(P.hfOrange, 0);

  const hips = new THREE.Group();
  hips.position.y = 0.93;
  root.add(hips);
  mesh(rbox(0.42, 0.16, 0.28, 0.05), dark, hips, 0, 0, 0);
  mesh(rbox(0.36, 0.06, 0.3, 0.02), lime, hips, 0, 0.08, 0).scale.set(1, 0.4, 1.02);

  function leg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.14, -0.04, 0);
    hips.add(hip);
    mesh(new THREE.SphereGeometry(0.085, 12, 8), joint, hip);
    mesh(rbox(0.17, 0.4, 0.2, 0.05), shell, hip, 0, -0.22, 0);
    mesh(rbox(0.19, 0.12, 0.08, 0.03), dark, hip, 0, -0.18, -0.11);
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    mesh(new THREE.SphereGeometry(0.075, 10, 8), joint, knee);
    mesh(rbox(0.14, 0.13, 0.08, 0.03), shell, knee, 0, 0, -0.07);
    mesh(rbox(0.14, 0.38, 0.17, 0.04), dark, knee, 0, -0.2, 0.01);
    mesh(rbox(0.15, 0.24, 0.07, 0.03), shell, knee, 0, -0.17, -0.07);
    const foot = mesh(rbox(0.16, 0.08, 0.3, 0.03), dark, knee, 0, -0.43, -0.05);
    mesh(rbox(0.1, 0.012, 0.05, 0.005), lime, foot, 0, 0.02, 0.15);
    return { hip, knee };
  }
  const legL = leg(-1),
    legR = leg(1);

  const torso = new THREE.Group();
  torso.position.y = 0.95;
  root.add(torso);
  mesh(rbox(0.34, 0.2, 0.24, 0.05), dark, torso, 0, 0.13, 0);
  const chest = mesh(rbox(0.58, 0.36, 0.34, 0.08), shell, torso, 0, 0.38, 0);
  mesh(rbox(0.3, 0.16, 0.06, 0.03), dark, chest, 0, 0.02, -0.17);
  mesh(rbox(0.12, 0.02, 0.02, 0.01), lime, chest, 0, 0.06, -0.2);
  // Backpack: poison core window, heat vents and spine lights face the camera.
  const pack = new THREE.Group();
  pack.position.set(0, 0.36, 0.2);
  torso.add(pack);
  mesh(rbox(0.42, 0.42, 0.16, 0.05), dark, pack);
  mesh(rbox(0.26, 0.3, 0.05, 0.03), shell, pack, 0, 0.02, 0.07);
  const core = mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16),
    orbMaterial(P.hack, P.poisonDeep, 1.1),
    pack,
    0,
    0.04,
    0.1,
  );
  core.rotation.x = Math.PI / 2;
  mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 20), joint, pack, 0, 0.04, 0.115);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 4; i++)
      mesh(rbox(0.07, 0.016, 0.02, 0.006), heatMat, pack, s * 0.165, 0.12 - i * 0.05, 0.08);
    mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 10), dark, pack, s * 0.15, -0.24, 0.02);
  }
  for (let i = 0; i < 3; i++)
    mesh(rbox(0.05, 0.02, 0.02, 0.006), poisonMat, pack, 0, -0.1 - i * 0.04, 0.095);
  // Shoulders.
  for (const s of [-1, 1]) {
    const p = mesh(rbox(0.22, 0.14, 0.28, 0.06), shell, torso, s * 0.36, 0.53, 0);
    p.rotation.z = s * -0.25;
    mesh(rbox(0.16, 0.012, 0.22, 0.005), lime, p, 0, 0.072, 0).visible = s > 0;
  }
  // Collar and head.
  mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.08, 16), dark, torso, 0, 0.59, 0);
  const head = new THREE.Group();
  head.position.y = 0.76;
  torso.add(head);
  const orbMat = orbMaterial(P.hack, P.poisonDeep, 1.35);
  const orb = mesh(new THREE.SphereGeometry(0.17, 32, 20), orbMat, head);
  const halo = glowSprite(P.hack, 0.75, 0.2);
  head.add(halo);
  // Cage ribs hold the orb.
  for (let i = 0; i < 3; i++) {
    const rib = mesh(
      new THREE.TorusGeometry(0.2, 0.014, 6, 24, Math.PI * 1.1),
      dark,
      head,
    );
    rib.rotation.set(0, (i * Math.PI) / 3, Math.PI / 2 - 0.05 * Math.PI);
  }
  mesh(new THREE.TorusGeometry(0.19, 0.022, 8, 28), joint, head, 0, -0.1, 0).rotation.x = Math.PI / 2;

  // Arms + rifle pivot at the shoulder line and follow pitch.
  const aimRig = new THREE.Group();
  aimRig.position.set(0, 1.43, 0);
  root.add(aimRig);
  const rifle = buildRifle();
  rifle.root.position.set(0.24, -0.12, -0.32);
  aimRig.add(rifle.root);
  const arm = (from, to, parent, thick = 0.07) => {
    const a = new THREE.Vector3(...from),
      b = new THREE.Vector3(...to);
    const len = a.distanceTo(b);
    const m = mesh(rbox(thick, len, thick * 1.1, 0.03), shell, parent);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      b.clone().sub(a).normalize(),
    );
    return m;
  };
  arm([0.36, 0.0, 0], [0.33, -0.24, -0.05], aimRig, 0.1);
  arm([0.33, -0.24, -0.05], [0.25, -0.2, -0.24], aimRig, 0.085);
  mesh(new THREE.SphereGeometry(0.05, 8, 6), joint, aimRig, 0.33, -0.24, -0.05);
  arm([-0.36, 0.0, 0], [-0.25, -0.24, -0.22], aimRig, 0.1);
  arm([-0.25, -0.24, -0.22], [0.2, -0.15, -0.55], aimRig, 0.085);
  mesh(new THREE.SphereGeometry(0.05, 8, 6), joint, aimRig, -0.25, -0.24, -0.22);
  mesh(rbox(0.09, 0.08, 0.1, 0.03), dark, aimRig, 0.21, -0.16, -0.57);

  const shadow = blobShadow(0.55, 0.6);
  root.add(shadow);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.56, 48),
    additive(P.hack, 0.35, null),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.025;
  root.add(ring);

  let walk = 0,
    crouchT = 0,
    recoil = 0;
  return {
    root,
    rifle,
    muzzle: rifle.tip,
    aimRig,
    orb,
    update(dt, s) {
      // s: { speed, crouch, pitch, heat, firing, dodge, time, health, hurt }
      walk += dt * (s.speed > 6 ? 13 : 9.5) * Math.min(1, s.speed / 2);
      crouchT = THREE.MathUtils.damp(crouchT, s.crouch ? 1 : 0, 14, dt);
      if (s.firing > 0.9) recoil = 1;
      recoil = Math.max(0, recoil - dt * 12);
      const amp = Math.min(1, s.speed / 5);
      const sw = Math.sin(walk) * 0.55 * amp;
      // Crouch folds hips and knees instead of squashing the mesh.
      const drop = crouchT * 0.4;
      hips.position.y = 0.93 - drop + Math.abs(Math.cos(walk)) * 0.04 * amp;
      torso.position.y = hips.position.y + 0.02;
      torso.rotation.x = -crouchT * 0.22 - amp * 0.08;
      aimRig.position.y = 1.43 - drop * 0.9;
      for (const [l, k] of [
        [legL, 1],
        [legR, -1],
      ]) {
        l.hip.rotation.x = sw * k - crouchT * 0.95;
        l.knee.rotation.x = Math.max(0, -Math.sin(walk + (k > 0 ? 0 : Math.PI)) * 0.9 * amp) + crouchT * 1.7;
      }
      legL.hip.rotation.z = crouchT * 0.12;
      legR.hip.rotation.z = -crouchT * 0.12;
      aimRig.rotation.x = s.pitch;
      rifle.root.position.z = -0.32 + recoil * 0.06;
      rifle.root.rotation.x = recoil * 0.05;
      root.rotation.z = THREE.MathUtils.damp(root.rotation.z, s.dodge ? -0.35 : 0, 12, dt);
      orbMat.uniforms.time.value = s.time;
      orbMat.uniforms.pulse.value = (s.hurt || 0) * 1.5 + (s.firing || 0) * 0.15;
      core.material.uniforms.time.value = s.time * 1.3;
      heatMat.emissiveIntensity = (s.heat || 0) ** 2 * 6;
      halo.material.opacity = 0.16 + (s.hurt || 0) * 0.5;
      ring.material.opacity = 0.18 + Math.sin(s.time * 3) * 0.06;
      rifle.update(dt, s);
    },
  };
}

// ---------------------------------------------------------------- defenders
// Hugging Face defenders are the official logo, extruded into a thick glossy
// badge, riding a gunmetal hover-hull. The hands of the logo hold the weapon.
export function buildDefender(brand, kind = "gunner") {
  const root = new THREE.Group();
  const face = kind === "shield" ? 1.0 : 0.88;
  const badgeMats = once("def.badge", () => logoMaterials(brand));
  const hullMat = once("def.hull", () => armour(0x2a3340, 0.42, 0.75));
  const trimMat = once("def.trim", () => metal(P.hfYellow, 0.35, 0.4));
  const darkMat = once("def.dark", () => metal(0x11161c, 0.55, 0.6));
  const ventMat = emissive(P.hfOrange, 2);
  const alertMat = emissive(P.danger, 0, { transparent: true });

  const hover = new THREE.Group();
  hover.position.y = 1.38;
  root.add(hover);
  const badge = mesh(brand.badge({ face, depth: 0.2, bevel: 0.045 }), badgeMats, hover, 0, 0, 0.16);
  tameLogoEnv(badge, badgeMats);
  // Hit flash: an additive copy of the badge.
  const flashMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const flash = mesh(badge.geometry, flashMat, hover, 0, 0, 0.165);
  flash.scale.setScalar(1.01);
  // Hull dome behind the logo.
  const r = face * 0.52;
  const hull = mesh(
    new THREE.SphereGeometry(r, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    hullMat,
    hover,
    0,
    0,
    -0.02,
  );
  hull.rotation.x = -Math.PI / 2;
  hull.scale.set(1, 0.85, 1);
  mesh(new THREE.TorusGeometry(r * 1.0, 0.035, 8, 40), trimMat, hover, 0, 0, -0.03);
  // Alert ring: lights red while the defender is lining up a burst.
  const alert = mesh(new THREE.TorusGeometry(r * 1.08, 0.025, 6, 48), alertMat, hover, 0, 0, -0.06);
  // Rear core: the glowing vent you see when flanking.
  const vent = mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.45, 0.06, 20), ventMat, hover, 0, 0.02, -r * 0.84);
  vent.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) {
    const fin = mesh(rbox(r * 0.95, 0.03, 0.05, 0.01), darkMat, hover, 0, 0.02, -r * 0.88);
    fin.rotation.z = (i * Math.PI) / 4;
  }
  const ventGlow = glowSprite(P.hfOrange, 0.8, 0.45);
  ventGlow.position.set(0, 0.02, -r * 0.95);
  hover.add(ventGlow);
  // Head fins give the silhouette a helmet line above the face.
  for (const s of [-1, 1]) {
    const fin = mesh(rbox(0.06, 0.3, 0.32, 0.025), hullMat, hover, s * r * 0.58, r * 0.72, -0.12);
    fin.rotation.z = s * -0.45;
    mesh(rbox(0.065, 0.2, 0.02, 0.008), trimMat, fin, 0, 0.02, 0.15);
  }
  // Hover thruster.
  const thruster = new THREE.Group();
  thruster.position.y = -r * 0.95;
  hover.add(thruster);
  mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.2, 16), darkMat, thruster, 0, 0, -0.08);
  mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 24), ventMat, thruster, 0, -0.1, -0.08).rotation.x = Math.PI / 2;
  const cone = new THREE.Mesh(
    once("def.cone", () => new THREE.CylinderGeometry(0.05, 0.24, 0.9, 16, 1, true)),
    additive(P.hfOrange, 0.55, beamTexture()),
  );
  cone.rotation.x = Math.PI;
  cone.position.set(0, -0.55, -0.08);
  thruster.add(cone);
  const pool = new THREE.Mesh(
    once("def.pool", () => new THREE.CircleGeometry(0.75, 24)),
    additive(P.hfOrange, 0.3),
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.03;
  root.add(pool);
  root.add(blobShadow(0.6, 0.55));

  // Weapon in the logo's right hand (viewer's left).
  let gun = null,
    muzzle = null,
    charge = null,
    shield = null,
    pane = null;
  const handX = face * 0.42,
    handY = -face * 0.46;
  let gunRig = null,
    shieldRig = null;
  if (kind === "gunner" && KIT) {
    // Breacher blaster from the glb: worn yellow/gunmetal, sliding barrel, four coil rings that charge toward the muzzle.
    const { root: g } = cloneKit(KIT.gun, ["coil_glow", "muzzle_glow", "cell_glow", "lens_red"]);
    g.scale.setScalar(1.12);
    gun = new THREE.Group();
    gun.position.set(-0.06, -0.3, 0.4);
    gun.add(g);
    hover.add(gun);
    muzzle = g.getObjectByName("muzzle");
    const barrelNode = g.getObjectByName("barrel");
    const rings = [];
    g.traverse((o) => o.name.startsWith("coil_ring") && rings.push(o));
    rings.sort((a, b) => a.position.z - b.position.z);
    gunRig = {
      g,
      barrelNode,
      barrelZ: barrelNode.position.z,
      ringMats: rings.map((o) => o.material),
      capMat: g.getObjectByName("coil_coil_glow").material,
      muzzleMat: g.getObjectByName("barrel_muzzle_glow").material,
      cellMat: g.getObjectByName("cell_cell_glow").material,
      lensMat: g.getObjectByName("body_lens_red").material,
      charge: 0,
      kick: 0,
      cold: new THREE.Color(0xff6a14),
      hot: new THREE.Color(0xfff0c0),
    };
    charge = glowSprite(0xff7a2a, 0.1, 0);
    muzzle.add(charge);
  } else if (kind === "gunner") {
    gun = new THREE.Group();
    gun.position.set(-handX, handY, 0.32);
    hover.add(gun);
    mesh(rbox(0.16, 0.2, 0.62, 0.04), darkMat, gun, 0, 0, 0.12);
    mesh(rbox(0.17, 0.05, 0.4, 0.02), trimMat, gun, 0, 0.09, 0.1);
    const barrel = mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.34, 12), darkMat, gun, 0, 0.01, 0.55);
    barrel.rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(0.06, 0.016, 6, 16), ventMat, gun, 0, 0.01, 0.64);
    mesh(rbox(0.05, 0.14, 0.12, 0.02), darkMat, gun, 0, -0.14, 0.02);
    muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.01, 0.74);
    gun.add(muzzle);
    charge = glowSprite(P.danger, 0.1, 0);
    charge.position.copy(muzzle.position);
    gun.add(charge);
  } else if (KIT) {
    // Tower shield from the glb: armoured frame with emitters, a hard-light pane (shader) you can see the logo through.
    // The pivot sits on the hinge pin; during attack windows the frame swings out and the pane dissolves.
    const { root: sr } = cloneKit(KIT.shield, ["emit_glow", "emit_strip"]);
    const hinge = sr.getObjectByName("hinge");
    sr.position.copy(hinge.position).negate();
    shield = new THREE.Group();
    shield.position.set(hinge.position.x, -0.15, 0.58 + hinge.position.z);
    shield.add(sr);
    hover.add(shield);
    const paneMat = hardLightMaterial();
    sr.getObjectByName("pane").material = paneMat;
    const emitMats = [];
    sr.traverse((o) => o.isMesh && o.material.name.startsWith("emit_") && emitMats.push(o.material));
    const arcMat = coverArcMaterial();
    const arc = new THREE.Mesh(
      once("def.arcGeo", () => new THREE.RingGeometry(0.9, 3.4, 40, 1, -Math.PI / 2 - 1.265, 2.53).rotateX(-Math.PI / 2)),
      arcMat,
    );
    arc.position.y = 0.045;
    arc.renderOrder = -1;
    root.add(arc);
    shieldRig = {
      paneMat,
      emitMats,
      arcMat,
      open: 0,
      ripples: [0, 1, 2].map(() => ({ age: 9, slot: 0 })),
      next: 0,
    };
  } else {
    // Riot shield: amber hard-light pane in a hazard-striped frame, gripped by
    // both logo hands. It swings open on its right hinge during attacks.
    shield = new THREE.Group();
    shield.position.set(0.72, -0.15, 0.62);
    hover.add(shield);
    const paneGeo = once("def.paneGeo", () => {
      const g = new THREE.CylinderGeometry(1.6, 1.6, 1.75, 24, 1, true, -0.47, 0.94);
      g.rotateY(Math.PI);
      g.translate(0, 0, 1.6);
      return g;
    });
    const hexTex = once("def.hex", () => {
      const [c, g] = canvas(256);
      g.fillStyle = "#000";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#fff";
      g.lineWidth = 3;
      const R = 22;
      for (let row = -1; row < 9; row++)
        for (let col = -1; col < 8; col++) {
          const cx = col * R * 1.73 + (row % 2) * R * 0.866,
            cy = row * R * 1.5;
          g.beginPath();
          for (let k = 0; k < 6; k++) {
            const a = Math.PI / 6 + (k * Math.PI) / 3;
            g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
          }
          g.closePath();
          g.stroke();
        }
      const t = texture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(2, 2);
      return t;
    });
    const paneMat = new THREE.MeshBasicMaterial({
      color: P.hfAmber,
      map: hexTex,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const tintMat = new THREE.MeshBasicMaterial({
      color: 0x3a2500,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    pane = new THREE.Group();
    pane.position.x = -0.72;
    shield.add(pane);
    mesh(paneGeo, tintMat, pane);
    const paneGlow = mesh(paneGeo, paneMat, pane);
    // Frame: top/bottom bars and hazard side posts.
    const stripeMat = once("def.stripe", () => {
      const [c, g] = canvas(64, 256);
      hazardStripes(g, 0, 0, 64, 256, "#ffd21e", "#14181d");
      const t = texture(c);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.4 });
    });
    for (const s of [-1, 1]) {
      const post = mesh(rbox(0.09, 1.85, 0.12, 0.03), stripeMat, pane, s * 0.72, 0, -0.17);
      post.rotation.y = s * 0.45;
      const bar = mesh(rbox(1.5, 0.08, 0.1, 0.03), darkMat, pane, 0, s * 0.9, 0);
      bar.position.z = 0.0;
    }
    mesh(rbox(0.3, 0.1, 0.06, 0.02), ventMat, pane, 0, 0.9, 0.06);
    pane.userData = { paneMat, tintMat, paneGlow };
  }

  // Readable health: segmented bar billboarded to the camera.
  const bar = new THREE.Group();
  bar.position.y = 2.35;
  root.add(bar);
  const back = new THREE.Mesh(
    once("def.barGeo", () => new THREE.PlaneGeometry(1, 1)),
    once("def.barBack", () => new THREE.MeshBasicMaterial({ color: 0x0a0f16, transparent: true, opacity: 0.75, depthTest: false })),
  );
  back.scale.set(1.04, 0.12, 1);
  back.renderOrder = 10;
  bar.add(back);
  const fill = new THREE.Mesh(
    back.geometry,
    new THREE.MeshBasicMaterial({ color: P.hfYellow, depthTest: false, toneMapped: false }),
  );
  fill.scale.set(1, 0.07, 1);
  fill.renderOrder = 11;
  bar.add(fill);
  const lag = new THREE.Mesh(
    back.geometry,
    new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true, opacity: 0.7 }),
  );
  lag.scale.set(1, 0.07, 1);
  lag.renderOrder = 10.5;
  bar.add(lag);
  bar.visible = false;
  let lagValue = 1;

  return {
    root,
    hover,
    badge,
    gun,
    muzzle,
    shield,
    bar,
    setHealth(v) {
      fill.scale.x = Math.max(0.0001, v);
      fill.position.x = -(1 - v) / 2;
      bar.visible = true;
    },
    // One shot left the barrel: recoil kick (called by fx.muzzle).
    kick() {
      if (gunRig) gunRig.kick = 1;
    },
    // A shot hit the shield from world direction `dir` (enemy -> shooter, need not be normalised): lights the hex
    // cells around the impact point and sends a ring across the pane. Returns the world point of the impact.
    shieldRipple(dir, out = new THREE.Vector3()) {
      if (!shieldRig) return null;
      const yaw = root.rotation.y,
        c = Math.cos(yaw),
        sn = Math.sin(yaw);
      const lx = dir.x * c - dir.z * sn,
        lz = dir.x * sn + dir.z * c;
      const phi = Math.max(-1.2, Math.min(1.2, Math.atan2(lx, lz)));
      const x = Math.max(-0.6, Math.min(0.6, 0.58 * Math.tan(phi)));
      const len = Math.hypot(dir.x, dir.z) || 1;
      const v = 0.5 + Math.max(-0.38, Math.min(0.38, (dir.y / len) * 0.6)) + (Math.random() - 0.5) * 0.12;
      const i = shieldRig.next++ % 3;
      shieldRig.ripples[i].age = 0;
      shieldRig.paneMat.uniforms.rp.value[i].set(0.5 + x / 1.3, v, 0, 1);
      // world point on the pane
      out.set(x, -0.15 + (v - 0.5) * 1.35, 0.58 + 0.02 - (x * x) / 3.2);
      return hover.localToWorld(out);
    },
    dispose() {
      flashMat.dispose();
      alertMat.dispose();
      ventMat.dispose();
      fill.material.dispose();
      lag.material.dispose();
      cone.material.dispose();
      pool.material.dispose();
      ventGlow.material.dispose();
      if (charge) charge.material.dispose();
      if (pane) {
        pane.userData.paneMat.dispose();
        pane.userData.tintMat.dispose();
      }
      if (gunRig) [...gunRig.ringMats, gunRig.capMat, gunRig.muzzleMat, gunRig.cellMat, gunRig.lensMat].forEach((m) => m.dispose());
      if (shieldRig) [shieldRig.paneMat, shieldRig.arcMat, ...shieldRig.emitMats].forEach((m) => m.dispose());
    },
    // s: { time, phase, flash, windup(0..1), exposed, stagger, moving, camera, hp, highlight, shieldHit }
    update(dt, s) {
      const bob = Math.sin(s.time * 2.2 + s.phase) * 0.06;
      hover.position.y = 1.38 + bob - (s.stagger > 0 ? 0.12 : 0);
      hover.rotation.x = THREE.MathUtils.damp(hover.rotation.x, s.moving ? 0.12 : 0, 6, dt);
      hover.rotation.z =
        s.stagger > 0 ? Math.sin(s.time * 30) * 0.18 : Math.sin(s.time * 1.3 + s.phase) * 0.03;
      flashMat.opacity = Math.min(0.9, s.flash * 7);
      alertMat.emissiveIntensity = s.windup > 0 ? 2 + Math.sin(s.time * 40) * 1.5 : 0;
      ventMat.emissiveIntensity = 1.8 + Math.sin(s.time * 6 + s.phase) * 0.5;
      cone.scale.set(1, 0.9 + Math.sin(s.time * 25 + s.phase) * 0.1, 1);
      pool.material.opacity = 0.22 + bob;
      if (charge) {
        charge.material.opacity = s.windup > 0 ? 0.4 + s.windup * 0.6 : s.firing ? 0.9 : 0;
        charge.scale.setScalar(s.windup > 0 ? 0.15 + s.windup * 0.55 : s.firing ? 0.8 : 0.1);
      }
      if (gun) gun.rotation.x = THREE.MathUtils.damp(gun.rotation.x, -(s.aimPitch || 0), 8, dt);
      if (gunRig) {
        // Wind-up: the four coil rings light one after another toward the muzzle, the muzzle ring goes white-hot,
        // the optic blinks red. Firing: everything flares and the barrel slides back.
        const r = gunRig,
          w = s.windup > 0 ? s.windup : 0;
        r.charge = THREE.MathUtils.damp(r.charge, s.firing ? 1 : w, 16, dt);
        r.kick = Math.max(0, r.kick - dt * 8);
        const n = r.ringMats.length;
        for (let i = 0; i < n; i++) {
          const lit = THREE.MathUtils.clamp((r.charge * 1.3 - i * 0.24) / 0.3, 0, 1);
          const m = r.ringMats[i];
          m.emissive.copy(r.cold).lerp(r.hot, lit * lit);
          m.emissiveIntensity = 0.3 + lit * 3.4 + r.kick * 3 + (lit > 0 ? Math.sin(s.time * 70 + i * 2) * 0.3 * lit : 0);
        }
        const near = THREE.MathUtils.clamp((r.charge - 0.7) / 0.3, 0, 1);
        r.capMat.emissive.copy(r.cold).lerp(r.hot, r.charge * 0.8);
        r.capMat.emissiveIntensity = 0.35 + r.charge * 2.8 + r.kick * 2;
        r.muzzleMat.emissive.copy(r.cold).lerp(r.hot, near);
        r.muzzleMat.emissiveIntensity = 0.5 + near * 4.5 + r.kick * 6;
        r.cellMat.emissiveIntensity = 1.2 + Math.sin(s.time * 3 + s.phase) * 0.3 + r.charge * 1.4;
        r.lensMat.emissiveIntensity = w > 0 ? 1.5 + Math.max(0, Math.sin(s.time * 30)) * 3 : 1.2;
        r.barrelNode.position.z = r.barrelZ - r.kick * 0.12;
        r.g.position.z = -r.kick * 0.06;
      }
      if (shieldRig) {
        const r = shieldRig,
          open = s.exposed || s.stagger > 0;
        r.open = THREE.MathUtils.damp(r.open, open ? 1 : 0, 9, dt);
        shield.rotation.y = -1.25 * r.open;
        const U = r.paneMat.uniforms;
        U.time.value = s.time + s.phase;
        U.open.value = r.open;
        U.flash.value = Math.min(1, (s.shieldHit || 0) * 7);
        for (let i = 0; i < 3; i++) {
          const rp = r.ripples[i];
          rp.age += dt;
          U.rp.value[i].z = rp.age < 0.6 ? rp.age : -1;
        }
        const live = 1 - r.open;
        for (const m of r.emitMats) {
          m.emissiveIntensity = (m.name === "emit_strip" ? 1.5 : 2.2) * (0.25 + live * 0.75) + (open ? Math.max(0, Math.sin(s.time * 26)) * 1.4 : 0) + (s.windup > 0 ? 0.8 : 0);
        }
        r.arcMat.uniforms.time.value = s.time;
        r.arcMat.uniforms.amount.value = live * (s.windup > 0 ? 1.4 : 1);
      }
      if (shield && !shieldRig) {
        const open = s.exposed || s.stagger > 0;
        shield.rotation.y = THREE.MathUtils.damp(shield.rotation.y, open ? -1.25 : 0, 9, dt);
        const u = pane.userData;
        u.paneMat.opacity = open
          ? 0.12 + Math.random() * 0.1
          : 0.45 + Math.min(0.5, (s.shieldHit || 0) * 4);
        u.paneMat.color.setHex((s.shieldHit || 0) > 0 ? 0xffffff : P.hfAmber);
      }
      if (bar.visible && s.camera) {
        bar.quaternion.copy(s.camera.quaternion);
        const v = fill.scale.x;
        lagValue = Math.max(v, lagValue - dt * 0.6);
        lag.scale.x = lagValue;
        lag.position.x = -(1 - lagValue) / 2;
        fill.material.color.setHex(s.highlight ? 0xffffff : P.hfYellow);
      }
    },
  };
}

// ---------------------------------------------------------------- allies
// Swarm escorts (cyan, permanent) and spawned subagents (green). Both are a
// glowing orb inside three armoured fins with a twin emitter underneath.
export function buildAgent(kind = "escort") {
  const sub = kind === "subagent";
  const color = sub ? P.hack : P.cyan;
  const root = new THREE.Group();
  const finMat = once("agent.fin", () => armour(0x9aa7b2, 0.45, 0.6));
  const darkMat = once("agent.dark", () => metal(0x151b22, 0.5, 0.7));
  const edge = emissive(color, sub ? 2.2 : 1.7);
  const body = new THREE.Group();
  body.position.y = 1.35;
  root.add(body);
  const orbMat = orbMaterial(color, sub ? 0x06301d : 0x062033, sub ? 1.3 : 1.15);
  const orb = mesh(new THREE.SphereGeometry(0.24, 24, 16), orbMat, body);
  const halo = glowSprite(color, 1.1, 0.22);
  body.add(halo);
  const fins = new THREE.Group();
  body.add(fins);
  for (let i = 0; i < 3; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.z = (i * Math.PI * 2) / 3 + Math.PI / 2;
    fins.add(pivot);
    const fin = mesh(rbox(0.12, sub ? 0.42 : 0.34, 0.2, 0.04), finMat, pivot, 0, 0.36, -0.02);
    fin.rotation.x = sub ? 0.3 : 0.15;
    mesh(rbox(0.03, sub ? 0.36 : 0.28, 0.03, 0.01), edge, fin, 0, 0, 0.11);
  }
  const ring = mesh(new THREE.TorusGeometry(0.34, 0.02, 6, 40), edge, body);
  const gun = new THREE.Group();
  gun.position.set(0, -0.24, 0.12);
  body.add(gun);
  for (const s of [-1, 1]) {
    const b = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.32, 8), darkMat, gun, s * 0.07, 0, 0.12);
    b.rotation.x = Math.PI / 2;
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.24, 0.42);
  body.add(muzzle);
  const flash = glowSprite(color, 0.4, 0, starTexture());
  flash.position.copy(muzzle.position);
  body.add(flash);
  const cone = new THREE.Mesh(
    once("agent.cone", () => new THREE.CylinderGeometry(0.04, 0.18, 0.8, 12, 1, true)),
    additive(color, 0.35, beamTexture()),
  );
  cone.rotation.x = Math.PI;
  cone.position.y = -0.62;
  body.add(cone);
  root.add(blobShadow(0.45, 0.5));
  // Arrival: column of light + expanding floor ring.
  let column = null,
    floorRing = null;
  if (sub) {
    column = new THREE.Mesh(
      once("agent.column", () => new THREE.CylinderGeometry(0.55, 0.55, 14, 20, 1, true).translate(0, 7, 0)),
      additive(color, 0, beamTexture()),
    );
    column.material.side = THREE.DoubleSide;
    root.add(column);
    floorRing = new THREE.Mesh(
      once("agent.ring", () => new THREE.RingGeometry(0.75, 0.9, 48)),
      additive(color, 0, null),
    );
    floorRing.rotation.x = -Math.PI / 2;
    floorRing.position.y = 0.04;
    root.add(floorRing);
  }
  let fire = 0;
  return {
    root,
    body,
    orb,
    muzzle,
    shoot() {
      fire = 1;
    },
    dispose() {
      [edge, orbMat, halo.material, flash.material, cone.material, column?.material, floorRing?.material].forEach(
        (m) => m && m.dispose(),
      );
    },
    // s: { time, phase, arrive(0..1, 1 = landed), hurt, fade }
    update(dt, s) {
      fire = Math.max(0, fire - dt * 9);
      const arrive = s.arrive ?? 1;
      body.position.y = 0.2 + arrive * 1.15 + Math.sin(s.time * 3 + s.phase) * 0.1 * arrive;
      fins.rotation.z += dt * (sub ? 2.4 : 1.2);
      ring.rotation.x = Math.sin(s.time * 0.9 + s.phase) * 0.6 + Math.PI / 2;
      ring.rotation.y = s.time * 1.4;
      orbMat.uniforms.time.value = s.time + s.phase;
      orbMat.uniforms.pulse.value = (s.hurt > 0 ? 1.5 : 0) + fire * 0.4;
      flash.material.opacity = fire;
      flash.material.rotation = s.time * 7;
      gun.position.z = 0.12 - fire * 0.05;
      halo.material.opacity = 0.2 + fire * 0.3;
      if (column) {
        const c = 1 - arrive;
        column.material.opacity = c * 0.9;
        column.scale.set(0.4 + c, 1, 0.4 + c);
        floorRing.material.opacity = arrive < 1 ? 0.9 * (1 - arrive) + 0.1 : 0;
        floorRing.scale.setScalar(0.4 + arrive * 2.2);
      }
      const f = s.fade ?? 1;
      root.scale.setScalar(Math.max(0.01, Math.min(1, f) * (0.3 + 0.7 * Math.min(1, arrive * 1.5))));
    },
  };
}

// ---------------------------------------------------------------- loot
// Four pickups, each with its own shape and colour so they read at range.
export const LOOT = {
  patch: { color: P.hack, label: "REPAIR PATCH", detail: "+35 integrity" },
  coolant: { color: P.cyan, label: "COOLANT", detail: "rifle vented · 6s no heat" },
  compute: { color: P.violet, label: "COMPUTE SHARD", detail: "subagents −10s" },
  overclock: { color: P.magenta, label: "OVERCLOCK", detail: "8s · shots pierce shields" },
};
export function buildPickup(type) {
  const { color } = LOOT[type];
  const root = new THREE.Group();
  const item = new THREE.Group();
  item.position.y = 0.95;
  root.add(item);
  const white = once("loot.white", () => armour(0xe4e9ee, 0.35, 0.3));
  const dark = once("loot.dark", () => metal(0x161c24, 0.45, 0.7));
  const glow = emissive(color, 1.8);
  if (type === "patch") {
    mesh(rbox(0.46, 0.16, 0.16, 0.05), white, item);
    mesh(rbox(0.16, 0.46, 0.16, 0.05), white, item);
    mesh(rbox(0.36, 0.08, 0.18, 0.03), glow, item);
    mesh(rbox(0.08, 0.36, 0.18, 0.03), glow, item);
  } else if (type === "coolant") {
    mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 18), white, item);
    for (const y of [-0.12, 0, 0.12]) mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 18), glow, item, 0, y, 0);
    mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.08, 14), dark, item, 0, 0.25, 0);
    mesh(new THREE.CylinderGeometry(0.12, 0.09, 0.08, 14), dark, item, 0, -0.25, 0);
  } else if (type === "compute") {
    mesh(new THREE.OctahedronGeometry(0.24, 0), glow, item).scale.y = 1.4;
    const r = mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 6), dark, item);
    r.rotation.x = Math.PI / 2;
  } else {
    mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.36, 6), dark, item);
    mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.38, 6), glow, item);
    for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.1, 0.16, 6), glow, item, 0, s * 0.27, 0).rotation.x = s < 0 ? Math.PI : 0;
  }
  const halo = glowSprite(color, 1.2, 0.3);
  halo.position.y = 0.95;
  root.add(halo);
  const glint = glowSprite(0xffffff, 0.7, 0.8, starTexture());
  glint.position.y = 0.95;
  root.add(glint);
  const beam = new THREE.Mesh(
    once("loot.beam", () => new THREE.CylinderGeometry(0.08, 0.32, 3.2, 14, 1, true).translate(0, 1.6, 0)),
    additive(color, 0.3, beamTexture()),
  );
  beam.material.side = THREE.DoubleSide;
  beam.rotation.x = Math.PI;
  beam.position.y = 3.2;
  root.add(beam);
  const ring = new THREE.Mesh(
    once("loot.ring", () => new THREE.RingGeometry(0.42, 0.5, 40)),
    additive(color, 0.7, null),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  root.add(ring);
  root.add(blobShadow(0.35, 0.4));
  return {
    root,
    item,
    dispose() {
      [glow, halo.material, glint.material, beam.material, ring.material].forEach((m) => m.dispose());
    },
    // s: { time, phase, spawn (0..1), blink, collect (0..1) }
    update(dt, s) {
      const sp = s.spawn ?? 1;
      const pop = sp < 1 ? Math.sin(sp * Math.PI) * 0.9 : 0;
      item.position.y = 0.95 + pop + Math.sin(s.time * 2.5 + s.phase) * 0.09;
      item.rotation.y = s.time * 1.8 + s.phase;
      item.rotation.z = Math.sin(s.time * 1.3) * 0.15;
      halo.position.y = glint.position.y = item.position.y;
      glint.material.rotation = s.time * 0.8;
      glint.material.opacity = 0.4 + Math.max(0, Math.sin(s.time * 3 + s.phase)) * 0.6;
      ring.scale.setScalar(1 + Math.sin(s.time * 4 + s.phase) * 0.08);
      const vis = s.blink ? (Math.sin(s.time * 24) > 0 ? 1 : 0.2) : 1;
      beam.material.opacity = 0.28 * vis * Math.min(1, sp * 2);
      ring.material.opacity = 0.7 * vis;
      root.scale.setScalar(Math.max(0.01, Math.min(1, sp * 1.6)) * (1 - (s.collect || 0) * 0.6));
    },
  };
}
