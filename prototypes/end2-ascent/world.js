import * as THREE from "three";
import { textPlate } from "./art.js";
import { interiorLighting, createFloorSets } from "./floors.js";
import { createLift } from "./lift.js";
import { createFloor2 } from "./floor2.js";

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
  // Signs size their canvas to the text (art.js textPlate), so long lines are
  // never cropped. `size` keeps its old meaning: glyphs are size * 0.074 m tall.
  function sign(text, size, color = "#c7dce6") {
    const px = 96;
    const mesh = textPlate(text, { width: 1, px, color, letter: 0.06 });
    const aspect = mesh.geometry.parameters.height; // canvas h / w, with h = 1.5 px
    const scale = (((0.59 * size) / 8) * 1.5) / aspect; // font px -> 0.074 * size m
    mesh.geometry.scale(scale, scale, 1);
    mesh.material.side = THREE.DoubleSide;
    mesh.userData.size = size;
    resources.add(mesh.geometry);
    resources.add(mesh.material);
    resources.add(mesh.material.map);
    return mesh;
  }
  function addSign(parent, text, size, x, y, z, color) {
    const mesh = sign(text, size, color);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Greybox architecture: shown until the authored floor kits load (floors.js), and
  // kept as the fallback if they fail. Its colliders stay the gameplay truth.
  const legacy = new THREE.Group();
  legacy.name = "greybox architecture";
  deck.add(legacy);
  // Large floor plates with inset seams: enough contrast to read silhouettes.
  box(legacy, 0, -0.45, (nearZ + farZ) / 2, width, 0.9, nearZ - farZ, mat.floor);
  for (let z = farZ + 4; z < nearZ; z += 8) {
    box(legacy, 0, 0.007, z, width - 1, 0.014, 0.035, mat.dark);
    for (const x of [-12, -4, 4, 12])
      box(legacy, x, 0.009, z + 3.9, 0.035, 0.018, 7.8, mat.dark);
  }
  // Light rails on the flanks lead to the lift without cluttering target space.
  for (const side of [-1, 1]) {
    const x = side * (width / 2 - 1.2);
    box(legacy, x, 0.015, -15.5, 0.08, 0.03, 50, mat.gold);
    box(legacy, side * 13.9, 0.015, -15.5, 0.045, 0.03, 43, mat.steel);
    for (let z = -32; z < 10; z += 6) {
      const chevron = box(
        legacy,
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
        legacy,
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
    box(legacy, (side * width) / 2, 0.65, -16, 0.7, 1.3, 56, mat.wall);
    fixedColliders.push(collider(side * (width / 2 + 0.2), -16, 0.8, 56, 24));
    box(legacy, side * (width / 2 - 1), 10.8, -16, 3, 0.7, 55, mat.dark);
    box(legacy, side * (width / 2 - 2.5), 11.9, -16, 0.13, 1.5, 55, mat.steel);
    box(legacy, side * (width / 2 - 2.5), 12.65, -16, 0.16, 0.1, 55, mat.gold);
    for (const z of [8, -8, -25, -42]) {
      box(legacy, side * (width / 2 - 0.25), 9, z, 1.2, 18, 1.4, mat.steel, true);
      box(
        legacy,
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
  box(legacy, -12, 6, nearZ + 0.4, 14, 12, 1, mat.wall);
  box(legacy, 12, 6, nearZ + 0.4, 14, 12, 1, mat.wall);
  box(legacy, 0, 10.2, nearZ + 0.4, 10, 3.6, 1, mat.steel);
  fixedColliders.push(collider(0, nearZ + 0.7, width, 0.8, 24));
  box(legacy, 0, 9, farZ - 0.8, width + 1, 18, 1.6, mat.wall);
  fixedColliders.push(collider(0, farZ - 0.8, width + 1, 1.6, 24));
  for (const z of [4, -14, -32]) {
    box(legacy, 0, 17.7, z, width, 0.8, 1.6, mat.dark);
    box(legacy, 0, 17.25, z, width - 3, 0.08, 0.45, mat.pale);
  }
  for (const side of [-1, 1]) {
    for (const z of [-8, -26]) {
      const x = side * 11;
      box(legacy, x, 7, z, 1.5, 14, 1.5, mat.steel, true);
      box(legacy, x, 0.3, z, 2.05, 0.6, 2.05, mat.dark);
      box(legacy, x, 5.9, z + 0.77, 0.11, 9, 0.035, mat.gold);
      fixedColliders.push(collider(x, z, 2.05, 2.05, 14));
    }
  }

  const lighting = interiorLighting(scene, root);
  // Authored atrium (y = 0) and data hall (y = floorHeight) with their emblems and
  // wall signs: floors.js, from design/3d/end2/floors/. Visual only.
  const floorSets = createFloorSets({
    scene,
    root,
    deck,
    T,
    brand,
    lighting,
    resources,
    sign,
    riding: () => lift.assembly.position.y > 0.1,
  });
  floorSets.legacy(legacy);

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
    floorSets.cover(group, sx, floors); // swaps the boxes for the cover kit piece
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

  // The lift platform, rails, tower shell, sky and fleet live in lift.js (lift-ui).
  const lift = createLift({ scene, root, deck, T, resources });

  // Floor 2 is a real building (floor2.js, building): its own colliders, ground height,
  // sections, doors and nav. ?f2=arena keeps the old floor-2 arena for comparison.
  const level =
    new URLSearchParams(location.search).get("f2") === "arena" ? null : createFloor2({ resources, T });
  if (level) {
    level.group.position.y = deckHeight;
    level.group.visible = false;
    root.add(level.group);
    floorSets.useBuilding(true);
  }
  const backdrop = root.getObjectByName("tower backdrop");
  let levelVersion = -1;
  // world.colliders holds absolute copies of the level's (local) colliders; door
  // changes bump level.version and are re-synced here.
  function syncLevel() {
    levelVersion = level.version;
    colliders.length = 0;
    for (const c of level.colliders) colliders.push({ ...c, baseY: c.baseY + floorY, local: c });
  }
  const onLevel = () => level && activeFloor === 2;

  function setLiftReady(value) {
    ready = value;
    lift.setReady(value, activeFloor);
  }
  function setLiftProgress(progress) {
    lift.setProgress(progress);
  }
  function setFloor(number) {
    activeFloor = number;
    lighting.setFloor(number);
    floorSets.setFloor(number);
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
    if (onLevel()) {
      for (const c of covers) c.group.visible = false;
      syncLevel();
      for (const s of level.sections)
        for (const [x, z, y] of s.anchors.drop) spawnPoints.push(new THREE.Vector3(x, floorY + y, z));
      level.setSection(level.sectionAt(level.start.x, level.start.z));
    } else for (const [x, z] of [
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
    lift.setReady.force = true; // rebuild the sign once after changing floor
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
    lift,
    floors: floorSets,
    // the floor-2 building while on floor 2 (null on floor 1 and with ?f2=arena)
    get level() {
      return onLevel() ? level : null;
    },
    // walkable height (absolute y) under x, z
    ground(x, z) {
      return onLevel() ? floorY + level.ground(x, z) : floorY;
    },
    update(dt, time, camera) {
      lift.update(dt, time, camera);
      floorSets.update(dt, time);
      if (level) {
        const riding = lift.assembly.position.y > 0.1;
        const inside = activeFloor === 2 && !riding;
        level.group.visible = inside;
        if (backdrop) backdrop.visible = !inside; // the building's walls replace the tower shell
        if (inside) {
          level.update(dt, time);
          if (level.version !== levelVersion) syncLevel();
        }
      }
    },
    dispose() {
      scene.remove(root);
      for (const resource of resources) resource.dispose();
    },
  };
}
