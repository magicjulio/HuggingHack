# ASCENT (Ending 2) defender weapons: the gunner's breacher blaster and the shield-bearer's hard-light tower shield.
# blender -b --factory-startup -P design/3d/end2/characters/defender_kit.py
#   -> end2-char-defender-kit.glb (both pieces, shared worn materials) + previews/
# Axes: Blender Z up, FRONT = -Y (glTF +Z, the way a defender faces in game). Metres. Origins:
#   gun    = the hand grip point; the bore runs along -Y.   nodes: gun > body, coil, barrel (slides back on recoil), muzzle, cell
#   shield = the shield's centre; the rail on +X is the hinge. nodes: shield > frame, pane (hard-light, material swapped in code),
#            emitters, hinge (empty at the hinge pin)
# Glow materials (the app drives emissiveIntensity / colour): coil_glow, muzzle_glow, cell_glow, lens_red, emit_glow, emit_strip.
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "..", "lib"))
import bpy, bmesh
import numpy as np
from math import radians as rad, pi, sin, cos
from mathutils import Vector
import kit
from kit import *

kit.reset("defender_kit", HERE)
sc = kit.sc

# ------------------------------------------------------------------------------------------------ materials
M = dict(
    yellow=tmat("def_yellow", surface("def_yellow", "#e0a208", 201, chip=0.62, rust_amt=0.35, metal=0.35, rough=0.48, dirt=0.55, panel=2)),
    gun=tmat("def_gunmetal", surface("def_gunmetal", "#2a3038", 202, chip=0.7, rust_amt=0.4, metal=0.75, rough=0.4, dirt=0.4)),
    steel=tmat("def_steel", surface("def_steel", "#59616c", 203, chip=0.78, rust_amt=0.2, metal=0.9, rough=0.3, dirt=0.3)),
    rubber=mat("def_rubber", lin("#0e0f11"), 0.0, 0.85),
    dark=mat("def_dark", lin("#06080b"), 0.4, 0.6),
    coil=mat("coil_glow", lin("#3a1400"), 0.0, 0.4, em=lin("#ff8a1e"), strength=2.0),
    muzzle=mat("muzzle_glow", lin("#3a1400"), 0.0, 0.4, em=lin("#ff8a1e"), strength=2.0),
    cell=mat("cell_glow", lin("#3a2200"), 0.0, 0.4, em=lin("#ffb020"), strength=1.6),
    lens=mat("lens_red", lin("#300408"), 0.0, 0.3, em=lin("#ff3b4e"), strength=2.5),
    emit=mat("emit_glow", lin("#3a2400"), 0.0, 0.4, em=lin("#ffc23a"), strength=2.2),
    strip=mat("emit_strip", lin("#3a2400"), 0.0, 0.4, em=lin("#ffb020"), strength=2.0),
)
pane_m = mat("pane", lin("#2a1a00"), 0.0, 0.2, em=lin("#ffad03"), strength=1.0)
M["pane"] = pane_m


# ------------------------------------------------------------------------------------------------ helpers
_box = kit.box


def box(name, center, size, material, parent, bev=0.006, seg=1, rot=None):
    return _box(name, center, size, material, parent, bev, seg, rot)


def tris(group):
    dg = bpy.context.evaluated_depsgraph_get()
    n = 0
    for o in group.children_recursive:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            n += len(me.loop_triangles)
    return n


def Y(f):
    return -f  # "forward distance" to a Blender y


def arc_sweep(name, R, a0, a1, z0, z1, t_in, t_out, material, parent, seg=18, bev=0.006):
    """Rectangular bar swept along a vertical arc of radius R (centre at y=+R, so the middle bulges to -Y = the front)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        pts = []
        for r, z in ((R - t_in, z0), (R + t_out, z0), (R + t_out, z1), (R - t_in, z1)):
            pts.append(bm.verts.new((r * sin(a), R - r * cos(a), z)))
        rings.append(pts)
    for i in range(seg):
        for k in range(4):
            bm.faces.new((rings[i][k], rings[i + 1][k], rings[i + 1][(k + 1) % 4], rings[i][(k + 1) % 4]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, material, parent), bev)


def arc_pt(R, a, z, r_off=0.0):
    r = R + r_off
    return (r * sin(a), R - r * cos(a), z)


def finish(group, keep=()):
    """Apply modifiers and join every mesh under `group` that shares a material (one draw call per material)."""
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


# ================================================================================================ GUN
gun = empty("gun", None)
body = empty("body", gun)
coil = empty("coil", gun)
barrel = empty("barrel", gun, (0, Y(0.74), 0))   # slides along +Y on recoil
cell = empty("cell", gun)

# receiver
box("receiver", (0, Y(0.12), -0.03), (0.19, 0.5, 0.2), M["gun"], body, 0.012)
box("top_plate", (0, Y(0.12), 0.088), (0.215, 0.46, 0.045), M["yellow"], body, 0.01)
for s in (-1, 1):
    box("side_plate", (s * 0.103, Y(0.15), -0.025), (0.014, 0.34, 0.15), M["yellow"], body, 0.006)
    box("side_plate_rear", (s * 0.099, Y(-0.06), -0.005), (0.012, 0.12, 0.17), M["steel"], body, 0.004)
    for i in range(4):
        box("vent", (s * 0.098, Y(0.0 + i * 0.07), -0.095), (0.012, 0.035, 0.04), M["dark"], body, 0.002)
# rear block + butt pad (tucked into the logo's hands)
box("rear", (0, Y(-0.145), -0.01), (0.17, 0.12, 0.22), M["steel"], body, 0.012)
box("butt_pad", (0, Y(-0.215), -0.01), (0.15, 0.03, 0.2), M["rubber"], body, 0.01)
for i in range(5):
    box("heatsink", (0, Y(-0.06 + i * 0.045), 0.125), (0.1, 0.012, 0.03), M["steel"], body, 0.002)
# grips
g = box("grip", (0, Y(-0.02), -0.2), (0.075, 0.1, 0.2), M["rubber"], body, 0.015)
g.rotation_euler = (rad(-14), 0, 0)
box("trigger_guard", (0, Y(0.07), -0.145), (0.03, 0.12, 0.012), M["steel"], body, 0.004)
box("trigger", (0, Y(0.05), -0.13), (0.012, 0.014, 0.05), M["dark"], body, 0.002)
box("foregrip", (0, Y(0.42), -0.15), (0.075, 0.075, 0.17), M["steel"], body, 0.012)
box("foregrip_rubber", (0, Y(0.42), -0.17), (0.082, 0.08, 0.1), M["rubber"], body, 0.012)
# top rail + red optic
box("rail", (0, Y(0.2), 0.12), (0.05, 0.34, 0.016), M["steel"], body, 0.003)
box("optic", (0, Y(0.2), 0.16), (0.065, 0.12, 0.065), M["dark"], body, 0.01)
box("optic_hood", (0, Y(0.14), 0.19), (0.07, 0.05, 0.01), M["steel"], body, 0.002)
box("lens_red", (0, Y(0.262), 0.16), (0.045, 0.008, 0.04), M["lens"], body, 0.001)
# power cell under the receiver
box("cell_body", (0, Y(0.2), -0.18), (0.15, 0.2, 0.15), M["dark"], cell, 0.012)
for s in (-1, 1):
    box("cell_cap", (0, Y(0.2 + s * 0.108), -0.18), (0.16, 0.022, 0.16), M["yellow"], cell, 0.006)
    box("cell_glow", (s * 0.076, Y(0.2), -0.18), (0.006, 0.14, 0.09), M["cell"], cell, 0.001)
# shroud + fins
cyl("shroud", (0, Y(0.58), 0.0), 0.082, 0.42, M["gun"], body, "Y", 16, 0.003)
for f in (0.38, 0.48, 0.58, 0.68, 0.77):
    cyl("fin", (0, Y(f), 0.0), 0.095, 0.03, M["steel"], body, "Y", 14, 0.002)
box("shroud_top", (0, Y(0.57), 0.08), (0.08, 0.34, 0.03), M["yellow"], body, 0.008)
# the charge coil: glowing rings around the shroud + two side capacitors (this is what the wind-up lights)
for f in (0.43, 0.53, 0.63, 0.72):
    torus("coil_ring", (0, Y(f), 0), 0.097, 0.012, M["coil"], coil, "Y", 20, 5)
for s in (-1, 1):
    cyl("cap", (s * 0.125, Y(0.5), 0.0), 0.034, 0.3, M["steel"], body, "Y", 14, 0.003)
    cyl("cap_bracket", (s * 0.1, Y(0.4), 0.0), 0.02, 0.05, M["gun"], body, "X", 8)
    cyl("cap_bracket", (s * 0.1, Y(0.62), 0.0), 0.02, 0.05, M["gun"], body, "X", 8)
    for f in (0.4, 0.5, 0.6):
        torus("cap_band", (s * 0.125, Y(f), 0), 0.036, 0.009, M["coil"], coil, "Y", 12, 4)
# cables
wire("cable", [Vector((0.03, Y(0.2), -0.2)), Vector((0.11, Y(0.3), -0.14)), Vector((0.125, Y(0.38), -0.04))], 0.007, M["rubber"], body, res=3)
wire("cable", [Vector((-0.03, Y(0.2), -0.2)), Vector((-0.11, Y(0.3), -0.14)), Vector((-0.125, Y(0.38), -0.04))], 0.007, M["rubber"], body, res=3)
# sliding barrel + brake
cyl("barrel_core", (0, Y(0.135), 0), 0.043, 0.27, M["steel"], barrel, "Y", 16, 0.002)
box("brake", (0, Y(0.225), 0), (0.125, 0.12, 0.125), M["gun"], barrel, 0.014)
box("brake_top", (0, Y(0.225), 0.052), (0.127, 0.12, 0.022), M["yellow"], barrel, 0.006)
for s in (-1, 1):
    for i in range(2):
        box("port", (s * 0.064, Y(0.19 + i * 0.05), 0.0), (0.014, 0.025, 0.08), M["dark"], barrel, 0.002)
torus("muzzle_glow", (0, Y(0.286), 0), 0.046, 0.011, M["muzzle"], barrel, "Y", 20, 6)
cyl("bore", (0, Y(0.289), 0), 0.03, 0.012, M["dark"], barrel, "Y", 14)
empty("muzzle", gun, (0, Y(1.04), 0))
empty("grip_point", gun, (0, 0, 0))
finish(gun, keep=("coil_ring",))

# ================================================================================================ SHIELD
R = 1.6
TH = 0.43                                    # half-angle of the pane arc
HX = R * sin(TH) + 0.07                      # hinge pin x (outer face of the +X rail)
shield = empty("shield", None, (5.0, 0, 0))  # placed apart from the gun
frame = empty("frame", shield)
emitters = empty("emitters", shield)
paneg = empty("pane_group", shield)

# top and bottom bars: emitter housings
arc_sweep("top_bar", R, -TH - 0.04, TH + 0.04, 0.70, 0.90, 0.10, 0.07, M["gun"], frame, 20, 0.01)
arc_sweep("top_cap", R, -TH - 0.04, TH + 0.04, 0.86, 0.92, 0.05, 0.085, M["yellow"], frame, 20, 0.008)
arc_sweep("bot_bar", R, -TH - 0.04, TH + 0.04, -0.94, -0.68, 0.10, 0.07, M["gun"], frame, 20, 0.01)
arc_sweep("kick_plate", R, -TH - 0.04, TH + 0.04, -0.94, -0.80, 0.04, 0.095, M["yellow"], frame, 20, 0.008)
# side rails (hinge = +X) with ribbing
for s in (-1, 1):
    a = s * TH
    x, y, _ = arc_pt(R, a, 0)
    rail = box("rail", (x, y, -0.02), (0.15, 0.17, 1.84), M["gun"], frame, 0.012)
    rail.rotation_euler = (0, 0, a)
    face = box("rail_face", arc_pt(R, a, 0.0, 0.085), (0.1, 0.03, 1.5), M["steel"], frame, 0.006)
    face.location = Vector(arc_pt(R, a, 0.0, 0.085))
    face.rotation_euler = (0, 0, a)
    for z in np.linspace(-0.62, 0.62, 6):
        rib = box("rib", arc_pt(R, a, z, 0.092), (0.13, 0.02, 0.05), M["yellow"] if int(round(z * 10)) % 2 == 0 else M["steel"], frame, 0.004)
        rib.rotation_euler = (0, 0, a)
    # corner blocks
    for z in (-0.86, 0.84):
        c = box("corner", arc_pt(R, a, z, 0.04), (0.2, 0.2, 0.2), M["steel"], frame, 0.02)
        c.rotation_euler = (0, 0, a)
        bolt = cyl("bolt", arc_pt(R, a, z, 0.15), 0.025, 0.02, M["dark"], frame, "Y", 8)
        bolt.rotation_euler = (rad(90) + 0, 0, 0)
# hinge knuckles on the +X rail
hx, hy, _ = arc_pt(R, TH, 0, 0.0)
for z in (-0.62, 0.0, 0.62):
    k = cyl("knuckle", (hx + 0.06, hy + 0.04, z), 0.055, 0.2, M["steel"], frame, "Z", 14, 0.004)
cyl("hinge_pin", (hx + 0.06, hy + 0.04, 0.0), 0.022, 1.7, M["dark"], frame, "Z", 8)
empty("hinge", shield, (hx + 0.06, hy + 0.04, 0.0))
# latch on the -X rail
lx, ly, _ = arc_pt(R, -TH, 0, 0.1)
box("latch", (lx, ly, 0.05), (0.08, 0.05, 0.2), M["yellow"], frame, 0.008).rotation_euler = (0, 0, -TH)
# kick plate chevrons (hazard)
for i in range(7):
    x0 = -0.64 + i * 0.2
    a = x0 / R
    p = arc_pt(R, a, -0.87, 0.1)
    ch = box("chevron", p, (0.07, 0.012, 0.13), M["dark"], frame, 0.001)
    ch.rotation_euler = (0, rad(0), a - rad(22) * 0)
    ch.rotation_euler = (0, 0, a)
    # slant via a tilted copy of the stripe (shear approximated by Y rotation of a thin box)
# back side: grab bar + standoffs (what the logo's hands hold) and a power cell behind the top bar
for s in (-1, 1):
    px, py, _ = arc_pt(R, s * 0.16, -0.3, -0.2)
    cyl("standoff", (px, py + 0.06, -0.3), 0.022, 0.16, M["steel"], frame, "Y", 8)
gb = box("grab_bar", (0, arc_pt(R, 0, 0)[1] + 0.2, -0.3), (0.5, 0.045, 0.045), M["rubber"], frame, 0.012)
box("power_cell", (0, arc_pt(R, 0, 0)[1] + 0.12, 0.76), (0.46, 0.14, 0.14), M["dark"], frame, 0.012)
for s in (-1, 1):
    box("power_cell_cap", (s * 0.25, arc_pt(R, 0, 0)[1] + 0.12, 0.76), (0.03, 0.15, 0.15), M["yellow"], frame, 0.006)

# emitters: lens pods on both bars + a thin strip along the pane edges
for s in (-1, 1):
    for zz, zs in ((0.69, -1), (-0.67, 1)):
        for ang in (-0.28, 0.0, 0.28):
            p = arc_pt(R, ang, zz, 0.02)
            e = cyl("emit_pod", p, 0.04, 0.045, M["emit"], emitters, "Z", 12, 0.002)
            e.rotation_euler = (0, 0, 0)
        break
arc_sweep("strip_top", R, -TH, TH, 0.685, 0.70, 0.03, 0.055, M["strip"], emitters, 20, 0.0)
arc_sweep("strip_bot", R, -TH, TH, -0.68, -0.665, 0.03, 0.055, M["strip"], emitters, 20, 0.0)
for s in (-1, 1):
    a = s * (TH - 0.035)
    st = box("strip_side", arc_pt(R, a, 0.0, 0.05), (0.014, 0.03, 1.34), M["strip"], emitters, 0.0)
    st.rotation_euler = (0, 0, a)

# the hard-light pane: curved sheet, UV 0..1, material `pane` is replaced by a shader in the game
bm = bmesh.new()
seg_u, seg_v = 24, 10
a0, a1 = -TH + 0.03, TH - 0.03
z0, z1 = -0.665, 0.685
grid = []
uvl = bm.loops.layers.uv.new()
for j in range(seg_v + 1):
    row = []
    for i in range(seg_u + 1):
        a = a0 + (a1 - a0) * i / seg_u
        z = z0 + (z1 - z0) * j / seg_v
        row.append(bm.verts.new(arc_pt(R, a, z, 0.045)))
    grid.append(row)
for j in range(seg_v):
    for i in range(seg_u):
        f = bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        for l in f.loops:
            vi = [(i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1)]
            k = [v for v in f.verts].index(l.vert)
            l[uvl].uv = (vi[k][0] / seg_u, vi[k][1] / seg_v)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
for f in bm.faces:
    if f.normal.y > 0:
        f.normal_flip()
emission(pane_m, 0.12)  # dim in the Blender preview so the frame reads; the app swaps the material
pane_o = mesh_obj("pane", bm, pane_m, paneg, uv=False)
finish(frame)
finish(emitters)

print("TRIS gun", tris(gun), "shield", tris(shield))
# ------------------------------------------------------------------------------------------------ previews + export
root = empty("end2-char-defender-kit", None)
gun.parent = root
shield.parent = root
shield.location = (0, 0, 0)  # shield and gun overlap at the origin in the glb; the app clones each by name

if "--nopreview" not in sys.argv:
    kit.stage((0, 0, 0), (2, -3, 0.6))
    for n in ("_wall", "_floor"):
        bpy.data.objects.remove(bpy.data.objects[n])
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 24
    sc.render.resolution_x, sc.render.resolution_y = 1280, 720
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    cam = sc.camera
    aim = bpy.data.objects["_aim"]
    PREV = os.path.join(HERE, "..", "previews")

    def shot(name, obj_show, hide, loc, at, lens=45):
        obj_show.location = (0, 0, 0)
        for h in hide:
            h.location = (40, 0, 0)
        cam.location, aim.location, cam.data.lens = loc, at, lens
        kit.render(os.path.join(PREV, f"characters-{name}.png"))

    gun.location = (0, 0, 0)
    shield.location = (0, 0, 0)
    for n, (loc, at, lens) in {
        "gun-three-quarter": ((1.6, -2.0, 0.7), (0, -0.4, 0.0), 42),
        "gun-side": ((2.6, -0.4, 0.15), (0, -0.4, 0.0), 40),
        "gun-front": ((0.5, -2.4, 0.3), (0, -0.4, 0.0), 40),
    }.items():
        shot(n, gun, [shield], loc, at, lens)
    for n, (loc, at, lens) in {
        "shield-front": ((0.2, -4.0, 0.3), (0, 0, 0), 38),
        "shield-three-quarter": ((2.6, -3.0, 1.0), (0, 0.2, 0), 38),
        "shield-back": ((-1.6, 3.2, 0.6), (0, 0, 0), 38),
    }.items():
        shot(n, shield, [gun], loc, at, lens)
    gun.location = shield.location = (0, 0, 0)
    emission(pane_m, 1.0)

kit.export(root, os.path.join(HERE, "end2-char-defender-kit.glb"), os.path.join(HERE, "defender_kit.blend"))
