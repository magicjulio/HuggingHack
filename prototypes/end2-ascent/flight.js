import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { P, logoMaterials } from "./art.js";
import { buildPlayer } from "./models.js";
import { createHQ } from "./hq.js";
import { createBarriers } from "./barrier.js";

// The approach (landing area). Owns `root` and a small DOM layer (letterbox + fade).
// API used by main.js: createFlight(scene, T, brand) -> { root, ready, start, update, dispose }.
//   update(dt, keys, camera) -> { done, collisions, progress, penaltySeconds, phase }
// Timeline (T.flight.duration seconds of flight clock, collisions pause the clock):
//   0 .. approach      steer through the armada towards the HQ, dodge the barrier drones
//   approach .. end    landing beat: flare, swing round, touchdown, ramp, KAM1196A walks out, fade
// The fade-out finishes when `done` is reported; dispose() (called by beginFloor) fades back in.
const MODELS = new URL("./assets/models/", import.meta.url).href;

export function createFlight(scene, T, brand) {
  const C = T.flight;
  const root = new THREE.Group();
  root.name = "armada-approach";
  root.visible = false;
  scene.add(root);

  // ------------------------------------------------------------------ timeline + path
  const duration = C.duration ?? 34;
  const beat = C.landingBeat ?? 5.6; // the landing cinematic at the end of the clock (not skippable)
  const BEAT_REF = 5.6; // the beat's choreography below is written for 5.6 s
  const approachTime = duration - beat;
  const distance = approachTime * (C.speed ?? 70);
  const altitude = C.approachAltitude ?? 155;
  const padZ = C.padZ ?? 52; // pad centre; the HQ entrance is at z = 0
  const padY = 0.25; // top of the pad disc on the HQ deck (end2-hq.glb `pad`)
  const hoverY = padY + (C.hoverAltitude ?? 16); // where the approach hands over to the landing beat
  const rideH = 1.52; // hull centre above the pad with the gear down (skid bottom at -1.52)
  const smooth = (t) => t * t * (3 - 2 * t);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const win = (t, a, b) => smooth(clamp01((t - a) / (b - a)));
  // Cruise at a constant speed, then brake linearly to a hover over the pad (last 18 %).
  const BRAKE = 0.82,
    V0 = 1 / (BRAKE + (1 - BRAKE) / 2);
  function travelled(u) {
    if (u <= BRAKE) return V0 * u;
    const k = (u - BRAKE) / (1 - BRAKE);
    return V0 * BRAKE + V0 * (1 - BRAKE) * (k - (k * k) / 2);
  }
  const pathZ = (u) => padZ + distance * (1 - travelled(clamp01(u)));
  const pathY = (u) => hoverY + (altitude - hoverY) * (1 - smooth(clamp01(u)));

  // ------------------------------------------------------------------ assets
  const gltf = (name) =>
    new Promise((ok, no) =>
      new GLTFLoader().load(MODELS + name, (g) => ok(g.scene), undefined, no),
    );
  const player = new THREE.Group(); // the hero dropship rides in here
  player.name = "player-dropship";
  root.add(player);
  const parts = {};
  const plumes = [];
  let fleetDraw = null;
  // obstacles: barrier picket drones (barrier.js)
  const obstacles = [];
  for (let i = 0; i < (C.obstacleCount ?? 3); i++) {
    const u = 0.28 + i * 0.205,
      z = pathZ(u);
    const x = [-20, 8, -12][i % 3],
      y = pathY(u) + [0, 2, -8][i % 3];
    obstacles.push({ x, y, z, hit: false });
  }
  const barriers = createBarriers(root, obstacles);

  // end2-hq.glb: the gigantic HQ, hidden in the fog; the logo sits on its emblem mount (hq.js).
  const hq = createHQ(root, T, brand);
  const ready = Promise.all([
    gltf("end2-dropship.glb"),
    gltf("end2-dropship-fleet.glb"),
    hq.ready,
    barriers.ready,
  ]).then(([hero, fleetShip]) => {
    dress(hero, P.hack, 9, true);
    player.add(hero);
    for (const n of ["ramp", "gear", "flap_l", "flap_r", "fan_l", "fan_r"])
      parts[n] = hero.getObjectByName(n);
    rigFlaps(hero);
    rigRamp(hero);
    fleetDraw = instancedFleet(fleetShip, P.cyan);
    // every escort heads for one of the HQ's fleet bays
    const bays = hq.anchors.bays;
    if (bays.length) fleet.forEach((f, i) => f.bay.copy(bays[(i * 5) % bays.length]));
  });

  const plumeTex = (() => {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 128;
    const g = c.getContext("2d"),
      gr = g.createLinearGradient(0, 0, 0, 128);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.25, "rgba(255,255,255,.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 8, 128);
    return new THREE.CanvasTexture(c);
  })();
  const radialTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d"),
      gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(255,255,255,1)");
    gr.addColorStop(0.4, "rgba(255,255,255,.35)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const additive = (color, opacity, map = radialTex) =>
    new THREE.MeshBasicMaterial({
      color,
      map,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  // Additive plume: a soft open cone, bright at the nozzle, pointing +Z (behind the ship).
  function plumeGeo(len, r) {
    const geo = new THREE.CylinderGeometry(r, r * 0.3, len, 20, 1, true);
    geo.translate(0, -len / 2, 0);
    geo.rotateX(Math.PI / 2);
    geo.rotateX(Math.PI);
    return geo;
  }
  const plumeMat = (color) => additive(color, 0.35, plumeTex);
  const GLOWS = ["engine_glow", "trim_glow", "orb"];
  function recolour(m, glow) {
    if (!GLOWS.includes(m.name)) return;
    m.color.copy(glow).multiplyScalar(m.name === "orb" ? 0.5 : 1);
    m.emissive.copy(glow);
    // The pilot orb is an agent: it never blooms (emissive stays under the threshold).
    if (m.name === "orb") m.emissiveIntensity = 0.45;
  }
  function dress(model, glowHex, plumeLen, hero) {
    const glow = new THREE.Color(glowHex);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.material = o.material.clone();
      recolour(o.material, glow);
      if (hero && o.material.name === "engine_glow") engineMats.push([o.material, o.material.emissiveIntensity]);
    });
    if (!hero) return;
    for (const s of ["l", "r"]) {
      const a = model.getObjectByName(`exhaust_${s}`);
      if (!a) continue;
      const p = new THREE.Mesh(plumeGeo(plumeLen, 0.95), plumeMat(glowHex));
      a.add(p);
      plumes.push(p);
    }
    // VTOL lift jets under the wing roots, only during the flare.
    for (const x of [-2.2, 2.2]) {
      const j = new THREE.Mesh(plumeGeo(5, 0.7), plumeMat(glowHex));
      j.rotation.x = Math.PI / 2; // point down
      j.position.set(x, -1.3, -0.6);
      j.visible = false;
      model.add(j);
      jets.push(j);
    }
  }
  const jets = [];
  const engineMats = [];
  // The flaps hang off the wing node's origin, not their hinge: re-pivot them onto the
  // hinge line (from dropship.py: trailing edge at 35 % .. 92 % of the span, wing-local).
  function rigFlaps(model) {
    for (const s of ["l", "r"]) {
      const flap = parts[`flap_${s}`];
      if (!flap) continue;
      const side = s === "r" ? 1 : -1;
      const a = new THREE.Vector3(side * 2.555, 0, 4.675),
        b = new THREE.Vector3(side * 6.716, 0, 6.1);
      const pivot = new THREE.Group();
      pivot.position.copy(a);
      flap.parent.add(pivot);
      pivot.add(flap);
      flap.position.sub(a);
      pivot.userData.axis = b.clone().sub(a).normalize().multiplyScalar(side);
      parts[`flap_${s}`] = pivot;
    }
  }
  // An interior glow behind the ramp (the hold is lit green) and light spilling on the pad.
  let hold = null;
  function rigRamp(model) {
    const ramp = parts.ramp;
    if (!ramp) return;
    hold = new THREE.Mesh(
      new THREE.PlaneGeometry(3.0, 1.7),
      new THREE.MeshBasicMaterial({ color: 0x5dff9e, transparent: true, opacity: 0 }),
    );
    hold.position.set(0, ramp.position.y + 0.92, ramp.position.z - 0.02);
    model.add(hold);
  }

  // ------------------------------------------------------------------ the fleet (instanced)
  const FLEET = C.fleetCount ?? 38;
  const fleet = [];
  for (let i = 0; i < FLEET; i++) {
    const side = i % 2 ? -1 : 1;
    const ahead = i < 4 ? 70 + i * 22 : -70 - Math.floor(i / 2) * 55; // four overtake you
    fleet.push({
      x: side * (32 + (i % 7) * 25),
      y: (i % 5) * 14 - 20,
      z0: ahead,
      speed: i < 4 ? 1.12 + i * 0.03 : 1 + ((i * 37) % 11) / 200,
      phase: i * 1.73,
      bay: new THREE.Vector3(side * (60 + ((i * 53) % 260)), 40 + ((i * 71) % 7) * 34, -40),
    });
  }
  const dummy = new THREE.Object3D();
  function instancedFleet(model, glowHex) {
    const byMat = new Map();
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const k of Object.keys(g.attributes))
        if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
      if (!g.attributes.uv)
        g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      const key = o.material.name;
      if (!byMat.has(key)) byMat.set(key, { mat: o.material, geos: [] });
      byMat.get(key).geos.push(g.index ? g.toNonIndexed() : g);
    });
    const glow = new THREE.Color(glowHex),
      meshes = [];
    for (const { mat, geos } of byMat.values()) {
      const m = mat.clone();
      recolour(m, glow);
      const im = new THREE.InstancedMesh(mergeGeometries(geos), m, FLEET);
      im.frustumCulled = false;
      meshes.push(im);
      root.add(im);
    }
    const anchors = ["l", "r"].map((s) => model.getObjectByName(`exhaust_${s}`).matrixWorld.clone());
    const pim = new THREE.InstancedMesh(plumeGeo(6, 0.95), plumeMat(glowHex), FLEET * 2);
    pim.frustumCulled = false;
    root.add(pim);
    const M4 = new THREE.Matrix4(),
      F = new THREE.Matrix4(),
      Z = new THREE.Matrix4().makeScale(0, 0, 0);
    return function draw(i, matrix, visible, time) {
      for (const im of meshes) im.setMatrixAt(i, visible ? matrix : Z);
      anchors.forEach((a, k) => {
        F.makeScale(1, 1, 0.85 + Math.sin(time * 29 + i + k * 2) * 0.12);
        pim.setMatrixAt(i * 2 + k, visible ? M4.multiplyMatrices(matrix, a).multiply(F) : Z);
      });
      if (i === FLEET - 1) {
        for (const im of meshes) im.instanceMatrix.needsUpdate = true;
        pim.instanceMatrix.needsUpdate = true;
      }
    };
  }

  // ------------------------------------------------------------------ light: one cool rim from the tower, nothing else
  // The scene's own hemisphere + sun (main.js) already light the approach; the old extra
  // hemisphere (2.5) + key (3) doubled it and blew the logo out to white.
  const rim = new THREE.DirectionalLight(0x8fc8ff, C.rimLight ?? 0.9);
  rim.position.set(-120, 260, -400);
  root.add(rim);
  root.add(rim.target);

  // ------------------------------------------------------------------ landing props: dust ring, light spill, the pilot
  const dust = new THREE.Mesh(new THREE.RingGeometry(0.2, 1, 48), additive(0xbfd6e6, 0));
  dust.rotation.x = -Math.PI / 2;
  root.add(dust);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), additive(P.hack, 0));
  spill.rotation.x = -Math.PI / 2;
  root.add(spill);
  const pilot = buildPlayer();
  pilot.root.visible = false;
  root.add(pilot.root);

  // ------------------------------------------------------------------ DOM: letterbox + fade (approach only)
  const veil = document.createElement("div");
  veil.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:40;opacity:0;background:#000;transition:none";
  const bars = [0, 1].map((k) => {
    const b = document.createElement("div");
    b.style.cssText = `position:fixed;left:0;right:0;${k ? "bottom" : "top"}:0;height:0;background:#000;pointer-events:none;z-index:39`;
    document.body.append(b);
    return b;
  });
  document.body.append(veil);

  // ------------------------------------------------------------------ state
  const cameraTarget = new THREE.Vector3(),
    cameraPosition = new THREE.Vector3(),
    shotPos = new THREE.Vector3(),
    shotAim = new THREE.Vector3(),
    tmp = new THREE.Vector3(),
    hoverFrom = new THREE.Vector3();
  let elapsed = 0,
    lateral = 0,
    vertical = 0,
    collisions = 0,
    stall = 0,
    shake = 0,
    running = false,
    totalTime = 0,
    fanSpin = 0,
    bank = 0,
    pitchV = 0,
    lastShot = "chase";
  let oldFog, oldBackground;
  // The scene's hemisphere + sun (main.js) are day-strength for the atrium. The approach is a night
  // scene lit by the HQ: dim them while flying (restored in dispose), so the logo reads true yellow.
  // The studio environment (IBL) gets the same treatment: its reflections were the grey veil on the HQ.
  const dimmed = new Map();
  let envSaved = null;
  function dimSceneLights(on) {
    if (on && !dimmed.size) {
      for (const o of scene.children)
        if (o.isLight && o.intensity > 0) {
          dimmed.set(o, o.intensity);
          o.intensity *= C.sceneLight ?? 0.42;
        }
      envSaved = scene.environmentIntensity;
      scene.environmentIntensity = envSaved * (C.sceneEnv ?? 0.2);
    }
    if (!on) {
      for (const [o, v] of dimmed) o.intensity = v;
      dimmed.clear();
      if (envSaved !== null) scene.environmentIntensity = envSaved;
      envSaved = null;
    }
  }
  function start() {
    elapsed = lateral = vertical = collisions = stall = shake = totalTime = 0;
    bank = pitchV = 0;
    lastShot = "chase";
    if (!root.visible) {
      oldFog = scene.fog;
      oldBackground = scene.background;
    }
    running = true;
    root.visible = true;
    // a lit haze (city glow from below): the HQ stands in it as a dark silhouette, its top never shows
    const haze = C.fogColor ?? 0x1a2940;
    scene.fog = new THREE.Fog(haze, C.fogNear ?? 60, C.fogFar ?? 1900);
    scene.background = new THREE.Color(haze);
    dimSceneLights(true);
    for (const o of obstacles) o.hit = false;
    player.position.set(0, altitude, pathZ(0));
    player.rotation.set(0, 0, 0);
    pilot.root.visible = false;
    veil.style.transition = "none";
    veil.style.opacity = 0;
    for (const b of bars) b.style.height = "0";
  }

  function setFlaps(v) {
    for (const s of ["l", "r"]) {
      const p = parts[`flap_${s}`];
      if (p) p.quaternion.setFromAxisAngle(p.userData.axis, v);
    }
  }

  function update(dt, keys, camera) {
    if (!running)
      return {
        done: elapsed >= duration,
        collisions,
        progress: Math.min(1, elapsed / duration),
        penaltySeconds: collisions * (C.collisionPenalty ?? 0.7),
        phase: "done",
      };
    totalTime += dt;
    if (stall > 0) stall = Math.max(0, stall - dt);
    else elapsed = Math.min(duration, elapsed + dt);
    const u = Math.min(1, elapsed / approachTime);
    // landing-beat clock, in reference seconds: T.flight.landingBeat stretches the whole cinematic evenly
    const lt = (Math.max(0, elapsed - approachTime) * BEAT_REF) / beat;
    const assist = win(u, 0.84, 1); // the autopilot takes over the final alignment
    const dx =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const dy =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    const steer = lt > 0 ? 0 : 1;
    lateral = THREE.MathUtils.clamp(lateral + dx * steer * (C.steerSpeed ?? 25) * dt, -(C.width ?? 40), C.width ?? 40);
    vertical = THREE.MathUtils.clamp(vertical + dy * steer * (C.steerSpeed ?? 25) * dt, -(C.height ?? 22), C.height ?? 22);

    // ---- ship pose
    const swing = win(lt, 0.15, 2.1); // yaw round so the ramp faces the entrance
    const settle = win(lt, 0.25, 2.3); // descent from the hover onto the pad
    const touchdown = lt > 2.3;
    const bob = touchdown ? Math.sin((lt - 2.3) * 14) * 0.22 * Math.exp(-(lt - 2.3) * 5) : 0;
    if (lt === 0) {
      player.position.set(
        lateral * (1 - assist),
        Math.max(hoverY - 4, pathY(u) + vertical * (1 - assist)),
        pathZ(u),
      );
      hoverFrom.copy(player.position);
    } else {
      player.position.set(
        hoverFrom.x * (1 - settle),
        hoverFrom.y + (padY + rideH - hoverFrom.y) * settle - bob,
        hoverFrom.z + (padZ - hoverFrom.z) * settle,
      );
    }
    bank = THREE.MathUtils.damp(bank, -dx * steer * 0.32 * (1 - assist), 5, dt);
    pitchV = THREE.MathUtils.damp(pitchV, dy * steer * 0.12 * (1 - assist), 4, dt);
    player.rotation.set(
      pitchV + (lt > 0 ? -0.1 * Math.sin(Math.PI * clamp01(lt / 2.3)) : 0), // nose up in the flare
      Math.PI * swing,
      bank + Math.sin(Math.PI * swing) * 0.12, // lean into the swing
    );
    // ---- moving parts
    setFlaps(THREE.MathUtils.clamp(dy * 0.35 * steer, -0.35, 0.35) * (1 - assist) + 0.42 * win(u, 0.9, 1) * (1 - win(lt, 3.6, 4.6)));
    if (parts.flap_l && dx) {
      // ailerons: opposite deflection when steering sideways
      parts.flap_l.quaternion.setFromAxisAngle(parts.flap_l.userData.axis, -dx * 0.3 * steer);
      parts.flap_r.quaternion.setFromAxisAngle(parts.flap_r.userData.axis, dx * 0.3 * steer);
    }
    const throttle = lt > 0 ? 1 - win(lt, 2.3, 3.4) * 0.85 : 1 + Math.abs(dx) * 0.2 + Math.max(0, dy) * 0.2;
    fanSpin += dt * (8 + 28 * throttle);
    if (parts.fan_l) parts.fan_l.rotation.z = fanSpin;
    if (parts.fan_r) parts.fan_r.rotation.z = -fanSpin;
    if (parts.gear) parts.gear.position.y = 0.3 * (1 - win(lt, 0.5, 1.5));
    const rampOpen = win(lt, 2.7, 3.7);
    if (parts.ramp) parts.ramp.rotation.x = rampOpen * (C.rampAngle ?? 1.33);
    if (hold) hold.material.opacity = rampOpen * 0.85;
    for (let i = 0; i < plumes.length; i++)
      plumes[i].scale.set(1, 1, (0.85 + Math.sin(totalTime * 31 + i * 1.7) * 0.12) * (0.25 + 0.75 * throttle) * (1 - win(lt, 2.3, 3.0) * 0.9));
    const spool = 1 - 0.85 * win(lt, 2.3, 2.9); // engines spool down: the nozzles face the ramp camera
    for (const [m, v] of engineMats) m.emissiveIntensity = v * spool;
    const lift = Math.sin(Math.PI * clamp01(lt / 2.6));
    for (let i = 0; i < jets.length; i++) {
      jets[i].visible = lift > 0.02;
      jets[i].scale.set(1, 1, lift * (0.8 + Math.sin(totalTime * 37 + i) * 0.15));
    }
    // ---- dust ring + light spill on touchdown
    const dk = clamp01((lt - 2.2) / 1.4);
    dust.visible = dk > 0 && dk < 1;
    dust.position.set(player.position.x, padY + 0.06, player.position.z);
    dust.scale.setScalar(4 + 26 * Math.sqrt(dk));
    dust.material.opacity = 0.55 * (1 - dk);
    spill.visible = rampOpen > 0;
    spill.position.set(player.position.x, padY + 0.05, padZ - 13);
    spill.material.opacity = rampOpen * 0.35;

    // ---- obstacles
    for (const o of obstacles) {
      if (
        lt === 0 &&
        !o.hit &&
        Math.abs(player.position.z - o.z) < 10 &&
        Math.abs(player.position.x - o.x) < 16 &&
        Math.abs(player.position.y - o.y) < 7
      ) {
        o.hit = true;
        barriers.hit(obstacles.indexOf(o));
        collisions++;
        stall = C.collisionPenalty ?? 0.7;
        shake = 1;
      }
    }
    barriers.update(totalTime, dt, player.position, camera);

    hq.update(totalTime, dt, camera);

    // ---- fleet: constant cruise, peel off into the tower bays near the façade
    if (fleetDraw) {
      const cruiseZ = padZ + distance * (1 - elapsed / approachTime);
      fleet.forEach((f, i) => {
        let z = cruiseZ + f.z0 - (f.speed - 1) * elapsed * (C.speed ?? 70);
        const natural = tmp.set(
          f.x + Math.sin(totalTime * 0.45 + f.phase) * 5,
          Math.max(18, pathY(Math.min(1, u + 0.05)) + f.y + Math.sin(totalTime + f.phase) * 2),
          z,
        );
        const k = smooth(clamp01((760 - z) / 700)); // within ~700 m: climb and line up on the bay
        natural.x += (f.bay.x - natural.x) * k;
        natural.y += (f.bay.y - natural.y) * k;
        dummy.position.copy(natural);
        dummy.rotation.set(-0.05 * k, 0, Math.sin(totalTime + f.phase) * 0.025);
        dummy.updateMatrix();
        fleetDraw(i, dummy.matrix, z > f.bay.z + 20 && z < player.position.z + 400, totalTime);
      });
    }

    // ---- the pilot walks out of the hold
    const walk = clamp01((lt - 3.3) / 0.6); // 0..1 down the ramp, then on along the deck
    pilot.root.visible = lt > 3.25;
    if (pilot.root.visible) {
      // ship-local ramp hinge (rear = -z in the world after the swing)
      const rampTip = padZ - 9.4 - 1.6;
      const zz = walk < 1 ? padZ - 8.6 - walk * (padZ - 8.6 - rampTip) : rampTip - 3.0 * (lt - 3.9);
      const yy = walk < 1 ? padY + 0.42 * (1 - walk) : padY;
      pilot.root.position.set(player.position.x, yy, zz);
      pilot.root.rotation.set(0, 0, 0);
      pilot.update(dt, { speed: walk < 1 ? 2.0 : 3.0, crouch: false, pitch: 0, heat: 0, firing: 0, dodge: false, time: totalTime, health: 100, hurt: 0 });
    }

    // ---- camera: chase -> A wide (blend) -> cut B low at the ramp -> cut C over the shoulder
    shake = Math.max(0, shake - dt * 2);
    const chaseW = 1 - win(lt, 0.1, 1.6);
    cameraPosition
      .copy(player.position)
      .add(tmp.set(Math.sin(totalTime * 43) * shake * 1.7, 9 + shake * Math.cos(totalTime * 37), C.cameraDistance ?? 34));
    // mid-approach the camera tilts up so the HQ towers over you as it comes out of the haze
    const lookLift = 4 * Math.sin(Math.PI * u) + (C.revealTilt ?? 16) * win(u, 0.3, 0.55) * (1 - win(u, 0.78, 0.95));
    cameraTarget.set(player.position.x * 0.7, player.position.y + 3 + lookLift, player.position.z - 90);
    const shot = lt <= 0 ? "chase" : lt < 2.6 ? "A" : lt < 4.2 ? "B" : "C";
    const pr = pilot.root.position;
    if (shot === "A") {
      // wide, high on the right: the ship flares in front of the portal, the façade climbs into the haze
      shotPos.set(26, padY + 10 - 3 * win(lt, 0.5, 2.6), padZ + 24 - 4 * win(lt, 0.5, 2.6));
      shotAim.set(player.position.x * 0.5, player.position.y + 1.5, player.position.z - 10);
      cameraPosition.lerp(shotPos, 1 - chaseW);
      cameraTarget.lerp(shotAim, 1 - chaseW);
    } else if (shot === "B") {
      // low between the ship and the HQ, looking back out along the approach: the ramp drops, the hold glows
      cameraPosition.set(-6.5, padY + 1.5, padZ - 26 + (lt - 2.6) * 0.7);
      cameraTarget.set(0.4, padY + 2.4, padZ - 6);
    } else if (shot === "C") {
      // over KAM1196A's shoulder, facing the entrance (framed like the combat camera)
      // the camera waits at the ramp tip (outside the hull) and the robot walks out past it into frame
      cameraPosition.set(pr.x + 1.25, padY + 2.45, Math.min(padZ - 10.7, pr.z + 4.4));
      cameraTarget.set(pr.x + 0.3, pr.y + 1.7, pr.z - 30);
    }
    const cut = shot !== lastShot && (shot === "B" || shot === "C");
    lastShot = shot;
    if (totalTime <= dt * 1.1 || cut) camera.position.copy(cameraPosition);
    else camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * (shot === "chase" ? 6 : shot === "A" ? 4 : 10)));
    camera.lookAt(cameraTarget);

    // ---- letterbox + fade
    const lb = win(lt, 0, 0.8) * 11;
    bars[0].style.height = bars[1].style.height = lb.toFixed(2) + "vh";
    veil.style.opacity = win(lt, BEAT_REF - 0.55, BEAT_REF - 0.02).toFixed(3);

    const done = elapsed >= duration;
    if (done) running = false;
    return {
      done,
      collisions,
      progress: elapsed / duration,
      penaltySeconds: collisions * (C.collisionPenalty ?? 0.7),
      phase: lt > 0 ? "landing" : "approach",
    };
  }
  function dispose() {
    root.visible = false;
    running = false;
    if (oldFog !== undefined) scene.fog = oldFog;
    if (oldBackground !== undefined) scene.background = oldBackground;
    dimSceneLights(false);
    for (const b of bars) b.style.height = "0";
    // Fade back in on whatever comes next (the atrium).
    if (+veil.style.opacity > 0) {
      veil.style.transition = "opacity .7s ease-out";
      requestAnimationFrame(() => (veil.style.opacity = 0));
    }
  }
  // test/preview hook (captures seek by flight clock; collisions pause it)
  root.userData.clock = () => ({ elapsed, approachTime, duration, landing: (Math.max(0, elapsed - approachTime) * BEAT_REF) / beat });
  return { root, ready, start, update, dispose };
}
