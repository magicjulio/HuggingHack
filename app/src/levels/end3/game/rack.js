// app: tall Deep Archive blocks (rooms 4–6) built from the slab art itself (deep-archive-platform-surface.png,
// 2172 × 430), cut like a nine-slice at one fixed scale: the end posts become the block's sides, bays and
// uprights repeat across, the panel band repeats down, with one cap on top and one base below. Stretching
// a single slab over a tall block smeared it, and stacking whole slabs read as a pile of bricks.
// Painted once per block at its screen size (30 px per world unit), smoothly downscaled from the art.

// source rectangles in the slab art's pixels, [from, to)
const LEFT = [40, 176],
  RIGHT = [2000, 2136],
  BAYS = [
    [176, 704],
    [840, 1328],
    [1464, 2000],
  ],
  UPRIGHTS = [
    [704, 840],
    [1328, 1464],
  ];
const CAP = [4, 126],
  BODY = [126, 366],
  BASE = [366, 430];
// screen px per art px: the full slab is about 8 world units wide, like room 6's low blocks
const SCALE = 30 / 270;

const span = ([a, b]) => b - a;

// lay source pieces across a target length: [src, dstFrom, dstTo] with whole-pixel edges
function lay(pieces, length) {
  const total = pieces.reduce((n, p) => n + span(p), 0);
  let at = 0;
  return pieces.map((p) => {
    const from = Math.round((at / total) * length);
    at += span(p);
    return [p, from, Math.round((at / total) * length)];
  });
}

function columns(w) {
  const ends = (span(LEFT) + span(RIGHT)) * SCALE;
  const unit = (span(BAYS[0]) + span(UPRIGHTS[0])) * SCALE;
  // a narrow wall is just the two end posts
  if (w < ends + 0.5 * span(BAYS[0]) * SCALE) return lay([LEFT, RIGHT], w);
  const n = Math.max(1, Math.round((w - ends + span(UPRIGHTS[0]) * SCALE) / unit));
  const pieces = [LEFT];
  for (let i = 0; i < n; i++) {
    if (i) pieces.push(UPRIGHTS[(i - 1) % UPRIGHTS.length]);
    pieces.push(BAYS[i % BAYS.length]);
  }
  pieces.push(RIGHT);
  return lay(pieces, w);
}

function rows(h) {
  const cap = Math.round(span(CAP) * SCALE),
    base = Math.round(span(BASE) * SCALE),
    body = h - cap - base;
  const m = Math.max(1, Math.round(body / (span(BODY) * SCALE)));
  const out = [[CAP, 0, cap]];
  for (let i = 0; i < m; i++)
    out.push([BODY, cap + Math.round((i * body) / m), cap + Math.round(((i + 1) * body) / m)]);
  out.push([BASE, h - base, h]);
  return out;
}

/** @param {CanvasImageSource} art the slab art · @returns {HTMLCanvasElement} a block w × h px */
export function archiveBlockCanvas(art, w, h) {
  const image = document.createElement("canvas");
  image.width = w;
  image.height = h;
  const c = image.getContext("2d");
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  for (const [sy, dy0, dy1] of rows(h))
    for (const [sx, dx0, dx1] of columns(w))
      if (dx1 > dx0 && dy1 > dy0)
        c.drawImage(art, sx[0], sy[0], span(sx), span(sy), dx0, dy0, dx1 - dx0, dy1 - dy0);
  return image;
}
