/** External engineer (Codex): assets and quality controls shared by the Canvas and film. */
import gateUrl from './memory/gate.jpg?url';
import deskUrl from './memory/desk.jpg?url';

export const MEMORY_URLS = { gate: gateUrl, desk: deskUrl };
// the tiers are shared with Chapter 1
export { fixedTier, QUALITY, qualityDpr, type QualityTier } from '../../engine/quality';
/** Calm Step 0 for players who ask the system for less motion (`?reduced` to review it). */
export const REDUCED_MOTION =
  new URLSearchParams(location.search).has('reduced') ||
  (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
