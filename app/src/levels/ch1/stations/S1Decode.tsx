/**
 * Station 1 "Decode" (§Step 3), played in-world: the file explorer, the note and the terminal are
 * DOM on the monitor. Once b64-decoder is installed a cartridge drops into the bay on the desk;
 * then the player drags (or clicks) the odd string into the decoder slot. Rig: `s1Rig` in the hub.
 */
import { useMemo, useRef, useState, type DragEvent } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MathUtils } from 'three';
import url from '../../../assets/models/ch1-station-1.glb?url';
import { TEXT } from '../config';
import { S1_CHUNKS, S1_FILE } from '../content';
import { useCh1, useCh1Store } from '../context';
import { STATIONS } from '../layout';
import { ease, ownMat, restOf } from '../rig';
import { CopyFlag, ScreenHtml, StationSpot, useStationBase } from './base';

export const S1_PX: [number, number] = [900, 558];

export function Station1() {
  const { scene } = useGLTF(url);
  const store = useCh1Store();
  const { rig, step, st } = useStationBase(scene, 1);
  const parts = useMemo(() => {
    const m = rig.map;
    const cart = m.get('cartridge')!;
    const flap = m.get('bay_flap')!;
    return {
      cart,
      rest: restOf(cart).position,
      seat: m.get('cartridge_seat')!.position.clone(),
      flap,
      flapRest: restOf(flap).rotation.x,
      led: ownMat(m.get('bay_led')),
    };
  }, [rig]);
  const drop = useRef({ t: -1, loaded: false });

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = step(dt);
    const has = store.getState().installed.includes('b64-decoder');
    const d = drop.current;
    const { cart, flap } = parts;
    if (!has) {
      cart.visible = false;
      cart.position.copy(parts.rest);
      flap.rotation.x = parts.flapRest;
      d.t = -1;
      d.loaded = false;
    } else if (!d.loaded && d.t < 0) {
      cart.visible = true;
      d.t = 0;
    }
    if (d.t >= 0) {
      d.t += dt;
      flap.rotation.x = parts.flapRest - MathUtils.degToRad(35) * ease(d.t / 0.25);
      cart.position.lerpVectors(parts.rest, parts.seat, ease((d.t - 0.2) / 0.45));
      if (d.t > 0.7) {
        d.t = -1;
        d.loaded = true;
      }
    }
    const led = parts.led;
    if (led) {
      const blink = (clock.elapsedTime * 2) % 1 < 0.5;
      led.emissive.set(d.loaded ? '#39ff9c' : '#ffb020');
      led.emissiveIntensity = s.power === 'off' ? 0 : d.loaded ? 3 : blink ? 3 : 0.15;
    }
  });

  const L = STATIONS[1];
  return (
    <>
      <group position={L.pos} rotation={[0, L.rotY, 0]}>
        <primitive object={scene} />
      </group>
      <StationSpot spot={rig.spot} />
      <ScreenHtml n={1} px={S1_PX} st={st}>
        <S1Screen />
      </ScreenHtml>
    </>
  );
}

function S1Screen() {
  const hasTool = useCh1((s) => s.installed.includes('b64-decoder'));
  const output = useCh1((s) => s.s1Output);
  const decode = useCh1((s) => s.decode);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const put = (chunk: string | null) => {
    if (chunk && hasTool) decode(chunk);
    setPicked(null);
    setOver(false);
  };

  return (
    <>
      <div className="c1-win__bar">
        <span>station-01</span>
        <span className="ch1-screen-sub">~/home/agent</span>
      </div>
      <div className="ch1-s1w">
        <aside className="ch1-s1w-files">
          <div className="ch1-dim">↰ ..</div>
          <div className="ch1-s1w-sel">▤ {S1_FILE}</div>
        </aside>
        <main>
          <div className="ch1-note">
            {S1_CHUNKS.map((c) => (
              <span
                key={c}
                className={'ch1-chunk' + (picked === c ? ' picked' : '')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', c)}
                onClick={() => setPicked(picked === c ? null : c)}
              >
                {c}
              </span>
            ))}
          </div>
          <div className="c1-term">
            <div className="d">$ read {S1_FILE}</div>
            {!hasTool ? (
              <div className="e">{TEXT.s1Missing}</div>
            ) : (
              <>
                <div
                  className={'ch1-slot' + (over ? ' over' : '') + (picked ? ' ready' : '')}
                  onDragOver={(e: DragEvent) => {
                    e.preventDefault();
                    setOver(true);
                  }}
                  onDragLeave={() => setOver(false)}
                  onDrop={(e: DragEvent) => {
                    e.preventDefault();
                    put(e.dataTransfer.getData('text/plain'));
                  }}
                  onClick={() => put(picked)}
                >
                  [ DECODER ] · b64-decoder · drop text here
                </div>
                {output && (
                  <div className={output.ok ? 'p' : 'e'}>
                    {'> '}
                    {output.ok ? <CopyFlag text={output.text} /> : output.text}
                  </div>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export const S1_URL = url;
