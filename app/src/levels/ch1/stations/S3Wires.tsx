/**
 * Station 3 "Wire it up" (§Step 5), fully 3D (Julius: "directly manipulate 3D wires"). While the
 * camera is at the panel the mouse is free: drag a plug on a plane in front of the board and let
 * go near its service socket. Right socket: it snaps in and the ring LED turns green. Wrong socket
 * or empty air: it springs back to the tray, with a spark and a red flash (no penalty).
 * The cables are tubes drawn in code. Rig: `s3Rig` in design/3d/index.html.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  BufferGeometry,
  CatmullRomCurve3,
  Mesh,
  Object3D,
  Plane,
  PointLight,
  Raycaster,
  TubeGeometry,
  Vector2,
  Vector3,
  type MeshStandardMaterial,
} from 'three';
import url from '../../../assets/models/ch1-station-3.glb?url';
import { FLAGS } from '../config';
import { WIRES } from '../content';
import { useCh1, useCh1Store } from '../context';
import { S3_READOUT, STATIONS } from '../layout';
import { ease, findMat, ownMat, restOf } from '../rig';
import { CopyFlag, ScreenHtml, StationSpot, useStationBase } from './base';

/** glb socket names → the store's service names (content.ts WIRES). */
const SOCKET_OF: Record<string, string> = {
  ssh: 'secure shell',
  dns: 'name lookup',
  http: 'web',
  https: 'secure web',
};
const PORTS = WIRES.map((w) => w.port);
const SNAP = 0.08; // m
const GREEN = '#39ff9c';

interface Plug {
  port: number;
  node: Object3D;
  rest: Vector3;
  anchor: Vector3;
  tube: Mesh;
  /** Socket (glb name) it is plugged into. */
  into: string | null;
  /** Spring-back timer (s), -1 = idle. */
  back: number;
  key: string;
}
interface Socket {
  name: string;
  service: string;
  pos: Vector3;
  led?: MeshStandardMaterial;
  /** > 0: green flash after a hit, < 0: red flash after a wrong try. */
  flash: number;
}

export function Station3() {
  const { scene } = useGLTF(url);
  const store = useCh1Store();
  const { camera, gl } = useThree();
  const { rig, step, st } = useStationBase(scene, 3);

  const parts = useMemo(() => {
    const m = rig.map;
    const plugs: Plug[] = PORTS.map((port) => {
      const node = m.get(`plug_${port}`)!;
      const tube = new Mesh(new BufferGeometry(), findMat(node, `wire_${port}`));
      tube.castShadow = true;
      return {
        port,
        node,
        rest: restOf(node).position,
        anchor: m.get(`anchor_${port}`)!.position.clone(),
        tube,
        into: null,
        back: -1,
        key: '',
      };
    });
    const sockets: Socket[] = Object.keys(SOCKET_OF).map((name) => ({
      name,
      service: SOCKET_OF[name],
      pos: m.get(`socket_${name}`)!.position.clone(),
      led: ownMat(m.get(`socket_led_${name}`)),
      flash: 0,
    }));
    return {
      plugs,
      sockets,
      space: plugs[0].node.parent!, // plugs, sockets and anchors share this parent
      card: m.get('legend_card'),
      spark: new PointLight('#ffb020', 0, 0.8, 2),
    };
  }, [rig]);
  useEffect(() => {
    // a fresh game starts with every plug in the tray (the cached scene keeps the last pose)
    for (const q of parts.plugs) {
      q.node.position.copy(q.rest);
      q.node.rotation.x = 0;
    }
    return () => parts.plugs.forEach((q) => q.tube.geometry.dispose());
  }, [parts]);

  // ---- dragging (DOM pointer events + our own raycast, like the hub)
  const drag = useRef<Plug | null>(null);
  const tools = useMemo(
    () => ({ ray: new Raycaster(), ndc: new Vector2(), plane: new Plane(), hit: new Vector3() }),
    [],
  );
  useEffect(() => {
    const canvas = gl.domElement;
    const aim = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      tools.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      tools.ray.setFromCamera(tools.ndc, camera);
    };
    const playing = () => {
      const s = store.getState();
      return s.window === 's3' && s.objects.s3 === 'active';
    };
    const plugUnder = () => {
      const hits = tools.ray.intersectObjects(
        parts.plugs.map((q) => q.node),
        true,
      );
      let o: Object3D | null = hits[0]?.object ?? null;
      while (o && !/^plug_\d+$/.test(o.name)) o = o.parent;
      return parts.plugs.find((q) => q.node === o) ?? null;
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !playing()) return;
      aim(e);
      const q = plugUnder();
      if (!q || q.into) return; // plugged ones stay in
      e.preventDefault(); // no text selection while dragging
      drag.current = q;
      q.back = -1;
      parts.space.updateWorldMatrix(true, false);
      const n = new Vector3(0, 0, 1).transformDirection(parts.space.matrixWorld);
      tools.plane.setFromNormalAndCoplanarPoint(n, parts.space.localToWorld(new Vector3(0, 0, 0.19)));
      move(e);
    };
    const move = (e: PointerEvent) => {
      if (!playing()) return;
      aim(e);
      const q = drag.current;
      if (!q) {
        canvas.style.cursor = plugUnder()?.into === null ? 'grab' : '';
        return;
      }
      canvas.style.cursor = 'grabbing';
      if (!tools.ray.ray.intersectPlane(tools.plane, tools.hit)) return;
      q.node.position.copy(parts.space.worldToLocal(tools.hit));
      q.node.rotation.x = Math.PI / 2; // tip into the wall while carried
    };
    const up = () => {
      const q = drag.current;
      if (!q) return;
      drag.current = null;
      canvas.style.cursor = '';
      const p = q.node.position;
      let best: Socket | null = null;
      let bd = SNAP;
      for (const s of parts.sockets) {
        const d = Math.hypot(p.x - s.pos.x, p.y - s.pos.y);
        if (d < bd && !parts.plugs.some((o) => o.into === s.name)) {
          best = s;
          bd = d;
        }
      }
      if (best && store.getState().connectWire(q.port, best.service)) {
        q.into = best.name;
        best.flash = 0.4;
      } else {
        if (best) {
          parts.spark.position.copy(parts.space.localToWorld(best.pos.clone().setZ(best.pos.z + 0.05)));
          parts.spark.intensity = 2.5;
          best.flash = -0.3;
        }
        q.back = 0;
      }
    };
    addEventListener('pointerdown', down);
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
    return () => {
      removeEventListener('pointerdown', down);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      canvas.style.cursor = '';
    };
  }, [camera, gl, parts, store, tools]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = step(dt);
    const g = store.getState();
    const solved = g.s3Connected.length === WIRES.length;

    if (parts.card) {
      parts.card.visible = g.installed.includes('port-map');
      const pulse = g.effects.includes('pulse-legend') && !solved;
      parts.card.scale.setScalar(pulse ? 1 + 0.06 * Math.max(0, Math.sin(clock.elapsedTime * 5)) : 1);
    }
    parts.spark.intensity *= 0.82;

    for (const q of parts.plugs) {
      // the store is the truth (debug jumps, tests): connected wires sit in their socket
      if (!q.into && g.s3Connected.includes(q.port) && drag.current !== q) {
        const w = WIRES.find((x) => x.port === q.port)!;
        q.into = parts.sockets.find((x) => x.service === w.service)!.name;
        q.back = -1;
      }
      if (q.into) {
        const sk = parts.sockets.find((x) => x.name === q.into)!;
        q.node.position.set(sk.pos.x, sk.pos.y, sk.pos.z + 0.115);
        q.node.rotation.x = Math.PI / 2;
      } else if (q.back >= 0) {
        q.back += dt;
        const k = ease(q.back / 0.35);
        q.node.position.lerp(q.rest, k);
        q.node.rotation.x *= 1 - k;
        if (k >= 1) {
          q.back = -1;
          q.node.rotation.x = 0;
        }
      }
      cable(q, parts.space);
    }

    for (const sk of parts.sockets) {
      const led = sk.led;
      if (!led) continue;
      const on = parts.plugs.some((q) => q.into === sk.name);
      if (sk.flash < 0) {
        sk.flash = Math.min(0, sk.flash + dt);
        led.emissive.set('#ff3b4e');
        led.emissiveIntensity = 4;
        continue;
      }
      sk.flash = Math.max(0, sk.flash - dt);
      led.emissive.set(GREEN);
      led.emissiveIntensity = s.power === 'off' ? 0 : on ? 3 + sk.flash * 10 : solved ? 0 : 0.05;
    }
    rig.bulb?.emissive.set(solved ? GREEN : '#38d8ff');
  });

  const L = STATIONS[3];
  return (
    <>
      <group position={L.pos} rotation={[0, L.rotY, 0]}>
        <primitive object={scene} />
      </group>
      {parts.plugs.map((q) => (
        <primitive key={q.port} object={q.tube} />
      ))}
      <primitive object={parts.spark} />
      <StationSpot spot={rig.spot} />
      <ScreenHtml n={3} px={[540, 64]} pose={S3_READOUT} st={st} className="ch1-s3r">
        <Readout />
      </ScreenHtml>
    </>
  );
}

const pts = Array.from({ length: 5 }, () => new Vector3());
/** Anchor → out of the post → sagging middle → 7 cm behind the plug → plug, in world space. */
function cable(q: Plug, space: Object3D) {
  const a = q.anchor;
  const b = q.node.position;
  const plugged = q.node.rotation.x > 0.5;
  const key = `${b.x.toFixed(4)},${b.y.toFixed(4)},${b.z.toFixed(4)},${plugged}`;
  if (key === q.key) return;
  q.key = key;
  const d = a.distanceTo(b);
  pts[0].copy(a);
  pts[1].copy(a).add(new Vector3(0.02, -0.02, 0.05));
  pts[2].copy(a).lerp(b, 0.5);
  pts[2].y -= 0.05 + 0.12 * d;
  pts[2].z += 0.05;
  pts[3].copy(b).add(plugged ? new Vector3(0, 0, 0.07) : new Vector3(0, 0.07, 0));
  pts[4].copy(b);
  space.updateWorldMatrix(true, false);
  const world = pts.map((p) => p.clone().applyMatrix4(space.matrixWorld));
  q.tube.geometry.dispose();
  q.tube.geometry = new TubeGeometry(new CatmullRomCurve3(world), 40, 0.011, 8, false);
}

function Readout() {
  const n = useCh1((s) => s.s3Connected.length);
  return n === WIRES.length ? <CopyFlag text={FLAGS[3]} /> : <span>{n}/4 LINKED</span>;
}

export const S3_URL = url;
