/** Small helpers for driving designer .glb models from code (node/material lookup, easing). */
import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  type Euler,
  type Material,
  type Vector3,
} from 'three';
import type { ObjState } from './store';

/** All nodes of a model by name (designer names are unique per file). */
export function nodes(root: Object3D) {
  const map = new Map<string, Object3D>();
  root.traverse((o) => map.set(o.name, o));
  return map;
}

export const matOf = (o: Object3D | undefined) =>
  (o as Mesh | undefined)?.material as MeshStandardMaterial | undefined;

/** First material with this name anywhere under `root`. */
export function findMat(root: Object3D, name: string) {
  let found: MeshStandardMaterial | undefined;
  root.traverse((o) => {
    const m = matOf(o);
    if (!found && m?.name === name) found = m;
  });
  return found;
}

/**
 * Give a mesh its own copy of its material (shared materials can't be driven per mesh).
 * Idempotent: StrictMode runs useMemo twice, and both runs must end up with the material that is
 * actually on the mesh.
 */
export function ownMat(o: Object3D | undefined) {
  const mesh = o as Mesh | undefined;
  if (!mesh?.material) return undefined;
  const m = mesh.material as MeshStandardMaterial;
  if (m.userData.ownedBy === mesh.uuid) return m;
  const copy = m.clone();
  copy.userData = { ...m.userData, ownedBy: mesh.uuid };
  mesh.material = copy;
  return copy;
}

/** Put a code-made material on a mesh once (same StrictMode reason as `ownMat`). */
export function setMat<M extends Material>(o: Object3D | undefined, key: string, make: () => M): M {
  const mesh = o as Mesh;
  const cur = mesh.material as Material;
  if (cur.userData.madeAs === key) return cur as M;
  const m = make();
  m.userData.madeAs = key;
  mesh.material = m;
  return m;
}

/** Every mesh casts and receives shadows (the discovery lighting relies on them). */
export function shadowAll(root: Object3D) {
  root.traverse((o) => {
    if ((o as Mesh).isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
}

/**
 * A node's pose as exported (position + rotation), recorded the first time it's asked for.
 * useGLTF caches scenes: on a replay the nodes still have the last game's pose.
 */
export function restOf(o: Object3D) {
  const u = o.userData as { rest?: { position: Vector3; rotation: Euler } };
  u.rest ??= { position: o.position.clone(), rotation: o.rotation.clone() };
  return u.rest;
}

export const ease = (k: number) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
};

/** Station power as the designer's rigs use it: dormant / awake / finished. */
export type Power = 'off' | 'on' | 'done';
export const powerOf = (s: ObjState): Power => (s === 'off' ? 'off' : s === 'done' ? 'done' : 'on');

/** A canvas texture for glTF UVs (flipY off). */
export function canvasTexture(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  return tex;
}

/** A glowing UI plane: the mesh gets a black material lit by a canvas (`emissiveMap`). */
export function uiScreen(o: Object3D | undefined, key: string, w: number, h: number) {
  const mat = setMat(
    o,
    key,
    () =>
      new MeshStandardMaterial({
        color: '#000',
        emissive: '#fff',
        emissiveMap: canvasTexture(w, h),
        roughness: 0.6,
      }),
  );
  const tex = mat.emissiveMap as CanvasTexture;
  return { mat, tex, g: (tex.image as HTMLCanvasElement).getContext('2d')! };
}
