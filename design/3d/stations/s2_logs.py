# Station 2 "Search" (ch1.station-2) — LOG RACK: a tall server rack with a portrait log screen where lines rain down.
# The search itself stays a terminal window (Julius); the rack is the in-room landmark.
# Headless: blender -b --factory-startup -P design/3d/stations/s2_logs.py -> ch1-station-2.glb, s2.blend, previews/
# Origin = floor point on the wall plane; front = -Y (glTF +Z).
# Nodes:
#   screen       0.78 x 1.25 m portrait, UV 0..1 (log rain canvas)
#   rack_leds    blinkenlight strips, material `rack_leds` (engineer flickers emissive / scrolls a texture)
#   grep_lens    articulated arm with a magnifier ring; hidden until `grep-lens` is installed, then swings in.
#                `lens_arm` rotates Z: +50 deg = parked beside the rack, -92 deg = lens in front of the screen.
#                Keep `lens` facing the room: lens.rotation.z = -lens_arm.rotation.z (glTF: rotation.y, same rule).
#                Lens rim material `lens_rim`, glass material `lens_glass` (transparent).
#   bulb, light_anchor  shared station header
import bpy, os, sys
import numpy as np
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("s2", OUT)
M = station_materials()
M["leds"] = mat("rack_leds", lin("#04140a"), 0.0, 0.3, em=lin("#39ff9c"), strength=2.0)
M["leds_c"] = mat("rack_leds_cyan", lin("#04121a"), 0.0, 0.3, em=lin("#38d8ff"), strength=1.5)
M["rim"] = mat("lens_rim", lin("#04121a"), 0.0, 0.3, em=lin("#38d8ff"), strength=2.5)
g = mat("lens_glass", lin("#9fe8ff"), 0.0, 0.05)
b = g.node_tree.nodes["Principled BSDF"]
b.inputs["Alpha"].default_value = 0.18
b.inputs["Transmission Weight"].default_value = 0.6
g.blend_method = "BLEND"
M["glass"] = g

root = empty("station_2", None)
W, DEP, H = 1.05, 0.7, 2.35

# ---------------------------------------------------------------- rack frame
for x in (-W / 2 + 0.04, W / 2 - 0.04):
    for y in (-0.06, -DEP + 0.04):
        box("post", (x, y, H / 2), (0.07, 0.07, H), M["steel"], root, 0.006)
box("rack_top", (0, -DEP / 2 - 0.01, H - 0.03), (W, DEP + 0.02, 0.06), M["gun"], root, 0.008)
box("rack_base", (0, -DEP / 2 - 0.01, 0.05), (W, DEP + 0.02, 0.1), M["rubber"], root, 0.008)
box("rack_back", (0, -0.03, H / 2), (W - 0.1, 0.04, H - 0.1), M["gun"], root, 0)
for s in (-1, 1):
    box("side_skin", (s * (W / 2 - 0.004), -DEP / 2, H / 2), (0.012, DEP - 0.12, H - 0.16), M["panel"], root, 0.003)

# server units below and above the screen
def unit(z, h, leds):
    box("unit", (0, -DEP + 0.11, z), (W - 0.16, 0.12, h - 0.012), M["gun"], root, 0.004)
    box("unit_face", (0, -DEP + 0.045, z), (W - 0.2, 0.01, h - 0.03), M["steel"], root, 0.002)
    for i in range(int((W - 0.4) / 0.05)):
        box("unit_vent", (-W / 2 + 0.3 + i * 0.05, -DEP + 0.038, z), (0.03, 0.006, h * 0.5), M["core"], root, 0)
    if leds:
        box("rack_leds", (-W / 2 + 0.17, -DEP + 0.036, z), (0.1, 0.006, 0.012), M["leds"] if leds == 1 else M["leds_c"], root, 0)

z = 0.16
for i, h in enumerate((0.13, 0.13, 0.22, 0.13, 0.09)):
    unit(z + h / 2, h, 1 + (i % 2))
    z += h
UNITS_TOP = z

# portrait screen with a heavy bezel
SZ, SW, SH = UNITS_TOP + 0.08 + 0.65, 0.78, 1.25
box("scr_bezel", (0, -DEP + 0.08, SZ), (W - 0.12, 0.08, SH + 0.1), M["gun"], root, 0.01, 2)
box("scr_well", (0, -DEP + 0.035, SZ), (SW + 0.03, 0.01, SH + 0.03), M["core"], root, 0)
plane("screen", (0, -DEP + 0.028, SZ), SW, SH, M["screen"], root)
box("scr_clip_t", (0, -DEP + 0.02, SZ + SH / 2 + 0.03), (0.3, 0.02, 0.03), M["trim"], root, 0.003)
text("scr_tag", "/var/log/vault", 0.024, (0, -DEP + 0.008, SZ + SH / 2 + 0.03), M["ink"], root, font=MONO)
unit(SZ + SH / 2 + 0.12, 0.09, 1)

# cable bundle from the top into the ceiling + loose patch cables on the side
for i, (x, mt) in enumerate(((-0.3, "rubber"), (-0.22, "steel"), (0.25, "rubber"), (0.31, "rubber"))):
    wire(f"rack_cable_{i}", [(x, -0.3, H), (x * 1.1, -0.35, H + 0.4), (x, -0.25, 3.6)], 0.018, M[mt], root)
for i, c in enumerate(("#2f6bff", "#e0303a", "#f2c230")):
    m = mat(f"patch_{i}", lin(c), 0.0, 0.6)
    wire(f"patch_{i}", [(-W / 2 + 0.12, -DEP + 0.05, 0.3 + i * 0.13), (-W / 2 - 0.05, -DEP + 0.02, 0.5 + i * 0.1),
                         (-W / 2 - 0.04, -DEP + 0.15, 1.0 + i * 0.1), (-W / 2 + 0.02, -DEP + 0.3, 1.2)], 0.008, m, root)

# ---------------------------------------------------------------- grep lens on an arm (parked beside the rack)
gl = empty("grep_lens", root, (W / 2 + 0.03, -DEP + 0.2, SZ + 0.15))
box("lens_mount", (0, 0, 0), (0.06, 0.14, 0.18), M["steel"], gl, 0.006)
arm = empty("lens_arm", gl, (0.03, -0.05, 0))
arm.rotation_euler = (0, 0, rad(50))
box("arm_a", (0.16, 0, 0), (0.32, 0.035, 0.035), M["trim"], arm, 0.004)
cyl("arm_joint", (0.32, 0, 0), 0.03, 0.06, M["gun"], arm, "Z", 16, 0.004)
box("arm_b", (0.32, -0.21, 0), (0.035, 0.42, 0.035), M["trim"], arm, 0.004)
lens = empty("lens", arm, (0.32, -0.42, 0))
lens.rotation_euler = (0, 0, rad(-50))  # counter-rotates the arm so the glass faces the room
torus("lens_ring", (0, 0, 0), 0.17, 0.018, M["steel"], lens, "Y", 40, 8)
torus("lens_glow", (0, -0.012, 0), 0.155, 0.006, M["rim"], lens, "Y", 40, 6)
cyl("lens_glass", (0, 0, 0), 0.155, 0.01, M["glass"], lens, "Y", 40)
box("lens_handle", (0.0, 0.0, -0.21), (0.03, 0.03, 0.08), M["rubber"], lens, 0.004)

station_header(root, 2, W + 0.1, H + 0.2, -DEP + 0.02, M, "LOG RACK")

# ---------------------------------------------------------------- preview: log rain on the screen, lens swung in
img = bpy.data.images.new("_ui", 320, 512)
px = np.zeros((512, 320, 4)); px[..., 3] = 1
px[..., :3] = (0.002, 0.01, 0.014)
rng = np.random.default_rng(2)
for r in range(70):
    y = 500 - r * 7
    L = rng.integers(60, 290)
    fade = 0.25 + 0.75 * (r / 70)
    px[y - 4:y, 10:10 + L, :3] = np.array((0.15, 0.75, 0.5)) * fade
px[200:206, 10:250, :3] = (1.0, 0.75, 0.2)   # the needle
img.pixels.foreach_set(px.ravel().astype(np.float32))
nt = M["screen"].node_tree
ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
nt.links.new(ti.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Emission Color"])
emission(M["screen"], 1.6); emission(M["bulb"], 3.0)
stage((0, -0.6, 1.3), (-1.6, -3.8, 1.9), lens=34)
render(os.path.join(OUT, "previews", "s2-rain.png"))
arm.rotation_euler = (0, 0, rad(-92)); lens.rotation_euler = (0, 0, rad(92))
render(os.path.join(OUT, "previews", "s2-lens.png"))
arm.rotation_euler = (0, 0, rad(50)); lens.rotation_euler = (0, 0, rad(-50))
nt.nodes.remove(ti)
emission(M["screen"], 0.16); emission(M["bulb"], 0.0)
export(root, os.path.join(OUT, "ch1-station-2.glb"), os.path.join(OUT, "s2.blend"))
