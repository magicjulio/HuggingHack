/**
 * Chapter 1 3D room. Depot, scorer eye and scan plinth are the designer's models (models.tsx);
 * everything else is still PLACEHOLDER greybox (boxes + glowing faces + labels).
 * Visual states come from the store; ids from layout.ts.
 */
import { Suspense, useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BackSide,
  PMREMGenerator,
  Vector3,
  type MeshStandardMaterial,
  type PointLight,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Label3D } from '../../engine/Label3D';
import { useCh1, useCh1Store } from './context';
import { CEILING_LAMP, PROPS, ROOM, type PropLayout } from './layout';
import { Depot3D, Plinth3D, Scorer3D } from './models';
import type { ObjState } from './store';

const SCREEN: Record<ObjState, { color: string; intensity: number }> = {
  off: { color: '#000000', intensity: 0 },
  on: { color: '#38d8ff', intensity: 0.35 },
  active: { color: '#39ff9c', intensity: 1.1 },
  done: { color: '#38d8ff', intensity: 0.08 },
};
const LABEL: Record<ObjState, string> = {
  off: '#000',
  on: '#7f93b5',
  active: '#39ff9c',
  done: '#4a5a78',
};

/** Above the glowing screen if there is one, else above the box. */
function labelPosition(p: PropLayout): [number, number, number] {
  if (p.screen && p.id !== 'desk') {
    const [x, y, z] = p.screen.pos;
    return [x, y + p.screen.size[1] / 2 + 0.18, z];
  }
  return [p.focus[0], p.pos[1] + p.size[1] / 2 + (p.id === 'desk' ? 0.35 : 0.3), p.focus[2]];
}

function Prop({ p }: { p: PropLayout }) {
  const state = useCh1((s) => s.objects[p.id]);
  const targeted = useCh1((s) => s.target === p.id);
  const glimmer = useCh1((s) => p.id === 'depot' && s.depotGlimmer);
  const lit = useCh1((s) => s.lightsOn);
  const mat = useRef<MeshStandardMaterial>(null);

  useFrame(({ clock }) => {
    const m = mat.current;
    if (!m) return;
    const base = SCREEN[state];
    let k = base.intensity;
    if (state === 'active') k *= 0.85 + 0.15 * Math.sin(clock.elapsedTime * 3);
    if (glimmer) k = 0.6 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 4));
    if (targeted) k += 0.35;
    m.emissiveIntensity = k;
  });

  const s = SCREEN[state];
  const isPaper = p.id === 'desk';
  return (
    <group>
      <mesh position={p.pos}>
        <boxGeometry args={p.size} />
        <meshStandardMaterial color={lit ? '#1a2333' : '#0b0f17'} roughness={0.85} />
      </mesh>
      {p.screen && (
        <mesh
          position={p.screen.pos}
          rotation={isPaper ? [-Math.PI / 2, 0, 0.15] : [0, p.screen.rotY, 0]}
        >
          <planeGeometry args={p.screen.size} />
          <meshStandardMaterial
            ref={mat}
            color={isPaper ? '#e8eef8' : '#05080d'}
            emissive={glimmer ? '#ffb020' : isPaper && state !== 'off' ? '#ffffff' : s.color}
            emissiveIntensity={s.intensity}
          />
        </mesh>
      )}
      {state !== 'off' && (
        <Label3D
          text={p.label}
          position={labelPosition(p)}
          color={targeted ? '#ffffff' : LABEL[state]}
          size={0.12}
        />
      )}
    </group>
  );
}

function CeilingLamp() {
  const store = useCh1Store();
  const lit = useCh1((s) => s.lightsOn);
  const light = useRef<PointLight>(null);
  const mat = useRef<MeshStandardMaterial>(null);
  useFrame(() => {
    const s = store.getState();
    // flicker grows with failed flag-5 attempts; one last flicker in the ending
    const flicker =
      s.phase === 'ending' && s.endTime > 1.8 && s.endTime < 2.6 ? 1 : s.ceilingFlicker;
    const on = Math.random() > flicker * 0.55;
    const k = lit ? (on ? 1 : 0.08) : 0;
    if (light.current) light.current.intensity = 22 * k;
    if (mat.current) mat.current.emissiveIntensity = 1.5 * k;
  });
  return (
    <group position={CEILING_LAMP}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.2, 0.3]} />
        <meshStandardMaterial ref={mat} color="#111" emissive="#e8f4ff" emissiveIntensity={0} />
      </mesh>
      <pointLight ref={light} position={[0, -0.3, 0]} distance={16} decay={1.6} color="#dce9ff" />
    </group>
  );
}

/**
 * Soft reflections for the metal props (built locally, no HDR download). Same setup as the
 * designer's review page: RoomEnvironment at low intensity. Dims while the room is dark.
 */
function Reflections() {
  const { gl, scene } = useThree();
  const lit = useCh1((s) => s.lightsOn);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useEffect(() => {
    scene.environmentIntensity = lit ? 0.35 : 0.05;
  }, [lit, scene]);
  return null;
}

/** Finds the usable object under the crosshair and stores it as `target`. */
function Targeting() {
  const store = useCh1Store();
  const { camera } = useThree();
  const fwd = useRef(new Vector3());
  const to = useRef(new Vector3());
  useFrame(() => {
    const s = store.getState();
    let best: (typeof PROPS)[number]['id'] | null = null;
    if (s.phase === 'play' && !s.window) {
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

export function Room() {
  const lit = useCh1((s) => s.lightsOn);
  const stepId = useCh1((s) => s.stepId);
  const w = ROOM.maxX - ROOM.minX;
  const d = ROOM.maxZ - ROOM.minZ;
  return (
    <>
      <color attach="background" args={['#020306']} />
      <Reflections />
      <ambientLight intensity={lit ? 0.45 : 0.03} />
      {lit && <hemisphereLight args={['#9fc4ff', '#0a0d14', 0.35]} />}
      {/* Step 1: only the desk is lit */}
      {(stepId === 'wake' || stepId === 'prompt') && (
        <spotLight
          position={[0, 3.2, 0.2]}
          angle={0.45}
          penumbra={0.6}
          intensity={40}
          distance={6}
          color="#e6f0ff"
        />
      )}

      {/* shell */}
      <mesh position={[0, ROOM.height / 2, 0]}>
        <boxGeometry args={[w, ROOM.height, d]} />
        <meshStandardMaterial
          color={lit ? '#121a28' : '#06080d'}
          side={BackSide}
          roughness={0.95}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={lit ? '#0d1320' : '#040509'} roughness={1} />
      </mesh>
      {lit && (
        <gridHelper args={[Math.max(w, d), 24, '#1c3550', '#132235']} position={[0, 0.002, 0]} />
      )}

      {PROPS.filter((p) => !p.model).map((p) => (
        <Prop key={p.id} p={p} />
      ))}
      <Suspense fallback={null}>
        <Depot3D />
        <Scorer3D />
        <Plinth3D />
      </Suspense>
      <CeilingLamp />
      <Targeting />
    </>
  );
}
