# ASCENT (Ending 2): barrier picket drone for the approach (replaces the box obstacles in flight.js).
# blender -b --factory-startup -P design/3d/end2/landing/barrier.py [-- preview]
#   -> end2-approach-barrier.glb (+ .blend); copy the glb to prototypes/end2-ascent/assets/models/.
# Game coordinates through t3()/tbox() (x right, y up, z towards the incoming player). Origin = field centre.
# It fills flight.js's collision box (|dx| < 16, |dy| < 7, |dz| < 10): pylons at x = +-14.6, field 28 x 12.
# Nodes for the app:
#   field        28 x 12 plane facing +z, UV 0..1 (the app gives it the energy shader; hit = flash)
#   eye          sensor head on the pod's nose (rotate towards the player; material `barrier_eye`)
#   fan_l/fan_r  ducted lift fans under the pod (spin around their local y)
#   beacon_l/r   pylon tops (the app adds blinking amber points)
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "lib"))
import kit
from kit import *
import bpy, bmesh
from math import radians, pi, cos, sin

OUT = os.path.dirname(os.path.abspath(__file__))
ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
NAME = "end2-approach-barrier"
kit.reset(NAME, OUT)


def t3(x, y, z):
    return (x, -z, y)


def tbox(name, x, y, z, w, h, d, m, parent, bev=0.0, rot=None):
    return box(name, t3(x, y, z), (w, d, h), m, parent, bev=bev, rot=rot)


def strut(name, a, b, w, h, m, parent):
    A, B = Vector(t3(*a)), Vector(t3(*b))
    d = B - A
    o = box(name, tuple((A + B) / 2), (w, d.length, h), m, parent, bev=0)
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = d.to_track_quat("Y", "Z")
    return o


kit.UVS = 1 / 3  # one texture tile = 3 m
M = dict(
    gun=tmat("bar_gunmetal", surface("bar_gunmetal", "#262d36", 411, chip=0.66, rust_amt=0.45, metal=0.75, rough=0.42, dirt=0.5, panel=2)),
    paint=tmat("bar_paint", surface("bar_paint", "#d39a12", 412, chip=0.58, rust_amt=0.55, metal=0.1, rough=0.5, dirt=0.55, panel=1)),
    steel=tmat("bar_steel", surface("bar_steel", "#4d5560", 413, chip=0.8, rust_amt=0.3, metal=0.9, rough=0.35, dirt=0.3)),
    dark=mat("bar_dark", lin("#08090b"), 0.3, 0.7),
    glow=mat("bar_glow", lin("#ff9d00"), 0, 0.4, em=lin("#ff9d00"), strength=2.0),
    eye=mat("barrier_eye", lin("#ff6a1a"), 0, 0.3, em=lin("#ff6a1a"), strength=2.0),
    field=mat("barrier_field", lin("#ff9d00"), 0, 0.5, em=lin("#ff9d00"), strength=1.0),
)
hz = tmat("bar_hazard", kit.surface("bar_hazard_base", "#d39a12", 414, chip=0.6, rust_amt=0.4, ribs=6, dirt=0.5))

root = empty(NAME, None)

# ---- pod: armoured body with a yellow dorsal plate, a hazard band and a sensor head
pod = empty("pod", root, t3(0, 0.0, 0))
tbox("pod_core", 0, 0, 0, 4.6, 2.6, 5.8, M["gun"], pod, bev=0.25)
tbox("pod_top", 0, 1.55, -0.3, 3.6, 0.6, 4.6, M["paint"], pod, bev=0.15)
tbox("pod_keel", 0, -1.55, 0.2, 2.4, 0.6, 4.2, M["gun"], pod, bev=0.12)
tbox("pod_band", 0, 0.2, 2.92, 4.3, 0.7, 0.12, hz, pod)
for sx in (-1, 1):
    tbox(f"pod_cheek_{sx}", sx * 2.45, 0.1, 0, 0.35, 1.8, 4.6, M["steel"], pod, bev=0.06)
    for k in range(3):
        tbox(f"pod_vent_{sx}_{k}", sx * 2.66, 0.1, -1.2 + k * 1.1, 0.12, 1.2, 0.5, M["dark"], pod)
    # antenna mast
    cyl(f"pod_mast_{sx}", t3(sx * 1.2, 2.5, -1.8), 0.06, 1.8, M["steel"], pod, seg=6)
# sensor head on the nose (+z, facing the incoming ship)
eye = empty("eye", pod, t3(0, 0.1, 3.0))
cyl("eye_housing", t3(0, 0, 0.45), 0.85, 0.9, M["gun"], eye, axis="Y", seg=16, bev=0.05)
cyl("eye_lens", t3(0, 0, 0.93), 0.5, 0.08, M["eye"], eye, axis="Y", seg=16)
torus("eye_rim", t3(0, 0, 0.92), 0.62, 0.08, M["steel"], eye, axis="Y", seg=20, rseg=6)
# ducted lift fans under the pod
for s, sx in (("l", -1), ("r", 1)):
    torus(f"duct_{s}", t3(sx * 1.4, -1.9, -0.6), 0.95, 0.18, M["gun"], pod, axis="Z", seg=20, rseg=6)
    fan = empty(f"fan_{s}", pod, t3(sx * 1.4, -1.9, -0.6))
    cyl(f"fan_{s}_hub", (0, 0, 0), 0.22, 0.3, M["steel"], fan, seg=10)
    for k in range(5):
        a = 2 * pi * k / 5
        o = box(f"fan_{s}_blade{k}", (0.45 * cos(a), 0.45 * sin(a), 0), (0.62, 0.16, 0.04),
                M["steel"], fan, bev=0, rot=(radians(18), 0, a))
    cyl(f"fan_{s}_glow", t3(sx * 1.4, -2.0, -0.6), 0.7, 0.02, M["glow"], pod, seg=16)

# ---- arms: twin truss booms out to the pylons, sagging slightly, with a hazard collar
PX = 14.6
for sx in (-1, 1):
    for dy in (0.55, -0.55):
        strut(f"boom_{sx}_{dy}", (sx * 2.3, dy, 0), (sx * (PX - 0.6), dy - 0.4, 0), 0.45, 0.45, M["gun"], root)
    for k in range(5):
        x0 = sx * (3.0 + k * 2.2)
        strut(f"brace_{sx}_{k}", (x0, 0.55 - 0.03 * k, 0), (x0 + sx * 2.2, -0.55 - 0.03 * k, 0), 0.18, 0.18, M["steel"], root)
    tbox(f"collar_{sx}", sx * 3.1, 0, 0, 0.6, 1.6, 1.2, hz, root, bev=0.05)
    # emitter pylon: tall armoured blade with an inner glowing strip facing the field
    tbox(f"pylon_{sx}", sx * PX, 0, 0, 1.3, 13.4, 1.8, M["gun"], root, bev=0.12)
    tbox(f"pylon_{sx}_paint", sx * (PX + 0.1), 4.4, 0, 1.36, 3.2, 1.84, M["paint"], root, bev=0.1)
    tbox(f"pylon_{sx}_haz", sx * (PX + 0.1), -4.6, 0, 1.36, 2.4, 1.84, hz, root, bev=0.1)
    tbox(f"pylon_{sx}_strip", sx * (PX - 0.68), 0, 0, 0.08, 12.0, 0.36, M["glow"], root)
    for k in range(4):
        tbox(f"pylon_{sx}_node{k}", sx * (PX - 0.75), -4.5 + k * 3.0, 0, 0.3, 0.7, 0.9, M["steel"], root, bev=0.04)
    cyl(f"pylon_{sx}_cap", t3(sx * PX, 6.9, 0), 0.5, 0.4, M["steel"], root, seg=10)
    empty(f"beacon_{'lr'[sx > 0]}", root, t3(sx * PX, 7.3, 0))
    # small stabiliser thruster on each pylon foot
    cyl(f"pylon_{sx}_thruster", t3(sx * PX, -7.1, 0), 0.45, 0.6, M["dark"], root, seg=10, r2=0.3)

# ---- the field (the app replaces its material with the energy shader)
plane("field", t3(0, 0, 0), 2 * (PX - 0.75), 12.0, M["field"], root)

if "preview" in ARGS:
    w = bpy.data.worlds.new("w")
    kit.sc.world = w
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#1a2940"), 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    sun = bpy.data.objects.new("_sun", bpy.data.lights.new("_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (radians(50), 0, radians(30))
    kit.sc.collection.objects.link(sun)
    cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
    kit.sc.collection.objects.link(cam)
    aim = empty("_aim", None, t3(0, 0, 0))
    cam.constraints.new("TRACK_TO").target = aim
    kit.sc.camera = cam
    kit.sc.render.engine = "BLENDER_EEVEE_NEXT"
    kit.sc.eevee.taa_render_samples = 16
    kit.sc.render.resolution_x, kit.sc.render.resolution_y = 960, 540
    kit.sc.view_settings.view_transform = "AgX"
    for nm, loc, at, lens in (("three-quarter", t3(20, 7, 30), t3(0, 0, 0), 35), ("pod", t3(5, 2.5, 9), t3(0, 0, 0.5), 35)):
        cam.location, aim.location, cam.data.lens = loc, at, lens
        kit.render(os.path.join(OUT, "previews", f"barrier-{nm}.png"))

kit.export(root, os.path.join(OUT, f"{NAME}.glb"), os.path.join(OUT, f"{NAME}.blend"))
