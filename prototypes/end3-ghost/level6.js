// A five-pass folded relay. All coordinates are physical geometry, not triggers.
const ledge = (x, y, w, oneWay = true, h = 0.45) => ({ x, y, w, h, oneWay });
const block = (x, y, w, h) => ledge(x, y, w, false, h);
const eye = (x, y, min, max, speed, range, halfAngle = 0.16) =>
  ({ x, y, min, max, speed, range, halfAngle });

export default {
  title: "06 / FIVE VERSIONS OF THE TRUTH",
  visualTheme: "archive",
  exitTolerance: 0.58,
  start: { x: 2.5, y: 1.08 },
  ghost: { x: 5, y: 4.58 },
  exit: { x: 30, y: 15.48 },
  perches: [],
  platforms: [
    ledge(16, 0.6, 32, false),
    ledge(16, 4.1, 32),
    ledge(16, 7.6, 32),
    // Opaque separator prevents either lower watcher leaking into the other pair.
    ledge(17.5, 7.6, 29, false),
    ledge(16, 11.1, 32),
    ledge(16, 14.6, 32),

    // Two storeys of extremely low passage at the left; neither beam
    // can be vaulted, nor can either thick ceiling be jumped onto.
    block(8, 4.1, 8, 2.52),
    block(8, 7.6, 8, 2.52),
    // The next pair of passages reverses the spatial relationship.
    block(24, 11.1, 8, 2.52),
    block(24, 14.6, 8, 2.52),

    // First reversal: a floor-to-roof screen with a genuinely blind side.
    block(26, 3, 0.8, 2.4),
    ledge(30.5, 2.3, 2.2),
    // Second reversal: only this end has the missing half-storey.
    ledge(1.8, 6.0, 2.6),
    // This little solid balcony is the safe place to leave KAM while
    // the ghost makes the long trip to the opposite end of the next pair.
    ledge(1, 4.1, 2, false),
    ledge(1, 7.6, 2, false),

    // Third reversal: the far-right pocket is below the eye and outside
    // its left-facing angular sweep, including both cone edges.
    ledge(31, 9.3, 1.8),
    // Fourth reversal and final ascent, deliberately offset from the eye.
    ledge(10, 12.9, 2.6),
    // Opaque ceiling protects the fourth traverse from the final watcher.
    block(22, 13.5, 20, 0.5),
    // A separate little canopy shelters the left staging pocket, but
    // leaves an oblique sightline from the last eye to x5/top11.1.
    ledge(1.4, 14.6, 2.8, false),
  ],
  scanners: [
    eye(0.8, 2.8, -0.85, 0.85, 1.1, 32),
    eye(31.2, 9.8, Math.PI - 0.85, Math.PI + 0.85, 1.25, 32),
    { ...eye(2, 16.2, -Math.PI, 0, 2.2, 31, 0.18), opposed: true },
  ],
};
