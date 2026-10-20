/**
 * Chapter 2 HUD = the designer's kit (handoff design-to-app/2026-10-14-ch2-hud-and-map.md), laid
 * out like their review page (design/ch2-ui/index.html): top left tokens + quests, top right
 * minimap + key hint, centre crosshair + use prompt, the agents' bubble, the log ribbon bottom left,
 * the inventory bottom right, the full map on M, and the poisoned layers (stamp, spread, vignette).
 * During the Step 7 cutscene everything but the log fades (`is-cinematic`).
 */
import { memo, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCh2 } from '../context';
import { TEXT } from '../config';
import { Bubble } from './Bubble';
import { Inventory } from './Inventory';
import { Log } from './Log';
import { FullMap, Minimap } from './Map';
import { Quests, Tokens } from './TopLeft';

// Each kit part subscribes to its own data; poison animation ticks do not change those parts.
const KitTokens = memo(Tokens);
const KitQuests = memo(Quests);
const KitMinimap = memo(Minimap);
const KitFullMap = memo(FullMap);
const KitBubble = memo(Bubble);
const KitLog = memo(Log);
const KitInventory = memo(Inventory);
const KitHurt = memo(Hurt);

const LETTERBOX = '10vh';

/** Red vignette on a hit; pulsing orange while clouds drain tokens (kit `hurt`). */
function Hurt() {
  const at = useCh2((s) => s.hurtAt);
  const kind = useCh2((s) => s.hurtKind);
  const [cloud, setCloud] = useState(false);
  useEffect(() => {
    if (at === null || kind !== 'cloud') return;
    setCloud(true);
    const t = setTimeout(() => setCloud(false), 2600);
    return () => clearTimeout(t);
  }, [at, kind]);
  return (
    <>
      <div
        key={kind === 'hit' ? `hit${at}` : 'hit'}
        className={'c2-hurt' + (kind === 'hit' && at !== null ? ' is-on' : '')}
      />
      <div className={'c2-hurt c2-hurt--cloud' + (cloud ? ' is-on' : '')} />
    </>
  );
}

export function Ch2Hud({
  visible,
  prompt,
  crosshair,
  poisoned,
}: {
  visible: boolean;
  /** What E does right now ("talk to c03220"), or null. */
  prompt: string | null;
  crosshair: boolean;
  /** Poisoned now (state or save): badge, vignette, minimap rim. */
  poisoned: boolean;
}) {
  const phase = useCh2((s) => s.phase);
  const cutT = useCh2((s) => s.cutT);
  const cinematic = useCh2((s) => s.cinematic);
  const spreadAt = useCh2((s) => s.poisonSpreadAt);
  const stampAt = useCh2((s) => s.poisonStampAt);
  const run = useCh2((s) => s.cutsceneRun);
  const root = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0, stampX: 380, stampY: 0, radius: 0 });

  // Measure the actual transcript line. Animations read game time, so replay skips, debug
  // jumps and unmounts cannot leave a wall-clock timeout or rAF painting an old scene.
  useLayoutEffect(() => {
    if (spreadAt === null && stampAt === null) return;
    const measure = () => {
      const h = root.current;
      if (!h) return;
      const r = h.getBoundingClientRect();
      const l = [...h.querySelectorAll('.c2-line--big')].at(-1)?.getBoundingClientRect() ?? {
        left: r.left + r.width * 0.1,
        top: r.top + r.height * 0.8,
        width: 400,
        height: 30,
      };
      const x = l.left - r.left + l.width * 0.35,
        y = l.top - r.top + l.height / 2;
      setOrigin({
        x,
        y,
        stampX: Math.max(380, x + 60),
        stampY: y - 55,
        radius: Math.hypot(r.width, r.height) * 1.1,
      });
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(root.current!);
    return () => resize.disconnect();
  }, [spreadAt, stampAt, run]);
  const spread = spreadAt === null ? 0 : Math.max(0, Math.min(1, (cutT - spreadAt) / 1.4));
  const washing = spreadAt !== null && spread < 1 && phase === 'cutscene';
  const stamp = stampAt !== null && cutT >= stampAt && cutT < stampAt + 2.5 && phase === 'cutscene';
  const shake = stamp && cutT - stampAt >= 0.23 && cutT - stampAt < 0.8;
  const vig = spread >= 1 || (poisoned && phase !== 'cutscene');

  return (
    <div
      ref={root}
      className={'c2-hud' + (cinematic ? ' is-cinematic' : '') + (shake ? ' c2-shake' : '')}
      style={
        {
          '--c2-letterbox': LETTERBOX,
          visibility: visible ? undefined : 'hidden',
        } as React.CSSProperties
      }
    >
      {/* rough ink edge for the POISONED stamp (designer's review page) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
        <filter id="c2-ink-rough" x="-10%" y="-20%" width="120%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves={2} seed={7} result="n" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="n"
            scale={5}
            xChannelSelector="R"
            yChannelSelector="G"
            result="d"
          />
          <feTurbulence
            type="fractalNoise"
            baseFrequency=".08 .5"
            numOctaves={1}
            seed={3}
            result="m"
          />
          <feColorMatrix
            in="m"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.6 1.75"
            result="holes"
          />
          <feComposite in="d" in2="holes" operator="in" />
        </filter>
      </svg>
      <div className={'c2-vig' + (vig ? ' is-on' : '')} />
      <div
        className={'c2-wash' + (washing ? ' is-on' : '')}
        style={
          {
            '--ox': `${origin.x}px`,
            '--oy': `${origin.y}px`,
            '--r': `${(1 - Math.pow(1 - spread, 2.4)) * origin.radius}px`,
          } as React.CSSProperties
        }
      />
      <KitHurt />

      <div className="c2-tl">
        <KitTokens poisoned={poisoned} />
        <KitQuests />
      </div>
      <div className="c2-tr">
        <KitMinimap poisoned={poisoned} />
        <div className="c2-keyhint">
          <span className="c1-key">M</span> map
        </div>
      </div>

      {crosshair && <div className="c2-cross" />}
      <div className="c2-use" hidden={!prompt}>
        <span className="c1-key">E</span>
        <span className="c2-use__t">{prompt}</span>
      </div>

      <KitBubble />
      <KitLog />
      <KitInventory />

      <div className="c2-stamp-layer">
        {stamp && (
          <div className="c2-stamp" key={run} style={{ left: origin.stampX, top: origin.stampY }}>
            {TEXT.poisoned}
          </div>
        )}
      </div>
      <KitFullMap />
    </div>
  );
}
