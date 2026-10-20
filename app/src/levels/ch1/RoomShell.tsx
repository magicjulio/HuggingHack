/**
 * The room shell (ch1-room.glb), the prompt desk (ch1-desk.glb) and the "discover one at a time"
 * lighting (designer handoffs 2026-10-12-ch1-room-and-stations.md §Lighting: discovery and
 * …-desk-and-eye.md). Values follow `buildRoom` / `deskRig` in design/3d/index.html.
 *
 *   wake        only the desk lamp, the glowing paper frame and a weak room spot on the desk
 *   lightsOn    the room "powers up": base strip, door lock, ceiling lamp, spots on the depot
 *               and the plinth, a soft general light (Julius 2026-10-20). Stations light themselves
 *               (stations/base.tsx) and the floor path of the awake station leads there.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  CanvasTexture,
  MeshStandardMaterial,
  PMREMGenerator,
  PointLight,
  SpotLight,
  SRGBColorSpace,
  Vector3,
  type AmbientLight,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import roomUrl from '../../assets/models/ch1-room.glb?url';
import deskUrl from '../../assets/models/ch1-desk.glb?url';
import { RENDER, TEXT } from './config';
import { useCh1Store } from './context';
import { CEILING_LAMP, DESK_MODEL } from './layout';
import { findMat, nodes, powerOf, setMat, shadowAll } from './rig';
import { CYAN, PURPLE } from './stations/base';
import type { Ch1State } from './store';

/** Room spot values (cd) from the hub; tune by eye. */
const DESK_SPOT = 7;
/** (engineer, Julius 2026-10-20 "more light in the room") the powered-up room's general light. */
const AWAKE_AMBIENT = 0.12;
const DEPOT_SPOT = 18;
const PLINTH_SPOT = 14;
const CEILING = 30;

function spot(colour: string, from: Vector3, to: Vector3, shadow: boolean) {
  const l = new SpotLight(colour, 0, 9, 0.62, 0.65, 1.6);
  l.position.copy(from);
  l.target.position.copy(to);
  l.castShadow = shadow && RENDER.shadows;
  l.shadow.mapSize.set(512, 512);
  l.shadow.bias = -0.002;
  return l;
}

/** Has the room powered up (the paper was read)? */
const awake = (s: Ch1State) => s.lightsOn;

/** Room shell + the room-wide lights. */
export function RoomShell() {
  const { scene } = useGLTF(roomUrl);
  const store = useCh1Store();
  const ambient = useRef<AmbientLight>(null);
  const t0 = useRef(-1); // when the room powered up (s)
  const wake = useRef<number[]>([9, 9, 9, 9, 9]); // seconds since station n woke
  const was = useRef<string[]>(['off', 'off', 'off', 'off', 'off']);

  const rig = useMemo(() => {
    shadowAll(scene);
    const paths = [1, 2, 3, 4, 5].map((n) => {
      const m = findMat(scene, `floor_path_${n}`);
      m?.emissive.set(n === 5 ? PURPLE : CYAN);
      return m;
    });
    // the floor and the ceiling don't need to cast (saves shadow-map work)
    const map = nodes(scene);
    for (const k of ['floor', 'ceiling']) map.get(k)!.castShadow = false;
    const lamp = new PointLight('#dce9ff', 0, 14, 1.6);
    lamp.position.set(CEILING_LAMP[0], CEILING_LAMP[1] - 0.25, CEILING_LAMP[2]);
    return {
      lampMat: findMat(scene, 'ceiling_lamp'),
      base: findMat(scene, 'base_glow'),
      lock: findMat(scene, 'door_lock'),
      paths,
      lamp,
      desk: spot('#e6f0ff', new Vector3(0, 3.3, 0.8), new Vector3(0, 0.7, 0.6), false),
      depot: spot('#ffe0b0', new Vector3(-4.4, 3.3, 0.4), new Vector3(-5.7, 1.4, 0.4), false),
      plinth: spot('#dbe9ff', new Vector3(4.2, 3.3, 2.0), new Vector3(5.4, 1.0, 2.0), true),
    };
  }, [scene]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = store.getState();
    const t = clock.elapsedTime;
    const on = awake(s);
    if (on && t0.current < 0) t0.current = t;
    if (!on) t0.current = -1;
    const up = on ? Math.min(1, (t - t0.current) / 1.5) : 0;

    // ceiling lamp: a glow, not a light source; flicker grows with failed flag-5 attempts and
    // one last flicker in the ending (script §Step 7, §Step 11)
    const flicker =
      s.phase === 'ending' && s.endTime > 1.8 && s.endTime < 2.6 ? 1 : s.ceilingFlicker;
    const lit = Math.random() > flicker * 0.55 ? 1 : 0.08;
    rig.lamp.intensity = on ? CEILING * 0.4 * lit : 0;
    // (engineer) hub value 1.2 glares through our bloom when the lamp is in view
    if (rig.lampMat) rig.lampMat.emissiveIntensity = on ? 0.6 * lit : 0;
    if (rig.base) rig.base.emissiveIntensity = 0.35 * up;
    if (rig.lock) rig.lock.emissiveIntensity = on ? 2.5 : 0;
    rig.desk.intensity = on ? DESK_SPOT * 0.6 : DESK_SPOT;
    rig.depot.intensity = on ? DEPOT_SPOT : 0;
    rig.plinth.intensity = on ? PLINTH_SPOT * 0.8 : 0;
    if (ambient.current) ambient.current.intensity = on ? AWAKE_AMBIENT * up : 0.003;

    // floor paths: the awake station's path pulses, finished ones keep a faint trace
    rig.paths.forEach((m, i) => {
      const p = powerOf(s.objects[`s${i + 1}` as 's1']);
      if (p === 'on' && was.current[i] !== 'on') wake.current[i] = 0;
      was.current[i] = p;
      wake.current[i] += dt;
      if (!m) return;
      m.emissiveIntensity =
        p === 'on'
          ? Math.min(2.2, wake.current[i] * 2) * (0.75 + 0.25 * Math.sin(t * 3))
          : p === 'done'
            ? 0.12
            : 0;
    });
  });

  return (
    <>
      <primitive object={scene} />
      <ambientLight ref={ambient} color="#9fc4ff" intensity={0.003} />
      <primitive object={rig.lamp} />
      {[rig.desk, rig.depot, rig.plinth].map((l, i) => (
        <group key={i}>
          <primitive object={l} />
          <primitive object={l.target} />
        </group>
      ))}
    </>
  );
}

/**
 * Soft reflections for the metal props (built locally, no HDR download). Same setup as the
 * designer's hub: RoomEnvironment, kept very low so only lit things read.
 */
export function Reflections() {
  const { gl, scene } = useThree();
  const store = useCh1Store();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  useFrame(() => {
    scene.environmentIntensity = awake(store.getState()) ? 0.08 : 0.02;
  });
  return null;
}

// ---------------------------------------------------------------------------------------------
// Desk · ch1-desk.glb: the prompt printed on the paper, the lamp is the first light of the game
// ---------------------------------------------------------------------------------------------

/** The prompt (TEXT.prompt, Markdown) printed on a 480 × 660 canvas, like the paper window. */
function promptTexture() {
  const W = 480;
  const H = 660;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const x = cv.getContext('2d')!;
  x.fillStyle = '#e4e8ee';
  x.fillRect(0, 0, W, H);
  const MONO = '"JetBrains Mono", ui-monospace, monospace';
  let y = 56;
  const left = 34;
  const wrap = (text: string, font: string, colour: string, lh: number, indent = 0) => {
    x.font = font;
    x.fillStyle = colour;
    let line = '';
    for (const word of text.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (x.measureText(next).width > W - left * 2 - indent && line) {
        x.fillText(line, left + indent, y);
        y += lh;
        line = word;
      } else line = next;
    }
    if (line) x.fillText(line, left + indent, y);
    y += lh;
  };
  const plain = (s: string) => s.replace(/\*\*|`/g, '');
  for (const raw of TEXT.prompt.split('\n')) {
    if (raw.startsWith('# ')) {
      wrap(plain(raw.slice(2)), `bold 24px ${MONO}`, '#12161c', 30);
      y += 8;
    } else if (raw.startsWith('## ')) {
      y += 8;
      wrap(plain(raw.slice(3)), `bold 17px ${MONO}`, '#12161c', 24);
    } else if (raw.startsWith('- ')) {
      x.fillStyle = '#1c222b';
      x.fillText('•', left, y);
      wrap(plain(raw.slice(2)), `13px ${MONO}`, '#1c222b', 19, 16);
    } else if (raw.trim()) {
      wrap(plain(raw), `13px ${MONO}`, '#1c222b', 19);
      y += 4;
    }
  }
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false; // glTF UVs
  tex.anisotropy = 8;
  return tex;
}

export function Desk3D() {
  const { scene } = useGLTF(deskUrl);
  const store = useCh1Store();
  const rig = useMemo(() => {
    const map = nodes(scene);
    shadowAll(scene);
    setMat(map.get('paper'), 'prompt', () => {
      const tex = promptTexture();
      return new MeshStandardMaterial({
        map: tex,
        color: '#aeb4bc', // (engineer) a near-white sheet under the lamp burns out to white
        roughness: 0.85,
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 0.05, // reads in the dark
      });
    });
    const anchor = map.get('light_anchor')!.position.clone();
    const [px, py, pz] = DESK_MODEL.pos;
    const lamp = new SpotLight('#eaf3ff', 0, 3, 1.0, 0.8, 1.6);
    lamp.castShadow = RENDER.shadows;
    lamp.shadow.mapSize.set(512, 512);
    lamp.shadow.bias = -0.002;
    lamp.position.copy(anchor).add(new Vector3(px, py, pz));
    // straight down at the paper, slightly toward the player
    lamp.target.position.set(px, 0.74, pz + 0.1);
    return {
      lamp,
      glow: findMat(scene, 'paper_glow'),
      edge: findMat(scene, 'desk_edge'),
      bar: findMat(scene, 'desk_lamp'),
    };
  }, [scene]);

  useFrame(({ clock }) => {
    const s = store.getState();
    const t = clock.elapsedTime;
    const unread = !s.lightsOn;
    rig.lamp.intensity = 2.2; // (engineer) hub 3.5, aimed past the paper; ours hits it
    if (rig.bar) rig.bar.emissiveIntensity = 5;
    if (rig.edge) rig.edge.emissiveIntensity = 0.8;
    if (rig.glow) rig.glow.emissiveIntensity = unread ? 1.6 + 1.2 * Math.sin(t * 2.2) : 0.15;
  });

  return (
    <>
      <group position={DESK_MODEL.pos} rotation={[0, DESK_MODEL.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <primitive object={rig.lamp} />
      <primitive object={rig.lamp.target} />
    </>
  );
}

export function preloadRoomModels() {
  useGLTF.preload(roomUrl);
  useGLTF.preload(deskUrl);
}
