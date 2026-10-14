/**
 * Level sanity: an autopilot runs and jumps along the golden path, gap by gap, so a layout change
 * can't silently make a jump impossible (or a "dash gap" trivially easy).
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PlatformWorld, createBody, stepBody, type V3 } from '../../engine/platformer';
import { BODY } from './config';
import { SURFACES } from './layout';

interface Hop {
  dash?: boolean;
  glide?: boolean;
  /** World time to start at (moving platforms). */
  t0?: number;
}

/** Run from the centre of `from` towards `to`, jump at the edge; true if we land on `to`. */
function hop(from: string, to: string, o: Hop = {}): boolean {
  const world = new PlatformWorld(SURFACES);
  world.update(o.t0 ?? 0);
  const centre = (id: string) => new Vector3().applyMatrix4(world.byId(id)!.matrix);
  const start = centre(from);
  const b = createBody([start.x, start.y + 0.5, start.z]);
  const dt = 1 / 60;
  let jumped = false;
  let dashed = false;
  for (let t = 0; t < 8; t += dt) {
    world.update(dt, b);
    const goal = centre(to);
    const dir = new Vector3(goal.x - b.pos.x, 0, goal.z - b.pos.z);
    const dist = dir.length();
    dir.normalize();
    // jump when the ground ends just ahead (and we have settled on the start)
    let jump = jumped && !!o.glide;
    if (!jumped && b.ground && t > 0.2) {
      const ahead = b.pos.clone().addScaledVector(dir, BODY.radius + 0.25);
      const below = !world.groundBelow(ahead.x, ahead.z, b.pos.y + BODY.stepUp);
      // or the target is a step up within jumping distance
      const up = goal.y - b.pos.y > BODY.stepUp && dist < 3.2;
      if (below || up) {
        jump = true;
        jumped = true;
      }
    }
    if (jumped && !b.ground) jump = jump || b.vel.y > 0; // full-height jump
    const dash = !!o.dash && jumped && !dashed && !b.ground && b.vel.y < 1;
    if (dash) dashed = true;
    const settled = jumped || (b.ground && t > 0.2);
    const move: [number, number] = settled && dist > 0.3 ? [dir.x, dir.z] : [0, 0];
    const ev = stepBody(b, { move, jump, dash }, world, BODY, dt);
    if (ev.some((e) => e.type === 'fell')) return false;
    if (jumped && b.ground?.def.id === to) return true;
    if (jumped && b.ground && b.ground.def.id !== from && b.ground.def.id !== to) return false;
  }
  return false;
}

/** Walk from `from` to `to` without jumping (connected surfaces). */
function walk(from: string, to: string, via: V3[] = []): boolean {
  const world = new PlatformWorld(SURFACES);
  const s = new Vector3().applyMatrix4(world.byId(from)!.matrix);
  const b = createBody([s.x, s.y + 0.3, s.z]);
  const goals = [
    ...via.map((v) => new Vector3(...v)),
    new Vector3().applyMatrix4(world.byId(to)!.matrix),
  ];
  const dt = 1 / 60;
  for (let t = 0; t < 40 && goals.length; t += dt) {
    world.update(dt, b);
    const g = goals[0];
    const dir = new Vector3(g.x - b.pos.x, 0, g.z - b.pos.z);
    if (dir.length() < 0.6) {
      goals.shift();
      continue;
    }
    dir.normalize();
    const ev = stepBody(b, { move: [dir.x, dir.z], jump: false, dash: false }, world, BODY, dt);
    if (ev.some((e) => e.type === 'fell')) return false;
  }
  return b.ground?.def.id === to;
}

describe('chapter 2 golden path is reachable', () => {
  it('Gate: three jumps, then the dash gap needs a dash (or a glide)', () => {
    expect(hop('gate', 'stone-1'), 'gate → stone-1').toBe(true);
    expect(hop('stone-1', 'stone-2'), 'stone-1 → stone-2').toBe(true);
    expect(hop('stone-2', 'stone-3'), 'stone-2 → stone-3').toBe(true);
    expect(hop('stone-3', 'ob-base'), 'stone-3 → ob-base').toBe(false);
    expect(hop('stone-3', 'ob-base', { dash: true }), 'stone-3 → ob-base, { dash: true }').toBe(
      true,
    );
    expect(hop('stone-3', 'ob-base', { glide: true }), 'stone-3 → ob-base, { glide: true }').toBe(
      true,
    );
  });

  it('Old Board: every drifting slab can be reached at some point of its drift', () => {
    const ids = ['ob-base', ...Array.from({ length: 10 }, (_, i) => `slab-${i}`), 'ob-top'];
    for (let i = 0; i < ids.length - 1; i++) {
      const ok = [0, 1.5, 3, 4.5].some((t0) => hop(ids[i], ids[i + 1], { t0 }));
      expect(ok, `${ids[i]} → ${ids[i + 1]}`).toBe(true);
    }
  });

  it('Task Yard: down the bridge, up the plinth, the ledge chain and back', () => {
    expect(
      walk('ob-base', 'yard', [
        [-45, 33, -6],
        [-24, 8, -37],
      ]),
      'ob-base → yard, [[-45, 33, -6]]',
    ).toBe(true);
    expect(hop('yard', 'yard-plinth'), 'yard → yard-plinth').toBe(true);
    expect(hop('yard', 'yard-step-1'), 'yard → yard-step-1').toBe(true);
    expect(hop('yard-step-1', 'yard-step-2'), 'yard-step-1 → yard-step-2').toBe(true);
    expect(hop('yard-step-2', 'yard-ledge'), 'yard-step-2 → yard-ledge').toBe(true);
    expect(hop('yard-ledge', 'yard-step-2'), 'yard-ledge → yard-step-2').toBe(true);
    expect(hop('yard-step-2', 'yard-step-1'), 'yard-step-2 → yard-step-1').toBe(true);
    expect(hop('yard-step-1', 'yard'), 'yard-step-1 → yard').toBe(true);
    expect(walk('yard', 'ring-0', [[17, 8, -40]]), 'yard → ring-0, [[17, 8, -40]]').toBe(true);
  });

  it('The Flood: around the ring, in to the centre, out to the run', () => {
    for (let k = 0; k < 5; k++) {
      const ok = [0, 2, 4].some((t0) => hop(`ring-${k}`, `ring-${k + 1}`, { t0 }));
      expect(ok, `ring-${k} → ring-${k + 1}`).toBe(true);
    }
    expect(
      [0, 2, 4].some((t0) => hop('ring-3', 'flood-stone', { t0 })),
      'ring-3 → flood-stone',
    ).toBe(true);
    expect(hop('flood-stone', 'flood-core'), 'flood-stone → flood-core').toBe(true);
    expect(
      [0, 2, 4].some((t0) => hop('ring-5', 'run-start', { t0 })),
      'ring-5 → run-start',
    ).toBe(true);
  });

  it('Reset Run: the bridges climb up to the Forge', () => {
    expect(walk('run-start', 'run-c1'), 'run-start → run-c1').toBe(true);
    expect(walk('run-c1', 'run-c2'), 'run-c1 → run-c2').toBe(true);
    expect(walk('run-c2', 'forge'), 'run-c2 → forge').toBe(true);
  });
});
