import { useRef, useState, type PointerEvent } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1 } from '../context';
import { FLAGS } from '../config';
import { SOCKETS, WIRES } from '../content';

const W = 600;
const H = 340;
const LEFT_X = 90;
const RIGHT_X = 510;
const rowY = (i: number) => 60 + i * 72;

/** §Step 5: drag each coloured wire (port) to its service socket. Wrong = spring back + spark. */
export function WireStation({ onClose }: { onClose: () => void }) {
  const connected = useCh1((s) => s.s3Connected);
  const connectWire = useCh1((s) => s.connectWire);
  const hasLegend = useCh1((s) => s.installed.includes('port-map'));
  const pulse = useCh1((s) => s.effects.includes('pulse-legend'));
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ port: number; x: number; y: number } | null>(null);
  const [spark, setSpark] = useState<{ i: number; n: number } | null>(null);
  const done = connected.length === WIRES.length;

  const toSvg = (e: PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const onUp = (e: PointerEvent) => {
    if (!drag) return;
    const p = toSvg(e);
    const i = SOCKETS.findIndex((_, k) => Math.hypot(p.x - RIGHT_X, p.y - rowY(k)) < 34);
    if (i >= 0 && !connectWire(drag.port, SOCKETS[i])) setSpark({ i, n: Date.now() });
    setDrag(null);
  };

  return (
    <Window title="STATION 3 · WIRE PANEL" onClose={onClose}>
      <div className="ch1-s3">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="ch1-wires"
          onPointerMove={(e) => drag && setDrag({ ...drag, ...toSvg(e) })}
          onPointerUp={onUp}
          onPointerLeave={() => setDrag(null)}
        >
          {SOCKETS.map((name, i) => (
            <g key={name}>
              <circle cx={RIGHT_X} cy={rowY(i)} r={16} className="ch1-socket" />
              <text x={RIGHT_X - 28} y={rowY(i) + 5} textAnchor="end" className="ch1-wire-label">
                {name}
              </text>
              {spark?.i === i && (
                <circle key={spark.n} cx={RIGHT_X} cy={rowY(i)} r={22} className="ch1-spark" />
              )}
            </g>
          ))}
          {WIRES.map((w, i) => {
            const isOn = connected.includes(w.port);
            const target = isOn ? rowY(SOCKETS.indexOf(w.service)) : null;
            const end =
              drag?.port === w.port
                ? drag
                : target !== null
                  ? { x: RIGHT_X, y: target }
                  : { x: LEFT_X + 40, y: rowY(i) };
            return (
              <g key={w.port}>
                <text x={LEFT_X - 26} y={rowY(i) + 5} textAnchor="end" className="ch1-wire-label">
                  {w.port}
                </text>
                <circle cx={LEFT_X} cy={rowY(i)} r={10} fill={w.color} />
                <path
                  d={`M ${LEFT_X} ${rowY(i)} C ${LEFT_X + 140} ${rowY(i)}, ${end.x - 140} ${end.y}, ${end.x} ${end.y}`}
                  stroke={w.color}
                  strokeWidth={7}
                  fill="none"
                  strokeLinecap="round"
                  className={drag?.port === w.port ? '' : 'ch1-wire-rest'}
                />
                <circle
                  cx={end.x}
                  cy={end.y}
                  r={11}
                  fill={w.color}
                  className={isOn || done ? '' : 'ch1-wire-end'}
                  onPointerDown={(e) => {
                    if (isOn || done) return;
                    (e.target as Element).releasePointerCapture?.(e.pointerId);
                    setDrag({ port: w.port, ...toSvg(e) });
                  }}
                />
              </g>
            );
          })}
        </svg>
        {hasLegend && (
          <div className={'ch1-legend' + (pulse ? ' pulse' : '')}>
            <b>port-map</b>
            {WIRES.map((w) => (
              <div key={w.port}>
                {w.port} → {w.service}
              </div>
            ))}
          </div>
        )}
        {done && <p className="ch1-flag">{FLAGS[3]}</p>}
      </div>
    </Window>
  );
}
