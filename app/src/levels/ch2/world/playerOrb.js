// Ch2 world: the player's orb (KAM1196A): green core, white-hot centre, two turning rings, halo, its own light, a contact
// shadow + ring on the floor below. The one thing in the world that blooms. Poison and the Step 7 flinch/drop live here.
// createPlayerOrb({ U, beats? }) -> { object, orb, update(t, dt, state), dispose() }
//   state { pos: [x, y, z] feet, grounded, glide, groundY (floor under the orb or null), poisoned 0..1, cutT (s, or null outside Step 7) }
//   object = orb + floor marks (add once); orb = the floating part (camera targets).
//   poisoned: 0 = green; 1 = green-black (Ch2 Step 7 on, carried into Ch3). Ramp it yourself (the cutscene: 0 -> 1 over 21.5-25 s).
//   cutT drives the one-shot moments as pure functions of time (scrubbable): flinch + glow contracts at beats.realisation,
//   drop in the air right after.
import * as THREE from 'three';
import { C, rand, V, haloTex, canvasTex, disposeTree } from './util.js';

export const ORB = { r: .34, hover: .62, drop: .7 };
const BEATS = { realisation: 21 };  // = app CUTSCENE.realisation
const ease = (x) => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);

export function createPlayerOrb({ U, beats = {} }) {
  const B = { ...BEATS, ...beats };
  const object = new THREE.Group(); object.name = 'playerOrb';
  const orb = new THREE.Group(); object.add(orb);
  const sphere = new THREE.IcosahedronGeometry(1, 3);
  const G = new THREE.Color(C.green), P = new THREE.Color(C.poison), PB = new THREE.Color(C.poisonBody);
  const coreM = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(3.2) });
  const core = new THREE.Mesh(sphere, coreM); core.scale.setScalar(ORB.r); orb.add(core);
  const hotM = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 6, 6) });
  const hot = new THREE.Mesh(sphere, hotM); hot.scale.setScalar(ORB.r * .45); orb.add(hot);
  // poison ink: a dark shell with slow noise holes the green glints through (0 = invisible)
  const inkM = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uInk: { value: 0 }, uDeep: { value: new THREE.Color(C.poisonDeep) }, uBody: { value: PB } }, transparent: true, depthWrite: false,
    vertexShader: `varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime, uInk; uniform vec3 uDeep, uBody; varying vec3 vP; varying vec3 vN; varying vec3 vV;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719)))*43758.5453); }
      float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
      void main(){ float n = n3(vP*3.2 + vec3(0., uTime*.25, 0.))*.65 + n3(vP*7. - uTime*.4)*.35;
        float rim = pow(1. - abs(dot(vN, vV)), 2.);
        float cover = smoothstep(.62 - uInk*.55, .66 - uInk*.5, n);                // more of the shell closes as the ink rises
        vec3 col = mix(uDeep, uBody, rim*.8);
        gl_FragColor = vec4(col, cover*uInk*.94 + rim*uInk*.3); }`,
  });
  const ink = new THREE.Mesh(sphere, inkM); ink.scale.setScalar(ORB.r * 1.06); orb.add(ink);
  const haloM = new THREE.SpriteMaterial({ map: haloTex(), color: G.clone().multiplyScalar(1.4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const halo = new THREE.Sprite(haloM); halo.scale.setScalar(ORB.r * 7); orb.add(halo);
  const rings = [0, 1].map((i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(ORB.r * (1.7 + i * .45), .012, 6, 64), new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.5) })); m.rotation.set(rand(0, 3), rand(0, 3), 0); orb.add(m); return m; });
  const light = new THREE.PointLight(0x39ff9c, 7, 8, 1.6); orb.add(light);
  // floor marks
  const shadowTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.95)'); gr.addColorStop(.6, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; object.add(shadow);
  const ringM = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.5), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const fring = new THREE.Mesh(new THREE.RingGeometry(.52, .58, 48), ringM); fring.rotation.x = -Math.PI / 2; object.add(fring);

  const col = new THREE.Color(), tmp = new THREE.Color();
  return {
    object, orb,
    update(t, dt, s = {}) {
      const pos = s.pos ?? [0, 0, 0], po = Math.max(0, Math.min(1, s.poisoned ?? 0)), c = s.cutT;
      // Step 7 one-shots (all zero outside the cutscene; after it, `poisoned` alone carries the look)
      const k = c == null ? -1 : c - B.realisation;
      const flinch = k < 0 ? 0 : Math.exp(-k * 5) * Math.sin(k * 38) * (k < .6 ? 1 : 0);        // a hard shudder, ~0.5 s
      const contract = k < 0 ? 0 : ease(k / .35) * (1 - .45 * ease((k - .4) / 1.6));             // glow snaps in, recovers a little
      const drop = k < 0 ? 0 : ORB.drop * ease((k - .25) / 1.1) + .08 * Math.sin(Math.max(0, k - 1.35) * 9) * Math.exp(-Math.max(0, k - 1.35) * 3) * (k > 1.35 ? 1 : 0);
      const live = s.cutT == null || k < 0;  // the hover bob + ring spin stop while the scene holds it
      const bob = live && s.grounded ? Math.sin(t * 1.8) * .07 : 0;
      orb.position.set(pos[0] + flinch * .06, pos[1] + ORB.hover + bob - drop, pos[2]);
      // colour: green -> green-black
      col.copy(G).lerp(P, po); coreM.color.copy(col).multiplyScalar(3.2 * (1 - .55 * po) * (1 - .45 * contract));
      hotM.color.setScalar(6 * (1 - .75 * po) * (1 - .5 * contract) + .2);
      inkM.uniforms.uInk.value = po;
      haloM.color.copy(tmp.copy(G).lerp(PB, po)).multiplyScalar(1.4 * (1 - .5 * po) * (1 - .6 * contract));
      halo.scale.setScalar(ORB.r * 7 * (1 - .55 * contract) * (1 - .25 * po));
      core.scale.setScalar(ORB.r * (1 - .14 * contract + flinch * .05));
      light.color.copy(tmp.copy(G).lerp(P, po)); light.intensity = 7 * (1 - .6 * po) * (1 - .5 * contract);
      const sq = s.glide ? 1.5 : 1;
      rings.forEach((r, i) => {
        const spin = live ? 1 : .15 * (1 - contract);
        r.rotation.x += dt * (.8 + i * .5) * spin; r.rotation.y += dt * (1.1 - i * .3) * spin; r.scale.setScalar(THREE.MathUtils.lerp(r.scale.x, sq * (1 - .2 * contract), Math.min(1, dt * 8)));
        r.material.color.copy(tmp.copy(G).lerp(P, po)).multiplyScalar(2.5 * (1 - .6 * po));
      });
      // floor marks
      const gy = s.groundY;
      shadow.visible = fring.visible = gy != null;
      if (gy != null) {
        shadow.position.set(pos[0], gy + .03, pos[2]); fring.position.set(pos[0], gy + .04, pos[2]);
        const kk = Math.max(.35, 1 - (orb.position.y - ORB.hover - gy) * .08); shadow.scale.setScalar(kk);
        ringM.color.copy(tmp.copy(G).lerp(P, po)).multiplyScalar(2.5 * (1 - .6 * po)); ringM.opacity = (.6 + .3 * Math.sin(t * 3)) * kk * (live ? 1 : .5);
      }
    },
    dispose() { disposeTree(object); },
  };
}
