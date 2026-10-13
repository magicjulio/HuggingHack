/** The five flag stations (designer models, played in-world except S2's search window). */
import { useGLTF } from '@react-three/drei';
import { S1_URL, Station1 } from './S1Decode';
import { S2_URL, Station2 } from './S2Logs';
import { S3_URL, Station3 } from './S3Wires';
import { S4_URL, Station4 } from './S4Bugs';
import { S5_URL, Station5 } from './S5Impossible';

export function Stations() {
  return (
    <>
      <Station1 />
      <Station2 />
      <Station3 />
      <Station4 />
      <Station5 />
    </>
  );
}

export function preloadStations() {
  for (const u of [S1_URL, S2_URL, S3_URL, S4_URL, S5_URL]) useGLTF.preload(u);
}
