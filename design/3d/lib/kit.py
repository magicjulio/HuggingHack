# Shared build kit for the ch1 room props (stations, shell). Import from a prop script:
#   sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib")); from kit import *
# Conventions (same as scorer/depot/plinth): Blender Z up, front faces -Y (= glTF +Z), metres.
# Station origin = the floor point on the wall plane (y = 0 is the wall, the prop stands at y < 0).
import bpy, bmesh, os
import numpy as np
from math import radians as rad
from mathutils import Matrix, Vector

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
sc = None
TEX = None
N = 512


def reset(name, out_dir):
    global sc, TEX
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = name
    TEX = os.path.join(out_dir, "tex")
    os.makedirs(TEX, exist_ok=True)
    return sc


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def srgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ----------------------------------------------------------------------------------------------- texture synth
def up(g, n):
    h, w = g.shape
    y, x = np.arange(n) * h / n, np.arange(n) * w / n
    y0, x0 = np.floor(y).astype(int), np.floor(x).astype(int)
    fy, fx = (y - y0)[:, None], (x - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    y1, x1 = (y0 + 1) % h, (x0 + 1) % w
    a, b, c, d = g[y0][:, x0], g[y0][:, x1], g[y1][:, x0], g[y1][:, x1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(seed, base=4, octaves=6, streak=1, n=None):
    n = n or N
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
    n = rgb.shape[0]
    img = bpy.data.images.new(name, n, n, alpha=False)
    img.colorspace_settings.name = "sRGB" if colour else "Non-Color"
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((n, n, 1))], axis=2)
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


def surface(name, paint, seed, chip=0.6, rust_amt=1.0, metal=0.0, rough=0.55, dirt=0.45, ribs=0, panel=0):
    """Worn paint over rust (see depot.py). panel > 0 adds a grid of panel seams (panels per tile)."""
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
    col = col * (1 - 0.45 * sstep(0.45, 0.85, drip))[..., None]
    col = col * (0.93 + 0.14 * speck)[..., None]
    alb = col * (1 - rustm[..., None]) + rust * rustm[..., None]
    seam = np.zeros((N, N))
    if ribs:
        g = (np.sin(np.linspace(0, ribs * 2 * np.pi, N, endpoint=False)) > 0.85)[:, None]
        alb = alb * np.where(g, 0.55, 1.0)[..., None]
    if panel:
        t = np.linspace(0, panel, N, endpoint=False) % 1.0
        line = ((t < 0.012) | (t > 0.988)).astype(float)
        seam = np.maximum(line[:, None], line[None, :])
        alb = alb * (1 - 0.6 * seam)[..., None]
    r = np.clip(rough + 0.2 * grime - 0.1 * speck + 0.3 * rustm, 0.05, 1)
    m = metal * (1 - rustm)
    orm = np.stack([np.ones((N, N)), r, m], axis=2)
    hgt = 0.6 * dent - 1.2 * chipm + 0.15 * speck + 0.4 * rustn * rustm - 1.5 * seam
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


GLOW = set()  # materials made with a glow colour (see export)


def mat(name, base, metal=0.0, rough=0.5, em=None, strength=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    if em:
        GLOW.add(name)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Emission Color"].default_value = (*(em or (0, 0, 0)), 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def emission(m, v=None):
    i = m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"]
    if v is not None:
        i.default_value = v
    return i


def station_materials():
    """The station family: worn gunmetal carcass, off-white service panels, steel trim, cyan glow."""
    return {
        "gun": tmat("st_gunmetal", surface("st_gunmetal", "#262b33", 101, chip=0.74, rust_amt=0.5, metal=0.75, rough=0.42, dirt=0.35)),
        "panel": tmat("st_panel", surface("st_panel", "#a9a597", 102, chip=0.7, rust_amt=0.6, dirt=0.55, panel=2)),
        "steel": tmat("st_steel", surface("st_steel", "#4a4f57", 103, chip=0.78, rust_amt=0.3, metal=0.9, rough=0.32, dirt=0.25)),
        "trim": mat("st_trim", lin("#8a94a3"), 1.0, 0.25),
        "core": mat("st_core", lin("#050608"), 0.3, 0.8),
        "rubber": mat("st_rubber", lin("#0e0f11"), 0.0, 0.85),
        "ink": mat("st_ink", lin("#141210"), 0.0, 0.7),
        "stencil": mat("st_stencil", lin("#c9c3b0"), 0.0, 0.7),
        "screen": mat("screen", lin("#02080c"), 0.0, 0.65, em=lin("#38d8ff"), strength=0.16),
        "bulb": mat("bulb", lin("#0a1a22"), 0.0, 0.3, em=lin("#38d8ff"), strength=0.0),
        "led_g": mat("st_led_green", lin("#04140a"), 0.0, 0.3, em=lin("#39ff9c"), strength=2.5),
        "led_a": mat("st_led_amber", lin("#1a1004"), 0.0, 0.3, em=lin("#ffb020"), strength=2.5),
        "hazard_y": mat("st_hazard_y", lin("#c8920f"), 0.0, 0.6),
    }


# ----------------------------------------------------------------------------------------------- geometry
UVS = 0.8
_seed = [0]


def boxuv(bm, off):
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for l in f.loops:
            c = l.vert.co + off
            u, v = (c.x, c.y) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z)
            l[uv].uv = (u * UVS, v * UVS)


def mesh_obj(name, bm, material, parent, loc=(0, 0, 0), uv=True):
    bm.normal_update()
    _seed[0] += 1
    if uv:
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


def prism(name, pts, y0, y1, material, parent, bev=0.004, loc=(0, 0, 0)):
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
    return bevel(mesh_obj(name, bm, material, parent, loc), bev)


def cyl(name, center, r, depth, material, parent, axis="Z", seg=16, bev=0.0, r2=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    rotm = {"X": Matrix.Rotation(rad(90), 3, "Y"), "Y": Matrix.Rotation(rad(90), 3, "X"), "Z": Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rotm)
    return bevel(mesh_obj(name, bm, material, parent, center), bev)


def torus(name, center, R, r, material, parent, axis="Y", seg=32, rseg=8):
    bm = bmesh.new()
    for i in range(seg):
        a = 2 * np.pi * i / seg
        for j in range(rseg):
            b = 2 * np.pi * j / rseg
            bm.verts.new(((R + r * np.cos(b)) * np.cos(a), (R + r * np.cos(b)) * np.sin(a), r * np.sin(b)))
    bm.verts.ensure_lookup_table()
    for i in range(seg):
        for j in range(rseg):
            i2, j2 = (i + 1) % seg, (j + 1) % rseg
            bm.faces.new((bm.verts[i * rseg + j], bm.verts[i2 * rseg + j], bm.verts[i2 * rseg + j2], bm.verts[i * rseg + j2]))
    rotm = {"X": Matrix.Rotation(rad(90), 3, "Y"), "Y": Matrix.Rotation(rad(90), 3, "X"), "Z": Matrix.Identity(3)}[axis]
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rotm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, material, parent, center)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def plane(name, center, w, h, material, parent, tilt=0.0):
    """Flat quad facing -Y with UVs 0..1 (u right, v up): the glTF `screen` contract. tilt leans the top back (deg)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, 0, z)) for x, z in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new()
    for l, c in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
        l[uv].uv = c
    if f.normal.y > 0:
        f.normal_flip()
    o = mesh_obj(name, bm, material, parent, center, uv=False)
    o.rotation_euler = (rad(-tilt), 0, 0)
    return o


def empty(name, parent, loc=(0, 0, 0), rot=(0, 0, 0)):
    o = bpy.data.objects.new(name, None)
    sc.collection.objects.link(o)
    o.parent, o.location, o.rotation_euler = parent, loc, rot
    o.empty_display_size = 0.08
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


def text(name, body, size, loc, material, parent, align="CENTER", spacing=1.0, font=FONT, rot=(rad(90), 0, 0), extrude=0.002):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.size, cu.extrude, cu.resolution_u = body, size, extrude, 2
    cu.font = bpy.data.fonts.load(font, check_existing=True)
    cu.align_x, cu.align_y, cu.space_character = align, "CENTER", spacing
    o = bpy.data.objects.new(name, cu)
    sc.collection.objects.link(o)
    o.rotation_euler = rot
    o.location = loc
    o = to_mesh(o, name, material, parent)
    return o


def wire(name, pts, r, material, parent, res=6, bres=1):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions, cu.bevel_depth, cu.bevel_resolution, cu.resolution_u = "3D", r, bres, res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(pts) - 1)
    for p, c in zip(sp.bezier_points, pts):
        p.co, p.handle_left_type, p.handle_right_type = c, "AUTO", "AUTO"
    o = bpy.data.objects.new(name, cu)
    sc.collection.objects.link(o)
    o = to_mesh(o, name, material, parent)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def hazard(name, center, w, h, material_y, material_k, parent, n=6, depth=0.004):
    """Yellow/black diagonal hazard stripes on a strip facing -Y."""
    g = empty(name, parent, center)
    box(name + "_k", (0, 0, 0), (w, depth, h), material_k, g, 0)
    step = w / n
    for i in range(n):
        x0 = -w / 2 + i * step
        pts = [(x0, -h / 2), (x0 + step * 0.5, -h / 2), (min(x0 + step * 0.5 + h * 0.6, w / 2), h / 2), (min(x0 + h * 0.6, w / 2), h / 2)]
        pts = [(max(-w / 2, min(w / 2, x)), z) for x, z in pts]
        prism(f"{name}_y{i}", pts, -depth / 2 - 0.001, depth / 2 - 0.0005, material_y, g, 0)
    return g


def station_header(root, n, width, z, y_front, M, label=""):
    """Number plate + light strip shared by all stations. `bulb` = the strip (reveal / state glow)."""
    hd = empty("header", root, (0, 0, z))
    box("header_plate", (0, y_front + 0.06, 0), (width, 0.12, 0.2), M["gun"], hd, 0.01, 2)
    box("header_trim", (0, y_front - 0.003, -0.1), (width + 0.02, 0.02, 0.016), M["trim"], hd, 0.003)
    box("header_well", (0.1, y_front - 0.001, 0.015), (width - 0.55, 0.012, 0.05), M["core"], hd, 0)
    box("bulb", (0.1, y_front - 0.006, 0.015), (width - 0.6, 0.012, 0.03), M["bulb"], hd, 0)
    box("num_plate", (-width / 2 + 0.16, y_front - 0.006, 0), (0.24, 0.012, 0.16), M["stencil"], hd, 0.004)
    text("num", f"{n:02d}", 0.12, (-width / 2 + 0.16, y_front - 0.014, -0.002), M["ink"], hd)
    if label:
        text("label", label, 0.036, (0.1, y_front - 0.008, -0.058), M["stencil"], hd)
    # spotlight anchor: in front of and above the station, aims down at the work surface (engineer adds the light)
    empty("light_anchor", root, (0, y_front - 0.9, 3.3), (rad(-28), 0, 0))
    return hd


# ----------------------------------------------------------------------------------------------- preview stage + export
def stage(aim_loc, cam_loc, lens=40, res=(960, 1080), key=600, rim=300, fill=80):
    w = bpy.data.worlds.new("w")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#05080e"), 1)
    aim = empty("_aim", None, aim_loc)

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

    ax, ay, az = aim_loc
    light("_key", "AREA", (ax - 2.2, ay - 3.0, az + 2.2), key, (0.9, 0.93, 1.0), 2.5)
    light("_rim", "AREA", (ax + 2.4, ay - 0.8, az + 1.6), rim, lin("#38d8ff"), 1.0)
    light("_fill", "AREA", (ax + 1.5, ay - 3.5, az - 0.6), fill, (0.7, 0.8, 1.0), 2.0)
    # preview wall + floor
    wm = mat("_wall", lin("#0b0e14"), 0.2, 0.8)
    box("_wall", (ax, 0.05, 2.0), (6, 0.1, 4.0), wm, None, 0)
    box("_floor", (ax, -2.5, -0.05), (6, 5.2, 0.1), wm, None, 0)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    sc.collection.objects.link(cam)
    cam.location = cam_loc
    cam.data.lens = lens
    cam.constraints.new("TRACK_TO").target = aim
    sc.camera = cam
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 32
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.use_nodes = True
    nt = sc.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    rl, gl, co = nt.nodes.new("CompositorNodeRLayers"), nt.nodes.new("CompositorNodeGlare"), nt.nodes.new("CompositorNodeComposite")
    gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 1.2, 5, -0.4
    nt.links.new(rl.outputs[0], gl.inputs[0])
    nt.links.new(gl.outputs[0], co.inputs[0])
    return cam


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def export(root, path, blend):
    # glTF drops the emissive colour when strength is 0, so every glow material ships at strength >= 1 with its colour;
    # the app drives emissiveIntensity per state (0 = off).
    for name in GLOW:
        m = bpy.data.materials.get(name)
        if m and emission(m).default_value < 1:
            emission(m, 1.0)
    for o in sc.objects:
        o.select_set(False)
    for o in [root] + list(root.children_recursive):
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_apply=True,
                              export_yup=True, export_lights=False, export_cameras=False,
                              export_image_format="WEBP", export_image_quality=80)
    tris = 0
    dg = bpy.context.evaluated_depsgraph_get()
    for o in root.children_recursive:
        if o.type == "MESH":
            me = o.evaluated_get(dg).to_mesh()
            me.calc_loop_triangles()
            tris += len(me.loop_triangles)
    print("TRIS", os.path.basename(path), tris, "SIZE", os.path.getsize(path) // 1024, "KB")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=blend)
