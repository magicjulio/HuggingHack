// app: tall Deep Archive blocks (rooms 4–6) as storage racks, painted per block at the block's own screen
// size (30 px per world unit), so the pixels stay 1:1 crisp. The slab art (2172 × 430) only reads well as a
// low slab; squeezed or stretched over a tall block it smeared. Palette taken from the slab art.
const C = {
  outline: "#070b12",
  body: "#0d151f",
  postL: "#26343f",
  postLit: "#3b4e5e",
  postR: "#18222e",
  cap: "#2a3a4a",
  capTop: "#6f8996",
  capLip: "#3e5262",
  capShade: "#1b2633",
  cyan: "#53d7df",
  cyanDim: "#2a7d86",
  ledOff: "#1d4f57",
  red: "#d2404a",
  divider: "#1f2c39",
  dividerLit: "#33465a",
  drawer: "#172230",
  drawerTop: "#2c3c4d",
  drawerShade: "#0a1019",
  label: "#3a4b5c",
  base: "#18222e",
  baseTop: "#2c3b4a",
};

// small deterministic hash: the same block always paints the same lights
const hash = (a, b, c) => {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** @returns {HTMLCanvasElement} a rack w × h px (whole pixels), `seed` varies the lights per block */
export function rackCanvas(w, h, seed = 0) {
  const image = document.createElement("canvas");
  image.width = w;
  image.height = h;
  const c = image.getContext("2d");
  const rect = (x, y, rw, rh, color) => {
    if (rw <= 0 || rh <= 0) return;
    c.fillStyle = color;
    c.fillRect(x, y, rw, rh);
  };
  rect(0, 0, w, h, C.outline);
  rect(1, 1, w - 2, h - 2, C.body);

  // side posts
  const post = w >= 40 ? 4 : 3;
  rect(1, 1, post, h - 2, C.postL);
  rect(1, 1, 1, h - 2, C.postLit);
  rect(w - 1 - post, 1, post, h - 2, C.postR);

  // cap: lit top edge, a row of cyan slits, red marker lights at the ends
  const capH = Math.max(8, Math.min(16, Math.round(h * 0.12)));
  rect(1, 1, w - 2, capH, C.cap);
  rect(1, 1, w - 2, 2, C.capTop);
  rect(1, 3, w - 2, 1, C.capLip);
  rect(1, capH - 1, w - 2, 1, C.capShade);
  rect(1, capH, w - 2, 1, C.outline);
  const slitY = Math.round(capH / 2);
  if (w >= 24) {
    for (let x = post + 5; x + 6 <= w - post - 5; x += 22) {
      rect(x, slitY, 6, 2, C.cyan);
      rect(x, slitY + 2, 6, 1, C.cyanDim);
    }
    if (w >= 60) {
      rect(post + 1, slitY, 2, 2, C.red);
      rect(w - post - 3, slitY, 2, 2, C.red);
    }
  } else rect(Math.floor(w / 2) - 1, slitY, 2, 2, C.cyan);

  // base
  const baseH = 5;
  rect(1, h - 1 - baseH, w - 2, baseH, C.base);
  rect(1, h - 1 - baseH, w - 2, 1, C.baseTop);

  // body: bays of drawers between cap and base
  const top = capH + 1,
    bottom = h - 1 - baseH,
    left = 1 + post,
    right = w - 1 - post,
    inner = right - left;
  const bays = Math.max(1, Math.round(inner / 54)),
    gap = bays > 1 ? 4 : 0,
    bayW = (inner - gap * (bays - 1)) / bays;
  const pitch = 16;
  for (let b = 0; b < bays; b++) {
    const x0 = Math.round(left + b * (bayW + gap)),
      x1 = Math.round(left + b * (bayW + gap) + bayW);
    if (b > 0) {
      const dx = x0 - gap;
      rect(dx, top, gap, bottom - top, C.divider);
      rect(dx, top, 1, bottom - top, C.dividerLit);
      // cyan light strips along the divider, like the slab art's uprights
      for (let y = top + 6; y + 12 <= bottom - 4; y += 40) rect(dx + 1, y, 2, 12, C.cyan);
    }
    const dw = x1 - x0;
    for (let row = 0, y = top + 2; y + pitch - 2 <= bottom; row++, y += pitch) {
      rect(x0 + 2, y, dw - 4, pitch - 3, C.drawer);
      rect(x0 + 2, y, dw - 4, 1, C.drawerTop);
      rect(x0 + 2, y + pitch - 4, dw - 4, 1, C.drawerShade);
      const lw = dw >= 30 ? 8 : 4;
      rect(x0 + Math.round((dw - lw) / 2), y + 5, lw, 2, C.label);
      const r = hash(seed, b, row);
      const led = r < 0.08 ? C.red : r < 0.3 ? C.cyan : C.ledOff;
      if (dw >= 16) rect(x1 - 6, y + 5, 2, 2, led);
    }
  }
  return image;
}
