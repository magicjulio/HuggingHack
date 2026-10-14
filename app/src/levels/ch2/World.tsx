/**
 * Chapter 2 3D world. Everything is drawn from layout data (layout.ts over the designer's
 * layout.json) and the store/sim. The islands are the designer's models; the rest are PLACEHOLDER
 * views that the designer's world modules replace one by one (same data, same props), without
 * touching gameplay (app/CLAUDE.md §Swappable views, handoff app-to-design 2026-10-14).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, Stars, useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Shape,
  Vector3,
  type Group,
  type Material,
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
  AREA_LABEL_AT,
  AREA_NAMES,
  BRIDGES,
  COUNTER,
  CROWD_MESSAGES,
  DOUBTS,
  FLOOD_CLOUDS,
  FORGE_CLOUDS,
  FORGE_HEART,
  FORGE_SLOTS,
  FORGE_WAVES,
  ITEMS,
  NPCS,
  ORB_LIFT,
  PADS,
  RIBBONS,
  RUN_WAVES,
  TOKEN_ORBS,
  V8SAME_EXIT,
  npc,
  type AreaId,
  type BridgeEntry,
  type Island,
  type ModelSize,
  type WaveLane,
} from './layout';
import { WAVE_TELEGRAPH, cloudPos, waveState } from './hazards';
import type { Ch2Store } from './store';
import islandS from '../../assets/models/ch2-island-s.glb?url';
import islandM from '../../assets/models/ch2-island-m.glb?url';
import islandL from '../../assets/models/ch2-island-l.glb?url';

export { ORB_LIFT };

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
const LASER_RED = '#ff2a3a';

// ------------------------------------------------------------------ islands (designer models)
const ISLAND_URL: Record<ModelSize, string> = { s: islandS, m: islandM, l: islandL };
export function preloadCh2() {
  for (const u of Object.values(ISLAND_URL)) useGLTF.preload(u);
}

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

/**
 * The designer's data-shard island (ch2.world.island-s/m/l): origin = top centre, `edge` material
 * tinted with the layout's edge colour, as in design/3d/ch2/level.html.
 */
function IslandModel({ surface }: { surface: Surface }) {
  const def = surface.def as Island;
  const { scene } = useGLTF(ISLAND_URL[def.model!]);
  const group = useSurfaceMatrix(surface);
  const model = useMemo(() => {
    const g = scene.clone(true);
    g.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const mat = m.material as Material & { name: string };
      if (mat.name !== 'edge') return;
      const own = (mat as MeshStandardMaterial).clone();
      if (def.edge) own.emissive.set(def.edge);
      own.emissiveIntensity = def.edge ? 4 : 2.6;
      m.material = own;
    });
    return g;
  }, [scene, def.edge]);
  const tall = def.id === 'taskyard' ? 10 : def.id === 'forge' ? 9 : 6.5;
  return (
    <group ref={group} matrixAutoUpdate={false}>
      <primitive object={model} scale={def.scale} />
      {def.label && (
        <Label3D
          text={def.label}
          position={[0, tall, 0]}
          color={def.edge ?? '#38d8ff'}
          size={def.id === 'taskyard' ? 0.9 : 0.6}
          opacity={0.85}
        />
      )}
    </group>
  );
}

// ------------------------------------------------------------------ other surfaces (PLACEHOLDER)
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

/** A bridge as one light ribbon along its samples (PLACEHOLDER for the designer's flow shader). */
function BridgeView({ bridge }: { bridge: BridgeEntry }) {
  const { deck, rails } = useMemo(() => {
    const pos: number[] = [];
    const idx: number[] = [];
    const S = bridge.samples;
    S.forEach((p, i) => {
      const q = S[Math.min(i + 1, S.length - 1)];
      const o = S[Math.max(i - 1, 0)];
      const d = new Vector3(q[0] - o[0], 0, q[2] - o[2]).normalize();
      const side = new Vector3(-d.z, 0, d.x).multiplyScalar(bridge.width / 2);
      const l = [p[0] - side.x, p[1], p[2] - side.z];
      const r = [p[0] + side.x, p[1], p[2] + side.z];
      pos.push(...l, ...r);
      if (i < S.length - 1) {
        const b = i * 2;
        idx.push(b, b + 1, b + 3, b, b + 3, b + 2);
      }
    });
    const deck = new BufferGeometry();
    deck.setAttribute('position', new Float32BufferAttribute(pos, 3));
    deck.setIndex(idx);
    deck.computeVertexNormals();
    // rails: line segments along both edges
    const seg: number[] = [];
    for (let i = 0; i + 1 < pos.length / 6; i++) {
      seg.push(...pos.slice(i * 6, i * 6 + 3), ...pos.slice((i + 1) * 6, (i + 1) * 6 + 3));
      seg.push(...pos.slice(i * 6 + 3, i * 6 + 6), ...pos.slice((i + 1) * 6 + 3, (i + 1) * 6 + 6));
    }
    const rails = new BufferGeometry();
    rails.setAttribute('position', new Float32BufferAttribute(seg, 3));
    return { deck, rails };
  }, [bridge]);
  const glow = useMemo(() => new Color(bridge.color).multiplyScalar(2.2), [bridge.color]);
  return (
    <>
      <mesh geometry={deck}>
        <meshStandardMaterial
          color="#050a12"
          emissive={bridge.color}
          emissiveIntensity={0.18}
          metalness={0.6}
          roughness={0.35}
          side={DoubleSide}
          transparent
          opacity={0.8}
        />
      </mesh>
      <lineSegments geometry={rails}>
        <lineBasicMaterial color={glow} />
      </lineSegments>
    </>
  );
}

function Islands({ store }: { store: Ch2Store }) {
  return (
    <>
      {store.sim.world.surfaces.map((s) => {
        const def = s.def as Island;
        if (def.kind === 'bridge') return null;
        return def.model ? (
          <IslandModel key={def.id} surface={s} />
        ) : (
          <SurfaceView key={def.id} surface={s} />
        );
      })}
      {BRIDGES.map((b) => (
        <BridgeView key={b.id} bridge={b} />
      ))}
      {(Object.keys(AREA_NAMES) as AreaId[]).map((a) => {
        const p = AREA_LABEL_AT[a];
        return (
          <Label3D
            key={a}
            text={AREA_NAMES[a]}
            position={[p[0], p[1] + 14, p[2]]}
            color={AREA_TINT[a]}
            size={1.4}
            opacity={0.45}
          />
        );
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

function Clouds({ store }: { store: Ch2Store }) {
  const refs = useRef<(Mesh | null)[]>([]);
  const all = [...FLOOD_CLOUDS, ...FORGE_CLOUDS];
  useFrame(() => {
    const s = store.getState();
    all.forEach((c, i) => {
      const m = refs.current[i];
      if (!m) return;
      const forge = i >= FLOOD_CLOUDS.length;
      m.visible = !forge || (s.forge.phase === 'forging' && s.forge.round >= 3);
      m.position.set(...cloudPos(c, s.time));
    });
  });
  return (
    <>
      {all.map((c, i) => (
        <mesh key={i} ref={(m) => void (refs.current[i] = m)}>
          <sphereGeometry args={[c.r, 20, 14]} />
          <meshBasicMaterial
            color="#ff7a3d"
            transparent
            opacity={0.22}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}

/**
 * Reset waves: red laser scan lines (PLACEHOLDER for the designer's scanner heads). A dim line marks
 * where the next pass starts in the last `WAVE_TELEGRAPH` seconds of the rest.
 */
function Waves({ store }: { store: Ch2Store }) {
  const lanes: WaveLane[] = [...RUN_WAVES, ...FORGE_WAVES];
  const refs = useRef<(Mesh | null)[]>([]);
  useFrame(() => {
    const s = store.getState();
    lanes.forEach((l, i) => {
      const m = refs.current[i];
      if (!m) return;
      const forge = i >= RUN_WAVES.length;
      const active = !forge || (s.forge.phase === 'forging' && s.forge.round >= 2);
      const w = waveState(l, s.time);
      const telegraph = !w.on && w.until < WAVE_TELEGRAPH;
      m.visible = active && (w.on || telegraph);
      if (!m.visible) return;
      m.position.set(w.p[0], w.p[1] + 0.1, w.p[2]);
      m.rotation.set(0, Math.atan2(l.dir[0], l.dir[1]), 0);
      const mat = m.material as MeshBasicMaterial;
      mat.opacity = w.on ? 1 : 0.25 + 0.25 * Math.sin(s.time * 22);
    });
  });
  return (
    <>
      {lanes.map((l, i) => (
        <mesh key={l.id} ref={(m) => void (refs.current[i] = m)} visible={false}>
          {/* across the lane (local X), thin along it (local Z) */}
          <boxGeometry args={[l.length, 0.06, 0.06]} />
          <meshBasicMaterial color={new Color(LASER_RED).multiplyScalar(4)} transparent />
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
  const poisoned = useCh2((s) => s.poisoned);
  return (
    <>
      {/* designer's level page: FogExp2 0x03060d, 0.0052 */}
      <color attach="background" args={[poisoned ? '#020a05' : '#03060d']} />
      <fogExp2 attach="fog" args={[poisoned ? '#020a05' : '#03060d', 0.0052]} />
      <hemisphereLight args={['#6b88c8', '#080a12', 0.9]} />
      <directionalLight position={[30, 80, 20]} intensity={0.8} />
      <Stars radius={260} depth={60} count={2500} factor={5} fade speed={0.4} />
      <Islands store={store} />
      <PlayerOrb store={store} color={color} />
      <Npcs store={store} />
      <Items />
      <Bits store={store} />
      <Clouds store={store} />
      <Waves store={store} />
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
