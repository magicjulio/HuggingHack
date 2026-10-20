import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { logoMaterials } from "./art.js";
import { asset } from "./assets.js";

// Floors area (level-1 atrium, level-2 hall): interior lighting and authored
// scenery. world.js keeps the gameplay data (colliders, spawns, lift); this
// module only dresses it. Owner: floors.

// ---------------------------------------------------------------- lighting
// The approach is lit hot (flight.js adds its own rig on top of main.js's
// hemisphere + sun). Indoors that washes the official logo's yellow out to
// white, so while the tower interior is visible the global lights run at a
// calmer level and the floor's own lights take over. Nothing is changed on the
// logo itself.
export const LIGHTING = {
  1: { hemi: 0.5, sun: 0.42, env: 0.25 },
  2: { hemi: 0.34, sun: 0.22, env: 0.22 },
  3: { hemi: 0.3, sun: 0.18, env: 0.2 }, // the summit (floor3.js): its own hall lights take over
};

export function interiorLighting(scene, root) {
  // ?light=hemi,sun,env overrides the floor-1 factors while tuning.
  const tune = new URLSearchParams(location.search).get("light");
  if (tune) {
    const [hemi, sun, env] = tune.split(",").map(Number);
    LIGHTING[1] = { hemi, sun, env };
  }
  // main.js adds its hemisphere + sun before createWorld; flight lights live
  // under flight's own root and are not touched.
  const globals = scene.children.filter(
    (o) => o.isHemisphereLight || o.isDirectionalLight,
  );
  let saved = null;
  let floor = 1;
  const rig = new THREE.Group();
  rig.name = "floors: interior lights";
  root.add(rig);
  const prev = scene.onBeforeRender;
  scene.onBeforeRender = function (...args) {
    const inside = root.visible;
    if (inside && !saved) {
      saved = {
        lights: globals.map((l) => l.intensity),
        env: scene.environmentIntensity,
      };
    }
    if (inside) {
      const L = LIGHTING[floor];
      globals.forEach((l, i) => {
        l.intensity = saved.lights[i] * (l.isHemisphereLight ? L.hemi : L.sun);
      });
      scene.environmentIntensity = saved.env * (L.env / 0.4);
    } else if (saved) {
      globals.forEach((l, i) => (l.intensity = saved.lights[i]));
      scene.environmentIntensity = saved.env;
      saved = null;
    }
    return prev.apply(this, args);
  };
  const q = new URLSearchParams(location.search);
  return {
    rig,
    // Two warm spots from the flanks light the logo; seen from the floor their
    // highlights fall to the opposite sides, never across the face.
    emblem(parent, mesh, gain = 1) {
      const power = +(q.get("emblem") || 100) * gain;
      const k = mesh.scale.x; // spots keep their angle on a smaller emblem
      // Satin print finish: no hot specular blob, and it does not mirror the
      // bright studio environment (that veil is what turned the yellow white).
      // (envMap set explicitly: otherwise three uses scene.environmentIntensity
      // and ignores the material's envMapIntensity.)
      for (const m of mesh.material) {
        m.roughness = 0.62;
        m.envMap = scene.environment;
        m.envMapIntensity = +(q.get("emblemEnv") || 0.1);
      }
      for (const side of [-1, 1]) {
        const s = new THREE.SpotLight(0xfff3e2, power, 0, 0.42, 0.7, 2);
        s.position.set(side * 9 * k, mesh.position.y + 7 * k, mesh.position.z + 16 * k);
        s.target.position.copy(mesh.position);
        parent.add(s, s.target);
      }
    },
    setFloor(n) {
      floor = n;
    },
    dispose() {
      scene.onBeforeRender = prev;
      if (saved) {
        globals.forEach((l, i) => (l.intensity = saved.lights[i]));
        scene.environmentIntensity = saved.env;
      }
    },
  };
}

// ------------------------------------------------------------------ scenery sets
// The authored atrium (floor 1, y = 0) and data hall (floor 2, y = T.world.floorHeight)
// from the Blender kits in design/3d/end2/floors/floors.py. Each kit piece is joined
// per material in Blender; here every placement of every piece is merged into ONE
// mesh per material per floor (a dozen draw calls for a whole floor). Materials are
// shared by name across the three glbs. Gameplay data (colliders, spawns) stays in
// world.js; nothing here collides.
// cover + floor2 kits are scripted (floors.py -- cover|floor2) but not built yet:
// add "cover: ./assets/models/end2-cover-kit.glb" and "floor2: ..." once they exist.
const KITS = {
  atrium: asset("end2-atrium-kit.glb"),
};
// Cover slots in createCover order, per floor; the piece is built at exactly that width.
const COVER_KINDS = {
  1: ["c_desk_500", "c_planter_500", "c_barrier_500", "c_checkpoint_400"],
  2: ["c_racks_440", "c_hardlight_500", "c_racks_400", "c_hardlight_360", "c_racks_320"],
};
// Bays are 7 m modules from z = +12 to -44.
const BAYS = [8.5, 1.5, -5.5, -12.5, -19.5, -26.5, -33.5, -40.5];
const COLUMNS = [
  [-11, -8],
  [11, -8],
  [-11, -26],
  [11, -26],
];
const EMISSIVE = {
  at_glow_y: 1.5,
  at_glow_w: 1.7,
  at_office: 0.7,
  c_screen: 0.5,
  c_hardlight: 1.6,
  c_rack: 1.5,
  f2_beacon: 2.2,
};

export function createFloorSets({ scene, root, deck, T, brand, lighting, resources, sign, riding }) {
  const H2 = T.world.floorHeight;
  const q = new URLSearchParams(location.search);
  const own = (x) => (resources.add(x), x);
  const uTime = { value: 0 };
  const sets = { 1: new THREE.Group(), 2: new THREE.Group() };
  sets[1].name = "floors: atrium";
  sets[2].name = "floors: data hall";
  sets[2].position.y = H2;
  root.add(sets[1], sets[2]);
  const coverSlots = [];
  const coverCount = { 1: 0, 2: 0 };
  const beacons = [];
  const hardlights = [];
  let floor = 1;
  let loaded = false;

  // ---------------------------------------------------------------- materials
  const mats = new Map();
  function shared(m) {
    if (mats.has(m.name)) {
      if (mats.get(m.name) !== m) m.dispose?.();
      return mats.get(m.name);
    }
    let out = m;
    if (m.name === "at_glass") {
      out = glassMaterial();
      m.dispose();
    } else if (m.name === "at_office") {
      m.emissiveMap = officeTexture();
      m.map = null;
      m.color.setHex(0x0c0b09);
      m.emissiveIntensity = EMISSIVE.at_office;
    } else if (m.name === "c_hardlight_wall") {
      out = hardlightMaterial();
      m.dispose();
    } else if (m.name in EMISSIVE) {
      m.emissiveIntensity = EMISSIVE[m.name];
      if (m.name === "c_rack") blinkLeds(m);
    }
    if (m.name === "at_stone") {
      // polished: a clear but dim reflection of the hall lights
      m.envMap = scene.environment;
      m.envMapIntensity = 0.55;
    }
    own(out);
    for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap"])
      if (out[k]) {
        out[k].anisotropy = 8;
        own(out[k]);
      }
    mats.set(m.name, out);
    return out;
  }
  function blinkLeds(m) {
    m.onBeforeCompile = (s) => {
      s.uniforms.uTime = uTime;
      s.fragmentShader = s.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          #ifdef USE_EMISSIVEMAP
          {
            vec2 cell = floor(vEmissiveMapUv * vec2(40.0, 42.0));
            float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
            float on = step(0.3, fract(h * 7.0 + uTime * (0.15 + h * 1.4)));
            totalEmissiveRadiance *= mix(0.2, 1.0, on);
          }
          #endif`,
        );
    };
    m.customProgramCacheKey = () => "floors-rack-leds";
  }
  // Big glass areas cost fill on the Iris Xe; this is unlit: a tint plus a fresnel
  // sheen of the hall's own light, alpha rising at grazing angles.
  function glassMaterial() {
    return new THREE.ShaderMaterial({
      name: "at_glass",
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
      uniforms: { tint: { value: new THREE.Color(0x0e1820) }, sheen: { value: new THREE.Color(0x6f8597) } },
      vertexShader: `varying vec3 vWorld; varying vec3 vN;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vN = mat3(modelMatrix) * normal;
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 tint; uniform vec3 sheen; varying vec3 vWorld; varying vec3 vN;
        void main(){
          vec3 n = normalize(vN);
          vec3 v = normalize(cameraPosition - vWorld);
          float ndv = clamp(abs(dot(n, v)), 0.0, 1.0);
          float f = pow(1.0 - ndv, 4.0);
          vec3 r = reflect(-v, n);
          vec3 refl = sheen * (0.25 + 0.75 * smoothstep(-0.3, 0.7, r.y));
          float streak = 0.5 + 0.5 * sin((vWorld.x + vWorld.z) * 1.7 + vWorld.y * 0.35);
          vec3 c = mix(tint, refl, clamp(f + 0.06 * streak, 0.0, 1.0));
          gl_FragColor = vec4(c, clamp(0.14 + 0.55 * f + 0.04 * streak, 0.0, 0.85));
        }`,
    });
  }
  // Lit offices behind the mezzanine glass: blinds, lit and dark rooms, people and
  // desks as silhouettes. Tileable (the kit maps it at 4 m per tile).
  function officeTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        const lit = rnd();
        const v = lit < 0.25 ? 0.08 : 0.35 + lit * 0.65;
        const warm = rnd() < 0.8;
        g.fillStyle = warm ? `rgb(${255 * v},${215 * v},${160 * v})` : `rgb(${170 * v},${210 * v},${255 * v})`;
        g.fillRect(x * 64, y * 64, 64, 64);
        g.fillStyle = "rgba(0,0,0,0.85)";
        if (rnd() < 0.6) g.fillRect(x * 64 + 6 + rnd() * 30, y * 64 + 44, 22, 20); // desk
        if (rnd() < 0.4) g.fillRect(x * 64 + 10 + rnd() * 40, y * 64 + 30, 6, 34); // someone standing
      }
    g.fillStyle = "rgba(0,0,0,0.35)";
    for (let y = 0; y < 256; y += 4) g.fillRect(0, y, 256, 1); // blinds
    g.fillStyle = "rgba(0,0,0,0.9)";
    for (let x = 0; x < 256; x += 64) g.fillRect(x, 0, 3, 256); // partitions
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return own(t);
  }
  function hardlightMaterial() {
    // Hard-light cover: a hex-scan energy sheet. u runs along the wall in metres, v up.
    return new THREE.ShaderMaterial({
      name: "c_hardlight_wall",
      uniforms: { uTime, color: { value: new THREE.Color(0xffc23a) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime; uniform vec3 color; varying vec2 vUv;
        void main(){
          vec2 p = vec2(vUv.x * 6.0, vUv.y * 5.2);
          vec2 r = vec2(1.0, 1.732);
          vec2 a = mod(p, r) - r * 0.5;
          vec2 b = mod(p - r * 0.5, r) - r * 0.5;
          vec2 g = dot(a, a) < dot(b, b) ? a : b;
          float edge = smoothstep(0.38, 0.5, max(abs(g.x) * 0.866 + abs(g.y) * 0.5, abs(g.y)));
          float scan = smoothstep(0.0, 0.08, 0.08 - abs(fract(vUv.y - uTime * 0.35) - 0.5) + 0.04);
          float rim = smoothstep(0.82, 1.0, vUv.y) + smoothstep(0.12, 0.0, vUv.y);
          float flick = 0.85 + 0.15 * sin(uTime * 23.0 + vUv.x * 3.0);
          float i = (0.12 + 0.35 * edge + 0.5 * scan + 0.55 * rim) * flick;
          gl_FragColor = vec4(color * clamp(i, 0.0, 1.2), 1.0);
        }`,
    });
  }

  // ---------------------------------------------------------------- kit loading
  const loader = new GLTFLoader();
  const pieces = new Map(); // name -> [{ geometry, material }]
  async function loadKit(url) {
    const gltf = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
    const scn = gltf.scene;
    scn.updateWorldMatrix(true, true);
    for (const p of scn.children[0]?.children ?? []) {
      const inv = new THREE.Matrix4().copy(p.matrixWorld).invert();
      const parts = [];
      p.traverse((o) => {
        if (!o.isMesh) return;
        const g = o.geometry.clone();
        g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        for (const k of Object.keys(g.attributes))
          if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
        if (!g.attributes.uv)
          g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        parts.push({ geometry: g, material: shared(o.material) });
        o.geometry.dispose();
      });
      pieces.set(p.name, parts);
    }
  }
  const rotY = (a) => new THREE.Matrix4().makeRotationY(a);
  const at = (x, y, z, a = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(rotY(a));
  // One merged mesh per material for every placement in `list` ([pieceName, matrix]).
  function bake(parent, list, name) {
    const byMat = new Map();
    for (const [piece, m] of list) {
      for (const part of pieces.get(piece) ?? []) {
        const g = part.geometry.clone().applyMatrix4(m);
        if (!byMat.has(part.material)) byMat.set(part.material, []);
        byMat.get(part.material).push(g);
      }
    }
    const out = new THREE.Group();
    out.name = name;
    for (const [material, geos] of byMat) {
      const indexed = geos.every((g) => g.index);
      const merged = mergeGeometries(indexed ? geos : geos.map((g) => (g.index ? g.toNonIndexed() : g)), false);
      geos.forEach((g) => g.dispose());
      const mesh = new THREE.Mesh(own(merged), material);
      mesh.name = `${name}:${material.name}`;
      mesh.receiveShadow = true;
      if (material.transparent) mesh.renderOrder = 2;
      out.add(mesh);
    }
    parent.add(out);
    return out;
  }

  // ---------------------------------------------------------------- floor 1: atrium
  function atriumLayout() {
    const L = [
      ["a_floor", at(0, 0, 0)],
      ["a_skylight", at(0, 0, 0)],
      ["a_far_wall", at(0, 0, 0)],
      ["a_portal", at(0, 0, 0)],
    ];
    for (const [x, z] of COLUMNS) L.push(["a_pillar", at(x, 0, z)]);
    BAYS.forEach((z, i) => {
      L.push(["a_bay_glass", at(19, 0, z, -Math.PI / 2)]);
      L.push([i % 2 ? "a_bay_wall_info" : "a_bay_wall_door", at(-19, 0, z, Math.PI / 2)]);
    });
    for (const [z, y] of [
      [3, 21.5],
      [-13, 19.5],
      [-27, 21.5],
    ])
      L.push(["a_halo", at(0, y, z)]);
    return L;
  }
  function hallLayout() {
    const L = [
      ["f2_floor", at(0, 0, 0)],
      ["f2_ceiling", at(0, 0, 0)],
      ["f2_far_wall", at(0, 0, 0)],
      ["f2_entrance", at(0, 0, 0)],
    ];
    for (const [x, z] of COLUMNS) L.push(["f2_rack_tower", at(x, 0, z)]);
    BAYS.forEach((z) => {
      L.push(["f2_bay_window", at(19, 0, z, -Math.PI / 2)]);
      L.push(["f2_bay_racks", at(-19, 0, z, Math.PI / 2)]);
    });
    return L;
  }

  // ---------------------------------------------------------------- emblems + signs (immediately)
  const emblemMats = logoMaterials(brand, { glow: 0, clearcoat: 0 });
  emblemMats.forEach(own);
  const emblem = new THREE.Mesh(brand.badge({ face: 8.5, depth: 0.9 }), emblemMats);
  emblem.position.set(0, 11.5, -43.9);
  sets[1].add(emblem);
  lighting.emblem(sets[1], emblem);
  const emblem2 = new THREE.Mesh(emblem.geometry, emblemMats);
  emblem2.scale.setScalar(5 / 8.5);
  emblem2.position.set(0, 6.2, -44.2);
  sets[2].add(emblem2);
  lighting.emblem(sets[2], emblem2, 0.45);
  const signs = [
    [1, "HUGGING FACE", 19, 0, 26.2, -43.45, "#ffd27a"],
    [1, "HEADQUARTERS", 15, -13.6, 10.4, -43.95, "#b9cfdc"],
    [1, "ASCENT CONTROL", 9, -13.6, 8.7, -43.95, "#8aa3b4"],
    [1, "01", 30, 13.6, 11.2, -43.95, "#d7e8ef"],
    [1, "ARRIVAL ATRIUM", 9, 13.6, 8.7, -43.95, "#d7e8ef"],
    [2, "02 / SENTINEL GALLERY", 10, -12.8, 8.4, -44.1, "#d7e8ef"],
    [2, "RESTRICTED: SCORING CLUSTER", 6, -12.8, 6.9, -44.1, "#e8a640"],
    [2, "AUTHORISED AGENTS ONLY", 7, 12.8, 8.0, -44.1, "#e8a640"],
  ];
  for (const [f, text, size, x, y, z, color] of signs) {
    const m = sign(text, size, color);
    m.position.set(x, y, z);
    sets[f].add(m);
  }

  // ---------------------------------------------------------------- vista: the outside through the glass
  // A one-sided card just outside the right-hand glass. Its shader ray-casts a city,
  // the plaza and the sky from the real camera, so parallax and the drop below
  // floor 2 are correct. Faces -x only: from outside (the lift ride) it is invisible.
  function vista(set, y0, y1, groundY) {
    const geo = own(new THREE.PlaneGeometry(60, y1 - y0));
    const m = own(
      new THREE.ShaderMaterial({
        fog: false,
        uniforms: {
          uTime,
          groundY: { value: groundY },
          top: { value: new THREE.Color(0x0a111c) },
          mid: { value: new THREE.Color(0x14233a) },
          hor: { value: new THREE.Color(0x35597a) },
          warm: { value: new THREE.Color(0x7a4b2a) },
        },
        vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: `uniform float uTime; uniform float groundY; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 warm;
          varying vec3 vWorld;
          float hash(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
          float hash2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
          vec3 sky(vec3 d){
            float h = clamp(d.y, -0.2, 1.0);
            vec3 c = mix(hor, mid, smoothstep(0.0, 0.25, h));
            c = mix(c, top, smoothstep(0.2, 0.9, h));
            c += warm * exp(-abs(h) * 14.0) * 0.35;
            return c;
          }
          // towers standing on a plane x = X; returns rgb + coverage
          vec4 towers(vec3 o, vec3 d, float X, float cellW, float hMax, float seed){
            float t = (X - o.x) / max(d.x, 1e-3);
            vec3 p = o + d * t;
            float cell = floor(p.z / cellW);
            float r = hash(cell + seed);
            float h = groundY + 30.0 + pow(clamp(r, 0.0, 1.0), 1.6) * hMax;
            float fz = fract(p.z / cellW);
            float gap = step(0.12, fz) * step(fz, 0.88);
            if (p.y > h || gap < 0.5 || r < 0.12) return vec4(0.0);
            vec2 win = vec2(floor(fz * cellW / 2.2), floor((p.y - groundY) / 3.6));
            float lit = step(0.72, hash2(win + cell * 7.0 + seed));
            vec2 wf = vec2(fract(fz * cellW / 2.2), fract((p.y - groundY) / 3.6));
            float pane = step(0.25, wf.x) * step(wf.x, 0.75) * step(0.3, wf.y) * step(wf.y, 0.7);
            vec3 wc = mix(vec3(1.0, 0.62, 0.25), vec3(0.55, 0.8, 1.0), step(0.6, hash2(win.yx + cell)));
            vec3 c = vec3(0.025, 0.035, 0.05) + wc * lit * pane * 0.9;
            float crown = smoothstep(1.2, 0.0, h - p.y) * step(0.7, r);
            c += vec3(1.0, 0.7, 0.3) * crown * 0.6;
            float fog = 1.0 - exp(-t * 0.0028);
            return vec4(mix(c, hor * 0.9, fog), 1.0);
          }
          void main(){
            vec3 o = cameraPosition;
            vec3 d = normalize(vWorld - cameraPosition);
            vec3 c = sky(d);
            // drifting craft lights high up
            for (int i = 0; i < 5; i++) {
              float fi = float(i);
              float t = (260.0 + fi * 90.0 - o.x) / max(d.x, 1e-3);
              vec3 p = o + d * t;
              vec2 q = vec2(mod(p.z + uTime * (6.0 + fi * 2.0) + fi * 157.0, 400.0) - 200.0, p.y - (groundY + 120.0 + fi * 35.0));
              float l = exp(-dot(q, q) * 0.35) * (0.6 + 0.4 * step(0.5, fract(uTime * 0.9 + fi * 0.37)));
              c += vec3(1.0, 0.85, 0.5) * l;
            }
            vec4 far = towers(o, d, o.x + 700.0, 64.0, 420.0, 3.0);
            c = mix(c, far.rgb, far.a);
            vec4 near = towers(o, d, o.x + 240.0, 46.0, 260.0, 11.0);
            c = mix(c, near.rgb, near.a);
            if (d.y < 0.0) {
              float t = (groundY - o.y) / d.y;
              vec3 p = o + d * t;
              if (near.a < 0.5 && t < 2400.0) {
                vec2 g = p.xz / 9.0;
                vec2 f = abs(fract(g) - 0.5);
                float grid = smoothstep(0.47, 0.5, max(f.x, f.y));
                vec2 lp = p.xz / vec2(18.0, 6.0);
                float lights = step(0.86, hash2(floor(lp))) * smoothstep(0.25, 0.0, length(fract(lp) - 0.5));
                vec3 gc = vec3(0.03, 0.035, 0.04) + vec3(0.2, 0.17, 0.12) * grid * 0.25 + vec3(1.0, 0.6, 0.15) * lights * 1.2;
                c = mix(gc, hor * 0.8, 1.0 - exp(-t * 0.0035));
              }
            }
            gl_FragColor = vec4(clamp(c, 0.0, 1.6), 1.0);
          }`,
      }),
    );
    const card = new THREE.Mesh(geo, m);
    card.rotation.y = -Math.PI / 2; // normal -> -x (into the building)
    card.position.set(21.2, (y0 + y1) / 2, -16);
    card.renderOrder = -1;
    set.add(card);
    return card;
  }
  vista(sets[1], -1, 31, -1);
  vista(sets[2], 2.5, 12.5, -1 - H2);

  // ---------------------------------------------------------------- light shafts + dust (atrium)
  // Light shafts: one quad per shaft, turned about its own axis toward the camera
  // in the vertex shader (no edge-on seams), all shafts in one draw call.
  {
    const dir = new THREE.Vector3(-0.32, -1, -0.24).normalize(); // sun from +x +y +z (main.js)
    const len = 34;
    const list = [
      [-9, 6, 3.4],
      [-3, -6, 2.2],
      [8, -2, 2.8],
      [-12, -18, 2.6],
      [6, -20, 3.6],
      [13, -30, 2.4],
    ];
    const pos = [],
      uv = [],
      top = [],
      width = [],
      index = [];
    list.forEach(([x, z, w], i) => {
      for (const [a, b] of [
        [-0.5, 0],
        [0.5, 0],
        [0.5, 1],
        [-0.5, 1],
      ]) {
        pos.push(a, -b * len, 0);
        uv.push(a + 0.5, 1 - b);
        top.push(x, 30, z);
        width.push(w);
      }
      index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    });
    const g = own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute("aTop", new THREE.Float32BufferAttribute(top, 3));
    g.setAttribute("aWidth", new THREE.Float32BufferAttribute(width, 1));
    g.setIndex(index);
    const m = own(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime,
          dir: { value: dir },
          color: { value: new THREE.Color(0xfff0d0) },
          strength: { value: +(q.get("shafts") || 0.09) },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        fog: false,
        vertexShader: `attribute vec3 aTop; attribute float aWidth; uniform vec3 dir; varying vec2 vUv; varying float vSide;
          void main(){
            vUv = uv;
            vec3 c = aTop + dir * (-position.y);
            vec3 toCam = cameraPosition - c;
            vec3 side = cross(dir, toCam);
            float l = length(side);
            side = l > 1e-4 ? side / l : vec3(1.0, 0.0, 0.0);
            vSide = clamp(l / max(length(toCam), 1e-3), 0.0, 1.0); // fades when looking along the shaft
            vec3 w = c + side * position.x * aWidth;
            gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
          }`,
        fragmentShader: `uniform float uTime; uniform vec3 color; uniform float strength; varying vec2 vUv; varying float vSide;
          void main(){
            float across = smoothstep(0.0, 0.4, vUv.x) * smoothstep(1.0, 0.6, vUv.x);
            float along = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
            float flow = 0.75 + 0.25 * sin(vUv.y * 9.0 - uTime * 0.6 + vUv.x * 4.0);
            gl_FragColor = vec4(color * strength * across * along * flow * vSide, 1.0);
          }`,
      }),
    );
    const shafts = new THREE.Mesh(g, m);
    shafts.name = "floors: light shafts";
    shafts.frustumCulled = false;
    shafts.renderOrder = 3;
    sets[1].add(shafts);
  }
  function dust(set, count, box, color, size) {
    const pos = new Float32Array(count * 3);
    const r = (a) => a[0] + Math.random() * (a[1] - a[0]);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r(box[0]);
      pos[i * 3 + 1] = r(box[1]);
      pos[i * 3 + 2] = r(box[2]);
    }
    const g = own(new THREE.BufferGeometry());
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = own(
      new THREE.ShaderMaterial({
        uniforms: { uTime, color: { value: new THREE.Color(color) }, size: { value: size } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
        vertexShader: `uniform float uTime; uniform float size; varying float vA;
          void main(){
            vec3 p = position;
            float ph = p.x * 0.37 + p.z * 0.21;
            p += vec3(sin(uTime * 0.11 + ph), sin(uTime * 0.07 + ph * 1.3) * 0.6, cos(uTime * 0.09 + ph)) * 0.8;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float d = max(-mv.z, 0.5);
            gl_PointSize = clamp(size * 300.0 / d, 1.0, 6.0);
            vA = clamp(1.0 - d / 45.0, 0.0, 1.0) * (0.55 + 0.45 * sin(uTime * 0.8 + ph * 3.0));
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `uniform vec3 color; varying float vA;
          void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); gl_FragColor = vec4(color * a * vA * 0.35, 1.0); }`,
      }),
    );
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    set.add(pts);
  }
  dust(sets[1], 700, [[-18, 18], [0.5, 26], [-43, 11]], 0xffe2b0, 0.05);
  dust(sets[2], 500, [[-18, 18], [0.3, 11], [-43, 11]], 0xbfd8ff, 0.04);

  // ---------------------------------------------------------------- floor 2: alarm beacons
  // Two ceiling beacons sweep HF-yellow spots across the hall; a soft additive cone
  // shows each beam in the haze. The domes and their spots pulse together.
  const coneMat = own(
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0xffb71e) }, strength: { value: +(q.get("alarm") || 0.16) } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){ vY = uv.y; vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 color; uniform float strength; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){
          float face = pow(clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.5);
          float fall = smoothstep(0.0, 0.9, vY);
          gl_FragColor = vec4(color * strength * face * fall, 1.0);
        }`,
    }),
  );
  const coneGeo = own(new THREE.ConeGeometry(4.2, 14, 24, 1, true).translate(0, -7, 0));
  for (const [x, z, phase] of [
    [-6.5, -9, 0],
    [6.5, -25.5, Math.PI],
  ]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 12 - 0.95, z);
    sets[2].add(pivot);
    const arm = new THREE.Group();
    arm.rotation.z = -0.95; // beam tilts down and outward
    pivot.add(arm);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    arm.add(cone);
    const spot = new THREE.SpotLight(0xffae1a, +(q.get("alarmPower") || 160), 34, 0.36, 0.55, 1.4);
    spot.position.set(0, 0, 0);
    spot.target.position.set(0, -10, 0);
    arm.add(spot, spot.target);
    beacons.push({ pivot, spot, phase, base: spot.intensity });
  }

  // ---------------------------------------------------------------- covers
  function placeCover(slot) {
    const parts = pieces.get(slot.kind);
    if (!parts) return;
    for (const c of [...slot.group.children]) if (c.userData.legacyCover) slot.group.remove(c);
    for (const part of parts) {
      const mesh = new THREE.Mesh(part.geometry, part.material);
      mesh.name = `${slot.kind}:${part.material.name}`;
      slot.group.add(mesh);
    }
  }

  // ---------------------------------------------------------------- load + build
  const legacy = [];
  const has = {};
  const ready = (async () => {
    if (q.get("sets") === "0") return false; // ?sets=0: greybox only (perf A/B, fallback)
    await Promise.all(
      Object.entries(KITS).map(([k, url]) =>
        loadKit(url).then(
          () => (has[k] = true),
          (e) => console.warn(`floors: ${url} missing, that floor keeps the greybox`, e),
        ),
      ),
    );
    if (has.atrium) bake(sets[1], atriumLayout(), "atrium");
    if (has.floor2) bake(sets[2], hallLayout(), "hall");
    // beacon housings ride on the sweep pivots' mounts
    if (has.floor2) bake(
      sets[2],
      beacons.map((b) => ["f2_beacon", at(b.pivot.position.x, 12, b.pivot.position.z)]).concat([
        ["f2_beacon", at(-14, 12, 5)],
        ["f2_beacon", at(14, 12, -37)],
      ]),
      "beacons",
    );
    if (has.cover) coverSlots.forEach(placeCover);
    loaded = true;
    show();
    return has.atrium && has.floor2 && has.cover;
  })();
  // greybox stays only on a floor whose kit is missing
  const kitFor = (n) => (n === 1 ? has.atrium : has.floor2);
  // floor 2 is the floor2.js building (world.js); the old data hall stays only for ?f2=arena
  let building = false;

  function show() {
    const ride = riding();
    sets[1].visible = floor === 1 || (ride && floor !== 3);
    sets[2].visible = !building && (floor === 2 || ride) && floor !== 3;
    for (const g of legacy) g.visible = floor !== 3 && !(building && floor === 2) && !(loaded && kitFor(floor));
  }

  return {
    sets,
    ready,
    get loaded() {
      return loaded;
    },
    // Old box architecture: kept until the kits load (and as the fallback if they fail).
    legacy(group) {
      legacy.push(group);
    },
    // createCover hands over each cover group; its box children are marked legacy.
    cover(group, sx, coverFloors) {
      const f = coverFloors[0];
      const kind = COVER_KINDS[f]?.[coverCount[f]++];
      const width = kind && +kind.split("_").pop() / 100;
      for (const c of group.children) c.userData.legacyCover = true;
      if (!kind || Math.abs(width - sx) > 0.01) return; // unknown slot: keep the boxes
      const slot = { group, kind };
      coverSlots.push(slot);
      if (loaded && has.cover) placeCover(slot);
    },
    setFloor(n) {
      floor = n;
      show();
    },
    // true: floor 2 is the building (hides the old hall set and the greybox there)
    useBuilding(on) {
      building = !!on;
      show();
    },
    update(dt, time) {
      uTime.value = time;
      show();
      if (sets[2].visible)
        for (const b of beacons) {
          b.pivot.rotation.y = time * 1.25 + b.phase;
          b.spot.intensity = b.base * (0.75 + 0.25 * Math.sin(time * 6.0 + b.phase));
        }
      const dome = mats.get("f2_beacon");
      if (dome) dome.emissiveIntensity = EMISSIVE.f2_beacon * (0.6 + 0.4 * Math.max(0, Math.sin(time * 6.0)));
    },
  };
}
