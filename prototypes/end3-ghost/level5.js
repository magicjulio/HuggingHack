// Independent room data. Platform y is its upper surface.
const ledge = (x, y, w = 2) => ({ x, y, w, h: 0.45, oneWay: true });
const solid = (x, y, w, h) => ({ x, y, w, h, oneWay: false });
const eye = (x, y, min, max, speed, range) => ({ x, y, min, max, speed, range });

export default {
  title: "05 / MOVING THE GOALPOSTS",
  visualTheme: "archive",
  exitTolerance: 0.65,
  start: { x: 2, y: 1.08 },
  ghost: { x: 5, y: 3.08 },
  exit: { x: 2, y: 9.4 },
  perches: [],
  platforms: [
    solid(16, 0.6, 32, 0.45),
    solid(2, 4, 4, 0.45),
    solid(16, 4, 6, 0.45),
    // This hanging wall separates the exit from the setup ladder.
    solid(4, 13, 1, 8),
    ledge(1.5, 8.5, 3),
    ledge(5.2, 2.6),
    ledge(5.2, 4.5),
    ledge(5.2, 6.5),
    ledge(5.2, 8.5),
    // No mid-height bridge: the upper circuit must be entered at the far end.
    solid(28.5, 4, 4, 0.45),
    ledge(31.5, 2.4, 1),
    ledge(31, 6, 1.6),
    ledge(27, 7.5),
    ledge(31, 8, 1.6),
    ledge(30, 10),
    ledge(30, 12),
    solid(28, 13, 1, 4),
    ledge(23, 12),
    ledge(20, 12),
    solid(16, 12, 4, 2),
    ledge(12, 14),
    ledge(16, 16),
    // A sheltered underpass, followed by a separate ascent on the left.
    ledge(16, 8.5, 10),
    ledge(13, 10.5),
    ledge(9, 12),
    ledge(5.5, 12),
  ],
  scanners: [
    {
      ...eye(8, 9, -3.12, -0.5, 1.5, 12),
      patrol: { x: 1.2, speed: 1.3 },
    },
    { ...eye(24, 9, -2.7, -0.3, 1.6, 12), halfAngle: 0.2 },
    { ...eye(16, 15, 0, Math.PI * 2, 1.55, 14), opposed: true },
  ],
};
