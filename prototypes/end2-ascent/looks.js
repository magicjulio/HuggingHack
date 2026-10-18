import * as THREE from "three";
import { P, additive, glowSprite, beamTexture, canvas, texture } from "./art.js";

// Placeholder looks for combat. Gameplay code only talks to this interface, so
// the characters area can replace any entry (fx.js) without touching logic:
//   bolt(kind)          → { root, update(dt, s), dispose() }   enemy projectile; s: { dir, age }
//   beam(kind)          → { root, set(a, b, s), hide(), dispose() }
//                          kinds: "warden" (sweep), "warden-aim", "tether" (heal), "beacon"
//   ring(kind)          → { root, set(pos, s), hide(), dispose() }
//                          kinds: "lunge", "spawn", "beacon", "shock", "hold"; s: { radius, progress, alpha, time }
//   impact(pos, kind)   one-shot; kinds: "bolt", "shock", "crit", "heal", "death-<enemy kind>"
//   number(pos, text, kind)  floating hit read-out; kinds: "hit", "crit", "blocked", "heal"
//   update(dt)          advances one-shots
// Keep agents and any orb glow below the bloom threshold (see the team brief).

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

export function createDefaultLooks(scene) {
  const live = []; // one-shots: { root, life, max, tick(t01), dispose }
  const boltGeo = new THREE.SphereGeometry(1, 10, 8);
  const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true);
  const ringGeo = new THREE.RingGeometry(0.86, 1, 56);
  const discGeo = new THREE.CircleGeometry(1, 56);
  const boltMat = new THREE.MeshBasicMaterial({ color: P.bolt, toneMapped: false });

  function bolt(kind) {
    const root = new THREE.Group();
    const core = new THREE.Mesh(boltGeo, boltMat);
    core.scale.set(0.08, 0.08, 0.42);
    root.add(core);
    const halo = glowSprite(kind === "shield" ? P.hfAmber : P.bolt, 0.7, 0.55);
    root.add(halo);
    scene.add(root);
    return {
      root,
      update(dt, s) {
        if (s.dir) root.quaternion.setFromUnitVectors(Z, s.dir);
      },
      dispose() {
        scene.remove(root);
        halo.material.dispose();
      },
    };
  }

  function beam(kind) {
    const color =
      kind === "tether" ? P.hfYellow : kind === "beacon" ? P.hack : P.danger;
    const root = new THREE.Group();
    const outer = new THREE.Mesh(beamGeo, additive(color, 0.5, beamTexture()));
    outer.material.side = THREE.DoubleSide;
    const inner = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false }),
    );
    root.add(outer, inner);
    root.visible = false;
    scene.add(root);
    const width = { warden: 0.22, "warden-aim": 0.02, tether: 0.05, beacon: 0.35 }[kind] ?? 0.05;
    const d = new THREE.Vector3();
    return {
      root,
      // s: { intensity 0..1, time }
      set(a, b, s = {}) {
        d.subVectors(b, a);
        const len = d.length();
        if (len < 0.01) return this.hide();
        root.visible = true;
        root.position.copy(a).addScaledVector(d, 0.5);
        root.quaternion.setFromUnitVectors(UP, d.divideScalar(len));
        const k = s.intensity ?? 1;
        const flicker = 0.85 + Math.sin((s.time || 0) * 50) * 0.15;
        outer.scale.set(width * (0.6 + k), len, width * (0.6 + k));
        inner.scale.set(width * 0.3 * k, len, width * 0.3 * k);
        outer.material.opacity = (kind === "warden-aim" ? 0.9 : 0.55) * k * flicker;
        inner.material.opacity = kind === "warden-aim" ? 0 : 0.85 * k;
      },
      hide() {
        root.visible = false;
      },
      dispose() {
        scene.remove(root);
        outer.material.dispose();
        inner.material.dispose();
      },
    };
  }

  function ring(kind) {
    const color = { lunge: P.danger, spawn: P.hfOrange, beacon: P.hack, shock: P.hack, hold: P.hack }[kind] ?? P.danger;
    const root = new THREE.Group();
    const edge = new THREE.Mesh(ringGeo, additive(color, 0.8, null));
    const fill = new THREE.Mesh(discGeo, additive(color, 0.18, null));
    // Progress arc (hold zone): a thin ring segment rebuilt only when progress moves.
    let arc = null,
      arcValue = -1;
    edge.rotation.x = fill.rotation.x = -Math.PI / 2;
    root.add(edge, fill);
    root.visible = false;
    scene.add(root);
    return {
      root,
      set(pos, s = {}) {
        root.visible = true;
        root.position.copy(pos);
        root.position.y += 0.035;
        const r = s.radius ?? 1;
        edge.scale.setScalar(r);
        fill.scale.setScalar(r * (kind === "lunge" ? 1 - (s.progress ?? 0) : 1));
        const a = s.alpha ?? 1;
        const pulse = 0.75 + Math.sin((s.time || 0) * (kind === "lunge" ? 30 : 5)) * 0.25;
        edge.material.opacity = 0.85 * a * pulse;
        fill.material.opacity = (kind === "hold" ? 0.08 : 0.22) * a;
        if (kind === "hold") {
          const p = Math.round((s.progress ?? 0) * 60) / 60;
          if (p !== arcValue) {
            arcValue = p;
            if (arc) {
              root.remove(arc);
              arc.geometry.dispose();
            }
            if (p > 0) {
              arc = new THREE.Mesh(
                new THREE.RingGeometry(1.02, 1.16, 64, 1, Math.PI / 2, -p * Math.PI * 2),
                edge.material,
              );
              arc.rotation.x = -Math.PI / 2;
              root.add(arc);
            } else arc = null;
          }
          if (arc) arc.scale.setScalar(r);
        }
      },
      hide() {
        root.visible = false;
      },
      dispose() {
        scene.remove(root);
        edge.material.dispose();
        fill.material.dispose();
        if (arc) arc.geometry.dispose();
      },
    };
  }

  function oneShot(root, life, tick, dispose) {
    scene.add(root);
    live.push({ root, life, max: life, tick, dispose });
  }

  function impact(pos, kind) {
    if (kind === "shock") {
      const r = ring("shock");
      r.root.visible = true;
      oneShot(
        r.root,
        0.55,
        (t) => r.set(pos, { radius: 0.5 + t * 7, alpha: 1 - t }),
        () => r.dispose(),
      );
      return;
    }
    const color =
      kind === "crit" ? 0xfff07a : kind === "heal" ? P.hfYellow : kind?.startsWith("death") ? P.hfYellow : P.bolt;
    const s = glowSprite(color, kind?.startsWith("death") ? 2.4 : 0.9, 0.9);
    s.position.copy(pos);
    const root = new THREE.Group();
    root.add(s);
    oneShot(
      root,
      kind?.startsWith("death") ? 0.35 : 0.16,
      (t) => {
        s.material.opacity = 0.9 * (1 - t);
        s.scale.setScalar((kind?.startsWith("death") ? 2.4 : 0.9) * (1 + t));
      },
      () => s.material.dispose(),
    );
  }

  // Floating numbers: a small canvas sprite per hit, capped.
  const numberColors = { hit: "#f4f7f0", crit: "#fff07a", blocked: "#66daff", heal: "#ffd21e" };
  function number(pos, text, kind = "hit") {
    if (live.length > 60) return;
    const [c, g] = canvas(128, 48);
    g.font = `700 ${kind === "crit" ? 34 : 28}px "Chakra Petch", Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineWidth = 5;
    g.strokeStyle = "#000000aa";
    g.strokeText(text, 64, 24);
    g.fillStyle = numberColors[kind] || numberColors.hit;
    g.fillText(text, 64, 24);
    const map = texture(c);
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, toneMapped: false }),
    );
    s.renderOrder = 999;
    const start = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.2, 0));
    const scale = kind === "crit" ? 0.95 : 0.7;
    oneShot(
      s,
      0.7,
      (t) => {
        s.position.copy(start).y += t * 0.9;
        s.material.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
        s.scale.set(scale * 2.67, scale, 1);
      },
      () => {
        map.dispose();
        s.material.dispose();
      },
    );
  }

  return {
    bolt,
    beam,
    ring,
    impact,
    number,
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i];
        e.life -= dt;
        if (e.life <= 0) {
          scene.remove(e.root);
          e.dispose?.();
          live.splice(i, 1);
          continue;
        }
        e.tick(1 - e.life / e.max);
      }
    },
    clear() {
      while (live.length) {
        const e = live.pop();
        scene.remove(e.root);
        e.dispose?.();
      }
    },
  };
}
