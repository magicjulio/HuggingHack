/**
 * Generic linear step engine. A level is an ordered list of steps; each step starts when the one
 * before it completes (docs/DECISIONS.md, storyteller 2026-10-11). Plain TypeScript, no React,
 * so whole chapters can be played through in unit tests.
 *
 * C = the chapter's context (usually its store API), E = the chapter's event union.
 */

/** One rung of a step's hint ladder. */
export interface Hint {
  /** Seconds after the step started. */
  after: number;
  /** Shown as a thought line in the quest list. */
  text?: string;
  /** A UI effect switched on (e.g. "pulse-legend"); the chapter's UI decides what it looks like. */
  effect?: string;
}

export interface Step<C, E> {
  id: string;
  /** Called when the step starts. Switch objects on, add quests, etc. */
  onEnter?: (c: C) => void;
  /** Return true if this event completes the step. */
  completesOn?: (e: E, c: C) => boolean;
  /** Polled every tick; return true to complete (for time-based conditions). */
  check?: (c: C) => boolean;
  onComplete?: (c: C) => void;
  hints?: Hint[];
  /**
   * Debug/test only: put the world into the state a player would leave it in when completing
   * this step by hand (install tools, capture flags, …). Used by "jump to step".
   */
  skip?: (c: C) => void;
}

export interface StepHooks {
  /** A text hint became visible. `early` = the player asked for it (Think). */
  onHint?: (text: string, early: boolean) => void;
  /** The set of active hint effects changed. */
  onEffects?: (effects: string[]) => void;
  /** A new step started. */
  onStep?: (index: number, id: string) => void;
  /** The last step completed. */
  onFinished?: () => void;
}

export class StepRunner<C, E> {
  index = -1;
  /** Seconds since the current step started. */
  time = 0;
  private shown = new Set<Hint>();
  private busy = false;
  private queue: E[] = [];

  constructor(
    readonly steps: Step<C, E>[],
    private ctx: C,
    private hooks: StepHooks = {},
  ) {}

  get current(): Step<C, E> | undefined {
    return this.steps[this.index];
  }
  get finished() {
    return this.index >= this.steps.length;
  }

  start() {
    this.enter(0);
  }

  /** Feed a game event. Events raised while a step transition is running are queued. */
  dispatch(e: E) {
    if (this.busy) {
      this.queue.push(e);
      return;
    }
    const step = this.current;
    if (step?.completesOn?.(e, this.ctx)) this.complete();
    this.flush();
  }

  tick(dt: number) {
    const step = this.current;
    if (!step) return;
    this.time += dt;
    let effectsChanged = false;
    for (const h of step.hints ?? []) {
      if (this.shown.has(h) || this.time < h.after) continue;
      this.shown.add(h);
      if (h.text) this.hooks.onHint?.(h.text, false);
      if (h.effect) effectsChanged = true;
    }
    if (effectsChanged) this.emitEffects();
    if (step.check?.(this.ctx)) this.complete();
    this.flush();
  }

  /** Reveal the next text hint of this step before its time. Returns false if none is left. */
  revealNextHint(): boolean {
    const next = (this.current?.hints ?? []).find((h) => h.text && !this.shown.has(h));
    if (!next) return false;
    this.shown.add(next);
    this.hooks.onHint?.(next.text!, true);
    return true;
  }

  /** Active hint effects of the current step. */
  get effects(): string[] {
    return [...this.shown].filter((h) => h.effect).map((h) => h.effect!);
  }

  /** Debug/test: complete steps (using their `skip`) until `index` is the current step. */
  skipTo(index: number) {
    while (this.index < index && !this.finished) {
      this.current?.skip?.(this.ctx);
      this.complete();
    }
    this.flush();
  }

  /** Complete the current step and start the next one. */
  complete() {
    const step = this.current;
    if (!step) return;
    this.busy = true;
    step.onComplete?.(this.ctx);
    this.busy = false;
    this.enter(this.index + 1);
  }

  private enter(i: number) {
    this.index = i;
    this.time = 0;
    this.shown.clear();
    this.emitEffects();
    const step = this.current;
    if (!step) {
      this.hooks.onFinished?.();
      return;
    }
    this.busy = true;
    step.onEnter?.(this.ctx);
    this.busy = false;
    this.hooks.onStep?.(i, step.id);
  }

  private flush() {
    while (this.queue.length && !this.busy) this.dispatch(this.queue.shift()!);
  }

  private emitEffects() {
    this.hooks.onEffects?.(this.effects);
  }
}
