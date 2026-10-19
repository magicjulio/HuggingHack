# ASCENT (Ending 2) floor 3: the summit kit (owner: arena, round 4).
# blender -b --factory-startup -P design/3d/end2/floor3/summit.py [-- preview]
#   -> end2-floor3-kit.glb (copy to prototypes/end2-ascent/assets/models/)
# The layout (walls, floors, ceilings, colliders, the corridor props) comes from floor3.js + the floor-2 kit. This kit
# adds the arena's own pieces, each built at exactly the footprint floor3.js gives it:
#   q_pylon  2.6 x 2.6, 26 m   roof column (four in the arena)
#   q_cradle 11 x 5, 2.2 m     the boss's base under the face (front = -z, toward the gate)
#   q_break  2.6 x 1.0, 1.2 m  breakable cover: a caged rack of coolant cells (slams destroy it)
#   q_gate   at d3 (3.6 m door) the arena gate surround, both faces of the 1 m wall
#   q_truss  48 m along z      roof truss, hangs from the ceiling (origin = ceiling attach point); floor3.js scales z
#   q_inlay  r 15              the arena floor ring
#   q_cab    5 x 4.5           the express cab, in the floor-3 alcove (doors on -z (closed) and +z (open))
# Axes: three.js (x, y, z) = Blender (x, -z, y). Every piece is an empty named after it; origin = the floor point of its
# centre; FRONT = three +z. Meshes are joined per material on export (one node per material per piece).
# Materials (read by floor3.js): q_gun, q_steel, q_yellow, q_hazard, q_cell, q_dark, q_trim, q_rubber, q_glow (mood),
# q_warn (mood beacons), q_crack, q_lamp, q_screen, q_glass.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import numpy as np
import bmesh, bpy
from math import pi, sin, cos, radians, atan2, hypot

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = "end2-floor3-kit"
kit.reset(NAME, OUT)
TEXDIRS = [os.path.join(OUT, "..", "floors", "tex"), os.path.join(OUT, "tex")]  # the building's sets first (same paint)


# ------------------------------------------------------------------------------------------------ textures
def cached(name, make, n, keys=("albedo", "orm", "normal")):
    for d in TEXDIRS:
        paths = [os.path.join(d, f"{name}_{k}.png") for k in keys]
        if all(os.path.exists(p) for p in paths):
            out = []
            for p, k in zip(paths, keys):
                img = bpy.data.images.load(p, check_existing=True)
                img.colorspace_settings.name = "sRGB" if k in ("albedo", "emissive") else "Non-Color"
                out.append(img)
            return tuple(out)
    kit.N = n
    r = make()
    kit.N = 512
    return r


def glass(name, tint="#1d2a36", rough=0.06):
    m = mat(name, lin(tint), 0.0, rough)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = 0.25
    if hasattr(m, "blend_method"):
        m.blend_method = "BLEND"
    return m


M = dict(
    gun=tmat("q_gun", cached("at_gun", lambda: surface("at_gun", "#262b33", 411, chip=0.74, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.4), 1024)),
    steel=tmat("q_steel", cached("b_steel", lambda: surface("b_steel", "#5a6068", 541, chip=0.8, rust_amt=0.25, metal=0.85, rough=0.35, dirt=0.3), 512)),
    yellow=tmat("q_yellow", cached("at_yellow", lambda: surface("at_yellow", "#d9a514", 431, chip=0.66, rust_amt=0.6, metal=0.1, rough=0.5, dirt=0.5), 512)),
    hazard=tmat("q_hazard", cached("at_hazard", None, 512)),
    cell=tmat("q_cell", cached("q_cell", lambda: surface("q_cell", "#56666b", 611, chip=0.7, rust_amt=0.35, metal=0.4, rough=0.45, dirt=0.5, panel=2), 512)),
    trim=mat("q_trim", lin("#8a94a3"), 1.0, 0.28),
    dark=mat("q_dark", lin("#07090c"), 0.3, 0.8),
    rubber=mat("q_rubber", lin("#0e0f11"), 0.0, 0.85),
    glow=mat("q_glow", lin("#9fd8ff"), 0.0, 0.3, em=lin("#9fd8ff"), strength=1.0),
    warn=mat("q_warn", lin("#ff8a1e"), 0.0, 0.3, em=lin("#ff8a1e"), strength=1.0),
    crack=mat("q_crack", lin("#ffa040"), 0.0, 0.3, em=lin("#ffa040"), strength=1.0),
    lamp=mat("q_lamp", lin("#e6f2ff"), 0.0, 0.3, em=lin("#e6f2ff"), strength=1.0),
    screen=mat("q_screen", lin("#03080c"), 0.0, 0.45, em=lin("#ffb347"), strength=1.0),
    glass=glass("q_glass"),
)
kit.UVS = 0.5  # one texture tile = 2 m
gun, steel, yel, haz, trim, dark, rub = M["gun"], M["steel"], M["yellow"], M["hazard"], M["trim"], M["dark"], M["rubber"]
glow, warn, crack, lamp, scr, cell = M["glow"], M["warn"], M["crack"], M["lamp"], M["screen"], M["cell"]


# ------------------------------------------------------------------------------------------------ helpers (three.js coordinates)
def T(name, parent, x0, x1, y0, y1, z0, z1, m, bev=0.01, seg=1):
    """Axis-aligned box from three.js extents (x right, y up, z toward the front)."""
    return box(name, ((x0 + x1) / 2, -(z0 + z1) / 2, (y0 + y1) / 2), (x1 - x0, z1 - z0, y1 - y0), m, parent, bev, seg)


def TC(name, parent, x, y, z, r, depth, m, axis="y", seg=16, bev=0.0, r2=None):
    return cyl(name, (x, -z, y), r, depth, m, parent, axis={"x": "X", "y": "Z", "z": "Y"}[axis], seg=seg, bev=bev, r2=r2)


def TV(name, parent, pts_xz, y0, y1, m, bev=0.006):
    """Extrude a footprint drawn in the three.js XZ plane (top view, x right, z toward the front) up from y0 to y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -z, y0)) for x, z in pts_xz]
    b = [bm.verts.new((x, -z, y1)) for x, z in pts_xz]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(len(pts_xz)):
        j = (i + 1) % len(pts_xz)
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, m, parent), bev)


def TPZ(name, parent, pts_zy, x0, x1, m, bev=0.006):
    """Extrude a profile drawn in the three.js ZY plane (z, y) along x from x0 to x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, -z, y)) for z, y in pts_zy]
    b = [bm.verts.new((x1, -z, y)) for z, y in pts_zy]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(len(pts_zy)):
        j = (i + 1) % len(pts_zy)
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, m, parent), bev)


def TPX(name, parent, pts_xy, z0, z1, m, bev=0.006):
    """Extrude a profile drawn in the three.js XY plane (x, y) along z from z0 to z1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -z0, y)) for x, y in pts_xy]
    b = [bm.verts.new((x, -z1, y)) for x, y in pts_xy]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(len(pts_xy)):
        j = (i + 1) % len(pts_xy)
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, m, parent), bev)


def beam(name, parent, a, b, w, m):
    """A square beam of width w between two three.js points (any direction)."""
    ax, ay, az = a
    bx, by, bz = b
    pa, pb = Vector((ax, -az, ay)), Vector((bx, -bz, by))
    d = pb - pa
    o = box(name, tuple((pa + pb) / 2), (w, w, d.length), m, parent, 0.004)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(d.normalized())
    return o


def bolts(name, parent, pts, face, m, r=0.02):
    for i, (x, y, z) in enumerate(pts):
        TC(f"{name}{i}", parent, x, y, z, r, 0.025, m, axis={"+z": "z", "-z": "z", "+x": "x", "-x": "x", "+y": "y"}[face], seg=6)


def oct_pts(r, c):
    """Octagon footprint: half-width r, corner chamfer c."""
    return [(-r + c, -r), (r - c, -r), (r, -r + c), (r, r - c), (r - c, r), (-r + c, r), (-r, r - c), (-r, -r + c)]


def piece(name):
    return empty(name, ROOT)


def consolidate(p):
    """Apply modifiers and join each piece's meshes per material: one node per material per piece."""
    kids = [o for o in p.children_recursive if o.type == "MESH"]
    for o in kids:
        for x in kit.sc.objects:
            x.select_set(False)
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        if o.rotation_mode == "QUATERNION" or any(o.rotation_euler):
            bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        for md in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=md.name)
    groups = {}
    for o in kids:
        groups.setdefault(o.data.materials[0].name, []).append(o)
    for mname, objs in groups.items():
        for x in kit.sc.objects:
            x.select_set(False)
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        j = bpy.context.view_layer.objects.active
        mw = j.matrix_world.copy()
        j.parent = p
        j.matrix_world = mw
        j.name = j.data.name = f"{p.name}__{mname}"
    for o in list(p.children_recursive):
        if o.type == "EMPTY":
            for c in list(o.children):
                mw = c.matrix_world.copy()
                c.parent = p
                c.matrix_world = mw
            bpy.data.objects.remove(o)


ROOT = empty(NAME, None)


# ================================================================================================ q_pylon
def pylon():
    """q_pylon 2.6 x 2.6 x 26: roof column. Octagonal gunmetal shaft on a bolted plinth, hazard skirt, steel collars
    with beacons every 6 m, mood glow slots on four faces, two conduits, a flared capital into the roof."""
    p = piece("q_pylon")
    H, r = 26.0, 1.3
    TV("plinth", p, oct_pts(1.62, 0.45), 0.0, 0.38, gun, 0.02)
    TV("plinth_cap", p, oct_pts(1.5, 0.42), 0.38, 0.5, steel, 0.01)
    bolts("pbolt", p, [(x, 0.39, z) for x in (-1.2, 1.2) for z in (-1.2, 1.2)] + [(0, 0.39, s * 1.4) for s in (-1, 1)] + [(s * 1.4, 0.39, 0) for s in (-1, 1)],
          "+y", trim, 0.035)
    TV("shaft", p, oct_pts(r, 0.38), 0.5, H - 1.6, gun, 0.01)
    # hazard skirt + yellow band
    for s, (x0, x1, z0, z1) in enumerate([(-0.92, 0.92, -r - 0.012, -r), (-0.92, 0.92, r, r + 0.012), (-r - 0.012, -r, -0.92, 0.92), (r, r + 0.012, -0.92, 0.92)]):
        T(f"skirt{s}", p, x0, x1, 0.55, 0.9, z0, z1, haz, 0)
    TV("band", p, oct_pts(r + 0.03, 0.39), 0.95, 1.2, yel, 0.005)
    # collars every 6 m with four beacons
    for k, y in enumerate((6.0, 12.0, 18.0)):
        TV(f"collar{k}", p, oct_pts(r + 0.1, 0.42), y, y + 0.35, steel, 0.008)
        TV(f"collar_b{k}", p, oct_pts(r + 0.06, 0.41), y - 0.1, y, dark, 0)
        for s, (x, z) in enumerate([(0, -r - 0.12), (0, r + 0.12), (-r - 0.12, 0), (r + 0.12, 0)]):
            T(f"beacon{k}{s}", p, x - 0.12, x + 0.12, y + 0.08, y + 0.27, z - 0.06, z + 0.06, warn, 0.01)
    # horizontal plate seams + rivets
    for k, y in enumerate((3.0, 9.0, 15.0, 21.0)):
        TV(f"seam{k}", p, oct_pts(r + 0.006, 0.382), y - 0.02, y + 0.02, dark, 0)
    # mood glow slots (two runs on every face) in a dark recess
    for s, (ax, sgn) in enumerate([("z", -1), ("z", 1), ("x", -1), ("x", 1)]):
        for y0, y1 in ((1.6, 5.4), (13.0, 17.4)):
            if ax == "z":
                T(f"slot_k{s}{y0}", p, -0.11, 0.11, y0 - 0.06, y1 + 0.06, sgn * r - 0.01, sgn * r + 0.01, dark, 0)
                T(f"slot{s}{y0}", p, -0.045, 0.045, y0, y1, sgn * (r + 0.008) - 0.006, sgn * (r + 0.008) + 0.006, glow, 0)
            else:
                T(f"slot_k{s}{y0}", p, sgn * r - 0.01, sgn * r + 0.01, y0 - 0.06, y1 + 0.06, -0.11, 0.11, dark, 0)
                T(f"slot{s}{y0}", p, sgn * (r + 0.008) - 0.006, sgn * (r + 0.008) + 0.006, y0, y1, -0.045, 0.045, glow, 0)
    # two conduits up the diagonal faces, clamped every 2 m
    for sx in (-1, 1):
        x, z = sx * 0.98, 0.98
        TC(f"conduit{sx}", p, x, (0.6 + H - 1.6) / 2, z, 0.09, H - 2.2, steel, seg=10)
        for y in np.arange(1.5, H - 2, 2.0):
            TC(f"clamp{sx}{y}", p, x, y, z, 0.13, 0.08, dark, seg=8)
    # stencil plate
    T("plate", p, -0.42, 0.42, 1.55, 1.95, -r - 0.025, -r - 0.005, M["dark"], 0.004)
    text("plate_t", "SUMMIT / C", 0.12, (0, r + 0.03, 1.75), steel, p, rot=(radians(90), 0, 0))
    # capital: flares into the roof
    TV("cap0", p, oct_pts(r + 0.08, 0.4), H - 1.6, H - 1.2, steel, 0.01)
    TV("cap1", p, oct_pts(1.75, 0.5), H - 1.2, H - 0.5, gun, 0.02)
    TV("cap2", p, oct_pts(2.05, 0.6), H - 0.5, H, dark, 0.01)
    for s, (x, z) in enumerate([(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)]):
        beam(f"brace{s}", p, (x * 1.0, H - 3.6, z * 1.0), (x * 1.75, H - 0.6, z * 1.75), 0.18, steel)


# ================================================================================================ q_cradle
def cradle():
    """q_cradle 11 x 5 x 2.2: the boss's base. A stepped machine plinth: hazard-edged lower step, armoured body with
    orange vents toward the gate (-z), an emitter ring on the deck under the face, corner posts with beacons, floor
    clamps and cable trunks running off to the walls."""
    p = piece("q_cradle")
    w, d, H = 11.0, 5.0, 2.2
    T("step", p, -w / 2, w / 2, 0.0, 0.45, -d / 2, d / 2, gun, 0.03, 2)
    T("step_edge", p, -w / 2 + 0.05, w / 2 - 0.05, 0.3, 0.45, -d / 2 - 0.012, -d / 2 + 0.02, haz, 0)
    T("step_edge_s", p, -w / 2 - 0.012, -w / 2 + 0.02, 0.3, 0.45, -d / 2 + 0.05, d / 2 - 0.05, haz, 0)
    T("step_edge_e", p, w / 2 - 0.02, w / 2 + 0.012, 0.3, 0.45, -d / 2 + 0.05, d / 2 - 0.05, haz, 0)
    T("step_cap", p, -w / 2 + 0.02, w / 2 - 0.02, 0.45, 0.5, -d / 2 + 0.02, d / 2 - 0.02, steel, 0.006)
    # body: chamfered front, armour plates
    TPZ("body", p, [(-2.15, 0.5), (2.15, 0.5), (2.15, 1.9), (-1.6, 1.9), (-2.15, 1.45)], -w / 2 + 0.4, w / 2 - 0.4, gun, 0.02)
    for k in range(5):
        x = -4.0 + k * 2.0
        TPZ(f"plate{k}", p, [(-2.19, 0.62), (-2.15, 0.62), (-2.15, 1.4), (-2.19, 1.4)], x - 0.85, x + 0.85, steel, 0.004)
        # orange vents under each plate
        for j in range(4):
            y = 0.7 + j * 0.16
            T(f"vent{k}{j}", p, x - 0.62, x + 0.62, y, y + 0.06, -2.2, -2.18, warn, 0)
        bolts(f"pb{k}", p, [(x + sx * 0.75, y, -2.2) for sx in (-1, 1) for y in (0.7, 1.32)], "-z", trim, 0.025)
    T("rail_f", p, -w / 2 + 0.4, w / 2 - 0.4, 1.42, 1.5, -2.2, -2.12, yel, 0.004)
    # deck + emitter under the face
    T("deck", p, -w / 2 + 0.3, w / 2 - 0.3, 1.9, 2.05, -1.9, 2.25, steel, 0.01)
    T("deck_k", p, -w / 2 + 0.6, w / 2 - 0.6, 2.05, 2.08, -1.6, 1.95, dark, 0)
    TC("emit_base", p, 0, 2.1, 0.2, 2.3, 0.12, gun, seg=40)
    TC("emit_ring", p, 0, 2.17, 0.2, 2.05, 0.04, glow, seg=40)
    TC("emit_mid", p, 0, 2.2, 0.2, 1.85, 0.06, dark, seg=40)
    TC("emit_core", p, 0, 2.22, 0.2, 0.9, 0.08, steel, seg=24, r2=0.6)
    TC("emit_eye", p, 0, 2.27, 0.2, 0.42, 0.04, glow, seg=20)
    for k in range(12):
        a = 2 * pi * k / 12
        T(f"fin{k}", p, cos(a) * 1.3 - 0.06, cos(a) * 1.3 + 0.06, 2.12, 2.24, 0.2 + sin(a) * 1.3 - 0.06, 0.2 + sin(a) * 1.3 + 0.06, trim, 0.003)
    # corner posts with beacons
    for sx in (-1, 1):
        for sz in (-1, 1):
            x, z = sx * (w / 2 - 0.35), sz * (d / 2 - 0.35)
            T(f"post{sx}{sz}", p, x - 0.3, x + 0.3, 0.45, H, z - 0.3, z + 0.3, gun, 0.02)
            T(f"post_y{sx}{sz}", p, x - 0.32, x + 0.32, 1.6, 1.78, z - 0.32, z + 0.32, yel, 0.005)
            T(f"post_b{sx}{sz}", p, x - 0.16, x + 0.16, H, H + 0.14, z - 0.16, z + 0.16, warn, 0.01)
            # floor clamps
            T(f"clamp{sx}{sz}", p, x + sx * 0.2 - 0.35, x + sx * 0.2 + 0.35, 0.0, 0.16, z + sz * 0.35 - 0.25, z + sz * 0.35 + 0.25, dark, 0.01)
            bolts(f"cb{sx}{sz}", p, [(x + sx * 0.2 + ox, 0.165, z + sz * 0.35) for ox in (-0.22, 0.22)], "+y", trim, 0.03)
    # cable trunks off the back corners to the walls (the floor around stays clear)
    for sx in (-1, 1):
        TC(f"trunk{sx}", p, sx * (w / 2 + 0.8), 0.18, 1.6, 0.18, 1.8, rub, axis="x", seg=10)
        TC(f"trunk2{sx}", p, sx * (w / 2 + 0.8), 0.18, 1.1, 0.14, 1.8, rub, axis="x", seg=10)
        c0, c1 = sorted((sx * (w / 2), sx * (w / 2 + 1.7)))
        T(f"trunk_cover{sx}", p, c0, c1, 0.0, 0.08, 0.8, 1.95, yel, 0.01)


# ================================================================================================ q_break
def breakable():
    """q_break 2.6 x 1.0 x 1.2: breakable cover. A light steel cage around a stack of coolant cells: worn teal-grey
    canisters with hot orange seams, yellow straps, hazard end plates. Reads as fragile next to the steel crates."""
    p = piece("q_break")
    w, d, H = 2.6, 1.0, 1.2
    T("skid", p, -w / 2 + 0.04, w / 2 - 0.04, 0.0, 0.1, -d / 2 + 0.04, d / 2 - 0.04, dark, 0.01)
    for sx in (-1, 1):
        for sz in (-1, 1):
            T(f"post{sx}{sz}", p, sx * (w / 2 - 0.05) - 0.05, sx * (w / 2 - 0.05) + 0.05, 0.0, H, sz * (d / 2 - 0.05) - 0.05, sz * (d / 2 - 0.05) + 0.05, steel, 0.008)
    for y in (0.1, H - 0.06):
        for sz in (-1, 1):
            T(f"rail{y}{sz}", p, -w / 2 + 0.05, w / 2 - 0.05, y, y + 0.06, sz * (d / 2 - 0.05) - 0.03, sz * (d / 2 - 0.05) + 0.03, steel, 0.004)
        for sx in (-1, 1):
            T(f"erail{y}{sx}", p, sx * (w / 2 - 0.05) - 0.03, sx * (w / 2 - 0.05) + 0.03, y, y + 0.06, -d / 2 + 0.05, d / 2 - 0.05, steel, 0.004)
    # cells: two rows of four canisters lying along z
    for row, y in enumerate((0.36, 0.78)):
        for k in range(4):
            x = -0.9 + k * 0.6
            TC(f"cell{row}{k}", p, x, y, 0.0, 0.25, d - 0.2, cell, axis="z", seg=14)
            for sz in (-1, 1):
                TC(f"cap{row}{k}{sz}", p, x, y, sz * (d / 2 - 0.1), 0.2, 0.05, gun, axis="z", seg=14)
                TC(f"seam{row}{k}{sz}", p, x, y, sz * (d / 2 - 0.14), 0.255, 0.025, crack, axis="z", seg=14)
            TC(f"mid{row}{k}", p, x, y, 0.0, 0.26, 0.04, crack if (row + k) % 2 else yel, axis="z", seg=14)
    # straps over the stack, hazard end plates
    for x in (-0.6, 0.6):
        T(f"strap{x}", p, x - 0.05, x + 0.05, 1.03, 1.07, -d / 2 + 0.07, d / 2 - 0.07, yel, 0.003)
        for sz in (-1, 1):
            T(f"strapv{x}{sz}", p, x - 0.05, x + 0.05, 0.12, 1.07, sz * (d / 2 - 0.07) - 0.02, sz * (d / 2 - 0.07) + 0.02, yel, 0.003)
    for sx in (-1, 1):
        T(f"endplate{sx}", p, sx * (w / 2 - 0.02) - 0.015, sx * (w / 2 - 0.02) + 0.015, 0.16, H - 0.1, -d / 2 + 0.1, d / 2 - 0.1, haz, 0.004)
    T("top_plate", p, -w / 2 + 0.1, w / 2 - 0.1, H - 0.05, H - 0.02, -d / 2 + 0.12, d / 2 - 0.12, M["glass"], 0)


# ================================================================================================ q_gate
def gate():
    """q_gate: the arena gate surround at d3 (a 3.6 m door in a 1 m wall; origin = the floor centre of the gap).
    Arena face (+z): two heavy jamb towers, a 10 m lintel with chevrons and beacons, hazard plates. The antechamber face
    (-z) gets a lighter frame. The floor-2 kit's p_frame_36 + leaves fill the opening; nothing here enters it."""
    p = piece("q_gate")
    zf = 0.5  # arena wall face
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 2.3, sx * 4.1))
        T(f"tower{sx}", p, x0, x1, 0.0, 8.6, zf, zf + 0.32, gun, 0.03, 2)
        T(f"tower_haz{sx}", p, x0 + 0.1, x1 - 0.1, 0.12, 1.25, zf + 0.32, zf + 0.335, haz, 0)
        T(f"tower_y{sx}", p, x0 - 0.02, x1 + 0.02, 1.3, 1.5, zf, zf + 0.35, yel, 0.005)
        for k in range(5):
            y = 2.0 + k * 1.2
            T(f"rib{sx}{k}", p, x0 + 0.08, x1 - 0.08, y, y + 0.12, zf + 0.32, zf + 0.37, steel, 0.004)
        T(f"slot{sx}", p, sx * 2.48 - 0.04, sx * 2.48 + 0.04, 1.8, 7.6, zf + 0.32, zf + 0.345, glow, 0)
        T(f"beacon{sx}", p, sx * 3.2 - 0.25, sx * 3.2 + 0.25, 8.6, 8.95, zf + 0.05, zf + 0.35, warn, 0.02)
        # antechamber side: jamb plates
        a0, a1 = sorted((sx * 2.3, sx * 3.5))
        T(f"aj{sx}", p, a0, a1, 0.0, 4.6, -zf - 0.2, -zf, gun, 0.02)
        T(f"aj_haz{sx}", p, a0 + 0.08, a1 - 0.08, 0.1, 1.0, -zf - 0.215, -zf - 0.2, haz, 0)
    T("lintel", p, -4.3, 4.3, 4.25, 6.0, zf, zf + 0.38, gun, 0.03, 2)
    T("lintel_y", p, -4.3, 4.3, 4.18, 4.3, zf, zf + 0.4, yel, 0.005)
    for k in range(7):
        x = -2.7 + k * 0.9
        TPX(f"chev{k}", p, [(x - 0.32, 4.6), (x, 4.95), (x + 0.32, 4.6), (x + 0.32, 4.78), (x, 5.13), (x - 0.32, 4.78)], zf + 0.38, zf + 0.4,
            glow if k % 2 == 0 else yel, 0)
    T("crown", p, -4.1, 4.1, 6.0, 8.6, zf, zf + 0.22, steel, 0.02)
    for k in range(6):
        x = -3.4 + k * 1.36
        T(f"crown_rib{k}", p, x - 0.08, x + 0.08, 6.1, 8.5, zf + 0.22, zf + 0.28, gun, 0.004)
    T("crown_plate", p, -1.6, 1.6, 6.7, 7.6, zf + 0.22, zf + 0.25, dark, 0.004)
    text("crown_t", "SUMMIT", 0.5, (0, -(zf + 0.255), 7.15), M["yellow"], p, rot=(radians(90), 0, pi))
    T("al", p, -2.9, 2.9, 4.2, 4.7, -zf - 0.22, -zf, gun, 0.02)
    T("al_y", p, -2.9, 2.9, 4.15, 4.25, -zf - 0.24, -zf, yel, 0.004)


# ================================================================================================ q_truss
def truss():
    """q_truss: a 48 m roof truss along z, 2.4 m deep, hanging from the ceiling (origin = the ceiling point at its
    centre). Top and bottom chords, verticals and diagonals every 4 m, a mood glow line under the bottom chord."""
    p = piece("q_truss")
    L, D = 48.0, 2.4
    T("top", p, -0.25, 0.25, -0.45, 0.0, -L / 2, L / 2, gun, 0.01)
    T("bot", p, -0.18, 0.18, -D - 0.3, -D, -L / 2 + 0.5, L / 2 - 0.5, gun, 0.01)
    T("bot_glow", p, -0.04, 0.04, -D - 0.32, -D - 0.3, -L / 2 + 1, L / 2 - 1, glow, 0)
    n = int(L / 4)
    for k in range(n + 1):
        z = -L / 2 + k * 4.0
        z = max(-L / 2 + 0.6, min(L / 2 - 0.6, z))
        T(f"v{k}", p, -0.1, 0.1, -D, -0.45, z - 0.1, z + 0.1, steel, 0.004)
        if k < n:
            z2 = max(-L / 2 + 0.6, min(L / 2 - 0.6, -L / 2 + (k + 1) * 4.0))
            if k % 2 == 0:
                beam(f"d{k}", p, (0, -0.45, z), (0, -D, z2), 0.12, steel)
            else:
                beam(f"d{k}", p, (0, -D, z), (0, -0.45, z2), 0.12, steel)
        if k % 2 == 0:
            T(f"node{k}", p, -0.22, 0.22, -D - 0.32, -D + 0.1, z - 0.22, z + 0.22, dark, 0.008)


# ================================================================================================ q_inlay
def inlay():
    """q_inlay: the arena floor ring, r 15 (origin = its centre). A recessed dark channel with steel lips and a mood
    glow line, hazard plates at the four quarter points and tick marks every 7.5 degrees."""
    p = piece("q_inlay")
    R, n = 15.0, 96

    def ring(name, r0, r1, y0, y1, m):
        bm = bmesh.new()
        lo0 = [bm.verts.new((cos(2 * pi * i / n) * r0, sin(2 * pi * i / n) * r0, y0)) for i in range(n)]
        lo1 = [bm.verts.new((cos(2 * pi * i / n) * r1, sin(2 * pi * i / n) * r1, y0)) for i in range(n)]
        hi0 = [bm.verts.new((cos(2 * pi * i / n) * r0, sin(2 * pi * i / n) * r0, y1)) for i in range(n)]
        hi1 = [bm.verts.new((cos(2 * pi * i / n) * r1, sin(2 * pi * i / n) * r1, y1)) for i in range(n)]
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((hi0[i], hi1[i], hi1[j], hi0[j]))
            bm.faces.new((hi1[i], lo1[i], lo1[j], hi1[j]))
            bm.faces.new((lo0[i], hi0[i], hi0[j], lo0[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        return mesh_obj(name, bm, m, p)

    ring("channel", R - 0.35, R + 0.35, 0.0, 0.006, dark)
    ring("lip_in", R - 0.42, R - 0.3, 0.0, 0.014, steel)
    ring("lip_out", R + 0.3, R + 0.42, 0.0, 0.014, steel)
    ring("line", R - 0.05, R + 0.05, 0.0, 0.012, glow)
    for k in range(48):
        a = 2 * pi * k / 48
        if k % 12 == 0:
            continue
        c, s = cos(a), sin(a)
        T(f"tick{k}", p, c * (R + 0.55) - 0.05, c * (R + 0.55) + 0.05, 0.0, 0.012, s * (R + 0.55) - 0.05, s * (R + 0.55) + 0.05, trim, 0)
    for k in range(4):
        a = pi / 2 * k
        c, s = cos(a), sin(a)
        o = T(f"quad{k}", p, -0.9, 0.9, 0.0, 0.016, -0.5, 0.5, haz, 0)
        o.location = (c * R, -s * R, 0.008)
        o.rotation_euler = (0, 0, a + pi / 2)


# ================================================================================================ q_cab
def cab():
    """q_cab: the express cab in the floor-3 alcove (5 x 4.5, origin = floor centre, doors on -z (closed, floor-2 side)
    and +z (open, out into the landing)). Grip-plate floor, panelled walls with handrails, a lit ceiling, a floor
    indicator over the open door, the closed rear leaves with windows, parked front leaves in their pockets."""
    p = piece("q_cab")
    w, d, h = 2.45, 2.2, 3.6
    T("floor", p, -w, w, -0.02, 0.04, -d, d, steel, 0.004)
    for k in range(5):
        x = -2.0 + k * 1.0
        T(f"grip{k}", p, x - 0.4, x + 0.4, 0.04, 0.05, -d + 0.2, d - 0.2, gun, 0.002)
    T("sill_f", p, -1.25, 1.25, 0.0, 0.06, d - 0.06, d + 0.05, yel, 0.004)
    # side walls: panels, handrail, lights
    for sx in (-1, 1):
        x = sx * (w - 0.05)
        T(f"wall{sx}", p, x - 0.05, x + 0.05, 0.0, h, -d, d, gun, 0.01)
        for k in range(3):
            z = -1.4 + k * 1.4
            T(f"panel{sx}{k}", p, x - sx * 0.07 - 0.02, x - sx * 0.07 + 0.02, 0.3, h - 0.35, z - 0.62, z + 0.62, steel, 0.006)
        T(f"rail{sx}", p, x - sx * 0.2 - 0.03, x - sx * 0.2 + 0.03, 0.95, 1.01, -d + 0.3, d - 0.3, trim, 0.004)
        for z in (-1.6, 0.0, 1.6):
            T(f"rb{sx}{z}", p, x - sx * 0.14 - 0.02, x - sx * 0.14 + 0.02, 0.96, 1.0, z - 0.02, z + 0.02, trim, 0)
        T(f"kick{sx}", p, x - sx * 0.08 - 0.02, x - sx * 0.08 + 0.02, 0.0, 0.2, -d, d, haz, 0)
        T(f"lstrip{sx}", p, x - sx * 0.08 - 0.01, x - sx * 0.08 + 0.01, h - 0.3, h - 0.26, -d + 0.2, d - 0.2, M["yellow"], 0)
    # ceiling and its light panel
    T("roof", p, -w, w, h, h + 0.12, -d, d, gun, 0.01)
    T("lamp", p, -1.4, 1.4, h - 0.04, h, -1.2, 1.2, lamp, 0)
    T("lamp_frame", p, -1.5, 1.5, h - 0.06, h - 0.02, -1.3, 1.3, dark, 0.004)
    # rear (-z): closed leaves with windows
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 0.02, sx * 1.25))
        T(f"rleaf{sx}", p, x0, x1, 0.06, 2.9, -d - 0.04, -d + 0.08, steel, 0.008)
        T(f"rwin{sx}", p, (x0 + x1) / 2 - 0.25, (x0 + x1) / 2 + 0.25, 1.5, 2.4, -d + 0.08, -d + 0.09, M["glass"], 0)
        T(f"rhaz{sx}", p, x0 + 0.05, x1 - 0.05, 0.1, 0.45, -d + 0.08, -d + 0.09, haz, 0)
    for sz, name in ((-1, "r"), (1, "f")):
        z = sz * d
        T(f"{name}head", p, -w, w, 2.9, h, z - 0.08, z + 0.08, gun, 0.01)
        for sx in (-1, 1):
            j0, j1 = sorted((sx * 1.25, sx * w))
            T(f"{name}jamb{sx}", p, j0, j1, 0.0, 2.9, z - 0.08, z + 0.08, gun, 0.01)
            T(f"{name}jy{sx}", p, sx * 1.25 - 0.04, sx * 1.25 + 0.04, 0.2, 2.8, z - 0.1, z + 0.1, M["yellow"], 0.003)
    # the floor indicator over the front door (inside face)
    T("ind", p, -0.5, 0.5, 3.0, 3.35, d - 0.11, d - 0.09, scr, 0)
    T("ind_frame", p, -0.56, 0.56, 2.96, 3.39, d - 0.09, d - 0.07, dark, 0.004)
    text("ind_t", "03", 0.24, (0, -(d - 0.115), 3.17), M["dark"], p, rot=(radians(90), 0, pi))
    # parked front leaves in the side pockets (outside the opening)
    for sx in (-1, 1):
        f0, f1 = sorted((sx * 1.3, sx * 2.4))
        T(f"fleaf{sx}", p, f0, f1, 0.06, 2.88, d - 0.2, d - 0.12, steel, 0.008)
    # call panel
    T("cpanel", p, w - 0.14, w - 0.1, 1.1, 1.6, 1.2, 1.6, dark, 0.004)
    for k in range(4):
        T(f"cbtn{k}", p, w - 0.15, w - 0.13, 1.18 + k * 0.1, 1.24 + k * 0.1, 1.33, 1.47, warn if k == 3 else trim, 0)


# ------------------------------------------------------------------------------------------------ build
pylon()
cradle()
breakable()
gate()
truss()
inlay()
cab()

for p in list(ROOT.children):
    consolidate(p)
path = os.path.join(OUT, NAME + ".glb")
export(ROOT, path, os.path.join(OUT, NAME + ".blend"))
for p in ROOT.children:
    print("PIECE", p.name, [c.name.split("__")[1] for c in p.children])
