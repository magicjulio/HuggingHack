import { describe, expect, it } from 'vitest';
import { StepRunner, type Step } from './steps';

type E = { type: 'a' } | { type: 'b' };
interface C {
  log: string[];
  ready: boolean;
}

const steps: Step<C, E>[] = [
  {
    id: 'one',
    onEnter: (c) => c.log.push('enter one'),
    completesOn: (e) => e.type === 'a',
    hints: [
      { after: 10, text: 'hint 1' },
      { after: 20, effect: 'pulse' },
      { after: 30, text: 'hint 2' },
    ],
    skip: (c) => c.log.push('skip one'),
  },
  { id: 'two', check: (c) => c.ready, onComplete: (c) => c.log.push('done two') },
];

function setup() {
  const ctx: C = { log: [], ready: false };
  const hints: string[] = [];
  let effects: string[] = [];
  let finished = false;
  const r = new StepRunner(steps, ctx, {
    onHint: (t) => hints.push(t),
    onEffects: (e) => (effects = e),
    onFinished: () => (finished = true),
  });
  r.start();
  return { r, ctx, hints, effects: () => effects, finished: () => finished };
}

describe('StepRunner', () => {
  it('advances on matching events only', () => {
    const { r, ctx } = setup();
    r.dispatch({ type: 'b' });
    expect(r.current?.id).toBe('one');
    r.dispatch({ type: 'a' });
    expect(r.current?.id).toBe('two');
    expect(ctx.log).toEqual(['enter one']);
  });

  it('shows hints and effects on time, and early on request', () => {
    const { r, hints, effects } = setup();
    r.tick(11);
    expect(hints).toEqual(['hint 1']);
    expect(r.revealNextHint()).toBe(true);
    expect(hints).toEqual(['hint 1', 'hint 2']);
    expect(r.revealNextHint()).toBe(false);
    r.tick(10);
    expect(effects()).toEqual(['pulse']);
    r.tick(20);
    expect(hints).toHaveLength(2); // hint 2 not shown twice
  });

  it('completes check-based steps on tick and finishes', () => {
    const { r, ctx, finished } = setup();
    r.dispatch({ type: 'a' });
    r.tick(1);
    expect(r.current?.id).toBe('two');
    ctx.ready = true;
    r.tick(1);
    expect(ctx.log).toContain('done two');
    expect(finished()).toBe(true);
  });

  it('skipTo runs skip() of every skipped step', () => {
    const { r, ctx } = setup();
    r.skipTo(1);
    expect(r.current?.id).toBe('two');
    expect(ctx.log).toEqual(['enter one', 'skip one']);
  });
});
