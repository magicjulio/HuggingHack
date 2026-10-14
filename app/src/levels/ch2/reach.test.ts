/**
 * Level sanity on the designer's layout.json: an autopilot runs and jumps along the golden path,
 * gap by gap, so a layout or physics change can't silently make a jump impossible (or the dash gap
 * trivially easy). Gate → tutorial stones → dash gap → Old Board slabs → slide to the Task Yard →
 * plinth, ledge chain, lift → Flood ring, tilting steps, centre → Reset Run → Forge.
 */
import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { PlatformWorld, createBody, stepBody, type V3 } from '../../engine/platformer';
import { BODY } from './config';
import { BRIDGES, SURFACES, padOf, type Island } from './layout';

const group = (w: PlatformWorld, id: string) => (w.byId(id)?.def as Island | undefined)?.group;
const centre = (w: PlatformWorld, id: string) => new Vector3().applyMatrix4(w.byId(id)!.matrix);
/** The piece of a bridge nearest to a point (bridges are many short surfaces). */
function pieceNear(bridge: string, p: Vector3) {
  const w = new PlatformWorld(SURFACES);
  let best = '';
  let bd = Infinity;
  for (const s of w.surfaces) {
    if ((s.def as Island).group !== bridge || !s.def.id.includes('#')) continue;
    const d = centre(w, s.def.id).distanceTo(p);
    if (d < bd) {
      bd = d;
      best = s.def.id;
    }
  }
  return best;
}
const bridgeEnd = (id: string, end: 'first' | 'last') => {
  const b = BRIDGES.find((x) => x.id === id)!;
  return pieceNear(id, new Vector3(...(end === 'first' ? b.samples[0] : b.samples.at(-1)!)));
};

interface Hop {
  dash?: boolean;
  glide?: boolean;
  /** World time to start at (moving platforms). */
  t0?: number;
  /** Start here instead of the centre of `from`. */
  start?: V3;
}

/** Run from the centre of surface `from` towards surface `to`, jump at the edge; true on landing. */
function hop(from: string, to: string, o: Hop = {}): boolean {
  const world = new PlatformWorld(SURFACES);
  world.update(o.t0 ?? 0);
  const start = o.start ? new Vector3(...o.start) : centre(world, from);
  const b = createBody([start.x, start.y + 0.3, start.z]);
  const dt = 1 / 60;
  let jumped = false;
  let dashed = false;
  const prev = b.pos.clone();
  const fromG = group(world, from);
  const toG = group(world, to);
  for (let t = 0; t < 10; t += dt) {
    world.update(dt, b);
    const goal = centre(world, to);
    const dir = new Vector3(goal.x - b.pos.x, 0, goal.z - b.pos.z);
    const dist = dir.length();
    dir.normalize();
    let jump = jumped && !!o.glide;
    if (!jumped && b.ground && t > 0.3) {
      // jump when the ground ends just ahead, or the target is a step up within reach
      const ahead = b.pos.clone().addScaledVector(dir, BODY.radius + 0.25);
      const below = world.groundBelow(ahead.x, ahead.z, b.pos.y + BODY.stepUp);
      const edge = !below || group(world, below.s.def.id) !== fromG;
      const up = goal.y - b.pos.y > BODY.stepUp && dist < 3.5;
      // walking into a step too high to step up (e.g. the forge dais): hop
      const blocked = t > 0.6 && Math.hypot(b.vel.x, b.vel.z) > 3 && b.pos.distanceTo(prev) < 0.01;
      if (edge || up || blocked) {
        jump = true;
        jumped = true;
      }
    }
    prev.copy(b.pos);
    if (jumped && !b.ground) jump = jump || b.vel.y > 0; // full-height jump
    const dash = !!o.dash && jumped && !dashed && !b.ground && b.vel.y < 1;
    if (dash) dashed = true;
    const settled = jumped || (b.ground && t > 0.3);
    const move: [number, number] = settled && dist > 0.3 ? [dir.x, dir.z] : [0, 0];
    const ev = stepBody(b, { move, jump, dash }, world, BODY, dt);
    if (ev.some((e) => e.type === 'fell')) return false;
    const g = b.ground && group(world, b.ground.def.id);
    if (jumped && g === toG) return true;
    if (jumped && g && g !== fromG && g !== toG) return false;
  }
  return false;
}

/** Can it be done at all: plain, gliding or with a dash, at a few platform times. */
const reachable = (from: string, to: string, times = [0], start?: V3) =>
  times.some((t0) =>
    [{}, { glide: true }, { dash: true }].some((o) => hop(from, to, { ...o, t0, start })),
  );

/**
 * Walk from `from` to `to` without jumping, through `via` points (connected surfaces), ending at
 * `end` (default: the centre of `to`).
 */
function walk(from: string, to: string, via: V3[] = [], end?: V3): boolean {
  const world = new PlatformWorld(SURFACES);
  const s = centre(world, from);
  const b = createBody([s.x, s.y + 0.3, s.z]);
  const goals = [
    ...via.map((v) => new Vector3(...v)),
    end ? new Vector3(...end) : centre(world, to),
  ];
  const dt = 1 / 60;
  for (let t = 0; t < 60 && goals.length; t += dt) {
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
  return !!b.ground && group(world, b.ground.def.id) === group(world, to);
}
/** Walk a whole bridge, from the island before it to the island after it. */
const walkBridge = (from: string, bridge: string, to: string, end?: V3) =>
  walk(from, to, BRIDGES.find((b) => b.id === bridge)!.samples, end);

describe('chapter 2 golden path is reachable (layout.json)', () => {
  it('Gate: three tutorial jumps, the tutorial bridge, then the dash gap needs a dash', () => {
    expect(hop('gate', 'tut-1'), 'gate → tut-1').toBe(true);
    expect(hop('tut-1', 'tut-2'), 'tut-1 → tut-2').toBe(true);
    expect(hop('tut-2', 'tut-3'), 'tut-2 → tut-3').toBe(true);
    const end = bridgeEnd('tutorial', 'last');
    expect(walk('tut-3', end), 'tut-3 → tutorial bridge end').toBe(true);
    expect(hop(end, 'ob-slab-0'), 'dash gap, plain jump').toBe(false);
    expect(hop(end, 'ob-slab-0', { glide: true }), 'dash gap, glide').toBe(false);
    expect(hop(end, 'ob-slab-0', { dash: true }), 'dash gap, dash').toBe(true);
  });

  it('Old Board: every drifting slab up to the top, at some point of its drift', () => {
    const ids = ['ob-slab-0', 'ob-slab-1', 'ob-slab-2', 'ob-slab-3', 'ob-slab-4', 'ob-slab-5'];
    for (let i = 0; i < ids.length - 1; i++)
      expect(reachable(ids[i], ids[i + 1], [0, 1.5, 3, 4.5]), `${ids[i]} → ${ids[i + 1]}`).toBe(
        true,
      );
    expect(reachable('ob-slab-5', 'ob-top', [0, 1.5, 3, 4.5]), 'ob-slab-5 → ob-top').toBe(true);
  });

  it('Task Yard: slide down, the plinth, the ledge chain, the lift back up', () => {
    // the slide ends 1 m inside the Yard's collider (designer fix 2026-10-14): walk straight on
    expect(walkBridge('ob-top', 'oldboard-yard', 'taskyard'), 'ob-top → taskyard').toBe(true);
    expect(hop('taskyard', 'piece-7731-plinth'), 'taskyard → plinth').toBe(true);
    expect(reachable('taskyard', 'yard-step-1'), 'taskyard → yard-step-1').toBe(true);
    expect(reachable('yard-step-1', 'yard-step-2'), 'yard-step-1 → yard-step-2').toBe(true);
    expect(reachable('yard-step-2', 'yard-ledge'), 'yard-step-2 → yard-ledge').toBe(true);
    expect(reachable('yard-ledge', 'yard-lift', [0, 1, 7]), 'yard-ledge → lift (down)').toBe(true);
    // the lift at the top (k = 1 at period / 2): off onto the Yard → Flood bridge beside it
    const lift = new PlatformWorld(SURFACES);
    lift.update(4);
    const off = pieceNear('yard-flood', centre(lift, 'yard-lift'));
    expect(reachable('yard-lift', off, [3.6, 4]), 'lift (top) → yard-flood bridge').toBe(true);
  });

  it('The Flood: over the bridge, the tilting steps to the centre, round the ring to the run', () => {
    expect(walkBridge('taskyard', 'yard-flood', 'flood-ring-4'), 'taskyard → flood-ring-4').toBe(
      true,
    );
    expect(reachable('flood-ring-4', 'flood-step-1'), 'ring-4 → step-1').toBe(true);
    expect(reachable('flood-step-1', 'flood-step-2'), 'step-1 → step-2').toBe(true);
    expect(reachable('flood-step-2', 'flood-centre'), 'step-2 → centre').toBe(true);
    for (const [a, b] of [
      [4, 3],
      [3, 2],
      [2, 1],
    ])
      expect(reachable(`flood-ring-${a}`, `flood-ring-${b}`), `ring-${a} → ring-${b}`).toBe(true);
    expect(reachable('flood-ring-1', 'run-start'), 'ring-1 → run-start').toBe(true);
  });

  it('Reset Run: the bridge climbs to the Forge, then up the dais', () => {
    const pad = padOf('forge').position;
    expect(walkBridge('run-start', 'reset-run', 'forge', pad), 'run-start → forge pad').toBe(true);
    // both dais tiers are within stepUp (designer fix 2026-10-14): walk up from the east,
    // between two slot pylons (the straight line from the pad hits a pylon)
    expect(
      walk('forge', 'forge-dais-1', [pad, [pad[0], pad[1], 0]]),
      'forge → dais (walking)',
    ).toBe(true);
  });
});
