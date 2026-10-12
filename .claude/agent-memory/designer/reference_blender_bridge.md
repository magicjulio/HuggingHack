---
name: reference-blender-bridge
description: The Claude Blender extension times out against Julius's Blender; drive it with design/3d/tools/bl.py instead
metadata:
  type: reference
---
Julius's Blender 4.3.2 runs the ahujasid "MCP for Blender" add-on on port 9876. The Claude desktop "Blender" extension (mcp__Blender__*, official Blender Lab) sends a different protocol, so every call times out. Workaround: `python3 -I design/3d/tools/bl.py code script.py`, which uses the add-on's JSON protocol (`execute_code`, `get_scene_info`, `get_viewport_screenshot`). Work in a new scene and leave his scene alone. See [[reference-3d-tooling]].
