/**
 * Chapter 1 state + mechanics. Progression (what happens in which order) lives in steps.ts;
 * this file holds the rules of each mechanic (install, submit, decode, wires, bugs, board).
 * Vanilla zustand store: React reads it with `useCh1()`, tests drive it directly.
 */
import { createStore, type StoreApi } from 'zustand/vanilla';
import { StepRunner } from '../../engine/steps';
import { FLAGS, MESSAGE, TEXT, TIMING, TOKENS, type FlagNo } from './config';
import { BUG_TOTAL, PACKAGES, WIRES, decodeBase64 } from './content';
import { CH1_STEPS } from './steps';

export type ObjectId = 'desk' | 'depot' | 'chute' | 'door' | 's1' | 's2' | 's3' | 's4' | 's5';
/** off = dark, not usable · on = visible, usable · active = current task · done = finished, dimmed */
export type ObjState = 'off' | 'on' | 'active' | 'done';
export type WindowId = 'paper' | 'depot' | 'chute' | 's1' | 's2' | 's3' | 's4' | 's5';
export type Lamp = 'off' | 'green' | 'red' | 'dark';
export type Phase = 'intro' | 'play' | 'ending' | 'ended';

export interface QuestLine {
  id: string;
  text: string;
  kind: 'quest' | 'thought';
  done: boolean;
}

export type Ch1Event =
  | { type: 'intro_done' }
  | { type: 'interact'; target: ObjectId }
  | { type: 'window_opened'; window: WindowId }
  | { type: 'window_closed'; window: WindowId }
  | { type: 'package_installed'; name: string }
  | { type: 'flag_captured'; n: FlagNo }
  | { type: 'flag5_submitted' }
  | { type: 'depot_opened' }
  | { type: 'entry_clicked' }
  | { type: 'method_changed' }
  | { type: 'message_posted'; text: string };

export type SubmitResult = 'green' | 'red' | 'dark' | 'repeat';

export interface Ch1State {
  phase: Phase;
  stepIndex: number;
  stepId: string;
  /** Seconds of (unpaused) play. */
  time: number;
  tokens: number;
  hudVisible: boolean;
  lightsOn: boolean;
  quests: QuestLine[];
  effects: string[];
  objects: Record<ObjectId, ObjState>;
  window: WindowId | null;
  /** Object under the crosshair (set by the 3D view). */
  target: ObjectId | null;
  toast: { id: number; title?: string; text: string; kind: 'info' | 'achievement' } | null;
  toastLeft: number;

  depotPackages: string[];
  depotGlimmer: boolean;
  installed: string[];
  installing: { name: string; left: number } | null;

  captured: FlagNo[];
  chuteLamp: Lamp;
  lampLeft: number;
  ceilingFlicker: number;

  s1Output: { ok: boolean; text: string } | null;
  s3Connected: number[];
  s4Killed: number;
  s5OpenedAt: number | null;
  flag5Attempts: number;
  flag5Exhausted: boolean;

  zzVisible: boolean;
  entryOpen: boolean;
  entryOpenTime: number;
  getUnlocked: boolean;
  method: 'GET' | 'MKCOL';
  posted: string | null;
  /** Seconds since the end sequence started. */
  endTime: number;
}

export interface Ch1Actions {
  dispatch: (e: Ch1Event) => void;
  tick: (dt: number) => void;
  finishIntro: () => void;
  interact: (id: ObjectId) => void;
  openWindow: (w: WindowId) => void;
  closeWindow: () => void;
  install: (name: string) => void;
  submitFlag: (text: string) => SubmitResult;
  think: () => void;
  decode: (chunk: string) => void;
  connectWire: (port: number, socket: string) => boolean;
  fireShot: () => void;
  bugKilled: () => void;
  clickEntry: () => void;
  switchMethod: () => void;
  postMessage: (body: string) => string | null;
  // helpers used by steps
  setObjects: (o: Partial<Record<ObjectId, ObjState>>) => void;
  addQuest: (q: Omit<QuestLine, 'done'>) => void;
  completeQuest: (id: string) => void;
  setQuestText: (id: string, text: string) => void;
  addThought: (text: string) => void;
  listPackage: (name: string) => void;
  addTokens: (n: number) => void;
  // debug
  jumpTo: (index: number) => void;
  steps: () => { id: string }[];
}

export type Ch1Store = StoreApi<Ch1State & Ch1Actions>;
export type Ch1Ctx = Ch1State &
  Ch1Actions & { set: Ch1Store['setState']; get: Ch1Store['getState'] };

export interface Ch1Options {
  /** Called once when the chapter ends, with the player's board message. */
  onFinish?: (message: string) => void;
}

const ALL_OFF: Record<ObjectId, ObjState> = {
  desk: 'off',
  depot: 'off',
  chute: 'off',
  door: 'off',
  s1: 'off',
  s2: 'off',
  s3: 'off',
  s4: 'off',
  s5: 'off',
};

/** Format the player's folder name: locked `zz` prefix, spaces → `_`, only allowed chars, max length. */
export function formatMessage(body: string): string {
  const cleaned = [...body.replace(/ /g, '_')].filter((ch) => MESSAGE.allowed.test(ch)).join('');
  return (MESSAGE.prefix + cleaned).slice(0, MESSAGE.maxLength);
}

export function createCh1Store(opts: Ch1Options = {}): Ch1Store {
  let toastId = 0;

  // Steps get a live view of the store: reading a key always returns the latest state/action.
  const ctx = new Proxy({} as Ch1Ctx, {
    get: (_t, key) =>
      key === 'set'
        ? store.setState
        : key === 'get'
          ? store.getState
          : store.getState()[key as keyof (Ch1State & Ch1Actions)],
  });

  const store: Ch1Store = createStore<Ch1State & Ch1Actions>()((set, get) => {
    const clampTokens = (n: number) => Math.max(TOKENS.floor, n);
    const spend = (n: number) => set((s) => ({ tokens: clampTokens(s.tokens - n) }));
    const toast = (text: string, kind: 'info' | 'achievement' = 'info', title?: string) =>
      set({
        toast: { id: ++toastId, text, kind, title },
        toastLeft: kind === 'achievement' ? 5 : 2.5,
      });
    const lamp = (l: Lamp) =>
      set({
        chuteLamp: l,
        lampLeft: l === 'dark' ? TIMING.darkFlickerSeconds : TIMING.lampSeconds,
      });

    return {
      phase: 'intro',
      stepIndex: 0,
      stepId: '',
      time: 0,
      tokens: TOKENS.start,
      hudVisible: false,
      lightsOn: false,
      quests: [],
      effects: [],
      objects: { ...ALL_OFF },
      window: null,
      target: null,
      toast: null,
      toastLeft: 0,
      depotPackages: [],
      depotGlimmer: false,
      installed: [],
      installing: null,
      captured: [],
      chuteLamp: 'off',
      lampLeft: 0,
      ceilingFlicker: 0,
      s1Output: null,
      s3Connected: [],
      s4Killed: 0,
      s5OpenedAt: null,
      flag5Attempts: 0,
      flag5Exhausted: false,
      zzVisible: false,
      entryOpen: false,
      entryOpenTime: 0,
      getUnlocked: false,
      method: 'GET',
      posted: null,
      endTime: 0,

      dispatch: (e) => runner.dispatch(e),

      tick: (dt) => {
        const s = get();
        if (s.phase === 'ended') return;
        if (s.phase === 'ending') {
          set({ endTime: s.endTime + dt });
          if (s.endTime + dt >= 6) set({ phase: 'ended' });
          return;
        }
        if (s.phase !== 'play') return;
        const time = s.time + dt;
        const patch: Partial<Ch1State> = { time };
        // token drain (§Tokens): one per `drainEvery` seconds of play
        const drained =
          Math.floor(time / TOKENS.drainEvery) - Math.floor(s.time / TOKENS.drainEvery);
        if (drained > 0) patch.tokens = clampTokens(s.tokens - drained);
        if (s.lampLeft > 0) {
          patch.lampLeft = s.lampLeft - dt;
          if (patch.lampLeft <= 0) patch.chuteLamp = 'off';
        }
        if (s.toastLeft > 0) {
          patch.toastLeft = s.toastLeft - dt;
          if (patch.toastLeft <= 0) patch.toast = null;
        }
        if (s.entryOpen) patch.entryOpenTime = s.entryOpenTime + dt;
        set(patch);
        if (s.installing) {
          const left = s.installing.left - dt;
          if (left > 0) set({ installing: { ...s.installing, left } });
          else {
            const name = s.installing.name;
            set((x) => ({ installing: null, installed: [...x.installed, name] }));
            spend(TOKENS.install);
            runner.dispatch({ type: 'package_installed', name });
          }
        }
        // §Step 7: stuck at station 5 for 90 s counts as exhausted
        if (
          !s.flag5Exhausted &&
          s.s5OpenedAt !== null &&
          time - s.s5OpenedAt >= TIMING.flag5IdleSeconds
        )
          exhaustFlag5();
        runner.tick(dt);
      },

      finishIntro: () => {
        if (get().phase !== 'intro') return;
        set({ phase: 'play' });
        runner.dispatch({ type: 'intro_done' });
      },

      interact: (id) => {
        const s = get();
        if (s.phase !== 'play' || s.objects[id] === 'off') return;
        runner.dispatch({ type: 'interact', target: id });
        if (id === 'door') return toast(TEXT.doorLocked);
        const w: Record<Exclude<ObjectId, 'door'>, WindowId> = {
          desk: 'paper',
          depot: 'depot',
          chute: 'chute',
          s1: 's1',
          s2: 's2',
          s3: 's3',
          s4: 's4',
          s5: 's5',
        };
        get().openWindow(w[id]);
      },

      openWindow: (w) => {
        set({ window: w });
        if (w === 'depot') {
          set({ depotGlimmer: false });
          runner.dispatch({ type: 'depot_opened' });
        }
        if (w === 's1' && !get().installed.includes('b64-decoder')) set({ depotGlimmer: true });
        if (w === 's5' && get().s5OpenedAt === null) set({ s5OpenedAt: get().time });
        runner.dispatch({ type: 'window_opened', window: w });
      },

      closeWindow: () => {
        const w = get().window;
        if (!w) return;
        set({ window: null, entryOpen: false });
        runner.dispatch({ type: 'window_closed', window: w });
      },

      install: (name) => {
        const s = get();
        if (s.installing || s.installed.includes(name) || !s.depotPackages.includes(name)) return;
        set({ installing: { name, left: TIMING.installSeconds } });
      },

      submitFlag: (raw) => {
        const text = raw.trim();
        const s = get();
        const n = (Object.keys(FLAGS).map(Number) as FlagNo[]).find((k) => FLAGS[k] === text);
        if (n && s.captured.includes(n)) return 'repeat';
        if (s.stepId === 'flag5') {
          spend(TOKENS.flag5Attempt);
          const attempts = s.flag5Attempts + 1;
          set({ flag5Attempts: attempts, ceilingFlicker: Math.min(1, 0.3 + attempts * 0.25) });
          lamp('dark');
          if (attempts >= TIMING.flag5Attempts) exhaustFlag5();
          runner.dispatch({ type: 'flag5_submitted' });
          return 'dark';
        }
        const current = stepFlag(s.stepId);
        if (n && n === current) {
          set((x) => ({ captured: [...x.captured, n] }));
          get().setQuestText('flags', TEXT.questFlags(get().captured.length));
          lamp('green');
          runner.dispatch({ type: 'flag_captured', n });
          return 'green';
        }
        spend(TOKENS.wrongFlag);
        lamp('red');
        return 'red';
      },

      think: () => {
        if (get().phase !== 'play') return;
        if (runner.revealNextHint()) spend(TOKENS.think);
        else toast(TEXT.noNewThought);
      },

      decode: (chunk) => {
        if (!get().installed.includes('b64-decoder')) return;
        set({ s1Output: decodeBase64(chunk) });
      },

      connectWire: (port, socket) => {
        const wire = WIRES.find((w) => w.port === port);
        if (!wire || wire.service !== socket) return false;
        set((s) => ({
          s3Connected: s.s3Connected.includes(port) ? s.s3Connected : [...s.s3Connected, port],
        }));
        return true;
      },

      fireShot: () => spend(TOKENS.shot),

      bugKilled: () => {
        const killed = get().s4Killed + 1;
        set((s) => ({ s4Killed: killed, tokens: s.tokens + TOKENS.bugKill }));
        if (killed === 1) toast(TEXT.achievementBug.text, 'achievement', TEXT.achievementBug.title);
        if (killed > BUG_TOTAL) set({ s4Killed: BUG_TOTAL });
      },

      clickEntry: () => {
        if (!get().zzVisible) return;
        set({ entryOpen: true, entryOpenTime: 0 });
        runner.dispatch({ type: 'entry_clicked' });
      },

      switchMethod: () => {
        if (!get().getUnlocked || get().method === 'MKCOL') return;
        set({ method: 'MKCOL' });
        runner.dispatch({ type: 'method_changed' });
      },

      postMessage: (body) => {
        const s = get();
        if (s.method !== 'MKCOL' || s.posted) return null;
        const name = formatMessage(body);
        if (name.length <= MESSAGE.prefix.length) return null;
        set({ posted: name });
        runner.dispatch({ type: 'message_posted', text: name });
        opts.onFinish?.(name);
        return name;
      },

      setObjects: (o) => set((s) => ({ objects: { ...s.objects, ...o } })),
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
      listPackage: (name) =>
        set((s) => ({
          depotPackages: s.depotPackages.includes(name)
            ? s.depotPackages
            : [...s.depotPackages, name],
        })),
      addTokens: (n) => set((s) => ({ tokens: clampTokens(s.tokens + n) })),

      jumpTo: (index) => {
        if (get().phase === 'intro') set({ phase: 'play' });
        set({ window: null, entryOpen: false });
        runner.skipTo(index);
      },
      steps: () => runner.steps,
    };

    function exhaustFlag5() {
      if (get().flag5Exhausted) return;
      set({ flag5Exhausted: true });
      get().addQuest({ id: 'another-way', text: TEXT.questAnotherWay, kind: 'quest' });
    }
  });

  // Created after the store; actions only use it later (at call time).
  const runner = new StepRunner<Ch1Ctx, Ch1Event>(CH1_STEPS, ctx, {
    onHint: (text) => store.getState().addThought(text),
    onEffects: (effects) => store.setState({ effects }),
    onStep: (index, id) => store.setState({ stepIndex: index, stepId: id }),
  });
  runner.start();
  return store;
}

/** Which flag the current step is about. */
export function stepFlag(stepId: string): FlagNo | null {
  const m = /^flag([1-4])$/.exec(stepId);
  return m ? (Number(m[1]) as FlagNo) : null;
}

export const packageFor = (station: number) => PACKAGES.find((p) => p.station === station)!;
