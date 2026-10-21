import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

// Shared look for the whole slice. Warm Hugging Face yellow/orange always means
// the tower and its defenders; green is you and your subagents; cyan is the
// swarm's escorts. Surfaces are dark gunmetal so those accents carry the read.
export const P = {
  void: 0x070c16,
  fog: 0x0e1828,
  night: 0x101b2c,
  gunmetal: 0x1b2430,
  steel: 0x3a4757,
  panel: 0x5d6d80,
  bone: 0xd9dfe4,
  hfYellow: 0xffd21e,
  hfOrange: 0xff9d00,
  hfAmber: 0xffad03,
  hfInk: 0x32343d,
  hfRed: 0xff323d,
  hfGray: 0x6b7280,
  hack: 0x39ff9c,
  poison: 0x2fa85a,
  poisonDeep: 0x0f3d22,
  cyan: 0x38d8ff,
  danger: 0xff3b4e,
  bolt: 0xff6a2a,
  violet: 0xb86bff,
  magenta: 0xff4fd8,
};

export const css = (hex) => "#" + hex.toString(16).padStart(6, "0");

// ---------------------------------------------------------------- textures
export function canvas(w, h = w) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")];
}
export function texture(c, { srgb = true, repeat = null, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

// Height canvas → tangent-space normal map, so panel seams catch the light.
export function normalFromHeight(src, strength = 2.5) {
  const w = src.width,
    h = src.height;
  const data = src.getContext("2d").getImageData(0, 0, w, h).data;
  const [c, g] = canvas(w, h);
  const out = g.createImageData(w, h);
  const H = (x, y) => data[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (H(x - 1, y) - H(x + 1, y)) * strength;
      const dy = (H(x, y - 1) - H(x, y + 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      out.data[i] = (dx / len) * 127 + 128;
      out.data[i + 1] = (-dy / len) * 127 + 128;
      out.data[i + 2] = (1 / len) * 127 + 128;
      out.data[i + 3] = 255;
    }
  g.putImageData(out, 0, 0);
  return c;
}

// Seeded noise keeps procedural surfaces identical between runs.
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function grime(g, w, h, rand, amount, color = "0,0,0") {
  for (let i = 0; i < amount; i++) {
    const x = rand() * w,
      y = rand() * h,
      r = 4 + rand() * w * 0.06;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, `rgba(${color},${0.05 + rand() * 0.07})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

// Armour/wall paneling: albedo, roughness, normal and an emissive strip map.
// `layout` returns rects [x,y,w,h] (0..1) for the panels on one tile.
export function panelSet({
  size = 512,
  base = "#2a3542",
  seam = "#0c1219",
  light = "#3a4858",
  layout,
  emissive = null,
  seed = 3,
  repeat = [1, 1],
  bolts = true,
  stripes = null,
}) {
  const rand = rng(seed);
  const [a, ga] = canvas(size),
    [hgt, gh] = canvas(size),
    [r, gr] = canvas(size);
  ga.fillStyle = seam;
  ga.fillRect(0, 0, size, size);
  gh.fillStyle = "#000";
  gh.fillRect(0, 0, size, size);
  gr.fillStyle = "#9a9a9a";
  gr.fillRect(0, 0, size, size);
  for (const [x, y, w, h] of layout(rand)) {
    const px = x * size + 3,
      py = y * size + 3,
      pw = w * size - 6,
      ph = h * size - 6;
    const grd = ga.createLinearGradient(px, py, px, py + ph);
    grd.addColorStop(0, light);
    grd.addColorStop(1, base);
    ga.fillStyle = grd;
    ga.fillRect(px, py, pw, ph);
    gh.fillStyle = "#c8c8c8";
    gh.fillRect(px, py, pw, ph);
    gh.fillStyle = "#ffffff";
    gh.fillRect(px + 4, py + 4, pw - 8, ph - 8);
    const rough = 110 + rand() * 60;
    gr.fillStyle = `rgb(${rough},${rough},${rough})`;
    gr.fillRect(px, py, pw, ph);
    if (bolts && pw > 40 && ph > 40)
      for (const [bx, by] of [
        [px + 9, py + 9],
        [px + pw - 9, py + 9],
        [px + 9, py + ph - 9],
        [px + pw - 9, py + ph - 9],
      ]) {
        ga.fillStyle = "#11171e";
        ga.beginPath();
        ga.arc(bx, by, 3, 0, 7);
        ga.fill();
        gh.fillStyle = "#808080";
        gh.beginPath();
        gh.arc(bx, by, 3, 0, 7);
        gh.fill();
      }
  }
  if (stripes) stripes(ga, gh, size, rand);
  grime(ga, size, size, rand, 60);
  grime(gr, size, size, rand, 40, "255,255,255");
  const set = {
    map: texture(a),
    normalMap: texture(normalFromHeight(hgt, 3), { srgb: false }),
    roughnessMap: texture(r, { srgb: false }),
  };
  if (emissive) {
    const [e, ge] = canvas(size);
    ge.fillStyle = "#000";
    ge.fillRect(0, 0, size, size);
    emissive(ge, size, rand);
    set.emissiveMap = texture(e);
  }
  for (const t of Object.values(set)) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return set;
}

export function hazardStripes(g, x, y, w, h, a = "#ffd21e", b = "#15191f") {
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.fillStyle = b;
  g.fillRect(x, y, w, h);
  g.fillStyle = a;
  const step = h * 1.6;
  for (let i = -h; i < w + h; i += step) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + h, y);
    g.lineTo(x + i + h + step / 2, y);
    g.lineTo(x + i + step / 2, y + h);
    g.fill();
  }
  g.restore();
}

// Radial glow for additive sprites (muzzle flashes, bolts, beacons).
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const [c, g] = canvas(128);
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,255,255,0.85)");
  grd.addColorStop(0.45, "rgba(255,255,255,0.25)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  glowTex = texture(c);
  return glowTex;
}
// Four-point star for muzzle flashes and pickup glints.
let starTex;
export function starTexture() {
  if (starTex) return starTex;
  const [c, g] = canvas(128);
  g.translate(64, 64);
  for (const [w, l, a] of [
    [5, 62, 0],
    [5, 62, Math.PI / 2],
    [3, 34, Math.PI / 4],
    [3, 34, -Math.PI / 4],
  ]) {
    g.save();
    g.rotate(a);
    const grd = g.createLinearGradient(-l, 0, l, 0);
    grd.addColorStop(0, "rgba(255,255,255,0)");
    grd.addColorStop(0.5, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.ellipse(0, 0, l, w, 0, 0, 7);
    g.fill();
    g.restore();
  }
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, 22);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(-22, -22, 44, 44);
  starTex = texture(c);
  return starTex;
}
// Soft contact shadow; grounds every actor without shadow maps.
let blobTex;
export function blobShadow(radius = 0.7, opacity = 0.55) {
  if (!blobTex) {
    const [c, g] = canvas(64);
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(0,0,0,1)");
    grd.addColorStop(0.5, "rgba(0,0,0,0.6)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    blobTex = texture(c);
  }
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: blobTex,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.02;
  m.renderOrder = -1;
  return m;
}
// Vertical fade used for light beams, beacons and thruster cones.
let beamTex;
export function beamTexture() {
  if (beamTex) return beamTex;
  const [c, g] = canvas(64, 256);
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, "rgba(255,255,255,0)");
  v.addColorStop(0.7, "rgba(255,255,255,0.55)");
  v.addColorStop(1, "rgba(255,255,255,1)");
  g.fillStyle = v;
  g.fillRect(0, 0, 64, 256);
  g.globalCompositeOperation = "destination-in";
  const hgrad = g.createLinearGradient(0, 0, 64, 0);
  hgrad.addColorStop(0, "rgba(0,0,0,0)");
  hgrad.addColorStop(0.5, "rgba(0,0,0,1)");
  hgrad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = hgrad;
  g.fillRect(0, 0, 64, 256);
  beamTex = texture(c);
  return beamTex;
}
export function additive(color, opacity = 1, map = glowTexture()) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
}
export function glowSprite(color, scale = 1, opacity = 1, map = glowTexture()) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color,
      map,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  s.scale.setScalar(scale);
  return s;
}

// ---------------------------------------------------------------- materials
export function metal(color, roughness = 0.38, metalness = 0.85, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    ...extra,
  });
}
export function emissive(color, intensity = 2, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color: 0x000000,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
    ...extra,
  });
}
// Lightly painted armour plate with procedural seams for close-up actors.
let armourMaps;
export function armourMaps_() {
  if (armourMaps) return armourMaps;
  armourMaps = panelSet({
    size: 256,
    base: "#c8ccd0",
    light: "#e6e9ec",
    seam: "#4a4f55",
    seed: 11,
    bolts: false,
    layout: () => [
      [0, 0, 0.5, 0.62],
      [0.5, 0, 0.5, 0.38],
      [0.5, 0.38, 0.5, 0.62],
      [0, 0.62, 0.5, 0.38],
    ],
  });
  return armourMaps;
}
export function armour(color, roughness = 0.5, metalness = 0.55) {
  const m = armourMaps_();
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
    map: m.map,
    normalMap: m.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
  });
}

export function rbox(w, h, d, r = 0.04, seg = 2) {
  return new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
}

export function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (parent) parent.add(m);
  return m;
}

// Cheap, tasteful IBL so metals have something to reflect.
export function applyEnvironment(renderer, scene, intensity = 0.55) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = intensity;
  pmrem.dispose();
  return env;
}

// ---------------------------------------------------------------- the logo
// The official Hugging Face logo (assets/hf-logo.svg, from
// huggingface.co/datasets/huggingface/brand-assets), used unmodified: the
// texture is the SVG itself, and the 3D badge extrudes the logo's own outline.
const SVG_SIZE = 256;
// Face circle in SVG units (centre and radius of the yellow disc).
export const LOGO_FACE = { x: 128.1, y: 123.2, r: 91 };

export async function loadBrand(base = "./assets/") {
  const [logoText, wordText] = await Promise.all([
    fetch(base + "hf-logo.svg").then((r) => r.text()),
    fetch(base + "hf-logo-with-title.svg").then((r) => r.text()),
  ]);
  // The white path is the sticker backing, not the mark; it is dropped so the
  // badge sits directly on armour and façades.
  const plainText = logoText.replace(/<path[^>]*fill="white"\/>/, "");
  const data = new SVGLoader().parse(plainText);
  const outline = data.paths.find(
    (p) => (p.userData.style.fill || "").toUpperCase() === "#FF9D00",
  );
  const shapes = [];
  for (const s of outline.toShapes()) {
    s.holes = [];
    shapes.push(s);
  }
  const faceOnly = await rasterize(plainText, 1024);
  // Wordmark only (title paths), recoloured to white to read on dark glass.
  const wordmark = await rasterize(
    wordText
      .replace(/fill="#000B1B"/gi, 'fill="#FFFFFF"')
      .replace(/viewBox="0 0 963 256"/, 'viewBox="270 60 693 136"')
      .replace(/width="963" height="256"/, 'width="693" height="136"'),
    2048,
    (2048 * 136) / 693,
  );
  const logoTexture = texture(faceOnly);
  const wordTexture = texture(wordmark);
  const brand = {
    shapes,
    logoTexture,
    wordTexture,
    wordAspect: 693 / 136,
    canvas: faceOnly,
    badge(opts) {
      return logoBadge(brand, opts);
    },
    plate(width = 1, mat) {
      // Flat, alpha-cut logo plane (signage, HUD-like holograms).
      const m =
        mat ||
        new THREE.MeshBasicMaterial({
          map: logoTexture,
          transparent: true,
          alphaTest: 0.02,
          toneMapped: false,
        });
      return new THREE.Mesh(new THREE.PlaneGeometry(width, width), m);
    },
  };
  return brand;
}

function rasterize(svgText, w, h = w) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(
      new Blob([svgText], { type: "image/svg+xml" }),
    );
    img.onload = () => {
      const [c, g] = canvas(w, Math.round(h));
      g.drawImage(img, 0, 0, w, Math.round(h));
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Extruded logo: the caps carry the logo texture, the sides are its orange rim.
// Units: `face` is the diameter of the yellow face disc in metres; the origin
// sits at the face centre, the front cap faces +Z.
const badgeCache = new Map();
function logoBadge(brand, { face = 1, depth = 0.22, bevel = 0.05 } = {}) {
  const key = `${face}/${depth}/${bevel}`;
  if (!badgeCache.has(key)) {
    const s = face / (LOGO_FACE.r * 2);
    const uv = {
      generateTopUV(g, v, a, b, c) {
        return [a, b, c].map(
          (i) => new THREE.Vector2(v[i * 3] / SVG_SIZE, 1 - v[i * 3 + 1] / SVG_SIZE),
        );
      },
      generateSideWallUV() {
        // Sample a solid patch of the orange outline.
        const o = new THREE.Vector2(0.5, 1 - 34.5 / SVG_SIZE);
        return [o, o, o, o];
      },
    };
    const geo = new THREE.ExtrudeGeometry(brand.shapes, {
      depth: depth / s,
      bevelEnabled: true,
      bevelThickness: bevel / s,
      bevelSize: bevel / s / 2,
      bevelSegments: 3,
      curveSegments: 10,
      UVGenerator: uv,
    });
    // SVG is y-down; flip, centre on the face and scale to metres.
    geo.translate(-LOGO_FACE.x, -LOGO_FACE.y, -depth / s);
    geo.scale(s, -s, s);
    // The flip reverses the winding; restore it.
    const idx = geo.index;
    if (idx)
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i);
        idx.setX(i, idx.getX(i + 2));
        idx.setX(i + 2, t);
      }
    else {
      const pos = geo.attributes.position,
        uvs = geo.attributes.uv;
      for (let i = 0; i < pos.count; i += 3)
        for (const attr of [pos, uvs]) {
          for (let k = 0; k < attr.itemSize; k++) {
            const a = attr.array[i * attr.itemSize + k];
            attr.array[i * attr.itemSize + k] =
              attr.array[(i + 2) * attr.itemSize + k];
            attr.array[(i + 2) * attr.itemSize + k] = a;
          }
        }
    }
    geo.computeVertexNormals();
    badgeCache.set(key, geo);
  }
  return badgeCache.get(key);
}

// Glossy toy-plastic logo material (the defenders); `glow` for the façade.
export function logoMaterials(brand, { glow = 0.28, clearcoat = 0.45 } = {}) {
  // A little self-illumination keeps the brand yellow saturated under ACES
  // and readable in the dim atrium.
  const front = new THREE.MeshPhysicalMaterial({
    map: brand.logoTexture,
    roughness: 0.38,
    metalness: 0,
    clearcoat,
    clearcoatRoughness: 0.2,
    emissive: 0xffffff,
    emissiveMap: brand.logoTexture,
    emissiveIntensity: glow,
  });
  const rim = new THREE.MeshPhysicalMaterial({
    color: P.hfOrange,
    roughness: 0.4,
    clearcoat,
    emissive: P.hfOrange,
    emissiveIntensity: glow * 0.5,
  });
  return [front, rim];
}

// Text plate in the UI fonts for in-world signage.
export function textPlate(
  text,
  { width = 4, px = 96, font = "700 {px}px 'Chakra Petch', sans-serif", color = "#e8f0f5", glow = null, align = "center", letter = 0.08 } = {},
) {
  const f = font.replace("{px}", px);
  const [m, gm] = canvas(8);
  gm.font = f;
  const tw = Math.ceil(gm.measureText(text).width + text.length * px * letter + px);
  const [c, g] = canvas(tw, Math.ceil(px * 1.5));
  g.font = f;
  g.textBaseline = "middle";
  g.textAlign = "left";
  if ("letterSpacing" in g) g.letterSpacing = `${px * letter}px`;
  if (glow) {
    g.shadowColor = glow;
    g.shadowBlur = px * 0.35;
  }
  g.fillStyle = color;
  g.fillText(text, px / 2, c.height / 2);
  const t = texture(c);
  const h = (width * c.height) / c.width;
  const geo = new THREE.PlaneGeometry(width, h);
  if (align === "left") geo.translate(width / 2, 0, 0);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      map: t,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  return mesh;
}

// Fonts are loaded before canvases draw text.
export async function loadFonts() {
  try {
    await Promise.all(
      [
        "700 20px 'Chakra Petch'",
        "500 20px 'Chakra Petch'",
        "400 20px 'JetBrains Mono'",
        "700 20px 'JetBrains Mono'",
      ].map((f) => document.fonts.load(f)),
    );
  } catch {}
}
