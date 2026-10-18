# ASCENT (Ending 2) second defender kit: the Hugger (rusher), the Warden (heavy emplacement) and the Maintainer (support drone).
# blender -b --factory-startup -P design/3d/end2/characters/extras_kit.py [--nopreview]
#   -> end2-char-extras-kit.glb (three roots, shared worn materials, same paint and gunmetal as defender_kit.py) + previews/
# Positions are written in GAME axes (x right, y up, z forward = where the defender looks) and converted: Blender (x, -z, y).
# Each root's origin is the logo face centre of its body group (hugger.body, maintainer.body) or the head pivot (warden.head);
# the app places the official logo badge itself (models.js / enemies-extra.js) and animates the named nodes:
#   hugger      : arm_l, arm_r (pivot = shoulder, rotate y), fore (child of each arm, pivot = elbow), coil_ring (3 per forearm), vent_glow
#   warden      : head (pivot), collar (spins), projector (coil_ring x5, lens_red), shutter_l/shutter_r (slide x), core_glow, core_ring_glow
#   maintainer  : halo (spins on y), emitter (spins, coil_ring x3, emit_glow), vent_glow, halo_glow
# Glow materials (the app drives emissiveIntensity / colour): coil_glow, vent_glow, core_glow, core_ring_glow, lens_red, emit_glow, halo_glow.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import bpy, bmesh
import numpy as np
from math import radians as rad, pi, sin, cos
from mathutils import Vector, Matrix
import kit
from kit import *

kit.reset("extras_kit", HERE)
sc = kit.sc

# ------------------------------------------------------------------------------------------------ materials (same paint as defender_kit.py)
M = dict(
    yellow=tmat("def_yellow", surface("def_yellow", "#e0a208", 201, chip=0.62, rust_amt=0.35, metal=0.35, rough=0.48, dirt=0.55, panel=2)),
    gun=tmat("def_gunmetal", surface("def_gunmetal", "#2a3038", 202, chip=0.7, rust_amt=0.4, metal=0.75, rough=0.4, dirt=0.4)),
    steel=tmat("def_steel", surface("def_steel", "#59616c", 203, chip=0.78, rust_amt=0.2, metal=0.9, rough=0.3, dirt=0.3)),
    rubber=mat("def_rubber", lin("#0e0f11"), 0.0, 0.85),
    dark=mat("def_dark", lin("#06080b"), 0.4, 0.6),
    coil=mat("coil_glow", lin("#3a1400"), 0.0, 0.4, em=lin("#ff8a1e"), strength=2.0),
    vent=mat("vent_glow", lin("#3a1c00"), 0.0, 0.4, em=lin("#ff9d00"), strength=2.0),
    core=mat("core_glow", lin("#3a1800"), 0.0, 0.3, em=lin("#ff8a1e"), strength=3.0),
    corering=mat("core_ring_glow", lin("#3a1800"), 0.0, 0.3, em=lin("#ffb040"), strength=2.5),
    lens=mat("lens_red", lin("#300408"), 0.0, 0.3, em=lin("#ff3b4e"), strength=2.5),
    emit=mat("emit_glow", lin("#3a2400"), 0.0, 0.4, em=lin("#ffc23a"), strength=2.2),
    halo=mat("halo_glow", lin("#3a2400"), 0.0, 0.4, em=lin("#ffd21e"), strength=1.6),
)


# ------------------------------------------------------------------------------------------------ helpers (game axes in, Blender out)
def G(x, y, z):
    return (x, -z, y)


def S(x, y, z):
    return (x, z, y)


LOD = [1.0]  # segment multiplier: small repeated defenders (hugger, maintainer) use fewer segments than the hero warden


def _sg(n):
    return max(6, int(round(n * LOD[0])))


def gbox(name, c, size, m, parent, bev=0.006, rot=None):
    """Box at game position c with game size (w, h, d); rot = Blender euler (rad)."""
    if min(size) < 0.075:
        bev = 0  # tiny parts stay sharp: bevels triple their triangles for nothing
    return kit.box(name, G(*c), S(*size), M[m], parent, bev, 1, rot)


def gcyl(name, c, r, length, m, parent, axis="z", seg=16, bev=0.0, r2=None):
    """Cylinder along a GAME axis (x | y | z)."""
    bax = {"x": "X", "y": "Z", "z": "Y"}[axis]
    return kit.cyl(name, G(*c), r, length, M[m], parent, bax, _sg(seg), bev, r2)


def gtorus(name, c, R, r, m, parent, axis="z", seg=28, rseg=6):
    bax = {"x": "X", "y": "Z", "z": "Y"}[axis]
    return kit.torus(name, G(*c), R, r, M[m], parent, bax, _sg(seg), max(4, min(rseg, 6)))


def gempty(name, parent, c=(0, 0, 0), rot=(0, 0, 0)):
    return kit.empty(name, parent, G(*c), rot)


def tris(group):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in group.children_recursive:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
    return n


def dome(name, c, r, depth, m, parent, seg=22, rings=10):
    seg, rings = _sg(seg), max(5, _sg(rings))
    """Half sphere bulging backwards (toward -z game = +Y Blender); the open front hides behind the logo."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=r)
    for v in bm.verts:
        v.co.y *= depth
    kill = [v for v in bm.verts if v.co.y < -0.0005]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    o = kit.mesh_obj(name, bm, M[m], parent, G(*c))
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def radial_box(name, a, R, z, tangent, depth, thick, m, parent, bev=0.008, cx=0.0, cy=0.0):
    """A plate lying on a cylinder around the game z axis at angle `a` (rad, clockwise from the top seen from the front)."""
    x, y = cx + R * sin(a), cy + R * cos(a)
    return kit.box(name, G(x, y, z), S(tangent, thick, depth), M[m], parent, bev, 2, (0, a, 0))


def finish(group, keep=()):
    """Apply modifiers and join every mesh under `group` that shares a (parent, material) pair (one draw call per material)."""
    kids = [c for c in group.children_recursive if c.type == "MESH" and c.name.split(".")[0] not in keep]
    for c in group.children_recursive:
        if c.type == "MESH" and c.name.split(".")[0] in keep:
            bpy.context.view_layer.objects.active = c
            for x in sc.objects:
                x.select_set(x == c)
            for m in list(c.modifiers):
                bpy.ops.object.modifier_apply(modifier=m.name)
    for o in kids:
        bpy.context.view_layer.objects.active = o
        for x in sc.objects:
            x.select_set(x == o)
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
    by = {}
    for o in kids:
        by.setdefault((o.parent, o.data.materials[0].name), []).append(o)
    for (par, mname), objs in by.items():
        if len(objs) < 2:
            objs[0].name = f"{par.name}_{mname}"
            continue
        for x in sc.objects:
            x.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        j.name = j.data.name = f"{par.name}_{mname}"


# ================================================================================================ HUGGER
# A rusher: the logo on a low armoured sled with two long clamp arms. Telegraph: three coil rings on each forearm light up
# from the elbow to the claw while the arms spread, the claw tips go white-hot at the lunge.
LOD[0] = 0.62
hug = kit.empty("hugger", None)
hbody = gempty("body", hug)
R_H = 0.32
dome("hull", (0, 0, -0.02), R_H, 0.95, "yellow", hbody)
gtorus("rim", (0, 0, -0.03), R_H, 0.032, "gun", hbody, "z", 36, 6)
gtorus("rim_trim", (0, 0, -0.065), R_H * 1.02, 0.012, "steel", hbody, "z", 36, 4)
# armour plating and the dorsal spine
for a in (-0.9, 0.9):
    radial_box("hull_plate", a, R_H * 0.93, -0.14, 0.2, 0.2, 0.025, "gun", hbody, 0.006)
gbox("spine", (0, R_H * 0.98, -0.14), (0.07, 0.07, 0.42), "gun", hbody, 0.012)
gbox("spine_cap", (0, R_H * 1.0 + 0.04, -0.14), (0.05, 0.02, 0.34), "yellow", hbody, 0.006)
for z in (-0.02, -0.14, -0.26):
    gbox("spine_rib", (0, R_H * 1.0 + 0.03, z), (0.09, 0.05, 0.03), "steel", hbody, 0.004)
gbox("sensor", (0, R_H * 1.0 + 0.1, 0.02), (0.035, 0.05, 0.035), "lens", hbody, 0.004)
# rear thruster pod
gcyl("pod", (0, -0.02, -0.4), 0.15, 0.2, "gun", hbody, "z", 18, 0.01)
gcyl("pod_cap", (0, -0.02, -0.51), 0.17, 0.03, "steel", hbody, "z", 18, 0.004)
gcyl("pod_vent", (0, -0.02, -0.535), 0.115, 0.02, "vent", hbody, "z", 16)
for i in range(6):
    a = i * pi / 3
    gbox("pod_fin", (0.13 * sin(a), -0.02 + 0.13 * cos(a), -0.4), (0.025, 0.05, 0.16), "steel", hbody, 0.003, (0, a, 0))
# sled: chassis, skid plates, hazard nose, struts, twin thrusters
gbox("sled", (0, -0.42, -0.12), (0.62, 0.12, 0.9), "gun", hbody, 0.02)
for s in (-1, 1):
    gbox("skid", (s * 0.325, -0.44, -0.1), (0.04, 0.1, 0.82), "yellow", hbody, 0.008)
    gcyl("nozzle", (s * 0.2, -0.42, -0.6), 0.075, 0.12, "steel", hbody, "z", 14, 0.004)
    gcyl("nozzle_glow", (s * 0.2, -0.42, -0.665), 0.058, 0.02, "vent", hbody, "z", 12)
    gbox("strut", (s * 0.15, -0.3, -0.1), (0.05, 0.2, 0.14), "steel", hbody, 0.008)
gbox("nose", (0, -0.43, 0.34), (0.5, 0.07, 0.06), "yellow", hbody, 0.01)
for i in range(5):
    gbox("nose_stripe", (-0.2 + i * 0.1, -0.43, 0.372), (0.04, 0.06, 0.012), "dark", hbody, 0.001)
for z in (-0.35, 0.05):
    gbox("sled_panel", (0, -0.355, z), (0.4, 0.02, 0.2), "steel", hbody, 0.004)

# clamp arms
for s, sn in ((-1, "l"), (1, "r")):
    sh = gempty(f"arm_{sn}", hug, (s * R_H * 0.95, -0.05 + 0.0, 0.0))
    # body-relative: the app parents arms to `body`; the glb stores them under the root at body-relative coordinates
    gbox("shoulder", (0, 0, 0.02), (0.17, 0.2, 0.22), "yellow", sh, 0.02)
    gcyl("shoulder_joint", (0, 0, 0.0), 0.075, 0.2, "steel", sh, "y", 14, 0.004)
    gbox("upper", (0, 0, 0.3), (0.11, 0.11, 0.5), "gun", sh, 0.012)
    gbox("upper_plate", (0, 0.065, 0.3), (0.12, 0.03, 0.4), "yellow", sh, 0.008)
    gbox("piston", (s * 0.075, -0.02, 0.28), (0.035, 0.035, 0.44), "steel", sh, 0.004)
    fore = gempty(f"fore_{sn}", sh, (0, 0, 0.58))
    gcyl("elbow", (0, 0, 0.0), 0.065, 0.14, "steel", fore, "y", 14, 0.004)
    gbox("forearm", (0, 0, 0.2), (0.095, 0.095, 0.4), "steel", fore, 0.01)
    gbox("forearm_top", (0, 0.055, 0.2), (0.1, 0.02, 0.3), "gun", fore, 0.006)
    for i, z in enumerate((0.1, 0.2, 0.3)):
        gtorus("coil_ring", (0, 0, z), 0.074, 0.011, "coil", fore, "z", 18, 5)
    # claw: palm and two inward-curving finger blades; tips glow with the coil
    gbox("palm", (-s * 0.02, 0, 0.44), (0.17, 0.2, 0.1), "yellow", fore, 0.012)
    for dy, nm in ((0.07, "finger_top"), (-0.07, "finger_bot")):
        gbox(nm, (-s * 0.06, dy, 0.54), (0.05, 0.05, 0.16), "gun", fore, 0.008, (0, 0, -s * rad(18)))
        gbox(nm + "_tip", (-s * 0.085, dy, 0.63), (0.04, 0.04, 0.045), "coil", fore, 0.002)
finish(hug, keep=("coil_ring",))
print("TRIS hugger", tris(hug))

# ================================================================================================ WARDEN
# Heavy emplacement. Tripod and swivel base, a gunmetal drum with yellow armour, a beam cannon under the face (five coil rings
# charge toward the muzzle), and the weak point on the BACK: a hazard-ringed hatch with an orange core you see through a
# louvred slit; when it vents, the shutters slide away and the whole disc blazes.
LOD[0] = 0.85
war = kit.empty("warden", None)
base = gempty("base", war)
# tripod: three legs, hydraulic rams, foot pads with hazard caps; a bearing hub the head swivels on
gcyl("hub", (0, 0.95, 0), 0.45, 0.6, "gun", base, "y", 22, 0.02)
gcyl("hub_ring", (0, 1.12, 0), 0.52, 0.06, "yellow", base, "y", 26, 0.008)
gcyl("hub_bearing", (0, 1.22, 0), 0.6, 0.1, "steel", base, "y", 26, 0.008)
gcyl("hub_foot", (0, 0.68, 0), 0.5, 0.06, "steel", base, "y", 22, 0.006)
for i in range(3):
    leg = gempty(f"leg_{i}", base, (0, 0, 0), (0, 0, -(i * 2 * pi / 3 + pi / 6)))
    # leg frame: points toward +z game, leaning down from the hub to the foot
    A, B = Vector((0, 0.95, 0.32)), Vector((0, 0.1, 1.45))
    d = B - A
    ln = d.length
    th = float(np.arctan2(-d.y, d.z))  # rotation about the game x axis that lays the box along the leg
    mid = (A + B) / 2
    kit.box("strut", G(*mid), S(0.2, 0.2, ln), M["gun"], leg, 0.02, 2, (th, 0, 0))
    kit.box("strut_plate", G(mid.x, mid.y + 0.115 * cos(th), mid.z - 0.115 * sin(th) * -1), S(0.22, 0.04, ln * 0.7), M["yellow"], leg, 0.008, 2, (th, 0, 0))
    gcyl("knee", (0, mid.y, mid.z), 0.13, 0.3, "steel", leg, "x", 14, 0.008)
    # hydraulic ram: a thinner cylinder beside the strut
    ram = gcyl("ram", (0.17, mid.y + 0.04, mid.z - 0.04), 0.035, ln * 0.8, "steel", leg, "z", 10)
    ram.rotation_euler = (th, 0, 0)
    # foot pad with a hazard cap and two ground spikes
    gbox("foot", (0, 0.05, 1.58), (0.44, 0.1, 0.62), "gun", leg, 0.02)
    gbox("foot_cap", (0, 0.108, 1.6), (0.4, 0.025, 0.4), "yellow", leg, 0.006)
    for x in (-0.15, 0.15):
        gcyl("spike", (x, 0.02, 1.9), 0.035, 0.16, "steel", leg, "z", 6, 0, 0.0)

# head: pivot at the logo centre height
head = gempty("head", war, (0, 1.6, 0))
gcyl("drum", (0, 0, -0.35), 0.85, 1.0, "gun", head, "z", 30, 0.02)
for zz in (-0.08, -0.46, -0.8):
    gtorus("drum_ring", (0, 0, zz), 0.858, 0.03, "steel", head, "z", 36, 5)
for i in range(8):
    a = i * pi / 4 + pi / 8
    radial_box("armour", a, 0.865, -0.46, 0.5, 0.58, 0.05, "yellow" if i % 2 == 0 else "steel", head, 0.01)
for i in range(8):
    a = i * pi / 4
    radial_box("armour_seam", a, 0.87, -0.46, 0.04, 0.62, 0.06, "dark", head, 0.002)
# front collar (spins) with bolt heads
collar = gempty("collar", head, (0, 0, 0.16))
gtorus("collar_ring", (0, 0, 0), 0.7, 0.11, "gun", collar, "z", 40, 8)
for i in range(12):
    a = i * pi / 6
    gcyl("collar_bolt", (0.7 * sin(a), 0.7 * cos(a), 0.09), 0.032, 0.05, "steel", collar, "z", 8)
gtorus("collar_trim", (0, 0, 0.11), 0.7, 0.035, "yellow", head, "z", 40, 6)
# swivel yokes and side plates
for s in (-1, 1):
    gcyl("trunnion", (s * 0.98, 0, -0.3), 0.13, 0.3, "steel", head, "x", 16, 0.006)
    gcyl("trunnion_cap", (s * 1.15, 0, -0.3), 0.08, 0.06, "yellow", head, "x", 12, 0.004)
    gbox("yoke", (s * 1.0, -0.55, -0.3), (0.16, 0.7, 0.24), "gun", head, 0.02)
    plate = gbox("side_plate", (s * 0.9, 0.0, 0.05), (0.2, 1.25, 0.2), "yellow", head, 0.02)
    plate.rotation_euler = (0, 0, s * 0.35)
    for k in range(4):
        gbox("plate_chev", (s * 0.97, -0.4 + k * 0.28, 0.17), (0.04, 0.12, 0.03), "dark", head, 0.002, (0, 0, s * 0.35))
# dorsal power block
gbox("dorsal", (0, 0.95, -0.38), (0.78, 0.2, 0.72), "yellow", head, 0.02)
gbox("dorsal_vent", (0, 1.06, -0.38), (0.6, 0.03, 0.5), "dark", head, 0.004)
for i in range(6):
    gbox("dorsal_fin", (0, 1.075, -0.58 + i * 0.075), (0.58, 0.04, 0.025), "steel", head, 0.003)
kit.wire("antenna", [Vector(G(0.28, 1.02, -0.6)), Vector(G(0.3, 1.5, -0.62)), Vector(G(0.28, 1.9, -0.62))], 0.01, M["rubber"], head, res=3)
gbox("lamp", (0.28, 1.92, -0.62), (0.04, 0.05, 0.04), "lens", head, 0.004)

# beam cannon under the face
proj = gempty("projector", head, (0, -0.69, 0.3))
gcyl("housing", (0, 0, 0.2), 0.17, 0.72, "gun", proj, "z", 20, 0.012)
for z in (-0.05, 0.1, 0.25, 0.4, 0.52):
    gtorus("coil_ring", (0, 0, z), 0.2, 0.017, "coil", proj, "z", 22, 5)
for s in (-1, 1):
    gcyl("cap", (s * 0.29, 0, 0.2), 0.06, 0.55, "steel", proj, "z", 12, 0.004)
    gbox("cap_bracket", (s * 0.2, 0, 0.0), (0.12, 0.06, 0.07), "gun", proj, 0.008)
    gbox("cap_bracket", (s * 0.2, 0, 0.4), (0.12, 0.06, 0.07), "gun", proj, 0.008)
    for z in (0.05, 0.2, 0.35):
        gtorus("coil_ring", (s * 0.29, 0, z), 0.066, 0.011, "coil", proj, "z", 12, 4)
gcyl("shroud", (0, 0, 0.52), 0.215, 0.14, "steel", proj, "z", 20, 0.008)
gcyl("muzzle", (0, 0, 0.6), 0.235, 0.06, "gun", proj, "z", 20, 0.008)
gcyl("lens", (0, 0, 0.635), 0.12, 0.012, "lens", proj, "z", 16)
for i in range(4):
    a = i * pi / 2 + pi / 4
    gbox("fin", (0.17 * sin(a), 0.17 * cos(a), 0.05), (0.025, 0.06, 0.2), "steel", proj, 0.003, (0, a, 0))

# the weak point on the back
GZ = -0.88
gcyl("flange", (0, 0, GZ - 0.02), 0.66, 0.08, "steel", head, "z", 30, 0.01)
gtorus("flange_hazard", (0, 0, GZ - 0.07), 0.6, 0.045, "yellow", head, "z", 32, 6)
gcyl("well", (0, 0, GZ - 0.07), 0.52, 0.03, "dark", head, "z", 28)
gcyl("core_disc", (0, 0, GZ - 0.095), 0.4, 0.035, "core", head, "z", 28)
gtorus("core_ring_inner", (0, 0, GZ - 0.125), 0.27, 0.02, "corering", head, "z", 26, 5)
gtorus("core_ring_outer", (0, 0, GZ - 0.125), 0.45, 0.02, "corering", head, "z", 28, 5)
for i in range(8):
    a = i * pi / 4 + pi / 8
    radial_box("core_cage", a, 0.43, GZ - 0.11, 0.03, 0.04, 0.03, "gun", head, 0.003)
# four chevrons pointing at the core (weak-point read from a distance)
for k in range(4):
    a = k * pi / 2
    phi = pi - a
    base_pts = [(-0.17, -0.1), (0.0, 0.1), (0.17, -0.1), (0.0, -0.03)]
    pts = [(x * cos(phi) - y * sin(phi), x * sin(phi) + y * cos(phi)) for x, y in base_pts]
    kit.prism(f"chevron_{k}", pts, -0.012, 0.012, M["yellow"], head, 0.003, G(0.8 * sin(a), 0.8 * cos(a), GZ - 0.075))
# louvred shutters (slide apart on venting)
for s, nm in ((-1, "l"), (1, "r")):
    sh = gempty(f"shutter_{nm}", head, (s * 0.26, 0, GZ - 0.17))
    gbox("shutter_plate", (0, 0, 0), (0.5, 0.96, 0.05), "gun", sh, 0.012)
    gbox("shutter_hazard", (s * 0.12, 0, -0.03), (0.2, 0.9, 0.012), "yellow", sh, 0.003)
    for k in range(5):
        gbox("shutter_louver", (-s * 0.02, -0.36 + k * 0.18, -0.035), (0.46, 0.035, 0.02), "steel", sh, 0.003)
finish(war, keep=("coil_ring",))
print("TRIS warden", tris(war))

# ================================================================================================ MAINTAINER
# Support drone: logo under a rotating service halo, folded tool arms, rear nacelles, and a three-prong emitter on a telescoping
# stalk. Telegraph: three coil rings around the emitter crystal light up from the top down while it heals.
LOD[0] = 0.62
mnt = kit.empty("maintainer", None)
mbody = gempty("body", mnt)
R_M = 0.364
dome("hull", (0, 0, -0.02), R_M, 0.95, "yellow", mbody)
gtorus("rim", (0, 0, -0.03), R_M, 0.03, "gun", mbody, "z", 34, 6)
gtorus("rim_trim", (0, 0, -0.062), R_M * 1.02, 0.011, "steel", mbody, "z", 34, 4)
for a in (-1.0, 1.0):
    radial_box("hull_plate", a, R_M * 0.94, -0.16, 0.2, 0.2, 0.025, "gun", mbody, 0.006)
# belly pod and telescoping stalk
gcyl("belly", (0, -R_M * 0.78, -0.05), 0.15, 0.22, "gun", mbody, "y", 18, 0.01)
gcyl("belly_band", (0, -R_M * 0.78 - 0.05, -0.05), 0.158, 0.03, "yellow", mbody, "y", 18, 0.004)
gcyl("stalk_a", (0, -R_M - 0.1, -0.05), 0.058, 0.26, "steel", mbody, "y", 12, 0.003)
gcyl("stalk_b", (0, -R_M - 0.34, -0.05), 0.04, 0.26, "gun", mbody, "y", 10, 0.003)
gcyl("stalk_collar", (0, -R_M - 0.2, -0.05), 0.07, 0.03, "yellow", mbody, "y", 12, 0.003)
# service halo: flat ring above the head that spins around y
halo = gempty("halo", mbody, (0, R_M + 0.28, -0.05))
gtorus("halo_ring", (0, 0, 0), 0.42, 0.034, "gun", halo, "y", 36, 6)
gtorus("halo_glow", (0, 0.004, 0), 0.42, 0.02, "halo", halo, "y", 36, 5)
gtorus("halo_inner", (0, -0.03, 0), 0.38, 0.012, "steel", halo, "y", 36, 4)
for i in range(4):
    a = i * pi / 2
    gbox("halo_node", (0.42 * sin(a), 0, 0.42 * cos(a)), (0.1, 0.1, 0.1), "gun", halo, 0.015, (0, 0, 0))
    gbox("halo_lamp", (0.42 * sin(a), 0.058, 0.42 * cos(a)), (0.05, 0.02, 0.05), "halo", halo, 0.002)
    gbox("halo_spoke", (0.2 * sin(a), 0, 0.2 * cos(a)), (0.03, 0.025, 0.4), "steel", halo, 0.003, (0, a, 0))
gcyl("halo_hub", (0, -0.15, 0), 0.05, 0.28, "steel", halo, "y", 10, 0.003)
# emitter head (spins): crystal, three prongs, three coil rings that light while healing
em = gempty("emitter", mbody, (0, -R_M - 0.62, -0.05))
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.09, radius2=0.0, depth=0.12)
o = kit.mesh_obj("crystal_top", bm, M["emit"], em, G(0, 0.0, 0))
o.rotation_euler = (0, 0, 0)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0, radius2=0.09, depth=0.1)
kit.mesh_obj("crystal_bot", bm, M["emit"], em, G(0, -0.11, 0))
for i, y in enumerate((0.07, 0.16, 0.25)):
    gtorus("coil_ring", (0, y, 0), 0.085 - i * 0.004, 0.011, "coil", em, "y", 16, 5)
for i in range(3):
    a = i * 2 * pi / 3
    gbox("prong", (0.11 * sin(a), 0.0, 0.11 * cos(a)), (0.03, 0.34, 0.03), "gun", em, 0.005, (0, a, 0))
    gbox("prong_tip", (0.11 * sin(a), -0.15, 0.11 * cos(a)), (0.045, 0.04, 0.045), "yellow", em, 0.004, (0, a, 0))
gcyl("emitter_mount", (0, 0.33, 0), 0.06, 0.06, "steel", em, "y", 10, 0.003)
# folded tool arms
for s in (-1, 1):
    gcyl("arm_joint", (s * 0.37, -0.1, -0.06), 0.045, 0.1, "steel", mbody, "x", 12, 0.003)
    up = gbox("arm_upper", (s * 0.4, -0.22, -0.04), (0.06, 0.2, 0.06), "gun", mbody, 0.008)
    gbox("arm_plate", (s * 0.43, -0.22, -0.04), (0.02, 0.15, 0.05), "yellow", mbody, 0.004)
    gbox("arm_fore", (s * 0.35, -0.37, 0.02), (0.05, 0.05, 0.2), "steel", mbody, 0.006)
    gbox("claw", (s * 0.33, -0.37, 0.14), (0.05, 0.05, 0.06), "yellow", mbody, 0.006)
    gbox("claw_tip", (s * 0.315, -0.37, 0.18), (0.012, 0.04, 0.04), "steel", mbody, 0.002)
    gbox("claw_tip", (s * 0.345, -0.37, 0.18), (0.012, 0.04, 0.04), "steel", mbody, 0.002)
# rear nacelles (the drone hovers on them)
for s in (-1, 1):
    gcyl("nacelle", (s * 0.22, 0.05, -0.34), 0.085, 0.24, "gun", mbody, "z", 14, 0.008)
    gcyl("nacelle_cap", (s * 0.22, 0.05, -0.47), 0.09, 0.025, "steel", mbody, "z", 14, 0.003)
    gcyl("vent_glow", (s * 0.22, 0.05, -0.49), 0.062, 0.02, "vent", mbody, "z", 12)
    gbox("nacelle_band", (s * 0.22, 0.05, -0.28), (0.1, 0.18, 0.03), "yellow", mbody, 0.004)
finish(mnt, keep=("coil_ring",))
print("TRIS maintainer", tris(mnt))

# ------------------------------------------------------------------------------------------------ previews + export
root = kit.empty("end2-char-extras-kit", None)
for r in (hug, war, mnt):
    r.parent = root
    r.location = (0, 0, 0)

if "--nopreview" not in sys.argv:
    kit.stage((0, 0, 0), (2, -3, 0.6))
    for n in ("_wall", "_floor"):
        bpy.data.objects.remove(bpy.data.objects[n])
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 24
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    cam = sc.camera
    aim = bpy.data.objects["_aim"]
    PREV = os.path.join(HERE, "..", "previews")
    # the hugger and maintainer bodies are logo-less here (the app adds the badge); show a stand-in disc
    for rname, body_name in (("hugger", "body"), ("maintainer", "body")):
        pass

    def shot(name, show, loc, at, lens=45):
        for r in (hug, war, mnt):
            r.location = (0, 0, 0) if r == show else (60, 0, 0)
        cam.location, aim.location, cam.data.lens = loc, at, lens
        kit.render(os.path.join(PREV, f"characters-r2-{name}.png"))

    # Blender camera positions are in Blender axes (x, -z, y)
    shot("hugger-3q", hug, (1.6, -1.8, 0.4), (0, 0.1, 0.0), 42)
    shot("hugger-side", hug, (2.4, -0.2, 0.3), (0, 0.0, 0.0), 40)
    shot("warden-3q", war, (3.4, -4.2, 2.6), (0, 0, 1.2), 40)
    shot("warden-back", war, (-2.8, 4.2, 2.4), (0, 0, 1.3), 40)
    shot("maintainer-3q", mnt, (1.8, -1.9, 0.3), (0, 0, -0.1), 42)
    shot("maintainer-side", mnt, (2.6, -0.4, -0.2), (0, 0, -0.2), 40)

kit.export(root, os.path.join(HERE, "end2-char-extras-kit.glb"), os.path.join(HERE, "extras_kit.blend"))
