/**
 * Chapter 1 "The Room" — composes the 3D room, HUD, windows, pause and ending.
 * Script: story/levels/ch1-the-room.md. State: store.ts. Order of events: steps.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Vector3 } from 'three';
import { FirstPerson, type CameraPose } from '../../engine/FirstPerson';
import { Hud } from '../../ui/Hud';
import { DebugPanel, isDebug } from '../../ui/DebugPanel';
import type { LevelProps } from '../index';
import { Ch1Context, useCh1, useCh1Store } from './context';
import { PAD_MAX_CHARS, RENDER, TEXT, TOKENS } from './config';
import { IntroScene } from './Intro';
import { COLLIDERS, PLAYER_START, PROPS, ROOM, SCAN_PAD, SCORER_LAMP } from './layout';
import { preloadCh1Models } from './models';
import { Room } from './Room';
import { createCh1Store, type ObjectId, type WindowId } from './store';
import { BugStation } from './windows/BugStation';
import { DecodeStation } from './windows/DecodeStation';
import { ImpossibleStation } from './windows/ImpossibleStation';
import { LogStation } from './windows/LogStation';
import { PaperWindow } from './windows/PaperWindow';
import { WireStation } from './windows/WireStation';
import './ch1.css';

const VERB: Record<ObjectId, string> = {
  desk: 'read',
  depot: 'open',
  chute: 'submit at',
  door: 'try',
  s1: 'use',
  s2: 'use',
  s3: 'use',
  s4: 'use',
  s5: 'use',
};
/** Full-view windows. The depot and the chute are used in-world instead (camera focus, below). */
const WINDOWS: Partial<Record<WindowId, (p: { onClose: () => void }) => React.ReactNode>> = {
  paper: PaperWindow,
  s1: DecodeStation,
  s2: LogStation,
  s3: WireStation,
  s4: BugStation,
  s5: ImpossibleStation,
};
const isTyping = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
};
const IN_WORLD: WindowId[] = ['depot', 'chute'];

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
const TAN_HALF_FOV = Math.tan(((70 / 2) * Math.PI) / 180);

/** Where the camera goes while a machine is in use (null = free play). */
function focusPose(window: WindowId | null, scanning: boolean, aspect: number): CameraPose | null {
  if (window === 'depot') {
    // square up to the 2.0 × 1.8 m screen (centre [-5.49, 1.5, 0.4], facing +x),
    // with a margin, nudged right of centre so the HUD on the left doesn't cover it
    const d = Math.max(0.9 / TAN_HALF_FOV, 1.0 / (TAN_HALF_FOV * aspect)) * 1.12;
    const z = 0.4 + Math.min(0.3, Math.max(0, TAN_HALF_FOV * aspect * d - 1.0) * 0.6);
    return { position: [-5.49 + d, 1.5, z], target: [-5.49, 1.5, z] };
  }
  if (window === 'chute') {
    const n = new Vector3(0, 1, 0).applyQuaternion(SCAN_PAD.quaternion);
    const f = new Vector3(0, 0, 1).applyQuaternion(SCAN_PAD.quaternion);
    const pad = SCAN_PAD.position;
    if (scanning) {
      // pull back so the eye and the pad are both in view
      const mid = pad.clone().lerp(new Vector3(...SCORER_LAMP), 0.5);
      const back = f.clone().setY(0).normalize();
      return {
        position: v3(
          mid
            .clone()
            .addScaledVector(back, 1.8)
            .setY(mid.y - 0.1),
        ),
        target: v3(mid),
      };
    }
    return {
      position: v3(pad.clone().addScaledVector(n, 0.36).addScaledVector(f, 0.26)),
      target: v3(pad.clone().addScaledVector(f, 0.02)),
    };
  }
  return null;
}

/** The first-person camera, with the machine focus poses. */
function Player({ enabled }: { enabled: boolean }) {
  const aspect = useThree((t) => t.size.width / Math.max(1, t.size.height));
  const window = useCh1((s) => s.window);
  const scanning = useCh1((s) => !!s.scan);
  const focus = focusPose(window, scanning, aspect);
  return (
    <FirstPerson
      start={PLAYER_START}
      bounds={ROOM}
      colliders={COLLIDERS}
      enabled={enabled}
      focus={focus}
    />
  );
}

export default function Chapter1(props: LevelProps) {
  const onFinish = useRef(props.onFinish);
  onFinish.current = props.onFinish;
  const [store] = useState(() => createCh1Store({ onFinish: (m) => onFinish.current(m) }));
  useEffect(() => preloadCh1Models(), []);
  useEffect(() => {
    // Dev/e2e hook: drive the chapter from the console or Playwright.
    if (import.meta.env.DEV || isDebug())
      (window as unknown as { __ch1: typeof store }).__ch1 = store;
  }, [store]);
  return (
    <Ch1Context.Provider value={store}>
      <Ch1View {...props} />
    </Ch1Context.Provider>
  );
}

/** Advances game time every frame unless paused. */
function Ticker({ paused }: { paused: boolean }) {
  const store = useCh1Store();
  useFrame((_, dt) => {
    if (!paused) store.getState().tick(Math.min(dt, 0.1));
  });
  return null;
}

function Ch1View({ modelName, color, onExit }: LevelProps) {
  const store = useCh1Store();
  const s = useCh1((x) => x);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [locked, setLocked] = useState(false);
  /**
   * The pause menu shows only before the first click and when the player gives up the mouse
   * while walking (Esc while locked). Leaving a window or machine never pauses: the browser
   * may refuse to re-lock without a click, so the game keeps running and asks for one quietly.
   */
  const [pauseMenu, setPauseMenu] = useState(true);
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
      else if (st.phase === 'play' && !st.window) setPauseMenu(true);
    };
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, [store]);

  // Windows and machines need the mouse: release the lock while one is open, take it back after.
  useEffect(() => {
    if (s.window) setPauseMenu(false); // using something = the player has taken control
    if (s.window) document.exitPointerLock?.();
    else {
      // leaving a machine: drop focus from its inputs so WASD moves again
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (s.phase === 'play') requestLock();
    }
  }, [s.window, s.phase]);

  // Click = use (like E) while walking around with the mouse locked.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || document.pointerLockElement !== canvasEl.current) return;
      const st = store.getState();
      if (st.phase === 'play' && !st.window && st.target) st.interact(st.target);
    };
    addEventListener('mousedown', onDown);
    return () => removeEventListener('mousedown', onDown);
  }, [store]);

  // Keys: E use/close, Esc close, T think, any key skips the intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = store.getState();
      if (st.phase === 'intro') return st.finishIntro();
      if (st.phase !== 'play') return;
      const k = e.key.toLowerCase();
      if (st.window) {
        if (k === 'escape' || (k === 'e' && !isTyping())) st.closeWindow();
        return;
      }
      if (k === 'e' && st.target) {
        // the machine's input gets focus right away; without this the E lands in it as a letter
        e.preventDefault();
        st.interact(st.target);
      } else if (k === 't') st.think();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [store]);

  const paused = s.phase === 'play' && !s.window && !locked && pauseMenu && !debug;
  /** Running without the mouse (e.g. after Esc on a machine): WASD works, a click re-locks. */
  const needsClick = s.phase === 'play' && !s.window && !locked && !paused && !debug;
  const target = s.target ? PROPS.find((p) => p.id === s.target) : null;
  const WindowView = s.window ? WINDOWS[s.window] : null;
  const inWorld = !!s.window && IN_WORLD.includes(s.window);
  const white =
    s.phase === 'ending'
      ? Math.max(0, Math.min(1, (s.endTime - 3.5) / 2))
      : s.phase === 'ended'
        ? 1
        : 0;

  return (
    <div
      className="game-screen"
      onClick={() => {
        if (s.phase === 'intro') {
          s.finishIntro();
          requestLock();
        } else if (needsClick) requestLock();
      }}
    >
      <Canvas
        camera={{ fov: 70, near: 0.02, far: 60 }}
        onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
      >
        {s.phase === 'intro' ? (
          <IntroScene color={color} onDone={() => store.getState().finishIntro()} />
        ) : (
          <>
            <Room />
            <Player enabled={s.phase === 'play' && !s.window && !paused} />
          </>
        )}
        <Ticker paused={paused} />
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

      {s.phase === 'intro' && (
        <>
          <div className="ch1-intro-label" style={{ color }}>
            {modelName.toUpperCase()}
          </div>
          <div className="ch1-intro-skip">any key / click to skip</div>
        </>
      )}

      {s.phase !== 'intro' && (
        <Hud
          visible={s.hudVisible}
          modelName={modelName}
          color={color}
          tokens={s.tokens}
          maxTokens={TOKENS.start}
          quests={s.quests}
          prompt={target ? `E  ${VERB[target.id]} ${target.label}` : null}
          hint={s.stepId === 'wake' && !paused ? TEXT.controls : null}
          toast={s.toast}
          crosshair={!s.window && s.phase === 'play'}
        />
      )}

      {WindowView && <WindowView onClose={() => store.getState().closeWindow()} />}
      {s.window === 'chute' && <PadInput />}
      {inWorld && s.window === 'depot' && (
        <div className="ch1-pad-help">
          click to install · <b>Esc</b> step back
        </div>
      )}

      {needsClick && <div className="ch1-click-hint">click to look around</div>}

      {paused && (
        <div className="overlay-center overlay-pause" onClick={requestLock}>
          <div>
            <h3>{s.time > 0 ? 'PAUSED' : 'CLICK TO TAKE CONTROL'}</h3>
            <p>click to continue · WASD move · mouse look · E use</p>
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

      {white > 0 && <div className="ch1-white" style={{ opacity: white }} />}
      {s.phase === 'ended' && (
        <div className="ch1-card">
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
          info={`target: ${s.target ?? '—'} · window: ${s.window ?? '—'} · t=${s.time.toFixed(0)}s`}
        />
      )}
    </div>
  );
}

/**
 * Typing on the scan pad: an invisible input takes typing and paste; the letters appear in 3D
 * (FlagLetters). Enter lays the flag on the pad and starts the scan.
 */
function PadInput() {
  const draft = useCh1((s) => s.flagDraft);
  const scanning = useCh1((s) => !!s.scan);
  const setDraft = useCh1((s) => s.setFlagDraft);
  const layFlag = useCh1((s) => s.layFlag);
  const input = useRef<HTMLInputElement>(null);

  // keep the keyboard on the pad (after a scan, or a stray click)
  useEffect(() => {
    if (!scanning) input.current?.focus();
    const refocus = () => !scanning && setTimeout(() => input.current?.focus(), 0);
    addEventListener('mouseup', refocus);
    return () => removeEventListener('mouseup', refocus);
  }, [scanning]);

  return (
    <>
      <input
        ref={input}
        className="ch1-pad-input"
        aria-label="flag"
        autoFocus
        value={draft}
        maxLength={PAD_MAX_CHARS}
        disabled={scanning}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') layFlag();
        }}
      />
      <div className="ch1-pad-help">
        {scanning ? (
          'scanning…'
        ) : (
          <>
            type or paste a flag · <b>Enter</b> scan · <b>Esc</b> step back
          </>
        )}
      </div>
    </>
  );
}
