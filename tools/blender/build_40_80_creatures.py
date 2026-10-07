"""Build lightweight, editable sunfish and blue-shark study assets for the 40–80m beat.

Run with Blender in background mode. These are original stylized silhouettes, not
photogrammetric specimens; biology copy in the app is sourced separately.
"""

import bpy
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "models" / "surface-40-80"
SOURCE = ROOT / "assets" / "blender" / "surface-40-80"
OUTPUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)


def reset():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def mat(name, color, roughness=0.72):
    item = bpy.data.materials.new(name)
    item.diffuse_color = (*color, 1)
    item.use_nodes = True
    surface = item.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = (*color, 1)
    surface.inputs["Roughness"].default_value = roughness
    return item


def ellipsoid(name, location, scale, material, segments=32, rings=16):
    # The study profile uses screen-like X/Y and forward Z. Blender's Z is up,
    # so swap Y/Z here before GLB export (glTF reorients Blender Z to viewer Y).
    x, vertical, forward = location
    sx, sy, sz = scale
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=(x, forward, vertical))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def fin(name, profile, thickness, material):
    # Profile lives in the visible XY plane. A closed extrusion gives readable
    # silhouettes from both desktop and narrow mobile camera crops.
    verts = [(x, -thickness / 2, y) for x, y in profile]
    verts += [(x, thickness / 2, y) for x, y in profile]
    size = len(profile)
    faces = [tuple(range(size - 1, -1, -1)), tuple(range(size, size * 2))]
    for i in range(size):
        j = (i + 1) % size
        faces.append((i, j, j + size, i + size))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("Soft edge", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


def export(name):
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / f"{name}.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{name}.glb"),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
    )


reset()
sun_gray = mat("Mola slate blue", (0.11, 0.21, 0.26))
sun_light = mat("Mola pale edge", (0.28, 0.36, 0.36))
sun_eye = mat("Mola black eye", (0.008, 0.026, 0.036), 0.2)
ellipsoid("Sunfish_Disc", (0, 0, 0), (0.83, 0.9, 0.19), sun_gray)
ellipsoid("Sunfish_Belly", (0.05, -0.35, 0.005), (0.68, 0.48, 0.195), sun_light)
fin("Sunfish_Dorsal", [(-0.23, 0.68), (0.05, 1.52), (0.22, 1.7), (0.27, 0.77)], 0.13, sun_gray)
fin("Sunfish_Anal", [(-0.22, -0.72), (0.06, -1.5), (0.23, -1.64), (0.3, -0.78)], 0.13, sun_gray)
fin("Sunfish_Clavus", [(0.62, 0.58), (0.86, 0.35), (0.88, -0.36), (0.6, -0.6)], 0.11, sun_light)
fin("Sunfish_Pectoral", [(0.08, -0.03), (0.45, 0.03), (0.55, -0.45), (0.28, -0.36)], 0.14, sun_light)
ellipsoid("Sunfish_Eye", (-0.43, 0.22, 0.191), (0.075, 0.075, 0.027), sun_eye, 16, 8)
ellipsoid("Sunfish_Mouth", (-0.78, -0.09, 0.03), (0.1, 0.06, 0.1), sun_light, 16, 8)
export("ocean-sunfish-study")

reset()
shark_blue = mat("Blue shark upper", (0.026, 0.09, 0.17), 0.5)
shark_white = mat("Blue shark underside", (0.25, 0.33, 0.36))
shark_eye = mat("Blue shark eye", (0.004, 0.017, 0.025), 0.22)
ellipsoid("Shark_FusiformBody", (-0.05, 0, 0), (1.17, 0.28, 0.25), shark_blue)
ellipsoid("Shark_PaleBelly", (-0.08, -0.12, 0.002), (0.91, 0.18, 0.24), shark_white)
ellipsoid("Shark_PointSnout", (-1.03, 0.015, 0), (0.58, 0.16, 0.14), shark_blue)
ellipsoid("Shark_CaudalPeduncle", (1.1, 0.01, 0), (0.55, 0.075, 0.08), shark_blue)
fin("Shark_Dorsal", [(-0.2, 0.22), (0.12, 0.66), (0.36, 0.25)], 0.10, shark_blue)
fin("Shark_Caudal", [(1.49, 0.0), (1.9, 0.68), (1.75, 0.05), (1.9, -0.42), (1.51, -0.12)], 0.12, shark_blue)
fin("Shark_Pectoral_Front", [(-0.32, -0.12), (0.03, -0.14), (0.33, -0.62), (-0.1, -0.38)], 0.12, shark_blue)
ellipsoid("Shark_Eye", (-0.81, 0.085, 0.136), (0.047, 0.046, 0.023), shark_eye, 16, 8)
for index in range(4):
    ellipsoid(f"Shark_Gill_{index + 1}", (-0.56 + index * 0.075, -0.055, 0.239), (0.008, 0.065, 0.006), shark_eye, 8, 8)
export("blue-shark-study")

print("CREATED", OUTPUT)
