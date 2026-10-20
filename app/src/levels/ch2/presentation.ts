/** External engineer (Codex): assets and quality controls shared by the Canvas and film. */
import { fixedQuality } from '../../state/settings';
import gateUrl from './memory/gate.jpg?url';
import deskUrl from './memory/desk.jpg?url';

export const MEMORY_URLS = { gate: gateUrl, desk: deskUrl };
export type QualityTier = 'high' | 'mid' | 'low';
export const QUALITY = { high: { msaa: 4 }, mid: { msaa: 0 }, low: { msaa: 0 } } as const;
export const qualityDpr = (tier: QualityTier) =>
  tier === 'low' ? 0.75 : Math.min(devicePixelRatio, 1.5);
/** `?quality=` or the player's setting; null = adapt. A function: the setting can change between runs. */
export const fixedTier = fixedQuality;
/** Calm Step 0 for players who ask the system for less motion (`?reduced` to review it). */
export const REDUCED_MOTION =
  new URLSearchParams(location.search).has('reduced') ||
  (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
