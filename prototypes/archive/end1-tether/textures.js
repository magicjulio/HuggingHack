// Procedural canvas textures. Everything is drawn once at load.
import * as THREE from 'three';

let seed = 1337;
export function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

function make(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// ---- PC tower front: drive bays, round grille, power ring
export function towerFront() {
  return make(256, 512, (g, w, h) => {
    g.fillStyle = '#161b23'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d2430'; g.fillRect(12, 12, w - 24, h - 24);
    for (let i = 0; i < 2; i++) {
      g.fillStyle = '#0c0f14'; g.fillRect(30, 36 + i * 44, w - 60, 34);
      g.fillStyle = '#2b3442'; g.fillRect(36, 42 + i * 44, w - 72, 3);
    }
    g.fillStyle = '#090b0f';
    for (let y = 140; y < h - 70; y += 11)
      for (let x = 30; x < w - 34; x += 11) { g.beginPath(); g.arc(x + 5, y + 5, 3, 0, 7); g.fill(); }
    g.strokeStyle = '#3a4554'; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, h - 36, 12, 0, 7); g.stroke();
  });
}
export function towerEmit() {
  return make(256, 512, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5ad8ff'; g.lineWidth = 4;
    g.beginPath(); g.arc(w / 2, h - 36, 12, 0, 7); g.stroke();
    g.fillStyle = '#2a7dff'; g.fillRect(14, 120, 4, h - 200); g.fillRect(w - 18, 120, 4, h - 200);
    g.fillStyle = '#ffb347'; g.fillRect(w - 52, 52, 8, 4);
  });
}

// ---- Server rack front: 1U servers with LED dots
function rackDraw(emit) {
  return (g, w, h) => {
    g.fillStyle = emit ? '#000' : '#12161d'; g.fillRect(0, 0, w, h);
    const units = 42, uh = h / units;
    for (let i = 0; i < units; i++) {
      const y = i * uh;
      if (!emit) {
        g.fillStyle = i % 7 === 3 ? '#0a0c10' : (i % 2 ? '#1a2029' : '#1d242e');
        g.fillRect(10, y + 1, w - 20, uh - 2);
        g.fillStyle = '#0b0e12';
        for (let x = 60; x < w - 30; x += 6) g.fillRect(x, y + 4, 3, uh - 8);
      }
      if (i % 7 === 3) continue;
      const n = 2 + Math.floor(rnd() * 4);
      for (let k = 0; k < n; k++) {
        const r = rnd();
        g.fillStyle = emit ? (r < 0.6 ? '#3dff8a' : r < 0.85 ? '#4aa8ff' : '#ffb03a') : '#223';
        g.fillRect(18 + k * 9, y + uh / 2 - 2, 5, 4);
      }
    }
    // side rails
    if (!emit) { g.fillStyle = '#262e3a'; g.fillRect(0, 0, 10, h); g.fillRect(w - 10, 0, 10, h); }
  };
}
export function rackFront() { seed = 99; return make(256, 1024, rackDraw(false)); }
export function rackEmit() { seed = 99; return make(256, 1024, rackDraw(true)); }

// ---- generic metal side panel
export function sidePanel() {
  return make(128, 512, (g, w, h) => {
    g.fillStyle = '#141920'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a2029';
    for (let y = 0; y < h; y += 128) g.fillRect(4, y + 4, w - 8, 120);
    g.fillStyle = '#0e1217';
    for (let y = 40; y < h; y += 128) for (let x = 20; x < w - 20; x += 10) g.fillRect(x, y, 4, 40);
  });
}

// ---- monitor screen: abstract windows and bars, no readable text
export function screenTex() {
  seed = 4242;
  return make(512, 320, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, '#0b1a33'); grd.addColorStop(1, '#071022');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    const wins = [[20, 20, 280, 190], [310, 20, 180, 120], [310, 150, 180, 150], [20, 220, 280, 80]];
    for (const [x, y, ww, hh] of wins) {
      g.fillStyle = 'rgba(20,40,70,0.9)'; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(90,160,255,0.5)'; g.fillRect(x, y, ww, 10);
      for (let ly = y + 20; ly < y + hh - 8; ly += 9) {
        const ind = Math.floor(rnd() * 4) * 10;
        const len = 20 + rnd() * (ww - 40 - ind);
        const r = rnd();
        g.fillStyle = r < 0.5 ? 'rgba(140,200,255,0.55)' : r < 0.8 ? 'rgba(120,255,170,0.5)' : 'rgba(255,190,110,0.55)';
        g.fillRect(x + 8 + ind, ly, len, 4);
      }
    }
  });
}

// ---- raised floor tiles
export function floorTex() {
  const t = make(256, 256, (g, w, h) => {
    g.fillStyle = '#0c1018'; g.fillRect(0, 0, w, h);
    for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
      const x = tx * 128, y = ty * 128;
      g.fillStyle = '#121824'; g.fillRect(x + 3, y + 3, 122, 122);
      if ((tx + ty) % 2 === 0) {
        g.fillStyle = '#0a0d14';
        for (let py = 14; py < 118; py += 9) for (let px = 14; px < 118; px += 9) g.fillRect(x + px, y + py, 4, 4);
      }
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- grid used on the red "no rights" shields
export function gridTex() {
  const t = make(128, 128, (g, w, h) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.lineWidth = 2;
    for (let i = 0; i <= w; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---- soft round glow used for halos and particles
let _glow;
export function glowTex() {
  if (_glow) return _glow;
  _glow = make(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  return _glow;
}
let _shadow;
export function shadowTex() {
  if (_shadow) return _shadow;
  _shadow = make(64, 64, (g, w) => {
    const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    grd.addColorStop(0, 'rgba(0,0,0,0.85)');
    grd.addColorStop(0.6, 'rgba(0,0,0,0.4)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, w);
  });
  return _shadow;
}

// ---- text label as a sprite
export function textSprite(text, { color = '#ffffff', size = 48, font = '700', bg = null, height = 2, fog = true } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const f = `${font} ${size}px "JetBrains Mono", "Consolas", monospace`;
  g.font = f;
  const tw = Math.ceil(g.measureText(text).width) + size;
  c.width = tw; c.height = Math.ceil(size * 1.6);
  g.font = f;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog });
  const s = new THREE.Sprite(m);
  s.scale.set(height * c.width / c.height, height, 1);
  s.userData.setText = (txt, col = color) => {
    g.clearRect(0, 0, c.width, c.height);
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
    g.font = f; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(txt, c.width / 2, c.height / 2);
    t.needsUpdate = true;
  };
  return s;
}

// ---- text on a flat plane (for walls)
export function textPlane(text, { color = '#ffffff', size = 48, font = '700', height = 2 } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const f = `${font} ${size}px "JetBrains Mono", "Consolas", monospace`;
  g.font = f;
  c.width = Math.ceil(g.measureText(text).width) + size; c.height = Math.ceil(size * 1.6);
  g.font = f; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(height * c.width / c.height, height),
    new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
}
