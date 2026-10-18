import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { lightPoints } from "./hq.js";

// Barrier picket drones on the approach (landing area; used by flight.js).
// end2-approach-barrier.glb: origin = field centre; the field is 27.7 x 12 m facing +z, so it fills
// flight.js's collision box (|dx| < 16, |dy| < 7, |dz| < 10).
// createBarriers(parent, spots) -> { ready, update(t, dt, target), hit(i) }   spots: [{x, y, z}]
const MODELS = new URL("./assets/models/", import.meta.url).href;

function fieldMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      hit: { value: 0 },
      seed: { value: 0 },
      color: { value: new THREE.Color(0xff8a00) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float time, hit, seed; uniform vec3 color; varying vec2 vUv;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        vec2 uv = vUv;
        // bright seams at the emitters and top/bottom edges
        float ex = min(uv.x, 1.0 - uv.x), ey = min(uv.y, 1.0 - uv.y);
        float edge = exp(-ex * 40.0) + 0.5 * exp(-ey * 30.0);
        // scan bands crawling upward, fine horizontal interference lines
        float band = smoothstep(0.82, 1.0, sin((uv.y * 6.0 - time * 1.4 + seed) * 6.2831) * 0.5 + 0.5);
        float lines = 0.5 + 0.5 * sin(uv.y * 160.0 + time * 9.0);
        // vertical cells that flicker one at a time
        float cell = floor(uv.x * 22.0);
        float flick = step(0.93, h(cell + floor(time * 7.0 + seed * 13.0)));
        float base = 0.10 + 0.08 * lines + 0.35 * band + 0.25 * flick * (0.5 + 0.5 * lines);
        // a hit: white-hot flash plus a ring rippling out from the centre
        float r = length((uv - 0.5) * vec2(2.3, 1.0));
        float ring = hit * smoothstep(0.08, 0.0, abs(r - (1.0 - hit) * 1.2));
        float a = clamp(base + edge * 0.9 + hit * 0.6 + ring * 1.2, 0.0, 2.0);
        vec3 c = mix(color, vec3(1.0, 0.92, 0.75), clamp(hit * 0.7 + ring, 0.0, 1.0));
        gl_FragColor = vec4(c * a * 0.55, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createBarriers(parent, spots) {
  const drones = [];
  const amber = new THREE.Color(0xffa020).multiplyScalar(1.2);
  const beacons = lightPoints(spots.length * 2, { pixelMax: 24, fade: [200, 1500] });
  parent.add(beacons);
  const ready = new Promise((ok, no) =>
    new GLTFLoader().load(MODELS + "end2-approach-barrier.glb", (g) => ok(g.scene), undefined, no),
  ).then((model) => {
    spots.forEach((s, i) => {
      const d = model.clone(true);
      d.position.set(s.x, s.y, s.z);
      parent.add(d);
      const field = d.getObjectByName("field");
      field.material = fieldMaterial();
      field.material.uniforms.seed.value = i * 1.7;
      const eye = d.getObjectByName("eye");
      const glow = [];
      d.traverse((o) => {
        if (o.isMesh && (o.material.name === "bar_glow" || o.material.name === "barrier_eye")) {
          o.material = o.material.clone(); // per-drone flash
          glow.push([o.material, o.material.emissiveIntensity]);
        }
      });
      ["beacon_l", "beacon_r"].forEach((n, k) => {
        const p = d.getObjectByName(n).getWorldPosition(new THREE.Vector3());
        beacons.set(i * 2 + k, p, amber, 2.4, 0.9, i * 0.31 + k * 0.5, 0.25);
      });
      drones.push({ root: d, base: d.position.clone(), field, eye, fans: [d.getObjectByName("fan_l"), d.getObjectByName("fan_r")], glow, hit: 0, phase: i * 2.1 });
    });
    beacons.geometry.attributes.position.needsUpdate = true;
  });

  function update(t, dt, target, camera) {
    beacons.material.uniforms.time.value = t;
    if (camera) beacons.material.uniforms.scale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const d of drones) {
      // hold station: a slow bob and sway, the collision box stays where flight.js expects it
      d.root.position.set(d.base.x, d.base.y + Math.sin(t * 0.9 + d.phase) * 0.4, d.base.z);
      d.root.rotation.set(0, Math.sin(t * 0.35 + d.phase) * 0.04, Math.sin(t * 0.5 + d.phase) * 0.015);
      for (const [k, f] of d.fans.entries()) if (f) f.rotation.y += dt * (k ? -26 : 26);
      if (d.eye && target) d.eye.lookAt(target); // the sensor head tracks the incoming ship (+z = lens)
      d.hit = Math.max(0, d.hit - dt * 1.6);
      d.field.material.uniforms.time.value = t;
      d.field.material.uniforms.hit.value = d.hit;
      for (const [m, v] of d.glow) m.emissiveIntensity = v * (1 + 2.5 * d.hit);
    }
  }
  function hit(i) {
    if (drones[i]) drones[i].hit = 1;
  }
  return { ready, update, hit };
}
