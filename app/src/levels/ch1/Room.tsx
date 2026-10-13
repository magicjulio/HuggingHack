/**
 * Chapter 1 3D room: every prop is a designer model now. Shell, desk and the discovery lighting
 * in RoomShell.tsx; depot, scorer eye and scan plinth in models.tsx; the five stations in
 * stations/. Visual states come from the store; ids and poses from layout.ts.
 */
import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { isDebug } from '../../ui/DebugPanel';
import { useCh1Store } from './context';
import { PROPS } from './layout';
import { Depot3D, Plinth3D, Scorer3D } from './models';
import { Desk3D, Reflections, RoomShell } from './RoomShell';
import { Stations } from './stations';

type PropId = (typeof PROPS)[number]['id'];
/** Dev/e2e: a target forced by `__ch1view.aim(id)`, held until the player uses something. */
let aimed: PropId | null = null;

/** Finds the usable object under the crosshair and stores it as `target`. */
function Targeting() {
  const store = useCh1Store();
  const { camera } = useThree();
  const fwd = useRef(new Vector3());
  const to = useRef(new Vector3());
  useFrame(() => {
    const s = store.getState();
    let best: PropId | null = null;
    if (s.window) aimed = null;
    if (aimed && s.phase === 'play' && !s.window) best = aimed;
    else if (s.phase === 'play' && !s.window) {
      camera.getWorldDirection(fwd.current);
      let bestAngle = 0.42; // ~24° cone
      for (const p of PROPS) {
        if (s.objects[p.id] === 'off') continue;
        to.current.set(...p.focus).sub(camera.position);
        const dist = to.current.length();
        if (dist > 2.6) continue;
        const angle = fwd.current.angleTo(to.current);
        if (angle < bestAngle) {
          bestAngle = angle;
          best = p.id;
        }
      }
    }
    if (best !== s.target) store.setState({ target: best });
  });
  return null;
}

/**
 * Dev/e2e hook: `window.__ch1view.at(name, dy, dz)` = where a named 3D node is on screen (client px), so
 * Playwright can click and drag things in the room (e.g. the S3 plugs); `aim(id)` forces the target.
 */
function DebugView() {
  const { camera, scene, gl } = useThree();
  useEffect(() => {
    if (!(import.meta.env.DEV || isDebug())) return;
    const w = window as unknown as { __ch1view?: unknown };
    w.__ch1view = {
      /** `dy`, `dz`: world metres from the node's origin. */
      at: (name: string, dy = 0, dz = 0) => {
        const o = scene.getObjectByName(name);
        if (!o) return null;
        const p = o.getWorldPosition(new Vector3());
        p.y += dy;
        p.z += dz;
        p.project(camera);
        const r = gl.domElement.getBoundingClientRect();
        return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
      },
      /** Pretend the crosshair is on `id` until something is used (fast renderers re-aim each frame). */
      aim: (id: PropId) => {
        aimed = id;
      },
    };
    return () => {
      delete w.__ch1view;
    };
  }, [camera, scene, gl]);
  return null;
}

export function Room() {
  return (
    <>
      <color attach="background" args={['#020306']} />
      <Reflections />
      <Suspense fallback={null}>
        <RoomShell />
        <Desk3D />
        <Depot3D />
        <Scorer3D />
        <Plinth3D />
        <Stations />
      </Suspense>
      <Targeting />
      <DebugView />
    </>
  );
}
