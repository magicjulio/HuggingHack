import * as THREE from "three";
import { createBossModel } from "./boss-model.js";
import { buildPlayer } from "./models.js";

// lab.html?view=boss (boss agent, round 4). Two layouts:
//   sheet (default): every expression, phase + damage stage and hand pose side by side (radius 1 m)
//   &solo: one full-size boss (radius 7 m, as in the game) with the player for scale and knobs for every state
// URL: &expr=angry&k=1 &damage=0..2 &phase=1..3 &pose=open|fist|slam|stuck &run=<s> (fast-forward, then hold)
const ease = (k) => k * k * (3 - 2 * k);

function placeHand(model, side, p) {
  // like boss.js: put the hand root so that its palm lands on p (world)
  const h = model.hands[side];
  h.root.updateWorldMatrix(true, true);
  const palm = h.palm.getWorldPosition(new THREE.Vector3());
  const rootW = h.root.getWorldPosition(new THREE.Vector3());
  h.root.position.copy(p).sub(palm).add(rootW);
}

export async function setupBossLab({ scene, params, items, place, now }) {
  const solo = params.has("solo");
  const want = {
    expr: params.get("expr") || "neutral",
    k: +(params.get("k") ?? 1),
    damage: +(params.get("damage") ?? 0),
    phase: +(params.get("phase") ?? 1),
    pose: params.get("pose") || "open",
  };
  if (!solo) {
    const R = 1;
    const models = [];
    const mk = (x, y, z, setup, handsAt) => {
      const m = createBossModel({ scene, radius: R, floorY: 0 });
      m.root.position.set(x, y, z);
      setup(m);
      models.push({ m, handsAt });
      return m;
    };
    // row 1: expressions, hands in the logo's hug pose
    const hug = (m) => (s) => {
      const o = m.root.position;
      return new THREE.Vector3(o.x + (s === "l" ? -0.62 : 0.62) * R, o.y + 0.28 * R, o.z + 0.95 * R);
    };
    ["neutral", "angry", "hurt", "roar"].forEach((e, i) => {
      const m = mk(-5.4 + i * 3.6, 4.4, 0, (m) => m.setExpression(e, 1));
      models[models.length - 1].handsAt = hug(m);
    });
    // row 2: phase 1/2/3 with damage 0/1/2 (the face as fight sets it), hands hidden
    [1, 2, 3].forEach((p, i) =>
      mk(-3.6 + i * 3.6, 1.35, 0, (m) => {
        m.setPhase(p);
        m.setDamage(p - 1);
        if (p === 3) m.setExpression("angry", 1);
        m.hands.l.root.visible = m.hands.r.root.visible = false;
      }),
    );
    // row 3: hand poses (heads hidden), both hands of one model per pose
    ["open", "fist", "slam", "stuck"].forEach((pose, i) => {
      const m = mk(-5.4 + i * 3.6, 0, 3.2, (m) => {
        m.root.visible = false;
        m.setHandPose("l", pose, 1);
        m.setHandPose("r", pose, 1);
      });
      const grounded = pose === "slam" || pose === "stuck";
      models[models.length - 1].handsAt = (s) => new THREE.Vector3(m.root.position.x + (s === "l" ? -0.7 : 0.7), grounded ? 0.0 : 0.55, m.root.position.z);
    });
    await Promise.all(models.map(({ m }) => m.ready));
    for (const { m, handsAt } of models) {
      scene.add(m.root);
      items.push({
        root: m.root,
        update(dt) {
          m.update(dt, now());
          if (handsAt) for (const s of ["l", "r"]) placeHand(m, s, handsAt(s));
        },
      });
    }
    window.__boss = models.map(({ m }) => m);
    return { target: new THREE.Vector3(0, 3.1, 0.6), dist: 19, height: 4.2, spin: false, fogNear: 30, fogFar: 90, floor: 1 };
  }

  // ---- solo: the full-size boss
  const R = +(params.get("radius") ?? 7);
  const faceY = +(params.get("faceY") ?? 6);
  const m = createBossModel({ scene, radius: R, floorY: 0 });
  m.root.position.set(0, faceY, 0);
  scene.add(m.root);
  const player = buildPlayer();
  player.root.position.set(2.5, 0, 2.2 * R);
  player.root.rotation.y = Math.PI;
  scene.add(player.root);
  await m.ready;
  m.setExpression(want.expr, want.k);
  m.setDamage(want.damage);
  m.setPhase(want.phase);
  const state = { pose: { l: want.pose, r: want.pose }, demo: null };
  m.setHandPose("l", want.pose, 1);
  m.setHandPose("r", want.pose, 1);
  const idle = (s, t) => new THREE.Vector3((s === "l" ? -1 : 1) * 0.66 * R, faceY + 0.3 * R + Math.sin(t * 1.3 + (s === "l" ? 2 : 0)) * 0.25, 0.95 * R);
  const ground = (s) => new THREE.Vector3((s === "l" ? -1 : 1) * 0.9 * R, 0, 1.7 * R);
  const handPos = { l: new THREE.Vector3(), r: new THREE.Vector3() };
  // a scripted slam (the shape of fight's: rise as a fist over the spot, drop, impact, lie as the weak point, return)
  function demo(side) {
    state.demo = { side, t: 0 };
  }
  function demoStep(dt, t) {
    const d = state.demo;
    if (!d) return;
    d.t += dt;
    const s = d.side,
      over = ground(s).setY(faceY + 0.6 * R);
    if (d.t < 1.2) {
      m.setHandPose(s, "fist", 1);
      handPos[s].lerpVectors(idle(s, t), over, ease(Math.min(1, d.t / 0.9)));
    } else if (d.t < 1.36) {
      if (state.pose[s] !== "slam") m.setHandPose(s, "slam", 1);
      state.pose[s] = "slam";
      handPos[s].lerpVectors(over, ground(s), ease((d.t - 1.2) / 0.16));
    } else if (!d.hit) {
      d.hit = true;
      handPos[s].copy(ground(s));
      m.impact(s, ground(s));
      m.setHandPose(s, "stuck", 1);
      state.pose[s] = "stuck";
    } else if (d.t < 4) {
      handPos[s].copy(ground(s));
    } else if (d.t < 4.9) {
      m.setHandPose(s, "open", 1);
      state.pose[s] = "open";
      handPos[s].lerpVectors(ground(s), idle(s, t), ease((d.t - 4) / 0.9));
    } else state.demo = null;
  }
  items.push({
    root: m.root,
    update(dt) {
      const t = now();
      demoStep(dt, t);
      for (const s of ["l", "r"]) {
        if (state.demo?.side === s) {
        } else if (state.pose[s] === "slam" || state.pose[s] === "stuck") handPos[s].copy(ground(s));
        else handPos[s].copy(idle(s, t));
        placeHand(m, s, handPos[s]);
      }
      m.update(dt, t);
      player.update(dt, { speed: 0, crouch: false, pitch: 0, heat: 0, firing: 0, time: t });
    },
  });

  // knobs
  const css = `#bk{position:fixed;right:18px;top:18px;width:300px;font:12px "JetBrains Mono",monospace;color:#cfe0f5;background:#0b1220cc;border:1px solid #ffffff22;padding:10px 12px;line-height:1.5}
  #bk h4{margin:8px 0 4px;font:600 12px "Chakra Petch",sans-serif;color:#ffd21e;letter-spacing:1px}
  #bk button{background:#162133;color:#cfe0f5;border:1px solid #ffffff2a;margin:2px;padding:3px 7px;font:inherit;cursor:pointer}
  #bk button.on{border-color:#ffd21e;color:#ffd21e} #bk input{width:100%}`;
  document.head.insertAdjacentHTML("beforeend", `<style>${css}</style>`);
  const el = document.createElement("div");
  el.id = "bk";
  document.body.append(el);
  const ui = { expr: want.expr, k: want.k };
  const row = (title, opts, cur, on) =>
    `<h4>${title}</h4>` + opts.map((o) => `<button data-g="${title}" data-v="${o}" class="${String(o) === String(cur) ? "on" : ""}">${o}</button>`).join("");
  function render() {
    el.innerHTML =
      row("expression", ["neutral", "angry", "hurt", "roar"], ui.expr) +
      `<input id="bk-k" type="range" min="0" max="1" step="0.01" value="${ui.k}"><div>blend k = <b id="bk-kv">${ui.k}</b></div>` +
      row("phase", [1, 2, 3], ui.phase ?? want.phase) +
      row("damage", [0, 1, 2], ui.damage ?? want.damage) +
      row("left hand", ["open", "fist", "slam", "stuck"], state.pose.l) +
      row("right hand", ["open", "fist", "slam", "stuck"], state.pose.r) +
      `<h4>fx</h4><button data-a="slam-l">slam left</button><button data-a="slam-r">slam right</button><button data-a="flash">flash face</button><button data-a="flash-l">flash hand</button><button data-a="dying">dying</button>` +
      `<h4>phase change</h4><button data-a="p2">→ phase 2 (roar)</button><button data-a="p3">→ phase 3 (roar, angry)</button>`;
    el.querySelector("#bk-k").oninput = (e) => {
      ui.k = +e.target.value;
      el.querySelector("#bk-kv").textContent = ui.k.toFixed(2);
      m.setExpression(ui.expr, ui.k);
    };
  }
  let timers = [];
  el.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const g = b.dataset.g,
      v = b.dataset.v,
      a = b.dataset.a;
    if (g === "expression") (ui.expr = v), m.setExpression(v, ui.k);
    if (g === "phase") (ui.phase = +v), m.setPhase(+v);
    if (g === "damage") (ui.damage = +v), m.setDamage(+v);
    if (g === "left hand" || g === "right hand") {
      const s = g === "left hand" ? "l" : "r";
      state.pose[s] = v;
      m.setHandPose(s, v, 1);
    }
    if (a === "slam-l") demo("l");
    if (a === "slam-r") demo("r");
    if (a === "flash") m.flash("face");
    if (a === "flash-l") m.flash("hand_l");
    if (a === "dying") m.setDying(1);
    if (a === "p2" || a === "p3") {
      timers.forEach(clearTimeout);
      const n = a === "p2" ? 2 : 3;
      m.setExpression("roar", 1);
      timers = [
        setTimeout(() => {
          m.setPhase(n);
          m.setDamage(n - 1);
          (ui.phase = n), (ui.damage = n - 1);
          render();
        }, 400),
        setTimeout(() => {
          ui.expr = n === 3 ? "angry" : "neutral";
          m.setExpression(ui.expr, 1);
          render();
        }, 2600),
      ];
    }
    render();
  });
  render();
  window.__boss = m;
  const tz = +(params.get("tz") ?? 1);
  return { target: new THREE.Vector3(0, faceY + R * 0.75, R * 0.6), dist: R * 5.2 * tz, height: faceY + R * 0.65, spin: false, fogNear: 60, fogFar: 220, floor: 3 };
}
