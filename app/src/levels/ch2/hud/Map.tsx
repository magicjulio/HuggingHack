/**
 * The map (kit `.c2-mini` / `.c2-fullmap`), drawn by the designer's map.js from layout.json.
 * - Minimap, top right, always on: turns with the camera; footer = area name + altimeter (you vs
 *   the Forge, the highest point).
 * - Full map on M: north-up; lit pads (reached) answer a click with quick travel. Closes with M or
 *   a click outside the panel, never Esc (Esc pauses).
 * Per frame it gets the same data as the store: feet, camera yaw, the step's goal, pads, time.
 */
import { useEffect, useRef, useState } from 'react';
import { useCh2, useCh2Store } from '../context';
import { FORGE_CORE, LAYOUT } from '../layout';
import { goalOf } from '../steps';
import type { Ch2Store } from '../store';
import { c2map, type Area, type MapFrame, type MapView } from './kit';

function frameOf(store: Ch2Store): MapFrame {
  const s = store.getState();
  const b = store.sim.body.pos;
  const pads: MapFrame['pads'] = {};
  for (const id of s.padsSeen) pads[id] = 'seen';
  pads[s.lastPad] = 'current';
  return { p: [b.x, b.y, b.z], yaw: store.sim.yaw, goal: goalOf(s), pads, t: s.time };
}

/** Runs `draw` every animation frame while `on`. */
function useMapLoop(on: boolean, draw: () => void) {
  const fn = useRef(draw);
  fn.current = draw;
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      fn.current();
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

/** Altimeter scale: −10 m … the Forge's height. */
const ALT_LOW = -10;

export function Minimap({ poisoned }: { poisoned: boolean }) {
  const store = useCh2Store();
  const canvas = useRef<HTMLCanvasElement>(null);
  const alt = useRef<HTMLSpanElement>(null);
  const altK = useRef<HTMLElement>(null);
  const view = useRef<MapView | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  useEffect(() => {
    view.current = c2map.create(canvas.current!, 'mini').layout(LAYOUT);
  }, []);
  useMapLoop(true, () => {
    const f = frameOf(store);
    view.current?.draw(f);
    const a = c2map.areaAt(LAYOUT, f.p);
    setArea((x) => (x?.id === a.id ? x : a));
    const y = f.p[1];
    if (alt.current) alt.current.textContent = `${y >= 0 ? '+' : ''}${Math.round(y)} m`;
    const k = (y - ALT_LOW) / (FORGE_CORE[1] - ALT_LOW);
    altK.current?.style.setProperty('--k', `${Math.max(0, Math.min(100, k * 100))}%`);
  });
  return (
    <div className={'c2-mini' + (poisoned ? ' is-poisoned' : '')}>
      <canvas ref={canvas} />
      <div className="c2-mini__foot">
        <div className="c2-mini__area" style={{ '--c2-area': area?.c } as React.CSSProperties}>
          {area?.n}
          <small>{area?.s}</small>
        </div>
        <div className="c2-alt">
          <span ref={alt} />
          <div className="c2-alt__bar">
            <b />
            <i ref={altK} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function FullMap() {
  const store = useCh2Store();
  const open = useCh2((s) => s.fullMap);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<MapView | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    view.current = c2map.create(canvas.current!, 'full').layout(LAYOUT);
  }, []);
  useMapLoop(open, () => view.current?.draw(frameOf(store)));
  const padAt = (e: React.PointerEvent) => view.current?.padAt(e.clientX, e.clientY) ?? null;
  return (
    <>
      <div
        className={'c2-fullmap' + (open ? ' is-open' : '')}
        onPointerDown={(e) => e.target === e.currentTarget && store.getState().toggleMap(false)}
      >
        <div className="c2-fullmap__panel">
          <div className="c2-fullmap__head">
            <span className="c2-fullmap__title">THE CACHE</span>
            <span className="c2-fullmap__sub">/zz → forge · seen from above</span>
            <span className="c2-fullmap__keys">
              <span>
                <span className="c1-key">M</span> close
              </span>
              <span>click a lit pad to travel</span>
            </span>
          </div>
          <canvas
            ref={canvas}
            onPointerMove={(e) => {
              const id = padAt(e);
              view.current?.hover(id);
              e.currentTarget.classList.toggle('is-travel', !!id);
            }}
            onPointerDown={(e) => {
              const id = padAt(e);
              if (!id) return;
              const s = store.getState();
              const before = s.lastPad;
              s.travel(id);
              if (store.getState().lastPad !== before || id === before) setFlash(performance.now());
            }}
          />
          <div className="c2-fullmap__legend">
            <span>
              <i className="c2-lg-goal" />
              goal
            </span>
            <span>
              <i className="c2-lg-pad" />
              respawn pad (lit = reached)
            </span>
            <span>
              <i className="c2-lg-laser" />
              reset laser
            </span>
            <span>
              <i className="c2-lg-cloud" />
              traffic cloud
            </span>
            <span>
              <i className="c2-lg-high" />
              brighter = higher
            </span>
          </div>
        </div>
      </div>
      {/* outside the map: travelling closes it */}
      {flash > 0 && <div key={flash} className="c2-travel-flash" />}
    </>
  );
}
