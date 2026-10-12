# Station 3 "Wire it up" (ch1.station-3) — wall-mounted port junction, Among-Us style wiring played in 3D.
# Headless: blender -b --factory-startup -P design/3d/stations/s3_wires.py -> ch1-station-3.glb, s3.blend, previews/
# Origin = floor point on the wall plane; the unit hangs on the wall (y < 0 is the room). Front = -Y (glTF +Z).
# Gameplay nodes (glTF names):
#   anchor_22/53/80/443   empties at the cable exit of each coloured post (cable start, fixed)
#   plug_22/53/80/443     plug heads at rest (dangling). Origin = cable attach point, tip points down (glTF -Y).
#                         The engineer draws the cable as a tube from anchor to plug and moves the plug.
#   socket_ssh/dns/http/https  empties at each socket mouth (plug tip goes here, pointing into the wall = glTF -Z)
#   socket_led_<svc>      ring LED per socket, own material `socket_led_<svc>` (0 = off, light green on a match)
#   legend_card           port-map card in its clip; hide until `port-map` is installed
#   screen                flag readout strip (UV 0..1), `bulb` header strip, light_anchor
import bpy, os, sys
from math import radians as rad

OUT = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(OUT, "..", "lib"))
import kit
from kit import *

kit.reset("s3", OUT)
M = station_materials()
WIRES = {  # port: (colour, wire material)
    "22": "#e0303a", "53": "#2f6bff", "80": "#f2c230", "443": "#ff4fd8",
}
for p, c in WIRES.items():
    M["w" + p] = mat(f"wire_{p}", lin(c), 0.0, 0.55)
SOCKETS = [("https", "secure web"), ("dns", "name lookup"), ("ssh", "secure shell"), ("http", "web")]  # top to bottom
for s, _ in SOCKETS:
    M["led_" + s] = mat(f"socket_led_{s}", lin("#04140a"), 0.0, 0.3, em=lin("#39ff9c"), strength=0.0)

root = empty("station_3", None)
W, H, D, ZC = 1.5, 1.15, 0.24, 1.45     # cabinet width/height/depth, centre height
FY = -D                                   # front plane
Z0, Z1 = ZC - H / 2, ZC + H / 2

# ---------------------------------------------------------------- cabinet shell (open front)
box("back", (0, -0.015, ZC), (W, 0.03, H), M["gun"], root, 0.004)
box("side_l", (-W / 2 + 0.025, -D / 2, ZC), (0.05, D, H), M["gun"], root, 0.008)
box("side_r", (W / 2 - 0.025, -D / 2, ZC), (0.05, D, H), M["gun"], root, 0.008)
box("top", (0, -D / 2, Z1 - 0.025), (W, D, 0.05), M["gun"], root, 0.008)
box("bottom", (0, -D / 2 - 0.03, Z0 + 0.03), (W, D + 0.06, 0.06), M["gun"], root, 0.008)  # deeper sill = cable tray
box("tray_lip", (0, FY - 0.055, Z0 + 0.075), (W - 0.04, 0.02, 0.05), M["steel"], root, 0.004)
hazard("sill_hazard", (0, FY - 0.067, Z0 + 0.03), W - 0.1, 0.045, M["hazard_y"], M["ink"], root, n=14)
for x in (-W / 2, W / 2):
    box(f"frame_{'l' if x < 0 else 'r'}", (x * 0.995, FY - 0.006, ZC), (0.035, 0.02, H + 0.02), M["trim"], root, 0.003)
box("frame_t", (0, FY - 0.006, Z1), (W + 0.02, 0.02, 0.035), M["trim"], root, 0.003)
# inner back board: off-white service panel with screws
box("board", (0, -0.035, ZC - 0.02), (W - 0.14, 0.012, H - 0.16), M["panel"], root, 0.003)
for x in (-W / 2 + 0.11, W / 2 - 0.11):
    for z in (Z0 + 0.12, Z1 - 0.1):
        cyl(f"screw", (x, -0.043, z), 0.009, 0.006, M["trim"], root, "Y", 10)

# ---------------------------------------------------------------- left: four coloured cable posts with port numbers
POST_X = -0.5
PZ = [Z1 - 0.2, Z1 - 0.42, Z1 - 0.64, Z1 - 0.86]
for (port, col), z in zip(WIRES.items(), PZ):
    g = empty(f"post_{port}", root, (POST_X, 0, z))
    box("post_plate", (0, -0.043, 0), (0.2, 0.01, 0.14), M["steel"], g, 0.003)
    cyl("post_base", (0.04, -0.06, 0), 0.032, 0.03, M["gun"], g, "Y", 16, 0.003)
    cyl("post_sleeve", (0.04, -0.095, 0), 0.022, 0.05, M["w" + port], g, "Y", 16, 0.003)
    cyl("post_tip", (0.04, -0.124, 0), 0.014, 0.012, M["trim"], g, "Y", 12)
    box("port_plate", (-0.05, -0.05, 0), (0.08, 0.006, 0.055), M["ink"], g, 0.002)
    text("port_num", port, 0.034, (-0.05, -0.054, 0), M["stencil"], g, font=MONO)
    empty(f"anchor_{port}", root, (POST_X + 0.04, -0.13, z))

# rest plugs: dangling in the tray, preview cables (not exported) show how they hang
rest = {"22": (-0.62, FY - 0.03, Z0 + 0.2), "53": (-0.48, FY - 0.045, Z0 + 0.16),
        "80": (-0.33, FY - 0.03, Z0 + 0.22), "443": (-0.2, FY - 0.04, Z0 + 0.15)}
for port, p in rest.items():
    g = empty(f"plug_{port}", root, p)
    cyl("plug_boot", (0, 0, -0.01), 0.012, 0.02, M["rubber"], g, "Z", 12)
    cyl("plug_body", (0, 0, -0.048), 0.02, 0.06, M["w" + port], g, "Z", 16, 0.003)
    cyl("plug_grip", (0, 0, -0.07), 0.022, 0.012, M["steel"], g, "Z", 16)
    cyl("plug_tip", (0, 0, -0.095), 0.009, 0.04, M["trim"], g, "Z", 12)

# ---------------------------------------------------------------- right: four labelled sockets (shuffled vs ports)
SOCK_X = 0.42
for (svc, label), z in zip(SOCKETS, PZ):
    g = empty(f"socket_group_{svc}", root, (SOCK_X, 0, z))
    box("sock_plate", (0.05, -0.044, 0), (0.36, 0.01, 0.15), M["steel"], g, 0.003)
    cyl("sock_collar", (-0.07, -0.062, 0), 0.04, 0.03, M["gun"], g, "Y", 20, 0.004)
    torus(f"socket_led_{svc}", (-0.07, -0.078, 0), 0.034, 0.005, M["led_" + svc], g, "Y", 24, 6)
    cyl("sock_hole", (-0.07, -0.078, 0), 0.016, 0.004, M["core"], g, "Y", 16)
    box("sock_label", (0.08, -0.05, 0), (0.2, 0.006, 0.05), M["ink"], g, 0.002)
    text("sock_text", label, 0.026, (0.08, -0.054, 0), M["stencil"], g, font=MONO)
    empty(f"socket_{svc}", root, (SOCK_X - 0.07, -0.082, z))

# ---------------------------------------------------------------- middle: cable guides, legend clip, flag readout
for z in PZ:
    box("guide", (-0.05, -0.045, z), (0.22, 0.012, 0.012), M["trim"], root, 0.002)
box("readout_bezel", (0, -0.05, Z0 + 0.11), (0.6, 0.03, 0.1), M["gun"], root, 0.006)
plane("screen", (0, -0.066, Z0 + 0.11), 0.54, 0.065, M["screen"], root)
box("clip", (-0.02, -0.05, Z1 - 0.06), (0.14, 0.02, 0.03), M["trim"], root, 0.003)
card = empty("legend_card", root, (-0.02, -0.058, Z1 - 0.2))
card.rotation_euler = (0, rad(0), rad(-4))
box("card", (0, 0, 0), (0.16, 0.003, 0.24), M["stencil"], card, 0)
text("card_title", "PORT MAP", 0.022, (0, -0.003, 0.09), M["ink"], card, font=MONO)
for i, (port, svc) in enumerate((("22", "ssh"), ("53", "dns"), ("80", "http"), ("443", "https"))):
    text(f"card_row_{port}", f"{port:>3}  {svc:<5}", 0.019, (0, -0.003, 0.045 - i * 0.04), M["ink"], card, font=MONO)

# conduits from the top into the ceiling, and a ground line to the floor
for x, r in ((-0.5, 0.035), (-0.38, 0.025), (0.55, 0.04)):
    cyl("conduit", (x, -0.07, (Z1 + 3.6) / 2), r, 3.6 - Z1, M["steel"], root, "Z", 14)
    cyl("conduit_clamp", (x, -0.07, Z1 + 0.25), r + 0.008, 0.04, M["gun"], root, "Z", 14)
cyl("ground", (0.66, -0.06, Z0 / 2), 0.02, Z0, M["steel"], root, "Z", 12)
box("status_leds", (0.6, FY - 0.004, Z0 + 0.11), (0.08, 0.01, 0.02), M["core"], root, 0)
for i in range(3):
    box("led", (0.575 + i * 0.025, FY - 0.01, Z0 + 0.11), (0.012, 0.004, 0.012), M["led_g"] if i < 2 else M["led_a"], root, 0)

station_header(root, 3, W + 0.1, Z1 + 0.22, FY + 0.02, M, "PORT JUNCTION")

# ---------------------------------------------------------------- preview: hanging cables (not exported)
prev = []
for port, p in rest.items():
    a = bpy.data.objects[f"anchor_{port}"].location
    x, y, z = p
    prev.append(wire(f"_cable_{port}", [(a.x, a.y, a.z), (a.x + 0.02, y - 0.02, (a.z + z) / 2 - 0.05), (x, y, z + 0.06), (x, y, z)],
                     0.011, M["w" + port], None, res=10))

cam = stage((0, -0.2, ZC), (-1.0, -2.6, 1.7), lens=42)
render(os.path.join(OUT, "previews", "s3-rest.png"))

# solved-ish preview: two wires plugged in, their socket LEDs green
for o in prev:
    bpy.data.objects.remove(o)
plugged = {"22": "ssh", "80": "http"}
for port, svc in plugged.items():
    s = bpy.data.objects[f"socket_{svc}"].matrix_world.translation
    a = bpy.data.objects[f"anchor_{port}"].location
    pl = bpy.data.objects[f"plug_{port}"]
    pl.location = (s.x, s.y - 0.1, s.z)
    pl.rotation_euler = (rad(-90), 0, 0)
    wire(f"_cable_{port}", [(a.x, a.y, a.z), (a.x + 0.25, a.y - 0.12, (a.z + s.z) / 2 - 0.08), (s.x - 0.05, s.y - 0.14, s.z), (s.x, s.y - 0.1, s.z)],
         0.011, M["w" + port], None, res=12)
    emission(M["led_" + svc], 4.0)
for port in ("53", "443"):
    a = bpy.data.objects[f"anchor_{port}"].location
    x, y, z = rest[port]
    wire(f"_cable_{port}", [(a.x, a.y, a.z), (a.x + 0.02, y - 0.02, (a.z + z) / 2 - 0.05), (x, y, z + 0.06), (x, y, z)], 0.011, M["w" + port], None, res=10)
emission(M["bulb"], 3.0)
render(os.path.join(OUT, "previews", "s3-wiring.png"))

# reset to rest for export
for port, svc in plugged.items():
    bpy.data.objects[f"plug_{port}"].location = rest[port]
    bpy.data.objects[f"plug_{port}"].rotation_euler = (0, 0, 0)
    emission(M["led_" + svc], 0.0)
emission(M["bulb"], 0.0)
export(root, os.path.join(OUT, "ch1-station-3.glb"), os.path.join(OUT, "s3.blend"))
