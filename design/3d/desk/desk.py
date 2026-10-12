# Prompt desk + paper (ch1.desk) — minimal: a waterfall slab desk in the station metal family but clean (no rust), a
# glowing inlay slot the paper lies on, and a slim lamp bar over it: the first light in the dark room.
# Headless: blender -b --factory-startup -P design/3d/desk/desk.py -> ch1-desk.glb, desk.blend, previews/
# Origin = floor centre under the desk (three [0, 0, 0.6] in layout.ts). Front = -Y (glTF +Z) = the side the player
# starts on. Top at 0.74 m, 1.6 x 0.8 like the greybox.
# Nodes:
#   paper        the prompt sheet (A4-ish 0.24 x 0.33, slight curl), material `paper`, UV 0..1 -> put the prompt
#                text on it as a texture (the full text still opens in the paper window)
#   paper_glow   inlay under/around the paper, material `paper_glow` (cyan; on while the paper is unread)
#   desk_edge    thin light line under the front edge, material `desk_edge` (the desk's "power" glow)
#   lamp_bar     emissive bar of the lamp, material `desk_lamp`; `light_anchor` = where the desk spotlight sits
import bpy, bmesh, os, sys
import numpy as np
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("desk", OUT)
M = station_materials()
M["clean"] = mat("desk_metal", lin("#1b2027"), 0.75, 0.36)
M["top"] = mat("desk_top", lin("#111419"), 0.35, 0.58)
M["paper"] = mat("paper", lin("#cfd5dd"), 0.0, 0.85)
M["paper_glow"] = mat("paper_glow", lin("#04121a"), 0.0, 0.4, em=lin("#38d8ff"), strength=3.0)
M["edge"] = mat("desk_edge", lin("#04121a"), 0.0, 0.4, em=lin("#38d8ff"), strength=1.5)
M["lamp"] = mat("desk_lamp", lin("#111111"), 0.0, 0.3, em=lin("#eaf3ff"), strength=6.0)

root = empty("desk", None)
W, D, H, T = 1.6, 0.8, 0.74, 0.045   # width, depth, top height, slab thickness

# ---------------------------------------------------------------- waterfall slab: top + two side slabs, recessed back panel
box("top", (0, 0, H - T / 2), (W, D, T), M["top"], root, 0.006, 3)
for s in (-1, 1):
    box("leg", (s * (W / 2 - T / 2), 0, (H - T) / 2), (T, D, H - T), M["clean"], root, 0.006, 3)
    box("leg_trim", (s * (W / 2 + 0.001), 0, (H - T) / 2), (0.004, D - 0.12, 0.012), M["trim"], root, 0)
box("modesty", (0, D / 2 - 0.12, 0.42), (W - 2 * T, 0.02, 0.5), M["clean"], root, 0.004)
# front edge: a hairline glow tucked under the lip
box("desk_edge", (0, -D / 2 + 0.03, H - T - 0.004), (W - 0.2, 0.012, 0.006), M["edge"], root, 0)
# paper inlay: shallow recessed slot with a light line around it
PX, PY, PR = 0.0, -0.05, rad(-8.6)   # matches the greybox paper (0.15 rad) in the room
slot = empty("paper_slot", root, (PX, PY, H))
slot.rotation_euler = (0, 0, PR)
box("slot_floor", (0, 0, 0.0006), (0.29, 0.38, 0.0012), M["core"], slot, 0)
for i, (cx, cy, sx, sy) in enumerate(((0, 0.193, 0.3, 0.005), (0, -0.193, 0.3, 0.005), (0.148, 0, 0.005, 0.38), (-0.148, 0, 0.005, 0.38))):
    box(f"paper_glow_{i}", (cx, cy, 0.0012), (sx, sy, 0.0024), M["paper_glow"], slot, 0)
# the paper: a slightly curled sheet (subdivided plane, edges lifted a few mm), UV 0..1, text side up
bm = bmesh.new()
uv = bm.loops.layers.uv.new()
nx, ny, PW, PL = 12, 16, 0.24, 0.33
vs = [[bm.verts.new(((i / nx - 0.5) * PW, (j / ny - 0.5) * PL, 0.0028 + 0.004 * ((i / nx - 0.5) * 2) ** 4 + 0.006 * max(0, j / ny - 0.85) / 0.15))
       for i in range(nx + 1)] for j in range(ny + 1)]
for j in range(ny):
    for i in range(nx):
        f = bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
        for l, (a, b) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
            l[uv].uv = (a / nx, b / ny)
paper = mesh_obj("paper", bm, M["paper"], slot, (0, 0, 0), uv=False)
for p in paper.data.polygons:
    p.use_smooth = True

# ---------------------------------------------------------------- lamp: one thin post at the back right, arm over the paper
LX, LH = 0.62, 0.52
box("lamp_foot", (LX, D / 2 - 0.1, H + 0.006), (0.12, 0.12, 0.012), M["clean"], root, 0.003)
cyl("lamp_post", (LX, D / 2 - 0.1, H + LH / 2), 0.009, LH, M["trim"], root, "Z", 12)
box("lamp_arm", ((LX + PX) / 2 + 0.05, D / 2 - 0.1, H + LH), (LX - PX + 0.1, 0.018, 0.018), M["trim"], root, 0.003)
box("lamp_head", (PX + 0.02, D / 2 - 0.1, H + LH - 0.015), (0.42, 0.05, 0.022), M["clean"], root, 0.004)
box("lamp_bar", (PX + 0.02, D / 2 - 0.1, H + LH - 0.028), (0.38, 0.02, 0.004), M["lamp"], root, 0)
empty("light_anchor", root, (PX + 0.02, D / 2 - 0.1, H + LH - 0.03), (0, 0, 0))

# ---------------------------------------------------------------- preview: prompt text on the paper, dark room, lamp as key
img = bpy.data.images.new("_prompt", 480, 660)
px = np.ones((660, 480, 4)); px[..., :3] = (0.91, 0.93, 0.95)
def line(y, x0, w, h=7, c=(0.12, 0.14, 0.18)):
    px[660 - y - h:660 - y, x0:x0 + w, :3] = c
line(40, 40, 260, 14); line(66, 40, 150, 6, (0.4, 0.45, 0.5))
for k, (y, w) in enumerate(((110, 380), (126, 350), (142, 300), (180, 120), (204, 390), (220, 340), (236, 380), (252, 210),
                            (290, 120), (314, 360), (330, 280), (366, 400), (382, 180))):
    line(y, 40, w, 10 if w == 120 else 6)
line(430, 40, 230, 8, (0.1, 0.55, 0.4))
img.pixels.foreach_set(px.ravel().astype(np.float32))
nt = M["paper"].node_tree
ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
nt.links.new(ti.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])

w = bpy.data.worlds.new("w"); kit.sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.002, 0.003, 0.005, 1)
fm = mat("_floor", lin("#0b0e14"), 0.4, 0.6)
box("_floor", (0, 0, -0.05), (8, 8, 0.1), fm, None, 0)
aim = empty("_aim", None, (0, 0.0, 0.6))
def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0, spot=None):
    d = bpy.data.lights.new(name, kind); d.energy, d.color = energy, color
    if kind == "AREA": d.size = size
    if spot: d.spot_size, d.spot_blend = rad(spot), 0.7
    o = bpy.data.objects.new(name, d); o.location = loc; kit.sc.collection.objects.link(o)
    o.constraints.new("TRACK_TO").target = aim
    return o
lamp_l = bpy.data.lights.new("_lamp", "AREA"); lamp_l.energy, lamp_l.size, lamp_l.color = 12, 0.38, (0.92, 0.96, 1.0)
lamp_l.shape, lamp_l.size_y = "RECTANGLE", 0.03
lo = bpy.data.objects.new("_lamp", lamp_l); lo.location = (PX + 0.02, D / 2 - 0.1, H + LH - 0.035); kit.sc.collection.objects.link(lo)
light("_spot", "SPOT", (0, -0.3, 3.3), 70, (0.9, 0.95, 1.0), spot=40)
rim = light("_rim", "AREA", (1.8, 1.6, 1.4), 60, lin("#38d8ff"), 1.0)
cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam")); kit.sc.collection.objects.link(cam)
cam.constraints.new("TRACK_TO").target = aim; kit.sc.camera = cam
kit.sc.render.engine = "BLENDER_EEVEE_NEXT"; kit.sc.eevee.taa_render_samples = 48
kit.sc.render.resolution_x, kit.sc.render.resolution_y = 1280, 800
kit.sc.view_settings.view_transform = "AgX"; kit.sc.view_settings.look = "AgX - Medium High Contrast"
kit.sc.use_nodes = True
cn = kit.sc.node_tree
for nd in list(cn.nodes): cn.nodes.remove(nd)
rl, gl, co = cn.nodes.new("CompositorNodeRLayers"), cn.nodes.new("CompositorNodeGlare"), cn.nodes.new("CompositorNodeComposite")
gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 1.0, 6, -0.3
cn.links.new(rl.outputs[0], gl.inputs[0]); cn.links.new(gl.outputs[0], co.inputs[0])
os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)
for name, loc, a in (("desk-wake", (-1.0, -2.4, 1.6), (0, 0.05, 0.8)), ("desk-close", (-0.35, -0.95, 1.45), (0, -0.05, 0.74))):
    cam.location = loc; aim.location = a
    kit.sc.render.filepath = os.path.join(OUT, "previews", name + ".png")
    bpy.ops.render.render(write_still=True)

nt.nodes.remove(ti)
export(root, os.path.join(OUT, "ch1-desk.glb"), os.path.join(OUT, "desk.blend"))
