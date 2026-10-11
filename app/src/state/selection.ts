/** Pure helpers for menu selection (tested in selection.test.ts). */

export interface Selectable {
  id: string;
  locked: boolean;
}

/** Next unlocked item in `dir` (+1 / -1), wrapping around. Returns `currentId` if nothing else is unlocked. */
export function cycleUnlocked(items: Selectable[], currentId: string, dir: 1 | -1): string {
  const open = items.filter((i) => !i.locked);
  if (open.length === 0) return currentId;
  const at = open.findIndex((i) => i.id === currentId);
  const next = at === -1 ? 0 : (at + dir + open.length) % open.length;
  return open[next].id;
}
