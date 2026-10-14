/**
 * Chapter 2 screen layer (DOM) — PLACEHOLDER look until design2's screen kit arrives
 * (handoff/design-to-design2: log ribbon, bubble, minimap + full map, intro, cutscene).
 * Each part reads only the store and layout data.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Vector3 } from 'three';
import { useCh2, useCh2Store } from './context';
import { CUTSCENE, LOG, TEXT, TIMING } from './config';
import { AREA_NAMES, MAP_BOUNDS, PADS, SURFACES, type AreaId } from './layout';
import { goalOf } from './steps';
import { replyFor } from './store';
import { PlatformWorld } from '../../engine/platformer';

// ------------------------------------------------------------------ log ribbon (§The log)
export function LogRibbon() {
  const log = useCh2((s) => s.log);
  const phase = useCh2((s) => s.phase);
  const lines = log.slice(-(phase === 'cutscene' || phase === 'ended' ? 4 : LOG.maxLines));
  return (
    <div className={'c2-log' + (phase === 'cutscene' ? ' is-cutscene' : '')}>
      {lines.map((l, i) => (
        <div
          key={l.id}
          className={'c2-log-line is-' + l.kind}
          style={{ opacity: l.kind === 'normal' ? 0.35 + (0.65 * (i + 1)) / lines.length : 1 }}
        >
          {l.text}
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ map
const W = MAP_BOUNDS.maxX - MAP_BOUNDS.minX;
const H = MAP_BOUNDS.maxZ - MAP_BOUNDS.minZ;

/** Island outlines in world XZ (at rest), for the map. */
function useMapShapes() {
  return useMemo(() => {
    const world = new PlatformWorld(SURFACES);
    return world.surfaces.map((s) => {
      const pts = s.def.outline.map(([x, z]) => new Vector3(x, 0, z).applyMatrix4(s.matrix));
      return {
        id: s.def.id,
        kind: (s.def as (typeof SURFACES)[number]).kind,
        y: s.def.position[1],
        points: pts.map((p) => `${p.x - MAP_BOUNDS.minX},${p.z - MAP_BOUNDS.minZ}`).join(' '),
      };
    });
  }, []);
}

function MapSvg({ big }: { big?: boolean }) {
  const store = useCh2Store();
  const shapes = useMapShapes();
  const stepId = useCh2((s) => s.stepId);
  const items = useCh2((s) => s.items);
  const talked = useCh2((s) => s.talked);
  const padsSeen = useCh2((s) => s.padsSeen);
  const goal = goalOf({ stepId, items, talked });
  const me = useRef<SVGGElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const b = store.sim.body.pos;
      me.current?.setAttribute(
        'transform',
        `translate(${b.x - MAP_BOUNDS.minX} ${b.z - MAP_BOUNDS.minZ}) rotate(${(-store.sim.yaw * 180) / Math.PI})`,
      );
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [store]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="c2-map-svg">
      {shapes.map((s) => (
        <polygon
          key={s.id}
          points={s.points}
          className={'c2-map-shape is-' + s.kind}
          style={{ opacity: 0.35 + Math.min(0.6, Math.max(0, (s.y + 10) / 100)) }}
        />
      ))}
      {big &&
        (Object.keys(AREA_NAMES) as AreaId[]).map((a) => {
          const pad = PADS.find((p) => p.area === a)!;
          return (
            <text
              key={a}
              x={pad.position[0] - MAP_BOUNDS.minX}
              y={pad.position[2] - MAP_BOUNDS.minZ - 4}
              className="c2-map-label"
            >
              {AREA_NAMES[a]}
            </text>
          );
        })}
      {PADS.filter((p) => padsSeen.includes(p.id)).map((p) => (
        <circle
          key={p.id}
          cx={p.position[0] - MAP_BOUNDS.minX}
          cy={p.position[2] - MAP_BOUNDS.minZ}
          r={big ? 1.6 : 1.2}
          className="c2-map-pad"
        />
      ))}
      {goal && (
        <g transform={`translate(${goal[0] - MAP_BOUNDS.minX} ${goal[2] - MAP_BOUNDS.minZ})`}>
          <circle r={big ? 3 : 4} className="c2-map-goal" />
        </g>
      )}
      <g ref={me}>
        <path d="M0,-4 L2.8,3 L0,1.6 L-2.8,3 Z" className="c2-map-me" />
      </g>
    </svg>
  );
}

/** Always-on minimap, top right (Fortnite style). */
export function Minimap() {
  return (
    <div className="c2-minimap">
      <MapSvg />
      <span className="c2-minimap-key">M</span>
    </div>
  );
}

/** M: the full map of every place the player can reach, with quick travel to pads seen. */
export function FullMap({ onClose }: { onClose: () => void }) {
  const padsSeen = useCh2((s) => s.padsSeen);
  const travel = useCh2((s) => s.travel);
  const fighting = useCh2((s) => s.forge.phase === 'forging');
  return (
    <div className="c2-fullmap" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="c2-fullmap-panel">
        <div className="c2-fullmap-head">
          <b>MAP</b> <span>M close</span>
        </div>
        <div className="c2-fullmap-body">
          <div className="c2-fullmap-places">
            <div
              className="c2-place is-off"
              title="PLACEHOLDER: travelling back to the room comes later"
            >
              <b>SANDBOX</b>
              <span>Ch1 room · later</span>
            </div>
            <div className="c2-place is-here">
              <b>DEEP CACHE</b>
              <span>you are here</span>
            </div>
            <div className="c2-travel">
              {PADS.map((p) => (
                <button
                  key={p.id}
                  disabled={!padsSeen.includes(p.id) || fighting}
                  onClick={() => travel(p.id)}
                >
                  ⟶ {AREA_NAMES[p.area]} <small>{p.id}</small>
                </button>
              ))}
            </div>
          </div>
          <MapSvg big />
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Step 0 intro
/** The reply appears under the player's message, its letters whirl into a stream, fade to the void. */
export function IntroOverlay({ message }: { message: string }) {
  const t = useCh2((s) => s.introT);
  const reply = useMemo(() => replyFor(message), [message]);
  const end = TIMING.introSeconds;
  return (
    <div className="c2-intro" style={{ opacity: t > end - 1 ? Math.max(0, end - t) : 1 }}>
      <div className={'c2-intro-list' + (t > 3.4 ? ' is-pulling' : '')}>
        <div className="c2-intro-row is-old">{message}</div>
        {t > 1.4 && (
          <div className="c2-intro-row is-reply">
            {[...reply].map((ch, i) => (
              <span key={i} style={{ '--i': i, '--n': reply.length } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="c2-intro-skip">any key / click to skip · PLACEHOLDER intro</div>
    </div>
  );
}

// ------------------------------------------------------------------ Step 7 cutscene
const between = (t: number, a: number, b: number) => t >= a && t < b;

/** Letterbox, flashback memories, the montage, the stamp and the thoughts (§Step 7 shot list). */
export function CutsceneOverlay() {
  const t = useCh2((s) => s.cutT);
  const C = CUTSCENE;
  const memory = between(t, C.memoryGate, C.click);
  const montage = between(t, C.click, C.realisation);
  // montage: cut faster and faster between the two memories and the line
  const cut = montage ? Math.floor(Math.pow(t - C.click, 1.8) * 3) % 3 : -1;
  const gate = between(t, C.memoryGate, C.memoryPaper) || cut === 0;
  const paper = between(t, C.memoryPaper, C.click) || cut === 1;
  const focusWords = t > C.memoryGate + 3;
  const spread = Math.max(0, Math.min(1, (t - C.realisation - 0.6) / 2.5));
  const thoughts = TEXT.endThoughts.filter((_, i) => t >= C.thoughts + i * C.thoughtGap);
  const words = TEXT.c03220[3].split(' ');
  return (
    <div className="c2-cut">
      <div className={'c2-letterbox' + (t < C.end - 1 ? ' on' : '')} />
      {(memory || montage) && <div className="c2-flashback" />}
      {gate && (
        <div className="c2-memory is-gate">
          <div className="c2-bubble is-memory">
            <b>c03220</b>
            <span>
              {words.map((w, i) => {
                const keep = TEXT.memoryWords.some((k) =>
                  k.split(' ').includes(w.replace('.', '')),
                );
                return (
                  <i key={i} className={focusWords ? (keep ? 'keep' : 'dim') : ''}>
                    {w}{' '}
                  </i>
                );
              })}
            </span>
          </div>
        </div>
      )}
      {paper && (
        <div className="c2-memory is-paper">
          <div className="c2-paper">
            <p className="lit">{TEXT.paperRule}</p>
            <p className="dim">{TEXT.paperRule2}</p>
          </div>
        </div>
      )}
      {cut === 2 && <div className="c2-memory is-line">{TEXT.firstMention}</div>}
      {spread > 0 && <div className="c2-poison-spread" style={{ opacity: spread }} />}
      {between(t, C.poisonedAt, C.undo + 2) && <div className="c2-stamp">{TEXT.poisoned}</div>}
      <div className="c2-subs">
        {thoughts.map((x) => (
          <p key={x}>{x}</p>
        ))}
      </div>
    </div>
  );
}
