/**
 * Chapter 1 "The Room" — composes the 3D room, HUD, windows, pause and ending.
 * Script: story/levels/ch1-the-room.md. State: store.ts. Order of events: steps.ts.
 */
import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { FirstPerson } from '../../engine/FirstPerson';
import { Hud } from '../../ui/Hud';
import { DebugPanel, isDebug } from '../../ui/DebugPanel';
import type { LevelProps } from '../index';
import { Ch1Context, useCh1, useCh1Store } from './context';
import { TEXT, TOKENS } from './config';
import { IntroScene } from './Intro';
import { COLLIDERS, PLAYER_START, PROPS, ROOM } from './layout';
import { Room } from './Room';
import { createCh1Store, type ObjectId, type WindowId } from './store';
import { BugStation } from './windows/BugStation';
import { ChuteWindow } from './windows/ChuteWindow';
import { DecodeStation } from './windows/DecodeStation';
import { DepotWindow } from './windows/DepotWindow';
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
const WINDOWS: Record<WindowId, (p: { onClose: () => void }) => React.ReactNode> = {
  paper: PaperWindow,
  depot: DepotWindow,
  chute: ChuteWindow,
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

export default function Chapter1(props: LevelProps) {
  const onFinish = useRef(props.onFinish);
  onFinish.current = props.onFinish;
  const [store] = useState(() => createCh1Store({ onFinish: (m) => onFinish.current(m) }));
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
    const onChange = () => setLocked(document.pointerLockElement === canvasEl.current);
    document.addEventListener('pointerlockchange', onChange);
    return () => {
      document.removeEventListener('pointerlockchange', onChange);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  // Windows need the mouse: release the lock while one is open, take it back after.
  useEffect(() => {
    if (s.window) document.exitPointerLock?.();
    else if (s.phase === 'play') requestLock();
  }, [s.window, s.phase]);

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
      if (k === 'e' && st.target) st.interact(st.target);
      else if (k === 't') st.think();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [store]);

  const paused = s.phase === 'play' && !s.window && !locked && !debug;
  const target = s.target ? PROPS.find((p) => p.id === s.target) : null;
  const WindowView = s.window ? WINDOWS[s.window] : null;
  const white =
    s.phase === 'ending'
      ? Math.max(0, Math.min(1, (s.endTime - 3.5) / 2))
      : s.phase === 'ended'
        ? 1
        : 0;

  return (
    <div
      className="game-screen"
      onClick={() => s.phase === 'intro' && (s.finishIntro(), requestLock())}
    >
      <Canvas
        camera={{ fov: 70, near: 0.05, far: 60 }}
        onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
      >
        {s.phase === 'intro' ? (
          <IntroScene color={color} onDone={() => store.getState().finishIntro()} />
        ) : (
          <>
            <Room />
            <FirstPerson
              start={PLAYER_START}
              bounds={ROOM}
              colliders={COLLIDERS}
              enabled={s.phase === 'play' && !s.window && (locked || debug)}
            />
          </>
        )}
        <Ticker paused={paused} />
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
