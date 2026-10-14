/**
 * Chapter 2 sound: the designer's synthesised sfx.js (WebAudio, no files; handoff design-to-app
 * 2026-10-14-ch2-intro-forge-sound-decor §3, sound board design/ch2-ui/sfx.html).
 * - One-shots: the store queues sound moments at their source (`sim.sounds`); this plays them.
 * - Loops: ambience always; forge hum near the forge (louder per round); cloud hum by the nearest
 *   cloud; the tornado in Step 0; the low hum in Step 7.
 * - Films: step0.js / step7.js cue lists fire once as introT / cutT pass them (a skip jumps over
 *   them silently); their levels drive the loops, `muffle` and `duck` every frame.
 * Lives in the Canvas (useFrame after the store's tick). Paused or map open: everything quieter.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { useCh2Store } from './context';
import { FLOOD_CLOUDS, FORGE_CLOUDS, FORGE_CORE, ORB_LIFT, WAVE_STATIONS } from './layout';
import { REDUCED_MOTION } from './presentation';
import { replyFor } from './store';
import { createSfx } from './ui/sfx.js';
import { cloudPos, waveState } from './world/motion.js';
import { SOUND as FILM_CUES, soundLevels as filmLevels } from './world/step7.js';
import { soundCues as introCues, soundLevels as introLevels } from './world/step0.js';

/** Within this distance of the forge its hum is heard (handoff §3). */
const FORGE_HEAR = 40;
/** The cloud hum fades out this far outside a cloud. */
const CLOUD_HEAR = 14;
/** A laser pass starting this close is heard. */
const LASER_HEAR = 12;
/** A cue list jump bigger than this is a skip: pass the cues without playing them. */
const SKIP_JUMP = 0.5;
const VOLUME = 0.8;
const VOLUME_PAUSED = 0.2;

type Cue = { t: number; play: string; opts?: Record<string, unknown> };
type Loop = { set(k: number): unknown; stop(): void };
interface Engine {
  sfx: ReturnType<typeof createSfx>;
  loops: Record<string, Loop>;
  intro: (t: number) => void;
  film: (t: number) => void;
}

/** Plays a timed cue list once as `t` passes each cue; seeks silently over skips and rewinds. */
function cuePlayer(cues: Cue[], play: (c: Cue) => void) {
  let next = 0;
  let last = -1;
  return (t: number) => {
    if (t < last || t - last > SKIP_JUMP) {
      next = cues.findIndex((c) => c.t > t);
      if (next < 0) next = cues.length;
    } else while (next < cues.length && cues[next].t <= t) play(cues[next++]);
    last = t;
  };
}

export function Sound({ quiet, ch1Message }: { quiet: boolean; ch1Message: string }) {
  const store = useCh2Store();
  const engine = useRef<Engine | null>(null);
  const quietRef = useRef(quiet);
  quietRef.current = quiet;
  useEffect(() => engine.current?.sfx.volume(quiet ? VOLUME_PAUSED : VOLUME), [quiet]);

  // One audio engine per mount (React's dev double mount must not reuse a closed context).
  // Browsers start audio suspended: the start-screen click usually allows it already; any later
  // click or key unlocks it too.
  useEffect(() => {
    const sfx = createSfx();
    const play = (c: Cue) => {
      if (REDUCED_MOTION && c.play === 'stream') return;
      sfx.play(c.play, c.opts);
    };
    const e: Engine = {
      sfx,
      loops: {},
      intro: cuePlayer(introCues(replyFor(ch1Message).length) as Cue[], play),
      film: cuePlayer(FILM_CUES as Cue[], play),
    };
    const unlock = () => {
      sfx.unlock();
      if (!e.loops.ambience)
        for (const name of ['ambience', 'forge_hum', 'cloud_hum', 'tornado', 'hum'])
          e.loops[name] = sfx.loop(name, 0);
    };
    unlock();
    sfx.volume(quietRef.current ? VOLUME_PAUSED : VOLUME);
    engine.current = e;
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
    return () => {
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
      if (engine.current === e) engine.current = null;
      sfx.stopAll(0.2);
      const ctx = sfx.context as AudioContext | null;
      setTimeout(() => void ctx?.close().catch(() => {}), 600);
    };
  }, [ch1Message]);

  const lasersOn = useRef<boolean[]>([]);
  const orb = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const s = store.getState();
    const sounds = store.sim.sounds.splice(0);
    const e = engine.current;
    if (!e) return;
    const { sfx, loops: L, intro, film } = e;
    for (const c of sounds) sfx.play(c.name, c.opts);
    if (!L.ambience) return;

    if (s.phase === 'intro') {
      intro(s.introT);
      const k = introLevels(s.introT, REDUCED_MOTION);
      L.tornado.set(k.tornado);
      L.ambience.set(0.6 * k.ambience);
      L.forge_hum.set(0);
      L.cloud_hum.set(0);
      return;
    }
    L.tornado.set(0);
    if (s.phase === 'cutscene' || s.phase === 'ended') {
      film(s.cutT);
      const k = filmLevels(s.cutT);
      sfx.muffle(k.muffle);
      sfx.duck(k.duck);
      L.hum.set(s.phase === 'ended' ? 0 : k.hum);
      L.forge_hum.set(0.4 * k.forgeHum);
      L.cloud_hum.set(0);
      L.ambience.set(0.6);
      return;
    }
    sfx.muffle(0);
    sfx.duck(0);
    L.hum.set(0);
    L.ambience.set(0.6);

    // the forge hums nearby: idle .3, while forging .4 + .2 per round
    const b = store.sim.body.pos;
    orb.set(b.x, b.y + ORB_LIFT, b.z);
    const f = s.forge;
    const forgeK = Math.max(0, 1 - orb.distanceTo(new Vector3(...FORGE_CORE)) / FORGE_HEAR);
    L.forge_hum.set(forgeK * (f.phase === 'forging' ? 0.4 + 0.2 * f.round : 0.3));
    // the nearest cloud: 1 inside, fading out over CLOUD_HEAR metres
    const clouds = [
      ...FLOOD_CLOUDS,
      ...(f.phase === 'forging' && f.round >= 3 ? FORGE_CLOUDS : []),
    ];
    let cloudK = 0;
    for (const c of clouds) {
      const p = cloudPos(c, s.time) as number[];
      const d = Math.hypot(orb.x - p[0], orb.y - p[1], orb.z - p[2]) - c.r;
      cloudK = Math.max(cloudK, 1 - Math.max(0, d) / CLOUD_HEAR);
    }
    L.cloud_hum.set(cloudK);
    // a laser pass starting near you
    WAVE_STATIONS.forEach((w, i) => {
      if (w.kind === 'lane' && !(f.phase === 'forging' && f.round >= 2)) return;
      const on = waveState(w, s.time).on;
      if (on && !lasersOn.current[i]) {
        const d = Math.hypot(orb.x - w.at[0], orb.y - w.at[1], orb.z - w.at[2]);
        if (d < LASER_HEAR) sfx.play('laser_sweep');
      }
      lasersOn.current[i] = on;
    });
  }, -1);
  return null;
}
