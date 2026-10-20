import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { P, canvas, texture, normalFromHeight, rng, glowSprite, glowTexture } from "./art.js";
import { buildAgent } from "./models.js";
import { asset } from "./assets.js";

// The lift: an authored freight platform (assets/models/end2-lift.glb), its guide rails
// (end2-lift-rail.glb, instanced), the tower it climbs and the sky around it, plus the
// cinematic camera for the ride. world.js owns the atrium and creates this once; main.js
// drives `setProgress` and `shot`. Blender sources: design/3d/end2/lift/.
export const LIFT_AT = { z: -39, railX: 4.25, railZ: -42.7 };
const DECK_LIFT = 0.04; // the platform sits 4 cm over the floor so the two tops never z-fight
const ease = (a, b, x) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ glb helpers
const loader = new GLTFLoader();
const load = (url) =>
  new Promise((res, rej) => loader.load(url, res, undefined, rej));

// Merge every static mesh of a loaded model by material so a 250-node Blender
// scene costs a handful of draw calls. `keep` names stay as live nodes (bar, beacons).
function bakeStatic(source, keepNames = []) {
  source.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(source.matrixWorld).invert();
  const keep = new Set(keepNames.map((n) => source.getObjectByName(n)).filter(Boolean));
  const groups = new Map();
  const doomed = [];
  source.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o.parent; p && p !== source; p = p.parent) if (keep.has(p)) return;
    if (keep.has(o)) return;
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes))
      if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv)
      g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push(g);
    doomed.push(o);
  });
  doomed.forEach((o) => o.removeFromParent());
  const out = [];
  for (const [material, geos] of groups) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    const m = new THREE.Mesh(merged, material);
    m.name = "merged:" + material.name;
    source.add(m);
    out.push(m);
  }
  return out;
}

// Instance a baked model's materials at the given matrices.
function instance(parent, meshes, matrices) {
  const made = [];
  for (const m of meshes) {
    const im = new THREE.InstancedMesh(m.geometry, m.material, matrices.length);
    matrices.forEach((mx, i) => im.setMatrixAt(i, mx));
    im.instanceMatrix.needsUpdate = true;
    im.frustumCulled = false;
    parent.add(im);
    made.push(im);
  }
  return made;
}

// ------------------------------------------------------------------ tower textures
// One tile = 38 m x 36 m (two storeys, eight bays). Albedo, a window/slab glow map
// and a height map for the normal map, painted from the same layout.
function facadeTextures() {
  const rnd = rng(7);
  const W = 1024,
    fx = W / 38,
    fy = W / 36,
    storey = 18 * fy;
  const lit = [];
  for (let f = 0; f < 2; f++) for (let b = 0; b < 8; b++) lit.push(rnd());
  const paint = (g, mode, scale = 1) => {
    g.save();
    g.scale(scale, scale);
    const col = {
      albedo: { base: "#18222d", slab: "#2c3947", pil: "#243140", glass: "#070d14", mull: "#33424f" },
      emit: { base: "#000", slab: "#000", pil: "#000", glass: "#000", mull: "#000" },
      height: { base: "#808080", slab: "#b8b8b8", pil: "#a0a0a0", glass: "#303030", mull: "#c8c8c8" },
    }[mode];
    g.fillStyle = col.base;
    g.fillRect(0, 0, W, W);
    if (mode === "albedo") {
      const r2 = rng(3);
      for (let i = 0; i < 2600; i++) {
        g.fillStyle = `rgba(${r2() > 0.5 ? "255,255,255" : "0,0,0"},${0.02 + r2() * 0.04})`;
        g.fillRect(r2() * W, r2() * W, 1 + r2() * 2, 4 + r2() * 28);
      }
    }
    for (let f = 0; f < 2; f++) {
      const y0 = f * storey;
      // slab band at the top of each storey, with a glow line along its lower edge
      g.fillStyle = col.slab;
      g.fillRect(0, y0, W, 1.4 * fy);
      if (mode === "emit") {
        g.fillStyle = "#b8dcea";
        g.fillRect(0, y0 + 1.05 * fy, W, 0.22 * fy);
      }
      for (let b = 0; b < 8; b++) {
        const cx = (b + 0.5) * 4.75 * fx;
        const wx = cx - 1.4 * fx,
          wy = y0 + 2.6 * fy,
          ww = 2.8 * fx,
          wh = 11.4 * fy;
        g.fillStyle = col.glass;
        g.fillRect(wx, wy, ww, wh);
        if (mode === "albedo") {
          const grad = g.createLinearGradient(0, wy, 0, wy + wh);
          grad.addColorStop(0, "rgba(90,130,160,0.35)");
          grad.addColorStop(1, "rgba(20,40,60,0)");
          g.fillStyle = grad;
          g.fillRect(wx, wy, ww, wh);
        }
        const v = lit[f * 8 + b];
        if (mode === "emit" && v < 0.4) {
          const warm = v < 0.3;
          const grad = g.createLinearGradient(0, wy, 0, wy + wh);
          grad.addColorStop(0, warm ? "#8a5200" : "#0a5a70");
          grad.addColorStop(1, warm ? "#3a2000" : "#04303c");
          g.fillStyle = grad;
          g.fillRect(wx, wy, ww, wh);
          g.fillStyle = "#000";
          for (let y = wy; y < wy + wh; y += 9) g.fillRect(wx, y, ww, 2.5);
        }
        // mullion
        g.fillStyle = col.mull;
        g.fillRect(cx - 0.07 * fx, wy, 0.14 * fx, wh);
        // pilaster between bays, with a gold line on every other one
        const px = b * 4.75 * fx;
        g.fillStyle = col.pil;
        g.fillRect(px - 0.3 * fx, y0, 0.6 * fx, storey);
        if (mode === "emit" && b % 2 === 0) {
          g.fillStyle = "#ffb840";
          g.fillRect(px - 0.04 * fx, y0 + 1.6 * fy, 0.08 * fx, storey - 1.8 * fy);
        }
      }
    }
    g.restore();
  };
  const [ac, ag] = canvas(W);
  const [ec, eg] = canvas(W);
  const [hc, hg] = canvas(512);
  paint(ag, "albedo");
  paint(eg, "emit");
  paint(hg, "height", 0.5);
  const rep = { repeat: [1, 1] };
  const map = texture(ac, { aniso: 8 }),
    emissiveMap = texture(ec, { aniso: 8 }),
    normalMap = texture(normalFromHeight(hc, 3.2), { srgb: false, aniso: 8 });
  for (const t of [map, emissiveMap, normalMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, emissiveMap, normalMap, ...rep };
}

function plazaTexture() {
  const [c, g] = canvas(1024);
  const r = rng(11);
  g.fillStyle = "#101820";
  g.fillRect(0, 0, 1024, 1024);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? "255,255,255" : "0,0,0"},${0.015 + r() * 0.04})`;
    g.fillRect(r() * 1024, r() * 1024, 2 + r() * 14, 2 + r() * 14);
  }
  g.strokeStyle = "#05090e";
  g.lineWidth = 3;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 256, 0);
    g.lineTo(i * 256, 1024);
    g.moveTo(0, i * 256);
    g.lineTo(1024, i * 256);
    g.stroke();
  }
  g.strokeStyle = "#8a6a1a";
  g.lineWidth = 5;
  g.setLineDash([36, 28]);
  g.beginPath();
  g.moveTo(0, 512);
  g.lineTo(1024, 512);
  g.stroke();
  const t = texture(c, { repeat: [60, 60] });
  return t;
}

// ------------------------------------------------------------------ the module
export function createLift({ scene, root, deck, T, resources = new Set() }) {
  const C = { duration: 9.5, height: T.world.floorHeight, fogFar: 520, railGlow: 0.7, ...T.lift };
  const H = C.height;
  const own = (x) => (resources.add(x), x);

  const assembly = new THREE.Group();
  assembly.name = "Moving ascent platform";
  assembly.position.set(0, DECK_LIFT, LIFT_AT.z);
  deck.add(assembly);

  // Placeholder deck until the glb arrives (it is local; this is only a safety net).
  const fallback = new THREE.Mesh(
    own(new THREE.BoxGeometry(7.3, 0.6, 7.3)),
    own(new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.6, metalness: 0.6 })),
  );
  fallback.position.y = -0.3;
  assembly.add(fallback);

  const model = { strips: null, led: null, bar: null, beacons: [], glows: [] };
  const riders = [];
  const lampLight = new THREE.PointLight(0xffc678, 0, 28, 1.6);
  lampLight.position.set(0, 3.4, 0.6);
  assembly.add(lampLight);

  // ---- status sign on the wall behind the lift
  const signCanvas = canvas(1024, 128);
  const signTex = texture(signCanvas[0], { aniso: 4 });
  const signMat = own(
    new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  const sign = new THREE.Mesh(own(new THREE.PlaneGeometry(7.5, 0.9375)), signMat);
  sign.position.set(0, 1.4, -42.8);
  deck.add(sign);
  function paintSign(text, color) {
    const g = signCanvas[1];
    g.clearRect(0, 0, 1024, 128);
    g.fillStyle = color;
    g.font = "700 74px 'Chakra Petch', monospace";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(text, 512, 66);
    signTex.needsUpdate = true;
  }
  paintSign("SECURE THE ATRIUM", "#f3bb76");

  // ---- pit frame on the floor around the platform (hazard border)
  {
    const [c, g] = canvas(256, 64);
    g.fillStyle = "#14181e";
    g.fillRect(0, 0, 256, 64);
    g.fillStyle = "#c8920f";
    for (let x = -64; x < 320; x += 48) {
      g.beginPath();
      g.moveTo(x, 64);
      g.lineTo(x + 24, 64);
      g.lineTo(x + 24 + 64, 0);
      g.lineTo(x + 64, 0);
      g.fill();
    }
    const t = texture(c, { aniso: 4, repeat: [1, 1] });
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 1);
    const m = own(new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.2 }));
    const half = 4.15;
    const strip = (w, d, x, z) => {
      const geo = own(new THREE.PlaneGeometry(w, d));
      const mesh = new THREE.Mesh(geo, m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, 0.012, z);
      deck.add(mesh);
    };
    strip(2 * half + 0.6, 0.3, 0, LIFT_AT.z + half);
    strip(2 * half + 0.6, 0.3, 0, LIFT_AT.z - half);
    strip(0.3, 2 * half, half + 0.15, LIFT_AT.z);
    strip(0.3, 2 * half, -half - 0.15, LIFT_AT.z);
  }

  // ---- rails (instanced), world-fixed. Rail module = 6 m; brackets every 18 m.
  const railGroup = new THREE.Group();
  railGroup.name = "lift rails";
  root.add(railGroup);

  // ---- the tower, the plaza and the sky
  const backdrop = new THREE.Group();
  backdrop.name = "tower backdrop";
  root.add(backdrop);
  const fac = facadeTextures();
  const facMat = own(
    new THREE.MeshStandardMaterial({
      map: fac.map,
      emissiveMap: fac.emissiveMap,
      emissive: 0xffffff,
      emissiveIntensity: 2.0,
      normalMap: fac.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.55,
      metalness: 0.35,
    }),
  );
  const darkMat = own(new THREE.MeshStandardMaterial({ color: 0x0d151e, roughness: 0.8, metalness: 0.3 }));
  const steelMat = own(new THREE.MeshStandardMaterial({ color: 0x2c3947, roughness: 0.5, metalness: 0.7 }));
  const lineMat = (hex, i) =>
    own(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: hex, emissiveIntensity: i, roughness: 0.4 }));
  const goldLine = lineMat(0xffc153, 1.6);
  const paleLine = lineMat(0xb6deed, 1.7);

  function facePlane(w, h, tileW, tileH) {
    const g = own(new THREE.PlaneGeometry(w, h));
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tileW, (uv.getY(i) * h) / tileH);
    return g;
  }
  const TOP = 440;
  // main tower facade at z = -51 (the rails climb in front of it)
  const facade = new THREE.Mesh(facePlane(95, TOP + 60, 38, 36), facMat);
  facade.position.set(0, (TOP - 60) / 2, -50.9);
  backdrop.add(facade);
  const body = new THREE.Mesh(own(new THREE.BoxGeometry(95, TOP + 60, 24)), darkMat);
  body.position.set(0, (TOP - 60) / 2, -63);
  backdrop.add(body);
  // wings: dark blocks with the same façade on their inner and front faces
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(own(new THREE.BoxGeometry(25, TOP + 60, 81)), darkMat);
    wing.position.set(s * 35, (TOP - 60) / 2, -10.5);
    backdrop.add(wing);
    const inner = new THREE.Mesh(facePlane(81, TOP + 60, 38, 36), facMat);
    inner.rotation.y = -s * Math.PI * 0.5;
    inner.position.set(s * 22.4, (TOP - 60) / 2, -10.5);
    backdrop.add(inner);
    const front = new THREE.Mesh(facePlane(25, TOP + 60, 38, 36), facMat);
    front.position.set(s * 35, (TOP - 60) / 2, 30.1);
    backdrop.add(front);
  }
  // vertical ribs + gold lines on the facade (instanced)
  const ribCount = 14;
  const rib = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), steelMat, ribCount);
  const ribLine = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), goldLine, ribCount);
  const m4 = new THREE.Matrix4(),
    q0 = new THREE.Quaternion();
  for (let i = 0; i < ribCount; i++) {
    const x = -20.5 + i * (41 / (ribCount - 1));
    m4.compose(new THREE.Vector3(x, (TOP - 60) / 2, -49.6), q0, new THREE.Vector3(0.9, TOP + 60, 1.6));
    rib.setMatrixAt(i, m4);
    m4.compose(new THREE.Vector3(x, (TOP - 60) / 2, -48.76), q0, new THREE.Vector3(0.08, TOP + 60, 0.05));
    ribLine.setMatrixAt(i, m4);
  }
  backdrop.add(rib, ribLine);
  // gallery slabs every 18 m across the facade; the rail brackets land on them
  const galleries = Math.floor(TOP / 18);
  const slab = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), steelMat, galleries * 3);
  const slabLine = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), paleLine, galleries * 3);
  for (let k = 0; k < galleries; k++) {
    const y = 18 * (k + 1);
    m4.compose(new THREE.Vector3(0, y, -49.4), q0, new THREE.Vector3(44, 0.7, 3.2));
    slab.setMatrixAt(k, m4);
    m4.compose(new THREE.Vector3(0, y - 0.1, -47.74), q0, new THREE.Vector3(44, 0.1, 0.1));
    slabLine.setMatrixAt(k, m4);
    for (const s of [-1, 1]) {
      // side galleries on the wing faces, so the canyon reads as floors
      m4.compose(new THREE.Vector3(s * 21.2, y, -10.5), q0, new THREE.Vector3(2.4, 0.5, 78));
      slab.setMatrixAt(galleries + k * 2 + (s > 0 ? 1 : 0), m4);
      m4.compose(new THREE.Vector3(s * 20.0, y - 0.1, -10.5), q0, new THREE.Vector3(0.08, 0.08, 78));
      slabLine.setMatrixAt(galleries + k * 2 + (s > 0 ? 1 : 0), m4);
    }
  }
  backdrop.add(slab, slabLine);

  // plaza far below, with the landing lights
  const plazaMat = own(new THREE.MeshStandardMaterial({ map: plazaTexture(), roughness: 0.8, metalness: 0.25, color: 0xb0b8c0 }));
  const plaza = new THREE.Mesh(own(new THREE.PlaneGeometry(1800, 1800)), plazaMat);
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.set(0, -1.0, 120);
  backdrop.add(plaza);
  // taxi-line lights
  const nLights = 90;
  const taxi = new THREE.InstancedMesh(own(new THREE.BoxGeometry(0.5, 0.12, 0.5)), lineMat(0xff9d00, 1.8), nLights);
  for (let i = 0; i < nLights; i++) {
    const side = i % 2 ? 1 : -1;
    const z = 16 + Math.floor(i / 2) * 5.5;
    m4.compose(new THREE.Vector3(side * 12, -0.92, z), q0, new THREE.Vector3(1, 1, 1));
    taxi.setMatrixAt(i, m4);
  }
  backdrop.add(taxi);

  // skyline: dark towers in the haze with a few glow strips, far enough to read as other buildings
  {
    const towers = 30;
    const tw = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), darkMat, towers);
    const strips = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), lineMat(0xffa23a, 1.3), towers * 5);
    const r = rng(23);
    let si = 0;
    for (let i = 0; i < towers; i++) {
      const a = (i / towers) * Math.PI * 2 + r() * 0.2;
      const d = 190 + r() * 380;
      let x = Math.sin(a) * d,
        z = -Math.cos(a) * d + 20;
      if (z > -35 && Math.abs(x) < 120) x += x < 0 ? -140 : 140; // keep the view toward the plaza open
      const w = 22 + r() * 36,
        h = 120 + r() * 560;
      m4.compose(new THREE.Vector3(x, h / 2 - 20, z), q0, new THREE.Vector3(w, h, w * (0.7 + r() * 0.6)));
      tw.setMatrixAt(i, m4);
      for (let k = 0; k < 5; k++) {
        const fx = (r() - 0.5) * w * 0.9;
        const y = h * (0.1 + 0.8 * r()) - 20;
        // face toward the origin so the glow is seen from the lift
        const dirx = -x,
          dirz = -z + 0;
        const len = Math.hypot(dirx, dirz) || 1;
        const nx = dirx / len,
          nz = dirz / len;
        m4.compose(
          new THREE.Vector3(x + nx * w * 0.5 + fx * -nz, y, z + nz * w * 0.5 + fx * nx),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(nx, nz), 0)),
          new THREE.Vector3(w * (0.15 + r() * 0.4), 0.5 + r() * 1.5, 0.2),
        );
        strips.setMatrixAt(si++, m4);
      }
    }
    backdrop.add(tw, strips);
  }

  // sky dome: horizon haze, follows the camera
  const sky = new THREE.Mesh(
    own(new THREE.SphereGeometry(3000, 24, 14)),
    own(
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(0x0a111c) },
          mid: { value: new THREE.Color(0x14233a) },
          hor: { value: new THREE.Color(0x35597a) },
          warm: { value: new THREE.Color(0x7a4b2a) },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 warm; varying vec3 vDir;
          void main(){
            float h = clamp(vDir.y, -0.2, 1.0);
            vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h));
            c = mix(c, top, smoothstep(0.2, 0.9, h));
            float glow = exp(-abs(h) * 14.0) * smoothstep(-0.6, 0.6, vDir.z);
            c += warm * glow * 0.35;
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    ),
  );
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  root.add(sky);

  // ---- swarm motes: squads of agents climbing the façade and the canyon walls
  const squads = 26,
    perSquad = 7;
  const nMotes = squads * perSquad;
  const motePos = new Float32Array(nMotes * 3),
    moteCol = new Float32Array(nMotes * 3);
  const squad = [];
  {
    const r = rng(41);
    for (let s = 0; s < squads; s++) {
      const kind = r();
      let x, z, nx = 0, nz = 0;
      if (kind < 0.5) {
        x = (r() - 0.5) * 41;
        z = -48.2 - r() * 1.2;
      } else {
        const side = kind < 0.75 ? -1 : 1;
        x = side * (20.4 + r() * 0.6);
        z = -46 + r() * 66;
      }
      const cyan = r() < 0.35;
      squad.push({ x, z, y: r() * 360 - 10, v: 5 + r() * 12, cyan, ph: r() * 6 });
    }
    const c = new THREE.Color();
    for (let s = 0; s < squads; s++)
      for (let k = 0; k < perSquad; k++) {
        c.set(squad[s].cyan ? P.cyan : P.hack).multiplyScalar(0.55 + r() * 0.35);
        const i = s * perSquad + k;
        moteCol.set([c.r, c.g, c.b], i * 3);
      }
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute("color", new THREE.BufferAttribute(moteCol, 3));
  const motes = new THREE.Points(
    moteGeo,
    own(
      new THREE.PointsMaterial({
        size: 1.5,
        sizeAttenuation: true,
        map: glowTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
        opacity: 0.95,
      }),
    ),
  );
  motes.frustumCulled = false;
  backdrop.add(motes);
  function updateMotes(dt, time) {
    for (let s = 0; s < squads; s++) {
      const q = squad[s];
      q.y += q.v * dt;
      if (q.y > 380) q.y = -12;
      for (let k = 0; k < perSquad; k++) {
        const i = (s * perSquad + k) * 3;
        const a = k * 2.4 + q.ph;
        motePos[i] = q.x + Math.sin(a + time * 0.9) * 1.1;
        motePos[i + 1] = q.y + (k - perSquad / 2) * 0.9 + Math.sin(a * 1.7 + time * 1.3) * 0.25;
        motePos[i + 2] = q.z + Math.cos(a * 1.3 + time * 0.8) * (q.x > 20 || q.x < -20 ? 0.5 : 0.9);
      }
    }
    moteGeo.attributes.position.needsUpdate = true;
  }
  updateMotes(0, 0);

  // ---- other lifts, far side of the façade (simple, lit): the swarm is climbing everywhere
  const other = [];
  {
    const geo = mergeGeometries(
      [
        new THREE.BoxGeometry(5, 0.5, 5).translate(0, -0.25, 0),
        new THREE.BoxGeometry(5.2, 1.0, 0.1).translate(0, 0.5, 2.5),
        new THREE.BoxGeometry(5.2, 1.0, 0.1).translate(0, 0.5, -2.5),
      ].map((g) => (g.deleteAttribute("uv"), g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)), g)),
    );
    own(geo);
    const bodyI = new THREE.InstancedMesh(geo, steelMat, 4);
    const glowI = new THREE.InstancedMesh(own(new THREE.BoxGeometry(5.1, 0.08, 0.12)), lineMat(0xff9d00, 2.0), 4);
    backdrop.add(bodyI, glowI);
    other.push({ bodyI, glowI, x: [-15.3, 14.2, -9.0, 9.4], z: [-45.5, -45.5, -46.5, -46.5], v: [6.5, 5, 7.5, 4.2], y: [40, 150, 230, 20] });
  }
  const otherM = new THREE.Matrix4();
  function updateOther(dt) {
    const o = other[0];
    for (let i = 0; i < 4; i++) {
      o.y[i] += o.v[i] * dt * (i % 2 ? -1 : 1);
      if (o.y[i] > 360) o.y[i] = 12;
      if (o.y[i] < 12) o.y[i] = 360;
      otherM.makeTranslation(o.x[i], o.y[i], o.z[i]);
      o.bodyI.setMatrixAt(i, otherM);
      otherM.makeTranslation(o.x[i], o.y[i] + 0.1, o.z[i] + 2.52);
      o.glowI.setMatrixAt(i, otherM);
    }
    o.bodyI.instanceMatrix.needsUpdate = o.glowI.instanceMatrix.needsUpdate = true;
  }
  updateOther(0);

  // ---- the fleet: parked on the plaza and cruising past the tower (instanced glb)
  const fleet = { parked: [], fliers: [], meshes: [] };
  const fleetM = new THREE.Matrix4(),
    fleetQ = new THREE.Quaternion(),
    fleetE = new THREE.Euler(),
    fleetV = new THREE.Vector3(),
    fleetS = new THREE.Vector3(1, 1, 1);
  const ready = (async () => {
    try {
      const [lg, rg, fg] = await Promise.all([
        load(asset("end2-lift.glb")),
        load(asset("end2-lift-rail.glb")),
        load(asset("end2-dropship-fleet.glb")).catch(() => null),
      ]);
      // platform
      const platform = lg.scene;
      platform.traverse((o) => {
        if (o.material) {
          resources.add(o.material);
          const n = o.material.name;
          if (n === "lift_strip") model.strips = o.material;
          if (n === "lift_ready_led") model.led = o.material;
        }
      });
      const keepNames = ["safety_bar", "beacon_fl", "beacon_fr", "beacon_bl", "beacon_br"];
      bakeStatic(platform, keepNames);
      model.bar = platform.getObjectByName("safety_bar");
      model.barY = model.bar?.position.y ?? 2.0;
      for (const tag of ["fl", "fr", "bl", "br"]) {
        const b = platform.getObjectByName("beacon_" + tag);
        if (!b) continue;
        const shade = b.getObjectByName("beacon_shade_" + tag);
        const g = glowSprite(P.hfYellow, 3.4, 0.7);
        g.position.copy(b.position);
        platform.add(g);
        model.beacons.push({ b, shade, glow: g, ph: model.beacons.length * 1.3 });
        model.glows.push(g);
      }
      assembly.remove(fallback);
      assembly.add(platform);
      if (model.strips) {
        model.strips.emissive.setHex(0xff9d00);
        model.strips.emissiveIntensity = 0.5;
      }
      // rails
      const rail = rg.scene;
      rail.traverse((o) => {
        if (o.material?.name === "lift_led_green") o.material.emissiveIntensity = C.railGlow;
        if (o.material?.name === "lift_strip") o.material.emissiveIntensity = C.railGlow * 1.1;
      });
      rail.updateWorldMatrix(true, true);
      const segGroup = rail.getObjectByName("rail_6m");
      const brGroup = rail.getObjectByName("rail_bracket");
      segGroup.parent.remove(segGroup);
      brGroup.parent.remove(brGroup);
      const segMeshes = bakeStatic(segGroup);
      const brMeshes = bakeStatic(brGroup);
      const segM = [],
        brM = [];
      const top = 372;
      for (const s of [-1, 1])
        for (let y = -0.2; y < top; y += 6) {
          segM.push(new THREE.Matrix4().makeTranslation(s * LIFT_AT.railX, y, LIFT_AT.railZ));
        }
      for (const s of [-1, 1])
        for (let y = 18; y < top; y += 18)
          brM.push(new THREE.Matrix4().makeTranslation(s * LIFT_AT.railX, y - 0.2, LIFT_AT.railZ));
      instance(railGroup, segMeshes, segM);
      instance(railGroup, brMeshes, brM);
      segMeshes.concat(brMeshes).forEach((m) => resources.add(m.material));
      // fleet
      if (fg) {
        const fgScene = fg.scene;
        fgScene.traverse((o) => {
          if (!o.material) return;
          if (["engine_glow", "trim_glow"].includes(o.material.name)) {
            o.material = o.material.clone();
            o.material.emissive.setHex(P.cyan);
            o.material.color?.setHex(P.cyan);
            o.material.emissiveIntensity = 1.4;
          }
        });
        const meshes = bakeStatic(fgScene);
        const parked = [
          [-70, 62, 0.4], [-48, 96, 2.2], [-22, 120, 1.0], [26, 70, -0.5], [52, 112, 2.9],
          [78, 80, 0.2], [-92, 130, 1.8], [8, 150, 0.7], [100, 148, -1.4], [-40, 170, 3.0],
        ];
        const fliers = [];
        for (let i = 0; i < 14; i++)
          fliers.push({
            y: 14 + i * 9 + (i % 3) * 5,
            z: 60 + (i % 5) * 22,
            x: (i * 53) % 360 - 180,
            v: (i % 2 ? 1 : -1) * (14 + (i % 4) * 4),
          });
        const total = parked.length + fliers.length;
        const inst = instance(backdrop, meshes, new Array(total).fill(new THREE.Matrix4()));
        fleet.meshes = inst;
        fleet.parked = parked;
        fleet.fliers = fliers;
        meshes.forEach((m) => resources.add(m.material));
        // parked ships: set once
        parked.forEach(([x, z, yaw], i) => {
          fleetE.set(0, yaw, 0);
          fleetQ.setFromEuler(fleetE);
          fleetM.compose(fleetV.set(x, 1.6, z), fleetQ, fleetS);
          inst.forEach((im) => im.setMatrixAt(i, fleetM));
        });
        // landing rings
        const ringMat = lineMat(0xff9d00, 1.2);
        for (const [x, z] of parked) {
          const ring = new THREE.Mesh(own(new THREE.RingGeometry(10.5, 10.9, 40)), ringMat);
          ring.rotation.x = -Math.PI / 2;
          ring.position.set(x, -0.9, z);
          backdrop.add(ring);
        }
        updateFleet(0);
      }
    } catch (e) {
      console.warn("lift assets not loaded", e);
    }
  })();
  function updateFleet(dt) {
    if (!fleet.meshes.length) return;
    const n0 = fleet.parked.length;
    fleet.fliers.forEach((f, i) => {
      f.x += f.v * dt;
      if (f.x > 200) f.x = -200;
      if (f.x < -200) f.x = 200;
      fleetE.set(0, f.v > 0 ? -Math.PI / 2 : Math.PI / 2, Math.sin(f.x * 0.05) * 0.05);
      fleetQ.setFromEuler(fleetE);
      fleetM.compose(fleetV.set(f.x, f.y + Math.sin(f.x * 0.04 + i) * 1.5, f.z), fleetQ, fleetS);
      fleet.meshes.forEach((im) => im.setMatrixAt(n0 + i, fleetM));
    });
    fleet.meshes.forEach((im) => (im.instanceMatrix.needsUpdate = true));
  }

  // ---- riders: the two swarm escorts hover beside the player during the ride
  for (const s of [-1, 1]) {
    const e = buildAgent("escort");
    e.root.position.set(s * 2.1, 0, 0.9);
    e.root.visible = false;
    assembly.add(e.root);
    riders.push({ model: e, phase: s * 1.7 });
  }

  // ---- state
  let isReady = false,
    barLow = 0,
    riding = false,
    time = 0;
  const mint = new THREE.Color(0x69ffd2),
    orange = new THREE.Color(0xff9d00);
  const camWorld = new THREE.Vector3(),
    tmp = new THREE.Vector3();

  function setReady(value, floorNo = 1) {
    if (isReady === value && !setReady.force) return;
    isReady = value;
    setReady.force = false;
    paintSign(
      value ? (floorNo === 1 ? "[ E ]  ASCEND TO FLOOR 02" : "ASCENT ROUTE SECURED") : "SECURE THE ATRIUM",
      value ? "#91ffe0" : "#f3bb76",
    );
  }
  function setProgress(p) {
    assembly.position.y = DECK_LIFT + THREE.MathUtils.clamp(p, 0, 1) * H;
  }
  function setRiding(on) {
    riding = on;
    riders.forEach((r) => (r.model.root.visible = on));
  }

  function update(dt, t, camera) {
    time = t;
    // strip + led colour by state
    if (model.strips) {
      const target = isReady ? mint : orange;
      model.strips.emissive.lerp(target, 1 - Math.exp(-dt * 6));
      model.strips.emissiveIntensity = isReady || riding ? 1.5 + Math.sin(t * 3) * 0.45 : 0.55;
      if (model.led) {
        model.led.emissive.copy(model.strips.emissive);
        model.led.emissiveIntensity = model.strips.emissiveIntensity;
      }
    }
    // safety bar: down while riding
    barLow = THREE.MathUtils.damp(barLow, riding ? 1 : 0, 4, dt);
    if (model.bar) model.bar.position.z = model.barY - 0.95 * barLow;
    // beacons sweep; the dome flashes when its open side faces the camera
    const cam = camera?.getWorldPosition(camWorld);
    for (const b of model.beacons) {
      if (b.shade) b.shade.rotation.z += dt * (riding ? 5.2 : 2.4);
      let vis = 0.6;
      if (cam && b.shade) {
        b.b.getWorldPosition(tmp);
        tmp.sub(cam).normalize().negate();
        const a = b.shade.rotation.z; // open side faces local -x, turned by the shade angle (Blender Z = three Y after export)
        const open = new THREE.Vector3(-Math.cos(-a), 0, -Math.sin(-a));
        vis = 0.25 + 0.75 * Math.max(0, open.dot(tmp)) ** 1.5;
      } else vis = 0.5 + 0.5 * Math.sin(t * 5 + b.ph);
      b.glow.material.opacity = vis * 0.8;
    }
    lampLight.intensity = riding ? 45 : isReady ? 24 : 12;
    riders.forEach((r) => {
      if (!r.model.root.visible) return;
      r.model.update(dt, { time: t, phase: r.phase, arrive: 1, hurt: 0, fade: 1 });
    });
    updateMotes(dt, t);
    updateOther(dt);
    updateFleet(dt);
    if (camera) sky.position.copy(camera.position);
  }

  // ---- cinematic camera. Positions are local to the platform centre; they rise with it.
  // Close on the rider, pull out through the canyon mouth to the wide shot, return to the gameplay pose.
  // lag = share of the platform's rise the camera does NOT follow, so in the wide shots
  // the platform visibly climbs through a camera that stays near the ground.
  const K = [
    { t: 0.0, p: [3.4, 1.7, 8.2], l: [0, 1.2, 1.0], fov: 50, lag: 0 },
    { t: 0.14, p: [4.4, 2.5, 10.5], l: [0, 1.6, 0], fov: 52, lag: 0 },
    { t: 0.3, p: [7.5, 5.0, 28], l: [0, 5, -2], fov: 56, lag: 0.15 },
    { t: 0.48, p: [-6, 9, 112], l: [0, 21, -10], fov: 54, lag: 1 },
    { t: 0.64, p: [11, 12, 80], l: [0, 8, -4], fov: 58, lag: 0.55 },
    { t: 0.78, p: [12, 6.5, 24], l: [0, 3.2, -2], fov: 58, lag: 0 },
  ];
  const posCurve = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
  const lookCurve = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
  const keyU = (t) => {
    if (t <= K[0].t) return 0;
    for (let i = 1; i < K.length; i++)
      if (t <= K[i].t) {
        const f = (t - K[i - 1].t) / (K[i].t - K[i - 1].t);
        const s = f * f * (3 - 2 * f) * 0.5 + f * 0.5; // mild ease keeps speed continuous across keys
        return (i - 1 + s) / (K.length - 1);
      }
    return 1;
  };
  const outP = new THREE.Vector3(),
    outL = new THREE.Vector3();
  // fills `camera` for ride time t (0..1) with the platform centre at `base`
  function shot(t, base, camera) {
    const u = keyU(Math.min(t, K[K.length - 1].t));
    posCurve.getPoint(u, outP);
    lookCurve.getPoint(u, outL);
    // fov and lag by key
    let fov = K[K.length - 1].fov,
      lag = K[K.length - 1].lag;
    for (let i = 1; i < K.length; i++)
      if (t <= K[i].t) {
        const e = ease(K[i - 1].t, K[i].t, t);
        fov = THREE.MathUtils.lerp(K[i - 1].fov, K[i].fov, e);
        lag = THREE.MathUtils.lerp(K[i - 1].lag, K[i].lag, e);
        break;
      }
    if (t <= 0) (fov = K[0].fov), (lag = K[0].lag);
    // handheld sway, a touch bigger when wide
    const sway = 0.04 + 0.12 * ease(0.3, 0.6, t) * (1 - ease(0.6, 0.85, t));
    outP.x += Math.sin(time * 0.9) * sway;
    outP.y += Math.sin(time * 1.3 + 1.2) * sway * 0.7;
    const rise = assembly.position.y - DECK_LIFT;
    camera.position.copy(outP).add(base);
    camera.position.y -= lag * rise;
    camera.lookAt(tmp.copy(outL).add(base));
    camera.fov = fov;
    camera.updateProjectionMatrix();
    return t;
  }

  // ------------------------------------------------------------------ the express (floor 2 → floor 3)
  // Owner: arena (round 4). A through-car express cab that climbs the outside of the tower's
  // prow from floor 2's goal (the EXPRESS ASCENT gate in ASCENT CORE) to the top floor.
  // Board through the back door (−z, floor 2 side), leave through the front (+z, floor 3).
  // Main.js drives it like the floor-1 ride (call sequence in FLOOR3.md):
  //   express.begin() → each frame setProgress(ease(t)); base(v); shot(t, v, camera) → end().
  // world.setFloor() calls end() itself. Everything here is absolute (world) coordinates.
  function createExpress({ level2, level3, floorHeight }) {
    const E = { duration: 8.5, walkTime: 1.1, blendFrom: 0.8, blendTo: 0.96, fogFar: 640, fadeIn: 0.05, fadeOut: 0.93, ...T.express };
    const g2 = level2?.goal ?? { x: 8, z: 61.5, y: 4.5 };
    const y0 = floorHeight + (g2.y ?? 0) + 0.02; // cab floor on floor 2 (absolute)
    const y1 = floorHeight * 2 + 0.02; // cab floor on floor 3
    const CAB = { x: 8, z: 63.75, w: 4.8, d: 4.4, h: 3.6 }; // = the floor-3 cab alcove (floor3.js)
    const entry = new THREE.Vector3(g2.x, y0, g2.z); // where the ride starts (the floor-2 goal)
    const set = new THREE.Group();
    set.name = "express ride";
    set.visible = false;
    root.add(set);
    const cab = new THREE.Group();
    cab.name = "express cab";
    cab.position.set(CAB.x, y0, CAB.z);
    set.add(cab);
    const B = (parent, mat, x0, x1, ya, yb, z0, z1) => {
      const m = new THREE.Mesh(own(new THREE.BoxGeometry(x1 - x0, yb - ya, z1 - z0).translate((x0 + x1) / 2, (ya + yb) / 2, (z0 + z1) / 2)), mat);
      parent.add(m);
      return m;
    };
    const glass = own(new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.18, depthWrite: false }));
    const cabStrip = lineMat(0xffc153, 1.4);
    const cabWhite = lineMat(0xd8ecff, 1.2);
    // the cab: floor, roof, corner posts, glass on the sides, both door frames open
    {
      const w = CAB.w / 2,
        d = CAB.d / 2,
        h = CAB.h;
      B(cab, darkMat, -w, w, -0.3, 0, -d, d);
      B(cab, steelMat, -w + 0.1, w - 0.1, 0, 0.03, -d + 0.1, d - 0.1);
      B(cab, darkMat, -w, w, h, h + 0.35, -d, d);
      B(cab, cabWhite, -w + 0.5, w - 0.5, h - 0.03, h, -0.15, 0.15);
      for (const sx of [-1, 1])
        for (const sz of [-1, 1]) B(cab, steelMat, sx * w - 0.12, sx * w + 0.12, 0, h, sz * d - 0.12, sz * d + 0.12);
      for (const sx of [-1, 1]) {
        B(cab, glass, sx * w - 0.03, sx * w + 0.03, 0.9, h - 0.1, -d + 0.12, d - 0.12);
        B(cab, steelMat, sx * w - 0.06, sx * w + 0.06, 0.85, 0.95, -d, d); // handrail
        B(cab, darkMat, sx * w - 0.05, sx * w + 0.05, 0, 0.85, -d, d);
        B(cab, cabStrip, sx * (w - 0.07) - 0.02, sx * (w - 0.07) + 0.02, 0.02, 0.06, -d + 0.2, d - 0.2);
      }
      for (const sz of [-1, 1]) {
        B(cab, darkMat, -w, w, h - 0.5, h, sz * d - 0.1, sz * d + 0.1); // door headers
        B(cab, cabStrip, -w + 0.3, w - 0.3, h - 0.42, h - 0.36, sz * (d + 0.11) - 0.01, sz * (d + 0.11) + 0.01);
        for (const sx of [-1, 1]) B(cab, steelMat, sx * (w - 0.5) - 0.4, sx * (w - 0.5) + 0.4, 0, h - 0.5, sz * d - 0.08, sz * d + 0.08); // leaves, parked
      }
    }
    // the climb: two guide rails on the cab's flanks, slabs of the tower's top floors passing
    // behind, a light band every floor. Instanced boxes, from floor 2 up past floor 3.
    {
      const m4 = new THREE.Matrix4(),
        q0 = new THREE.Quaternion();
      const yA = y0 - 12,
        yB = y1 + 20;
      for (const sx of [-1, 1]) {
        B(set, steelMat, CAB.x + sx * 2.85 - 0.3, CAB.x + sx * 2.85 + 0.3, yA, yB, CAB.z - 0.35, CAB.z + 0.35);
        B(set, darkMat, CAB.x + sx * 3.3 - 0.15, CAB.x + sx * 3.3 + 0.15, yA, yB, CAB.z - 1.6, CAB.z + 1.6);
      }
      const n = Math.ceil((yB - yA) / 4.5);
      const slabs = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), darkMat, n * 2);
      const bands = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), paleLine, n * 2);
      const ties = new THREE.InstancedMesh(own(new THREE.BoxGeometry(1, 1, 1)), steelMat, n);
      for (let i = 0; i < n; i++) {
        const y = yA + i * 4.5;
        for (const [k, sx] of [
          [0, -1],
          [1, 1],
        ]) {
          m4.compose(new THREE.Vector3(CAB.x + sx * 9, y, CAB.z - 4.5), q0, new THREE.Vector3(11, 0.6, 7));
          slabs.setMatrixAt(i * 2 + k, m4);
          m4.compose(new THREE.Vector3(CAB.x + sx * 9, y - 0.36, CAB.z - 0.98), q0, new THREE.Vector3(11, 0.08, 0.06));
          bands.setMatrixAt(i * 2 + k, m4);
        }
        m4.compose(new THREE.Vector3(CAB.x, y + 2.2, CAB.z - 2.4), q0, new THREE.Vector3(7, 0.25, 0.25));
        ties.setMatrixAt(i, m4);
      }
      for (const im of [slabs, bands, ties]) {
        im.frustumCulled = false;
        set.add(im);
      }
      // the tower's top: a dark crown over the ride's last floors
      B(set, darkMat, CAB.x - 14, CAB.x + 14, y1 + 6.5, y1 + 9, CAB.z - 9, CAB.z - 1);
      B(set, goldLine, CAB.x - 14, CAB.x + 14, y1 + 6.4, y1 + 6.55, CAB.z - 1.05, CAB.z - 0.95);
    }
    let active = false,
      progress = 0,
      lampHome = null;
    const base = new THREE.Vector3();
    // camera keys, local to the cab floor centre (+z = out of the front door, away from the tower)
    const K = [
      { t: 0.0, p: [1.3, 1.75, -1.4], l: [0, 1.5, 6], fov: 56, lag: 0 },
      { t: 0.16, p: [2.2, 2.2, 1.0], l: [0, 1.0, 12], fov: 60, lag: 0 },
      { t: 0.34, p: [7, 1.2, 14], l: [0, 1.8, 0], fov: 50, lag: 0.25 },
      { t: 0.52, p: [-16, -8, 46], l: [0, 6, -4], fov: 54, lag: 0.85 },
      { t: 0.7, p: [5, 16, 18], l: [0, -2, 0], fov: 58, lag: 0.2 },
      { t: 0.84, p: [0.2, 2.6, -1.9], l: [0, 1.6, 5], fov: 60, lag: 0 },
    ];
    const pc = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.p)), false, "centripetal");
    const lc = new THREE.CatmullRomCurve3(K.map((k) => new THREE.Vector3(...k.l)), false, "centripetal");
    const oP = new THREE.Vector3(),
      oL = new THREE.Vector3();
    const keyAt = (t) => {
      if (t <= 0) return [0, K[0]];
      for (let i = 1; i < K.length; i++)
        if (t <= K[i].t) {
          const f = (t - K[i - 1].t) / (K[i].t - K[i - 1].t);
          return [(i - 1 + (f * f * (3 - 2 * f) * 0.5 + f * 0.5)) / (K.length - 1), K[i], K[i - 1], ease(K[i - 1].t, K[i].t, t)];
        }
      return [1, K[K.length - 1]];
    };
    const api = {
      config: E,
      entry,
      cab,
      assembly: cab,
      from: y0,
      to: y1,
      get active() {
        return active;
      },
      // shows the ride, hides floor 2 (world.update), moves the cab lamp into the cab
      begin() {
        active = true;
        set.visible = true;
        progress = 0;
        cab.position.y = y0;
        if (!lampHome) {
          lampHome = lampLight.parent;
          cab.add(lampLight);
          lampLight.position.set(0, CAB.h - 0.4, 0);
        }
      },
      setProgress(p) {
        progress = THREE.MathUtils.clamp(p, 0, 1);
        cab.position.y = THREE.MathUtils.lerp(y0, y1, progress);
      },
      // the cab floor centre now (absolute)
      base(out = new THREE.Vector3()) {
        return out.set(CAB.x, cab.position.y, CAB.z);
      },
      shot(t, at, camera) {
        const [u, k1, k0, e] = keyAt(Math.min(t, K[K.length - 1].t));
        pc.getPoint(u, oP);
        lc.getPoint(u, oL);
        const fov = k0 ? THREE.MathUtils.lerp(k0.fov, k1.fov, e) : k1.fov;
        const lag = k0 ? THREE.MathUtils.lerp(k0.lag, k1.lag, e) : k1.lag;
        const sway = 0.03 + 0.1 * ease(0.3, 0.55, t) * (1 - ease(0.6, 0.8, t));
        oP.x += Math.sin(time * 0.9) * sway;
        oP.y += Math.sin(time * 1.3 + 1.2) * sway * 0.7;
        const c = at || api.base(base);
        camera.position.copy(oP).add(c);
        camera.position.y -= lag * (cab.position.y - y0);
        camera.lookAt(tmp.copy(oL).add(c));
        camera.fov = fov;
        camera.updateProjectionMatrix();
        return t;
      },
      end() {
        if (!active && !set.visible) return;
        active = false;
        set.visible = false;
        if (lampHome) {
          lampHome.add(lampLight);
          lampLight.position.set(0, 3.4, 0.6);
          lampHome = null;
        }
      },
      update(dt) {
        if (!active) return;
        lampLight.intensity = 38;
        void dt;
      },
    };
    void level3;
    return api;
  }
  // the top floor has no atrium lift: its rails would poke through the summit
  function setTop(on) {
    railGroup.visible = !on;
  }

  return {
    assembly,
    ready,
    sky,
    config: C,
    setReady,
    setProgress,
    setRiding,
    update,
    shot,
    createExpress,
    setTop,
    dispose() {
      for (const r of riders) r.model.dispose?.();
      root.remove(backdrop, railGroup, sky);
      for (const x of resources) x.dispose?.();
    },
  };
}
