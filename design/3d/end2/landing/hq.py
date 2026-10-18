# ASCENT (Ending 2): the Hugging Face HQ as seen on the approach. Hero massing for the fog reveal.
# blender -b --factory-startup -P design/3d/end2/landing/hq.py [-- preview]
#   -> end2-hq.glb (+ .blend) next to this script; copy the glb to prototypes/end2-ascent/assets/models/.
# Written in THREE.JS coordinates through t3()/tbox(): x right, y up, z towards the approaching fleet.
# The façade plane is z = 0, the bottom entrance (portal) is centred on x = 0, the landing deck top is y = 0.
# Scale is real metres: the tower is ~2.7 km tall and ~0.8 km wide, so fog always hides its top.
# Near the pad (where the camera gets close) everything is worn paint over gunmetal (kit.surface);
# far away it is a window-grid façade texture with lit windows in the emissive map.
# Nodes for the app (glTF extras / names):
#   logo_anchor  centre of the emblem mount, on the spine's front face (the app adds the official logo, face 210 m)
#   pad          landing pad centre on the deck (y = 0)
#   bay_00..     fleet bay mouths (ships fly in and vanish behind the bay plane)
#   search_0..   searchlight roots on the podium edge (the app adds sweeping cones)
#   beacon_00..  aviation lights (the app adds blinking sprites that read through the fog)
#   door         the lit inner door at the back of the entrance tunnel
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import bpy, bmesh
import numpy as np
from math import atan2, sqrt, radians, pi, cos, sin

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = "end2-hq"
kit.reset(NAME, OUT)


def t3(x, y, z):
    """three.js (x, y, z) -> Blender (x, -z, y)."""
    return (x, -z, y)


def tbox(name, x, y, z, w, h, d, m, parent, bev=0.0, rot=None):
    return box(name, t3(x, y, z), (w, d, h), m, parent, bev=bev, rot=rot)


# ------------------------------------------------------------------------------------------------ textures
def facade_maps(n=1024, seed=7):
    """One tile = 96 m: floors every 4 m, window bays every 2 m, panel seams every 16 m, lit windows."""
    r = np.random.default_rng(seed)
    ppm = n / 96.0
    y = np.arange(n)[:, None] / ppm  # metres down the tile (image rows)
    x = np.arange(n)[None, :] / ppm
    fy, fx = y % 4.0, x % 2.0
    spandrel = (fy < 1.25)
    mullion = (fx < 0.22)
    seam = ((y % 16.0) < 0.35) | ((x % 16.0) < 0.3)
    floor_i = (y // 4.0).astype(int)
    col_i = (x // 2.0).astype(int)
    # per-window random values
    rnd = r.random((24, 48))
    wv = rnd[floor_i % 24, col_i % 48]
    lit_floor = r.random(24)[floor_i % 24]
    grime = kit.fbm(seed + 1, 3, 5, n=n)
    drip = kit.fbm(seed + 2, 6, 6, streak=12, n=n)
    glass = srgb("#0a1016")[None, None] * (0.8 + 0.5 * wv[..., None])
    panel = srgb("#2c343e")[None, None] * (0.75 + 0.35 * grime[..., None])
    alb = np.where(spandrel[..., None] | mullion[..., None], panel, glass)
    alb = alb * (1 - 0.35 * sstep(0.55, 0.9, drip))[..., None]
    alb = alb * np.where(seam, 0.45, 1.0)[..., None]
    # lit windows: warm office light, some cool, whole floors lit in bands
    window = ~(spandrel | mullion)
    on = window & ((wv > 0.86) | ((lit_floor > 0.82) & (wv > 0.3)))
    warm = srgb("#ffcf8a")[None, None]
    cool = srgb("#9fe6ff")[None, None]
    colr = np.where((wv > 0.955)[..., None], cool, warm)
    inner = sstep(0.0, 0.5, fy - 1.25) * sstep(4.0, 3.4, fy)  # soft fall-off to the window edges
    em = colr * (on * (0.35 + 0.65 * wv) * inner)[..., None]
    hgt = spandrel * 0.6 + mullion * 0.8 - seam * 0.8 + 0.1 * grime
    nrm = kit.normal_from(hgt.astype(float), 3.0)
    orm = np.stack([np.ones((n, n)), np.where(window, 0.12, 0.55 + 0.2 * grime), np.where(window, 0.0, 0.7)], axis=2)
    return (kit.save("hq_facade_albedo", alb), kit.save("hq_facade_emit", em), kit.save("hq_facade_orm", orm, False),
            kit.save("hq_facade_normal", nrm, False))


def hazard_maps(n=512, seed=21):
    """Worn diagonal HF-yellow / black stripes (tile = 4 m, 4 stripe pairs)."""
    u = np.arange(n)[None, :] / n
    v = np.arange(n)[:, None] / n
    stripe = ((u + v) * 4) % 1.0 < 0.5
    chips = kit.fbm(seed, 14, 6, n=n)
    grime = kit.fbm(seed + 1, 3, 5, n=n)
    yel = srgb("#e3a512")[None, None] * (0.75 + 0.3 * grime[..., None])
    blk = srgb("#15181d")[None, None] * (0.9 + 0.3 * grime[..., None])
    alb = np.where(stripe[..., None], yel, blk)
    chipm = sstep(0.62, 0.66, chips)
    alb = alb * (1 - chipm[..., None]) + srgb("#3a3f46")[None, None] * chipm[..., None]
    orm = np.stack([np.ones((n, n)), 0.55 + 0.3 * grime - 0.2 * chipm, 0.6 * chipm], axis=2)
    nrm = kit.normal_from(-chipm * 1.0 + 0.2 * grime, 4.0)
    return kit.save("hq_hazard_albedo", alb), kit.save("hq_hazard_orm", orm, False), kit.save("hq_hazard_normal", nrm, False)


def facade_mat():
    alb, em, orm, nrm = facade_maps()
    m = tmat("hq_facade", (alb, orm, nrm))
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    te = nt.nodes.new("ShaderNodeTexImage")
    te.image = em
    nt.links.new(te.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 1.0
    return m


M = dict(
    facade=facade_mat(),
    deck=tmat("hq_deck", surface("hq_deck", "#2a3038", 301, chip=0.7, rust_amt=0.35, metal=0.7, rough=0.48, dirt=0.5, panel=2)),
    gun=tmat("hq_gunmetal", surface("hq_gunmetal", "#232a33", 302, chip=0.72, rust_amt=0.4, metal=0.75, rough=0.42, dirt=0.4, panel=1)),
    paint=tmat("hq_paint", surface("hq_paint", "#d7980f", 303, chip=0.6, rust_amt=0.6, metal=0.1, rough=0.5, dirt=0.5)),
    steel=tmat("hq_steel", surface("hq_steel", "#4a525c", 304, chip=0.78, rust_amt=0.25, metal=0.9, rough=0.32, dirt=0.25)),
    hazard=tmat("hq_hazard", hazard_maps()),
    dark=mat("hq_dark", lin("#07090c"), 0.4, 0.7),
    warm=mat("hq_glow_warm", lin("#ffb020"), 0, 0.4, em=lin("#ffb020"), strength=2.0),
    cool=mat("hq_glow_cool", lin("#bfefff"), 0, 0.4, em=lin("#bfefff"), strength=1.5),
    bay=mat("hq_bay", lin("#0c2630"), 0, 0.6, em=lin("#7fdcff"), strength=1.0),
    inner=mat("hq_inner", lin("#2a2010"), 0, 0.6, em=lin("#ffd9a0"), strength=1.0),
    door=mat("hq_door", lin("#fff1d0"), 0, 0.5, em=lin("#fff1d0"), strength=2.5),
)

root = empty(NAME, None)


def scale_uv(s):
    kit.UVS = s


# ------------------------------------------------------------------------------------------------ helpers
def loft_oct(name, rings, m, parent, top=True):
    """Chamfered-rectangle loft. rings: (y, cz, hw, hd, ch) in three coords."""
    bm = bmesh.new()
    rows = []
    for (y, cz, hw, hd, ch) in rings:
        pts = [(-hw + ch, cz + hd), (hw - ch, cz + hd), (hw, cz + hd - ch), (hw, cz - hd + ch),
               (hw - ch, cz - hd), (-hw + ch, cz - hd), (-hw, cz - hd + ch), (-hw, cz + hd - ch)]
        rows.append([bm.verts.new(t3(x, y, z)) for x, z in pts])
    for i in range(len(rows) - 1):
        for j in range(8):
            j2 = (j + 1) % 8
            bm.faces.new((rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]))
    if top:
        bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, m, parent)


def strut(name, a, b, w, h, m, parent):
    """Box from point a to point b (three coords), cross-section w x h."""
    A, B = Vector(t3(*a)), Vector(t3(*b))
    d = B - A
    o = box(name, tuple((A + B) / 2), (w, d.length, h), m, parent, bev=0)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Y", "Z")
    return o


def anchor(name, x, y, z, **extra):
    e = empty(name, root, t3(x, y, z))
    for k, v in extra.items():
        e[k] = v
    return e


# ------------------------------------------------------------------------------------------------ tower (far: façade texture)
scale_uv(1 / 96)
FRONT0, FRONT1, Y0, Y1 = 0.0, -50.0, 90.0, 2700.0


def front(y):
    return FRONT0 + (FRONT1 - FRONT0) * (y - Y0) / (Y1 - Y0)


def half_w(y):
    return 380 + (260 - 380) * (y - Y0) / (Y1 - Y0)


loft_oct("tower", [(Y0, -200, 380, 200, 60), (Y1, -200, 260, 150, 45)], M["facade"], root)
# spine (carries the emblem), stands proud of the façade
loft_oct("spine", [(Y0, 0, 82, 24, 12), (Y1, -50, 62, 24, 10)], M["gun"], root)
for sx in (-1, 1):
    strut(f"spine_light_{sx}", (sx * 70, Y0 + 30, 22.5), (sx * 52, Y1, -27.5), 2.2, 1.2, M["warm"], root)
# podium with the portal cut out of it (three blocks around the opening)
PW, PH = 48, 62  # portal half-width, height
tbox("podium_l", -(550 + PW) / 2, 45, -150, 550 - PW, 90, 300, M["facade"], root)
tbox("podium_r", (550 + PW) / 2, 45, -150, 550 - PW, 90, 300, M["facade"], root)
tbox("podium_top", 0, (PH + 90) / 2, -150, PW * 2, 90 - PH, 300, M["facade"], root)
tbox("podium_cap", 0, 92, -148, 1110, 4, 306, M["gun"], root)
tbox("podium_edge", 0, 89.5, 2.4, 1104, 1.0, 1.2, M["warm"], root)
# wings: stepped setbacks, asymmetric heights; each tier's front edge is lit (they come out of the fog one by one)
TIERS = {-1: [(90, 520, 560, 360, -40), (520, 980, 540, 385, -75), (980, 1600, 515, 400, -105)],
         1: [(90, 610, 560, 360, -40), (610, 1150, 540, 385, -75), (1150, 1900, 515, 400, -105)]}
for sx, tiers in TIERS.items():
    for k, (ya, yb, xo, xi, zf) in enumerate(tiers):
        cx, w = sx * (xo + xi) / 2, xo - xi
        tbox(f"wing_{sx}_{k}", cx, (ya + yb) / 2, (zf - 330) / 2, w, yb - ya, 330 + zf, M["facade"], root)
        tbox(f"wing_{sx}_{k}_lip", cx, yb + 1.5, zf + 1.5, w + 4, 3, 3, M["gun"], root)
        tbox(f"wing_{sx}_{k}_glow", cx, yb - 1.0, zf + 3.1, w, 0.9, 0.4, M["warm"], root)
        anchor(f"beacon_w{'lr'[sx > 0]}{k}", sx * xo, yb + 4, zf, colour="red")
# fins: thin blades on the tower front, sloped with it, ending at different heights
FINS = [(110, 2300), (165, 1900), (225, 2550), (285, 1500), (340, 700)]
for sx in (-1, 1):
    for k, (fx, top) in enumerate(FINS):
        top = top - (180 if sx > 0 and k % 2 else 0)
        while half_w(top) < fx + 10:
            top -= 50
        strut(f"fin_{sx}_{k}", (sx * fx, Y0, front(Y0) + 5), (sx * fx, top, front(top) + 5), 4, 10, M["gun"], root)
        anchor(f"beacon_f{'lr'[sx > 0]}{k}", sx * fx, top + 4, front(top) + 5, colour="red" if k % 2 else "amber")
# floor ledges every 160 m: the eye counts them and the count never ends
for k, y in enumerate(range(250, 2650, 160)):
    hw = half_w(y)
    tbox(f"ledge_{k}", 0, y, front(y) + 2.5, 2 * hw - 120, 2.5, 5, M["gun"], root)
    if k % 3 == 0:
        tbox(f"ledge_{k}_glow", 0, y - 1.6, front(y) + 4.9, 2 * hw - 140, 0.6, 0.3, M["cool"], root)
# tower corner beacons up into the fog
for k, y in enumerate((700, 1250, 1800, 2350, 2690)):
    for sx in (-1, 1):
        anchor(f"beacon_t{'lr'[sx > 0]}{k}", sx * (half_w(y) - 10), y, front(y) - 10, colour="red")

# emblem mount on the spine: a chamfered gunmetal plate with a lit recess line and four clamp brackets.
# The app puts the official logo (face 210 m, ~300 m with the hands) on logo_anchor, facing +z.
LOGO_Y, MOUNT = 262.0, 300.0
mz = 24 - 50.0 * (LOGO_Y - Y0) / (Y1 - Y0)  # spine front face at LOGO_Y
H2, CH = MOUNT / 2, 34.0
oct_pts = [(-H2 + CH, LOGO_Y - H2), (H2 - CH, LOGO_Y - H2), (H2, LOGO_Y - H2 + CH), (H2, LOGO_Y + H2 - CH),
           (H2 - CH, LOGO_Y + H2), (-H2 + CH, LOGO_Y + H2), (-H2, LOGO_Y + H2 - CH), (-H2, LOGO_Y - H2 + CH)]
prism("emblem_mount", oct_pts, -(mz + 8), -(mz - 2), M["gun"], root, bev=0)
for sy in (-1, 1):
    tbox(f"emblem_glow_h{sy}", 0, LOGO_Y + sy * (MOUNT / 2 - 7), mz + 8.3, MOUNT - 70, 1.2, 0.4, M["warm"], root)
    tbox(f"emblem_glow_v{sy}", sy * (MOUNT / 2 - 7), LOGO_Y, mz + 8.3, 1.2, MOUNT - 70, 0.4, M["warm"], root)
    for sx in (-1, 1):
        tbox(f"emblem_clamp_{sx}_{sy}", sx * (MOUNT / 2 - 18), LOGO_Y + sy * (MOUNT / 2 - 18), mz + 10, 22, 22, 4,
             M["steel"], root, bev=0.4, rot=(0, radians(45), 0))
anchor("logo_anchor", 0, LOGO_Y, mz + 8.2)

# fleet bays on the tower front: dark mouth + lit interior plane + steel frame
BAYS = [(-300, 150), (-200, 150), (200, 150), (300, 150), (-250, 232), (250, 232), (-300, 310), (300, 310),
        (-290, 380), (290, 380), (-200, 455), (200, 455)]
for k, (bx, by) in enumerate(BAYS):
    fz = front(by)
    W, H = 46, 20
    tbox(f"bay_{k}_mouth", bx, by, fz + 0.3, W, H, 0.6, M["bay"], root)
    tbox(f"bay_{k}_top", bx, by + H / 2 + 1.5, fz + 2, W + 6, 3, 4, M["gun"], root)
    tbox(f"bay_{k}_bot", bx, by - H / 2 - 1.5, fz + 3, W + 6, 3, 6, M["gun"], root)
    for sx in (-1, 1):
        tbox(f"bay_{k}_side{sx}", bx + sx * (W / 2 + 1.5), by, fz + 2, 3, H, 4, M["gun"], root)
    tbox(f"bay_{k}_lip", bx, by - H / 2 - 0.2, fz + 6.1, W, 0.5, 0.3, M["cool"], root)
    anchor(f"bay_{k:02d}", bx, by, fz)

# ------------------------------------------------------------------------------------------------ the entrance (near: worn paint)
scale_uv(1 / 6)
# portal frame: two posts and a lintel standing proud, chamfered top corners
for sx in (-1, 1):
    tbox(f"post_{sx}", sx * (PW + 5), PH / 2, 6, 10, PH, 12, M["gun"], root, bev=0.4)
    tbox(f"post_{sx}_haz", sx * (PW + 5), 9, 12.2, 10.4, 18, 0.6, M["hazard"], root)
    tbox(f"post_{sx}_glow", sx * (PW + 0.4), PH / 2, 12.1, 0.6, PH - 6, 0.4, M["warm"], root)
    tbox(f"chamfer_{sx}", sx * (PW - 6), PH - 6, 6, 18, 6, 12, M["gun"], root, bev=0.3, rot=(0, radians(45 * sx), 0))
    # blast doors, slid open into the façade beside the portal
    tbox(f"blast_{sx}", sx * (PW + 42), 30, 3.5, 64, 60, 5, M["gun"], root, bev=0.3)
    tbox(f"blast_{sx}_haz", sx * (PW + 12), 30, 6.2, 4, 58, 0.5, M["hazard"], root)
    for k in range(4):
        tbox(f"blast_{sx}_rib{k}", sx * (PW + 42), 8 + k * 14, 6.4, 60, 1.5, 1.2, M["steel"], root)
tbox("lintel", 0, PH + 5, 6, 2 * PW + 20, 10, 12, M["gun"], root, bev=0.4)
tbox("lintel_haz", 0, PH + 5, 12.2, 2 * PW + 16, 3, 0.6, M["hazard"], root)
tbox("lintel_glow", 0, PH + 0.3, 12.1, 2 * PW - 4, 0.6, 0.4, M["warm"], root)
# tunnel: floor, walls, ceiling, ribs, lit back wall with the inner door
TD = 90
tbox("tunnel_floor", 0, -2, -TD / 2, 2 * PW, 4, TD, M["deck"], root)
tbox("tunnel_ceiling", 0, PH + 1, -TD / 2, 2 * PW, 2, TD, M["dark"], root)
for sx in (-1, 1):
    tbox(f"tunnel_wall_{sx}", sx * (PW + 1), PH / 2, -TD / 2, 2, PH, TD, M["dark"], root)
for k in range(6):
    z = -8 - k * 14
    for sx in (-1, 1):
        tbox(f"rib_{k}_{sx}", sx * (PW - 2), PH / 2, z, 4, PH, 3, M["gun"], root)
        tbox(f"rib_{k}_{sx}_glow", sx * (PW - 4.1), PH / 2, z, 0.4, PH - 8, 0.8, M["cool"], root)
    tbox(f"rib_{k}_top", 0, PH - 2, z, 2 * PW, 4, 3, M["gun"], root)
tbox("tunnel_back", 0, PH / 2, -TD, 2 * PW, PH, 1, M["dark"], root)
tbox("door_halo", 0, 9, -TD + 0.8, 34, 24, 0.4, M["inner"], root)
tbox("door_frame", 0, 9, -TD + 1.2, 26, 18, 1.4, M["gun"], root)
tbox("door_panel", 0, 8, -TD + 2.0, 18, 14, 0.4, M["door"], root)
anchor("door", 0, 0, -TD + 2.2)

# landing deck, pad, chevrons, kerbs, greebles
DZ0, DZ1, DW = 0.0, 150.0, 170.0
tbox("deck", 0, -4, (DZ0 + DZ1) / 2, DW, 8, DZ1 - DZ0, M["deck"], root)
for sx in (-1, 1):
    tbox(f"kerb_{sx}", sx * (DW / 2 - 1), 0.6, (DZ0 + DZ1) / 2, 2, 1.2, DZ1 - DZ0, M["hazard"], root)
    for k in range(10):
        tbox(f"kerb_{sx}_light{k}", sx * (DW / 2 - 2.05), 0.7, 8 + k * 15, 0.2, 0.4, 1.6, M["warm"], root)
tbox("deck_front", 0, -4, DZ1 + 1, DW, 8, 2, M["hazard"], root)
PADZ, PR = 52.0, 17.0
cyl("pad_disc", t3(0, 0.12, PADZ), PR, 0.24, M["gun"], root, seg=48)
for k in range(32):
    a = 2 * pi * (k + 0.5) / 32
    o = tbox(f"pad_seg_{k}", sin(a) * (PR - 1.2), 0.27, PADZ + cos(a) * (PR - 1.2), 2.6, 0.1, 1.7,
             M["paint"] if k % 2 else M["dark"], root, rot=(0, 0, a))
for k in range(16):
    a = 2 * pi * k / 16
    tbox(f"pad_light_{k}", sin(a) * (PR + 0.8), 0.25, PADZ + cos(a) * (PR + 0.8), 0.7, 0.3, 0.7, M["cool"], root)
torus("pad_ring", t3(0, 0.25, PADZ), 6.5, 0.35, M["paint"], root, axis="Z", seg=40, rseg=4).scale = (1, 1, 0.25)
anchor("pad", 0, 0, PADZ)
for k, z in enumerate((30, 22, 14)):
    for sx in (-1, 1):
        tbox(f"chev_{k}_{sx}", sx * 5.2, 0.05, z, 12, 0.1, 2.4, M["paint"], root, rot=(0, 0, radians(30 * sx)))
# service gantries left/right of the portal, crates, a fuel line: the scale cue next to the ship
for sx in (-1, 1):
    gx = sx * 74
    for k, (dz, h) in enumerate(((10, 22), (26, 22))):
        tbox(f"gantry_{sx}_leg{k}a", gx - 4, h / 2, dz, 1.2, h, 1.2, M["steel"], root)
        tbox(f"gantry_{sx}_leg{k}b", gx + 4, h / 2, dz, 1.2, h, 1.2, M["steel"], root)
    tbox(f"gantry_{sx}_deck", gx, 22.5, 18, 10, 1, 18, M["gun"], root)
    tbox(f"gantry_{sx}_lamp", gx, 21.8, 18, 6, 0.4, 3, M["cool"], root)
    for k in range(5):
        tbox(f"crate_{sx}_{k}", gx + (k % 2) * 3.2 - 1.6, 1.3 + (k // 2) * 2.6 * (k < 4), 40 + (k % 3) * 3.4, 3, 2.6, 3,
             M["paint"] if k == 2 else M["gun"], root, bev=0.08)
    wire(f"fuel_{sx}", [t3(sx * 52, 0.6, 12), t3(sx * 60, 0.6, 30), t3(sx * 66, 0.6, 48), t3(sx * 70, 0.6, 70)], 0.5,
         M["steel"], root)
# deck supports and the causeway that leads the fleet in
for sx in (-1, 1):
    for z in (30, 120):
        tbox(f"pier_{sx}_{z}", sx * 55, -110, z, 14, 212, 14, M["gun"], root)
CZ0, CZ1, CW = DZ1, 1700.0, 44.0
tbox("causeway", 0, -2.5, (CZ0 + CZ1) / 2, CW, 5, CZ1 - CZ0, M["deck"], root)
for sx in (-1, 1):
    tbox(f"causeway_glow_{sx}", sx * (CW / 2 - 0.6), 0.2, (CZ0 + CZ1) / 2, 0.5, 0.4, CZ1 - CZ0, M["warm"], root)
for k, z in enumerate(range(300, 1700, 200)):
    tbox(f"causeway_pier_{k}", 0, -105, z, 10, 200, 10, M["gun"], root)

# the arms: two great buttresses that reach out round the deck (the building embraces its landing zone)
for sx in (-1, 1):
    pts = [(sx * 470, 170, -20), (sx * 360, 125, 110), (sx * 235, 80, 210), (sx * 140, 50, 270)]
    for k in range(3):
        strut(f"arm_{sx}_{k}", pts[k], pts[k + 1], 30 - k * 5, 22 - k * 4, M["gun"], root)
        a, b = pts[k], pts[k + 1]
        strut(f"arm_{sx}_{k}_glow", (a[0], a[1] + 11.6 - k * 2, a[2]), (b[0], b[1] + 11.6 - k * 2, b[2]), 1.2, 0.6, M["warm"], root)
    x, y, z = pts[-1]
    tbox(f"arm_{sx}_claw", x, y - 6, z + 6, 16, 20, 14, M["gun"], root, bev=0.5)
    tbox(f"arm_{sx}_claw_haz", x, y - 6, z + 13.2, 16.4, 6, 0.5, M["hazard"], root)
    anchor(f"beacon_a{'lr'[sx > 0]}", x, y + 6, z + 6, colour="amber")
for k, sx in enumerate((-460, -300, -170, 170, 300, 460)):
    anchor(f"search_{k}", sx, 94, 4)

# ------------------------------------------------------------------------------------------------ merge by material (draw calls)
bpy.context.view_layer.update()
meshes = [o for o in root.children if o.type == "MESH"]
for o in meshes:
    for x in kit.sc.objects:
        x.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    for md in list(o.modifiers):
        bpy.ops.object.modifier_apply(modifier=md.name)
by = {}
for o in meshes:
    by.setdefault(o.data.materials[0].name, []).append(o)
for name, objs in by.items():
    for x in kit.sc.objects:
        x.select_set(False)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    o = bpy.context.view_layer.objects.active
    o.name = o.data.name = "hq_" + name.replace("hq_", "")
    # keep world transform, parent to root
    o.parent = root

if "preview" in ARGS:
    w = bpy.data.worlds.new("w")
    kit.sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#101b2c"), 1)
    sun = bpy.data.objects.new("_sun", bpy.data.lights.new("_sun", "SUN"))
    sun.data.energy = 2.0
    sun.rotation_euler = (radians(55), 0, radians(20))
    kit.sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    kit.sc.collection.objects.link(cam)
    cam.data.clip_end = 8000
    aim = empty("_aim", None, t3(0, 300, 0))
    cam.constraints.new("TRACK_TO").target = aim
    kit.sc.camera = cam
    kit.sc.render.engine = "BLENDER_EEVEE_NEXT"
    kit.sc.eevee.taa_render_samples = 8
    kit.sc.render.resolution_x, kit.sc.render.resolution_y = 960, 540
    kit.sc.view_settings.view_transform = "AgX"
    for nm, loc, at in (("far", t3(260, 120, 1500), t3(0, 500, 0)), ("deck", t3(40, 30, 160), t3(0, 20, 0))):
        cam.location, aim.location = loc, at
        kit.render(os.path.join(OUT, "previews", f"hq-{nm}.png"))

kit.export(root, os.path.join(OUT, f"{NAME}.glb"), os.path.join(OUT, f"{NAME}.blend"))
