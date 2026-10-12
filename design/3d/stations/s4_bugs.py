# Station 4 "Bugs" (ch1.station-4) — DEBUG BAY: an arcade-style cabinet with a big code monitor. Played in-world:
# bugs crawl over `screen` and the player shoots them with the normal first-person crosshair (raycast hit -> screen UV).
# Headless: blender -b --factory-startup -P design/3d/stations/s4_bugs.py -> ch1-station-4.glb, s4.blend, previews/
# Origin = floor point on the wall plane; front = -Y (glTF +Z).
# Nodes:
#   screen          1.2 x 0.76 m, UV 0..1, tilted back 10 deg (code + bugs canvas)
#   counter         small strip under the monitor (UV 0..1) for "bugs 7/12"
#   gun_mount       the bug-gun emitter on the cabinet top; hidden until installed. `gun_head` turns (Y then X) to face
#                   the hit point; `gun_muzzle` empty = beam start. Muzzle glow material `gun_glow`.
#   marquee         lit "DEBUG BAY" sign, material `marquee` (0 off, ~3 on)
#   bulb, light_anchor  shared station header
import bpy, os, sys
import numpy as np
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("s4", OUT)
M = station_materials()
M["side"] = tmat("st_cab_red", surface("st_cab_red", "#5a1418", 121, chip=0.68, rust_amt=0.7, ribs=18))
M["marquee"] = mat("marquee", lin("#1a0404"), 0.0, 0.4, em=lin("#ff3b4e"), strength=0.0)
M["gun_glow"] = mat("gun_glow", lin("#04140a"), 0.0, 0.3, em=lin("#39ff9c"), strength=0.0)
M["counter"] = mat("counter", lin("#02080c"), 0.0, 0.6, em=lin("#39ff9c"), strength=0.16)

root = empty("station_4", None)
W, DEP = 1.36, 0.78

# ---------------------------------------------------------------- cabinet: side profile extruded (arcade silhouette)
prof = [(-0.05, 0.0), (-0.05, 2.25), (-0.42, 2.25), (-0.5, 1.98), (-0.62, 1.86), (-0.58, 1.05),
        (-DEP, 0.98), (-DEP, 0.0)]  # (y, z): back at the wall, front leans out under the monitor
for s, x in (("l", -W / 2), ("r", W / 2)):
    prism(f"side_{s}", [(y, z) for y, z in prof], 0, 0.06, M["side"], root, 0.008)
    o = bpy.data.objects[f"side_{s}"]
    # prism extrudes along Y; rotate the profile so its "x" axis becomes Y
    o.rotation_euler = (0, 0, rad(90))  # profile x -> room y, extrusion -> -x
    o.location = (x + 0.06 if s == "l" else x, 0, 0)
    box(f"side_trim_{s}", (x, -DEP + 0.005, 0.49), (0.075, 0.02, 0.98), M["trim"], root, 0.003)
box("body", (0, -0.4, 0.5), (W - 0.1, 0.72, 1.0), M["gun"], root, 0.008)
box("kick", (0, -DEP + 0.05, 0.05), (W - 0.1, 0.06, 0.1), M["rubber"], root, 0.004)
box("body_panel", (0, -DEP + 0.005, 0.55), (W - 0.36, 0.02, 0.7), M["panel"], root, 0.006)
hazard("body_hazard", (0, -DEP - 0.008, 0.2), W - 0.36, 0.08, M["hazard_y"], M["ink"], root, n=12)
for i in range(4):
    box("vent", (0, -DEP - 0.006, 0.72 + i * 0.05), (0.5, 0.01, 0.022), M["core"], root, 0)
text("body_stencil", "QA // CONTAINMENT", 0.05, (0, -DEP - 0.01, 0.42), M["ink"], root, font=MONO)

# control deck (slanted shelf below the monitor)
deck = empty("deck", root, (0, -0.68, 1.02))
deck.rotation_euler = (rad(-14), 0, 0)
box("deck_top", (0, 0, 0), (W - 0.12, 0.26, 0.04), M["steel"], deck, 0.008)
for i, x in enumerate((-0.4, -0.28, 0.32, 0.44)):
    cyl("deck_btn", (x, -0.03, 0.03), 0.026, 0.02, M["led_a"] if i == 0 else M["rubber"], deck, "Z", 16, 0.003)
box("deck_grille", (0.0, 0.02, 0.022), (0.36, 0.12, 0.006), M["core"], deck, 0)

# ---------------------------------------------------------------- monitor in a deep hood
SZ, SW, SH, TILT = 1.5, 1.2, 0.76, 10
mon = empty("monitor", root, (0, -0.5, SZ))
mon.rotation_euler = (rad(-TILT), 0, 0)
box("mon_back", (0, 0.18, 0), (W - 0.12, 0.3, SH + 0.14), M["gun"], mon, 0.01)
box("mon_well", (0, 0.01, 0), (SW + 0.04, 0.02, SH + 0.04), M["core"], mon, 0)
plane("screen", (0, -0.002, 0), SW, SH, M["screen"], mon)
for s in (-1, 1):  # containment rails along the screen edges
    box("rail", (s * (SW / 2 + 0.035), -0.03, 0), (0.03, 0.05, SH + 0.06), M["trim"], mon, 0.004)
    for k in range(5):
        box("rail_clamp", (s * (SW / 2 + 0.035), -0.058, -SH / 2 + 0.08 + k * 0.15), (0.05, 0.02, 0.03), M["steel"], mon, 0.003)
box("counter_bezel", (0, -0.01, -SH / 2 - 0.055), (0.42, 0.03, 0.07), M["gun"], mon, 0.004)
plane("counter", (0, -0.026, -SH / 2 - 0.055), 0.36, 0.045, M["counter"], mon)

# marquee on top
mq = empty("marquee_box", root, (0, -0.33, 2.08))
box("mq_frame", (0, 0, 0), (W - 0.08, 0.2, 0.26), M["gun"], mq, 0.01)
box("mq_well", (0, -0.1, 0), (W - 0.24, 0.01, 0.17), M["core"], mq, 0)
text("marquee", "DEBUG BAY", 0.12, (0, -0.108, 0.0), M["marquee"], mq, spacing=1.05)
for s in (-1, 1):
    cyl("mq_bolt", (s * (W / 2 - 0.1), -0.104, 0), 0.012, 0.008, M["trim"], mq, "Y", 10)

# ---------------------------------------------------------------- bug gun: emitter on a swivel, sits on the cabinet top
gm = empty("gun_mount", root, (0.42, -0.25, 2.25))
cyl("gun_base", (0, 0, 0.03), 0.09, 0.06, M["steel"], gm, "Z", 20, 0.006)
cyl("gun_yoke", (0, 0, 0.09), 0.05, 0.06, M["gun"], gm, "Z", 16, 0.004)
gh = empty("gun_head", gm, (0, 0, 0.16))
gh.rotation_euler = (rad(-35), 0, rad(15))   # aimed down at the screen
box("gun_body", (0, -0.03, 0), (0.09, 0.2, 0.08), M["gun"], gh, 0.012, 2)
cyl("gun_barrel", (0, -0.17, 0), 0.022, 0.1, M["steel"], gh, "Y", 16, 0.003)
torus("gun_coil", (0, -0.15, 0), 0.03, 0.007, M["gun_glow"], gh, "Y", 16, 6)
torus("gun_coil2", (0, -0.19, 0), 0.03, 0.007, M["gun_glow"], gh, "Y", 16, 6)
cyl("gun_tip", (0, -0.225, 0), 0.016, 0.012, M["gun_glow"], gh, "Y", 12)
empty("gun_muzzle", gh, (0, -0.235, 0))
box("gun_fin", (0, 0.02, 0.055), (0.012, 0.12, 0.04), M["trim"], gh, 0.002)

station_header(root, 4, W + 0.1, 2.78, -0.05, M)

# ---------------------------------------------------------------- previews: code + bugs on the screen
img = bpy.data.images.new("_ui", 640, 400)
px = np.zeros((400, 640, 4)); px[..., 3] = 1
px[..., :3] = (0.003, 0.012, 0.018)
rng = np.random.default_rng(4)
for r in range(18):
    y = 380 - r * 21
    ind = 20 + 24 * (r % 4 in (1, 2))
    for seg in range(rng.integers(2, 5)):
        L = rng.integers(20, 110)
        c = [(0.1, 0.55, 0.7), (0.2, 0.75, 0.45), (0.7, 0.5, 0.9), (0.6, 0.65, 0.7)][rng.integers(0, 4)]
        px[y - 8:y, ind:ind + L, :3] = c
        ind += L + 10
for bx, by, s in ((180, 260, 16), (420, 140, 13), (520, 300, 15), (300, 90, 12)):  # bugs: dark bodies with red eyes
    yy, xx = np.ogrid[:400, :640]
    m = ((xx - bx) / (s * 1.5)) ** 2 + ((yy - by) / s) ** 2 < 1
    px[m, :3] = (0.02, 0.01, 0.0)
    px[by - 2:by + 2, bx + int(s * 1.2):bx + int(s * 1.5), :3] = (1.0, 0.1, 0.15)
img.pixels.foreach_set(px.ravel().astype(np.float32))
nt = M["screen"].node_tree
ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
nt.links.new(ti.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Emission Color"])
emission(M["screen"], 1.8)
emission(M["marquee"], 3.5); emission(M["bulb"], 3.0); emission(M["gun_glow"], 3.0); emission(M["counter"], 1.2)
stage((0, -0.5, 1.3), (-1.5, -3.6, 1.9), lens=36)
render(os.path.join(OUT, "previews", "s4-armed.png"))

nt.nodes.remove(ti)
for k, v in (("screen", 0.16), ("marquee", 0.0), ("bulb", 0.0), ("gun_glow", 0.0), ("counter", 0.16)):
    emission(M[k], v)
export(root, os.path.join(OUT, "ch1-station-4.glb"), os.path.join(OUT, "s4.blend"))
