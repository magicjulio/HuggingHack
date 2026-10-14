// Ch2 world: reset lasers = red-eyed scanner heads sweeping a red laser line (Julius 2026-10-14: "real red lasers beaming
// through it, like the laser scanner from the sandbox scorer"). Timing and hits: motion.js (waveStations, waveLine, waveHit).
// createLasers({ layout, U }) -> { object, stations, update(t, dt, state), dispose() }
//   stations  = motion.waveStations(layout): the Reset Run's (kind 'run') and the forge fight's lanes (kind 'lane')
//   state     { lanes: bool } shows the forge lanes (forge round 2+); default hidden. Run lasers always run.
// Look: on = hot thin core + faint sheath across the floor, the head's lens burns, a red fan from the lens down to the line.
// Resting = the line is gone, a dim dotted line marks where the next pass starts and the lens charges up (last 1.2 s).
// Run heads hang 6.2 m above their station and turn to follow the line; lane heads ride above the line (30 m across the island).
import * as THREE from 'three';
import { TAU, V, disposeTree } from './util.js';
import { waveStations, waveLine } from './motion.js';

export const LASER_RED = '#ff2a3a';
const HEAD_Y = { run: 6.2, lane: 7.5 };

export function createLasers({ layout, U }) {
  const object = new THREE.Group(); object.name = 'lasers';
  const RED = new THREE.Color(LASER_RED), red = (k) => RED.clone().multiplyScalar(k);
  const housing = new THREE.MeshStandardMaterial({ color: 0x14161b, metalness: .85, roughness: .32 });
  const fanMat = () => new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uCol: { value: red(1) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute float k; varying float vK; void main(){ vK = k; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uA; uniform vec3 uCol; varying float vK; void main(){ float a = (pow(vK, 2.)*.7 + .08)*uA; gl_FragColor = vec4(uCol*a*1.6, a); }`,
  });
  const beam = (len, r) => {  // a real laser: a hot thin core inside a faint wider sheath, lying along x
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 6, 1, true), new THREE.MeshBasicMaterial({ color: red(5) }));
    const sheath = new THREE.Mesh(new THREE.CylinderGeometry(r * 4, r * 4, len, 8, 1, true), new THREE.MeshBasicMaterial({ color: red(1.2), transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending }));
    core.rotation.z = sheath.rotation.z = Math.PI / 2; g.add(core, sheath); return g;
  };

  const stations = waveStations(layout).map((st) => {
    const len = st.half * 2 + 1.0, yaw = Math.atan2(st.dir[0], st.dir[1]);  // local x of the groups = side
    const line = beam(len, st.kind === 'lane' ? .05 : .04); line.rotation.y = yaw; object.add(line);
    const dots = new THREE.Mesh(new THREE.PlaneGeometry(len, .12), new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 }, uCol: { value: red(2.2) }, uN: { value: Math.round(len * 3) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vUv; uniform float uA, uN; uniform vec3 uCol; void main(){ float a = step(.55, fract(vUv.x*uN))*uA; gl_FragColor = vec4(uCol*a, a); }`,
    }));
    dots.rotation.x = -Math.PI / 2; const dq = new THREE.Group(); dq.add(dots); dq.rotation.y = yaw; object.add(dq);
    // scanner head: hex housing, red lens looking down, a slow ring. Same family as the Ch1 scorer, smaller and meaner
    const head = new THREE.Group(); object.add(head);
    head.add(new THREE.Mesh(new THREE.CylinderGeometry(.62, .42, .5, 6), housing));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.3, .62, .22, 6), housing); cap.position.y = .36; head.add(cap);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(.24, 20, 12, 0, TAU, Math.PI / 2, Math.PI / 2), new THREE.MeshBasicMaterial({ color: red(1) })); lens.position.y = -.25; head.add(lens);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.85, .02, 4, 48), new THREE.MeshBasicMaterial({ color: red(1.4) })); ring.rotation.x = Math.PI / 2; head.add(ring);
    const fanGeo = new THREE.BufferGeometry(); fanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3)); fanGeo.setAttribute('k', new THREE.BufferAttribute(new Float32Array([0, 1, 1]), 1));
    const fan = new THREE.Mesh(fanGeo, fanMat()); fan.frustumCulled = false; object.add(fan);
    const edges = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3)), new THREE.LineBasicMaterial({ color: red(2.4), transparent: true, opacity: .8 })); edges.frustumCulled = false; object.add(edges);
    return { ...st, parts: [line, dq, head, fan, edges], line, dq, dots, head, lens, ring, fan, edges };
  });

  const c = V(0, 0, 0), hp = V(0, 0, 0), side = V(0, 0, 0), l = V(0, 0, 0), r = V(0, 0, 0), apex = V(0, 0, 0);
  return {
    object, stations,
    update(t, dt, state = {}) {
      for (const w of stations) {
        const vis = w.kind === 'run' || !!state.lanes;
        for (const p of w.parts) p.visible = vis;
        if (!vis) continue;
        const s = waveLine(w, t); c.set(...s.centre); side.set(w.side[0], 0, w.side[1]);
        const flick = .75 + .25 * Math.sin(t * 60 + w.offset * 9);
        w.line.visible = s.on; w.line.position.copy(c).y += .05;
        w.dq.visible = !s.on; w.dq.position.copy(c).y += .04; w.dots.material.uniforms.uA.value = .18 + .8 * s.charge * (.6 + .4 * Math.sin(t * 22));
        const H = HEAD_Y[w.kind] + Math.sin(t * .9 + w.offset) * .15;
        if (w.kind === 'run') hp.set(w.at[0], w.at[1] + H, w.at[2]); else hp.copy(c).y += H;
        w.head.position.copy(hp); w.head.lookAt(c.x, hp.y, c.z); w.head.rotateX(Math.atan2(w.kind === 'run' ? s.along : 0, H) * .5);
        w.ring.rotation.z = t * (s.on ? 4 : .6);
        w.lens.material.color.copy(RED).multiplyScalar(s.on ? 5 * flick : .5 + 3 * s.charge);
        apex.copy(hp).y -= .4; l.copy(c).addScaledVector(side, -(w.half + .5)); r.copy(c).addScaledVector(side, w.half + .5);
        const fp = w.fan.geometry.attributes.position; fp.setXYZ(0, apex.x, apex.y, apex.z); fp.setXYZ(1, l.x, l.y + .05, l.z); fp.setXYZ(2, r.x, r.y + .05, r.z); fp.needsUpdate = true;
        const ep = w.edges.geometry.attributes.position; ep.setXYZ(0, apex.x, apex.y, apex.z); ep.setXYZ(1, l.x, l.y + .05, l.z); ep.setXYZ(2, apex.x, apex.y, apex.z); ep.setXYZ(3, r.x, r.y + .05, r.z); ep.needsUpdate = true;
        w.fan.visible = w.edges.visible = s.on; w.fan.material.uniforms.uA.value = flick;
      }
    },
    dispose() { disposeTree(object); },
  };
}
