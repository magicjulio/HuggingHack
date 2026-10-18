# ASCENT (Ending 2) freight lift: the platform KAM1196A rides from the arrival atrium up the tower face, and its guide rail.
# blender -b --factory-startup -P design/3d/end2/lift/lift.py [-- rail]
#   (default) -> end2-lift.glb       the open freight platform (origin = deck centre, deck top at y = 0, ~7.3 m square)
#   rail      -> end2-lift-rail.glb  one 6 m guide-rail module (`rail_6m`) + the 18 m wall bracket (`rail_bracket`) for instancing
# Axes: Blender Z up, FRONT (the open boarding side) = -Y = glTF +Z = three.js +z (toward the atrium).
# The rail side is Blender +Y = three.js -z. The platform clamps hold rails at x = +-4.25, three z = -42.7 (platform centre z = -39).
# Control nodes (find by name in three.js):
#   safety_bar          the front gate bar. Exported RAISED (open); lower it by 0.95 m when the ride starts.
#   beacon_fl/fr/bl/br  the four HF yellow beacons (empties at the dome centre); `beacon_shade_*` is the half-shade, spin it on Y.
#   materials `lift_strip` (edge light strips: orange = locked, mint = ready), `lift_beacon` (HF yellow dome),
#   `lift_ready_led` (console lamp), `lift_underglow`, `lift_screen`.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import numpy as np
import bmesh, math
from math import pi, sin, cos, radians

OUT = os.path.dirname(os.path.abspath(__file__))
RAIL = "rail" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
NAME = "end2-lift-rail" if RAIL else "end2-lift"
kit.reset(NAME, OUT)
N = kit.N

# ------------------------------------------------------------------------------------------------ textures
def tread_surface(name, paint, seed):
    """Diamond-tread plate, worn paint, oil stains. Tile = 1.25 m (UVS 0.8)."""
    grime = fbm(seed + 1, 3, 5)
    drip = fbm(seed + 2, 5, 6, streak=8)
    chips = fbm(seed + 3, 14, 6)
    rustn = fbm(seed + 4, 16, 5)
    speck = fbm(seed + 5, 64, 3)
    stain = fbm(seed + 6, 4, 5)
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    n = 14
    a = np.abs(((u * n) % 1.0) - 0.5) + np.abs(((v * n) % 1.0) - 0.5)
    lug = sstep(0.40, 0.22, a)
    # alternate lug orientation per cell so it reads as classic tread, not a dot grid
    cell = (np.floor(u * n) + np.floor(v * n)) % 2
    bar = np.where(cell > 0, sstep(0.16, 0.08, np.abs(((u * n) % 1.0) - 0.5)) * sstep(0.45, 0.30, np.abs(((v * n) % 1.0) - 0.5)),
                   sstep(0.16, 0.08, np.abs(((v * n) % 1.0) - 0.5)) * sstep(0.45, 0.30, np.abs(((u * n) % 1.0) - 0.5)))
    tread = np.clip(bar, 0, 1)
    chipm = sstep(0.70, 0.74, chips * 0.7 + rustn * 0.3) * 0.9
    rustm = np.clip(chipm + sstep(0.72, 0.95, drip) * 0.35, 0, 1)
    rust = srgb("#24100a")[None, None] * (1 - rustn[..., None]) + srgb("#7a3816")[None, None] * rustn[..., None]
    col = srgb(paint)[None, None] * (0.62 + 0.55 * grime[..., None])
    col = col * (1 - 0.55 * sstep(0.55, 0.85, stain))[..., None]          # oil
    col = col * (0.9 + 0.2 * speck)[..., None]
    col = col * (1 + 0.5 * tread)[..., None]                              # lugs catch the wear: lighter bare metal on top
    alb = col * (1 - rustm[..., None]) + rust * rustm[..., None]
    # plate seams: one per tile edge
    t = np.arange(N) / N
    line = ((t < 0.010) | (t > 0.990)).astype(float)
    seam = np.maximum(line[:, None], line[None, :])
    alb = alb * (1 - 0.65 * seam)[..., None]
    r = np.clip(0.5 + 0.2 * grime - 0.15 * tread - 0.1 * speck + 0.3 * rustm - 0.25 * sstep(0.55, 0.85, stain), 0.05, 1)
    m = 0.7 * (1 - rustm)
    orm = np.stack([np.ones((N, N)), r, m], axis=2)
    hgt = 1.0 * tread + 0.6 * fbm(seed + 7, 5, 4) - 1.2 * chipm - 1.5 * seam + 0.1 * speck
    return save(name + "_albedo", alb), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 5.0), False)


def hazard_surface(name, seed, yellow="#d6a210", black="#14181e"):
    """Diagonal hazard stripes (3 periods per 1.25 m tile), chipped and dirty."""
    grime = fbm(seed + 1, 3, 5)
    chips = fbm(seed + 3, 14, 6)
    rustn = fbm(seed + 4, 16, 5)
    speck = fbm(seed + 5, 64, 3)
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    s = ((u + v) * 3.0) % 1.0
    stripe = sstep(0.48, 0.52, s) * sstep(1.0, 0.96, s) + 0 * s
    stripe = (s > 0.5).astype(float)
    chipm = sstep(0.66, 0.70, chips * 0.7 + rustn * 0.3)
    col = srgb(yellow)[None, None] * stripe[..., None] + srgb(black)[None, None] * (1 - stripe[..., None])
    col = col * (0.55 + 0.6 * grime[..., None]) * (0.9 + 0.2 * speck[..., None])
    rust = srgb("#3a1a0c")[None, None] * (1 - rustn[..., None]) + srgb("#8a4a1c")[None, None] * rustn[..., None]
    alb = col * (1 - chipm[..., None]) + rust * chipm[..., None]
    r = np.clip(0.55 + 0.25 * grime + 0.25 * chipm, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.1 * (1 - chipm)], axis=2)
    hgt = 0.3 * fbm(seed + 6, 5, 4) - 1.0 * chipm + 0.1 * speck
    return save(name + "_albedo", alb), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 4.0), False)


# ------------------------------------------------------------------------------------------------ materials
M = dict(
    tread=tmat("lift_tread", tread_surface("lift_tread", "#2a313a", 301)),
    gun=tmat("lift_gunmetal", surface("lift_gunmetal", "#262b33", 311, chip=0.72, rust_amt=0.55, metal=0.75, rough=0.42, dirt=0.4)),
    steel=tmat("lift_steel", surface("lift_steel", "#4a4f57", 312, chip=0.78, rust_amt=0.3, metal=0.9, rough=0.34, dirt=0.3)),
    frame=tmat("lift_frame", surface("lift_frame", "#c28a14", 313, chip=0.66, rust_amt=0.8, metal=0.3, rough=0.55, dirt=0.5, panel=1)),  # HF-ish safety yellow, heavily weathered
    panel=tmat("lift_panel", surface("lift_panel", "#8c8a80", 314, chip=0.7, rust_amt=0.6, dirt=0.55, panel=2)),
    hazard=tmat("lift_hazard", hazard_surface("lift_hazard", 321)),
    trim=mat("lift_trim", lin("#8a94a3"), 1.0, 0.25),
    rubber=mat("lift_rubber", lin("#0e0f11"), 0.0, 0.85),
    ink=mat("lift_ink", lin("#141210"), 0.0, 0.7),
    stencil=mat("lift_stencil", lin("#c9b25a"), 0.0, 0.7),
    red=mat("lift_red", lin("#a01820"), 0.1, 0.5),
    strip=mat("lift_strip", lin("#2a1608"), 0.0, 0.35, em=lin("#ff9d00"), strength=2.2),
    beacon=mat("lift_beacon", lin("#2a2004"), 0.0, 0.25, em=lin("#ffd21e"), strength=3.2),
    ready=mat("lift_ready_led", lin("#1a1004"), 0.0, 0.3, em=lin("#ff9d00"), strength=2.5),
    glowg=mat("lift_led_green", lin("#04140a"), 0.0, 0.3, em=lin("#39ff9c"), strength=2.5),
    under=mat("lift_underglow", lin("#2a1608"), 0.0, 0.35, em=lin("#ffb020"), strength=2.0),
    screen=mat("lift_screen", lin("#02080c"), 0.0, 0.65, em=lin("#38d8ff"), strength=0.5),
    lamp=mat("lift_lamp", lin("#fff2d0"), 0.0, 0.3, em=lin("#fff0c8"), strength=3.0),
)
root = empty(NAME, None)
S = 3.65                                   # half-width of the deck


def bolts(parent, pts, r=0.022, h=0.016, m=None, axis="Z"):
    for i, p in enumerate(pts):
        cyl(f"bolt_{i}", p, r, h, m or M["trim"], parent, axis, 5, 0)


# ================================================================================================ RAIL MODULE
if RAIL:
    # Rail section: x 0.35 (width) by y 0.5 (depth), 6 m along Z. The platform clamp wraps it.
    L = 6.0
    rail = empty("rail_6m", root)
    box("spine", (0, 0, L / 2), (0.14, 0.50, L), M["steel"], rail, 0.012, 2)
    for s in (-1, 1):
        box("flange", (s * 0.105, 0.0, L / 2), (0.14, 0.50, L - 0.02), M["steel"], rail, 0.012, 2)
        box("flange_lip", (s * 0.175, 0.0, L / 2), (0.035, 0.50, L - 0.02), M["trim"], rail, 0.006, 1)
    box("web_front", (0, -0.235, L / 2), (0.30, 0.03, L - 0.02), M["gun"], rail, 0.006, 1)
    # gold marker strip (HF warm) and mint run light on the front face, 2 x 3 m dashes so the segment seams read
    for i in range(2):
        box("gold_strip", (-0.075, -0.255, 1.5 + i * 3.0), (0.035, 0.012, 2.6), M["strip"], rail, 0)
        box("mint_strip", (0.075, -0.255, 1.5 + i * 3.0), (0.035, 0.012, 2.6), M["glowg"], rail, 0)
    # rack on the inner face (the drive pinions bite here): 48 teeth, 0.125 pitch
    for k in range(24):
        for s in (-1, 1):
            box("tooth", (s * 0.21, 0.0, 0.125 + k * 0.25), (0.03, 0.30, 0.1), M["trim"], rail, 0, 1)
    # joint plates + bolts at both ends
    for z in (0.03, L - 0.03):
        box("joint_plate", (0, 0.0, z), (0.46, 0.60, 0.07), M["frame"], rail, 0.01, 2)
        bolts(rail, [(sx * 0.17, sy * 0.22, z) for sx in (-1, 1) for sy in (-1, 1)], 0.02, 0.1, None, "Y")
    # wall bracket (one per 18 m): arm to the cross-brace that sits 5.3 m behind the rail
    br = empty("rail_bracket", root, (0, 0, 0))
    box("br_arm_a", (0, 2.7, 0.0), (0.22, 5.4, 0.22), M["frame"], br, 0.012, 2)
    box("br_arm_b", (0, 2.7, 0.9), (0.14, 5.0, 0.14), M["steel"], br, 0.008, 1)
    box("br_diag", (0, 1.6, 0.5), (0.12, 3.0, 0.12), M["steel"], br, 0.008, 1, rot=(radians(24), 0, 0))
    box("br_plate", (0, 5.35, 0.3), (0.5, 0.1, 1.1), M["frame"], br, 0.01, 2)
    bolts(br, [(sx * 0.18, 5.28, 0.3 + sz * 0.42) for sx in (-1, 1) for sz in (-1, 1)], 0.03, 0.06, None, "Y")
    # preview + export
    kit.stage((0, 0, 1.5), (-1.6, -2.4, 2.0), lens=45, res=(960, 960))
    for o in list(kit.sc.objects):
        if o.name in ("_wall", "_floor"):
            bpy.data.objects.remove(o)
    br.location = (0.6, 0, 2.6)
    kit.render(os.path.join(OUT, "previews", "lift-rail.png"))
    br.location = (0, 0, 0)
    kit.export(root, os.path.join(OUT, "end2-lift-rail.glb"), os.path.join(OUT, "lift-rail.blend"))
    raise SystemExit

# ================================================================================================ PLATFORM
# ---------------------------------------------------------------- deck
DECK = box("deck_plate", (0, 0, -0.07), (2 * S, 2 * S, 0.14), M["tread"], root, 0.012, 2)
# hazard band inside the edge, 0.46 m wide, as four strips
HB = 0.46
for nm, c, sz in (("hz_front", (0, -(S - HB / 2 - 0.12), 0.004), (2 * S - 0.24, HB, 0.008)),
                  ("hz_back", (0, (S - HB / 2 - 0.12), 0.004), (2 * S - 0.24, HB, 0.008)),
                  ("hz_left", (-(S - HB / 2 - 0.12), 0, 0.004), (HB, 2 * S - 2 * HB - 0.48, 0.008)),
                  ("hz_right", ((S - HB / 2 - 0.12), 0, 0.004), (HB, 2 * S - 2 * HB - 0.48, 0.008))):
    box(nm, c, sz, M["hazard"], root, 0.002, 1)
# kick plates: raised lip around the deck (open at the front gate)
KP = 0.13
for s in (-1, 1):
    box("kick_side", (s * (S - 0.045), 0, KP / 2), (0.09, 2 * S, KP), M["gun"], root, 0.012, 2)
box("kick_back", (0, S - 0.045, KP / 2), (2 * S, 0.09, KP), M["gun"], root, 0.012, 2)
for s in (-1, 1):
    box("kick_front", (s * 2.55, -(S - 0.045), KP / 2), (2.3, 0.09, KP), M["gun"], root, 0.012, 2)
# edge light strips along the outside of the kick plates (state colour)
for s in (-1, 1):
    box("strip_side", (s * (S - 0.092), 0, 0.075), (0.012, 2 * S - 0.4, 0.03), M["strip"], root, 0)
box("strip_back", (0, S - 0.092, 0.075), (2 * S - 0.4, 0.012, 0.03), M["strip"], root, 0)
for s in (-1, 1):
    box("strip_front", (s * 2.55, -(S - 0.092), 0.075), (2.0, 0.012, 0.03), M["strip"], root, 0)
# deck stencils (painted, no glow)
text("stencil_ascent", "ASCENT / FREIGHT 02", 0.5, (0, 0.95, 0.006), M["stencil"], root, rot=(0, 0, 0), spacing=1.1, font=MONO, extrude=0.0)
text("stencil_load", "MAX LOAD 40 T / NO STANDING UNDER", 0.16, (0, 1.55, 0.006), M["stencil"], root, rot=(0, 0, 0), font=MONO, extrude=0.0)
# tie-down eyelets
for i, (x, y) in enumerate(((-3.0, -1.4), (-3.0, 1.4), (3.0, -1.4), (3.0, 1.4), (-1.9, 3.0), (1.9, 3.0))):
    torus(f"eyelet_{i}", (x, y, 0.025), 0.06, 0.012, M["trim"], root, "Z", 16, 5)
    cyl(f"eyelet_base_{i}", (x, y, 0.006), 0.085, 0.014, M["steel"], root, "Z", 12, 0.002)
# deck seam rivets
rv = []
for x in (-2.5, -1.25, 0, 1.25, 2.5):
    for y in (-3.05, 3.05):
        rv.append((x, y, 0.012))
bolts(root, rv, 0.018, 0.014, M["trim"], "Z")

# ---------------------------------------------------------------- underside structure (what the wide shots see from below and the skirt always shows)
SK_H = 0.62
box("skirt_front", (0, -(S - 0.05), -0.14 - SK_H / 2), (2 * S, 0.1, SK_H), M["panel"], root, 0.014, 2)
box("skirt_back", (0, (S - 0.05), -0.14 - SK_H / 2), (2 * S, 0.1, SK_H), M["panel"], root, 0.014, 2)
for s in (-1, 1):
    box("skirt_side", (s * (S - 0.05), 0, -0.14 - SK_H / 2), (0.1, 2 * S, SK_H), M["panel"], root, 0.014, 2)
box("skirt_cap", (0, -(S - 0.02), -0.14 - SK_H - 0.02), (2 * S - 0.1, 0.06, 0.05), M["steel"], root, 0.01, 1)
# hazard band on the front skirt bottom
box("skirt_hazard", (0, -(S + 0.003), -0.14 - SK_H + 0.07), (2 * S - 0.2, 0.01, 0.12), M["hazard"], root, 0.001, 1)
# girders: 3 longitudinal I-beams + cross beams below the deck
for x in (-2.2, 0.0, 2.2):
    box("girder_web", (x, 0, -0.14 - 0.40), (0.07, 2 * S - 0.3, 0.52), M["frame"], root, 0.008, 1)
    for z in (-0.14 - 0.14, -0.14 - 0.66):
        box("girder_flange", (x, 0, z), (0.34, 2 * S - 0.3, 0.07), M["frame"], root, 0.01, 1)
for y in (-2.7, -1.35, 0, 1.35, 2.7):
    box("cross_beam", (0, y, -0.14 - 0.74), (2 * S - 0.4, 0.2, 0.1), M["steel"], root, 0.01, 1)
# bolt rows on the skirt
bolts(root, [(x, -(S + 0.004), -0.14 - 0.12) for x in np.linspace(-3.3, 3.3, 14)], 0.026, 0.014, M["trim"], "Y")
bolts(root, [(x, -(S + 0.004), -0.14 - 0.46) for x in np.linspace(-3.3, 3.3, 14)], 0.026, 0.014, M["trim"], "Y")
# four hydraulic struts / dampers under the corners
for sx in (-1, 1):
    for sy in (-1, 1):
        cx, cy = sx * 3.0, sy * 3.0
        cyl("damper_sleeve", (cx, cy, -0.14 - 0.52), 0.11, 0.8, M["gun"], root, "Z", 14, 0.008)
        cyl("damper_rod", (cx, cy, -0.14 - 1.12), 0.055, 0.7, M["trim"], root, "Z", 10, 0.002)
        cyl("damper_foot", (cx, cy, -0.14 - 1.5), 0.14, 0.08, M["steel"], root, "Z", 12, 0.006)
# under-glow strips + two work-light panels (HF warm light on the shaft below)
for s in (-1, 1):
    box("under_strip", (s * 1.1, 0, -0.14 - 0.78), (0.08, 2 * S - 1.0, 0.012), M["under"], root, 0)
box("under_strip_f", (0, -2.2, -0.14 - 0.79), (2.2, 0.08, 0.012), M["under"], root, 0)
box("under_strip_b", (0, 2.2, -0.14 - 0.79), (2.2, 0.08, 0.012), M["under"], root, 0)

# ---------------------------------------------------------------- guard rails: both sides + the back (a heavy mesh fence), open front gate
POST_H = 1.18
ys = [-3.0, -1.5, 0.0, 1.5, 3.0]
for s in (-1, 1):
    x = s * (S - 0.12)
    for i, y in enumerate(ys):
        box("post", (x, y, 0.13 + POST_H / 2), (0.08, 0.08, POST_H), M["frame"], root, 0.008, 2)
        box("post_foot", (x, y, 0.17), (0.16, 0.16, 0.06), M["steel"], root, 0.008, 1)
    for z, r in ((POST_H + 0.07, 0.034), (0.72, 0.026), (0.4, 0.026)):
        cyl("rail_tube", (x, 0, z), r, 2 * S - 0.4, M["frame"], root, "Y", 10, 0)
    # kickplate with hazard sections between posts 1-2 and 3-4
    for a, b in ((-3.0, -1.5), (0.0, 1.5)):
        box("rail_hz", (x + s * 0.045, (a + b) / 2, 0.52), (0.012, (b - a) - 0.2, 0.22), M["hazard"], root, 0.001, 1)
# back fence: posts + mesh panel + diagonal bracing
for x in (-3.3, -2.2, -1.1, 0.0, 1.1, 2.2, 3.3):
    box("fence_post", (x, S - 0.1, 0.13 + 1.1), (0.07, 0.07, 2.2), M["frame"], root, 0.008, 2)
box("fence_top", (0, S - 0.1, 2.38), (2 * S - 0.2, 0.09, 0.09), M["frame"], root, 0.01, 2)
box("fence_mid", (0, S - 0.1, 1.2), (2 * S - 0.2, 0.07, 0.07), M["frame"], root, 0.008, 2)
for i in range(13):
    for k, (z0, z1) in enumerate(((0.2, 1.2), (1.2, 2.38))):
        x = -3.3 + i * 0.55
        box("fence_wire", (x, S - 0.12, (z0 + z1) / 2), (0.012, 0.012, z1 - z0), M["steel"], root, 0)
for k in range(2):
    for z0, z1 in ((0.2, 1.2), (1.2, 2.38)):
        for i in range(0, 12, 3):
            x0 = -3.3 + i * 0.55
            box("fence_diag", (x0 + 0.825, S - 0.115, (z0 + z1) / 2), (0.014, 0.012, math.hypot(1.65, z1 - z0)), M["steel"], root, 0,
                rot=(0, math.atan2(z1 - z0, 1.65) * (1 if (i // 3 + k) % 2 else -1), 0))
# load-limit sign on the fence
box("sign_plate", (-2.2, S - 0.16, 1.7), (0.9, 0.03, 0.55), M["panel"], root, 0.006, 1)
box("sign_hz", (-2.2, S - 0.178, 1.98), (0.9, 0.012, 0.1), M["hazard"], root, 0)
text("sign_t1", "LIFT 02 / UP ONLY", 0.075, (-2.2, S - 0.182, 1.78), M["ink"], root, font=MONO, rot=(radians(-90), 0, radians(180)), extrude=0.0)
text("sign_t2", "KEEP CLEAR OF RAILS", 0.055, (-2.2, S - 0.182, 1.62), M["ink"], root, font=MONO, rot=(radians(-90), 0, radians(180)), extrude=0.0)

# ---------------------------------------------------------------- front gate: two posts and a safety bar (exported raised)
for s in (-1, 1):
    x = s * 1.38
    box("gate_post", (x, -(S - 0.12), 0.13 + 1.2), (0.12, 0.12, 2.4), M["frame"], root, 0.01, 2)
    box("gate_post_foot", (x, -(S - 0.12), 0.18), (0.26, 0.26, 0.08), M["steel"], root, 0.01, 1)
    box("gate_post_cap", (x, -(S - 0.12), 2.56), (0.2, 0.2, 0.06), M["steel"], root, 0.008, 1)
    box("gate_lamp", (x, -(S - 0.185), 2.15), (0.07, 0.025, 0.16), M["strip"], root, 0)
    box("gate_rail", (x, -(S - 0.185), 1.3), (0.04, 0.02, 1.4), M["hazard"], root, 0.001, 1)
bar = empty("safety_bar", root, (0, -(S - 0.12), 2.0))      # raised position (open); the ride lowers it by 0.95
cyl("bar_tube", (0, 0, 0), 0.05, 2.76, M["steel"], bar, "X", 12, 0)
box("bar_hazard", (0, 0, 0), (2.7, 0.14, 0.14), M["hazard"], bar, 0.006, 1)
for s in (-1, 1):
    box("bar_clamp", (s * 1.38, 0, 0), (0.2, 0.2, 0.2), M["gun"], bar, 0.01, 2)
# front corner posts (low, with the chain eyes)
for s in (-1, 1):
    box("front_post", (s * (S - 0.12), -(S - 0.12), 0.13 + POST_H / 2), (0.09, 0.09, POST_H), M["frame"], root, 0.008, 2)
    box("front_post_foot", (s * (S - 0.12), -(S - 0.12), 0.17), (0.18, 0.18, 0.06), M["steel"], root, 0.008, 1)

# ---------------------------------------------------------------- beacons: four posts at the corners, HF yellow
for tag, sx, sy in (("fl", -1, -1), ("fr", 1, -1), ("bl", -1, 1), ("br", 1, 1)):
    x, y = sx * (S - 0.2), sy * (S - 0.2)
    cyl(f"beacon_mast_{tag}", (x, y, 0.13 + 1.25), 0.05, 2.5, M["frame"], root, "Z", 8, 0)
    cyl(f"beacon_base_{tag}", (x, y, 2.66), 0.12, 0.12, M["steel"], root, "Z", 12, 0.008)
    b = empty(f"beacon_{tag}", root, (x, y, 2.86))
    cyl(f"beacon_dome_{tag}", (0, 0, 0), 0.11, 0.26, M["beacon"], b, "Z", 14, 0.01, r2=0.08)
    cyl(f"beacon_cap_{tag}", (0, 0, 0.15), 0.1, 0.05, M["steel"], b, "Z", 12, 0.006)
    sh = empty(f"beacon_shade_{tag}", b, (0, 0, 0))
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=10, radius1=0.135, radius2=0.115, depth=0.27)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x < -0.001], context="VERTS")
    mesh_obj(f"shade_mesh_{tag}", bm, M["gun"], sh, uv=False)
    for a in range(4):
        ang = a * pi / 2 + pi / 4
        box(f"cage_{tag}_{a}", (cos(ang) * 0.14, sin(ang) * 0.14, 0), (0.015, 0.015, 0.3), M["steel"], b, 0)
    # a work lamp on the inner side of each mast, pointing across the deck
    box(f"worklamp_{tag}", (x - sx * 0.1, y - sy * 0.1, 1.9), (0.16, 0.16, 0.12), M["gun"], root, 0.01, 1)
    box(f"worklamp_lens_{tag}", (x - sx * 0.17, y - sy * 0.17, 1.9), (0.04, 0.04, 0.09), M["lamp"], root, 0)

# ---------------------------------------------------------------- guide clamps on the two rails: yoke + rollers + drive housing + brake
RX, RY = 4.25, S + 0.05                    # rail axis relative to the platform centre (world rails: x +-4.25, z -42.7 = platform z -39 - 3.7)
for s in (-1, 1):
    c = empty("clamp_" + ("r" if s > 0 else "l"), root, (s * RX, RY, 0.0))
    # outrigger arms from the deck frame to the carriage (top + bottom)
    for z in (-0.5, 0.7):
        box("arm", (-s * 0.35, -0.12, z), (0.7 + 0.1, 0.3, 0.2), M["frame"], c, 0.012, 2)
    box("arm_gusset", (-s * 0.3, -0.12, 0.1), (0.5, 0.25, 1.4), M["steel"], c, 0.012, 2)
    # carriage yoke: back plate behind the rail + two cheeks beside it
    box("yoke_back", (0, 0.40, 0.5), (0.80, 0.08, 2.4), M["gun"], c, 0.014, 2)
    for t in (-1, 1):
        box("yoke_cheek", (t * 0.30, 0.04, 0.5), (0.1, 0.78, 2.4), M["gun"], c, 0.014, 2)
    box("yoke_front", (0, -0.34, 0.5), (0.80, 0.07, 0.34), M["gun"], c, 0.012, 2)     # closes the front low: the rail slides through
    box("yoke_front_top", (0, -0.34, 1.5), (0.80, 0.07, 0.34), M["gun"], c, 0.012, 2)
    # rollers: 3 per face on the front cheek positions
    for z in (-0.4, 0.5, 1.4):
        for t in (-1, 1):
            cyl("roller", (t * 0.22, -0.12, z), 0.085, 0.07, M["rubber"], c, "X", 14, 0.004)
            cyl("roller_hub", (t * 0.22, -0.12, z), 0.04, 0.09, M["trim"], c, "X", 8, 0)
        cyl("roller_back", (0, 0.31, z), 0.085, 0.3, M["rubber"], c, "Y", 14, 0.004)
    # drive housing (motor + gearbox) on the outside, warning hazard on its face
    box("drive_box", (s * 0.62, 0.15, 0.55), (0.5, 0.62, 1.2), M["frame"], c, 0.02, 2)
    box("drive_hazard", (s * 0.62, -0.17, 0.2), (0.44, 0.012, 0.18), M["hazard"], c, 0.001, 1)
    cyl("motor", (s * 0.62, 0.15, 1.5), 0.2, 0.5, M["gun"], c, "Z", 16, 0.012)
    for z in np.linspace(1.3, 1.7, 4):
        torus("motor_fin", (s * 0.62, 0.15, z), 0.2, 0.012, M["steel"], c, "Z", 16, 4)
    box("drive_led", (s * 0.62, -0.17, 0.65), (0.05, 0.012, 0.05), M["glowg"], c, 0)
    bolts(c, [(s * 0.62 + dx, -0.168, 0.9 + dz) for dx in (-0.18, 0.18) for dz in (-0.2, 0.2)], 0.022, 0.016, M["trim"], "Y")
    # brake calipers (red) at the low end
    box("brake", (s * 0.35, -0.38, -0.45), (0.28, 0.1, 0.2), M["red"], c, 0.01, 2)
    # hoist cable lugs and a braided cable going up 1.2 m
    cyl("lug", (0, 0.1, 1.82), 0.1, 0.08, M["steel"], c, "Z", 10, 0.006)
    wire("cable", [(0, 0.1, 1.86), (0.04, 0.12, 2.6), (0, 0.1, 3.4)], 0.028, M["rubber"], c)
    # warning plate on the cheek
    box("clamp_plate", (s * 0.35, -0.35, 0.5), (0.3, 0.012, 0.28), M["stencil"], c, 0)
    text("clamp_text", "CLAMP 0" + ("2" if s > 0 else "1"), 0.045, (s * 0.35, -0.358, 0.5), M["ink"], c, font=MONO)

# ---------------------------------------------------------------- control pedestal at the front-right
cp = empty("console", root, (2.75, -2.2, 0))
box("ped_base", (0, 0, 0.55), (0.62, 0.5, 1.1), M["gun"], cp, 0.015, 2)
box("ped_foot", (0, 0, 0.04), (0.74, 0.62, 0.08), M["steel"], cp, 0.01, 1)
box("ped_front", (0, -0.255, 0.45), (0.5, 0.012, 0.6), M["panel"], cp, 0.004, 1)
box("ped_top", (0.0, 0.0, 1.11), (0.66, 0.54, 0.05), M["steel"], cp, 0.012, 2)
slope = empty("ped_slope", cp, (0, -0.02, 1.2))
slope.rotation_euler = (radians(-32), 0, 0)
box("slope_panel", (0, 0, 0), (0.56, 0.4, 0.06), M["gun"], slope, 0.01, 2)
bpy.context.view_layer.update()
plane("screen", (0, -0.036, 0.0), 0.38, 0.17, M["screen"], slope)
for i, m_ in enumerate(("ready", "glowg", "strip")):
    box(f"lamp_{i}", (-0.19 + i * 0.07, -0.036, -0.13), (0.045, 0.012, 0.045), M[m_], slope, 0)
cyl("big_btn", (0.16, -0.036, -0.12), 0.045, 0.05, M["glowg"], slope, "Y", 14, 0.004)
cyl("stop_btn", (-0.17, -0.036, 0.12), 0.05, 0.06, M["red"], slope, "Y", 14, 0.006)
box("stop_guard", (-0.17, -0.04, 0.12), (0.14, 0.012, 0.14), M["hazard"], slope, 0.001, 1)
box("status_bar", (0, -0.262, 0.7), (0.4, 0.01, 0.06), M["ready"], cp, 0)
text("console_text", "LIFT 02 / CONTROL", 0.04, (0, -0.264, 0.3), M["stencil"], cp, font=MONO, extrude=0.0)
box("console_hz", (0, -0.263, 0.12), (0.44, 0.01, 0.12), M["hazard"], cp, 0.001, 1)

# ---------------------------------------------------------------- freight clutter: toolbox, extinguisher, strapped crate
tb = empty("toolbox", root, (-2.9, 2.5, KP))
box("tb_body", (0, 0, 0.15), (0.6, 0.32, 0.3), M["frame"], tb, 0.012, 2)
box("tb_lid", (0, 0, 0.32), (0.62, 0.34, 0.06), M["gun"], tb, 0.01, 2)
box("tb_handle", (0, 0, 0.37), (0.22, 0.03, 0.03), M["trim"], tb, 0.004)
ex = empty("extinguisher", root, (-2.95, 1.6, KP))
cyl("ex_body", (0, 0, 0.3), 0.075, 0.6, M["red"], ex, "Z", 12, 0.01)
cyl("ex_neck", (0, 0, 0.64), 0.03, 0.08, M["trim"], ex, "Z", 8, 0)
box("ex_bracket", (0, 0.0, 0.42), (0.17, 0.17, 0.05), M["steel"], ex, 0.004, 1)
cr = empty("crate", root, (2.6, 2.3, KP))
box("crate_body", (0, 0, 0.45), (1.1, 1.1, 0.9), M["gun"], cr, 0.02, 2)
for x in (-0.42, 0, 0.42):
    box("crate_rib", (x, -0.555, 0.45), (0.05, 0.012, 0.86), M["steel"], cr, 0.004, 1)
box("crate_hz", (0, -0.556, 0.2), (0.9, 0.01, 0.12), M["hazard"], cr, 0.001, 1)
for s in (-1, 1):
    box("crate_strap", (s * 0.28, 0, 0.45), (0.06, 1.14, 0.94), M["rubber"], cr, 0.004, 1)
    box("crate_buckle", (s * 0.28, -0.575, 0.7), (0.07, 0.015, 0.08), M["trim"], cr, 0.002, 1)
text("crate_text", "HF-IT / GPU / 04", 0.07, (0, -0.558, 0.6), M["stencil"], cr, font=MONO, extrude=0.0)

# ---------------------------------------------------------------- previews
def look(cam_loc, aim, lens, out, res=(1280, 800)):
    # re-aim the stage camera
    aim_o = kit.sc.objects["_aim"]
    aim_o.location = aim
    kit.sc.camera.location = cam_loc
    kit.sc.camera.data.lens = lens
    kit.sc.render.resolution_x, kit.sc.render.resolution_y = res
    kit.render(os.path.join(OUT, "previews", out))


kit.stage((0, 0, 0.8), (-7.5, -9.5, 4.2), lens=34, res=(1280, 800), key=900, rim=500, fill=260)
for o in list(kit.sc.objects):
    if o.name in ("_wall", "_floor"):
        bpy.data.objects.remove(o)
# stand-in rails so the clamps read in the preview
look((-7.5, -9.5, 4.2), (0, 0, 0.8), 34, "lift-iso.png")
look((-3.4, -7.2, 1.7), (0, -1.5, 1.0), 30, "lift-front.png")
look((6.5, -2.5, -2.4), (0, 0.5, -0.4), 30, "lift-underside.png")
look((4.5, 9.0, 3.8), (0, 2.0, 0.9), 34, "lift-back.png")

# rest state for export: safety bar raised (already), strips orange (locked)
kit.export(root, os.path.join(OUT, "end2-lift.glb"), os.path.join(OUT, "lift.blend"))

if os.environ.get("TRIS"):
    dg = bpy.context.evaluated_depsgraph_get()
    rows = []
    for o in root.children_recursive:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            rows.append((len(me.loop_triangles), o.name))
    agg = {}
    for t, n in rows:
        k = n.rstrip("0123456789._")
        agg[k] = agg.get(k, 0) + t
    for k, t in sorted(agg.items(), key=lambda kv: -kv[1])[:25]:
        print("TRI", t, k)
