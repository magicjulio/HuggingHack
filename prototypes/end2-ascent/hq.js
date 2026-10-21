import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { P, logoMaterials } from "./art.js";

// The Hugging Face HQ as seen on the approach (landing area; used by flight.js).
// end2-hq.glb is authored in game coordinates: the entrance portal is centred on x = 0 with the
// façade at z = 0, the landing deck top is y = 0, the pad is at `pad` (0, 0, 52).
// createHQ(parent, T, brand) -> { group, ready, anchors, update(t, dt, camera) }
//   anchors: { pad, door, logo, bays: Vector3[], search: Vector3[], beacons: [{p, colour}] }
const MODELS = new URL("./assets/models/", import.meta.url).href;

// ---------------------------------------------------------------- shared shaders
// Additive volumetric beam: soft at the silhouette, bright at the root (uv.y = 0), no fog.
export function beamMaterial(color, strength = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = mat3(modelMatrix) * normal;
        vV = cameraPosition - wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color; uniform float strength;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0);
        float along = clamp(1.0 - vUv.y, 0.0, 1.0);
        float a = strength * f * f * along * along;
        gl_FragColor = vec4(color * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// Fog-piercing point lights (aviation beacons, pylon tops, city lights, the far armada).
// Attributes: position, color, aBlink (x = rate Hz, y = phase, z = duty 0..1 or 0 = steady), aSize (metres).
export function lightPoints(count, { pixelMax = 48, fade = [400, 3000], floor = 0.0 } = {}) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aBlink", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(count), 1));
  const m = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      scale: { value: 500 },
      pixelMax: { value: pixelMax },
      fade: { value: new THREE.Vector2(...fade) },
      floorA: { value: floor },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aBlink; attribute float aSize;
      uniform float time, scale, pixelMax, floorA; uniform vec2 fade;
      varying vec3 vC; varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float d = max(1.0, -mv.z);
        float on = 1.0;
        if (aBlink.z > 0.0) {
          float k = fract(time * aBlink.x + aBlink.y);
          on = max(floorA, (1.0 - smoothstep(0.0, aBlink.z, k)));
        }
        vA = on * mix(1.0, 0.35, smoothstep(fade.x, fade.y, d));
        vC = color;
        gl_PointSize = clamp(aSize * scale / d, 1.5, pixelMax);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float r = clamp(1.0 - length(c) * 2.0, 0.0, 1.0);
        float a = vA * (r * r * 0.7 + pow(r, 8.0) * 0.6);
        gl_FragColor = vec4(vC * a, 1.0);
      }`,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.set = (i, p, colour, size, rate = 0, phase = 0, duty = 0) => {
    g.attributes.position.setXYZ(i, p.x, p.y, p.z);
    g.attributes.color.setXYZ(i, colour.r, colour.g, colour.b);
    g.attributes.aBlink.setXYZ(i, rate, phase, duty);
    g.attributes.aSize.setX(i, size);
  };
  return pts;
}

const RED = new THREE.Color(0xff2a20).multiplyScalar(1.3),
  AMBER = new THREE.Color(0xffa020).multiplyScalar(1.2);

export function createHQ(parent, T, brand) {
  const C = T.flight;
  const group = new THREE.Group();
  group.name = "hq";
  parent.add(group);
  const anchors = { pad: new THREE.Vector3(0, 0, 52), door: new THREE.Vector3(0, 0, -88), logo: new THREE.Vector3(0, 262, 29), bays: [], search: [], beacons: [] };
  const searchlights = [];
  let beacons = null;

  const ready = new Promise((ok, no) =>
    new GLTFLoader().load(MODELS + "end2-hq.glb", (g) => ok(g.scene), undefined, no),
  ).then((hq) => {
    group.add(hq);
    hq.updateMatrixWorld(true);
    const at = (o) => o.getWorldPosition(new THREE.Vector3()).sub(group.getWorldPosition(new THREE.Vector3()));
    hq.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false; // one huge merged mesh per material; culling never helps
        tune(o.material);
        return;
      }
      const n = o.name;
      if (n === "pad") anchors.pad.copy(at(o));
      else if (n === "door") anchors.door.copy(at(o));
      else if (n === "logo_anchor") anchors.logo.copy(at(o));
      else if (/^bay_\d\d$/.test(n)) anchors.bays.push(at(o));
      else if (/^search_\d$/.test(n)) anchors.search.push(at(o));
      else if (n.startsWith("beacon_")) anchors.beacons.push({ p: at(o), colour: o.userData.colour || "red" });
    });
    addLogo();
    addSearchlights();
    addBeacons();
  });

  // Material balance for the approach light (the scene's hemisphere + sun, plus flight.js's rim).
  function tune(m) {
    const k = {
      hq_facade: 0.55, // lit windows: a warm haze through the fog, not a light wall
      hq_inner: 0.35, // the warm halo round the inner door // the tunnel's back wall (huge; only the door itself should glare)
      hq_door: 1.6,
      hq_bay: 0.9,
      hq_glow_warm: 1.7,
      hq_glow_cool: 0.7,
    }[m.name];
    if (k !== undefined) m.emissiveIntensity = k;
  }

  // The official logo, unmodified, standing proud of the emblem mount. Its own small self-light
  // keeps the yellow saturated in the fog; the brightness is set with light, never the logo colours.
  let logo = null;
  function addLogo() {
    const depth = 10;
    logo = new THREE.Mesh(
      brand.badge({ face: C.logoFace ?? 210, depth, bevel: 1.5 }),
      logoMaterials(brand, { glow: C.logoGlow ?? 0.12, clearcoat: 0.2 }),
    );
    logo.position.copy(anchors.logo).add(new THREE.Vector3(0, 0, depth));
    // A lit emblem cuts through the haze a little: its fog is scaled down (the logo's colours are untouched).
    const fogK = (C.logoFog ?? 0.6).toFixed(3);
    for (const m of logo.material)
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace(
          "#include <fog_fragment>",
          `#ifdef USE_FOG
            float fogFactor = smoothstep( fogNear, fogFar, vFogDepth ) * ${fogK};
            gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
          #endif`,
        );
      };
    logo.name = "hf-logo";
    group.add(logo);
    // Two floodlights on the mount's lower clamps wash the emblem from below (they light only it).
    const flood = new THREE.SpotLight(0xfff0d0, C.logoFlood ?? 0.8, 700, 0.62, 0.5, 0);
    flood.position.copy(anchors.logo).add(new THREE.Vector3(0, -230, 160));
    flood.target = logo;
    group.add(flood);
  }

  function addSearchlights() {
    const len = 1300;
    const geo = new THREE.CylinderGeometry(70, 1.5, len, 24, 1, true);
    geo.translate(0, len / 2, 0);
    anchors.search.forEach((p, i) => {
      const pivot = new THREE.Group();
      pivot.position.copy(p);
      const beam = new THREE.Mesh(geo, beamMaterial(i % 2 ? 0xfff2c8 : 0xcfe9ff, C.searchStrength ?? 0.16));
      pivot.add(beam);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6dc }));
      pivot.add(lamp);
      group.add(pivot);
      searchlights.push({ pivot, phase: i * 1.9, side: Math.sign(p.x) || 1 });
    });
  }

  function addBeacons() {
    const list = anchors.beacons;
    beacons = lightPoints(list.length, { pixelMax: 40, fade: [600, 3200], floor: 0.05 });
    list.forEach((b, i) =>
      beacons.set(i, b.p, b.colour === "amber" ? AMBER : RED, b.colour === "amber" ? 7 : 9, 0.55, (i * 0.37) % 1, 0.22),
    );
    group.add(beacons);
  }

  function update(t, dt, camera) {
    for (const s of searchlights) {
      // slow figure-eight sweeps, leaning out over the approach
      const a = t * 0.23 + s.phase;
      s.pivot.rotation.set(0.55 + Math.sin(a * 1.3) * 0.28, 0, -s.side * (0.12 + Math.sin(a) * 0.32));
    }
    if (beacons) {
      beacons.material.uniforms.time.value = t;
      beacons.material.uniforms.scale.value = camera ? innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) : 500;
    }
  }

  return { group, ready, anchors, update, get logo() { return logo; } };
}
