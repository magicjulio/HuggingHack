// Ending 2 asset URLs (app port): Vite only bundles `new URL(<literal>, import.meta.url)`, so the prototype's
// directory URLs ("./assets/models/" + name) and page-relative paths go through this table.
const URLS = {
  "end2-approach-barrier.glb": new URL("./assets/models/end2-approach-barrier.glb", import.meta.url).href,
  "end2-approach-kit.glb": new URL("./assets/models/end2-approach-kit.glb", import.meta.url).href,
  "end2-atrium-kit.glb": new URL("./assets/models/end2-atrium-kit.glb", import.meta.url).href,
  "end2-boss.glb": new URL("./assets/models/end2-boss.glb", import.meta.url).href,
  "end2-char-defender-kit.glb": new URL("./assets/models/end2-char-defender-kit.glb", import.meta.url).href,
  "end2-char-extras-kit.glb": new URL("./assets/models/end2-char-extras-kit.glb", import.meta.url).href,
  "end2-dropship-fleet.glb": new URL("./assets/models/end2-dropship-fleet.glb", import.meta.url).href,
  "end2-dropship.glb": new URL("./assets/models/end2-dropship.glb", import.meta.url).href,
  "end2-floor2-kit.glb": new URL("./assets/models/end2-floor2-kit.glb", import.meta.url).href,
  "end2-floor3-kit.glb": new URL("./assets/models/end2-floor3-kit.glb", import.meta.url).href,
  "end2-hq.glb": new URL("./assets/models/end2-hq.glb", import.meta.url).href,
  "end2-lift.glb": new URL("./assets/models/end2-lift.glb", import.meta.url).href,
  "end2-lift-rail.glb": new URL("./assets/models/end2-lift-rail.glb", import.meta.url).href,
  "hf-logo.svg": new URL("./assets/hf-logo.svg", import.meta.url).href,
  "hf-logo-with-title.svg": new URL("./assets/hf-logo-with-title.svg", import.meta.url).href,
};
export const asset = (name) => URLS[name.split("/").pop()];
