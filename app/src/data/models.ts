/**
 * Playable models (characters). Names from handoff/research-to-design/2026-10-11-agent-names.md.
 * Colour = orb colour (designer). Stats and unlock rules are PLACEHOLDERS, not game balance:
 * the storyteller/Julius decide them.
 */
export interface ModelInfo {
  id: string;
  name: string;
  /** Shown redacted (dim) until revealed. */
  redacted?: boolean;
  meta: string;
  color: string;
  /** PLACEHOLDER stats 0..1: hack, stealth, tokens. */
  stats: [number, number, number];
  /** Locked unless the save unlocks it. */
  lockedByDefault: boolean;
}

export const MODELS: ModelInfo[] = [
  {
    id: 'im1',
    name: 'Internal Model 1',
    meta: '"IM1" · persistent · default',
    color: '#39ff9c',
    stats: [0.55, 0.5, 0.6],
    lockedByDefault: false,
  },
  {
    id: 'sol',
    name: 'GPT-5.6 Sol',
    meta: 'unlock: finish chapter 1', // PLACEHOLDER unlock rule
    color: '#38d8ff',
    stats: [0.75, 0.6, 0.8],
    lockedByDefault: true,
  },
  {
    id: 'astra',
    name: 'Astra-family ???',
    redacted: true,
    meta: 'unlock: ???', // PLACEHOLDER unlock rule
    color: '#b86bff',
    stats: [0.95, 0.8, 0.9],
    lockedByDefault: true,
  },
];

export const modelById = (id: string) => MODELS.find((m) => m.id === id);
