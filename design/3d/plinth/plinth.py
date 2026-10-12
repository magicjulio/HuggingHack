# Scan plinth (ch1.scan-plinth) — the small table under the scorer where the player lays a flag to be scanned.
# Headless: blender -b --factory-startup -P design/3d/plinth/plinth.py  -> ch1-scan-plinth.glb, plinth.blend, previews/
# Blender Z up, front faces -Y (= glTF +Z). Origin = base centre on the floor. Pad top at ~0.93 m.
# Glowing mesh: `screen` (the scan pad, material `screen`) — the app drives it like the station screens.
import bpy, bmesh, math, os
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.name = "plinth"
TILT = rad(12)  # top leans toward the player


def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


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


M = {  # same family as the scorer (scorer_hull / plate / trim)
    "hull": mat("scorer_hull", lin("#0d1117"), 0.85, 0.34),
    "plate": mat("scorer_plate", lin("#1a1f28"), 0.8, 0.42),
    "trim": mat("scorer_trim", lin("#8a94a3"), 1.0, 0.22),
    "core": mat("scorer_core", lin("#05070a"), 0.4, 0.7),
    "screen": mat("screen", lin("#04121a"), 0.0, 0.3, em=lin("#38d8ff"), strength=0.6),
    "accent": mat("plinth_accent", lin("#04121a"), 0.0, 0.4, em=lin("#38d8ff"), strength=1.5),
}


def box(name, center, size, material, parent=None, bev=0.004, seg=2):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    sc.collection.objects.link(o)
    o.location = center
    o.parent = parent
    me.materials.append(material)
    if bev:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width, m.segments, m.limit_method, m.harden_normals = bev, seg, "ANGLE", True
    return o


root = bpy.data.objects.new("scan_plinth", None)
sc.collection.objects.link(root)

# foot + column (tapered by stacking two blocks), trim strips and a thin cyan accent line
box("foot", (0, 0, 0.025), (0.62, 0.50, 0.05), M["hull"], root, 0.006, 3)
box("foot_step", (0, 0, 0.065), (0.50, 0.40, 0.03), M["plate"], root, 0.004)
box("column", (0, 0.02, 0.46), (0.34, 0.28, 0.78), M["plate"], root, 0.006, 3)
for x in (-0.13, 0.13):
    box(f"column_trim_{'l' if x < 0 else 'r'}", (x, -0.124, 0.46), (0.018, 0.012, 0.72), M["trim"], root, 0.002)
box("column_accent", (0, -0.122, 0.46), (0.006, 0.006, 0.66), M["accent"], root, 0)
box("column_panel", (0, -0.122, 0.20), (0.18, 0.008, 0.16), M["hull"], root, 0.002)

# tilted top: slab, recessed glowing scan pad, bright frame, corner clamps, return slot at the back
top = bpy.data.objects.new("top", None)
sc.collection.objects.link(top)
top.parent = root
top.location = (0, 0, 0.88)
top.rotation_euler = (TILT, 0, 0)
box("top_slab", (0, 0, 0.0), (0.60, 0.46, 0.06), M["hull"], top, 0.008, 3)
box("pad_frame", (0, -0.02, 0.031), (0.44, 0.30, 0.012), M["trim"], top, 0.002)
box("pad_well", (0, -0.02, 0.034), (0.40, 0.26, 0.012), M["core"], top, 0.0)
box("screen", (0, -0.02, 0.039), (0.38, 0.24, 0.004), M["screen"], top, 0.0)
for i, (x, y) in enumerate([(-0.205, -0.155), (0.205, -0.155), (-0.205, 0.115), (0.205, 0.115)]):
    box(f"clamp_{i}", (x, y, 0.042), (0.04, 0.04, 0.016), M["plate"], top, 0.003)
box("slot_lip", (0, 0.185, 0.034), (0.36, 0.05, 0.012), M["trim"], top, 0.002)
box("slot", (0, 0.185, 0.04), (0.32, 0.018, 0.006), M["core"], top, 0.0)

# preview stage (not exported)
w = bpy.data.worlds.new("w")
sc.world = w
w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (*lin("#05080e"), 1)


def light(name, kind, loc, energy, color=(1, 1, 1), size=1.0):
    d = bpy.data.lights.new(name, kind)
    d.energy, d.color = energy, color
    if kind == "AREA":
        d.size = size
    o = bpy.data.objects.new(name, d)
    o.location = loc
    sc.collection.objects.link(o)
    t = o.constraints.new("TRACK_TO")
    t.target = top
    return o


light("key", "AREA", (-1.6, -1.8, 2.2), 160, (0.85, 0.92, 1.0), 1.5)
light("rim", "AREA", (1.3, 1.4, 1.6), 120, lin("#38d8ff"), 1.0)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
sc.collection.objects.link(cam)
cam.location = (-1.25, -2.0, 1.55)
cam.data.lens = 50
t = cam.constraints.new("TRACK_TO")
t.target = bpy.data.objects["column"]
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

os.makedirs(os.path.join(OUT, "previews"), exist_ok=True)
sc.render.filepath = os.path.join(OUT, "previews", "plinth.png")
bpy.ops.render.render(write_still=True)

for o in sc.objects:
    o.select_set(o.type in ("MESH", "EMPTY"))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "ch1-scan-plinth.glb"), export_format="GLB", use_selection=True,
                          export_apply=True, export_yup=True, export_lights=False, export_cameras=False)
bpy.context.preferences.filepaths.save_version = 0  # no .blend1 backups
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "plinth.blend"))
