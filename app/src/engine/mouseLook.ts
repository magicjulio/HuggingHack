/**
 * Mouse-look deltas with pointer-lock spikes taken out. Some browser / OS / mouse combinations
 * (Chrome on Windows above all) now and then report one huge movementX/Y, often right after the
 * lock is taken, and the view jumps (playtest: "mouse view jumps to a different view").
 *
 * A real move builds up over several events, so a single event that is both big and far bigger
 * than the one before it (or comes just after the lock) is dropped. A second big event in a row
 * gets through: a genuinely fast flick is never lost for more than one event.
 */
const SPIKE = 150; // px in one event; a hard flick at 60 events/s stays under this
const JUMP = 6; // ...and this many times the last event's size
const SETTLE = 150; // ms after the lock is taken in which a big event is dropped anyway
const REST = 100; // ms without events: the mouse was at rest, the last size counts as 0

let last = 0;
let lastAt = -Infinity;
let lockedAt = -Infinity;
let dropped = false;
// two listeners reading one event (E2: flight and on foot) get the same answer
let seen: MouseEvent | null = null;
let answer: [number, number] = [0, 0];

if (typeof document !== 'undefined')
  document.addEventListener('pointerlockchange', () => {
    lockedAt = performance.now();
    last = 0;
  });

/** [dx, dy] for one mousemove: e.movementX/Y, or [0, 0] for a spike. */
export function lookDelta(e: MouseEvent): [number, number] {
  if (e === seen) return answer;
  seen = e;
  const dx = e.movementX || 0,
    dy = e.movementY || 0;
  const size = Math.hypot(dx, dy),
    now = e.timeStamp;
  const before = now - lastAt > REST ? 0 : last;
  lastAt = now;
  const spike = !dropped && size > SPIKE && (size > JUMP * before || now - lockedAt < SETTLE);
  dropped = spike;
  if (!spike) last = size;
  return (answer = spike ? [0, 0] : [dx, dy]);
}

/** Tests: forget the history. */
export function resetLookDelta() {
  last = 0;
  lastAt = lockedAt = -Infinity;
  dropped = false;
  seen = null;
}
