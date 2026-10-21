import * as THREE from "three";
import { buildPlayer, buildDefender } from "./models.js";
import { buildHugger, buildWarden, buildMaintainer } from "./enemies-extra.js";
import { createProjectiles } from "./projectiles.js";

// Lab harness: a scripted 16 s fight that drives a `looks` object (createDefaultLooks or createFxLooks) the way
// actors.js does: bolts through createProjectiles, beams and rings per enemy, impacts, numbers and deaths.
// Two of them side by side (`?view=looks`) compare the placeholder looks with the pooled fx.
export const LOOP = 16;

export function createScenario({ scene, looks, brand, ox = 0, loopOffset = 0 }) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const player = { pos: V(ox, 0, 6), height: 1.8, alive: true, isPlayer: true };
  const playerModel = buildPlayer();
  playerModel.root.position.copy(player.pos);
  scene.add(playerModel.root);
  const COVER = { z: 3.4, h: 1.0, hw: 2.4 };
  // a low cover wall to shoot at
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(COVER.hw * 2, COVER.h, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x3a4350, roughness: 0.7, metalness: 0.4 }),
  );
  wall.position.set(ox, COVER.h / 2, COVER.z);
  scene.add(wall);
  const blocked = (a, b) => {
    // segment crosses the wall plane z = COVER.z inside the wall box
    if ((a.z - COVER.z) * (b.z - COVER.z) > 0) return false;
    const t = (COVER.z - a.z) / (b.z - a.z || 1e-6);
    const y = a.y + (b.y - a.y) * t,
      x = a.x + (b.x - a.x) * t;
    return y < COVER.h && Math.abs(x - ox) < COVER.hw;
  };
  const projectiles = createProjectiles({
    looks,
    blocked,
    center: (t, isPlayer) => (isPlayer ? V(player.pos.x, player.pos.y + 1.04, player.pos.z) : t.pos),
  });

  const mk = (model, x, z, ry = 0) => {
    model.root.position.set(ox + x, 0, z);
    model.root.rotation.y = ry;
    scene.add(model.root);
    return { model, x: ox + x, z, dead: false, flash: 0, shieldHit: 0 };
  };
  const G = mk(buildDefender(brand, "gunner"), -2.6, -5, 0.15);
  const S = mk(buildDefender(brand, "shield"), 2.6, -5, -0.15);
  const H = mk(buildHugger(brand), -0.7, -2.4);
  const W = mk(buildWarden(brand), 0.4, -9.5);
  const M = mk(buildMaintainer(brand), 1.5, -6.5);
  const all = [G, S, H, W, M];
  const kinds = new Map([[G, "gunner"], [S, "shield"], [H, "hugger"], [W, "warden"], [M, "maintainer"]]);
  const cen = (e) => V(e.x, { gunner: 1.38, shield: 1.38, hugger: 0.95, warden: 1.6, maintainer: 2.3 }[kinds.get(e)], e.z);

  const lunge = looks.ring("lunge"),
    spawn = looks.ring("spawn"),
    hold = looks.ring("hold"),
    beacon = looks.ring("beacon"),
    column = looks.beam("beacon"),
    wardenBeam = looks.beam("warden"),
    wardenAim = looks.beam("warden-aim"),
    tether = looks.beam("tether");

  const fired = new Set(); // one-shot triggers inside a loop: key -> fired
  const once = (key, cond, fn) => {
    if (cond && !fired.has(key)) {
      fired.add(key);
      fn();
    } else if (!cond && fired.has(key + ":armed")) fired.delete(key);
  };
  const shoot = (e, kind, aimAt) => {
    const start = cen(e);
    const dir = aimAt.clone().sub(start).normalize();
    if (projectiles.spawn(kind, start, dir, 22, 1)) {
      if (looks.muzzle) looks.muzzle(e.model, kind);
      else looks.impact(start, "muzzle");
    }
  };
  const aimPlayer = () => V(player.pos.x + (Math.random() - 0.5) * 0.6, 1.5, player.pos.z);
  const aimCover = () => V(ox + (Math.random() - 0.5) * 3.2, 0.55, COVER.z + 1.5);

  let lastT = 0;
  const hitFlash = [0, 0];
  function update(dt, time, camera) {
    const t = (((time + loopOffset) % LOOP) + LOOP) % LOOP;
    if (t < lastT) {
      // new loop: everyone is back
      fired.clear();
      for (const e of all) {
        e.dead = false;
        e.model.root.visible = true;
      }
    }
    lastT = t;
    for (const e of all) e.flash = Math.max(0, e.flash - dt);
    for (const e of all) e.shieldHit = Math.max(0, e.shieldHit - dt);

    // ---- gunner: windup 0.2-1.0, three bursts of 3 (1.0-2.4) and again at 4.5
    const gb = t < 4 ? t : t - 4.5;
    const gWind = G.dead ? 0 : gb > 0.2 && gb < 1.0 ? (gb - 0.2) / 0.8 : 0;
    const gFire = !G.dead && gb >= 1.0 && gb < 2.2;
    for (let i = 0; i < 6; i++) {
      const tt = (i < 3 ? 1.0 : 4.5 + 1.0) + (i % 3) * 0.28;
      once("g" + i, t >= tt && t < tt + 0.3 && !G.dead, () => shoot(G, "gunner", i % 3 === 2 ? aimCover() : i < 3 ? aimPlayer() : aimCover()));
    }
    // ---- shield-bearer: bursts 2.5-3.5, opens during them; gets hit by the player's rifle
    const sOpen = !S.dead && ((t > 2.9 && t < 3.9) || (t > 8.2 && t < 9.2));
    const sWind = !S.dead && t > 2.2 && t < 2.9 ? (t - 2.2) / 0.7 : 0;
    for (let i = 0; i < 3; i++) once("s" + i, t >= 3.0 + i * 0.28 && t < 3.3 + i * 0.28 && !S.dead, () => shoot(S, "shield", aimPlayer()));
    for (const [k, tt] of [[0, 1.2], [1, 1.7], [2, 2.0], [3, 5.1], [4, 5.4], [5, 6.0], [6, 6.3]]) {
      once("sh" + k, t >= tt && t < tt + 0.3 && !S.dead, () => {
        const dir = V(Math.sin(k * 2.1) * 0.5, 0.05 * (k % 3), 1).normalize();
        if (looks.shieldHit) looks.shieldHit(S.model, dir);
        else S.model.shieldRipple?.(dir);
        S.shieldHit = 0.12;
      });
    }
    // ---- hugger: tell 6.0-6.9 with the lunge ring on the floor, lunge 6.9-7.3
    const hTell = !H.dead && t > 6.0 && t < 6.9 ? (t - 6.0) / 0.9 : 0;
    const hLunge = !H.dead && t >= 6.9 && t < 7.3;
    H.model.root.position.z = H.z + (hLunge ? ((t - 6.9) / 0.4) * 1.6 : t >= 7.3 ? 1.6 : 0);
    if (hTell > 0) lunge.set(V(H.x, 0, H.z + 1.6), { radius: 1.1, progress: hTell, alpha: 1, time });
    else lunge.hide();
    // ---- warden: charge 3.8-5.4 (aim line), beam 5.4-7.4 sweep, vent 7.4-9
    const wCharge = !W.dead && t > 3.8 && t < 5.4 ? (t - 3.8) / 1.6 : 0;
    const wFire = !W.dead && t >= 5.4 && t < 7.4;
    const wVent = !W.dead && t >= 7.4 && t < 9.0;
    const yaw = wFire ? -0.55 + ((t - 5.4) / 2.0) * 1.1 : -0.55;
    if (wCharge > 0 || wFire) {
      const o = V(W.x + Math.sin(yaw) * 0.9, 1.55, W.z + Math.cos(yaw) * 0.9);
      const pitch = -0.18,
        c = Math.cos(pitch);
      const dir = V(Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c);
      const len = o.y / -dir.y;
      const end = o.clone().addScaledVector(dir, len);
      if (wFire) {
        wardenAim.hide();
        wardenBeam.set(o, end, { intensity: 1, time });
        if (Math.random() < 0.25) looks.impact(end, "beam");
      } else {
        wardenBeam.hide();
        wardenAim.set(o, end, { intensity: 0.35 + 0.65 * wCharge, time });
      }
    } else {
      wardenBeam.hide();
      wardenAim.hide();
    }
    // ---- maintainer: heals the gunner 9.5-12 (tether + numbers)
    const mHeal = !M.dead && !G.dead && t > 9.5 && t < 12;
    if (mHeal) {
      const from = M.model.emitter ? M.model.emitter.getWorldPosition(V(0, 0, 0)) : cen(M);
      tether.set(from, cen(G), { intensity: 0.8, time });
      once("heal0", t > 10.4, () => looks.number(cen(G).add(V(0, 0.9, 0)), "+10", "heal"));
      once("heal1", t > 11.4, () => looks.number(cen(G).add(V(0, 0.9, 0)), "+10", "heal"));
      once("healfx", t > 10.4, () => looks.impact(cen(G), "heal"));
      once("healfx2", t > 11.4, () => looks.impact(cen(G), "heal"));
    } else tether.hide();
    // ---- zone rings and the drop beacon (agent effects, kept under the bloom threshold)
    const hp = t > 0.5 && t < 11 ? Math.min(1, (t - 0.5) / 10) : 0;
    if (hp > 0) hold.set(V(ox + 3.2, 0, 4.5), { radius: 2.2, progress: hp, alpha: 1, time });
    else hold.hide();
    if (t > 11.5 && t < 13.5) {
      const k = (t - 11.5) / 2;
      beacon.set(V(ox - 3.2, 0, 4.5), { radius: 3, progress: k, alpha: 0.5 + k * 0.5, time });
      column.set(V(ox - 3.2, 40, 4.5), V(ox - 3.2, 0, 4.5), { intensity: 0.3 + 0.7 * k, time });
      once("shock", t > 13.4, () => looks.impact(V(ox - 3.2, 0, 4.5), "shock"));
    } else {
      beacon.hide();
      column.hide();
    }
    if (t > 12.6 && t < 13.5) spawn.set(V(H.x + 1.2, 0, H.z - 1.6), { radius: 1.2, progress: (t - 12.6) / 0.9, alpha: 1 - ((t - 12.6) / 0.9) * 0.4, time });
    else spawn.hide();
    // ---- deaths 13.6.. (everyone goes down one after another, then the loop restarts)
    for (const [e, tt] of [[H, 13.6], [G, 14.0], [S, 14.4], [M, 14.8], [W, 15.2]]) {
      once("die" + kinds.get(e), t >= tt && !e.dead, () => {
        e.dead = true;
        e.model.root.visible = false;
        looks.impact(cen(e).setY(cen(e).y + (e === H ? 0 : 0)), "death-" + kinds.get(e));
        looks.number(cen(e).add(V(0, 0.6, 0)), "-100", "crit");
      });
    }
    // rifle-style hit flash on the hugger at 1.5, 2.5, numbers
    once("n0", t > 1.9 && !G.dead, () => looks.number(cen(G).add(V(0, 0.5, 0)), "-24", "hit"));
    once("n1", t > 2.4 && !S.dead, () => looks.number(cen(S).add(V(0, 0.5, 0)), "BLOCKED", "blocked"));

    const base = { time, camera };
    G.model.update(dt, { ...base, phase: 0.3, flash: G.flash, windup: gWind, firing: gFire, exposed: false, stagger: 0, moving: false });
    S.model.update(dt, { ...base, phase: 1.1, flash: S.flash, windup: sWind, firing: false, exposed: sOpen, stagger: 0, moving: false, shieldHit: S.shieldHit });
    H.model.update(dt, { ...base, phase: 2, flash: H.flash, windup: hTell, lunging: hLunge, recover: false, stagger: 0, moving: t > 5 && t < 6, });
    W.model.update(dt, { ...base, phase: 0, flash: W.flash, charge: wCharge, firing: wFire, venting: wVent, stagger: 0, aimPitch: -0.18 });
    M.model.update(dt, { ...base, phase: 0.5, flash: M.flash, healing: mHeal, stagger: 0, moving: false });
    W.model.root.rotation.y = wCharge > 0 || wFire ? yaw * 0.6 : 0;
    playerModel.update(dt, { speed: 0, crouch: false, pitch: -0.05, heat: 0.2, firing: 0, time });
    projectiles.update(dt, player, [], () => {}, () => {});
  }
  return {
    update,
    projectiles,
    players: playerModel,
    dispose() {
      projectiles.clear();
    },
    center: () => V(ox, 1.2, -2),
  };
}
