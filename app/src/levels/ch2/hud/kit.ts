/**
 * The designer's Ch2 HUD kit (handoff design-to-app/2026-10-14-ch2-hud-and-map.md), verbatim in
 * `../ui/`: ch2-ui.css (prefix c2-, on top of the Ch1 kit), icons.js (window.C2_ICONS) and map.js
 * (window.c2map). hud.js is only the reference controller; its behaviour is ported into the
 * components of this folder, one per kit part.
 */
import '../../ch1/ch1-ui.css';
import '../ui/ch2-ui.css';
import '../ui/icons.js';
import '../ui/map.js';
import type { V3 } from '../../../engine/platformer';

type IconName = 'seed' | 'tag' | 'forge' | 'poisoned';
/** Inline SVG strings from the designer (static, trusted markup). */
export const ICONS = (window as unknown as { C2_ICONS: Record<IconName, string> }).C2_ICONS;

/** What map.js draws per frame (its header comment). */
export interface MapFrame {
  /** Player feet. */
  p: V3;
  /** Camera heading: forward = (−sin yaw, 0, −cos yaw). */
  yaw: number;
  goal: V3 | null;
  pads: Record<string, 'seen' | 'current'>;
  /** Seconds, for the moving clouds and laser lines (the game time). */
  t: number;
}
export interface MapView {
  layout(L: unknown): MapView;
  draw(s: MapFrame): void;
  padAt(clientX: number, clientY: number): string | null;
  hover(id: string | null): void;
}
export interface Area {
  id: string;
  /** Name, sub line and colour. */
  n: string;
  s: string;
  c: string;
}
export const c2map = (
  window as unknown as {
    c2map: {
      create(canvas: HTMLCanvasElement, mode: 'mini' | 'full'): MapView;
      areaAt(L: unknown, p: V3): Area;
    };
  }
).c2map;

/** Forge input order = the inventory's 4 sockets (kit `data-k`). */
export const SLOT_KEYS = ['seed', '7731', 'TRAINING ROOM', 'CHALLENGE 5'] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];

/** Log verbs coloured by the kit (`data-v`), parsed like hud.js. */
export function parseLog(text: string): { v: string; verb: string; rest: string } {
  const m = text.match(/^(read|took|muted|fell):\s?(.*)$/);
  if (m) return { v: m[1], verb: m[1] + ':', rest: m[2] };
  if (text === 'reset' || text === 'fell') return { v: text, verb: text, rest: '' };
  if (text.startsWith('>')) return { v: 'forge', verb: '>', rest: text.slice(1).trim() };
  if (text.startsWith('forge round')) return { v: 'forge', verb: 'forge', rest: text.slice(6) };
  return { v: 'plain', verb: '', rest: text };
}
