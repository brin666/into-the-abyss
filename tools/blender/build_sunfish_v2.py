"""Build an editable, lightweight Mola mola profile for the 40-80m encounter.

Blender: blender -b --factory-startup --python tools/blender/build_sunfish_v2.py
This original mesh is a natural-history-inspired study, not a scanned specimen.
The earlier ocean-sunfish-study.blend/.glb remain untouched for rollback.
"""

import bpy
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets" / "blender" / "surface-40-80" / "ocean-sunfish-v2.blend"
OUTPUT = ROOT / "public" / "models" / "surface-40-80" / "ocean-sunfish-v2.glb"


def material(name, rgb, roughness=0.78):
    item = bpy.data.materials.new(name)
    item.diffuse_color = (*rgb, 1)
    item.use_nodes = True
    surface = item.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = (*rgb, 1)
    surface.inputs["Roughness"].default_value = roughness
    return item


def mesh_object(name, vertices, faces, mat):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    return obj


def ellipsoid(name, location, scale, mat, segments=16, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj


def profile_fin(name, profile, thickness, mat, pivot=(0, 0), depth=0):
    """Profile is side-view (x, height); negative Blender Y faces the camera."""
    px, pz = pivot
    vertices = [(x - px, depth - thickness / 2, z - pz) for x, z in profile]
    vertices += [(x - px, depth + thickness / 2, z - pz) for x, z in profile]
    size = len(profile)
    faces = [tuple(range(size - 1, -1, -1)), tuple(range(size, size * 2))]
    faces += [(i, (i + 1) % size, (i + 1) % size + size, i + size) for i in range(size)]
    obj = mesh_object(name, vertices, faces, mat)
    obj.location = (px, 0, pz)
    bevel = obj.modifiers.new("Rounded fin edge", "BEVEL")
    bevel.width = min(0.024, thickness * 0.22)
    bevel.segments = 2
    obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
    return obj


bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

skin = material("Mola vertex-tinted skin", (1.0, 1.0, 1.0))
vertex_color_node = skin.node_tree.nodes.new("ShaderNodeVertexColor")
vertex_color_node.layer_name = "MolaColor"
skin.node_tree.links.new(vertex_color_node.outputs["Color"], skin.node_tree.nodes.get("Principled BSDF").inputs["Base Color"])
fin_mat = material("Mola darker fins", (0.042, 0.064, 0.070))
edge = material("Mola clavus edge", (0.085, 0.112, 0.11))
eye_ring = material("Mola eye rim", (0.12, 0.15, 0.15))
eye_black = material("Mola eye black", (0.008, 0.018, 0.023), 0.18)
mouth_mat = material("Mola small mouth", (0.055, 0.08, 0.09))

# A nearly flat rear, not the tapering tail of an ordinary fish. Each section
# gives x, half-height and half-thickness in Blender's X/Z/Y axes respectively.
sections = [
    (-1.02, 0.075, 0.038), (-0.96, 0.23, 0.075), (-0.86, 0.42, 0.12),
    (-0.70, 0.59, 0.17), (-0.50, 0.72, 0.205), (-0.26, 0.80, 0.235),
    (0.00, 0.83, 0.25), (0.24, 0.81, 0.235), (0.46, 0.76, 0.20),
    (0.63, 0.70, 0.15), (0.79, 0.65, 0.09),
]
radial = 32
body_vertices = []
for x, half_height, half_thickness in sections:
    for i in range(radial):
        angle = 2 * math.pi * i / radial
        body_vertices.append((x, half_thickness * math.sin(angle), half_height * math.cos(angle)))
body_faces = []
for ring in range(len(sections) - 1):
    for i in range(radial):
        nxt = (i + 1) % radial
        body_faces.append((ring * radial + i, ring * radial + nxt,
                           (ring + 1) * radial + nxt, (ring + 1) * radial + i))
body_faces.append(tuple(range(radial - 1, -1, -1)))
body_faces.append(tuple((len(sections) - 1) * radial + i for i in range(radial)))
body = mesh_object("Sunfish_Disc_Truncated", body_vertices, body_faces, skin)
colors = body.data.color_attributes.new(name="MolaColor", type="FLOAT_COLOR", domain="CORNER")
center = (0.055, 0.080, 0.087)
back = (0.038, 0.060, 0.066)
belly = (0.075, 0.102, 0.105)
for polygon in body.data.polygons:
    for loop_index in polygon.loop_indices:
        point = body.data.vertices[body.data.loops[loop_index].vertex_index].co
        blend = min(1, abs(point.z) / 0.83) * 0.62
        endpoint = back if point.z >= 0 else belly
        value = tuple(center[i] * (1 - blend) + endpoint[i] * blend for i in range(3))
        colors.data[loop_index].color = (*value, 1.0)
body.modifiers.new("Smoothed body normals", "WEIGHTED_NORMAL")

# Tall opposed fins are behind the body midpoint, as in a side profile.
profile_fin("Sunfish_Dorsal_Fin", [
    (0.19, 0.73), (0.27, 1.14), (0.39, 1.57), (0.49, 1.72),
    (0.59, 1.64), (0.62, 1.28), (0.66, 0.69),
], 0.095, fin_mat, pivot=(0.43, 0.77))
profile_fin("Sunfish_Anal_Fin", [
    (0.20, -0.72), (0.28, -1.10), (0.40, -1.52), (0.50, -1.66),
    (0.60, -1.58), (0.63, -1.21), (0.67, -0.68),
], 0.09, fin_mat, pivot=(0.44, -0.76))

# A rounded, scalloped clavus closes the truncated rear; there is no tail fin.
profile_fin("Sunfish_Clavus", [
    (0.76, 0.63), (0.91, 0.60), (0.94, 0.45), (0.90, 0.31),
    (0.98, 0.16), (0.92, 0.01), (0.99, -0.16), (0.91, -0.31),
    (0.95, -0.46), (0.88, -0.61), (0.76, -0.65),
], 0.085, edge, pivot=(0.78, 0))

# The near-side pectoral, eye and mouth sit in front of the body surface.
profile_fin("Sunfish_Pectoral_Fin", [
    (-0.28, 0.07), (0.02, 0.08), (0.29, -0.22),
    (0.20, -0.35), (-0.20, -0.22),
], 0.035, fin_mat, pivot=(-0.23, 0.02), depth=-0.25)
ellipsoid("Sunfish_Eye_Rim", (-0.70, -0.18, 0.18), (0.095, 0.024, 0.083), eye_ring)
ellipsoid("Sunfish_Eye", (-0.70, -0.205, 0.18), (0.057, 0.017, 0.055), eye_black)
ellipsoid("Sunfish_Mouth", (-1.015, -0.052, -0.10), (0.040, 0.035, 0.045), mouth_mat)

SOURCE.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_yup=True,
                          export_apply=True, export_vertex_color="MATERIAL")
print("CREATED", SOURCE, OUTPUT)
