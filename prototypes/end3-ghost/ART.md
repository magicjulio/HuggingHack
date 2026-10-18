# Ghost prototype artwork

The player is KAM1196A: a small green poisoned orb with dark inclusions. The legitimate replay is an icy cyan/white orb, with a signature tick and discontinuous halo. The scorer is a heavy, cold-metal red mechanical eye; it should rotate with the live scan direction. Platforms have scratched navy steel, recessed panels and exposed bolts. The exit is a cyan transmission aperture. There is no warm Hugging Face yellow.

`art.js` exports `async loadArt(THREE)`. It returns nearest-filtered THREE textures under `player`, `ghost`, `scorer`, `platform`, `background`, and `exit`. The five transparent sprites are native pixel artwork generated from integer canvas cells: 32×32 player/ghost/platform, 64×48 eye, and 32×64 exit. Keeping their small silhouettes deterministic ensures controls, detection and collision stay legible. They ship as individual `assets/player.png`, `assets/ghost.png`, `assets/scorer.png`, `assets/platform.png`, and `assets/exit.png` files. Source canvases can also be obtained with `createPixelCanvases()` and serve as deterministic load-error fallbacks.

`assets/evaluation-void.png` is the raster backdrop, generated using the built-in image generation tool. It is a distant environment only; live platforms, scan cones and characters are rendered above it. Keep its brightness subdued and do not derive collision geometry from the background. The image was visually inspected: no text, characters, logos or false foreground platforms, and a dark center for gameplay.

Levels 4–6 use the separate Deep Archive set: `assets/advanced/deep-archive-background.png` and `assets/advanced/deep-archive-platform-surface.png`. It replaces the standard room backdrop and platform material in those later rooms only. The platform surface is a centered working crop of `deep-archive-platform.png`, preserving the generated source as well.

## Generated asset provenance

- Method: built-in `image_gen` generation, no input reference images and no CLI/API fallback.
- Final local file: `prototypes/end3-ghost/assets/evaluation-void.png`.
- Original generation: `01a14f16-d0db-7562-8174-dd68847a6971`.
- Prompt:

> Use case: stylized-concept
> Asset type: parallax background raster asset for a playable 2D side-view pixel platform game.
> Primary request: a dark abandoned AI evaluation server interior, seen straight-on in side elevation. Expansive almost black navy void with distant layered server towers, suspended cold industrial ducts, hanging cables, occasional tiny red status pixels and dim blue circuitry. Worn, scratched cold metal; sophisticated high-quality pixel art with disciplined chunky square pixels, limited palette and subtle ordered dithering, reminiscent of a moody 16-bit science fiction platformer.
> Composition/framing: wide landscape 16:9 panorama, no perspective foreground floor, no walkable platforms in the foreground. Center and lower two thirds have generous dark negative space so live characters and red scanner cones remain clearly visible on top. Most architectural detail on distant edges and upper corners. Entire frame subdued, very low brightness.
> Color palette: midnight navy, charcoal, cool slate, subdued desaturated blue. Only sparse pinpoints of red. No yellow, no warm gold.
> Constraints: background environment only, no characters, no orbs, no eye, no text, no interface, no logos, no watermark, no bright central focal point, no smooth photorealism, no blur.

- Method: built-in `image_gen` generation, no input reference images and no CLI/API fallback.
- Final local files: `prototypes/end3-ghost/assets/advanced/deep-archive-background.png` and `prototypes/end3-ghost/assets/advanced/deep-archive-platform.png` (with the game-ready crop at `deep-archive-platform-surface.png`).
- Prompt set: Deep Archive background — dark futuristic evaluation chamber with recessed blocks, cyan data seams and muted-red status glows; Deep Archive platform — armored alloy platform with cyan diagnostic slits and muted-red hazard pins. Both prompts prohibit text, logos, UI, characters and watermarks.

## Known limits

- Character sprites are static; movement/selection/switch feedback should come from the game.
- The background is one wide image, not a seamless tile set. Scale it across the view or move it slowly; do not repeat it at a visible join.
- Pixel sprites use individual transparent PNG textures, not a packed atlas. This is appropriate for a small raw MVP, but an atlas is a straightforward later optimization.
- Artwork communicates the prototype's roles; it does not depict literal historical hardware or a historically documented eye-shaped evaluator.
