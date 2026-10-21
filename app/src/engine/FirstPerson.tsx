/**
 * First-person controller: WASD move, mouse look (pointer lock), simple circle-vs-box collisions.
 * Generic: a level passes its colliders, bounds and start pose.
 * `focus` glides the camera to a fixed pose (e.g. squared up to a machine's screen) and back.
 */
import { lookScale } from '../state/settings';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { lookDelta } from './mouseLook';

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
  /** While set, the camera glides to this pose; when cleared it glides back to where it was. */
  focus?: CameraPose | null;
}

export interface CameraPose {
  position: [number, number, number];
  /** Point to look at. */
  target: [number, number, number];
}

/** Yaw/pitch (this controller's convention: yaw 0 looks towards -z) that look from `from` to `to`. */
export function lookAngles(
  from: [number, number, number],
  to: [number, number, number],
): { yaw: number; pitch: number } {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const dz = to[2] - from[2];
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}

/** Shortest signed difference b - a between two angles. */
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** Glide speed (1/s, exponential). */
const GLIDE = 7;

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
  focus = null,
}: FirstPersonProps) {
  const { camera, gl } = useThree();
  const look = useRef({ yaw: startYaw, pitch: 0 });
  const keys = useRef(new Set<string>());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  /** Pose to return to after a focus ends. */
  const saved = useRef<{ pos: [number, number, number]; yaw: number; pitch: number } | null>(null);
  /** On the way back from a focus the player has looked or walked: the view is theirs again. */
  const handedBack = useRef(false);

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
      const [dx, dy] = lookDelta(e);
      if (dx || dy) handedBack.current = true;
      const k = SENSITIVITY * lookScale();
      l.yaw -= dx * k;
      l.pitch = Math.max(-1.4, Math.min(1.4, l.pitch - dy * k));
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

  /** WASD → a step on the floor plan from (x, z), with collisions; null when no key is down. */
  const walk = (x: number, z: number, dt: number): [number, number] | null => {
    let mx = 0;
    let mz = 0;
    for (const k of keys.current) {
      const m = MOVE_KEYS[k];
      if (m) {
        mx += m[0];
        mz += m[1];
      }
    }
    if (!mx && !mz) return null;
    const len = Math.hypot(mx, mz);
    const yaw = look.current.yaw;
    // local (mx, mz) → world, rotated by yaw
    const wx = (mx * Math.cos(yaw) + mz * Math.sin(yaw)) / len;
    const wz = (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) / len;
    x += wx * speed * dt;
    z += wz * speed * dt;
    for (const b of colliders) [x, z] = pushOut(x, z, radius, b);
    x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x));
    z = Math.max(bounds.minZ + radius, Math.min(bounds.maxZ - radius, z));
    return [x, z];
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const l = look.current;
    if (focus && !saved.current)
      saved.current = {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        yaw: l.yaw,
        pitch: l.pitch,
      };
    if (focus) handedBack.current = false;
    if (saved.current) {
      const back = saved.current;
      // returning: walking moves the spot the camera glides back to, so WASD works at once
      if (!focus && enabled) {
        const step = walk(back.pos[0], back.pos[2], dt);
        if (step) {
          back.pos = [step[0], eyeHeight, step[1]];
          handedBack.current = true;
        }
      }
      const free = !focus && handedBack.current;
      const goal = focus
        ? { pos: focus.position, ...lookAngles(focus.position, focus.target) }
        : back;
      const k = 1 - Math.exp(-GLIDE * dt);
      const p = camera.position;
      p.set(
        p.x + (goal.pos[0] - p.x) * k,
        p.y + (goal.pos[1] - p.y) * k,
        p.z + (goal.pos[2] - p.z) * k,
      );
      // once the player looks or walks, the turn back stops and the mouse steers
      if (!free) {
        l.yaw += angleDiff(l.yaw, goal.yaw) * k;
        l.pitch += (goal.pitch - l.pitch) * k;
      }
      // snap when close, so the camera (and anything screen-attached) comes fully to rest
      const d = Math.hypot(goal.pos[0] - p.x, goal.pos[1] - p.y, goal.pos[2] - p.z);
      if (d < 0.003 && (free || Math.abs(angleDiff(l.yaw, goal.yaw)) < 0.002)) {
        p.set(...goal.pos);
        if (!free) {
          l.yaw = goal.yaw;
          l.pitch = goal.pitch;
        }
        if (!focus) saved.current = null;
      }
      camera.rotation.set(l.pitch, l.yaw, 0, 'YXZ');
      return;
    }
    camera.rotation.set(l.pitch, l.yaw, 0, 'YXZ');
    if (!enabled) return;
    const step = walk(camera.position.x, camera.position.z, dt);
    if (step) camera.position.set(step[0], eyeHeight, step[1]);
  });

  return null;
}
