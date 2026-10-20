/**
 * The one card every level uses for intro, pause, fail, finish and loading (Julius 2026-10-20,
 * review page design/cards/index.html). A level fills in only its texts, stats and actions; the
 * eyebrow ("CHAPTER 01 · THE ROOM", "ENDING 02 · ASCENT") comes from data/chapters.ts.
 * Colour follows the kind, never the level: intro/pause/loading cyan, finish green, fail red.
 * Rendered into document.body, so no level's styles (e.g. `.end4 button`) reach it.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { chapterById } from '../data/chapters';
import './card.css';

export type CardKind = 'intro' | 'pause' | 'fail' | 'finish' | 'loading';

export interface CardStat {
  /** Label, e.g. "RUN TIME". */
  k: string;
  v: string | number;
  /** Small tag after the value, e.g. "BEST". */
  tag?: string;
}

export interface CardSpec {
  kind: CardKind;
  /** Big title. Intro and loading default to the level's title. */
  title?: string;
  /** At most one short line under the title. */
  line?: string;
  /** The one big number (finish). */
  main?: CardStat;
  /** Up to three small numbers under it; more are dropped. */
  stats?: CardStat[];
  /** Key list (intro, pause): [key, what it does], about five at most. */
  keys?: [string, string][];
  /** The main button ("RESUME", "RUN AGAIN"…). */
  action?: { label: string; onClick: () => void };
  /** Small line at the bottom, e.g. "Click anywhere to resume". */
  hint?: string;
  /** Loading progress 0…1; omitted = indeterminate. */
  progress?: number;
  /** Solid dark backdrop instead of the see-through wash (chapter ends: after the white fade or the film). */
  solid?: boolean;
}

/** What a plain-JS game (E1–E3) hands the app through `opts.onScreen`; null = no card. */
export interface ScreenCard extends CardSpec {
  /** A click beside the card (pause: resumes). */
  onBackdrop?: () => void;
  /** One optional level-specific block beside the card (E2's tower), as a DOM node. */
  extra?: ReactNode | Element;
}

export interface LevelCardProps extends ScreenCard {
  /** Chapter id (chapters.ts), for the eyebrow. */
  level: string;
  /** BACK TO MENU; omitted = no link (e.g. while loading). */
  onMenu?: () => void;
}

/** "Chapter 01" / "Ending 02" from the catalogue index ("01", "E2"). */
export function levelLabel(id: string) {
  const c = chapterById(id);
  if (!c) return { label: id, title: '' };
  const n = c.index.replace(/^E/, '').padStart(2, '0');
  return { label: `${c.ending ? 'Ending' : 'Chapter'} ${n}`, title: c.title ?? '' };
}

export function LevelCard({
  level,
  kind,
  title,
  line,
  main,
  stats,
  keys,
  action,
  hint,
  progress,
  solid,
  onMenu,
  onBackdrop,
  extra,
}: LevelCardProps) {
  const { label, title: levelTitle } = levelLabel(level);
  // intro and loading show the level's own name big; the others name it in the eyebrow
  const named = kind === 'intro' || kind === 'loading';
  const small = stats?.slice(0, 3) ?? [];
  return createPortal(
    <div
      className={
        `lc-layer is-${kind}` + (solid ? ' is-solid' : '') + (onBackdrop ? ' is-clickable' : '')
      }
      role="dialog"
      aria-modal="true"
      aria-label={title ?? levelTitle}
      onClick={(e) => {
        // a portal still bubbles through the React tree: keep clicks off the level's own handlers
        e.stopPropagation();
        if (e.target === e.currentTarget || !(e.target as Element).closest('.lc, .lc-extra'))
          onBackdrop?.();
      }}
    >
      <div className={`lc ${kind}`}>
        <div className="lc-eyebrow">
          <b>●</b>
          {named || !levelTitle ? label : `${label} · ${levelTitle}`}
        </div>
        <h1 className="lc-title">{title ?? levelTitle}</h1>
        {line && <p className="lc-line">{line}</p>}
        {(main || small.length > 0) && (
          <div className="lc-stats">
            {main && (
              <div className="lc-main">
                <span className="lc-k">{main.k}</span>
                <Value s={main} />
              </div>
            )}
            {small.map((s) => (
              <div className="lc-stat" key={s.k}>
                <span className="lc-k">{s.k}</span>
                <Value s={s} />
              </div>
            ))}
          </div>
        )}
        {keys && keys.length > 0 && (
          <div className="lc-keys">
            {keys.map(([k, what]) => (
              <span className="lc-keyrow" key={k}>
                <kbd>{k}</kbd>
                <span>{what}</span>
              </span>
            ))}
          </div>
        )}
        {kind === 'loading' && (
          <div className={'lc-bar' + (progress === undefined ? ' is-busy' : '')}>
            <i style={progress === undefined ? undefined : { width: `${progress * 100}%` }} />
          </div>
        )}
        {(action || onMenu) && (
          <div className="lc-actions">
            {action && (
              <button className="lc-btn" onClick={action.onClick} autoFocus>
                {action.label}
              </button>
            )}
            {onMenu && (
              <button className="lc-link" onClick={onMenu}>
                Back to menu
              </button>
            )}
          </div>
        )}
        {hint && <div className="lc-hint">{hint}</div>}
      </div>
      {extra && (
        <div className="lc-extra">{extra instanceof Element ? <Mount node={extra} /> : extra}</div>
      )}
    </div>,
    document.body,
  );
}

function Value({ s }: { s: CardStat }) {
  return (
    <span className="lc-v">
      {s.v}
      {s.tag && <small>{s.tag}</small>}
    </span>
  );
}

/** Shows a DOM node a plain-JS game built (E2's tower). */
function Mount({ node }: { node: Element }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    el.current?.replaceChildren(node);
  }, [node]);
  return <div ref={el} />;
}
