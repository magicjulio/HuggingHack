# Ch2 "Deep Cache" islands: floating data shards in cyberspace.
# Headless: blender -b --factory-startup -P design/3d/ch2/islands.py  -> ch2-island-{s,m,l}.glb, islands.blend, previews/
# Look: a flat walkable deck (dark glossy circuit tiles with glowing traces), a gunmetal rim with a cyan edge line,
# and a faceted crystal underside hanging into the void with glowing fracture veins. A few loose shards hover below.
# Conventions: Blender Z up (glTF Y up), metres. Origin = centre of the walkable top, which is the plane z = 0
# (glTF y = 0), so the engineer's floor collider is "y = 0 inside the outline".
# Nodes per island (root `island_<size>`):
#   deck        the whole solid (top + rim + underside), materials isl_top / isl_rim / isl_rock
#   edge        glowing line around the deck, material `edge` (cyan; tint per island or state)
#   shard_<n>   loose crystals under the island; bob and spin them in code
#   outline     (empty) custom prop "outline" = JSON list of [x, y] top outline points in glTF XZ (x, -y) for colliders
import bpy, bmesh, os, sys, json
import numpy as np
from math import radians as rad, pi, cos, sin

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("ch2_islands", OUT)
TN = 1024


# ----------------------------------------------------------------------------------------------- textures
def circuit_tex(seed):
    """Dark tiles, a faint grid, and bright Manhattan traces with pads. Tileable; 1 texture = 8 m."""
    r = np.random.default_rng(seed)
    n, tiles = TN, 8
    t = n // tiles
    alb = np.zeros((n, n, 3)) + srgb("#0b1018")[None, None]
    var = up(r.random((tiles, tiles)), n) * 0 + np.kron(r.random((tiles, tiles)), np.ones((t, t)))
    alb *= (0.8 + 0.35 * var)[..., None]
    em = np.zeros((n, n))
    # grid seams between tiles (dim)
    c = np.arange(n) % t
    seam = ((c < 2) | (c >= t - 1)).astype(float)
    grid = np.maximum(seam[:, None], seam[None, :])
    alb *= (1 - 0.5 * grid)[..., None]
    em += 0.18 * grid
    # traces: random walks on a fine lattice (8 px cells), right-angle turns, pads at ends
    cell = 8
    m = n // cell
    tr = np.zeros((n, n))
    pads = np.zeros((n, n))
    for _ in range(46):
        x, y = r.integers(0, m, 2)
        d = r.integers(0, 4)
        L = r.integers(6, 30)
        pts = [(x, y)]
        for _ in range(L):
            if r.random() < 0.18:
                d = (d + (1 if r.random() < 0.5 else 3)) % 4
            dx, dy = ((1, 0), (0, 1), (-1, 0), (0, -1))[d]
            x, y = (x + dx) % m, (y + dy) % m
            pts.append((x, y))
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            xs = sorted((x0, x1)); ys = sorted((y0, y1))
            if abs(x1 - x0) > 1 or abs(y1 - y0) > 1:
                continue
            X0, X1 = xs[0] * cell + cell // 2 - 1, xs[1] * cell + cell // 2 + 2
            Y0, Y1 = ys[0] * cell + cell // 2 - 1, ys[1] * cell + cell // 2 + 2
            tr[Y0:Y1, X0:X1] = 1
        for (px, py) in (pts[0], pts[-1]):
            cx, cy = px * cell + cell // 2, py * cell + cell // 2
            pads[max(0, cy - 4):cy + 5, max(0, cx - 4):cx + 5] = 1
            pads[max(0, cy - 2):cy + 3, max(0, cx - 2):cx + 3] = 0.4
    em = np.maximum(em, 0.75 * tr)
    em = np.maximum(em, pads)
    # a few lit tiles (data blocks) faintly glowing
    lit = np.kron((r.random((tiles, tiles)) > 0.9).astype(float), np.ones((t, t)))
    inner = np.maximum.outer(np.abs(c - t / 2), np.abs(c - t / 2)) < t * 0.38
    em = np.maximum(em, 0.12 * lit * inner)
    alb = alb * (1 - tr[..., None] * 0.3) + srgb("#0e2a33")[None, None] * tr[..., None] * 0.3
    col = srgb("#38d8ff")[None, None] * em[..., None]
    hgt = -1.0 * grid + 0.4 * tr + 0.6 * pads
    return (save("isl_top_albedo", alb), save("isl_top_emit", col),
            save("isl_top_normal", normal_from(hgt, 3.0), False))


def vein_tex(seed):
    """Ridged noise -> thin glowing cracks over dark faceted glass-metal."""
    a = fbm(seed, 3, 6, n=TN)
    b = fbm(seed + 7, 6, 5, n=TN)
    ridge = 1 - np.abs(2 * a - 1)
    ridge2 = 1 - np.abs(2 * b - 1)
    v = np.maximum(sstep(0.955, 0.985, ridge), 0.6 * sstep(0.97, 0.99, ridge2))
    glow = sstep(0.88, 0.985, ridge) * 0.12
    e = np.clip(v + glow, 0, 1)
    tint = srgb("#2fd6ff")[None, None] * (1 - b[..., None] * 0.5) + srgb("#7a5cff")[None, None] * (b[..., None] * 0.5)
    alb = srgb("#0a0e16")[None, None] * (0.75 + 0.5 * fbm(seed + 3, 8, 4, n=TN))[..., None]
    alb = alb * (1 - e[..., None]) + tint * 0.3 * e[..., None]
    hgt = -1.5 * v + 0.3 * fbm(seed + 4, 12, 4, n=TN)
    return save("isl_rock_albedo", alb), save("isl_rock_emit", tint * e[..., None]), save("isl_rock_normal", normal_from(hgt, 4.0), False)


def emat(name, alb, emit, nrm, metal, rough, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes["Principled BSDF"]
    ta, te, tn = (nt.nodes.new("ShaderNodeTexImage") for _ in range(3))
    ta.image, te.image, tn.image = alb, emit, nrm
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(ta.outputs["Color"], b.inputs["Base Color"])
    nt.links.new(te.outputs["Color"], b.inputs["Emission Color"])
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Emission Strength"].default_value = strength
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    return m


TOP = emat("isl_top", *circuit_tex(11), metal=0.55, rough=0.3, strength=2.2)
ROCK = emat("isl_rock", *vein_tex(21), metal=0.35, rough=0.42, strength=3.0)
RIM = mat("isl_rim", lin("#1a2029"), 0.85, 0.32)
EDGE = mat("edge", lin("#04121a"), 0.0, 0.3, em=lin("#38d8ff"), strength=4.0)


# ----------------------------------------------------------------------------------------------- geometry
def outline(R, n, seed, jitter=0.12):
    r = np.random.default_rng(seed)
    a0 = r.random() * 2 * pi
    pts = []
    for i in range(n):
        a = a0 + 2 * pi * (i + (r.random() - 0.5) * 0.35) / n
        rr = R * (1 - jitter + 2 * jitter * r.random())
        pts.append((rr * cos(a), rr * sin(a)))
    return pts


def build_island(tag, R, n, depth, seed, slab=0.45, inset=0.32, n_shards=4):
    r = np.random.default_rng(seed)
    root = empty(f"island_{tag}", None)
    pts = outline(R, n, seed)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new()
    top = [bm.verts.new((x, y, 0)) for x, y in pts]
    lip = [bm.verts.new((x * 0.985, y * 0.985, -slab)) for x, y in pts]
    ft = bm.faces.new(top)
    ft.material_index = 0
    sides = []
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((top[j], top[i], lip[i], lip[j]))
        f.material_index = 1
        sides.append(f)
    # underside: shrinking, twisting jagged rings down to a tip
    rings = [lip]
    K = max(4, int(depth / (R * 0.35)) + 3)
    for k in range(1, K):
        t = k / K
        s = (1 - t) ** 0.9 * (0.9 + 0.1 * r.random())
        tw = 0.12 * k
        z = -slab - depth * t ** 1.15
        ring = []
        for i, (x, y) in enumerate(pts):
            jr = s * (0.8 + 0.4 * r.random())
            c, sn = cos(tw), sin(tw)
            ring.append(bm.verts.new(((x * c - y * sn) * jr, (x * sn + y * c) * jr, z + (r.random() - 0.5) * depth * 0.08)))
        rings.append(ring)
    tip = bm.verts.new(((r.random() - 0.5) * R * 0.2, (r.random() - 0.5) * R * 0.2, -slab - depth * (1.05 + 0.1 * r.random())))
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            # split each quad into two tris on a random diagonal: faceted crystal look
            if r.random() < 0.5:
                tris = ((a[j], a[i], b[i]), (a[j], b[i], b[j]))
            else:
                tris = ((a[j], a[i], b[j]), (a[i], b[i], b[j]))
            for tri in tris:
                f = bm.faces.new(tri)
                f.material_index = 2
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((rings[-1][j], rings[-1][i], tip))
        f.material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # inset the top: rim band (metal) + circuit field
    res = bmesh.ops.inset_region(bm, faces=[ft], thickness=inset, depth=0.0)
    for f in res["faces"]:
        f.material_index = 1
    # a shallow step down between rim and field gives the rim a lip that catches light
    inner = [f for f in bm.faces if f.material_index == 0]
    r2 = bmesh.ops.inset_region(bm, faces=inner, thickness=0.05, depth=0.02)
    for f in r2["faces"]:
        f.material_index = 1
    # UVs: top planar (1 texture = 8 m), everything else box-projected at 1 texture = 4 m
    bm.normal_update()
    for f in bm.faces:
        nrm = f.normal
        ax = max(range(3), key=lambda i: abs(nrm[i]))
        for l in f.loops:
            c = l.vert.co
            if f.material_index == 0:
                l[uvl].uv = (c.x / 8 + seed * 0.13, c.y / 8)
            else:
                u, v = (c.x, c.y) if ax == 2 else (c.x, c.z) if ax == 1 else (c.y, c.z)
                l[uvl].uv = (u / 4, v / 4)
    me = bpy.data.meshes.new("deck")
    bm.to_mesh(me)
    bm.free()
    for m in (TOP, RIM, ROCK):
        me.materials.append(m)
    deck = bpy.data.objects.new("deck", me)
    kit.sc.collection.objects.link(deck)
    deck.parent = root

    # edge line: a thin glowing band just under the top edge, sticking out a little
    eb = bmesh.new()
    lo, hi = [], []
    for x, y in pts:
        l = (x * x + y * y) ** 0.5
        ox, oy = x / l * 0.03, y / l * 0.03
        lo.append(eb.verts.new((x + ox, y + oy, -0.13)))
        hi.append(eb.verts.new((x + ox, y + oy, -0.08)))
    for i in range(n):
        j = (i + 1) % n
        eb.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bmesh.ops.recalc_face_normals(eb, faces=eb.faces)
    mesh_obj("edge", eb, EDGE, root, uv=False)

    # loose shards hovering below
    for k in range(n_shards):
        sb = bmesh.new()
        bmesh.ops.create_icosphere(sb, subdivisions=1, radius=1.0)
        sx = 0.25 + 0.5 * r.random()
        for v in sb.verts:
            v.co.x *= sx * (0.7 + 0.6 * r.random())
            v.co.y *= sx * (0.7 + 0.6 * r.random())
            v.co.z *= sx * (1.6 + 1.2 * r.random())
        a = r.random() * 2 * pi
        d = R * (0.55 + 0.5 * r.random())
        z = -slab - depth * (0.25 + 0.5 * r.random())
        o = mesh_obj(f"shard_{k + 1}", sb, ROCK, root, (d * cos(a), d * sin(a), z))
        o.rotation_euler = (r.random() * 0.6, r.random() * 0.6, r.random() * pi)

    # outline for colliders, glTF coords (x, z = -y)
    ol = empty("outline", root)
    ol["outline"] = json.dumps([[round(x, 3), round(-y, 3)] for x, y in pts])
    return root


ISLANDS = {
    "s": build_island("s", 2.6, 9, 3.2, 3, n_shards=3),
    "m": build_island("m", 5.0, 12, 6.0, 5, n_shards=4),
    "l": build_island("l", 9.0, 15, 10.0, 8, n_shards=6),
}


# ----------------------------------------------------------------------------------------------- preview: the void
def void_stage():
    w = bpy.data.worlds.new("void")
    kit.sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#03050b"), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 1.0
    kit.sc.render.engine = "BLENDER_EEVEE_NEXT"
    kit.sc.eevee.taa_render_samples = 48
    kit.sc.view_settings.view_transform = "AgX"
    kit.sc.view_settings.look = "AgX - Medium High Contrast"
    kit.sc.use_nodes = True
    nt = kit.sc.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    rl, gl, co = nt.nodes.new("CompositorNodeRLayers"), nt.nodes.new("CompositorNodeGlare"), nt.nodes.new("CompositorNodeComposite")
    gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 0.9, 7, -0.25
    nt.links.new(rl.outputs[0], gl.inputs[0])
    nt.links.new(gl.outputs[0], co.inputs[0])


def light(name, kind, loc, energy, color, aim, size=2.0):
    d = bpy.data.lights.new(name, kind)
    d.energy, d.color = energy, color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    kit.sc.collection.objects.link(o)
    o.constraints.new("TRACK_TO").target = aim
    return o


def camera(loc, aim, lens):
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    kit.sc.collection.objects.link(cam)
    cam.location = loc
    cam.data.lens = lens
    cam.data.clip_end = 400
    cam.constraints.new("TRACK_TO").target = aim
    kit.sc.camera = cam
    return cam


void_stage()
aim = empty("_aim", None, (0, 0, -1))
# cool key from above, violet + cyan rims from below (the void glows faintly)
light("_key", "SUN", (10, -10, 20), 1.6, (0.75, 0.85, 1.0), aim)
light("_rimc", "AREA", (14, 10, -4), 9000, lin("#38d8ff"), aim, 10)
light("_rimv", "AREA", (-16, -6, -10), 7000, lin("#7a5cff"), aim, 10)
# a player-sized green orb for scale on the large island
orb = mat("_orb", lin("#39ff9c"), 0, 0.2, em=lin("#39ff9c"), strength=12)
ob = bmesh.new()
bmesh.ops.create_uvsphere(ob, u_segments=24, v_segments=12, radius=0.3)
mesh_obj("_orb", ob, orb, None, (1.5, -2.0, 0.45), uv=False)
for p in bpy.data.objects["_orb"].data.polygons:
    p.use_smooth = True

prev = os.path.join(OUT, "previews")
ISLANDS["l"].location = (0, 0, 0)
ISLANDS["m"].location = (-17, 10, 3.5)
ISLANDS["s"].location = (11, 14, 6.5)
kit.sc.render.resolution_x, kit.sc.render.resolution_y = 1600, 900
cam = camera((14, -24, 9), aim, 30)
render(os.path.join(prev, "islands-group.png"))
# close-up on the large deck with the orb
aim.location = (1.0, -1.0, -0.6)
cam.location = (5.5, -8.5, 2.4)
cam.data.lens = 28
render(os.path.join(prev, "island-l-close.png"))
# from below: the crystal underside
aim.location = (0, 0, -5)
cam.location = (16, -16, -11)
cam.data.lens = 32
render(os.path.join(prev, "island-l-below.png"))

for tag, root in ISLANDS.items():
    root.location = (0, 0, 0)
for tag, root in ISLANDS.items():
    export(root, os.path.join(OUT, f"ch2-island-{tag}.glb"), os.path.join(OUT, "islands.blend"))
