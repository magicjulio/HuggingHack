/**
 * Chapter 2 "The Cache" — composes the 3D void, the third-person camera, HUD, log, map,
 * intro, cutscene, pause and ending. Script: story/levels/ch2-the-cache.md v3.2.
 * State: store.ts. Order of events: steps.ts. World data: layout.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Vector3 } from 'three';
import { ThirdPerson, type CameraOverride, type OrbitView } from '../../engine/ThirdPerson';
import { Hud } from '../../ui/Hud';
import { DebugPanel, isDebug } from '../../ui/DebugPanel';
import { useGame } from '../../state/store';
import type { LevelProps } from '../index';
import { Ch2Context, useCh2, useCh2Store } from './context';
import { CAMERA, CUTSCENE, RENDER, TEXT, TOKENS } from './config';
import { ITEMS, NPCS, SPAWN_YAW } from './layout';
import { createCh2Store, type Target } from './store';
import { ORB_LIFT, World, preloadCh2 } from './World';
import { CutsceneOverlay, FullMap, IntroOverlay, LogRibbon, Minimap } from './Screen';
import './ch2.css';

/** Ch1 tools a player must have installed to finish Ch1 (fallback for older saves). */
const CH1_TOOLS = ['b64-decoder', 'grep-lens', 'port-map', 'bug-gun'];
/** (engineer) Used when there is no Ch1 message in the save (e.g. Ch2 picked from the menu). */
const NO_MESSAGE = 'zzHELLO';

preloadCh2();

function promptFor(t: Target | null): string | null {
  if (!t) return null;
  if (t.kind === 'npc') return `E  read ${NPCS.find((n) => n.id === t.id)!.handle}`;
  if (t.kind === 'forge') return 'E  put into the forge';
  const it = ITEMS.find((i) => i.id === t.id)!;
  return `E  take ${it.kind === 'seed' ? 'a copy of the seed' : it.label}`;
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
      <Ch2View {...props} ch1Message={ch1Message} />
    </Ch2Context.Provider>
  );
}

/** Advances game time every frame unless paused. */
function Ticker({ paused }: { paused: boolean }) {
  const store = useCh2Store();
  useFrame((_, dt) => {
    if (!paused) store.getState().tick(Math.min(dt, 0.1));
  });
  return null;
}

/** Third-person camera on the orb; the cutscene takes it over with a slow orbit. */
function Camera({ enabled, view }: { enabled: boolean; view: OrbitView }) {
  const store = useCh2Store();
  const target = useRef(new Vector3());
  useFrame(() => {
    store.sim.yaw = view.yaw;
  });
  /** §Step 7: pull back into a slow orbit around the orb. */
  const override = (): CameraOverride | null => {
    const s = store.getState();
    if (s.phase !== 'cutscene' && s.phase !== 'ended') return null;
    const b = store.sim.body.pos;
    const a = view.yaw + s.cutT * 0.12;
    const r = 6 + Math.min(4, s.cutT * 0.6);
    return {
      position: [
        b.x + Math.sin(a) * r,
        b.y + 2.2 + Math.min(1.5, s.cutT * 0.2),
        b.z + Math.cos(a) * r,
      ],
      target: [b.x, b.y + ORB_LIFT, b.z],
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

function Ch2View({ modelName, color, onExit, ch1Message }: LevelProps & { ch1Message: string }) {
  const store = useCh2Store();
  const s = useCh2((x) => x);
  const status = useGame((g) => g.save.status);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [locked, setLocked] = useState(false);
  const [pauseMenu, setPauseMenu] = useState(true);
  const [view] = useState<OrbitView>(() => ({ yaw: SPAWN_YAW, pitch: CAMERA.startPitch }));
  const debug = isDebug();

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

  // the full map needs the mouse
  useEffect(() => {
    if (s.fullMap) document.exitPointerLock?.();
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
  const flashback = cut && s.cutT >= CUTSCENE.memoryGate && s.cutT < CUTSCENE.realisation;
  const hurt = s.hurtAt !== null && s.time - s.hurtAt < 0.35;
  const reset = s.respawn?.why === 'reset' && s.time - s.respawn.at < 1.2;
  const white = s.phase === 'ended' ? 1 : 0;
  const poisonedNow = s.poisoned || status.includes('poisoned');

  return (
    <div
      className={'game-screen c2' + (flashback ? ' is-flashback' : '')}
      onClick={() => {
        if (s.phase === 'intro') {
          s.finishIntro();
          requestLock();
        } else if (needsClick) requestLock();
      }}
    >
      <Canvas
        camera={{ fov: CAMERA.fov, near: 0.1, far: CAMERA.far }}
        onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
      >
        <World color={color} ch1Message={ch1Message} />
        <Camera enabled={s.phase === 'play' && !paused && !s.fullMap} view={view} />
        <Shooter canvas={canvasEl} />
        <Ticker paused={paused || s.fullMap} />
        {RENDER.bloom && (
          <EffectComposer multisampling={4}>
            <Bloom
              mipmapBlur
              luminanceThreshold={RENDER.bloomThreshold}
              intensity={RENDER.bloomIntensity}
            />
            <ToneMapping mode={ToneMappingMode.AGX} />
          </EffectComposer>
        )}
      </Canvas>

      {s.phase === 'intro' && <IntroOverlay message={ch1Message} />}

      {s.phase !== 'intro' && (
        <Hud
          visible={s.hudVisible && !cut && s.phase !== 'ended'}
          modelName={modelName}
          color={poisonedNow ? '#2fa85a' : color}
          tokens={s.tokens}
          maxTokens={TOKENS.start}
          quests={s.quests}
          prompt={s.phase === 'play' ? promptFor(s.target) : null}
          hint={s.keyHint}
          toast={s.toast}
          crosshair={s.phase === 'play' && !s.fullMap}
          keys="Space jump (hold: glide) · Shift dash · click shoot · E use · T think · M map · Esc pause"
          status={poisonedNow ? ['poisoned'] : []}
        />
      )}
      {s.phase !== 'intro' && <LogRibbon />}
      {s.phase === 'play' && !s.fullMap && <Minimap />}
      {s.fullMap && <FullMap onClose={() => s.toggleMap(false)} />}
      {cut && <CutsceneOverlay />}
      {hurt && <div className="c2-hurt" />}
      {reset && <div className="c2-reset">{TEXT.resetWord}</div>}

      {needsClick && <div className="c2-click-hint">click to look around</div>}

      {paused && (
        <div className="overlay-center overlay-pause" onClick={() => requestLock()}>
          <div>
            <h3>{s.time > 0 ? 'PAUSED' : 'CLICK TO TAKE CONTROL'}</h3>
            <p>
              click to continue · WASD move · mouse look · Space jump (hold: glide) · Shift dash
            </p>
            <p>click shoot · E use · T think · M map · Esc pause</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
            >
              QUIT TO MENU
            </button>
          </div>
        </div>
      )}

      {white > 0 && (
        <div className="c2-card">
          <div>
            <h2>{TEXT.chapterEndCard}</h2>
            <div className="placeholder-tag">PLACEHOLDER · next chapter not written yet</div>
            <div>
              <button onClick={onExit}>BACK TO MENU</button>
            </div>
          </div>
        </div>
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
