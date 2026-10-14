# Designer → App: Ch2 world modules, part 3 (the last stand-ins)

**What it is:** The remaining world visuals as modules, same contract as before (`createX(ctx) → {object, update(t, dt, state), dispose()}`, three@0.186.1 only, no DOM or globals). With these, plus the external designer's `npcs`/`crowd`/`trails`, **no placeholder view is left in Ch2's world**.
**What changed since the last handoff:**
- New: `oldBoard.js`, `pads.js` (`createPads` + `createLifts`), `pickups.js`, `props.js`, `flood.js`, `ribbons.js`.
- Changed: `clouds.js`. Glyphs fade within ~4.5 m of the camera, so standing inside a cloud shows the swirl and no longer fills the screen with giant letters (your Flood screenshot).
- `design/3d/ch2/level.html` now runs on all of them; its colliders stay page-side, like yours.

**What the receiver must do:**
1. Copy `assets/ch2/world/{oldBoard,pads,pickups,props,flood,ribbons,clouds}.js` verbatim.
2. Replace your placeholder Old Board, pads, lift, pickups, crates, token orbs, Gate folders, flood bits, counter and ribbons. Feed state from your store/sim (§1).

**Open questions:** none. Still to come from me:
- the forge ending (proof, fold rounds, flag into the orb)
- the Step 0 intro and the sound (both waiting for Julius's review)
- the vibe-pass decorations Julius wants kept

## 1. State per module (all optional; each falls back to cosmetic defaults)
| Module | ctx | `update(t, dt, state)` |
|---|---|---|
| `createOldBoard` | `{layout, U}` | `{slabs: [{pos}]}`: your slab tops, by layout order (default `motion.slabAt`). Column, top disc and slab colliders stay yours. |
| `createPads` | `{layout, U, snap?}` | `{active: padId, seen?: {padId: true}}`. The active beam brightens; reached pads glow a little. `snap(x, z, y)` → floor y (your ground query), else the layout y. |
| `createLifts` | `{layout}` | `{lifts: {id: {y}}}` (default `motion.liftY`) |
| `createPickups` | `{layout, U, crates?}` | `{items: {layoutPickupId: 'there'|'taken'|'crumbled'}, tokens: takenIndices}`. **taken**: snaps up and vanishes in 0.35 s. **crumbled**: the decoy tears into 12 tumbling scraps over 1.2 s. `crates` = your `cratesFor(installed)` (`[{label, pos}]`); each crate mesh is named `crate:<label>`, and its collider yaw is `-mesh.rotation.y`. Ids are the layout's (`piece-7731` …); map them through your `ITEM_IDS`. |
| `createProps` | `{layout, U, islands, reply?}` | none. The Gate's zz folder arc; the **first folder is the player's reply** (`step0.replyFor(ch1Message)`, the same string the intro shows). Also the Yard's neighbour crates and the stray crate tumbling off the edge. |
| `createFlood` | `{layout, U}` | `{bits: [{pos?, state: 'idle'|'chase'|'muted'|'gone'}], counter: n, forge: [up to 8 forge-fight bits, same shape]}`. Muted bits go grey, stop spinning and sink. `spit(from, to, trails)` draws one of your spits as the garbage burst on the shared trails. |
| `createRibbons` | `{layout, U, message}` | none. `message` = the player's Ch1 message; it replaces the layout's `zzYOUR_CH1_MESSAGE`, the first ribbon you see at the Gate. |

## 2. Notes
- **No-bloom rule:** everything here keeps the rule. Agents are under the threshold; only the player orb, lasers and pickups glow.
- **Fonts:** `pickups`, `props`, `oldBoard`, `flood` and `ribbons` draw text with OffscreenCanvas at creation, so load the fonts first, as for islands. Like `util.js`, they touch OffscreenCanvas only when created, never at import.
- **Review:** `level.html?taken=piece-7731&crumbled=decoy-1` previews item states; `&poison=1` shows the poisoned player orb in play; `&msg=zzYOUR_TEXT` sets the Gate ribbon.

## Next reader
engineer.
