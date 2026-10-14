/**
 * Chapter 2 hazards as plain functions of time and positions (headless, testable):
 * traffic clouds, reset waves, flood bits and their garbage spit. Views read the same functions,
 * so what you see is what hits you.
 */
import { Vector3 } from 'three';
import type { V3 } from '../../engine/platformer';
import type { CloudPath, WaveLane } from './layout';

// ---------------------------------------------------------------- clouds
export function cloudPos(c: CloudPath, t: number): V3 {
  const a = c.phase + c.speed * t;
  return [c.centre[0] + Math.cos(a) * c.r, c.centre[1] + 1.2, c.centre[2] + Math.sin(a) * c.r];
}

export function inAnyCloud(p: Vector3, clouds: CloudPath[], t: number): boolean {
  return clouds.some((c) => {
    const q = cloudPos(c, t);
    return Math.hypot(p.x - q[0], (p.y - q[1]) * 1.6, p.z - q[2]) < c.radius;
  });
}

// ---------------------------------------------------------------- reset waves
/** Where the wall of a lane is at time t, or null between waves. */
export function wavePos(l: WaveLane, t: number): { p: V3; k: number } | null {
  const c = (((t + l.phase) % l.period) + l.period) % l.period;
  if (c > l.travel) return null;
  const k = c / l.travel;
  return {
    p: [
      l.from[0] + (l.to[0] - l.from[0]) * k,
      l.from[1] + (l.to[1] - l.from[1]) * k,
      l.from[2] + (l.to[2] - l.from[2]) * k,
    ],
    k,
  };
}

/** Seconds until the next wave of this lane starts (for telegraphs). */
export function waveNext(l: WaveLane, t: number): number {
  const c = (((t + l.phase) % l.period) + l.period) % l.period;
  return c <= l.travel ? 0 : l.period - c;
}

const WALL_HALF = 0.45;

/** Does the wall of lane `l` touch a body at `p` (feet) at time t? */
export function waveHits(l: WaveLane, t: number, p: Vector3, bodyHeight = 0.9): boolean {
  const w = wavePos(l, t);
  if (!w) return false;
  const ax = l.to[0] - l.from[0];
  const az = l.to[2] - l.from[2];
  const len = Math.hypot(ax, az) || 1;
  const ux = ax / len;
  const uz = az / len;
  const dx = p.x - w.p[0];
  const dz = p.z - w.p[2];
  const along = dx * ux + dz * uz;
  const across = -dx * uz + dz * ux;
  if (Math.abs(along) > WALL_HALF || Math.abs(across) > l.width / 2) return false;
  const dy = p.y - w.p[1];
  return dy > -bodyHeight && dy < l.height;
}

// ---------------------------------------------------------------- flood bits
export type BitState = 'idle' | 'chase' | 'muted' | 'gone';
export interface Bit {
  id: number;
  pos: Vector3;
  home: Vector3;
  state: BitState;
  /** Who it goes for: the player (hover and spit) or the forge (fly in and hit it). */
  goal: 'player' | 'forge';
  /** Seconds until the next spit. */
  cool: number;
  /** Seconds in the current state. */
  t: number;
  /** Forge-fight bits give up after this long (seconds of chasing) and drift off; null = never. */
  life: number | null;
}
export interface Spit {
  pos: Vector3;
  vel: Vector3;
  life: number;
}

export const BITS = {
  wakeRadius: 16,
  keepDistance: 6,
  speed: 4.2,
  forgeSpeed: 3.4,
  spitEvery: 2.4,
  spitSpeed: 9,
  spitLife: 3,
  hitRadius: 0.8,
  forgeHitRadius: 2.2,
  mutedSeconds: 4,
  /** Forge-fight bits that go for the player give up after this many seconds. */
  fightLife: 12,
  /** How close to a shot's line a bit still counts as hit (generous; third-person aim). */
  aimRadius: 1.1,
  shotRange: 45,
};

let bitIds = 0;
export function makeBit(
  home: V3,
  goal: Bit['goal'] = 'player',
  awake = false,
  life: number | null = null,
): Bit {
  return {
    id: ++bitIds,
    pos: new Vector3(...home),
    home: new Vector3(...home),
    state: awake ? 'chase' : 'idle',
    goal,
    cool: BITS.spitEvery * 0.6,
    t: 0,
    life,
  };
}

const tmp = new Vector3();

/**
 * Move bits and spit; returns hits on the player and on the forge this step.
 * `player` is the orb centre; `forge` the forge's centre (or null when there is none).
 */
export function updateBits(
  bits: Bit[],
  spits: Spit[],
  player: Vector3,
  forge: Vector3 | null,
  dt: number,
): { playerHits: number; forgeHits: number } {
  let playerHits = 0;
  let forgeHits = 0;
  for (const b of bits) {
    b.t += dt;
    if (b.state === 'gone') continue;
    if (b.state === 'muted') {
      // grey, drifts off and down
      b.pos.y -= dt * 1.2;
      b.pos.x += (b.pos.x - b.home.x >= 0 ? 1 : -1) * dt * 0.6;
      if (b.t > BITS.mutedSeconds) b.state = 'gone';
      continue;
    }
    if (b.state === 'idle') {
      b.pos.set(b.home.x, b.home.y + Math.sin(b.t * 2 + b.id) * 0.4, b.home.z);
      if (b.pos.distanceTo(player) < BITS.wakeRadius) {
        b.state = 'chase';
        b.t = 0;
      }
      continue;
    }
    // chase
    if (b.life !== null && b.t > b.life) {
      b.state = 'muted';
      b.t = 0;
      continue;
    }
    if (b.goal === 'forge' && forge) {
      tmp.copy(forge).sub(b.pos);
      const d = tmp.length();
      if (d < BITS.forgeHitRadius) {
        forgeHits++;
        b.state = 'gone';
        continue;
      }
      b.pos.addScaledVector(tmp.normalize(), Math.min(d, BITS.forgeSpeed * dt));
      continue;
    }
    // hover at a distance around the player, jittery, and spit garbage
    tmp.copy(b.pos).sub(player);
    tmp.y = 0;
    if (tmp.lengthSq() < 1e-4) tmp.set(1, 0, 0);
    tmp.normalize().multiplyScalar(BITS.keepDistance);
    tmp.add(player);
    tmp.y = player.y + 1.6 + Math.sin(b.t * 5 + b.id) * 0.3;
    tmp.x += Math.sin(b.t * 9 + b.id * 3) * 0.15;
    tmp.sub(b.pos);
    const d = tmp.length();
    b.pos.addScaledVector(tmp.normalize(), Math.min(d, BITS.speed * dt));
    b.cool -= dt;
    if (b.cool <= 0) {
      b.cool = BITS.spitEvery;
      const vel = player.clone().sub(b.pos).normalize().multiplyScalar(BITS.spitSpeed);
      spits.push({ pos: b.pos.clone(), vel, life: BITS.spitLife });
    }
  }
  for (let i = spits.length - 1; i >= 0; i--) {
    const s = spits[i];
    s.pos.addScaledVector(s.vel, dt);
    s.life -= dt;
    if (s.pos.distanceTo(player) < BITS.hitRadius) {
      playerHits++;
      spits.splice(i, 1);
    } else if (s.life <= 0) spits.splice(i, 1);
  }
  return { playerHits, forgeHits };
}

/** The live bit a shot along `dir` from `origin` hits first, if any. */
export function shotTarget(bits: Bit[], origin: Vector3, dir: Vector3): Bit | null {
  let best: Bit | null = null;
  let bestT = Infinity;
  for (const b of bits) {
    if (b.state !== 'chase' && b.state !== 'idle') continue;
    tmp.copy(b.pos).sub(origin);
    const t = tmp.dot(dir);
    if (t < 0 || t > BITS.shotRange) continue;
    const off = tmp.addScaledVector(dir, -t).length();
    if (off < BITS.aimRadius && t < bestT) {
      best = b;
      bestT = t;
    }
  }
  return best;
}
