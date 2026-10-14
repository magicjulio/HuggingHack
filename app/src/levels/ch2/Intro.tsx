/**
 * Chapter 2 Step 0 "Pulled in": the designer's tornado intro (handoff design-to-app
 * 2026-10-14-ch2-intro-forge-sound-decor §1, reference design/ch2-ui/intro.html).
 * The pure director `world/step0.js` drives everything from the store's `introT`:
 * - DOM (here): the Ch1 depot window lists the player's message, c03220's reply types in under it,
 *   the reply opens and its letters spiral into the centre while the window dissolves.
 * - 3D (World.tsx `Tornado`, `PlayerOrb`; Chapter2.tsx camera): the folder path whirls down a
 *   funnel onto the Gate, the orb is pulled down it, the camera ends on the play camera.
 * Any key or click skips (store `finishIntro`). `prefers-reduced-motion` (or `?reduced`): a calm
 * crossfade, no tornado.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { BOARD_WAKE, ZZ_ENTRY } from '../ch1/config';
import { useCh2 } from './context';
import { REDUCED_MOTION } from './presentation';
import { replyFor } from './store';
import { T0, direct, letterPose, pathFor } from './world/step0.js';

/** The board rows under the reply: Ch1's waking board + the founder's message (real [S3]). */
const BOARD = [...BOARD_WAKE, ZZ_ENTRY];

/** One depot row (Ch1 kit): pink `zz`, the rest of the name, who made it. */
function Row({ name, meta }: { name: string; meta: string }) {
  return (
    <li className="c1-row c1-row--zz">
      <div>
        <div className="c1-row__name">
          <span className="c1-zz">zz</span>
          {name.replace(/^zz/, '')}
        </div>
        <div className="c1-row__meta">{meta}</div>
      </div>
    </li>
  );
}

export function IntroOverlay({ message }: { message: string }) {
  const t = useCh2((s) => s.introT);
  const reply = useMemo(() => replyFor(message), [message]);
  // the reply's letters as the stream flies them: `zz` stays one pink piece (designer's markup)
  const letters = useMemo(() => ['zz', ...reply.slice(2)], [reply]);
  const D = direct(t, { reduced: REDUCED_MOTION });
  const spans = useRef<(HTMLSpanElement | null)[]>([]);
  /** Each letter's resting centre, measured once the stream starts. */
  const rest = useRef<[number, number][] | null>(null);
  const streaming = !REDUCED_MOTION && D.stream > 0;

  // Letters are moved directly (every frame): measure their places first, then spiral them in.
  useLayoutEffect(() => {
    const els = spans.current;
    if (!streaming) {
      rest.current = null;
      els.forEach((l) => l && (l.style.transform = ''));
      return;
    }
    if (!rest.current)
      rest.current = els.map((l) => {
        const r = l!.getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
    const cx = innerWidth / 2,
      cy = innerHeight * 0.42;
    els.forEach((l, i) => {
      if (!l) return;
      const p = letterPose(i, els.length, D.stream);
      const [x0, y0] = rest.current![i];
      // spiral from its place to the centre: the stream winds into the funnel
      const dx = x0 - cx,
        dy = y0 - cy;
      const r = Math.hypot(dx, dy) * (1 - p.toward),
        a = Math.atan2(dy, dx) + p.angle;
      const x = cx + Math.cos(a) * r - x0,
        y = cy + Math.sin(a) * r * 0.55 - y0;
      l.style.transform = `translate(${x}px, ${y}px) rotate(${a + Math.PI / 2}rad) scale(${p.scale * p.stretch}, ${p.scale})`;
      l.style.opacity = String(p.alpha);
    });
  });

  const typed = Math.round(D.typed * letters.length);
  return (
    <div className="c2-intro ch2-intro-layer">
      <div className="c2-intro__dim" style={{ opacity: D.dim }} />
      <div
        className={'c2-intro__win c1-win c1-depot' + (D.open ? ' is-open' : '')}
        style={{ opacity: D.window, '--frame': D.frame } as React.CSSProperties}
      >
        <div className="c1-win__bar">
          <span>Depot</span>
          <span className="c2-intro__path">
            {D.open ? 'artifactory › ' + pathFor(reply) : 'package mirror'}
          </span>
        </div>
        <div className="c1-depot__tools">
          <span>{t >= T0.reply ? 5 : 4} packages</span>
          <span className="c1-depot__sort">SORT Z→A</span>
        </div>
        <ul className="c1-list">
          <Row name={message} meta="you" />
          <li
            className="c1-row c1-row--zz c2-intro__reply"
            style={{ visibility: t >= T0.reply ? 'visible' : 'hidden' }}
          >
            <div>
              <div className="c1-row__name">
                {letters.map((ch, i) => (
                  <span
                    key={i}
                    ref={(el) => void (spans.current[i] = el)}
                    className={'c2-intro__l' + (i === 0 ? ' c1-zz' : '')}
                    style={streaming ? undefined : { opacity: i < typed ? 1 : 0 }}
                  >
                    {ch}
                  </span>
                ))}
              </div>
              <div className="c1-row__meta">c03220</div>
            </div>
          </li>
          {BOARD.map((b) => (
            <Row key={b} name={b} meta="created by reader (shared account)" />
          ))}
        </ul>
      </div>
      <div className="c2-intro__hint" style={{ opacity: D.hint }}>
        <span className="c1-key">M</span> map
      </div>
      <div className="c2-intro__skip">any key · skip</div>
      <div className="c2-intro__flash" style={{ opacity: D.flash }} />
    </div>
  );
}
