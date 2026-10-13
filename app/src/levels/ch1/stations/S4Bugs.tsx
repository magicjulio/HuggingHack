/**
 * Station 4 "Bugs" (§Step 6), played in-world on the arcade cabinet. The real code and the bugs
 * are DOM + a canvas on the monitor; with bug-gun installed, each click fires (1 token, +2 per
 * kill) and the turret on top turns to the hit point and shoots a short green beam.
 * (engineer) Aim = the free mouse while the camera is at the cabinet, like the depot, rather than
 * the locked crosshair. Rig: `s4Rig` in design/3d/index.html; bug rules as the old window.
 */
import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  AdditiveBlending,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Vector3,
} from 'three';
import url from '../../../assets/models/ch1-station-4.glb?url';
import slowSvg from '../../../assets/sprites/ch1-bug-slow.svg?url';
import fastSvg from '../../../assets/sprites/ch1-bug-fast.svg?url';
import heisenSvg from '../../../assets/sprites/ch1-bug-heisenbug.svg?url';
import deadSvg from '../../../assets/sprites/ch1-bug-dead.svg?url';
import { FLAGS } from '../config';
import { BUG_TOTAL, BUG_WAVES, S4_BUGGY_LINES, S4_CODE, isComment, waveAfter } from '../content';
import { useCh1, useCh1Store } from '../context';
import { STATIONS } from '../layout';
import { findMat, uiScreen } from '../rig';
import { CopyFlag, ScreenHtml, StationSpot, useStationBase } from './base';

export const S4_PX: [number, number] = [960, 608];
/** Bug canvas resolution (×2 so it stays sharp when the screen is scaled up). */
const RES = 2;

type Kind = 'slow' | 'fast' | 'heisen';
interface Bug {
  x: number;
  y: number;
  dir: number;
  speed: number;
  kind: Kind;
  turnIn: number;
}
const HIT_RADIUS = 0.04; // in screen widths
const HEISEN_RADIUS = 0.14;

const sprite = (src: string) => {
  const img = new Image();
  img.src = src;
  return img;
};
const SPRITES: Record<Kind | 'dead', HTMLImageElement> | null =
  typeof Image === 'undefined'
    ? null
    : { slow: sprite(slowSvg), fast: sprite(fastSvg), heisen: sprite(heisenSvg), dead: sprite(deadSvg) };

function spawn(killed: number): Bug[] {
  const w = waveAfter(killed);
  if (!w) return [];
  const { kind, speed } = BUG_WAVES[w.wave];
  return Array.from({ length: w.remaining }, () => ({
    x: 0.1 + Math.random() * 0.8,
    y: 0.15 + Math.random() * 0.75,
    dir: Math.random() * Math.PI * 2,
    speed,
    kind,
    turnIn: Math.random(),
  }));
}

/** A shot at screen point (u, v), 0..1 from the top left. */
export type Shot = { u: number; v: number };

export function Station4() {
  const { scene } = useGLTF(url);
  const store = useCh1Store();
  const { rig, step, st } = useStationBase(scene, 4);
  const parts = useMemo(() => {
    const m = rig.map;
    const { mat: counter, tex, g: cnt } = uiScreen(m.get('counter'), 's4-counter', 512, 64);
    const beam = new Mesh(
      new CylinderGeometry(0.006, 0.006, 1, 6, 1, true),
      new MeshBasicMaterial({
        color: '#7dffbf',
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    beam.visible = false;
    return {
      cnt,
      tex,
      counter,
      mount: m.get('gun_mount')!,
      head: m.get('gun_head')!,
      muzzle: m.get('gun_muzzle')!,
      glow: findMat(scene, 'gun_glow'),
      marquee: findMat(scene, 'marquee'),
      beam,
    };
  }, [rig, scene]);
  const shot = useRef<{ point: Vector3; t: number } | null>(null);
  const shownKills = useRef(-1);
  const v = useMemo(() => ({ a: new Vector3(), up: new Vector3(0, 1, 0) }), []);

  const onShot = ({ u, v: vv }: Shot) => {
    const S = STATIONS[4].screen;
    const p = S.position.clone();
    p.addScaledVector(new Vector3(1, 0, 0).applyQuaternion(S.quaternion), (u - 0.5) * S.size[0]);
    p.addScaledVector(new Vector3(0, 1, 0).applyQuaternion(S.quaternion), (0.5 - vv) * S.size[1]);
    shot.current = { point: p, t: 0 };
    parts.head.lookAt(p);
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = step(dt);
    const g = store.getState();
    const armed = g.installed.includes('bug-gun');
    parts.mount.visible = armed;
    parts.counter.emissiveIntensity = s.uiK;
    if (parts.marquee)
      parts.marquee.emissiveIntensity =
        s.power === 'off' ? 0 : s.power === 'done' ? 0.4 : 3 * (Math.random() < 0.03 ? 0.3 : 1);
    const sh = shot.current;
    if (parts.glow) parts.glow.emissiveIntensity = armed ? 2 + (sh ? 6 : 0) : 0;
    const b = parts.beam;
    if (sh) {
      sh.t += dt;
      parts.muzzle.getWorldPosition(v.a);
      b.position.copy(v.a).lerp(sh.point, 0.5);
      b.scale.set(1, v.a.distanceTo(sh.point), 1);
      b.quaternion.setFromUnitVectors(v.up, sh.point.clone().sub(v.a).normalize());
      b.visible = sh.t < 0.09;
      (b.material as MeshBasicMaterial).opacity = 1 - sh.t / 0.09;
      if (sh.t > 0.1) shot.current = null;
    } else b.visible = false;

    if (g.s4Killed !== shownKills.current) {
      shownKills.current = g.s4Killed;
      const x = parts.cnt;
      x.fillStyle = '#01060a';
      x.fillRect(0, 0, 512, 64);
      x.fillStyle = '#39ff9c';
      x.font = 'bold 40px "JetBrains Mono", ui-monospace, monospace';
      x.textAlign = 'center';
      x.fillText(`bugs ${g.s4Killed}/${BUG_TOTAL}`, 256, 46);
      parts.tex.needsUpdate = true;
    }
  });

  const L = STATIONS[4];
  return (
    <>
      <group position={L.pos} rotation={[0, L.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <primitive object={parts.beam} />
      <StationSpot spot={rig.spot} />
      <ScreenHtml n={4} px={S4_PX} st={st}>
        <S4Screen onShot={onShot} />
      </ScreenHtml>
    </>
  );
}

function S4Screen({ onShot }: { onShot: (s: Shot) => void }) {
  const store = useCh1Store();
  const killed = useCh1((s) => s.s4Killed);
  const hasGun = useCh1((s) => s.installed.includes('bug-gun'));
  const canvas = useRef<HTMLCanvasElement>(null);
  const bugs = useRef<Bug[]>(spawn(store.getState().s4Killed));
  const mouse = useRef<{ x: number; y: number } | null>(null);
  const splats = useRef<{ x: number; y: number; t: number }[]>([]);
  const gun = useRef(hasGun);
  gun.current = hasGun;

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    const W = (c.width = S4_PX[0] * RES);
    const H = (c.height = (S4_PX[1] - 40) * RES);
    const aspect = H / W;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      g.clearRect(0, 0, W, H);
      if (!bugs.current.length) {
        const k = store.getState().s4Killed;
        if (k < BUG_TOTAL) bugs.current = spawn(k);
      }
      const size = W * 0.046;
      for (const b of bugs.current) {
        b.turnIn -= dt;
        if (b.turnIn <= 0) {
          b.dir += (Math.random() - 0.5) * 2.4;
          b.turnIn = 0.3 + Math.random() * (b.kind === 'fast' ? 0.5 : 1.2);
        }
        b.x += Math.cos(b.dir) * b.speed * dt;
        b.y += (Math.sin(b.dir) * b.speed * dt) / aspect;
        if (b.x < 0.03 || b.x > 0.97) b.dir = Math.PI - b.dir;
        if (b.y < 0.05 || b.y > 0.95) b.dir = -b.dir;
        b.x = Math.max(0.03, Math.min(0.97, b.x));
        b.y = Math.max(0.05, Math.min(0.95, b.y));
        let alpha = 1;
        if (b.kind === 'heisen' && mouse.current) {
          const d = Math.hypot(mouse.current.x - b.x, (mouse.current.y - b.y) * aspect);
          alpha = Math.max(0, Math.min(1, (d - HEISEN_RADIUS * 0.6) / (HEISEN_RADIUS * 0.4)));
        }
        const img = SPRITES?.[b.kind];
        if (!img?.complete) continue;
        g.save();
        g.globalAlpha = alpha;
        g.translate(b.x * W, b.y * H);
        g.rotate(b.dir + Math.PI / 2);
        g.drawImage(img, -size / 2, -size / 2, size, size);
        g.restore();
      }
      splats.current = splats.current.filter((s) => now - s.t < 600);
      for (const s of splats.current) {
        const k = (now - s.t) / 600;
        g.globalAlpha = 1 - k;
        const img = SPRITES?.dead;
        if (img?.complete) g.drawImage(img, s.x * W - size / 2, s.y * H - size / 2, size, size);
        g.fillStyle = '#39ff9c';
        g.beginPath();
        g.arc(s.x * W, s.y * H, size * (0.5 + k), 0, Math.PI * 2);
        g.globalAlpha = 0.35 * (1 - k);
        g.fill();
        g.globalAlpha = 1;
      }
      if (gun.current && mouse.current) {
        const mx = mouse.current.x * W;
        const my = mouse.current.y * H;
        const R = W * 0.018;
        g.strokeStyle = '#39ff9c';
        g.lineWidth = 2 * RES;
        g.beginPath();
        g.arc(mx, my, R, 0, Math.PI * 2);
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          g.moveTo(mx + dx * R * 0.5, my + dy * R * 0.5);
          g.lineTo(mx + dx * R * 1.6, my + dy * R * 1.6);
        }
        g.stroke();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [store]);

  /** Mouse in canvas units. offsetX/offsetWidth: the bounding rect is skewed by the 3D transform. */
  const pos = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget;
    return { x: e.nativeEvent.offsetX / c.offsetWidth, y: e.nativeEvent.offsetY / c.offsetHeight };
  };
  const shoot = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!hasGun || store.getState().s4Killed >= BUG_TOTAL) return;
    const p = pos(e);
    const c = e.currentTarget;
    const aspect = c.offsetHeight / c.offsetWidth;
    store.getState().fireShot();
    // the canvas sits under the 40 px top bar: screen v = (40 + y) / height
    onShot({ u: p.x, v: (40 + p.y * c.offsetHeight) / S4_PX[1] });
    const hit = bugs.current.findIndex(
      (b) => Math.hypot(b.x - p.x, (b.y - p.y) * aspect) < HIT_RADIUS,
    );
    if (hit >= 0) {
      const [b] = bugs.current.splice(hit, 1);
      splats.current.push({ x: b.x, y: b.y, t: performance.now() });
      store.getState().bugKilled();
    }
  };

  const fixed = new Set(S4_BUGGY_LINES.slice(0, killed));
  const done = killed >= BUG_TOTAL;
  return (
    <>
      <div className="c1-win__bar ch1-s4w-bar">
        <span>debug bay</span>
        <span className="ch1-screen-sub">Artifactory 7.146.25 · refreshToken()</span>
        <span style={{ marginLeft: 'auto' }} />
        <span className="ch1-counter">
          bugs <b>{killed}</b>/{BUG_TOTAL}
        </span>
      </div>
      <div className="ch1-s4w">
        <pre className="ch1-code">
          {S4_CODE.map((l, i) => (
            <div
              key={i}
              className={
                fixed.has(i) ? 'fixed' : l.buggy !== l.fixed ? 'buggy' : isComment(l.fixed) ? 'c' : ''
              }
            >
              <span className="ch1-ln">{String(i + 1).padStart(2, ' ')}</span>
              {fixed.has(i) ? l.fixed : l.buggy}
            </div>
          ))}
        </pre>
        <canvas
          ref={canvas}
          className={'ch1-bugs' + (hasGun ? ' gun' : '')}
          onMouseMove={(e) => (mouse.current = pos(e))}
          onMouseLeave={() => (mouse.current = null)}
          onMouseDown={shoot}
        />
        {/* (engineer) source line for the real code, see content.ts */}
        <p className="ch1-s4-source">real code, shown by OpenAI at Black Hat USA 2026</p>
        {done && (
          <div className="ch1-s4w-flag">
            <CopyFlag text={FLAGS[4]} />
          </div>
        )}
      </div>
    </>
  );
}

export const S4_URL = url;
