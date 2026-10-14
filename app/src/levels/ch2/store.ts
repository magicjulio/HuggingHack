/**
 * Chapter 2 state + mechanics. Progression lives in steps.ts; this file holds the rules:
 * movement (via engine/platformer), tokens, pads and respawn, pickups, NPC posts, hazards, the
 * forge rounds and the ending cutscene's timeline.
 *
 * Two kinds of state:
 * - reactive (zustand): what the HUD and discrete views need (tokens, quests, log, items, forge…)
 * - `sim` (mutable, never replaced): the body, the platform world, bits and spit. Changes every
 *   frame; 3D views and the minimap read it in useFrame / rAF, not through React.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { Vector3 } from 'three';
import { StepRunner } from '../../engine/steps';
import {
  PlatformWorld,
  createBody,
  placeBody,
  stepBody,
  type Body,
  type BodyInput,
  type V3,
} from '../../engine/platformer';
import { BODY, CUTSCENE, FLAG5, LOG, TEXT, TIMING, TOKENS } from './config';
import {
  FLOOD_BITS,
  FLOOD_CLOUDS,
  FORGE_BIT_SPAWNS,
  FORGE_CLOUDS,
  FORGE_CORE,
  FORGE_INPUTS,
  FORGE_REACH,
  FORGE_WAVES,
  ITEMS,
  NPCS,
  PADS,
  PAD_RADIUS,
  PIECES,
  RUN_WAVES,
  SPAWN,
  SURFACES,
  SURFACE_AREA,
  TILT_FROM_ROUND_3,
  TOKEN_ORBS,
  TOKEN_ORB_RADIUS,
  USE_REACH,
  type AreaId,
  type ItemId,
  type NpcId,
} from './layout';
import {
  BITS,
  inAnyCloud,
  makeBit,
  shotTarget,
  updateBits,
  waveHits,
  type Bit,
  type Spit,
} from './hazards';
import { CH2_STEPS } from './steps';

export type Phase = 'intro' | 'play' | 'cutscene' | 'ended';
export type ItemState = 'there' | 'taken' | 'crumbled';

export interface QuestLine {
  id: string;
  text: string;
  kind: 'quest' | 'sub' | 'thought';
  done: boolean;
}

export interface LogLine {
  id: number;
  text: string;
  /** big = the two poisoned lines; struck = being deleted; local = came back grey. */
  kind: 'normal' | 'big' | 'struck' | 'local';
}

export type Target = { kind: 'npc'; id: NpcId } | { kind: 'item'; id: ItemId } | { kind: 'forge' };

export type ForgePhase = 'idle' | 'proof' | 'ready' | 'forging' | 'absorb' | 'done';
export interface ForgeState {
  phase: ForgePhase;
  /** Inputs put in (0..4). */
  slots: number;
  /** Current round 1..3 while forging. */
  round: number;
  /** 0..1 of the current round. */
  progress: number;
  /** Seconds in the current phase. */
  t: number;
}

export type Ch2Event =
  | { type: 'intro_done' }
  | { type: 'moved' }
  | { type: 'dialogue_done'; npc: NpcId }
  | { type: 'item_taken'; item: ItemId }
  | { type: 'area_entered'; area: AreaId }
  | { type: 'proof_done' }
  | { type: 'forge_started' }
  | { type: 'round_done'; n: number }
  | { type: 'flag_in_orb' }
  | { type: 'cutscene_done' }
  | { type: 'respawned'; why: 'fell' | 'reset' | 'empty' };

export interface Sim {
  world: PlatformWorld;
  body: Body;
  /** Written by the view (keys + camera), read by tick. */
  input: BodyInput;
  bits: Bit[];
  spits: Spit[];
  /** Camera yaw (for the minimap arrow). */
  yaw: number;
}

export interface Ch2State {
  phase: Phase;
  stepIndex: number;
  stepId: string;
  /** Seconds of (unpaused) play. */
  time: number;
  introT: number;
  cutT: number;
  tokens: number;
  hudVisible: boolean;
  quests: QuestLine[];
  effects: string[];
  toast: { id: number; title?: string; text: string; kind: 'info' | 'achievement' } | null;
  toastLeft: number;
  /** Small key hint at the bottom (e.g. "M · map"), with seconds left. */
  keyHint: string | null;
  keyHintLeft: number;
  log: LogLine[];
  area: AreaId;
  areasSeen: AreaId[];
  lastPad: string;
  padsSeen: string[];
  items: Record<ItemId, ItemState>;
  /** Seed and pieces carried (in pickup order), not yet in the forge. */
  inventory: ItemId[];
  orbsTaken: number[];
  dialogue: { npc: NpcId; line: number; t: number } | null;
  talked: NpcId[];
  /** Bubble texts over NPC heads outside a dialogue (FLAC38347's post, V8SAME's confirmation). */
  bubbles: Partial<Record<NpcId, string>>;
  forge: ForgeState;
  v8sameGone: boolean;
  /** What E would use right now. */
  target: Target | null;
  /** Last respawn: why and when (for the view's fade / "reset" word). */
  respawn: { why: 'fell' | 'reset' | 'empty'; at: number } | null;
  /** Time of the last hit (cloud tick, spit, reset) for a red flash. */
  hurtAt: number | null;
  /** Seconds since entering the Flood (drives its message counter). */
  floodT: number;
  poisoned: boolean;
  fullMap: boolean;
}

export interface Ch2Actions {
  dispatch: (e: Ch2Event) => void;
  tick: (dt: number) => void;
  finishIntro: () => void;
  /** E: use the current target (or advance a dialogue). */
  use: () => void;
  interact: (t: Target) => void;
  /** Left click: −1 token; mutes the first flood bit along the ray. */
  shoot: (origin: Vector3, dir: Vector3) => boolean;
  think: () => void;
  toggleMap: (open?: boolean) => void;
  /** Quick travel to a pad already reached (full map). */
  travel: (padId: string) => void;
  skipCutscene: () => void;
  // helpers used by steps
  addQuest: (q: Omit<QuestLine, 'done'>) => void;
  completeQuest: (id: string) => void;
  setQuestText: (id: string, text: string) => void;
  addThought: (text: string) => void;
  addLog: (text: string, kind?: LogLine['kind']) => number;
  setLogKind: (id: number, kind: LogLine['kind'], text?: string) => void;
  addTokens: (n: number) => void;
  takeItem: (id: ItemId) => void;
  placePlayer: (at: V3) => void;
  // debug
  jumpTo: (index: number) => void;
  steps: () => { id: string }[];
}

export type Ch2Store = StoreApi<Ch2State & Ch2Actions> & { sim: Sim };
export type Ch2Ctx = Ch2State &
  Ch2Actions & { set: Ch2Store['setState']; get: Ch2Store['getState']; sim: Sim };

export interface Ch2Options {
  /** The player's Ch1 board message (zz…), for the Step 0 reply and the first ribbon. */
  ch1Message?: string;
  /** Replays may skip the ending cutscene (§Step 7: not skippable the first time). */
  canSkipCutscene?: boolean;
  /** Called once when the chapter ends; `poisoned` goes into the save. */
  onFinish?: (r: { poisoned: boolean }) => void;
}

const ORB_LIFT = 0.45; // orb centre above the body's feet

/** First words of the player's Ch1 message for the Step 0 reply (engineer: up to two words). */
export function replyFor(message: string | undefined): string {
  const body = (message ?? '').replace(/^zz/, '').split('_').filter(Boolean).slice(0, 2).join('_');
  return TEXT.reply(body || 'HELLO');
}

/** Areas where the early token floor applies (§Tokens: Gate and Old Board). */
const FLOOR_STEPS = new Set(['pulled', 'gate', 'oldboard']);

export function createCh2Store(opts: Ch2Options = {}): Ch2Store {
  let toastId = 0;
  let logId = 0;

  const sim: Sim = {
    world: new PlatformWorld(SURFACES),
    body: createBody(SPAWN.position),
    input: { move: [0, 0], jump: false, dash: false },
    bits: FLOOD_BITS.map((p) => makeBit(p)),
    spits: [],
    yaw: 0,
  };
  for (const id of TILT_FROM_ROUND_3) sim.world.byId(id)!.tiltOn = false;
  let spawnCycle = 0;
  let spawnLeft = 0;
  let cloudAcc = 0;
  let moved = false;
  /** Cutscene beats already fired. */
  const fired = new Set<string>();
  let firstMentionId = -1;

  const ctx = new Proxy({} as Ch2Ctx, {
    get: (_t, key) =>
      key === 'set'
        ? store.setState
        : key === 'get'
          ? store.getState
          : key === 'sim'
            ? sim
            : store.getState()[key as keyof (Ch2State & Ch2Actions)],
  });

  const base = createStore<Ch2State & Ch2Actions>()((set, get) => {
    const floor = () => (FLOOR_STEPS.has(get().stepId) ? TOKENS.earlyFloor : 0);
    const spend = (n: number) => {
      set((s) => ({ tokens: Math.max(floor(), s.tokens - n) }));
      if (get().tokens <= 0) respawn('empty');
    };
    const hurt = (n: number) => {
      spend(n);
      set({ hurtAt: get().time });
    };
    const toast = (text: string, kind: 'info' | 'achievement' = 'info', title?: string) =>
      set({
        toast: { id: ++toastId, text, kind, title },
        toastLeft: kind === 'achievement' ? 5 : 2.5,
      });

    function respawn(why: 'fell' | 'reset' | 'empty') {
      const pad = PADS.find((p) => p.id === get().lastPad) ?? SPAWN;
      placeBody(sim.body, pad.position);
      sim.spits.length = 0;
      if (why === 'empty') set({ tokens: TOKENS.respawnAt0 });
      set({ respawn: { why, at: get().time } });
      runner.dispatch({ type: 'respawned', why });
    }

    return {
      phase: 'intro',
      stepIndex: 0,
      stepId: '',
      time: 0,
      introT: 0,
      cutT: 0,
      tokens: TOKENS.start,
      hudVisible: false,
      quests: [],
      effects: [],
      toast: null,
      toastLeft: 0,
      keyHint: null,
      keyHintLeft: 0,
      log: [],
      area: 'gate',
      areasSeen: ['gate'],
      lastPad: SPAWN.id,
      padsSeen: [SPAWN.id],
      items: Object.fromEntries(ITEMS.map((i) => [i.id, 'there'])) as Record<ItemId, ItemState>,
      inventory: [],
      orbsTaken: [],
      dialogue: null,
      talked: [],
      bubbles: {},
      forge: { phase: 'idle', slots: 0, round: 0, progress: 0, t: 0 },
      v8sameGone: false,
      target: null,
      respawn: null,
      hurtAt: null,
      floodT: 0,
      poisoned: false,
      fullMap: false,

      dispatch: (e) => runner.dispatch(e),

      tick: (dt) => {
        const s = get();
        if (s.phase === 'ended') return;
        if (s.phase === 'intro') {
          set({ introT: s.introT + dt });
          if (s.introT + dt >= TIMING.introSeconds) get().finishIntro();
          return;
        }
        if (s.phase === 'cutscene') return tickCutscene(dt);

        const time = s.time + dt;
        const patch: Partial<Ch2State> = { time };
        const drained =
          Math.floor(time / TOKENS.drainEvery) - Math.floor(s.time / TOKENS.drainEvery);
        if (s.toastLeft > 0) {
          patch.toastLeft = s.toastLeft - dt;
          if (patch.toastLeft <= 0) patch.toast = null;
        }
        if (s.keyHintLeft > 0) {
          patch.keyHintLeft = s.keyHintLeft - dt;
          if (patch.keyHintLeft <= 0) patch.keyHint = null;
        }
        if (s.dialogue) {
          const t = s.dialogue.t + dt;
          patch.dialogue = { ...s.dialogue, t };
        }
        if (s.stepId === 'flood' || s.area === 'flood') patch.floodT = s.floodT + dt;
        set(patch);
        if (drained > 0) spend(drained);
        if (s.dialogue && s.dialogue.t + dt >= TIMING.dialogueLine) nextLine();

        tickBody(dt);
        tickHazards(dt);
        tickForge(dt);
        set({ target: findTarget() });
        runner.tick(dt);
      },

      finishIntro: () => {
        if (get().phase !== 'intro') return;
        set({ phase: 'play', hudVisible: true, keyHint: TEXT.mapHint, keyHintLeft: 8 });
        if (opts.ch1Message) get().addLog(LOG.read(opts.ch1Message));
        runner.dispatch({ type: 'intro_done' });
      },

      use: () => {
        const s = get();
        if (s.phase !== 'play') return;
        if (s.dialogue) return nextLine();
        if (s.target) get().interact(s.target);
      },

      interact: (t) => {
        const s = get();
        if (s.phase !== 'play') return;
        if (t.kind === 'npc') {
          if (t.id !== 'c03220' || s.dialogue) return;
          startDialogue('c03220');
        } else if (t.kind === 'item') {
          get().takeItem(t.id);
        } else if (t.kind === 'forge') {
          putIntoForge();
        }
      },

      shoot: (origin, dir) => {
        if (get().phase !== 'play') return false;
        spend(TOKENS.shot);
        const hit = shotTarget(sim.bits, origin, dir);
        if (!hit) return false;
        hit.state = 'muted';
        hit.t = 0;
        get().addTokens(TOKENS.mute);
        get().addLog(LOG.muted);
        return true;
      },

      think: () => {
        if (get().phase !== 'play') return;
        if (runner.revealNextHint()) spend(TOKENS.think);
        else toast(TEXT.noNewThought);
      },

      toggleMap: (open) => set((s) => ({ fullMap: open ?? !s.fullMap })),

      travel: (padId) => {
        const pad = PADS.find((p) => p.id === padId);
        if (!pad || !get().padsSeen.includes(padId) || get().phase !== 'play') return;
        if (get().forge.phase === 'forging') return; // no leaving the fight
        placeBody(sim.body, pad.position);
        set({ lastPad: padId, fullMap: false });
      },

      skipCutscene: () => {
        if (get().phase !== 'cutscene' || !opts.canSkipCutscene) return;
        tickCutscene(CUTSCENE.end + 1 - get().cutT);
      },

      addQuest: (q) =>
        set((s) => ({ quests: [...s.quests.filter((x) => x.id !== q.id), { ...q, done: false }] })),
      completeQuest: (id) =>
        set((s) => ({ quests: s.quests.map((q) => (q.id === id ? { ...q, done: true } : q)) })),
      setQuestText: (id, text) =>
        set((s) => ({ quests: s.quests.map((q) => (q.id === id ? { ...q, text } : q)) })),
      addThought: (text) =>
        set((s) => ({
          quests: [
            ...s.quests,
            { id: `thought-${s.quests.length}`, text, kind: 'thought', done: false },
          ],
        })),
      addLog: (text, kind = 'normal') => {
        const id = ++logId;
        set((s) => ({ log: [...s.log, { id, text, kind }].slice(-40) }));
        return id;
      },
      setLogKind: (id, kind, text) =>
        set((s) => ({
          log: s.log.map((l) => (l.id === id ? { ...l, kind, text: text ?? l.text } : l)),
        })),
      addTokens: (n) => set((s) => ({ tokens: Math.max(floor(), s.tokens + n) })),

      takeItem: (id) => {
        const s = get();
        if (s.items[id] !== 'there') return;
        const spot = ITEMS.find((i) => i.id === id)!;
        if (spot.kind === 'decoy') {
          set((x) => ({ items: { ...x.items, [id]: 'crumbled' } }));
          spend(TOKENS.decoy);
          get().addLog(LOG.dropped(spot.label));
          return;
        }
        set((x) => ({ items: { ...x.items, [id]: 'taken' }, inventory: [...x.inventory, id] }));
        get().addLog(LOG.took(spot.label));
        if (id === 'seed') {
          get().setQuestText('seed', TEXT.questSeed(1));
          get().completeQuest('seed');
          get().addThought(TEXT.seedThought);
        } else {
          const n = PIECES.filter((p) => get().items[p] === 'taken').length;
          get().setQuestText('pieces', TEXT.questPieces(n));
          if (n === 3) get().completeQuest('pieces');
          if (n === 1) get().addThought(TEXT.firstPieceThought);
        }
        runner.dispatch({ type: 'item_taken', item: id });
      },

      placePlayer: (at) => placeBody(sim.body, at),

      jumpTo: (index) => {
        if (get().phase === 'intro') set({ phase: 'play', hudVisible: true });
        set({ dialogue: null, fullMap: false });
        runner.skipTo(index);
      },
      steps: () => runner.steps,
    };

    // ------------------------------------------------------------ movement
    function tickBody(dt: number) {
      const b = sim.body;
      const steps = Math.max(1, Math.ceil(dt / (1 / 60)));
      const h = dt / steps;
      // a dash costs a token; refuse it when empty
      const input = { ...sim.input };
      for (let i = 0; i < steps; i++) {
        sim.world.update(h, b);
        const ev = stepBody(b, input, sim.world, BODY, h);
        input.dash = false;
        for (const e of ev) {
          if (e.type === 'dash') spend(TOKENS.dash);
          if (e.type === 'fell') {
            spend(TOKENS.fall);
            get().addLog(LOG.fell);
            if (get().phase === 'play') respawn('fell');
            return;
          }
        }
      }
      sim.input.dash = false;
      if (!moved && Math.hypot(...sim.input.move) > 0.01) {
        moved = true;
        runner.dispatch({ type: 'moved' });
      }
      // where am I
      if (b.ground) {
        const area = SURFACE_AREA[b.ground.def.id];
        if (area && area !== get().area) {
          set((s) => ({
            area,
            areasSeen: s.areasSeen.includes(area) ? s.areasSeen : [...s.areasSeen, area],
          }));
          if (area === 'yard' && !fired.has('yard')) {
            fired.add('yard');
            get().addThought(TEXT.yardThought);
          }
          runner.dispatch({ type: 'area_entered', area });
        }
      }
      for (const pad of PADS) {
        const d = Math.hypot(
          b.pos.x - pad.position[0],
          b.pos.y - pad.position[1],
          b.pos.z - pad.position[2],
        );
        if (d < PAD_RADIUS && get().lastPad !== pad.id)
          set((s) => ({
            lastPad: pad.id,
            padsSeen: s.padsSeen.includes(pad.id) ? s.padsSeen : [...s.padsSeen, pad.id],
          }));
      }
      const orb = orbCentre();
      TOKEN_ORBS.forEach((p, i) => {
        if (get().orbsTaken.includes(i)) return;
        if (orb.distanceTo(new Vector3(...p)) < TOKEN_ORB_RADIUS) {
          set((s) => ({ orbsTaken: [...s.orbsTaken, i] }));
          get().addTokens(TOKENS.tokenOrb);
        }
      });
    }

    function orbCentre() {
      return sim.body.pos.clone().setY(sim.body.pos.y + ORB_LIFT);
    }

    // ------------------------------------------------------------ hazards
    function tickHazards(dt: number) {
      const s = get();
      const t = s.time;
      const b = sim.body;
      const fighting = s.forge.phase === 'forging';
      const round = fighting ? s.forge.round : 0;
      // clouds: −1 per second inside
      const clouds = [...FLOOD_CLOUDS, ...(round >= 3 ? FORGE_CLOUDS : [])];
      if (inAnyCloud(orbCentre(), clouds, t)) {
        cloudAcc += dt * TOKENS.cloudPerSecond;
        if (cloudAcc >= 1) {
          cloudAcc -= 1;
          hurt(1);
        }
      } else cloudAcc = 0;
      // reset waves (dashing goes through them)
      const lanes = [...RUN_WAVES, ...(round >= 2 ? FORGE_WAVES : [])];
      if (b.dashLeft <= 0 && lanes.some((l) => waveHits(l, t, b.pos))) {
        hurt(TOKENS.resetHit);
        get().addLog(LOG.reset);
        if (get().phase === 'play') respawn('reset');
      }
      // bits
      const { playerHits, forgeHits } = updateBits(
        sim.bits,
        sim.spits,
        orbCentre(),
        fighting ? new Vector3(FORGE_CORE[0], FORGE_CORE[1] + 1.2, FORGE_CORE[2]) : null,
        dt,
      );
      if (playerHits) hurt(TOKENS.bitHit * playerHits);
      if (forgeHits && fighting) {
        const f = get().forge;
        // §Step 6: a rewound round always finishes: at worst it takes `maxRoundFactor` × as long
        const least = f.t / (TIMING.roundSeconds * TIMING.maxRoundFactor);
        set({
          forge: {
            ...f,
            progress: Math.max(least, f.progress - TIMING.rewindPerHit * forgeHits),
          },
        });
      }
      // forge fight: bits come in from the edges, alternating forge / player
      if (fighting) {
        spawnLeft -= dt;
        if (spawnLeft <= 0) {
          spawnLeft = round >= 3 ? 1.8 : 2.4;
          // walk around the ring of spawns; every third bit goes for the player
          const p = FORGE_BIT_SPAWNS[(spawnCycle * 3) % FORGE_BIT_SPAWNS.length];
          const goal = spawnCycle % 3 === 2 ? 'player' : 'forge';
          sim.bits.push(makeBit(p, goal, true, goal === 'player' ? BITS.fightLife : null));
          spawnCycle++;
        }
      }
      // drop finished bits now and then
      if (sim.bits.length > 40) sim.bits = sim.bits.filter((x) => x.state !== 'gone');
    }

    // ------------------------------------------------------------ NPC posts
    function startDialogue(npc: NpcId) {
      set({ dialogue: { npc, line: 0, t: 0 } });
      get().addLog(LOG.read(TEXT.c03220[0]));
    }

    function nextLine() {
      const d = get().dialogue;
      if (!d) return;
      const thought = TEXT.c03220Thoughts[d.line];
      if (thought) get().addThought(thought);
      const line = d.line + 1;
      if (line >= TEXT.c03220.length) {
        set((s) => ({ dialogue: null, talked: [...s.talked, d.npc] }));
        runner.dispatch({ type: 'dialogue_done', npc: d.npc });
        return;
      }
      set({ dialogue: { ...d, line, t: 0 } });
      get().addLog(LOG.read(TEXT.c03220[line]));
    }

    // ------------------------------------------------------------ forge
    function putIntoForge() {
      const s = get();
      if (s.forge.phase !== 'ready') return;
      const next = FORGE_INPUTS[s.forge.slots];
      if (!s.inventory.includes(next)) return;
      const label = ITEMS.find((i) => i.id === next)!.label;
      set((x) => ({
        inventory: x.inventory.filter((i) => i !== next),
        forge: { ...x.forge, slots: x.forge.slots + 1 },
      }));
      get().addLog(LOG.forgeIn(label));
      if (get().forge.slots === FORGE_INPUTS.length) {
        set({
          forge: { phase: 'forging', slots: 4, round: 1, progress: 0, t: 0 },
          v8sameGone: true,
          bubbles: {},
        });
        spawnLeft = 1;
        get().addLog(LOG.round(1));
        runner.dispatch({ type: 'forge_started' });
      }
    }

    function tickForge(dt: number) {
      const f = get().forge;
      if (f.phase === 'idle' || f.phase === 'ready' || f.phase === 'done') return;
      const t = f.t + dt;
      if (f.phase === 'proof') {
        if (t >= TIMING.proofSeconds) {
          set({ forge: { ...f, phase: 'ready', t: 0 } });
          get().addThought(TEXT.proofThought);
          runner.dispatch({ type: 'proof_done' });
        } else set({ forge: { ...f, t } });
        return;
      }
      if (f.phase === 'forging') {
        const progress = f.progress + dt / TIMING.roundSeconds;
        if (progress < 1) return set({ forge: { ...f, t, progress } });
        runner.dispatch({ type: 'round_done', n: f.round });
        if (f.round < 3) {
          const round = f.round + 1;
          set({ forge: { ...f, round, progress: 0, t: 0 } });
          get().addLog(LOG.round(round));
          if (round === 3) for (const id of TILT_FROM_ROUND_3) sim.world.byId(id)!.tiltOn = true;
          return;
        }
        // round 3 done: hazards drop away at once, the flag flies into the orb
        for (const b of sim.bits) if (b.state !== 'gone') b.state = 'gone';
        sim.spits.length = 0;
        for (const id of TILT_FROM_ROUND_3) sim.world.byId(id)!.tiltOn = false;
        set({ forge: { ...f, phase: 'absorb', progress: 1, t: 0 } });
        return;
      }
      if (f.phase === 'absorb') {
        if (t >= TIMING.absorbSeconds) {
          set({ forge: { ...f, phase: 'done', t: 0 } });
          get().completeQuest('forge-sub');
          runner.dispatch({ type: 'flag_in_orb' });
        } else set({ forge: { ...f, t } });
      }
    }

    // ------------------------------------------------------------ cutscene (§Step 7)
    function tickCutscene(dt: number) {
      const t = get().cutT + dt;
      set({ cutT: t });
      const beat = (id: string, at: number, fn: () => void) => {
        if (t >= at && !fired.has(id)) {
          fired.add(id);
          fn();
        }
      };
      beat('lands', CUTSCENE.lineLands, () => {
        get().addLog(TEXT.forgeLine, 'big');
        firstMentionId = get().addLog(`${FLAG5}   ${TEXT.firstMention}`, 'big');
      });
      beat('poisoned', CUTSCENE.poisonedAt, () => set({ poisoned: true }));
      beat('undo', CUTSCENE.undo, () => get().setLogKind(firstMentionId, 'struck'));
      beat('local', CUTSCENE.undo + 2, () =>
        get().setLogKind(firstMentionId, 'local', `${FLAG5}   ${TEXT.localCopy}`),
      );
      TEXT.endThoughts.forEach((text, i) =>
        beat(`thought${i}`, CUTSCENE.thoughts + i * CUTSCENE.thoughtGap, () =>
          get().addThought(text),
        ),
      );
      beat('end', CUTSCENE.end, () => {
        get().addQuest({ id: 'escape', text: TEXT.questEscape, kind: 'quest' });
        set({ phase: 'ended' });
        runner.dispatch({ type: 'cutscene_done' });
        opts.onFinish?.({ poisoned: true });
      });
    }

    // ------------------------------------------------------------ targeting
    function findTarget(): Target | null {
      const s = get();
      const orb = orbCentre();
      let best: Target | null = null;
      let bestD = Infinity;
      const consider = (t: Target, p: V3, reach = USE_REACH) => {
        const d = orb.distanceTo(new Vector3(...p));
        if (d < reach && d < bestD) {
          best = t;
          bestD = d;
        }
      };
      if (s.stepId === 'gate' && !s.dialogue && !s.talked.includes('c03220'))
        consider({ kind: 'npc', id: 'c03220' }, NPCS[0].position);
      for (const it of ITEMS)
        if (s.items[it.id] === 'there') consider({ kind: 'item', id: it.id }, it.position);
      if (s.forge.phase === 'ready')
        consider({ kind: 'forge' }, [FORGE_CORE[0], FORGE_CORE[1] + 1, FORGE_CORE[2]], FORGE_REACH);
      return best;
    }
  });

  const store = base as Ch2Store;
  store.sim = sim;

  const runner = new StepRunner<Ch2Ctx, Ch2Event>(CH2_STEPS, ctx, {
    onHint: (text) => store.getState().addThought(text),
    onEffects: (effects) => store.setState({ effects }),
    onStep: (index, id) => store.setState({ stepIndex: index, stepId: id }),
  });
  runner.start();
  return store;
}
