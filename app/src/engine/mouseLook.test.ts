import { beforeEach, describe, expect, it } from 'vitest';
import { lookDelta, resetLookDelta } from './mouseLook';

let t = 1000;
/** One mousemove `ms` after the last. */
const move = (dx: number, dy = 0, ms = 16) =>
  lookDelta({ movementX: dx, movementY: dy, timeStamp: (t += ms) } as MouseEvent);

describe('lookDelta', () => {
  beforeEach(() => resetLookDelta());

  it('passes ordinary and fast movement through', () => {
    for (const d of [3, 12, 40, 90, 140, 210, 260, 180, 60]) expect(move(d)).toEqual([d, 0]);
    expect(move(-30, 20)).toEqual([-30, 20]);
  });

  it('drops one huge jump in the middle of a slow move', () => {
    move(8);
    move(10, 2);
    expect(move(-1400, 600)).toEqual([0, 0]);
    expect(move(9)).toEqual([9, 0]);
  });

  it('drops a big first event from rest, but never two in a row', () => {
    move(5);
    expect(move(900, 0, 500)).toEqual([0, 0]);
    expect(move(850)).toEqual([850, 0]);
  });

  it('answers the same event the same way for every listener', () => {
    move(6);
    const e = { movementX: 1200, movementY: 0, timeStamp: (t += 16) } as MouseEvent;
    expect(lookDelta(e)).toEqual([0, 0]);
    expect(lookDelta(e)).toEqual([0, 0]);
  });
});
