# ASCENT (Ending 2) end boss GLM-5.2: the Hugging Face logo face in 3D. This script builds the parts that are not the face
# itself: the mechanical back shell with the orange bezel (the logo's outline), and the two logo hands as articulated
# armoured gauntlets. The face features (eyes, mouth, tongue, cheeks, angry/hurt/roar morphs) are built at runtime from the
# official SVG in prototypes/end2-ascent/boss-model.js, so the neutral face is always the unmodified logo.
#   blender -b --factory-startup -P design/3d/end2/boss/boss.py [-- --nopreview]
#   -> end2-boss.glb (+ boss.blend, previews/boss-r4-blender-*.png)
# Game axes in, Blender out: game (x right, y up, z forward = where the boss looks) -> Blender (x, -z, y). Metres, R = 7.
# Nodes (the API, see prototypes/end2-ascent/BOSS.md):
#   end2_boss > boss_shell (origin = head centre): back dome, plates, bezel (+ bezel_chunk: hidden at damage 2), collar,
#               ears (steam vents), thrusters, dmg1 / dmg2 (shown at damage 1 / 2)
#             > hand_l / hand_r (origin = palm centre, fingers +y, back of the hand +z, palm -z; l = thumb toward +x):
#               <p>_palm, <p>_f1a..f4c (finger joints, pivot at the joint, rest rotation 0), <p>_ta, <p>_tb (thumb, ta has
#               its rest rotation about z), <p>_vent_a / _b (slide along x), <p>_core (weak-point glow), <p>_impact (empty)
#             > face_swatch (a hidden carrier for the worn face paint maps)
# Materials: boss_yellow, boss_orange, boss_gunmetal, boss_steel, boss_dark, boss_face; glow: boss_accent (phase colour),
#   boss_thruster, boss_core (weak point). The app drives every emissive.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import bpy, bmesh
import numpy as np
from math import radians as rad, pi, sin, cos, sqrt, acos, atan2
from mathutils import Vector, Quaternion
import kit
from kit import *

NOPREVIEW = "--nopreview" in sys.argv
kit.reset("end2_boss", HERE)
sc = kit.sc
R = 7.0
OUT = os.path.join(HERE, "..", "..", "..", "..", "prototypes", "end2-ascent", "assets", "models", "end2-boss.glb")
PREV = os.path.join(HERE, "..", "previews")

# ------------------------------------------------------------------------------------------------ materials
# Logo colours as worn paint: low dirt and few chips so the average stays the logo's yellow and orange.
M = dict(
    yellow=tmat("boss_yellow", surface("boss_yellow", "#ffd21e", 401, chip=0.82, rust_amt=0.12, metal=0.1, rough=0.45, dirt=0.22)),
    orange=tmat("boss_orange", surface("boss_orange", "#ff9d00", 402, chip=0.76, rust_amt=0.25, metal=0.2, rough=0.45, dirt=0.28)),
    gun=tmat("boss_gunmetal", surface("boss_gunmetal", "#2a3038", 403, chip=0.72, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.4, panel=3)),
    steel=tmat("boss_steel", surface("boss_steel", "#59616c", 404, chip=0.78, rust_amt=0.2, metal=0.9, rough=0.3, dirt=0.3)),
    dark=mat("boss_dark", lin("#07090c"), 0.4, 0.6),
    accent=mat("boss_accent", lin("#1a1006"), 0.0, 0.5, em=lin("#ffad03"), strength=1.4),
    thruster=mat("boss_thruster", lin("#1a1006"), 0.0, 0.4, em=lin("#ffad03"), strength=2.0),
    core=mat("boss_core", lin("#2a1000"), 0.0, 0.3, em=lin("#ff9d00"), strength=1.0),
)
face_m = tmat("boss_face", surface("boss_face", "#ffd21e", 405, chip=0.88, rust_amt=0.06, metal=0.0, rough=0.45, dirt=0.16))


# ------------------------------------------------------------------------------------------------ helpers (game axes)
def G(x, y, z):
    return (x, -z, y)


def S(x, y, z):
    return (x, z, y)


def gbox(name, c, size, m, parent, bev=0.02, seg=2, rot=None):
    if min(size) < 0.08:
        bev = 0
    return kit.box(name, G(*c), S(*size), M[m] if isinstance(m, str) else m, parent, bev, seg, rot)


def gcyl(name, c, r, length, m, parent, axis="z", seg=16, bev=0.0, r2=None):
    return kit.cyl(name, G(*c), r, length, M[m], parent, {"x": "X", "y": "Z", "z": "Y"}[axis], seg, bev, r2)


def gtorus(name, c, Rm, r, m, parent, axis="z", seg=28, rseg=6):
    return kit.torus(name, G(*c), Rm, r, M[m], parent, {"x": "X", "y": "Z", "z": "Y"}[axis], seg, rseg)


def gempty(name, parent, c=(0, 0, 0), rot=(0, 0, 0)):
    return kit.empty(name, parent, G(*c), rot)


def smooth(o):
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def plate(name, gpos, gnormal, w, h, t, m, parent, bev=0.04, spin=0.0, tangent=None):
    """A box lying on a surface: local Z (thickness) along the normal, local X (w) along `tangent` (game axes)."""
    n = Vector(G(*gnormal)).normalized()
    o = kit.box(name, Vector(G(*gpos)) + n * (t * 0.5), (w, h, t), M[m], parent, bev, 1)
    tg = Vector(G(*tangent)) if tangent is not None else (Vector((1, 0, 0)) if abs(n.x) < 0.9 else Vector((0, 1, 0)))
    x = (tg - n * tg.dot(n)).normalized()
    y = n.cross(x)
    from mathutils import Matrix
    q = Matrix((x, y, n)).transposed().to_quaternion()
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = q @ Quaternion((0, 0, 1), spin)
    return o


def arc_torus(name, c, Rm, r, a0, a1, m, parent, seg=24, rseg=10):
    """A piece of a torus in the game xy plane (facing +z), from angle a0 to a1 (rad, CCW from +x)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ring = []
        for j in range(rseg):
            b = 2 * pi * j / rseg
            x = (Rm + r * cos(b)) * cos(a)
            y = (Rm + r * cos(b)) * sin(a)
            z = r * sin(b)
            ring.append(bm.verts.new(G(x, y, z)))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            j2 = (j + 1) % rseg
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j2], rings[i][j2]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = kit.mesh_obj(name, bm, M[m], parent, G(*c))
    return smooth(o)


def tris(group):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in group.children_recursive:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
    return n


def finish(group, keep=()):
    """Apply modifiers and join meshes sharing (parent, material): one draw call per material per moving node."""
    kids = [c for c in group.children_recursive if c.type == "MESH"]
    for o in kids:
        bpy.context.view_layer.objects.active = o
        for x in sc.objects:
            x.select_set(x == o)
        for mo in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=mo.name)
    by = {}
    for o in kids:
        if o.name.split(".")[0] in keep:
            continue
        by.setdefault((o.parent, o.data.materials[0].name), []).append(o)
    for (par, mname), objs in by.items():
        for x in sc.objects:
            x.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = j.data.name = f"{par.name}_{mname}"


root = kit.empty("end2_boss", None)

# ================================================================================================ SHELL
kit.UVS = 0.22  # textures tile every ~4.5 m on the giant
shell = gempty("boss_shell", root)
ZB = 0.92  # back dome depth


def dome_pt(th, ph, r=0.99 * R):
    """Point and normal on the back dome. th from the back pole (0) to the rim (pi/2), ph around (0 = +x, CCW from the front)."""
    d = Vector((sin(th) * cos(ph), sin(th) * sin(ph), -cos(th)))
    p = Vector((d.x * r, d.y * r, d.z * r * ZB))
    n = Vector((d.x, d.y, d.z / ZB)).normalized()
    return p, n


# back dome
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=48, v_segments=24, radius=0.99 * R)
for v in bm.verts:
    v.co.y *= ZB
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.01], context="VERTS")
smooth(kit.mesh_obj("dome", bm, M["gun"], shell, (0, 0, 0)))
# armour plates in three rings: steel near the pole, gunmetal, logo yellow near the rim (reads HF from the side)
rnd = np.random.default_rng(5)
for th, n_, w, h, m in ((0.42, 7, 0.34, 0.28, "steel"), (0.86, 11, 0.36, 0.3, "gun"), (1.24, 14, 0.3, 0.26, "yellow")):
    for i in range(n_):
        ph = 2 * pi * (i + 0.5 * (th > 1)) / n_
        if th > 1 and -0.35 < sin(ph) < 0.35 and cos(ph) > 0.9:
            continue
        p, nn = dome_pt(th, ph)
        plate(f"plate_{th:.2f}_{i}", tuple(p), tuple(nn), w * R * (0.85 + 0.15 * rnd.random()), h * R, 0.06 * R, m, shell, 0.05, 0.0, (-sin(ph), cos(ph), 0))
        if rnd.random() < 0.5:
            for s in (-1, 1):
                q, _ = dome_pt(th + 0.08 * s, ph)
                bp = q + nn * 0.06 * R * 1.02
                kit.cyl("bolt", G(*bp), 0.05 * R * 0.5, 0.06, M["steel"], shell, "Y", 8)
# ribs over the dome (four meridians) and a dorsal spine
for k in range(4):
    ph = pi / 4 + k * pi / 2
    pts = [G(*(dome_pt(th, ph)[0] + dome_pt(th, ph)[1] * 0.035 * R)) for th in np.linspace(0.12, 1.45, 9)]
    smooth(kit.wire("rib", [Vector(p) for p in pts], 0.045 * R, M["steel"], shell, 4, 1))
for th in np.linspace(0.18, 1.35, 8):
    p, nn = dome_pt(th, pi / 2)
    plate("spine", tuple(p), tuple(nn), 0.12 * R, 0.09 * R, 0.05 * R, "steel", shell, 0.03, 0.0, (1, 0, 0))
# glow strips (phase accent) set into the dome
for z in (-0.42, -0.66):
    zz = z * R
    rr = 0.99 * R * sqrt(max(0.0, 1 - (zz / (0.99 * R * ZB)) ** 2)) + 0.012 * R
    gtorus("accent_ring", (0, 0, zz), rr, 0.016 * R, "accent", shell, "z", 72, 4)
# bezel: the logo's orange outline as a bolted armour ring, in 12 pieces; one breaks off at damage stage 2
CH0, CH1 = rad(48), rad(78)
for i in range(12):
    a0, a1 = i * pi / 6, (i + 1) * pi / 6
    if a0 < CH1 and a1 > CH0:
        continue
    arc_torus("bezel", (0, 0, 0), 1.035 * R, 0.075 * R, a0 + 0.004, a1 - 0.004, "orange", shell, 8, 10)
arc_torus("bezel_left", (0, 0, 0), 1.035 * R, 0.075 * R, rad(30) + 0.004, CH0, "orange", shell, 6, 12)
arc_torus("bezel_right", (0, 0, 0), 1.035 * R, 0.075 * R, CH1, rad(90) - 0.004, "orange", shell, 4, 12)
chunk = gempty("bezel_chunk", shell)
arc_torus("bezel_chunk_ring", (0, 0, 0), 1.035 * R, 0.075 * R, CH0 + 0.003, CH1 - 0.003, "orange", chunk, 8, 12)
for i in range(24):
    a = 2 * pi * (i + 0.5) / 24
    par = chunk if CH0 < a < CH1 else shell
    gcyl("bezel_bolt", (cos(a) * 1.035 * R, sin(a) * 1.035 * R, 0.068 * R), 0.022 * R, 0.03 * R, "steel", par, "z", 8)
arc_torus("bezel_back", (0, 0, -0.07 * R), 1.0 * R, 0.05 * R, 0, 2 * pi, "gun", shell, 64, 6)
gtorus("collar", (0, 0, -0.2 * R), 0.955 * R, 0.06 * R, "steel", shell, "z", 64, 6)
# ears: steam vents on both sides
for s in (-1, 1):
    e = gempty("ear", shell, (s * 0.93 * R, 0.32 * R, -0.08 * R))
    gcyl("ear_housing", (0, 0, 0), 0.26 * R, 0.24 * R, "gun", e, "x", 28, 0.01 * R)
    gtorus("ear_ring", (s * 0.12 * R, 0, 0), 0.24 * R, 0.03 * R, "orange", e, "x", 32, 6)
    gcyl("ear_grille", (s * 0.125 * R, 0, 0), 0.19 * R, 0.02 * R, "dark", e, "x", 24)
    for k in range(5):
        gbox("ear_slat", (s * 0.14 * R, (-0.12 + k * 0.06) * R, 0), (0.02 * R, 0.022 * R, 0.34 * R), "steel", e, 0)
# thrusters under the head
for i in range(3):
    a = (i - 1) * 0.7
    t = gempty("thruster", shell, (sin(a) * 0.55 * R, -0.8 * R, -0.22 * R))
    gcyl("thruster_body", (0, 0, 0), 0.13 * R, 0.24 * R, "gun", t, "y", 24, 0.01 * R, 0.16 * R)
    gtorus("thruster_ring", (0, -0.1 * R, 0), 0.16 * R, 0.025 * R, "steel", t, "y", 24, 6)
    gcyl("thruster_glow", (0, -0.125 * R, 0), 0.11 * R, 0.02 * R, "thruster", t, "y", 24)
# damage stage 1: a torn plate and sparking wires, upper left near the rim (seen from the front over the bezel)
d1 = gempty("dmg1", shell)
p, nn = dome_pt(1.36, rad(140))
gbox("gash", tuple(p), (0.32 * R, 0.2 * R, 0.1 * R), "dark", d1, 0.01)
plate("torn_plate", tuple(p + nn * 0.05 * R + Vector((0.12 * R, 0.1 * R, 0))), tuple(nn), 0.3 * R, 0.22 * R, 0.04 * R, "yellow", d1, 0.03, 0.6)
for k in range(3):
    q = p + nn * 0.05 * R
    smooth(kit.wire("live_wire", [Vector(G(*(q + Vector((dx, dy, 0)) * R))) for dx, dy in ((0, 0), (0.05 + 0.03 * k, 0.08), (0.02 * k, 0.16 + 0.03 * k))], 0.012 * R, M["accent"], d1, 4, 1))
# damage stage 2: the bezel chunk is gone (frayed glowing ends), and a second gash on the right
d2 = gempty("dmg2", shell)
for a in (CH0, CH1):
    gcyl("bezel_stump", (cos(a) * 1.035 * R, sin(a) * 1.035 * R, 0), 0.06 * R, 0.02 * R, "accent", d2, "z", 10)
    for k in range(3):
        q = Vector((cos(a) * 1.0 * R, sin(a) * 1.0 * R, -0.04 * R))
        smooth(kit.wire("live_wire", [Vector(G(*q)), Vector(G(*(q + Vector((0.06 * k - 0.06, 0.1, 0.08)) * R)))], 0.01 * R, M["accent"], d2, 4, 1))
p, nn = dome_pt(1.2, rad(-30))
gbox("gash2", tuple(p), (0.4 * R, 0.24 * R, 0.12 * R), "dark", d2, 0.01)
gtorus("exposed_ring", tuple(p + nn * 0.02 * R), 0.09 * R, 0.02 * R, "accent", d2, "z", 16, 5)

# ================================================================================================ HANDS
kit.UVS = 0.4
Pw, Ph, Pt = 0.42 * R, 0.34 * R, 0.17 * R
FX = [0.62, 0.21, -0.21, -0.62]
FY = [0, 0.025, 0, -0.05]
FR = [r * R for r in (0.056, 0.058, 0.055, 0.049)]
FL = [1, 1.08, 1, 0.82]
SEG = [0.13 * R, 0.1 * R, 0.08 * R]
TSEG, TR = [0.12 * R, 0.1 * R], 0.064 * R


def segment(pre, joint, L, r, tip):
    # a rounded armour segment (bevelled cylinder), an orange back plate (the outline read) and an orange hinge
    gcyl(pre + "seg", (0, L * 0.5, 0), r, max(0.1, L - r * 0.1), "yellow", joint, "y", 10, r * 0.45)
    gbox(pre + "seg_plate", (0, L * 0.52, r * 0.86), (1.3 * r, L * 0.62, 0.16 * r), "orange", joint, 0.03, 1)
    gcyl(pre + "hinge", (0, 0, 0), r * 0.6, 2.12 * r, "orange", joint, "x", 8, 0)
    if tip:
        gcyl(pre + "tip", (0, L - r * 0.12, 0), r * 0.92, r * 0.5, "orange", joint, "y", 10, r * 0.22)


def hand(name, sx):
    pre = "l_" if sx > 0 else "r_"
    h = gempty(name, root)
    palm = gempty(pre + "palm_g", h)
    gbox(pre + "palm", (0, 0, 0), (Pw, Ph, Pt), "yellow", palm, Pt * 0.38, 2)
    gbox(pre + "outline", (0, 0, -Pt * 0.1), (Pw * 1.05, Ph * 1.04, Pt * 0.62), "orange", palm, Pt * 0.28, 1)
    gbox(pre + "palm_pad", (0, Ph * 0.02, -Pt * 0.5), (Pw * 0.78, Ph * 0.7, 0.06 * R), "gun", palm, 0.04, 2)
    for k in range(4):
        gbox(pre + "grip", ((-0.3 + k * 0.2) * Pw, Ph * 0.02, -Pt * 0.54), (0.03 * R, Ph * 0.6, 0.03 * R), "dark", palm, 0)
    # back: armour housing, the core socket, pistons, bolts, knuckle bar
    gbox(pre + "back_plate", (0, -Ph * 0.02, Pt * 0.47), (Pw * 0.74, Ph * 0.7, 0.05 * R), "gun", palm, 0.04, 2)
    gtorus(pre + "core_socket", (0, -Ph * 0.02, Pt * 0.55), 0.1 * R, 0.022 * R, "steel", palm, "z", 20, 4)
    for s in (-1, 1):
        gcyl(pre + "piston", (s * Pw * 0.43, -Ph * 0.05, Pt * 0.42), 0.03 * R, Ph * 0.78, "steel", palm, "y", 8)
        gcyl(pre + "piston_sleeve", (s * Pw * 0.43, -Ph * 0.25, Pt * 0.42), 0.045 * R, Ph * 0.3, "gun", palm, "y", 8)
        for t in (-1, 1):
            gcyl(pre + "bolt", (s * Pw * 0.31, t * Ph * 0.3, Pt * 0.6), 0.02 * R, 0.03 * R, "steel", palm, "z", 8)
    gcyl(pre + "knuckle_bar", (0, Ph * 0.44, Pt * 0.3), 0.05 * R, Pw * 0.92, "orange", palm, "x", 14, 0.02)
    core = gempty(pre + "core_g", h)
    o = kit.cyl(pre + "core", G(0, -Ph * 0.02, Pt * 0.5), 0.085 * R, 0.06 * R, M["core"], h, "Y", 16, 0.02)
    o.name = o.data.name = pre + "core"
    for s, nm in ((-1, "a"), (1, "b")):
        v = kit.box(pre + "vent_" + nm, G(s * Pw * 0.17, -Ph * 0.02, Pt * 0.62), S(Pw * 0.33, Ph * 0.6, 0.06 * R), M["yellow"], h, 0.03, 2)
        v.name = v.data.name = pre + "vent_" + nm
        for k in range(5):
            kit.box(pre + "slat", G(0, (-0.24 + k * 0.12) * Ph, 0.035 * R), S(Pw * 0.26, 0.025 * R, 0.02 * R), M["dark"], v, 0, 1)
    # wrist cuff and thruster
    cuff = gempty(pre + "cuff", h, (0, -Ph * 0.56, 0))
    gcyl(pre + "cuff_body", (0, 0, 0), 0.16 * R, 0.13 * R, "gun", cuff, "y", 20, 0.01 * R, 0.18 * R)
    gtorus(pre + "cuff_ring", (0, 0.05 * R, 0), 0.165 * R, 0.02 * R, "orange", cuff, "y", 20, 4)
    gtorus(pre + "cuff_glow", (0, -0.03 * R, 0), 0.172 * R, 0.014 * R, "accent", cuff, "y", 20, 4)
    gcyl(pre + "nozzle", (0, -0.1 * R, 0), 0.1 * R, 0.08 * R, "steel", cuff, "y", 14, 0, 0.13 * R)
    gcyl(pre + "nozzle_glow", (0, -0.145 * R, 0), 0.085 * R, 0.01 * R, "accent", cuff, "y", 14)
    # fingers
    for i in range(4):
        par = h
        for j in range(3):
            loc = (sx * FX[i] * Pw * 0.5, Ph * 0.5 + FY[i] * R, 0) if j == 0 else (0, SEG[j - 1] * FL[i], 0)
            jn = gempty(f"{pre}f{i + 1}{'abc'[j]}", par, loc)
            segment(f"{pre}f{i + 1}{'abc'[j]}_", jn, SEG[j] * FL[i], FR[i] * (1 - j * 0.07), j == 2)
            par = jn
    # thumb (the base joint carries its rest angle about game z = Blender -y)
    par = h
    for j in range(2):
        if j == 0:
            jn = gempty(pre + "ta", par, (sx * 0.47 * Pw, -0.1 * Ph, -0.05 * Pt), (0, -sx * -0.95, 0))
        else:
            jn = gempty(pre + "tb", par, (0, TSEG[0], 0))
        segment(pre + "t" + "ab"[j] + "_", jn, TSEG[j], TR * (1 - j * 0.08), j == 1)
        par = jn
    gempty(pre + "impact", h, (0, 0, -Pt * 0.5))
    return h


hl = hand("hand_l", 1)
hr = hand("hand_r", -1)
hl.location = G(-12, 2, 4)
hr.location = G(12, 2, 4)

# the face paint carrier (the app copies its maps onto the procedural face)
sw = kit.plane("face_swatch", (0, -0.5, 0), 0.5, 0.5, face_m, root)

keep = {"l_core", "r_core", "l_vent_a", "l_vent_b", "r_vent_a", "r_vent_b", "face_swatch"}
finish(shell, keep)
finish(hl, keep)
finish(hr, keep)
print("TRIS shell", tris(shell), "hand_l", tris(hl), "hand_r", tris(hr))

# ------------------------------------------------------------------------------------------------ preview (Blender) + export
if not NOPREVIEW:
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#05080e"), 1)
    aim = kit.empty("_aim", None, G(0, 0.2 * R, 0))

    def light(name, kind, loc, energy, color=(1, 1, 1), size=6.0):
        d = bpy.data.lights.new(name, kind)
        d.energy, d.color = energy, color
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location = loc
        sc.collection.objects.link(o)
        o.constraints.new("TRACK_TO").target = aim
        return o

    light("_key", "AREA", G(-14, 18, 24), 90000, (1.0, 0.92, 0.8), 10)
    light("_rim", "AREA", G(20, 8, -18), 60000, lin("#5fd0ff"), 8)
    light("_fill", "AREA", G(10, -4, 26), 20000, (0.7, 0.8, 1.0), 10)
    disc = kit.cyl("_face_disc", G(0, 0, 0.55 * R), 0.99 * R, 0.02, face_m, None, "Y", 64)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    sc.collection.objects.link(cam)
    cam.constraints.new("TRACK_TO").target = aim
    sc.camera = cam
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 24
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    hl.location = G(-0.75 * R, -0.35 * R, 1.0 * R)
    hr.location = G(0.75 * R, -0.35 * R, 1.0 * R)

    def shot(name, loc, at, lens=40):
        cam.location = G(*loc)
        aim.location = G(*at)
        cam.data.lens = lens
        kit.render(os.path.join(PREV, f"boss-r4-blender-{name}.png"))

    shot("three-quarter-back", (-26, 10, -24), (0, 0.5, 0))
    shot("side", (34, 4, 6), (0, 0.5, 0))
    shot("hand", (-0.75 * R - 5, -0.35 * R + 3, 1.0 * R + 9), (-0.75 * R, -0.35 * R, 1.0 * R), 45)
    bpy.data.objects.remove(disc)
    hl.location = G(-12, 2, 4)
    hr.location = G(12, 2, 4)

kit.export(root, OUT, os.path.join(HERE, "boss.blend"))
