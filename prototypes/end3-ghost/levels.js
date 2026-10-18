import level4 from "./level4.js";
import level5 from "./level5.js";
import level6 from "./level6.js";

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
    start: { x: 1.4, y: 1.4 },
    ghost: { x: 2.5, y: 1.4 },
    exit: { x: 29, y: 1.5 },
    perches: [{ x: 8, y: 11.35 }],
    platforms: [
      platform(16, 0.6, 32, false),
      platform(1.6, 2.4, 2.2),
      { x: 3.7, y: 4.5, w: 0.8, h: 3.9, oneWay: false },
      platform(8, 8.5, 3),
      platform(8, 10.3, 3),
      platform(7, 4.6, 3.2),
      platform(8, 6.6, 3.8),
      platform(19, 1.8, 3),
      platform(23, 3.5, 3),
      platform(27, 1.8, 3),
    ],
    scanners: [eye(16, 11, -3.12, -0.4, 0.5)],
  },
  {
    title: "02 / UNDER THE WATCHER",
    start: { x: 3, y: 8.48 },
    ghost: { x: 9, y: 1.08 },
    exit: { x: 29, y: 10.9 },
    perches: [{ x: 16, y: 1.65 }],
    platforms: [
      platform(16, 0.6, 32, false),
      platform(3, 8, 6, false),
      { x: 6, y: 10, w: 0.8, h: 9.4, oneWay: false },
      platform(9, 10, 3),
      platform(14, 10, 3),
      platform(19, 10, 3),
      platform(24, 10, 3),
      platform(29, 10, 3),
    ],
    scanners: [eye(16, 6, -3.12, 3.12, 1.1, 28)],
  },
  {
    title: "03 / THE BLIND SIDE",
    exitTolerance: 0.65,
    start: { x: 2, y: 1.08 },
    ghost: { x: 7, y: 11.48 },
    exit: { x: 3, y: 11.9 },
    perches: [
      { x: 7, y: 12.05 },
      { x: 7, y: 1.65 },
    ],
    platforms: [
      platform(16, 0.6, 32, false),
      { x: 16, y: 10, w: 16, h: 5, oneWay: false },
      platform(4.5, 11, 9),
      { x: 4, y: 18, w: 8, h: 6, oneWay: false },
      platform(26, 2.5, 2),
      platform(29, 4.5, 2),
      platform(26, 6.5, 2),
      platform(29, 8.5, 2),
      platform(26, 10.5, 2),
      platform(22, 11, 2),
      platform(17, 11, 2),
      platform(12, 11, 2),
    ],
    scanners: [{ ...eye(2, 11.48, -1.5, 4.5, 2.2, 32), halfAngle: 0.24 }],
  },
  level4,
  level5,
  level6,
];
