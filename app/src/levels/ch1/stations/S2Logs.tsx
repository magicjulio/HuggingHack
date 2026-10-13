/**
 * Station 2 "Search" (§Step 4): the log rack. The portrait screen shows the log rain (canvas
 * texture) while walking around; E still opens the search window (windows/LogStation.tsx).
 * Once grep-lens is installed the lens swings in front of the screen. Rig: `s2Rig` in the hub.
 */
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MathUtils } from 'three';
import url from '../../../assets/models/ch1-station-2.glb?url';
import { generateLogs } from '../content';
import { useCh1Store } from '../context';
import { STATIONS } from '../layout';
import { ease, findMat, restOf, uiScreen } from '../rig';
import { StationSpot, useStationBase } from './base';

const W = 400;
const H = 640;
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const LINES = generateLogs().map((l) => l.text);

export function Station2() {
  const { scene } = useGLTF(url);
  const store = useCh1Store();
  const { rig, step } = useStationBase(scene, 2);
  const parts = useMemo(() => {
    const m = rig.map;
    const { mat: ui, tex, g } = uiScreen(m.get('screen'), 's2-logs', W, H);
    const arm = m.get('lens_arm')!;
    return {
      g,
      tex,
      ui,
      lens: m.get('grep_lens')!,
      arm,
      glass: m.get('lens')!,
      park: restOf(arm).rotation.y,
      leds: [findMat(scene, 'rack_leds'), findMat(scene, 'rack_leds_cyan')],
    };
  }, [rig, scene]);
  const anim = useRef({ t: -1, shown: false, off: 0, blink: 0 });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = step(dt);
    const time = clock.elapsedTime;
    const has = store.getState().installed.includes('grep-lens');
    const a = anim.current;
    const swing = MathUtils.degToRad(-92);
    if (!has) {
      parts.lens.visible = false;
      a.shown = false;
    } else if (!a.shown) {
      parts.lens.visible = true;
      a.shown = true;
      a.t = 0;
    }
    let ry = has ? swing : parts.park;
    if (a.t >= 0) {
      a.t += dt;
      ry = parts.park + (swing - parts.park) * ease(a.t / 0.9);
      if (a.t > 0.9) a.t = -1;
    }
    parts.arm.rotation.y = ry;
    parts.glass.rotation.y = -ry; // the glass keeps facing the room

    a.blink -= dt;
    if (a.blink <= 0) {
      a.blink = 0.08 + Math.random() * 0.25;
      for (const m of parts.leds) if (m) m.emissiveIntensity = s.power === 'off' ? 0 : Math.random() < 0.5 ? 2.5 : 0.3;
    }

    // log rain (only drawn while visible)
    parts.ui.emissiveIntensity = s.uiK;
    if (s.power === 'off') return;
    const g = parts.g;
    g.fillStyle = '#01070a';
    g.fillRect(0, 0, W, H);
    a.off += dt * (s.power === 'done' ? 20 : 140);
    g.font = `15px ${MONO}`;
    const start = Math.floor(a.off / 18);
    for (let i = 0; i < 34; i++) {
      const l = LINES[(start + i) % LINES.length];
      g.fillStyle = `rgba(57,255,156,${0.25 + 0.6 * (i / 34)})`;
      g.fillText(l.slice(0, 40), 12, 80 + i * 17 - (a.off % 18));
    }
    g.fillStyle = '#062431';
    g.fillRect(0, 0, W, 56);
    g.fillStyle = '#9fe8ff';
    g.font = `16px ${MONO}`;
    g.fillText(has ? `grep-lens ready${(time * 2) % 1 < 0.5 ? ' ▌' : ''}` : '/var/log/doors  (no search tool)', 12, 24);
    g.fillStyle = '#ffd27a';
    g.fillText(`${LINES.length} lines`, 12, 46);
    parts.tex.needsUpdate = true;
  });

  const L = STATIONS[2];
  return (
    <>
      <group position={L.pos} rotation={[0, L.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <StationSpot spot={rig.spot} />
    </>
  );
}

export const S2_URL = url;
