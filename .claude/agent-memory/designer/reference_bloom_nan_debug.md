---
name: bloom-nan-debug
description: flat/black blocks under bloom = a NaN pixel; how to find it fast (route-patch + hide-children bisect)
metadata:
  type: reference
---

Under UnrealBloom/pmndrs bloom, a frame that goes flat black or dark blue (whole frame or a big block) is one NaN pixel spread by the blur. Known sources so far: zero-scaled instances, degenerate tube frames (Ch2 bridge), `pow(1.0 - dot(vN,vV), k)` when the dot is slightly above 1 (ASCENT orb, 2026-10-17).

How to find it: 1) a Playwright `page.route` that rewrites `bloom = true`→false or patches the shader in the response, which proves the cause without editing files I don't own; 2) hide `scene.children[i]` one at a time and measure the PNG byte size of a screenshot clip (a flat block compresses to about 1.5 KB, real content to 80 KB or more). Scripts are in the job tmp folder, and the pattern is easy to rewrite. Related: [[feedback_ch2_world_look]].
