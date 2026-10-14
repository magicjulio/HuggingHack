/**
 * The agent as a glowing orb — PLACEHOLDER (sphere + additive glow sprite). The designer will send
 * an orb reference; the final version is a shader (handoff/design-to-app, answer 1).
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, type Group } from 'three';

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

export function Orb3D({
  color,
  position = [0, 0, 0],
  radius = 0.5,
  intensity = 1,
  bloom = true,
}: {
  color: string;
  position?: [number, number, number];
  radius?: number;
  /** 0..1, e.g. to fade the orb in. */
  intensity?: number;
  /**
   * false = stays under the bloom threshold: shaded core, soft halo (designer rule 2026-10-14 for
   * other agents; only the player orb blooms).
   */
  bloom?: boolean;
}) {
  const glow = useMemo(glowTexture, []);
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (group.current) group.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 1.4) * 0.04);
  });
  return (
    <group ref={group} position={position}>
      <mesh>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={(bloom ? 1.6 : 0.35) * intensity}
          roughness={bloom ? 1 : 0.45}
          transparent
          opacity={intensity}
        />
      </mesh>
      <sprite scale={[radius * 7, radius * 7, 1]}>
        <spriteMaterial
          map={glow}
          color={color}
          blending={AdditiveBlending}
          transparent
          opacity={(bloom ? 0.8 : 0.22) * intensity}
          depthWrite={false}
        />
      </sprite>
    </group>
  );
}
