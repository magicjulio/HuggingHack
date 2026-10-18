# ASCENT (Ending 2) floor 2: the building kit (owner: building, round 3).
# blender -b --factory-startup -P design/3d/end2/floors/building.py [-- preview]
#   -> end2-floor2-kit.glb (copy to prototypes/end2-ascent/assets/models/)
# The layout itself (walls, floors, ceilings, colliders) is generated in three.js from floor2.js LAYOUT; this kit
# supplies (1) the materials those generated surfaces wear (the m_* swatch pieces) and (2) the props, door frames and
# leaves, stairs, railing and light fixtures, each built at the exact size floor2.js places it (no scaling).
# Axes: three.js (x, y, z) = Blender (x, -z, y). Every piece is an empty named after it; origin = the floor point of
# its centre; FRONT = three +z (Blender -y). Meshes are joined per material on export (one node per material per piece).
# Materials (shared names, read by floor2.js): b_wall, b_floor, b_raised, b_ceiling, b_gun, b_steel, b_yellow,
# b_hazard, b_trim, b_dark, b_rubber, b_glow_y, b_glow_w, b_screen, b_screen_o, b_rack, b_glass.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import numpy as np
import bmesh, bpy
from math import pi, sin, cos, radians, atan2, hypot

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = "end2-floor2-kit"
kit.reset(NAME, OUT)
TEXDIR = os.path.join(OUT, "tex")


# ------------------------------------------------------------------------------------------------ textures
def cached(name, make, n, keys=("albedo", "orm", "normal")):
    """Texture sets are deterministic; reuse the PNGs from an earlier run (delete tex/ to rebuild)."""
    paths = [os.path.join(TEXDIR, f"{name}_{k}.png") for k in keys]
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


def plate_floor(name, seed, base="#30363d", tiles=4, rough=0.42):
    """Worn steel-trowelled floor in 1 m plates (4 per tile edge = 4 m tile): scuffs along walk lines, grime in
    the joints, a few oil stains, a faint diamond grip pattern."""
    N = kit.N
    cloud = fbm(seed + 1, 3, 5)
    scuff = fbm(seed + 2, 10, 6, streak=7)
    speck = fbm(seed + 3, 96, 2)
    stain = fbm(seed + 4, 4, 5)
    grime = fbm(seed + 5, 6, 5)
    t = np.linspace(0, tiles, N, endpoint=False) % 1.0
    line = ((t < 0.006) | (t > 0.994)).astype(float)
    seam = np.maximum(line[:, None], line[None, :])
    near = np.maximum(sstep(0.04, 0.0, t)[:, None] + sstep(0.96, 1.0, t)[:, None], sstep(0.04, 0.0, t)[None, :] + sstep(0.96, 1.0, t)[None, :])
    idx = (np.floor(np.linspace(0, tiles, N, endpoint=False))).astype(int)
    tone = np.random.default_rng(seed).random((tiles, tiles))[idx][:, idx]
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    grip = ((np.abs(((u + v) * tiles * 16) % 1.0 - 0.5) < 0.08) | (np.abs(((u - v) * tiles * 16) % 1.0 - 0.5) < 0.08)).astype(float)
    col = srgb(base)[None, None] * (0.85 + 0.2 * cloud[..., None] + 0.08 * tone[..., None]) * (0.94 + 0.12 * speck[..., None])
    col = col * (1 + 0.22 * sstep(0.62, 0.85, scuff))[..., None]
    col = col * (1 - 0.35 * sstep(0.68, 0.9, stain))[..., None] * (1 - 0.3 * near * grime)[..., None]
    col = col * (1 - 0.08 * grip)[..., None] * (1 - 0.65 * seam)[..., None]
    r = np.clip(rough + 0.2 * grime - 0.18 * sstep(0.62, 0.85, scuff) - 0.15 * sstep(0.68, 0.9, stain) + 0.3 * seam + 0.06 * grip, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.25 + 0.2 * sstep(0.62, 0.85, scuff)], axis=2)
    hgt = 0.1 * cloud - 1.5 * seam + 0.25 * grip + 0.05 * speck
    return save(name + "_albedo", col), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 4.0), False)


def raised_floor(name, seed):
    """Data-centre raised floor: 0.6 m tiles (4 per 2.4 m tile edge), every third row perforated, scuffed."""
    N = kit.N
    grime = fbm(seed + 1, 3, 5)
    scuff = fbm(seed + 2, 12, 6, streak=8)
    speck = fbm(seed + 3, 64, 3)
    n = 4
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    fu, fv = (u * n) % 1.0, (v * n) % 1.0
    seam = np.maximum(sstep(0.012, 0.0, fu) + sstep(0.988, 1.0, fu), sstep(0.012, 0.0, fv) + sstep(0.988, 1.0, fv))
    row = np.floor(v * n)
    perf_tile = (row % 3 == 1).astype(float) * ((np.floor(u * n) % 2) == 0)
    hole = (np.abs(((fu * 14) % 1.0) - 0.5) < 0.18) * (np.abs(((fv * 14) % 1.0) - 0.5) < 0.18)
    inner = (fu > 0.08) * (fu < 0.92) * (fv > 0.08) * (fv < 0.92)
    perf = perf_tile * hole * inner
    col = srgb("#3b4148")[None, None] * (0.8 + 0.3 * grime[..., None]) * (0.92 + 0.16 * speck[..., None])
    col = col * (1 - 0.8 * perf)[..., None] * (1 - 0.6 * seam)[..., None]
    col = col * (1 + 0.25 * sstep(0.6, 0.85, scuff))[..., None]
    r = np.clip(0.45 + 0.2 * grime - 0.2 * sstep(0.6, 0.85, scuff) + 0.3 * perf, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.35 * (1 - perf)], axis=2)
    hgt = -1.4 * seam - 1.0 * perf + 0.1 * speck
    return save(name + "_albedo", col), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 5.0), False)


def ceiling_tiles(name, seed):
    """Dark acoustic ceiling: 0.6 m tiles with a fine perforation, sagging stains, a few missing (black) tiles."""
    N = kit.N
    grime = fbm(seed + 1, 3, 5)
    stain = fbm(seed + 2, 5, 5)
    speck = fbm(seed + 3, 128, 2)
    n = 4
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    fu, fv = (u * n) % 1.0, (v * n) % 1.0
    grid = np.maximum(sstep(0.03, 0.0, fu) + sstep(0.97, 1.0, fu), sstep(0.03, 0.0, fv) + sstep(0.97, 1.0, fv))
    missing = (np.random.default_rng(seed).random((n, n)) < 0.08)[np.floor(v * n).astype(int), np.floor(u * n).astype(int)]
    col = srgb("#262b31")[None, None] * (0.85 + 0.25 * grime[..., None]) * (0.9 + 0.2 * speck[..., None])
    col = col * (1 - 0.3 * sstep(0.6, 0.85, stain))[..., None]
    col = np.where(grid[..., None] > 0.5, srgb("#4a4f56")[None, None] * (0.9 + 0.2 * grime[..., None]), col)
    col = np.where(missing[..., None], srgb("#06080a")[None, None], col)
    r = np.clip(0.85 - 0.4 * grid, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.6 * grid], axis=2)
    hgt = 0.6 * grid - 0.8 * missing + 0.1 * speck
    return save(name + "_albedo", col), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 3.0), False)


def hazard_surface(name, seed, yellow="#d6a210", black="#14181e"):
    N = kit.N
    grime = fbm(seed + 1, 3, 5)
    chips = fbm(seed + 3, 14, 6)
    rustn = fbm(seed + 4, 16, 5)
    speck = fbm(seed + 5, 64, 3)
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    stripe = (((u + v) * 3.0) % 1.0 > 0.5).astype(float)
    chipm = sstep(0.66, 0.70, chips * 0.7 + rustn * 0.3)
    col = srgb(yellow)[None, None] * stripe[..., None] + srgb(black)[None, None] * (1 - stripe[..., None])
    col = col * (0.55 + 0.6 * grime[..., None]) * (0.9 + 0.2 * speck[..., None])
    rust = srgb("#3a1a0c")[None, None] * (1 - rustn[..., None]) + srgb("#8a4a1c")[None, None] * rustn[..., None]
    alb = col * (1 - chipm[..., None]) + rust * chipm[..., None]
    r = np.clip(0.55 + 0.25 * grime + 0.25 * chipm, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.1 * (1 - chipm)], axis=2)
    hgt = 0.3 * fbm(seed + 6, 5, 4) - 1.0 * chipm + 0.1 * speck
    return save(name + "_albedo", alb), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 4.0), False)


def rack_surface(name, seed):
    """Server rack fronts: 0.6 m cabinets, mesh doors, LED columns. UV tile = 2.4 m wide x 2.4 m tall (4 cabinets)."""
    N = kit.N
    grime = fbm(seed + 1, 3, 5)
    speck = fbm(seed + 2, 64, 3)
    rnd = np.random.default_rng(seed)
    u = (np.arange(N)[None, :] / N) * np.ones((N, 1))
    v = (np.arange(N)[:, None] / N) * np.ones((1, N))
    fu = (u * 4) % 1.0
    cab = np.floor(u * 4).astype(int)
    frame = (fu < 0.05) | (fu > 0.95) | (v < 0.03) | (v > 0.97)
    mesh = ((np.floor(u * N / 3) + np.floor(v * N / 3)) % 2 == 0) * ~frame
    col = srgb("#16191e")[None, None] * np.ones((N, N, 1))
    col = np.where(frame[..., None], srgb("#2c3139")[None, None], col)
    col = col * (1 - 0.25 * mesh)[..., None] * (0.85 + 0.3 * grime[..., None]) * (0.92 + 0.16 * speck[..., None])
    em = np.zeros((N, N, 3))
    units = 42
    fv = (v * units) % 1.0
    unit = np.floor(v * units).astype(int)
    on = rnd.random((4, units, 3))
    palette = [srgb("#ffb43a"), srgb("#dff1ff"), srgb("#5fd8ff"), srgb("#ffd21e")]
    for c in range(4):
        for k, cx in enumerate((0.18, 0.26, 0.34)):
            dot = (np.abs(fu - cx) < 0.018) * (np.abs(fv - 0.5) < 0.16) * (cab == c)
            lit = on[c][unit, k] > 0.45
            choice = (on[c][unit, k] * 97).astype(int) % 4
            for pi_, pc in enumerate(palette):
                m = dot * lit * (choice == pi_)
                em += m[..., None] * pc[None, None]
        bay = (np.abs(fu - 0.7) < 0.2) * (np.abs(fv - 0.5) < 0.08) * (cab == c) * (unit % 6 == 2)
        em += bay[..., None] * srgb("#3b6b8a")[None, None] * 0.5
    col = col + em * 0.4
    r = np.clip(0.5 + 0.2 * grime - 0.3 * frame, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.6 * frame + 0.2], axis=2)
    hgt = -0.6 * mesh + 0.4 * frame - 0.3 * (em.sum(axis=2) > 0)
    return (save(name + "_albedo", col), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 3.0), False),
            save(name + "_emissive", np.clip(em, 0, 1)))


def tmat_e(name, maps, strength=1.0):
    alb, orm, nrm, emi = maps
    m = tmat(name, (alb, orm, nrm))
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    te = nt.nodes.new("ShaderNodeTexImage")
    te.image = emi
    nt.links.new(te.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = strength
    return m


def glass(name, tint="#1d2a36", rough=0.06):
    m = mat(name, lin(tint), 0.0, rough)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = 0.25
    if hasattr(m, "blend_method"):
        m.blend_method = "BLEND"
    return m


# ------------------------------------------------------------------------------------------------ materials
# gunmetal, yellow and hazard reuse the atrium's cached texture sets (same paint, same building)
M = dict(
    wall=tmat("b_wall", cached("b_wall", lambda: surface("b_wall", "#3d4651", 501, chip=0.8, rust_amt=0.25, metal=0.3, rough=0.55, dirt=0.4, panel=3), 1024)),
    floor=tmat("b_floor", cached("b_floor", lambda: plate_floor("b_floor", 511), 1024)),
    raised=tmat("b_raised", cached("b_raised", lambda: raised_floor("b_raised", 521), 1024)),
    ceiling=tmat("b_ceiling", cached("b_ceiling", lambda: ceiling_tiles("b_ceiling", 531), 512)),
    gun=tmat("b_gun", cached("at_gun", lambda: surface("at_gun", "#262b33", 411, chip=0.74, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.4), 1024)),
    steel=tmat("b_steel", cached("b_steel", lambda: surface("b_steel", "#5a6068", 541, chip=0.8, rust_amt=0.25, metal=0.85, rough=0.35, dirt=0.3), 512)),
    yellow=tmat("b_yellow", cached("at_yellow", lambda: surface("at_yellow", "#d9a514", 431, chip=0.66, rust_amt=0.6, metal=0.1, rough=0.5, dirt=0.5), 512)),
    hazard=tmat("b_hazard", cached("at_hazard", lambda: hazard_surface("at_hazard", 441), 512)),
    rack=tmat_e("b_rack", cached("b_rack", lambda: rack_surface("b_rack", 551), 1024, ("albedo", "orm", "normal", "emissive"))),
    trim=mat("b_trim", lin("#8a94a3"), 1.0, 0.28),
    dark=mat("b_dark", lin("#07090c"), 0.3, 0.8),
    rubber=mat("b_rubber", lin("#0e0f11"), 0.0, 0.85),
    glow_y=mat("b_glow_y", lin("#ffc153"), 0.0, 0.3, em=lin("#ffc153"), strength=1.0),
    glow_w=mat("b_glow_w", lin("#d8ecff"), 0.0, 0.3, em=lin("#d8ecff"), strength=1.0),
    screen=mat("b_screen", lin("#03080c"), 0.0, 0.45, em=lin("#6fc4ff"), strength=1.0),
    screen_o=mat("b_screen_o", lin("#0c0603"), 0.0, 0.45, em=lin("#ffa040"), strength=1.0),
    glass=glass("b_glass"),
)
kit.UVS = 0.5  # props: one texture tile = 2 m


# ------------------------------------------------------------------------------------------------ helpers (three.js coordinates)
def T(name, parent, x0, x1, y0, y1, z0, z1, m, bev=0.01, seg=1):
    """Axis-aligned box from three.js extents (x right, y up, z toward the front)."""
    return box(name, ((x0 + x1) / 2, -(z0 + z1) / 2, (y0 + y1) / 2), (x1 - x0, z1 - z0, y1 - y0), m, parent, bev, seg)


def TC(name, parent, x, y, z, r, depth, m, axis="y", seg=16, bev=0.0, r2=None):
    """Cylinder centred at three.js (x, y, z) along a three.js axis."""
    return cyl(name, (x, -z, y), r, depth, m, parent, axis={"x": "X", "y": "Z", "z": "Y"}[axis], seg=seg, bev=bev, r2=r2)


def TQ(name, parent, corners, m, uv):
    """One-sided quad from 4 three.js points (counter-clockwise seen from the front) with explicit UVs."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, -z, y)) for x, y, z in corners]
    f = bm.faces.new(vs)
    lay = bm.loops.layers.uv.new()
    for l, c in zip(f.loops, uv):
        l[lay].uv = c
    return mesh_obj(name, bm, m, parent, uv=False)


def TP(name, parent, pts_xy, z0, z1, m, bev=0.006):
    """Extrude a profile drawn in the three.js XY plane (side view) along z from z0 to z1."""
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


def stencil(name, parent, body, size, x, y, z, m, face="+z", align="CENTER"):
    """Flat text facing a three.js direction."""
    rot = {"+z": (radians(90), 0, 0), "-z": (radians(90), 0, pi), "+x": (radians(90), 0, pi / 2), "-x": (radians(90), 0, -pi / 2)}[face]
    return text(name, body, size, (x, -z, y), m, parent, align=align, rot=rot, extrude=0.0015)


def bolts(name, parent, pts, face, m, r=0.018):
    for i, (x, y, z) in enumerate(pts):
        TC(f"{name}{i}", parent, x, y, z, r, 0.02, m, axis={"+z": "z", "-z": "z", "+x": "x", "-x": "x"}[face], seg=6)


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
gun, steel, yel, haz, trim, dark, rub = M["gun"], M["steel"], M["yellow"], M["hazard"], M["trim"], M["dark"], M["rubber"]
gy, gw, scr, scro = M["glow_y"], M["glow_w"], M["screen"], M["screen_o"]


def feet(p, w, d, h=0.06):
    T("kick", p, -w / 2 + 0.05, w / 2 - 0.05, 0, h, -d / 2 + 0.05, d / 2 - 0.05, rub, 0.004)


# ================================================================================================ swatches
# One small quad per surface material, so the generated walls, floors and ceilings in three.js can wear them.
def swatches():
    for k in ("wall", "floor", "raised", "ceiling", "gun", "steel", "yellow", "hazard", "trim", "dark", "glow_y", "glow_w", "glass"):
        p = piece(f"m_{k}")
        TQ("sw", p, [(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], M[k], [(0, 0), (1, 0), (1, 1), (0, 1)])


# ================================================================================================ low cover (h 1.2)
H = 1.2


def barrier():
    """p_barrier 2.7 x 0.5: steel security barrier, hazard band, scanner light along the top."""
    p = piece("p_barrier")
    w, d = 2.7, 0.5
    prof = [(-0.25, 0.0), (0.25, 0.0), (0.24, 0.12), (0.16, 0.38), (0.14, 1.12), (-0.14, 1.12), (-0.16, 0.38), (-0.24, 0.12)]
    TPZ("body", p, prof, -w / 2 + 0.08, w / 2 - 0.08, gun, 0.012)
    for s in (-1, 1):
        T(f"end{s}", p, s * (w / 2 - 0.08) - 0.08, s * (w / 2 - 0.08) + 0.08, 0, H, -d / 2, d / 2, yel, 0.015, 2)
        T(f"end_cap{s}", p, s * (w / 2 - 0.08) - 0.09, s * (w / 2 - 0.08) + 0.09, H - 0.04, H, -d / 2 - 0.01, d / 2 + 0.01, trim, 0.006)
        T(f"haz{s}", p, -w / 2 + 0.17, w / 2 - 0.17, 0.14, 0.34, s * 0.235 - 0.008, s * 0.235 + 0.008, haz, 0)
        for x in (-0.8, 0.0, 0.8):
            T(f"rib{s}{x}", p, x - 0.03, x + 0.03, 0.4, 1.08, s * 0.15 - 0.012, s * 0.15 + 0.012, steel, 0.004)
        bolts(f"bolt{s}", p, [(x, 0.75, s * 0.158) for x in (-1.1, -0.4, 0.4, 1.1)], "+z", trim)
    T("cap", p, -w / 2 + 0.08, w / 2 - 0.08, 1.12, H - 0.02, -0.17, 0.17, steel, 0.01)
    T("scan_well", p, -w / 2 + 0.25, w / 2 - 0.25, H - 0.02, H, -0.05, 0.05, dark, 0)
    T("scan", p, -w / 2 + 0.3, w / 2 - 0.3, H - 0.015, H + 0.002, -0.02, 0.02, gy, 0)
    T("lift_slot", p, -0.5, 0.5, 0.0, 0.07, -0.26, 0.26, dark, 0)
    stencil("tag", p, "CHECKPOINT 02", 0.07, 0.0, 0.62, 0.162, M["dark"])
    feet(p, w, d, 0.03)


def desk():
    """p_desk 3.4 x 1.2: back-to-back workstation pair with a privacy screen and monitors."""
    p = piece("p_desk")
    w, d = 3.4, 1.2
    T("top", p, -w / 2, w / 2, 0.72, 0.76, -d / 2, d / 2, steel, 0.008)
    T("top_edge", p, -w / 2 - 0.01, w / 2 + 0.01, 0.725, 0.755, -d / 2 - 0.01, d / 2 + 0.01, rub, 0.003)
    for x in (-w / 2 + 0.06, 0, w / 2 - 0.06):
        T(f"leg{x}", p, x - 0.04, x + 0.04, 0, 0.72, -d / 2 + 0.05, d / 2 - 0.05, gun, 0.01)
    T("modesty", p, -w / 2 + 0.1, w / 2 - 0.1, 0.18, 0.7, -0.02, 0.02, gun, 0.006)
    T("screen", p, -w / 2 + 0.02, w / 2 - 0.02, 0.76, H - 0.03, -0.035, 0.035, M["wall"], 0.01)
    T("screen_cap", p, -w / 2, w / 2, H - 0.03, H, -0.045, 0.045, yel, 0.006)
    for s in (-1, 1):
        for x in (-0.85, 0.85):
            z = s * 0.3
            T(f"mon_foot{s}{x}", p, x - 0.12, x + 0.12, 0.76, 0.775, z - 0.08, z + 0.08, dark, 0.004)
            T(f"mon_neck{s}{x}", p, x - 0.025, x + 0.025, 0.775, 0.9, z - 0.02, z + 0.02, gun, 0)
            T(f"mon{s}{x}", p, x - 0.3, x + 0.3, 0.86, 1.18, z - 0.02, z + 0.02, dark, 0.006)
            T(f"mon_screen{s}{x}", p, x - 0.28, x + 0.28, 0.88, 1.16, z - s * 0.021, z - s * 0.019, scr, 0)
            T(f"kb{s}{x}", p, x - 0.22, x + 0.22, 0.76, 0.775, s * 0.47 - 0.07, s * 0.47 + 0.07, dark, 0.003)
        T(f"cup{s}", p, s * 0.2 - 0.04, s * 0.2 + 0.04, 0.76, 0.86, s * 0.42 - 0.04, s * 0.42 + 0.04, trim, 0.01)
        T(f"papers{s}", p, -1.45, -1.15, 0.76, 0.79, s * 0.35 - 0.12, s * 0.35 + 0.12, trim, 0.002)
        T(f"drawers{s}", p, 1.05, 1.55, 0.06, 0.66, s * 0.3 - 0.25, s * 0.3 + 0.25, gun, 0.01)
        for k in range(3):
            T(f"drawer_h{s}{k}", p, 1.22, 1.38, 0.18 + k * 0.2, 0.2 + k * 0.2, s * 0.555 - 0.01, s * 0.555 + 0.01, trim, 0)


def desk_s():
    """p_desk_s 2.4 x 0.9: single office desk with a back panel (front = +z, the user's side)."""
    p = piece("p_desk_s")
    w, d = 2.4, 0.9
    T("top", p, -w / 2, w / 2, 0.72, 0.76, -d / 2, d / 2, steel, 0.008)
    for x in (-w / 2 + 0.05, w / 2 - 0.05):
        T(f"side{x}", p, x - 0.04, x + 0.04, 0, 0.72, -d / 2 + 0.03, d / 2 - 0.03, gun, 0.01)
    T("back", p, -w / 2, w / 2, 0.0, H - 0.03, -d / 2, -d / 2 + 0.06, M["wall"], 0.01)
    T("back_cap", p, -w / 2 - 0.01, w / 2 + 0.01, H - 0.03, H, -d / 2 - 0.01, -d / 2 + 0.07, yel, 0.005)
    T("mon", p, -0.35, 0.35, 0.86, 1.16, -0.2, -0.17, dark, 0.006)
    T("mon_screen", p, -0.33, 0.33, 0.88, 1.14, -0.169, -0.167, scr, 0)
    T("mon_neck", p, -0.025, 0.025, 0.76, 0.88, -0.2, -0.16, gun, 0)
    T("kb", p, -0.22, 0.22, 0.76, 0.775, 0.05, 0.19, dark, 0.003)
    T("tower", p, 0.75, 0.95, 0.0, 0.45, -0.3, 0.2, dark, 0.01)
    T("tower_led", p, 0.84, 0.86, 0.38, 0.4, 0.2, 0.202, gy, 0)


def crate():
    """p_crate 2.4 x 1.1: ribbed steel cargo crate, yellow corner posts, stencils."""
    p = piece("p_crate")
    w, d = 2.4, 1.1
    T("body", p, -w / 2 + 0.06, w / 2 - 0.06, 0.1, H - 0.06, -d / 2 + 0.06, d / 2 - 0.06, gun, 0.01)
    for sx in (-1, 1):
        for sz in (-1, 1):
            T(f"post{sx}{sz}", p, sx * w / 2 - 0.08 * (sx + 1), sx * w / 2 + 0.08 * (1 - sx), 0.0, H, sz * d / 2 - 0.08 * (sz + 1), sz * d / 2 + 0.08 * (1 - sz), yel, 0.012)
    for s in (-1, 1):
        for k in range(9):
            x = -1.0 + k * 0.25
            T(f"rib{s}{k}", p, x - 0.03, x + 0.03, 0.14, H - 0.1, s * (d / 2 - 0.04) - 0.02, s * (d / 2 - 0.04) + 0.02, steel, 0.004)
        T(f"band{s}", p, -w / 2 + 0.08, w / 2 - 0.08, 0.5, 0.6, s * (d / 2 - 0.02) - 0.015, s * (d / 2 - 0.02) + 0.015, steel, 0.004)
        stencil(f"tag{s}", p, "F2 / 0441", 0.11, -0.55, 0.85, s * (d / 2 - 0.035) + s * 0.022, M["dark"], "+z" if s > 0 else "-z")
        for k in range(5):
            z = -0.4 + k * 0.2
            T(f"erib{s}{k}", p, s * (w / 2 - 0.04) - 0.02, s * (w / 2 - 0.04) + 0.02, 0.14, H - 0.1, z - 0.03, z + 0.03, steel, 0.004)
    T("lid", p, -w / 2 + 0.07, w / 2 - 0.07, H - 0.06, H - 0.02, -d / 2 + 0.07, d / 2 - 0.07, steel, 0.008)
    T("skid", p, -w / 2 + 0.05, w / 2 - 0.05, 0.0, 0.1, -d / 2 + 0.05, d / 2 - 0.05, dark, 0.006)
    for x in (-0.6, 0.6):
        T(f"slot{x}", p, x - 0.2, x + 0.2, 0.01, 0.09, -d / 2 + 0.04, d / 2 - 0.04, rub, 0)
    T("seal", p, 0.7, 0.9, H - 0.25, H - 0.12, d / 2 - 0.035, d / 2 - 0.02, M["glow_y"], 0)


def trunk():
    """p_trunk 2.4 x 0.8: rugged equipment case / cable vault with a hinged lid, latches and cable coils."""
    p = piece("p_trunk")
    w, d = 2.4, 0.8
    T("body", p, -w / 2 + 0.03, w / 2 - 0.03, 0.08, 0.92, -d / 2 + 0.02, d / 2 - 0.02, steel, 0.03, 2)
    T("lid", p, -w / 2, w / 2, 0.92, 1.06, -d / 2, d / 2, gun, 0.03, 2)
    T("lid_band", p, -w / 2 - 0.005, w / 2 + 0.005, 0.95, 1.0, -d / 2 - 0.005, d / 2 + 0.005, yel, 0.004)
    T("base", p, -w / 2 + 0.02, w / 2 - 0.02, 0.0, 0.08, -d / 2 + 0.04, d / 2 - 0.04, rub, 0.01)
    for s in (-1, 1):
        for x in (-0.8, 0.0, 0.8):
            T(f"latch{s}{x}", p, x - 0.07, x + 0.07, 0.8, 0.98, s * (d / 2) - 0.015, s * (d / 2) + 0.015, trim, 0.006)
        for k in range(4):
            y = 0.2 + k * 0.17
            T(f"rib{s}{k}", p, -w / 2 + 0.12, w / 2 - 0.12, y, y + 0.035, s * (d / 2 - 0.01) - 0.012, s * (d / 2 - 0.01) + 0.012, gun, 0.004)
        T(f"handle{s}", p, s * (w / 2 + 0.005) - 0.015, s * (w / 2 + 0.005) + 0.015, 0.55, 0.62, -0.18, 0.18, yel, 0.006)
    stencil("tag", p, "FIBRE TRUNK", 0.08, 0.0, 0.62, d / 2 + 0.001, M["dark"])
    # cable coil on top (stays under 1.2)
    for k in range(3):
        TC(f"coil{k}", p, -0.55 + k * 0.05, 1.08 + k * 0.035, 0.0, 0.26 - k * 0.03, 0.035, M["dark"], seg=16)
    TC("coil_hub", p, -0.5, 1.1, 0.0, 0.12, 0.06, yel, seg=12)


def console():
    """p_console 3.4 x 1.0: operations console, sloped control deck facing +z, screen bank at the back."""
    p = piece("p_console")
    w, d = 3.4, 1.0
    TPZ("cab", p, [(-0.5, 0.0), (0.5, 0.0), (0.5, 0.78), (0.15, 0.9), (-0.5, 0.95)], -w / 2, w / 2, gun, 0.012)
    T("kick", p, -w / 2 + 0.04, w / 2 - 0.04, 0.0, 0.08, -0.46, 0.46, rub, 0.004)
    T("band", p, -w / 2, w / 2, 0.62, 0.68, 0.495, 0.51, yel, 0)
    # sloped deck with orange screens
    for k in range(3):
        x = -1.1 + k * 1.1
        TQ(f"deck{k}", p, [(x - 0.48, 0.79, 0.47), (x + 0.48, 0.79, 0.47), (x + 0.48, 0.895, 0.17), (x - 0.48, 0.895, 0.17)], scro,
           [(0, 0), (1, 0), (1, 1), (0, 1)])
    T("bank", p, -w / 2 + 0.05, w / 2 - 0.05, 0.9, H - 0.02, -0.5, -0.36, dark, 0.01)
    for k in range(4):
        x = -1.2 + k * 0.8
        T(f"bscreen{k}", p, x - 0.36, x + 0.36, 0.94, H - 0.06, -0.359, -0.357, scr, 0)
    T("bank_cap", p, -w / 2, w / 2, H - 0.02, H, -0.52, -0.34, yel, 0.004)
    for s in (-1, 1):
        T(f"endcap{s}", p, s * (w / 2) - 0.03, s * (w / 2) + 0.03, 0.0, H, -0.5, 0.5, steel, 0.008)
    for k in range(10):
        x = -1.4 + k * 0.31
        T(f"key{k}", p, x - 0.06, x + 0.06, 0.78, 0.8, 0.43, 0.47, trim if k % 3 else gy, 0.002)


def barricade():
    """p_barricade 1.8 x 0.6: deployable steel shield plate on braced feet, firing slit."""
    p = piece("p_barricade")
    w = 1.8
    TPZ("plate", p, [(-0.06, 0.08), (0.06, 0.08), (0.06, H - 0.06), (-0.02, H), (-0.06, H)], -w / 2, w / 2, gun, 0.01)
    T("slit", p, -0.4, 0.4, 0.86, 0.92, -0.07, 0.07, dark, 0)
    T("haz", p, -w / 2 + 0.05, w / 2 - 0.05, 0.16, 0.38, 0.06, 0.068, haz, 0)
    T("haz_b", p, -w / 2 + 0.05, w / 2 - 0.05, 0.16, 0.38, -0.068, -0.06, haz, 0)
    for x in (-0.7, 0.7):
        TPZ(f"brace{x}", p, [(-0.3, 0.0), (0.3, 0.0), (0.06, 0.7), (-0.06, 0.7)], x - 0.04, x + 0.04, steel, 0.006)
        T(f"foot{x}", p, x - 0.12, x + 0.12, 0.0, 0.08, -0.3, 0.3, rub, 0.006)
    T("top", p, -w / 2, w / 2, H - 0.04, H, -0.07, 0.07, yel, 0.005)
    bolts("bolt", p, [(x, y, 0.065) for x in (-0.8, 0.8) for y in (0.5, 1.0)], "+z", trim)


# ================================================================================================ tall pieces
def rack():
    """p_rack 1.6 x 2.0 x 2.8: a pod of four cabinets, LED fronts on both x faces (the gallery runs along x)."""
    p = piece("p_rack")
    wx, dz, h = 1.6, 2.0, 2.8
    T("plinth", p, -wx / 2, wx / 2, 0, 0.1, -dz / 2, dz / 2, dark, 0.005)
    T("body", p, -wx / 2 + 0.03, wx / 2 - 0.03, 0.1, h - 0.12, -dz / 2 + 0.03, dz / 2 - 0.03, gun, 0.01)
    T("top", p, -wx / 2, wx / 2, h - 0.12, h, -dz / 2, dz / 2, gun, 0.015)
    T("top_band", p, -wx / 2 - 0.005, wx / 2 + 0.005, h - 0.3, h - 0.22, -dz / 2 - 0.005, dz / 2 + 0.005, yel, 0.003)
    for s in (-1, 1):
        x = s * (wx / 2 - 0.015)
        for k in range(3):
            z0 = -dz / 2 + 0.06 + k * (dz - 0.12) / 3
            z1 = z0 + (dz - 0.12) / 3 - 0.03
            u0 = (k % 4) * 0.25
            c = [(x, 0.16, z0), (x, 0.16, z1), (x, h - 0.34, z1), (x, h - 0.34, z0)] if s > 0 else [(x, 0.16, z1), (x, 0.16, z0), (x, h - 0.34, z0), (x, h - 0.34, z1)]
            TQ(f"front{s}{k}", p, c, M["rack"], [(u0, 0.0), (u0 + 0.25, 0.0), (u0 + 0.25, 0.95), (u0, 0.95)])
            T(f"handle{s}{k}", p, x + s * 0.005 - 0.01, x + s * 0.005 + 0.01, 1.1, 1.5, z1 - 0.08, z1 - 0.05, trim, 0)
    # cable trays up into the ceiling void
    T("tray", p, -0.3, 0.3, h, h + 0.08, -dz / 2, dz / 2, trim, 0.004)
    for k in range(4):
        TC(f"cable{k}", p, -0.2 + k * 0.13, h + 0.1, 0, 0.035, dz - 0.1, M["dark"] if k != 2 else yel, axis="z", seg=6)
    for s in (-1, 1):
        T(f"side_panel{s}", p, -wx / 2 + 0.05, wx / 2 - 0.05, 0.2, h - 0.4, s * (dz / 2) - 0.01, s * (dz / 2) + 0.01, steel, 0.006)
        stencil(f"tag{s}", p, f"R-{17 if s > 0 else 18}", 0.16, 0.0, h - 0.6, s * (dz / 2 + 0.012), M["dark"], "+z" if s > 0 else "-z")


def cooler():
    """p_cooler 3 x 3 x 3.8: computer-room cooling unit; fans on top, grilles, pipes, status screen (front +z)."""
    p = piece("p_cooler")
    w, h = 3.0, 3.8
    T("plinth", p, -w / 2, w / 2, 0, 0.18, -w / 2, w / 2, dark, 0.01)
    T("body", p, -w / 2 + 0.05, w / 2 - 0.05, 0.18, h - 0.5, -w / 2 + 0.05, w / 2 - 0.05, steel, 0.02, 2)
    for s in (-1, 1):
        T(f"grille{s}", p, -1.25, 1.25, 0.4, 2.5, s * (w / 2 - 0.04) - 0.02, s * (w / 2 - 0.04) + 0.02, dark, 0.004)
        for k in range(14):
            y = 0.48 + k * 0.145
            T(f"slat{s}{k}", p, -1.22, 1.22, y, y + 0.035, s * (w / 2 - 0.02) - 0.015, s * (w / 2 - 0.02) + 0.015, gun, 0)
        T(f"sgrille{s}", p, s * (w / 2 - 0.04) - 0.02, s * (w / 2 - 0.04) + 0.02, 0.4, 2.5, -1.25, 1.25, dark, 0.004)
        for k in range(14):
            y = 0.48 + k * 0.145
            T(f"sslat{s}{k}", p, s * (w / 2 - 0.02) - 0.015, s * (w / 2 - 0.02) + 0.015, y, y + 0.035, -1.22, 1.22, gun, 0)
    T("band", p, -w / 2, w / 2, 2.62, 2.78, -w / 2, w / 2, yel, 0.008)
    T("panel", p, -0.7, 0.7, 2.86, 3.22, w / 2 - 0.06, w / 2 - 0.02, dark, 0.006)
    T("panel_screen", p, -0.62, 0.2, 2.9, 3.18, w / 2 - 0.019, w / 2 - 0.017, scr, 0)
    for k in range(3):
        T(f"panel_led{k}", p, 0.3 + k * 0.12, 0.36 + k * 0.12, 3.0, 3.06, w / 2 - 0.019, w / 2 - 0.017, gy if k else M["glow_w"], 0)
    T("deck", p, -w / 2, w / 2, h - 0.5, h - 0.38, -w / 2, w / 2, gun, 0.015)
    for x in (-0.7, 0.7):
        for z in (-0.7, 0.7):
            TC(f"shroud{x}{z}", p, x, h - 0.2, z, 0.62, 0.36, gun, seg=24)
            TC(f"fan{x}{z}", p, x, h - 0.06, z, 0.56, 0.06, M["dark"], seg=24)
            for k in range(3):
                a = k * pi / 3
                o = T(f"blade{x}{z}{k}", p, x - 0.52, x + 0.52, h - 0.08, h - 0.03, z - 0.05, z + 0.05, steel, 0)
                o.rotation_euler = (0, 0, a)
            TC(f"hub{x}{z}", p, x, h - 0.02, z, 0.1, 0.06, yel, seg=12)
    for s in (-1, 1):
        TC(f"pipe{s}", p, s * 1.1, 1.6, -w / 2 - 0.12, 0.09, 3.0, trim, seg=12)
        TC(f"pipe_c{s}", p, s * 1.1, 0.4, -w / 2 - 0.12, 0.11, 0.08, yel, seg=12)
        TC(f"pipe_c2{s}", p, s * 1.1, 2.6, -w / 2 - 0.12, 0.11, 0.08, yel, seg=12)
    stencil("tag", p, "CRAC-04", 0.22, -1.0, 2.7, w / 2 - 0.005, M["dark"], align="LEFT")


def terminal():
    """p_terminal 2.4 x 2.4 x 2.2: the operations terminal: plinth, four angled screens, a light ring on top."""
    p = piece("p_terminal")
    w = 2.4
    T("plinth", p, -w / 2, w / 2, 0, 0.25, -w / 2, w / 2, gun, 0.02, 2)
    T("plinth_haz", p, -w / 2 - 0.005, w / 2 + 0.005, 0.05, 0.18, -w / 2 - 0.005, w / 2 + 0.005, haz, 0)
    T("core", p, -0.7, 0.7, 0.25, 2.0, -0.7, 0.7, steel, 0.03, 2)
    for k in range(4):
        rot = k * pi / 2
        g = empty(f"face{k}", p, (0, 0, 0), (0, 0, rot))
        # angled desk + screen on each side (Blender local: front = -Y)
        B = lambda n, x0, x1, y0, y1, z0, z1, m, bev=0.01: box(n, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), m, g, bev, 1)
        B(f"desk{k}", -0.75, 0.75, -1.2, -0.7, 0.25, 0.95, gun, 0.012)
        B(f"desk_top{k}", -0.78, 0.78, -1.22, -0.68, 0.95, 0.99, trim, 0.006)
        B(f"mon{k}", -0.62, 0.62, -0.78, -0.72, 1.15, 1.85, M["dark"], 0.01)
        B(f"mon_scr{k}", -0.58, 0.58, -0.785, -0.78, 1.19, 1.81, scro if k % 2 else scr, 0)
        B(f"keys{k}", -0.4, 0.4, -1.1, -0.85, 0.99, 1.01, M["dark"], 0.003)
        B(f"vent{k}", -0.5, 0.5, -0.705, -0.7, 0.4, 0.8, M["dark"], 0)
    T("cap", p, -0.8, 0.8, 2.0, 2.12, -0.8, 0.8, gun, 0.02)
    T("ring", p, -0.82, 0.82, 2.04, 2.08, -0.82, 0.82, gy, 0)
    T("mast", p, -0.08, 0.08, 2.12, 2.2, -0.08, 0.08, trim, 0.005)


def cabinet():
    """p_cabinet 2.2 x 2.4 x 2.4: bank of steel file lockers (front +z)."""
    p = piece("p_cabinet")
    w, d, h = 2.2, 2.4, 2.4
    T("body", p, -w / 2, w / 2, 0.05, h, -d / 2, d / 2, gun, 0.01)
    T("kick", p, -w / 2 + 0.03, w / 2 - 0.03, 0, 0.05, -d / 2 + 0.03, d / 2 - 0.03, rub, 0)
    for s in (-1, 1):
        for i in range(3):
            for j in range(4):
                x0 = -w / 2 + 0.06 + i * (w - 0.12) / 3
                x1 = x0 + (w - 0.12) / 3 - 0.03
                y0 = 0.12 + j * 0.56
                T(f"door{s}{i}{j}", p, x0, x1, y0, y0 + 0.52, s * (d / 2) - 0.012, s * (d / 2) + 0.012, steel, 0.006)
                T(f"pull{s}{i}{j}", p, (x0 + x1) / 2 - 0.1, (x0 + x1) / 2 + 0.1, y0 + 0.42, y0 + 0.45, s * (d / 2 + 0.02) - 0.01, s * (d / 2 + 0.02) + 0.01, trim, 0)
                if (i + j) % 3 == 0:
                    T(f"label{s}{i}{j}", p, x0 + 0.05, x0 + 0.22, y0 + 0.3, y0 + 0.36, s * (d / 2 + 0.013) - 0.002, s * (d / 2 + 0.013) + 0.002, yel, 0)
    T("top", p, -w / 2 - 0.02, w / 2 + 0.02, h, h + 0.04, -d / 2 - 0.02, d / 2 + 0.02, yel, 0.005)


def shaft():
    """p_shaft 6 x 2.2 x 11: the next lift: a sealed express-lift gate set into a frame (front +z = the arena side)."""
    p = piece("p_shaft")
    w, d, h = 6.0, 2.2, 11.0
    T("back", p, -w / 2, w / 2, 0, h, -d / 2, d / 2 - 0.6, gun, 0.02)
    for s in (-1, 1):
        T(f"jamb{s}", p, s * (w / 2 - 0.55) - 0.55, s * (w / 2 - 0.55) + 0.55, 0, h, d / 2 - 0.6, d / 2, gun, 0.03, 2)
        T(f"jamb_haz{s}", p, s * (w / 2 - 0.55) - 0.5, s * (w / 2 - 0.55) + 0.5, 0.1, 1.3, d / 2, d / 2 + 0.015, haz, 0)
        T(f"jamb_glow{s}", p, s * (w / 2 - 1.12) - 0.04, s * (w / 2 - 1.12) + 0.04, 0.3, 6.0, d / 2 - 0.6, d / 2 - 0.5, gy, 0)
        # leaves
        x0, x1 = (-1.9, -0.015) if s < 0 else (0.015, 1.9)
        T(f"leaf{s}", p, x0, x1, 0.05, 6.2, d / 2 - 0.75, d / 2 - 0.6, steel, 0.02)
        for k in range(6):
            y = 0.7 + k * 0.95
            T(f"leaf_rib{s}{k}", p, x0 + 0.1, x1 - 0.1, y, y + 0.12, d / 2 - 0.6, d / 2 - 0.55, gun, 0.006)
        T(f"leaf_haz{s}", p, x0 + 0.05, x1 - 0.05, 0.1, 0.55, d / 2 - 0.6, d / 2 - 0.585, haz, 0)
        T(f"beacon{s}", p, s * (w / 2 - 0.55) - 0.2, s * (w / 2 - 0.55) + 0.2, 6.6, 7.0, d / 2, d / 2 + 0.25, gy, 0.02)
    T("header", p, -w / 2, w / 2, 6.2, 7.6, d / 2 - 0.65, d / 2, gun, 0.03, 2)
    T("header_haz", p, -w / 2 + 1.1, w / 2 - 1.1, 6.35, 6.6, d / 2, d / 2 + 0.015, haz, 0)
    T("seam", p, -0.015, 0.015, 0.1, 6.15, d / 2 - 0.59, d / 2 - 0.57, gy, 0)
    T("above", p, -w / 2, w / 2, 7.6, h, d / 2 - 0.75, d / 2 - 0.6, M["wall"], 0.01)
    for k in range(5):
        y = 8.0 + k * 0.6
        T(f"chev{k}", p, -0.6, 0.6, y, y + 0.12, d / 2 - 0.6, d / 2 - 0.58, gy if k % 2 == 0 else yel, 0)
    stencil("tag", p, "EXPRESS ASCENT / FL 03+", 0.32, 0.0, 6.95, d / 2 + 0.002, M["dark"])


# ================================================================================================ architecture
def stairs():
    """p_stairs: the cooling-hall stairs, 3.5 wide, 14 m run rising 4.5 m toward three +z, balustrade on +x.
    Origin = the centre of the bottom edge (the first riser)."""
    p = piece("p_stairs")
    w, run, rise, n = 3.5, 14.0, 4.5, 28
    tr, ri = run / n, rise / n
    # solid stepped body: one profile in the ZY plane extruded across x
    prof = [(0.0, 0.0)]
    for i in range(n):
        prof += [(i * tr, (i + 1) * ri), ((i + 1) * tr, (i + 1) * ri)]
    prof += [(run, 0.0)]
    TPZ("body", p, [(z, y) for z, y in prof], -w / 2, w / 2, M["gun"], 0.004)
    for i in range(n):
        z0, y = i * tr, (i + 1) * ri
        T(f"nose{i}", p, -w / 2 + 0.05, w / 2 - 0.05, y - 0.02, y + 0.004, z0, z0 + 0.06, yel if i % 4 else gy, 0.002)
        T(f"tread{i}", p, -w / 2 + 0.05, w / 2 - 0.05, y, y + 0.006, z0 + 0.08, z0 + tr - 0.02, M["raised"], 0)
    # stringer + balustrade wall on the open side (+x), sloped top at the handrail height
    xs = w / 2
    TPZ("balustrade", p, [(0.0, 0.0), (run, 0.0), (run, rise + 1.1), (0.0, 1.1)], xs, xs + 0.3, M["wall"], 0.01)
    TPZ("bal_cap", p, [(0.0, 1.1), (run, rise + 1.1), (run, rise + 1.16), (0.0, 1.16)], xs - 0.02, xs + 0.32, yel, 0.004)
    TPZ("bal_glow", p, [(0.3, 0.85), (run - 0.3, rise + 0.85), (run - 0.3, rise + 0.9), (0.3, 0.9)], xs - 0.01, xs, gy, 0)
    # wall-side handrail on brackets
    ang = atan2(rise, run)
    for k in range(6):
        z = 1.0 + k * 2.4
        y = z / run * rise + 0.95
        T(f"bracket{k}", p, -w / 2, -w / 2 + 0.12, y - 0.02, y + 0.02, z - 0.02, z + 0.02, trim, 0)
    TPZ("rail", p, [(0.4, 0.95 + 0.4 / run * rise), (run - 0.4, rise - 0.4 / run * rise + 0.95), (run - 0.4, rise - 0.4 / run * rise + 1.0),
                    (0.4, 1.0 + 0.4 / run * rise)], -w / 2 + 0.1, -w / 2 + 0.16, trim, 0.005)


def railing():
    """p_rail: 2 m mezzanine railing module along x (posts at both ends, kick plate, top rail), 1.1 m."""
    p = piece("p_rail")
    L, h = 2.0, 1.1
    for x in (-L / 2 + 0.05, L / 2 - 0.05):
        T(f"post{x}", p, x - 0.04, x + 0.04, 0, h, -0.04, 0.04, steel, 0.006)
    T("top", p, -L / 2, L / 2, h - 0.05, h, -0.06, 0.06, yel, 0.01)
    for y in (0.4, 0.75):
        T(f"mid{y}", p, -L / 2 + 0.05, L / 2 - 0.05, y - 0.015, y + 0.015, -0.015, 0.015, trim, 0)
    T("kick", p, -L / 2, L / 2, 0, 0.15, -0.012, 0.012, haz, 0)


def frames():
    """p_frame_<w>: door frames that fill the 1 m wall gap of a door of width w (origin = floor centre of the gap).
    p_leaf_<w>: one sliding leaf, half the opening (origin = floor centre of the leaf, closed position)."""
    for w in (2.2, 3.2, 3.6):
        tag = f"{int(round(w * 10)):02d}"
        p = piece(f"p_frame_{tag}")
        hd = 3.3
        for s in (-1, 1):
            x = s * (w / 2 + 0.18)
            T(f"jamb{s}", p, x - 0.2, x + 0.2, 0, hd + 0.3, -0.56, 0.56, gun, 0.02, 2)
            for f in (-1, 1):
                T(f"jamb_haz{s}{f}", p, x - 0.16, x + 0.16, 0.08, 1.2, f * 0.56 - 0.01, f * 0.56 + 0.01, haz, 0)
                T(f"jamb_y{s}{f}", p, x - s * 0.17 - 0.02, x - s * 0.17 + 0.02, 1.25, hd + 0.2, f * 0.56 - 0.012, f * 0.56 + 0.012, yel, 0.002)
            T(f"track{s}", p, x - 0.04, x + 0.04, 0.0, hd, -0.12, 0.12, M["dark"], 0)
            T(f"panel{s}", p, x - 0.14, x + 0.14, 1.35, 1.75, 0.56, 0.575, M["dark"], 0.004)
            T(f"panel_led{s}", p, x - 0.04, x + 0.04, 1.6, 1.68, 0.575, 0.58, gy, 0)
            T(f"panel_b{s}", p, x - 0.14, x + 0.14, 1.35, 1.75, -0.575, -0.56, M["dark"], 0.004)
            T(f"panel_ledb{s}", p, x - 0.04, x + 0.04, 1.6, 1.68, -0.58, -0.575, gy, 0)
        T("header", p, -w / 2 - 0.38, w / 2 + 0.38, hd, hd + 0.62, -0.56, 0.56, gun, 0.02, 2)
        for f in (-1, 1):
            T(f"header_haz{f}", p, -w / 2, w / 2, hd + 0.06, hd + 0.18, f * 0.56 - 0.01, f * 0.56 + 0.01, haz, 0)
        T("sill", p, -w / 2, w / 2, 0, 0.02, -0.5, 0.5, steel, 0.003)
        T("sill_y", p, -w / 2, w / 2, 0.0, 0.025, -0.04, 0.04, yel, 0)
        p = piece(f"p_leaf_{tag}")
        lw = w / 2
        T("leaf", p, -lw / 2, lw / 2, 0.02, hd - 0.02, -0.08, 0.08, steel, 0.015, 2)
        for f in (-1, 1):
            T(f"skin{f}", p, -lw / 2 + 0.06, lw / 2 - 0.06, 0.12, hd - 0.12, f * 0.08 - 0.006, f * 0.08 + 0.006, gun, 0.006)
            for k in range(4):
                y = 0.5 + k * 0.62
                T(f"rib{f}{k}", p, -lw / 2 + 0.12, lw / 2 - 0.12, y, y + 0.08, f * 0.095 - 0.01, f * 0.095 + 0.01, steel, 0.004)
            T(f"haz{f}", p, -lw / 2 + 0.06, lw / 2 - 0.06, 0.12, 0.42, f * 0.087 - 0.003, f * 0.087 + 0.003, haz, 0)
            T(f"vis{f}", p, -0.12, 0.12, 1.9, 2.5, f * 0.087 - 0.004, f * 0.087 + 0.004, M["glass"], 0)
        T("edge", p, -lw / 2, -lw / 2 + 0.05, 0.02, hd - 0.02, -0.085, 0.085, rub, 0.004)


def lamp():
    """p_lamp: 1.6 m linear ceiling fixture (origin = the ceiling attach point; it hangs 0.14 below)."""
    p = piece("p_lamp")
    T("housing", p, -0.8, 0.8, -0.12, 0.0, -0.17, 0.17, gun, 0.008)
    T("diffuser", p, -0.74, 0.74, -0.14, -0.12, -0.11, 0.11, gw, 0)
    for x in (-0.8, 0.8):
        T(f"cap{x}", p, x - 0.02, x + 0.02, -0.13, 0.0, -0.18, 0.18, yel, 0.003)


# ------------------------------------------------------------------------------------------------ build
swatches()
barrier()
desk()
desk_s()
crate()
trunk()
console()
barricade()
rack()
cooler()
terminal()
cabinet()
shaft()
stairs()
railing()
frames()
lamp()

if "preview" in ARGS:
    # lineup render of the props (not exported content)
    pass

for p in list(ROOT.children):
    consolidate(p)
path = os.path.join(OUT, NAME + ".glb")
export(ROOT, path, os.path.join(OUT, NAME + ".blend"))
for p in ROOT.children:
    print("PIECE", p.name, [c.name.split("__")[1] for c in p.children])
