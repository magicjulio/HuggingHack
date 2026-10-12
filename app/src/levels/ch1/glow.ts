/** Shared glow rules for the scorer eye, the scan pad and the flag letters. */
import type { Lamp } from './store';

/** State glow (eye material `bulb`, pad tint): [colour, emissive intensity]. Designer handoff 2026-10-12. */
export const LAMP_GLOW: Record<Lamp, [string, number]> = {
  off: ['#1a2333', 0.3],
  green: ['#39ff9c', 3],
  red: ['#ff3b4e', 3],
  dark: ['#b86bff', 1],
};

/** The impossible flag: 35% of frames nearly black, otherwise a fast pulse. */
export const darkFlicker = (t: number) =>
  Math.random() < 0.35 ? 0.05 : 0.8 * Math.abs(Math.sin(t * 9));
