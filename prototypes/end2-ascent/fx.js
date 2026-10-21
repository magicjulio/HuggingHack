import * as THREE from "three";

// ---------------------------------------------------------------------------------------------------------------
// ASCENT combat effects. Everything is pooled: after createFx() nothing is allocated per shot, per hit or per kill.
//
//   const fx = createFx(scene);                              // once, when the actors are created
//   const handle = fx.bolt(from, dir, "gunner", muzzle?);    // enemy projectile; returns a bare Object3D already in the scene
//   handle.position.addScaledVector(v, dt);                  //   the game moves the handle, fx draws the bolt around it
//   scene.remove(handle);                                    //   the game removes it (hit, cover, expiry); fx frees the slot
//                                                            //   and, unless it expired in flight, spawns an impact
//   fx.muzzle(defenderModel | object3d, "gunner");           // muzzle flash + barrel kick
//   fx.impact(at, normal, kind);                             // "cover" | "armour" | "rifle" | "rifle-armour" | "shield" | "player"
//   fx.shieldHit(defenderModel, dirToShooter);               // ripple on the hard-light pane + deflection sparks
//   fx.death(at, kind, floorY);                              // defender break-apart burst
//   fx.spark(at, dir, colorHex, n)                           // generic spark spray
//   fx.update(dt, time);                                     // once per frame (no camera needed: billboards are done in the shaders)
//   fx.clear();  fx.dispose();  fx.stats();
//
// Bolt kinds (BOLT_KINDS): "gunner", "shield", "heavy" (enemy fire, hot orange/amber/red, blooms) and "ally"
// (friendly green, kept under the bloom threshold: agents never bloom).
// Drawing cost: 2 instanced meshes (bolt tails, billboards), 2 point clouds, 1 line set, 1 instanced shard mesh,
// 1 instanced decal mesh = 7 draw calls however many bolts and bursts are alive.
// ---------------------------------------------------------------------------------------------------------------

export const BOLT_KINDS = {
  gunner: { color: 0xff4d12, core: 0xffd9a0, len: 3.0, width: 0.28, head: 0.46, hdr: 1.2 },
  shield: { color: 0xff9a14, core: 0xffe9b0, len: 2.4, width: 0.3, head: 0.5, hdr: 1.2 },
  heavy: { color: 0xff2e46, core: 0xffd0c8, len: 4.0, width: 0.4, head: 0.7, hdr: 1.8 },
  ally: { color: 0x39ff9c, core: 0xe8fff2, len: 1.6, width: 0.12, head: 0.34, hdr: 0.85 },
};

const IMPACTS = {
  // sparks (n), speed range, spark colour, flash colour, flash size, smoke puffs, decal tint
  cover: { n: 10, v: [2.5, 8], c: 0xff9a3a, flash: 0xffb060, fs: 0.9, smoke: 3, decal: 0xff7a22 },
  armour: { n: 12, v: [3, 9], c: 0xffe08a, flash: 0xfff0c0, fs: 1.1, smoke: 0, decal: 0 },
  rifle: { n: 8, v: [2, 7], c: 0x9affc4, flash: 0xb8ffd8, fs: 0.8, smoke: 2, decal: 0x39ff9c },
  "rifle-armour": { n: 10, v: [3, 9], c: 0xffe08a, flash: 0xfff0c0, fs: 1.0, smoke: 0, decal: 0 },
  shield: { n: 9, v: [3, 10], c: 0xffd070, flash: 0xffe9b0, fs: 1.1, smoke: 0, decal: 0 },
  player: { n: 7, v: [2, 6], c: 0xff6a4a, flash: 0xff8a6a, fs: 0.8, smoke: 0, decal: 0 },
};

const SHARD_COLORS = [0xd9a417, 0xd9a417, 0x2a3038, 0x2a3038, 0x59616c, 0x11161c];

// ---- scratch objects (module level, reused) ---------------------------------------------------------------------
const _v = new THREE.Vector3(),
  _v2 = new THREE.Vector3(),
  _p = new THREE.Vector3(),
  _t1 = new THREE.Vector3(),
  _t2 = new THREE.Vector3(),
  _q = new THREE.Quaternion(),
  _q2 = new THREE.Quaternion(),
  _m = new THREE.Matrix4(),
  _s = new THREE.Vector3(),
  _col = new THREE.Color(),
  _col2 = new THREE.Color(),
  Z = new THREE.Vector3(0, 0, 1),
  UP = new THREE.Vector3(0, 1, 0);

const _dbs = new THREE.Vector2();
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------------------------------------------
const STREAK_VS = /* glsl */ `
  attribute vec4 aColor; attribute vec2 aPar;
  varying vec2 vUv; varying vec4 vC; varying float vS;
  void main(){
    vUv = uv; vC = aColor; vS = aPar.x;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const STREAK_FS = /* glsl */ `
  uniform float time;
  varying vec2 vUv; varying vec4 vC; varying float vS;
  void main(){
    float across = abs(vUv.x - 0.5) * 2.0;
    float along = clamp(vUv.y, 0.0, 1.0);
    float w = mix(0.12, 1.0, smoothstep(0.2, 1.0, along));
    float prof = clamp(1.0 - across / w, 0.0, 1.0);
    float core = prof * prof * prof;
    float fade = along * along;
    float fl = 0.88 + 0.12 * sin(time * 70.0 + along * 14.0 + vS * 6.0);
    vec3 col = mix(vC.rgb, vec3(1.0, 0.93, 0.7), core * 0.55) * vC.a * fl;
    float a = clamp((prof * prof * 0.75 + core) * fade, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }`;
const GLOW_VS = /* glsl */ `
  attribute vec4 aColor; attribute vec2 aPar;
  varying vec2 vUv; varying vec4 vC; varying float vS; varying float vShape;
  void main(){
    vUv = uv; vC = aColor; vS = aPar.x; vShape = aPar.y;
    // billboard: instance position and uniform scale come from the matrix, the quad itself faces the camera
    vec4 mv = viewMatrix * vec4(instanceMatrix[3].xyz, 1.0);
    mv.xy += position.xy * length(instanceMatrix[0].xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const GLOW_FS = /* glsl */ `
  uniform float time;
  varying vec2 vUv; varying vec4 vC; varying float vS; varying float vShape;
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float v = 0.0;
    vec3 col = vC.rgb;
    if (vShape < 0.5) {                      // bolt head: hot core, halo, spinning broken ring
      float core = exp(-d * d * 16.0);
      float halo = exp(-d * d * 3.2) * 0.55;
      float ang = atan(p.y + 1e-5, p.x + 1e-5);
      float rr = (d - 0.55) / 0.08;
      float ring = exp(-rr * rr) * (0.5 + 0.5 * sin(ang * 3.0 + time * 18.0 + vS * 9.0)) * 0.8;
      v = core * 1.0 + halo + ring;
      col = mix(col, vec3(1.0, 0.93, 0.74), clamp(core, 0.0, 1.0) * 0.55);
    } else if (vShape < 1.5) {               // star flash, rotated by the seed
      float cs = cos(vS * 2.7), sn = sin(vS * 2.7);
      vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
      float ax = abs(q.x), ay = abs(q.y);
      float s1 = exp(-ay * 38.0) * exp(-ax * 2.2);
      float s2 = exp(-ax * 38.0) * exp(-ay * 2.2);
      float core = exp(-d * d * 10.0);
      v = core * 1.2 + (s1 + s2) * 0.9 + exp(-d * d * 2.0) * 0.3;
      col = mix(col, vec3(1.0), clamp(core, 0.0, 1.0) * 0.7);
    } else if (vShape < 2.5) {               // soft glow
      v = exp(-d * d * 4.0);
    } else {                                 // shockwave ring
      float rr = (d - 0.82) / 0.09;
      v = exp(-rr * rr) + 0.07 * (1.0 - d);
    }
    v *= 1.0 - smoothstep(0.92, 1.0, d);
    gl_FragColor = vec4(col * vC.a, clamp(v, 0.0, 1.0));
  }`;
const POINT_VS = /* glsl */ `
  attribute vec4 aColor; attribute float aSize;
  uniform float uScale;
  varying vec4 vC;
  void main(){
    vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(aSize * uScale / max(0.1, -mv.z), 1.0, 110.0);   // uScale = drawing-buffer height / 2 * projection[1][1]
    gl_Position = projectionMatrix * mv;
  }`;
const POINT_FS = /* glsl */ `
  uniform float uSoft;
  varying vec4 vC;
  void main(){
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    float a = exp(-d * uSoft) * (1.0 - smoothstep(0.7, 1.0, d));
    gl_FragColor = vec4(vC.rgb, vC.a * a);
  }`;

const BEAM_VS = /* glsl */ `
  attribute vec4 aColor; attribute vec2 aPar;
  varying vec2 vUv; varying vec4 vC; varying vec2 vP; varying float vLen;
  void main(){
    vUv = uv; vC = aColor; vP = aPar; vLen = length(instanceMatrix[2].xyz);
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const BEAM_FS = /* glsl */ `
  uniform float time;
  varying vec2 vUv; varying vec4 vC; varying vec2 vP; varying float vLen;
  void main(){
    float across = clamp(abs(vUv.x - 0.5) * 2.0, 0.0, 1.0);
    float d = clamp(vUv.y, 0.0, 1.0) * vLen;                       // metres from the start
    float seed = vP.x, st = vP.y;
    float ends = smoothstep(0.0, 0.3, d) * smoothstep(0.0, 0.5, vLen - d);
    vec3 col; float a;
    if (st < 0.5) {                               // 0 · Warden beam: white-hot core, flowing orange body
      float core = pow(1.0 - across, 3.5);
      float body = pow(1.0 - across, 1.3);
      float flow = 0.78 + 0.22 * sin(d * 4.0 - time * 55.0 + seed) + 0.12 * sin(d * 11.0 + time * 80.0);
      col = mix(vC.rgb, vec3(1.0, 0.9, 0.7), core * 0.75) * vC.a * flow;
      a = clamp(body * 0.8 + core * 0.6, 0.0, 1.0) * ends;
    } else if (st < 1.5) {                        // 1 · aim line: thin dashed laser that fills in while it charges
      float dash = smoothstep(0.3, 0.7, sin(d * 3.2 - time * 9.0) * 0.5 + 0.5);
      float line = pow(1.0 - across, 2.2);
      col = vC.rgb * vC.a * (0.6 + 0.4 * dash);
      a = line * (0.3 + 0.7 * dash) * ends;
    } else if (st < 2.5) {                        // 2 · tether: thin yellow line with bright packets running to the patient
      float ph = fract(d / 1.3 - time * 1.1);
      float pq = (ph - 0.5) * 5.5;
      float pk = exp(-pq * pq);
      float line = pow(1.0 - across, 2.5);
      col = vC.rgb * vC.a * (0.5 + 1.6 * pk);
      a = (line * (0.35 + 0.65 * pk)) * ends;
    } else {                                      // 3 · beacon column: soft, tall, slow stripes sliding down
      float soft = pow(1.0 - across, 1.2);
      float stripe = 0.72 + 0.28 * sin(d * 0.9 + time * 3.0);
      float taper = smoothstep(0.0, 6.0, d) * smoothstep(0.0, 0.8, vLen - d);
      col = vC.rgb * vC.a * stripe;
      a = soft * 0.55 * taper;
    }
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;
const MARK_VS = /* glsl */ `
  attribute vec4 aColor; attribute vec2 aPar;
  varying vec2 vUv; varying vec4 vC; varying vec2 vP;
  void main(){
    vUv = uv; vC = aColor; vP = aPar;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const MARK_FS = /* glsl */ `
  uniform float time;
  varying vec2 vUv; varying vec4 vC; varying vec2 vP;
  float line(float d, float r, float w){ float x = (d - r) / w; return exp(-x * x); }
  void main(){
    vec2 p = (vUv - 0.5) * 2.5;                   // 1.0 = the ring radius
    float d = length(p);
    float ang = atan(p.x + 1e-5, -p.y + 1e-5);                  // 0 at the top (-Z), clockwise seen from above
    float st = vP.x, prog = vP.y, al = vC.a;
    float v = 0.0;
    if (st < 0.5) {                               // 0 · lunge: red zone, fill shrinking toward the rim, hazard ticks
      float fillR = max(0.04, 1.0 - prog);
      float fill = (1.0 - smoothstep(fillR - 0.04, fillR, d)) * 0.3;
      float tick = smoothstep(0.5, 0.62, sin(ang * 16.0 + time * 1.5) * 0.5 + 0.5) * line(d, 0.9, 0.05);
      float pulse = 0.72 + 0.28 * sin(time * 30.0);
      v = line(d, 1.0, 0.035) * pulse + tick * 0.8 + fill + line(d, fillR, 0.03) * 0.7;
    } else if (st < 1.5) {                        // 1 · spawn: orange rim, a ring that keeps rising out of the floor
      float k = fract(time * 1.3);
      v = line(d, 1.0, 0.04) * 0.9 + line(d, 0.35 + k * 0.6, 0.03 + 0.03 * k) * (1.0 - k) + (1.0 - smoothstep(0.0, 1.0, d)) * 0.16
        + smoothstep(0.6, 0.8, sin(ang * 10.0 + time * 2.0) * 0.5 + 0.5) * line(d, 0.86, 0.06) * 0.5;
    } else if (st < 2.5) {                        // 2 · beacon: dashed rim that turns, a ring closing in as the drop nears
      float dash = smoothstep(0.35, 0.55, sin(ang * 12.0 - time * 1.4) * 0.5 + 0.5);
      float inner = max(0.08, 1.0 - prog * 0.85);
      v = line(d, 1.0, 0.03) * (0.35 + 0.65 * dash) + line(d, inner, 0.025) * 0.8 + (1.0 - smoothstep(0.0, inner, d)) * 0.12;
    } else if (st < 3.5) {                        // 3 · shockwave: bright leading edge, soft wake behind it
      float wake = (1.0 - smoothstep(0.0, 1.0, d)) * 0.22 * smoothstep(0.55, 1.0, d + 0.45);
      v = line(d, 0.96, 0.05) * 1.2 + line(d, 0.86, 0.1) * 0.35 + wake;
    } else {                                      // 4 · hold zone: faint full ring, bright arc that fills clockwise
      float t = ang / 6.2831853; t = t < 0.0 ? t + 1.0 : t;
      float arc = step(t, prog) * smoothstep(1.0, 1.04, d) * (1.0 - smoothstep(1.14, 1.18, d));
      float hq = (t - prog) * 40.0;
      float head = exp(-hq * hq) * step(0.001, prog) * line(d, 1.1, 0.07);
      float tick = smoothstep(0.55, 0.65, sin(ang * 24.0) * 0.5 + 0.5) * line(d, 0.95, 0.03);
      v = line(d, 1.0, 0.02) * 0.5 + arc * 1.1 + head * 1.6 + tick * 0.35 + (1.0 - smoothstep(0.0, 1.0, d)) * 0.07;
    }
    v *= 1.0 - smoothstep(1.17, 1.25, d);
    gl_FragColor = vec4(vC.rgb * al, clamp(v * al, 0.0, 1.0));
  }`;
const DECAL_VS = /* glsl */ `
  attribute vec4 aColor; attribute vec2 aPar;
  varying vec2 vUv; varying vec4 vC; varying float vA;
  void main(){
    vUv = uv; vC = aColor; vA = aPar.x;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }`;
const DECAL_FS = /* glsl */ `
  varying vec2 vUv; varying vec4 vC; varying float vA;   // vA = age 0..1
  float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main(){
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float ang = atan(p.y + 1e-5, p.x + 1e-5);
    float ragged = 0.78 + 0.22 * h(vec2(floor(ang * 5.0 + 20.0), vC.a));
    float body = 1.0 - smoothstep(0.35 * ragged, 0.95 * ragged, d);
    float hot = (1.0 - smoothstep(0.0, 0.45, d)) * clamp(1.0 - vA * 3.0, 0.0, 1.0);
    float fade = 1.0 - smoothstep(0.6, 1.0, vA);
    vec3 scorch = vec3(0.015, 0.012, 0.01);
    vec3 col = scorch + vC.rgb * hot * 2.5;
    gl_FragColor = vec4(col, clamp(body * 0.8 * fade + hot * 0.4, 0.0, 1.0));
  }`;

// ---------------------------------------------------------------------------------------------------------------
export function createFx(scene, opts = {}) {
  const uniforms = {
    time: { value: 0 },
    uScale: { value: 600 }, // point-sprite scale, refreshed in onBeforeRender from the real camera and drawing buffer
  };
  const frameHooks = []; // retained looks draw themselves through these every frame (see createFxLooks)
  let drawing = false;
  const root = new THREE.Group();
  root.name = "fx";
  scene.add(root);
  const disposables = [];
  const own = (o) => (disposables.push(o), o);

  // ===== instanced streaks (bolt tails, flares) and billboards (bolt heads, flashes, rings) ======================
  const MAX_BOLTS = 96,
    MAX_STREAK = MAX_BOLTS + 40,
    MAX_GLOW = MAX_BOLTS + 80;
  function instanced(geo, vs, fs, max) {
    const aColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    const aPar = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    aColor.setUsage(THREE.DynamicDrawUsage);
    aPar.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aColor", aColor);
    geo.setAttribute("aPar", aPar);
    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: vs,
      fragmentShader: fs,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const m = new THREE.InstancedMesh(geo, mat, max);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    m.renderOrder = 5;
    root.add(m);
    own(geo);
    own(mat);
    return { mesh: m, aColor, aPar, n: 0, max };
  }
  const streakGeo = new THREE.BufferGeometry();
  streakGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute([-0.5, 0, -1, 0.5, 0, -1, 0.5, 0, 0, -0.5, 0, 0, 0, -0.5, -1, 0, 0.5, -1, 0, 0.5, 0, 0, -0.5, 0], 3),
  );
  streakGeo.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1], 2));
  streakGeo.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  const streaks = instanced(streakGeo, STREAK_VS, STREAK_FS, MAX_STREAK);
  const glows = instanced(new THREE.PlaneGeometry(1, 1), GLOW_VS, GLOW_FS, MAX_GLOW);

  // Beams (Warden, aim line, tether, beacon column): three crossed quads along +Z, scaled to (width, width, length).
  const MAX_BEAM = 16,
    MAX_MARK = 48;
  const beamGeo = new THREE.BufferGeometry();
  {
    const pos = [], uvs = [], idx = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3,
        cx = Math.cos(a) * 0.5,
        cy = Math.sin(a) * 0.5,
        o = i * 4;
      pos.push(-cx, -cy, 0, cx, cy, 0, cx, cy, 1, -cx, -cy, 1);
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    beamGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    beamGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    beamGeo.setIndex(idx);
  }
  const beams = instanced(beamGeo, BEAM_VS, BEAM_FS, MAX_BEAM);
  // Floor marks (zone rings, shockwaves): one flat quad per ring, radius = scale / 2.5.
  const markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const marks = instanced(markGeo, MARK_VS, MARK_FS, MAX_MARK);
  marks.mesh.renderOrder = 3;
  marks.mesh.material.polygonOffset = true;
  marks.mesh.material.polygonOffsetFactor = -3;
  marks.mesh.material.polygonOffsetUnits = -3;

  function putBeam(a, b, width, style, r, g, bl, inten, seed) {
    if (beams.n >= beams.max) return;
    _v.subVectors(b, a);
    const len = _v.length();
    if (len < 0.02) return;
    _q.setFromUnitVectors(Z, _v.multiplyScalar(1 / len));
    _s.set(width, width, len);
    _m.compose(a, _q, _s);
    beams.mesh.setMatrixAt(beams.n, _m);
    beams.aColor.setXYZW(beams.n, r, g, bl, inten);
    beams.aPar.setXY(beams.n, seed, style);
    beams.n++;
  }
  /** Flat ring on the floor at `pos` (world), `style` 0 lunge · 1 spawn · 2 beacon · 3 shock · 4 hold. */
  function putMark(pos, radius, style, prog, r, g, b, alpha) {
    if (marks.n >= marks.max) return;
    _q.identity();
    _s.setScalar(radius * 2.5);
    _v.set(pos.x, pos.y + 0.04, pos.z);
    _m.compose(_v, _q, _s);
    marks.mesh.setMatrixAt(marks.n, _m);
    marks.aColor.setXYZW(marks.n, r, g, b, alpha);
    marks.aPar.setXY(marks.n, style, prog);
    marks.n++;
  }

  function putStreak(pos, dir, width, len, r, g, b, inten, seed) {
    if (streaks.n >= streaks.max) return;
    _q.setFromUnitVectors(Z, dir);
    _s.set(width, width, len);
    _m.compose(pos, _q, _s);
    streaks.mesh.setMatrixAt(streaks.n, _m);
    streaks.aColor.setXYZW(streaks.n, r, g, b, inten);
    streaks.aPar.setXY(streaks.n, seed, 0);
    streaks.n++;
  }
  function putGlow(pos, size, shape, r, g, b, inten, seed) {
    if (glows.n >= glows.max) return;
    _s.set(size, size, size);
    _m.compose(pos, _q.identity(), _s); // billboarded in the vertex shader
    glows.mesh.setMatrixAt(glows.n, _m);
    glows.aColor.setXYZW(glows.n, r, g, b, inten);
    glows.aPar.setXY(glows.n, seed, shape);
    glows.n++;
  }

  // ===== transient streaks / glows (muzzle flashes, impact flashes, shock rings) =================================
  const T_MAX = 96;
  const trans = Array.from({ length: T_MAX }, () => ({
    on: false, streak: false, ring: -1, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1),
    age: 0, life: 1, s0: 1, s1: 1, w: 0.2, shape: 1, r: 1, g: 1, b: 1, i0: 1, seed: 0, spin: 0, pow: 1.5,
  }));
  let tPtr = 0;
  function emitGlow(pos, shape, size0, size1, life, color, inten, spin = 0, pw = 1.5) {
    const t = trans[tPtr++ % T_MAX];
    _col.set(color);
    t.on = true; t.streak = false; t.ring = -1; t.pos.copy(pos); t.age = 0; t.life = life; t.s0 = size0; t.s1 = size1;
    t.shape = shape; t.r = _col.r; t.g = _col.g; t.b = _col.b; t.i0 = inten; t.seed = Math.random() * 6; t.spin = spin; t.pow = pw;
    return t;
  }
  function emitStreak(pos, dir, width, len0, len1, life, color, inten) {
    const t = trans[tPtr++ % T_MAX];
    _col.set(color);
    t.on = true; t.streak = true; t.ring = -1; t.pos.copy(pos); t.dir.copy(dir); t.age = 0; t.life = life; t.w = width; t.s0 = len0; t.s1 = len1;
    t.r = _col.r; t.g = _col.g; t.b = _col.b; t.i0 = inten; t.seed = Math.random() * 6; t.pow = 1.2;
    return t;
  }

  /** One-shot floor ring (shockwave, order ping): radius r0 -> r1 over `life`. */
  function emitRing(pos, style, r0, r1, life, color, alpha) {
    const t = trans[tPtr++ % T_MAX];
    _col.set(color);
    t.on = true; t.streak = false; t.ring = style; t.pos.copy(pos); t.age = 0; t.life = life; t.s0 = r0; t.s1 = r1;
    t.r = _col.r; t.g = _col.g; t.b = _col.b; t.i0 = alpha; t.pow = 0.8;
    return t;
  }

  // ===== bolts ===================================================================================================
  const bolts = Array.from({ length: MAX_BOLTS }, () => ({
    on: false, h: null, kind: BOLT_KINDS.gunner, prev: new THREE.Vector3(), origin: new THREE.Vector3(),
    dir: new THREE.Vector3(0, 0, 1), off: new THREE.Vector3(), age: 0, seed: 0, r: 1, g: 1, b: 1, tr: 1, tg: 1, tb: 1,
  }));
  let bPtr = 0;
  function onRemoved(ev) {
    const h = ev.target;
    const b = h.userData.fxBolt;
    if (!b || !b.on || b.h !== h) return;
    b.on = false;
    h.userData.fxBolt = null;
    h.removeEventListener("removed", onRemoved);
    // Hit something (cover, a body, a shield) unless it simply expired in flight.
    if (b.age < 2.7 && b.origin.distanceToSquared(h.position) > 0.25) {
      _t1.copy(b.dir).negate();
      impact(h.position, _t1, h.userData.fxImpact || "cover", true);
    }
  }
  /** Spawn an enemy bolt. `muzzle` (optional Object3D): the visual starts at the barrel and converges on the real line. */
  function bolt(from, dir, kind = "gunner", muzzle = null, handle = null) {
    const k = BOLT_KINDS[kind] || BOLT_KINDS.gunner;
    let b = null;
    for (let i = 0; i < MAX_BOLTS; i++) {
      const c = bolts[(bPtr + i) % MAX_BOLTS];
      if (!c.on) {
        b = c;
        bPtr = (bPtr + i + 1) % MAX_BOLTS;
        break;
      }
    }
    const h = handle || new THREE.Object3D(); // only allocation: the handle the game keeps (one per shot, like the mesh it replaces)
    if (handle) h.userData.fxBolt = null;
    else h.position.copy(from);
    if (!b) b = bolts[bPtr++ % MAX_BOLTS]; // pool exhausted: recycle the oldest
    else b.on = true;
    if (b.h) {
      b.h.userData.fxBolt = null;
      b.h.removeEventListener("removed", onRemoved);
    }
    b.on = true;
    b.h = h;
    b.kind = k;
    b.prev.copy(from);
    b.origin.copy(from);
    b.dir.copy(dir).normalize();
    b.age = 0;
    b.seed = Math.random() * 6;
    _col.set(k.color);
    b.r = _col.r; b.g = _col.g; b.b = _col.b;
    _col.set(k.core);
    b.tr = _col.r; b.tg = _col.g; b.tb = _col.b;
    if (muzzle) {
      muzzle.updateWorldMatrix(true, false);
      muzzle.getWorldPosition(b.off).sub(from);
      if (b.off.lengthSq() > 4) b.off.set(0, 0, 0); // a muzzle far from the shot origin is not the shooter's: ignore it
    } else b.off.set(0, 0, 0);
    h.userData.fxBolt = b;
    h.userData.fxImpact = kind === "ally" ? "armour" : "cover";
    h.addEventListener("removed", onRemoved);
    scene.add(h);
    return h;
  }

  /** Release a bolt handle without an impact (the game already called impact itself, or the bolt just expired). */
  function freeBolt(h) {
    const b = h && h.userData.fxBolt;
    if (!b) return;
    if (b.h === h) b.on = false;
    h.userData.fxBolt = null;
    h.removeEventListener("removed", onRemoved);
  }

  // ===== particles ===============================================================================================
  function pointCloud(n, additive, soft) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3),
      col = new Float32Array(n * 4),
      size = new Float32Array(n);
    const aP = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const aC = new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage);
    const aS = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", aP);
    geo.setAttribute("aColor", aC);
    geo.setAttribute("aSize", aS);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: uniforms.uScale, uSoft: { value: soft } },
      vertexShader: POINT_VS,
      fragmentShader: POINT_FS,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    pts.onBeforeRender = (r, _s, cam) => {
      const rt = r.getRenderTarget();
      const h = rt ? rt.height : r.getDrawingBufferSize(_dbs).y;
      uniforms.uScale.value = h * 0.5 * cam.projectionMatrix.elements[5];
    };
    pts.renderOrder = additive ? 6 : 4;
    root.add(pts);
    own(geo);
    own(mat);
    const P = {
      n, ptr: 0, aP, aC, aS, pos, col, size,
      vel: new Float32Array(n * 3), life: new Float32Array(n), max: new Float32Array(n),
      s0: new Float32Array(n), s1: new Float32Array(n), c0: new Float32Array(n * 4), c1: new Float32Array(n * 4),
      grav: new Float32Array(n), drag: new Float32Array(n),
    };
    return P;
  }
  const embers = pointCloud(420, true, 3.2); // additive: ember dots, flashes of dust glow
  const smoke = pointCloud(96, false, 1.6); // normal blend: dark puffs
  function puff(P, x, y, z, vx, vy, vz, life, s0, s1, c0, a0, c1, a1, grav, drag) {
    const i = P.ptr++ % P.n;
    P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
    P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz;
    P.life[i] = P.max[i] = life; P.s0[i] = s0; P.s1[i] = s1; P.grav[i] = grav; P.drag[i] = drag;
    _col.set(c0); _col2.set(c1);
    P.c0[i * 4] = _col.r; P.c0[i * 4 + 1] = _col.g; P.c0[i * 4 + 2] = _col.b; P.c0[i * 4 + 3] = a0;
    P.c1[i * 4] = _col2.r; P.c1[i * 4 + 1] = _col2.g; P.c1[i * 4 + 2] = _col2.b; P.c1[i * 4 + 3] = a1;
  }
  function stepPoints(P, dt) {
    let any = false;
    for (let i = 0; i < P.n; i++) {
      let l = P.life[i];
      if (l <= 0) {
        if (P.size[i] !== 0) {
          P.size[i] = 0;
          P.col[i * 4 + 3] = 0;
          any = true;
        }
        continue;
      }
      any = true;
      l -= dt;
      P.life[i] = l;
      const k = 1 - l / P.max[i];
      const dr = Math.max(0, 1 - P.drag[i] * dt);
      P.vel[i * 3] *= dr; P.vel[i * 3 + 1] = P.vel[i * 3 + 1] * dr - P.grav[i] * dt; P.vel[i * 3 + 2] *= dr;
      P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
      if (l <= 0) {
        P.size[i] = 0;
        P.col[i * 4 + 3] = 0;
        continue;
      }
      P.size[i] = lerp(P.s0[i], P.s1[i], k);
      for (let c = 0; c < 4; c++) P.col[i * 4 + c] = lerp(P.c0[i * 4 + c], P.c1[i * 4 + c], k);
      P.col[i * 4 + 3] *= 1 - k * k; // plus the colour ramp's own alpha
    }
    if (any) {
      P.aP.needsUpdate = true;
      P.aC.needsUpdate = true;
      P.aS.needsUpdate = true;
    }
  }

  // ===== sparks: a streak (line) plus a hot head (ember point) ===================================================
  const SP = 320;
  const spark = {
    ptr: 0,
    pos: new Float32Array(SP * 3), vel: new Float32Array(SP * 3), life: new Float32Array(SP), max: new Float32Array(SP),
    col: new Float32Array(SP * 3), floorY: new Float32Array(SP),
  };
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new THREE.BufferAttribute(new Float32Array(SP * 6), 3).setUsage(THREE.DynamicDrawUsage);
  const lineCol = new THREE.BufferAttribute(new Float32Array(SP * 6), 3).setUsage(THREE.DynamicDrawUsage);
  lineGeo.setAttribute("position", linePos);
  lineGeo.setAttribute("color", lineCol);
  const lines = new THREE.LineSegments(
    lineGeo,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  lines.frustumCulled = false;
  lines.renderOrder = 6;
  root.add(lines);
  own(lineGeo);
  own(lines.material);
  function sparkAt(x, y, z, vx, vy, vz, color, life, floorY = -1e9) {
    const i = spark.ptr++ % SP;
    spark.pos[i * 3] = x; spark.pos[i * 3 + 1] = y; spark.pos[i * 3 + 2] = z;
    spark.vel[i * 3] = vx; spark.vel[i * 3 + 1] = vy; spark.vel[i * 3 + 2] = vz;
    spark.life[i] = spark.max[i] = life;
    _col.set(color);
    spark.col[i * 3] = _col.r; spark.col[i * 3 + 1] = _col.g; spark.col[i * 3 + 2] = _col.b;
    spark.floorY[i] = floorY;
  }
  function stepSparks(dt) {
    for (let i = 0; i < SP; i++) {
      let l = spark.life[i];
      const o = i * 6;
      if (l <= 0) {
        linePos.array[o] = linePos.array[o + 3] = 0;
        linePos.array[o + 1] = linePos.array[o + 4] = -999;
        linePos.array[o + 2] = linePos.array[o + 5] = 0;
        continue;
      }
      l -= dt;
      spark.life[i] = l;
      const vx = (spark.vel[i * 3] *= 1 - 1.2 * dt);
      const vy = (spark.vel[i * 3 + 1] = spark.vel[i * 3 + 1] * (1 - 1.2 * dt) - 9 * dt);
      const vz = (spark.vel[i * 3 + 2] *= 1 - 1.2 * dt);
      let x = (spark.pos[i * 3] += vx * dt),
        y = (spark.pos[i * 3 + 1] += vy * dt),
        z = (spark.pos[i * 3 + 2] += vz * dt);
      if (y < spark.floorY[i]) {
        spark.pos[i * 3 + 1] = y = spark.floorY[i];
        spark.vel[i * 3 + 1] = Math.abs(vy) * 0.4;
        spark.vel[i * 3] *= 0.6;
        spark.vel[i * 3 + 2] *= 0.6;
      }
      const k = clamp01(l / spark.max[i]);
      const len = 0.045 + 0.012 * Math.hypot(vx, vy, vz) * 0.3;
      linePos.array[o] = x; linePos.array[o + 1] = y; linePos.array[o + 2] = z;
      linePos.array[o + 3] = x - vx * len; linePos.array[o + 4] = y - vy * len; linePos.array[o + 5] = z - vz * len;
      const br = k * 2.2;
      lineCol.array[o] = spark.col[i * 3] * br; lineCol.array[o + 1] = spark.col[i * 3 + 1] * br; lineCol.array[o + 2] = spark.col[i * 3 + 2] * br;
      lineCol.array[o + 3] = spark.col[i * 3] * br * 0.15; lineCol.array[o + 4] = spark.col[i * 3 + 1] * br * 0.1; lineCol.array[o + 5] = spark.col[i * 3 + 2] * br * 0.05;
    }
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;
  }

  // ===== shards: instanced hull chunks for the death burst ======================================================
  const SH = 80;
  const shardGeo = new THREE.BoxGeometry(1, 1, 1);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.6, roughness: 0.45 });
  const shardMesh = new THREE.InstancedMesh(shardGeo, shardMat, SH);
  shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shardMesh.setColorAt(0, _col.set(0xffffff));
  for (let i = 0; i < SH; i++) shardMesh.setColorAt(i, _col.set(SHARD_COLORS[i % SHARD_COLORS.length]));
  shardMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  shardMesh.frustumCulled = false;
  shardMesh.count = 0;
  root.add(shardMesh);
  own(shardGeo);
  own(shardMat);
  const shards = Array.from({ length: SH }, () => ({
    life: 0, max: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), q: new THREE.Quaternion(), axis: new THREE.Vector3(), spin: 0,
    sc: new THREE.Vector3(), floorY: 0, rest: false,
  }));
  let shPtr = 0;
  function stepShards(dt) {
    let n = 0;
    for (let i = 0; i < SH; i++) {
      const s = shards[i];
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) continue;
      if (!s.rest) {
        s.vel.y -= 14 * dt;
        s.pos.addScaledVector(s.vel, dt);
        if (s.pos.y < s.floorY + s.sc.y * 0.5) {
          s.pos.y = s.floorY + s.sc.y * 0.5;
          if (Math.abs(s.vel.y) < 1.2) {
            s.rest = true;
            s.vel.set(0, 0, 0);
          } else s.vel.y *= -0.35;
          s.vel.x *= 0.6;
          s.vel.z *= 0.6;
          s.spin *= 0.5;
        }
        _q2.setFromAxisAngle(s.axis, s.spin * dt);
        s.q.premultiply(_q2);
      }
      const k = s.life / s.max;
      const sh = k < 0.25 ? k * 4 : 1;
      _s.copy(s.sc).multiplyScalar(sh);
      _m.compose(s.pos, s.q, _s);
      shardMesh.setMatrixAt(n, _m);
      shardMesh.setColorAt(n, _col.set(SHARD_COLORS[i % SHARD_COLORS.length]));
      n++;
    }
    shardMesh.count = n;
    shardMesh.instanceMatrix.needsUpdate = true;
    if (n && shardMesh.instanceColor) shardMesh.instanceColor.needsUpdate = true;
  }

  // ===== decals: scorch marks on surfaces (only when a surface normal is known) ==================================
  const DC = 40;
  const decalGeo = new THREE.PlaneGeometry(1, 1);
  const dAColor = new THREE.InstancedBufferAttribute(new Float32Array(DC * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const dAPar = new THREE.InstancedBufferAttribute(new Float32Array(DC * 2), 2).setUsage(THREE.DynamicDrawUsage);
  decalGeo.setAttribute("aColor", dAColor);
  decalGeo.setAttribute("aPar", dAPar);
  const decalMat = new THREE.ShaderMaterial({
    vertexShader: DECAL_VS,
    fragmentShader: DECAL_FS,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const decalMesh = new THREE.InstancedMesh(decalGeo, decalMat, DC);
  decalMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  decalMesh.frustumCulled = false;
  decalMesh.count = 0;
  decalMesh.renderOrder = 2;
  root.add(decalMesh);
  own(decalGeo);
  own(decalMat);
  const decals = Array.from({ length: DC }, () => ({
    life: 0, max: 9, pos: new THREE.Vector3(), q: new THREE.Quaternion(), size: 0.5, r: 1, g: 0.5, b: 0, seed: 0,
  }));
  let dPtr = 0;
  function decal(at, normal, color, size) {
    const d = decals[dPtr++ % DC];
    d.life = d.max = 9;
    d.pos.copy(normal).multiplyScalar(0.02).add(at);
    _q.setFromUnitVectors(Z, normal);
    _q2.setFromAxisAngle(Z, Math.random() * 6.28);
    d.q.copy(_q).multiply(_q2);
    d.size = size;
    _col.set(color);
    d.r = _col.r; d.g = _col.g; d.b = _col.b; d.seed = Math.random() * 5;
  }
  function stepDecals(dt) {
    let n = 0;
    for (let i = 0; i < DC; i++) {
      const d = decals[i];
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) continue;
      _s.set(d.size, d.size, d.size);
      _m.compose(d.pos, d.q, _s);
      decalMesh.setMatrixAt(n, _m);
      dAColor.setXYZW(n, d.r, d.g, d.b, d.seed);
      dAPar.setXY(n, 1 - d.life / d.max, 0);
      n++;
    }
    decalMesh.count = n;
    if (n) {
      decalMesh.instanceMatrix.needsUpdate = true;
      dAColor.needsUpdate = true;
      dAPar.needsUpdate = true;
    }
  }

  // ===== public effects ==========================================================================================
  function randomOnHemisphere(normal, out, spread = 1) {
    // normal + random tangent, unit-ish
    _t2.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1));
    _t2.addScaledVector(normal, -_t2.dot(normal)).normalize();
    return out.copy(normal).multiplyScalar(rnd(0.35, 1)).addScaledVector(_t2, spread * rnd(0.3, 1));
  }

  function spraySparks(at, normal, n, vmin, vmax, color, floorY) {
    for (let i = 0; i < n; i++) {
      randomOnHemisphere(normal, _v, 1.1);
      const sp = rnd(vmin, vmax);
      sparkAt(at.x, at.y, at.z, _v.x * sp, _v.y * sp, _v.z * sp, i % 4 === 0 ? 0xffffff : color, rnd(0.25, 0.6), floorY);
    }
  }

  /** Surface impact. `normal` points away from the surface (toward the shooter). Decal only when `normal` is real. */
  function impact(at, normal, kind = "cover", auto = false) {
    const k = IMPACTS[kind] || IMPACTS.cover;
    _p.copy(at);
    _t1.copy(normal);
    if (_t1.lengthSq() < 1e-6) _t1.set(0, 1, 0);
    _t1.normalize();
    emitGlow(_p, 1, k.fs * 0.5, k.fs, 0.1, k.flash, 2.4, Math.random() * 3);
    emitGlow(_p, 2, k.fs * 0.9, k.fs * 1.8, 0.16, k.c, 1.1);
    spraySparks(_p, _t1, k.n, k.v[0], k.v[1], k.c, -1e9);
    for (let i = 0; i < 4; i++) {
      randomOnHemisphere(_t1, _v, 0.8);
      puff(embers, _p.x, _p.y, _p.z, _v.x * 2, _v.y * 2, _v.z * 2, rnd(0.25, 0.5), 0.07, 0.02, k.c, 1.4, 0xff3000, 0.2, 3, 2);
    }
    for (let i = 0; i < k.smoke; i++) {
      randomOnHemisphere(_t1, _v, 0.5);
      puff(smoke, _p.x, _p.y, _p.z, _v.x * 0.8, _v.y * 0.8 + 0.5, _v.z * 0.8, rnd(0.5, 0.9), 0.18, 0.55, 0x2a2622, 0.55, 0x15120f, 0.0, -0.4, 1.5);
    }
    if (!auto && k.decal) decal(_p, _t1, k.decal, rnd(0.5, 0.8));
  }

  /** Muzzle flash at a world point, firing along `dir`. */
  function muzzleAt(pos, dir, kind = "gunner") {
    const k = BOLT_KINDS[kind] || BOLT_KINDS.gunner;
    const ally = kind === "ally";
    emitGlow(pos, 1, 0.5, ally ? 0.7 : 1.15, 0.075, k.core, ally ? 1.2 : 3.0);
    emitGlow(pos, 2, 0.8, 1.6, 0.13, k.color, ally ? 0.8 : 1.6);
    _v.copy(pos).addScaledVector(dir, 0.35);
    emitStreak(_v, dir, ally ? 0.25 : 0.5, 0.7, 1.4, 0.07, k.color, ally ? 1.0 : 2.2);
    if (!ally)
      for (let i = 0; i < 4; i++) {
        _t1.set(rnd(-0.3, 0.3), rnd(-0.3, 0.3), rnd(-0.3, 0.3)).add(dir).normalize();
        const sp = rnd(4, 9);
        sparkAt(pos.x, pos.y, pos.z, _t1.x * sp, _t1.y * sp, _t1.z * sp, k.color, rnd(0.15, 0.3));
      }
  }

  /** Muzzle flash at a barrel. `source` is a defender model ({ muzzle, kick }) or an Object3D facing +Z. */
  function muzzleFlash(source, kind = "gunner") {
    const obj = source.muzzle || source;
    if (!obj || !obj.getWorldPosition) return;
    obj.updateWorldMatrix(true, false);
    obj.getWorldPosition(_p);
    obj.getWorldQuaternion(_q);
    _v2.copy(Z).applyQuaternion(_q);
    muzzleAt(_p, _v2, kind);
    if (source.kick) source.kick();
  }

  /** Hit on a shield-bearer's pane. `dir` points from the shield-bearer toward the shooter. */
  function shieldHit(model, dir) {
    if (!model || !model.shieldRipple) return;
    const p = model.shieldRipple(dir, _p);
    if (!p) return;
    _t1.copy(dir);
    _t1.y *= 0.3;
    _t1.normalize();
    emitGlow(p, 2, 0.3, 0.8, 0.14, 0xffa020, 0.55);
    emitGlow(p, 1, 0.3, 0.5, 0.07, 0xffd890, 0.9, Math.random() * 3);
    spraySparks(p, _t1, 9, 3, 10, 0xffd070, -1e9);
  }

  // How big a kill reads, and how high each kind's body centre floats (so the shards land on the floor).
  const DEATH = {
    hugger: { sc: 0.7, shards: 9, centre: 0.95 },
    gunner: { sc: 1.0, shards: 14, centre: 1.38 },
    shield: { sc: 1.25, shards: 19, centre: 1.38 },
    maintainer: { sc: 0.85, shards: 11, centre: 2.3 },
    warden: { sc: 1.9, shards: 34, centre: 1.6 },
  };

  /** Defender destroyed: flash, shockwave, sparks, smoke, hull shards. `at` = body centre. */
  function death(at, kind = "gunner", floorY = null) {
    const D = DEATH[kind] || DEATH.gunner;
    const sc = D.sc;
    if (floorY === null) floorY = at.y - D.centre;
    _p.copy(at);
    emitGlow(_p, 2, 1.0 * sc, 3.0 * sc, 0.2, 0xffe6a0, 1.5);
    emitGlow(_p, 1, 0.9 * sc, 2.0 * sc, 0.1, 0xffffff, 2.2, Math.random() * 3);
    emitGlow(_p, 3, 0.8, 4.2 * sc, 0.45, 0xffb020, 1.0, 0, 1.0);
    _v.set(_p.x, floorY, _p.z);
    emitRing(_v, 3, 0.6, 4.2 * sc, 0.6, 0xff7a22, 1.0);
    const nSpark = Math.round(22 * sc);
    for (let i = 0; i < nSpark; i++) {
      _t1.set(rnd(-1, 1), rnd(-0.2, 1.1), rnd(-1, 1)).normalize();
      const sp = rnd(3, 11) * (0.8 + 0.2 * sc);
      sparkAt(_p.x, _p.y, _p.z, _t1.x * sp, _t1.y * sp, _t1.z * sp, i % 3 === 0 ? 0xffffff : 0xffb040, rnd(0.35, 0.85), floorY);
    }
    for (let i = 0; i < Math.round(16 * sc); i++) {
      _t1.set(rnd(-1, 1), rnd(-0.1, 1), rnd(-1, 1)).normalize();
      const sp = rnd(1.5, 6);
      puff(embers, _p.x, _p.y, _p.z, _t1.x * sp, _t1.y * sp, _t1.z * sp, rnd(0.5, 1.1), 0.12, 0.03, 0xffc040, 1.6, 0xff3000, 0.1, 6, 1.4);
    }
    for (let i = 0; i < Math.round(7 * sc); i++) {
      _t1.set(rnd(-1, 1), rnd(0.1, 1), rnd(-1, 1)).normalize();
      puff(smoke, _p.x, _p.y, _p.z, _t1.x * 1.6, _t1.y * 1.6 + 0.8, _t1.z * 1.6, rnd(0.9, 1.5), 0.35 * sc, 1.2 * sc, 0x302a24, 0.7, 0x14110e, 0.0, -0.5, 1.8);
    }
    for (let i = 0; i < D.shards; i++) {
      const s = shards[shPtr++ % SH];
      s.life = s.max = rnd(1.3, 2.2);
      s.pos.copy(_p).add(_t1.set(rnd(-0.25, 0.25), rnd(-0.25, 0.25), rnd(-0.25, 0.25)));
      _t1.set(rnd(-1, 1), rnd(0.2, 1.3), rnd(-1, 1)).normalize().multiplyScalar(rnd(3, 8));
      s.vel.copy(_t1);
      s.q.setFromAxisAngle(_t2.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(), rnd(0, 6.28));
      s.axis.set(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize();
      s.spin = rnd(6, 18);
      s.sc.set(rnd(0.08, 0.26), rnd(0.03, 0.09), rnd(0.1, 0.3)).multiplyScalar(0.8 + 0.35 * sc);
      s.floorY = floorY;
      s.rest = false;
    }
  }

  /** Generic spark spray. `dir` is the spray axis. */
  function sparkBurst(at, dir, color = 0xffb040, n = 8) {
    _t1.copy(dir).normalize();
    spraySparks(at, _t1, n, 3, 9, color, -1e9);
  }

  // ---- named one-shots used by the looks mapping --------------------------------------------------------------
  /** Beacon drop lands: green shockwave out to `radius`, dust, sparks. */
  function shock(at, radius = 7) {
    emitRing(at, 3, 0.5, radius, 0.55, 0x39ff9c, 0.85);
    emitGlow(_p.set(at.x, at.y + 0.3, at.z), 2, 1.5, radius * 0.5, 0.25, 0x9affc4, 1.0);
    emitGlow(_p, 1, 1.0, 2.6, 0.12, 0xffffff, 2.4, Math.random() * 3);
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * 6.2832 + rnd(-0.1, 0.1);
      const sp = rnd(5, 12);
      sparkAt(at.x, at.y + 0.1, at.z, Math.cos(a) * sp, rnd(1, 4), Math.sin(a) * sp, i % 3 === 0 ? 0xffffff : 0x9affc4, rnd(0.3, 0.6), at.y);
    }
    for (let i = 0; i < 6; i++) {
      const a = rnd(0, 6.28);
      puff(smoke, at.x, at.y + 0.2, at.z, Math.cos(a) * 2.5, rnd(0.2, 1), Math.sin(a) * 2.5, rnd(0.6, 1.1), 0.4, 1.4, 0x2a3a30, 0.5, 0x101814, 0.0, -0.3, 1.8);
    }
  }
  /** Squad order: a small green ping ring on the floor and a rising spark column at the focus. */
  function order(at, floorY = at.y - 1.0) {
    _v.set(at.x, floorY, at.z);
    emitRing(_v, 2, 0.25, 1.5, 0.5, 0x39ff9c, 0.8);
    emitGlow(at, 1, 0.5, 0.9, 0.15, 0xc8ffe0, 1.4, Math.random() * 3);
    for (let i = 0; i < 8; i++)
      puff(embers, at.x + rnd(-0.3, 0.3), floorY + 0.1, at.z + rnd(-0.3, 0.3), 0, rnd(1.5, 3.5), 0, rnd(0.4, 0.8), 0.09, 0.02, 0x39ff9c, 0.9, 0x39ff9c, 0.0, -1, 1.0);
  }
  /** Maintainer heals a defender: yellow motes lift off the patient. */
  function heal(at) {
    emitGlow(at, 2, 0.4, 1.2, 0.3, 0xffd21e, 1.2);
    for (let i = 0; i < 9; i++)
      puff(embers, at.x + rnd(-0.35, 0.35), at.y + rnd(-0.5, 0.2), at.z + rnd(-0.35, 0.35), rnd(-0.3, 0.3), rnd(0.8, 2.2), rnd(-0.3, 0.3), rnd(0.5, 0.9), 0.11, 0.03, 0xffd21e, 1.3, 0xffa000, 0.0, -0.6, 1.2);
  }
  /** Critical hit: a yellow star flash with a few sparks. */
  function crit(at) {
    emitGlow(at, 1, 0.6, 1.5, 0.14, 0xfff07a, 3.0, Math.random() * 3);
    sparkBurst(at, _t2.set(0, 1, 0), 0xfff07a, 8);
  }
  /** Warden beam hits a surface: a short red-orange spark spit. */
  function beamEnd(at) {
    emitGlow(at, 1, 0.3, 0.6, 0.07, 0xffd8c0, 1.8, Math.random() * 3);
    sparkBurst(at, _t2.set(rnd(-0.6, 0.6), 1, rnd(-0.6, 0.6)), 0xff7a3a, 4);
  }

  // ===== per frame ===============================================================================================
  function update(dt, time) {
    uniforms.time.value = time;
    streaks.n = 0;
    glows.n = 0;
    beams.n = 0;
    marks.n = 0;
    // bolts
    for (let i = 0; i < MAX_BOLTS; i++) {
      const b = bolts[i];
      if (!b.on) continue;
      const h = b.h;
      b.age += dt;
      _v.copy(h.position).sub(b.prev);
      const moved = _v.lengthSq();
      if (moved > 1e-8) {
        b.dir.copy(_v).multiplyScalar(1 / Math.sqrt(moved));
        b.prev.copy(h.position);
      }
      const travelled = b.origin.distanceTo(h.position);
      const conv = Math.max(0, 1 - travelled / 7);
      _p.copy(h.position).addScaledVector(b.off, conv);
      const k = b.kind;
      const grow = Math.min(1, 0.35 + b.age * 7);
      putStreak(_p, b.dir, k.width * grow, k.len * grow, b.r, b.g, b.b, k.hdr, b.seed);
      putGlow(_p, k.head * (0.85 + 0.15 * Math.sin(time * 40 + b.seed)), 0, b.r, b.g, b.b, k.hdr, b.seed);
    }
    // transients
    for (let i = 0; i < T_MAX; i++) {
      const t = trans[i];
      if (!t.on) continue;
      t.age += dt;
      if (t.age >= t.life) {
        t.on = false;
        continue;
      }
      const k = t.age / t.life;
      const e = 1 - (1 - k) * (1 - k);
      if (t.ring >= 0) putMark(t.pos, lerp(t.s0, t.s1, e), t.ring, k, t.r, t.g, t.b, t.i0 * Math.pow(1 - k, t.pow));
      else {
        const inten = t.i0 * Math.pow(1 - k, t.pow);
        if (t.streak) putStreak(t.pos, t.dir, t.w, lerp(t.s0, t.s1, e), t.r, t.g, t.b, inten, t.seed);
        else putGlow(t.pos, lerp(t.s0, t.s1, e), t.shape, t.r, t.g, t.b, inten, t.seed);
      }
    }
    // retained looks (beams, zone rings) draw themselves for this frame
    drawing = true;
    for (const f of frameHooks) f(time);
    drawing = false;
    for (const S of [streaks, glows, beams, marks]) {
      S.mesh.count = S.n;
      S.mesh.instanceMatrix.needsUpdate = true;
      S.aColor.needsUpdate = true;
      S.aPar.needsUpdate = true;
    }
    stepPoints(embers, dt);
    stepPoints(smoke, dt);
    stepSparks(dt);
    stepShards(dt);
    stepDecals(dt);
  }

  function clear() {
    for (const b of bolts) {
      if (b.on && b.h) {
        b.h.userData.fxBolt = null;
        b.h.removeEventListener("removed", onRemoved);
      }
      b.on = false;
    }
    for (const t of trans) t.on = false;
    embers.life.fill(0);
    smoke.life.fill(0);
    spark.life.fill(0);
    for (const s of shards) s.life = 0;
    for (const d of decals) d.life = 0;
  }

  return {
    bolt,
    freeBolt,
    muzzle: muzzleFlash,
    muzzleAt,
    impact,
    shieldHit,
    death,
    spark: sparkBurst,
    shock,
    order,
    heal,
    crit,
    beamEnd,
    update,
    clear,
    /** Register a function(time) that draws retained looks each frame through `draw`. */
    onFrame(fn) {
      frameHooks.push(fn);
    },
    /** Immediate-mode drawing, only valid inside an onFrame callback. */
    draw: { beam: putBeam, ring: putMark, glow: putGlow },
    emit: { glow: emitGlow, ring: emitRing },
    stats() {
      return {
        bolts: bolts.filter((b) => b.on).length,
        streaks: streaks.n,
        glows: glows.n,
        beams: beams.n,
        marks: marks.n,
        sparks: spark.life.filter((l) => l > 0).length,
        embers: embers.life.filter((l) => l > 0).length,
        shards: shardMesh.count,
        decals: decalMesh.count,
        drawCalls: 9,
      };
    },
    dispose() {
      clear();
      scene.remove(root);
      disposables.forEach((d) => d.dispose && d.dispose());
      shardMesh.dispose();
      decalMesh.dispose();
      for (const S of [streaks, glows, beams, marks]) S.mesh.dispose();
    },
  };
}

// ===============================================================================================================
// createFxLooks(scene, opts): the looks.js interface (createDefaultLooks) on top of the pooled fx.
//   bolt(kind)            { root, update(dt, s), dispose() }       kinds: gunner | shield | heavy | ally (anything else = gunner)
//   beam(kind)            { root, set(a, b, s), hide(), dispose() } kinds: warden | warden-aim | tether | beacon
//   ring(kind)            { root, set(pos, s), hide(), dispose() }  kinds: lunge | spawn | beacon | shock | hold
//   impact(pos, kind)     bolt | muzzle | beam | shock | order | heal | crit | death-<enemy kind>
//   number(pos, text, kind)                                         hit | crit | blocked | heal
//   update(dt, time?)  clear()  dispose()
// Extras the default looks do not have (all optional for the caller):
//   looks.muzzle(model, kind)     flash at the real barrel and kick the barrel back (model = defender model)
//   looks.shieldHit(model, dir)   ripple on the hard-light pane + sparks (dir = shield-bearer -> shooter)
//   looks.fx                      the underlying createFx instance
//   opts.playerPos()              optional: returns the player's body centre; a bolt that ends within 1.1 m of it
//                                 gets the "player" hit instead of the cover hit
// Bolts are moved by the game through `look.root.position` exactly like before; the pooled bolt is bound to that
// root on the first update(), so nothing is allocated per shot except the root Object3D (as with the old mesh).
// ===============================================================================================================
export function createFxLooks(scene, opts = {}) {
  const fx = createFx(scene, opts);
  const liveBolts = new Set();
  const beams = new Set();
  const rings = new Set();
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  let clock = 0;

  const boltKind = (k) => (BOLT_KINDS[k] ? k : "gunner");

  function bolt(kind) {
    const root = new THREE.Object3D();
    const look = {
      root,
      kind: boltKind(kind),
      dir: V(0, 0, 1),
      bound: false,
      update(dt, s) {
        if (s && s.dir) look.dir.copy(s.dir);
        if (!look.bound && s && s.dir) {
          look.bound = true;
          fx.bolt(root.position, s.dir, look.kind, null, root); // the root itself is the handle fx draws around
          const b = root.userData.fxBolt;
          if (b) b.off.copy(s.dir).multiplyScalar(0.9).y -= 0.3; // visually leave the barrel (ahead of and below the body centre), converge on the true line
          liveBolts.add(look);
        }
      },
      dispose() {
        liveBolts.delete(look);
        fx.freeBolt(root);
        scene.remove(root);
      },
    };
    return look;
  }

  const _a = V(),
    _d = V(),
    _n = V();
  const BEAM = {
    warden: { style: 0, width: 0.5, color: 0xff3a1e, hdr: 1.35 },
    "warden-aim": { style: 1, width: 0.07, color: 0xff2e46, hdr: 1.4 },
    tether: { style: 2, width: 0.16, color: 0xffd21e, hdr: 1.0 },
    beacon: { style: 3, width: 1.1, color: 0x39ff9c, hdr: 0.62 }, // an agent effect: stays under the bloom threshold
  };
  const rgb = (hex) => ({ r: ((hex >> 16) & 255) / 255, g: ((hex >> 8) & 255) / 255, b: (hex & 255) / 255 });
  function beam(kind) {
    const def = BEAM[kind] || BEAM.tether;
    const c = rgb(def.color);
    const look = {
      root: new THREE.Object3D(),
      a: V(),
      b: V(),
      vis: false,
      k: 1,
      stamp: -9,
      seed: Math.random() * 6,
      set(a, b, s = {}) {
        look.a.copy(a);
        look.b.copy(b);
        look.k = s.intensity ?? 1;
        look.vis = true;
        look.stamp = clock;
      },
      hide() {
        look.vis = false;
      },
      dispose() {
        beams.delete(look);
      },
    };
    look.def = def;
    look.c = c;
    beams.add(look);
    return look;
  }
  fx.onFrame((time) => {
    for (const L of beams) {
      if (!L.vis || clock - L.stamp > 0.35) continue; // not refreshed for a while: treat as hidden
      const d = L.def,
        k = L.k;
      const w = d.style === 0 ? d.width * (0.6 + 0.4 * k) : d.style === 1 ? d.width * (0.5 + k) : d.width;
      fx.draw.beam(L.a, L.b, w, d.style, L.c.r, L.c.g, L.c.b, d.hdr * (d.style === 3 ? 0.4 + 0.6 * k : k), L.seed);
      if (d.style === 0) {
        // source glow at the projector and a hot flare where it lands
        const f = 0.85 + 0.15 * Math.sin(time * 60);
        fx.draw.glow(L.a, 0.8 * k * f, 2, 1, 0.35, 0.2, 1.0 * k, L.seed);
        fx.draw.glow(L.b, 1.3 * k * f, 1, 1, 0.55, 0.35, 1.1 * k, L.seed);
      } else if (d.style === 2) {
        fx.draw.glow(L.a, 0.55, 2, 1, 0.82, 0.12, 0.7, L.seed);
        fx.draw.glow(L.b, 0.7, 2, 1, 0.82, 0.12, 0.7, L.seed);
      } else if (d.style === 3) {
        fx.draw.glow(L.b, 1.6, 2, 0.22, 1, 0.61, 0.5 * k, L.seed); // base of the column
      }
    }
    for (const L of rings) {
      if (!L.vis || clock - L.stamp > 0.35) continue;
      fx.draw.ring(L.pos, L.radius, L.style, L.progress, L.c.r, L.c.g, L.c.b, L.alpha * L.hdr);
    }
  });

  const RING = {
    lunge: { style: 0, color: 0xff3b4e, hdr: 1.3 },
    spawn: { style: 1, color: 0xff9d00, hdr: 1.1 },
    beacon: { style: 2, color: 0x39ff9c, hdr: 0.8 },
    shock: { style: 3, color: 0x39ff9c, hdr: 0.85 },
    hold: { style: 4, color: 0x39ff9c, hdr: 0.8 },
  };
  function ring(kind) {
    const def = RING[kind] || RING.lunge;
    const look = {
      root: new THREE.Object3D(),
      pos: V(),
      radius: 1,
      progress: 0,
      alpha: 1,
      vis: false,
      stamp: -9,
      style: def.style,
      hdr: def.hdr,
      c: rgb(def.color),
      set(pos, s = {}) {
        look.pos.copy(pos);
        look.radius = s.radius ?? 1;
        look.progress = s.progress ?? 0;
        look.alpha = s.alpha ?? 1;
        look.vis = true;
        look.stamp = clock;
      },
      hide() {
        look.vis = false;
      },
      dispose() {
        rings.delete(look);
      },
    };
    rings.add(look);
    return look;
  }

  // ---- impacts -------------------------------------------------------------------------------------------------
  function nearestBolt(pos, maxD = 2.2) {
    let best = null,
      bd = maxD * maxD;
    for (const L of liveBolts) {
      const d = L.root.position.distanceToSquared(pos);
      if (d < bd) {
        bd = d;
        best = L;
      }
    }
    return best;
  }
  const DEATH_FLOOR = null;
  function impact(pos, kind = "bolt") {
    if (kind === "bolt") {
      const L = nearestBolt(pos);
      const k = L ? L.kind : "gunner";
      _n.copy(L ? L.dir : _d.set(0, 1, 0)).negate();
      const onPlayer = opts.playerPos && opts.playerPos().distanceToSquared(pos) < 1.21;
      fx.impact(pos, _n, onPlayer ? "player" : k === "ally" ? "armour" : "cover", true);
    } else if (kind === "muzzle") {
      const L = nearestBolt(pos, 0.6);
      if (!L) return;
      _a.copy(pos).addScaledVector(L.dir, 0.9).y -= 0.3;
      fx.muzzleAt(_a, L.dir, L.kind);
    } else if (kind === "beam") fx.beamEnd(pos);
    else if (kind === "shock") fx.shock(pos, 7.5);
    else if (kind === "order") fx.order(pos);
    else if (kind === "heal") fx.heal(pos);
    else if (kind === "crit") fx.crit(pos);
    else if (kind.startsWith("death")) fx.death(pos, kind.slice(6), DEATH_FLOOR);
  }

  // ---- floating numbers: 24 sprites with their own small canvas, re-drawn on use --------------------------------
  const NUM = 24;
  const numColors = { hit: "#f4f7f0", crit: "#fff07a", blocked: "#66daff", heal: "#ffd21e" };
  const numbers = Array.from({ length: NUM }, () => {
    const cv = document.createElement("canvas");
    cv.width = 128;
    cv.height = 48;
    const map = new THREE.CanvasTexture(cv);
    map.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false }));
    sp.renderOrder = 999;
    sp.visible = false;
    scene.add(sp);
    return { cv, map, sp, g: cv.getContext("2d"), life: 0, max: 0.7, start: V(), scale: 0.7 };
  });
  let nPtr = 0;
  function number(pos, text, kind = "hit") {
    const n = numbers[nPtr++ % NUM];
    const g = n.g;
    g.clearRect(0, 0, 128, 48);
    g.font = `700 ${kind === "crit" ? 34 : 28}px "Chakra Petch", Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 5;
    g.strokeStyle = "#000000aa";
    g.strokeText(text, 64, 24);
    g.fillStyle = numColors[kind] || numColors.hit;
    g.fillText(text, 64, 24);
    n.map.needsUpdate = true;
    n.start.copy(pos);
    n.start.x += (Math.random() - 0.5) * 0.5;
    n.start.y += 0.2;
    n.life = n.max = 0.7;
    n.scale = kind === "crit" ? 0.95 : 0.7;
    n.sp.visible = true;
  }

  return {
    fx,
    bolt,
    beam,
    ring,
    impact,
    number,
    muzzle: (model, kind) => fx.muzzle(model, boltKind(kind)),
    shieldHit: (model, dir) => fx.shieldHit(model, dir),
    update(dt, time) {
      clock += dt;
      fx.update(dt, time ?? clock);
      for (const n of numbers) {
        if (n.life <= 0) continue;
        n.life -= dt;
        if (n.life <= 0) {
          n.sp.visible = false;
          continue;
        }
        const t = 1 - n.life / n.max;
        n.sp.position.copy(n.start).y += t * 0.9;
        n.sp.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        n.sp.scale.set(n.scale * 2.67, n.scale, 1);
      }
    },
    clear() {
      fx.clear();
      for (const n of numbers) {
        n.life = 0;
        n.sp.visible = false;
      }
      for (const L of beams) L.vis = false;
      for (const L of rings) L.vis = false;
    },
    dispose() {
      fx.dispose();
      for (const n of numbers) {
        scene.remove(n.sp);
        n.map.dispose();
        n.sp.material.dispose();
      }
    },
  };
}
