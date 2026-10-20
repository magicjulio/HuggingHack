import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// Instancing helpers for the approach (landing area; flight.js, flight-combat.js, barrier.js).
// A glb "prefab" (a node and its subtree) is baked into one merged geometry per material, in the
// prefab node's own frame. Named moving parts can be kept out of the bake and get their own bake.
//   bakePrefab(node, { skip: ["fan_l", ...] }) -> [{ geometry, material }]
//   createInstancer(parent, bake, capacity, { cast, name }) -> { set(i, matrix), hide(i), commit(), meshes, capacity }
//   freezeStatic(model, movingNames) merges a hero model's static meshes in place (fewer draw calls).
const KEEP = ["position", "normal", "uv"];

function cleanGeometry(src, matrix) {
  let g = src.clone().applyMatrix4(matrix);
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (!g.attributes.normal) g.computeVertexNormals();
  g.morphAttributes = {};
  return g;
}

export function bakePrefab(node, { skip = [] } = {}) {
  node.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(node.matrixWorld).invert();
  const byMat = new Map();
  const m = new THREE.Matrix4();
  (function walk(o) {
    if (o !== node && skip.includes(o.name)) return;
    if (o.isMesh) {
      m.multiplyMatrices(inv, o.matrixWorld);
      const key = o.material.name || o.material.uuid;
      if (!byMat.has(key)) byMat.set(key, { material: o.material, geos: [] });
      byMat.get(key).geos.push(cleanGeometry(o.geometry, m));
    }
    for (const c of o.children) walk(c);
  })(node);
  return [...byMat.values()].map(({ material, geos }) => ({ geometry: mergeGeometries(geos), material }));
}

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
export function createInstancer(parent, bake, capacity, { name = "inst", materials } = {}) {
  const meshes = bake.map(({ geometry, material }) => {
    const im = new THREE.InstancedMesh(geometry, materials?.(material) ?? material, capacity);
    im.name = `${name}:${material.name}`;
    im.frustumCulled = false; // instances spread over kilometres; the bounding sphere would be wrong
    for (let i = 0; i < capacity; i++) im.setMatrixAt(i, ZERO);
    parent.add(im);
    return im;
  });
  let used = 0; // highest index written this frame + 1 (draw count)
  return {
    meshes,
    capacity,
    set(i, matrix) {
      for (const im of meshes) im.setMatrixAt(i, matrix);
      if (i + 1 > used) used = i + 1;
    },
    hide(i) {
      for (const im of meshes) im.setMatrixAt(i, ZERO);
    },
    commit() {
      for (const im of meshes) {
        im.count = Math.max(used, 0);
        im.visible = used > 0; // an empty InstancedMesh still costs a draw call
        im.instanceMatrix.needsUpdate = true;
      }
      used = 0;
    },
  };
}

// Merge every mesh of `model` that is not under one of `moving` into one mesh per material,
// parented to `model` (identity frame). Each moving part gets the same treatment in its own frame,
// so it still moves as one piece.
export function freezeStatic(model, moving = []) {
  const out = freezeInto(model, moving);
  model.traverse((o) => {
    if (moving.includes(o.name)) out.push(...freezeInto(o, moving));
  });
  return out;
}
function freezeInto(frame, stop) {
  frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const byMat = new Map();
  (function walk(o) {
    if (o !== frame && stop.includes(o.name)) return;
    if (o.isMesh && o.geometry.attributes.position) {
      m.multiplyMatrices(inv, o.matrixWorld);
      const key = o.material.name || o.material.uuid;
      if (!byMat.has(key)) byMat.set(key, { material: o.material, geos: [] });
      byMat.get(key).geos.push(cleanGeometry(o.geometry, m));
      o.geometry = new THREE.BufferGeometry(); // keep the node (children may be moving parts), drop the draw
    }
    for (const c of [...o.children]) walk(c);
  })(frame);
  const merged = [];
  for (const { material, geos } of byMat.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.name = "frozen:" + material.name;
    frame.add(mesh);
    merged.push(mesh);
  }
  return merged;
}
