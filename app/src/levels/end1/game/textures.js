// Procedural canvas textures. Everything is drawn once at load.
import * as THREE from 'three';

function cv(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Desktop tower: dark case, drive bays, vents, a light strip. Returns {map, emissive}.
export function towerTextures() {
  const [c, g] = cv(256, 512);
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#202c3d'); grd.addColorStop(1, '#0e151f');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
  g.strokeStyle = '#2c3e55'; g.lineWidth = 3; g.strokeRect(12, 12, 232, 488);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#0a0f16'; g.fillRect(30, 40 + i * 36, 196, 26);
    g.fillStyle = '#26354a'; g.fillRect(34, 44 + i * 36, 188, 4);
  }
  g.fillStyle = '#070b10';
  for (let y = 180; y < 470; y += 13) for (let x = 40; x < 210; x += 19) g.fillRect(x, y, 13, 5);
  const [e, eg] = cv(256, 512);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 512);
  eg.fillStyle = '#1b4a6a';
  eg.fillRect(0, 0, 256, 3); eg.fillRect(0, 509, 256, 3); eg.fillRect(0, 0, 3, 512); eg.fillRect(253, 0, 3, 512);
  eg.fillStyle = '#56d6ff'; eg.fillRect(232, 40, 5, 110);
  for (let i = 0; i < 3; i++) { eg.fillStyle = i === 1 ? '#ffb347' : '#5dff9a'; eg.fillRect(200, 52 + i * 36, 8, 4); }
  return { map: tex(c), emissive: tex(e) };
}

// Server rack: stacked units with many small LEDs.
export function rackTextures() {
  const [c, g] = cv(256, 512);
  g.fillStyle = '#121a25'; g.fillRect(0, 0, 256, 512);
  for (let y = 8; y < 504; y += 24) {
    g.fillStyle = '#1b2636'; g.fillRect(14, y, 228, 20);
    g.fillStyle = '#0a0e14'; g.fillRect(60, y + 6, 120, 8);
  }
  const [e, eg] = cv(256, 512);
  eg.fillStyle = '#000'; eg.fillRect(0, 0, 256, 512);
  eg.fillStyle = '#1b4a6a';
  eg.fillRect(0, 0, 256, 3); eg.fillRect(0, 509, 256, 3); eg.fillRect(0, 0, 3, 512); eg.fillRect(253, 0, 3, 512);
  const cols = ['#5dff9a', '#56d6ff', '#56d6ff', '#ffb347'];
  for (let y = 8; y < 504; y += 24) {
    for (let k = 0; k < 4; k++) {
      if (Math.random() < 0.75) { eg.fillStyle = cols[(Math.random() * 4) | 0]; eg.fillRect(196 + k * 10, y + 8, 5, 4); }
    }
  }
  return { map: tex(c), emissive: tex(e) };
}

// Monitor screen: lines of code-like glyph blocks (no real text needed at this scale).
export function screenTexture() {
  const [c, g] = cv(512, 256);
  g.fillStyle = '#04121a'; g.fillRect(0, 0, 512, 256);
  const cols = ['#2fd3a0', '#4fb8ff', '#8fe8ff', '#2a8f7a'];
  for (let y = 14; y < 246; y += 11) {
    let x = 14 + ((Math.random() * 4) | 0) * 14;
    while (x < 470 && Math.random() < 0.93) {
      const w = 8 + Math.random() * 46;
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.globalAlpha = 0.5 + Math.random() * 0.5;
      g.fillRect(x, y, w, 5);
      x += w + 7;
    }
  }
  g.globalAlpha = 1;
  g.strokeStyle = '#1d3a4a'; g.lineWidth = 6; g.strokeRect(0, 0, 512, 256);
  return tex(c);
}

export function floorTexture() {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#080c14'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#132033'; g.lineWidth = 2;
  g.strokeRect(1, 1, 254, 254);
  g.strokeStyle = '#0e1828'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(128, 0); g.lineTo(128, 256); g.moveTo(0, 128); g.lineTo(256, 128); g.stroke();
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(120, 120);
  return t;
}

// Big label (e.g. RESEARCH CLUSTER, SANDBOX 7731).
export function labelTexture(text, { w = 1024, h = 128, color = '#bfefff', font = 'bold 84px monospace', bg = null } = {}) {
  const [c, g] = cv(w, h);
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.font = font; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = color; g.shadowBlur = 18;
  g.fillText(text, w / 2, h / 2);
  return tex(c);
}

// OpenAI logo (the standard 24×24 icon path) in the label's colour and glow, for the cluster's sign.
const OPENAI_PATH = 'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z';
export function logoTexture({ size = 256, color = '#bfefff' } = {}) {
  const [c, g] = cv(size, size);
  const s = (size * 0.8) / 24;
  g.translate(size * 0.1, size * 0.1); g.scale(s, s);
  g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 18;
  g.fill(new Path2D(OPENAI_PATH));
  return tex(c);
}

// Sandbox cube face: a blown-open doorway.
export function sandboxTexture() {
  const [c, g] = cv(256, 256);
  g.fillStyle = '#2a2f38'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#4a5160'; g.lineWidth = 4; g.strokeRect(4, 4, 248, 248);
  g.fillStyle = '#d6ffe6'; g.shadowColor = '#5dff9a'; g.shadowBlur = 30;
  g.fillRect(96, 110, 64, 146);
  g.shadowBlur = 0;
  g.fillStyle = '#9fb0c4'; g.font = 'bold 22px monospace'; g.textAlign = 'center';
  g.fillText('SANDBOX 7731', 128, 60);
  return tex(c);
}
