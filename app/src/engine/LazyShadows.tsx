/**
 * Renders a light's shadow map only when it can have changed: the light is lit, and it or a shadow
 * caster inside its cone moved, appeared, vanished or changed shape. A frozen map holds the same
 * picture (moving the camera never changes a shadow map), so nothing is lost in looks; a still room
 * with seven shadow lights then draws the scene once per frame instead of eight times.
 * Hooks `scene.onBeforeRender`, which three calls after the world matrices update and before the
 * shadow pass.
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Sphere,
  type BufferGeometry,
  type InstancedMesh,
  type Light,
  type LightShadow,
  type Mesh,
  type Object3D,
  type PointLight,
  type SpotLight,
} from 'three';

/** World matrix (16) + visible + geometry id + position version + instance version. */
const KEY = 20;

interface Caster {
  key: Float64Array;
  sphere: Sphere;
  frame: number;
}

interface Watched {
  key: Float64Array;
  /** Something in its reach changed since its map was last drawn. */
  dirty: boolean;
}

type ShadowLight = Light & { shadow: LightShadow; target?: Object3D; distance?: number };

const isCaster = (o: Object3D) =>
  o.castShadow && ((o as Mesh).isMesh || o.type === 'Line' || o.type === 'Points');

/** Deformed every frame by the GPU (bones, morphs): always counts as moved. */
const deforms = (o: Object3D) =>
  (o as Mesh & { isSkinnedMesh?: boolean }).isSkinnedMesh ||
  !!(o as Mesh).morphTargetInfluences?.some((w) => w !== 0);

function casterKey(o: Object3D, visible: boolean, out: Float64Array) {
  out.set(o.matrixWorld.elements);
  const g = (o as Mesh).geometry as BufferGeometry | undefined;
  out[16] = visible ? 1 : 0;
  out[17] = g?.id ?? -1;
  const pos = g?.attributes.position;
  out[18] = pos ? ('version' in pos ? pos.version : pos.data.version) : -1;
  out[19] = (o as InstancedMesh).instanceMatrix?.version ?? -1;
}

function worldSphere(o: Object3D, out: Sphere) {
  const g = (o as Mesh).geometry as BufferGeometry | undefined;
  if (!g || (o as InstancedMesh).isInstancedMesh || deforms(o)) {
    out.radius = Infinity; // can't bound it cheaply: it touches every light
    return out;
  }
  g.computeBoundingSphere();
  return out.copy(g.boundingSphere!).applyMatrix4(o.matrixWorld);
}

function lightKey(l: ShadowLight, out: Float64Array) {
  out.set(l.matrixWorld.elements);
  out.set(l.target?.matrixWorld.elements.slice(12, 15) ?? [0, 0, 0], 16);
  out[19] = ((l as SpotLight).angle ?? 0) * 1e3 + (l.distance ?? 0) + l.shadow.mapSize.x * 1e-3;
}

const same = (a: Float64Array, b: Float64Array) => {
  for (let i = 0; i < KEY; i++) if (a[i] !== b[i]) return false;
  return true;
};

export function LazyShadows() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    const casters = new Map<Object3D, Caster>();
    const lights = new Map<ShadowLight, Watched>();
    const changed: Sphere[] = [];
    const tmp = new Float64Array(KEY);
    const reach = new Sphere();
    let frame = 0;

    const touch = (s: Sphere) => changed.push(s.clone());

    const walk = (o: Object3D, visible: boolean) => {
      const vis = visible && o.visible;
      if (isCaster(o)) {
        casterKey(o, vis, tmp);
        let c = casters.get(o);
        if (!c) {
          c = { key: new Float64Array(tmp), sphere: worldSphere(o, new Sphere()), frame };
          casters.set(o, c);
          touch(c.sphere);
        } else if (!same(c.key, tmp) || deforms(o)) {
          touch(c.sphere); // where it was
          c.key.set(tmp);
          touch(worldSphere(o, c.sphere)); // where it is
        }
        c.frame = frame;
      }
      const l = o as ShadowLight;
      if (l.isLight && l.castShadow && l.shadow) {
        l.shadow.autoUpdate = false;
        lightKey(l, tmp);
        const w = lights.get(l);
        if (!w) lights.set(l, { key: new Float64Array(tmp), dirty: true });
        else if (!same(w.key, tmp)) {
          w.key.set(tmp);
          w.dirty = true;
        }
      }
      for (const ch of o.children) walk(ch, vis);
    };

    const prev = scene.onBeforeRender;
    scene.onBeforeRender = function (...args) {
      prev.apply(this, args);
      frame++;
      changed.length = 0;
      walk(scene, true);
      for (const [o, c] of casters)
        if (c.frame !== frame) {
          touch(c.sphere); // removed from the scene: clear its old shadow
          casters.delete(o);
        }
      for (const [l, w] of lights) {
        if (!l.parent) {
          lights.delete(l);
          continue;
        }
        if (!w.dirty && changed.length) {
          if ((l as PointLight).isPointLight) {
            reach.set(l.getWorldPosition(reach.center), l.distance || Infinity);
            w.dirty = changed.some((s) => s.intersectsSphere(reach));
          } else {
            l.shadow.updateMatrices(l);
            const f = l.shadow.getFrustum();
            w.dirty = changed.some((s) => s.radius === Infinity || f.intersectsSphere(s));
          }
        }
        // A dark light shows no shadow: keep it dirty and draw it once it lights up. Every light
        // still needs a map once: without one three binds a texture of the wrong type, WebGL
        // rejects every draw and the frame stays black.
        if (!l.shadow.map) l.shadow.needsUpdate = true;
        else if (w.dirty && l.intensity > 0 && l.visible) {
          l.shadow.needsUpdate = true;
          w.dirty = false;
        }
      }
    };
    return () => {
      scene.onBeforeRender = prev;
      for (const l of lights.keys()) l.shadow.autoUpdate = true;
    };
  }, [scene]);
  return null;
}
