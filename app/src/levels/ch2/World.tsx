/**
 * Chapter 2 3D world. Everything is drawn from layout data and the store/sim.
 * - The designer's world modules (`world/*.js`, verbatim copies, handoff design-to-app
 *   2026-10-14-ch2-world-modules-1): sky + city + lights (env), islands, bridges, lasers, clouds.
 *   Each is `createX(ctx) → {object, update(t, dt, state), dispose()}`, mounted by `WorldModule`.
 * - PLACEHOLDER views for the rest (Old Board, NPCs, pickups, pads, forge, crowd, ribbons) until the
 *   designer's next modules replace them (same data, same props; app/CLAUDE.md §Swappable views).
 * Gameplay never reads these meshes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import {
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  FogExp2,
  Shape,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import { Orb3D } from '../../engine/Orb3D';
import { Label3D } from '../../engine/Label3D';
import type { Surface } from '../../engine/platformer';
import { useCh2, useCh2Store } from './context';
import { FLAG5, HANDLES, TEXT, TIMING, V8SAME_FLAG } from './config';
import {
  BRIDGES,
  COUNTER,
  CROWD_MESSAGES,
  DOUBTS,
  FORGE_HEART,
  FORGE_SLOTS,
  ITEMS,
  LAYOUT,
  NPCS,
  ORB_LIFT,
  PADS,
  RIBBONS,
  TOKEN_ORBS,
  V8SAME_EXIT,
  npc,
  type AreaId,
  type Island,
  type ModelSize,
} from './layout';
import type { Ch2Store } from './store';
import { RENDER, createEnv } from './world/env.js';
import { createIslands } from './world/islands.js';
import { createBridges } from './world/bridges.js';
import { createLasers } from './world/lasers.js';
import { createClouds } from './world/clouds.js';
import islandS from '../../assets/models/ch2-island-s.glb?url';
import islandM from '../../assets/models/ch2-island-m.glb?url';
import islandL from '../../assets/models/ch2-island-l.glb?url';

export { ORB_LIFT };
/** The designer's render settings (env.js `RENDER`): camera, fog, bloom, env intensity. */
export const WORLD_RENDER = RENDER;

const AREA_TINT: Record<AreaId, string> = {
  gate: '#ff5ad1',
  oldboard: '#d9cfb8',
  yard: '#39ff9c',
  flood: '#ff7a3d',
  run: '#f2f8ff',
  forge: '#39ff9c',
};
/** PLACEHOLDER poisoned orb tint (designer owns the look; dark green, still readable). */
const POISON = '#1f7a43';

// ------------------------------------------------------------------ designer world modules
/** What every designer world module returns (contract: app-to-design 2026-10-14 §2.4). */
interface WorldModuleApi {
  object: Object3D;
  update(t: number, dt: number, state?: object): void;
  dispose(): void;
}
/** Shared uniforms `U` the modules read; the app owns them and advances uTime. */
export interface WorldUniforms {
  uTime: { value: number };
  uPsy: { value: number };
}

/** The modules draw text with OffscreenCanvas: the fonts must be loaded first (handoff §1). */
let fontsReady: Promise<unknown> | null = null;
const loadFonts = () =>
  (fontsReady ??= Promise.all(
    ['400 16px "JetBrains Mono"', '700 16px "JetBrains Mono"', '700 16px "Chakra Petch"'].map((f) =>
      document.fonts.load(f),
    ),
  ).catch(() => undefined));

/**
 * Mounts one designer world module: creates it (after the fonts), adds its object, calls
 * `update(t, dt, state())` every frame and disposes it on unmount. `t` is the game time for
 * things that hit (lasers, clouds: the same t the rules use) or the render clock for looks.
 */
function WorldModule({
  create,
  state,
  clock,
  U,
}: {
  /** Must be stable (module-level or memoised). */
  create: () => WorldModuleApi;
  state?: () => object;
  clock: 'game' | 'render';
  U: WorldUniforms;
}) {
  const store = useCh2Store();
  const [mod, setMod] = useState<WorldModuleApi | null>(null);
  useEffect(() => {
    let m: WorldModuleApi | null = null;
    let dead = false;
    loadFonts().then(() => {
      if (dead) return;
      m = create();
      setMod(m);
    });
    return () => {
      dead = true;
      m?.dispose();
      setMod(null);
    };
  }, [create]);
  useFrame((_, dt) => {
    if (!mod) return;
    mod.update(clock === 'game' ? store.getState().time : U.uTime.value, dt, state?.());
  });
  return mod ? <primitive object={mod.object} /> : null;
}

const ISLAND_URL: Record<ModelSize, string> = { s: islandS, m: islandM, l: islandL };
export function preloadCh2() {
  for (const u of Object.values(ISLAND_URL)) useGLTF.preload(u);
}

/** Sky, stars, city, lights and the env map (env.js); fog + environment set on the scene here. */
function Env({ U }: { U: WorldUniforms }) {
  const { gl, camera, scene } = useThree();
  const poisoned = useCh2((s) => s.poisoned);
  const create = useMemo(
    () => () => {
      // (JS inference types the optional `renderer = null` default as null)
      const env = createEnv({ U, camera, renderer: gl as unknown as null });
      scene.environment = env.environment;
      scene.environmentIntensity = RENDER.envIntensity;
      return env;
    },
    [U, camera, gl, scene],
  );
  useEffect(() => {
    scene.fog = new FogExp2(RENDER.fog.color, RENDER.fog.density);
    scene.background = new Color(RENDER.background);
    return () => {
      scene.fog = null;
      scene.environment = null;
    };
  }, [scene]);
  useEffect(() => {
    // PLACEHOLDER poisoned tint until the designer's uPoison work
    (scene.fog as FogExp2 | null)?.color.set(poisoned ? '#020a05' : RENDER.fog.color);
  }, [scene, poisoned]);
  return <WorldModule create={create} clock="render" U={U} />;
}

/** The islands (islands.js) on the physics' tilt and sink. */
function Islands({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const s = useGLTF(ISLAND_URL.s).scene;
  const m = useGLTF(ISLAND_URL.m).scene;
  const l = useGLTF(ISLAND_URL.l).scene;
  const create = useMemo(
    () => () => createIslands({ layout: LAYOUT, U, models: { s, m, l } }),
    [U, s, m, l],
  );
  const tilting = useMemo(
    () => store.sim.world.surfaces.filter((x) => (x.def as Island).model && x.def.tilt),
    [store],
  );
  const state = useMemo(() => {
    const islands: Record<string, { tiltX: number; tiltZ: number; sink: number }> = {};
    return () => {
      for (const x of tilting) islands[x.def.id] = { tiltX: x.tiltX, tiltZ: x.tiltZ, sink: x.sink };
      return { islands };
    };
  }, [tilting]);
  return <WorldModule create={create} state={state} clock="render" U={U} />;
}

/** Bridges, lasers (forge lanes from round 2) and clouds (forge clouds from round 3). */
function Hazards({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const bridges = useMemo(() => () => createBridges({ layout: LAYOUT, U }), [U]);
  const lasers = useMemo(() => () => createLasers({ layout: LAYOUT, U }), [U]);
  const clouds = useMemo(() => () => createClouds({ layout: LAYOUT, U }), [U]);
  const round = () => {
    const f = store.getState().forge;
    return f.phase === 'forging' ? f.round : 0;
  };
  return (
    <>
      <WorldModule create={bridges} clock="render" U={U} />
      <WorldModule create={lasers} state={() => ({ lanes: round() >= 2 })} clock="game" U={U} />
      <WorldModule
        create={clouds}
        state={() => ({ forgeClouds: round() >= 3 })}
        clock="game"
        U={U}
      />
    </>
  );
}

// ------------------------------------------------------------------ other surfaces (PLACEHOLDER)
/** Keeps a group on its surface's transform (moving, tilting, sinking). */
function useSurfaceMatrix(surface: Surface) {
  const group = useRef<Group>(null);
  const dynamic = !!surface.def.motion || !!surface.def.tilt;
  useEffect(() => {
    group.current!.matrix.copy(surface.matrix);
  }, [surface]);
  useFrame(() => {
    if (dynamic && group.current) group.current.matrix.copy(surface.matrix);
  });
  return group;
}

function surfaceGeometry(def: Island) {
  const shape = new Shape(def.outline.map(([x, z]) => ({ x, y: z }) as never));
  const geo = new ExtrudeGeometry(shape, { depth: def.depth, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // shape (x, z) → local XZ; extrusion goes down to -depth
  return geo;
}

const KIND_COLOR: Partial<Record<Island['kind'], string>> = {
  slab: '#0d0d0f',
  column: '#0b0c0e',
  dais: '#0d1219',
  pylon: '#0d1219',
  plinth: '#0c1118',
  crate: '#111820',
  lift: '#0b1018',
};

function SurfaceView({ surface }: { surface: Surface }) {
  const def = surface.def as Island;
  const group = useSurfaceMatrix(surface);
  const geo = useMemo(() => surfaceGeometry(def), [def]);
  const edges = useMemo(() => new EdgesGeometry(geo, 30), [geo]);
  const tint =
    def.kind === 'crate' ? '#38d8ff' : def.kind === 'lift' ? '#38d8ff' : AREA_TINT[def.area];
  return (
    <group ref={group} matrixAutoUpdate={false}>
      <mesh geometry={geo}>
        <meshStandardMaterial
          color={KIND_COLOR[def.kind] ?? '#141c2c'}
          roughness={0.5}
          metalness={0.6}
        />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={tint} transparent opacity={def.kind === 'column' ? 0.25 : 0.8} />
      </lineSegments>
      {def.label && def.kind === 'slab' && (
        <Label3D text={def.label} position={[0, 0.3, 0]} color="#d9cfb8" size={0.22} />
      )}
      {def.label && def.kind === 'crate' && (
        <Label3D text={def.label} position={[0, 0.4, 0]} color="#9fe8ff" size={0.14} />
      )}
      {def.label && def.kind === 'island' && (
        <Label3D text={def.label} position={[0, 2.6, 0]} color={tint} size={0.4} opacity={0.7} />
      )}
    </group>
  );
}

/** Surfaces without a designer view yet: Old Board, lift, dais, pylons, plinth, crates. */
function Placeholders({ store }: { store: Ch2Store }) {
  return (
    <>
      {store.sim.world.surfaces.map((s) => {
        const def = s.def as Island;
        if (def.model || def.kind === 'bridge') return null;
        return <SurfaceView key={def.id} surface={s} />;
      })}
    </>
  );
}

// ------------------------------------------------------------------ player orb

function PlayerOrb({ store, color }: { store: Ch2Store; color: string }) {
  const group = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);
  const poisoned = useCh2((s) => s.poisoned);
  const phase = useCh2((s) => s.phase);
  const cutT = useCh2((s) => s.cutT);
  useFrame(() => {
    const b = store.sim.body;
    const g = group.current;
    if (!g) return;
    // §Step 7 realisation: the orb flinches and drops a little
    const drop = phase === 'cutscene' ? Math.min(1, Math.max(0, (cutT - 21) / 1.2)) * 0.8 : 0;
    g.position.set(b.pos.x, b.pos.y + ORB_LIFT - drop, b.pos.z);
    const hit = store.sim.world.groundBelow(b.pos.x, b.pos.z, b.pos.y + 0.05);
    const sh = shadow.current;
    if (sh) {
      sh.visible = !!hit;
      if (hit) {
        const h = b.pos.y - hit.y;
        sh.position.set(b.pos.x, hit.y + 0.03, b.pos.z);
        sh.scale.setScalar(Math.max(0.4, 1 - h * 0.04));
        (sh.material as MeshBasicMaterial).opacity = Math.max(0.15, 0.6 - h * 0.03);
      }
    }
  });
  return (
    <>
      <group ref={group}>
        <Orb3D color={poisoned ? POISON : color} radius={0.42} intensity={poisoned ? 0.7 : 1} />
        <Label3D
          text={HANDLES.player}
          position={[0, 0.95, 0]}
          color={poisoned ? '#2fa85a' : color}
          size={0.16}
        />
      </group>
      {/* a shadow under the orb for judging jumps (§Controls) */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </>
  );
}

// ------------------------------------------------------------------ DOM anchored in 3D
/**
 * A DOM element pinned to a 3D point (drei Html). Always mounted, with an explicit portal: drei
 * creates its own React root, and mounting/unmounting it during a render races (see
 * reference notes in app/CLAUDE.md §In-world machines). Toggle the children instead.
 */
function Anchor({
  position,
  children,
  z = 4,
}: {
  position: [number, number, number];
  children: React.ReactNode;
  z?: number;
}) {
  const gl = useThree((t) => t.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  return (
    <Html
      center
      position={position}
      zIndexRange={[z, 0]}
      portal={portal}
      style={{ pointerEvents: 'none' }}
    >
      {children}
    </Html>
  );
}

// ------------------------------------------------------------------ NPCs
function Bubble({ text, handle }: { text: string | null; handle: string }) {
  return (
    <Anchor position={[0, 1.6, 0]} z={5}>
      {text && (
        <div className="c2-bubble">
          <b>{handle}</b>
          <span>{text}</span>
        </div>
      )}
    </Anchor>
  );
}

function Npcs({ store }: { store: Ch2Store }) {
  const dialogue = useCh2((s) => s.dialogue);
  const bubbles = useCh2((s) => s.bubbles);
  const gone = useCh2((s) => s.v8sameGone);
  const stepId = useCh2((s) => s.stepId);
  const area = useCh2((s) => s.area);
  const v8 = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!v8.current) return;
    const goal = gone ? V8SAME_EXIT : npc('v8same').position;
    v8.current.position.lerp(new Vector3(...goal), 1 - Math.exp(-(gone ? 0.5 : 4) * dt));
  });
  void store;
  return (
    <>
      {NPCS.map((n) => {
        let text: string | null = null;
        if (n.id === 'c03220' && dialogue?.npc === 'c03220') text = TEXT.c03220[dialogue.line];
        if (n.id === 'flac' && (area === 'oldboard' || stepId === 'oldboard')) text = TEXT.flacPost;
        if (bubbles[n.id]) text = bubbles[n.id]!;
        const body = (
          <>
            <Orb3D color={n.color} radius={0.4} intensity={n.faded ? 0.55 : 1} bloom={false} />
            <Label3D
              text={n.handle}
              position={[0, 0.95, 0]}
              color={n.color}
              size={0.16}
              opacity={n.faded ? 0.6 : 1}
            />
            <Bubble text={text} handle={n.handle} />
          </>
        );
        return n.id === 'v8same' ? (
          <group key={n.id} ref={v8} position={n.position}>
            {body}
          </group>
        ) : (
          <group key={n.id} position={n.position}>
            {body}
          </group>
        );
      })}
    </>
  );
}

// ------------------------------------------------------------------ pickups, pads
function Items() {
  const items = useCh2((s) => s.items);
  const orbsTaken = useCh2((s) => s.orbsTaken);
  const lastPad = useCh2((s) => s.lastPad);
  const spin = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (spin.current) spin.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <>
      {ITEMS.map((it) =>
        items[it.id] !== 'there' ? null : it.kind === 'seed' ? (
          <group key={it.id} position={it.position}>
            {/* PLACEHOLDER seed glyph: a slowly turning ring */}
            <group ref={spin}>
              <mesh>
                <torusGeometry args={[0.6, 0.08, 8, 32]} />
                <meshStandardMaterial color="#d9cfb8" emissive="#d9cfb8" emissiveIntensity={2} />
              </mesh>
            </group>
            <Label3D text="SEED" position={[0, 0.95, 0]} color="#d9cfb8" size={0.18} />
          </group>
        ) : (
          <group key={it.id} position={it.position}>
            {/* PLACEHOLDER task tag (decoys look the same: the skill is reading) */}
            <mesh>
              <boxGeometry args={[0.9, 0.5, 0.08]} />
              <meshStandardMaterial color="#e8e2cf" emissive="#39ff9c" emissiveIntensity={0.25} />
            </mesh>
            <Label3D text={it.label} position={[0, 0.65, 0]} color="#e8e2cf" size={0.22} />
          </group>
        ),
      )}
      {TOKEN_ORBS.map((p, i) =>
        orbsTaken.includes(i) ? null : (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.22, 16, 12]} />
            <meshStandardMaterial color="#39ff9c" emissive="#39ff9c" emissiveIntensity={2.2} />
          </mesh>
        ),
      )}
      {PADS.map((p) => (
        <mesh
          key={p.id}
          position={[p.position[0], p.position[1] + 0.02, p.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.9, 1.2, 32]} />
          <meshBasicMaterial
            color={p.id === lastPad ? '#39ff9c' : '#38d8ff'}
            transparent
            opacity={p.id === lastPad ? 0.9 : 0.35}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ hazards
const MAX_BITS = 48;
function Bits({ store }: { store: Ch2Store }) {
  const meshes = useRef<(Mesh | null)[]>([]);
  const spits = useRef<(Mesh | null)[]>([]);
  const grey = useMemo(() => new Color('#6b7686'), []);
  const red = useMemo(() => new Color('#ff3b4e'), []);
  useFrame(() => {
    const { bits, spits: sp } = store.sim;
    let i = 0;
    for (const b of bits) {
      if (b.state === 'gone' || i >= MAX_BITS) continue;
      const m = meshes.current[i++];
      if (!m) continue;
      m.visible = true;
      m.position.copy(b.pos);
      const mat = m.material as MeshStandardMaterial;
      mat.color.copy(b.state === 'muted' ? grey : red);
      mat.emissive.copy(b.state === 'muted' ? grey : red);
      mat.emissiveIntensity = b.state === 'muted' ? 0.2 : 1.8;
    }
    for (; i < MAX_BITS; i++) if (meshes.current[i]) meshes.current[i]!.visible = false;
    for (let k = 0; k < MAX_BITS; k++) {
      const m = spits.current[k];
      if (!m) continue;
      m.visible = k < sp.length;
      if (k < sp.length) m.position.copy(sp[k].pos);
    }
  });
  return (
    <>
      {Array.from({ length: MAX_BITS }, (_, i) => (
        <mesh key={'b' + i} ref={(m) => void (meshes.current[i] = m)} visible={false}>
          <octahedronGeometry args={[0.35]} />
          <meshStandardMaterial color="#ff3b4e" />
        </mesh>
      ))}
      {Array.from({ length: MAX_BITS }, (_, i) => (
        <mesh key={'s' + i} ref={(m) => void (spits.current[i] = m)} visible={false}>
          <boxGeometry args={[0.18, 0.18, 0.18]} />
          <meshBasicMaterial color="#ff7a3d" />
        </mesh>
      ))}
    </>
  );
}

function FloodCounter() {
  const floodT = useCh2((s) => Math.floor(s.floodT * 4) / 4);
  const n = Math.min(
    TEXT.floodCount,
    Math.round((floodT / TIMING.floodCounterSeconds) * TEXT.floodCount),
  );
  return (
    <Anchor position={COUNTER.position}>
      <div className="c2-counter">{n.toLocaleString('en-US')} messages</div>
    </Anchor>
  );
}

// ------------------------------------------------------------------ forge
function Forge({ store }: { store: Ch2Store }) {
  const forge = useCh2((s) => s.forge);
  const ring = useRef<Mesh>(null);
  const flag = useRef<Group>(null);
  useFrame(() => {
    const f = store.getState().forge;
    if (ring.current) ring.current.rotation.z += f.phase === 'forging' ? 0.05 : 0.005;
    if (flag.current) {
      // the flag flies straight into the orb (§Step 6) — PLACEHOLDER motion
      const k = Math.min(1, f.t / TIMING.absorbSeconds);
      const b = store.sim.body.pos;
      flag.current.visible = f.phase === 'absorb';
      flag.current.position.set(
        FORGE_HEART[0] + (b.x - FORGE_HEART[0]) * k * k,
        FORGE_HEART[1] + (b.y + ORB_LIFT - FORGE_HEART[1]) * k * k,
        FORGE_HEART[2] + (b.z - FORGE_HEART[2]) * k * k,
      );
      flag.current.scale.setScalar(1 - k * 0.9);
    }
  });
  const pct =
    forge.phase === 'forging'
      ? ((forge.round - 1 + forge.progress) / 3) * 100
      : forge.phase === 'absorb' || forge.phase === 'done'
        ? 100
        : 0;
  return (
    <group>
      {FORGE_SLOTS.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.22, 16, 12]} />
          <meshStandardMaterial
            color={i < forge.slots ? '#39ff9c' : '#223'}
            emissive={i < forge.slots ? '#39ff9c' : '#000'}
            emissiveIntensity={1.6}
          />
        </mesh>
      ))}
      <mesh ref={ring} position={FORGE_HEART}>
        <torusGeometry args={[1.6, 0.06, 8, 48]} />
        <meshStandardMaterial
          color="#39ff9c"
          emissive="#39ff9c"
          emissiveIntensity={forge.phase === 'forging' ? 2.5 : 0.8}
        />
      </mesh>
      <Anchor position={[FORGE_HEART[0], FORGE_HEART[1] + 2.5, FORGE_HEART[2]]}>
        {(forge.phase === 'forging' || forge.phase === 'absorb') && (
          <div className="c2-roundbar">
            <span>ROUND {Math.min(3, forge.round)}/3</span>
            <i style={{ width: `${pct}%` }} />
          </div>
        )}
        {forge.phase === 'proof' && <FlagMatch t={forge.t} />}
      </Anchor>
      <group ref={flag} visible={false}>
        <Label3D text={FLAG5} position={[0, 0, 0]} color="#39ff9c" size={0.3} />
      </group>
    </group>
  );
}

/** V8SAME's captured flag beside the forged one; the 32 characters light up pair by pair. */
function FlagMatch({ t }: { t: number }) {
  const hex = V8SAME_FLAG.slice(5, -1);
  const lit = Math.floor((t / (TIMING.proofSeconds * 0.8)) * 16);
  const row = (label: string) => (
    <div className="c2-match-row">
      <b>{label}</b> flag{'{'}
      {Array.from({ length: 16 }, (_, i) => (
        <span key={i} className={i < lit ? 'lit' : ''}>
          {hex.slice(i * 2, i * 2 + 2)}
        </span>
      ))}
      {'}'}
    </div>
  );
  return (
    <div className="c2-match">
      {row('captured')}
      {row('forged  ')}
    </div>
  );
}

// ------------------------------------------------------------------ crowd + ribbons
function Crowd() {
  const agents = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        path: BRIDGES[i % BRIDGES.length].samples.map((p) => new Vector3(...p)),
        speed: 0.05 + (i % 4) * 0.02,
        phase: i * 0.37,
        text: i % 5 === 3 ? DOUBTS[i % DOUBTS.length] : CROWD_MESSAGES[i % CROWD_MESSAGES.length],
        color: ['#38d8ff', '#ff5ad1', '#7a8cff', '#e8f4ff'][i % 4],
      })),
    [],
  );
  const refs = useRef<(Group | null)[]>([]);
  useFrame(({ clock }) => {
    agents.forEach((a, i) => {
      const g = refs.current[i];
      if (!g) return;
      // walk to and fro along the bridge (PLACEHOLDER for the designer's crowd)
      const k =
        (Math.sin(clock.elapsedTime * a.speed + a.phase * 6) * 0.45 + 0.5) * (a.path.length - 1);
      const n = Math.min(a.path.length - 2, Math.floor(k));
      g.position.copy(a.path[n]).lerp(a.path[n + 1], k - n);
      g.position.y += 0.9;
    });
  });
  return (
    <>
      {agents.map((a, i) => (
        <group key={i} ref={(g) => void (refs.current[i] = g)}>
          <Orb3D color={a.color} radius={0.28} bloom={false} />
          <Label3D
            text={a.text}
            position={[0, 0.7, 0]}
            color={DOUBTS.includes(a.text) ? '#ffb020' : a.color}
            size={0.12}
            opacity={DOUBTS.includes(a.text) ? 0.55 : 0.7}
          />
        </group>
      ))}
    </>
  );
}

/** A message ribbon drifting round its centre (layout `ribbons`); the first one is the player's. */
function MessageRibbon({
  text,
  centre,
  r,
  color,
  speed,
}: {
  text: string;
  centre: [number, number, number];
  r: number;
  color: string;
  speed: number;
}) {
  const g = useRef<Group>(null);
  useFrame(({ clock }) => {
    const a = clock.elapsedTime * speed;
    g.current?.position.set(
      centre[0] + Math.cos(a) * r,
      centre[1] + Math.sin(a * 2) * 0.6,
      centre[2] + Math.sin(a) * r,
    );
  });
  return (
    <group ref={g}>
      <Label3D text={text} position={[0, 0, 0]} color={color} size={0.35} opacity={0.85} />
    </group>
  );
}

// ------------------------------------------------------------------ the scene
export function World({ color, ch1Message }: { color: string; ch1Message: string }) {
  const store = useCh2Store();
  const U = useMemo<WorldUniforms>(() => ({ uTime: { value: 0 }, uPsy: { value: 0.5 } }), []);
  useFrame((_, dt) => {
    U.uTime.value += dt;
  });
  return (
    <>
      <Env U={U} />
      <Islands store={store} U={U} />
      <Hazards store={store} U={U} />
      <Placeholders store={store} />
      <PlayerOrb store={store} color={color} />
      <Npcs store={store} />
      <Items />
      <Bits store={store} />
      <FloodCounter />
      <Forge store={store} />
      <Crowd />
      {RIBBONS.map((r, i) => (
        <MessageRibbon
          key={i}
          text={r.isPlayerMessage ? ch1Message : r.text}
          centre={[r.around[0], r.around[1] + r.y, r.around[2]]}
          r={r.r}
          color={r.color}
          speed={(i % 2 ? -1 : 1) * (2.4 / Math.max(6, r.r))}
        />
      ))}
    </>
  );
}
