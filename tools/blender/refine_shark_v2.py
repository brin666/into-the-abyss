"""Refine the existing editable blue-shark study without touching its v1 files.

Blender: blender -b --factory-startup --python tools/blender/refine_shark_v2.py
The silhouette follows NOAA's blue-shark identification traits, not a scan.
"""

import bpy
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "blender" / "surface-40-80"
MODEL_DIR = ROOT / "public" / "models" / "surface-40-80"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE / "blue-shark-study.blend"))


def profile_fin(name, profile, thickness, material, depth=0):
    vertices = [(x, depth - thickness / 2, z) for x, z in profile]
    vertices += [(x, depth + thickness / 2, z) for x, z in profile]
    size = len(profile)
    faces = [tuple(range(size - 1, -1, -1)), tuple(range(size, 2 * size))]
    faces += [(i, (i + 1) % size, (i + 1) % size + size, i + size) for i in range(size)]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft fin edge", "BEVEL")
    bevel.width = 0.018
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


eye = bpy.data.objects["Shark_Eye"]
eye.location.y = -0.185  # Blender -Y exports toward the Three.js camera.
for index in range(1, 5):
    gill = bpy.data.objects[f"Shark_Gill_{index}"]
    gill.location.y = -0.235

dorsal = bpy.data.objects["Shark_Dorsal"]
dorsal.location.x += 0.28
upper = bpy.data.objects["Shark_FusiformBody"].data.materials[0]
profile_fin("Shark_Second_Dorsal", [
    (0.91, 0.14), (1.05, 0.33), (1.11, 0.13),
], 0.055, upper)
profile_fin("Shark_Anal_Fin", [
    (0.86, -0.14), (1.05, -0.31), (1.10, -0.12),
], 0.045, upper)

pectoral = bpy.data.objects["Shark_Pectoral_Front"]
for vertex in pectoral.data.vertices:
    if vertex.co.z < -0.20:
        vertex.co.z = -0.20 + (vertex.co.z + 0.20) * 1.42
    if vertex.co.x > 0:
        vertex.co.x += 0.17
pectoral.data.update()

# Group the narrow peduncle and asymmetric caudal fin around a real tail pivot.
pivot = bpy.data.objects.new("Shark_Tail_Pivot", None)
bpy.context.collection.objects.link(pivot)
pivot.location = (0.94, 0, 0)
for name in ("Shark_CaudalPeduncle", "Shark_Caudal"):
    obj = bpy.data.objects[name]
    original_location = obj.location.copy()
    obj.parent = pivot
    obj.location = original_location - pivot.location

SOURCE.mkdir(parents=True, exist_ok=True)
MODEL_DIR.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "blue-shark-v2.blend"))
bpy.ops.export_scene.gltf(
    filepath=str(MODEL_DIR / "blue-shark-v2.glb"),
    export_format="GLB",
    export_yup=True,
    export_apply=True,
)
print("CREATED", SOURCE / "blue-shark-v2.blend", MODEL_DIR / "blue-shark-v2.glb")
