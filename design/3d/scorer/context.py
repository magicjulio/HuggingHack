# Context render: the scorer eye in its real spot (app pose) with the room, plinth and nearby props.
# blender -b --factory-startup -P design/3d/scorer/context.py -- [scorer.glb] [out.png]
import bpy, os, sys
from math import radians as rad, pi
OUT = os.path.dirname(os.path.abspath(__file__))
D3 = os.path.join(OUT, "..")
sys.path.insert(0, os.path.join(D3, "lib"))
import kit
from kit import *
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SC = argv[0] if argv else os.path.join(OUT, "ch1-scorer.glb")
PNG = argv[1] if len(argv) > 1 else os.path.join(OUT, "previews", "scorer-in-room.png")
kit.reset("ctx", os.path.join(D3, "room"))

def place(path, three_pos, roty=0.0):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    h = empty("_h", None, (three_pos[0], -three_pos[2], three_pos[1]), (0, 0, roty))
    for o in bpy.data.objects:
        if o not in before and o.parent is None and o is not h:
            o.parent = h
    return h

place(os.path.join(D3, "room", "ch1-room.glb"), (0, 0, 0))
place(os.path.join(D3, "plinth", "ch1-scan-plinth.glb"), (5.4, 0, 2.0), -pi / 2)
place(SC, (5.4, 2.5, 2.0))                       # app: no rotation, eye.lookAt(player)
place(os.path.join(D3, "stations", "ch1-station-4.glb"), (3.0, 0, 5.0), pi)
place(os.path.join(D3, "stations", "ch1-station-3.glb"), (3.2, 0, -5.0), 0)
place(os.path.join(D3, "desk", "ch1-desk.glb"), (0, 0, 0.6))
# the eye looks at the camera; state green; lamp + base glow as after the paper
cam_three = (2.7, 1.65, 3.7)
eye = bpy.data.objects.get("eye")
if eye:
    t = empty("_look", None, (cam_three[0], -cam_three[2], cam_three[1]))
    c = eye.constraints.new("TRACK_TO"); c.target = t; c.track_axis = "TRACK_NEGATIVE_Y"; c.up_axis = "UP_Z"
for m in bpy.data.materials:
    if not m.use_nodes or "Principled BSDF" not in m.node_tree.nodes: continue
    b = m.node_tree.nodes["Principled BSDF"]; n = m.name.split(".")[0]
    if n == "bulb":
        b.inputs["Emission Color"].default_value = (*lin("#39ff9c"), 1); b.inputs["Emission Strength"].default_value = 3.0
    elif n.startswith("tick_"):
        b.inputs["Emission Color"].default_value = (*lin("#38d8ff"), 1); b.inputs["Emission Strength"].default_value = 4.0 if n in ("tick_1", "tick_2") else 0
    elif n in ("base_glow", "door_lock", "screen", "desk_edge"):
        b.inputs["Emission Strength"].default_value = {"base_glow": 0.6, "door_lock": 2.5, "screen": 0.0, "desk_edge": 0.5}[n]
    elif n in ("ceiling_lamp", "paper_glow", "desk_lamp", "marquee", "gun_glow", "counter", "cartridge_glow") or n.startswith(("floor_path", "socket_led", "rack_led", "pipe_flow", "cap_glow")):
        b.inputs["Emission Strength"].default_value = 0.0
w = bpy.data.worlds.new("w"); kit.sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0, 0, 0, 1)
def spot(loc, tgt, e, col=(0.86, 0.92, 1.0), ang=55):
    d = bpy.data.lights.new("s", "SPOT"); d.energy, d.color, d.spot_size, d.spot_blend = e, col, rad(ang), 0.6
    o = bpy.data.objects.new("s", d); o.location = loc; kit.sc.collection.objects.link(o)
    o.constraints.new("TRACK_TO").target = empty("_t", None, tgt)
spot((4.3, -2.0, 3.3), (5.4, -2.0, 1.0), 260)            # plinth spot
g = bpy.data.lights.new("g", "POINT"); g.energy, g.color = 25, lin("#39ff9c")
go = bpy.data.objects.new("g", g); go.location = (5.0, -2.0, 2.45); kit.sc.collection.objects.link(go)
a = bpy.data.lights.new("a", "AREA"); a.size, a.energy = 8, float(argv[2]) if len(argv) > 2 else 120
ao = bpy.data.objects.new("a", a); ao.location = (0, 0, 3.3); kit.sc.collection.objects.link(ao)
cam = bpy.data.objects.new("_cam", bpy.data.cameras.new("_cam")); kit.sc.collection.objects.link(cam)
cam.location = (cam_three[0], -cam_three[2], cam_three[1]); cam.data.lens = 26
cam.constraints.new("TRACK_TO").target = empty("_aim", None, (5.4, -1.6, 1.85))
kit.sc.camera = cam
kit.sc.render.engine = "BLENDER_EEVEE_NEXT"; kit.sc.eevee.taa_render_samples = 32
kit.sc.render.resolution_x, kit.sc.render.resolution_y = 1280, 800
kit.sc.view_settings.view_transform = "AgX"; kit.sc.view_settings.look = "AgX - Medium High Contrast"
kit.sc.use_nodes = True
nt = kit.sc.node_tree
for nd in list(nt.nodes): nt.nodes.remove(nd)
rl, gl, co = nt.nodes.new("CompositorNodeRLayers"), nt.nodes.new("CompositorNodeGlare"), nt.nodes.new("CompositorNodeComposite")
gl.glare_type, gl.threshold, gl.size, gl.mix = "BLOOM", 1.0, 6, -0.3
nt.links.new(rl.outputs[0], gl.inputs[0]); nt.links.new(gl.outputs[0], co.inputs[0])
os.makedirs(os.path.dirname(PNG), exist_ok=True)
kit.sc.render.filepath = PNG
bpy.ops.render.render(write_still=True)
