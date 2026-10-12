# Scorer eye (ch1.scorer) — builds the model into a scene "scorer", renders previews, exports .glb.
# Live:     python3 -I design/3d/tools/bl.py code <runner>  (runner sets OUT / ACTION, then exec()s this file)
# Headless: blender -b -P design/3d/scorer/scorer.py
# Blender Z up, eye looks along -Y (= glTF +Z, so three.js lookAt() aims it). Origin = eye centre.
import bpy, bmesh, math, os
from math import sin, cos, radians as rad
from mathutils import Vector

OUT = globals().get("OUT") or os.path.dirname(os.path.abspath(__file__))
ACTION = globals().get("ACTION", "all")  # build | render | export | all
TAU = 2 * math.pi


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


# State colours = tokens.css / Room.tsx LAMP_COLOR. (colour, emission strength, lid closure 0..1)
STATES = {
    "off": ("#1a2333", 0.4, 0.0),
    "green": ("#39ff9c", 3.2, 0.0),
    "red": ("#ff3b4e", 3.6, 0.0),
    "dark": ("#b86bff", 1.6, 0.45),
}

# ---------------------------------------------------------------- scene
if bpy.app.background:  # headless: the build owns the whole file
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.name = "scorer"
sc = bpy.data.scenes.get("scorer") or bpy.data.scenes.new("scorer")
for w in bpy.context.window_manager.windows:
    w.scene = sc


def mat(name, base, metal=0.0, rough=0.5, em=None, strength=0.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Emission Color"].default_value = (*(em or (0, 0, 0)), 1)
    b.inputs["Emission Strength"].default_value = strength
    return m


def link(name, bm, material, parent, smooth=True, sharp=35):
    old = bpy.data.objects.get(name)
    if old:
        bpy.data.objects.remove(old)
    for f in bm.faces:
        f.smooth = smooth
    for e in bm.edges:
        if e.is_manifold and e.calc_face_angle(0) > rad(sharp):
            e.smooth = False
    if bpy.data.meshes.get(name):
        bpy.data.meshes.remove(bpy.data.meshes[name])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.parent = parent
    me.materials.append(material)
    return o


def empty(name, parent=None, loc=(0, 0, 0)):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o)
    o = bpy.data.objects.new(name, None)
    o.empty_display_size = 0.1
    o.location = loc
    sc.collection.objects.link(o)
    o.parent = parent
    return o


def bevel(o, w=0.002, seg=2, angle=30):
    m = o.modifiers.new("bevel", "BEVEL")
    m.width, m.segments, m.limit_method, m.angle_limit = w, seg, "ANGLE", rad(angle)
    m.harden_normals = True
    return m


def lathe(bm, prof, segs=96, a0=0.0, a1=TAU):
    """Revolve a closed (r, y) cross-section around the Y axis (the eye axis)."""
    full = abs(a1 - a0 - TAU) < 1e-6
    n = segs if full else segs + 1
    rows = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / segs
        rows.append([bm.verts.new((r * cos(a), y, r * sin(a))) for r, y in prof])
    P = len(prof)
    for i in range(segs):
        j = (i + 1) % n
        for k in range(P):
            k2 = (k + 1) % P
            bm.faces.new((rows[i][k], rows[j][k], rows[j][k2], rows[i][k2]))
    if not full:
        bm.faces.new(rows[0])
        bm.faces.new(list(reversed(rows[-1])))
    return bm


def box(bm, center, size, rot_y=0.0):
    """Axis box rotated about the Y axis by rot_y."""
    cx, cy, cz = center
    sx, sy, sz = (s / 2 for s in size)
    vs = []
    for dx, dy, dz in [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]:
        x, y, z = dx * sx, dy * sy, dz * sz
        x, z = x * cos(rot_y) + z * sin(rot_y), -x * sin(rot_y) + z * cos(rot_y)
        vs.append(bm.verts.new((cx + x, cy + y, cz + z)))
    for f in [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 5), (0, 4, 7, 3)]:
        bm.faces.new([vs[i] for i in f])


def finish(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ---------------------------------------------------------------- materials
M = {
    "hull": mat("scorer_hull", lin("#0d1117"), 0.85, 0.34),
    "plate": mat("scorer_plate", lin("#1a1f28"), 0.8, 0.42),
    "core": mat("scorer_core", lin("#05070a"), 0.4, 0.7),
    "trim": mat("scorer_trim", lin("#8a94a3"), 1.0, 0.22),
    "glass": mat("scorer_lens", lin("#020304"), 0.0, 0.04, coat=1.0),
    "bulb": mat("bulb", (0, 0, 0), 0.0, 0.4),
}
TICKS = [mat(f"tick_{i}", lin("#0a1a22"), 0.2, 0.4, em=lin("#38d8ff"), strength=0.0) for i in range(1, 6)]


def build():
    for o in list(sc.objects):
        bpy.data.objects.remove(o)
    root = empty("scorer")
    eye = empty("eye", root)

    # core (only seen through the panel gaps)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16, radius=0.188)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().y < -0.10], context="FACES")
    link("core", bm, M["core"], eye)

    # housing: armour plates in rings around the eye axis, with gaps
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=36, v_segments=18, radius=0.2)
    pid = {}
    kill = []
    for f in bm.faces:
        c = f.calc_center_median().normalized()
        phi = math.degrees(math.acos(max(-1, min(1, -c.y))))
        az = math.atan2(c.z, c.x)
        if phi < 54:
            kill.append(f)
            continue
        band, n, off = (0, 6, 0.5) if phi < 98 else (1, 6, 0.0) if phi < 142 else (2, 3, 0.25)
        pid[f] = (band, int(((az / TAU) + 0.5 + off / n) * n) % n)
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    seam = [e for e in bm.edges if len(e.link_faces) == 2 and pid[e.link_faces[0]] != pid[e.link_faces[1]]]
    bmesh.ops.split_edges(bm, edges=seam)
    seen = set()
    for f in bm.faces:
        if f in seen:
            continue
        isl, stack = set(), [f]
        while stack:
            g = stack.pop()
            if g in isl:
                continue
            isl.add(g)
            for e in g.edges:
                stack += [h for h in e.link_faces if h not in isl]
        seen |= isl
        vs = {v for g in isl for v in g.verts}
        cen = sum((v.co.copy() for v in vs), Vector()) / len(vs)
        rmax = max((v.co - cen).length for v in vs)
        s = 1 - 0.006 / rmax
        for v in vs:
            v.co = (cen + (v.co - cen) * s).normalized() * 0.2
    o = link("housing", bm, M["plate"], eye)
    sol = o.modifiers.new("solidify", "SOLIDIFY")
    sol.thickness, sol.offset = 0.012, -1
    bevel(o, 0.0025, 1, 30)

    # lens bezel (bright trim) + inner throat (dark)
    bm = bmesh.new()
    lathe(bm, [(0.150, -0.105), (0.168, -0.112), (0.171, -0.150), (0.163, -0.163), (0.142, -0.163), (0.134, -0.152), (0.136, -0.112)], 64)
    o = link("bezel", bm, M["trim"], eye)
    bevel(o, 0.0015, 1, 25)
    bm = bmesh.new()
    lathe(bm, [(0.134, -0.150), (0.137, -0.150), (0.122, -0.108), (0.118, -0.108)], 48)
    link("throat", bm, M["hull"], eye)
    # fine grip ring behind the bezel
    bm = bmesh.new()
    for k in range(72):
        box(bm, (0.158 * cos(k / 72 * TAU), -0.100, 0.158 * sin(k / 72 * TAU)), (0.004, 0.012, 0.006), -k / 72 * TAU)
    link("grip", bm, M["hull"], eye, smooth=False)

    # iris backplate (dark) + segmented glowing iris + pupil
    bm = bmesh.new()
    lathe(bm, [(0.0, -0.104), (0.121, -0.104), (0.121, -0.110), (0.0, -0.118)], 48)
    link("iris_back", bm, M["core"], eye)
    bm = bmesh.new()
    nseg, gap = 32, rad(2.2)
    for k in range(nseg):
        a0, a1 = k / nseg * TAU + gap / 2, (k + 1) / nseg * TAU - gap / 2
        lathe(bm, [(0.064, -0.124), (0.113, -0.114), (0.113, -0.109), (0.064, -0.118)], 3, a0, a1)
    finish(bm)
    link("bulb", bm, M["bulb"], eye, smooth=False)
    bm = bmesh.new()
    lathe(bm, [(0.047, -0.112), (0.066, -0.120), (0.066, -0.128), (0.050, -0.132)], 48)
    o = link("pupil_ring", bm, M["trim"], eye)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=0.05)
    bmesh.ops.scale(bm, vec=(1, 0.55, 1), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, -0.106, 0), verts=bm.verts)
    link("pupil", bm, M["glass"], eye)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=8, radius=0.009)
    bmesh.ops.translate(bm, vec=(0, -0.131, 0), verts=bm.verts)
    o = link("pupil_core", bm, M["bulb"], eye)

    # score ticks on the bezel front (5 flags), each its own material
    for i in range(5):
        a = rad(90 + (i - 2) * 16)
        bm = bmesh.new()
        box(bm, (0.1525 * cos(a), -0.1645, 0.1525 * sin(a)), (0.012, 0.003, 0.006), -a)
        link(f"tick_{i + 1}", bm, TICKS[i], eye, smooth=False)

    # back: hub + radial cooling fins
    bm = bmesh.new()
    lathe(bm, [(0.0, 0.17), (0.055, 0.17), (0.06, 0.205), (0.045, 0.228), (0.0, 0.228)], 24)
    o = link("hub", bm, M["hull"], eye)
    bevel(o, 0.002, 2, 30)
    bm = bmesh.new()
    for k in range(8):
        a = k / 8 * TAU + TAU / 16
        box(bm, (0.105 * cos(a), 0.175, 0.105 * sin(a)), (0.09, 0.05, 0.006), -a)
    o = link("fins", bm, M["hull"], eye, smooth=False)
    bevel(o, 0.0015, 1, 30)

    # eyelids: two armoured shells pivoting around X (open = retracted top/bottom)
    for name, t0, t1 in (("lid_top", 52, 168), ("lid_bottom", -52, -168)):
        bm = bmesh.new()
        A, T, r = 22, 14, 0.216
        grid = [[bm.verts.new((r * sin(al), -r * cos(al) * cos(th), r * cos(al) * sin(th)))
                 for al in [rad(-86 + 172 * i / A) for i in range(A + 1)]]
                for th in [rad(t0 + (t1 - t0) * j / T) for j in range(T + 1)]]
        for j in range(T):
            for i in range(A):
                bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
        finish(bm)
        o = link(name, bm, M["hull"], eye)
        sol = o.modifiers.new("solidify", "SOLIDIFY")
        sol.thickness, sol.offset = 0.014, 1
        bevel(o, 0.003, 2, 30)
        # bright lip along the leading edge
        bm = bmesh.new()
        lip = [bm.verts.new((0.2235 * sin(al), -0.2235 * cos(al) * cos(rad(t0)), 0.2235 * cos(al) * sin(rad(t0))))
               for al in [rad(-80 + 160 * i / 16) for i in range(17)]]
        for v0, v1 in zip(lip, lip[1:]):
            bm.edges.new((v0, v1))
        lo = link(name + "_lip", bm, M["trim"], o)
        sk = lo.modifiers.new("skin", "SKIN")
        for v in lo.data.skin_vertices[0].data:
            v.radius = (0.0035, 0.0035)

    # gyroscope rings (rotate around the eye), with glowing nodes at the arc ends
    for name, r0, r1, rot in (("ring_outer", 0.282, 0.296, (rad(14), rad(0), rad(-8))),
                              ("ring_inner", 0.250, 0.262, (rad(-12), rad(60), rad(10)))):
        piv = empty(name, root)
        piv.rotation_euler = rot
        bm = bmesh.new()
        nodes = bmesh.new()
        for k in range(3):
            a0 = k / 3 * TAU + rad(10)
            a1 = a0 + rad(100)
            lathe(bm, [(r0, -0.009), (r1, -0.009), (r1, 0.009), (r0, 0.009)], 18, a0, a1)
            for a in (a0 - rad(3.5), a1 + rad(3.5)):
                box(nodes, ((r0 + r1) / 2 * cos(a), 0, (r0 + r1) / 2 * sin(a)), (0.012, 0.014, 0.012), -a)
        finish(bm)
        o = link(name + "_band", bm, M["trim"], piv)
        bevel(o, 0.0015, 1, 30)
        link(name + "_nodes", nodes, M["bulb"], piv, smooth=False)
    return root


def set_state(st):
    col, strength, lid = STATES[st]
    b = M["bulb"].node_tree.nodes["Principled BSDF"]
    b.inputs["Emission Color"].default_value = (*lin(col), 1)
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Base Color"].default_value = (*[c * 0.3 for c in lin(col)], 1)
    for i, t in enumerate(TICKS):  # preview: 3 flags scored
        t.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 4.0 if (i < 3 and st != "off") else 0.0
    for n, sign in (("lid_top", 1), ("lid_bottom", -1)):
        o = sc.objects.get(n)
        if o:
            o.rotation_euler = (sign * rad(52) * lid, 0, 0)
    g = sc.objects.get("preview_glow")
    if g:
        g.data.color = lin(col)
        g.data.energy = strength * 0.08


def stage():
    """Preview-only lights + camera (not exported)."""
    w = sc.world or bpy.data.worlds.new("scorer_world")
    sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#05080e"), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0

    def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0):
        o = bpy.data.objects.get(name)
        if o:
            bpy.data.objects.remove(o)
        d = bpy.data.lights.new(name, kind)
        d.energy, d.color = energy, color
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location = loc
        sc.collection.objects.link(o)
        tr = o.constraints.new("TRACK_TO")
        tr.target = sc.objects["scorer"]
        return o

    light("key", "AREA", (-1.3, -1.2, 1.3), 70, (0.85, 0.92, 1.0), 1.2)
    light("rim", "AREA", (1.0, 1.1, 0.7), 70, lin("#38d8ff"), 0.8)
    light("under", "AREA", (0.3, -0.8, -1.0), 6, (0.6, 0.7, 1.0), 1.0)
    light("preview_glow", "POINT", (0, -0.35, 0), 1, (1, 1, 1))
    cam = bpy.data.objects.get("preview_cam")
    if cam:
        bpy.data.objects.remove(cam)
    cam = bpy.data.objects.new("preview_cam", bpy.data.cameras.new("preview_cam"))
    sc.collection.objects.link(cam)
    cam.location = (-0.78, -1.6, 0.34)
    cam.data.lens = 75
    tr = cam.constraints.new("TRACK_TO")
    tr.target = sc.objects["scorer"]
    sc.camera = cam
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 48
    sc.render.resolution_x, sc.render.resolution_y = 960, 720
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


def render(states):
    os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)
    for st in states:
        set_state(st)
        sc.render.filepath = os.path.join(OUT, "previews", f"scorer-{st}.png")
        bpy.ops.render.render(write_still=True, scene=sc.name)
    set_state("green")


def export():
    set_state("off")  # ship neutral; the app drives the state
    keep = set()
    def walk(o):
        keep.add(o)
        for c in o.children:
            walk(c)
    walk(sc.objects["scorer"])
    vl = sc.view_layers[0]
    for o in bpy.context.view_layer.objects:  # user's scene: never export its selection
        o.select_set(False)
    for o in sc.objects:
        o.select_set(o in keep, view_layer=vl)
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "ch1-scorer.glb"), export_format="GLB",
                              use_selection=True, export_apply=True, export_yup=True, export_lights=False,
                              export_cameras=False, export_extras=False)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "scorer.blend"), copy=not bpy.app.background)
    set_state("green")


if ACTION in ("build", "all"):
    build()
    stage()
    set_state("green")
if ACTION in ("render", "all"):
    render(globals().get("STATES_TO_RENDER", ["green", "red", "off", "dark"]))
if ACTION in ("export", "all"):
    export()
