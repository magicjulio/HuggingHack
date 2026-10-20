import * as THREE from "three";
import { lightPoints } from "./hq.js";

// Approach dressing (landing area): the far armada streaming to the tower and city light below the
// fog sea. Two Points draws in total. createSky(parent, route) -> { update(t, camera, clock) }
export function createSky(parent, route, { armada = 420, city = 700 } = {}) {
  const R = (() => {
    let a = 977;
    return () => ((a = (a * 16807) % 2147483647) - 1) / 2147483646;
  })();
  const z0 = route.z(0) + 400,
    z1 = 200;
  // the far armada: running lights of agent craft in loose streams, well outside the corridor
  const ships = [];
  const cyan = new THREE.Color(0x38d8ff).multiplyScalar(1.3),
    mint = new THREE.Color(0x9fffd0).multiplyScalar(1.1);
  for (let i = 0; i < armada; i++) {
    const stream = i % 6;
    const side = stream % 2 ? 1 : -1;
    ships.push({
      x: side * (160 + stream * 90 + (R() - 0.5) * 140),
      y: 40 + stream * 45 + (R() - 0.5) * 70,
      z: z1 + (z0 - z1) * R(),
      v: 75 + R() * 35,
      c: R() < 0.8 ? cyan : mint,
      s: 2.2 + R() * 1.6,
      ph: R(),
    });
  }
  const fleetPts = lightPoints(armada, { pixelMax: 6, fade: [700, 3200], floor: 0.4 });
  ships.forEach((s, i) => fleetPts.set(i, s, s.c, s.s, 1.6, s.ph, 0.55));
  parent.add(fleetPts);
  // city light under the fog: warm sodium grids and a few cool towers, a few aviation reds
  const cityPts = lightPoints(city, { pixelMax: 5, fade: [500, 3000], floor: 0.2 });
  const warm = new THREE.Color(0xffb35a).multiplyScalar(0.45),
    cool = new THREE.Color(0x9fd2ff).multiplyScalar(0.4),
    red = new THREE.Color(0xff3020).multiplyScalar(0.8);
  const p = new THREE.Vector3();
  for (let i = 0; i < city; i++) {
    // clustered blocks along a few avenues
    const block = Math.floor(R() * 40);
    const bx = ((block * 7919) % 2400) - 1200,
      bz = ((block * 104729) % 3600) - 200;
    p.set(bx + (R() - 0.5) * 220, -320 - R() * 60, bz + (R() - 0.5) * 220);
    if (Math.abs(p.x) < 40) p.x += 80 * Math.sign(p.x || 1);
    const r = R();
    if (r < 0.04) cityPts.set(i, p, red, 4, 0.5, R(), 0.3);
    else cityPts.set(i, p, r < 0.75 ? warm : cool, 2.4 + R() * 2, 0, 0, 0);
  }
  parent.add(cityPts);
  const pos = fleetPts.geometry.attributes.position;
  function update(t, camera, dt) {
    const scale = innerHeight / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    for (const pts of [fleetPts, cityPts]) {
      pts.material.uniforms.time.value = t;
      pts.material.uniforms.scale.value = scale;
    }
    ships.forEach((s, i) => {
      s.z -= s.v * dt;
      if (s.z < z1) s.z += z0 - z1; // they vanish into the tower and new ones come out of the haze
      pos.setXYZ(i, s.x, s.y + Math.sin(t * 0.4 + s.ph * 6) * 3, s.z);
    });
    pos.needsUpdate = true;
  }
  return { update };
}
