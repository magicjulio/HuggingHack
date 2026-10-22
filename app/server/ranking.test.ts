import { describe, expect, it } from 'vitest';
import { RANKED } from '../src/data/ranking';
import { boardSql, checkName, checkRun, checkToken, levelOf } from './ranking';

const end1 = RANKED.end1;

describe('ranking rules', () => {
  it('names: 3–20 letters, digits, _ or -', () => {
    expect(checkName('ZebraVogel94349')).toBe(true);
    expect(checkName('a_b-c')).toBe(true);
    expect(checkName('ab')).toBe(false);
    expect(checkName('x'.repeat(21))).toBe(false);
    expect(checkName('no spaces')).toBe(false);
    expect(checkName('<b>')).toBe(false);
    expect(checkName(42)).toBe(false);
  });

  it('tokens: 32 hex characters', () => {
    expect(checkToken('0123456789abcdef0123456789abcdef')).toBe(true);
    expect(checkToken('short')).toBe(false);
  });

  it('runs: score in range, only the level stats, small integers', () => {
    expect(checkRun(end1, 42.3249, { falls: 2 })).toEqual({ score: 42.32, stats: { falls: 2 } });
    expect(checkRun(end1, 60, { falls: 1, kills: 9 })).toEqual({ score: 60, stats: { falls: 1 } });
    expect(checkRun(end1, 60, undefined)).toEqual({ score: 60, stats: {} });
    expect(checkRun(end1, 5, {})).toBeNull();
    expect(checkRun(end1, 99999, {})).toBeNull();
    expect(checkRun(end1, NaN, {})).toBeNull();
    expect(checkRun(end1, '60', {})).toBeNull();
    expect(checkRun(end1, 60, { falls: -1 })).toBeNull();
    expect(checkRun(end1, 60, { falls: 1.5 })).toBeNull();
  });

  it('levels: only the ranked ones', () => {
    expect(levelOf('end1')).toBe(end1);
    expect(levelOf('ch1')).toBeNull();
    expect(levelOf('toString')).toBeNull();
  });

  it('board sql orders by the level direction', () => {
    expect(boardSql(end1)).toContain('ORDER BY score ASC');
    expect(boardSql({ ...end1, order: 'desc' })).toContain('ORDER BY score DESC');
  });
});
