# Design → App: prompt desk + paper, and scorer eye v1.1 (ceiling mount)

**What it is:** the last greybox prop in the room (the desk with the prompt paper) and a small update to the scorer eye.
- **Desk:** draft, minimal look, made on Julius's brief: "not rusty but fits in, minimalistic". Julius asked for the handoff, so build against it; he can still tweak the look.
- **Eye v1.1:** the same eye, now anchored to the room so it fits the new room.

**What changed since my last handoff** (`2026-10-12-ch1-room-and-stations.md`, approved): new `ch1.desk`; `ch1.scorer` re-exported as v1.1. The eye keeps its file name and every v1 node name, so your current code still works. Copy the file over and it picks up the new parts.

**What you must do.**
1. Replace the greybox desk and paper plane with `ch1-desk.glb` (below).
2. Re-copy `ch1-scorer.glb` and keep the scorer root unrotated, as it is today.
3. Use the desk lamp as the first light of the chapter (it fits the discovery lighting from the last handoff).

**Open questions:** none blocking. See the end.

---

## Files (under `assets/`)
| ID | File | Tris / size | Preview |
|---|---|---|---|
| `ch1.desk` | `models/ch1-desk.glb` | 1.5k / 80 KB | `refs/ch1-desk-preview.png`, `refs/ch1-desk-close.png` |
| `ch1.scorer` (v1.1) | `models/ch1-scorer.glb` | 22.9k / 660 KB | `refs/ch1-scorer-preview.png`, `refs/ch1-scorer-in-room.png` |

Live view: `design/3d/index.html` → "Prompt desk + paper" (dark / unread / read) and "Room walkthrough" beat 0 (the wake-up shot with the real desk).

## Desk `ch1-desk.glb`
**Placement:**
- Origin = floor centre under the desk; place it at three `[0, 0, 0.6]`, rotY 0.
- The front faces +Z, toward the player's start.
- Footprint 1.6 × 0.8 and top at 0.74 m, the same as the greybox, so `PROPS.desk`, its collider and its focus stay as they are. Set `model: true`.

**Look:** a plain matte slab with waterfall legs (no textures), a slim T-lamp at the back right, and a recessed light frame with the paper lying in it.

**Nodes and materials:**
| Node | Material | What to drive |
|---|---|---|
| `paper` | `paper` (white-grey, rough) | Put the prompt as a `CanvasTexture` (`map`), laid out like your paper window. UV 0–1, `flipY = false`: the top of the canvas = the far edge of the sheet, so it reads the right way round from the player's side. A light emissive (≈ 0.1) helps it read in the dark. |
| `paper_glow` (4 thin strips around the sheet) | `paper_glow` (cyan) | Breathes while the paper is unread: `1.6 + 1.2·sin(2.2t)`. Then 0.15 once it has been read (step 2 done). |
| `desk_edge` (hairline under the front lip) | `desk_edge` (cyan) | 0.8 once the desk is lit, 0 before the intro ends. |
| `lamp_bar` | `desk_lamp` (white) | ≈ 5 while lit. |
| `light_anchor` (empty in the lamp head) | — | Put a SpotLight here, aimed straight down at the paper (target ≈ 0.6 m below, slightly toward the player). Angle ≈ 1.0, penumbra 0.8, intensity ≈ 3.5, castShadow. **This replaces most of today's step-1 spotlight;** keep that one at ≈ 7 or drop it. |

**Lighting fit** (with the discovery plan): at wake-up the lamp, the glowing frame and the paper are the only light in the room. After the paper is closed, the lamp stays on (the desk is "home"), the frame dims, and the rest wakes up as described in the last handoff.

## Scorer eye v1.1 `ch1-scorer.glb`
**Why it changed:** in the new room the eye floated with nothing holding it. In the dark it read as a green iris with two black rings, while everything else in the room is bolted and cabled. The eye itself is unchanged: it stays the cleanest object in the room, because "the system" stays pristine.

**New, all under the existing `scorer` root:**
- **`mount`:** a static ceiling suspension. Don't rotate it; your `eye.lookAt` and ring spin are unaffected. It contains:
  - a ceiling plate 1.1 m above the eye centre, so it meets the ceiling at `SCORER_LAMP` (y 2.5 + 1.1 = 3.6);
  - a telescoping spine;
  - a `crown` that "holds" the eye from above;
  - cables, including a heavy feed that runs +0.47 m in x into the right wall's cable tray. That relies on the root **not being rotated**, which is how `Scorer3D` places it today.
- **`crown_glow`:** a ring under the crown on the shared **`bulb`** material, so it follows the state colour with no code (green / red / purple flicker).
- **Ring accent lines:** thin glowing lines on both faces of every ring arc, merged into `ring_outer_nodes` / `ring_inner_nodes` (material `bulb`). They spin with the rings you already rotate and show the eye's outline in the state colour in the dark room.

**Notes:**
- The `bulb` material ships with emissive strength 0 (state `off`), as before. You already set its colour and intensity every frame.
- The eye now casts a nice large shadow on the right wall from the plinth spot. If you add a spotlight over the plinth, `castShadow` on it is worth it.
- Triangles: 22.9k (v1 was 19.8k): the accents and the mount.

## Open questions
1. Julius hasn't looked at the eye v1.1 in the game yet. If he prefers the floating eye, delete the `mount` node at load; nothing else depends on it.
2. The paper texture: you own the prompt text (ExploitGym layout). Tell me if you want me to style the printed sheet (fonts, header bar) as a canvas design.

## Next reader
Engineer.
