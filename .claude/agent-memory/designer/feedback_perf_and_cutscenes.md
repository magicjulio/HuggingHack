---
name: feedback-perf-and-cutscenes
description: Julius loved the Step 7 film approach and worries about lag on players' machines; measure perf, don't guess
metadata:
  type: feedback
---
Julius accepted the Step 7 cutscene at once (2026-10-14: "THIS IS AMAZING AND EXACTLY WHAT i wanted"). What worked: a scrubbable animatic page on the real world modules, the script's shot list beat by beat, memory stills + DOM texts under one flashback post effect, and a director module (`world/step7.js`) as the single source of timing.

His one worry: "whether the players computer / browser will be able to play this without lags".

**Why:** it's a browser game for a general audience, so laptops with integrated GPUs are the floor.

**How to apply:**
- For every heavy scene, measure on this machine (Intel Iris Xe, a good low-end reference) with the probes: `CUTSCENE.bench`/`coldFrame`, real playback with vsync ON. With vsync off the measurements give fake 200–500 ms stalls; don't trust them.
- Report numbers, not reassurance.
- Cheap wins first: bake slow procedural stuff (the sky), pre-upload textures, warm shaders, MSAA/resolution tiers.

Related: [[feedback-ch2-world-look]], [[feedback-show-progress]].
