# ASCENT (Ending 2) floors: the level-1 arrival atrium, the cover props, and the level-2 data hall.
# blender -b --factory-startup -P design/3d/end2/floors/floors.py -- atrium|cover|floor2
#   atrium -> end2-atrium-kit.glb   pieces a_* (see ATRIUM below)
#   cover  -> end2-cover-kit.glb    pieces c_* built at the exact cover slot sizes of world.js createCover
#   floor2 -> end2-floor2-kit.glb   pieces f2_*
# Axes: Blender Z up; three.js (x, y, z) = Blender (x, z, -y). FRONT of a repeated piece = Blender -Y = three +z.
# Unique pieces (floors, skylight, end walls, ceiling) are authored in world coordinates (origin = deck centre line,
# x = 0, floor top y = 0, three z = -Blender y). Repeated pieces have their origin at the floor point of their centre.
# Every piece is an empty named after it; its meshes are joined per material on export, so three.js can merge
# all pieces of a floor into one mesh per material (floors.js `buildSet`).
# Materials shared by name across the three kits (three.js keeps the first copy it loads):
#   at_stone, at_stone_lt, at_gun, at_clad, at_yellow, at_hazard, at_trim, at_dark, at_glass,
#   at_glow_y (HF yellow light), at_glow_w (cool white light), at_office (lit office glass, below bloom),
#   c_foliage, c_screen, c_rack (rack fronts, emissive LED map), c_hardlight (energy wall, shader in three.js),
#   f2_floor (raised-floor tiles), f2_beacon (alarm dome).
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import numpy as np
import bmesh, bpy
from math import pi, sin, cos, radians

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else ["atrium"]
WHAT = ARGS[0]
NAME = {"atrium": "end2-atrium-kit", "cover": "end2-cover-kit", "floor2": "end2-floor2-kit"}[WHAT]
kit.reset(NAME, OUT)
TEXDIR = os.path.join(OUT, "tex")


# ------------------------------------------------------------------------------------------------ textures
def cached(name, make, n):
    """Texture sets are deterministic; reuse the PNGs from an earlier run (delete tex/ to rebuild)."""
    paths = [os.path.join(TEXDIR, f"{name}_{k}.png") for k in ("albedo", "orm", "normal")]
    if all(os.path.exists(p) for p in paths):
        out = []
        for p, colour in zip(paths, (True, False, False)):
            img = bpy.data.images.load(p, check_existing=True)
            img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
            out.append(img)
        return tuple(out)
    kit.N = n
    r = make()
    kit.N = 512
    return r


def stone_surface(name, base, seed, slab=2, rough=0.3):
    """Polished stone slabs: soft veining, scuffs, darker joints. `slab` slabs per tile edge."""
    N = kit.N
    vein = fbm(seed + 1, 3, 6, streak=3)
    cloud = fbm(seed + 2, 2, 5)
    speck = fbm(seed + 3, 96, 2)
    scuff = fbm(seed + 4, 10, 6, streak=6)
    grime = fbm(seed + 5, 4, 5)
    t = np.linspace(0, slab, N, endpoint=False) % 1.0
    line = ((t < 0.004) | (t > 0.996)).astype(float)
    seam = np.maximum(line[:, None], line[None, :])
    # per-slab tone variation
    idx = (np.floor(np.linspace(0, slab, N, endpoint=False))).astype(int)
    rr = np.random.default_rng(seed).random((slab, slab))
    tone = rr[idx][:, idx]
    v = sstep(0.47, 0.5, vein) * sstep(0.53, 0.5, vein)
    col = srgb(base)[None, None] * (0.86 + 0.18 * cloud[..., None] + 0.1 * tone[..., None])
    col = col * (1 + 0.1 * v)[..., None] * (0.94 + 0.12 * speck)[..., None]
    col = col * (1 - 0.25 * sstep(0.6, 0.9, grime))[..., None]
    col = col * (1 - 0.7 * seam)[..., None]
    r = np.clip(rough + 0.25 * sstep(0.55, 0.8, scuff) + 0.15 * grime - 0.05 * tone + 0.4 * seam, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, np.zeros((N, N))], axis=2)
    hgt = 0.15 * cloud - 1.6 * seam + 0.05 * speck
    return save(name + "_albedo", col), save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 4.0), False)


def hazard_surface(name, seed, yellow="#d6a210", black="#14181e"):
    """Diagonal hazard stripes (3 periods per tile), chipped and dirty (same look as the lift)."""
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


def raised_floor_surface(name, seed):
    """Data-hall raised floor: 0.6 m tiles (UV tile = 2.4 m -> 4x4 tiles), every third row perforated, scuffed."""
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


def rack_surface(name, seed):
    """Server rack fronts: 0.6 m cabinets, mesh doors, LED columns. UV tile = 2.4 m wide x 2.4 m tall (4 cabinets).
    The emissive map lights the LEDs only (amber, cool white, a little cyan); see rack_material."""
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
    # LED grid: per cabinet two columns of units, each unit a row of tiny dots
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
        # drive bay strip
        bay = (np.abs(fu - 0.7) < 0.2) * (np.abs(fv - 0.5) < 0.08) * (cab == c) * (unit % 6 == 2)
        em += bay[..., None] * srgb("#3b6b8a")[None, None] * 0.5
    col = col + em * 0.4
    r = np.clip(0.5 + 0.2 * grime - 0.3 * frame, 0.05, 1)
    orm = np.stack([np.ones((N, N)), r, 0.6 * frame + 0.2], axis=2)
    hgt = -0.6 * mesh + 0.4 * frame - 0.3 * (em.sum(axis=2) > 0)
    alb = save(name + "_albedo", col)
    emi = save(name + "_emissive", np.clip(em, 0, 1))
    return alb, save(name + "_orm", orm, False), save(name + "_normal", normal_from(hgt, 3.0), False), emi


def tmat_e(name, maps, strength=1.0):
    """Textured PBR material plus an emissive map (glTF emissiveTexture)."""
    alb, orm, nrm, emi = maps
    m = tmat(name, (alb, orm, nrm))
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    te = nt.nodes.new("ShaderNodeTexImage")
    te.image = emi
    nt.links.new(te.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = strength
    return m


def rack_cached(name, seed, n):
    paths = [os.path.join(TEXDIR, f"{name}_{k}.png") for k in ("albedo", "orm", "normal", "emissive")]
    if all(os.path.exists(p) for p in paths):
        out = []
        for p, colour in zip(paths, (True, False, False, True)):
            img = bpy.data.images.load(p, check_existing=True)
            img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
            out.append(img)
        return tuple(out)
    kit.N = n
    r = rack_surface(name, seed)
    kit.N = 512
    return r


# ------------------------------------------------------------------------------------------------ materials
def glass(name, tint="#1d2a36", rough=0.06):
    m = mat(name, lin(tint), 0.0, rough)
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Alpha"].default_value = 0.18
    if hasattr(m, "blend_method"):
        m.blend_method = "BLEND"
    return m


M = dict(
    stone=tmat("at_stone", cached("at_stone", lambda: stone_surface("at_stone", "#2b2f35", 401, slab=2, rough=0.26), 1024)),
    stone_lt=tmat("at_stone_lt", cached("at_stone_lt", lambda: stone_surface("at_stone_lt", "#5a5d61", 405, slab=4, rough=0.3), 512)),
    gun=tmat("at_gun", cached("at_gun", lambda: surface("at_gun", "#262b33", 411, chip=0.74, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.4), 1024)),
    clad=tmat("at_clad", cached("at_clad", lambda: surface("at_clad", "#38424d", 421, chip=0.8, rust_amt=0.2, metal=0.35, rough=0.5, dirt=0.22, panel=2), 1024)),
    yellow=tmat("at_yellow", cached("at_yellow", lambda: surface("at_yellow", "#d9a514", 431, chip=0.66, rust_amt=0.6, metal=0.1, rough=0.5, dirt=0.5), 512)),
    hazard=tmat("at_hazard", cached("at_hazard", lambda: hazard_surface("at_hazard", 441), 512)),
    trim=mat("at_trim", lin("#8a94a3"), 1.0, 0.28),
    dark=mat("at_dark", lin("#07090c"), 0.3, 0.8),
    glass=glass("at_glass"),
    glow_y=mat("at_glow_y", lin("#ffc153"), 0.0, 0.3, em=lin("#ffc153"), strength=1.0),
    glow_w=mat("at_glow_w", lin("#d8ecff"), 0.0, 0.3, em=lin("#d8ecff"), strength=1.0),
    office=mat("at_office", lin("#1a1712"), 0.0, 0.4, em=lin("#ffd9a0"), strength=1.0),
)
kit.UVS = 0.25  # architecture: one texture tile = 4 m


def C(name):
    """Late materials (only the kits that need them build these)."""
    if name in M:
        return M[name]
    if name == "foliage":
        M[name] = mat("c_foliage", lin("#2c3a26"), 0.0, 0.7)
    elif name == "soil":
        M[name] = mat("c_soil", lin("#16110d"), 0.0, 0.95)
    elif name == "screen":
        M[name] = mat("c_screen", lin("#03080c"), 0.0, 0.5, em=lin("#7fc8ff"), strength=1.0)
    elif name == "rack":
        M[name] = tmat_e("c_rack", rack_cached("c_rack", 451, 1024))
    elif name == "hardlight":
        M[name] = mat("c_hardlight", lin("#ffcf4a"), 0.0, 0.2, em=lin("#ffcf4a"), strength=1.0)
    elif name == "rubber":
        M[name] = mat("at_rubber", lin("#0e0f11"), 0.0, 0.85)
    elif name == "raised":
        M[name] = tmat("f2_floor", cached("f2_floor", lambda: raised_floor_surface("f2_floor", 461), 1024))
    elif name == "beacon":
        M[name] = mat("f2_beacon", lin("#ffcf3a"), 0.0, 0.25, em=lin("#ffc21e"), strength=1.0)
    elif name == "cable":
        M[name] = mat("f2_cable", lin("#101214"), 0.0, 0.6)
    elif name == "cable_y":
        M[name] = mat("f2_cable_y", lin("#a07a12"), 0.0, 0.55)
    return M[name]


# ------------------------------------------------------------------------------------------------ helpers
def W(x, z, y):
    """three.js world (x, y, z) -> Blender location tuple. Signature reads (x, z, y) to match plan drawings."""
    return (x, -z, y)


def B(name, parent, x0, x1, y0, y1, z0, z1, m, bev=0.01, seg=1):
    """Axis-aligned box from Blender extents."""
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), m, parent, bev, seg)


def plan(name, pts, z0, z1, m, parent, bev=0.006, loc=(0, 0, 0)):
    """Extrude a polygon given in the Blender XY plane from z0 to z1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in pts]
    b = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, m, parent, loc), bev)


def quad(name, corners, m, parent, uv=None):
    """One-sided quad from 4 Blender points (counter-clockwise seen from the front)."""
    bm = bmesh.new()
    vs = [bm.verts.new(c) for c in corners]
    f = bm.faces.new(vs)
    if uv:
        lay = bm.loops.layers.uv.new()
        for l, c in zip(f.loops, uv):
            l[lay].uv = c
    return mesh_obj(name, bm, m, parent, uv=uv is None)


def planar_uv(o, s):
    """Top-down UVs in world metres * s (tiles line up across separate slabs)."""
    me = o.data
    lay = me.uv_layers.active
    for poly in me.polygons:
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co + o.location
            lay.data[li].uv = (v.x * s, v.y * s)


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
    # drop helper empties left under the piece
    for o in list(p.children_recursive):
        if o.type == "EMPTY":
            for c in list(o.children):
                mw = c.matrix_world.copy()
                c.parent = p
                c.matrix_world = mw
            bpy.data.objects.remove(o)


ROOT = empty(NAME, None)


# ================================================================================================ ATRIUM
def atrium():
    gun, clad, yel, trim, dark, gl = M["gun"], M["clad"], M["yellow"], M["trim"], M["dark"], M["glass"]
    gy, gw = M["glow_y"], M["glow_w"]

    # ---- a_floor: polished stone, lighter runway to the lift, inlaid light lines, trench grates, medallion
    p = piece("a_floor")
    B("slab", p, -19.6, 19.6, -12.7, 44.3, -0.5, 0.0, M["stone"], 0)
    B("runway", p, -4.0, 4.0, -12.7, 34.5, 0.0, 0.004, M["stone_lt"], 0.002)
    for s in (-1, 1):
        B(f"run_edge{s}", p, s * 4.0 - 0.07, s * 4.0 + 0.07, -12.7, 34.5, 0.0, 0.006, trim, 0.002)
        B(f"run_glow{s}", p, s * 4.0 - 0.025, s * 4.0 + 0.025, -12.7, 34.4, 0.0, 0.009, gy, 0)
        # side trench grate along the walls
        x0 = s * 17.6
        B(f"trench{s}", p, x0 - 0.35, x0 + 0.35, -12.4, 43.7, -0.002, 0.003, dark, 0)
        for k in range(0, 186):
            yy = -12.2 + k * 0.3
            B(f"slat{s}_{k}", p, x0 - 0.33, x0 + 0.33, yy - 0.025, yy + 0.025, 0.0, 0.008, gun, 0)
        for yy in (-12.4, 43.7):
            B(f"trench_end{s}_{yy}", p, x0 - 0.38, x0 + 0.38, yy - 0.03, yy + 0.03, 0.0, 0.01, trim, 0)
        B(f"trench_l{s}", p, x0 - 0.38, x0 - 0.33, -12.4, 43.7, 0.0, 0.01, trim, 0)
        B(f"trench_r{s}", p, x0 + 0.33, x0 + 0.38, -12.4, 43.7, 0.0, 0.01, trim, 0)
    # medallion: two inlaid rings and the cardinal ticks around the atrium centre (three z = -14)
    for R, w in ((6.3, 0.06), (6.9, 0.12)):
        bm = bmesh.new()
        seg = 96
        outer = [bm.verts.new((cos(2 * pi * i / seg) * (R + w / 2), 14 + sin(2 * pi * i / seg) * (R + w / 2), 0.003)) for i in range(seg)]
        inner = [bm.verts.new((cos(2 * pi * i / seg) * (R - w / 2), 14 + sin(2 * pi * i / seg) * (R - w / 2), 0.003)) for i in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((inner[i], outer[i], outer[j], inner[j]))
        mesh_obj(f"ring{R}", bm, trim if w < 0.1 else gun, p)
    for k in range(12):
        a = 2 * pi * k / 12
        box(f"tick{k}", (cos(a) * 7.4, 14 + sin(a) * 7.4, 0.004), (0.9 if k % 3 == 0 else 0.4, 0.05, 0.008), gy if k % 3 == 0 else trim, p, 0, 1,
            rot=(0, 0, a))

    # ---- a_pillar: 2.0 m core, 30 m, yellow light slots, collars, capital (origin = base centre)
    p = piece("a_pillar")
    B("plinth", p, -1.15, 1.15, -1.15, 1.15, 0.0, 0.55, gun, 0.03, 2)
    B("plinth_band", p, -1.17, 1.17, -1.17, 1.17, 0.55, 0.68, yel, 0.01)
    B("kick", p, -1.19, 1.19, -1.19, 1.19, 0.0, 0.06, M["dark"], 0.005)
    c = 0.2
    core = [(-0.95 + c, -0.95), (0.95 - c, -0.95), (0.95, -0.95 + c), (0.95, 0.95 - c), (0.95 - c, 0.95), (-0.95 + c, 0.95), (-0.95, 0.95 - c), (-0.95, -0.95 + c)]
    plan("core", core, 0.68, 29.2, clad, p, 0.01)
    for k in range(4):
        rot = k * pi / 2
        g = empty(f"face{k}", p, (0, 0, 0), (0, 0, rot))
        # light slot between two fins on each face
        for s in (-1, 1):
            B(f"fin{k}{s}", g, s * 0.2 - 0.06, s * 0.2 + 0.06, -1.1, -0.93, 0.9, 27.2, gun, 0.01)
        B(f"slot{k}", g, -0.14, 0.14, -0.97, -0.93, 0.9, 27.2, M["dark"], 0)
        B(f"glow{k}", g, -0.035, 0.035, -0.985, -0.95, 1.2, 26.9, gy, 0)
        # access panel with bolts near the base
        B(f"hatch{k}", g, 0.38, 0.82, -0.975, -0.94, 1.0, 2.2, gun, 0.006)
        for bx in (0.43, 0.77):
            for bz in (1.06, 2.14):
                cyl(f"bolt{k}{bx}{bz}", (bx, -0.98, bz), 0.018, 0.02, trim, g, axis="Y", seg=6)
        B(f"vent{k}", g, -0.82, -0.4, -0.975, -0.94, 1.0, 1.6, M["dark"], 0.003)
        for vz in range(5):
            B(f"vslat{k}{vz}", g, -0.8, -0.42, -0.99, -0.95, 1.06 + vz * 0.11, 1.1 + vz * 0.11, gun, 0)
    for z0, band in ((3.4, True), (12.0, False), (20.6, False)):
        B(f"collar{z0}", p, -1.07, 1.07, -1.07, 1.07, z0, z0 + 0.42, gun, 0.02, 2)
        if band:
            B(f"collar_band{z0}", p, -1.08, 1.08, -1.08, 1.08, z0 + 0.13, z0 + 0.29, yel, 0.005)
        else:
            B(f"collar_glow{z0}", p, -1.08, 1.08, -1.08, 1.08, z0 + 0.19, z0 + 0.23, gw, 0)
    B("capital", p, -1.25, 1.25, -1.25, 1.25, 28.4, 29.4, gun, 0.03, 2)
    plan("capital_flare", [(-1.6, -1.6), (1.6, -1.6), (1.6, 1.6), (-1.6, 1.6)], 29.4, 29.9, gun, p, 0.02)

    # ---- bay helpers (7 m modules along X, inside face toward -Y, wall plane at Y = 0)
    def half_pilasters(p, depth=0.9, top=30.0, glow=True):
        for s in (-1, 1):
            B(f"pil{s}", p, s * 3.5 - (0.4 if s > 0 else 0), s * 3.5 + (0.4 if s < 0 else 0), -depth + 0.35, 0.45, 0.0, top, clad, 0.01)
            B(f"pil_base{s}", p, s * 3.5 - (0.45 if s > 0 else 0), s * 3.5 + (0.45 if s < 0 else 0), -depth + 0.3, 0.45, 0.0, 0.5, gun, 0.01)
        if glow:
            B("pil_glow", p, 3.5 - 0.035, 3.5, -depth + 0.33, -depth + 0.36, 1.4, top - 2.0, gy, 0)
            B("pil_glow2", p, -3.5, -3.5 + 0.035, -depth + 0.33, -depth + 0.36, 1.4, top - 2.0, gy, 0)

    # ---- a_bay_glass: right side, sill + full-height curtain wall to the skylight
    p = piece("a_bay_glass")
    B("sill", p, -3.5, 3.5, -0.35, 0.35, 0.0, 1.3, clad, 0.01)
    B("sill_cap", p, -3.5, 3.5, -0.42, 0.4, 1.3, 1.36, trim, 0.005)
    B("grille", p, -3.1, 3.1, -0.37, -0.35, 0.22, 0.72, M["dark"], 0)
    for k in range(6):
        B(f"gslat{k}", p, -3.08, 3.08, -0.4, -0.36, 0.26 + k * 0.08, 0.29 + k * 0.08, gun, 0)
    half_pilasters(p)
    for x in (-1.75, 0.0, 1.75):
        B(f"mull{x}", p, x - 0.05, x + 0.05, -0.18, 0.06, 1.36, 30.0, gun, 0.004)
        B(f"mull_cap{x}", p, x - 0.03, x + 0.03, -0.2, -0.17, 1.36, 30.0, trim, 0)
    for zz in (5.8, 10.3, 14.8, 19.3, 23.8, 28.3):
        B(f"tran{zz}", p, -3.1, 3.1, -0.16, 0.06, zz - 0.05, zz + 0.05, gun, 0.004)
    quad("glass", [(-3.1, 0.0, 1.36), (3.1, 0.0, 1.36), (3.1, 0.0, 30.0), (-3.1, 0.0, 30.0)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    B("head", p, -3.5, 3.5, -0.5, 0.5, 29.6, 30.4, gun, 0.02)
    # exterior maintenance ledge every 9 m (seen through the glass, gives the wall depth)
    for zz in (10.3, 19.3):
        B(f"ledge{zz}", p, -3.5, 3.5, 0.08, 0.9, zz - 0.12, zz, gun, 0.01)
        B(f"ledge_rail{zz}", p, -3.5, 3.5, 0.85, 0.9, zz, zz + 1.0, trim, 0.005)

    # ---- a_bay_wall_door / a_bay_wall_info: left side, mezzanines at 7.5 and 15, offices behind glass
    def wall_bay(name, door):
        p = piece(name)
        half_pilasters(p)
        B("wall_low", p, -3.1, 3.1, 0.0, 0.4, 0.0, 7.0, clad, 0.01)
        B("skirt", p, -3.1, 3.1, -0.05, 0.0, 0.0, 0.25, gun, 0.004)
        if door:
            B("door_frame", p, -1.35, 1.35, -0.18, 0.02, 0.0, 3.5, gun, 0.01)
            B("door_recess", p, -1.15, 1.15, -0.02, 0.05, 0.0, 3.3, M["dark"], 0)
            for s in (-1, 1):
                B(f"door_leaf{s}", p, (0 if s > 0 else -1.1), (1.1 if s > 0 else 0), -0.06, -0.01, 0.02, 3.25, gun, 0.006)
                B(f"door_win{s}", p, s * 0.55 - 0.15, s * 0.55 + 0.15, -0.075, -0.06, 1.4, 2.6, M["office"], 0)
            B("door_glow", p, -1.2, 1.2, -0.2, -0.17, 3.42, 3.47, gy, 0)
            B("door_plate", p, 1.55, 2.25, -0.06, -0.0, 2.0, 2.3, trim, 0.004)
            B("door_plate_y", p, 1.58, 2.22, -0.07, -0.06, 2.12, 2.18, yel, 0)
        else:
            B("info_frame", p, -2.6, 2.6, -0.12, 0.02, 0.9, 5.6, gun, 0.012)
            B("info_panel", p, -2.4, 2.4, -0.13, -0.11, 1.1, 5.4, M["office"], 0)
            for k in range(5):
                B(f"info_rib{k}", p, -2.4 + k * 1.2 - 0.03, -2.4 + k * 1.2 + 0.03, -0.16, -0.12, 1.1, 5.4, gun, 0)
            B("bench", p, -2.0, 2.0, -0.75, -0.25, 0.42, 0.5, M["stone_lt"], 0.01)
            for s in (-1, 1):
                B(f"bench_leg{s}", p, s * 1.6 - 0.1, s * 1.6 + 0.1, -0.7, -0.3, 0.0, 0.42, gun, 0.005)
        for zl in (7.5, 15.0):
            # slab, fascia, soffit lights, glass balustrade, rail
            B(f"slab{zl}", p, -3.5, 3.5, -3.5, 0.0, zl - 0.55, zl, gun, 0.01)
            B(f"fascia{zl}", p, -3.5, 3.5, -3.58, -3.48, zl - 0.6, zl + 0.05, yel, 0.004)
            B(f"fascia_glow{zl}", p, -3.5, 3.5, -3.52, -3.42, zl - 0.66, zl - 0.6, gw, 0)
            for dx in (-1.75, 1.75):
                cyl(f"down{zl}{dx}", (dx, -1.75, zl - 0.56), 0.16, 0.02, gw, p, seg=12)
            quad(f"balu{zl}", [(-3.5, -3.42, zl), (3.5, -3.42, zl), (3.5, -3.42, zl + 1.05), (-3.5, -3.42, zl + 1.05)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
            B(f"rail{zl}", p, -3.5, 3.5, -3.5, -3.36, zl + 1.05, zl + 1.11, trim, 0.01)
            for dx in (-2.625, -0.875, 0.875, 2.625):
                B(f"post{zl}{dx}", p, dx - 0.03, dx + 0.03, -3.46, -3.38, zl, zl + 1.05, gun, 0)
            # office front behind the mezzanine
            top = zl + 7.5 - 0.6 if zl < 15 else 22.4
            B(f"office_sill{zl}", p, -3.1, 3.1, -0.1, 0.4, zl, zl + 0.6, clad, 0.01)
            B(f"office_glow{zl}", p, -3.1, 3.1, 0.25, 0.3, zl + 0.6, top - 0.4, M["office"], 0)
            quad(f"office_glass{zl}", [(-3.1, 0.0, zl + 0.6), (3.1, 0.0, zl + 0.6), (3.1, 0.0, top - 0.4), (-3.1, 0.0, top - 0.4)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
            for x in (-1.55, 0.0, 1.55):
                B(f"omull{zl}{x}", p, x - 0.04, x + 0.04, -0.06, 0.04, zl + 0.6, top - 0.4, gun, 0)
            B(f"office_head{zl}", p, -3.1, 3.1, -0.1, 0.4, top - 0.4, top + 0.1, clad, 0.01)
            # silhouettes of desks inside the offices
            for x in (-2.0, 0.6):
                B(f"odesk{zl}{x}", p, x, x + 1.3, 0.45, 1.2, zl + 0.0, zl + 0.75, gun, 0.004)
            B(f"oback{zl}", p, -3.1, 3.1, 1.5, 1.6, zl - 0.2, top, clad, 0)
        B("wall_top", p, -3.1, 3.1, 0.0, 0.4, 22.4, 30.0, clad, 0.01)
        for zz in (24.5, 27.0):
            B(f"reveal{zz}", p, -3.1, 3.1, -0.02, 0.0, zz, zz + 0.06, M["dark"], 0)
        B("head", p, -3.5, 3.5, -0.5, 0.5, 29.6, 30.4, gun, 0.02)

    wall_bay("a_bay_wall_door", True)
    wall_bay("a_bay_wall_info", False)

    # ---- a_skylight: coffered glass roof at 30 m with a shaft opening for the lift (x +-5.4, z -34..-44)
    p = piece("a_skylight")
    zt = 30.0
    xs = (-19.4, -12.2, -5.4, 5.4, 12.2, 19.4)
    for x in xs:
        B(f"beamx{x}", p, x - 0.3, x + 0.3, -12.6, 44.2, zt, zt + 1.3, gun, 0.02)
        B(f"beamx_glow{x}", p, x - 0.05, x + 0.05, -12.6, 44.2, zt - 0.03, zt, gw, 0)
    for k in range(9):
        y = -12.3 + k * 7.0
        x0, x1 = -19.4, 19.4
        B(f"beamy{k}", p, x0, x1, y - 0.3, y + 0.3, zt, zt + 1.3, gun, 0.02)
        B(f"beamy_glow{k}", p, x0, x1, y - 0.05, y + 0.05, zt - 0.03, zt, gw, 0)
    # purlins every 1.75 m (coffers)
    for k in range(32):
        y = -12.3 + 0.875 + k * 1.75
        if abs((y + 12.3) % 7.0) < 0.1:
            continue
        for xa, xb in ((-19.4, -5.4), (5.4, 19.4)) if y > 34.0 else ((-19.4, 19.4),):
            B(f"purl{k}{xa}", p, xa, xb, y - 0.06, y + 0.06, zt + 0.7, zt + 1.0, gun, 0)
    # glass (three panes around the lift opening)
    for (xa, xb, ya, yb) in ((-19.4, -5.4, -12.6, 44.2), (5.4, 19.4, -12.6, 44.2), (-5.4, 5.4, -12.6, 34.0)):
        quad(f"sky_glass{xa}{ya}", [(xa, ya, zt + 1.0), (xb, ya, zt + 1.0), (xb, yb, zt + 1.0), (xa, yb, zt + 1.0)][::-1], gl, p,
             uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    # lift opening: lined collar
    B("shaft_lip", p, -5.4, 5.4, 33.8, 34.3, zt - 0.4, zt + 1.3, gun, 0.02)
    B("shaft_lip_y", p, -5.4, 5.4, 33.75, 33.8, zt - 0.4, zt + 0.2, M["hazard"], 0)
    for s in (-1, 1):
        B(f"shaft_side{s}", p, s * 5.4 - 0.25, s * 5.4 + 0.25, 34.0, 44.2, zt - 0.4, zt + 1.3, gun, 0.02)
    # parapet
    for s in (-1, 1):
        B(f"parapet_x{s}", p, s * 19.4 - 0.3, s * 19.4 + 0.3, -12.6, 44.2, zt + 1.3, zt + 2.0, clad, 0.01)
    B("parapet_front", p, -19.4, 19.4, -12.9, -12.3, zt + 1.3, zt + 2.0, clad, 0.01)

    # ---- a_halo: ring chandelier (origin = ring centre), cables reach 10 m up
    p = piece("a_halo")
    torus("ring_glow", (0, 0, 0), 4.5, 0.075, gw, p, axis="Z", seg=64, rseg=6)
    torus("ring_outer", (0, 0, 0.0), 4.72, 0.11, gun, p, axis="Z", seg=64, rseg=6)
    torus("ring_inner", (0, 0, 0.0), 4.28, 0.06, trim, p, axis="Z", seg=64, rseg=6)
    for k in range(6):
        a = 2 * pi * k / 6
        box(f"clip{k}", (cos(a) * 4.5, sin(a) * 4.5, 0.12), (0.4, 0.22, 0.16), gun, p, 0.01, rot=(0, 0, a))
    for k in range(3):
        a = 2 * pi * k / 3 + pi / 6
        cyl(f"cable{k}", (cos(a) * 4.5, sin(a) * 4.5, 5.1), 0.012, 10.0, trim, p, seg=6)
    torus("ring_y", (0, 0, 0.16), 4.5, 0.03, M["yellow"], p, axis="Z", seg=64, rseg=4)

    # ---- a_far_wall: emblem wall at three z = -44 with a recessed centre bay (world coordinates)
    p = piece("a_far_wall")
    y0 = 44.0  # inner face
    for s in (-1, 1):
        B(f"block{s}", p, min(s * 7.6, s * 19.6), max(s * 7.6, s * 19.6), y0, y0 + 1.6, 0.0, 30.0, clad, 0.01)
        for zz in (3.0, 6.0, 9.0, 12.0, 15.0, 18.0, 21.0, 24.0, 27.0):
            B(f"rev{s}{zz}", p, min(s * 7.6, s * 19.6), max(s * 7.6, s * 19.6), y0 - 0.02, y0, zz, zz + 0.05, M["dark"], 0)
        B(f"skirt{s}", p, min(s * 7.6, s * 19.6), max(s * 7.6, s * 19.6), y0 - 0.08, y0, 0.0, 0.3, gun, 0.005)
        # recess pilasters with glow edges
        B(f"jamb{s}", p, s * 7.6 - 0.45, s * 7.6 + 0.45, y0 - 0.45, y0 + 1.6, 0.0, 23.0, gun, 0.02)
        B(f"jamb_glow{s}", p, s * 7.15 - 0.03, s * 7.15 + 0.03, y0 - 0.2, y0 + 0.2, 0.6, 22.4, gy, 0)
        # large vents low on the blocks
        for k in range(2):
            xc = s * (11.0 + k * 5.0)
            B(f"vent{s}{k}", p, xc - 1.6, xc + 1.6, y0 - 0.05, y0, 0.8, 2.6, M["dark"], 0)
            for j in range(8):
                B(f"vslat{s}{k}{j}", p, xc - 1.55, xc + 1.55, y0 - 0.1, y0 - 0.02, 0.88 + j * 0.22, 0.95 + j * 0.22, gun, 0)
    # recess back wall with vertical ribs
    B("recess_back", p, -7.6, 7.6, y0 + 1.2, y0 + 2.0, 0.0, 23.0, M["dark"], 0)
    for k in range(15):
        x = -7.0 + k * 1.0
        B(f"rib{k}", p, x - 0.12, x + 0.12, y0 + 0.95, y0 + 1.2, 0.0, 23.0, gun, 0.008)
    B("recess_floor_glow", p, -7.1, 7.1, y0 + 0.9, y0 + 1.0, 0.0, 0.06, gy, 0)
    # lintel over the recess, yellow band
    B("lintel", p, -8.1, 8.1, y0 - 0.5, y0 + 1.6, 23.0, 30.0, clad, 0.02)
    B("lintel_band", p, -8.1, 8.1, y0 - 0.56, y0 - 0.5, 23.0, 23.6, yel, 0.004)
    B("lintel_glow", p, -7.6, 7.6, y0 - 0.5, y0 - 0.3, 22.94, 23.0, gw, 0)
    B("cornice", p, -19.6, 19.6, y0 - 0.6, y0 + 1.6, 29.6, 30.4, gun, 0.02)

    # ---- a_portal: entrance wall at three z = +12.3 (inner face), glass doors, glass above (the lift camera flies out here)
    p = piece("a_portal")
    yi = -12.3
    for s in (-1, 1):
        B(f"side{s}", p, min(s * 6.8, s * 19.6), max(s * 6.8, s * 19.6), yi - 0.8, yi, 0.0, 10.0, clad, 0.01)
        B(f"side_skirt{s}", p, min(s * 6.8, s * 19.6), max(s * 6.8, s * 19.6), yi, yi + 0.06, 0.0, 0.3, gun, 0.004)
        for zz in (3.0, 6.0):
            B(f"side_rev{s}{zz}", p, min(s * 6.8, s * 19.6), max(s * 6.8, s * 19.6), yi, yi + 0.02, zz, zz + 0.05, M["dark"], 0)
        B(f"jamb{s}", p, s * 6.4 - 0.5, s * 6.4 + 0.5, yi - 0.9, yi + 0.5, 0.0, 11.6, gun, 0.02)
        B(f"jamb_y{s}", p, s * 5.88 - 0.02, s * 5.88 + 0.02, yi - 0.8, yi + 0.4, 0.0, 10.6, yel, 0)
        B(f"jamb_glow{s}", p, s * 5.9 - 0.03, s * 5.9 + 0.03, yi + 0.42, yi + 0.5, 0.4, 10.4, gy, 0)
    B("lintel", p, -6.9, 6.9, yi - 0.9, yi + 0.5, 10.6, 11.6, gun, 0.02)
    B("lintel_y", p, -6.9, 6.9, yi + 0.5, yi + 0.56, 10.6, 11.0, yel, 0.004)
    B("canopy", p, -6.9, 6.9, yi, yi + 1.8, 9.8, 10.2, gun, 0.02)
    B("canopy_glow", p, -6.4, 6.4, yi + 0.4, yi + 1.6, 9.77, 9.8, gw, 0)
    # door leaves (glass with frames)
    for k in range(4):
        xa = -5.8 + k * 2.9
        B(f"leaf_frame_l{k}", p, xa, xa + 0.08, yi - 0.45, yi - 0.35, 0.0, 9.0, gun, 0)
        B(f"leaf_frame_t{k}", p, xa, xa + 2.9, yi - 0.45, yi - 0.35, 8.9, 9.0, gun, 0)
        B(f"leaf_bar{k}", p, xa + 0.2, xa + 2.7, yi - 0.47, yi - 0.43, 1.0, 1.08, trim, 0)
        quad(f"leaf_glass{k}", [(xa, yi - 0.4, 0.0), (xa + 2.9, yi - 0.4, 0.0), (xa + 2.9, yi - 0.4, 8.9), (xa, yi - 0.4, 8.9)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    B("door_head", p, -5.9, 5.9, yi - 0.8, yi, 9.0, 10.6, clad, 0.01)
    B("threshold", p, -5.9, 5.9, yi - 0.6, yi + 0.4, 0.0, 0.02, M["hazard"], 0)
    # glass above the doors and side walls up to the skylight
    zt0 = 11.6
    B("transom_low", p, -19.6, 19.6, yi - 0.25, yi + 0.1, zt0 - 0.2, zt0, gun, 0.01)
    for k in range(23):
        x = -19.25 + k * 1.75
        B(f"pmull{k}", p, x - 0.05, x + 0.05, yi - 0.2, yi + 0.05, zt0, 30.0, gun, 0)
    for zz in (16.0, 20.5, 25.0):
        B(f"ptran{zz}", p, -19.6, 19.6, yi - 0.18, yi + 0.04, zz - 0.05, zz + 0.05, gun, 0)
    quad("portal_glass", [(-19.6, yi, zt0), (19.6, yi, zt0), (19.6, yi, 30.0), (-19.6, yi, 30.0)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    for s in (-1, 1):
        B(f"pil{s}", p, min(s * 19.0, s * 19.6), max(s * 19.0, s * 19.6), yi - 0.9, yi + 0.5, 0.0, 30.0, clad, 0.01)
    B("head", p, -19.6, 19.6, yi - 0.5, yi + 0.5, 29.6, 30.4, gun, 0.02)


# ================================================================================================ COVER
# Cover slots (world.js createCover): box sx x 1.5 (+0.12 lip), collider height 1.43. Origin = floor centre, front = -Y.
def cover():
    gun, clad, yel, trim, dark, gl = M["gun"], M["clad"], M["yellow"], M["trim"], M["dark"], M["glass"]
    kit.UVS = 0.8
    H = 1.35

    def foot(p, w, d=1.5):
        B("kick", p, -w / 2 + 0.04, w / 2 - 0.04, -d / 2 + 0.04, d / 2 - 0.04, 0.0, 0.08, C("rubber"), 0.005)

    # reception desk (5.0)
    p = piece("c_desk_500")
    w, d = 5.0, 1.5
    pts = [(-w / 2, d / 2), (-w / 2, -d / 2 + 0.3), (-w / 2 + 0.3, -d / 2), (w / 2 - 0.3, -d / 2), (w / 2, -d / 2 + 0.3), (w / 2, d / 2)]
    plan("body", pts, 0.08, 1.06, clad, p, 0.02)
    plan("top", [(x * 1.02, y * 1.04) for x, y in pts], 1.06, 1.12, M["stone_lt"], p, 0.01)
    # raised transaction counter along the front
    B("counter", p, -w / 2 + 0.35, w / 2 - 0.35, -d / 2 - 0.04, -d / 2 + 0.34, 1.12, H, gun, 0.015)
    B("counter_top", p, -w / 2 + 0.3, w / 2 - 0.3, -d / 2 - 0.08, -d / 2 + 0.36, H, H + 0.04, M["stone_lt"], 0.008)
    B("counter_glow", p, -w / 2 + 0.4, w / 2 - 0.4, -d / 2 - 0.07, -d / 2 - 0.04, 1.13, 1.16, gy, 0)
    B("band", p, -w / 2 + 0.3, w / 2 - 0.3, -d / 2 - 0.012, -d / 2, 0.55, 0.68, yel, 0)
    for k in range(5):
        x = -2.0 + k * 1.0
        B(f"panel{k}", p, x - 0.46, x + 0.46, -d / 2 - 0.02, -d / 2, 0.16, 0.48, gun, 0.006)
    foot(p, w, d)
    # monitors on the back (staff) side, below the cover height
    for x in (-1.3, 1.1):
        B(f"mon_stand{x}", p, x - 0.05, x + 0.05, 0.2, 0.28, 1.12, 1.18, gun, 0)
        B(f"mon{x}", p, x - 0.32, x + 0.32, 0.24, 0.28, 1.15, 1.40, M["dark"], 0.005)
        B(f"mon_screen{x}", p, x - 0.29, x + 0.29, 0.285, 0.29, 1.18, 1.38, C("screen"), 0)
    B("keyboard", p, -0.3, 0.3, 0.45, 0.6, 1.12, 1.14, dark, 0.004)

    # planter (5.0): concrete box, lip, soil, shrubs
    p = piece("c_planter_500")
    w = 5.0
    B("box", p, -w / 2, w / 2, -0.75, 0.75, 0.0, 0.95, M["stone_lt"], 0.03, 2)
    B("lip", p, -w / 2 - 0.04, w / 2 + 0.04, -0.79, 0.79, 0.95, 1.02, gun, 0.01)
    B("soil", p, -w / 2 + 0.12, w / 2 - 0.12, -0.63, 0.63, 0.9, 0.98, C("soil"), 0)
    B("band", p, -w / 2, w / 2, -0.765, -0.75, 0.12, 0.18, yel, 0)
    rng_ = np.random.default_rng(5)
    for k in range(22):
        x = -2.2 + k * 0.21 + rng_.uniform(-0.05, 0.05)
        y = rng_.uniform(-0.4, 0.4)
        r = rng_.uniform(0.22, 0.34)
        h = rng_.uniform(1.18, 1.4)
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
        for v in bm.verts:
            v.co.z *= 0.8
            v.co += Vector((rng_.uniform(-0.04, 0.04), rng_.uniform(-0.04, 0.04), rng_.uniform(-0.04, 0.04)))
        mesh_obj(f"shrub{k}", bm, C("foliage"), p, (x, y, h - r * 0.8))
    for x in (-1.8, 0.0, 1.8):
        B(f"light{x}", p, x - 0.2, x + 0.2, -0.77, -0.75, 0.55, 0.62, gw, 0)

    # barrier (5.0): two jersey barriers with hazard paint + steel mesh top rail
    p = piece("c_barrier_500")
    prof = [(-0.75, 0.0), (0.75, 0.0), (0.68, 0.25), (0.28, 0.45), (0.22, 1.08), (-0.22, 1.08), (-0.28, 0.45), (-0.68, 0.25)]
    for s in (-1, 1):
        xa, xb = (-2.5, -0.02) if s < 0 else (0.02, 2.5)
        bm = bmesh.new()  # jersey profile (Y, Z) extruded along X
        a = [bm.verts.new((xa, y, z)) for y, z in prof]
        b = [bm.verts.new((xb, y, z)) for y, z in prof]
        bm.faces.new(a)
        bm.faces.new(b[::-1])
        for i in range(len(prof)):
            j = (i + 1) % len(prof)
            bm.faces.new((a[i], b[i], b[j], a[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bevel(mesh_obj(f"jersey{s}", bm, M["stone_lt"], p), 0.02)
        B(f"haz{s}", p, xa + 0.05, xb - 0.05, -0.7, -0.62, 0.05, 0.24, M["hazard"], 0)
        B(f"hazb{s}", p, xa + 0.05, xb - 0.05, 0.62, 0.7, 0.05, 0.24, M["hazard"], 0)
        B(f"cap{s}", p, xa + 0.02, xb - 0.02, -0.25, 0.25, 1.08, 1.12, gun, 0.01)
        for x in (xa + 0.15, xb - 0.15):
            B(f"post{s}{x}", p, x - 0.04, x + 0.04, -0.04, 0.04, 1.12, H + 0.05, trim, 0.004)
        B(f"toprail{s}", p, xa + 0.1, xb - 0.1, -0.04, 0.04, H, H + 0.06, yel, 0.005)
        for k in range(10):
            x = xa + 0.25 + k * (xb - xa - 0.5) / 9
            B(f"mesh{s}{k}", p, x - 0.008, x + 0.008, -0.01, 0.01, 1.12, H, trim, 0)
        B(f"lift_slot{s}", p, (xa + xb) / 2 - 0.3, (xa + xb) / 2 + 0.3, -0.76, 0.76, 0.0, 0.08, dark, 0)

    # checkpoint (4.0): baggage scanner lane with tunnel, rollers and an operator screen
    p = piece("c_checkpoint_400")
    w = 4.0
    B("base", p, -w / 2, w / 2, -0.75, 0.75, 0.0, 0.75, clad, 0.02)
    B("belt", p, -w / 2 + 0.05, w / 2 - 0.05, -0.45, 0.45, 0.75, 0.8, C("rubber"), 0.004)
    for k in range(16):
        x = -1.9 + k * 0.25
        if abs(x) < 0.9:
            continue
        cyl(f"roller{k}", (x, 0, 0.78), 0.03, 0.9, trim, p, axis="Y", seg=8)
    B("tunnel", p, -0.95, 0.95, -0.75, 0.75, 0.8, H, gun, 0.03, 2)
    B("tunnel_mouth", p, -0.97, 0.97, -0.5, 0.5, 0.82, 1.2, dark, 0.01)
    B("tunnel_band", p, -0.96, 0.96, -0.765, -0.75, 1.05, 1.15, yel, 0)
    B("tunnel_glow", p, -0.6, 0.6, -0.77, -0.76, 1.22, 1.26, gy, 0)
    for s in (-1, 1):
        B(f"guard{s}", p, -w / 2, w / 2, s * 0.62 - 0.03, s * 0.62 + 0.03, 0.8, 0.95, trim, 0.005)
    B("screen_box", p, 1.2, 1.9, 0.2, 0.7, 0.8, H, gun, 0.01)
    B("screen", p, 1.25, 1.85, 0.195, 0.2, 0.95, 1.3, C("screen"), 0)
    B("haz", p, -w / 2, w / 2, -0.765, -0.75, 0.05, 0.2, M["hazard"], 0)
    foot(p, w)

    # rack rows (4.4 / 4.0 / 3.2): back-to-back half-height cabinets with LED fronts
    for name, w in (("c_racks_440", 4.4), ("c_racks_400", 4.0), ("c_racks_320", 3.2)):
        p = piece(name)
        n = round(w / 0.6)
        cw = w / n
        B("plinth", p, -w / 2, w / 2, -0.75, 0.75, 0.0, 0.1, dark, 0.005)
        for k in range(n):
            x = -w / 2 + cw * (k + 0.5)
            B(f"cab{k}", p, x - cw / 2 + 0.01, x + cw / 2 - 0.01, -0.72, 0.72, 0.1, 1.3, gun, 0.012)
            for s in (-1, 1):
                # LED front (UVs: one cabinet = a quarter of the rack tile)
                u0 = (k % 4) * 0.25
                yy = s * 0.725
                c = [(x - cw / 2 + 0.05, yy, 0.16), (x + cw / 2 - 0.05, yy, 0.16), (x + cw / 2 - 0.05, yy, 1.24), (x - cw / 2 + 0.05, yy, 1.24)]
                quad(f"front{k}{s}", c if s < 0 else c[::-1], C("rack"), p,
                     uv=[(u0, 0.1), (u0 + 0.25, 0.1), (u0 + 0.25, 0.55), (u0, 0.55)] if s < 0 else [(u0, 0.55), (u0 + 0.25, 0.55), (u0 + 0.25, 0.1), (u0, 0.1)])
        B("top", p, -w / 2, w / 2, -0.78, 0.78, 1.3, H, gun, 0.01)
        B("tray", p, -w / 2 + 0.1, w / 2 - 0.1, -0.2, 0.2, H, H + 0.06, trim, 0.004)
        for k in range(5):
            cyl(f"cable{k}", (0, -0.12 + k * 0.06, H + 0.045), 0.025, w - 0.3, C("cable_y") if k == 2 else C("cable"), p, axis="X", seg=6)
        B("band", p, -w / 2, w / 2, -0.79, -0.78, 1.18, 1.24, yel, 0)

    # hard-light barriers (5.0 / 3.6): emitter base + end posts + energy wall (shader in three.js)
    for name, w in (("c_hardlight_500", 5.0), ("c_hardlight_360", 3.6)):
        p = piece(name)
        B("base", p, -w / 2, w / 2, -0.4, 0.4, 0.0, 0.28, gun, 0.03, 2)
        B("base_y", p, -w / 2, w / 2, -0.415, -0.4, 0.06, 0.16, M["hazard"], 0)
        B("emitter", p, -w / 2 + 0.3, w / 2 - 0.3, -0.12, 0.12, 0.28, 0.34, dark, 0.005)
        B("emitter_glow", p, -w / 2 + 0.35, w / 2 - 0.35, -0.05, 0.05, 0.34, 0.35, C("hardlight"), 0)
        for s in (-1, 1):
            x = s * (w / 2 - 0.18)
            B(f"post{s}", p, x - 0.18, x + 0.18, -0.3, 0.3, 0.28, H + 0.08, gun, 0.02)
            B(f"post_glow{s}", p, x - 0.03 - s * 0.16, x + 0.03 - s * 0.16, -0.08, 0.08, 0.4, H, C("hardlight"), 0)
            B(f"post_cap{s}", p, x - 0.2, x + 0.2, -0.32, 0.32, H + 0.08, H + 0.12, yel, 0.005)
            for k in range(3):
                B(f"post_rib{s}{k}", p, x - 0.19, x + 0.19, -0.31, 0.31, 0.5 + k * 0.3, 0.54 + k * 0.3, trim, 0)
        # energy wall: two sheets (front/back), UV u along the wall, v up
        wl = w / 2 - 0.36
        for s, yy in ((-1, -0.03), (1, 0.03)):
            c = [(-wl, yy, 0.34), (wl, yy, 0.34), (wl, yy, H), (-wl, yy, H)]
            quad(f"wall{s}", c if s < 0 else c[::-1], C("hardlight"), p,
                 uv=[(0, 0), (w, 0), (w, 1), (0, 1)] if s < 0 else [(0, 1), (w, 1), (w, 0), (0, 0)])
        # the energy-wall sheets keep their own node so three.js can give them the shimmer shader
        for s in (-1, 1):
            kit.sc.objects[f"wall{s}"].data.materials.clear()
        hl = mat("c_hardlight_wall", lin("#ffcf4a"), 0.0, 0.2, em=lin("#ffcf4a"), strength=1.0)
        for s in (-1, 1):
            kit.sc.objects[f"wall{s}"].data.materials.append(hl)


# ================================================================================================ FLOOR 2
def floor2():
    gun, clad, yel, trim, dark, gl = M["gun"], M["clad"], M["yellow"], M["trim"], M["dark"], M["glass"]
    gy, gw = M["glow_y"], M["glow_w"]
    rack = C("rack")
    HALL = 12.0

    # ---- f2_floor: raised floor with the lift opening (x +-4.0, z -35 .. -43)
    p = piece("f2_floor")
    kit.UVS = 1 / 2.4
    hx0, hx1, hy0, hy1 = -4.0, 4.0, 35.0, 43.0
    for (xa, xb, ya, yb) in ((-19.6, 19.6, -12.7, hy0), (-19.6, 19.6, hy1, 44.3), (-19.6, hx0, hy0, hy1), (hx1, 19.6, hy0, hy1)):
        planar_uv(B(f"tiles{xa}{ya}", p, xa, xb, ya, yb, -0.6, 0.0, C("raised"), 0), 1 / 2.4)
    kit.UVS = 0.25
    # opening liner and the under-floor structure visible from below during the ride
    for (xa, xb, ya, yb) in ((hx0, hx1, hy0 - 0.12, hy0), (hx0, hx1, hy1, hy1 + 0.12), (hx0 - 0.12, hx0, hy0, hy1), (hx1, hx1 + 0.12, hy0, hy1)):
        B(f"liner{xa}{ya}", p, xa, xb, ya, yb, -1.6, 0.0, gun, 0.005)
    B("under", p, -19.6, 19.6, -12.7, 44.3, -1.6, -1.2, gun, 0)
    for k in range(9):
        y = -12.3 + k * 7.0
        if hy0 - 1 < y < hy1 + 1:
            continue
        B(f"girder{k}", p, -19.6, 19.6, y - 0.35, y + 0.35, -2.6, -1.6, gun, 0.02)
    # safety yellow edge strip around the opening is lift-ui's pit frame; add the slot lights between
    for s in (-1, 1):
        B(f"edge_glow{s}", p, -18.0, 18.0, -12.0 if s < 0 else 43.6, -11.94 if s < 0 else 43.66, 0.0, 0.01, gy, 0)
    # cable trench under removed tiles, the hall's visual spine
    for s in (-1, 1):
        x0 = s * 7.5
        B(f"trench{s}", p, x0 - 0.3, x0 + 0.3, -12.0, 33.0, -0.01, 0.0, dark, 0)
        for k in range(15):
            cyl(f"tcable{s}{k}", (x0 - 0.2 + (k % 5) * 0.1, 10.5, -0.05 - (k // 5) * 0.05), 0.03, 45.0, C("cable_y") if k == 7 else C("cable"), p, axis="Y", seg=6)
        for k in range(46):
            y = -11.6 + k * 1.0
            B(f"tgrate{s}{k}", p, x0 - 0.3, x0 + 0.3, y - 0.03, y + 0.03, -0.01, 0.005, gun, 0)

    # ---- f2_rack_tower: on the column colliders (2.05 footprint), floor to ceiling
    p = piece("f2_rack_tower")
    B("plinth", p, -1.05, 1.05, -1.05, 1.05, 0.0, 0.3, dark, 0.01)
    B("band", p, -1.06, 1.06, -1.06, 1.06, 0.3, 0.42, M["hazard"], 0)
    for k in range(4):
        g = empty(f"face{k}", p, (0, 0, 0), (0, 0, k * pi / 2))
        # three stacked rack faces with the LED map, framed by gun posts
        for j in range(3):
            z0 = 0.42 + j * 3.0
            quad(f"rface{k}{j}", [(-0.92, -0.98, z0 + 0.05), (0.92, -0.98, z0 + 0.05), (0.92, -0.98, z0 + 2.9), (-0.92, -0.98, z0 + 2.9)], rack, g,
                 uv=[(0, 0), (0.75, 0), (0.75, 1.2), (0, 1.2)])
            B(f"rshelf{k}{j}", g, -1.0, 1.0, -1.02, -0.9, z0 + 2.9, z0 + 3.0, gun, 0.006)
        B(f"cap_glow{k}", g, -0.9, 0.9, -1.03, -1.0, 9.42, 9.48, gy, 0)
    B("core", p, -0.95, 0.95, -0.95, 0.95, 0.42, 9.42, M["dark"], 0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            B(f"post{sx}{sy}", p, sx * 1.0 - 0.08, sx * 1.0 + 0.08, sy * 1.0 - 0.08, sy * 1.0 + 0.08, 0.3, 9.6, gun, 0.01)
    B("top", p, -1.05, 1.05, -1.05, 1.05, 9.42, 9.62, gun, 0.01)
    # cable risers into the ceiling trays
    for k in range(6):
        cyl(f"riser{k}", (-0.5 + k * 0.2, 0.0, 10.8), 0.06, 2.4, C("cable_y") if k in (1, 4) else C("cable"), p, seg=8)
    B("riser_clamp", p, -0.7, 0.7, -0.12, 0.12, 10.2, 10.3, gun, 0.004)

    # ---- f2_bay_racks: left wall, a wall of racks, pipes above (7 m module, front -Y)
    p = piece("f2_bay_racks")
    for s in (-1, 1):
        B(f"pil{s}", p, s * 3.5 - (0.3 if s > 0 else 0), s * 3.5 + (0.3 if s < 0 else 0), -0.55, 0.45, 0.0, HALL, gun, 0.01)
    B("wall", p, -3.2, 3.2, 0.3, 0.6, 0.0, HALL, clad, 0)
    for j in range(2):
        z0 = 0.15 + j * 1.85
        quad(f"rwall{j}", [(-3.2, 0.0, z0), (3.2, 0.0, z0), (3.2, 0.0, z0 + 1.8), (-3.2, 0.0, z0 + 1.8)], rack, p,
             uv=[(0, 0.1), (2.66, 0.1), (2.66, 0.85), (0, 0.85)])
        B(f"rshelf{j}", p, -3.2, 3.2, -0.08, 0.3, z0 + 1.8, z0 + 1.85, gun, 0.004)
    B("rplinth", p, -3.2, 3.2, -0.05, 0.3, 0.0, 0.15, dark, 0)
    B("rack_glow", p, -3.2, 3.2, -0.1, -0.06, 3.86, 3.9, gy, 0)
    for k, z in enumerate((5.0, 5.35, 5.7, 8.6)):
        cyl(f"pipe{k}", (0, -0.1 - (k % 2) * 0.15, z), 0.12 if k < 3 else 0.22, 7.0, gun if k != 1 else yel, p, axis="X", seg=12)
    for x in (-2.0, 1.2):
        B(f"bracket{x}", p, x - 0.05, x + 0.05, -0.35, 0.3, 4.7, 6.0, gun, 0.004)
    B("duct", p, -3.2, 3.2, -0.9, 0.3, 9.5, 11.0, gun, 0.02)
    for k in range(6):
        B(f"duct_rib{k}", p, -3.2 + k * 1.28 - 0.03, -3.2 + k * 1.28 + 0.03, -0.93, 0.3, 9.45, 11.05, trim, 0)

    # ---- f2_bay_window: right wall, windows 3.5 .. 11.5 m (the drop shows outside), heavy frames
    p = piece("f2_bay_window")
    for s in (-1, 1):
        B(f"pil{s}", p, s * 3.5 - (0.3 if s > 0 else 0), s * 3.5 + (0.3 if s < 0 else 0), -0.55, 0.45, 0.0, HALL, gun, 0.01)
    B("low", p, -3.2, 3.2, -0.35, 0.35, 0.0, 3.5, clad, 0.01)
    B("low_cap", p, -3.25, 3.25, -0.5, 0.4, 3.5, 3.62, gun, 0.01)
    for k in range(9):
        B(f"louver{k}", p, -2.8, 2.8, -0.42, -0.35, 0.5 + k * 0.28, 0.6 + k * 0.28, gun, 0)
    B("louver_back", p, -2.85, 2.85, -0.36, -0.35, 0.45, 3.0, dark, 0)
    for x in (-1.6, 0.0, 1.6):
        B(f"wmull{x}", p, x - 0.12, x + 0.12, -0.25, 0.1, 3.62, 11.5, gun, 0.01)
    for zz in (7.5,):
        B(f"wtran{zz}", p, -3.2, 3.2, -0.22, 0.1, zz - 0.1, zz + 0.1, gun, 0.01)
    quad("wglass", [(-3.2, 0.0, 3.62), (3.2, 0.0, 3.62), (3.2, 0.0, 11.5), (-3.2, 0.0, 11.5)], gl, p, uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
    B("shutter_box", p, -3.2, 3.2, -0.7, 0.3, 11.2, HALL, gun, 0.02)
    B("shutter_lip", p, -3.2, 3.2, -0.72, -0.68, 10.9, 11.2, M["hazard"], 0)
    B("head_glow", p, -3.0, 3.0, -0.73, -0.7, 11.25, 11.3, gy, 0)

    # ---- f2_ceiling: slab at 12 m, beams every 7 m, cable trays, linear lights
    p = piece("f2_ceiling")
    B("slab", p, -19.6, 19.6, -12.7, 44.3, HALL, HALL + 0.6, M["dark"], 0)
    for k in range(9):
        y = -12.3 + k * 7.0
        B(f"beam{k}", p, -19.6, 19.6, y - 0.35, y + 0.35, HALL - 0.9, HALL, gun, 0.02)
    for x in (-14.0, -7.0, 7.0, 14.0):
        # ladder tray along z with cables
        for s in (-1, 1):
            B(f"tray_side{x}{s}", p, x + s * 0.45 - 0.03, x + s * 0.45 + 0.03, -12.6, 44.2, HALL - 1.5, HALL - 1.38, trim, 0)
        for k in range(57):
            y = -12.3 + k * 1.0
            B(f"rung{x}{k}", p, x - 0.45, x + 0.45, y - 0.02, y + 0.02, HALL - 1.5, HALL - 1.47, gun, 0)
        for k in range(6):
            cyl(f"tcab{x}{k}", (x - 0.3 + k * 0.12, 15.8, HALL - 1.42), 0.045, 56.8, C("cable_y") if k == 2 else C("cable"), p, axis="Y", seg=6)
        for k in range(8):
            y = -12.3 + k * 7.0
            B(f"hanger{x}{k}", p, x - 0.5, x + 0.5, y - 0.03, y + 0.03, HALL - 1.52, HALL - 0.9, gun, 0)
    for x in (-10.5, 10.5, -3.0, 3.0):
        for k in range(8):
            y = -12.3 + 3.5 + k * 7.0
            if abs(x) < 5 and y > 32:
                continue
            B(f"lamp{x}{k}", p, x - 0.12, x + 0.12, y - 2.0, y + 2.0, HALL - 0.12, HALL, gun, 0.005)
            B(f"lamp_glow{x}{k}", p, x - 0.07, x + 0.07, y - 1.9, y + 1.9, HALL - 0.14, HALL - 0.12, gw, 0)

    # ---- f2_beacon: alarm beacon (origin = mount point on the ceiling, the dome hangs below)
    p = piece("f2_beacon")
    B("mount", p, -0.35, 0.35, -0.35, 0.35, -0.25, 0.0, gun, 0.01)
    cyl("neck", (0, 0, -0.4), 0.12, 0.3, gun, p, seg=12)
    cyl("base", (0, 0, -0.62), 0.32, 0.16, M["yellow"], p, seg=20, bev=0.01)
    cyl("dome", (0, 0, -0.9), 0.26, 0.4, C("beacon"), p, seg=20, r2=0.18)
    for k in range(4):
        a = k * pi / 2
        box(f"cage{k}", (cos(a) * 0.29, sin(a) * 0.29, -0.9), (0.03, 0.03, 0.44), gun, p, 0, rot=(0, 0, a))
    torus("cage_ring", (0, 0, -1.1), 0.27, 0.02, gun, p, axis="Z", seg=20, rseg=4)

    # ---- f2_far_wall: blast wall at three z = -44 (world coordinates), recess for the small emblem
    p = piece("f2_far_wall")
    y0 = 44.0
    for s in (-1, 1):
        B(f"block{s}", p, min(s * 6.0, s * 19.6), max(s * 6.0, s * 19.6), y0, y0 + 1.6, 0.0, HALL, gun, 0.01)
        for k in range(4):
            xc = s * (8.0 + k * 3.0)
            B(f"plate{s}{k}", p, xc - 1.4, xc + 1.4, y0 - 0.12, y0, 0.6, HALL - 1.0, clad, 0.02)
            for zb in (1.0, HALL - 1.4):
                for xb in (xc - 1.2, xc + 1.2):
                    cyl(f"bolt{s}{k}{zb}{xb}", (xb, y0 - 0.13, zb), 0.04, 0.03, trim, p, axis="Y", seg=6)
        B(f"haz{s}", p, min(s * 6.0, s * 19.6), max(s * 6.0, s * 19.6), y0 - 0.14, y0 - 0.12, 0.0, 0.55, M["hazard"], 0)
        B(f"jamb{s}", p, s * 6.0 - 0.4, s * 6.0 + 0.4, y0 - 0.4, y0 + 1.6, 0.0, HALL, gun, 0.02)
        B(f"jamb_glow{s}", p, s * 5.58 - 0.03, s * 5.58 + 0.03, y0 - 0.2, y0 + 0.2, 0.5, HALL - 1.0, gy, 0)
    B("recess", p, -6.0, 6.0, y0 + 1.0, y0 + 1.8, 0.0, HALL, M["dark"], 0)
    for k in range(11):
        x = -5.0 + k * 1.0
        B(f"rib{k}", p, x - 0.1, x + 0.1, y0 + 0.8, y0 + 1.0, 0.0, HALL, gun, 0.006)

    # ---- f2_entrance: sealed blast door at three z = +12.3
    p = piece("f2_entrance")
    yi = -12.3
    B("wall", p, -19.6, 19.6, yi - 0.8, yi, 0.0, HALL, gun, 0.01)
    for s in (-1, 1):
        B(f"leaf{s}", p, (0.02 if s > 0 else -5.0), (5.0 if s > 0 else -0.02), yi, yi + 0.3, 0.0, 7.0, clad, 0.02)
        B(f"leaf_haz{s}", p, (0.1 if s > 0 else -4.9), (4.9 if s > 0 else -0.1), yi + 0.3, yi + 0.32, 0.3, 1.2, M["hazard"], 0)
        for k in range(5):
            B(f"leaf_rib{s}{k}", p, (0.1 if s > 0 else -4.9), (4.9 if s > 0 else -0.1), yi + 0.3, yi + 0.38, 1.6 + k * 1.1, 1.75 + k * 1.1, gun, 0.004)
        B(f"frame{s}", p, s * 5.4 - 0.4, s * 5.4 + 0.4, yi, yi + 0.6, 0.0, 7.6, gun, 0.02)
        B(f"lamp{s}", p, s * 5.4 - 0.12, s * 5.4 + 0.12, yi + 0.6, yi + 0.75, 7.8, 8.1, C("beacon"), 0.01)
    B("frame_top", p, -5.8, 5.8, yi, yi + 0.6, 7.0, 7.8, gun, 0.02)
    B("frame_haz", p, -5.8, 5.8, yi + 0.6, yi + 0.62, 7.1, 7.7, M["hazard"], 0)


{"atrium": atrium, "cover": cover, "floor2": floor2}[WHAT]()
for p in list(ROOT.children):
    consolidate(p)
path = os.path.join(OUT, NAME + ".glb")
export(ROOT, path, os.path.join(OUT, NAME + ".blend"))
for p in ROOT.children:
    print("PIECE", p.name, [c.name.split("__")[1] for c in p.children])
