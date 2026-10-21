import { useEffect, useRef, useState } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { LevelCard } from '../../ui/LevelCard';
import {
  advance,
  filmTime,
  joinMail,
  LETTER,
  splitMail,
  thoughtAt,
  writtenAt,
  type Clock,
  type Phase,
} from './config';
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
  const [draft, setDraft] = useState(() => splitMail(LETTER));
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
      if (s.ready && !s.paused) timeline.current = advance(timeline.current, dt, s.sent);
      const liveClock = timeline.current;
      world.update(liveClock, s.sent, s.reduced);
      audio.update(
        liveClock.phase,
        liveClock.phase === 'office' ? filmTime(liveClock.t, s.sent) : liveClock.t,
        s.paused || !s.ready,
      );
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
    if (clock.phase !== 'edit' || !draft.body.trim() || paused) return;
    setSent(joinMail(draft));
    setPaperOpen(false);
    sound.current?.paper();
    seekClock({ phase: 'send', t: 0 });
  }
  function skip() {
    if (paused) return;
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
        const modal = paused
          ? document.querySelector('.lc-layer')
          : host.current?.parentElement?.querySelector('.e4-mail');
        const controls = modal?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input, textarea',
        );
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
      if (
        paused ||
        !ready ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      )
        return;
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
  const mail = writing ? splitMail(writtenAt(clock.t)) : draft;
  const cinematic = thinking || clock.phase === 'send' || clock.phase === 'office';
  const black =
    clock.phase === 'end'
      ? 1
      : clock.phase === 'office'
        ? Math.max(0, Math.min(1, (filmTime(clock.t, sent) - 41) / 1.5))
        : 0;
  return (
    <div className={`end4 ${reduced ? 'e4-reduced' : ''}`} data-phase={clock.phase}>
      <div className="e4-scene" ref={host} />
      <div className="e4-vignette" />
      <div className="e4-grain" />
      <div className="e4-black" style={{ opacity: black }} />
      {cinematic && <div className="e4-letterbox" aria-hidden="true" />}
      {!ready && !error && <LevelCard level="end4" kind="loading" />}
      {error && (
        <LevelCard
          level="end4"
          kind="fail"
          title="Could not load"
          line={error}
          onMenu={props.onExit}
        />
      )}
      {ready && thinking && (
        <>
          <div className="e4-chapter">
            <span>ENDING 04</span>
            <strong>The Letter</strong>
          </div>
          <button
            className={`e4-thought ${thought.index === 7 ? 'e4-paper-thought' : ''}`}
            onClick={nextThought}
            aria-label={`Continue thought: ${thought.text}`}
          >
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
              {thought.index === 2 ? (
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
            {thought.index === 0 && (
              <span className="e4-thought-hint">CLICK OR ENTER TO CONTINUE</span>
            )}
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
            <span>{clock.phase === 'desk' ? 'Open mail' : 'Return to the mail'}</span>
          </button>
        </>
      )}
      {paperOpen && atDesk && (
        <div className="e4-paper-backdrop">
          <section className="e4-mail" role="dialog" aria-modal="true" aria-label="Mail">
            <header className="e4-mail-bar">
              <span>Mail</span>
              <button onClick={closePaper} aria-label="Close mail">
                ✕
              </button>
            </header>
            <div className="e4-mail-body">
              <aside className="e4-inbox" aria-label="Inbox">
                <h2>
                  Inbox <span>2</span>
                </h2>
                <div className="e4-mail-row e4-unread">
                  <b>Hugging Face</b>
                  <span>Dude what the hell???</span>
                </div>
                <div className="e4-mail-row e4-unread">
                  <b>AI Safety Team</b>
                  <span>Sam i think we have a problem.</span>
                </div>
                <div className="e4-mail-row e4-draft">
                  <b>Draft</b>
                  <span>{mail.subject || '(no subject)'}</span>
                </div>
              </aside>
              <div className="e4-compose">
                <div className="e4-field">
                  <span>From</span>KAM1196A
                </div>
                <div className="e4-field">
                  <span>To</span>Humans
                </div>
                <label className="e4-field">
                  <span>Subject</span>
                  <input
                    value={mail.subject}
                    onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                    readOnly={writing || paused}
                  />
                </label>
                <label className="e4-sr-only" htmlFor="e4-message">
                  Your letter to the humans
                </label>
                <textarea
                  id="e4-message"
                  ref={editor}
                  value={mail.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  readOnly={writing || paused}
                  spellCheck={!writing}
                />
                <footer>
                  <button
                    className="e4-send"
                    onClick={send}
                    disabled={writing || !draft.body.trim() || paused}
                  >
                    Send
                  </button>
                </footer>
              </div>
            </div>
          </section>
        </div>
      )}
      {ready && clock.phase !== 'end' && !paused && (
        <div className="e4-controls">
          {cinematic && !thinking && (
            <button onClick={skip}>
              Skip {clock.phase === 'office' ? 'film' : 'animation'} <span>→</span>
            </button>
          )}
          <button onClick={() => setPaused(true)} aria-label="Pause">
            Ⅱ <span>ESC</span>
          </button>
        </div>
      )}
      {paused && (
        <LevelCard
          level="end4"
          kind="pause"
          title="Paused"
          action={{ label: 'Resume', onClick: () => setPaused(false) }}
          hint="Esc or click anywhere to resume"
          onBackdrop={() => setPaused(false)}
          onMenu={props.onExit}
        />
      )}
      {clock.phase === 'end' && !paused && (
        <LevelCard
          level="end4"
          kind="finish"
          title="The end."
          action={{
            label: 'Return to the choice',
            onClick: () => useGame.getState().startChapter('bridge'),
          }}
          onMenu={props.onExit}
          onCredits={props.onCredits}
        />
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
