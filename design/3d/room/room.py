# Room shell (ch1.room) — the closed training room: panelled walls, cable trays, floor with path inlays, ceiling beams,
# ceiling lamp housing and the sealed door. Stations, depot, plinth and scorer are separate .glb files placed by the app.
# Headless: blender -b --factory-startup -P design/3d/room/room.py -> ch1-room.glb, room.blend, previews/
# Coordinates match app/src/levels/ch1/layout.ts after glTF conversion (three x = x, three y = z, three z = -y):
#   room x -6..6, three z -5..5 (Blender y 5..-5), height 3.6. Back wall = three z -5. Origin = room centre on the floor.
# Nodes:
#   floor_path_1..5   glowing floor inlay from the desk to station n; own material `floor_path_n` (0 = off).
#                     Light the path when station n wakes up, dim it when it is done. The guide for "discovering".
#   base_glow         thin strip along the bottom of all walls, material `base_glow` (room "power", 0 in the dark intro)
#   ceiling_lamp      emissive panel in the lamp housing, material `ceiling_lamp` (steady / flicker in code)
#   door_leaf         the sealed door panel (never opens in ch1); `door_lock` red lamp material
# Preview only (not exported): every prop .glb placed at the proposed layout (see STATIONS below).
import bpy, os, sys
import numpy as np
from math import radians as rad, pi

OUT = os.path.dirname(os.path.abspath(__file__))
D3 = os.path.join(OUT, "..")
sys.path.insert(0, os.path.join(D3, "lib"))
import kit
from kit import *

kit.reset("room", OUT)
M = station_materials()
M["wall"] = tmat("room_wall", surface("room_wall", "#1d222a", 201, chip=0.78, rust_amt=0.4, metal=0.5, rough=0.55, dirt=0.5, panel=1))
M["floor"] = tmat("room_floor", surface("room_floor", "#14171c", 202, chip=0.8, rust_amt=0.3, metal=0.6, rough=0.5, dirt=0.6, panel=2))
M["ceil"] = mat("room_ceiling", lin("#07090c"), 0.3, 0.8)
M["base_glow"] = mat("base_glow", lin("#04121a"), 0.0, 0.4, em=lin("#38d8ff"), strength=0.0)
M["lamp"] = mat("ceiling_lamp", lin("#111111"), 0.0, 0.4, em=lin("#e8f4ff"), strength=0.0)
M["lock"] = mat("door_lock", lin("#1a0404"), 0.0, 0.4, em=lin("#ff3b4e"), strength=2.5)
M["door"] = tmat("room_door", surface("room_door", "#3a3d42", 203, chip=0.7, rust_amt=0.7, metal=0.6, rough=0.5, dirt=0.5, ribs=10))
PATHM = [mat(f"floor_path_{n}", lin("#04121a"), 0.0, 0.4, em=lin("#38d8ff"), strength=0.0) for n in range(1, 6)]

X0, X1, Y0, Y1, H = -6.0, 6.0, -5.0, 5.0, 3.6
T = 0.2   # wall thickness (outside the room)
root = empty("room", None)

# ---------------------------------------------------------------- floor, ceiling, walls (inner faces at the room bounds)
kit.UVS = 0.5
box("floor", (0, 0, -0.05), (X1 - X0, Y1 - Y0, 0.1), M["floor"], root, 0)
kit.UVS = 0.42
box("wall_back", (0, Y1 + T / 2, H / 2), (X1 - X0 + 2 * T, T, H), M["wall"], root, 0)
box("wall_front", (0, Y0 - T / 2, H / 2), (X1 - X0 + 2 * T, T, H), M["wall"], root, 0)
box("wall_left", (X0 - T / 2, 0, H / 2), (T, Y1 - Y0, H), M["wall"], root, 0)
# right wall with a door opening at three z = -1.5 (Blender y = 1.5), 1.4 wide, 2.5 high
DY, DW, DH = 1.5, 1.4, 2.5
box("wall_right_a", (X1 + T / 2, (Y0 + DY - DW / 2) / 2, H / 2), (T, DY - DW / 2 - Y0, H), M["wall"], root, 0)
box("wall_right_b", (X1 + T / 2, (DY + DW / 2 + Y1) / 2, H / 2), (T, Y1 - DY - DW / 2, H), M["wall"], root, 0)
box("wall_right_c", (X1 + T / 2, DY, (DH + H) / 2), (T, DW, H - DH), M["wall"], root, 0)
kit.UVS = 0.8
box("ceiling", (0, 0, H + 0.05), (X1 - X0, Y1 - Y0, 0.1), M["ceil"], root, 0)

# baseboard + glow strip, ribs, cable tray on every wall
def along_walls(fn):
    fn("back", (0, Y1), (1, 0), X1 - X0)
    fn("front", (0, Y0), (1, 0), X1 - X0)
    fn("left", (X0, 0), (0, 1), Y1 - Y0)
    fn("right", (X1, 0), (0, 1), Y1 - Y0)

def trim(name, c, d, L):
    nx, ny = (0, -1 if c[1] > 0 else 1) if d[0] else (1 if c[0] < 0 else -1, 0)
    sx, sy = (L, 0.05) if d[0] else (0.05, L)
    box(f"base_{name}", (c[0] + nx * 0.025, c[1] + ny * 0.025, 0.06), (sx, sy, 0.12), M["gun"], root, 0.004)
    box(f"base_glow_{name}", (c[0] + nx * 0.052, c[1] + ny * 0.052, 0.13), (sx if d[0] else 0.006, 0.006 if d[0] else sy, 0.012), M["base_glow"], root, 0)
    # cable tray at 3.1 m
    box(f"tray_{name}", (c[0] + nx * 0.12, c[1] + ny * 0.12, 3.12), (sx if d[0] else 0.2, 0.2 if d[0] else sy, 0.03), M["steel"], root, 0.004)
    box(f"tray_lip_{name}", (c[0] + nx * 0.22, c[1] + ny * 0.22, 3.17), (sx if d[0] else 0.012, 0.012 if d[0] else sy, 0.08), M["steel"], root, 0.002)
    for k in range(3):  # cable bundle lying in the tray
        off = 0.06 + k * 0.045
        cyl(f"tray_cable_{name}", (c[0] + nx * off, c[1] + ny * off, 3.155), 0.018, L - 0.1, M["rubber"], root, "X" if d[0] else "Y", 8)
    # ribs every 2 m
    n = int(L // 2)
    for i in range(1, n + (1 if L % 2 else 0)):
        t = -L / 2 + i * 2.0
        p = (t, c[1]) if d[0] else (c[0], t)
        box(f"rib_{name}", (p[0] + nx * 0.04, p[1] + ny * 0.04, H / 2), (0.14 if d[0] else 0.08, 0.08 if d[0] else 0.14, H), M["gun"], root, 0.006)

along_walls(trim)

# ceiling beams + lamp housing in the middle (three CEILING_LAMP = [0, 3.55, 0])
for x in (-4, -2, 2, 4):
    box("beam", (x, 0, H - 0.12), (0.18, Y1 - Y0, 0.24), M["gun"], root, 0.006)
box("lamp_housing", (0, 0, H - 0.08), (1.5, 0.55, 0.16), M["gun"], root, 0.01)
box("lamp_well", (0, 0, H - 0.165), (1.3, 0.36, 0.01), M["core"], root, 0)
box("ceiling_lamp", (0, 0, H - 0.168), (1.2, 0.3, 0.006), M["lamp"], root, 0)
for x in (-0.65, 0.65):
    box("lamp_cage", (x, 0, H - 0.2), (0.02, 0.4, 0.06), M["trim"], root, 0.002)
for y in (-0.15, 0.0, 0.15):
    box("lamp_bar", (0, y, H - 0.215), (1.32, 0.012, 0.012), M["trim"], root, 0)

# sealed door in the right wall opening (faces -X into the room)
dr = empty("door", root, (X1, DY, 0))
box("door_frame_t", (-0.06, 0, DH + 0.08), (0.14, DW + 0.32, 0.16), M["gun"], dr, 0.01)
for s in (-1, 1):
    box("door_frame_s", (-0.06, s * (DW / 2 + 0.08), DH / 2), (0.14, 0.16, DH), M["gun"], dr, 0.01)
    hz = hazard(f"door_hazard_{'l' if s < 0 else 'r'}", (-0.135, s * (DW / 2 + 0.08), DH / 2), DH - 0.1, 0.12, M["hazard_y"], M["ink"], dr, n=12)
    hz.rotation_euler = (0, rad(90), rad(90))
leaf = empty("door_leaf", dr, (0.05, 0, 0))
box("door_panel", (0, 0, DH / 2), (0.1, DW, DH), M["door"], leaf, 0.012)
box("door_seam", (-0.052, 0, DH / 2), (0.006, 0.012, DH - 0.1), M["core"], leaf, 0)
for z in (0.7, 1.8):
    box("door_bar", (-0.07, 0, z), (0.04, DW - 0.1, 0.12), M["steel"], leaf, 0.006)
box("door_window", (-0.055, 0, 1.6), (0.01, 0.3, 0.4), M["core"], leaf, 0.004)
box("door_lockbox", (-0.09, -DW / 2 - 0.25, 1.2), (0.08, 0.18, 0.28), M["gun"], dr, 0.008)
box("door_lock", (-0.132, -DW / 2 - 0.25, 1.28), (0.006, 0.08, 0.04), M["lock"], dr, 0)
text("door_stencil", "NO EXIT", 0.1, (-0.106, 0, 1.25), M["stencil"], leaf, rot=(rad(90), 0, rad(-90)))

# floor path inlays: desk (three [0, *, 0.6] -> Blender (0, -0.6)) to each station front
STATIONS = {  # three x, three z, rotY  (proposal: spread around the room)
    1: (-3.2, -5.0, 0.0),
    2: (-3.5, 5.0, pi),
    3: (3.2, -5.0, 0.0),
    4: (3.0, 5.0, pi),
    5: (0.0, -5.0, 0.0),
}
PATHS = {  # Blender (x, y) polylines
    1: [(-0.5, 0.0), (-0.5, 1.6), (-3.2, 1.6), (-3.2, 4.0)],
    5: [(0.0, 0.0), (0.0, 4.0)],
    3: [(0.5, 0.0), (0.5, 1.6), (3.2, 1.6), (3.2, 4.4)],
    2: [(-0.5, -1.2), (-0.5, -2.6), (-3.5, -2.6), (-3.5, -4.0)],
    4: [(0.5, -1.2), (0.5, -2.6), (3.0, -2.6), (3.0, -4.0)],
}
for n, pts in PATHS.items():
    g = empty(f"floor_path_{n}", root)
    for (ax, ay), (bx, by) in zip(pts, pts[1:]):
        cx, cy = (ax + bx) / 2, (ay + by) / 2
        sx, sy = abs(bx - ax) + 0.05, abs(by - ay) + 0.05
        box(f"path_{n}_seg", (cx, cy, 0.002), (max(sx, 0.05), max(sy, 0.05), 0.006), PATHM[n - 1], g, 0)
    ex, ey = pts[-1]
    box(f"path_{n}_pad", (ex, ey, 0.002), (0.3, 0.3, 0.006), PATHM[n - 1], g, 0)

# ---------------------------------------------------------------- export the shell before placing preview props
export(root, os.path.join(OUT, "ch1-room.glb"), os.path.join(OUT, "room.blend"))

# ---------------------------------------------------------------- preview: all props at the proposed layout
def place(path, name, three_x, three_z, roty, y=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    top = [o for o in new if o.parent is None]
    holder = empty("_" + name, None, (three_x, -three_z, y), (0, 0, roty))
    for o in top:
        o.parent = holder
    return holder

ST = os.path.join(D3, "stations")
SCREENS = {}
for n, (x, z, ry) in STATIONS.items():
    h = place(os.path.join(ST, f"ch1-station-{n}.glb"), f"s{n}", x, z, ry)
    SCREENS[n] = {o.active_material for o in h.children_recursive if o.type == "MESH" and o.name.startswith(("screen", "bulb"))}
place(os.path.join(D3, "depot", "ch1-depot.glb"), "depot", -5.75, 0.4, -pi / 2)
place(os.path.join(D3, "plinth", "ch1-scan-plinth.glb"), "plinth", 5.4, 2.0, pi / 2)
place(os.path.join(D3, "scorer", "ch1-scorer.glb"), "scorer", 5.4, 2.0, pi / 2, 2.5)
# desk greybox stand-in
box("_desk", (0, -0.6, 0.37), (1.6, 0.8, 0.74), M["gun"], None, 0.01)
box("_paper", (0, -0.6, 0.745), (0.3, 0.42, 0.004), mat("_paper", lin("#e8eef8"), 0.0, 0.6, em=lin("#ffffff"), strength=0.6), None, 0)

w = bpy.data.worlds.new("w")
kit.sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
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

def spot(name, loc, target, energy, color=(0.9, 0.95, 1.0), angle=50):
    d = bpy.data.lights.new(name, "SPOT")
    d.energy, d.color, d.spot_size, d.spot_blend = energy, color, rad(angle), 0.6
    o = bpy.data.objects.new(name, d)
    o.location = loc
    kit.sc.collection.objects.link(o)
    t = empty(name + "_t", None, target)
    o.constraints.new("TRACK_TO").target = t
    return o

LIGHTS = {}
LIGHTS["desk"] = spot("_l_desk", (0, -0.4, 3.3), (0, -0.6, 0.7), 300)
for n, (x, z, ry) in STATIONS.items():
    fy = -z - (0.9 if z < 0 else -0.9)
    LIGHTS[n] = spot(f"_l_s{n}", (x, -z + (-1.3 if z < 0 else 1.3), 3.3), (x, -z + (-0.4 if z < 0 else 0.4), 1.2), 450, (0.8, 0.92, 1.0), 60)
LIGHTS["depot"] = spot("_l_depot", (-4.6, -0.4, 3.3), (-5.8, -0.4, 1.5), 350, (1.0, 0.85, 0.7))
LIGHTS["plinth"] = spot("_l_plinth", (4.3, -2.0, 3.3), (5.4, -2.0, 1.2), 300)
amb = bpy.data.lights.new("_amb", "AREA"); amb.size = 8; amb.energy = 0
ao = bpy.data.objects.new("_amb", amb); ao.location = (0, 0, H - 0.3); kit.sc.collection.objects.link(ao)

cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam"))
kit.sc.collection.objects.link(cam)
kit.sc.camera = cam
aim = empty("_aim", None, (0, 1.5, 1.0))
cam.constraints.new("TRACK_TO").target = aim
os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)

def shot(fname, lit, paths=(), lamp=0.0, base=0.0, ambient=0, cam_loc=(0, -4.6, 1.65), aim_loc=(0, 3.0, 1.2), lens=20):
    for k, l in LIGHTS.items():
        l.hide_render = k not in lit
    for n in range(1, 6):
        emission(PATHM[n - 1], paths.get(n, 0.0) if isinstance(paths, dict) else 0.0)
    for n, mats in SCREENS.items():  # dormant stations: screen + header strip fully dark
        for m in mats:
            on = n in lit
            emission(m, (0.9 if m.name.startswith("screen") else 2.5) if on else 0.0)
    emission(M["lamp"], lamp); emission(M["base_glow"], base)
    amb.energy = ambient
    cam.location, aim.location, cam.data.lens = cam_loc, aim_loc, lens
    kit.sc.render.filepath = os.path.join(OUT, "previews", fname)
    bpy.ops.render.render(write_still=True)

# 1) overview, everything lit (the "lights on" look the engineer has now, for reference)
for nm in ("wall_front", "ceiling", "beam", "tray_front", "tray_lip_front", "rib_front", "base_front", "tray_cable_front"):
    for o in bpy.data.objects:
        if o.name.startswith(nm):
            o.hide_render = True
shot("room-overview.png", lit=list(LIGHTS), lamp=3.0, base=1.5, ambient=2500, cam_loc=(0, -11.5, 7.5), aim_loc=(0, 0.3, 0.4), lens=24)
for o in bpy.data.objects:
    o.hide_render = o.name.startswith("_l_") and o.hide_render
# 2) discovery beat: dark room, only the desk + station 1 awake, path 1 glowing
shot("room-discover-s1.png", lit=["desk", 1], paths={1: 2.5}, base=0.3, ambient=0)
# 3) later beat: station 3 awake (s1, s2 done/dimmed), path 3 glowing, depot faint
shot("room-discover-s3.png", lit=["desk", 3, "depot"], paths={1: 0.2, 3: 2.5}, base=0.3, ambient=0)
# 4) turning round: station 2 behind the player
shot("room-discover-s2.png", lit=["desk", 2], paths={2: 2.5, 1: 0.2}, base=0.3, ambient=0,
     cam_loc=(0, 3.0, 1.65), aim_loc=(-1.5, -4.0, 1.1), lens=20)
