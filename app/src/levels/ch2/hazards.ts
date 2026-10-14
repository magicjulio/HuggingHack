/**
 * Chapter 2 hazards as plain functions of time and positions (headless, testable):
 * traffic clouds, reset waves, flood bits and their garbage spit. Views read the same functions,
 * so what you see is what hits you.
 */
import { Vector3 } from 'three';
import type { V3 } from '../../engine/platformer';
import type { Cloud, WaveLane } from './layout';
import { WAVE_CHARGE, inCloud, waveHit, waveLine } from './world/motion.js';

// Clouds and lasers: thin typed wrappers over the designer's motion.js (layout notes.clouds,
// notes.waves), the same functions the world modules draw with.

/** Is `p` (the orb centre) inside any of the clouds at time t? */
export const inAnyCloud = (p: Vector3, clouds: Cloud[], t: number): boolean =>
  clouds.some((c) => inCloud(c, [p.x, p.y, p.z], t));

/** Seconds of rest before a pass in which the emitter charges and the next line is marked. */
export const WAVE_TELEGRAPH: number = WAVE_CHARGE;

export interface WaveState {
  /** The line is sweeping (and hits). */
  on: boolean;
  /** Where the line is along `dir`, metres from the station. */
  along: number;
  /** Seconds left in this period. */
  until: number;
  /** World point of the line's centre. */
  centre: V3;
  /** Telegraph 0..1 over the last `WAVE_TELEGRAPH` s of the rest (1 while on). */
  charge: number;
}
export const waveState = (w: WaveLane, t: number): WaveState =>
  waveLine(w, t) as unknown as WaveState;

/** Does lane `w`'s line touch a body standing at `p` (feet) at time t? Dashing: the caller skips. */
export const waveHits = (w: WaveLane, t: number, p: Vector3): boolean =>
  waveHit(w, [p.x, p.y, p.z], t);

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
