/** External engineer (Codex): assets and quality controls shared by the Canvas and film. */
import gateUrl from './memory/gate.jpg?url';
import deskUrl from './memory/desk.jpg?url';

export const MEMORY_URLS = { gate: gateUrl, desk: deskUrl };
export type QualityTier = 'high' | 'mid' | 'low';
export const QUALITY = { high: { msaa: 4 }, mid: { msaa: 0 }, low: { msaa: 0 } } as const;
export const qualityDpr = (tier: QualityTier) =>
  tier === 'low' ? 0.75 : Math.min(devicePixelRatio, 1.5);
const requested = new URLSearchParams(location.search).get('quality');
export const FIXED_QUALITY =
  requested === 'high' || requested === 'mid' || requested === 'low' ? requested : null;
