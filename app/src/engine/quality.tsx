/**
 * Render quality tiers shared by the R3F levels (Ch1, Ch2). Every machine starts on `high`, the full
 * look; only one that misses the frame budget steps down, and it keeps the lower tier for the run.
 * high = MSAA 4 / DPR ≤ 1.5, mid = MSAA 0, low = MSAA 0 / DPR .75.
 */
import { PerformanceMonitor } from '@react-three/drei';
import { fixedQuality } from '../state/settings';

export type QualityTier = 'high' | 'mid' | 'low';
export const QUALITY = { high: { msaa: 4 }, mid: { msaa: 0 }, low: { msaa: 0 } } as const;
export const qualityDpr = (tier: QualityTier) =>
  tier === 'low' ? 0.75 : Math.min(devicePixelRatio, 1.5);
/** `?quality=` or the player's setting; null = adapt. A function: the setting can change between runs. */
export const fixedTier = fixedQuality;

/** Steps the tier down while the frame rate stays under 59 fps. Mount inside the Canvas. */
export function QualityMonitor({
  tier,
  onTier,
}: {
  tier: QualityTier;
  onTier: (next: (t: QualityTier) => QualityTier) => void;
}) {
  if (fixedTier()) return null;
  return (
    <PerformanceMonitor
      ms={500}
      iterations={4}
      threshold={0.5}
      // Do not re-enable a tier that already missed the budget during this level.
      // Otherwise mid → high → mid repeatedly reallocates buffers in the middle of a film.
      bounds={() => [tier === 'low' ? 0 : 59, Infinity]}
      onDecline={() => onTier((t) => (t === 'high' ? 'mid' : 'low'))}
    />
  );
}
