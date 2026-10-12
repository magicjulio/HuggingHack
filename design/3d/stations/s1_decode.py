# Station 1 "Decode" (ch1.station-1) — crypto terminal: a console desk with a chunky monitor and a decoder cartridge bay.
# Headless: blender -b --factory-startup -P design/3d/stations/s1_decode.py -> ch1-station-1.glb, s1.blend, previews/
# Origin = floor point on the wall plane; front = -Y (glTF +Z). Played in-world: the file explorer + terminal UI is real
# DOM on `screen` (drei <Html transform>, like the depot), the player drags the odd string into the decoder area.
# Nodes:
#   screen          1.0 x 0.62 m, UV 0..1, tilted back 8 deg
#   cartridge       the b64-decoder cartridge. Rest = hovering out of the bay (hidden until installed); slide it along
#                   local -Y... in glTF: move it to the `cartridge_seat` empty (0.35 s) when the install finishes.
#   cartridge_seat  empty where the cartridge sits when inserted
#   bay_flap        hinged dust flap over the bay (rotate X, negative = opens up)
#   bay_led         material `decoder_led`: 0 = empty bay, amber blink = "missing tool", green = decoder loaded
#   bulb, light_anchor  shared station header
import bpy, os, sys
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("s1", OUT)
M = station_materials()
M["dled"] = mat("decoder_led", lin("#1a1004"), 0.0, 0.3, em=lin("#ffb020"), strength=0.0)
M["cart"] = tmat("st_cart", surface("st_cart", "#1c6f86", 111, chip=0.76, rust_amt=0.2, dirt=0.3))
M["cart_glow"] = mat("cartridge_glow", lin("#04121a"), 0.0, 0.3, em=lin("#38d8ff"), strength=2.5)

root = empty("station_1", None)
DW, DD, DH = 1.4, 0.72, 0.82   # desk
DY = -0.06 - DD / 2            # desk centre y

# ---------------------------------------------------------------- console desk: slanted front, side pedestals
box("desk_top", (0, DY, DH - 0.03), (DW, DD, 0.06), M["gun"], root, 0.01, 2)
box("desk_edge", (0, DY - DD / 2 - 0.005, DH - 0.03), (DW + 0.01, 0.025, 0.07), M["rubber"], root, 0.006)
for x in (-DW / 2 + 0.17, DW / 2 - 0.17):
    box("pedestal", (x, DY + 0.04, (DH - 0.06) / 2), (0.32, DD - 0.1, DH - 0.06), M["panel"], root, 0.01, 2)
    box("ped_vent", (x, DY - DD / 2 + 0.085, 0.2), (0.22, 0.01, 0.16), M["core"], root, 0.002)
    for i in range(5):
        box("ped_slat", (x, DY - DD / 2 + 0.078, 0.14 + i * 0.03), (0.22, 0.012, 0.008), M["steel"], root, 0)
box("modesty", (0, -0.1, 0.45), (DW - 0.64, 0.04, 0.7), M["gun"], root, 0.004)
box("kick", (0, DY, 0.03), (DW, DD - 0.04, 0.06), M["rubber"], root, 0.004)
hazard("desk_hazard", (0, DY - DD / 2 + 0.07, 0.07), 0.3, 0.05, M["hazard_y"], M["ink"], root, n=6)

# keyboard + trackball
kb = empty("keyboard", root, (-0.2, DY - 0.17, DH + 0.005))
kb.rotation_euler = (rad(4), 0, 0)
box("kb_base", (0, 0, 0.012), (0.56, 0.2, 0.025), M["steel"], kb, 0.006)
for r in range(4):
    for c in range(13):
        box("key", (-0.24 + c * 0.04, -0.07 + r * 0.045, 0.03), (0.032, 0.036, 0.012), M["rubber"], kb, 0.002, 1)
cyl("trackball_base", (0.17, DY - 0.17, DH + 0.012), 0.05, 0.025, M["gun"], root, "Z", 20, 0.004)
bm_ = cyl("trackball", (0.17, DY - 0.17, DH + 0.03), 0.028, 0.03, M["cart_glow"], root, "Z", 16)

# ---------------------------------------------------------------- monitor: deep housing on an arm, tilted back
SZ, SW, SH, TILT = 1.42, 1.0, 0.62, 8
mon = empty("monitor", root, (0, -0.38, SZ))
mon.rotation_euler = (rad(-TILT), 0, 0)
box("mon_shell", (0, 0.12, 0), (SW + 0.16, 0.34, SH + 0.16), M["gun"], mon, 0.02, 3)
box("mon_back", (0, 0.32, 0), (SW - 0.2, 0.12, SH - 0.1), M["steel"], mon, 0.015, 2)
box("mon_bezel", (0, -0.06, 0), (SW + 0.12, 0.03, SH + 0.12), M["panel"], mon, 0.008, 2)
box("mon_well", (0, -0.073, 0), (SW + 0.02, 0.01, SH + 0.02), M["core"], mon, 0)
plane("screen", (0, -0.08, 0), SW, SH, M["screen"], mon)
box("mon_hood", (0, -0.02, SH / 2 + 0.09), (SW + 0.2, 0.2, 0.025), M["gun"], mon, 0.006)
box("mon_chin", (0, -0.08, -SH / 2 - 0.045), (0.3, 0.015, 0.03), M["ink"], mon, 0.002)
text("mon_brand", "CRYPT-0 / TERMINAL", 0.018, (-0.36, -0.089, -SH / 2 - 0.043), M["stencil"], mon, font=MONO)
for i in range(3):
    box("mon_led", (0.4 + i * 0.03, -0.089, -SH / 2 - 0.043), (0.012, 0.004, 0.012), M["led_g"] if i else M["led_a"], mon, 0)
for s in (-1, 1):  # side handles
    box("handle", (s * (SW / 2 + 0.1), -0.02, 0), (0.025, 0.05, 0.3), M["trim"], mon, 0.005)
# arm from the wall
box("arm_wall", (0, -0.04, SZ - 0.1), (0.3, 0.08, 0.4), M["steel"], root, 0.008)
box("arm", (0, -0.12, SZ - 0.1), (0.12, 0.16, 0.12), M["gun"], root, 0.008)
for i, (x, mt) in enumerate(((-0.4, "rubber"), (-0.34, "steel"), (0.42, "rubber"))):
    wire(f"mon_cable_{i}", [(x, -0.05, SZ + 0.25), (x * 1.05, -0.02, SZ + 0.6), (x, -0.03, 3.6)], 0.016, M[mt], root)

# ---------------------------------------------------------------- decoder bay on the right of the desk
BX, BY, BZ = 0.5, DY - 0.13, DH
bay = empty("bay", root, (BX, BY, BZ))
box("bay_housing", (0, 0, 0.11), (0.32, 0.3, 0.22), M["steel"], bay, 0.012, 2)
box("bay_mouth", (0, -0.02, 0.222), (0.2, 0.08, 0.008), M["core"], bay, 0)
box("bay_frame", (0, -0.02, 0.222), (0.23, 0.11, 0.01), M["trim"], bay, 0.002)
hazard("bay_hazard", (0, -0.152, 0.17), 0.26, 0.04, M["hazard_y"], M["ink"], bay, n=6)
box("bay_label", (0, -0.152, 0.08), (0.2, 0.006, 0.05), M["ink"], bay, 0.002)
text("bay_text", "DECODER BAY", 0.022, (0, -0.156, 0.08), M["stencil"], bay, font=MONO)
box("bay_led", (0.11, -0.153, 0.12), (0.02, 0.006, 0.02), M["dled"], bay, 0)
flap = empty("bay_flap", bay, (0, 0.035, 0.228))
flap.rotation_euler = (rad(-70), 0, 0)
box("flap_panel", (0, -0.055, 0), (0.22, 0.11, 0.008), M["gun"], flap, 0.002)
seat = empty("cartridge_seat", root, (BX, BY - 0.02, BZ + 0.16))
cart = empty("cartridge", root, (BX, BY - 0.02, BZ + 0.42))
box("cart_body", (0, 0, 0), (0.18, 0.05, 0.14), M["cart"], cart, 0.006, 2)
box("cart_grip", (0, 0, 0.08), (0.14, 0.04, 0.03), M["rubber"], cart, 0.006)
box("cart_window", (0, -0.026, 0.0), (0.12, 0.004, 0.035), M["cart_glow"], cart, 0)
box("cart_label", (0, -0.026, -0.04), (0.14, 0.004, 0.035), M["stencil"], cart, 0)
text("cart_text", "B64", 0.026, (0, -0.03, -0.04), M["ink"], cart, font=MONO)
for i in range(6):
    box("cart_pin", (-0.05 + i * 0.02, 0, -0.074), (0.008, 0.02, 0.01), M["trim"], cart, 0)

station_header(root, 1, 1.4, 2.32, -0.06, M, "CRYPTO TERMINAL")

# ---------------------------------------------------------------- previews
# a fake UI on the screen (preview only): explorer pane + terminal
img = bpy.data.images.new("_ui", 512, 320)
import numpy as np
px = np.zeros((320, 512, 4)); px[..., 3] = 1
px[..., :3] = (0.005, 0.02, 0.03)
px[300:316, :, :3] = (0.02, 0.25, 0.32)              # title bar (rows are bottom-up)
px[20:290, 10:180, :3] = (0.01, 0.05, 0.07)          # explorer pane
for r in range(6):
    px[260 - r * 28:270 - r * 28, 20:150, :3] = (0.05, 0.4, 0.5) if r != 2 else (0.15, 0.9, 0.55)
px[20:290, 190:502, :3] = (0.0, 0.01, 0.015)          # terminal
for r in range(7):
    px[262 - r * 22:270 - r * 22, 200:200 + (60 + r * 37) % 280, :3] = (0.1, 0.7, 0.45) if r < 6 else (1.0, 0.6, 0.1)
img.pixels.foreach_set(px.ravel().astype(np.float32))
nt = M["screen"].node_tree
ti = nt.nodes.new("ShaderNodeTexImage"); ti.image = img
nt.links.new(ti.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Emission Color"])
emission(M["screen"], 1.6)

stage((0, -0.4, 1.15), (-1.3, -3.0, 1.75), lens=38)
emission(M["dled"], 4.0); emission(M["bulb"], 3.0)
render(os.path.join(OUT, "previews", "s1-missing-tool.png"))
cart.location = seat.location
emission(M["dled"], 0.0)
M["dled"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (*lin("#39ff9c"), 1)
emission(M["dled"], 4.0)
flap.rotation_euler = (rad(-100), 0, 0)
render(os.path.join(OUT, "previews", "s1-decoder-loaded.png"))

# export in rest state (cartridge out, flap closed-ish, UI texture removed)
cart.location = (BX, BY - 0.02, BZ + 0.42)
flap.rotation_euler = (rad(-70), 0, 0)
nt.nodes.remove(ti)
emission(M["screen"], 0.16); emission(M["bulb"], 0.0); emission(M["dled"], 0.0)
M["dled"].node_tree.nodes["Principled BSDF"].inputs["Emission Color"].default_value = (*lin("#ffb020"), 1)
export(root, os.path.join(OUT, "ch1-station-1.glb"), os.path.join(OUT, "s1.blend"))
