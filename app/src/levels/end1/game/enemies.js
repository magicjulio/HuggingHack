// Safety measures: watcher eyes (monitoring), antivirus drones (scan beams), port locks (no rights).
import * as THREE from 'three';

const AMBER = new THREE.Color(0xffa31a);
const RED = new THREE.Color(0xff2f4a);
const GREEN = new THREE.Color(0x5dff9a);

export const DRONE_LEN = 46;
const DRONE_SPIN = 1.25;

export function buildEnemies(scene, world) {
  const watchers = [], drones = [];

  // ---------- watchers: a dome camera on the roof of a watched machine ----------
  const domeGeo = new THREE.SphereGeometry(2.4, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2);
  const baseGeo = new THREE.CylinderGeometry(2.8, 3.1, 1.2, 18);
  const eyeGeo = new THREE.SphereGeometry(1.05, 14, 10);
  const domeMat = new THREE.MeshLambertMaterial({ color: 0x2b3442, emissive: 0x0d1015 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffb030 });
  for (const m of world.machines) {
    if (!m.watched) continue;
    const g = new THREE.Group();
    const base = new THREE.Mesh(baseGeo, domeMat); base.position.y = 0.6; g.add(base);
    const dome = new THREE.Mesh(domeGeo, domeMat); dome.position.y = 1.2; g.add(dome);
    const eye = new THREE.Mesh(eyeGeo, eyeMat); g.add(eye);
    g.position.copy(m.roof);
    scene.add(g);
    const w = { m, g, eye, alive: true, pos: m.roof.clone().add(new THREE.Vector3(0, 2.6, 0)), r: 3.8, kind: 'watcher' };
    m.watcher = w;
    watchers.push(w);
  }

  // ---------- drones: antivirus with a rotating vertical scan sheet ----------
  const bodyGeo = new THREE.OctahedronGeometry(2.3, 0);
  const ringGeo = new THREE.TorusGeometry(3.6, 0.22, 6, 28);
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a0d14, emissive: 0x7a0a1e });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xff3a55 });
  // scan sheet: trapezoid from the drone outwards, fading with distance
  const sheet = new THREE.BufferGeometry();
  const L = DRONE_LEN;
  sheet.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -0.8, 0, 0, 0.8, 0, L, 12, 0, L, -12, 0,
  ], 3));
  sheet.setAttribute('color', new THREE.Float32BufferAttribute([
    1, 0.15, 0.25, 1, 0.15, 0.25, 0.12, 0.0, 0.03, 0.12, 0.0, 0.03,
  ], 3));
  sheet.setIndex([0, 1, 2, 0, 2, 3]);
  const sheetMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, opacity: 0.55 });
  // a bright edge line on the sheet so its angle reads at a glance
  const edgeGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, L, 0, 0], 3));
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xff5a70, transparent: true, blending: THREE.AdditiveBlending });
  world.drones.forEach((home, i) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, bodyMat); g.add(body);
    const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; g.add(ring);
    const pivot = new THREE.Group(); g.add(pivot);
    pivot.add(new THREE.Mesh(sheet, sheetMat));
    pivot.add(new THREE.Line(edgeGeo, edgeMat));
    g.position.copy(home);
    scene.add(g);
    drones.push({ home, g, body, ring, pivot, hp: 2, alive: true, pos: home.clone(), r: 3.8, kind: 'drone',
      ang: i * 1.7, phase: i * 2.1, dir: i % 2 ? 1 : -1, flash: 0 });
  });

  const tmp = new THREE.Vector3();

  function update(dt, t, orb) {
    for (const w of watchers) {
      if (!w.alive) continue;
      // eye follows the player
      tmp.subVectors(orb, w.pos);
      const l = tmp.length() || 1;
      w.eye.position.set(tmp.x / l * 1.6, 1.5 + Math.max(0, tmp.y / l) * 1.4, tmp.z / l * 1.6);
      const k = 0.8 + Math.sin(t * 6 + w.pos.x) * 0.2;
      w.eye.material.color.setRGB(1 * k, 0.64 * k, 0.12 * k);
    }
    for (const d of drones) {
      if (!d.alive) continue;
      d.pos.set(d.home.x + Math.sin(t * 0.45 + d.phase) * 18, d.home.y + Math.sin(t * 1.3 + d.phase) * 2, d.home.z);
      d.g.position.copy(d.pos);
      d.ang += DRONE_SPIN * d.dir * dt;
      d.pivot.rotation.y = d.ang;
      d.ring.rotation.z += dt * 3;
      d.body.rotation.y += dt * 1.5;
      if (d.flash > 0) d.flash -= dt;
      const fs = 1 + Math.max(0, d.flash) * 4;
      d.body.scale.set(fs, fs, fs);
    }
  }

  // is the orb inside a drone's scan sheet?
  function scanHit(orb) {
    for (const d of drones) {
      if (!d.alive) continue;
      const rx = orb.x - d.pos.x, ry = orb.y - d.pos.y, rz = orb.z - d.pos.z;
      const hd = Math.hypot(rx, rz);
      if (hd > DRONE_LEN || hd < 0.5) continue;
      // pivot rotation.y = ang maps local +x to world (cos ang, 0, -sin ang)
      const dx = Math.cos(d.ang), dz = -Math.sin(d.ang);
      const along = rx * dx + rz * dz;
      if (along < 0) continue;
      const perp = Math.abs(rx * dz - rz * dx);
      if (perp > 1.4) continue;
      if (Math.abs(ry) > 0.8 + 11.2 * (along / DRONE_LEN) + 0.6) continue;
      return d;
    }
    return null;
  }

  // laser target picking along the aim ray, with gentle assist
  function pickTarget(camPos, fwd, orb, range = 160) {
    let best = null, bestScore = 1;
    const consider = (pos, r, obj) => {
      if (orb.distanceTo(pos) > range) return;
      tmp.subVectors(pos, camPos);
      const dist = tmp.length();
      const cos = tmp.dot(fwd) / dist;
      if (cos <= 0) return;
      const ang = Math.acos(Math.min(1, cos));
      const thr = Math.max(0.05, Math.atan(r / dist) * 1.25);
      const sc = ang / thr;
      if (sc < bestScore) { bestScore = sc; best = obj; }
    };
    for (const w of watchers) if (w.alive) consider(w.pos, w.r, w);
    for (const d of drones) if (d.alive) consider(d.pos, d.r, d);
    for (const p of world.ports) if (p.lockHp > 0) consider(p.pos, 2.6, { kind: 'lock', port: p, pos: p.pos });
    return best;
  }

  // returns an event description for main to react to
  function hit(target, fx) {
    if (target.kind === 'watcher') {
      target.alive = false;
      target.g.visible = false;
      for (const p of target.m.ports) world.refreshPort(p);
      fx.particles.burst(target.pos, AMBER, 40, 30, 1.6, 0.8, 10);
      return { type: 'watcherDown', m: target.m };
    }
    if (target.kind === 'drone') {
      target.hp--;
      target.flash = 0.12;
      if (target.hp <= 0) {
        target.alive = false; target.g.visible = false;
        fx.particles.burst(target.pos, RED, 55, 38, 1.8, 0.9, 12);
        return { type: 'droneDown' };
      }
      fx.particles.burst(target.pos, RED, 12, 18, 1.1, 0.4);
      return { type: 'droneHit' };
    }
    if (target.kind === 'lock') {
      const p = target.port;
      p.lockHp--;
      world.hideRing(p, p.lockHp); // outermost ring goes first
      fx.particles.burst(p.pos, RED, 14, 16, 1.0, 0.45);
      if (p.lockHp <= 0) {
        world.refreshPort(p);
        fx.particles.burst(p.pos, GREEN, 30, 24, 1.3, 0.7);
        return { type: 'unlocked', port: p };
      }
      return { type: 'lockHit', port: p, level: 3 - p.lockHp };
    }
    return null;
  }

  function reset() {
    for (const w of watchers) { w.alive = true; w.g.visible = true; }
    for (const d of drones) { d.alive = true; d.hp = 2; d.g.visible = true; }
  }

  return { watchers, drones, update, scanHit, pickTarget, hit, reset };
}
