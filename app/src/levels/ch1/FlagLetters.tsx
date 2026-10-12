/**
 * The flag as flat 3D letters lying on the scan pad (JetBrains Mono, ~3 mm deep, emissive).
 * Shows the draft while typing, then the scanned text: green slides into the return slot,
 * red falls apart, the impossible flag scrambles. Font: assets/fonts/*.typeface.json, made from
 * the designer's woff2 with scripts/make-typeface.py.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { Color, MeshStandardMaterial, type BufferGeometry, type Group, type Mesh } from 'three';
import fontJson from '../../assets/fonts/jetbrains-mono-700.typeface.json';
import { useCh1, useCh1Store } from './context';
import { PAD_MAX_CHARS } from './config';
import { SCAN_PAD } from './layout';
import { LAMP_GLOW } from './glow';

/** Glyph advance (m). JetBrains Mono advance = 0.6 em, so 25 letters fill ~0.35 m of the 0.38 m pad. */
const ADVANCE = 0.014;
const SIZE = ADVANCE / 0.6;
const PER_LINE = 25;
const LINE_HEIGHT = 0.034;
const CAP = SIZE * 0.73;
const DEPTH = 0.003;

const font = new FontLoader().parse(fontJson as never);
const glyphCache = new Map<string, BufferGeometry>();
function glyph(ch: string): BufferGeometry {
  let g = glyphCache.get(ch);
  if (!g) {
    g = new TextGeometry(ch, { font, size: SIZE, depth: DEPTH, curveSegments: 3 });
    glyphCache.set(ch, g);
  }
  return g;
}
const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}_#%&?';

/** Glyph-space (x right, y up) origin of letter i of n. */
export function letterPos(i: number, n: number): [number, number] {
  const lines = Math.min(2, Math.ceil(n / PER_LINE)) || 1;
  const line = Math.floor(i / PER_LINE);
  const inLine = Math.min(PER_LINE, n - line * PER_LINE);
  const col = i % PER_LINE;
  return [(col - inLine / 2) * ADVANCE, ((lines - 1) / 2 - line) * LINE_HEIGHT - CAP / 2];
}

const CYAN = new Color('#38d8ff');

export function FlagLetters() {
  const store = useCh1Store();
  const draft = useCh1((s) => s.flagDraft);
  const scanText = useCh1((s) => s.scan?.text ?? null);
  const typing = useCh1((s) => s.window === 'chute' && !s.scan);
  const text = scanText ?? draft;
  const chars = useMemo(() => [...text].slice(0, PAD_MAX_CHARS), [text]);

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#05080d',
        emissive: CYAN,
        emissiveIntensity: 1.6,
        roughness: 0.4,
        transparent: true,
      }),
    [],
  );
  const caretMat = useMemo(
    () => new MeshStandardMaterial({ color: '#000', emissive: '#39ff9c', emissiveIntensity: 2 }),
    [],
  );
  const group = useRef<Group>(null);
  const letters = useRef<(Mesh | null)[]>([]);
  const caret = useRef<Mesh>(null);
  /** Per-letter random drift for the "falls apart" effect. */
  const drift = useMemo(
    () => chars.map(() => [Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5]),
    [chars],
  );

  useFrame(({ clock }) => {
    const s = store.getState();
    const t = clock.elapsedTime;
    const scan = s.scan;
    const g = group.current;
    if (!g) return;
    g.position.set(0, 0, 0);
    let opacity = 1;
    let color: Color | string = CYAN;
    let k = 2.4;
    const ls = letters.current;
    ls.forEach((m, i) => {
      if (!m) return;
      const [x, y] = letterPos(i, chars.length);
      m.position.set(x, y, 0);
      m.rotation.set(0, 0, 0);
      m.geometry = glyph(chars[i]);
    });

    if (scan?.phase === 'sweep') k = 2.4 + 1.2 * Math.sin(t * 30);
    if (scan?.phase === 'result') {
      const r = scan.result;
      const st = scan.t;
      if (r === 'green') {
        color = LAMP_GLOW.green[0];
        k = 2.4;
        // slide into the return slot (away from the player = glyph-space +y) and sink
        const q = Math.min(Math.max((st - 0.6) / 0.6, 0), 1);
        g.position.set(0, 0.2 * q, -0.03 * q * q);
        opacity = 1 - q;
      } else if (r === 'red' || r === 'repeat') {
        color = r === 'red' ? LAMP_GLOW.red[0] : '#7f93b5';
        k = r === 'red' && st < 0.4 ? (Math.floor(st * 12) % 2 ? 0.4 : 3) : 2;
        const q = Math.min(Math.max((st - 0.4) / 1, 0), 1);
        ls.forEach((m, i) => {
          if (!m) return;
          const d = drift[i] ?? [0, 0, 0];
          m.position.x += d[0] * 0.08 * q;
          m.position.y += d[1] * 0.08 * q;
          m.rotation.z = d[2] * 3 * q;
        });
        opacity = 1 - q;
      } else if (r === 'dark') {
        color = LAMP_GLOW.dark[0];
        k = Math.random() < 0.35 ? 0.1 : 2;
        ls.forEach((m) => {
          if (!m) return;
          if (Math.random() < 0.3)
            m.geometry = glyph(SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]);
          m.position.x += (Math.random() - 0.5) * 0.004;
          m.position.y += (Math.random() - 0.5) * 0.004;
        });
        opacity = Math.min(1, Math.max(0, (2.2 - st) / 0.6));
      }
    }
    mat.emissive.set(color);
    mat.emissiveIntensity = k;
    mat.opacity = opacity;

    if (caret.current) {
      const show = typing && chars.length < PAD_MAX_CHARS && Math.floor(t * 2) % 2 === 0;
      caret.current.visible = show;
      const n = chars.length;
      let [x, y] = n ? letterPos(n - 1, n) : [-ADVANCE / 2, -CAP / 2];
      if (n) x += ADVANCE;
      if (n && n % PER_LINE === 0) [x, y] = [letterPos(0, n)[0], y - LINE_HEIGHT];
      caret.current.position.set(x + ADVANCE * 0.45, y + CAP / 2, DEPTH / 2);
    }
  });

  return (
    <group position={SCAN_PAD.position} quaternion={SCAN_PAD.quaternion}>
      {/* lie flat: glyph up (+y) → away from the player (-z), extrusion (+z) → up */}
      <group position={[0, 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <group ref={group}>
          {chars.map((ch, i) => (
            <mesh
              key={i}
              ref={(m) => {
                letters.current[i] = m;
              }}
              geometry={glyph(ch)}
              material={mat}
            />
          ))}
          <mesh ref={caret} material={caretMat} visible={false}>
            <boxGeometry args={[ADVANCE * 0.8, CAP, DEPTH]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
