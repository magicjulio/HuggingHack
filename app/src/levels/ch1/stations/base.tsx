/**
 * What every ch1 station shares (designer handoff 2026-10-12-ch1-room-and-stations.md, "Lighting:
 * discovery"): the header strip `bulb`, a spotlight at `light_anchor` aimed at the screen, the
 * screen boot, and dormant → awake → done states from `objects.sN`. Values follow `stationBase`
 * and `buildRoom` in design/3d/index.html.
 */
import { useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { SpotLight, Vector3, type Object3D, type Quaternion } from 'three';
import { RENDER, TEXT } from '../config';
import { Ch1Context, useCh1, useCh1Store } from '../context';
import { STATIONS, type StationNo } from '../layout';
import { nodes, ownMat, powerOf, shadowAll, type Power } from '../rig';

export const CYAN = '#38d8ff';
export const PURPLE = '#b86bff';
const Y = new Vector3(0, 1, 0);

/** (designer) station spot ≈ 28 cd, decay 1.6, distance 9; tune by eye. */
const SPOT = 28;

export interface BaseState {
  power: Power;
  /** Seconds since the station woke up. */
  wakeT: number;
  /** Screen brightness 0..1 (boot flicker, dim when done). */
  uiK: number;
}

/** Looks up the shared nodes once; `step(dt)` animates them and returns the current state. */
export function useStationBase(scene: Object3D, n: StationNo, colour = CYAN) {
  const store = useCh1Store();
  const rig = useMemo(() => {
    const L = STATIONS[n];
    const map = nodes(scene);
    shadowAll(scene);
    const bulb = ownMat(map.get('bulb'));
    bulb?.emissive.set(colour);
    const screen = ownMat(map.get('screen'));
    const spot = new SpotLight(n === 5 ? '#d8c8ff' : '#dbe9ff', 0, 9, 0.62, 0.65, 1.6);
    spot.castShadow = RENDER.shadows;
    spot.shadow.mapSize.set(512, 512);
    spot.shadow.bias = -0.002;
    const anchor = map.get('light_anchor')?.position.clone() ?? new Vector3(0, 3.3, 1);
    spot.position.copy(anchor.applyAxisAngle(Y, L.rotY).add(new Vector3(...L.pos)));
    spot.target.position.copy(L.screen.position);
    return { map, bulb, screen, spot };
  }, [scene, n, colour]);

  const st = useRef<BaseState>({ power: 'off', wakeT: 9, uiK: 0 });
  const step = (dt: number): BaseState => {
    const s = st.current;
    const power = powerOf(store.getState().objects[`s${n}`]);
    if (power === 'on' && s.power !== 'on') s.wakeT = 0;
    s.power = power;
    s.wakeT += dt;
    const waking = power === 'on' && s.wakeT < 0.9; // fluorescent start-up
    let k = power === 'off' ? 0 : power === 'done' ? 0.35 : 3;
    if (waking && Math.random() < 0.45) k *= 0.05;
    if (rig.bulb) rig.bulb.emissiveIntensity = k;
    s.uiK =
      power === 'off'
        ? 0
        : power === 'done'
          ? 0.22
          : s.wakeT < 0.5
            ? Math.random() < 0.5
              ? 0.1
              : 0.8
            : 0.9;
    if (rig.screen) rig.screen.emissiveIntensity = s.uiK * 0.25; // backlight behind the DOM/canvas
    const goal = power === 'on' ? SPOT : power === 'done' ? SPOT * 0.12 : 0;
    const l = rig.spot;
    l.intensity += (goal - l.intensity) * Math.min(1, dt * (power === 'on' ? 1.6 : 3));
    if (waking && Math.random() < 0.4) l.intensity *= 0.2;
    return s;
  };
  return { rig, step, st };
}

/** The station's spotlight (+ its target) in world space. */
export function StationSpot({ spot }: { spot: SpotLight }) {
  return (
    <>
      <primitive object={spot} />
      <primitive object={spot.target} />
    </>
  );
}

/**
 * DOM UI on a station's screen (drei <Html transform>), like the depot: `px` is the panel's CSS
 * size, scaled to the screen's width. Interactive only while the player is focused on it.
 */
export function ScreenHtml({
  n,
  px,
  children,
  className = '',
  pose,
  st,
}: {
  n: StationNo;
  px: [number, number];
  children: ReactNode;
  className?: string;
  /** Another plane than the station's screen (e.g. the S3 readout strip). */
  pose?: { position: Vector3; quaternion: Quaternion; size: [number, number] };
  /** The station's base state: the panel follows its boot flicker and dims when done. */
  st?: MutableRefObject<BaseState>;
}) {
  const store = useCh1Store();
  const power = useCh1((s) => powerOf(s.objects[`s${n}`]));
  const focused = useCh1((s) => s.window === `s${n}`);
  // pin the DOM target (see Depot3D)
  const gl = useThree((t) => t.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);
  const panel = useRef<HTMLDivElement>(null);
  useFrame(() => {
    if (!panel.current || !st) return;
    const s = st.current;
    const k = s.power === 'done' ? 0.55 : Math.min(1, s.uiK / 0.9);
    panel.current.style.opacity = String(k);
  });
  const L = pose ?? STATIONS[n].screen;
  if (power === 'off') return null;
  return (
    <group position={L.position} quaternion={L.quaternion}>
      <Html
        transform
        portal={portal}
        distanceFactor={(L.size[0] / px[0]) * 400}
        position={[0, 0, 0.003]}
        zIndexRange={[5, 0]}
        pointerEvents={focused ? 'auto' : 'none'}
      >
        <Ch1Context.Provider value={store}>
          <div
            ref={panel}
            className={`ch1-screen ch1-st is-${power} ${focused ? 'is-focused' : ''} ${className}`}
            style={{ width: px[0], height: px[1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
            <div className="ch1-screen-scan" />
          </div>
        </Ch1Context.Provider>
      </Html>
    </group>
  );
}

/** A flag on a station screen: selectable as a whole, plus a copy button (paste it on the pad). */
export function CopyFlag({ text }: { text: string }) {
  const store = useCh1Store();
  return (
    <span className="ch1-copyflag">
      <span className="ch1-copy">{text}</span>
      <button
        className="c1-btn"
        onClick={() => {
          navigator.clipboard?.writeText(text).then(
            () => store.setState({ toast: { id: Date.now(), text: TEXT.copied, kind: 'info' }, toastLeft: 2 }),
            () => {},
          );
        }}
      >
        COPY
      </button>
    </span>
  );
}
