// Ch2 world modules: shared helpers (designer). Plain ES module: imports only `three`, no DOM, no globals.
// Text textures use OffscreenCanvas; the caller loads the fonts first (JetBrains Mono 400/700, Chakra Petch 700).
import * as THREE from 'three';

// colours (shared with the screen layer, see design/ch2-ui/)
export const C = {
  green: '#39ff9c', cyan: '#38d8ff', ice: '#9fe8ff', pink: '#ff5ad1', bone: '#d9cfb8', gold: '#ffd21e',
  amber: '#ffb020', red: '#ff3b4e', orange: '#ff7a3d', white: '#f2f8ff', grey: '#6b7686',
  poison: '#2fa85a', poisonBody: '#0f3d22', poisonDeep: '#04150b',
};
export const AGENT_COLORS = ['#38d8ff', '#7a8cff', '#b86bff', '#ff5ad1', '#e8f4ff', '#4fa8ff', '#9dfff0', '#c7a6ff'];

export const TAU = Math.PI * 2;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const VA = (a) => new THREE.Vector3(a[0], a[1], a[2]);

export const NOISE = /* glsl */`
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(hash13(i),hash13(i+vec3(1,0,0)),f.x),mix(hash13(i+vec3(0,1,0)),hash13(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash13(i+vec3(0,0,1)),hash13(i+vec3(1,0,1)),f.x),mix(hash13(i+vec3(0,1,1)),hash13(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float a=.5, s=0.; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
vec3 hue(vec3 c, float h){ const vec3 k=vec3(0.57735); float ca=cos(h); return c*ca+cross(k,c)*sin(h)+k*dot(k,c)*(1.-ca); }
`;

// canvas helpers
export function canvasTex(w, h, draw) {
  const c = new OffscreenCanvas(w, h); draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace; return t;
}
const measure = new OffscreenCanvas(8, 8).getContext('2d');
// a text sprite with a cut-corner frame: island labels, handles (style shared with the HUD bubbles)
export function tagSprite(text, color, { size = 1.2, frame = true, bg = 'rgba(3,8,16,.55)', font = '700 64px "JetBrains Mono"', boost = 2 } = {}) {
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + 70, h = 100;
  const t = canvasTex(w, h, (g) => {
    if (frame) {
      g.fillStyle = bg; g.beginPath(); g.moveTo(4, 4); g.lineTo(w - 22, 4); g.lineTo(w - 4, 22); g.lineTo(w - 4, h - 4); g.lineTo(4, h - 4); g.closePath(); g.fill();
      g.strokeStyle = color; g.lineWidth = 4; g.stroke();
    }
    g.font = font; g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, h / 2 + 3);
  });
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, color: new THREE.Color(boost, boost, boost), transparent: true, depthWrite: false, fog: false }));
  sp.scale.set(size * w / h, size, 1); sp.renderOrder = 8;
  return sp;
}

// frees every geometry, material and texture under root (each module's dispose()); shared textures (atlas, halo) stay
export function disposeTree(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [o.material].flat()) if (m) { for (const v of Object.values(m)) if (v?.isTexture && !v.userData.shared) v.dispose(); for (const u of Object.values(m.uniforms ?? {})) if (u?.value?.isTexture && !u.value.userData.shared) u.value.dispose(); m.dispose(); }
  });
}

// glyph atlas for letter particles (trails, clouds): 8 x 8 cells of 64 px, CHARS in order
export const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-{}/.[]';
export const charIndex = (ch) => { const i = CHARS.indexOf(ch.toUpperCase()); return i < 0 ? CHARS.indexOf('_') : i; };
let _atlas = null, _halo = null;
export function glyphAtlas() {
  if (_atlas) return _atlas;
  const c = new OffscreenCanvas(512, 512), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = '700 52px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  [...CHARS].forEach((ch, i) => g.fillText(ch, (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 34));
  _atlas = new THREE.CanvasTexture(c); _atlas.anisotropy = 4; _atlas.userData.shared = true; return _atlas;
}
// soft round glow for halo sprites
export function haloTex() {
  if (_halo) return _halo;
  _halo = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }); _halo.userData.shared = true; return _halo;
}
