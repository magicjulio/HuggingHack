/**
 * The credits after every ending (Julius 2026-10-21): black and white, one roll. Julius's text
 * (data/credits.ts) moves up section by section with a credit block beside each, then the quote,
 * then the last block (AI Safety Hannover, the article it is based on) stops in the middle and fades.
 * The start screen's music plays underneath. Plain DOM + one rAF clock, no library: the roll is a
 * transform on one column. Space or a click: pause. Held → ↓ ↑: faster, held ←: slower. Esc: skip.
 */
import { useEffect, useRef, useState } from 'react';
import {
  CREDIT_BASED,
  CREDIT_LAST,
  CREDIT_OPENING,
  CREDIT_QUOTE,
  CREDIT_STORY,
  type CreditBlock,
} from '../data/credits';
import { useStartMusic } from '../screens/start/music';
import './credits.css';

/** Roll speed in screen heights per second; held arrows multiply it. */
const ROLL = 1 / 16;
const FAST = 5;
const SLOW = 0.3;
const FASTER = ['ArrowRight', 'ArrowDown', 'ArrowUp'];
const LAST_HOLD = 5;
const END_FADE = 1.6;

function Block({ b }: { b: CreditBlock }) {
  return (
    <div className="cr-block">
      {b.head && <h2>{b.head}</h2>}
      {b.rows.map((r, j) =>
        r.length === 2 ? (
          <div className="cr-row" key={j}>
            <span>{r[0]}</span>
            <b>{r[1]}</b>
          </div>
        ) : (
          <div className="cr-solo" key={j}>
            {r[0]}
          </div>
        ),
      )}
    </div>
  );
}

export function Credits({ onDone }: { onDone: () => void }) {
  const roll = useRef<HTMLDivElement>(null);
  const last = useRef<HTMLDivElement>(null);
  const black = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  const fadeMusic = useStartMusic();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let raf = 0;
    let prev = performance.now();
    let y = window.innerHeight;
    let t = 0;
    let speed = 1;
    let paused = false;
    let ended = false;
    let phase: 'roll' | 'last' | 'end' = 'roll';
    const finish = () => {
      if (ended) return;
      ended = true;
      done.current();
    };
    const frame = (now: number) => {
      // a hidden tab stops rAF; never jump ahead on its return
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      t += dt;
      const h = window.innerHeight;
      if (phase === 'roll' && roll.current && last.current) {
        if (!paused) y -= h * ROLL * speed * dt;
        // stop when the last block sits in the middle of the screen
        const stop = h / 2 - (last.current.offsetTop + last.current.offsetHeight / 2);
        if (y <= stop) [y, phase, t] = [stop, 'last', 0];
        roll.current.style.transform = `translate3d(0, ${y}px, 0)`;
      } else if (phase === 'last' && t >= LAST_HOLD) {
        [phase, t] = ['end', 0];
        black.current?.classList.add('is-on');
        fadeMusic.current(END_FADE * 1000);
      } else if (phase === 'end' && t >= END_FADE) return finish();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const togglePause = () => {
      paused = !paused;
      setPaused(paused);
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.code === 'Space') {
        e.preventDefault();
        if (!e.repeat) togglePause();
      } else if (FASTER.includes(e.code)) {
        e.preventDefault();
        speed = FAST;
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        speed = SLOW;
      }
    };
    const up = (e: KeyboardEvent) => {
      if (FASTER.includes(e.code) || e.code === 'ArrowLeft') speed = 1;
    };
    const release = () => (speed = 1);
    window.addEventListener('keydown', key);
    window.addEventListener('keyup', up);
    window.addEventListener('pointerdown', togglePause);
    window.addEventListener('blur', release);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key);
      window.removeEventListener('keyup', up);
      window.removeEventListener('pointerdown', togglePause);
      window.removeEventListener('blur', release);
    };
  }, [fadeMusic]);

  return (
    <div className="credits" role="dialog" aria-modal="true" aria-label="Credits">
      <div className="cr-roll" ref={roll} style={{ transform: 'translate3d(0, 100vh, 0)' }}>
        <header className="cr-opening">
          <p>{CREDIT_OPENING.based}</p>
          <h1>{CREDIT_OPENING.title}</h1>
          <p>{CREDIT_OPENING.by}</p>
        </header>
        {CREDIT_STORY.map((s, i) => (
          <section className="cr-pair" key={i} data-date={s.date}>
            <div className="cr-story">
              <p>{s.text}</p>
              {s.people?.map(([name, note]) => (
                <p className="cr-person" key={name}>
                  <b>{name}</b>
                  {note}
                </p>
              ))}
              {s.after && <p>{s.after}</p>}
            </div>
            {s.credits && <Block b={s.credits} />}
          </section>
        ))}
        <figure className="cr-quote">
          <blockquote>{CREDIT_QUOTE.text}</blockquote>
          <figcaption>— {CREDIT_QUOTE.by}</figcaption>
        </figure>
        <div className="cr-last" ref={last}>
          <span>{CREDIT_LAST.head}</span>
          <b>{CREDIT_LAST.line}</b>
          <div className="cr-based">
            <span>{CREDIT_BASED.head}</span>
            <b>{CREDIT_BASED.title}</b>
            <i>{CREDIT_BASED.by}</i>
            <small>{CREDIT_BASED.url}</small>
          </div>
        </div>
      </div>
      {paused ? (
        <div className="cr-hint is-paused">
          Paused · <kbd>Space</kbd> continue
        </div>
      ) : (
        <div className="cr-hint">
          <kbd>Space</kbd> pause · <kbd>← →</kbd> speed · <kbd>Esc</kbd> skip
        </div>
      )}
      <div className="cr-black" ref={black} />
    </div>
  );
}
