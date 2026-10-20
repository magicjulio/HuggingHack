import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { asset } from '../end2/game/assets.js';
import { loadBrand } from '../end2/game/art.js';

/**
 * The Hugging Face tower in the distance: Ending 2's HQ (end2-hq.glb) with the official logo, so the tower you pick
 * is the building you land at. Kept cheap for a far preview: the model's merged meshes and one flat logo plate; no
 * searchlights, beacons, spotlight or extruded badge (those are E2's approach, hq.js). Fog is off on it (at ~500 m the
 * scene's fog would erase it, like phaseOne's far places, which draw their own haze).
 * loadHFTower() -> { object, logo: Vector3 (anchor, model units), dispose() }
 */
// the approach area's merged meshes (deck runway, ground paint, hazard rails, the district around it): not part of the
// tower, and far too wide for this slot
const FAR = new Set(['hq_deck', 'hq_paint', 'hq_hazard', 'hq_gunmetal', 'hq_glow_warm']);
const LOGO = 1.6;   // the logo plate, x E2's size: read from ~500 m away

export async function loadHFTower() {
  const [gltf, brand] = await Promise.all([new GLTFLoader().loadAsync(asset('end2-hq.glb')), loadBrand()]);
  const object = new THREE.Group(); object.name = 'hfTower';
  const hq = gltf.scene; object.add(hq);
  const logo = new THREE.Vector3(0, 262, 29);   // hq.js default; the model's logo_anchor wins
  hq.updateMatrixWorld(true);
  const drop = [];
  hq.traverse((o) => {
    if (o.name === 'logo_anchor') o.getWorldPosition(logo);
    if (!o.isMesh) return;
    if (FAR.has(o.material.name)) { drop.push(o); return; }
    o.material.fog = false;
  });
  for (const o of drop) { o.removeFromParent(); o.geometry.dispose(); o.material.dispose(); }
  const plate = brand.plate(210 * LOGO, new THREE.MeshBasicMaterial({ map: brand.logoTexture, transparent: true, alphaTest: .02, fog: false, toneMapped: false }));
  plate.position.copy(logo).add(new THREE.Vector3(0, 0, 2)); object.add(plate);
  brand.wordTexture.dispose();
  return {
    object, logo,
    dispose() {
      object.traverse((o) => { if (!o.isMesh) return; o.geometry.dispose(); for (const m of [o.material].flat()) { for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose(); } });
    },
  };
}
