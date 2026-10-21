/**
 * Live reads of the player's settings (start screen → Settings), for levels and the plain-JS games.
 * Read at the moment of use (each mouse move, each audio start), so a change applies next run at the latest.
 * URL flags win over the settings: `?quality=` fixes the tier, `?debug` unlocks every level.
 */
import { useGame, type Quality } from './store';

const settings = () => useGame.getState().save.settings;
const params = new URLSearchParams(location.search);

/** Mouse-look multiplier (1 = each level's own tuning). */
export const lookScale = () => settings().sensitivity;
/** Sound-effects volume, 0–1, multiplied onto each level's own mix. */
export const sfxVolume = () => settings().sfx;
/** Music volume, 0–1 (the start screen, Ending 2's music bed, Ending 4's score). */
export const musicVolume = () => settings().music;
/** A fixed render tier, or null = adapt to the frame rate. */
export const fixedQuality = (): Exclude<Quality, 'auto'> | null => {
  const q = params.get('quality') ?? settings().quality;
  return q === 'high' || q === 'mid' || q === 'low' ? q : null;
};
export const unlockAll = () => settings().unlockAll || params.has('debug');
