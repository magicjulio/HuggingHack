# Designer → App: ASCENT flat-screen bug, a one-line shader fix

**What it is:** the cause and the fix for the bug Julius hit in `prototypes/end2-ascent/`. Part of the screen, or all of it, turns into a flat dark-blue block, mostly while you aim and fire. The lab's `?view=lineup` shows the same thing.
**What changed since the last handoff:** nothing has been exported. This is a bug report with a tested fix. I didn't edit `prototypes/`, because it isn't mine to write.
**What the receiver must do:** apply the one-line change below in `prototypes/end2-ascent/models.js:64`, and in any copy you port into `app/`.
**Open questions:** none.

## The cause
`orbMaterial()` (`models.js:64`) is the player's head and every escort and subagent orb. Its fresnel term is:
```glsl
float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
```
`vN` and `vV` are interpolated varyings, so they are not exactly unit length. When a pixel faces the camera head on, `dot(vN, vV)` comes out a hair **above 1.0**. That makes the base negative, and GLSL's `pow` of a negative base returns **NaN**. One NaN pixel goes into the half-float target. `UnrealBloomPass` blurs it over its mip chain, and the grade pass shows the result as a flat block. It is the same failure mode as the "one NaN pixel blacks out the bloom" rule on Ch2.

## The fix (tested)
```glsl
float fres = pow(clamp(1.0 - dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.2);
```
I tested this by patching `models.js` in the browser only (Playwright route), on the real GPU (Vulkan, 1600×900):

| Check | Before | After |
|---|---|---|
| Lab `?view=lineup` | right ~90 % of the frame flat | renders fully |
| Game: 12 aim/fire frames on floor 1, aiming at different enemies | 6 / 12 flat | 0 / 12 flat |

Stills: `shots-2026-10-17-ascent-nan/{lineup,aim}-{before,after}.png`.

That is the only `pow(` in the ASCENT, end1-swing and `app/src/levels/end1` shaders.

**Rule for new shaders:** clamp the base before any `pow`. Normalize varyings in the fragment shader before taking a dot product.

## Next reader
Engineer.
