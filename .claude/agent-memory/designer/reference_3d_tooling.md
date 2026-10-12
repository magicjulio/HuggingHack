---
name: reference-3d-tooling
description: 3D pipeline available on Julius's machine — headless Blender 4.3.2 scripts → .glb + EEVEE preview renders; Blender MCP options
metadata:
  type: reference
---
- `blender -b -P script.py` works: it builds a scene in Python, renders a PNG with `BLENDER_EEVEE_NEXT`, and exports a `.glb` with `bpy.ops.export_scene.gltf`. The Draco error in the log is harmless. Proof of concept: `design/3d/poc/`.
- GPU: Intel Iris Xe, no NVIDIA, so keep renders small.
- Blender MCP: the community `ahujasid/blender-mcp` is added with `claude mcp add blender uvx blender-mcp`. It needs the add-on enabled in Blender's GUI and the "Connect" button pressed (port 9876). It gives live viewport screenshots plus Poly Haven, Sketchfab and Hyper3D asset import. Blender Foundation released an official MCP server, v1.0.0, in April 2026.
- Claude Design (Anthropic Labs, April 2026) is 2D only: mockups, prototypes, slides. It does not make 3D.
