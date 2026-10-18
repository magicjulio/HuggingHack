# ASCENT (Ending 2): the approach kit, round 3 (things in the sky to dodge or shoot).
# blender -b --factory-startup -P design/3d/end2/landing/approach_kit.py [-- preview]
#   -> end2-approach-kit.glb (+ .blend); copy the glb to prototypes/end2-ascent/assets/models/.
# Game coordinates through t3()/tbox() (x right, y up, z towards the incoming player).
# Every top-level node below the root is one prefab. The app (flight-kit.js) merges each prefab's
# meshes by material in the prefab's own frame and draws it as one InstancedMesh per material, so
# the prefab empties may sit anywhere (they are spread out here for the preview lineup).
# Prefabs (origin = the prefab empty):
#   wreck_plate   torn hull plate, ~14 x 9 m, ribs on the back           (dodge; breaks after 3 hits)
#   wreck_truss   broken girder section, ~18 m                            (dodge; breaks after 3 hits)
#   wreck_block   broken engine nacelle, ~7 m, embers in the torn end      (dodge or shoot)
#   pod           cargo pod 6 x 3.2 x 3.2, HF yellow, glowing seams       (shoot: it bursts)
#   interceptor   defence drone, faces +z, sensor `ic_eye` on the nose    (shoots at you)
#   turret_base   causeway flak tower, origin at its foot, 24 m tall; `turret_head` sits on top
#   turret_head   yaw/pitch head, origin at the pivot, twin barrels along +z, sensor eye
#   ship_gun      laser cannon pod for the dropship's wings, barrel along -z (the ship's nose)
#   emitter       barrier-gate emitter node, faces +z, glowing core `em_core`  (shoot all four)
#   gate          barrier gate frame, opening 100 x 60 m, faces +z; anchors em_0..3 (emitters)
#   gate_field    100 x 60 plane, UV 0..1 (the app gives it the energy shader)
# Shared materials: ap_gun, ap_paint, ap_steel, ap_hazard, ap_burnt, ap_dark, ap_glow, ap_eye, ap_core, ap_tip.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import bpy, bmesh
from math import radians, pi, cos, sin

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = "end2-approach-kit"
kit.reset(NAME, OUT)


def t3(x, y, z):
    return (x, -z, y)


def tbox(name, x, y, z, w, h, d, m, parent, bev=0.0, rot=None):
    return box(name, t3(x, y, z), (w, d, h), m, parent, bev=bev, rot=rot)


def tcyl(name, x, y, z, r, depth, m, parent, axis="y", seg=12, r2=None, bev=0.0):
    """Cylinder along a three.js axis (x | y | z)."""
    return cyl(name, t3(x, y, z), r, depth, m, parent, axis={"x": "X", "y": "Z", "z": "Y"}[axis], seg=seg, r2=r2, bev=bev)


def strut(name, a, b, w, h, m, parent):
    A, B = Vector(t3(*a)), Vector(t3(*b))
    d = B - A
    o = box(name, tuple((A + B) / 2), (w, d.length, h), m, parent, bev=0)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Y", "Z")
    return o


def sphere(name, x, y, z, r, m, parent, seg=16, rings=10):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    o = mesh_obj(name, bm, m, parent, t3(x, y, z))
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def jag(w, h, seed, n=7, rough=0.22):
    """A torn rectangle outline in Blender XZ (x right, z up): straight on two sides, ragged on the others."""
    import random
    r = random.Random(seed)
    pts = [(-w / 2, -h / 2), (w / 2, -h / 2)]
    for k in range(1, n):  # ragged right edge going up
        pts.append((w / 2 - r.random() * w * rough, -h / 2 + h * k / n))
    for k in range(n, -1, -1):  # ragged top edge going left
        pts.append((-w / 2 + w * k / n, h / 2 - r.random() * h * rough * (0.4 if k in (0, n) else 1)))
    return pts


kit.UVS = 1 / 3  # one texture tile = 3 m
M = dict(
    gun=tmat("ap_gun", surface("ap_gun", "#262d36", 511, chip=0.66, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.5, panel=2)),
    paint=tmat("ap_paint", surface("ap_paint", "#d39a12", 512, chip=0.58, rust_amt=0.55, metal=0.1, rough=0.5, dirt=0.55, panel=1)),
    steel=tmat("ap_steel", surface("ap_steel", "#4d5560", 513, chip=0.8, rust_amt=0.3, metal=0.9, rough=0.35, dirt=0.3)),
    burnt=tmat("ap_burnt", surface("ap_burnt", "#1b1d20", 515, chip=0.5, rust_amt=0.9, metal=0.6, rough=0.62, dirt=0.8, panel=1)),
    dark=mat("ap_dark", lin("#08090b"), 0.3, 0.7),
    glow=mat("ap_glow", lin("#ff9d00"), 0, 0.4, em=lin("#ff9d00"), strength=2.0),
    eye=mat("ap_eye", lin("#ff4a1a"), 0, 0.3, em=lin("#ff4a1a"), strength=2.0),
    core=mat("ap_core", lin("#ffb020"), 0, 0.3, em=lin("#ffb020"), strength=3.0),
    tip=mat("ap_tip", lin("#39ff9c"), 0, 0.3, em=lin("#39ff9c"), strength=2.0),
)
M["hazard"] = tmat("ap_hazard", kit.surface("ap_hazard", "#d39a12", 514, chip=0.6, rust_amt=0.4, ribs=6, dirt=0.5))

root = empty(NAME, None)


# ------------------------------------------------------------------------------------ wreck_plate
def wreck_plate(at):
    p = empty("wreck_plate", root, t3(*at))
    prism("wp_skin", jag(14, 9, 1), -0.3, 0.3, M["burnt"], p, bev=0)
    # surviving yellow livery on the front face, torn the same way
    prism("wp_livery", [(x * 0.82 - 1.0, z * 0.5 - 1.6) for x, z in jag(14, 9, 1)], -0.36, -0.3, M["paint"], p, bev=0)
    tbox("wp_haz", -2.5, -3.2, 0.33, 7.5, 0.7, 0.08, M["hazard"], p)
    for k in range(4):  # ribs on the back
        x = -5.6 + k * 3.4
        tbox(f"wp_rib{k}", x, -0.3 - k * 0.35, -0.75, 0.45, 8.0 - k * 1.2, 0.9, M["gun"], p)
    for k, y in enumerate((-2.8, 1.6)):
        tbox(f"wp_str{k}", -1.2, y, -0.65, 11.0 - k * 2.5, 0.35, 0.6, M["steel"], p)
    # ember glow in the torn edge + a few rivet heads
    for k, (x, y) in enumerate(((5.2, 0.5), (4.1, 3.2), (-1.0, 4.0), (2.2, 4.1))):
        tbox(f"wp_ember{k}", x, y, 0.0, 0.9, 0.25, 0.7, M["glow"], p)
    for k in range(6):
        tcyl(f"wp_rivet{k}", -6.2 + k * 2.2, -4.0, 0.36, 0.12, 0.12, M["steel"], p, axis="z", seg=6)


# ------------------------------------------------------------------------------------ wreck_truss
def wreck_truss(at):
    p = empty("wreck_truss", root, t3(*at))
    L = 18.0
    for sy in (-1, 1):
        for sz in (-1, 1):
            n = L if not (sy > 0 and sz > 0) else L * 0.66  # one chord snapped short
            tbox(f"wt_chord_{sy}_{sz}", -L / 2 + n / 2, sy * 1.3, sz * 1.3, n, 0.5, 0.5, M["gun"], p)
    for k in range(7):
        x0 = -L / 2 + k * 2.5
        strut(f"wt_brace_a{k}", (x0, -1.3, 1.3), (x0 + 2.5, 1.3, 1.3), 0.22, 0.22, M["steel"], p)
        strut(f"wt_brace_b{k}", (x0, -1.3, -1.3), (x0 + 2.5, 1.3, -1.3), 0.22, 0.22, M["steel"], p)
        if k < 5:
            strut(f"wt_brace_c{k}", (x0, 1.3, -1.3), (x0 + 2.5, 1.3, 1.3), 0.2, 0.2, M["steel"], p)
    # bent end of the snapped chord, a yellow service collar and a dangling cable bundle
    strut("wt_bent", (-L / 2 + L * 0.66, 1.3, 1.3), (-L / 2 + L * 0.66 + 3.2, 2.6, 2.4), 0.5, 0.5, M["gun"], p)
    tbox("wt_collar", -2.0, 0, 0, 1.4, 3.3, 3.3, M["paint"], p)
    tbox("wt_collar_haz", -2.0, 0, 1.66, 1.42, 3.0, 0.06, M["hazard"], p)
    wire("wt_cable", [t3(-2.6, -1.4, 0.8), t3(-3.4, -3.4, 1.2), t3(-2.8, -5.2, 0.4)], 0.12, M["dark"], p, res=4)
    tbox("wt_ember", L / 2 - 0.2, 0, 0, 0.3, 2.4, 2.4, M["glow"], p)


# ------------------------------------------------------------------------------------ wreck_block
def wreck_block(at):
    p = empty("wreck_block", root, t3(*at))
    tcyl("wb_shell", 0, 0, 0, 2.2, 7.0, M["burnt"], p, axis="x", seg=16)
    tcyl("wb_band", -2.2, 0, 0, 2.32, 1.1, M["paint"], p, axis="x", seg=16)
    tcyl("wb_haz", -1.4, 0, 0, 2.3, 0.35, M["hazard"], p, axis="x", seg=16)
    for k in range(3):
        torus(f"wb_rib{k}", t3(-0.4 + k * 1.4, 0, 0), 2.25, 0.16, M["steel"], p, axis="X", seg=20, rseg=4)
    # the torn end: dark interior, hot ring, fan stubs
    tcyl("wb_inner", 3.52, 0, 0, 1.9, 0.08, M["dark"], p, axis="x", seg=16)
    torus("wb_hot", t3(3.5, 0, 0), 1.95, 0.14, M["glow"], p, axis="X", seg=20, rseg=4)
    for k in range(5):
        a = 2 * pi * k / 5 + 0.3
        tbox(f"wb_blade{k}", 3.3, 0.9 * cos(a), 0.9 * sin(a), 0.12, 1.6 - (k % 2) * 0.6, 0.4, M["steel"], p, rot=(a, 0, 0))
    tcyl("wb_cap", -3.7, 0, 0, 1.4, 0.6, M["gun"], p, axis="x", seg=12, r2=0.9)
    tbox("wb_pylon", 0.4, 2.4, 0, 3.4, 1.0, 0.8, M["gun"], p)


# ------------------------------------------------------------------------------------ pod
def pod(at):
    p = empty("pod", root, t3(*at))
    tbox("pd_body", 0, 0, 0, 6.0, 3.2, 3.2, M["paint"], p, bev=0.18)
    for sx in (-1, 1):
        tbox(f"pd_cap{sx}", sx * 3.05, 0, 0, 0.5, 3.4, 3.4, M["gun"], p, bev=0.1)
        tbox(f"pd_haz{sx}", sx * 2.35, 0, 0, 0.5, 3.26, 3.26, M["hazard"], p)
        for sy in (-1, 1):
            tbox(f"pd_corner{sx}{sy}", sx * 3.05, sy * 1.55, 1.55, 0.7, 0.5, 0.5, M["steel"], p)
            tbox(f"pd_cornerb{sx}{sy}", sx * 3.05, sy * 1.55, -1.55, 0.7, 0.5, 0.5, M["steel"], p)
    for sz in (-1, 1):  # glowing seams (the volatile cargo shows through)
        tbox(f"pd_seam{sz}", 0, 0, sz * 1.62, 3.6, 0.18, 0.06, M["glow"], p)
        for k in range(3):
            tbox(f"pd_rib{sz}{k}", -1.2 + k * 1.2, 0, sz * 1.63, 0.18, 3.0, 0.08, M["gun"], p)
    tbox("pd_seam_top", 0, 1.62, 0, 3.6, 0.06, 0.18, M["glow"], p)
    tbox("pd_handle", 0, 1.75, 0, 2.2, 0.2, 0.3, M["steel"], p)


# ------------------------------------------------------------------------------------ interceptor
def interceptor(at):
    p = empty("interceptor", root, t3(*at))
    tbox("ic_body", 0, 0, 0, 2.6, 1.5, 4.6, M["gun"], p, bev=0.2)
    tbox("ic_dorsal", 0, 0.85, -0.3, 1.9, 0.3, 3.4, M["paint"], p, bev=0.08)
    tbox("ic_keel", 0, -0.85, 0.2, 1.2, 0.35, 3.0, M["gun"], p)
    tbox("ic_haz", 0, 0.2, 2.32, 2.4, 0.4, 0.06, M["hazard"], p)
    # nose sensor (the tell: the app brightens ap_eye before a shot)
    tcyl("ic_housing", 0, 0.05, 2.6, 0.75, 0.8, M["gun"], p, axis="z", seg=14)
    tcyl("ic_eye", 0, 0.05, 3.02, 0.5, 0.1, M["eye"], p, axis="z", seg=14)
    torus("ic_rim", t3(0, 0.05, 3.05), 0.6, 0.07, M["steel"], p, axis="Y", seg=16, rseg=4)
    for sx in (-1, 1):
        # swept wing blade out to the gun pod
        strut(f"ic_wing{sx}", (sx * 1.2, 0.1, -0.6), (sx * 4.2, -0.2, 0.4), 1.6, 0.22, M["gun"], p)
        strut(f"ic_wingp{sx}", (sx * 1.3, 0.24, -0.9), (sx * 3.6, 0.0, 0.0), 0.9, 0.08, M["paint"], p)
        tcyl(f"ic_pod{sx}", sx * 4.3, -0.2, 0.3, 0.42, 2.8, M["steel"], p, axis="z", seg=10)
        tcyl(f"ic_barrel{sx}", sx * 4.3, -0.2, 2.2, 0.14, 1.4, M["dark"], p, axis="z", seg=8)
        tcyl(f"ic_muzzle{sx}", sx * 4.3, -0.2, 2.95, 0.2, 0.12, M["glow"], p, axis="z", seg=8)
        strut(f"ic_fin{sx}", (sx * 0.8, 0.7, -1.8), (sx * 1.6, 2.0, -2.6), 0.14, 0.9, M["gun"], p)
    tcyl("ic_nozzle", 0, 0, -2.6, 0.75, 0.8, M["dark"], p, axis="z", seg=12, r2=0.55)
    tcyl("ic_burn", 0, 0, -3.02, 0.55, 0.06, M["glow"], p, axis="z", seg=12)


# ------------------------------------------------------------------------------------ turret
def turret(at):
    b = empty("turret_base", root, t3(*at))
    H = 24.0
    for sx in (-1, 1):  # lattice mast: four legs, cross braces
        for sz in (-1, 1):
            strut(f"tb_leg{sx}{sz}", (sx * 2.6, 0, sz * 2.6), (sx * 1.1, H - 1.5, sz * 1.1), 0.5, 0.5, M["gun"], b)
    for k in range(5):
        y0, y1 = k * 4.4, k * 4.4 + 4.4
        w0, w1 = 2.6 - 1.5 * y0 / H, 2.6 - 1.5 * y1 / H
        for sx in (-1, 1):
            strut(f"tb_bx{k}{sx}", (-w0, y0, sx * w0), (w1, y1, sx * w1), 0.2, 0.2, M["steel"], b)
            strut(f"tb_bz{k}{sx}", (sx * w0, y0, -w0), (sx * w1, y1, w1), 0.2, 0.2, M["steel"], b)
    tbox("tb_foot", 0, 0.6, 0, 7.0, 1.2, 7.0, M["gun"], b, bev=0.1)
    tbox("tb_foot_haz", 0, 1.3, 3.52, 6.6, 0.5, 0.06, M["hazard"], b)
    tbox("tb_deck", 0, H - 1.0, 0, 4.6, 0.8, 4.6, M["gun"], b, bev=0.08)
    tbox("tb_deck_paint", 0, H - 0.5, 0, 4.0, 0.3, 4.0, M["paint"], b)
    tbox("tb_box", 0, H * 0.45, 0, 1.6, 3.0, 1.6, M["paint"], b)
    tbox("tb_glow", 0, H - 1.0, 2.32, 3.8, 0.18, 0.06, M["glow"], b)
    empty("tb_beacon", b, t3(2.2, H - 0.3, 2.2))

    h = empty("turret_head", root, t3(at[0], at[1] + H + 1.2, at[2]))
    tcyl("th_ring", 0, -0.7, 0, 1.9, 0.6, M["steel"], h, axis="y", seg=16)
    tbox("th_yoke", 0, 0.4, -0.3, 3.4, 1.8, 3.0, M["gun"], h, bev=0.15)
    tbox("th_armour", 0, 0.9, 0.3, 3.0, 0.9, 2.6, M["paint"], h, bev=0.1)
    tbox("th_haz", 0, 0.1, 1.22, 3.2, 0.4, 0.06, M["hazard"], h)
    for sx in (-1, 1):
        tcyl(f"th_barrel{sx}", sx * 0.75, 0.3, 2.6, 0.26, 4.2, M["steel"], h, axis="z", seg=10)
        tcyl(f"th_brake{sx}", sx * 0.75, 0.3, 4.7, 0.38, 0.6, M["dark"], h, axis="z", seg=10)
        tcyl(f"th_muzzle{sx}", sx * 0.75, 0.3, 5.02, 0.24, 0.06, M["glow"], h, axis="z", seg=8)
    tcyl("th_eye", 0, 1.2, 1.62, 0.32, 0.12, M["eye"], h, axis="z", seg=12)
    tcyl("th_eye_house", 0, 1.2, 1.4, 0.45, 0.4, M["gun"], h, axis="z", seg=12)


# ------------------------------------------------------------------------------------ ship_gun
def ship_gun(at):
    g = empty("ship_gun", root, t3(*at))
    tcyl("sg_house", 0, 0, 0, 0.3, 2.2, M["gun"], g, axis="z", seg=10, r2=0.24)
    tbox("sg_rail", 0, 0.3, 0.2, 0.18, 0.18, 1.8, M["steel"], g)
    tcyl("sg_barrel", 0, 0, -1.6, 0.11, 1.4, M["steel"], g, axis="z", seg=8)
    torus("sg_coil0", t3(0, 0, -1.2), 0.17, 0.05, M["tip"], g, axis="Y", seg=10, rseg=4)
    torus("sg_coil1", t3(0, 0, -1.6), 0.17, 0.05, M["tip"], g, axis="Y", seg=10, rseg=4)
    tcyl("sg_tip", 0, 0, -2.32, 0.14, 0.1, M["tip"], g, axis="z", seg=8)
    tbox("sg_mount", 0, 0.32, 0.6, 0.3, 0.4, 0.8, M["gun"], g)


# ------------------------------------------------------------------------------------ emitter
def emitter(at):
    e = empty("emitter", root, t3(*at))
    import math
    hexa = [(3.4 * math.cos(math.pi / 6 + k * math.pi / 3), 3.4 * math.sin(math.pi / 6 + k * math.pi / 3)) for k in range(6)]
    prism("em_house", hexa, -1.6, 1.6, M["gun"], e, bev=0.0)  # extruded along three z
    for k in range(6):  # yellow armour petals round the core, one hazard-striped
        a = math.pi / 3 * k
        tbox(f"em_petal{k}", 2.5 * cos(a), 2.5 * sin(a), 1.75, 1.6, 0.9, 0.5,
             M["hazard"] if k == 0 else M["paint"], e, rot=(0, -a, 0))
    sphere("em_core", 0, 0, 1.6, 1.7, M["core"], e, seg=16, rings=10)
    torus("em_ring", t3(0, 0, 1.9), 2.05, 0.18, M["steel"], e, axis="Y", seg=24, rseg=4)
    for k in range(4):  # conduits back to the frame
        a = math.pi / 4 + math.pi / 2 * k
        tcyl(f"em_conduit{k}", 2.2 * cos(a), 2.2 * sin(a), -2.6, 0.35, 2.4, M["steel"], e, axis="z", seg=8)
    tcyl("em_back", 0, 0, -2.2, 2.4, 1.2, M["dark"], e, axis="z", seg=12)


# ------------------------------------------------------------------------------------ gate
def gate(at):
    kit.UVS = 1 / 9  # the frame is 120 m wide: one texture tile = 9 m, or the wear reads as noise
    g = empty("gate", root, t3(*at))
    OW, OH = 50.0, 30.0  # opening half-width / half-height
    T_ = 7.0  # frame band
    D = 6.0  # depth
    # sides: armoured beams, painted front panels, glowing inner lips (the field emitters' rails)
    for sy in (-1, 1):
        tbox(f"gt_h{sy}", 0, sy * (OH + T_ / 2), 0, 2 * OW + 2 * T_, T_, D, M["gun"], g, bev=0.3)
        for k in range(6):
            x = -OW + 8 + k * (2 * OW - 16) / 5
            tbox(f"gt_hp{sy}{k}", x, sy * (OH + T_ / 2), D / 2 + 0.1, 12.0, T_ - 2.0, 0.3, M["paint"] if k % 2 else M["gun"], g)
        tbox(f"gt_hl{sy}", 0, sy * (OH + 0.25), D / 2 - 0.6, 2 * OW - 10, 0.5, 0.5, M["glow"], g)
        tbox(f"gt_hb{sy}", 0, sy * (OH + T_ - 0.3), -D / 2 - 1.0, 2 * OW, 1.2, 2.0, M["steel"], g)
    for sx in (-1, 1):
        tbox(f"gt_v{sx}", sx * (OW + T_ / 2), 0, 0, T_, 2 * OH, D, M["gun"], g, bev=0.3)
        for k in range(3):
            y = -OH + 10 + k * (2 * OH - 20) / 2
            tbox(f"gt_vp{sx}{k}", sx * (OW + T_ / 2), y, D / 2 + 0.1, T_ - 2.0, 12.0, 0.3, M["paint"] if k != 1 else M["gun"], g)
        tbox(f"gt_vl{sx}", sx * (OW + 0.25), 0, D / 2 - 0.6, 0.5, 2 * OH - 10, 0.5, M["glow"], g)
    # corner blocks with hazard faces and beacon anchors
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (OW + T_ / 2), sy * (OH + T_ / 2)
            tbox(f"gt_c{sx}{sy}", cx, cy, 0.6, T_ + 3, T_ + 3, D + 2.5, M["gun"], g, bev=0.4)
            tbox(f"gt_ch{sx}{sy}", cx, cy, D / 2 + 1.9, T_ + 1.5, T_ + 1.5, 0.4, M["hazard"], g)
            tcyl(f"gt_cthr{sx}{sy}", cx + sx * 3.0, cy + sy * 3.0, -D / 2 - 1.0, 1.4, 2.4, M["dark"], g, axis="z", seg=10, r2=1.0)
            empty(f"gt_beacon{'lr'[sx > 0]}{'bt'[sy > 0]}", g, t3(cx, cy + sy * (T_ / 2 + 2.0), 2.0))
    # emitter sockets mid-side (the app mounts `emitter` here)
    for k, (x, y, rz) in enumerate(((-OW + 1.0, 0, 0), (OW - 1.0, 0, 0), (0, OH - 1.0, 0), (0, -OH + 1.0, 0))):
        empty(f"em_{k}", g, t3(x, y, D / 2 + 2.2))
        tbox(f"gt_sock{k}", x, y, D / 2 - 0.4, 8.0 if k > 1 else 3.0, 3.0 if k > 1 else 8.0, 1.6, M["steel"], g)
    # the back: a truss of diagonal braces along every side, cable trays, and thruster pods
    for sy in (-1, 1):
        y = sy * (OH + T_ / 2)
        for k in range(10):
            x0 = -OW - 2 + k * (2 * OW + 4) / 10
            strut(f"gt_hbr{sy}{k}", (x0, y - sy * 2.6, -D / 2 - 1.6), (x0 + (2 * OW + 4) / 10, y + sy * 2.6, -D / 2 - 1.6), 0.8, 0.8, M["steel"], g)
        tbox(f"gt_tray{sy}", 0, y + sy * 1.6, -D / 2 - 0.4, 2 * OW - 6, 1.0, 1.4, M["dark"], g)
    for sx in (-1, 1):
        x = sx * (OW + T_ / 2)
        for k in range(6):
            y0 = -OH - 2 + k * (2 * OH + 4) / 6
            strut(f"gt_vbr{sx}{k}", (x - sx * 2.6, y0, -D / 2 - 1.6), (x + sx * 2.6, y0 + (2 * OH + 4) / 6, -D / 2 - 1.6), 0.8, 0.8, M["steel"], g)
        for k in range(2):  # station-keeping thruster pods on the outer flanks
            yy = (k * 2 - 1) * 14
            tcyl(f"gt_pod{sx}{k}", x + sx * (T_ / 2 + 1.8), yy, 0, 2.0, 7.0, M["gun"], g, axis="z", seg=12)
            tcyl(f"gt_podn{sx}{k}", x + sx * (T_ / 2 + 1.8), yy, -4.2, 1.6, 1.6, M["dark"], g, axis="z", seg=12, r2=1.2)
            tcyl(f"gt_podg{sx}{k}", x + sx * (T_ / 2 + 1.8), yy, -5.05, 1.2, 0.1, M["glow"], g, axis="z", seg=12)
            tbox(f"gt_podh{sx}{k}", x + sx * (T_ / 2 + 1.8), yy, 3.3, 3.6, 3.6, 0.3, M["hazard"], g)
    # hazard lips round the opening, so its edge reads from far away
    for sy in (-1, 1):
        tbox(f"gt_lip_h{sy}", 0, sy * (OH + 0.9), D / 2 + 0.25, 2 * OW - 14, 1.2, 0.2, M["hazard"], g)
    for sx in (-1, 1):
        tbox(f"gt_lip_v{sx}", sx * (OW + 0.9), 0, D / 2 + 0.25, 1.2, 2 * OH - 14, 0.2, M["hazard"], g)
    # the field (the app replaces its material)
    plane("gate_field", t3(at[0], at[1], at[2] + 0.4), 2 * OW, 2 * OH, M["glow"], root)
    kit.UVS = 1 / 3


wreck_plate((-46, 0, 0))
wreck_truss((-24, 0, 0))
wreck_block((-6, 0, 0))
pod((6, 0, 0))
interceptor((17, 0, 0))
turret((30, -26, 0))
ship_gun((40, 0, 0))
emitter((48, 0, 0))
gate((0, 0, -140))

if "preview" in ARGS:
    w = bpy.data.worlds.new("w")
    kit.sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#1a2940"), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.5
    sun = bpy.data.objects.new("_sun", bpy.data.lights.new("_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (radians(55), 0, radians(-35))
    kit.sc.collection.objects.link(sun)
    rim = bpy.data.objects.new("_rim", bpy.data.lights.new("_rim", "SUN"))
    rim.data.energy, rim.data.color = 1.5, lin("#8fc8ff")
    rim.rotation_euler = (radians(70), 0, radians(160))
    kit.sc.collection.objects.link(rim)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    kit.sc.collection.objects.link(cam)
    aim = empty("_aim", None, t3(0, 0, 0))
    cam.constraints.new("TRACK_TO").target = aim
    kit.sc.camera = cam
    kit.sc.render.engine = "BLENDER_EEVEE_NEXT"
    kit.sc.eevee.taa_render_samples = 16
    kit.sc.render.resolution_x, kit.sc.render.resolution_y = 1600, 700
    kit.sc.view_settings.view_transform = "AgX"
    bpy.data.objects["gate_field"].hide_render = True
    for nm, loc, at, lens in (
        ("lineup", t3(2, 10, 48), t3(2, -1, 0), 26),
        ("close", t3(14, 4, 14), t3(13, 0, 0), 30),
        ("gate", t3(70, 20, -20), t3(0, 0, -140), 30),
    ):
        cam.location, aim.location, cam.data.lens = loc, at, lens
        kit.render(os.path.join(OUT, "previews", f"kit-{nm}.png"))

kit.export(root, os.path.join(OUT, f"{NAME}.glb"), os.path.join(OUT, f"{NAME}.blend"))
