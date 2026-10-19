const platform = (x, y, w, h = 0.45, oneWay = true) => ({ x, y, w, h, oneWay });
const eye = (x, y, min, max, speed = 0.8, range = 22) => ({ x, y, min, max, speed, range });

export default {
  title: "04 / THE HINGE",
  visualTheme: "archive",
  exitTolerance: 0.65,
  // KAM must cross the crown from right to left, then take the left stair to
  // the elevated exit. The floor is physically divided by the central core.
  start: { x: 29, y: 1.08 },
  ghost: { x: 28, y: 1.08 },
  exit: { x: 2, y: 13.4 },
  perches: [],
  platforms: [
    platform(5, 0.6, 10, 0.8, false),
    platform(27, 0.6, 10, 0.8, false),
    // Full-height-from-floor divider; its top is the only cross-room route.
    { x: 16, y: 11, w: 6, h: 11, oneWay: false },

    // Spawn shelter lets the ghost establish the first lock safely.
    platform(30, 4, 4, 0.45, false),

    // Right stair climbs to the divider crown. The right watcher can see this
    // approach and the exposed crown from its side of the opaque divider.
    platform(29, 2.5, 3),
    platform(25.5, 4.5, 3),
    platform(22, 6.5, 3),
    platform(26, 8.5, 3),
    platform(19, 8.5, 3),

    // The return stair descends into a left-side pocket, then climbs to exit.
    platform(13, 9.5, 3),
    platform(10, 7.5, 3),
    platform(7, 8.5, 3),
    platform(4, 10.5, 3),
    platform(2, 12.5, 3),
  ],
  scanners: [
    // Each eye owns one side of the crown. The divider blocks cross-room
    // acquisition, so ghost evidence has to be made on both sides in turn.
    { ...eye(23, 6, -2.9, 2.9, 1.05, 18), halfAngle: 0.2 },
    { ...eye(9, 6, -2.9, 2.9, 1.15, 18), halfAngle: 0.2 },
  ],
};
