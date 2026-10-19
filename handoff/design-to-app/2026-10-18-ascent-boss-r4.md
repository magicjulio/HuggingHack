# ASCENT round 4, boss: the look of GLM-5.2, the end boss (2026-10-18/19)

**What it is:** the boss agent's delivery for round 4 (`2026-10-18-ascent-team-brief-r4.md`): the end boss's 3D look and its model API (Contract 2), for fight's `boss.js`.
**What changed since the last handoff:** this is new. `boss-model.js` replaces fight's stub boss in the game (`main.js` already imports it). It adds `end2-boss.glb`, a lab view, and `BOSS.md`.
**What the receiver must do:** Julius plays floor 3 and reviews the look in the lab (links below), then answers "For Julius". Fight: the API is final as written in `BOSS.md`. The optional extras are listed there. Engineer: nothing yet (prototype only).
**Open questions:** listed under "For Julius". The boss is named **GLM-5.2** (Julius, DECISIONS 2026-10-19). The model carries no text.

## What's done
- **`prototypes/end2-ascent/boss-model.js`** → `createBossModel(opts)`, the full Contract 2 API plus `impact(side, pos)`, `dispose()` and the optional `setCharge`, `setDying`, `isWeak` and `stats`. Contract and knobs: **`BOSS.md`**.
- **The face is the logo itself.** Eyes, mouth, tongue and cheeks are built at runtime from `assets/hf-logo.svg`, sampled along rays around each feature and laid onto a slightly flattened dome (`bossZ`). The neutral face is the unmodified logo, in its colours.
- **Expressions are morph targets**, all in logo colours, eased in about 0.1–0.15 s:
  - **angry** (phase 3, the sanctioned change): thick ink brows slanted down hard, the logo's notched eyes cut by the brows, a downturned snarl with white teeth, cheeks from amber to logo red, the red anger mark (💢), steam from the ear vents, a rage tremble.
  - **hurt**: `> <` eyes, worried brows, a small wobbly mouth.
  - **roar**: a huge open mouth with teeth, a squint, and rings of force out of the mouth.
- **Mechanical take (Blender, `design/3d/end2/boss/boss.py` → `end2-boss.glb`):**
  - the logo's orange outline as a bolted armour bezel in 12 pieces
  - a gunmetal back dome with armour plates (logo yellow near the rim), ribs, phase-glow strips, steam "ears" and three thrusters
  - worn `kit.surface()` paint throughout
  - the logo hands as articulated gauntlets: rigid finger joints, an orange outline trim and knuckle plates, a wrist cuff with a thruster, and back-of-hand vent shutters over the weak core
- **Hand poses** (`setHandPose`):
  - open: the logo pose
  - fist: the wind-up
  - slam: flat, palm down, the palm point is the contact point
  - stuck: lying splayed with twitching fingers, the vents slide open, the **orange core glows and sparks** (the weak point read)
- **Damage:** glowing cracks across the face (stage 1 at 66 %, more at 33 %), sparks and smoke from the cracks, torn shell plates (`dmg1`), and at stage 2 the bezel chunk breaks off with live wires (`dmg2`).
- **Phase look:** the accent glow goes amber → orange → **red**, pulsing faster each phase, and the crack glow follows.
- **Boss fx:**
  - slam dust ring along the floor, a dust column, debris chips, sparks, and a cracked crater decal (fades in ~9 s)
  - roar rings, steam, the hit flash (a stuck hand flashes hot orange)
  - blob shadows under the face and under each hand (a hand's shadow tightens as it comes down)
- **Budgets:** head 26.9k tris in total (shell 15.7k + the procedural face), hands 7.95k each.
- **Lab:** `lab.html?view=boss` (the sheet: expressions · phases 1–3 with damage 0–2 · hand poses) and `lab.html?view=boss&solo` (full size beside the player, with knobs: expression + blend slider, phase, damage, poses, a scripted slam, flash, a phase-change roar). Code: `boss-lab.js`. `lab.js` only got a view entry and one branch.

## How to view
- Serve `prototypes/` (`prototypes/serve.sh`, 8765), then open `…/end2-ascent/lab.html?view=boss` and `…?view=boss&solo`. URL state: `&expr=angry&k=1&phase=3&damage=2&pose=stuck`.
- In the game: `…/end2-ascent/?floor=3&at=arena&phase=3` (fight's test entry).
- Previews: `design/3d/end2/previews/boss-r4-{sheet,neutral,angry,roar,side,stuck,ingame}.png`, and Blender checks `boss-r4-blender-*.png` (off-colour lighting, shapes only).

## Verified
- `node prototypes/end2-ascent/smoke.mjs` passes: intro → floor 1 → lift → floor 2 → express → floor 3 → boss → end card, no browser errors.
- Real GPU (Iris Xe, Vulkan, 1920×1080), `?test=1`, `toArena(3)` with wave 3 awake:
  - with the boss: **28–29 fps**
  - with the boss hidden: **32 fps**
  - p50 frame time is 33.3 ms in both cases, so the arena is already over the 16.7 ms budget without the boss, and the boss costs roughly 2–3 ms.
  - The boss alone in the lab runs at 60 fps at full size.
  - Flat-frame check: every preview is 0.5–1.8 MB.

## Left / not done
- **Perf of the arena** (arena/fight): floor 3 is at ~30 fps at 1080p even without the boss. My part could still lose about 1 ms by merging finger joints into a skinned mesh (~30 draws per hand now) and cutting the dust overdraw.
- The face's worn paint (`bossFacePaint`) shows vertical drip streaks; it may be too dirty for the logo. A tuning pass waits for Julius's eye.
- The hand texture's chips read a little like cork up close; a hand realism pass (modelled panel seams, fewer chips) is the next art step.
- `setDying(k)` exists, but `boss.js` doesn't call it yet (fight: an optional one-liner in the death beat).

## For Julius (all proposals, each behind a knob)
1. **The angry face** (the highlight): brows + cut eyes + snarl with teeth + red cheeks + 💢 + steam + tremble. Knobs: `bossVein`, `bossFlush`, `bossTeeth`, `bossSteam`, `bossTremble` (0 = off). Funny enough? Too much?
2. **Face depth:** `bossZ` (0.82 = a slightly flattened dome; 1 = a full ball; 0.6 = closer to the flat logo).
3. **Worn paint on the face:** on by default; `bossFacePaint=0` = the clean logo yellow (the hands and shell stay worn).
4. **The mechanical take:** an armoured back shell and gauntlets. Does it still read as the logo from the front?
5. **Hurt and roar faces** (`> <` eyes; a giant mouth with teeth).
6. **Hand pose readability:** the weak point = vents open + glowing orange core + sparks.
7. **Scale:** face radius 7 m (about 15 m tall with the bezel, the top at about 21 m on `faceY` 6). Knob `radius` in `opts`, or `&radius=` in the lab.
