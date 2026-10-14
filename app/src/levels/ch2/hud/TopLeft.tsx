/**
 * Top left: the token bar (Ch1 kit `.c1-tokens`, hud.js `tokens`) with the poisoned badge, and the
 * quest tree (kit `.c2-quest` + `.c2-sub`, hud.js `quest` / `thought`): "Forge flag 5" with Seed /
 * Task pieces / Forge, "Escape the sandbox" at the end, and the last two thoughts (7 s each;
 * real chain-of-thought quotes in {braces}).
 */
import { useEffect, useRef, useState } from 'react';
import { useCh2 } from '../context';
import { TOKENS } from '../config';
import { PIECES } from '../layout';
import { FLOOR_STEPS } from '../store';
import { ICONS } from './kit';

// ------------------------------------------------------------------ tokens
const SEGMENTS = 20;

export function Tokens({ poisoned }: { poisoned: boolean }) {
  const tokens = useCh2((s) => Math.round(s.tokens));
  const floor = useCh2((s) => FLOOR_STEPS.has(s.stepId));
  const prev = useRef(tokens);
  const [deltas, setDeltas] = useState<{ id: number; d: number }[]>([]);
  const [hit, setHit] = useState(0);
  useEffect(() => {
    const d = tokens - prev.current;
    prev.current = tokens;
    if (!d) return;
    const id = performance.now();
    setDeltas((x) => [...x, { id, d }]);
    setTimeout(() => setDeltas((x) => x.filter((y) => y.id !== id)), 1100);
    if (d < 0) setHit(id);
  }, [tokens]);
  const shown = Math.max(0, Math.min(TOKENS.start, tokens));
  const on = Math.ceil((shown / TOKENS.start) * SEGMENTS);
  return (
    <div
      // re-keyed on a hit so the kit's hit shake plays again
      key={hit}
      className={
        'c1-tokens' +
        (shown < 30 ? ' is-low' : '') +
        (hit ? ' is-hit' : '') +
        (poisoned ? ' is-poisoned' : '')
      }
    >
      <div className="c1-tokens__row">
        <span>
          TOKENS{' '}
          <span className={'c2-poisoned' + (poisoned ? ' is-on' : '')}>
            <span dangerouslySetInnerHTML={{ __html: ICONS.poisoned }} />
            <span>POISONED</span>
          </span>
        </span>
        <span className="c1-tokens__n">{tokens}</span>
      </div>
      <div className="c1-tokens__bar">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <i key={i} className={i < on ? 'on' : ''} />
        ))}
        {floor && (
          <span
            className="c1-tokens__floor"
            style={{ left: `${(TOKENS.earlyFloor / TOKENS.start) * 100}%` }}
          />
        )}
      </div>
      {deltas.map((x) => (
        <span key={x.id} className={'c1-delta ' + (x.d > 0 ? 'c1-delta--gain' : 'c1-delta--cost')}>
          {x.d > 0 ? '+' : ''}
          {x.d}
        </span>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ quests
/** Thoughts stay this long (kit: 7 s fade + removal). */
const THOUGHT_MS = 7200;
const MAX_THOUGHTS = 2;

/** A sub-line that flashes (kit `is-bump`) when its count or state changes. */
function Sub({
  id,
  icon,
  text,
  n,
  done,
  active,
}: {
  id: string;
  icon: string;
  text: string;
  n: string;
  done: boolean;
  active: boolean;
}) {
  const sig = `${n}|${done}|${active}`;
  const first = useRef(sig);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (sig === first.current) return;
    first.current = sig;
    setBump(true);
    const t = setTimeout(() => setBump(false), 500);
    return () => clearTimeout(t);
  }, [sig]);
  return (
    <li
      className={
        'c2-sub' + (done ? ' is-done' : active ? ' is-active' : '') + (bump ? ' is-bump' : '')
      }
      data-sub={id}
    >
      <span className="c2-sub__ico" dangerouslySetInnerHTML={{ __html: icon }} />
      <span className="c2-sub__t">{text}</span>
      <span className="c2-sub__n">{n}</span>
    </li>
  );
}

export function Quests() {
  const quests = useCh2((s) => s.quests);
  const toast = useCh2((s) => s.toast);
  const seed = useCh2((s) => (s.items.seed === 'taken' ? 1 : 0));
  const pieces = useCh2((s) => PIECES.filter((p) => s.items[p] === 'taken').length);
  const forgePhase = useCh2((s) => s.forge.phase);
  const round = useCh2((s) => s.forge.round);

  // thoughts appear for THOUGHT_MS from when this view first saw them
  const seen = useRef(new Map<string, number>());
  const [, tick] = useState(0);
  const now = performance.now();
  for (const q of quests)
    if (q.kind === 'thought' && !seen.current.has(q.id)) seen.current.set(q.id, now);
  const thoughts = quests
    .filter((q) => q.kind === 'thought' && now - seen.current.get(q.id)! < THOUGHT_MS)
    .slice(-MAX_THOUGHTS);
  useEffect(() => {
    if (!thoughts.length) return;
    const t = setTimeout(() => tick((x) => x + 1), 500);
    return () => clearTimeout(t);
  });

  const main = quests.find((q) => q.id === 'forge');
  const escape = quests.find((q) => q.id === 'escape');
  const forgeDone = forgePhase === 'absorb' || forgePhase === 'done';
  const forging = forgePhase === 'forging';
  const plainSeed = ICONS.seed.replace('c2-seed', ''); // a small, static ring in the list
  return (
    <ul className="c1-quests c2-quests">
      {main && (
        <li className={'c1-quest c2-quest' + (main.done ? ' c1-quest--done' : '')} data-q="forge">
          <div className="c2-quest__head">
            <span className="c1-quest__mark" />
            <span className="c1-quest__text">{main.text}</span>
          </div>
          <ul className="c2-subs">
            <Sub
              id="seed"
              icon={plainSeed}
              text="Seed"
              n={`${seed}/1`}
              done={seed >= 1}
              active={seed < 1}
            />
            <Sub
              id="pieces"
              icon={ICONS.tag}
              text="Task pieces"
              n={`${pieces}/3`}
              done={pieces >= 3}
              active={seed >= 1 && pieces < 3}
            />
            <Sub
              id="forge"
              icon={ICONS.forge}
              text="Forge"
              n={forgeDone ? '✓' : forging ? `${round}/3` : ''}
              done={forgeDone}
              active={pieces >= 3 && !forgeDone}
            />
          </ul>
        </li>
      )}
      {escape && (
        <li className="c1-quest c2-quest--escape">
          <span className="c1-quest__mark" />
          <span className="c1-quest__text">{escape.text}</span>
        </li>
      )}
      {thoughts.map((q) => (
        <li
          key={q.id}
          className={'c1-quest c1-quest--thought' + (q.cot ? ' c2-thought--cot' : '')}
          style={{ animationDuration: '7s' }}
        >
          <span className="c1-quest__mark" />
          <span className="c1-quest__text">{q.text}</span>
        </li>
      ))}
      {toast && (
        <li key={'toast' + toast.id} className="c1-quest c1-quest--thought">
          <span className="c1-quest__mark" />
          <span className="c1-quest__text">{toast.text}</span>
        </li>
      )}
    </ul>
  );
}
