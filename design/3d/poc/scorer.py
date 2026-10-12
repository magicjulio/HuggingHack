import bpy, math
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene
def mat(name,col,em=0,metal=0.6,rough=0.3):
    m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value=(*col,1);b.inputs["Metallic"].default_value=metal;b.inputs["Roughness"].default_value=rough
    if em: b.inputs["Emission Color"].default_value=(*col,1);b.inputs["Emission Strength"].default_value=em
    return m
dark=mat("hull",(0.02,0.03,0.05),metal=0.9,rough=0.25)
green=mat("iris_glow",(0.1,1,0.5),em=12)
cyan=mat("ring_glow",(0.15,0.8,1),em=6)
# housing: bevelled sphere with a slot
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22,segments=64,ring_count=32);h=bpy.context.object;h.name="housing";h.data.materials.append(dark)
bpy.ops.object.shade_smooth()
# lids: two torus segments
for i,z in enumerate((1,-1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=0.2,minor_radius=0.025,location=(0,-0.02,0),rotation=(math.radians(90),0,0))
    t=bpy.context.object;t.name="lid_ring" if i==0 else "outer_ring";t.scale=(1.0+0.25*i,1.0+0.25*i,1);t.data.materials.append(cyan if i else dark)
# iris: emissive disk + pupil
bpy.ops.mesh.primitive_cylinder_add(radius=0.11,depth=0.02,location=(0,-0.215,0),rotation=(math.radians(90),0,0));i=bpy.context.object;i.name="bulb";i.data.materials.append(green)
bpy.ops.mesh.primitive_cylinder_add(radius=0.045,depth=0.03,location=(0,-0.222,0),rotation=(math.radians(90),0,0));p=bpy.context.object;p.name="pupil";p.data.materials.append(mat("pupil",(0,0,0),metal=0,rough=0.1))
# blades around iris (aperture)
for k in range(8):
    a=k*math.pi/4
    bpy.ops.mesh.primitive_cube_add(size=1,location=(0.15*math.cos(a),-0.2,0.15*math.sin(a)),rotation=(0,a,0));b=bpy.context.object
    b.scale=(0.06,0.01,0.018);b.rotation_euler=(0,-a,0);b.data.materials.append(dark);b.name=f"blade_{k}"
# antenna cables
for s in (-1,1):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.008,depth=0.6,location=(0.12*s,0.05,0.42),rotation=(0,math.radians(10*s),0));bpy.context.object.data.materials.append(dark)
# camera/light
bpy.ops.object.camera_add(location=(0.35,-1.05,0.18),rotation=(math.radians(83),0,math.radians(18)));sc.camera=bpy.context.object
bpy.ops.object.light_add(type='AREA',location=(1,-1,1.2));bpy.context.object.data.energy=40
w=bpy.data.worlds.new("w");sc.world=w;w.use_nodes=True;w.node_tree.nodes["Background"].inputs[0].default_value=(0.005,0.008,0.015,1)
sc.render.engine='BLENDER_EEVEE_NEXT';sc.eevee.use_shadows=True
sc.render.resolution_x=800;sc.render.resolution_y=600;sc.render.filepath="//scorer-preview.png"
try:
    sc.view_settings.view_transform='AgX'
except: pass
bpy.ops.render.render(write_still=True)
bpy.ops.export_scene.gltf(filepath=bpy.path.abspath("//ch1-scorer-poc.glb"),export_format='GLB')
