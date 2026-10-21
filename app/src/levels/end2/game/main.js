// Ending 2 "ASCENT": bootstrap, input, camera, combat, floors, boss, HUD.
// From prototypes/end2-ascent/main.js @ 5336107 (promoted: handoff/design-to-app/2026-10-19-ascent-promoted.md).
// App changes, nothing else: the page became a factory, createAscent(root, opts) → { dispose }, that builds its own
// DOM (markup.js) in `root`, routes every window/document listener through on() (and lends it to flight.js, audio.js
// and flight-hud.js via host.js) and in dispose() cancels the rAF, removes listeners, closes the audio, frees the GPU
// and empties `root`. Booting is async (fonts, logo, glbs) as before; dispose() during the boot stops it.
// The menu, pause, regroup and end overlays are the app's shared level card (opts.onScreen, see showOverlay; the
// HTML panel and end card are gone; a loading card shows during the boot); the finish calls opts.onFinish(result);
// window.__ascent (was ?test) comes with opts.debug; body[data-aim|data-vent] and --vent-* live on `root`.
// updateCamera keeps the camera above the floor when looking up (T.camera.floorGap).
import { lookScale } from "../../../state/settings"; // app: settings
import * as THREE from "three";
import { createWorld } from "./world.js";
import { createActors } from "./actors.js";
import { createFxLooks } from "./fx.js"; // pooled fx looks (was createDefaultLooks from ./looks.js)
import { createEncounter } from "./encounter.js";
import { createBuilding } from "./building.js"; // floor-2 level adapter (fight)
import { createFlight } from "./flight.js";
import { P, loadBrand, loadFonts, applyEnvironment } from "./art.js";
import { buildPlayer, buildPickup, LOOT } from "./models.js";
import { createRenderer, skipHiddenMatrices } from "./post.js";
import { createAudio } from "./audio.js";
import { createBoss, createStubBossModel } from "./boss.js"; // floor-3 end boss (fight)
import { MARKUP } from "./markup.js";
import { host } from "./host.js";
// The boss's look (boss agent, BOSS.md). Loaded defensively: until it exists (or
// if it fails), boss.js's procedural stub with the same API stands in.
const bossModelModule = await import("./boss-model.js").catch((e) => {
  console.warn("boss-model.js not loaded, using the stub boss:", e?.message);
  return null;
});

// All gameplay, camera, encounter and presentation tuning lives here.
export const T = {
  player: {
    speed: 5.4,
    sprint: 8.6,
    crouchSpeed: 2.7,
    aimSpeed: 3.2,
    radius: 0.42,
    health: 100,
    regenDelay: 4,
    regen: 12,
    height: 1.8,
    crouchHeight: 0.95,
    dodgeSpeed: 14,
    dodgeDuration: 0.27,
    dodgeCooldown: 1.1,
    dodgeProtection: 0.18,
    // combat redesign: vault (Space into low cover), snap to cover, knock-back
    vaultReach: 1.5, // Space within this distance of low cover, moving or facing it, vaults it
    vaultTime: 0.34,
    vaultHeight: 0.75,
    snapToCover: true, // sprinting into low cover crouches behind it
    knockDecay: 6, // pushPlayer impulse decay per second
  },
  weapon: {
    damage: 24,
    interval: 0.13,
    range: 95,
    heatPerShot: 7.6,
    cooling: 30,
    overheatCooling: 22,
    recoverHeat: 28,
    hipSpread: 0.027,
    aimSpread: 0.0025,
    // active vent (R; forced on overheat). Tap R again while the vent sweep is in
    // [ventWindow[0], ventWindow[1]] (fractions of ventTime) for an instant vent
    // and ventBuff × damage for ventBuffTime; a tap outside it jams for ventJam.
    activeVent: true, // false = old passive overheat/cool-down
    ventTime: 1.7,
    ventWindow: [0.42, 0.62],
    ventJam: 0.9,
    ventBuff: 1.3,
    ventBuffTime: 5,
    ventMinHeat: 12, // R below this heat does nothing
  },
  aim: { marker: 0.06 }, // world aim marker size per metre of distance (constant angular size)
  hitStop: { time: 0.06, scale: 0.2 }, // on kill; time 0 turns it off
  camera: {
    sensitivity: 0.0021,
    distance: 4.5,
    aimDistance: 2.2,
    shoulder: 0.72,
    aimShoulder: 0.57,
    fov: 68,
    aimFov: 48,
    follow: 17,
    minPitch: -1.1,
    maxPitch: 0.85,
    floorGap: 0.3, // app: looking up, the camera slides in along its arm to stay this far above the floor
  },
  // ---- Combat redesign v1 (DESIGN.md → "Combat loop"). Per-floor scaling:
  floors: {
    1: { damage: 0.6, attackers: 3, lunges: 1, fireScale: 1 },
    2: { damage: 1, attackers: 5, lunges: 2, fireScale: 0.85 },
    // floor 3 (the finale): the boss is the main threat, so the adds fire a little less often
    3: { damage: 1, attackers: 4, lunges: 2, fireScale: 0.95 },
  },
  // Per enemy kind; enemies.js reads e.cfg = T.enemies[kind]. height = hit-sphere
  // centre above the feet, hit = hit-sphere radius, radius = body (movement).
  enemies: {
    dropTime: 0.9, // drop-in from the ceiling onto an orange ring
    dropHeight: 9,
    gunner: {
      hp: 65, speed: 2.2, radius: 0.45, hit: 0.62, height: 1.38, turn: 3.2,
      range: 18, pushRange: 10, maxRange: 34,
      burst: 3, shotGap: 0.16, damage: 7, telegraph: 0.75, interval: 2.3, boltSpeed: 18,
      duck: 0.6, pop: 0.42, repost: 7, // hover offsets: duck below the cover lip, pop above it to fire
      relocate: 1.2, postSearch: 12, postMin: 7, postMax: 24,
    },
    shield: {
      hp: 110, speed: 1.9, radius: 0.55, hit: 0.7, height: 1.38, turn: 1.7,
      range: 14, pushRange: 7, maxRange: 30,
      burst: 3, shotGap: 0.2, damage: 7, telegraph: 0.8, interval: 2.4, boltSpeed: 17,
      expose: 1.1, block: 0.12,
      bashRange: 2.2, bashWindup: 0.55, bashDamage: 14, bashPush: 7, bashCooldown: 3,
    },
    hugger: {
      hp: 40, speed: 4.4, radius: 0.4, hit: 0.55, height: 0.95, turn: 6,
      lungeRange: 7, telegraph: 0.8, track: 0.6, lungeSpeed: 13, lungeTime: 0.6, arc: 1.1,
      contact: 1.05, damage: 16, push: 7, recover: 1.1, cooldown: 1.6, weave: 2.2, weaveRate: 2.4,
    },
    warden: {
      hp: 420, radius: 1.0, hit: 1.0, height: 1.6, beamHeight: 0.91, turn: 0.9, beamTurn: 0.25,
      range: 40, telegraph: 1.4, beamTime: 2.6, beamDps: 22, beamWidth: 0.6,
      vent: 3.2, cooldown: 2.8, armour: 0.15, core: 2.5,
    },
    maintainer: {
      hp: 70, speed: 2.6, radius: 0.45, hit: 0.55, height: 2.3, turn: 3,
      keepAway: 9, healRange: 9, heal: 14, fleeSpeed: 3.4,
    },
  },
  crit: { rear: 1.5, rearArc: -0.3 }, // rear arc: dot(facing, toShooter) below this
  // Subagents (Q): beacon → drop → shockwave stagger → taunt; Q again = order.
  squad: {
    count: 3, duration: 14, cooldown: 24, range: 16, dropDelay: 0.8,
    shockRadius: 6.5, shockDamage: 15, shockPush: 1, stagger: 1.8,
    taunt: 5, tauntWeight: 0.15, hp: 60, damage: 18, interval: 0.75, speed: 3.1,
    escortSpeed: 3.1, escortDamage: 5, escortInterval: 1.2, escortHp: 500,
    orderCooldown: 0.4, flankDistance: 5, shake: 0.35,
  },
  loot: {
    radius: 2, magnet: 4.5, magnetSpeed: 9, life: 26, blink: 5,
    chance: { gunner: 0.4, shield: 0.9, hugger: 0.25, warden: 1, maintainer: 1 },
    guaranteed: { maintainer: "compute", warden: "overclock" },
    patch: 35, coolant: 6, compute: 10, overclock: 8,
  },
  // Approach (landing area): flight.js + flight-combat.js. Phases scale with duration - landingBeat.
  // URL knobs: ?flightdiff=0.6 (difficulty), ?failmode=soft (no breach), ?flightbot=1 (autopilot; on with ?test).
  flight: {
    duration: 46, // 40.4 s approach + 5.6 s landing cinematic (not skippable)
    speed: 70,
    steerSpeed: 28,
    width: 40,
    height: 22,
    collisionPenalty: 0.7,
    approachAltitude: 155,
    landingAltitude: 7,
    cameraDistance: 34,
    fleetCount: 38,
    difficulty: 1, // scales wave sizes, debris density, enemy fire rate and damage
    hull: 100, hullRegen: 3, regenDelay: 3,
    failMode: "checkpoint", // hull 0 -> back to the start of the phase; "soft" = never fails
    mercyAfter: 2, // failures (or gate bounces) before a phase eases off / the escorts help
    laserRate: 9, laserSpeed: 900, laserDamage: 1, laserHeat: 0.05, laserCool: 0.34, aimAssist: 0.022, aimSensitivity: 1,
    boltSpeed: 190, boltDamage: 7, interceptorTell: 0.55, interceptorCooldown: 2.0, interceptorHold: 7,
    flakSpeed: 230, flakDamage: 8, turretTell: 0.7, turretCooldown: 2.3,
    fieldDamage: 20, gateDamage: 26, gateKnockback: 2.2,
  },
  world: {
    coverHeight: 1.35,
    floorHeight: 72,
    width: 38,
    nearZ: 12,
    farZ: -44,
  },
  encounter: {
    initialDelay: 2.5,
    beatDelay: 2.5, // pause between beats
    liftDuration: 9,
    completionDelay: 3,
    retryPenalty: 10,
    // Beats per floor (encounter.js). type: clear | push (defenders advance) |
    // hold (stand in the ring until it fills; trickle reinforcements; then clear).
    // spawns: { kind, x, z, delay? } — positions are pushed out of cover.
    floors: {
      1: [
        {
          id: "breach", type: "clear", title: "BREACH / GUNNERS IN COVER",
          hint: "C crouches behind cover; hold right mouse to rise and aim. Gunners duck and pop up to fire: hit them then, or flank them.",
          hintTime: 10,
          spawns: [
            { kind: "gunner", x: -7, z: -15 },
            { kind: "gunner", x: 6, z: -18, delay: 0.5 },
            { kind: "gunner", x: 1, z: -25, delay: 1 },
          ],
        },
        {
          id: "shield-line", type: "clear", title: "SHIELD LINE",
          hint: "Shield fronts block your fire. Hit them while they shoot, flank, or drop your squad on them (Q). Don't let them close in: they bash.",
          spawns: [
            { kind: "shield", x: 0, z: -21 },
            { kind: "gunner", x: -9, z: -24, delay: 0.4 },
            { kind: "gunner", x: 9, z: -22, delay: 0.8 },
            { kind: "gunner", x: 3, z: -31, delay: 1.2 },
          ],
        },
        {
          id: "flank-rush", type: "clear", title: "FLANK RUSH / HUGGERS",
          hint: "Huggers rush you and leap over cover after a red floor ring. Shoot them early or dodge the leap (Space).",
          spawns: [
            { kind: "hugger", x: -16, z: -8, delay: 0.6 },
            { kind: "hugger", x: 16, z: -12, delay: 2.2 },
            { kind: "hugger", x: -16, z: -17, delay: 3.8 },
            { kind: "gunner", x: -4, z: -30 },
            { kind: "gunner", x: 8, z: -32, delay: 0.5 },
          ],
        },
        {
          id: "hold-lift", type: "hold", title: "HOLD THE LIFT", doneTitle: "LIFT POWERED / CLEAR THE ATRIUM",
          hint: "Stand in the ring on the lift while it powers up. The meter pauses when you step out.",
          hold: { x: 0, z: -39, r: 3.4, time: 15 },
          spawns: [
            { kind: "gunner", x: -10, z: -16 },
            { kind: "gunner", x: 10, z: -18, delay: 0.6 },
          ],
          trickle: { every: 3.5, max: 4, pool: ["gunner", "hugger", "gunner"], points: [[-14, -12], [14, -14], [-8, -5], [8, -4]] },
        },
      ],
      2: [
        {
          id: "sentinel-line", type: "clear", title: "SENTINEL LINE / WARDEN",
          hint: "The Warden's beam stops at cover; move across it or duck. Its front is armoured; hit the glowing rear core, or hit it while it vents. The Maintainer heals: take it out first.",
          hintTime: 11,
          spawns: [
            { kind: "warden", x: 0, z: -25 },
            { kind: "maintainer", x: 0, z: -33, delay: 0.6 },
            { kind: "gunner", x: -10, z: -20, delay: 0.3 },
            { kind: "gunner", x: 10, z: -22, delay: 0.9 },
            { kind: "shield", x: -4, z: -16, delay: 1.2 },
          ],
        },
        {
          id: "counter-push", type: "push", title: "COUNTER-PUSH",
          hint: "A shield wall advances. Drop the squad behind it or flank before it reaches you.",
          spawns: [
            { kind: "shield", x: -5, z: -24 },
            { kind: "shield", x: 5, z: -26, delay: 0.4 },
            { kind: "gunner", x: -12, z: -28, delay: 0.8 },
            { kind: "gunner", x: 12, z: -28, delay: 1.2 },
            { kind: "gunner", x: 0, z: -34, delay: 1.6 },
            { kind: "hugger", x: -16, z: -14, delay: 3 },
            { kind: "hugger", x: 16, z: -18, delay: 4.5 },
            { kind: "maintainer", x: 0, z: -37, delay: 2 },
          ],
        },
        {
          id: "hold-ascent", type: "hold", title: "HOLD THE ASCENT", doneTitle: "ASCENT POWERED / CLEAR THE GALLERY",
          hint: "Hold the lift ring. A Warden covers it from the flank: turn it with your squad.",
          hold: { x: 0, z: -39, r: 3.4, time: 20 },
          spawns: [
            { kind: "warden", x: -14, z: -21 },
            { kind: "gunner", x: 10, z: -14, delay: 0.6 },
            { kind: "gunner", x: 4, z: -8, delay: 1.2 },
          ],
          trickle: { every: 3, max: 5, pool: ["gunner", "hugger", "shield", "gunner"], points: [[-14, -10], [14, -12], [0, -5], [12, -24]] },
        },
      ],
    },
    // Floor 2 as a building (encounter.js → createSections): one script per
    // level section id (floor2.js). Used only when world.level exists; the beat
    // list above stays the fallback.
    sections: {
      2: {
        // s0 LIFT LANDING: a breath. Empty, so d1 unlocks right away.
        s0: { title: "FLOOR 02 / THE BUILDING", hint: "Fight through it room by room. Doors stay locked (orange) until the section is clear, then turn green.", hintTime: 9 },
        // s1 SECURITY HALL: a gunner corridor; Huggers burst out of the side offices.
        s1: {
          title: "SECURITY HALL / GUNNER CORRIDOR",
          hint: "Gunners hold the barriers down the hall. Watch the side offices.",
          garrison: [
            { kind: "gunner", at: "back:0" },
            { kind: "gunner", at: "back:1" },
            { kind: "gunner", at: "back:2" },
          ],
          events: [
            { on: "half", via: "walk", toast: "HUGGERS / SIDE OFFICES", spawn: [{ kind: "hugger", at: "flank:0" }, { kind: "hugger", at: "flank:2", delay: 0.4 }] },
          ],
        },
        // s2 OPEN OFFICE: a shield-bearer leads, gunners in the desk rows, a
        // Maintainer keeps them alive from behind the cabinets.
        s2: {
          title: "OPEN OFFICE / FIND THE MAINTAINER",
          hint: "The Maintainer at the back heals the line. Flank down the side and take it out first.",
          garrison: [
            { kind: "shield", at: "drop:0", mode: "advance" },
            { kind: "gunner", at: "drop:1" },
            { kind: "gunner", at: "drop:2" },
            { kind: "gunner", at: "back:1" },
            { kind: "maintainer", at: "back:0" },
          ],
        },
        // s3 SERVER GALLERY: a Warden covers the whole length; the rack pods are
        // the only pockets out of its beam. Huggers come up the hall behind it.
        s3: {
          title: "SERVER GALLERY / WARDEN",
          hint: "The Warden's beam covers the hall. Move pod to pod while it charges; hit the core when it vents.",
          garrison: [
            { kind: "warden", at: "back:0", leash: 1 },
            { kind: "gunner", at: "flank:0" },
            { kind: "gunner", at: "flank:1" },
          ],
          events: [
            { on: "half", via: "walk", toast: "HUGGERS / FROM THE FAR END", spawn: [{ kind: "hugger", at: "back:1" }, { kind: "hugger", at: "back:2", delay: 0.8 }] },
          ],
        },
        // s4 COOLING HALL: they hold the mezzanine; a Maintainer up top; Huggers on
        // the floor. Take the stairs up the west wall.
        s4: {
          title: "COOLING HALL / HIGH GROUND",
          hint: "Gunners hold the mezzanine. Take the stairs on the left wall; the Maintainer is up there.",
          garrison: [
            { kind: "gunner", at: "high:0", leash: 3 },
            { kind: "gunner", at: "high:2", leash: 3 },
            { kind: "gunner", at: "high:3", leash: 3 },
            { kind: "maintainer", at: "high:1", leash: 6 },
            { kind: "hugger", at: "drop:0", wake: "enter" },
            { kind: "hugger", at: "drop:1", wake: "enter" },
          ],
          events: [{ on: "clear", via: "drop", toast: "REINFORCEMENTS / MEZZANINE", spawn: [{ kind: "shield", at: "high:4" }, { kind: "gunner", at: "back:0" }] }],
        },
        // s5 SKYBRIDGE: a shield wall at the 2 m choke, gunners behind it.
        s5: {
          title: "SKYBRIDGE / SHIELD WALL",
          hint: "Two shields hold the choke. Drop your squad behind them (Q), or wait for their firing window.",
          garrison: [
            { kind: "shield", at: [-13.6, 35.2, 4.5], leash: 2 },
            { kind: "shield", at: [-13.6, 36.8, 4.5], leash: 2 },
            { kind: "gunner", at: "back:1" },
            { kind: "gunner", at: "back:2" },
          ],
        },
        // s6 OPERATIONS: an ambush right behind the door (red door light first),
        // then hold the terminal while they come in from the back.
        s6: {
          title: "OPERATIONS / AMBUSH",
          ambush: true,
          tellText: "MOVEMENT BEHIND THE DOOR / GET READY",
          hint: "Hold the ring at the terminal. They keep coming from the back until it is done.",
          garrison: [
            { kind: "hugger", at: "flank:0", wake: "enter" },
            { kind: "hugger", at: "flank:1", wake: "enter" },
            { kind: "shield", at: "drop:0", wake: "enter" },
            { kind: "gunner", at: "back:0" },
          ],
          hold: { time: 14, doneTitle: "TERMINAL HELD / CLEAR THE ROOM", trickle: { every: 3.4, max: 4, pool: ["gunner", "hugger", "gunner", "shield"], via: "walk", at: ["back:0", "back:1", "back:2"] } },
        },
        // s7 ASCENT CORE: everything at once, a second wave drops in, then reach the
        // next lift shaft.
        s7: {
          title: "ASCENT CORE / EVERYTHING THEY HAVE",
          hint: "The last room. Warden, shields, gunners, a Maintainer. The next lift is behind them.",
          garrison: [
            { kind: "warden", at: "back:0", leash: 1 },
            { kind: "shield", at: "drop:3", mode: "advance" },
            { kind: "gunner", at: "flank:2" },
            { kind: "gunner", at: "flank:3" },
            { kind: "maintainer", at: "back:1" },
          ],
          events: [
            { on: "half", via: "drop", toast: "DROP-IN / SECOND WAVE", spawn: [{ kind: "hugger", at: "drop:1" }, { kind: "hugger", at: "drop:2", delay: 0.5 }, { kind: "gunner", at: "drop:0", delay: 1 }] },
          ],
          hold: { time: 3, after: "clear", readyTitle: "ROOM CLEAR / GET TO THE LIFT SHAFT", doneTitle: "NEXT LIFT REACHED" },
        },
      },
      // Floor 3 (round 4): a short corridor on floor-2 rules, then the arena. The
      // arena's script has `boss: true`: the section ends when the boss is down.
      // Keys are floor3.js section ids (FLOOR3.md): s0 EXPRESS LANDING → s1 SERVICE
      // SPINE → s2 ANTECHAMBER → s3 SUMMIT HALL (the arena). A run-up, not a second building.
      3: {
        s0: { title: "FLOOR 03 / THE TOP", hint: "The last floor. A short way to the top, then whatever waits there.", hintTime: 7 },
        // s1 SERVICE SPINE: a short gunner hall; a shield pushes down it, Huggers at half
        s1: {
          title: "SERVICE SPINE",
          hint: "Gunners at the far end, a shield coming down the hall.",
          garrison: [
            { kind: "gunner", at: "back:0" },
            { kind: "gunner", at: "back:1" },
            { kind: "shield", at: "flank:0", mode: "advance" },
          ],
          events: [{ on: "half", via: "walk", toast: "HUGGERS / FROM THE FAR END", spawn: [{ kind: "hugger", at: "back:2" }, { kind: "hugger", at: "back:1", delay: 0.6 }] }],
        },
        // s2 ANTECHAMBER: the last room before the top; a Maintainer keeps them up
        s2: {
          title: "ANTECHAMBER",
          hint: "The doors to the top are at the far end. Take the Maintainer first.",
          garrison: [
            { kind: "gunner", at: "flank:2" },
            { kind: "gunner", at: "flank:3" },
            { kind: "shield", at: "drop:0", mode: "advance" },
            { kind: "maintainer", at: "back:0" },
          ],
          events: [{ on: "half", via: "drop", toast: "DROP-IN", spawn: [{ kind: "hugger", at: "drop:1" }, { kind: "gunner", at: "drop:2", delay: 0.5 }] }],
        },
        // s3 SUMMIT HALL: the arena. The boss runs the fight (boss.js, T.boss).
        s3: { boss: true, title: "SUMMIT HALL", hintTime: 0 },
      },
    },
  },
  // ---- Floor 2 as a building (floor2.js level; building.js adapter). Engine knobs:
  building: {
    checkpoint: true, // retry at the last opened door instead of the floor start
    stepUp: 0.55, // biggest ground step anyone walks up or down (stairs are finer)
    gravity: 24, // the player falls off ledges; enemies never step off them
    wakeRadius: 7, // a dormant defender with line of sight wakes when you get this close
    alarm: true, // hurting a dormant defender wakes its whole section
    camProbe: 0.24, // camera keeps this far from walls (a cheap sphere cast)
    camCeiling: 0.35, // ... and this far below the section ceiling
    doorTell: 1.1, // seconds of red door light + warning before an ambush door opens
    sectionDelay: 1.2, // pause between a section's last kill and its door opening
    dropCeiling: 0.6, // drop-ins start this far below the ceiling (was dropHeight 9)
  },
  // ---- Floor 3, the finale (round 4, fight): floor flow and the arena (proposal).
  floor3: {
    on: true, // false = floor 2's goal ends the run with the finish card, as before round 4
    rideDelay: 1.6, // seconds after floor 2's goal before the ride up starts
    stubRide: 6, // ride length while lift.js has no floor-3 ride (fade stub)
    closeDoor: true, // the arena door shuts behind you once you are this far in:
    closeAfter: 4, // metres past the door
  },
  // ---- The end boss (boss.js). Everything is a proposal for Julius.
  boss: {
    name: "GLM-5.2", // Julius, 2026-10-19 (DECISIONS)
    hp: 9000, // "a lot"
    thresholds: [0.66, 0.33], // phase 2 at 66 %, phase 3 at 33 % (by health, not time)
    checkpoint: true, // retry at the start of the current phase with the boss's health at its threshold
    retryGrace: 2.5, // seconds after a phase retry before the first slam
    startDelay: 2.4, // after the fight starts, before the first slam
    faceMult: 1, // the face always takes rifle damage
    handCrit: 2.5, // a hand that is down after a slam (or stunned by the squad) takes crits
    handArmour: 0.12, // a hand in the air: mostly blocked (blue armour read-out)
    squadMult: 0.6, // squad and escort fire on the boss (they target the face when nothing else is up)
    faceHit: 0.46, // face hit-sphere radius / the face's largest size
    faceLift: 6, // the face's eye height above bossHome, for the look-at
    headTurn: 0.6, // radians the face turns to follow you
    tetherIn: 2, // the boss's "standing point" (allies, the Maintainer) this far into the slam zone
    roar: 2.6, // invulnerable seconds at each phase change (roar, shake, next wave drops)
    roarShake: 0.7,
    hand: { idleSide: 11, idleFwd: 4, idleUp: 1.5, bob: 0.5, riseHeight: 6.5, lift: 1.6, follow: 7, slamTime: 0.16, returnTime: 0.9 },
    slam: { radius: 3.4, damage: 30, push: 10, shake: 0.55, shakeFar: 0.14, allyDamage: 45 },
    // phase 3: a ring of force rolls out from a slam; Space (the dodge's i-frames) takes you through it
    shockwave: { speed: 10, width: 1, maxRadius: 34, damage: 22, push: 6, originAt: 0.35, tellScale: 1.15 },
    // phase 2+: the hand lands at one end of a line of rings and drags along it
    sweep: { length: 15, speed: 13, rings: 4, radius: 2.6, damage: 24, push: 9, tellScale: 1.1 },
    interrupt: { stun: 1.8 }, // the squad's landing cuts a winding-up slam; the hand is stunned and weak
    heal: { scale: 4 }, // a Maintainer's heal on the boss = its heal × this, up to the top of the phase
    death: { time: 4.5, sink: 7, tilt: 0.35, shake: 0.9, killAdds: true, cardDelay: 1.2 },
    // Per phase: tell (s, the red ring), track (share of the tell the ring follows you), down
    // (s the hand stays down = weak), gap (s between moves), concurrent (hands attacking at once;
    // 1 = strictly one at a time), damage (× slam/shockwave/sweep), moves (weights), wave (drops
    // in at the start of the phase: via "drop" from arena.drops or "side" through a side door),
    // refill (more adds while the phase lasts, once fewer than `below` are up).
    phases: {
      1: {
        tell: 1.2, track: 0, followTrack: 0.5, down: 2.6, gap: [1.4, 2.2], concurrent: 1, damage: 1, firstMove: 0.4,
        moves: { single: 1 },
        chain: { count: 3, tell: 0.7, track: 0.35 },
        wave: [
          { kind: "gunner", via: "drop" },
          { kind: "gunner", via: "drop", delay: 0.4 },
          { kind: "shield", via: "drop", delay: 0.8 },
          { kind: "gunner", via: "drop", delay: 1.2 },
        ],
        refill: { after: 24, every: 9, max: 3, below: 2, pool: ["gunner", "shield", "gunner"], via: "drop" },
      },
      2: {
        tell: 0.95, track: 0.25, followTrack: 0.65, down: 2.1, gap: [0.9, 1.5], concurrent: 2, damage: 1.15, firstMove: 0.3,
        moves: { single: 1, follow: 1.2, sweep: 0.8 },
        chain: { count: 3, tell: 0.65, track: 0.4 },
        wave: [
          { kind: "hugger", via: "side" },
          { kind: "hugger", via: "side", delay: 0.6 },
          { kind: "maintainer", via: "side", delay: 1 },
          { kind: "gunner", via: "drop", delay: 0.3 },
          { kind: "gunner", via: "drop", delay: 0.8 },
          { kind: "shield", via: "drop", delay: 1.3 },
        ],
        refill: { after: 22, every: 8, max: 4, below: 3, pool: ["hugger", "gunner", "hugger", "shield"], via: "side" },
      },
      3: {
        tell: 0.9, track: 0.25, followTrack: 0.6, down: 1.8, gap: [1.1, 1.7], concurrent: 2, damage: 1.15, firstMove: 0.3,
        moves: { follow: 1, double: 0.8, chain: 0.9, shockwave: 0.7, sweep: 0.5 },
        doubleShock: true, // double slams roll a shockwave out too
        chain: { count: 3, tell: 0.65, track: 0.4 },
        wave: [
          { kind: "warden", via: "drop" },
          { kind: "maintainer", via: "side", delay: 0.6 },
          { kind: "hugger", via: "side", delay: 0.3 },
          { kind: "gunner", via: "drop", delay: 0.5 },
          { kind: "gunner", via: "drop", delay: 1 },
          { kind: "shield", via: "drop", delay: 1.5 },
        ],
        refill: { after: 24, every: 9, max: 4, below: 2, pool: ["hugger", "gunner", "shield", "hugger", "gunner"], via: "side" },
      },
    },
    text: {
      phase: { 2: "GLM-5.2 ROARS / IT GETS HARDER", 3: "GLM-5.2 IS ANGRY / IT GETS MUCH HARDER" },
      shockwave: "SHOCKWAVE / DODGE THROUGH IT (SPACE)",
      interrupt: "SLAM INTERRUPTED / HAND STUNNED",
      death: "GLM-5.2 IS FALLING",
    },
  },
  audio: { volume: 0.6, sfx: 1, music: 0.5, mute: false },
  lift: {
    duration: 9.5,
    walkTime: 0.9,
    blendFrom: 0.78,
    blendTo: 0.96,
    fogFar: 520,
  },
  fx: {
    maxPixelRatio: 1.5,
    msaa: 4, // scene MSAA samples (4 = the look so far; 2 or 0 are cheaper on the GPU). URL ?msaa=
    renderScale: 1, // render resolution (1 = full; 0.8 is softer, ~35% fewer pixels). URL ?res=

    maxParticles: 240,
    beamDuration: 0.09,
    volume: 0.13,
    fogNear: 50,
    fogFar: 280,
    exposure: 1.2,
  },
};
/**
 * @param {HTMLElement} root  empty element the game fills (full viewport)
 * @param {{ best?: number | null, onFinish?: (r: object) => void, onScreen?: (card: object | null) => void, debug?: boolean }} opts
 * @returns {{ dispose(): void }}
 */
export function createAscent(root, opts = {}) {
root.innerHTML = MARKUP;
// every global listener goes through on(), so dispose() can remove it
const offs = [];
function on(target, type, fn, o) { target.addEventListener(type, fn, o); offs.push(() => target.removeEventListener(type, fn, o)); }
host.el = root;
host.on = on;
let disposed = false, raf = 0;
const cleanup = [];
opts.onScreen?.({ kind: "loading" }); // app: fonts, logo and glbs load first
boot().catch((e) => { if (!disposed) console.error("[ascent]", e); });

function dispose() {
  disposed = true;
  cancelAnimationFrame(raf);
  for (const off of offs) off();
  offs.length = 0;
  if (document.pointerLockElement && root.contains(document.pointerLockElement)) document.exitPointerLock();
  for (const fn of cleanup.splice(0).reverse()) {
    try { fn(); } catch (e) { console.warn("[ascent] dispose", e); }
  }
  if (host.el === root) host.el = null;
  root.innerHTML = "";
}
return { dispose };

async function boot() {
const $ = (id) => root.querySelector("#" + id),
  canvas = $("c");
await loadFonts();
if (disposed) return;
const brand = await loadBrand();
if (disposed) return;
const gfx = createRenderer(canvas, {
  pixelRatio: T.fx.maxPixelRatio,
  exposure: T.fx.exposure,
  msaa: T.fx.msaa,
  renderScale: T.fx.renderScale,
});
const renderer = gfx.renderer;
const scene = new THREE.Scene();
cleanup.push(() => {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose();
      m.dispose();
    }
  });
  scene.environment?.dispose();
  renderer.dispose();
  renderer.forceContextLoss();
});
scene.background = new THREE.Color(0x101b28);
scene.fog = new THREE.Fog(0x101b28, T.fx.fogNear, T.fx.fogFar);
applyEnvironment(renderer, scene, 0.4);
const camera = new THREE.PerspectiveCamera(
  T.camera.fov,
  innerWidth / innerHeight,
  0.08,
  6500,
);
scene.add(new THREE.HemisphereLight(0xcce8ff, 0x283042, 2.25));
const sun = new THREE.DirectionalLight(0xffe7b1, 2.5);
sun.position.set(15, 35, 20);
scene.add(sun);
const world = createWorld(scene, T, brand),
  flight = createFlight(scene, T, brand);
await flight.ready; // the approach's glb models (dropship, fleet, HQ)
if (disposed) return;
// perf: hidden floors and the armada (after the approach) skip their matrix updates (?perfmat=0: off)
if (new URLSearchParams(location.search).get("perfmat") !== "0") (skipHiddenMatrices(world.root), skipHiddenMatrices(flight.root));
const keys = new Set();
let mouseFire = false,
  mouseAim = false,
  locked = false,
  paused = false,
  yaw = 0,
  pitch = -0.08;
let state = "menu",
  floor = 1,
  runTime = 0,
  phaseTime = 0,
  finishWait = 0;
let health = T.player.health,
  heat = 0,
  overheated = false,
  fireCooldown = 0,
  lastDamage = -99,
  crouch = false,
  dodge = 0,
  dodgeCooldown = 0;
// Combat redesign player state: vault, active vent, hit-stop, vent buff.
let vaultT = 0,
  venting = 0, // seconds into the current vent; 0 = not venting
  ventHeat = 0, // heat when the vent started (drains linearly over ventTime)
  ventJam = 0, // extra seconds added by a missed tap
  ventTapped = false,
  ventBuffUntil = -1,
  hitStop = 0,
  fallSpeed = 0; // floor 2: falling off a ledge (T.building.gravity)
const vaultFrom = new THREE.Vector3(),
  vaultTo = new THREE.Vector3();
let last = performance.now(),
  toastTime = 0,
  hintTime = 0,
  hitTime = 0,
  hitBlocked = false,
  shake = 0,
  damageFlash = 0;
const pos = new THREE.Vector3(0, 0, 8),
  velocity = new THREE.Vector3(),
  dodgeDir = new THREE.Vector3();
const stats = {
  kills: 0,
  allyKills: 0,
  calls: 0,
  retries: 0,
  collisions: 0,
  shots: 0,
  hits: 0,
};
let playerHeight = T.player.height;
const playerModel = buildPlayer();
const body = playerModel.root;
scene.add(body);
const glow = playerModel.muzzle;
body.visible = false;

// Short-lived effects use shared geometry; the caps bound long sessions.
const effects = [];
const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 5),
  particleGeo = new THREE.SphereGeometry(1, 5, 4);
function beam(a, b, color = 0xa9f278) {
  const d = a.distanceTo(b);
  if (d < 0.01) return;
  const m = new THREE.Mesh(
    beamGeo,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
  );
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
  m.scale.set(0.025, d, 0.025);
  scene.add(m);
  effects.push({ m, life: T.fx.beamDuration, max: T.fx.beamDuration });
}
function burst(p, color = 0xb8f978, count = 12) {
  for (let i = 0; i < count && effects.length < T.fx.maxParticles; i++) {
    const m = new THREE.Mesh(
      particleGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true }),
    );
    m.position.copy(p);
    const s = 0.035 + Math.random() * 0.065;
    m.scale.setScalar(s);
    scene.add(m);
    effects.push({
      m,
      life: 0.3 + Math.random() * 0.35,
      max: 0.65,
      v: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4,
        (Math.random() - 0.5) * 5,
      ),
    });
  }
}
function updateFx(dt) {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.life -= dt;
    if (e.life <= 0) {
      scene.remove(e.m);
      e.m.material.dispose();
      effects.splice(i, 1);
      continue;
    }
    e.m.material.opacity = Math.min(1, e.life / e.max);
    if (e.v) {
      e.m.position.addScaledVector(e.v, dt);
      e.v.y -= dt * 7;
    }
  }
}
// Sound (lift-ui): procedural kit in audio.js. T.audio = { volume, sfx, music, mute }; M mutes.
const audio = createAudio(T);
cleanup.push(() => audio.close());
const initAudio = () => audio.init();
const sound = (name) => audio.play(name);
let audioClock = performance.now();
function updateAudio() {
  const now = performance.now(),
    dt = Math.min(0.25, (now - audioClock) / 1000);
  audioClock = now;
  audio.update(dt, {
    mode: state,
    paused,
    floor,
    health,
    enemies: actors.enemies.filter((e) => !e.dead && e.hp > 0).length,
    holding: !!director.holding,
    holdProgress: director.progress || 0,
  });
}
const box = new THREE.Box3(),
  ray = new THREE.Ray(),
  tmpHit = new THREE.Vector3();
// Low cover (height < LOW_COVER) can be skipped: hugger lunges, vault checks.
const LOW_COVER = 2.2;
// Floor 2 is a building (world.level → building.js adapter `bld`): colliders
// have their own baseY, the ground has stairs and upper levels, doors open.
// Floor 1 (bld === null) keeps the old flat rules exactly.
let bld = null;
// Floor 3 (round 4): the end boss (boss.js), its arena (level.arena or a stub),
// and the phase to retry at (T.boss.checkpoint).
let boss = null,
  bossArena = null,
  bossRetryPhase = 0;
const bossStats = { deaths: [0, 0, 0, 0], start: -1, end: -1 };
const urlArgs = new URLSearchParams(location.search);
function groundAt(x, z, y) {
  if (!bld) return world.floorY;
  return bld.ground(x, z, y);
}
// Does collider c block a body whose feet are at y? Floor 2: vertical overlap
// with the body above step height (stairs are ground, not colliders).
function solid(c, y, ignoreLow = false) {
  if (c.disabled || (ignoreLow && c.height < LOW_COVER)) return false;
  if (!bld) return Math.abs(c.baseY - y) <= 0.5;
  return c.baseY < y + 1.7 && c.baseY + c.height > y + T.building.stepUp;
}
function worldHit(origin, dir, maxDist, ignoreLow = false) {
  let nearest = maxDist;
  ray.set(origin, dir);
  for (const c of world.colliders) {
    if (c.disabled || (ignoreLow && c.height < LOW_COVER)) continue;
    box.min.set(c.minX, c.baseY, c.minZ);
    box.max.set(c.maxX, c.baseY + c.height, c.maxZ);
    if (ray.intersectBox(box, tmpHit)) {
      const d = tmpHit.distanceTo(origin);
      if (d < nearest) nearest = d;
    }
  }
  return nearest;
}
function blocked(a, b, ignoreLow = false) {
  const d = b.clone().sub(a),
    len = d.length();
  return len > 0.001 && worldHit(a, d.divideScalar(len), len, ignoreLow) < len - 0.03;
}
// Push a point on the current floor out of any collider (spawns, drops, lunges).
function free(p, radius = T.player.radius) {
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const c of world.colliders) {
      if (!solid(c, p.y)) continue;
      const l = p.x - (c.minX - radius),
        r = c.maxX + radius - p.x,
        n = p.z - (c.minZ - radius),
        f = c.maxZ + radius - p.z;
      if (l <= 0 || r <= 0 || n <= 0 || f <= 0) continue;
      const m = Math.min(l, r, n, f);
      if (m === l) p.x = c.minX - radius - 0.01;
      else if (m === r) p.x = c.maxX + radius + 0.01;
      else if (m === n) p.z = c.minZ - radius - 0.01;
      else p.z = c.maxZ + radius + 0.01;
      moved = true;
    }
    if (!bld) {
      p.x = THREE.MathUtils.clamp(p.x, -T.world.width / 2 + radius, T.world.width / 2 - radius);
      p.z = THREE.MathUtils.clamp(p.z, T.world.farZ + radius, T.world.nearZ - radius);
    }
    if (!moved) break;
  }
  if (bld) {
    const g = groundAt(p.x, p.z, p.y);
    if (g !== null) p.y = g;
  }
  return p;
}
// Floor 2: may a body at p step onto (x, z)? Ground must exist, no climb above
// stepUp, and no drop below it unless canDrop (the player; enemies keep to
// their level). Returns the ground height there, or null when refused.
function stepTo(p, x, z, canDrop) {
  if (!bld.walkable(x, z)) return null;
  const g = groundAt(x, z, p.y);
  if (g === null || g - p.y > T.building.stepUp) return null;
  if (!canDrop && p.y - g > T.building.stepUp) return null;
  return g;
}
function move(p, delta, radius = T.player.radius, ignoreLow = false, canDrop = false) {
  const steps = Math.max(1, Math.ceil(delta.length() / 0.2)),
    sx = delta.x / steps,
    sz = delta.z / steps;
  for (let i = 0; i < steps; i++) {
    let nx = p.x + sx,
      nz = p.z;
    for (const c of world.colliders) {
      if (!solid(c, p.y, ignoreLow)) continue;
      if (
        nx > c.minX - radius &&
        nx < c.maxX + radius &&
        nz > c.minZ - radius &&
        nz < c.maxZ + radius
      )
        nx =
          sx > 0
            ? Math.min(nx, c.minX - radius)
            : sx < 0
              ? Math.max(nx, c.maxX + radius)
              : nx;
    }
    if (bld) {
      if (nx !== p.x && stepTo(p, nx, p.z, canDrop) === null) nx = p.x;
      p.x = nx;
    } else
      p.x = THREE.MathUtils.clamp(
        nx,
        -T.world.width / 2 + radius,
        T.world.width / 2 - radius,
      );
    nz = p.z + sz;
    for (const c of world.colliders) {
      if (!solid(c, p.y, ignoreLow)) continue;
      if (
        p.x > c.minX - radius &&
        p.x < c.maxX + radius &&
        nz > c.minZ - radius &&
        nz < c.maxZ + radius
      )
        nz =
          sz > 0
            ? Math.min(nz, c.minZ - radius)
            : sz < 0
              ? Math.max(nz, c.maxZ + radius)
              : nz;
    }
    if (bld) {
      if (nz !== p.z && stepTo(p, p.x, nz, canDrop) === null) nz = p.z;
      p.z = nz;
      // follow the ground (stairs); a bigger drop is a fall (player only)
      const g = groundAt(p.x, p.z, p.y);
      if (g !== null && Math.abs(g - p.y) <= T.building.stepUp) p.y = g;
    } else
      p.z = THREE.MathUtils.clamp(
        nz,
        T.world.farZ + radius,
        T.world.nearZ - radius,
      );
  }
  return p;
}
// ---- Loot: defenders drop pickups; walk over one to collect it.
const pickups = [];
let coolantUntil = -1,
  overclockUntil = -1;
// Rules (T.loot): a drop chance per kind, guaranteed drops (maintainer → compute,
// warden → overclock), pickups pushed out of cover, and a magnet pull nearby.
function dropLoot(kind, at) {
  const L = T.loot;
  let type = L.guaranteed[kind];
  if (!type) {
    if (Math.random() > (L.chance[kind] ?? 0.4)) return;
    // Weighted by need: low health favours patches, a hot rifle favours coolant.
    const weights = {
      patch: health < 70 ? 4 : 1,
      coolant: heat > 50 ? 3 : 1,
      compute: actors.ready ? 0.6 : 2.5,
      overclock: kind === "shield" ? 3 : 1,
    };
    let roll = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
    type = "patch";
    for (const [k, w] of Object.entries(weights)) {
      if ((roll -= w) <= 0) {
        type = k;
        break;
      }
    }
  }
  const model = buildPickup(type);
  model.root.position.copy(free(at.clone().setY(bld ? at.y : world.floorY), 0.45));
  scene.add(model.root);
  pickups.push({ type, model, age: 0, spawn: 0, collect: -1, phase: Math.random() * 6 });
  sound("drop");
}
const lootDetail = (type) =>
  ({
    patch: `+${T.loot.patch} integrity`,
    coolant: `rifle vented · ${T.loot.coolant}s no heat`,
    compute: `subagents −${T.loot.compute}s`,
    overclock: `${T.loot.overclock}s · pierce shields and armour`,
  })[type];
function applyLoot(type) {
  const info = LOOT[type];
  if (type === "patch") health = Math.min(T.player.health, health + T.loot.patch);
  else if (type === "coolant") {
    heat = 0;
    overheated = false;
    venting = ventJam = 0;
    coolantUntil = runTime + T.loot.coolant;
  } else if (type === "compute") actors.reduceCooldown(T.loot.compute);
  else overclockUntil = runTime + T.loot.overclock;
  stats.loot = (stats.loot || 0) + 1;
  toast(`${info.label} · ${lootDetail(type)}`, 1.8);
  sound("pickup");
  burst(pos.clone().add(new THREE.Vector3(0, 1.1, 0)), info.color, 12);
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.age += dt;
    p.spawn = Math.min(1, p.spawn + dt * 2.2);
    const at = p.model.root.position;
    const near = state === "combat" && health > 0 && p.spawn >= 0.5 && Math.abs(at.y - pos.y) < 1.6;
    const d = Math.hypot(at.x - pos.x, at.z - pos.z);
    if (p.collect >= 0) p.collect += dt * 4;
    else if (near && d < T.loot.radius) {
      p.collect = 0;
      applyLoot(p.type);
    } else if (near && d < T.loot.magnet) {
      // Magnet: drifts toward you, faster the closer you are.
      const pull = Math.min(d, T.loot.magnetSpeed * dt * (1 - d / T.loot.magnet + 0.25));
      at.x += ((pos.x - at.x) / d) * pull;
      at.z += ((pos.z - at.z) / d) * pull;
    }
    const expired = p.age > T.loot.life;
    p.model.update(dt, {
      time: runTime,
      phase: p.phase,
      spawn: p.spawn,
      blink: p.age > T.loot.life - T.loot.blink,
      collect: Math.max(0, p.collect),
    });
    if (p.collect >= 1 || expired) removePickup(i);
  }
}
function removePickup(i) {
  const p = pickups[i];
  scene.remove(p.model.root);
  p.model.dispose();
  pickups.splice(i, 1);
}
function clearPickups() {
  while (pickups.length) removePickup(pickups.length - 1);
  coolantUntil = overclockUntil = -1;
}
// `continuous` (the Warden beam, every frame): hurt sound and shake are throttled.
let lastHurtFx = -99;
const combatStats = { taken: 0 }; // balance read-out (window.__ascent.balance)
function damagePlayer(amount, from, continuous = false) {
  if (
    state !== "combat" ||
    paused ||
    health <= 0 ||
    dodge > T.player.dodgeDuration - T.player.dodgeProtection ||
    vaultT > 0 ||
    (boss && boss.dead) // the boss's death beat: nothing hurts any more
  )
    return;
  health = Math.max(0, health - amount);
  combatStats.taken += amount;
  const sid = statId();
  if (sid && !director.done) {
    statFor(sid).taken += amount;
    if (!health) statFor(sid).deaths++;
  }
  lastDamage = runTime;
  damageFlash = Math.max(damageFlash, continuous ? 0.5 : 0.8);
  if (!continuous || runTime - lastHurtFx > 0.25) {
    lastHurtFx = runTime;
    shake = Math.max(shake, 0.07);
    sound("hurt");
  }
  if (!health) {
    state = "dead";
    combatStats.deaths = (combatStats.deaths || 0) + 1;
    if (boss?.active) bossStats.deaths[boss.phase]++;
    // phase checkpoint (T.boss.checkpoint): remember which phase to retry
    bossRetryPhase = boss?.active && !boss.dead && T.boss.checkpoint ? boss.phase : 0;
    showOverlay("dead");
  }
}
// Knock-back (shield bash, hugger lunge): an impulse that decays; breaks crouch.
const knock = new THREE.Vector3();
function pushPlayer(v) {
  if (vaultT > 0) return;
  knock.add(v);
  crouch = false;
}
// Combat looks (bolts, beams, floor rings, impacts, numbers): looks.js interface.
const looks = createFxLooks(scene);
const actors = createActors(scene, T, {
  blocked,
  move,
  free,
  rayLength: worldHit,
  colliders: () => world.colliders,
  // floor 2 (building): the level adapter, ground height, and a woken section
  building: () => bld,
  ground: (x, z, y) => (bld ? bld.ground(x, z, y) ?? y : world.floorY),
  onAlarm: (section) => director.alarm(section),
  // floor 3: the boss as a target for allies and a patient for Maintainers, and
  // the squad's landing (it interrupts a winding-up slam)
  bossTarget: () => (boss && boss.active && !boss.dead ? boss.target : null),
  onSquadLand: (point, radius) => boss?.squadLanded(point, radius),
  pushPlayer,
  shake: (a) => (shake = Math.max(shake, a)),
  looks,
  damagePlayer,
  beam,
  burst,
  sound,
  onKill(kind, byAlly, at, e) {
    stats.kills++;
    if (bld && e && e.section >= 0) {
      const st = statFor(bld.sections[e.section].id);
      st.kills++;
      if (byAlly) st.squadKills++;
    }
    if (at) dropLoot(kind, at);
    if (byAlly) stats.allyKills++;
    else if (T.hitStop.time > 0) hitStop = T.hitStop.time * (kind === "warden" ? 2.5 : 1);
  },
  getPlayer: () => ({
    pos,
    alive: state === "combat" && health > 0,
    height: playerHeight,
  }),
  getCamera: () => camera,
}, brand);

function toast(text, duration = 2.5) {
  $("toast").textContent = text;
  toastTime = duration;
}
function hint(text, duration = 7) {
  $("hint").textContent = text;
  hintTime = duration;
  $("hint").classList.remove("hidden");
}
function clearInput() {
  keys.clear();
  mouseFire = mouseAim = false;
}
function lock() {
  const promise = canvas.requestPointerLock?.();
  promise?.catch(() => {
    hint("Click the view to capture the mouse.", 3);
  });
}
function release() {
  clearInput();
  if (document.pointerLockElement) document.exitPointerLock();
}
// app: the overlays as the shared level card (ui/LevelCard.tsx), drawn by End2.tsx; KEYS on intro + pause
const KEYS = [["WASD", "steer the approach · move"], ["MOUSE", "look · left click fire · hold right aim"], ["C / SHIFT / SPACE", "cover · sprint · dodge"], ["Q / E", "spawn subagents · use the lift"]];
function showOverlay(type) {
  root.classList.toggle("finished", type === "finish");
  const card = {
    menu: {
      kind: "intro",
      line: "The scorer’s files are believed to be at the top. Fly into the fleet, take the atrium, and call in your own squad to push upward.",
      keys: KEYS,
      action: { label: "Join the swarm", onClick: startRun },
    },
    pause: { kind: "pause", title: "Paused", keys: KEYS, action: { label: "Resume", onClick: resume }, onBackdrop: resume, hint: "Click anywhere to resume" },
    dead: {
      kind: "fail",
      title: "Core interrupted",
      line: bossRetryPhase
        ? `Retry phase ${bossRetryPhase} of the fight, the boss's health back at ${Math.round((bossRetryPhase === 1 ? 1 : T.boss.thresholds[bossRetryPhase - 2]) * 100)} %. +${T.encounter.retryPenalty}s to your run.`
        : `Retry floor ${floor} with health and subagents restored. +${T.encounter.retryPenalty}s to your run.`,
      action: { label: bossRetryPhase ? "Retry phase" : "Retry floor", onClick: retryFloor },
      hint: "R retries",
    },
  }[type];
  if (type === "finish") {
    opts.onScreen?.(endCard());
    sound("finish");
    // app: the save records the run (best time, chapter done)
    opts.onFinish?.({ time: runTime, kills: stats.kills, allyKills: stats.allyKills, calls: stats.calls, retries: stats.retries, loot: stats.loot || 0, floor });
  } else opts.onScreen?.(card);
  release();
}
// End card: run time + three numbers; the tower strip (extra slot) shows how far the climb got.
function endCard() {
  // floor 3 (round 4): three floors, end text is a placeholder for the storyteller
  const top = T.floor3.on && floor === 3;
  return {
    kind: "finish",
    title: top ? "Three floors secured" : "Two floors secured",
    line: top ? "[End text placeholder: the storyteller and Julius decide what happens at the top.]" : "The swarm holds the lower tower.",
    main: { k: "Run time", v: formatTime(runTime) },
    stats: [{ k: "Takedowns", v: stats.kills }, { k: "Call-ins", v: stats.calls }, { k: "Retries", v: stats.retries }],
    action: { label: "Fly again", onClick: startRun },
    extra: towerStrip(top ? 3 : 2),
  };
}
function towerStrip(litFloors) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 520");
  svg.setAttribute("width", "120");
  svg.setAttribute("height", "380");
  svg.setAttribute("aria-hidden", "true");
  const add = (tag, attrs, style, text) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    e.setAttribute("style", style);
    if (text) e.textContent = text;
    svg.appendChild(e);
  };
  const line = "stroke: var(--color-line-strong); stroke-width: 1.5", on = "stroke: var(--color-hack-green); stroke-width: 2";
  const text = (lit) => `font: 400 13px var(--font-mono); letter-spacing: 1.5px; fill: var(${lit ? "--color-hack-green" : "--color-text-faint"})`;
  add("line", { x1: 22, x2: 22, y1: 10, y2: 510 }, line);
  add("line", { x1: 70, x2: 70, y1: 10, y2: 510 }, line);
  for (let i = 0; i < 9; i++) {
    const y = 492 - i * 54, lit = i < litFloors;
    add("line", { x1: 12, x2: 80, y1: y, y2: y }, lit ? on : line);
    if (i < 3) add("text", { x: 88, y: y + 4 }, text(lit), "FL 0" + (i + 1) + (i === litFloors ? " ?" : ""));
  }
  return svg;
}
function startRun() {
  initAudio();
  actors.clear();
  clearPickups();
  world.root.visible = false;
  body.visible = false;
  flight.start();
  state = "flight";
  paused = false;
  floor = 1;
  runTime = 0;
  phaseTime = 0;
  Object.keys(stats).forEach((k) => (stats[k] = 0));
  health = T.player.health;
  heat = 0;
  overheated = false;
  toastTime = 0;
  hintTime = 0;
  showCard(null);
  $("hud").classList.remove("hidden");
  lock();
  boss?.stop();
  bossRetryPhase = 0;
  bossStats.deaths.fill(0);
  bossStats.start = bossStats.end = -1;
  // test entry points: ?floor=2 or ?floor=3 skips the approach (?at=arena: straight
  // into the boss arena; ?phase=2|3: start the boss there)
  const at = +urlArgs.get("floor");
  if (at === 2 || at === 3) beginFloor(at);
}
function beginFloor(n, retry = false) {
  flight.dispose();
  floor = n;
  world.root.visible = true;
  world.setFloor(n);
  world.setLiftReady(false);
  // Floor 2 with a building level (floor2.js): start where the lift arrives.
  bld = world.level ? createBuilding(world.level, world.floorY, { ground: world.ground, blocked, stepUp: T.building.stepUp }) : null;
  playerSection = -1;
  fallSpeed = 0;
  setupFloor3(n); // the boss and its arena (floor 3); hides the boss elsewhere
  let startYaw = 0;
  if (bld) {
    pos.copy(bld.start);
    pos.y = groundAt(pos.x, pos.z, pos.y) ?? pos.y;
    startYaw = bld.startYaw;
  } else pos.set(0, (n - 1) * T.world.floorHeight, 8);
  actors.reset(pos.y, n, bld ? { pos, yaw: startYaw } : null);
  clearPickups();
  body.visible = true;
  state = "combat";
  phaseTime = 0;
  director.start(n, pos.y, bld);
  // Checkpoint (T.building.checkpoint): a retry on floor 2 restarts at the last
  // opened door, with that section's defenders back in place.
  // Floor 3: a boss-phase retry (T.boss.checkpoint) or ?at=arena restores to the
  // arena door, then puts you just inside the arena (the boss starts on entry).
  const intoArena = n === 3 && bld && arenaIndex > 0 && ((retry && bossRetryPhase > 0) || (!retry && (urlArgs.get("at") === "arena" || testArena)));
  const cp = intoArena ? arenaIndex : retry && bld && T.building.checkpoint ? lastCheckpoint : 0;
  if (cp > 0) {
    const at = director.restore(n, cp);
    pos.copy(at.pos);
    startYaw = at.yaw;
    if (intoArena) {
      const door = bld.entryDoor(arenaIndex);
      const c = door?.checkpoint;
      if (c) pos.set(c.x, bld.floorY + (c.y || 0), c.z), (startYaw = c.yaw ?? startYaw);
      else pos.copy(bld.doorSide(door, arenaIndex, 3));
      pos.y = groundAt(pos.x, pos.z, pos.y) ?? pos.y;
    }
    actors.regroup(pos, startYaw);
  }
  lastCheckpoint = 0;
  beatMark = null;
  finishWait = 0;
  health = T.player.health;
  heat = 0;
  overheated = false;
  venting = ventJam = 0;
  ventBuffUntil = -1;
  vaultT = hitStop = 0;
  knock.set(0, 0, 0);
  lastDamage = -99;
  dodge = 0;
  dodgeCooldown = 0;
  fireCooldown = 0;
  crouch = false;
  yaw = startYaw;
  pitch = -0.06;
  playerHeight = T.player.height;
  velocity.set(0, 0, 0);
  clearInput();
  updateCamera(1, true);
  toast(
    n === 1
      ? "FLOOR 01 / TAKE THE ATRIUM"
      : retry && bossRetryPhase
        ? `CHECKPOINT / PHASE ${bossRetryPhase}`
        : cp > 0
          ? "CHECKPOINT / LAST OPEN DOOR"
          : n === 3
            ? "FLOOR 03 / THE TOP"
            : "FLOOR 02 / BREAK THE DEFENSE",
  );
  hint(
    n === 1
      ? "C crouches behind cover. Hold right mouse to rise and aim. Q calls your squad."
      : n === 3
        ? "The last floor. Fight through to the top."
      : bld
        ? "Fight through the building. Doors stay locked until each section is clear. While your squad is out, Q again gives orders."
        : "Floor 02 hits harder. While your squad is out, Q again gives orders: aim at an enemy to focus it, at the floor to move them.",
    10,
  );
  if (retry) {
    stats.retries++;
    runTime += T.encounter.retryPenalty;
  }
}
let lastCheckpoint = 0; // set on death (floor 2): the director's last opened door
function retryFloor() {
  paused = false;
  lastCheckpoint = bld ? director.checkpoint : 0;
  beginFloor(floor, true);
  showCard(null);
  lock();
}
function resume() {
  paused = false;
  showCard(null);
  clearInput();
  last = performance.now();
  lock();
}
function showCard(card) {
  root.classList.remove("finished");
  opts.onScreen?.(card);
}
canvas.addEventListener("click", () => {
  if (!locked && !paused && ["flight", "combat", "lift"].includes(state))
    lock();
});
on(window, "contextmenu", (e) => e.preventDefault());
on(document, "pointerlockchange", () => {
  const was = locked;
  locked = document.pointerLockElement === canvas;
  if (
    was &&
    !locked &&
    ["flight", "combat", "lift"].includes(state) &&
    !paused
  ) {
    paused = true;
    showOverlay("pause");
  }
});
on(window, "blur", () => {
  if (["flight", "combat", "lift"].includes(state) && !paused) {
    paused = true;
    showOverlay("pause");
  }
});
on(window, "mousemove", (e) => {
  if (!locked || paused || state !== "combat") return;
  const k = T.camera.sensitivity * (mouseAim ? 0.72 : 1) * lookScale(); // app: settings
  yaw -= e.movementX * k;
  pitch = THREE.MathUtils.clamp(
    pitch - e.movementY * k,
    T.camera.minPitch,
    T.camera.maxPitch,
  );
});
on(window, "mousedown", (e) => {
  if (!locked || paused) return;
  if (e.button === 0) mouseFire = true;
  if (e.button === 2) mouseAim = true;
});
on(window, "mouseup", (e) => {
  if (e.button === 0) mouseFire = false;
  if (e.button === 2) mouseAim = false;
});
on(window, "keydown", (e) => {
  if (
    ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  )
    e.preventDefault();
  if (
    e.code === "Escape" &&
    !paused &&
    ["flight", "combat", "lift"].includes(state)
  ) {
    paused = true;
    showOverlay("pause");
    return;
  }
  if (paused || state === "menu" || state === "finish") return;
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "KeyR" && state === "dead") {
    retryFloor();
    return;
  }
  if (state !== "combat") return;
  if (e.code === "KeyC") crouch = !crouch;
  if (e.code === "KeyR") ventKey();
  if (e.code === "Space" && vaultT <= 0 && startVault()) return;
  if (e.code === "Space" && dodgeCooldown <= 0) {
    dodgeDir.copy(movementDirection());
    if (dodgeDir.lengthSq() < 0.1)
      dodgeDir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    dodge = T.player.dodgeDuration;
    dodgeCooldown = T.player.dodgeCooldown;
    crouch = false;
    sound("spawn");
  }
  if (e.code === "KeyQ") callSquad();
  if (
    e.code === "KeyE" &&
    worldReady() &&
    pos.distanceTo(world.liftPosition) < 4.5
  )
    startLift();
});
on(window, "keyup", (e) => keys.delete(e.code));
function movementDirection() {
  const z =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
    x =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
  return new THREE.Vector3(
    x * Math.cos(yaw) - z * Math.sin(yaw),
    0,
    -x * Math.sin(yaw) - z * Math.cos(yaw),
  ).normalize();
}
// Low cover straight ahead along `dir` (flat): nearest low collider whose
// footprint the ray enters within `reach`; returns { c, enter, exit } or null.
function lowCoverAhead(dir, reach) {
  let best = null;
  for (const c of world.colliders) {
    if (c.height >= LOW_COVER || Math.abs(c.baseY - pos.y) > 0.5) continue;
    const r = T.player.radius;
    let t0 = -Infinity,
      t1 = Infinity;
    for (const [p, d, lo, hi] of [
      [pos.x, dir.x, c.minX - r, c.maxX + r],
      [pos.z, dir.z, c.minZ - r, c.maxZ + r],
    ]) {
      if (Math.abs(d) < 1e-6) {
        if (p < lo || p > hi) t0 = Infinity;
        continue;
      }
      const a = (lo - p) / d,
        b = (hi - p) / d;
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 > t1 || t1 < 0 || t0 > reach) continue;
    if (!best || t0 < best.enter) best = { c, enter: Math.max(0, t0), exit: t1 };
  }
  return best;
}
// Space next to low cover (moving or facing into it): vault over it with
// i-frames. Returns false when there is nothing to vault (then Space dodges).
function startVault() {
  const dir = movementDirection();
  if (dir.lengthSq() < 0.1) dir.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  const hit = lowCoverAhead(dir, T.player.vaultReach);
  if (!hit || hit.exit - hit.enter > 3) return false; // nothing low ahead, or too deep to clear
  const to = pos.clone().addScaledVector(dir, hit.exit + 0.15);
  if (free(to.clone()).distanceTo(to) > 0.05) return false; // landing spot is inside something
  vaultFrom.copy(pos);
  vaultTo.copy(to);
  vaultT = T.player.vaultTime;
  crouch = false;
  knock.set(0, 0, 0);
  velocity.copy(dir).multiplyScalar(T.player.speed);
  sound("spawn");
  return true;
}
let snapHinted = false;
function updatePlayer(dt) {
  const sprinting = (keys.has("ShiftLeft") || keys.has("ShiftRight")) && !mouseAim;
  const isLow = crouch && !mouseAim && dodge <= 0 && vaultT <= 0;
  playerHeight = isLow ? T.player.crouchHeight : T.player.height;
  const speed = mouseAim
    ? T.player.aimSpeed
    : isLow
      ? T.player.crouchSpeed
      : sprinting
        ? T.player.sprint
        : T.player.speed;
  const dir = movementDirection();
  let lift = 0;
  if (vaultT > 0) {
    // Vault: a short hop across the cover; no steering, no damage.
    vaultT = Math.max(0, vaultT - dt);
    const k = 1 - vaultT / T.player.vaultTime;
    const s = k * k * (3 - 2 * k);
    pos.x = THREE.MathUtils.lerp(vaultFrom.x, vaultTo.x, s);
    pos.z = THREE.MathUtils.lerp(vaultFrom.z, vaultTo.z, s);
    lift = Math.sin(Math.PI * k) * T.player.vaultHeight;
  } else {
    velocity.lerp(dir.clone().multiplyScalar(speed), 1 - Math.exp(-dt * 15));
    const step = (
      dodge > 0
        ? dodgeDir.clone().multiplyScalar(T.player.dodgeSpeed)
        : velocity.clone()
    ).multiplyScalar(dt);
    const before = pos.clone();
    move(pos, step, T.player.radius, false, true);
    // Snap to cover: sprinting into low cover drops you into a crouch behind it.
    if (
      T.player.snapToCover &&
      sprinting &&
      !crouch &&
      dodge <= 0 &&
      dir.lengthSq() > 0.1 &&
      step.length() > 0.05 &&
      before.distanceTo(pos) < step.length() * 0.4 &&
      lowCoverAhead(dir, 0.25)
    ) {
      crouch = true;
      velocity.set(0, 0, 0);
      if (!snapHinted) {
        snapHinted = true;
        hint("Snapped to cover. Hold right mouse to rise and aim; Space vaults over.", 4);
      }
    }
  }
  if (knock.lengthSq() > 1e-4) {
    move(pos, knock.clone().multiplyScalar(dt), T.player.radius, false, true);
    knock.multiplyScalar(Math.exp(-dt * T.player.knockDecay));
  } else knock.set(0, 0, 0);
  dodge = Math.max(0, dodge - dt);
  dodgeCooldown = Math.max(0, dodgeCooldown - dt);
  if (bld) {
    // Floor 2: stand on the ground (stairs, upper levels); fall off ledges.
    const g = groundAt(pos.x, pos.z, pos.y);
    if (g !== null) {
      if (pos.y > g + 0.02) {
        fallSpeed += T.building.gravity * dt;
        pos.y = Math.max(g, pos.y - fallSpeed * dt);
      } else {
        pos.y = g;
        fallSpeed = 0;
      }
    }
    trackSection();
  }
  body.position.copy(pos);
  body.position.y += lift;
  body.rotation.set(0, yaw, 0);
  playerModel.update(dt, {
    speed: velocity.length(),
    crouch: isLow,
    pitch,
    heat: heat / 100,
    firing: fireCooldown > T.weapon.interval - 0.04 ? 1 : 0,
    dodge: dodge > 0 || vaultT > 0,
    time: runTime,
    hurt: Math.max(0, 1 - (runTime - lastDamage) * 3),
  });
  if (runTime - lastDamage > T.player.regenDelay)
    health = Math.min(T.player.health, health + dt * T.player.regen);
}
// ---- Heat and the active vent (T.weapon.vent*). R (or an overheat) starts a
// vent: heat drains over ventTime. Tap R inside the window = instant vent and a
// damage buff; tap outside = jam. body[data-vent] = "window" | "jam" | "".
function startVent(forced) {
  venting = 1e-6;
  ventHeat = Math.max(heat, 1);
  ventJam = 0;
  ventTapped = false;
  overheated = true;
  sound(forced ? "overheat" : "vent");
  if (forced) hint("Overheated: venting. Tap R as the heat bar crosses the marker for an instant vent.", 3);
  const [a, b] = T.weapon.ventWindow;
  root.style.setProperty("--vent-from", `${(1 - b) * ventHeat}%`);
  root.style.setProperty("--vent-to", `${(1 - a) * ventHeat}%`);
}
function ventKey() {
  if (!T.weapon.activeVent) return;
  if (venting <= 0) {
    if (heat >= T.weapon.ventMinHeat) startVent(false);
    return;
  }
  if (ventTapped) return;
  ventTapped = true;
  const k = venting / T.weapon.ventTime,
    [a, b] = T.weapon.ventWindow;
  if (k >= a && k <= b) {
    heat = 0;
    venting = 0;
    overheated = false;
    ventBuffUntil = runTime + T.weapon.ventBuffTime;
    toast(`PERFECT VENT · DAMAGE ×${T.weapon.ventBuff}`, 1.6);
    sound("pickup");
    looks.impact(glow.getWorldPosition(new THREE.Vector3()), "heal");
  } else {
    ventJam = T.weapon.ventJam;
    sound("overheat");
    toast("VENT JAMMED", 1.2);
  }
}
function updateHeat(dt) {
  if (!T.weapon.activeVent) {
    heat = Math.max(
      0,
      heat -
        dt *
          (overheated ? T.weapon.overheatCooling : T.weapon.cooling) *
          (mouseFire && !overheated ? 0.08 : 1),
    );
    if (overheated && heat < T.weapon.recoverHeat) overheated = false;
  } else if (venting > 0) {
    venting += dt;
    const k = Math.min(1, venting / T.weapon.ventTime);
    heat = ventHeat * (1 - k);
    if (venting >= T.weapon.ventTime + ventJam) {
      venting = ventJam = 0;
      heat = 0;
      overheated = false;
    }
  } else heat = Math.max(0, heat - dt * T.weapon.cooling * (mouseFire ? 0.08 : 1));
  let v = "";
  if (venting > 0) {
    const k = venting / T.weapon.ventTime,
      [a, b] = T.weapon.ventWindow;
    if (ventTapped && ventJam > 0) v = "jam";
    else if (!ventTapped && k >= a && k <= b) v = "window";
  }
  if (root.dataset.vent !== v) root.dataset.vent = v;
}
// Floor 2: which section the player stands in; tells the level (culling, lights).
function trackSection() {
  const s = bld.sectionAt(pos.x, pos.z, pos.y);
  if (s >= 0 && s !== playerSection) {
    playerSection = s;
    world.level?.setSection?.(bld.sections[s].id);
  }
}
const camUp = new THREE.Vector3(0, 1, 0),
  camOff = new THREE.Vector3(),
  camFrom = new THREE.Vector3();
function updateCamera(dt, snap = false) {
  const q = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(pitch, yaw, 0, "YXZ"),
  );
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q),
    right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
  const eye = pos.clone().add(new THREE.Vector3(0, playerHeight * 0.88, 0));
  const desired = eye
    .clone()
    .addScaledVector(
      forward,
      -(mouseAim ? T.camera.aimDistance : T.camera.distance),
    )
    .addScaledVector(
      right,
      mouseAim ? T.camera.aimShoulder : T.camera.shoulder,
    );
  const d = desired.clone().sub(eye),
    distance = d.length();
  d.normalize();
  let hit = worldHit(eye, d, distance);
  if (bld) {
    // Narrow halls: a cheap sphere cast (four parallel rays camProbe apart), so
    // the near plane never slides into a wall beside or above the camera.
    const r = T.building.camProbe;
    for (const [v, s] of [[right, r], [right, -r], [camUp, r], [camUp, -r]]) {
      camFrom.copy(eye).add(camOff.copy(v).multiplyScalar(s));
      hit = Math.min(hit, worldHit(camFrom, d, distance));
    }
    if (hit < distance) desired.copy(eye).addScaledVector(d, Math.max(0.1, hit - r));
    const ceil = bld.ceilingAt(pos.x, pos.z, pos.y) - T.building.camCeiling;
    if (desired.y > ceil) desired.y = Math.max(eye.y - 0.25, ceil);
  } else if (hit < distance)
    desired.copy(eye).addScaledVector(d, Math.max(0.1, hit - 0.16));
  // app: looking up swung the camera under the floor (inside the arena); pull it in along its arm instead
  const floor = groundAt(desired.x, desired.z, pos.y + T.building.stepUp);
  if (floor != null && d.y < -1e-3 && desired.y < floor + T.camera.floorGap)
    desired.copy(eye).addScaledVector(d, Math.max(0.1, (floor + T.camera.floorGap - eye.y) / d.y));
  // Snap (no lag) when the lagging camera would sit behind a wall.
  const k = snap || (bld && blocked(eye, camera.position)) ? 1 : 1 - Math.exp(-dt * T.camera.follow);
  camera.position.lerp(desired, k);
  camera.quaternion.copy(q);
  if (shake > 0) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
  }
  camera.fov = THREE.MathUtils.lerp(
    camera.fov,
    mouseAim ? T.camera.aimFov : T.camera.fov,
    snap ? 1 : 1 - Math.exp(-dt * 12),
  );
  camera.updateProjectionMatrix();
}
// Nearest live enemy hit-sphere along a ray (actors.hitCenter + e.hitRadius);
// enemies still dropping in (spawn < 1) can't be hit yet.
const aimSphere = new THREE.Sphere(),
  aimHit = new THREE.Vector3();
function rayEnemy(origin, dir, maxDist) {
  let distance = maxDist,
    enemy = null;
  ray.set(origin, dir);
  for (const e of actors.enemies) {
    if (e.dead || e.hp <= 0 || e.spawn < 1) continue;
    aimSphere.center.copy(actors.hitCenter(e));
    aimSphere.radius = e.hitRadius || 0.7;
    if (ray.intersectSphere(aimSphere, aimHit)) {
      const d = aimHit.distanceTo(origin);
      if (d < distance) {
        distance = d;
        enemy = e;
      }
    }
  }
  // floor 3: the boss's face and hands (hit spheres from boss.js)
  if (floor === 3 && boss?.active) {
    const b = boss.raycast(ray, distance);
    if (b) return { distance: b.distance, enemy: { isBoss: true, part: b.part, weak: b.weak, kind: "boss" } };
  }
  return { distance, enemy };
}
function targetFromCamera() {
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const { distance, enemy } = rayEnemy(camera.position, dir, worldHit(camera.position, dir, T.weapon.range));
  return {
    point: camera.position.clone().addScaledVector(dir, distance),
    enemy,
  };
}
// What a shot from `origin` along `dir` would hit: the nearest cover or enemy.
function traceShot(origin, dir) {
  const { distance, enemy } = rayEnemy(origin, dir, worldHit(origin, dir, T.weapon.range));
  return { distance, target: enemy };
}
// ---- Aim read-out. The screen reticle is where the camera looks; the world
// marker is where the rifle's shot lands. When cover is in the way the two
// differ, and the reticle says so instead of leaving the player guessing.
const aimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.2, 0.26, 32),
  new THREE.MeshBasicMaterial({ transparent: true, depthTest: false, toneMapped: false }),
);
const aimDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.045, 12),
  new THREE.MeshBasicMaterial({ depthTest: false, toneMapped: false }),
);
const aimMarker = new THREE.Group();
aimMarker.add(aimRing, aimDot);
aimMarker.renderOrder = aimRing.renderOrder = aimDot.renderOrder = 998;
aimMarker.visible = false;
scene.add(aimMarker);
const aimLaser = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
  new THREE.LineBasicMaterial({ transparent: true, opacity: 0.45, toneMapped: false }),
);
aimLaser.visible = false;
aimLaser.frustumCulled = false;
scene.add(aimLaser);
// open | enemy | cover (shot blocked) | weak (rear arc, Warden core: crit) | armour
// (shield front, Warden front: mostly blocked). Mirrored to body[data-aim] for hud.css.
let aimState = "open";
const AIM_COLOR = { open: 0xdff7d0, enemy: 0xff5a4a, cover: 0xffb24b, weak: 0xfff07a, armour: 0x66daff };
function updateAim() {
  const { point, enemy } = targetFromCamera();
  const muzzlePos = new THREE.Vector3();
  glow.getWorldPosition(muzzlePos);
  const dir = point.clone().sub(muzzlePos);
  const intended = dir.length();
  dir.normalize();
  const { distance, target } = traceShot(muzzlePos, dir);
  const blockedByCover = distance < intended - 0.35 && !target;
  const mod = target ? (target.isBoss ? boss.modifier(target.part) : actors.shotModifier(target, muzzlePos, runTime < overclockUntil)) : null;
  aimState = blockedByCover ? "cover" : !target ? "open" : mod.blocked ? "armour" : mod.crit ? "weak" : "enemy";
  if (root.dataset.aim !== aimState) root.dataset.aim = aimState;
  const end = muzzlePos.clone().addScaledVector(dir, Math.min(distance, T.weapon.range));
  const color = AIM_COLOR[aimState];
  aimRing.material.color.setHex(color);
  aimDot.material.color.setHex(color);
  aimMarker.position.copy(end);
  aimMarker.quaternion.copy(camera.quaternion);
  // constant angular size: scale grows with distance from the camera
  aimMarker.scale.setScalar(Math.max(0.02, camera.position.distanceTo(end) * T.aim.marker));
  aimMarker.visible = state === "combat" && (mouseAim || aimState !== "open");
  const arr = aimLaser.geometry.attributes.position;
  arr.setXYZ(0, muzzlePos.x, muzzlePos.y, muzzlePos.z);
  arr.setXYZ(1, end.x, end.y, end.z);
  arr.needsUpdate = true;
  aimLaser.material.color.setHex(color);
  aimLaser.visible = state === "combat" && mouseAim;
}
function fire() {
  if (
    fireCooldown > 0 ||
    overheated ||
    dodge > 0 ||
    ((keys.has("ShiftLeft") || keys.has("ShiftRight")) &&
      !mouseAim &&
      !crouch &&
      velocity.length() > 6)
  )
    return;
  fireCooldown = T.weapon.interval;
  if (runTime >= coolantUntil) heat += T.weapon.heatPerShot;
  stats.shots++;
  const { point } = targetFromCamera();
  const muzzlePos = new THREE.Vector3();
  glow.getWorldPosition(muzzlePos);
  const dir = point.sub(muzzlePos).normalize();
  const spread = mouseAim ? T.weapon.aimSpread : T.weapon.hipSpread;
  dir
    .add(
      new THREE.Vector3(
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread,
      ),
    )
    .normalize();
  const { distance, target } = traceShot(muzzlePos, dir);
  const end = muzzlePos.clone().addScaledVector(dir, distance);
  const over = runTime < overclockUntil;
  beam(muzzlePos, end, over ? 0xff5fd6 : 0xa9f278);
  burst(end, target ? 0xffd265 : over ? 0xff5fd6 : 0x9ecd86, target ? 5 : 2);
  if (target) {
    const at = target.isBoss ? end.clone() : actors.hitCenter(target);
    const dmg = T.weapon.damage * (runTime < ventBuffUntil ? T.weapon.ventBuff : 1);
    const result = target.isBoss
      ? boss.hit(target.part, dmg, muzzlePos)
      : actors.hitEnemy(target, dmg, muzzlePos, false, runTime < overclockUntil);
    if (target.isBoss) {
      // the boss's hit read-out sits on the hit point; invulnerable (roar) reads as blocked
      if (result.invuln) result.damage = 0;
      target.hitRadius = 0.2;
    }
    hitTime = 0.12;
    hitBlocked = result.blocked;
    stats.hits++;
    sound(result.blocked ? "shield" : "hit");
    looks.number(
      at.setY(at.y + (target.hitRadius || 0.6) + 0.15),
      result.invuln ? "IMMUNE" : String(Math.max(1, Math.round(result.damage))),
      result.crit ? "crit" : result.blocked ? "blocked" : "hit",
    );
    if (result.crit) looks.impact(end, "crit");
  }
  sound("fire");
  shake = mouseAim ? 0.025 : 0.045;
  if (heat >= 100) {
    heat = 100;
    if (T.weapon.activeVent) startVent(true);
    else {
      overheated = true;
      sound("overheat");
      hint("Rifle overheated. Take cover while it cools.", 3);
    }
  }
}
// Q: throw the squad beacon at the aimed point (clamped to T.squad.range). While
// the squad is out, Q is an order: aimed enemy = focus it, aimed floor = move there.
function callSquad() {
  const squadOut = actors.squadActive;
  if (!actors.ready && !squadOut) {
    hint(
      actors.dropping ? "Squad inbound." : `Subagents ready in ${Math.ceil(actors.cooldown)}s.`,
      2,
    );
    return;
  }
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  let point = pos.clone();
  const aimed = targetFromCamera();
  const wanted = aimed.point.clone();
  wanted.y = pos.y;
  const delta = wanted.sub(pos);
  if (delta.length() > T.squad.range) delta.setLength(T.squad.range);
  if (delta.length() < 3 && !squadOut) delta.copy(forward).multiplyScalar(5);
  move(point, delta, 0.7);
  // aimed at the boss: the squad focuses its face (boss.target proxy)
  const focus = aimed.enemy?.isBoss ? boss.target : aimed.enemy;
  const result = actors.callIn(point, focus);
  if (result === "deploy") {
    stats.calls++;
    toast("SUBAGENT BEACON / SQUAD DROPPING", 2.5);
    hint("Squad incoming: the landing staggers everything nearby. Q again while they're out gives orders.", 5);
  } else if (result === "focus") toast(`SQUAD / FOCUS ${aimed.enemy.kind.toUpperCase()}`, 1.4);
  else if (result === "move") toast("SQUAD / MOVE", 1.2);
}
// ---- Encounter: beats per floor (T.encounter.floors, encounter.js).
const director = createEncounter(T, {
  looks,
  spawn: (spec, mode) => actors.spawnWave(spec, mode),
  alive: () => actors.alive,
  playerPos: () => pos,
  playerAlive: () => state === "combat" && health > 0,
  toast,
  hint,
  sound,
  // sections (floor 2 building)
  aliveIn: (i) => actors.aliveIn(i),
  wakeSection: (i, filter) => actors.wakeSection(i, filter),
  clearEnemies: () => actors.clearEnemies(),
  playerSection: () => playerSection,
  openDoor: (door) => door.open(),
  doorAlarm: (door, on) => door?.setAlert?.(on),
  // floor 3: the arena section (script `boss: true`) starts the boss and ends with it
  bossEnter: (i) => enterArena(i),
  bossDone: () => !!boss?.done,
});
// ---- Floor 3: the arena and the boss (boss.js; T.floor3, T.boss) ---------------
let testArena = false, // test hooks: start floor 3 inside the arena / at a boss phase
  testPhase = 0;
let arenaIndex = -1, // the arena's section index (building), -1 on the stub
  arenaDoor = null, // the door to close behind you once you are in
  floor3Time = 0,
  sideIx = 0,
  dropIx = 0;
// level.arena (local, y = 0 is the floor) → absolute; or a stub in the plain deck
// while floor3.js is not in (the atrium greybox at floor 3's height).
function arenaFor(level, y0) {
  const a = level?.arena;
  if (a) {
    const V = (p) => new THREE.Vector3(p.x, y0 + (p.y || 0), p.z);
    return {
      raw: a,
      section: a.section,
      center: V(a.center),
      radius: a.radius || 20,
      bossHome: V(a.bossHome),
      slamZone: a.slamZone || [],
      drops: (a.drops || []).map(([x, z, y]) => new THREE.Vector3(x, y0 + (y || 0), z)),
      sideDoors: a.sideDoors || [],
      breakables: a.breakables || [],
      breakAt: a.breakAt ? (x, z, r, dir) => a.breakAt(x, z, r, dir) : null,
      resetBreakables: () => a.resetBreakables?.(),
      setMood: (k, instant) => a.setMood?.(k, instant),
    };
  }
  return {
    stub: true,
    section: null,
    center: new THREE.Vector3(0, y0, -14),
    radius: 18,
    bossHome: new THREE.Vector3(0, y0 + 3, -37),
    slamZone: [{ minX: -17, maxX: 17, minZ: -33, maxZ: 10 }],
    drops: world.spawnPoints.map((p) => p.clone()),
    sideDoors: [],
    breakables: [],
    setMood() {},
  };
}
function makeBossModel(opts) {
  try {
    if (bossModelModule?.createBossModel) return bossModelModule.createBossModel(opts);
  } catch (e) {
    console.warn("createBossModel failed, using the stub boss:", e?.message);
  }
  return createStubBossModel(opts);
}
function setupFloor3(n) {
  if (n !== 3) {
    boss?.stop();
    boss?.setVisible(false);
    return;
  }
  arenaIndex = bld && world.level?.arena ? bld.sections.findIndex((s) => s.id === world.level.arena.section) : -1;
  arenaDoor = null;
  floor3Time = 0;
  sideIx = dropIx = 0;
  const a = arenaFor(world.level, world.floorY);
  if (world.level?.arena) world.level.onBreak = () => sound("kill-heavy"); // breakable cover goes (FLOOR3.md)
  if (!boss || !bossArena || bossArena.stub !== a.stub || bossArena.raw !== a.raw) {
    boss?.dispose();
    bossArena = a;
    boss = createBoss(T, {
      scene,
      looks,
      arena: a,
      createModel: makeBossModel,
      ground: (x, z, y) => groundAt(x, z, y ?? world.floorY) ?? world.floorY,
      player: () => ({ pos, vel: velocity, alive: state === "combat" && health > 0, evading: dodge > 0 || vaultT > 0 }),
      damagePlayer,
      pushPlayer,
      allies: () => actors.allies,
      hurtAlly: (al, d) => {
        al.hurt = 0.18;
        if (al.temporary) (al.hp -= d) <= 0 && (al.dead = true);
      },
      shake: (k) => (shake = Math.max(shake, k)),
      sound,
      toast,
      hint,
      burst,
      alive: () => actors.enemies.filter((e) => !e.dead && (arenaIndex < 0 || e.section === arenaIndex)).length,
      spawnWave: spawnBossWave,
      onPhase: (p) => {
        if (p > 1) sound("wave");
      },
      onDeath: bossFalls,
    });
  } else boss.stop();
  boss.setVisible(true);
}
// A phase's wave: "drop" from arena.drops (cycled), "side" through a side door.
function spawnBossWave(phase, list) {
  const A = bossArena;
  const specs = list.map((w) => {
    let p = null,
      placed = false,
      mode = w.mode || "hold";
    if (w.via === "side" && A.sideDoors.length && bld) {
      const id = A.sideDoors[sideIx++ % A.sideDoors.length];
      const door = bld.doorById.get(id);
      if (door && !door.isOpen) door.open();
      const sec = bld.sections[arenaIndex];
      const spot = (sec?.raw.anchors?.side || []).find((s) => s[3] === id);
      p = spot ? new THREE.Vector3(spot[0], bld.floorY + (spot[2] || 0), spot[1]) : door ? bld.doorPoint(door) : null;
      placed = !!p;
      mode = w.mode || "advance";
    }
    if (!p) {
      const drops = A.drops.length ? A.drops : [A.center];
      p = drops[dropIx++ % drops.length].clone();
      p.x += (Math.random() - 0.5) * 1.5;
      p.z += (Math.random() - 0.5) * 1.5;
    }
    return { kind: w.kind, x: p.x, z: p.z, y: p.y, section: arenaIndex, mode, placed, delay: w.delay || 0, yaw: Math.atan2(pos.x - p.x, pos.z - p.z) };
  });
  return actors.spawnWave(specs);
}
// The player walked into the arena: the boss wakes. The door behind closes once
// you are T.floor3.closeAfter in (T.floor3.closeDoor).
function enterArena(i) {
  arenaDoor = T.floor3.closeDoor ? bld?.entryDoor(i) : null;
  startBoss();
}
function startBoss() {
  const phase = bossRetryPhase || Math.min(3, Math.max(1, testPhase || +urlArgs.get("phase") || 1));
  const retried = bossRetryPhase > 0;
  bossRetryPhase = 0;
  boss.start(phase);
  if (bossStats.start < 0) bossStats.start = runTime;
  if (retried) boss.delay(T.boss.retryGrace);
  toast(`${T.boss.name}${phase > 1 ? ` / PHASE ${phase}` : ""}`, 3);
  hint("Its face always takes damage. A hand that slammed stays down for a moment: hit it for crits. Red rings mark the next slam: get out. Your squad (Q) cuts a slam that is winding up.", 11);
}
// The boss falls: its defenders go down with it (T.boss.death.killAdds).
function bossFalls() {
  bossStats.end = runTime;
  if (!T.boss.death.killAdds) return;
  for (const e of actors.enemies) {
    if (e.dead) continue;
    const c = actors.hitCenter(e);
    burst(c, 0xffd64b, 10);
    looks.impact(c, "death-" + e.kind);
  }
  actors.clearEnemies();
}
function updateFloor3(dt) {
  floor3Time += dt;
  // the stub arena (no floor3.js level) has no corridor: the fight starts right away
  if (boss && !bld && !boss.active && !boss.done && floor3Time > 1) startBoss();
  if (arenaDoor && arenaDoor.isOpen) {
    const dp = bld.doorPoint(arenaDoor);
    if (bld.sectionAt(pos.x, pos.z, pos.y) === arenaIndex && Math.hypot(pos.x - dp.x, pos.z - dp.z) > T.floor3.closeAfter) {
      arenaDoor.close();
      arenaDoor = null;
      toast("THE DOOR SEALS BEHIND YOU", 2);
      sound("bash");
    }
  }
  if (boss?.done) {
    finishWait += dt;
    if (finishWait > T.boss.death.cardDelay) {
      state = "finish";
      showOverlay("finish");
    }
  }
}
let playerSection = -1; // floor 2: section index the player stands in (building.js)
const beatLog = []; // balance read-out: per beat { floor, id, time, taken }
let beatMark = null;
function worldReady() {
  return floor === 1 && director.done;
}
// HUD detail line: beat n / total, hostiles, and the hold meter.
function beatDetail() {
  const hostiles = actors.alive;
  if (director.done) return floor === 1 ? "Lift powered" : "Ascent secured";
  if (director.index < 0) return "Defenders massing";
  if (director.mode === "sections") {
    // Section n / N · name · awake hostiles (dormant ones are behind closed doors)
    const awake = actors.enemies.filter((e) => !e.dead && !e.dormant).length;
    let line = `Section ${director.index + 1} / ${director.count} · ${director.name} · ${awake} hostile${awake === 1 ? "" : "s"}`;
    if (director.holding) line += ` · HOLD ${Math.floor(director.progress * 100)}%${director.inZone ? "" : " · get in the ring"}`;
    else if (director.pending) line += " · door unlocking";
    else if (director.cleared) line += " · door open";
    return line;
  }
  const head = `Beat ${director.index + 1} / ${director.count} · ${hostiles} hostile${hostiles === 1 ? "" : "s"}`;
  if (!director.holding) return head;
  return `${head} · HOLD ${Math.floor(director.progress * 100)}%${director.inZone ? "" : " · get in the ring"}`;
}
// Balance read-out per section/beat id (floor 2 sections survive retries).
const sectionStats = {};
const statFor = (id) => (sectionStats[`${floor}:${id}`] ??= { time: 0, taken: 0, deaths: 0, kills: 0, squadKills: 0 });
const statId = () => (director.mode === "sections" ? director.front : director.beat?.id);
function encounter(dt) {
  director.update(dt, runTime);
  const id = director.done ? "done" : director.beat?.id ?? "intro";
  if (id !== "done" && id !== "intro") statFor(statId()).time += dt;
  if (id !== beatMark?.id) {
    if (beatMark && beatMark.id !== "intro")
      beatLog.push({ floor: beatMark.floor, id: beatMark.id, time: +(runTime - beatMark.t).toFixed(1), taken: Math.round(combatStats.taken - beatMark.taken) });
    beatMark = { floor, id, t: runTime, taken: combatStats.taken };
  }
  if (floor === 3) return updateFloor3(dt);
  if (!director.done) return;
  if (floor === 1) {
    world.setLiftReady(true);
    const near = pos.distanceTo(world.liftPosition) < 4.5;
    hint(
      near
        ? "E · Ride the lift to floor 02"
        : "Atrium secured. Follow the gold floor line to the lift.",
      0.3,
    );
    return;
  }
  // round 4: floor 2's goal is the express lift to the top floor (T.floor3.on)
  if (T.floor3.on) {
    if (finishWait === 0) toast("FLOOR 02 SECURED / EXPRESS LIFT TO THE TOP", T.floor3.rideDelay + 1);
    finishWait += dt;
    if (finishWait > T.floor3.rideDelay) startLift(3);
    return;
  }
  if (finishWait === 0) toast("FLOOR 02 SECURED / THE CLIMB CONTINUES", T.encounter.completionDelay + 0.5);
  finishWait += dt;
  if (finishWait > T.encounter.completionDelay) {
    state = "finish";
    showOverlay("finish");
  }
}
// The lift ride (lift-ui): cinematic shot from lift.js, eased onto the gameplay camera at the end.
const liftRide = {
  from: new THREE.Vector3(),
  base: new THREE.Vector3(),
  camPos: new THREE.Vector3(),
  camQuat: new THREE.Quaternion(),
  camFov: 60,
  walked: new THREE.Vector3(),
};
const liftEase = (a, b, x) => {
  const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};
// to = 2: the atrium lift (lift-ui's ride). to = 3: floor 2's goal → the top
// floor (arena's ride in lift.js when it is in, else a fade stub, T.floor3.stubRide).
let liftTo = 2;
function startLift(to = 2) {
  liftTo = to;
  if (to === 3) return startRide3();
  state = "lift";
  aimMarker.visible = aimLaser.visible = false;
  phaseTime = 0;
  actors.clear();
  clearPickups();
  clearInput();
  liftRide.from.copy(pos);
  yaw = 0;
  pitch = -0.06;
  crouch = false;
  world.lift.setRiding(true);
  body.position.copy(pos);
  toast("ASCENDING / FLOOR 02", 3);
  sound("lift");
  hint(
    "The fleet is still arriving. This is only the beginning of the climb.",
    6,
  );
}
function startRide3() {
  state = "lift";
  aimMarker.visible = aimLaser.visible = false;
  phaseTime = 0;
  actors.clear();
  clearPickups();
  clearInput();
  crouch = false;
  liftRide.from.copy(pos);
  world.express?.begin(); // arena's express ride (lift.js); a fade stub without it
  toast("ASCENDING / THE TOP FLOOR", 3);
  sound("lift");
  hint("The express lift. One floor left.", 5);
}
// The express ride (lift.js `world.express`, arena): walk into the cab, the cab
// climbs with a cinematic shot, ease onto the gameplay camera, dip to black,
// beginFloor(3) pops the top floor in. Without it: a short fade stub.
function updateRide3(dt) {
  phaseTime += dt;
  const X = world.express;
  const fade = $("fade");
  if (!X) {
    const t = Math.min(1, phaseTime / T.floor3.stubRide);
    pos.y = liftRide.from.y + liftEase(0.1, 0.8, t) * 6;
    body.position.copy(pos);
    playerModel.update(dt, { speed: 0, crouch: false, pitch: 0, heat: 0, firing: 0, dodge: false, time: runTime, hurt: 0 });
    updateCamera(dt);
    if (fade) {
      fade.style.transition = "none";
      fade.style.opacity = liftEase(0.45, 0.8, t);
    }
    if (t >= 1) arriveTop(fade);
    return;
  }
  const C = X.config,
    t = Math.min(1, phaseTime / C.duration);
  const walk = liftEase(0, C.walkTime, phaseTime);
  X.setProgress(liftEase(C.walkTime / C.duration, 0.9, t));
  const base = X.base(liftRide.base);
  const before = liftRide.walked.copy(pos);
  pos.set(THREE.MathUtils.lerp(liftRide.from.x, base.x, walk), base.y, THREE.MathUtils.lerp(liftRide.from.z, base.z, walk));
  const step = before.distanceTo(pos);
  body.position.copy(pos);
  // face out of the cab's front door (+z), the way floor 3 starts
  body.rotation.set(0, THREE.MathUtils.lerp(body.rotation.y, Math.PI, 1 - Math.exp(-dt * 8)), 0);
  body.updateMatrixWorld(true);
  playerModel.update(dt, { speed: walk < 1 ? Math.min(T.player.speed, step / Math.max(dt, 1e-4)) : 0, crouch: false, pitch: 0, heat: 0, firing: 0, dodge: false, time: runTime, hurt: 0 });
  X.shot(t, base, camera);
  const blend = liftEase(C.blendFrom, C.blendTo, t);
  if (blend > 0) {
    liftRide.camPos.copy(camera.position);
    liftRide.camQuat.copy(camera.quaternion);
    liftRide.camFov = camera.fov;
    yaw = Math.PI;
    pitch = -0.06;
    updateCamera(1, true);
    camera.position.lerpVectors(liftRide.camPos, camera.position, blend);
    camera.quaternion.slerpQuaternions(liftRide.camQuat, camera.quaternion, blend);
    camera.fov = THREE.MathUtils.lerp(liftRide.camFov, camera.fov, blend);
    camera.updateProjectionMatrix();
  }
  const far = T.fx.fogFar,
    wide = liftEase(0.2, 0.45, t) * (1 - liftEase(0.72, 0.95, t));
  scene.fog.far = THREE.MathUtils.lerp(far, C.fogFar ?? far, wide);
  if (fade) {
    fade.style.transition = "none";
    fade.style.opacity = Math.max(1 - liftEase(0, C.fadeIn ?? 0.05, t), liftEase(C.fadeOut ?? 0.93, 1, t)); // in from black, out at the end
  }
  if (t >= 1) {
    scene.fog.far = far;
    X.end();
    arriveTop(fade);
  }
}
function arriveTop(fade) {
  sound("arrive");
  beginFloor(3);
  if (fade) {
    fade.style.transition = "opacity 0.9s ease-out";
    fade.style.opacity = 0;
  }
}
function updateLift(dt) {
  if (liftTo === 3) return updateRide3(dt);
  phaseTime += dt;
  const C = T.lift,
    t = Math.min(1, phaseTime / (C?.duration ?? T.encounter.liftDuration)),
    smooth = t * t * (3 - 2 * t),
    lift = world.lift;
  world.setLiftProgress(smooth);
  const base = liftRide.base.set(0, world.floorY + lift.assembly.position.y, -39);
  // the player walks from where they stood onto the platform centre, then rides it
  const walk = liftEase(0, C?.walkTime ?? 0.9, phaseTime);
  const before = liftRide.walked.copy(pos);
  pos.set(
    THREE.MathUtils.lerp(liftRide.from.x, 0, walk),
    base.y,
    THREE.MathUtils.lerp(liftRide.from.z, -39, walk),
  );
  const step = before.distanceTo(pos);
  body.position.copy(pos);
  body.rotation.set(0, THREE.MathUtils.lerp(body.rotation.y, 0, 1 - Math.exp(-dt * 8)), 0);
  body.updateMatrixWorld(true);
  playerModel.update(dt, {
    speed: walk < 1 ? Math.min(T.player.speed, step / Math.max(dt, 1e-4)) : 0,
    crouch: false,
    pitch: 0,
    heat: 0,
    firing: 0,
    dodge: false,
    time: runTime,
    hurt: 0,
  });
  // camera: cinematic shot, then ease onto the gameplay camera before the cut to floor 2
  lift.shot(t, base, camera);
  const blend = liftEase(C?.blendFrom ?? 0.78, C?.blendTo ?? 0.96, t);
  if (blend > 0) {
    liftRide.camPos.copy(camera.position);
    liftRide.camQuat.copy(camera.quaternion);
    liftRide.camFov = camera.fov;
    updateCamera(1, true);
    camera.position.lerpVectors(liftRide.camPos, camera.position, blend);
    camera.quaternion.slerpQuaternions(liftRide.camQuat, camera.quaternion, blend);
    camera.fov = THREE.MathUtils.lerp(liftRide.camFov, camera.fov, blend);
    camera.updateProjectionMatrix();
  }
  // the tower is far bigger than the atrium: let the fog open up during the wide shot
  const far = T.fx.fogFar,
    wide = liftEase(0.2, 0.45, t) * (1 - liftEase(0.72, 0.95, t));
  scene.fog.far = THREE.MathUtils.lerp(far, lift.config.fogFar, wide);
  // dip to black at the end; beginFloor(2) pops the new deck in underneath
  const fade = $("fade");
  if (fade) {
    fade.style.transition = "none";
    fade.style.opacity = liftEase(0.93, 1, t);
  }
  if (t >= 1) {
    lift.setRiding(false);
    scene.fog.far = far;
    sound("arrive");
    beginFloor(2);
    if (fade) {
      fade.style.transition = "opacity 0.9s ease-out";
      fade.style.opacity = 0;
    }
  }
}
function formatTime(t) {
  return `${Math.floor(t / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(t % 60)
    .toString()
    .padStart(2, "0")}`;
}
// HUD writes only when a value changes (perf: an unchanged textContent write still replaces the
// text node and forces a style + layout pass every frame).
const hudCache = new Map();
function setText(id, v) {
  v = String(v);
  if (hudCache.get(id) === v) return;
  hudCache.set(id, v);
  $(id).textContent = v;
}
function setStyle(id, prop, v) {
  const k = id + "." + prop;
  v = String(v);
  if (hudCache.get(k) === v) return;
  hudCache.set(k, v);
  $(id).style[prop] = v;
}
function updateHud() {
  const combat = state === "combat" || state === "dead",
    flying = state === "flight";
  setText("objective", flying
    ? "Reach the headquarters"
    : state === "lift"
      ? "Climb with the swarm"
      : worldReady()
        ? "Atrium secured · board the lift"
        : floor === 1
          ? "Clear the atrium"
          : floor === 3 && boss?.active
            ? boss.dead
              ? "It is falling"
              : "Bring it down"
          : bld
            ? director.holding
              ? "Hold the ring"
              : "Fight through the building"
            : "Secure the next ascent");
  setText("detail", flying
    ? "Bottom entrance / approach corridor"
    : state === "lift"
      ? "Scorer’s files believed to be at the top"
      : floor === 3 && boss?.active
        ? `Phase ${boss.phase} / 3 · ${actors.enemies.filter((e) => !e.dead).length} defenders · face always, hands when down`
        : beatDetail());
  setText("phase", flying
    ? "FLEET APPROACH"
    : state === "lift"
      ? "VERTICAL TRANSIT"
      : `FLOOR 0${floor}`);
  setText("timer", formatTime(runTime));
  $("crosshair").classList.toggle("hidden", !combat);
  $("crosshair").classList.toggle("aim", mouseAim);
  $("crosshair").classList.toggle("hit", hitTime > 0 && !hitBlocked);
  $("crosshair").classList.toggle("blocked", hitTime > 0 && hitBlocked);
  $("crosshair").classList.toggle("onenemy", aimState === "enemy");
  $("crosshair").classList.toggle("cover", aimState === "cover");
  const buffs = [];
  if (runTime < coolantUntil)
    buffs.push(`<span class="buff cool">COOLANT ${Math.ceil(coolantUntil - runTime)}s</span>`);
  if (runTime < overclockUntil)
    buffs.push(`<span class="buff over">OVERCLOCK ${Math.ceil(overclockUntil - runTime)}s</span>`);
  const buffHtml = combat ? buffs.join("") : "";
  if ($("buffs").dataset.h !== buffHtml) {
    $("buffs").dataset.h = buffHtml;
    $("buffs").innerHTML = buffHtml;
  }
  $("vitals").classList.toggle("hidden", !combat);
  $("ability").classList.toggle("hidden", !combat);
  $("controls").classList.toggle("hidden", !combat);
  $("flightmeter").classList.toggle("hidden", !flying);
  setStyle("healthfill", "width", health + "%");
  setText("healthtext", Math.ceil(health));
  setStyle("heatfill", "width", heat + "%");
  setText("heatlabel", overheated
    ? "Cooling"
    : "Heat");
  setStyle("callfill", "width", (actors.ready ? 100 : 100 * (1 - actors.cooldown / T.squad.cooldown)) +
    "%");
  setText("abilitydetail", actors.activeRemaining > 0
      ? `LIVE ${Math.ceil(actors.activeRemaining)}s`
      : actors.ready
        ? "READY"
        : `${Math.ceil(actors.cooldown)}s`);
  setStyle("toast", "opacity", toastTime > 0 ? 1 : 0);
  $("hint").classList.toggle("hidden", hintTime <= 0);
  setStyle("damage", "opacity", damageFlash);
  updateBossBar(combat);
  updateAudio();
}
// Floor 3: the boss bar (marks at 66 % and 33 %; white flicker while it roars).
const bossBar = { shown: null, phase: 0, k: -1, invuln: null };
function updateBossBar(combat) {
  const on = !!(combat && floor === 3 && boss?.active && !boss.done);
  if (on !== bossBar.shown) {
    bossBar.shown = on;
    $("bossbar").classList.toggle("off", !on);
    $("bossname").textContent = T.boss.name;
  }
  if (!boss) return;
  const k = Math.round((boss.hp / boss.maxHp) * 1000) / 10;
  if (k !== bossBar.k) {
    bossBar.k = k;
    $("bossfill").style.width = k + "%";
    $("bossghost").style.width = k + "%";
  }
  if (boss.phase !== bossBar.phase) {
    bossBar.phase = boss.phase;
    $("bossbar").dataset.phase = boss.phase;
    $("bossphase").textContent = `PHASE ${boss.phase} / 3`;
  }
  if (boss.invulnerable !== bossBar.invuln) {
    bossBar.invuln = boss.invulnerable;
    $("bossbar").classList.toggle("invuln", boss.invulnerable);
  }
}
function tick(dt) {
  if (!paused && ["flight", "combat", "lift"].includes(state)) {
    runTime += dt;
    toastTime -= dt;
    hintTime -= dt;
    hitTime -= dt;
    shake = Math.max(0, shake - dt * 0.7);
    damageFlash = Math.max(0, damageFlash - dt * 1.4);
    if (state === "flight") {
      const result = flight.update(dt, keys, camera, { fire: mouseFire, sound });
      stats.collisions = result.collisions;
      $("flightfill").style.width = result.progress * 100 + "%";
      if (result.done) {
        beginFloor(1);
      }
    } else if (state === "combat") {
      // Hit-stop: a kill slows the combat simulation for a beat (T.hitStop).
      const real = dt;
      if (hitStop > 0) {
        hitStop -= real;
        dt *= T.hitStop.scale;
      }
      fireCooldown -= dt;
      updateHeat(dt);
      updatePlayer(dt);
      updateCamera(real);
      body.updateMatrixWorld(true);
      if (mouseFire) fire();
      actors.update(dt, runTime);
      if (floor === 3 && boss) boss.update(dt, runTime);
      updatePickups(dt);
      updateAim(dt);
      if (state === "combat") encounter(dt);
    } else updateLift(dt);
    world.update(dt, runTime, camera);
    updateFx(dt);
    looks.update(dt);
  }
  updateHud();
}
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  tick(dt);
  if (gfx.grade) gfx.grade.uniforms.hurt.value = Math.min(1, damageFlash);
  gfx.render(scene, camera);
  if (!disposed) raf = requestAnimationFrame(frame);
}
on(window, "resize", () => {
  gfx.resize();
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
// The start screen previews the actual armada; no separate splash image.
world.root.visible = false;
flight.start();
flight.update(0, new Set(), camera);
raf = requestAnimationFrame(frame);
showOverlay("menu"); // app: the title card replaces the loading card
// Deterministic browser smoke hooks are opt-in and absent from normal play (app: opts.debug, was ?test).
const hooks = {
    T,
    gfx,
    renderer,
    scene,
    camera,
    world,
    actors,
    pos,
    keys,
    start: startRun,
    beginFloor,
    callSquad,
    startLift,
    stats,
    audio,
    finishCard() {
      state = "finish";
      showOverlay("finish");
    },
    applyLoot,
    pickups,
    tick,
    fire,
    move,
    blocked,
    damagePlayer,
    // combat redesign hooks (smoke.mjs bot, balance check)
    encounter: director,
    looks,
    free,
    get balance() {
      const sections = Object.fromEntries(Object.entries(sectionStats).map(([k, v]) => [k, { ...v, time: +v.time.toFixed(1), taken: Math.round(v.taken) }]));
      return { taken: Math.round(combatStats.taken), deaths: combatStats.deaths || 0, beats: beatLog.slice(), sections };
    },
    get aim() {
      return aimState;
    },
    get playerState() {
      return { crouch, vaulting: vaultT > 0, venting, ventJam, ventBuff: runTime < ventBuffUntil, heat, overheated, knock: knock.length() };
    },
    get snapshot() {
      return {
        state,
        paused,
        floor,
        beat: director.done ? "done" : director.beat?.id ?? null,
        beatIndex: director.index,
        holding: director.holding,
        encounterDone: director.done,
        health,
        heat,
        overheated,
        venting: venting > 0,
        runTime,
        stats: { ...stats },
        ready: actors.ready,
        cooldown: actors.cooldown,
        enemies: actors.enemies.filter((e) => !e.dead && e.hp > 0).length,
        pos: pos.toArray(),
        drawCalls: renderer.info.render.calls,
      };
    },
    aimAt(point) {
      const d = new THREE.Vector3(...point).sub(camera.position).normalize();
      yaw = Math.atan2(-d.x, -d.z);
      pitch = Math.asin(d.y);
      mouseAim = true;
      updateCamera(0.1, true);
    },
    setInput({ fire: f, aim: a, crouched: c } = {}) {
      if (f !== undefined) mouseFire = f;
      if (a !== undefined) mouseAim = a;
      if (c !== undefined) crouch = c;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    setPose(x, z, y) {
      pos.set(x, y ?? (floor - 1) * T.world.floorHeight, z);
      if (bld) pos.y = groundAt(x, z, pos.y) ?? pos.y;
      updateCamera(1, true);
    },
    // floor 2 (building): the adapter, routes, the player's section, ground
    get building() {
      return bld;
    },
    get section() {
      return playerSection;
    },
    ground: (x, z, y) => groundAt(x, z, y),
    route: (a, b) => bld?.path(a, b) ?? null,
    // floor 3 (round 4): the boss (boss.js), its arena, per-phase balance read-out
    get boss() {
      return boss;
    },
    get arena() {
      return bossArena;
    },
    get arenaIndex() {
      return arenaIndex;
    },
    startBoss,
    // floor 3 straight into the arena (phase 1..3), like ?floor=3&at=arena&phase=n
    toArena(phase = 1) {
      testArena = true;
      testPhase = phase;
      beginFloor(3);
      testArena = false;
    },
    get bossBalance() {
      if (!boss) return null;
      const st = boss.stats;
      return {
        phaseTime: st.phaseTime.slice(1).map((t) => +t.toFixed(1)),
        deaths: bossStats.deaths.slice(1),
        damage: Math.round(st.damage),
        crit: Math.round(st.crit),
        squad: Math.round(st.squad),
        healed: Math.round(st.healed),
        moves: st.slams,
        interrupts: st.interrupts,
        fight: bossStats.start >= 0 ? +(((bossStats.end >= 0 ? bossStats.end : runTime) - bossStats.start)).toFixed(1) : 0,
      };
    },
    get yaw() {
      return yaw;
    },
    get cameraClear() {
      // the camera is not inside a collider and sees the player's chest
      const eye = pos.clone().add(new THREE.Vector3(0, playerHeight * 0.6, 0));
      const inside = world.colliders.some((c) => !c.disabled && camera.position.x > c.minX && camera.position.x < c.maxX && camera.position.z > c.minZ && camera.position.z < c.maxZ && camera.position.y > c.baseY && camera.position.y < c.baseY + c.height);
      return !inside && !blocked(camera.position, eye);
    },
  };
if (opts.debug) {
  window.__ascent = hooks;
  cleanup.push(() => {
    if (window.__ascent === hooks) delete window.__ascent;
  });
}
}
}
