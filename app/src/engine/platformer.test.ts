import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BODY,
  PlatformWorld,
  createBody,
  inPolygon,
  rect,
  stepBody,
  type Body,
  type BodyEvent,
  type BodyInput,
  type SurfaceDef,
} from './platformer';

const P = DEFAULT_BODY;
const idle: BodyInput = { move: [0, 0], jump: false, dash: false };

function run(
  world: PlatformWorld,
  b: Body,
  seconds: number,
  input: BodyInput | ((t: number) => BodyInput) = idle,
) {
  const dt = 1 / 60;
  const events: BodyEvent[] = [];
  for (let t = 0; t < seconds; t += dt) {
    world.update(dt, b);
    events.push(...stepBody(b, typeof input === 'function' ? input(t) : input, world, P, dt));
  }
  return events;
}

const floor = (extra: Partial<SurfaceDef> = {}): SurfaceDef => ({
  id: 'floor',
  outline: rect(10, 10),
  depth: 2,
  position: [0, 0, 0],
  ...extra,
});

describe('platformer', () => {
  it('point in polygon', () => {
    expect(inPolygon(0, 0, rect(2, 2))).toBe(true);
    expect(inPolygon(1.5, 0, rect(2, 2))).toBe(false);
  });

  it('falls onto a surface and stands on it', () => {
    const w = new PlatformWorld([floor()]);
    const b = createBody([0, 3, 0]);
    const ev = run(w, b, 2);
    expect(b.ground?.def.id).toBe('floor');
    expect(b.pos.y).toBeCloseTo(0, 5);
    expect(ev.filter((e) => e.type === 'land')).toHaveLength(1);
  });

  it('jumps about 2 m high and lands again (floaty)', () => {
    const w = new PlatformWorld([floor()]);
    const b = createBody([0, 0.01, 0]);
    run(w, b, 0.2);
    let top = 0;
    let airborne = 0;
    run(w, b, 2.5, (t) => {
      top = Math.max(top, b.pos.y);
      if (!b.ground) airborne += 1 / 60;
      return { ...idle, jump: t < 0.6 };
    });
    expect(top).toBeGreaterThan(1.7);
    expect(top).toBeLessThan(2.4);
    expect(airborne).toBeGreaterThan(0.9);
    expect(b.ground).not.toBeNull();
  });

  it('gliding falls much slower than dropping', () => {
    const fallTime = (glide: boolean) => {
      const w = new PlatformWorld([floor()]);
      const b = createBody([0, 10, 0]);
      let t = 0;
      while (!b.ground && t < 20) {
        w.update(1 / 60, b);
        stepBody(b, { ...idle, jump: glide }, w, P, 1 / 60);
        t += 1 / 60;
      }
      return t;
    };
    expect(fallTime(true)).toBeGreaterThan(fallTime(false) * 3);
  });

  it('dash covers ground fast, once per jump in the air', () => {
    const w = new PlatformWorld([floor({ outline: rect(100, 10) })]);
    const b = createBody([0, 0, 0]);
    run(w, b, 0.1);
    const x0 = b.pos.x;
    const ev = run(w, b, 0.3, (t) => ({ move: [1, 0], jump: false, dash: t < 0.02 }));
    expect(ev.some((e) => e.type === 'dash')).toBe(true);
    expect(b.pos.x - x0).toBeGreaterThan(3);
    // in the air: first dash works, second doesn't until landing
    const air = createBody([0, 30, 0]);
    const w2 = new PlatformWorld([]);
    const e1 = run(w2, air, 0.05, { move: [1, 0], jump: false, dash: true });
    const e2 = run(w2, air, 1, (t) => ({ move: [1, 0], jump: false, dash: t > 0.8 }));
    expect(e1.filter((e) => e.type === 'dash')).toHaveLength(1);
    expect(e2.filter((e) => e.type === 'dash')).toHaveLength(0);
  });

  it('walks off an edge and falls into the void', () => {
    const w = new PlatformWorld([floor({ outline: rect(4, 4) })]);
    const b = createBody([0, 0, 0]);
    const ev = run(w, b, 8, { move: [1, 0], jump: false, dash: false });
    expect(ev.some((e) => e.type === 'fell')).toBe(true);
  });

  it('walks up a ramp onto a higher island and is pushed out of a slab side', () => {
    const ramp: SurfaceDef = {
      id: 'ramp',
      outline: rect(3, 10),
      depth: 0.3,
      position: [0, 1.5, -6],
      pitch: Math.atan2(3, 10), // rises 3 m over 10 m towards -z
    };
    const top: SurfaceDef = { id: 'top', outline: rect(6, 6), depth: 4, position: [0, 3, -14] };
    const w = new PlatformWorld([floor(), ramp, top]);
    const b = createBody([0, 0, 0]);
    run(w, b, 2, { move: [0, -1], jump: false, dash: false });
    expect(b.ground?.def.id).toBe('top');
    expect(b.pos.y).toBeCloseTo(3, 1);

    // a wall: the slab side of a high island stops the body
    const wall: SurfaceDef = { id: 'wall', outline: rect(10, 2), depth: 6, position: [0, 4, -4] };
    const w2 = new PlatformWorld([floor(), wall]);
    const b2 = createBody([0, 0, 0]);
    run(w2, b2, 2, { move: [0, -1], jump: false, dash: false });
    expect(b2.pos.z).toBeGreaterThan(-3 + P.radius - 0.05);
    expect(b2.ground?.def.id).toBe('floor');
  });

  it('rides along on a moving platform', () => {
    const mover: SurfaceDef = {
      id: 'mover',
      outline: rect(3, 3),
      depth: 0.5,
      position: [0, 0, 0],
      motion: (t) => ({ offset: [t, 0, 0] }),
    };
    const w = new PlatformWorld([mover]);
    const b = createBody([0, 0.5, 0]);
    run(w, b, 1);
    expect(b.ground?.def.id).toBe('mover');
    const x0 = b.pos.x;
    run(w, b, 1);
    expect(b.pos.x - x0).toBeCloseTo(1, 1);
  });

  it('a tilting platform leans under the body and lets it slide', () => {
    const tilter: SurfaceDef = {
      id: 'tilt',
      outline: rect(6, 6),
      depth: 0.5,
      position: [0, 0, 0],
      tilt: { max: 0.35, speed: 3 },
    };
    const w = new PlatformWorld([tilter]);
    const b = createBody([2.2, 0.5, 0]);
    const s = w.byId('tilt')!;
    let lean = 0;
    const x0 = 2.2;
    const ev = run(w, b, 6, () => {
      lean = Math.max(lean, Math.abs(s.tiltZ));
      return idle;
    });
    expect(lean).toBeGreaterThan(0.1);
    // standing off-centre, it slides outwards (and off)
    expect(ev.some((e) => e.type === 'fell') || b.pos.x > x0 + 0.3).toBe(true);
  });
});
