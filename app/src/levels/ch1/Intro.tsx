/**
 * Step 0: void, a glowing orb forms (this is you), camera pushes in → first person.
 * Skippable with any key or click (Chapter1 handles input). PLACEHOLDER motion.
 */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Orb3D } from '../../engine/Orb3D';
import { TIMING } from './config';

export function IntroScene({ color, onDone }: { color: string; onDone: () => void }) {
  const { camera } = useThree();
  const t = useRef(0);
  const done = useRef(false);
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.05);
    const k = Math.min(1, t.current / TIMING.introSeconds);
    // ease-in push towards the orb
    camera.position.set(0, 0, 7 - 6.4 * k * k * k);
    camera.rotation.set(0, 0, 0);
    if (k >= 1 && !done.current) {
      done.current = true;
      onDone();
    }
  });
  return (
    <>
      <color attach="background" args={['#020306']} />
      <ambientLight intensity={0.2} />
      <Orb3D color={color} radius={0.45} intensity={1} />
    </>
  );
}
