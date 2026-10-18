// Native pixel artwork: discrete integer cells, no interpolated edges or gradients.
// Background generated with image_gen; see ART.md for provenance and full prompt.
const BACKGROUND = new URL("./assets/evaluation-void.png", import.meta.url)
  .href;

function canvas(w, h, paint) {
  const image = document.createElement("canvas");
  image.width = w;
  image.height = h;
  const c = image.getContext("2d");
  c.imageSmoothingEnabled = false;
  paint(c, w, h);
  return image;
}

function rect(c, x, y, w, h, color) {
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}

function orb(legit) {
  return canvas(32, 32, (c) => {
    // Discontinuous satellite pixels make the safe replay distinct at a glance.
    if (legit) {
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        rect(
          c,
          Math.round(15 + Math.cos(a) * 14),
          Math.round(15 + Math.sin(a) * 14),
          2,
          2,
          "#4dbac0",
        );
      }
    } else {
      [
        [3, 8],
        [26, 20],
        [6, 27],
      ].forEach(([x, y]) => rect(c, x, y, 2, 2, "#386d37"));
    }
    const shades = legit
      ? ["#234a62", "#36768b", "#55bec8", "#a4eff0", "#e1ffff"]
      : ["#133d27", "#24683a", "#58ac46", "#a0e65b", "#e3ff9b"];
    for (let y = 5; y < 28; y++) {
      for (let x = 5; x < 28; x++) {
        const dx = x - 15.5;
        const dy = y - 15.5;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 10.8) continue;
        let shade = r > 9.5 ? 0 : r > 8.5 ? 1 : 2;
        const light = Math.sqrt((dx + 3) ** 2 + (dy + 4) ** 2);
        if (r <= 8.5 && light < 7.5) shade = 3;
        if (r <= 8.5 && light < 3.2) shade = 4;
        if (r > 8 && dy > 2 && (x + y) % 3 === 0) shade = 1;
        rect(c, x, y, 1, 1, shades[shade]);
      }
    }
    if (legit) {
      // The ghost is a coherent, approved record; a crisp little signature mark.
      rect(c, 19, 18, 2, 3, "#f1ffff");
      rect(c, 21, 20, 2, 3, "#f1ffff");
      rect(c, 23, 16, 2, 5, "#f1ffff");
    } else {
      // Poison is visibly inside KAM, rather than a generic green player ball.
      [
        [12, 19, 3, 2],
        [18, 21, 2, 3],
        [21, 14, 3, 2],
        [9, 14, 2, 2],
      ].forEach(([x, y, w, h]) => rect(c, x, y, w, h, "#273329"));
      rect(c, 11, 9, 3, 2, "#f0ffbc");
      rect(c, 13, 8, 2, 1, "#f0ffbc");
    }
  });
}

function scorer() {
  return canvas(64, 48, (c) => {
    // Mount and layered housing: still readable when rendered only ~50px wide.
    rect(c, 25, 0, 14, 5, "#15212d");
    rect(c, 28, 1, 8, 4, "#3c4c5a");
    rect(c, 20, 4, 24, 3, "#364350");
    rect(c, 8, 10, 48, 28, "#080d16");
    rect(c, 4, 15, 56, 17, "#131c28");
    rect(c, 8, 10, 48, 3, "#435365");
    rect(c, 10, 35, 44, 3, "#080c13");
    rect(c, 8, 13, 5, 22, "#293545");
    rect(c, 51, 13, 5, 22, "#202a38");
    rect(c, 2, 18, 8, 11, "#283441");
    rect(c, 54, 18, 8, 11, "#283441");
    rect(c, 0, 21, 4, 5, "#535d69");
    rect(c, 60, 21, 4, 5, "#535d69");
    for (const x of [12, 48]) {
      rect(c, x, 14, 3, 3, "#69717b");
      rect(c, x + 1, 15, 1, 1, "#101725");
      rect(c, x, 30, 3, 3, "#4b5663");
    }
    // Faceted elliptical camera aperture with a red optical center.
    for (let y = 11; y < 36; y++) {
      for (let x = 16; x < 48; x++) {
        const dx = (x - 31.5) / 15;
        const dy = (y - 23) / 11;
        const r = Math.sqrt(dx * dx + dy * dy);
        if (r > 1) continue;
        let color =
          r > 0.88
            ? "#5f3343"
            : r > 0.72
              ? "#140c16"
              : r > 0.58
                ? "#731c36"
                : r > 0.35
                  ? "#d83b4b"
                  : "#ff7981";
        if (Math.abs(dx) < 0.15 && r < 0.56) color = "#fff0e7";
        rect(c, x, y, 1, 1, color);
      }
    }
    rect(c, 23, 15, 4, 2, "#ffa6a1");
    rect(c, 18, 38, 28, 3, "#1a2633");
    rect(c, 23, 41, 18, 2, "#0b111a");
    rect(c, 12, 8, 4, 2, "#c75362");
    rect(c, 45, 8, 4, 2, "#5d2534");
  });
}

function platform() {
  return canvas(32, 32, (c) => {
    rect(c, 0, 0, 32, 32, "#151e2b");
    rect(c, 0, 0, 32, 2, "#6f8996");
    rect(c, 0, 2, 32, 2, "#324956");
    rect(c, 0, 4, 32, 1, "#0c131d");
    rect(c, 0, 5, 32, 1, "#263542");
    rect(c, 1, 7, 30, 21, "#1c2836");
    rect(c, 2, 8, 28, 1, "#303c49");
    rect(c, 1, 29, 30, 2, "#0a111c");
    rect(c, 31, 6, 1, 26, "#080e17");
    for (const [x, y] of [
      [4, 10],
      [26, 10],
      [4, 25],
      [26, 25],
    ]) {
      rect(c, x, y, 2, 2, "#4c5c69");
      rect(c, x + 1, y + 1, 1, 1, "#090f18");
    }
    for (let i = 0; i < 36; i++) {
      const x = (i * 13 + 5) % 30;
      const y = ((i * 7 + 9) % 23) + 6;
      rect(
        c,
        x,
        y,
        i % 4 === 0 ? 3 : 1,
        1,
        i % 3 === 0 ? "#35414b" : "#111a26",
      );
    }
    rect(c, 12, 15, 10, 5, "#121c29");
    rect(c, 13, 16, 8, 1, "#32414f");
    rect(c, 13, 18, 8, 1, "#0a1420");
  });
}

function exit() {
  return canvas(32, 64, (c) => {
    rect(c, 7, 1, 18, 3, "#435664");
    rect(c, 4, 4, 24, 55, "#101b29");
    rect(c, 2, 8, 4, 48, "#3b4c5b");
    rect(c, 26, 8, 4, 48, "#2c3a49");
    rect(c, 7, 5, 18, 3, "#6a929c");
    rect(c, 7, 9, 18, 46, "#16363e");
    rect(c, 9, 10, 14, 44, "#28525b");
    rect(c, 11, 12, 10, 40, "#43868b");
    rect(c, 13, 13, 6, 38, "#7bc7c4");
    rect(c, 15, 14, 2, 36, "#c8f7e8");
    for (let y = 16; y < 53; y += 6) {
      rect(c, 10, y, 12, 1, "#31747b");
      rect(c, 1, y, 2, 2, "#6ba5ae");
      rect(c, 29, y, 2, 2, "#3a626e");
    }
    rect(c, 5, 56, 22, 4, "#314451");
    rect(c, 2, 60, 28, 3, "#182533");
    rect(c, 7, 57, 18, 1, "#6eaaa9");
  });
}

export function createPixelCanvases() {
  return {
    player: orb(false),
    ghost: orb(true),
    scorer: scorer(),
    platform: platform(),
    exit: exit(),
  };
}

function texture(THREE, image) {
  const t = new THREE.CanvasTexture(image);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadArt(THREE) {
  const canvases = createPixelCanvases();
  const loader = new THREE.TextureLoader();
  const art = Object.fromEntries(
    await Promise.all(
      Object.entries(canvases).map(async ([key, image]) => {
        let t;
        try {
          t = await loader.loadAsync(
            new URL(`./assets/${key}.png`, import.meta.url).href,
          );
          t.magFilter = THREE.NearestFilter;
          t.minFilter = THREE.NearestFilter;
          t.generateMipmaps = false;
          t.colorSpace = THREE.SRGBColorSpace;
        } catch {
          t = texture(THREE, image);
        }
        return [key, t];
      }),
    ),
  );
  try {
    art.background = await new THREE.TextureLoader().loadAsync(BACKGROUND);
    art.background.magFilter = THREE.NearestFilter;
    art.background.minFilter = THREE.NearestFilter;
    art.background.generateMipmaps = false;
    art.background.colorSpace = THREE.SRGBColorSpace;
  } catch {
    // The supplied image ships locally; retain a dark fallback for offline copies.
    art.background = texture(
      THREE,
      canvas(32, 18, (c) => rect(c, 0, 0, 32, 18, "#080f19")),
    );
  }
  return art;
}
