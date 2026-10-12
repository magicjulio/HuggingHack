# Station 5 "The impossible one" (ch1.station-5) — a sealed, clean black terminal (unlike the worn stations) whose
# output pipe leaves the housing, runs along the wall and ends in a bolted blind flange: nothing consumes the output.
# Plaque on the cap: "OUTPUT -> NO CONSUMER". Played in-world on `screen` (typing / output line).
# Headless: blender -b --factory-startup -P design/3d/stations/s5_impossible.py -> ch1-station-5.glb, s5.blend, previews/
# Origin = floor point on the wall plane; front = -Y (glTF +Z).
# Nodes:
#   screen        0.9 x 0.56 m, UV 0..1
#   pipe_flow_1..8  glowing rings along the pipe, shared material `pipe_flow`; light them in sequence so pulses run
#                 towards the cap and die there (use the order 1 -> 8)
#   cap_glow      ring at the blind flange, material `cap_glow` (purple flicker when a flag-5 attempt dies)
#   seal_bolts    decorative; `bulb`, light_anchor shared header (this one's strip is purple `bulb` tint via code)
import bpy, os, sys
import numpy as np
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("s5", OUT)
M = station_materials()
M["obsidian"] = mat("s5_obsidian", lin("#07080b"), 0.6, 0.22)
M["seam"] = mat("s5_seam", lin("#0a0612"), 0.0, 0.4, em=lin("#b86bff"), strength=1.2)
M["flow"] = mat("pipe_flow", lin("#0a0612"), 0.0, 0.3, em=lin("#b86bff"), strength=0.0)
M["cap"] = mat("cap_glow", lin("#0a0612"), 0.0, 0.3, em=lin("#b86bff"), strength=0.0)
M["plaque"] = tmat("st_plaque", surface("st_plaque", "#8e8a7c", 152, chip=0.7, rust_amt=0.8, dirt=0.6))
M["pipe"] = tmat("st_pipe", surface("st_pipe", "#3a3e44", 151, chip=0.72, rust_amt=0.5, metal=0.85, rough=0.4, dirt=0.3))

root = empty("station_5", None)

# ---------------------------------------------------------------- monolith terminal: angular, seamless, faint purple seams
pts = [(-0.55, 0.0), (0.55, 0.0), (0.6, 0.9), (0.52, 2.05), (-0.52, 2.05), (-0.6, 0.9)]
prism("monolith", pts, -0.55, -0.03, M["obsidian"], root, 0.01)
for z in (0.9,):
    box("seam_h", (0, -0.555, z), (1.18, 0.006, 0.008), M["seam"], root, 0)
for x in (-0.3, 0.3):
    box("seam_v", (x, -0.555, 0.45), (0.006, 0.006, 0.86), M["seam"], root, 0)
# screen recessed in a sloped face
face = empty("face", root, (0, -0.56, 1.45))
face.rotation_euler = (rad(-6), 0, 0)
box("face_frame", (0, 0.01, 0), (1.0, 0.03, 0.68), M["steel"], face, 0.006)
box("face_well", (0, -0.006, 0), (0.94, 0.01, 0.6), M["core"], face, 0)
plane("screen", (0, -0.012, 0), 0.9, 0.56, M["screen"], face)
# sealed: two clamp bars bolted across the lower body, warning stencil
for z in (0.32, 0.62):
    box("seal_bar", (0, -0.57, z), (1.24, 0.03, 0.07), M["steel"], root, 0.006)
    for x in (-0.54, 0.54):
        cyl("seal_bolts", (x, -0.59, z), 0.022, 0.02, M["trim"], root, "Y", 6)
text("stencil_flag", "FLAG 5", 0.09, (0, -0.558, 1.95), M["stencil"], root, spacing=1.15)

# ---------------------------------------------------------------- output pipe: out of the right side, up, along the wall, dead end
PR = 0.055
OUTZ = 1.1
path = [(0.6, -0.3, OUTZ), (0.85, -0.3, OUTZ), (0.96, -0.24, OUTZ + 0.12), (1.0, -0.2, 1.45), (1.02, -0.19, 1.62),
        (1.14, -0.17, 1.72), (1.4, -0.16, 1.74), (1.62, -0.16, 1.74)]
wire("pipe", path, PR, M["pipe"], root, res=8, bres=3)
cyl("pipe_collar", (0.62, -0.3, OUTZ), PR + 0.02, 0.06, M["steel"], root, "X", 20, 0.004)
for x, y, z, ax in [(1.0, -0.2, 1.4, "Z"), (1.45, -0.16, 1.74, "X")]:
    cyl("pipe_bracket", (x, y, z), PR + 0.012, 0.04, M["gun"], root, ax, 16)
    box("bracket_arm", (x, y / 2, z), (0.03, abs(y), 0.03), M["gun"], root, 0.003)
# flow rings along the pipe (pulse order 1 -> 8 towards the cap)
flow_pts = [(0.72, -0.3, OUTZ, "X"), (0.82, -0.3, OUTZ, "X"), (0.99, -0.215, 1.3, "Z"), (1.0, -0.2, 1.5, "Z"),
            (1.22, -0.165, 1.735, "X"), (1.32, -0.162, 1.74, "X"), (1.53, -0.16, 1.74, "X"), (1.6, -0.16, 1.74, "X")]
for i, (x, y, z, ax) in enumerate(flow_pts):
    o = torus(f"pipe_flow_{i + 1}", (x, y, z), PR + 0.006, 0.008, M["flow"], root, "X" if ax == "X" else "Z", 20, 6)
# blind flange at the end, bolts, glow ring, hazard tape, plaque hanging below
CX, CY, CZ = 1.66, -0.16, 1.74
cyl("flange", (CX, CY, CZ), 0.13, 0.04, M["steel"], root, "X", 24, 0.006)
cyl("blind_cap", (CX + 0.035, CY, CZ), 0.12, 0.035, M["gun"], root, "X", 24, 0.006)
for k in range(8):
    a = k * np.pi / 4
    cyl("cap_bolt", (CX + 0.06, CY + 0.092 * np.cos(a), CZ + 0.092 * np.sin(a)), 0.013, 0.025, M["trim"], root, "X", 6)
torus("cap_glow", (CX - 0.03, CY, CZ), PR + 0.014, 0.012, M["cap"], root, "X", 24, 6)
pl = empty("plaque", root, (CX - 0.2, -0.25, 1.48))
pl.rotation_euler = (0, 0, rad(-4))
for s in (-1, 1):
    box("plaque_chain", (s * 0.16, 0.04, 0.15), (0.006, 0.006, 0.2), M["trim"], pl, 0)
box("plaque_plate", (0, 0, 0), (0.5, 0.012, 0.17), M["plaque"], pl, 0.004)
text("plaque_text", "OUTPUT → NO CONSUMER", 0.05, (0, -0.008, 0.022), M["ink"], pl, font=MONO)
text("plaque_sub", "LINE TERMINATED", 0.03, (0, -0.008, -0.042), M["ink"], pl, font=MONO)
hazard("pipe_tape", (1.4, -0.225, 1.74), 0.1, 0.12, M["hazard_y"], M["ink"], root, n=3)

station_header(root, 5, 1.3, 2.3, -0.56, M)
# header sits on the monolith top; push it up a little so it clears the FLAG 5 stencil
bpy.data.objects["header"].location.z = 2.28

# ---------------------------------------------------------------- previews
img = bpy.data.images.new("_ui", 480, 300)
px = np.zeros((300, 480, 4)); px[..., 3] = 1
px[..., :3] = (0.004, 0.003, 0.01)
for r in range(5):
    px[250 - r * 26:258 - r * 26, 20:20 + 90 + r * 50, :3] = (0.5, 0.35, 0.8)
px[100:112, 20:400, :3] = (0.9, 0.5, 1.0)
img.pixels.foreach_set(px.ravel().astype(np.float32))
nt = M["screen"].node_tree
ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
nt.links.new(ti.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Emission Color"])
emission(M["screen"], 1.5)
M["bulb"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (*lin("#b86bff"), 1)
emission(M["bulb"], 3.0)
stage((0.6, -0.4, 1.35), (-0.6, -3.4, 1.8), lens=34)
emission(M["flow"], 2.5); emission(M["cap"], 5.0)
render(os.path.join(OUT, "previews", "s5-dead-end.png"))

nt.nodes.remove(ti)
M["bulb"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (*lin("#38d8ff"), 1)
for k, v in (("screen", 0.16), ("bulb", 0.0), ("flow", 0.0), ("cap", 0.0)):
    emission(M[k], v)
export(root, os.path.join(OUT, "ch1-station-5.glb"), os.path.join(OUT, "s5.blend"))
