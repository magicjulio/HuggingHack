# ASCENT (Ending 2) dropship: KAM1196A's ride into the Hugging Face HQ, seen mostly from behind and above (chase cam).
# blender -b --factory-startup -P design/3d/end2/dropship.py [-- fleet]
#   hero  -> end2-dropship.glb        (the player's ship, ~20k tris, separate nodes for the moving parts)
#   fleet -> end2-dropship-fleet.glb  (same silhouette, no plates/greebles, for the ~38 swarm ships)
# Axes: Blender Z up, NOSE ALONG +Y (= glTF -Z = three.js -Z, the way flight.js flies). Origin = hull centre. Metres.
# Glow materials: engine_glow (green = player, the app recolours to cyan for the fleet), trim_glow, orb, nav_red, nav_green.
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "lib"))
import kit
from kit import *
import bmesh
import numpy as np
from math import pi, cos, sin, radians

OUT = os.path.dirname(os.path.abspath(__file__))
FLEET = "fleet" in sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else False
NAME = "end2-dropship-fleet" if FLEET else "end2-dropship"
kit.reset(NAME, OUT)

# ------------------------------------------------------------------------------------------------ materials
M = dict(
    armour=mat("armour", lin("#8f99a3"), 0.25, 0.38),          # light grey paint: the approach is lit ~2x the atrium (flight.js adds its own lights), bone white blew out
    core=mat("core", lin("#1b2430"), 0.75, 0.42),               # gunmetal hull under the plates
    steel=mat("steel", lin("#3a4757"), 0.9, 0.28),
    dark=mat("dark", lin("#0b1017"), 0.6, 0.55),
    ink=mat("ink", lin("#1b2430"), 0.2, 0.6),
    hazard_y=mat("hazard_y", lin("#c98a10"), 0.1, 0.5),
    hazard_k=mat("hazard_k", lin("#14181e"), 0.1, 0.6),
    engine_glow=mat("engine_glow", lin("#39ff9c"), 0, 0.4, em=lin("#39ff9c"), strength=2.0),
    trim_glow=mat("trim_glow", lin("#39ff9c"), 0, 0.4, em=lin("#39ff9c"), strength=1.0),
    orb=mat("orb", lin("#2fa85a"), 0, 0.3, em=lin("#39ff9c"), strength=1.1),
    nav_red=mat("nav_red", lin("#ff3b4e"), 0, 0.4, em=lin("#ff3b4e"), strength=2.0),
    nav_green=mat("nav_green", lin("#9affc4"), 0, 0.4, em=lin("#9affc4"), strength=2.0),
)
glass = mat("glass", lin("#0c2a26"), 0.0, 0.05)
b = glass.node_tree.nodes["Principled BSDF"]
b.inputs["Alpha"].default_value = 0.32
glass.surface_render_method = "BLENDED"
M["glass"] = glass

root = empty(NAME, None)

# ------------------------------------------------------------------------------------------------ hull shape
# Superellipse cross-sections along Y (rear -9.4 .. nose +10.4): half-width a, half-height b, centre z, squareness n.
HY = [-9.4, -8.0, -5.0, -1.0, 2.5, 5.5, 8.0, 10.4]
HA = [2.05, 2.35, 2.55, 2.45, 2.05, 1.45, 0.75, 0.12]
HB = [1.30, 1.45, 1.55, 1.50, 1.30, 0.95, 0.55, 0.10]
HZ = [0.10, 0.12, 0.15, 0.18, 0.12, -0.05, -0.20, -0.28]
HN = [4.0, 3.6, 3.2, 3.0, 2.8, 2.6, 2.4, 2.2]


def H(y):
    return (np.interp(y, HY, HA), np.interp(y, HY, HB), np.interp(y, HY, HZ), np.interp(y, HY, HN))


def ring_pt(y, t, scale=1.0):
    a, bb, zc, n = H(y)
    c, s = cos(t), sin(t)
    x = a * scale * np.sign(c) * abs(c) ** (2 / n)
    z = zc + bb * scale * np.sign(s) * abs(s) ** (2 / n)
    return (x, y, z)


def loft(name, ys, ts, material, parent, scale=1.0, closed=True, cap=True, smooth=True):
    bm = bmesh.new()
    rows = [[bm.verts.new(ring_pt(y, t, scale)) for t in ts] for y in ys]
    nt = len(ts)
    for i in range(len(ys) - 1):
        for j in range(nt if closed else nt - 1):
            j2 = (j + 1) % nt
            bm.faces.new((rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]))
    if cap and closed:
        bm.faces.new(rows[0][::-1])
        bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm, material, parent)
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = len(p.vertices) == 4
    return o


def solidify(o, t, bev=0.02, seg=1):
    m = o.modifiers.new("solid", "SOLIDIFY")
    m.thickness, m.offset = t, 1.0
    if bev:
        bevel(o, bev, seg)
    return o


NT = 20 if FLEET else 40
TS = [2 * pi * i / NT for i in range(NT)]
YS = list(np.linspace(-9.4, 10.4, 12 if FLEET else 34))
loft("hull", YS, TS, M["core"], root)

# ------------------------------------------------------------------------------------------------ armour plates
# Plates sit 2.5 % outside the core with gaps, so the dark hull shows as seams (the scorer trick).
GAP_Y, GAP_T = 0.10, 0.035
PY = [-9.2, -6.6, -3.9, -1.2, 1.4, 5.6, 8.2]
PT = [(-0.30, 0.42), (0.42, 1.12), (1.12, 2.02), (2.02, 2.72), (2.72, 3.44)]   # angle bands (0 = right side, pi/2 = top)
if not FLEET:
    for i in range(len(PY) - 1):
        y0, y1 = PY[i] + GAP_Y, PY[i + 1] - GAP_Y
        for k, (t0, t1) in enumerate(PT):
            if i == 4 and k == 2:          # canopy sits here
                continue
            if i == 0 and k in (1, 3):     # engine pylons / tail fins land here: keep the gunmetal
                continue
            t0g, t1g = t0 + GAP_T, t1 - GAP_T
            ys = list(np.linspace(y0, y1, max(3, int((y1 - y0) * 2.2))))
            ts = list(np.linspace(t0g, t1g, max(3, int((t1g - t0g) * 9))))
            p = loft(f"plate_{i}_{k}", ys, ts, M["armour"], root, scale=1.035, closed=False, cap=False)
            solidify(p, 0.07, 0.018)
    # nose cap plate (top), belly keel plate
    p = loft("plate_nose", list(np.linspace(8.3, 10.1, 4)), list(np.linspace(0.35, 2.8, 12)), M["armour"], root, 1.04, False, False)
    solidify(p, 0.06, 0.015)
    p = loft("keel", list(np.linspace(-8.6, 6.0, 10)), list(np.linspace(4.32, 5.1, 5)), M["steel"], root, 1.03, False, False)
    solidify(p, 0.09, 0.02)
else:
    p = loft("plate_top", list(np.linspace(-9.0, 9.0, 10)), list(np.linspace(0.3, 2.84, 10)), M["armour"], root, 1.02, False, False)
    solidify(p, 0.05, 0)

# ------------------------------------------------------------------------------------------------ canopy + the pilot (you)
cy = 3.5
_, cb, cz, _ = H(cy)
top = cz + cb
canopy = empty("canopy", root, (0, cy, top - 0.12))
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=24 if not FLEET else 12, v_segments=12 if not FLEET else 6, radius=1.0)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05], context="VERTS")
bmesh.ops.scale(bm, vec=(1.05, 1.75, 0.95), verts=bm.verts)
g = mesh_obj("glass", bm, M["glass"], canopy, uv=False)
for p in g.data.polygons:
    p.use_smooth = True
bm = bmesh.new()
bmesh.ops.create_uvsphere(bm, u_segments=24 if not FLEET else 12, v_segments=14 if not FLEET else 8, radius=0.62)
o = mesh_obj("orb", bm, M["orb"], canopy, (0, 0.1, 0.32), uv=False)
for p in o.data.polygons:
    p.use_smooth = True
if not FLEET:
    fr = torus("canopy_frame", (0, 0, 0.02), 1.0, 0.07, M["steel"], canopy, axis="Z", seg=40, rseg=6)
    fr.scale = (1.09, 1.8, 1.0)
    # two ribs over the dome
    for sx in (-0.42, 0.42):
        pts = [(sx * (1 - (u * u)) ** 0.5 * 1.0, u * 1.72, 0.03 + 0.9 * (1 - u * u) ** 0.5) for u in np.linspace(-0.98, 0.98, 14)]
        wire(f"canopy_rib_{'l' if sx < 0 else 'r'}", [(x, y, z) for x, y, z in pts], 0.045, M["steel"], canopy)
    # pilot cradle under the orb
    cyl("cradle", (0, 0.1, -0.05), 0.55, 0.22, M["dark"], canopy, seg=20, r2=0.38)
    torus("cradle_glow", (0, 0.1, 0.07), 0.47, 0.025, M["trim_glow"], canopy, axis="Z", seg=32, rseg=4)

# ------------------------------------------------------------------------------------------------ wings
def slab(name, poly, z0, z1, material, parent, loc=(0, 0, 0), bev=0.03):
    """Extrude a polygon in the XY plane between z0 and z1."""
    bm = bmesh.new()
    a = [bm.verts.new((x, y, z0)) for x, y in poly]
    c = [bm.verts.new((x, y, z1)) for x, y in poly]
    bm.faces.new(a[::-1])
    bm.faces.new(c)
    for i in range(len(poly)):
        j = (i + 1) % len(poly)
        bm.faces.new((a[i], a[j], c[j], c[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bevel(mesh_obj(name, bm, material, parent, loc), bev, 1 if FLEET else 2)


def lerp2(p, q, u):
    return (p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u)


for side in (1, -1):
    s = "r" if side > 0 else "l"
    wing = empty(f"wing_{s}", root, (side * 1.9, -1.2, -0.15), (0, radians(-7 * side), 0))
    # planform (local): root chord y -3.8..+2.0, swept to the tip chord at x 7.2, y -6.2..-4.2
    LE0, TE0, LE1, TE1 = (0, 2.0), (0, -3.8), (7.3, -4.1), (7.3, -6.3)
    poly = [TE0, TE1, LE1, LE0]
    slab(f"wing_{s}_core", [(side * x, y) for x, y in poly] if side > 0 else [(side * x, y) for x, y in poly][::-1],
         -0.2, 0.2, M["core"], wing)
    if not FLEET:
        # three top plates between spar lines, inset for seams
        cuts = [0.04, 0.36, 0.68, 0.97]
        for k in range(3):
            u0, u1 = cuts[k] + 0.012, cuts[k + 1] - 0.012
            q = [lerp2(TE0, TE1, u0), lerp2(TE0, TE1, u1), lerp2(LE0, LE1, u1), lerp2(LE0, LE1, u0)]
            # pull the plate in from the leading/trailing edge
            q = [(x, y + (0.16 if i < 2 else -0.28)) for i, (x, y) in enumerate(q)]
            pts = [(side * x, y) for x, y in q]
            slab(f"wing_{s}_plate_{k}", pts if side > 0 else pts[::-1], 0.2, 0.27, M["armour"], wing, bev=0.015)
            pts_b = [(side * x, y) for x, y in q]
            slab(f"wing_{s}_under_{k}", pts_b if side > 0 else pts_b[::-1], -0.25, -0.2, M["steel"], wing, bev=0.01)
        # leading-edge strake (steel) and the trailing flap (separate node, can droop on landing)
        le = [lerp2(LE0, LE1, u) for u in (0.0, 1.0)]
        slab(f"wing_{s}_edge", [(side * le[0][0], le[0][1]), (side * le[1][0], le[1][1]),
                                 (side * le[1][0], le[1][1] + 0.22), (side * le[0][0], le[0][1] + 0.22)][::side],
             -0.12, 0.12, M["steel"], wing, bev=0.02)
        flap = empty(f"flap_{s}", wing, (0, 0, 0))
        te = [lerp2(TE0, TE1, u) for u in (0.35, 0.92)]
        fp = [(side * te[0][0], te[0][1]), (side * te[1][0], te[1][1]),
              (side * te[1][0], te[1][1] - 0.7), (side * te[0][0], te[0][1] - 0.7)]
        slab(f"flap_{s}_mesh", fp[::side], -0.1, 0.1, M["armour"], flap, bev=0.02)
        # a glowing seam between wing and flap
        slab(f"flap_{s}_glow", [(side * te[0][0], te[0][1] + 0.02), (side * te[1][0], te[1][1] + 0.02),
                                (side * te[1][0], te[1][1] - 0.04), (side * te[0][0], te[0][1] - 0.04)][::side],
             0.0, 0.14, M["trim_glow"], wing, bev=0)
        # call sign stencilled on the right wing
        if side > 0:
            text("callsign", "KAM1196A", 0.62, (3.35, -2.1, 0.275), M["ink"], wing, rot=(0, 0, radians(-14)), extrude=0.004,
                 font=kit.MONO)
    # wingtip pod with nav light
    tip = empty(f"tip_{s}", wing, (side * 7.45, -5.0, 0.0))
    cyl(f"tip_{s}_pod", (0, 0, 0), 0.32, 3.2, M["steel"], tip, axis="Y", seg=12 if FLEET else 16, bev=0.0 if FLEET else 0.02, r2=0.22)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.17)
    mesh_obj(f"nav_{s}", bm, M["nav_green" if side > 0 else "nav_red"], tip, (0, 1.65, 0), uv=False)

# ------------------------------------------------------------------------------------------------ engines
for side in (1, -1):
    s = "r" if side > 0 else "l"
    eng = empty(f"engine_{s}", root, (side * 3.55, -5.6, 0.35))
    L = 6.4
    # nacelle body: a lofted circle (bulge in the middle), open at the back for the nozzle
    bm = bmesh.new()
    NS = 14 if FLEET else 28
    prof = [(3.3, 0.92), (3.0, 1.08), (1.8, 1.18), (-1.5, 1.16), (-2.9, 1.06)]
    rows = []
    for y, r in prof:
        rows.append([bm.verts.new((r * cos(2 * pi * j / NS), y, r * sin(2 * pi * j / NS))) for j in range(NS)])
    for i in range(len(rows) - 1):
        for j in range(NS):
            j2 = (j + 1) % NS
            bm.faces.new((rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    nac = mesh_obj(f"nacelle_{s}", bm, M["core"], eng)
    for p in nac.data.polygons:
        p.use_smooth = True
    solidify(nac, 0.06, 0)
    # intake lip + dark intake fan face
    torus(f"intake_{s}", (0, 3.32, 0), 0.92, 0.1, M["steel"], eng, axis="Y", seg=NS, rseg=6)
    cyl(f"intake_{s}_fan", (0, 3.0, 0), 0.86, 0.1, M["dark"], eng, axis="Y", seg=NS)
    if not FLEET:
        # spinner + fan blades (node `fan_<s>` can spin)
        fan = empty(f"fan_{s}", eng, (0, 3.05, 0))
        cyl(f"fan_{s}_hub", (0, 0.12, 0), 0.24, 0.3, M["steel"], fan, axis="Y", seg=12, r2=0.05)
        for k in range(10):
            bl = box(f"fan_{s}_blade_{k}", (0, 0, 0), (0.07, 0.04, 0.62), M["steel"], fan, bev=0)
            bl.rotation_euler = (0, radians(36 * k), 0)
            bl.location = (0.45 * sin(radians(36 * k)), 0.05, 0.45 * cos(radians(36 * k)))
            bl.rotation_euler = (radians(25), radians(36 * k), 0)
        # armour sleeves over the top half of the nacelle
        for k, (y0, y1) in enumerate(((0.35, 2.85), (-2.6, 0.15))):
            bm = bmesh.new()
            ang = np.linspace(radians(-25 if side > 0 else 25) + radians(10), radians(205 if side > 0 else 155) - radians(10), 18)
            if side < 0:
                ang = np.linspace(radians(-25), radians(205), 18)
            ys = np.linspace(y0, y1, 5)
            rr = lambda y: np.interp(y, [p_[0] for p_ in prof[::-1]], [p_[1] for p_ in prof[::-1]]) * 1.04
            vv = [[bm.verts.new((rr(y) * cos(a), y, rr(y) * sin(a))) for a in ang] for y in ys]
            for i in range(len(ys) - 1):
                for j in range(len(ang) - 1):
                    bm.faces.new((vv[i][j], vv[i][j + 1], vv[i + 1][j + 1], vv[i + 1][j]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            sl = mesh_obj(f"engine_{s}_sleeve_{k}", bm, M["armour"], eng)
            for p in sl.data.polygons:
                p.use_smooth = True
            solidify(sl, 0.06, 0.015)
        # hazard band near the nozzle
        torus(f"engine_{s}_band", (0, -2.75, 0), 1.08, 0.07, M["hazard_y"], eng, axis="Y", seg=NS, rseg=4)
    # nozzle: flared steel bell, dark throat, glowing core + 3 segmented rings (the read from the chase cam)
    noz = empty(f"nozzle_{s}", eng, (0, -3.0, 0))
    bm = bmesh.new()
    nprof = [(0.25, 1.0), (-0.35, 0.98), (-0.95, 1.12), (-1.05, 1.06)]
    rows = [[bm.verts.new((r * cos(2 * pi * j / NS), y, r * sin(2 * pi * j / NS))) for j in range(NS)] for y, r in nprof]
    for i in range(len(rows) - 1):
        for j in range(NS):
            j2 = (j + 1) % NS
            bm.faces.new((rows[i][j], rows[i][j2], rows[i + 1][j2], rows[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bell = mesh_obj(f"nozzle_{s}_bell", bm, M["steel"], noz)
    for p in bell.data.polygons:
        p.use_smooth = True
    solidify(bell, 0.07, 0)
    cyl(f"nozzle_{s}_throat", (0, -0.1, 0), 0.9, 0.2, M["dark"], noz, axis="Y", seg=NS)
    cyl(f"exhaust_{s}_core", (0, -0.32, 0), 0.5, 0.06, M["engine_glow"], noz, axis="Y", seg=NS)
    if not FLEET:
        for k, (r, yy) in enumerate(((0.86, -0.25), (0.7, -0.27), (0.6, -0.29))):
            # 12 wedges per ring = segmented glow (the scorer iris trick)
            bm = bmesh.new()
            n = 12
            for w in range(n):
                a0, a1 = 2 * pi * (w + 0.12) / n, 2 * pi * (w + 0.88) / n
                ri, ro = r - 0.07, r
                vs = [bm.verts.new((rr_ * cos(a), yy, rr_ * sin(a))) for rr_, a in ((ri, a0), (ro, a0), (ro, a1), (ri, a1))]
                f = bm.faces.new(vs)
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            for f in bm.faces:
                if f.normal.y > 0:
                    f.normal_flip()
            mesh_obj(f"exhaust_{s}_ring_{k}", bm, M["engine_glow"], noz, uv=False)
    empty(f"exhaust_{s}", noz, (0, -1.1, 0))   # plume anchor for the app (additive cone / sprite), points -Y
    # pylon to the hull
    box(f"pylon_{s}", (side * -1.45, -0.4, 0.05), (1.9, 3.6, 0.5), M["core"], eng, bev=0.06 if not FLEET else 0)
    if not FLEET:
        box(f"pylon_{s}_cap", (side * -1.45, -0.4, 0.32), (1.7, 3.2, 0.08), M["armour"], eng, bev=0.02)

# ------------------------------------------------------------------------------------------------ tail, spine, ramp
for side in (1, -1):
    s = "r" if side > 0 else "l"
    fin = empty(f"fin_{s}", root, (side * 1.15, -7.6, 1.25), (0, radians(28 * side), 0))
    fpoly = [(-0.09, -1.6, 0), (-0.09, 1.4, 0)]
    bm = bmesh.new()
    prof = [(-1.7, 0.0), (1.5, 0.0), (-0.2, 2.2), (-1.5, 2.3)]  # (y, z) in the fin plane
    a = [bm.verts.new((-0.09, y, z)) for y, z in prof]
    c = [bm.verts.new((0.09, y, z)) for y, z in prof]
    bm.faces.new(a[::-1]); bm.faces.new(c)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((a[i], a[j], c[j], c[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bevel(mesh_obj(f"fin_{s}_mesh", bm, M["armour"], fin), 0.0 if FLEET else 0.03, 2)
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.12)
    mesh_obj(f"fin_{s}_light", bm, M["nav_red"], fin, (0, -1.5, 2.32), uv=False)

_, sb, sz, _ = H(-2.0)
if not FLEET:
    # dorsal spine: steel rail with a running light that leads the eye from the tail to the canopy
    box("spine", (0, -3.2, sz + sb * 1.035 + 0.12), (0.5, 9.2, 0.22), M["steel"], root, bev=0.05)
    box("spine_glow", (0, -3.2, sz + sb * 1.035 + 0.24), (0.12, 8.6, 0.04), M["trim_glow"], root, bev=0)
    box("antenna_base", (0, -7.9, H(-7.9)[2] + H(-7.9)[1] * 1.03 + 0.15), (0.3, 0.6, 0.3), M["steel"], root, bev=0.03)
    cyl("antenna", (0, -7.9, H(-7.9)[2] + H(-7.9)[1] * 1.03 + 1.0), 0.03, 1.6, M["steel"], root, seg=6)
    # side vents (greebles) behind the canopy
    for side in (1, -1):
        for k in range(4):
            y = -0.6 - k * 0.55
            x, _, z = ring_pt(y, radians(30 if side > 0 else 150), 1.06)
            v = box(f"vent_{'r' if side > 0 else 'l'}_{k}", (x, y, z), (0.08, 0.32, 0.5), M["dark"], root, bev=0)
            v.rotation_euler = (0, radians(-35 * side), 0)

# rear ramp, hinged at its bottom edge (node `ramp`, rotate X to open)
ra, rb, rz, _ = H(-9.4)
ztop = rz + rb * 0.5
zbot = rz - rb * 0.92
ramp = empty("ramp", root, (0, -9.42, zbot))
# the door follows the hull's rear section (scaled in), flat across the top
t0 = np.arcsin(((ztop - rz) / (rb * 0.92)) ** (H(-9.4)[3] / 2))
door = [ring_pt(-9.4, t, 0.92) for t in np.linspace(pi - t0, 2 * pi + t0, 22 if not FLEET else 10)]
door = [(x, z - zbot) for x, _, z in door]
dm = prism("ramp_door", door, -0.16, 0.0, M["armour" if not FLEET else "core"], ramp, bev=0.03 if not FLEET else 0)
if not FLEET:
    hazard("ramp_hazard", (0, -0.17, 0.42), ra * 1.25, 0.36, M["hazard_y"], M["hazard_k"], ramp, n=9, depth=0.02)
    box("ramp_glow", (0, -0.17, ztop - zbot - 0.22), (ra * 1.3, 0.03, 0.06), M["trim_glow"], ramp, bev=0)
    for side in (1, -1):
        box(f"ramp_hinge_{'r' if side > 0 else 'l'}", (side * ra * 0.62, -0.08, 0.06), (0.26, 0.26, 0.26), M["steel"], ramp, bev=0.04)
    # landing skids, folded up under the belly (node `gear`, lower on landing)
    gear = empty("gear", root, (0, 0, 0))
    for side in (1, -1):
        box(f"skid_{'r' if side > 0 else 'l'}", (side * 1.2, -0.6, -1.42), (0.26, 6.2, 0.2), M["steel"], gear, bev=0.04)
        for y in (-3.0, 1.8):
            box(f"strut_{'r' if side > 0 else 'l'}_{int(y)}", (side * 1.2, y, -1.28), (0.14, 0.3, 0.3), M["dark"], gear, bev=0.02)

# ------------------------------------------------------------------------------------------------ preview stage + renders
def preview_stage():
    w = bpy.data.worlds.new("w")
    kit.sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#101b28"), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    aim = empty("_aim", None, (0, 0, 0))

    def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0):
        d = bpy.data.lights.new(name, kind)
        d.energy, d.color = energy, color
        if kind == "AREA":
            d.size = size
        o = bpy.data.objects.new(name, d)
        o.location = loc
        kit.sc.collection.objects.link(o)
        o.constraints.new("TRACK_TO").target = aim
        return o

    light("_sun", "SUN", (12, 18, 30), 3.2, lin("#ffe7b1"))       # warm HQ light from ahead
    light("_rim", "AREA", (-14, -20, 6), 9000, lin("#38d8ff"), 8)   # cool rim from behind-left
    light("_fill", "AREA", (16, -10, -6), 2500, lin("#accbdb"), 10)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    kit.sc.collection.objects.link(cam)
    cam.constraints.new("TRACK_TO").target = aim
    kit.sc.camera = cam
    kit.sc.render.engine = "BLENDER_EEVEE_NEXT"
    kit.sc.eevee.taa_render_samples = 32
    kit.sc.render.resolution_x, kit.sc.render.resolution_y = 1280, 720
    kit.sc.view_settings.view_transform = "AgX"
    kit.sc.view_settings.look = "AgX - Medium High Contrast"
    kit.sc.use_nodes = True
    nt = kit.sc.node_tree
    for nd in list(nt.nodes):
        nt.nodes.remove(nd)
    rl, gl, co = nt.nodes.new("CompositorNodeRLayers"), nt.nodes.new("CompositorNodeGlare"), nt.nodes.new("CompositorNodeComposite")
    gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 1.0, 6, -0.3
    nt.links.new(rl.outputs[0], gl.inputs[0])
    nt.links.new(gl.outputs[0], co.inputs[0])
    return cam, aim


cam, aim = preview_stage()
PREV = os.path.join(OUT, "previews")
views = {
    "chase": ((0, -30, 9.5), (0, 6, 2.5), 32),      # the gameplay camera: behind and above
    "three-quarter": ((17, 15, 6), (0, -0.5, 0), 40),
    "rear-low": ((-9, -21, -1.5), (0, -4, 0.5), 35),
    "top": ((-11, -8, 22), (0, -0.5, 0), 38),
}
only = os.environ.get("VIEWS")
for name, (loc, at, lens) in views.items():
    if only and name not in only.split(","):
        continue
    cam.location, aim.location, cam.data.lens = loc, at, lens
    render(os.path.join(PREV, f"{NAME}-{name}.png"))

export(root, os.path.join(OUT, f"{NAME}.glb"), os.path.join(OUT, f"{NAME}.blend"))
