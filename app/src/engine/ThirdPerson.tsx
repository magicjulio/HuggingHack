/**
 * Third-person camera + platforming keys. Generic: the level owns the body and physics
 * (engine/platformer); this component only turns mouse and keys into a camera and a
 * camera-relative `BodyInput`, and follows a target point.
 *
 * Mouse (pointer lock) orbits; WASD/arrows move relative to the camera; Space = jump (held =
 * glide); Shift = dash. `override` takes the camera over (cutscenes); `enabled` gates input.
 */
import { lookScale } from '../state/settings';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import type { BodyInput } from './platformer';

export interface OrbitView {
  yaw: number;
  pitch: number;
}

export interface CameraOverride {
  position: [number, number, number];
  target: [number, number, number];
  /** Scripted films set an exact pose so hard cuts and shakes survive camera following. */
  immediate?: boolean;
  fov?: number;
}

export interface ThirdPersonProps {
  /** Point the camera looks at (e.g. the orb's centre). Read every frame. */
  target: () => Vector3;
  /** Written every frame while enabled. */
  input: BodyInput;
  enabled: boolean;
  distance: number;
  height: number;
  minPitch: number;
  maxPitch: number;
  /** Shared look angles (start values, read back by the minimap). */
  view: OrbitView;
  /** Read every frame: while it returns a pose, the camera eases there instead of following. */
  override?: () => CameraOverride | null;
}

const SENSITIVITY = 0.0022;
const MOVE: Record<string, [number, number]> = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function ThirdPerson({
  target,
  input,
  enabled,
  distance,
  height,
  minPitch,
  maxPitch,
  view,
  override,
}: ThirdPersonProps) {
  const { camera, gl } = useThree();
  const keys = useRef(new Set<string>());
  const dashQueued = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const look = useRef(new Vector3());
  const first = useRef(true);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        if (!e.repeat) dashQueued.current = true;
      }
      if (e.code === 'Space') e.preventDefault();
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    const move = (e: MouseEvent) => {
      if (!enabledRef.current || document.pointerLockElement !== gl.domElement) return;
      const k = SENSITIVITY * lookScale();
      view.yaw -= e.movementX * k;
      view.pitch = Math.max(minPitch, Math.min(maxPitch, view.pitch + e.movementY * k));
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
  }, [gl, view, minPitch, maxPitch]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    // input, relative to the camera's yaw (yaw 0 looks towards -z)
    let mx = 0;
    let mz = 0;
    if (enabled)
      for (const k of keys.current) if (MOVE[k]) [mx, mz] = [mx + MOVE[k][0], mz + MOVE[k][1]];
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const c = Math.cos(view.yaw);
      const s = Math.sin(view.yaw);
      input.move = [(mx * c + mz * s) / len, (-mx * s + mz * c) / len];
    } else input.move = [0, 0];
    input.jump = enabled && keys.current.has('Space');
    if (enabled && dashQueued.current) input.dash = true;
    dashQueued.current = false;

    // camera
    const t = target();
    const over = override?.() ?? null;
    let goalPos: Vector3;
    let goalLook: Vector3;
    if (over) {
      goalPos = new Vector3(...over.position);
      goalLook = new Vector3(...over.target);
    } else {
      const cp = Math.cos(view.pitch);
      goalPos = new Vector3(
        t.x + Math.sin(view.yaw) * cp * distance,
        t.y + height + Math.sin(view.pitch) * distance,
        t.z + Math.cos(view.yaw) * cp * distance,
      );
      goalLook = new Vector3(t.x, t.y + height * 0.45, t.z);
    }
    if (first.current || over?.immediate) {
      camera.position.copy(goalPos);
      look.current.copy(goalLook);
      first.current = false;
    }
    const k = 1 - Math.exp(-(over ? 2.5 : 14) * dt);
    camera.position.lerp(goalPos, k);
    look.current.lerp(goalLook, over ? k : 1);
    camera.lookAt(look.current);
    if (over?.fov !== undefined && camera instanceof PerspectiveCamera && camera.fov !== over.fov) {
      camera.fov = over.fov;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  });

  return null;
}
