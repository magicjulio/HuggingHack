import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { lightPoints } from "./hq.js";
import { bakePrefab, createInstancer } from "./flight-kit.js";
import { asset } from "./assets.js";

// Barrier picket drones on the approach (landing area; used by flight-combat.js), drawn instanced.
// end2-approach-barrier.glb: origin = field centre; the field is 27.7 x 12 m facing +z.
// createBarriers(parent, capacity) -> { ready, update(t, dt, drones, target, camera) }
//   drones: [{ x, y, z, alive, down (0..1 falling), hit (0..1 flash), field (0..1), phase }]
// fieldMaterial() is shared with the barrier gate (flight-combat.js): instanced, per instance
// attribute aField = (hit flash, seed, strength 0..1).
const MODELS = ""; // app port: asset(MODELS + name) resolves through assets.js

export function fieldMaterial(color = 0xff8a00) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, color: { value: new THREE.Color(color) } },
    vertexShader: /* glsl */ `
      attribute vec3 aField;
      varying vec2 vUv; varying vec3 vF;
      void main() {
        vUv = uv; vF = aField;
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: /* glsl */ `
      uniform float time; uniform vec3 color; varying vec2 vUv; varying vec3 vF;
      float h(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float hit = vF.x, seed = vF.y, on = vF.z;
        if (on <= 0.001) discard;
        vec2 uv = vUv;
        float ex = min(uv.x, 1.0 - uv.x), ey = min(uv.y, 1.0 - uv.y);
        float edge = exp(-ex * 40.0) + 0.5 * exp(-ey * 30.0);
        float band = smoothstep(0.82, 1.0, sin((uv.y * 6.0 - time * 1.4 + seed) * 6.2831) * 0.5 + 0.5);
        float lines = 0.5 + 0.5 * sin(uv.y * 160.0 + time * 9.0);
        float cell = floor(uv.x * 22.0);
        float flick = step(0.93, h(cell + floor(time * 7.0 + seed * 13.0)));
        float base = 0.10 + 0.08 * lines + 0.35 * band + 0.25 * flick * (0.5 + 0.5 * lines);
        float r = length((uv - 0.5) * vec2(2.3, 1.0));
        float ring = hit * smoothstep(0.08, 0.0, abs(r - (1.0 - hit) * 1.2));
        // collapsing: the field breaks up into flickering cells
        float alive = on < 0.999 ? step(h(cell * 7.0 + floor(time * 20.0)), on) : 1.0;
        float a = clamp(base + edge * 0.9 + hit * 0.6 + ring * 1.2, 0.0, 2.0) * on * alive;
        vec3 c = mix(color, vec3(1.0, 0.92, 0.75), clamp(hit * 0.7 + ring, 0.0, 1.0));
        gl_FragColor = vec4(c * a * 0.55, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

// An instanced field: one InstancedMesh with the aField attribute.
export function fieldInstances(parent, geometry, capacity, color) {
  const g = geometry.clone();
  const attr = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
  g.setAttribute("aField", attr);
  const mesh = new THREE.InstancedMesh(g, fieldMaterial(color), capacity);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  const Z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < capacity; i++) mesh.setMatrixAt(i, Z);
  parent.add(mesh);
  return {
    mesh,
    set(i, matrix, hit, seed, on) {
      mesh.setMatrixAt(i, on > 0 ? matrix : Z);
      attr.setXYZ(i, hit, seed, on);
    },
    commit(time) {
      mesh.material.uniforms.time.value = time;
      mesh.instanceMatrix.needsUpdate = true;
      attr.needsUpdate = true;
    },
  };
}

export function createBarriers(parent, capacity = 8) {
  const amber = new THREE.Color(0xffa020).multiplyScalar(1.2);
  const beacons = lightPoints(capacity * 2, { pixelMax: 24, fade: [200, 1500] });
  parent.add(beacons);
  let body = null,
    fans = null,
    eyes = null,
    fields = null;
  const local = {}; // part frames relative to the drone root
  const ready = new Promise((ok, no) =>
    new GLTFLoader().load(asset(MODELS + "end2-approach-barrier.glb"), (g) => ok(g.scene), undefined, no),
  ).then((model) => {
    const d = model.getObjectByName("end2-approach-barrier") || model.children[0] || model;
    d.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(d.matrixWorld).invert();
    for (const n of ["fan_l", "fan_r", "eye", "field", "beacon_l", "beacon_r"]) {
      const o = d.getObjectByName(n);
      local[n] = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    }
    body = createInstancer(parent, bakePrefab(d, { skip: ["fan_l", "fan_r", "eye", "field"] }), capacity, { name: "barrier" });
    fans = createInstancer(parent, bakePrefab(d.getObjectByName("fan_l")), capacity * 2, { name: "barrier-fan" });
    eyes = createInstancer(parent, bakePrefab(d.getObjectByName("eye")), capacity, { name: "barrier-eye" });
    const fieldGeo = bakePrefab(d.getObjectByName("field"))[0].geometry;
    fields = fieldInstances(parent, fieldGeo, capacity);
    // glow materials flash with hits: shared materials, so drive them by the strongest flash
    glowMats = [...body.meshes, ...eyes.meshes]
      .map((m) => m.material)
      .filter((m) => m.name === "bar_glow" || m.name === "barrier_eye")
      .map((m) => [m, m.emissiveIntensity]);
  });
  let glowMats = [];

  const M = new THREE.Matrix4(),
    P = new THREE.Matrix4(),
    R = new THREE.Matrix4(),
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    v = new THREE.Vector3(),
    s = new THREE.Vector3(1, 1, 1),
    eyeM = new THREE.Matrix4(),
    look = new THREE.Matrix4(),
    up = new THREE.Vector3(0, 1, 0);

  function update(t, dt, drones, target, camera) {
    beacons.material.uniforms.time.value = t;
    if (camera) beacons.material.uniforms.scale.value = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    if (!body) return;
    let flash = 0;
    drones.forEach((d, i) => {
      if (i >= capacity) return;
      const vis = d.visible !== false && d.down < 1;
      if (!vis) {
        body.hide(i);
        eyes.hide(i);
        fans.hide(i * 2);
        fans.hide(i * 2 + 1);
        fields.set(i, M, 0, 0, 0);
        beacons.set(i * 2, v.set(0, -1e5, 0), amber, 0);
        beacons.set(i * 2 + 1, v, amber, 0);
        return;
      }
      // hold station with a slow bob and sway; a dead drone tips over and drops
      const fall = d.down || 0;
      v.set(d.x, d.y + Math.sin(t * 0.9 + d.phase) * 0.4 - 60 * fall * fall, d.z);
      e.set(fall * 1.1, Math.sin(t * 0.35 + d.phase) * 0.04 + fall * 0.6, Math.sin(t * 0.5 + d.phase) * 0.015 + fall * 1.6);
      q.setFromEuler(e);
      M.compose(v, q, s);
      body.set(i, M);
      const spin = t * 26 * (1 - fall * 0.8);
      fans.set(i * 2, P.multiplyMatrices(M, local.fan_l).multiply(R.makeRotationY(spin)));
      fans.set(i * 2 + 1, P.multiplyMatrices(M, local.fan_r).multiply(R.makeRotationY(-spin)));
      // the sensor head tracks the incoming ship (+z = lens)
      eyeM.multiplyMatrices(M, local.eye);
      if (target && fall === 0) {
        const pos = new THREE.Vector3().setFromMatrixPosition(eyeM);
        look.lookAt(target, pos, up); // Matrix4.lookAt(eye, target) builds -z towards target: swap for +z
        eyeM.compose(pos, q.setFromRotationMatrix(look), s);
      }
      eyes.set(i, eyeM);
      fields.set(i, P.multiplyMatrices(M, local.field), d.hit || 0, i * 1.7, d.field ?? 1);
      for (const [k, n] of ["beacon_l", "beacon_r"].entries()) {
        v.setFromMatrixPosition(P.multiplyMatrices(M, local[n]));
        beacons.set(i * 2 + k, v, amber, fall > 0 ? 0 : 2.4, 0.9, i * 0.31 + k * 0.5, 0.25);
      }
      flash = Math.max(flash, d.hit || 0);
    });
    beacons.geometry.attributes.position.needsUpdate = true;
    beacons.geometry.attributes.aSize.needsUpdate = true;
    beacons.geometry.attributes.color.needsUpdate = true;
    beacons.geometry.attributes.aBlink.needsUpdate = true;
    body.commit();
    eyes.commit();
    fans.commit();
    fields.commit(t);
    for (const [m, base] of glowMats) m.emissiveIntensity = base * (1 + 1.5 * flash);
  }
  return { ready, update };
}
