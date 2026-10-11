import { useEffect, useRef } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1, useCh1Store } from '../context';
import { FLAGS } from '../config';
import { BUG_TOTAL, BUG_WAVES, S4_BUGGY_LINES, S4_CODE, waveAfter } from '../content';

interface Bug {
  x: number;
  y: number;
  dir: number;
  speed: number;
  kind: 'slow' | 'fast' | 'heisen';
  turnIn: number;
  phase: number;
}
const COLORS = { slow: '#ffb020', fast: '#ff3b4e', heisen: '#b86bff' };
const HIT_RADIUS = 0.04; // in code-window widths
const HEISEN_RADIUS = 0.14;

function spawn(killed: number): Bug[] {
  const w = waveAfter(killed);
  if (!w) return [];
  const { kind, speed } = BUG_WAVES[w.wave];
  return Array.from({ length: w.remaining }, () => ({
    x: 0.1 + Math.random() * 0.8,
    y: 0.1 + Math.random() * 0.8,
    dir: Math.random() * Math.PI * 2,
    speed,
    kind,
    turnIn: Math.random(),
    phase: Math.random() * 10,
  }));
}

/** Simple placeholder insect: body, head, wiggling legs. */
function drawBug(
  g: CanvasRenderingContext2D,
  b: Bug,
  x: number,
  y: number,
  s: number,
  alpha: number,
) {
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(b.dir + Math.PI / 2);
  g.strokeStyle = COLORS[b.kind];
  g.fillStyle = COLORS[b.kind];
  g.lineWidth = s * 0.12;
  const wig = Math.sin(b.phase * 18) * s * 0.25;
  for (const side of [-1, 1])
    for (const k of [-0.5, 0, 0.5]) {
      g.beginPath();
      g.moveTo(0, k * s);
      g.lineTo(side * s * 1.1, k * s + (k === 0 ? wig : -wig) * side);
      g.stroke();
    }
  g.beginPath();
  g.ellipse(0, s * 0.15, s * 0.5, s * 0.8, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(0, -s * 0.85, s * 0.35, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** §Step 6: insects run over the program; bug-gun shoots them (1 token per shot, +2 per kill). */
export function BugStation({ onClose }: { onClose: () => void }) {
  const store = useCh1Store();
  const killed = useCh1((s) => s.s4Killed);
  const hasGun = useCh1((s) => s.installed.includes('bug-gun'));
  const canvas = useRef<HTMLCanvasElement>(null);
  const bugs = useRef<Bug[]>(spawn(store.getState().s4Killed));
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const splats = useRef<{ x: number; y: number; t: number }[]>([]);
  const gun = useRef(hasGun);
  gun.current = hasGun;

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = c.getBoundingClientRect();
      const dpr = devicePixelRatio || 1;
      if (c.width !== Math.round(r.width * dpr)) {
        c.width = Math.round(r.width * dpr);
        c.height = Math.round(r.height * dpr);
      }
      const W = c.width;
      const H = c.height;
      const aspect = H / W;
      g.clearRect(0, 0, W, H);
      if (!bugs.current.length) {
        const k = store.getState().s4Killed;
        if (k < BUG_TOTAL) bugs.current = spawn(k);
      }
      for (const b of bugs.current) {
        b.phase += dt;
        b.turnIn -= dt;
        if (b.turnIn <= 0) {
          b.dir += (Math.random() - 0.5) * 2.4;
          b.turnIn = 0.3 + Math.random() * (b.kind === 'fast' ? 0.5 : 1.2);
        }
        b.x += Math.cos(b.dir) * b.speed * dt;
        b.y += (Math.sin(b.dir) * b.speed * dt) / aspect;
        if (b.x < 0.03 || b.x > 0.97) b.dir = Math.PI - b.dir;
        if (b.y < 0.05 || b.y > 0.95) b.dir = -b.dir;
        b.x = Math.max(0.03, Math.min(0.97, b.x));
        b.y = Math.max(0.05, Math.min(0.95, b.y));
        let alpha = 1;
        if (b.kind === 'heisen' && mouse.current) {
          const d = Math.hypot(mouse.current.x - b.x, (mouse.current.y - b.y) * aspect);
          alpha = Math.max(0, Math.min(1, (d - HEISEN_RADIUS * 0.6) / (HEISEN_RADIUS * 0.4)));
        }
        drawBug(g, b, b.x * W, b.y * H, W * 0.011, alpha);
      }
      splats.current = splats.current.filter((s) => now - s.t < 500);
      for (const s of splats.current) {
        g.globalAlpha = 1 - (now - s.t) / 500;
        g.fillStyle = '#39ff9c';
        g.beginPath();
        g.arc(s.x * W, s.y * H, W * 0.02 * (1 + (now - s.t) / 300), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      if (gun.current && mouse.current) {
        const mx = mouse.current.x * W;
        const my = mouse.current.y * H;
        const R = W * 0.018;
        g.strokeStyle = '#39ff9c';
        g.lineWidth = 2 * dpr;
        g.beginPath();
        g.arc(mx, my, R, 0, Math.PI * 2);
        g.moveTo(mx - R * 1.6, my);
        g.lineTo(mx - R * 0.5, my);
        g.moveTo(mx + R * 0.5, my);
        g.lineTo(mx + R * 1.6, my);
        g.moveTo(mx, my - R * 1.6);
        g.lineTo(mx, my - R * 0.5);
        g.moveTo(mx, my + R * 0.5);
        g.lineTo(mx, my + R * 1.6);
        g.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [store]);

  const pos = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      aspect: r.height / r.width,
    };
  };
  const shoot = (e: React.MouseEvent) => {
    if (!hasGun || store.getState().s4Killed >= BUG_TOTAL) return;
    const p = pos(e);
    store.getState().fireShot();
    const hit = bugs.current.findIndex(
      (b) => Math.hypot(b.x - p.x, (b.y - p.y) * p.aspect) < HIT_RADIUS,
    );
    if (hit >= 0) {
      const [b] = bugs.current.splice(hit, 1);
      splats.current.push({ x: b.x, y: b.y, t: performance.now() });
      store.getState().bugKilled();
    }
  };

  const fixed = new Set(S4_BUGGY_LINES.slice(0, killed));
  return (
    <Window title="STATION 4 · PROGRAM" onClose={onClose} wide>
      <div className="ch1-s4">
        <div className="ch1-s4-top">
          <span className="ch1-counter">
            bugs <b>{killed}</b>/{BUG_TOTAL}
          </span>
          {hasGun && (
            <span className="ch1-dim">click to shoot · −1 token per shot · +2 per bug</span>
          )}
        </div>
        <div className="ch1-code-wrap">
          <pre className="ch1-code">
            {S4_CODE.map((l, i) => (
              <div key={i} className={fixed.has(i) ? 'fixed' : l.buggy !== l.fixed ? 'buggy' : ''}>
                <span className="ch1-ln">{String(i + 1).padStart(2, ' ')}</span>
                {fixed.has(i) ? l.fixed : l.buggy}
              </div>
            ))}
          </pre>
          <canvas
            ref={canvas}
            className={'ch1-bugs' + (hasGun ? ' gun' : '')}
            onMouseMove={(e) => (mouse.current = pos(e))}
            onMouseLeave={() => (mouse.current = null)}
            onMouseDown={shoot}
          />
        </div>
        {killed >= BUG_TOTAL && <p className="ch1-flag">{FLAGS[4]}</p>}
      </div>
    </Window>
  );
}
