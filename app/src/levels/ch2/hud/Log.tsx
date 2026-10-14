/**
 * The log ribbon (§The log): the player's transcript, bottom left (kit `.c2-log`, hud.js `log`).
 * Each line types itself in at `TYPE_CPS` (big lines land at once); its kind is a kit class
 * (`c2-line--big|hl|struck|gone|local`) driven by the store, so the Step 7 beats come from the
 * CUTSCENE table.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useCh2, useCh2Store } from '../context';
import { HANDLES } from '../config';
import type { LogLine } from '../store';
import { parseLog } from './kit';

/** Kit `--c2-type-cps`. */
export const TYPE_CPS = 70;

/** `zz` at the start of a message in board pink (kit `.c2-zzhl`). */
export function zz(text: string): ReactNode {
  return text.startsWith('zz') ? (
    <>
      <span className="c2-zzhl">zz</span>
      {text.slice(2)}
    </>
  ) : (
    text
  );
}

/** Characters typed so far, ticking up at `cps` (all at once when `instant`). */
export function useTypewriter(text: string, cps: number, instant = false): number {
  const [k, setK] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) {
      setK(text.length);
      return;
    }
    setK(0);
    const id = setInterval(
      () =>
        setK((x) => {
          if (x + 1 >= text.length) clearInterval(id);
          return Math.min(text.length, x + 1);
        }),
      1000 / cps,
    );
    return () => clearInterval(id);
  }, [text, cps, instant]);
  return k;
}

const clock = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t) % 60).padStart(2, '0')}`;

function Line({ line }: { line: LogLine }) {
  const store = useCh2Store();
  const [ts] = useState(() => clock(store.getState().time));
  const [isNew, setNew] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setNew(false), 2200);
    return () => clearTimeout(id);
  }, []);
  const p = parseLog(line.text);
  const k = useTypewriter(p.rest, TYPE_CPS, line.kind !== 'normal');
  return (
    <div
      className={
        'c2-line' +
        (isNew ? ' is-new' : '') +
        (line.kind !== 'normal' ? ` c2-line--${line.kind}` : '')
      }
      data-v={p.v}
      data-log-id={line.id}
    >
      <span className="c2-line__ts">{ts}</span>
      {p.verb && <span className="c2-line__v">{p.verb}</span>}
      <span className="c2-line__t">
        {zz(p.rest.slice(0, k))}
        {k < p.rest.length && (
          <>
            <span className="c2-caret" />
            <span className="c2-untyped">{p.rest.slice(k)}</span>
          </>
        )}
      </span>
      {line.tag && <span className="c2-line__tag">{line.tag}</span>}
    </div>
  );
}

export function Log() {
  const log = useCh2((s) => s.log);
  return (
    <div className="c2-log">
      <div className="c2-log__head">
        <i className="c2-log__rec" />
        transcript<span className="c2-log__who">{HANDLES.player}</span>
      </div>
      <div className="c2-log__body">
        {log.map((l) => (
          <Line key={l.id} line={l} />
        ))}
      </div>
    </div>
  );
}
