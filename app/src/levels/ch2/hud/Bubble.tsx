/**
 * The agents' posts (kit `.c2-bubble`, hud.js `say` / `place`): one bubble, pinned every frame to
 * the speaking agent's projected anchor (`SCREEN.bubble`), flipped left near the right edge. The
 * text types itself in; underscores and dashes are dimmed, `zz` is pink; earlier posts of the
 * same agent float up as ghosts (max 2).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useCh2 } from '../context';
import { npc as npcOf } from '../layout';
import { SCREEN, speechOf } from './screen';
import { TYPE_CPS, useTypewriter } from './Log';

/** Dim `_` and `-` so long folder names read as words; `zz` at the start in pink. */
function chars(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const rest = text.startsWith('zz') ? text.slice(2) : text;
  if (rest !== text)
    out.push(
      <span key="zz" className="c2-zzhl">
        zz
      </span>,
    );
  [...rest].forEach((c, i) =>
    out.push(
      c === '_' || c === '-' ? (
        <span key={i} className="us">
          {c}
        </span>
      ) : (
        c
      ),
    ),
  );
  return out;
}

const GAP = 46;

export function Bubble() {
  const line = useCh2((s) => (s.dialogue?.npc === 'c03220' ? s.dialogue.line : null));
  const bubbles = useCh2((s) => s.bubbles);
  const area = useCh2((s) => s.area);
  const stepId = useCh2((s) => s.stepId);
  const sp = speechOf({ line, bubbles, area, stepId });
  const key = sp ? `${sp.npc}|${sp.i}|${sp.text}` : '';

  // ghosts: the same agent's earlier posts, newest first
  const [ghosts, setGhosts] = useState<string[]>([]);
  const prev = useRef<{ npc: string; text: string } | null>(null);
  useEffect(() => {
    const p = prev.current;
    if (sp && p && p.npc === sp.npc && p.text !== sp.text)
      setGhosts((g) => [p.text, ...g].slice(0, 2));
    else if (!sp || !p || p.npc !== sp.npc) setGhosts([]);
    prev.current = sp ? { npc: sp.npc, text: sp.text } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on a new post
  }, [key]);

  const text = sp?.text ?? '';
  const k = useTypewriter(text, TYPE_CPS * 0.8);

  // pin + flip every frame
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const lead = useRef<SVGLineElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const r = root.current;
      if (!r || !box.current) return;
      const on = SCREEN.bubble.on;
      r.style.visibility = on ? '' : 'hidden';
      if (!on) return;
      const { x, y } = SCREEN.bubble;
      r.style.transform = `translate(${x}px,${y}px)`;
      const W = r.parentElement?.clientWidth ?? innerWidth;
      const w = box.current.offsetWidth;
      const flip = x + GAP + w > W - 16;
      r.style.setProperty('--bx', flip ? `${-GAP - w}px` : `${GAP}px`);
      box.current.style.transformOrigin = flip ? '100% 100%' : '0 100%';
      lead.current?.setAttribute('x2', String(flip ? -GAP : GAP));
      r.style.setProperty('--tailx', flip ? `${Math.max(24, w - 30)}px` : '2.2em');
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={root}
      className={'c2-bubble' + (sp && k >= text.length ? ' is-typed' : '')}
      data-npc={sp?.npc ?? 'c03220'}
      hidden={!sp}
    >
      <div className="c2-bubble__pin" />
      <svg className="c2-bubble__lead" width="1" height="1">
        <line ref={lead} x1="0" y1="0" x2={GAP} y2={-GAP} />
      </svg>
      <div className="c2-bubble__box" ref={box}>
        <div className="c2-bubble__ghosts">
          {ghosts.map((g, i) => (
            <div key={g + i} className="c2-ghost">
              {chars(g)}
            </div>
          ))}
        </div>
        {/* re-mounted per post so the kit's bubble-in animation plays again */}
        <div className="c2-bubble__panel" key={key}>
          <div className="c2-bubble__who">
            <span>{sp ? npcOf(sp.npc).handle : ''}</span>
            <b className="c2-bubble__n">{sp && sp.n > 1 ? `${sp.i}/${sp.n}` : ''}</b>
          </div>
          <div className="c2-bubble__t">
            {chars(text.slice(0, k))}
            {k < text.length && (
              <>
                <span className="c2-caret" />
                <span className="c2-untyped">{chars(text.slice(k))}</span>
              </>
            )}
          </div>
          {sp?.dialogue && (
            <div className="c2-bubble__key">
              <span className="c1-key">E</span> next
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
