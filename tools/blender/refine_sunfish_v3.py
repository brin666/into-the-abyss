"""Refine the editable v2 Mola study without overwriting its rollback files.

Blender: blender -b --factory-startup --python tools/blender/refine_sunfish_v3.py
This is local modeling, not a Lux3D generation or a claim of specimen accuracy.
"""

import bpy
import math
from mathutils import Vector, noise
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/surface-40-80/ocean-sunfish-v2.blend"
BLEND = ROOT / "assets/blender/surface-40-80/ocean-sunfish-v3.blend"
GLB = ROOT / "public/models/surface-40-80/ocean-sunfish-v3.glb"

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

body = bpy.data.objects["Sunfish_Disc_Truncated"]
for modifier in tuple(body.modifiers):
    body.modifiers.remove(modifier)

# One subdivision pass removes the faceted cross-section while keeping the
# silhouette inexpensive for mobile. Repaint after subdivision so flecks do
# not turn into large, interpolated rectangular islands.
bpy.context.view_layer.objects.active = body
body.select_set(True)
subdivision = body.modifiers.new("Continuous disc surface", "SUBSURF")
subdivision.subdivision_type = "SIMPLE"
subdivision.levels = 1
bpy.ops.object.modifier_apply(modifier=subdivision.name)
body.select_set(False)

colors = body.data.color_attributes.get("MolaColor")
if colors is None:
    colors = body.data.color_attributes.new(name="MolaColor", type="FLOAT_COLOR", domain="CORNER")

for polygon in body.data.polygons:
    for index in polygon.loop_indices:
        vertex = body.data.vertices[body.data.loops[index].vertex_index]
        x, y, z = vertex.co
        broad = noise.noise(Vector((x * 2.3 + 1.1, y * 8.0, z * 2.3)))
        fine = noise.noise(Vector((x * 15.0, y * 31.0 + 3.0, z * 14.0)))
        freckles = max(0.0, fine - 0.38) * 0.17
        dorsal = max(0.0, z) / 0.85
        ventral = max(0.0, -z) / 0.85
        tone = 0.018 * broad + 0.011 * fine + freckles
        base = (0.102 - 0.026 * dorsal + 0.020 * ventral,
                0.121 - 0.027 * dorsal + 0.020 * ventral,
                0.128 - 0.026 * dorsal + 0.019 * ventral)
        colors.data[index].color = tuple(max(0.018, min(0.36, channel + tone)) for channel in base) + (1.0,)

skin = bpy.data.materials["Mola vertex-tinted skin"]
surface = skin.node_tree.nodes.get("Principled BSDF")
surface.inputs["Roughness"].default_value = 0.87

# Sunfish have a blunt, small mouth. The older protruding ball read as a toy.
mouth = bpy.data.objects["Sunfish_Mouth"]
mouth.location = (-1.022, -0.057, -0.105)
mouth.scale = (0.48, 0.80, 0.30)

rim = bpy.data.objects["Sunfish_Eye_Rim"]
eye = bpy.data.objects["Sunfish_Eye"]
rim.scale = (0.92, 1.0, 0.92)
eye.scale = (0.93, 1.0, 0.93)

for name in ("Sunfish_Dorsal_Fin", "Sunfish_Anal_Fin", "Sunfish_Clavus", "Sunfish_Pectoral_Fin"):
    fin = bpy.data.objects[name]
    for modifier in fin.modifiers:
        if modifier.type == "BEVEL":
            modifier.width = min(0.04, modifier.width * 1.55)
            modifier.segments = 3

# Fine, shallow skin pores: actual mesh, sparse enough to remain inexpensive.
# They sit on the near side only and are not claimed to reproduce real denticles.
spot_material = bpy.data.materials.new("Mola muted skin pores")
spot_material.diffuse_color = (0.14, 0.18, 0.18, 1.0)
spot_material.use_nodes = True
spot_material.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = spot_material.diffuse_color
spot_material.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.92

vertices = []
faces = []
for row in range(-7, 8):
    z = row * 0.087
    for column in range(-10, 12):
        x = column * 0.075 - 0.07
        if x < -0.84 or x > 0.67 or abs(z) > 0.72:
            continue
        # Use a deterministic irregular distribution, avoiding the face, eye,
        # and pectoral fin. The spot positions do not animate independently.
        irregularity = noise.noise(Vector((x * 17.0, z * 17.0, 4.0)))
        if irregularity < 0.24 or (x < -0.54 and abs(z - 0.18) < 0.20):
            continue
        if -0.31 < x < 0.30 and -0.39 < z < 0.12:
            continue
        height = 0.83 * min(1.0, max(0.0, (x + 1.02) / 0.65))
        if abs(z) >= height * 0.86:
            continue
        nearest = min(range(0, len(body.data.vertices)), key=lambda idx: (body.data.vertices[idx].co.x - x) ** 2 + (body.data.vertices[idx].co.z - z) ** 2 + 0.5 * (body.data.vertices[idx].co.y + 0.2) ** 2)
        y = body.data.vertices[nearest].co.y - 0.004
        radius = 0.005 + (irregularity - 0.24) * 0.005
        start = len(vertices)
        vertices.extend(((x - radius, y, z), (x, y - 0.001, z + radius * 0.7), (x + radius, y, z)))
        faces.append((start, start + 1, start + 2))

if faces:
    mesh = bpy.data.meshes.new("MolaSkinPoresMesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    pores = bpy.data.objects.new("Sunfish_Subtle_Skin_Pores", mesh)
    bpy.context.collection.objects.link(pores)
    mesh.materials.append(spot_material)

BLEND.parent.mkdir(parents=True, exist_ok=True)
GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB", export_yup=True,
                          export_apply=True, export_vertex_color="MATERIAL")
print("CREATED", BLEND, GLB, "pores", len(faces))
