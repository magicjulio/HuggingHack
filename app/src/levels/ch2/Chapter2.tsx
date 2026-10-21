/**
 * Chapter 2 "The Cache" — composes the 3D void, the third-person camera, HUD, log, map,
 * intro, cutscene, pause and ending. Script: story/levels/ch2-the-cache.md v3.2.
 * State: store.ts. Order of events: steps.ts. World data: layout.ts.
 */
import { memo, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { ThirdPerson, type CameraOverride, type OrbitView } from '../../engine/ThirdPerson';
import { DebugPanel, isDebug } from '../../ui/DebugPanel';
import { LevelCard } from '../../ui/LevelCard';
import { useGame } from '../../state/store';
import type { LevelProps } from '../index';
import { Ch2Context, useCh2, useCh2Store } from './context';
import { BODY, CAMERA, RENDER, TEXT } from './config';
import { ITEMS, LAYOUT, NPCS, SPAWN, SPAWN_YAW } from './layout';
import { createCh2Store, type Target } from './store';
import { ORB_LIFT, WORLD_RENDER, World, preloadCh2 } from './World';
import { IntroOverlay } from './Intro';
import { CutsceneOverlay } from './Cutscene';
import { Rendering } from './Rendering';
import { fixedTier, REDUCED_MOTION, qualityDpr, type QualityTier } from './presentation';
import { camPose, stage } from './world/step7.js';
import { camPose as introCamPose, orbPos as introOrbPos } from './world/step0.js';
import { Ch2Hud } from './hud/Ch2Hud';
import { ScreenProjector } from './hud/screen';
import { Sound } from './Sound';
import './ch2.css';

/** Key list on the pause card. */
const KEYS: [string, string][] = [
  ['WASD', 'move · mouse look'],
  ['SPACE', 'jump · hold to glide'],
  ['SHIFT', 'dash'],
  ['CLICK', 'shoot'],
  ['E · T · M', 'use · think · map'],
];
/** Ch1 tools a player must have installed to finish Ch1 (fallback for older saves). */
const CH1_TOOLS = ['b64-decoder', 'grep-lens', 'port-map', 'bug-gun'];
/** (engineer) Used when there is no Ch1 message in the save (e.g. Ch2 picked from the menu). */
const NO_MESSAGE = 'zzHELLO';

// World animation uses useFrame: HUD time updates must not reconcile its whole scene graph.
const SceneWorld = memo(World);
const SceneRendering = memo(Rendering);
const SceneCamera = memo(Camera);

preloadCh2();

/** What E does (the HUD shows it next to an E key). */
function promptFor(t: Target | null): string | null {
  if (!t) return null;
  if (t.kind === 'npc') return `read ${NPCS.find((n) => n.id === t.id)!.handle}`;
  if (t.kind === 'forge') return 'put into the forge';
  const it = ITEMS.find((i) => i.id === t.id)!;
  return `take ${it.kind === 'seed' ? 'a copy of the seed' : it.label}`;
}

export default function Chapter2(props: LevelProps) {
  const save = useGame((s) => s.save);
  const onFinish = useRef(props.onFinish);
  onFinish.current = props.onFinish;
  const [ch1Message] = useState(() => save.messages.ch1 ?? NO_MESSAGE);
  const [installed] = useState(() => save.installed.ch1 ?? CH1_TOOLS);
  const [store] = useState(() =>
    createCh2Store({
      ch1Message,
      installed,
      canSkipCutscene: save.completedChapters.includes('ch2'),
      onFinish: (r) => onFinish.current({ status: r.poisoned ? ['poisoned'] : [] }),
    }),
  );
  useEffect(() => {
    if (import.meta.env.DEV || isDebug())
      (window as unknown as { __ch2: typeof store }).__ch2 = store;
  }, [store]);
  return (
    <Ch2Context.Provider value={store}>
      <Ch2View {...props} ch1Message={ch1Message} installed={installed} />
    </Ch2Context.Provider>
  );
}

/** Advances game time every frame unless paused. */
function Ticker({ paused }: { paused: boolean }) {
  const store = useCh2Store();
  useFrame((_, dt) => {
    if (!paused) store.getState().tick(Math.min(dt, 0.1));
  }, -3);
  return null;
}

/**
 * The play camera at the spawn (= ThirdPerson's pose for the start yaw and pitch): the Step 0
 * director ends exactly there, so the intro hands over without a jump.
 */
function playPose() {
  const [x, y, z] = SPAWN.position;
  const ty = y + ORB_LIFT,
    cp = Math.cos(CAMERA.startPitch);
  return {
    pos: [
      x + Math.sin(SPAWN_YAW) * cp * CAMERA.distance,
      ty + CAMERA.height + Math.sin(CAMERA.startPitch) * CAMERA.distance,
      z + Math.cos(SPAWN_YAW) * cp * CAMERA.distance,
    ],
    look: [x, ty + CAMERA.height * 0.45, z],
  };
}
const PLAY_POSE = playPose();

/**
 * Third-person camera on the orb. Step 0 (tornado) and Step 7 (slow orbit) take it over with
 * their directors' poses.
 */
function Camera({
  enabled,
  view,
  orbPosition,
}: {
  enabled: boolean;
  view: OrbitView;
  orbPosition: Vector3;
}) {
  const store = useCh2Store();
  const target = useRef(new Vector3());
  useFrame(() => {
    store.sim.yaw = view.yaw;
  });
  const override = (): CameraOverride | null => {
    const s = store.getState();
    if (s.phase === 'intro') {
      // §Step 0: above the funnel, falling with the orb, settling on the play camera
      const o = introOrbPos(s.introT, LAYOUT, REDUCED_MOTION);
      const c = introCamPose(
        s.introT,
        LAYOUT,
        [o[0], o[1] + ORB_LIFT, o[2]],
        PLAY_POSE,
        REDUCED_MOTION,
      );
      return { position: c.pos, target: c.look, fov: c.fov, immediate: true } as CameraOverride;
    }
    /** §Step 7: pull back into a slow orbit around the orb. */
    if (s.phase !== 'cutscene' && s.phase !== 'ended') return null;
    const c = camPose(s.cutT, stage(LAYOUT).centre, orbPosition.toArray());
    return {
      position: c.pos as [number, number, number],
      target: c.look as [number, number, number],
      fov: c.fov,
      immediate: true,
    };
  };
  return (
    <ThirdPerson
      target={() => target.current.copy(store.sim.body.pos).setY(store.sim.body.pos.y + ORB_LIFT)}
      input={store.sim.input}
      enabled={enabled}
      distance={CAMERA.distance}
      height={CAMERA.height}
      minPitch={CAMERA.minPitch}
      maxPitch={CAMERA.maxPitch}
      view={view}
      override={override}
      floor={(x, z) =>
        store.sim.world.groundBelow(x, z, store.sim.body.pos.y + BODY.stepUp)?.y ?? null
      }
    />
  );
}

/** Left click while walking: shoot along the camera's aim (mutes a flood bit). */
function Shooter({ canvas }: { canvas: React.RefObject<HTMLCanvasElement | null> }) {
  const store = useCh2Store();
  const camera = useThree((t) => t.camera);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement !== canvas.current) return;
      if (store.getState().phase !== 'play') return;
      const dir = new Vector3();
      camera.getWorldDirection(dir);
      store.getState().shoot(camera.position.clone(), dir);
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
  }, [store, camera, canvas]);
  return null;
}

function Ch2View({
  color,
  onExit,
  onContinue,
  ch1Message,
  installed,
}: LevelProps & { ch1Message: string; installed: string[] }) {
  const store = useCh2Store();
  const s = useCh2((x) => x);
  const status = useGame((g) => g.save.status);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [locked, setLocked] = useState(false);
  const [pauseMenu, setPauseMenu] = useState(true);
  const [view] = useState<OrbitView>(() => ({ yaw: SPAWN_YAW, pitch: CAMERA.startPitch }));
  const [orbPosition] = useState(() => new Vector3());
  const [quality, setQuality] = useState<QualityTier>(fixedTier() ?? 'high');
  const debug = isDebug();
  useEffect(() => {
    // dev/e2e: `__ch2view.yaw/pitch` turns the camera (screenshots of a given spot)
    if (import.meta.env.DEV || debug)
      (window as unknown as { __ch2view: OrbitView }).__ch2view = view;
  }, [view, debug]);

  const requestLock = () => {
    try {
      const p = canvasEl.current?.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => {});
    } catch {
      /* needs a click; the pause overlay asks for one */
    }
  };

  useEffect(() => {
    const onChange = () => {
      const isLocked = document.pointerLockElement === canvasEl.current;
      setLocked(isLocked);
      const st = store.getState();
      if (isLocked) setPauseMenu(false);
      else if (st.phase === 'play' && !st.fullMap) setPauseMenu(true);
    };
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [store]);

  // the full map and the end card need the mouse
  useEffect(() => {
    if (s.fullMap || s.phase === 'ended') document.exitPointerLock?.();
    else if (s.phase === 'play') requestLock();
  }, [s.fullMap, s.phase]);

  // Keys: E use, T think, M map, Esc pause; any key skips the intro
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = store.getState();
      if (st.phase === 'intro') return st.finishIntro();
      if (st.phase === 'cutscene') return; // no input (§Step 7); replays: Enter skips
      if (st.phase !== 'play') return;
      const k = e.key.toLowerCase();
      if (k === 'm') return st.toggleMap();
      if (st.fullMap) return;
      if (k === 'e') st.use();
      else if (k === 't') st.think();
    };
    const onSkip = (e: KeyboardEvent) => {
      if (e.key === 'Enter') store.getState().skipCutscene();
    };
    addEventListener('keydown', onKey);
    addEventListener('keydown', onSkip);
    return () => {
      removeEventListener('keydown', onKey);
      removeEventListener('keydown', onSkip);
    };
  }, [store]);

  const paused = s.phase === 'play' && !locked && pauseMenu && !s.fullMap && !debug;
  const needsClick = s.phase === 'play' && !locked && !paused && !s.fullMap && !debug;
  const cut = s.phase === 'cutscene';
  const reset = s.respawn?.why === 'reset' && s.time - s.respawn.at < 1.2;
  const poisonedNow = s.poisoned || status.includes('poisoned');

  return (
    <div
      className="game-screen ch2"
      onClick={() => {
        if (s.phase === 'intro') {
          s.finishIntro();
          requestLock();
        } else if (needsClick) requestLock();
      }}
    >
      <Canvas
        camera={WORLD_RENDER.camera}
        dpr={qualityDpr(quality)}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
      >
        <SceneWorld
          color={color}
          ch1Message={ch1Message}
          installed={installed}
          orbPosition={orbPosition}
        />
        <SceneCamera
          enabled={s.phase === 'play' && !paused && !s.fullMap}
          view={view}
          orbPosition={orbPosition}
        />
        <ScreenProjector />
        <Sound quiet={paused || s.fullMap} ch1Message={ch1Message} />
        <Shooter canvas={canvasEl} />
        <Ticker paused={paused || s.fullMap} />
        <SceneRendering
          orbPosition={orbPosition}
          bloom={RENDER.bloom}
          tier={quality}
          onTier={setQuality}
        />
      </Canvas>

      {s.phase === 'intro' && <IntroOverlay message={ch1Message} />}

      {s.phase !== 'intro' && (
        <Ch2Hud
          visible={s.hudVisible && s.phase !== 'ended'}
          prompt={s.phase === 'play' && !s.fullMap ? promptFor(s.target) : null}
          crosshair={s.phase === 'play' && !s.fullMap}
          poisoned={poisonedNow}
        />
      )}
      {cut && <CutsceneOverlay nofx={!RENDER.bloom} />}
      {reset && <div className="ch2-reset">{TEXT.resetWord}</div>}

      {needsClick && <div className="ch2-click-hint">click to look around</div>}

      {paused && (
        <LevelCard
          level="ch2"
          // before the first click it is the chapter's intro card
          {...(s.time > 0 ? { kind: 'pause', title: 'Paused', keys: KEYS } : { kind: 'intro' })}
          action={{ label: s.time > 0 ? 'Resume' : 'Take control', onClick: requestLock }}
          hint="Click anywhere to continue"
          onBackdrop={requestLock}
          onMenu={onExit}
        />
      )}

      {s.phase === 'ended' && (
        <LevelCard
          level="ch2"
          kind="finish"
          title={TEXT.chapterEndCard}
          solid
          action={onContinue && { label: 'Continue', onClick: onContinue }}
          onMenu={onExit}
        />
      )}

      {debug && (
        <DebugPanel
          steps={s.steps().map((x) => x.id)}
          current={s.stepIndex}
          onJump={(i) => s.jumpTo(i)}
          tokens={s.tokens}
          onTokens={(n) => s.addTokens(n)}
          info={`area: ${s.area} · pad: ${s.lastPad} · forge: ${s.forge.phase} r${s.forge.round} · t=${s.time.toFixed(0)}s`}
        />
      )}
    </div>
  );
}
