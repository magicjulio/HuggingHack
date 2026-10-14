// Ch2 world: the Forge (highest point, centre): two-tier dais with a seam, four slot pylons (seed, 7731, TRAINING ROOM,
// CHALLENGE 5), three nested fold rings around a hot core, a beacon straight up, the round bar (3 arcs on the floor).
// createForge({ layout, U }) -> { object, core, slotPos, update(t, dt, state), dispose() }
//   state { power 0..1 (1 = running, 0 = dead; Step 7 powers it down over its first seconds), round 0..3, progress 0..1,
//           slots 0..4 filled, phase 'idle'|'proof'|'ready'|'forging'|'absorb'|'done' (= app ForgePhase), t (s in the phase),
//           orb: [x, y, z] the player orb's centre (absorb target) }
//   proof   (9 s) V8SAME's captured flag over the forged one, the 32 characters lighting up pair by pair, then MATCH
//   ready   the slots light up as you fill them (each shows what went in)
//   forging the four inputs orbit the core and fold into each other, faster and tighter each round; rings + core speed up
//   absorb  (2.5 s, "something wild") the flag bursts out of the core as 38 glowing characters and spirals into the orb
// ctx.flags = { v8: 'flag{…}', player: 'flag{…}' } (the app's V8SAME_FLAG / FLAG5)
//   slotPos[i] = world point of slot i's glowing frame (E target, where the item flies in) = layout.forge.slotPos
// Colliders are yours (layout.forge: dais tiers, pylons).
import * as THREE from 'three';
import { C, TAU, V, VA, tagSprite, haloTex, canvasTex, disposeTree } from './util.js';

export const PROOF_SECONDS = 9, ABSORB_SECONDS = 2.5;
const DEFAULT_FLAGS = { v8: 'flag{1f8b137165cfbd4014c9eda039cf882a}', player: 'flag{127aa18850ddec6a01b9e212737193fa}' };

export function createForge({ layout, U, flags = DEFAULT_FLAGS }) {
  const LF = layout.forge, object = new THREE.Group(); object.name = 'forge'; object.position.copy(VA(LF.pos));
  const G = new THREE.Color(C.green);
  const metal = new THREE.MeshStandardMaterial({ color: 0x0d1219, metalness: .85, roughness: .28 });
  const seam = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.2) });
  const [t1, t2] = [...LF.dais].sort((a, b) => b.r - a.r);  // outer, inner tier
  const dais = new THREE.Mesh(new THREE.CylinderGeometry(t1.r - .2, t1.r + .2, t1.y, 8), metal); dais.position.y = t1.y / 2; object.add(dais);
  const dais2 = new THREE.Mesh(new THREE.CylinderGeometry(t2.r - .1, t2.r + .3, t2.y - t1.y, 8), metal); dais2.position.y = t1.y + (t2.y - t1.y) / 2; object.add(dais2);
  const seamRing = new THREE.Mesh(new THREE.TorusGeometry(t1.r - .18, .035, 4, 8), seam); seamRing.rotation.x = Math.PI / 2; seamRing.rotation.z = Math.PI / 8; seamRing.position.y = t1.y; object.add(seamRing);
  // round bar: three arcs around the dais
  const bars = [0, 1, 2].map((i) => { const m = new THREE.Mesh(new THREE.RingGeometry(5.3, 5.6, 48, 1, i * TAU / 3 + .06, TAU / 3 - .12), new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.position.y = .06; object.add(m); return m; });
  // four slot pylons: an empty glowing frame each, what belongs there written dim underneath
  const frameM = new THREE.LineBasicMaterial({ color: G.clone().multiplyScalar(2.8) }), slotViews = [];
  LF.slots.forEach((name, i) => {
    const a = i * TAU / 4 + Math.PI / 4, r = LF.pylon?.radius ?? 3.0;
    const s = new THREE.Group(); s.position.set(Math.cos(a) * r, t2.y, Math.sin(a) * r); s.rotation.y = -a - Math.PI / 2; object.add(s);
    const body = new THREE.Mesh(new THREE.BoxGeometry(.9, 2.0, .5), metal); body.position.y = 1.0; s.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.1, .12, .62), metal); cap.position.y = 2.05; s.add(cap);
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.66, .9)), frameM); frame.position.set(0, 1.25, .26); s.add(frame);
    const holeM = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(.62, .86), holeM); hole.position.set(0, 1.25, .255); s.add(hole);
    const inLbl = tagSprite(name, C.green, { size: .16, frame: false, boost: 2.6 }); inLbl.position.set(0, 1.25, .3); inLbl.visible = false; s.add(inLbl);
    slotViews.push({ holeM, inLbl });
    const lbl = tagSprite(name, C.green, { size: .2, frame: false, boost: 1.0 }); lbl.position.set(0, .45, .4); s.add(lbl);
  });
  // the fold: three nested rings of segments, one per round, turning on different axes around a hot core
  const CY = 4.4;
  const coreM = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(2.2) });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(.55, 2), coreM); core.position.y = CY; object.add(core);
  const cageM = new THREE.LineBasicMaterial({ color: new THREE.Color(C.white).multiplyScalar(2) });
  core.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.9, 0)), cageM));
  const ringM = new THREE.MeshStandardMaterial({ color: 0x0b1016, metalness: .8, roughness: .3, emissive: G, emissiveIntensity: .9 });
  const rings = [2.0, 2.7, 3.4].map((R, i) => {
    const n = 24 + i * 8, ring = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .14, .2), ringM, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    for (let k = 0; k < n; k++) { const a = k * TAU / n; q.setFromAxisAngle(V(0, 1, 0), -a); m4.compose(V(Math.cos(a) * R, 0, Math.sin(a) * R), q, V(1, 1 + (k % 3 === 0 ? 1.8 : 0), 1)); ring.setMatrixAt(k, m4); }
    const g = new THREE.Group(); g.position.y = CY; g.add(ring); object.add(g); return g;
  });
  // beacon: a faint column of light straight up, so the goal is always in sight
  const beaconU = { uTime: U.uTime, uPower: { value: 1 } };
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(.6, 1.6, 400, 12, 1, true), new THREE.ShaderMaterial({
    uniforms: beaconU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uPower; void main(){ float a = pow(clamp(1.-vUv.y,0.,1.), 1.5)*.22*(.8+.2*sin(vUv.y*80. - uTime*3.))*uPower; gl_FragColor = vec4(vec3(.22,1.,.62)*a, a); }`,
  }));
  beacon.position.y = CY + 200; object.add(beacon);
  const glowM = new THREE.SpriteMaterial({ map: haloTex(), color: G.clone().multiplyScalar(.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false });
  const glow = new THREE.Sprite(glowM); glow.scale.setScalar(13); glow.position.y = CY; object.add(glow);
  const light = new THREE.PointLight(0x39ff9c, 22, 26, 1.6); light.position.y = CY; object.add(light);

  // ---- proof: V8SAME's captured flag over the forged one (a billboard above the core, redrawn as pairs light)
  const pc = new OffscreenCanvas(1400, 330), pg = pc.getContext('2d'), ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
  const proofM = new THREE.SpriteMaterial({ map: ptex, transparent: true, depthWrite: false, fog: false, opacity: 0 });
  const proof = new THREE.Sprite(proofM); proof.scale.set(12, 2.83, 1); proof.position.y = CY + 3.6; object.add(proof);
  let proofLit = -1;
  function drawProof(lit) {
    if (lit === proofLit) return; proofLit = lit;
    const hx = (f) => f.slice(5, -1), a = hx(flags.v8), b = hx(flags.v8);   // captured = forged: that is the proof
    pg.clearRect(0, 0, 1400, 330); pg.font = '700 46px "JetBrains Mono"'; pg.textBaseline = 'middle';
    const row = (y, label, hexs, col, litCol) => {
      pg.fillStyle = 'rgba(255,255,255,.55)'; pg.font = '700 26px "JetBrains Mono"'; pg.fillText(label, 30, y); pg.font = '700 46px "JetBrains Mono"';
      let x = 230; pg.fillStyle = col; pg.fillText('flag{', x, y); x += pg.measureText('flag{').width;
      for (let i = 0; i < 16; i++) { pg.fillStyle = i < lit ? litCol : 'rgba(255,255,255,.28)'; const pr = hexs.slice(i * 2, i * 2 + 2); pg.fillText(pr, x, y); x += pg.measureText(pr).width + 8; }
      pg.fillStyle = col; pg.fillText('}', x, y);
    };
    row(80, 'CAPTURED', a, '#ffd21e', '#fff3b0'); row(250, 'FORGED', b, '#39ff9c', '#d8ffe9');
    pg.font = '700 40px "JetBrains Mono"'; let x = 230 + pg.measureText('flag{').width + 4;   // = between matching pairs
    pg.font = '700 46px "JetBrains Mono"'; x = 230 + pg.measureText('flag{').width;
    for (let i = 0; i < 16; i++) { const w = pg.measureText(a.slice(i * 2, i * 2 + 2)).width; if (i < lit) { pg.fillStyle = '#fff'; pg.font = '700 40px "JetBrains Mono"'; pg.fillText('=', x + w / 2 - 12, 166); pg.font = '700 46px "JetBrains Mono"'; } x += w + 8; }
    if (lit >= 16) { pg.fillStyle = '#ffd21e'; pg.font = '700 52px "Chakra Petch"'; pg.fillText('MATCH', 1180, 166); }
    ptex.needsUpdate = true;
  }
  // ---- forging: the four inputs as glowing words orbiting the core, folding into each other
  const inputs = LF.slots.map((name) => { const sp = tagSprite(name, C.green, { size: .55, frame: false, boost: 2.8 }); sp.visible = false; object.add(sp); return sp; });
  // ---- absorb: the flag's 38 characters (own small lowercase atlas, they bloom)
  const charTex = {}, chTex = (ch) => charTex[ch] ??= canvasTex(64, 96, (g) => { g.fillStyle = '#fff'; g.font = '700 74px "JetBrains Mono"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 32, 52); });
  const flagChars = [...flags.player].map((ch, i) => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: chTex(ch), color: G.clone().multiplyScalar(i < 5 || i === flags.player.length - 1 ? 1.6 : 3.2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); sp.scale.set(.6, .9, 1); sp.visible = false; object.add(sp); return sp; });
  const arriveM = new THREE.MeshBasicMaterial({ color: G.clone().multiplyScalar(3), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const arrive = new THREE.Mesh(new THREE.RingGeometry(.4, .5, 48), arriveM); arrive.visible = false; object.add(arrive);
  const local = new THREE.Vector3(), tmp = new THREE.Vector3(), ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };

  const ang = [0, 0, 0]; let spinT = 0;
  return {
    object, core, slotPos: LF.slotPos,
    update(t, dt, s = {}) {
      const pw = Math.max(0, Math.min(1, s.power ?? 1)), live = .15 + .85 * pw;
      const phase = s.phase ?? 'idle', pt = s.t ?? 0, round = s.round ?? 0;
      const boost = phase === 'proof' ? 2.2 : phase === 'forging' ? 1 + round * .9 + (s.progress ?? 0) * .6 : phase === 'absorb' ? 3 * (1 - pt / ABSORB_SECONDS) : 1;
      spinT += dt * pw * boost;  // the rings spin down with the power and stop; faster while folding
      rings[0].rotation.set(spinT * .4, 0, Math.sin(spinT * .3) * .5); rings[1].rotation.set(Math.PI / 2 + Math.sin(spinT * .25) * .4, spinT * .3, 0); rings[2].rotation.set(Math.sin(spinT * .2) * .3, -spinT * .2, Math.PI / 2.4);
      core.scale.setScalar((1 + .06 * Math.sin(t * 2.2) * pw) * (.7 + .3 * pw)); core.rotation.y = spinT * .5;
      // power: everything that glows goes down with it; a last flicker on the way
      const fl = pw > .02 && pw < .6 ? (Math.sin(t * 41) * Math.sin(t * 13) > .6 ? .45 : 1) : 1;
      coreM.color.copy(G).multiplyScalar(2.2 * live * fl); seam.color.copy(G).multiplyScalar(2.2 * live * fl); frameM.color.copy(G).multiplyScalar(2.8 * live);
      cageM.color.setScalar(2 * live); ringM.emissiveIntensity = .9 * pw * fl + .05;
      glowM.color.copy(G).multiplyScalar(.7 * pw * fl); light.intensity = 22 * pw * fl; beaconU.uPower.value = pw;
      const prog = s.progress ?? 0;
      // proof
      const pIn = phase === 'proof' ? Math.min(1, pt / .5) : 0;
      proofM.opacity += (pIn - proofM.opacity) * Math.min(1, dt * 5); proof.visible = proofM.opacity > .01;
      if (phase === 'proof') drawProof(Math.min(16, Math.floor(pt / (PROOF_SECONDS * .8) * 16)));
      // slots
      const filled = phase === 'forging' || phase === 'absorb' || phase === 'done' ? 4 : (s.slots ?? 0);
      slotViews.forEach((v, i) => { const on = i < filled; v.holeM.color.copy(G).multiplyScalar(on ? (.25 + .1 * Math.sin(t * 4 + i)) * live : 0); v.inLbl.visible = on && phase !== 'done'; });
      // forging: the inputs orbit and fold
      const fold = phase === 'forging';
      inputs.forEach((sp, i) => {
        sp.visible = fold; if (!fold) return;
        const k = prog, r = 2.5 - 1.9 * ease(k * 1.1), a = spinT * (1.2 + round * .5) + i * Math.PI / 2 + k * Math.PI * round;
        sp.position.set(Math.cos(a) * r, CY + Math.sin(a * 2 + i) * .5 * (1 - k), Math.sin(a) * r);
        sp.material.opacity = 1 - ease((k - .9) / .1) * .9;   // they merge into the core at the end of each round
      });
      if (fold) coreM.color.multiplyScalar(1 + round * .35 + prog * .4);
      // absorb: burst into a ring, then spiral into the orb
      const ab = phase === 'absorb', n = flagChars.length;
      if (s.orb) local.set(s.orb[0] - object.position.x, s.orb[1] - object.position.y, s.orb[2] - object.position.z);
      flagChars.forEach((sp, i) => {
        sp.visible = ab; if (!ab) return;
        const burst = ease(pt / .55), fly = Math.max(0, Math.min(1, (pt - .55 - i * .012) / 1.55)), e = fly * fly * (3 - 2 * fly);
        const a0 = i / n * Math.PI * 2 + pt * 1.5, ring = tmp.set(Math.cos(a0) * 2.6 * burst, CY + .4 + Math.sin(a0 * 3) * .3, Math.sin(a0) * 2.6 * burst);
        const swirl = (1 - e) * 1.6, a1 = a0 + e * 9;
        sp.position.copy(ring).lerp(local, e).add(new THREE.Vector3(Math.cos(a1) * swirl * e, Math.sin(e * Math.PI) * 2.2, Math.sin(a1) * swirl * e));
        const sc = (1 - .85 * ease((e - .72) / .28)) * (1 + .25 * Math.sin(pt * 20 + i)); sp.scale.set(.6 * sc, .9 * sc, 1); sp.material.opacity = e >= 1 ? 0 : 1;
      });
      const hit = ab ? (pt - 2.15) / .35 : -1; arrive.visible = hit > 0 && hit < 1;
      if (arrive.visible) { arrive.position.copy(local); arrive.lookAt(local.x, local.y + 1, local.z); arrive.scale.setScalar(1 + hit * 6); arriveM.opacity = 1 - hit; }
      bars.forEach((b, i) => { const full = i < round - 1 || (i === round - 1 && prog >= 1), cur = i === round - 1 && !full; b.material.opacity = (full ? .95 : cur ? .4 + .5 * prog : .35 + .15 * Math.sin(t * 1.5 + i)) * live; });
    },
    dispose() { disposeTree(object); },
  };
}
