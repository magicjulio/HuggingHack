# Package depot (ch1.depot) v2 — rusty cyberpunk drop-point kiosk. Stands for Artifactory, the package mirror that turns
# out to be the weak spot, so it looks worn and slightly broken. Its list UI is HTML on `screen`.
# Headless: blender -b --factory-startup -P design/3d/depot/depot.py  -> ch1-depot.glb, depot.blend, previews/, tex/
# Blender Z up, front faces -Y (= glTF +Z). Origin = base centre on the floor; the back sits flat on the wall at +Y.
# Footprint: 2.4 wide x 0.5 deep like layout.ts, but 3.0 tall (hood above the screen) and the frame/hood stick out
# up to ~0.17 m in front of the collision box. Screen plane 2.0 x 1.8, centre 1.5 m, 0.26 m in front of the unit centre.
# Textures (paint, rust, grime, dents) are generated here with numpy and embedded in the .glb as WebP.
# Glowing mesh: `screen`. Animatable nodes: `hatch` (rotate X, negative = flap lifts out), `service_door` (rotate Z),
# `beacon` (amber lamp on the hood, material `depot_beacon`), `tube_broken` (flickering light tube, `depot_tube_bad`).
import bpy, bmesh, os
import numpy as np
from math import radians as rad
from mathutils import Matrix, Vector

OUT = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(OUT, "tex")
os.makedirs(TEX, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.name = "depot"
W, D, H = 2.4, 0.5, 3.0
FY = -D / 2                      # front plane of the collision box (local y)
SZ, SW, SH = 1.5, 2.0, 1.8       # screen centre height, width, height
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def srgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ----------------------------------------------------------------------------------------------- texture synth
N = 1024


def up(g, n):
    """Smooth, tileable upsample of grid g (rows = v, cols = u) to n x n."""
    h, w = g.shape
    y, x = np.arange(n) * h / n, np.arange(n) * w / n
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = (y - y0)[:, None], (x - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % h, (x0 + 1) % w
    a, b, c, d = g[y0][:, x0], g[y0][:, x1], g[y1][:, x0], g[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(seed, base=4, octaves=6, streak=1, n=N):
    """Fractal noise in 0..1. streak > 1 squashes rows so features run vertically (drips)."""
    r = np.random.default_rng(seed)
    out, amp, tot = np.zeros((n, n)), 1.0, 0.0
    for o in range(octaves):
        s = base * 2 ** o
        out += amp * up(r.random((max(2, s // streak), s)), n)
        tot += amp
        amp *= 0.5
    out /= tot
    return (out - out.min()) / (out.max() - out.min())


def sstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def save(name, rgb, colour=True):
    img = bpy.data.images.new(name, N, N, alpha=False)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((N, N, 1))], axis=2)
    img.pixels.foreach_set(rgba.astype(np.float32).ravel())
    img.filepath_raw = os.path.join(TEX, name + ".png")
    img.file_format = "PNG"
    img.save()
    return img


def normal_from(height, strength):
    gy, gx = np.gradient(height)
    nx, ny, nz = -gx * strength, -gy * strength, np.ones_like(height)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx / l * 0.5 + 0.5, ny / l * 0.5 + 0.5, nz / l * 0.5 + 0.5], axis=2)


def surface(name, paint, seed, chip=0.6, rust_amt=1.0, metal=0.0, rough=0.55, dirt=0.45, ribs=0):
    """Worn paint over rust: chipped patches, drip streaks, grime, dents. Returns (albedo, orm, normal) images."""
    grime = fbm(seed + 1, 3, 5)
    drip = fbm(seed + 2, 6, 6, streak=10)
    chips = fbm(seed + 3, 14, 6)
    rustn = fbm(seed + 4, 16, 5)
    speck = fbm(seed + 5, 64, 3)
    dent = fbm(seed + 6, 5, 4)
    chipm = sstep(chip, chip + 0.04, chips * 0.75 + rustn * 0.25) * rust_amt
    rustm = np.clip(chipm + sstep(0.7, 0.95, drip) * 0.45 * rust_amt, 0, 1)
    rust = srgb("#24100a")[None, None] * (1 - rustn[..., None]) + srgb("#7a3816")[None, None] * rustn[..., None]
    col = srgb(paint)[None, None] * (1 - dirt * 0.65 + dirt * 0.6 * grime[..., None])
    col = col * (1 - 0.45 * sstep(0.45, 0.85, drip))[..., None]          # dark grime runs
    col = col * (0.93 + 0.14 * speck)[..., None]
    alb = col * (1 - rustm[..., None]) + rust * rustm[..., None]
    if ribs:  # ribbed sheet: darker grooves every 1/ribs of a tile
        g = (np.sin(np.linspace(0, ribs * 2 * np.pi, N, endpoint=False)) > 0.85)[:, None]
        alb = alb * np.where(g, 0.55, 1.0)[..., None]
    r = np.clip(rough + 0.2 * grime - 0.1 * speck + 0.3 * rustm, 0.05, 1)
    m = metal * (1 - rustm)
    orm = np.stack([np.ones((N, N)), r, m], axis=2)
    hgt = 0.6 * dent - 1.2 * chipm + 0.15 * speck + 0.4 * rustn * rustm
    nrm = normal_from(hgt, 6.0)
    return save(name + "_albedo", alb), save(name + "_orm", orm, False), save(name + "_normal", nrm, False)


def tmat(name, maps):
    alb, orm, nrm = maps
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    ta, to, tn = (nt.nodes.new("ShaderNodeTexImage") for _ in range(3))
    ta.image, to.image, tn.image = alb, orm, nrm
    sep, nm = nt.nodes.new("ShaderNodeSeparateColor"), nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(ta.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(to.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], b.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], b.inputs["Metallic"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    return m


def mat(name, base, metal=0.0, rough=0.5, em=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Emission Color"].default_value = (*(em or (0, 0, 0)), 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


M = {
    "yellow": tmat("depot_paint_yellow", surface("depot_yellow", "#d49a12", 10, chip=0.66)),
    "white": tmat("depot_paint_white", surface("depot_white", "#bdb8aa", 20, chip=0.67, dirt=0.6)),
    "red": tmat("depot_paint_red", surface("depot_red", "#5a1418", 30, chip=0.66, ribs=24)),
    "steel": tmat("depot_steel", surface("depot_steel", "#3a3e44", 40, chip=0.7, metal=0.85, rough=0.45, dirt=0.3)),
    "rust": tmat("depot_rust", surface("depot_rustpipe", "#4a2614", 50, chip=0.4, rough=0.8)),
    "core": mat("depot_core", lin("#050608"), 0.3, 0.8),
    "ink": mat("depot_ink", lin("#141210"), 0.0, 0.7),
    "screen": mat("screen", lin("#02080c"), 0.0, 0.65, em=lin("#38d8ff"), strength=0.16),
    "tube": mat("depot_tube", lin("#0a1a22"), 0.0, 0.3, em=lin("#38d8ff"), strength=3.0),
    "tube_bad": mat("depot_tube_bad", lin("#0a1a22"), 0.0, 0.3, em=lin("#38d8ff"), strength=0.4),
    "arrow": mat("depot_arrow", lin("#2a2004"), 0.0, 0.4, em=lin("#ffd21e"), strength=3.0),
    "beacon": mat("depot_beacon", lin("#2a1a04"), 0.0, 0.25, em=lin("#ffb020"), strength=0.3),
    "digits": mat("depot_digits", lin("#1a0404"), 0.0, 0.4, em=lin("#ff3b4e"), strength=2.5),
    "sticker_m": mat("depot_sticker_m", lin("#c2186b"), 0.0, 0.6),
    "sticker_c": mat("depot_sticker_c", lin("#1aa0c0"), 0.0, 0.6),
    "sticker_w": mat("depot_sticker_w", lin("#d8d4c8"), 0.0, 0.7),
    "wire_r": mat("depot_wire_r", lin("#8a1a1a"), 0.0, 0.5),
    "wire_y": mat("depot_wire_y", lin("#a08010"), 0.0, 0.5),
    "wire_k": mat("depot_wire_k", lin("#101010"), 0.0, 0.5),
}

# ----------------------------------------------------------------------------------------------- geometry helpers
UVS = 0.55  # texture tiles per metre


def boxuv(bm, off):
    """World-scale box projection; v follows Z on walls so drip streaks run downwards."""
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co + off
            u, v = (c.x, c.y) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z)
            l[uv].uv = (u * UVS, v * UVS)


_seed = [0]


def mesh_obj(name, bm, material, parent, loc=(0, 0, 0)):
    bm.normal_update()
    _seed[0] += 1
    boxuv(bm, Vector(loc) + Vector((_seed[0] * 0.37, _seed[0] * 0.21, 0)))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.location, o.parent = loc, parent
    me.materials.append(material)
    return o


def bevel(o, w, seg=2):
    if w:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width, m.segments, m.limit_method, m.harden_normals = w, seg, "ANGLE", True
    return o


def box(name, center, size, material, parent, bev=0.006, seg=2, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    o = bevel(mesh_obj(name, bm, material, parent, center), bev, seg)
    if rot:
        o.rotation_euler = rot
    return o


def prism(name, pts, y0, y1, material, parent, bev=0.004):
    """Extrude a polygon given in the XZ plane between y0 and y1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, material, parent), bev)


def cyl(name, center, r, depth, material, parent, axis="Z", seg=12, bev=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    rotm = {"X": Matrix.Rotation(rad(90), 3, "Y"), "Y": Matrix.Rotation(rad(90), 3, "X"), "Z": Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rotm)
    return bevel(mesh_obj(name, bm, material, parent, center), bev)


def empty(name, parent, loc=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    sc.collection.objects.link(o)
    o.parent, o.location = parent, loc
    return o


def to_mesh(o, name, material, parent):
    bpy.context.view_layer.objects.active = o
    for x in sc.objects:
        x.select_set(x == o)
    bpy.ops.object.convert(target="MESH")
    o = bpy.context.object
    o.name = o.data.name = name
    o.data.materials.clear()
    o.data.materials.append(material)
    o.parent = parent
    return o


def text(name, body, size, loc, material, parent, align="CENTER", spacing=1.0):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.size, cu.extrude, cu.resolution_u = body, size, 0.002, 2
    cu.font = bpy.data.fonts.load(FONT, check_existing=True)
    cu.align_x, cu.align_y, cu.space_character = align, "CENTER", spacing
    o = bpy.data.objects.new(name, cu)
    sc.collection.objects.link(o)
    o.rotation_euler = (rad(90), 0, 0)
    o.location = loc
    return to_mesh(o, name, material, parent)


def wire(name, pts, r, material, parent):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = "3D", r, 1, 6
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for p, c in zip(sp.bezier_points, pts):
        p.co, p.handle_left_type, p.handle_right_type = c, "AUTO", "AUTO"
    o = bpy.data.objects.new(name, cu)
    sc.collection.objects.link(o)
    return to_mesh(o, name, material, parent)


root = empty("depot", None)

# ----------------------------------------------------------------------------------------------- carcass
box("back_plate", (0, 0.22, H / 2), (W, 0.06, H), M["steel"], root, 0.006)
box("body", (0, 0.04, 1.5), (2.06, 0.36, 2.0), M["core"], root, 0.0)
# left pillar: off-white sheet with a yellow band; right pillar: yellow, with a service door hanging open
box("pillar_l", (-1.1, 0.0, 1.5), (0.2, D, 1.9), M["white"], root, 0.012, 2)
box("pillar_l_band", (-1.1, FY - 0.004, 0.86), (0.205, 0.02, 0.3), M["yellow"], root, 0.004)
box("pillar_r", (1.1, 0.0, 1.5), (0.2, D, 1.9), M["yellow"], root, 0.012, 2)
box("service_cavity", (1.1, FY + 0.03, 1.72), (0.13, 0.08, 0.5), M["core"], root, 0.0)
door = empty("service_door", root, (1.165, FY - 0.006, 1.72))  # hinge on the outer edge
door.rotation_euler = (0, 0, rad(-38))
box("service_door_panel", (-0.065, 0, 0), (0.13, 0.012, 0.5), M["yellow"], door, 0.003)
box("service_door_vent", (-0.065, -0.008, 0.12), (0.08, 0.006, 0.12), M["steel"], door, 0.002)
for i, (mt, dz, dx) in enumerate([("wire_r", 0.0, -0.02), ("wire_y", 0.06, 0.01), ("wire_k", -0.08, 0.03)]):
    wire(f"service_wire_{i}", [(1.08 + dx, FY + 0.04, 1.93), (1.1 + dx, FY - 0.05, 1.75 + dz),
                               (1.12 + dx, FY - 0.03, 1.52 + dz * 0.5)], 0.007, M[mt], root)
# seams + rivets on both pillars
for s, x in (("l", -1.1), ("r", 1.1)):
    for z in (0.62, 2.36):
        box(f"pillar_{s}_seam_{int(z*100)}", (x, FY - 0.004, z), (0.205, 0.012, 0.014), M["steel"], root, 0.002)
    for z in np.linspace(0.7, 2.3, 7):
        for dx in (-0.075, 0.075):
            if s == "r" and 1.45 < z < 2.0:
                continue  # behind the open service door
            cyl(f"rivet_{s}_{int(z*100)}_{'a' if dx < 0 else 'b'}", (x + dx, FY - 0.003, z), 0.008, 0.008,
                M["steel"], root, "Y", seg=6)

# ----------------------------------------------------------------------------------------------- screen alcove
FD = 0.13  # frame protrudes this far in front of the box
for n, c, s in (("top", (0, FY - FD / 2, SZ + SH / 2 + 0.05), (SW + 0.2, FD, 0.1)),
                ("bot", (0, FY - FD / 2, SZ - SH / 2 - 0.05), (SW + 0.2, FD, 0.1)),
                ("l", (-SW / 2 - 0.05, FY - FD / 2, SZ), (0.1, FD, SH)),
                ("r", (SW / 2 + 0.05, FY - FD / 2, SZ), (0.1, FD, SH))):
    box(f"frame_{n}", c, s, M["steel"], root, 0.012, 2)
for i, (x, z) in enumerate([(-1, -1), (1, -1), (-1, 1), (1, 1)]):
    cx, cz = x * (SW / 2 + 0.05), SZ + z * (SH / 2 + 0.05)
    box(f"frame_clamp_{i}", (cx, FY - FD - 0.012, cz), (0.14, 0.024, 0.14), M["yellow"], root, 0.008)
    cyl(f"frame_bolt_{i}", (cx, FY - FD - 0.028, cz), 0.018, 0.014, M["steel"], root, "Y", seg=6)
box("screen_well", (0, FY + 0.01, SZ), (SW, 0.02, SH), M["core"], root, 0.0)
bm = bmesh.new()
bm.loops.layers.uv.new("UVMap")  # calc_uvs needs an existing layer
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5, calc_uvs=True)
bmesh.ops.scale(bm, vec=(SW, SH, 1), verts=bm.verts)
bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(rad(90), 3, "X"))
me = bpy.data.meshes.new("screen")
bm.to_mesh(me)
bm.free()
scr = bpy.data.objects.new("screen", me)
sc.collection.objects.link(scr)
scr.parent, scr.location = root, (0, FY - 0.01, SZ)
me.materials.append(M["screen"])
# hazard stripes along the bottom frame
box("hazard_band", (0, FY - FD - 0.001, 0.55), (SW + 0.18, 0.004, 0.05), M["yellow"], root, 0.0)
for i in range(14):
    x = -1.04 + i * 0.15
    prism(f"hazard_{i}", [(x, 0.527), (x + 0.07, 0.527), (x + 0.11, 0.573), (x + 0.04, 0.573)],
          FY - FD - 0.006, FY - FD - 0.002, M["ink"], root, 0.0)

# ----------------------------------------------------------------------------------------------- hood with sign
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
bmesh.ops.scale(bm, vec=(W, 0.68, 0.6), verts=bm.verts)
bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, 0.14), plane_no=(0, 0, 1))
for v in bm.verts:  # chamfer the top-front edge back like the reference drop point
    if v.co.z > 0.2 and v.co.y < 0:
        v.co.y += 0.26
HOOD_Y = -0.09
bevel(mesh_obj("hood", bm, M["yellow"], root, (0, HOOD_Y, 2.7)), 0.012, 2)
hf = HOOD_Y - 0.34  # hood front plane
prism("hood_white", [(0.36, 2.41), (1.2, 2.41), (1.2, 2.84), (0.56, 2.84)], hf - 0.006, hf + 0.01, M["white"], root)
prism("hood_slash", [(-1.2, 2.41), (-0.98, 2.41), (-1.2, 2.6)], hf - 0.006, hf + 0.01, M["white"], root)
text("sign", "ARTIFACTORY", 0.2, (-0.44, hf - 0.009, 2.62), M["ink"], root, spacing=1.02)
text("sign_code", "D-01", 0.1, (0.86, hf - 0.009, 2.7), M["ink"], root)
text("sign_sub", "PKG MIRROR · PULL & INSTALL", 0.045, (0.82, hf - 0.009, 2.52), M["ink"], root)
box("hood_lip", (0, hf + 0.04, 2.4), (W - 0.04, 0.1, 0.03), M["steel"], root, 0.004)
# light tubes under the hood: three segments, the middle one is broken and flickers
for i, x in enumerate((-0.68, 0.0, 0.68)):
    cyl("tube_broken" if i == 1 else f"tube_{i}", (x, hf + 0.07, 2.36), 0.014, 0.6,
        M["tube_bad"] if i == 1 else M["tube"], root, "X", seg=8)
    for dx in (-0.31, 0.31):
        box(f"tube_{i}_cap_{'a' if dx < 0 else 'b'}", (x + dx, hf + 0.07, 2.37), (0.03, 0.04, 0.05), M["steel"], root, 0.003)
# amber beacon on top
beacon = empty("beacon", root, (0.86, -0.02, 3.0))
cyl("beacon_base", (0, 0, 0.02), 0.07, 0.04, M["steel"], beacon, seg=12, bev=0.004)
cyl("beacon_lens", (0, 0, 0.08), 0.05, 0.08, M["beacon"], beacon, seg=12, bev=0.01)
cyl("beacon_cap", (0, 0, 0.125), 0.055, 0.012, M["steel"], beacon, seg=12)

# ----------------------------------------------------------------------------------------------- base: bay, keypad, arrows
box("base", (0, -0.02, 0.29), (W, 0.54, 0.5), M["red"], root, 0.012, 2)
box("kick", (0, FY - 0.01, 0.035), (W + 0.02, 0.06, 0.07), M["steel"], root, 0.006)
box("ledge", (0, FY - 0.08, 0.515), (SW + 0.3, 0.2, 0.04), M["steel"], root, 0.01, 2)
box("bay_frame", (-0.15, FY - 0.04, 0.27), (0.82, 0.04, 0.32), M["white"], root, 0.01)
box("bay_mouth", (-0.15, FY - 0.035, 0.27), (0.72, 0.06, 0.23), M["core"], root, 0.0)
box("bay_glow", (-0.15, FY - 0.01, 0.375), (0.68, 0.01, 0.01), M["tube"], root, 0.0)
hatch = empty("hatch", root, (-0.15, FY - 0.068, 0.385))
box("hatch_flap", (0, 0, -0.11), (0.7, 0.012, 0.22), M["steel"], hatch, 0.004)
for i in range(4):
    box(f"hatch_rib_{i}", (0, -0.009, -0.035 - i * 0.05), (0.62, 0.006, 0.014), M["red"], hatch, 0.0)
box("keypad", (0.62, FY - 0.04, 0.29), (0.28, 0.04, 0.24), M["white"], root, 0.008)
box("keypad_display", (0.62, FY - 0.062, 0.36), (0.2, 0.006, 0.05), M["core"], root, 0.0)
text("keypad_digits", "-88.8", 0.04, (0.62, FY - 0.066, 0.36), M["digits"], root)
for r_ in range(3):
    for c in range(3):
        box(f"key_{r_}{c}", (0.56 + c * 0.06, FY - 0.064, 0.295 - r_ * 0.045), (0.042, 0.01, 0.032), M["steel"], root, 0.003)
for i, z in enumerate((0.1, 0.18)):  # glowing chevrons pointing up at the screen
    prism(f"arrow_{i}", [(-0.98, z), (-0.88, z + 0.07), (-0.78, z), (-0.78, z + 0.035), (-0.88, z + 0.105), (-0.98, z + 0.035)],
          FY - 0.05, FY - 0.042, M["arrow"], root, 0.0)

# ----------------------------------------------------------------------------------------------- clutter
# rusty conduits: one from the hood up into the ceiling, one down the left side into the floor
cyl("conduit_up", (-0.8, 0.12, 3.3), 0.05, 0.62, M["rust"], root, seg=12)
cyl("conduit_side", (-1.26, 0.1, 1.5), 0.04, 3.0, M["rust"], root, seg=10)
for z in (0.4, 1.3, 2.2):
    box(f"conduit_clip_{int(z*10)}", (-1.24, 0.12, z), (0.11, 0.1, 0.05), M["steel"], root, 0.004)
wire("cable_sag", [(-1.22, -0.05, 2.38), (-0.9, -0.36, 2.22), (-0.5, -0.4, 2.36)], 0.012, M["wire_k"], root)
# stickers, a bit crooked
for i, (mt, x, z, w_, h_, a) in enumerate([("sticker_m", -1.1, 1.95, 0.12, 0.08, 4), ("sticker_c", -1.09, 1.82, 0.09, 0.09, -7),
                                           ("sticker_w", 1.1, 1.18, 0.14, 0.06, 3), ("sticker_w", -0.55, 0.42, 0.1, 0.06, -2)]):
    box(f"sticker_{i}", (x, FY - 0.013 if abs(x) > 1 else FY - 0.042, z), (w_, 0.002, h_), M[mt], root, 0.0, rot=(0, rad(a), 0))

# ----------------------------------------------------------------------------------------------- preview stage (not exported)
stage = tmat("_stage", surface("stage_wall", "#1e2024", 60, chip=0.8, rust_amt=0.25, dirt=0.9))
box("_floor", (0, -2, -0.01), (8, 8, 0.02), stage, None, 0.0)
box("_wall", (0, 0.27, 1.8), (8, 0.02, 3.6), stage, None, 0.0)
w = bpy.data.worlds.new("w")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#05080e"), 1)
aim = empty("_aim", None, (0, 0, 1.5))


def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new(name, kind)
    d.energy, d.color = energy, color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    sc.collection.objects.link(o)
    o.constraints.new("TRACK_TO").target = aim
    return o


light("key", "AREA", (-2.6, -3.0, 3.2), 700, (1.0, 0.86, 0.7), 2.5)   # warm sodium-ish key
light("rim", "AREA", (2.4, -0.6, 2.8), 350, lin("#38d8ff"), 1.0)
light("fill", "AREA", (1.5, -3.5, 0.6), 90, (0.7, 0.8, 1.0), 2.0)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
cam.location = (-2.6, -5.4, 1.8)
cam.data.lens = 40
cam.constraints.new("TRACK_TO").target = aim
sc.camera = cam
sc.render.engine = "BLENDER_EEVEE_NEXT"
sc.eevee.taa_render_samples = 48
sc.render.resolution_x, sc.render.resolution_y = 960, 1080
sc.view_settings.view_transform = "AgX"
sc.view_settings.look = "AgX - Medium High Contrast"
sc.use_nodes = True
nt = sc.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
rl, gl, co = nt.nodes.new("CompositorNodeRLayers"), nt.nodes.new("CompositorNodeGlare"), nt.nodes.new("CompositorNodeComposite")
gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 1.2, 5, -0.4
nt.links.new(rl.outputs[0], gl.inputs[0])
nt.links.new(gl.outputs[0], co.inputs[0])

os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)
sb = M["screen"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
bb = M["beacon"].node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
for state, s, b_ in (("on", 0.16, 0.3), ("glimmer", 0.05, 6.0)):
    sb.default_value, bb.default_value = s, b_
    sc.render.filepath = os.path.join(OUT, "previews", f"depot-{state}.png")
    bpy.ops.render.render(write_still=True)
sb.default_value, bb.default_value = 0.16, 0.3

for o in sc.objects:
    o.select_set(False)
for o in [root] + list(root.children_recursive):
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "ch1-depot.glb"), export_format="GLB", use_selection=True,
                          export_apply=True, export_yup=True, export_lights=False, export_cameras=False,
                          export_image_format="WEBP", export_image_quality=82)
tris = 0
dg = bpy.context.evaluated_depsgraph_get()
for o in root.children_recursive:
    if o.type == "MESH":
        me = o.evaluated_get(dg).to_mesh()
        me.calc_loop_triangles()
        tris += len(me.loop_triangles)
print("DEPOT TRIS", tris)
bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "depot.blend"))
