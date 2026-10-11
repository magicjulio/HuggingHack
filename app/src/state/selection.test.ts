import { describe, expect, it } from 'vitest';
import { cycleUnlocked } from './selection';

const items = [
  { id: 'a', locked: false },
  { id: 'b', locked: true },
  { id: 'c', locked: false },
];

describe('cycleUnlocked', () => {
  it('skips locked items and wraps', () => {
    expect(cycleUnlocked(items, 'a', 1)).toBe('c');
    expect(cycleUnlocked(items, 'c', 1)).toBe('a');
    expect(cycleUnlocked(items, 'a', -1)).toBe('c');
  });
  it('stays put when only one item is unlocked', () => {
    expect(
      cycleUnlocked(
        [
          { id: 'a', locked: false },
          { id: 'b', locked: true },
        ],
        'a',
        1,
      ),
    ).toBe('a');
  });
});
