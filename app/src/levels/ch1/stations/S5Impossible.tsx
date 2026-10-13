/**
 * Station 5 "The impossible one" (§Step 7), in-world: the black monolith. The screen ends in
 * "output → no consumer"; the output pipe runs into a blind cap. Every flag-5 attempt sends a
 * purple pulse down the pipe that dies at the cap. Rig: `s5Rig` in design/3d/index.html.
 */
import { useMemo, useRef, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import url from '../../../assets/models/ch1-station-5.glb?url';
import { TEXT } from '../config';
import { useCh1, useCh1Store } from '../context';
import { STATIONS } from '../layout';
import { findMat, ownMat } from '../rig';
import { PURPLE, ScreenHtml, StationSpot, useStationBase } from './base';

export function Station5() {
  const { scene } = useGLTF(url);
  const store = useCh1Store();
  const { rig, step, st } = useStationBase(scene, 5, PURPLE);
  const parts = useMemo(
    () => ({
      rings: Array.from({ length: 8 }, (_, i) => ownMat(rig.map.get(`pipe_flow_${i + 1}`))),
      cap: findMat(scene, 'cap_glow'),
      seam: findMat(scene, 's5_seam'),
    }),
    [rig, scene],
  );
  const pulse = useRef({ t: -1, seen: 0 });
  const screen = useRef<HTMLDivElement>(null);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = step(dt);
    const attempts = store.getState().flag5Attempts;
    const p = pulse.current;
    if (attempts > p.seen) p.t = 0;
    p.seen = attempts;
    let head = -1;
    if (p.t >= 0) {
      p.t += dt;
      head = p.t * 7; // rings per second
      if (p.t > 2.4) p.t = -1;
    }
    if (parts.seam) parts.seam.emissiveIntensity = s.power === 'off' ? 0.25 : 1.2;
    parts.rings.forEach((m, i) => {
      if (!m) return;
      const d = head - i;
      m.emissiveIntensity =
        s.power === 'off' ? 0 : 0.15 + (d > 0 && d < 1.5 ? 4 * (1 - d / 1.5) : 0);
    });
    const dying = p.t >= 0 && head > 8;
    if (parts.cap)
      parts.cap.emissiveIntensity = dying
        ? Math.random() < 0.4
          ? 0.1
          : 5
        : s.power === 'off'
          ? 0
          : 0.4;
    if (dying && rig.bulb && Math.random() < 0.5) rig.bulb.emissiveIntensity *= 0.1;
    screen.current?.classList.toggle('is-flick', dying && Math.random() < 0.5);
  });

  const L = STATIONS[5];
  return (
    <>
      <group position={L.pos} rotation={[0, L.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <StationSpot spot={rig.spot} />
      <ScreenHtml n={5} px={[900, 560]} st={st} className="ch1-s5w">
        <S5Screen ref={screen} />
      </ScreenHtml>
    </>
  );
}

function S5Screen({ ref }: { ref: Ref<HTMLDivElement> }) {
  const attempts = useCh1((s) => s.flag5Attempts);
  return (
    <div ref={ref} className="ch1-s5w-body">
      <h3>FLAG 5</h3>
      <div className="c1-term">
        <div className="d">{'> flag5'}</div>
        <div className="ch1-s5w-out">{TEXT.s5Output}</div>
        {/* (engineer) */}
        <div className="d ch1-s5w-n">attempts: {attempts}</div>
      </div>
    </div>
  );
}

export const S5_URL = url;
