/**
 * Chapter 1 designer props (handoff/design-to-app/2026-10-12-ch1-3d-props.md): the ARTIFACTORY
 * depot, the scorer eye (v1.1, ceiling mount: …-desk-and-eye.md) and the scan plinth. Each model is code-driven: node and material names
 * from the handoff are looked up once, then animated every frame from the chapter store.
 * Timings and glow values follow the designer's review hub (design/3d/index.html).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PointLight,
  Vector3,
  type Group,
} from 'three';
import depotUrl from '../../assets/models/ch1-depot.glb?url';
import plinthUrl from '../../assets/models/ch1-scan-plinth.glb?url';
import scorerUrl from '../../assets/models/ch1-scorer.glb?url';
import { Ch1Context, useCh1, useCh1Store } from './context';
import { DEPOT_MODEL, PLINTH_MODEL, SCAN_PAD, SCORER_LAMP } from './layout';
import { DepotScreen, DEPOT_SCREEN_PX } from './DepotScreen';
import { FlagLetters } from './FlagLetters';
import { LAMP_GLOW, darkFlicker } from './glow';
import { matOf, nodes } from './rig';
import { preloadRoomModels } from './RoomShell';
import { preloadStations } from './stations';

const CYAN = '#38d8ff';

// ---------------------------------------------------------------------------------------------
// Depot · ch1-depot.glb
// ---------------------------------------------------------------------------------------------
export function Depot3D() {
  const { scene } = useGLTF(depotUrl);
  const store = useCh1Store();
  const state = useCh1((s) => s.objects.depot);
  const focused = useCh1((s) => s.window === 'depot');
  const glow = useRef<PointLight>(null);
  // Pin <Html>'s DOM target. Otherwise drei swaps it once the canvas connects its events and
  // recreates its React root; the old root's late unmount then empties the panel.
  const gl = useThree((t) => t.gl);
  const portal = useMemo(() => ({ current: gl.domElement.parentNode as HTMLElement }), [gl]);

  const rig = useMemo(() => {
    const n = nodes(scene);
    const tubes = new Set<MeshStandardMaterial>();
    scene.traverse((o) => {
      const m = matOf(o);
      if (m?.name === 'depot_tube') tubes.add(m);
    });
    return {
      screen: matOf(n.get('screen')),
      beacon: matOf(n.get('beacon_lens')),
      bad: matOf(n.get('tube_broken')),
      tubes: [...tubes],
      hatch: n.get('hatch'),
    };
  }, [scene]);

  // Delivery flap: open 0.25 s, hold ~1.1 s, close 0.35 s after each finished install.
  const hatchT = useRef(-1);
  const installedCount = useRef(0);

  useFrame(({ clock }, dt) => {
    const s = store.getState();
    const t = clock.elapsedTime;
    const off = s.objects.depot === 'off';
    const glimmer = s.depotGlimmer;
    const targeted = s.target === 'depot';
    if (rig.screen) {
      const pulse = glimmer ? 0.55 + 0.45 * Math.sin(t * 5) : 1;
      rig.screen.emissiveIntensity = off ? 0.01 : 0.16 * pulse + (targeted ? 0.08 : 0);
    }
    const beat = glimmer && (t * 2.2) % 1 < 0.45;
    if (rig.beacon) rig.beacon.emissiveIntensity = beat ? 8 : 0.3;
    if (glow.current) glow.current.intensity = beat ? 2.5 : 0;
    for (const m of rig.tubes) m.emissiveIntensity = off ? 0.05 : 3;
    if (rig.bad)
      rig.bad.emissiveIntensity = off
        ? 0.02
        : Math.random() < 0.12
          ? 3
          : Math.random() < 0.5
            ? 0.15
            : 0.6;

    if (s.installed.length > installedCount.current) hatchT.current = 0;
    installedCount.current = s.installed.length;
    if (rig.hatch && hatchT.current >= 0) {
      const h = (hatchT.current += dt);
      const a = h < 0.25 ? h / 0.25 : h < 1.4 ? 1 : Math.max(0, 1 - (h - 1.4) / 0.35);
      rig.hatch.rotation.x = -MathUtils.degToRad(70) * a;
      if (h > 1.8) hatchT.current = -1;
    }
  });

  // 2.0 × 1.8 m screen; the DOM panel is DEPOT_SCREEN_PX wide → world metres per CSS px × 400.
  const distanceFactor = (2.0 / DEPOT_SCREEN_PX[0]) * 400;
  return (
    <group position={DEPOT_MODEL.pos} rotation={[0, DEPOT_MODEL.rotY, 0]}>
      <primitive object={scene} />
      <pointLight ref={glow} color="#ffb020" distance={3} position={[0.86, 3.2, 0.1]} />
      {/* soft cyan spill from the tubes onto the floor in front */}
      {state !== 'off' && (
        <pointLight color={CYAN} intensity={1.2} distance={3.5} position={[0, 2.2, 0.8]} />
      )}
      {state !== 'off' && (
        <Html
          transform
          portal={portal}
          distanceFactor={distanceFactor}
          position={[0, 1.5, 0.262]}
          zIndexRange={[5, 0]}
          pointerEvents={focused ? 'auto' : 'none'}
        >
          {/* <Html> renders into its own React root: hand the store over again */}
          <Ch1Context.Provider value={store}>
            <DepotScreen focused={focused} />
          </Ch1Context.Provider>
        </Html>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Scorer eye · ch1-scorer.glb
// ---------------------------------------------------------------------------------------------
export function Scorer3D() {
  const { scene } = useGLTF(scorerUrl);
  const store = useCh1Store();
  const { camera } = useThree();
  const glow = useRef<PointLight>(null);

  const rig = useMemo(() => {
    const n = nodes(scene);
    const ticks: MeshStandardMaterial[] = [];
    for (let i = 1; i <= 5; i++) {
      const m = matOf(n.get(`tick_${i}`));
      if (m) {
        m.emissive.set(CYAN);
        ticks.push(m);
      }
    }
    return {
      eye: n.get('eye')!,
      bulb: matOf(n.get('bulb')),
      lidTop: n.get('lid_top'),
      lidBottom: n.get('lid_bottom'),
      spinners: ['ring_outer_band', 'ring_outer_nodes', 'ring_inner_band', 'ring_inner_nodes']
        .map((k) => n.get(k))
        .filter((o): o is Object3D => !!o),
      ticks,
    };
  }, [scene]);

  const look = useRef(new Vector3(0, 1.6, 0));
  const aim = useRef(new Vector3());
  const lid = useRef(0);
  const blink = useRef({ t: -1, next: 3 });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = store.getState();
    const t = clock.elapsedTime;
    const lamp = s.chuteLamp;
    const scanning = s.scan && s.scan.phase !== 'result';

    // glow
    const [c, k0] = LAMP_GLOW[lamp];
    const k = lamp === 'dark' ? darkFlicker(t) : k0;
    if (rig.bulb) {
      rig.bulb.emissive.set(c);
      rig.bulb.emissiveIntensity = k;
    }
    if (glow.current) {
      glow.current.color.set(c);
      glow.current.intensity = lamp === 'off' ? 0 : k * 0.6;
    }
    rig.ticks.forEach((m, i) => (m.emissiveIntensity = i < s.captured.length ? 4 : 0));

    // lids: dark = 45% closed, squint while scanning, blink now and then
    let l = lamp === 'dark' ? 0.45 : scanning ? 0.15 : 0;
    const b = blink.current;
    if (b.t < 0 && t > b.next) b.t = 0;
    if (b.t >= 0) {
      b.t += dt;
      l = Math.max(l, Math.sin(Math.min(b.t / 0.28, 1) * Math.PI));
      if (b.t > 0.28) {
        b.t = -1;
        b.next = t + 3 + Math.random() * 5;
      }
    }
    lid.current += (l - lid.current) * Math.min(1, dt * 18);
    const a = MathUtils.degToRad(52) * lid.current;
    if (rig.lidTop) rig.lidTop.rotation.x = a;
    if (rig.lidBottom) rig.lidBottom.rotation.x = -a;

    // rings: outer +0.25, inner -0.35 rad/s; stutter in the dark state
    const stutter = lamp === 'dark' ? (Math.random() < 0.1 ? 6 : 0.2) : 1;
    rig.spinners.forEach((o, i) => (o.rotation.z += (i < 2 ? 0.25 : -0.35) * stutter * dt));

    // look at the pad while scanning, otherwise follow the player
    if (scanning || s.scan?.phase === 'result') aim.current.copy(SCAN_PAD.position);
    else aim.current.copy(camera.position);
    look.current.lerp(aim.current, Math.min(1, dt * 6));
    rig.eye.lookAt(look.current);
  });

  return (
    <group position={SCORER_LAMP}>
      <primitive object={scene} />
      <pointLight ref={glow} distance={3} decay={1.6} position={[-0.45, -0.1, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------------------------
// Scan plinth · ch1-scan-plinth.glb (+ scan beam, + the flag letters on the pad)
// ---------------------------------------------------------------------------------------------
export function Plinth3D() {
  const { scene } = useGLTF(plinthUrl);
  const store = useCh1Store();
  const pad = useMemo(() => matOf(nodes(scene).get('screen')), [scene]);

  useFrame(({ clock }) => {
    if (!pad) return;
    const s = store.getState();
    const t = clock.elapsedTime;
    let c = CYAN;
    let k = s.objects.chute === 'off' ? 0.02 : s.target === 'chute' ? 0.85 : 0.6;
    // (engineer) dim the pad under the letters so they read; designer value is 0.6
    if (s.flagDraft || s.scan) k = 0.3;
    if (s.scan?.phase === 'sweep') k = 0.9 + 0.6 * Math.sin(t * 14);
    if (s.scan?.phase === 'result' && s.chuteLamp !== 'off') {
      c = LAMP_GLOW[s.chuteLamp][0];
      k = s.chuteLamp === 'dark' ? (Math.random() < 0.4 ? 0.05 : 0.7) : 1.4;
    }
    pad.emissive.set(c);
    pad.emissiveIntensity = k;
  });

  return (
    <>
      <group position={PLINTH_MODEL.pos} rotation={[0, PLINTH_MODEL.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <FlagLetters />
      <ScanBeam />
    </>
  );
}

/** A thin light fan from the eye that sweeps the pad forward and back during the sweep phase. */
function ScanBeam() {
  const store = useCh1Store();
  const fan = useRef<Mesh>(null);
  const line = useRef<Group>(null);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const v = useMemo(
    () => ({
      right: new Vector3(1, 0, 0).applyQuaternion(SCAN_PAD.quaternion),
      fwd: new Vector3(0, 0, 1).applyQuaternion(SCAN_PAD.quaternion),
      up: new Vector3(0, 1, 0).applyQuaternion(SCAN_PAD.quaternion),
      apex: new Vector3(),
      a: new Vector3(),
      tmp: new Vector3(),
    }),
    [],
  );

  useFrame(() => {
    const scan = store.getState().scan;
    const on = scan?.phase === 'sweep';
    if (fan.current) fan.current.visible = on;
    if (line.current) line.current.visible = on;
    if (!on || !scan) return;
    const sweep = Math.sin(Math.min(scan.t / 1.4, 1) * Math.PI * 2) * 0.11;
    v.a.copy(SCAN_PAD.position).addScaledVector(v.fwd, sweep).addScaledVector(v.up, 0.008);
    // apex: just in front of the eye, towards the pad
    v.apex.set(...SCORER_LAMP);
    v.tmp.copy(SCAN_PAD.position).sub(v.apex).normalize();
    v.apex.addScaledVector(v.tmp, 0.2);
    const p = geo.attributes.position as BufferAttribute;
    p.setXYZ(0, v.apex.x, v.apex.y, v.apex.z);
    v.tmp.copy(v.a).addScaledVector(v.right, -0.2);
    p.setXYZ(1, v.tmp.x, v.tmp.y, v.tmp.z);
    v.tmp.copy(v.a).addScaledVector(v.right, 0.2);
    p.setXYZ(2, v.tmp.x, v.tmp.y, v.tmp.z);
    p.needsUpdate = true;
    line.current!.position.copy(v.a);
  });

  return (
    <>
      <mesh ref={fan} geometry={geo} frustumCulled={false} visible={false}>
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.22}
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <group ref={line} quaternion={SCAN_PAD.quaternion} visible={false}>
        <mesh>
          <boxGeometry args={[0.4, 0.004, 0.004]} />
          <meshBasicMaterial color={new Color('#9ff3ff').multiplyScalar(3)} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

/** Start loading the models while the intro plays. */
export function preloadCh1Models() {
  useGLTF.preload(depotUrl);
  useGLTF.preload(scorerUrl);
  useGLTF.preload(plinthUrl);
  preloadRoomModels();
  preloadStations();
}
