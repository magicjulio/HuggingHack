/**
 * First-person controller: WASD move, mouse look (pointer lock), simple circle-vs-box collisions.
 * Generic: a level passes its colliders, bounds and start pose.
 */
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

/** Axis-aligned box on the floor plan (x/z, metres). */
export interface Box2 {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface FirstPersonProps {
  start: [number, number]; // x, z
  /** Radians; 0 looks towards -z. */
  startYaw?: number;
  eyeHeight?: number;
  radius?: number;
  speed?: number;
  /** Walkable area. */
  bounds: Box2;
  colliders: Box2[];
  /** Movement and look only while enabled (e.g. no window open). */
  enabled: boolean;
}

const SENSITIVITY = 0.0022;
const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Push a circle at (x,z) out of a box. Exported for tests. */
export function pushOut(x: number, z: number, r: number, b: Box2): [number, number] {
  const cx = Math.max(b.minX, Math.min(x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return [x, z];
  if (d2 === 0) {
    // centre inside the box: leave by the nearest side
    const opts: [number, number, number][] = [
      [b.minX - r, z, x - b.minX],
      [b.maxX + r, z, b.maxX - x],
      [x, b.minZ - r, z - b.minZ],
      [x, b.maxZ + r, b.maxZ - z],
    ];
    opts.sort((a, c) => a[2] - c[2]);
    return [opts[0][0], opts[0][1]];
  }
  const d = Math.sqrt(d2);
  return [cx + (dx / d) * r, cz + (dz / d) * r];
}

export function FirstPerson({
  start,
  startYaw = 0,
  eyeHeight = 1.6,
  radius = 0.3,
  speed = 3,
  bounds,
  colliders,
  enabled,
}: FirstPersonProps) {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: startYaw, pitch: 0 });
  const keys = useRef(new Set<string>());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    camera.position.set(start[0], eyeHeight, start[1]);
    camera.rotation.set(0, startYaw, 0, 'YXZ');
    look.current = { yaw: startYaw, pitch: 0 };
    // start pose is applied once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => keys.current.add(e.code);
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    const move = (e: MouseEvent) => {
      if (!enabledRef.current || document.pointerLockElement !== gl.domElement) return;
      const l = look.current;
      l.yaw -= e.movementX * SENSITIVITY;
      l.pitch = Math.max(-1.4, Math.min(1.4, l.pitch - e.movementY * SENSITIVITY));
    };
    addEventListener('keydown', down);
    addEventListener('keyup', up);
    addEventListener('blur', blur);
    addEventListener('mousemove', move);
    return () => {
      removeEventListener('keydown', down);
      removeEventListener('keyup', up);
      removeEventListener('blur', blur);
      removeEventListener('mousemove', move);
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    camera.rotation.set(look.current.pitch, look.current.yaw, 0, 'YXZ');
    if (!enabled) return;
    let mx = 0;
    let mz = 0;
    for (const k of keys.current) {
      const m = MOVE_KEYS[k];
      if (m) {
        mx += m[0];
        mz += m[1];
      }
    }
    if (!mx && !mz) return;
    const len = Math.hypot(mx, mz);
    const yaw = look.current.yaw;
    // local (mx, mz) → world, rotated by yaw
    const wx = (mx * Math.cos(yaw) + mz * Math.sin(yaw)) / len;
    const wz = (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) / len;
    let x = camera.position.x + wx * speed * dt;
    let z = camera.position.z + wz * speed * dt;
    for (const b of colliders) [x, z] = pushOut(x, z, radius, b);
    x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x));
    z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z));
    camera.position.set(x, eyeHeight, z);
  });

  return null;
}
