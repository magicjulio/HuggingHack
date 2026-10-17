import * as THREE from "three";
import { logoMaterials } from "./art.js";

// The playable deck moves between two heights; the tower shell stays in place.
export function createWorld(scene, T, brand) {
  const W = T.world;
  const deckHeight = W.floorHeight;
  const width = W.width;
  const nearZ = W.nearZ;
  const farZ = W.farZ;
  const coverHeight = W.coverHeight ?? 1.35;
  const root = new THREE.Group();
  root.name = "AScent headquarters";
  scene.add(root);
  const deck = new THREE.Group();
  root.add(deck);
  const colliders = [];
  const spawnPoints = [];
  const liftPosition = new THREE.Vector3(0, 0, -39);
  const covers = [];
  const fixedColliders = [];
  const resources = new Set();
  const fleets = [];
  let activeFloor = 1;
  let floorY = 0;
  let ready = false;

  function material(color, roughness = 0.7, metalness = 0.35) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    resources.add(m);
    return m;
  }
  function glow(color, intensity = 1) {
    const m = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
      roughness: 0.3,
    });
    resources.add(m);
    return m;
  }
  const mat = {
    floor: material(0x273945),
    wall: material(0x172b39),
    dark: material(0x101c28),
    steel: material(0x426071, 0.4, 0.75),
    cover: material(0x3b5262),
    gold: glow(0xffc153, 0.75),
    pale: glow(0xb6deed, 0.7),
    mint: glow(0x69ffd2, 1.2),
    orange: glow(0xf09748, 1),
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  resources.add(cube);
  function box(parent, x, y, z, sx, sy, sz, m, shadow = false) {
    const mesh = new THREE.Mesh(cube, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function collider(x, z, sx, sz, height) {
    return {
      minX: x - sx / 2,
      maxX: x + sx / 2,
      minZ: z - sz / 2,
      maxZ: z + sz / 2,
      height,
      baseY: floorY,
    };
  }
  function textureCanvas(w, h, paint) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    paint(canvas.getContext("2d"), w, h);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    resources.add(texture);
    return texture;
  }
  function sign(text, size, color = "#c7dce6", w = 1024, h = 128) {
    const map = textureCanvas(w, h, (ctx) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      ctx.font = `700 ${Math.floor(h * 0.59)}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, w / 2, h / 2);
    });
    const m = new THREE.MeshBasicMaterial({
      map,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    resources.add(m);
    const geometry = new THREE.PlaneGeometry(size, (size * h) / w);
    resources.add(geometry);
    return new THREE.Mesh(geometry, m);
  }
  function addSign(parent, text, size, x, y, z, color) {
    const mesh = sign(text, size, color);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Large floor plates with inset seams: enough contrast to read silhouettes.
  box(deck, 0, -0.45, (nearZ + farZ) / 2, width, 0.9, nearZ - farZ, mat.floor);
  for (let z = farZ + 4; z < nearZ; z += 8) {
    box(deck, 0, 0.007, z, width - 1, 0.014, 0.035, mat.dark);
    for (const x of [-12, -4, 4, 12])
      box(deck, x, 0.009, z + 3.9, 0.035, 0.018, 7.8, mat.dark);
  }
  // Light rails on the flanks lead to the lift without cluttering target space.
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 1.2);
    box(deck, x, 0.015, -15.5, 0.08, 0.03, 50, mat.gold);
    box(deck, side * 13.9, 0.015, -15.5, 0.045, 0.03, 43, mat.steel);
    for (let z = -32; z < 10; z += 6) {
      const chevron = box(
        deck,
        side * 15.7,
        0.02,
        z,
        0.7,
        0.035,
        0.08,
        mat.gold,
      );
      chevron.rotation.y = (side * Math.PI) / 4;
      const other = box(
        deck,
        side * 16.15,
        0.02,
        z,
        0.7,
        0.035,
        0.08,
        mat.gold,
      );
      other.rotation.y = (-side * Math.PI) / 4;
    }
    // Sill, open upper façade, and balcony high above the combat plane.
    box(deck, (side * width) / 2, 0.65, -16, 0.7, 1.3, 56, mat.wall);
    fixedColliders.push(collider(side * (width / 2 + 0.2), -16, 0.8, 56, 24));
    box(deck, side * (width / 2 - 1), 10.8, -16, 3, 0.7, 55, mat.dark);
    box(deck, side * (width / 2 - 2.5), 11.9, -16, 0.13, 1.5, 55, mat.steel);
    box(deck, side * (width / 2 - 2.5), 12.65, -16, 0.16, 0.1, 55, mat.gold);
    for (const z of [8, -8, -25, -42]) {
      box(deck, side * (width / 2 - 0.25), 9, z, 1.2, 18, 1.4, mat.steel, true);
      box(
        deck,
        side * (width / 2 - 0.88),
        7,
        z + 0.1,
        0.06,
        11,
        0.24,
        mat.gold,
      );
    }
  }
  // Entrance framing and far command wall.
  box(deck, -12, 6, nearZ + 0.4, 14, 12, 1, mat.wall);
  box(deck, 12, 6, nearZ + 0.4, 14, 12, 1, mat.wall);
  box(deck, 0, 10.2, nearZ + 0.4, 10, 3.6, 1, mat.steel);
  fixedColliders.push(collider(0, nearZ + 0.7, width, 0.8, 24));
  box(deck, 0, 9, farZ - 0.8, width + 1, 18, 1.6, mat.wall);
  fixedColliders.push(collider(0, farZ - 0.8, width + 1, 1.6, 24));
  for (const z of [4, -14, -32]) {
    box(deck, 0, 17.7, z, width, 0.8, 1.6, mat.dark);
    box(deck, 0, 17.25, z, width - 3, 0.08, 0.45, mat.pale);
  }
  for (const side of [-1, 1]) {
    for (const z of [-8, -26]) {
      const x = side * 11;
      box(deck, x, 7, z, 1.5, 14, 1.5, mat.steel, true);
      box(deck, x, 0.3, z, 2.05, 0.6, 2.05, mat.dark);
      box(deck, x, 5.9, z + 0.77, 0.11, 9, 0.035, mat.gold);
      fixedColliders.push(collider(x, z, 2.05, 2.05, 14));
    }
  }

  // The official smile logo, extruded along its own outline; front cap is the unmodified SVG.
  const emblemMats = logoMaterials(brand, { glow: 0, clearcoat: 0 });
  const emblemGeo = brand.badge({ face: 8.5, depth: 0.9 });
  // The atrium is lit hard; scale the albedo so the brand yellow stays yellow, not white.
  emblemMats[0].color.setScalar(0.42);
  emblemMats[1].color.multiplyScalar(0.5);
  emblemMats.forEach((m) => resources.add(m));
  const emblem = new THREE.Mesh(emblemGeo, emblemMats);
  emblem.position.set(0, 11.5, farZ + 0.14);
  deck.add(emblem);
  addSign(deck, "HUGGING FACE", 13, 0, 6.4, farZ + 0.13, "#ffce76");
  addSign(
    deck,
    "HEADQUARTERS / ASCENT CONTROL",
    14,
    0,
    4.9,
    farZ + 0.14,
    "#819cae",
  );
  const floorLabel = addSign(
    deck,
    "01 / ARRIVAL ATRIUM",
    14,
    -0.2,
    2.9,
    farZ + 0.15,
    "#d7e8ef",
  );

  function createCover(x, z, sx, sz, floors) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    deck.add(group);
    box(group, 0, coverHeight / 2, 0, sx, coverHeight, sz, mat.cover, true);
    box(group, 0, coverHeight + 0.025, 0, sx + 0.12, 0.1, sz + 0.12, mat.steel);
    box(
      group,
      0,
      coverHeight - 0.24,
      sz / 2 + 0.008,
      sx - 0.3,
      0.07,
      0.02,
      mat.gold,
    );
    for (const side of [-1, 1])
      box(
        group,
        side * (sx / 2 - 0.17),
        coverHeight / 2,
        sz / 2 + 0.02,
        0.16,
        coverHeight,
        0.09,
        mat.dark,
      );
    covers.push({
      group,
      collider: collider(x, z, sx + 0.12, sz + 0.12, coverHeight + 0.08),
      floors,
    });
  }
  createCover(-5.5, -2, 5, 1.5, [1]);
  createCover(5.5, -10, 5, 1.5, [1]);
  createCover(-4.8, -19, 5, 1.5, [1]);
  createCover(5.8, -28, 4, 1.5, [1]);
  createCover(5.3, -2.5, 4.4, 1.5, [2]);
  createCover(-6, -10.5, 5, 1.5, [2]);
  createCover(3.5, -18, 4, 1.5, [2]);
  createCover(-6.5, -27, 3.6, 1.5, [2]);
  createCover(7.3, -29, 3.2, 1.5, [2]);

  // This complete assembly travels with the player; the floor stays below.
  const liftAssembly = new THREE.Group();
  liftAssembly.name = "Moving ascent platform";
  deck.add(liftAssembly);
  box(liftAssembly, 0, -0.42, -39, 7.3, 0.92, 7.3, mat.dark);
  box(liftAssembly, 0, -0.87, -39, 6.6, 0.16, 6.6, mat.steel);
  const liftMat = glow(0xd98b42, 0.6);
  const liftBars = [];
  for (const side of [-1, 1]) {
    liftBars.push(
      box(liftAssembly, side * 3.5, 0.09, -39, 0.12, 0.09, 7, liftMat),
    );
    liftBars.push(
      box(liftAssembly, 0, 0.09, -39 + side * 3.5, 7, 0.09, 0.12, liftMat),
    );
  }
  const liftGlyph = addSign(
    liftAssembly,
    "ASCEND",
    4.5,
    0,
    0.1,
    -39,
    "#ffd28b",
  );
  liftGlyph.rotation.x = -Math.PI / 2;
  for (const side of [-1, 1]) {
    for (const z of [-41.7, -36.3])
      box(liftAssembly, side * 3.28, 0.62, z, 0.12, 1.24, 0.12, mat.steel);
    box(liftAssembly, side * 3.28, 1.16, -39, 0.12, 0.12, 5.5, mat.steel);
    box(liftAssembly, side * 3.28, 0.62, -39, 0.07, 0.07, 5.5, liftMat);
    box(liftAssembly, side * 2.6, -0.91, -39, 0.18, 0.1, 5.5, liftMat);
    // Guide rails are outside the platform and continue far beyond this slice.
    box(root, side * 4.25, 170, -42.7, 0.35, 400, 0.5, mat.steel);
    box(root, side * 4.25, 170, -42.42, 0.1, 400, 0.05, mat.mint);
    box(liftAssembly, side * 4.25, -0.35, -42.7, 0.7, 1.3, 0.75, mat.steel);
    box(liftAssembly, side * 3.65, -0.35, -42.2, 1.4, 0.2, 0.25, mat.steel);
  }
  box(liftAssembly, 0, 1.16, -41.7, 6.6, 0.12, 0.12, mat.steel);
  const liftStatus = addSign(
    deck,
    "SECURE THE ATRIUM",
    7.5,
    0,
    1.4,
    -42.8,
    "#f3bb76",
  );
  for (const side of [-1, 1]) {
    box(deck, side * 4.1, 2.1, -41.9, 0.4, 4.2, 0.4, mat.steel);
    box(deck, side * 4.1, 2.1, -41.65, 0.13, 3.7, 0.06, liftMat);
  }

  // A stationary architectural shell makes the ride travel through real space.
  for (const side of [-1, 1]) {
    // Open viewing bays keep the wide lift camera outside solid geometry.
    box(root, side * 32, 190, -68, 19, 480, 15, mat.dark);
    box(root, side * 32, 190, 24, 19, 480, 12, mat.dark);
    box(root, side * 22.1, 160, -38, 2, 400, 3, mat.steel);
    box(root, side * 21.04, 160, -36.6, 0.09, 390, 0.25, mat.gold);
    for (let y = -36; y < 350; y += 18) {
      box(root, side * 22.2, y, -16, 0.2, 0.14, 62, mat.pale);
      box(root, side * 29, y, 29.8, 9, 0.18, 0.08, mat.gold);
    }
    for (const z of [-56, -5, 25])
      box(root, side * 22, 170, z, 1.6, 440, 1.6, mat.steel);
  }
  // Rear shaft ribs and passing cross-braces remain visible from the lift.
  box(root, 0, 185, -63, 95, 470, 24, mat.dark);
  for (const x of [-17, -8, 8, 17]) {
    box(root, x, 180, -49, 1.4, 440, 2, mat.steel);
    box(root, x, 180, -47.95, 0.12, 430, 0.07, mat.gold);
  }
  for (let y = 18; y < 350; y += 18)
    box(root, 0, y, -48, 43, 0.65, 1.5, mat.wall);
  for (let i = 0; i < 16; i++) {
    const craft = new THREE.Group();
    const side = i % 2 ? -1 : 1;
    craft.position.set(
      side * (53 + (i % 5) * 15),
      -15 + i * 9,
      40 + (i % 4) * 26,
    );
    box(craft, 0, 0, 0, 2.4, 0.75, 4.4, mat.steel);
    box(craft, 0, 0, 0.5, 6, 0.2, 1, mat.dark);
    box(craft, 0, 0, 2.2, 1.4, 0.4, 0.12, mat.mint);
    root.add(craft);
    fleets.push({
      mesh: craft,
      y: craft.position.y,
      z: craft.position.z,
      phase: i * 0.8,
    });
  }

  function replaceSign(mesh, text, color) {
    const replacement = sign(text, mesh.geometry.parameters.width, color);
    const oldMap = mesh.material.map;
    const oldMaterial = mesh.material;
    oldMap.dispose();
    resources.delete(oldMap);
    oldMaterial.dispose();
    resources.delete(oldMaterial);
    mesh.material = replacement.material;
    replacement.geometry.dispose();
    resources.delete(replacement.geometry);
  }
  function setLiftReady(value) {
    if (ready === value) return;
    ready = value;
    liftMat.color.setHex(value ? 0x69ffd2 : 0xd98b42);
    liftMat.emissive.copy(liftMat.color);
    replaceSign(
      liftStatus,
      value
        ? activeFloor === 1
          ? "[ E ]  ASCEND TO FLOOR 02"
          : "ASCENT ROUTE SECURED"
        : "SECURE THE ATRIUM",
      value ? "#91ffe0" : "#f3bb76",
    );
  }
  function setLiftProgress(progress) {
    liftAssembly.position.y =
      THREE.MathUtils.clamp(progress, 0, 1) * deckHeight;
  }
  function setFloor(number) {
    activeFloor = number;
    floorY = (number - 1) * deckHeight;
    deck.position.y = floorY;
    setLiftProgress(0);
    liftPosition.y = floorY;
    colliders.length = 0;
    for (const c of fixedColliders) {
      c.baseY = floorY;
      colliders.push(c);
    }
    for (const c of covers) {
      c.group.visible = c.floors.includes(number);
      if (c.group.visible) {
        c.collider.baseY = floorY;
        colliders.push(c.collider);
      }
    }
    spawnPoints.length = 0;
    for (const [x, z] of [
      [-14.5, -20],
      [14.5, -21],
      [-8, -31],
      [0, -31],
      [8, -31],
      [-2, -24],
      [14, -30],
    ]) {
      spawnPoints.push(new THREE.Vector3(x, floorY, z));
    }
    replaceSign(
      floorLabel,
      number === 1 ? "01 / ARRIVAL ATRIUM" : "02 / SENTINEL GALLERY",
      "#d7e8ef",
    );
    ready = null; // Rebuild the label once after changing floor.
    setLiftReady(false);
  }
  setFloor(1);

  return {
    root,
    colliders,
    spawnPoints,
    liftPosition,
    get floorY() {
      return floorY;
    },
    setFloor,
    setLiftReady,
    setLiftProgress,
    update(dt, time) {
      liftMat.emissiveIntensity = ready ? 1.05 + Math.sin(time * 3) * 0.3 : 0.5;
      for (const fleet of fleets) {
        fleet.mesh.position.y =
          fleet.y + Math.sin(time * 0.4 + fleet.phase) * 3;
        fleet.mesh.position.z =
          fleet.z + Math.sin(time * 0.07 + fleet.phase) * 25;
      }
    },
    dispose() {
      scene.remove(root);
      for (const resource of resources) resource.dispose();
    },
  };
}
