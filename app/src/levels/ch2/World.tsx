/**
 * Chapter 2 3D world. Everything is drawn from layout data and the store/sim.
 * Every view is a designer world module (`world/*.js`, verbatim copies; handoffs design-to-app
 * 2026-10-14 world-modules-1/-3, step7-cutscene, intro-forge-sound-decor): environment, decor,
 * islands + props, bridges, hazards, Old Board, lifts, pads, pickups, flood, forge, player orb,
 * NPCs, crowd, trails and ribbons. Step 7 uses the designer's director for their state.
 * Each is `createX(ctx) → {object, update(t, dt, state), dispose()}`, mounted by `WorldModule`;
 * the app feeds it state from the store/sim. Gameplay never reads these meshes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Color, FogExp2, Vector3, Group, type Object3D } from 'three';
import { Label3D } from '../../engine/Label3D';
import type { Surface } from '../../engine/platformer';
import { useCh2, useCh2Store } from './context';
import { FLAG5, HANDLES, TEXT, TIMING, V8SAME_FLAG } from './config';
import {
  FLOOD_BITS,
  ITEMS,
  LAYOUT,
  NPCS,
  OLD_BOARD_SLABS,
  ORB_LIFT,
  V8SAME_EXIT,
  cratesFor,
  npc,
  type Island,
  type ModelSize,
} from './layout';
import type { Bit } from './hazards';
import { replyFor, type Ch2Store } from './store';
import { NPC_CENTRES } from './hud/screen';
import { RENDER, createEnv } from './world/env.js';
import { createIslands } from './world/islands.js';
import { createBridges } from './world/bridges.js';
import { createLasers } from './world/lasers.js';
import { createClouds } from './world/clouds.js';
import { createForge } from './world/forge.js';
import { createNpcs } from './world/npcs.js';
import { createCrowd } from './world/crowd.js';
import { createTrails } from './world/trails.js';
import { createPlayerOrb } from './world/playerOrb.js';
import { direct, stage } from './world/step7.js';
import { createOldBoard } from './world/oldBoard.js';
import { createLifts, createPads } from './world/pads.js';
import { createPickups } from './world/pickups.js';
import { createProps } from './world/props.js';
import { createFlood } from './world/flood.js';
import { createRibbons } from './world/ribbons.js';
import { createDecor } from './world/decor.js';
import { createTornado } from './world/tornado.js';
import {
  T0,
  direct as introDirect,
  funnel as introFunnel,
  orbPos as introOrbPos,
  pathFor,
} from './world/step0.js';
import { REDUCED_MOTION } from './presentation';
import depotUrl from '../../assets/models/ch1-depot.glb?url';
import islandS from '../../assets/models/ch2-island-s.glb?url';
import islandM from '../../assets/models/ch2-island-m.glb?url';
import islandL from '../../assets/models/ch2-island-l.glb?url';

export { ORB_LIFT };
/** The designer's render settings (env.js `RENDER`): camera, fog, bloom, env intensity. */
export const WORLD_RENDER = RENDER;

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
  }, -1);
  return mod ? <primitive object={mod.object} /> : null;
}

const ISLAND_URL: Record<ModelSize, string> = { s: islandS, m: islandM, l: islandL };
export function preloadCh2() {
  for (const u of [...Object.values(ISLAND_URL), depotUrl]) useGLTF.preload(u);
}

/** Sky, stars, city, lights and the env map (env.js); fog + environment set on the scene here. */
function Env({ U }: { U: WorldUniforms }) {
  const { gl, camera, scene } = useThree();
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
  return <WorldModule create={create} clock="render" U={U} />;
}

/**
 * Scenery from the mood pass that Julius kept (decor.js): the shifting cube island, the tesseract,
 * far islands with agent streams, faint wire solids, data rain and the Ch1 depot drifting by.
 */
function Decor({ U }: { U: WorldUniforms }) {
  const s = useGLTF(ISLAND_URL.s).scene;
  const m = useGLTF(ISLAND_URL.m).scene;
  const l = useGLTF(ISLAND_URL.l).scene;
  const depot = useGLTF(depotUrl).scene;
  const create = useMemo(
    () => () => createDecor({ layout: LAYOUT, U, models: { s, m, l }, depot: depot as never }),
    [U, s, m, l, depot],
  );
  return <WorldModule create={create} clock="render" U={U} />;
}

/**
 * The islands (islands.js) on the physics' tilt and sink, with their set dressing (props.js: the
 * Gate's zz folders, the first one being the reply the player fell through; the Yard's neighbours).
 */
function Islands({ store, U, reply }: { store: Ch2Store; U: WorldUniforms; reply: string }) {
  const s = useGLTF(ISLAND_URL.s).scene;
  const m = useGLTF(ISLAND_URL.m).scene;
  const l = useGLTF(ISLAND_URL.l).scene;
  const create = useMemo(
    () => () => {
      const islands = createIslands({ layout: LAYOUT, U, models: { s, m, l } });
      const props = createProps({ layout: LAYOUT, U, islands: islands.byId, reply });
      const object = new Group();
      object.add(islands.object, props.object);
      return {
        object,
        update(t: number, dt: number, state?: object) {
          const ambient =
            store.getState().phase !== 'cutscene' && store.getState().phase !== 'ended';
          islands.labels.visible = props.object.visible = ambient;
          islands.update(t, dt, state);
          props.update(t, dt);
        },
        dispose() {
          props.dispose();
          islands.dispose();
        },
      };
    },
    [U, s, m, l, store, reply],
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
  const visible = useCh2(
    (s) => s.phase !== 'cutscene' && s.phase !== 'ended' && s.forge.phase !== 'absorb',
  );
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
      <group visible={visible}>
        <WorldModule create={lasers} state={() => ({ lanes: round() >= 2 })} clock="game" U={U} />
        <WorldModule
          create={clouds}
          state={() => ({ forgeClouds: round() >= 3 })}
          clock="game"
          U={U}
        />
      </group>
    </>
  );
}

// ------------------------------------------------------------------ Old Board, lifts, pads
/** Where a moving surface is now (its top centre), from the physics. */
const topOf = (x: Surface): [number, number, number] => {
  const e = x.matrix.elements;
  return [e[12], e[13], e[14]];
};

/** The Old Board's column, top and drifting slabs (oldBoard.js), on the physics' slab positions. */
function OldBoard({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const create = useMemo(() => () => createOldBoard({ layout: LAYOUT, U }), [U]);
  const state = useMemo(() => {
    const slabs = OLD_BOARD_SLABS.map((d) => store.sim.world.byId(d.id)!);
    const out = { slabs: slabs.map(() => ({ pos: [0, 0, 0] as [number, number, number] })) };
    return () => {
      slabs.forEach((x, i) => (out.slabs[i].pos = topOf(x)));
      return out;
    };
  }, [store]);
  return <WorldModule create={create} state={state} clock="game" U={U} />;
}

/** The lifts (pads.js `createLifts`) at the physics' height. */
function Lifts({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const create = useMemo(() => () => createLifts({ layout: LAYOUT }), []);
  const state = useMemo(() => {
    const lifts = LAYOUT.lifts.map((l) => [l.id, store.sim.world.byId(l.id)!] as const);
    const out: Record<string, { y: number }> = {};
    return () => {
      for (const [id, x] of lifts) out[id] = { y: topOf(x)[1] };
      return { lifts: out };
    };
  }, [store]);
  return <WorldModule create={create} state={state} clock="game" U={U} />;
}

/** Respawn pads (pads.js): the last pad's beam brightens, reached pads glow a little. */
function Pads({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const create = useMemo(
    () => () =>
      createPads({
        layout: LAYOUT,
        U,
        // (JS inference types the optional `snap = null` default as null)
        snap: ((x: number, z: number, y: number) =>
          store.sim.world.groundBelow(x, z, y)?.y ?? -Infinity) as never,
      }),
    [U, store],
  );
  const state = () => {
    const s = store.getState();
    return { active: s.lastPad, seen: Object.fromEntries(s.padsSeen.map((id) => [id, true])) };
  };
  return <WorldModule create={create} state={state} clock="render" U={U} />;
}

// ------------------------------------------------------------------ Step 0 tornado
/**
 * §Step 0: the reply's folder path whirling down a funnel onto the Gate (tornado.js, driven by
 * step0.js `direct`), and a pink pop on the spawn when the orb lands.
 */
function Tornado({
  store,
  U,
  fx,
  reply,
}: {
  store: Ch2Store;
  U: WorldUniforms;
  fx: WorldFx;
  reply: string;
}) {
  const create = useMemo(
    () => () => {
      const tornado = createTornado({ U, funnel: introFunnel(LAYOUT) });
      tornado.setText(pathFor(reply));
      let popped = false;
      return {
        ...tornado,
        update(t: number, dt: number) {
          const s = store.getState();
          if (s.phase !== 'intro') {
            tornado.update(t, dt, { opacity: 0, scatter: 0 });
            return;
          }
          const I = introDirect(s.introT, { reduced: REDUCED_MOTION });
          tornado.update(t, dt, I.tornado);
          if (I.landed && !popped && !REDUCED_MOTION && fx.trails) {
            popped = true;
            const p = LAYOUT.spawn.pos;
            fx.trails.pop(new Vector3(p[0], p[1] + 0.05, p[2]), '#ff5ad1', 1.6);
          }
        },
      };
    },
    [U, store, fx, reply],
  );
  const intro = useCh2((s) => s.phase === 'intro');
  return intro ? <WorldModule create={create} clock="render" U={U} /> : null;
}

// ------------------------------------------------------------------ player orb

/** The approved player module handles glow, rings, shadow and the film's flinch/drop. */
function PlayerOrb({
  store,
  U,
  orbPosition,
}: {
  store: Ch2Store;
  U: WorldUniforms;
  orbPosition: Vector3;
}) {
  const create = useMemo(
    () => () => {
      const player = createPlayerOrb({ U });
      const ST = stage(LAYOUT);
      return {
        ...player,
        update(t: number, dt: number) {
          const s = store.getState(),
            b = store.sim.body;
          const film = s.phase === 'cutscene' || s.phase === 'ended';
          if (s.phase === 'intro') {
            // §Step 0: pulled down the funnel onto the spawn
            const I = introDirect(s.introT, { reduced: REDUCED_MOTION });
            player.update(t, dt, {
              pos: introOrbPos(s.introT, LAYOUT, REDUCED_MOTION),
              grounded: I.landed,
              glide: !I.landed && s.introT > T0.dive,
              groundY: I.landed ? LAYOUT.spawn.pos[1] : null,
              poisoned: 0,
              cutT: null,
            });
            orbPosition.copy(player.orb.position);
            return;
          }
          const hit = store.sim.world.groundBelow(b.pos.x, b.pos.z, b.pos.y + 0.05);
          player.update(t, dt, {
            pos: film ? ST.hang : b.pos.toArray(),
            grounded: !film && !!b.ground,
            glide: !film && b.gliding,
            groundY: film ? ST.feet[1] : (hit?.y ?? null),
            poisoned: film ? direct(s.cutT).poisoned : s.poisoned ? 1 : 0,
            cutT: film ? s.cutT : null,
          });
          orbPosition.copy(player.orb.position);
        },
      };
    },
    [U, store, orbPosition],
  );
  const label = useRef<Group>(null);
  const visible = useCh2(
    (s) => s.phase !== 'cutscene' && s.phase !== 'ended' && s.phase !== 'intro',
  );
  useFrame(() => {
    label.current?.position.copy(orbPosition);
  });
  return (
    <>
      <WorldModule create={create} clock="render" U={U} />
      <group ref={label} visible={visible}>
        <Label3D text={HANDLES.player} position={[0, 0.95, 0]} color="#39ff9c" size={0.16} />
      </group>
    </>
  );
}

// ------------------------------------------------------------------ scene clock
/**
 * A clock for living things (NPCs, crowd, bits): it follows game time, so pause and the map
 * freeze them, and it also runs during the Step 0 intro (game time starts after it), so the world
 * you fall into is already moving.
 */
function sceneClock(store: Ch2Store) {
  let previous = store.getState().time;
  let now = previous;
  return (gameT: number, frameDt: number) => {
    const dt =
      store.getState().phase === 'intro'
        ? Math.min(frameDt, 0.1)
        : Math.max(0, Math.min(gameT - previous, 0.1));
    previous = gameT;
    now += dt;
    return { now, dt };
  };
}

// ------------------------------------------------------------------ NPCs (their posts: the HUD's bubble)
/** External engineer (Codex): approved art, caller-owned exit and handle labels. */
function Npcs({ store, U }: { store: Ch2Store; U: WorldUniforms }) {
  const labels = useRef<(Group | null)[]>([]);
  const create = useMemo(
    () => () => {
      const npcU = { ...U, uTime: { value: store.getState().time } };
      const module = createNpcs({ layout: LAYOUT, U: npcU });
      const byId = module.byId as Record<string, { object: Object3D }>;
      const exit = new Vector3(...V8SAME_EXIT);
      const home = new Vector3(...npc('v8same').position);
      const v8 = home.clone();
      const clock = sceneClock(store);
      return {
        ...module,
        dispose() {
          for (const n of NPCS) NPC_CENTRES.delete(n.id);
          module.dispose();
        },
        update(gameT: number, frameDt: number) {
          const s = store.getState();
          const { now: t, dt } = clock(gameT, frameDt);
          if (!s.v8sameGone) v8.copy(home);
          else v8.lerp(exit, 1 - Math.exp(-0.5 * dt));
          npcU.uTime.value = t;
          module.update(t, dt, {
            npcs: Object.fromEntries(
              NPCS.map((n) => [
                n.handle,
                {
                  pos: n.id === 'v8same' ? v8.toArray() : n.position,
                  talking: s.dialogue?.npc === n.id || !!s.bubbles[n.id],
                  leaving: n.id === 'v8same' && s.v8sameGone,
                },
              ]),
            ),
          });
          NPCS.forEach((n, i) => {
            const object = byId[n.handle].object;
            labels.current[i]?.position.copy(object.position);
            NPC_CENTRES.set(n.id, object.position);
          });
        },
      };
    },
    [store, U],
  );
  return (
    <>
      <WorldModule create={create} clock="game" U={U} />
      {NPCS.map((n, i) => (
        <group key={n.id} ref={(g) => void (labels.current[i] = g)} position={n.position}>
          <Label3D
            text={n.handle}
            position={[0, n.id === 'c03220' ? 1.55 : 1.15, 0]}
            color={n.color}
            size={0.16}
            opacity={n.faded ? 0.6 : 1}
          />
        </group>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ pickups, flood
/**
 * Seed, task tags and decoys (+ the CHALLENGE 5 plinth), the player's Ch1 installs as crates and
 * the token orbs (pickups.js). Taken items snap up; a decoy crumbles.
 */
function Pickups({
  store,
  U,
  installed,
}: {
  store: Ch2Store;
  U: WorldUniforms;
  installed: string[];
}) {
  const create = useMemo(
    () => () =>
      createPickups({
        layout: LAYOUT,
        U,
        crates: cratesFor(installed).map((c) => ({ label: c.label, pos: c.position })) as never,
      }),
    [U, installed],
  );
  const state = () => {
    const s = store.getState();
    return {
      items: Object.fromEntries(ITEMS.map((it) => [it.layoutId, s.items[it.id]])),
      tokens: s.orbsTaken,
    };
  };
  return <WorldModule create={create} state={state} clock="render" U={U} />;
}

/** Shared effects: the crowd's trails also carry the bits' garbage bursts and the intro's pop. */
export interface WorldFx {
  trails: ReturnType<typeof createTrails> | null;
}

const FORGE_POOL = 8;
/**
 * The Flood's bits, the forge fight's bits (a pool of 8) and the message counter (flood.js).
 * Each new spit of the sim is drawn as one garbage burst on the shared trails.
 */
function Flood({ store, U, fx }: { store: Ch2Store; U: WorldUniforms; fx: WorldFx }) {
  const create = useMemo(
    () => () => {
      const flood = createFlood({ layout: LAYOUT, U });
      const seen = new WeakSet<object>();
      type BitView = { pos: [number, number, number]; state: Bit['state'] };
      const bits: BitView[] = FLOOD_BITS.map(() => ({ pos: [0, 0, 0], state: 'gone' }));
      const forge: BitView[] = [];
      const clock = sceneClock(store);
      return {
        ...flood,
        update(gameT: number, frameDt: number) {
          const { now: t, dt } = clock(gameT, frameDt);
          const s = store.getState(),
            sim = store.sim;
          for (const b of bits) b.state = 'gone';
          forge.length = 0;
          for (const b of sim.bits) {
            const v =
              b.spot !== undefined
                ? bits[b.spot]
                : b.state !== 'gone' && forge.length < FORGE_POOL
                  ? (forge[forge.length] = { pos: [0, 0, 0], state: 'gone' })
                  : null;
            if (!v) continue;
            v.pos = [b.pos.x, b.pos.y, b.pos.z];
            v.state = b.state;
          }
          const p = sim.body.pos;
          for (const sp of sim.spits) {
            if (seen.has(sp)) continue;
            seen.add(sp);
            if (fx.trails)
              flood.spit([sp.pos.x, sp.pos.y, sp.pos.z], [p.x, p.y + ORB_LIFT, p.z], fx.trails);
          }
          const counter = Math.min(
            TEXT.floodCount,
            Math.round((s.floodT / TIMING.floodCounterSeconds) * TEXT.floodCount),
          );
          flood.update(t, dt, { bits, forge, counter });
        },
      };
    },
    [U, store, fx],
  );
  return <WorldModule create={create} clock="game" U={U} />;
}

// ------------------------------------------------------------------ forge
/**
 * The forge (forge.js) with its Step 6 views: V8SAME's proof, the lit slots, the inputs folding
 * per round, the flag spiralling into the orb; after it, idling at 0.6 until Step 7 powers it down.
 */
function Forge({
  store,
  U,
  orbPosition,
}: {
  store: Ch2Store;
  U: WorldUniforms;
  orbPosition: Vector3;
}) {
  const create = useMemo(
    () => () => {
      const module = createForge({ layout: LAYOUT, U, flags: { v8: V8SAME_FLAG, player: FLAG5 } });
      return {
        ...module,
        update(t: number, dt: number) {
          const s = store.getState(),
            f = s.forge;
          const film = s.phase === 'cutscene' || s.phase === 'ended';
          const D = film ? direct(s.cutT) : null;
          module.update(t, D?.shot === 'forge' ? dt * 3 : dt, {
            power: D?.power ?? (f.phase === 'done' ? DONE_POWER : 1),
            phase: film ? 'done' : f.phase,
            t: f.t,
            round: film ? 3 : f.round,
            progress: film ? 1 : f.progress,
            slots: f.slots,
            orb: orbPosition.toArray(),
          });
        },
      };
    },
    [U, store, orbPosition],
  );
  return <WorldModule create={create} clock="render" U={U} />;
}
/** Forge power after the flag is out, until the film powers it down (handoff §2). */
const DONE_POWER = 0.6;

// ------------------------------------------------------------------ crowd + ribbons
/** One lifecycle and game clock for the crowd and its shared effects. */
function Crowd({ store, U, fx }: { store: Ch2Store; U: WorldUniforms; fx: WorldFx }) {
  const camera = useThree((s) => s.camera);
  const create = useMemo(
    () => () => {
      const fxU = { ...U, uTime: { value: store.getState().time } };
      const trails = createTrails({ U: fxU, camera });
      fx.trails = trails;
      const crowd = createCrowd({
        layout: LAYOUT,
        U: fxU,
        camera,
        trails,
        islands: undefined,
        bridges: undefined,
      });
      const object = new Group();
      object.name = 'ambientAgents';
      object.add(crowd.object, trails.object);
      const clock = sceneClock(store);
      return {
        object,
        update(gameT: number, frameDt: number) {
          const s = store.getState();
          const visible = s.phase !== 'cutscene' && s.phase !== 'ended';
          const { now: t, dt } = clock(gameT, frameDt);
          crowd.object.visible = trails.object.visible = visible;
          fxU.uTime.value = t;
          // No render-clock movement or emission while map/pause stops game time.
          if (!visible || dt === 0) return;
          trails.update(t, 0);
          crowd.update(t, dt, { visible });
          trails.update(t, dt);
        },
        dispose() {
          if (fx.trails === trails) fx.trails = null;
          crowd.dispose();
          trails.dispose();
          object.clear();
        },
      };
    },
    [store, U, camera, fx],
  );
  return <WorldModule create={create} clock="game" U={U} />;
}

/** Message ribbons (ribbons.js); the one at the Gate carries the player's Ch1 message. */
function Ribbons({ U, message }: { U: WorldUniforms; message: string }) {
  const create = useMemo(() => () => createRibbons({ layout: LAYOUT, U, message }), [U, message]);
  return <WorldModule create={create} clock="render" U={U} />;
}

// ------------------------------------------------------------------ the scene
export function World({
  ch1Message,
  installed,
  orbPosition,
}: {
  color: string;
  ch1Message: string;
  /** The player's Ch1 installs (the Task Yard crates). */
  installed: string[];
  orbPosition: Vector3;
}) {
  const store = useCh2Store();
  const ambient = useCh2((s) => s.phase !== 'cutscene' && s.phase !== 'ended');
  const U = useMemo<WorldUniforms>(() => ({ uTime: { value: 0 }, uPsy: { value: 0.5 } }), []);
  const fx = useMemo<WorldFx>(() => ({ trails: null }), []);
  const reply = useMemo(() => replyFor(ch1Message), [ch1Message]);
  useFrame((_, dt) => {
    U.uTime.value += dt;
  }, -2);
  return (
    <>
      <Env U={U} />
      <Tornado store={store} U={U} fx={fx} reply={reply} />
      <Islands store={store} U={U} reply={reply} />
      <Hazards store={store} U={U} />
      <PlayerOrb store={store} U={U} orbPosition={orbPosition} />
      <Forge store={store} U={U} orbPosition={orbPosition} />
      <group visible={ambient}>
        <Decor U={U} />
        <OldBoard store={store} U={U} />
        <Lifts store={store} U={U} />
        <Pads store={store} U={U} />
        <Pickups store={store} U={U} installed={installed} />
        <Npcs store={store} U={U} />
        <Flood store={store} U={U} fx={fx} />
        <Crowd store={store} U={U} fx={fx} />
        <Ribbons U={U} message={ch1Message} />
      </group>
    </>
  );
}
