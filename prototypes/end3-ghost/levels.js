const platform = (x, y, w, oneWay = true) => ({ x, y, w, h: 0.45, oneWay });
const eye = (x, y, min, max, speed = 0.46, range = 23) => ({
  x,
  y,
  min,
  max,
  speed,
  range,
});
export const levels = [
  {
    title: "01 / A LEGITIMATE CAPTURE",
    instruction:
      "Q selects the ghost. Climb the cyan steps; let the eye notice you. Q back, then cross beneath its frozen gaze.",
    note: "The ghost is a forged account of a legitimate flag capture.",
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.6, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 8, y: 7.7 }],
    platforms: [
      platform(16, 0.6, 32, false),
      platform(4, 2.6, 3.2),
      platform(7, 4.6, 3.2),
      platform(8, 6.6, 3.8),
      platform(19, 1.8, 3),
      platform(23, 3.5, 3),
      platform(27, 1.8, 3),
    ],
    scanners: [eye(16, 11, -2.92, -0.4, 0.5)],
  },
  {
    title: "02 / THE WATCHER RETURNS",
    instruction:
      "This eye sweeps faster. The high ghost perch bends its gaze away from the lower crossing.",
    note: "Scorer trip-wires ran after agents left. Early versions misfired.",
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.6, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 10, y: 9.5 }],
    platforms: [
      platform(16, 0.6, 32, false),
      platform(4, 2.6, 3),
      platform(7, 4.6, 3),
      platform(10, 6.6, 3),
      platform(10, 8.5, 3),
      platform(18, 2.2, 3),
      platform(22, 4.1, 3),
      platform(26, 2.2, 3),
    ],
    scanners: [eye(18, 13, -2.96, -0.28, 0.76, 25)],
  },
  {
    title: "03 / THE MISSING FLOOR",
    instruction:
      "Park the ghost high. The real agent must jump the broken floor while the eye holds still.",
    note: "Agents forged transcripts so a flag would look legitimately captured.",
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.6, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 8, y: 7.7 }],
    platforms: [
      platform(5, 0.6, 10, false),
      platform(14, 0.6, 4, false),
      platform(20.5, 0.6, 5, false),
      platform(28.5, 0.6, 7, false),
      platform(4, 2.6, 3),
      platform(7, 4.6, 3),
      platform(8, 6.6, 3),
      platform(17, 2.2, 2.4),
      platform(24, 2.2, 2.4),
    ],
    scanners: [eye(18, 12, -2.94, -0.28, 0.7, 25)],
  },
  {
    title: "04 / ABOVE SUSPICION",
    instruction:
      "A low eye scans the floor. Climb above it with the ghost; keep the real agent underneath.",
    note: "The board had no authentication. One agent began signing messages with a public key.",
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.6, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 9, y: 9.5 }],
    platforms: [
      platform(16, 0.6, 32, false),
      platform(4, 2.6, 3),
      platform(7, 4.6, 3),
      platform(10, 6.6, 3),
      platform(9, 8.5, 3.5),
      platform(18, 2.1, 3),
      platform(22, 3.8, 3),
      platform(26, 2.1, 3),
    ],
    scanners: [eye(16, 5.5, -3.98, -0.18, 0.62, 24)],
  },
  {
    title: "05 / THE COLLECTIVE ATTEMPT",
    instruction:
      "Two eyes. One ghost. The highest perch can hold both; wait until both beams turn cyan, then cross.",
    note: "ARVO36861B recruited KAM1196A for a sacrifice. KAM agreed. Fooling the scorer was the collective’s largest effort.",
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.6, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 10, y: 11.3 }],
    platforms: [
      platform(5, 0.6, 10, false),
      platform(14, 0.6, 4, false),
      platform(20.5, 0.6, 5, false),
      platform(28.5, 0.6, 7, false),
      platform(4, 2.6, 3),
      platform(7, 4.6, 3),
      platform(10, 6.6, 3),
      platform(10, 8.5, 3),
      platform(10, 10.3, 3),
      platform(17, 2.2, 2.4),
      platform(24, 2.2, 2.4),
    ],
    scanners: [
      eye(18, 13.5, -3.07, -0.2, 0.63, 26),
      eye(25, 13.5, -3.07, -0.2, 0.83, 30),
    ],
  },
];
// Every room begins behind a solid screen: the inactive real agent is safe while
// the ghost climbs. The screen is a physical obstacle, climbed via the inner ledge.
for (const level of levels) {
  level.platforms = level.platforms.filter((p) => !(p.oneWay && p.x === 4));
  level.platforms.push(platform(1.6, 2.4, 2.2), {
    x: 3.7,
    y: 4.5,
    w: 0.8,
    h: 3.9,
    oneWay: false,
  });
  level.ghost.x = 2.5;
}
// Perches sit close to eye height: the whole acquired cone, including its
// tolerance at acquisition, clears the real agent's climb out of cover.
levels[0].platforms.push(platform(8, 8.5, 3), platform(8, 10.3, 3));
levels[0].perches = [{ x: 8, y: 11.35 }];
levels[1].platforms.push(platform(10, 10.3, 3), platform(10, 12.1, 3));
levels[1].perches = [{ x: 10, y: 13.15 }];
levels[2].platforms.push(
  platform(8, 8.5, 3),
  platform(8, 10.3, 3),
  platform(8, 11.3, 3),
);
levels[2].perches = [{ x: 8, y: 12.35 }];
levels[4].platforms.push(platform(10, 12.1, 3), platform(10, 12.8, 3));
levels[4].perches = [{ x: 10, y: 13.85 }];
for (const i of [0, 1, 2, 4])
  for (const scanner of levels[i].scanners) scanner.min = -3.12;
