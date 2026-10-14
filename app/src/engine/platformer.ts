/**
 * Third-person platforming physics: a kinematic body (the orb) on floating surfaces.
 * Generic and headless (no React), so chapters can be played through in unit tests.
 *
 * A surface is a flat outline (local XZ polygon, walkable top at local y = 0) with a world
 * transform. It may move (`motion`) or tilt under the player (`tilt`). Bodies land on tops,
 * get pushed out of the sides, ride along on moving surfaces and slide on steep tilts.
 * Gameplay reads footprints from layout data, never from meshes (app/CLAUDE.md §Swappable views).
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';

export type V3 = [number, number, number];
export type V2 = [number, number];

export interface SurfaceDef {
  id: string;
  /** Walkable top as a polygon in local XZ (metres). Convex or concave, either winding. */
  outline: V2[];
  /** Thickness under the top: the slab the body can't pass through from the side. */
  depth: number;
  /**
   * Sides block the body (default). false = a floor only, like the designer's level page: you pass
   * through it from below or the side and pop up onto its top when it is within `stepUp`.
   */
  solid?: boolean;
  position: V3;
  /** Rotation about Y (radians). */
  yaw?: number;
  /** Fixed slope: rotation about the local X axis (ramps, climbing bridges). */
  pitch?: number;
  /** Moves over time: offset from `position` (and extra yaw) at game time t. */
  motion?: (t: number) => { offset: V3; yaw?: number };
  /**
   * Tilts towards the body standing on it, up to `max` radians (eased at `speed` per second),
   * then settles back; optionally sinks `sink` metres while occupied (eased at `sinkRate`).
   */
  tilt?: { max: number; speed: number; sink?: number; sinkRate?: number };
}

export class Surface {
  readonly matrix = new Matrix4();
  readonly prev = new Matrix4();
  readonly inv = new Matrix4();
  readonly prevInv = new Matrix4();
  /** Current tilt (radians about local X and Z). */
  tiltX = 0;
  tiltZ = 0;
  /** How far it has sunk under the body (metres). */
  sink = 0;
  /** Tilting can be switched off and on (e.g. only in a later fight round). */
  tiltOn = true;
  constructor(readonly def: SurfaceDef) {
    this.compose(0);
    this.prev.copy(this.matrix);
    this.prevInv.copy(this.inv);
  }

  /** Recompute the transform for game time t (keeps the previous one for carrying). */
  compose(t: number) {
    const d = this.def;
    const m = d.motion?.(t);
    const pos = new Vector3(...d.position);
    if (m) pos.add(new Vector3(...m.offset));
    pos.y -= this.sink;
    const q = new Quaternion().setFromEuler(
      new Euler(d.pitch ?? 0, (d.yaw ?? 0) + (m?.yaw ?? 0), 0, 'YXZ'),
    );
    if (this.tiltX || this.tiltZ)
      q.multiply(new Quaternion().setFromEuler(new Euler(this.tiltX, 0, this.tiltZ)));
    this.matrix.compose(pos, q, new Vector3(1, 1, 1));
    this.inv.copy(this.matrix).invert();
  }
}

/** Ray-casting point-in-polygon. */
export function inPolygon(x: number, z: number, poly: V2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Closest point on the polygon's boundary to (x, z), with the distance. */
export function closestOnEdge(x: number, z: number, poly: V2[]): { p: V2; d: number } {
  let best: V2 = poly[0];
  let bestD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    const ex = bx - ax;
    const ez = bz - az;
    const len2 = ex * ex + ez * ez || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / len2));
    const px = ax + ex * t;
    const pz = az + ez * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < bestD) {
      bestD = d;
      best = [px, pz];
    }
  }
  return { p: best, d: bestD };
}

/** Rectangle outline centred on the origin (w along local X, l along local Z). */
export const rect = (w: number, l: number): V2[] => [
  [-w / 2, -l / 2],
  [w / 2, -l / 2],
  [w / 2, l / 2],
  [-w / 2, l / 2],
];
/** Regular polygon outline (n sides, circumradius r). */
export const ngon = (n: number, r: number, rot = 0): V2[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

export interface BodyParams {
  radius: number;
  /** Body height (orb diameter + a bit), for side collisions. */
  height: number;
  runSpeed: number;
  /** How fast horizontal velocity eases towards the input on the ground (per second). */
  accel: number;
  /** The same in the air (lower = floatier; no input eases towards standing still). */
  airAccel: number;
  gravity: number;
  /** Extra gravity factor while rising with Space released (short hops). */
  shortHopGravity: number;
  jumpSpeed: number;
  /** Max fall speed while gliding (hold Space in the air, falling). */
  glideFall: number;
  /** Horizontal speed while gliding. */
  glideSpeed: number;
  dashSpeed: number;
  dashTime: number;
  /** Seconds from the start of a dash until the next one. */
  dashCooldown: number;
  /** Seconds after leaving an edge in which a jump still works. */
  coyote: number;
  /** Seconds a jump press is remembered before landing. */
  jumpBuffer: number;
  /** Step up onto ledges this high without jumping. */
  stepUp: number;
  /** Keep walking down slopes and steps this deep. */
  snapDown: number;
  /** Downhill slide on tilted ground: m/s per (gravity × sine of the tilt). 0 = none. */
  slide: number;
  /** Below this height the body has fallen into the void. */
  killY: number;
}

export const DEFAULT_BODY: BodyParams = {
  radius: 0.4,
  height: 0.9,
  runSpeed: 7,
  accel: 14,
  airAccel: 7,
  gravity: 14,
  shortHopGravity: 2.2,
  jumpSpeed: 7.5,
  glideFall: 1.6,
  glideSpeed: 8.5,
  dashSpeed: 17,
  dashTime: 0.22,
  dashCooldown: 0.67,
  coyote: 0.12,
  jumpBuffer: 0.12,
  stepUp: 0.35,
  snapDown: 0.35,
  slide: 0.35,
  killY: -40,
};

export interface BodyInput {
  /** Desired move direction in world XZ (length 0..1), already camera-relative. */
  move: V2;
  /** Space is held. */
  jump: boolean;
  /** Dash was pressed this frame (edge). */
  dash: boolean;
}

export type BodyEvent =
  | { type: 'jump' }
  | { type: 'land'; surface: string; speed: number }
  | { type: 'dash' }
  | { type: 'glide' }
  | { type: 'fell' };

export interface Body {
  pos: Vector3;
  vel: Vector3;
  /** Surface the body stands on, or null in the air. */
  ground: Surface | null;
  /** Last horizontal move direction (the orb faces it). */
  facing: V2;
  gliding: boolean;
  dashLeft: number;
  dashCool: number;
  /** One air dash per jump; refilled on landing. */
  airDash: boolean;
  coyoteLeft: number;
  bufferLeft: number;
  jumpWasHeld: boolean;
  /** Seconds since the last landing / respawn (for effects). */
  airTime: number;
}

export function createBody(at: V3): Body {
  return {
    pos: new Vector3(...at),
    vel: new Vector3(),
    ground: null,
    facing: [0, -1],
    gliding: false,
    dashLeft: 0,
    dashCool: 0,
    airDash: true,
    coyoteLeft: 0,
    bufferLeft: 0,
    jumpWasHeld: false,
    airTime: 0,
  };
}

/** Put the body down at a point (respawn), standing still. */
export function placeBody(b: Body, at: V3) {
  b.pos.set(...at);
  b.vel.set(0, 0, 0);
  b.ground = null;
  b.gliding = false;
  b.dashLeft = 0;
  b.airDash = true;
  b.airTime = 0;
}

const tmp = new Vector3();
const tmp2 = new Vector3();
const DOWN = new Vector3(0, -1, 0);

export class PlatformWorld {
  readonly surfaces: Surface[];
  time = 0;
  constructor(defs: SurfaceDef[]) {
    this.surfaces = defs.map((d) => new Surface(d));
  }
  byId(id: string) {
    return this.surfaces.find((s) => s.def.id === id);
  }

  /** Advance moving and tilting surfaces. `body` is used for tilting. */
  update(dt: number, body?: Body) {
    this.time += dt;
    for (const s of this.surfaces) {
      s.prev.copy(s.matrix);
      s.prevInv.copy(s.inv);
      const tilt = s.def.tilt;
      if (tilt) {
        let gx = 0;
        let gz = 0;
        if (body?.ground === s && s.tiltOn) {
          // lean towards the body: the further from the centre, the more
          const l = tmp.copy(body.pos).applyMatrix4(s.inv);
          const r = Math.max(1, ...s.def.outline.map(([x, z]) => Math.hypot(x, z)));
          gx = Math.max(-1, Math.min(1, l.z / r)) * tilt.max;
          gz = -Math.max(-1, Math.min(1, l.x / r)) * tilt.max;
        }
        const k = 1 - Math.exp(-tilt.speed * dt);
        s.tiltX += (gx - s.tiltX) * k;
        s.tiltZ += (gz - s.tiltZ) * k;
        if (tilt.sink) {
          const want = body?.ground === s && s.tiltOn ? tilt.sink : 0;
          s.sink += (want - s.sink) * (1 - Math.exp(-(tilt.sinkRate ?? tilt.speed) * dt));
        }
      }
      if (s.def.motion || tilt) s.compose(this.time);
    }
  }

  /**
   * Height of the surface top straight below/above (x, z) for a ray starting at `fromY`
   * going down; null if the point is outside its outline.
   */
  topAt(s: Surface, x: number, z: number, fromY: number) {
    const o = tmp.set(x, fromY, z).applyMatrix4(s.inv);
    const d = tmp2.copy(DOWN).transformDirection(s.inv);
    if (d.y >= -1e-6) return null;
    const t = -o.y / d.y;
    if (t < -50) return null;
    const hx = o.x + d.x * t;
    const hz = o.z + d.z * t;
    if (!inPolygon(hx, hz, s.def.outline)) return null;
    return fromY - t;
  }

  /** Highest top under (x, z) that is at or below `maxY`. */
  groundBelow(x: number, z: number, maxY: number): { s: Surface; y: number } | null {
    let best: { s: Surface; y: number } | null = null;
    for (const s of this.surfaces) {
      const y = this.topAt(s, x, z, maxY + 0.01);
      if (y === null || y > maxY + 0.001) continue;
      if (!best || y > best.y) best = { s, y };
    }
    return best;
  }

  /** Upward surface normal of `s` in world space. */
  normalOf(s: Surface) {
    return new Vector3(0, 1, 0).transformDirection(s.matrix);
  }
}

/** One physics step. Returns what happened (for sounds, the log, tokens). */
export function stepBody(
  b: Body,
  input: BodyInput,
  world: PlatformWorld,
  P: BodyParams,
  dt: number,
): BodyEvent[] {
  const ev: BodyEvent[] = [];

  // 1. ride along with the surface we stand on (it moved during world.update)
  if (b.ground) {
    const local = tmp.copy(b.pos).applyMatrix4(b.ground.prevInv);
    b.pos.copy(local.applyMatrix4(b.ground.matrix));
  }

  // 2. timers and jump buffer
  b.dashCool = Math.max(0, b.dashCool - dt);
  b.coyoteLeft = b.ground ? P.coyote : Math.max(0, b.coyoteLeft - dt);
  const pressed = input.jump && !b.jumpWasHeld;
  b.jumpWasHeld = input.jump;
  b.bufferLeft = pressed ? P.jumpBuffer : Math.max(0, b.bufferLeft - dt);

  const [mx, mz] = input.move;
  const mlen = Math.hypot(mx, mz);
  if (mlen > 0.01) b.facing = [mx / mlen, mz / mlen];

  // 3. dash: a short burst along the facing (or move) direction, no gravity
  if (input.dash && b.dashCool <= 0 && b.dashLeft <= 0 && (b.ground || b.airDash)) {
    b.dashLeft = P.dashTime;
    b.dashCool = P.dashCooldown;
    if (!b.ground) b.airDash = false;
    b.gliding = false;
    ev.push({ type: 'dash' });
  }
  if (b.dashLeft > 0) {
    b.dashLeft -= dt;
    b.vel.set(b.facing[0] * P.dashSpeed, 0, b.facing[1] * P.dashSpeed);
  } else {
    // 4. run / air control towards the wanted velocity
    const gliding = !b.ground && input.jump && b.vel.y < 0;
    if (gliding && !b.gliding) ev.push({ type: 'glide' });
    b.gliding = gliding;
    const top = gliding ? P.glideSpeed : P.runSpeed;
    // ease towards the wanted velocity (same model as the designer's level page)
    const k = Math.min(1, (b.ground ? P.accel : P.airAccel) * dt);
    b.vel.x += (mx * top - b.vel.x) * k;
    b.vel.z += (mz * top - b.vel.z) * k;

    // 5. jump (buffered, with coyote time)
    if (b.bufferLeft > 0 && (b.ground || b.coyoteLeft > 0)) {
      b.vel.y = P.jumpSpeed;
      b.ground = null;
      b.coyoteLeft = 0;
      b.bufferLeft = 0;
      ev.push({ type: 'jump' });
    }

    // 6. gravity: low and floaty; heavier when Space is let go on the way up; capped while gliding
    if (!b.ground) {
      const g = b.vel.y > 0 && !input.jump ? P.gravity * P.shortHopGravity : P.gravity;
      b.vel.y -= g * dt;
      if (b.gliding) b.vel.y = Math.max(b.vel.y, -P.glideFall);
    } else b.vel.y = 0;
  }

  // 7. move (plus a slide downhill on tilted ground that running doesn't brake)
  const oldY = b.pos.y;
  b.pos.addScaledVector(b.vel, dt);
  if (b.ground?.def.tilt && b.dashLeft <= 0) {
    const n = world.normalOf(b.ground);
    b.pos.x += n.x * P.gravity * P.slide * dt;
    b.pos.z += n.z * P.gravity * P.slide * dt;
  }

  // 8. side collisions: push out of slabs the body is inside of (not their tops)
  for (const s of world.surfaces) {
    if (s.def.solid === false) continue;
    const l = tmp.copy(b.pos).applyMatrix4(s.inv);
    if (l.y > -P.stepUp || l.y + P.height < -s.def.depth) continue;
    const inside = inPolygon(l.x, l.z, s.def.outline);
    const { p, d } = closestOnEdge(l.x, l.z, s.def.outline);
    if (!inside && d >= P.radius) continue;
    // head bump: coming up from below into the underside
    if (b.vel.y > 0 && inside && l.y + P.height < -s.def.depth + 0.3) {
      b.pos.y = oldY;
      b.vel.y = 0;
      continue;
    }
    const nx = inside ? p[0] - l.x : l.x - p[0];
    const nz = inside ? p[1] - l.z : l.z - p[1];
    const nl = Math.hypot(nx, nz) || 1;
    l.x = p[0] + (nx / nl) * P.radius;
    l.z = p[1] + (nz / nl) * P.radius;
    b.pos.copy(l.applyMatrix4(s.matrix));
  }

  // 9. ground: land on tops we came from above, follow slopes and steps down
  const wasGround = b.ground;
  const reach = Math.max(oldY, b.pos.y) + P.stepUp;
  const hit = world.groundBelow(b.pos.x, b.pos.z, reach);
  const falling = b.vel.y <= 0;
  if (hit && falling && b.pos.y <= hit.y + (wasGround ? P.snapDown : 0.001)) {
    if (!wasGround) ev.push({ type: 'land', surface: hit.s.def.id, speed: -b.vel.y });
    b.pos.y = hit.y;
    b.vel.y = 0;
    b.ground = hit.s;
    b.gliding = false;
    b.airDash = true;
    b.airTime = 0;
  } else {
    b.ground = null;
    b.airTime += dt;
  }

  if (b.pos.y < P.killY) ev.push({ type: 'fell' });
  return ev;
}
