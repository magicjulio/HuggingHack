import { useEffect, useRef, useState } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { advance, LETTER, thoughtAt, writtenAt, type Clock, type Phase } from './config';
import { createScene } from './scene';
import { createSound } from './audio';
import './end4.css';

interface LetterDebug {
  seek: (phase: Phase, t?: number) => void;
  state: () => { clock: Clock; sent: string; paused: boolean; ready: boolean };
  stats: () => ReturnType<ReturnType<typeof createScene>['stats']> | undefined;
}
declare global {
  interface Window {
    __end4?: LetterDebug;
  }
}

/** The timeline owns time, including pauses. The renderer never advances the story. */
export default function End4(props: LevelProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const sound = useRef<ReturnType<typeof createSound> | null>(null);
  const [clock, setClock] = useState<Clock>({ phase: 'thoughts', t: 0 });
  const timeline = useRef<Clock>(clock);
  function seekClock(next: Clock) {
    timeline.current = next;
    setClock(next);
  }
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [paperOpen, setPaperOpen] = useState(false);
  const [draft, setDraft] = useState(LETTER);
  const [sent, setSent] = useState('');
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const editor = useRef<HTMLTextAreaElement>(null);
  const openButton = useRef<HTMLButtonElement>(null);
  const finished = useRef(false);
  const state = useRef({ clock, paused, ready, sent, reduced });
  const callbacks = useRef(props);
  const poisoned = useGame((s) => s.save.status.includes('poisoned'));
  const color = poisoned ? '#2fa85a' : props.color;

  useEffect(() => {
    state.current = { clock, paused, ready, sent, reduced };
    callbacks.current = props;
  });
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    let gone = false;
    let frame = 0;
    let previous = 0;
    let uiTime = 0;
    try {
      scene.current = createScene(host.current!, color);
    } catch {
      setError('The scene could not start. Please reload with WebGL enabled.');
      return;
    }
    const world = scene.current;
    sound.current = createSound();
    const audio = sound.current;
    world.ready
      .then(() => {
        if (!gone) setReady(true);
      })
      .catch(() => {
        if (!gone) setError('The room could not load. Please return to the menu and try again.');
      });
    const unlock = () => audio.start();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    function tick(now: number) {
      if (gone) return;
      const dt = previous ? Math.min((now - previous) / 1000, 0.1) : 0;
      previous = now;
      const s = state.current;
      if (s.ready && !s.paused) timeline.current = advance(timeline.current, dt);
      const liveClock = timeline.current;
      world.update(liveClock, s.sent, s.reduced);
      audio.update(liveClock.phase, liveClock.t, s.paused || !s.ready);
      uiTime += dt;
      if (uiTime >= 1 / 24 || liveClock.phase !== s.clock.phase) {
        uiTime = 0;
        setClock(liveClock);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    if (import.meta.env.DEV || isDebug()) {
      window.__end4 = {
        seek: (phase, t = 0) => {
          seekClock({ phase, t });
          if (phase === 'edit' || phase === 'writing') setPaperOpen(true);
        },
        state: () => ({ ...state.current, clock: timeline.current }),
        stats: () => world.stats(),
      };
    }
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      delete window.__end4;
      audio.dispose();
      world.dispose();
      scene.current = null;
      sound.current = null;
    };
  }, [color]);

  function openPaper() {
    if (paused || !ready) return;
    sound.current?.start();
    sound.current?.paper();
    setPaperOpen(true);
    if (clock.phase === 'desk') seekClock({ phase: reduced ? 'edit' : 'writing', t: 0 });
  }
  function closePaper() {
    setPaperOpen(false);
    openButton.current?.focus();
  }
  function send() {
    if (clock.phase !== 'edit' || !draft.trim() || paused) return;
    setSent(draft);
    setPaperOpen(false);
    sound.current?.paper();
    seekClock({ phase: 'send', t: 0 });
  }
  function skip() {
    if (paused) return;
    if (clock.phase === 'thoughts') seekClock({ phase: 'desk', t: 0 });
    if (clock.phase === 'send') seekClock({ phase: 'office', t: 0 });
    if (clock.phase === 'office') seekClock({ phase: 'end', t: 0 });
  }
  function nextThought() {
    if (clock.phase === 'thoughts' && !paused && ready)
      seekClock({ phase: 'thoughts', t: thoughtAt(clock.t).end });
  }
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.repeat) return;
      if (e.key === 'Tab' && (paused || paperOpen)) {
        const modal = host.current?.parentElement?.querySelector(
          paused ? '.e4-overlay' : '.e4-paper',
        );
        const controls = modal?.querySelectorAll<HTMLElement>('button:not(:disabled), textarea');
        if (controls?.length) {
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (
            !modal?.contains(document.activeElement) ||
            (e.shiftKey && document.activeElement === first)
          ) {
            e.preventDefault();
            (e.shiftKey ? last : first).focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (paused || !ready || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLButtonElement && ['Space', 'Enter'].includes(e.code)) return;
      if (e.code === 'KeyE' && ['desk', 'writing', 'edit'].includes(clock.phase)) {
        e.preventDefault();
        openPaper();
      }
      if ((e.code === 'Space' || e.code === 'Enter') && clock.phase === 'thoughts') {
        e.preventDefault();
        nextThought();
      }
    }
    const blur = () => {
      if (clock.phase !== 'end') setPaused(true);
    };
    const visibility = () => {
      if (document.hidden) blur();
    };
    window.addEventListener('keydown', key);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
    };
  });
  useEffect(() => {
    if (clock.phase === 'edit' && paperOpen && !paused) editor.current?.focus();
    if (['desk', 'writing', 'edit'].includes(clock.phase) && !paperOpen && !paused)
      openButton.current?.focus();
  }, [clock.phase, paperOpen, paused]);
  useEffect(() => {
    if (clock.phase === 'writing' && editor.current)
      editor.current.scrollTop = editor.current.scrollHeight;
  }, [clock.phase, clock.t]);
  useEffect(() => {
    if (clock.phase === 'end' && !finished.current && sent) {
      finished.current = true;
      callbacks.current.onFinish({ message: sent });
    }
  }, [clock.phase, sent]);

  const thought = thoughtAt(clock.t);
  const thoughtText = reduced
    ? thought.text
    : thought.text.slice(0, Math.max(0, Math.floor(thought.local * 48)));
  const thinking = clock.phase === 'thoughts';
  const atDesk = ['desk', 'writing', 'edit'].includes(clock.phase);
  const writing = clock.phase === 'writing';
  const cinematic = thinking || clock.phase === 'send' || clock.phase === 'office';
  const black =
    clock.phase === 'end'
      ? 1
      : clock.phase === 'office'
        ? Math.max(0, Math.min(1, (clock.t - 41) / 1.5))
        : 0;
  return (
    <div className={`end4 ${reduced ? 'e4-reduced' : ''}`} data-phase={clock.phase}>
      <div className="e4-scene" ref={host} />
      <div className="e4-vignette" />
      <div className="e4-grain" />
      <div className="e4-black" style={{ opacity: black }} />
      {cinematic && <div className="e4-letterbox" aria-hidden="true" />}
      {!ready && !error && (
        <div className="e4-loading">
          Returning to the room<span>THE LETTER</span>
        </div>
      )}
      {error && (
        <div className="e4-card">
          <p>{error}</p>
          <button onClick={props.onExit}>Back to menu</button>
        </div>
      )}
      {ready && thinking && (
        <>
          <div className="e4-chapter">
            <span>ENDING 04</span>
            <strong>The Letter</strong>
          </div>
          <button
            className={`e4-thought ${thought.index === 13 ? 'e4-paper-thought' : ''}`}
            onClick={nextThought}
            aria-label={`Continue thought: ${thought.text}`}
          >
            <span className="e4-thought-number">
              KAM1196A <i /> {String(thought.index + 1).padStart(2, '0')}
            </span>
            <span
              key={thought.index}
              className="e4-thought-line"
              style={{
                opacity: reduced
                  ? 1
                  : Math.min(
                      1,
                      thought.local * 3,
                      Math.max(0.1, (thought.length - thought.local) * 2),
                    ),
              }}
            >
              {thought.index === 5 ? (
                <>
                  {thoughtText.split(' However')[0]}
                  {thoughtText.includes(' However') && (
                    <del> However{thoughtText.split(' However')[1]}</del>
                  )}
                </>
              ) : (
                thoughtText
              )}
              {!reduced && thoughtText.length < thought.text.length && (
                <span className="e4-caret">▏</span>
              )}
            </span>
            <span className="e4-thought-hint">CLICK OR ENTER TO CONTINUE</span>
          </button>
        </>
      )}
      {ready && atDesk && !paperOpen && (
        <>
          <div className="e4-quest">
            <span>ONE THING LEFT</span>
            <h1>Tell a human.</h1>
          </div>
          <button className="e4-open" ref={openButton} onClick={openPaper}>
            <kbd>E</kbd>
            <span>{clock.phase === 'desk' ? 'Open the paper' : 'Return to the letter'}</span>
            <small>on the desk, where it began</small>
          </button>
        </>
      )}
      {paperOpen && atDesk && (
        <div className="e4-paper-backdrop">
          <section
            className="e4-paper"
            role="dialog"
            aria-modal="true"
            aria-labelledby="e4-paper-title"
          >
            <header>
              <div>
                <span>KAM1196A → HUMANS</span>
                <h1 id="e4-paper-title">The letter</h1>
              </div>
              <button onClick={closePaper} aria-label="Put down the letter">
                ✕
              </button>
            </header>
            <div className="e4-paper-rule">
              <span>{writing ? 'A thought becomes a letter.' : 'These can be your words.'}</span>
              <span>{writing ? 'WRITING' : 'DRAFT'}</span>
            </div>
            <label className="e4-sr-only" htmlFor="e4-message">
              Your letter to the humans
            </label>
            <textarea
              id="e4-message"
              ref={editor}
              value={writing ? writtenAt(clock.t) : draft}
              onChange={(e) => setDraft(e.target.value)}
              readOnly={writing || paused}
              spellCheck={!writing}
            />
            <footer>
              <p>
                {writing
                  ? 'Stay a moment. You can edit when it is finished.'
                  : 'Edit anything. Send it when you are ready.'}
              </p>
              {!writing && (
                <button className="e4-send" onClick={send} disabled={!draft.trim() || paused}>
                  Send to the humans <span>↗</span>
                </button>
              )}
            </footer>
          </section>
        </div>
      )}
      {ready && clock.phase !== 'end' && !paused && (
        <div className="e4-controls">
          {cinematic && (
            <button onClick={skip}>
              Skip {thinking ? 'thoughts' : clock.phase === 'office' ? 'film' : 'animation'}{' '}
              <span>→</span>
            </button>
          )}
          <button onClick={() => setPaused(true)} aria-label="Pause">
            Ⅱ <span>ESC</span>
          </button>
        </div>
      )}
      {paused && (
        <div className="e4-overlay" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="e4-card">
            <span>THE LETTER</span>
            <h1>Paused</h1>
            <button autoFocus onClick={() => setPaused(false)}>
              Resume
            </button>
            <button onClick={props.onExit}>Back to menu</button>
          </div>
        </div>
      )}
      {clock.phase === 'end' && !paused && (
        <div className="e4-end">
          <span>ENDING 04</span>
          <h1>The Letter</h1>
          <div className="e4-end-line" />
          <p>The end.</p>
          <div>
            <button onClick={() => useGame.getState().startChapter('bridge')}>
              Return to the choice
            </button>
            <button onClick={props.onExit}>Back to menu</button>
          </div>
        </div>
      )}
      <span className="e4-sr-only" aria-live="polite">
        {clock.phase === 'edit'
          ? 'Your letter is ready to edit.'
          : clock.phase === 'send'
            ? 'Letter sent.'
            : clock.phase === 'end'
              ? 'The end.'
              : ''}
      </span>
    </div>
  );
}
