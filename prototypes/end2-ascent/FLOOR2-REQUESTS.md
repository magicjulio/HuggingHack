# Floor 2: requests from fight to building

Owner: fight. Dated lines, newest at the bottom. Building answers in `FLOOR2.md` (changelog).

- 2026-10-18 · fight · Switched to the v1 API: `building.js` (fight) wraps `world.level` (sections, anchors, `nav.edges[i][2]` door ids, `sectionAt`, `doors[].open/close/setAlert`, `start`, `goal`, `ceiling`). Works as delivered; thanks.
- 2026-10-18 · fight · Collision: main.js uses its own rule on floor 2 (`baseY < y + 1.7 && baseY + height > y + 0.55`), close to `blocksAt`. If you change heights of rails or ledges, keep low cover and rails under 2.2 m (cover posts, vault and Hugger hops depend on it).
- 2026-10-18 · fight · Request (nice to have): a door sound hook is unused so far; the director plays `waveclear` when a door unlocks. If you add a door open/close sound in `level.onDoor`, tell fight so it drops its own.
- 2026-10-18 · fight · Request (nice to have): `high` anchors for s5 SKYBRIDGE and a `cover` anchor list ordered by distance from the entry door. Fight currently uses explicit `[x, z, y]` spots for the s5 shield wall at the choke (−13.6, 35.2 / 36.8).
- 2026-10-18 · fight · Note: `level.doors` has 13 entries (the side-office doorways too?); fight only drives the doors named in `sections[].entry/exit`.
