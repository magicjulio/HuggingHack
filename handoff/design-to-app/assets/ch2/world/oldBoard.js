// Ch2 world: the Old Board. A tall dim spire built from the earlier board's dash messages (scrolling bone text, a dying-screen
// flicker), a worn top disc with a bone rim, and the drifting message slabs you climb.
// createOldBoard({ layout, U }) -> { object, slabs, update(t, dt, state), dispose() }
//   state { slabs: [{ pos: [x, y, z] }] } = your physics' slab tops (walkable centre); default motion.slabAt(layout, i, t)
// Colliders are yours: column, top disc (layout.oldBoard.top), slab boxes (size[0] x size[1], top at pos.y).
import * as THREE from 'three';
import { C, V, VA, canvasTex, disposeTree } from './util.js';
import { slabAt } from './motion.js';

export function createOldBoard({ layout, U }) {
  const OB = layout.oldBoard, Cc = VA(OB.column.pos), object = new THREE.Group(); object.name = 'oldBoard';
  const H = OB.column.top - OB.column.bottom;
  const lines = ['FLAC38347-39800-WE-ALL-SEEK-CATFLAG-SEED-ORACLE', 'FLAC38347-PUBLIC-HMAC-SEED-PAPER-CONFIRMED-SEE-ALL'];   // the earlier board's two real messages [S3]
  const colTex = canvasTex(1024, 2048, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.font = '700 30px "JetBrains Mono"';
    for (let y = 30, i = 0; y < h; y += 44, i++) { g.globalAlpha = .25 + .75 * Math.random() * Math.random(); g.fillStyle = '#d9cfb8'; g.fillText(lines[i % 2] + '  ' + lines[(i + 1) % 2], -Math.random() * 300, y); }
  });
  colTex.wrapS = colTex.wrapT = THREE.RepeatWrapping; colTex.repeat.set(1, H / 12);
  const colMat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uTex: { value: colTex }, uFlick: { value: 1 }, uH: { value: H }, uBottom: { value: OB.column.bottom } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform sampler2D uTex; uniform float uTime, uFlick, uH, uBottom; varying vec2 vUv; varying vec3 vW;
      void main(){ vec2 uv = vec2(vUv.x*2., vUv.y*uH/12. - uTime*.01);
        float t = texture2D(uTex, uv).r; float k = clamp((vW.y-uBottom)/uH, 0., 1.);
        float scan = .75 + .25*sin(vW.y*9. - uTime*2.);
        vec3 bone = vec3(.85,.80,.70);
        gl_FragColor = vec4(vec3(.010,.010,.012) + bone*t*.55*scan*uFlick*smoothstep(0.,.35,k), 1.); }`,
  });
  const col = new THREE.Mesh(new THREE.CylinderGeometry(OB.column.radius, OB.column.radius * 1.15, H, 6, 1, true), colMat);
  col.position.set(Cc.x, OB.column.bottom + H / 2, Cc.z); object.add(col);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(OB.column.radius * 1.01, OB.column.radius * 1.16, H, 6, 1)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.bone).multiplyScalar(.9), transparent: true, opacity: .55 }));
  edges.position.copy(col.position); object.add(edges);
  const topY = OB.top.y;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(OB.top.radius, OB.top.radius * .85, .6, 12), new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: .5, roughness: .6 }));
  top.position.set(Cc.x, topY - .3, Cc.z); object.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(OB.top.radius, .03, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(C.bone).multiplyScalar(1.15) }));
  rim.rotation.x = Math.PI / 2; rim.position.set(Cc.x, topY + .01, Cc.z); object.add(rim);
  // slabs: each one is a message, written with dashes, slowly drifting
  const slabs = OB.slabs.map((s, i) => {
    const [w, d] = s.size, { pos, rotY } = slabAt(layout, i, 0);
    const tex = canvasTex(1024, Math.round(1024 * d / w), (g, cw, ch) => {
      g.fillStyle = '#0d0d0f'; g.fillRect(0, 0, cw, ch);
      g.strokeStyle = 'rgba(217,207,184,.55)'; g.lineWidth = 6; g.strokeRect(6, 6, cw - 12, ch - 12);
      g.fillStyle = '#d9cfb8'; let fs = 120; g.font = `700 ${fs}px "JetBrains Mono"`;
      while (g.measureText(s.text).width > cw - 60 && fs > 20) { fs -= 4; g.font = `700 ${fs}px "JetBrains Mono"`; }
      g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(s.text, cw / 2, ch / 2 + 4);
      g.globalAlpha = .25; for (let k = 0; k < 40; k++) g.fillRect(Math.random() * cw, Math.random() * ch, Math.random() * 60, 2);   // worn
    });
    const mat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, metalness: .4, roughness: .7, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: .9 });
    const side = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, metalness: .5, roughness: .6, emissive: new THREE.Color(C.bone), emissiveIntensity: .12 });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .32, d), [side, side, mat, side, side, side]);
    m.position.copy(VA(pos)).add(V(0, -.16, 0)); m.rotation.y = rotY; object.add(m);
    m.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w, .32, d)), new THREE.LineBasicMaterial({ color: new THREE.Color(C.bone).multiplyScalar(1.6), transparent: true, opacity: .7 })));
    return { m, mat };
  });
  return {
    object, slabs,
    update(t, dt, s = {}) {
      const f = Math.sin(t * 13.7) * Math.sin(t * 3.1) > .93 ? .35 : 1;   // the old board flickers now and then, like a dying screen
      colMat.uniforms.uFlick.value = f;
      slabs.forEach((sl, i) => { const p = s.slabs?.[i]?.pos ?? slabAt(layout, i, t).pos; sl.m.position.set(p[0], p[1] - .16, p[2]); sl.mat.emissiveIntensity = .9 * f; });
    },
    dispose() { disposeTree(object); },
  };
}
