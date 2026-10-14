// External designer (Codex, GPT-6.1): the three approved named NPCs from level.html.
// createNpcs({layout,U}) -> {object,byId,update(t,dt,state),dispose()}
// state.npcs[layout handle] = {pos:[x,y,z],talking:boolean,leaving?:boolean,visible?:boolean}
// pos is the world orb centre, not feet. App owns movement/exit and bubble/handle DOM.
// Without a supplied pos, layout.pos + 1.15m is used. Cosmetic hover is ±.1m.
import * as THREE from 'three';
import { C, TAU, V, VA, tagSprite, haloTex as getHaloTex } from './util.js';
import { createAgentKit } from './agents.js';
export function createNpcs({layout,U}) {
const object = new THREE.Group(); object.name = 'npcs';
const kit = createAgentKit(), {makeOrb,noBloom} = kit, haloTex = getHaloTex();
// --- c03220: the one who worked it out. An ice orb inside a turning wire icosahedron, HMAC letters orbiting like a hash being computed
function makeC03220() {
  const g = makeOrb(C.ice, .36, 0);
  const cage = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.78, 0)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(2.6) }));
  g.add(cage);
  const cage2 = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(1.05, 0)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.cyan).multiplyScalar(1.2), transparent: true, opacity: .6 }));
  g.add(cage2);
  const letters = [...'HMACSEED'].map((ch, i) => { const sp = tagSprite(ch, C.ice, { size: .22, frame: false, boost: 2.6 }); g.add(sp); return sp; });
  g.userData.update = (t) => {
    cage.rotation.set(t * .5, t * .7, 0); cage2.rotation.set(-t * .3, t * .2, t * .25);
    letters.forEach((sp, i) => { const a = t * 1.2 + i * TAU / 8; sp.position.set(Math.cos(a) * 1.35, Math.sin(a * 2 + i) * .18, Math.sin(a) * 1.35); });
  };
  return g;
}
// --- FLAC38347: from the older board. Faded, half-transparent, low-poly, scanlines; dashes circle it slowly
function makeFLAC() {
  const g = new THREE.Group();
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, uCol: { value: new THREE.Color(C.bone) }, uMax: { value: 99 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vN = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); vV = normalize(-mv.xyz); vW = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform float uTime, uMax; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float fr = pow(clamp(1.-abs(dot(vN, vV)),0.,1.), 2.); float scan = step(.5, fract(vW.y*14. - uTime*1.5));
        float flick = .7 + .3*step(.2, fract(sin(floor(uTime*9.)*91.7)*43758.5));
        gl_FragColor = vec4(min(uCol*(.22 + fr*2.2)*(.55+.45*scan)*flick, vec3(uMax)), 1.); }`,
  });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.56, 0), mat); g.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, color: new THREE.Color(C.bone).multiplyScalar(.5), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); halo.scale.setScalar(2.6); g.add(halo);
  const dashes = new THREE.Group(); g.add(dashes);
  for (let i = 0; i < 14; i++) { const d = new THREE.Mesh(new THREE.BoxGeometry(.16, .03, .03), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.bone).multiplyScalar(1.4), transparent: true, opacity: .7 })); const a = i * TAU / 14; d.position.set(Math.cos(a) * .85, 0, Math.sin(a) * .85); d.rotation.y = -a + Math.PI / 2; dashes.add(d); }
  g.userData = { color: new THREE.Color(C.bone), update: (t) => { core.rotation.set(t * .2, t * .3, 0); dashes.rotation.y = -t * .25; dashes.rotation.x = .3; g.visible = Math.sin(t * 7.3) * Math.sin(t * 2.9) < .97; } };
  return g;
}
// --- V8SAME: the one who proved it. Two gold cores circling each other: the captured flag and the computed one, the same
function makeV8SAME() {
  const g = new THREE.Group();
  const a = makeOrb(C.gold, .17, 0), b = makeOrb(C.gold, .17, 0); g.add(a, b);
  a.userData.halo.scale.setScalar(.7); b.userData.halo.scale.setScalar(.7);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .016, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(2.6) })); g.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(.62, .016, 6, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.gold).multiplyScalar(2.6) })); g.add(ring2);
  const eq = tagSprite('=', C.gold, { size: .3, frame: false, boost: 3 }); g.add(eq);
  g.userData = { color: new THREE.Color(C.gold), update: (t) => {
    const k = .42 + .08 * Math.sin(t * 1.3);
    a.position.set(Math.cos(t * 2.4) * k, Math.sin(t * 4.8) * .05, Math.sin(t * 2.4) * k); b.position.copy(a.position).multiplyScalar(-1);
    ring.rotation.set(Math.PI / 2 + Math.sin(t * .7) * .4, t * .4, 0); ring2.rotation.set(Math.PI / 2 - Math.sin(t * .7) * .4, -t * .4, 0);
  } };
  return g;
}

const factories = { c03220: makeC03220, FLAC38347: makeFLAC, V8SAME: makeV8SAME };
const byId = {};
for (const n of layout.npcs) {
  if (!factories[n.id]) continue;
  const o = noBloom(factories[n.id]()); o.name = n.id;
  const base = VA(n.pos).add(V(0, 1.15, 0)); o.position.copy(base); object.add(o);
  const anchor = new THREE.Object3D(); anchor.name = 'bubble_anchor'; anchor.position.y = 2.1; o.add(anchor);
  byId[n.id] = { object: o, anchor, base };
}
return { object, byId,
  update(t, dt, state = {}) {
    for (const [handle, n] of Object.entries(byId)) {
      const s = state.npcs?.[handle];
      n.object.visible = true;
      n.object.userData.update?.(t);
      if (s?.pos) n.object.position.fromArray(s.pos); else n.object.position.copy(n.base);
      n.object.position.y += Math.sin(t * 1.4 + handle.length) * .1;
      if (s?.visible === false) n.object.visible = false;
      // talking/leaving are accepted for the shared state contract; neither changes the approved idle art.
    }
  },
  dispose() { kit.dispose(object); },
};
}
