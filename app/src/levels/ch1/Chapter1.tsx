/**
 * Chapter 1 "The Room" — composes the 3D room, HUD, windows, pause and ending.
 * Script: story/levels/ch1-the-room.md. State: store.ts. Order of events: steps.ts.
 */
import { useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Quaternion, Vector3 } from 'three';
import { FirstPerson, type CameraPose } from '../../engine/FirstPerson';
import { LazyShadows } from '../../engine/LazyShadows';
import {
  fixedTier,
  QUALITY,
  QualityMonitor,
  qualityDpr,
  type QualityTier,
} from '../../engine/quality';
import { Hud } from '../../ui/Hud';
import { DebugPanel, isDebug } from '../../ui/DebugPanel';
import { LevelCard } from '../../ui/LevelCard';
import type { LevelProps } from '../index';
import { Ch1Context, useCh1, useCh1Store } from './context';
import { PAD_MAX_CHARS, RENDER, TEXT, TOKENS } from './config';
import { IntroScene } from './Intro';
import {
  COLLIDERS,
  PLAYER_START,
  PROPS,
  ROOM,
  SCAN_PAD,
  SCORER_LAMP,
  STATIONS,
  type StationLayout,
} from './layout';
import { preloadCh1Models } from './models';
import { Room } from './Room';
import { createCh1Store, type ObjectId, type WindowId } from './store';
import { LogStation } from './windows/LogStation';
import { PaperWindow } from './windows/PaperWindow';
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
/** Full-view windows. Every other machine is used in-world (camera focus, below). */
const WINDOWS: Partial<Record<WindowId, (p: { onClose: () => void }) => React.ReactNode>> = {
  paper: PaperWindow,
  s2: LogStation,
};
const isTyping = () => {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
};
const IN_WORLD: WindowId[] = ['depot', 'chute', 's1', 's3', 's4', 's5'];
/** (engineer) Key help under an in-world machine. */
const HELP: Partial<Record<WindowId, string>> = {
  depot: 'click to install',
  s1: 'drag the odd string into the decoder (or click it, then the slot)',
  s3: 'drag a plug into its socket',
  s4: 'click to shoot · −1 token per shot · +2 per bug',
  s5: '',
};

/** Key list on the pause card. */
const KEYS: [string, string][] = [
  ['WASD', 'move · mouse look'],
  ['E', 'use'],
  ['T', 'think'],
  ['ESC', 'pause'],
];

/** Keys that walk away from a machine (Julius 2026-10-13: Esc is kept for pause / fullscreen). */
const WALK_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

const v3 = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];
const TAN_HALF_FOV = Math.tan(((70 / 2) * Math.PI) / 180);

/** Square up to a station's screen: back off along its normal until it fits with a margin. */
function screenPose(L: StationLayout, aspect: number): CameraPose {
  const { quaternion: q, size } = L.screen;
  // S5: also frame the output pipe on its right, where each attempt's pulse dies (engineer)
  const wide = L.n === 5;
  const [w, h] = wide ? [2.3, 1.1] : size;
  const c = L.screen.position.clone();
  if (wide) c.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(q), 0.62);
  const d = Math.max(h / 2 / TAN_HALF_FOV, w / 2 / (TAN_HALF_FOV * aspect)) * 1.18;
  const n = new Vector3(0, 0, 1).applyQuaternion(q);
  return { position: v3(c.clone().addScaledVector(n, d)), target: v3(c) };
}

/** Where the camera goes while a machine is in use (null = free play). */
function focusPose(window: WindowId | null, scanning: boolean, aspect: number): CameraPose | null {
  if (window === 'depot') {
    // square up to the 2.0 × 1.8 m screen (centre [-5.49, 1.5, 0.4], facing +x),
    // with a margin, nudged right of centre so the HUD on the left doesn't cover it
    const d = Math.max(0.9 / TAN_HALF_FOV, 1.0 / (TAN_HALF_FOV * aspect)) * 1.12;
    const z = 0.4 + Math.min(0.3, Math.max(0, TAN_HALF_FOV * aspect * d - 1.0) * 0.6);
    return { position: [-5.49 + d, 1.5, z], target: [-5.49, 1.5, z] };
  }
  const st = window && /^s[1345]$/.test(window) ? STATIONS[Number(window[1]) as 1] : null;
  if (st) return screenPose(st, aspect);
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

/** What an in-world machine shows: centre + half axes (world), for the side exits. */
interface Quad {
  c: Vector3;
  ax: Vector3;
  ay: Vector3;
}
const AX = new Vector3(1, 0, 0);
function quad(
  c: Vector3,
  q: Quaternion,
  [w, h]: [number, number],
  up = new Vector3(0, 1, 0),
): Quad {
  return {
    c,
    ax: AX.clone()
      .applyQuaternion(q)
      .multiplyScalar(w / 2),
    ay: up.applyQuaternion(q).multiplyScalar(h / 2),
  };
}
const screenQuad = (L: StationLayout) =>
  quad(L.screen.position, L.screen.quaternion, L.screen.size);
const QUADS: Partial<Record<WindowId, Quad>> = {
  depot: quad(
    new Vector3(-5.49, 1.5, 0.4),
    new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2),
    [2.0, 1.8],
  ),
  chute: quad(SCAN_PAD.position, SCAN_PAD.quaternion, SCAN_PAD.size, new Vector3(0, 0, 1)),
  s1: screenQuad(STATIONS[1]),
  s3: screenQuad(STATIONS[3]),
  s4: screenQuad(STATIONS[4]),
  s5: screenQuad(STATIONS[5]),
};

/**
 * Sizes the two side exits (DOM strips left and right of a machine) to the gap between the
 * viewport edge and the machine as the camera sees it, between 28 px and a quarter of the width.
 */
function SideExitSizer({ sides }: { sides: RefObject<(HTMLDivElement | null)[]> }) {
  const store = useCh1Store();
  const camera = useThree((t) => t.camera);
  const size = useThree((t) => t.size);
  const v = useRef(new Vector3());
  useFrame(() => {
    const w = store.getState().window;
    const q = w && QUADS[w];
    const [left, right] = sides.current;
    if (!q || !left || !right) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        v.current.copy(q.c).addScaledVector(q.ax, sx).addScaledVector(q.ay, sy).project(camera);
        const x = ((v.current.x + 1) / 2) * size.width;
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    const fit = (px: number) => `${Math.max(28, Math.min(size.width / 4, px))}px`;
    left.style.width = fit(lo);
    right.style.width = fit(size.width - hi);
  });
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
  const [store] = useState(() =>
    createCh1Store({
      // the message and the installs are reused in Ch2 (reply, Task Yard crates)
      onFinish: (message) => onFinish.current({ message, installed: store.getState().installed }),
    }),
  );
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

function Ch1View({ modelName, color, onExit, onContinue }: LevelProps) {
  const store = useCh1Store();
  const s = useCh1((x) => x);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const [locked, setLocked] = useState(false);
  /**
   * The pause menu shows before the first click, when the player gives up the mouse while
   * walking (Esc while locked) and on Esc at a machine. Esc never leaves a machine (Julius
   * 2026-10-13: it is the browser's key for pause and fullscreen); WASD, the step-back button
   * and the side exits do. Leaving never pauses: the browser may refuse to re-lock without a
   * click, so the game keeps running and asks for one quietly.
   */
  const [pauseMenu, setPauseMenu] = useState(true);
  const [quality, setQuality] = useState<QualityTier>(fixedTier() ?? 'high');
  const pauseRef = useRef(pauseMenu);
  pauseRef.current = pauseMenu;
  const sides = useRef<(HTMLDivElement | null)[]>([null, null]);
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

  // Keys: E use/close, WASD walk away from a machine, Esc pause, T think, any key skips the intro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = store.getState();
      if (st.phase === 'intro') return st.finishIntro();
      if (st.phase !== 'play') return;
      const k = e.key.toLowerCase();
      if (st.window) {
        if (pauseRef.current && !isDebug()) return; // paused over the machine
        if (k === 'escape') setPauseMenu(true);
        else if (!isTyping() && (k === 'e' || WALK_KEYS.has(e.code))) {
          if (WALK_KEYS.has(e.code)) e.preventDefault(); // arrows would scroll a window
          st.closeWindow();
        }
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

  const paused = s.phase === 'play' && !locked && pauseMenu && !debug;
  /** Continue: back to the machine as it was (mouse stays free), or take the mouse again. */
  const resume = () => {
    if (store.getState().window) setPauseMenu(false);
    else requestLock();
  };
  const leave = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    store.getState().closeWindow();
  };
  /** Running without the mouse (e.g. after Esc on a machine): WASD works, a click re-locks. */
  const needsClick = s.phase === 'play' && !s.window && !locked && !paused && !debug;
  const target = s.target ? PROPS.find((p) => p.id === s.target) : null;
  const WindowView = s.window ? WINDOWS[s.window] : null;
  const inWorld = !!s.window && IN_WORLD.includes(s.window);
  const help =
    s.window === 's4' && !s.installed.includes('bug-gun') ? '' : s.window ? HELP[s.window] : '';
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
        shadows={RENDER.shadows && 'percentage'}
        // the other levels' cap (≤ 1.5): a 2× screen would draw 1.8× the pixels for little to see
        dpr={qualityDpr(quality)}
        camera={{ fov: 70, near: 0.02, far: 60 }}
        onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
        data-quality={quality}
      >
        {s.phase === 'intro' ? (
          <IntroScene color={color} onDone={() => store.getState().finishIntro()} />
        ) : (
          <>
            <Room />
            <Player enabled={s.phase === 'play' && !s.window && !paused} />
            <SideExitSizer sides={sides} />
          </>
        )}
        <Ticker paused={paused} />
        {RENDER.shadows && <LazyShadows />}
        <QualityMonitor tier={quality} onTier={setQuality} />
        {RENDER.bloom && (
          <EffectComposer multisampling={QUALITY[quality].msaa}>
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
      {inWorld && !paused && (
        <>
          {(['left', 'right'] as const).map((side, i) => (
            <div
              key={side}
              ref={(el) => {
                sides.current[i] = el;
              }}
              className={`ch1-side is-${side}`}
              onPointerDown={leave}
            >
              {/* (engineer) */}
              <span>{side === 'left' ? '‹ step back' : 'step back ›'}</span>
            </div>
          ))}
          {s.window !== 'chute' && (
            <div className="ch1-pad-help">
              {help && <>{help} · </>}
              <StepBack />
            </div>
          )}
        </>
      )}

      {needsClick && <div className="ch1-click-hint">click to look around</div>}

      {paused && (
        <LevelCard
          level="ch1"
          // before the first click it is the chapter's intro card
          {...(s.time > 0 ? { kind: 'pause', title: 'Paused', keys: KEYS } : { kind: 'intro' })}
          action={{ label: s.time > 0 ? 'Resume' : 'Take control', onClick: resume }}
          hint="Click anywhere to continue"
          onBackdrop={resume}
          onMenu={onExit}
        />
      )}

      {white > 0 && <div className="ch1-white" style={{ opacity: white }} />}
      {s.phase === 'ended' && (
        <LevelCard
          level="ch1"
          kind="finish"
          title={TEXT.chapterEndCard}
          solid
          // the script's fade to white (§Step 11) plays first; the card's dark backdrop fades in over it
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
            type or paste a flag · <b>Enter</b> scan · <StepBack />
          </>
        )}
      </div>
    </>
  );
}

/** (engineer) Leaves the machine in view. Also: WASD (when not typing) or a click beside it. */
function StepBack() {
  const close = useCh1((s) => s.closeWindow);
  return (
    <button className="ch1-stepback" onClick={close}>
      ✕ step back
    </button>
  );
}
