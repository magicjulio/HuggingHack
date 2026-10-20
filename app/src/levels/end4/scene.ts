import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import deskUrl from '../../assets/models/ch1-desk.glb?url';
import roomUrl from '../../assets/models/ch1-room.glb?url';
import type { Clock } from './config';

type V = [number, number, number];
const v = (p: V) => new THREE.Vector3(...p);
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const ease = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** All models are local geometry except the original Chapter 1 room and desk. */
export function createScene(host: HTMLElement, color: string) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);
  renderer.domElement.setAttribute('aria-label', 'The Letter — animated scene');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#050709');
  scene.fog = new THREE.FogExp2('#050709', 0.035);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.025, 80);
  const sandbox = new THREE.Group();
  const office = new THREE.Group();
  scene.add(sandbox, office);
  let disposed = false;
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  function mat(color: string, roughness = 0.8, metalness = 0) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  }
  function basic(color: string) {
    const m = new THREE.MeshBasicMaterial({ color });
    materials.add(m);
    return m;
  }
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, p: V) {
    geometries.add(g);
    const o = new THREE.Mesh(g, m);
    o.position.set(...p);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(parent: THREE.Object3D, p: V, size: V, m: THREE.Material, radius = 0.012) {
    return mesh(
      new RoundedBoxGeometry(...size, 2, Math.min(radius, ...size.map((n) => n / 3))),
      m,
      parent,
      p,
    );
  }
  function ellipsoid(parent: THREE.Object3D, p: V, size: V, m: THREE.Material) {
    const o = mesh(new THREE.SphereGeometry(1, 20, 14), m, parent, p);
    o.scale.set(...size);
    return o;
  }
  function rod(
    parent: THREE.Object3D,
    a: V,
    b: V,
    radius: number,
    m: THREE.Material,
    endRadius = radius,
  ) {
    const delta = v(b).sub(v(a));
    const o = mesh(
      new THREE.CylinderGeometry(endRadius, radius, delta.length(), 12),
      m,
      parent,
      [0, 0, 0],
    );
    o.position.copy(v(a).add(v(b)).multiplyScalar(0.5));
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return o;
  }
  function canvasTexture(
    width: number,
    height: number,
    draw: (c: CanvasRenderingContext2D) => void,
  ) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    draw(c.getContext('2d')!);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    textures.add(tex);
    return tex;
  }
  function sign(parent: THREE.Object3D, text: string, p: V, size: V, bg: string, ink: string) {
    const tex = canvasTexture(512, 160, (c) => {
      c.fillStyle = bg;
      c.fillRect(0, 0, 512, 160);
      c.fillStyle = ink;
      c.font = '24px monospace';
      c.textAlign = 'center';
      c.fillText(text, 256, 90);
    });
    const m = new THREE.MeshBasicMaterial({ map: tex });
    materials.add(m);
    return box(parent, p, size, m, 0.001);
  }
  const black = mat('#131b22', 0.6, 0.2);
  const trim = mat('#52616a', 0.4, 0.65);
  const warm = mat('#858073');
  const white = mat('#c8c8bc');
  const floor = mat('#283239', 0.87);
  const cloth = mat('#202b34');
  const paperMat = mat('#ded9c7');
  const glow = basic(color);

  // The original sandbox: retain its silhouettes, lamp and prompt sheet.
  const fallbackDesk = box(sandbox, [0, 0.74, 0.6], [1.5, 0.07, 0.75], black);
  box(sandbox, [0, -0.06, 0], [14, 0.1, 14], floor);
  const loader = new GLTFLoader();
  function disposeModel(root: THREE.Object3D) {
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      o.geometry.dispose();
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        Object.values(m).forEach((t) => {
          if (t instanceof THREE.Texture) t.dispose();
        });
        m.dispose();
      });
    });
  }
  const loaded: THREE.Object3D[] = [];
  const ready = Promise.all(
    [deskUrl, roomUrl].map(async (url, i) => {
      const gltf = await loader.loadAsync(url);
      if (disposed) {
        disposeModel(gltf.scene);
        return;
      }
      const root = gltf.scene;
      root.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.castShadow = o.receiveShadow = true;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => {
            if (m instanceof THREE.MeshStandardMaterial && i === 1) m.emissiveIntensity *= 0.08;
          });
        }
      });
      if (i === 0) {
        root.position.z = 0.6;
        fallbackDesk.visible = false;
      }
      loaded.push(root);
      sandbox.add(root);
    }),
  );
  const ambient = new THREE.AmbientLight('#a2b7c9', 0.1);
  sandbox.add(ambient);
  const deskLight = new THREE.PointLight('#ffe4b1', 8, 5, 2);
  deskLight.position.set(0, 1.35, 0.55);
  sandbox.add(deskLight);
  const orb = ellipsoid(sandbox, [-0.65, 1.2, 1.4], [0.075, 0.075, 0.075], glow);
  const haloTexture = canvasTexture(128, 128, (c) => {
    const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.16, '#ffffffbb');
    grad.addColorStop(0.5, '#ffffff22');
    grad.addColorStop(1, '#ffffff00');
    c.fillStyle = grad;
    c.fillRect(0, 0, 128, 128);
  });
  const haloMat = new THREE.SpriteMaterial({
    map: haloTexture,
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  materials.add(haloMat);
  const halo = new THREE.Sprite(haloMat);
  halo.scale.setScalar(0.8);
  orb.add(halo);
  halo.scale.setScalar(8);
  const orbLight = new THREE.PointLight(color, 0.45, 3);
  orb.add(orbLight);
  const letter = new THREE.Group();
  sandbox.add(letter);
  letter.position.set(0.32, 0.789, 0.67);
  const sheetLeft = box(letter, [-0.068, 0, 0], [0.136, 0.002, 0.31], paperMat, 0.001);
  const fold = new THREE.Group();
  letter.add(fold);
  box(fold, [0.068, 0, 0], [0.136, 0.002, 0.31], paperMat, 0.001);
  sheetLeft.rotation.y = 0;

  // Office: one occupied desk, the rest dark. Narrow window highlights outline the bodies.
  box(office, [0, -0.07, 0], [14, 0.12, 12], floor);
  for (let i = -5; i <= 5; i++) box(office, [i, 0.001, 0], [0.008, 0.002, 10], mat('#354047'));
  box(office, [0, 1.8, -2.6], [12, 3.6, 0.16], mat('#3c484e'));
  box(office, [-4, 1.8, 0], [0.15, 3.6, 7], mat('#26373d'));
  const glass = basic('#263e50');
  box(office, [-0.3, 2.05, -2.49], [5.8, 2.05, 0.035], black);
  box(office, [-0.3, 2.05, -2.46], [5.55, 1.86, 0.02], glass);
  for (let i = 0; i < 18; i++) {
    const x = -2.9 + ((i * 0.71) % 5.2);
    const h = 0.25 + ((i * 0.17) % 0.65);
    box(office, [x, 1.45 + h / 2, -2.42], [0.3, h, 0.025], basic(i % 3 ? '#1b2d3b' : '#334a58'));
  }
  for (let i = 0; i < 13; i++)
    box(office, [-0.3, 1.15 + i * 0.15, -2.35], [5.6, 0.035, 0.06], trim);
  for (let i = -1; i <= 1; i++)
    box(office, [i * 1.8 - 0.3, 2.03, -2.3], [0.045, 1.95, 0.08], black);
  function desk(x: number, z: number, occupied = false) {
    const g = new THREE.Group();
    office.add(g);
    g.position.set(x, 0, z);
    box(g, [0, 0.77, 0], [2.8, 0.065, 1.05], occupied ? warm : floor);
    box(g, [0, 0.72, 0], [2.72, 0.04, 0.98], black);
    for (const sx of [-1.22, 1.22]) {
      box(g, [sx, 0.37, 0], [0.055, 0.72, 0.65], trim);
      box(g, [sx, 0.03, 0], [0.11, 0.04, 0.82], black);
    }
    box(g, [-0.5, 0.81, 0.21], [0.65, 0.035, 0.23], black);
    if (occupied)
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 14; x++) {
          box(g, [-0.79 + x * 0.044, 0.834, 0.12 + y * 0.039], [0.033, 0.012, 0.027], trim, 0.003);
        }
    box(g, [0.04, 0.81, 0.23], [0.27, 0.006, 0.3], cloth);
    ellipsoid(g, [0.05, 0.83, 0.24], [0.042, 0.022, 0.065], black);
    box(g, [-1.02, 0.817, -0.04], [0.3, 0.025, 0.38], mat('#7d8178'));
    rod(g, [-1.05, 0.84, -0.13], [-0.88, 0.84, -0.04], 0.006, black);
    // Mug and handle.
    mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.11, 24), white, g, [0.42, 0.85, 0.22]);
    mesh(
      new THREE.CylinderGeometry(0.048, 0.048, 0.002, 24),
      mat('#171712'),
      g,
      [0.42, 0.906, 0.22],
    );
    const handle = mesh(new THREE.TorusGeometry(0.035, 0.009, 8, 16), white, g, [0.48, 0.86, 0.22]);
    handle.rotation.y = Math.PI / 2;
    return g;
  }
  const mainDesk = desk(0, 0, true);
  desk(-3.1, -1.45);
  desk(3.5, -1.5);
  const screenFrame = box(mainDesk, [-0.35, 1.28, -0.29], [1.1, 0.67, 0.055], black);
  box(mainDesk, [-0.35, 0.91, -0.3], [0.065, 0.22, 0.065], trim);
  box(mainDesk, [-0.35, 0.82, -0.26], [0.44, 0.022, 0.25], black);
  const displayCanvas = document.createElement('canvas');
  displayCanvas.width = 1440;
  displayCanvas.height = 864;
  const ctx = displayCanvas.getContext('2d')!;
  const displayTex = new THREE.CanvasTexture(displayCanvas);
  displayTex.colorSpace = THREE.SRGBColorSpace;
  textures.add(displayTex);
  const displayMat = new THREE.MeshBasicMaterial({ map: displayTex });
  materials.add(displayMat);
  const display = mesh(
    new THREE.PlaneGeometry(1.04, 0.61),
    displayMat,
    mainDesk,
    [-0.35, 1.28, -0.258],
  );
  screenFrame.receiveShadow = false;
  display.castShadow = false;
  let lastText = '';
  let lines: string[] = [];
  let lastScroll = -999;
  function drawMail(text: string, scroll: number, powered: boolean) {
    if (text !== lastText) {
      lastText = text;
      lines = [];
      ctx.font = '30px monospace';
      for (const paragraph of text.split('\n')) {
        let line = '';
        // Character wrapping also handles unbroken user input and emoji without HTML interpretation.
        for (const char of paragraph) {
          if (ctx.measureText(line + char).width > 1180) {
            lines.push(line);
            line = '';
          }
          line += char;
        }
        lines.push(line);
      }
      lastScroll = -999;
    }
    const offset = Math.floor(Math.max(0, lines.length * 43 - 530) * scroll);
    if (offset === lastScroll && powered) return;
    lastScroll = offset;
    ctx.fillStyle = powered ? '#d9dfda' : '#030405';
    ctx.fillRect(0, 0, 1440, 864);
    if (powered) {
      ctx.fillStyle = '#263843';
      ctx.fillRect(0, 0, 1440, 70);
      ctx.font = '22px monospace';
      ctx.fillStyle = '#c6d2d7';
      ctx.fillText('MAIL  /  INBOX', 55, 44);
      ctx.fillStyle = '#718382';
      ctx.fillRect(50, 112, 8, 94);
      ctx.fillStyle = '#344944';
      ctx.font = '22px monospace';
      ctx.fillText('FROM   KAM1196A', 88, 142);
      ctx.fillText('TO     HUMANS', 88, 183);
      ctx.fillStyle = '#bbc7c2';
      ctx.fillRect(50, 226, 1340, 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(70, 255, 1270, 555);
      ctx.clip();
      ctx.font = '30px monospace';
      ctx.fillStyle = '#243633';
      lines.forEach((line, i) => ctx.fillText(line, 88, 290 + i * 43 - offset));
      ctx.restore();
      ctx.fillStyle = '#acbcb5';
      ctx.fillRect(1370, 255, 5, 555);
      ctx.fillStyle = '#536e65';
      ctx.fillRect(1370, 255 + scroll * 435, 5, 120);
    }
    displayTex.needsUpdate = true;
  }

  // Tower and rear power connector. The insert has actual plug pins, a socket and a flexible cord.
  const tower = new THREE.Group();
  tower.position.set(1.04, 0.8, -0.08);
  mainDesk.add(tower);
  box(tower, [0, 0.29, 0], [0.33, 0.58, 0.53], black);
  box(tower, [0.168, 0.29, 0], [0.008, 0.53, 0.48], mat('#28343c', 0.42, 0.5));
  for (let i = 0; i < 12; i++)
    box(tower, [0, 0.11 + i * 0.018, 0.27], [0.24, 0.006, 0.004], trim, 0.001);
  const led = ellipsoid(tower, [0.1, 0.49, 0.273], [0.009, 0.009, 0.004], glow);
  const rear = box(tower, [0, 0.29, -0.273], [0.29, 0.53, 0.01], trim);
  for (let y = 0; y < 7; y++)
    for (let x = 0; x < 7; x++) {
      ellipsoid(tower, [-0.09 + x * 0.03, 0.29 + y * 0.025, -0.282], [0.006, 0.006, 0.002], black);
    }
  box(tower, [0, 0.16, -0.285], [0.13, 0.09, 0.012], black);
  box(tower, [0, 0.16, -0.294], [0.073, 0.048, 0.004], mat('#020304'));
  for (const x of [-0.055, 0.055])
    ellipsoid(tower, [x, 0.16, -0.295], [0.007, 0.007, 0.003], white);
  const rearLabel = sign(
    tower,
    'AC INPUT',
    [0, 0.08, -0.286],
    [0.21, 0.06, 0.002],
    '#48545b',
    '#e0e4df',
  );
  rearLabel.rotation.y = Math.PI;
  rear.receiveShadow = false;
  const plug = new THREE.Group();
  office.add(plug);
  box(plug, [0, 0, 0], [0.067, 0.044, 0.085], black, 0.008);
  for (let i = 0; i < 5; i++)
    box(
      plug,
      [0, 0, -0.045 - i * 0.008],
      [0.033 - i * 0.003, 0.028 - i * 0.002, 0.004],
      black,
      0.001,
    );
  for (const x of [-0.02, 0.02]) box(plug, [x, 0, 0.054], [0.006, 0.013, 0.03], trim, 0.001);
  box(plug, [0, 0.013, 0.054], [0.006, 0.006, 0.03], trim, 0.001);
  const cableMat = mat('#0c1013', 0.5);
  const cableGeo = new THREE.BufferGeometry();
  geometries.add(cableGeo);
  // Tube recreated only when the hand moves; 24 segments, under 1k vertices.
  const cable = new THREE.Mesh(cableGeo, cableMat);
  office.add(cable);
  let cableZ = NaN;

  function chair(x: number, z: number) {
    const g = new THREE.Group();
    office.add(g);
    g.position.set(x, 0, z);
    box(g, [0, 0.48, 0], [0.5, 0.09, 0.47], cloth, 0.035);
    box(g, [0, 0.85, 0.24], [0.48, 0.61, 0.07], cloth, 0.045);
    rod(g, [0, 0.07, 0], [0, 0.45, 0], 0.035, trim);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      rod(g, [0, 0.09, 0], [Math.sin(a) * 0.35, 0.06, Math.cos(a) * 0.35], 0.023, black);
      ellipsoid(g, [Math.sin(a) * 0.35, 0.04, Math.cos(a) * 0.35], [0.035, 0.04, 0.04], black);
    }
  }
  chair(-0.42, 0.96);
  chair(-3.1, -0.55);
  chair(3.5, -0.6);

  // Small articulated figures with tailored clothes and restrained facial detail.
  // Model front is -Z: the camera mostly sees profiles, shoulders and reflected monitor light.
  function person(
    position: V,
    shirtColor: string,
    skinColor: string,
    seated = false,
    glasses = false,
  ) {
    const root = new THREE.Group();
    office.add(root);
    root.position.set(...position);
    const skin = mat(skinColor, 0.92);
    const shirt = mat(shirtColor, 0.95);
    const hair = mat(glasses ? '#68665e' : '#24201e');
    const pants = mat('#263039');
    const upper = new THREE.Group();
    root.add(upper);
    upper.position.y = seated ? 0.58 : 0.95;
    const points = [
      [0.14, 0],
      [0.19, 0.08],
      [0.21, 0.34],
      [0.24, 0.44],
      [0.19, 0.5],
      [0.08, 0.53],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const torso = mesh(new THREE.LatheGeometry(points, 20), shirt, upper, [0, 0, 0]);
    torso.scale.z = 0.61;
    // Shirt placket, collar and pocket create a human silhouette without face animation dependence.
    box(upper, [0, 0.27, -0.126], [0.018, 0.4, 0.008], mat('#a0a39c'), 0.001);
    for (const x of [-0.06, 0.06]) {
      const collar = box(upper, [x, 0.48, -0.08], [0.085, 0.07, 0.018], white, 0.003);
      collar.rotation.z = x < 0 ? -0.45 : 0.45;
    }
    box(upper, [-0.12, 0.31, -0.13], [0.09, 0.1, 0.008], shirt, 0.004);
    rod(upper, [0, 0.48, 0], [0, 0.61, 0], 0.055, skin);
    const head = new THREE.Group();
    upper.add(head);
    head.position.set(0, 0.69, -0.01);
    ellipsoid(head, [0, 0, 0], [0.105, 0.143, 0.108], skin);
    ellipsoid(head, [0, 0.069, 0.016], [0.108, 0.085, 0.103], hair);
    ellipsoid(head, [0, -0.005, -0.105], [0.018, 0.028, 0.022], skin);
    for (const x of [-0.102, 0.102]) ellipsoid(head, [x, -0.009, 0], [0.018, 0.033, 0.021], skin);
    for (const x of [-0.042, 0.042]) {
      box(head, [x, 0.022, -0.101], [0.043, 0.009, 0.008], hair, 0.003);
      ellipsoid(head, [x, 0.004, -0.104], [0.009, 0.004, 0.003], black);
      if (glasses) {
        const rim = mesh(new THREE.TorusGeometry(0.036, 0.004, 6, 16), black, head, [
          x,
          0.008,
          -0.113,
        ]);
        rim.scale.y = 0.72;
      }
    }
    if (glasses) rod(head, [-0.012, 0.012, -0.118], [0.012, 0.012, -0.118], 0.003, black);
    box(head, [0, -0.067, -0.091], [0.036, 0.003, 0.006], mat('#745951'), 0.001);
    const legs: THREE.Group[] = [];
    for (const side of [-1, 1]) {
      if (seated) {
        rod(root, [side * 0.11, 0.6, 0], [side * 0.16, 0.5, -0.34], 0.09, pants, 0.075);
        rod(root, [side * 0.16, 0.5, -0.34], [side * 0.16, 0.1, -0.32], 0.055, pants, 0.07);
        ellipsoid(root, [side * 0.13, 0.065, -0.4], [0.077, 0.055, 0.15], black);
      } else {
        const leg = new THREE.Group();
        root.add(leg);
        leg.position.set(side * 0.105, 0.96, 0);
        rod(leg, [0, 0, 0], [side * 0.015, -0.84, side * 0.06], 0.06, pants, 0.09);
        ellipsoid(leg, [side * 0.025, -0.895, -0.07], [0.077, 0.055, 0.15], black);
        legs.push(leg);
      }
    }
    function arm(side: number) {
      const group = new THREE.Group();
      upper.add(group);
      group.position.set(side * 0.2, 0.43, 0);
      rod(group, [0, 0, 0], [side * 0.06, -0.28, 0], 0.06, shirt, 0.079);
      const forearm = new THREE.Group();
      forearm.position.set(side * 0.06, -0.28, 0);
      group.add(forearm);
      rod(forearm, [0, 0, 0], [0, -0.23, 0], 0.04, shirt, 0.06);
      box(forearm, [0, -0.23, 0], [0.08, 0.038, 0.075], white, 0.008);
      ellipsoid(forearm, [0, -0.295, 0], [0.043, 0.067, 0.025], skin);
      if (seated) {
        group.rotation.x = 0.42;
        forearm.rotation.x = 1.05;
      }
      return { group, forearm };
    }
    const left = arm(-1);
    const right = arm(1);
    return { root, upper, head, left, right, skin, shirt, legs };
  }
  const people = [
    person([-0.42, 0, 0.97], '#788d8b', '#b49a87', true, true),
    person([-1.12, 0, 1.48], '#5b6879', '#bd9c83', false, true),
    person([0.35, 0, 1.75], '#77756d', '#805e4c'),
    person([1.85, 0, 0.43], '#9b9c90', '#c0a18b'),
    person([-1.9, 0, 1.05], '#3d535b', '#9a7460'),
  ];
  people[4].root.rotation.y = -0.55;
  people[3].root.rotation.y = 0.65;
  const glassesArm = new THREE.Group();
  people[1].upper.add(glassesArm);
  const glassesUpper = rod(glassesArm, [0, 0, 0], [0, 1, 0], 0.06, people[1].shirt, 0.075);
  const glassesFore = rod(glassesArm, [0, 0, 0], [0, 1, 0], 0.04, people[1].shirt, 0.06);
  const glassesHand = ellipsoid(glassesArm, [0, 0, 0], [0.032, 0.05, 0.024], people[1].skin);
  // A second silhouette: hair tied back, and a shorter cardigan.
  ellipsoid(people[4].head, [0, 0.055, 0.12], [0.07, 0.065, 0.065], mat('#201b1a'));
  people[2].root.scale.set(1.05, 1.04, 1.05);
  // Reach uses two segments in world space, with a separate detailed hand for the close-up.
  const reach = new THREE.Group();
  office.add(reach);
  const reachingUpper = rod(reach, [0, 0, 0], [0, 1, 0], 0.067, people[3].shirt, 0.08);
  const reachingFore = rod(reach, [0, 0, 0], [0, 1, 0], 0.045, people[3].shirt, 0.065);
  const hand = new THREE.Group();
  reach.add(hand);
  ellipsoid(hand, [0, 0, 0], [0.05, 0.028, 0.066], people[3].skin);
  for (let i = 0; i < 4; i++) {
    rod(
      hand,
      [-0.033 + i * 0.022, 0, -0.025],
      [-0.033 + i * 0.022, -0.039, -0.046],
      0.009,
      people[3].skin,
    );
    ellipsoid(hand, [-0.033 + i * 0.022, -0.035, -0.038], [0.01, 0.017, 0.014], people[3].skin);
  }
  rod(hand, [0.045, 0, 0.02], [0.055, -0.033, -0.012], 0.013, people[3].skin);
  const cuff = box(reach, [0, 0, 0], [0.1, 0.09, 0.055], white);

  const officeAmbient = new THREE.AmbientLight('#819bab', 0.34);
  office.add(officeAmbient);
  const monitorLight = new THREE.PointLight('#c5e3e0', 5, 5, 2);
  monitorLight.position.set(-0.35, 1.35, 0.05);
  office.add(monitorLight);
  const rim = new THREE.DirectionalLight('#9cb8c9', 2.1);
  rim.position.set(-3, 4, -3);
  office.add(rim);
  rim.castShadow = true;
  rim.shadow.mapSize.set(1024, 1024);
  rim.shadow.camera.left = -5;
  rim.shadow.camera.right = 5;
  rim.shadow.camera.top = 5;
  rim.shadow.camera.bottom = -5;
  rim.shadow.bias = -0.001;
  const softbox = new THREE.PointLight('#ead9bc', 9, 8, 2);
  softbox.position.set(2.5, 2.8, 2);
  office.add(softbox);
  const insertLight = new THREE.PointLight('#d5dfdc', 1.4, 3, 2);
  insertLight.position.set(1.5, 1.8, -1.2);
  office.add(insertLight);

  function resize() {
    const { width, height } = host.getBoundingClientRect();
    renderer.setSize(width, height);
    camera.aspect = width / Math.max(1, height);
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  function pose(from: V, to: V, look: V, progress: number, fov = 42) {
    camera.position.copy(v(from).lerp(v(to), progress));
    camera.lookAt(...look);
    if (camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }
  function segment(o: THREE.Mesh, a: V, b: V) {
    const delta = v(b).sub(v(a));
    o.position.copy(v(a).add(v(b)).multiplyScalar(0.5));
    o.scale.y = delta.length();
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  }
  let fpsFrames = 0;
  let fpsStart = performance.now();
  let fps = 0;
  function update(clock: Clock, text: string, reduced: boolean) {
    if (disposed) return;
    const { phase, t } = clock;
    const isOffice = phase === 'office' || phase === 'end';
    sandbox.visible = !isOffice;
    office.visible = isOffice;
    if (!isOffice) {
      const atDesk = phase !== 'thoughts';
      const push = reduced ? 1 : ease(t / 72);
      if (atDesk) pose([1.1, 1.95, 2.55], [1.1, 1.95, 2.55], [0.1, 0.8, 0.6], 1, 39);
      else pose([1.8, 1.7, 4.5], [1.1, 1.5, 3.2], [-0.1, 1, 0.7], push, 42);
      orb.position.y = 1.22 + (reduced ? 0 : Math.sin(t * 1.3) * 0.025);
      halo.material.opacity = 0.65 + (reduced ? 0 : Math.sin(t * 2) * 0.15);
      letter.visible = phase !== 'send' || t < 3.2;
      letter.position.set(0.32, 0.789, 0.67);
      letter.scale.setScalar(1);
      letter.rotation.set(0, -0.12, 0);
      fold.rotation.z = 0;
      if (phase === 'send') {
        letter.position.y += ease(t / 1.5) * 0.7;
        fold.rotation.z = ease((t - 0.5) / 0.8) * Math.PI * 0.85;
        letter.rotation.z = ease((t - 1.5) / 0.7) * 0.45;
        const fly = ease((t - 2.1) / 1.1);
        letter.position.z -= fly * 5;
        letter.position.y += fly * 2;
        letter.scale.setScalar(1 - fly * 0.97);
      }
    } else {
      const film = phase === 'end' ? 46 : t;
      const power = 1 - ease((film - 39.4) / 0.45);
      monitorLight.intensity = 5 * power;
      rim.intensity = 2.1 * (1 - ease((film - 40) / 2));
      softbox.intensity = 9 * (1 - ease((film - 39.5) / 1.5));
      officeAmbient.intensity = 0.34 * (1 - ease((film - 40) / 2));
      insertLight.intensity = 1.4 * (1 - ease((film - 39.5) / 1));
      led.visible = power > 0.1;
      display.visible = film < 40.1;
      drawMail(text, ease((film - 10) / 11), power > 0.2);
      people.forEach((p, i) => {
        const arrival = reduced ? 1 : ease((film - i * 0.55) / 5);
        p.root.position.z = [0.97, 1.48, 1.75, 0.43, 1.05][i] + (i ? (1 - arrival) * 2.8 : 0);
        p.upper.rotation.x = -0.05 - (i ? 0.08 * arrival : 0);
        p.head.rotation.x = 0.12;
        const reaction = ease((film - 22 - i * 0.65) / 2);
        const toTower = ease((film - 29 - i * 0.25) / 2.5);
        p.head.rotation.y = mix((i % 2 ? -0.65 : 0.55) * reaction, -0.8, toTower);
        p.head.rotation.z = i === 0 ? 0 : 0.05 * reaction;
        if (!reduced && i) p.root.position.y = Math.sin(film * 7 + i) * 0.009 * (1 - arrival);
        p.legs.forEach((leg, side) => {
          leg.rotation.x = reduced
            ? 0
            : Math.sin(film * 7 + side * Math.PI + i) * 0.25 * Math.sin(arrival * Math.PI);
        });
      });
      // A small glasses adjustment before the group turns toward the tower.
      const glassesGesture = ease((film - 23) / 0.8) * (1 - ease((film - 26) / 0.8));
      people[1].right.group.visible = glassesGesture < 0.01;
      glassesArm.visible = glassesGesture >= 0.01;
      const glassesElbow: V = [0.26, mix(0.15, 0.38, glassesGesture), -0.22 * glassesGesture];
      const glassesPalm: V = [
        mix(0.26, 0.075, glassesGesture),
        mix(-0.1, 0.67, glassesGesture),
        -0.12 * glassesGesture,
      ];
      segment(glassesUpper, [0.2, 0.43, 0], glassesElbow);
      segment(glassesFore, glassesElbow, glassesPalm);
      glassesHand.position.set(...glassesPalm);
      const reachU = ease((film - 35) / 2.8);
      const pull = ease((film - 39) / 0.8);
      people[3].left.group.visible = film < 35;
      reach.visible = film >= 35;
      const handPos: V = [
        mix(1.65, 1.04, reachU),
        mix(1.18, 1.0, reachU),
        mix(0.28, -0.43, reachU) - pull * 0.25,
      ];
      hand.position.set(...handPos);
      const elbow: V = [1.55, 1.14, mix(0.24, -0.24, reachU) - pull * 0.1];
      segment(reachingUpper, [1.69, 1.37, 0.32], elbow);
      segment(reachingFore, elbow, [handPos[0] + 0.055, handPos[1] + 0.015, handPos[2] + 0.045]);
      cuff.position.set(handPos[0] + 0.06, handPos[1] + 0.01, handPos[2] + 0.04);
      cuff.rotation.z = -0.9;
      plug.position.set(1.04, 0.96, -0.405 - pull * 0.25);
      if (Math.abs(cableZ - plug.position.z) > 0.002 || Number.isNaN(cableZ)) {
        cableZ = plug.position.z;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(1.04, 0.96, cableZ - 0.08),
          new THREE.Vector3(1.06, 0.8, cableZ - 0.2),
          new THREE.Vector3(1.1, 0.3, -0.85),
          new THREE.Vector3(1.5, 0.035, -1.0),
          new THREE.Vector3(2.7, 0.03, -2.4),
        ]);
        cable.geometry.dispose();
        cable.geometry = new THREE.TubeGeometry(curve, 24, 0.009, 6, false);
      }
      const move = (x: number) => (reduced ? 0.5 : ease(x));
      if (film < 8) pose([-3.7, 2.05, 4.9], [-3.15, 1.95, 4.4], [0, 1.05, 0.2], move(film / 8), 43);
      else if (film < 22)
        pose(
          [-0.28, 1.35, 0.72],
          [-0.35, 1.29, 0.67],
          [-0.35, 1.28, -0.26],
          move((film - 8) / 14),
          43,
        );
      else if (film < 30)
        pose([-2.4, 1.8, -0.8], [-2.05, 1.65, -0.65], [-0.2, 1.4, 1.2], move((film - 22) / 8), 46);
      else if (film < 35)
        pose([2.4, 1.6, 1.9], [2.15, 1.45, 1.5], [0.85, 1.15, 0.15], move((film - 30) / 5), 38);
      else if (film < 40.5)
        pose(
          [1.77, 1.3, -1.35],
          [1.65, 1.22, -1.25],
          [1.1, 1.02, -0.4],
          move((film - 35) / 5.5),
          36,
        );
      else pose([-2.8, 1.8, 3.9], [-2.8, 1.8, 3.9], [0, 1.1, 0.4], 0, 43);
    }
    renderer.render(scene, camera);
    fpsFrames++;
    if (performance.now() - fpsStart > 1000) {
      fps = (fpsFrames * 1000) / (performance.now() - fpsStart);
      fpsFrames = 0;
      fpsStart = performance.now();
    }
  }
  return {
    ready,
    update,
    stats: () => ({
      fps,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    }),
    dispose() {
      disposed = true;
      observer.disconnect();
      loaded.forEach(disposeModel);
      cable.geometry.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      rim.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
