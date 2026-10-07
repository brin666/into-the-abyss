"""Re-seat the v10 cork in the full visible palm, preserving v10 for rollback.

This does not add finger bones or claim a fully closed grip. It corrects the
v10 fingertip-only contact target and requires separate close-up inspection.
"""

import bpy
from mathutils import Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "lux3d-delivery/into-the-abyss-vessel-20261003/assembly"
SOURCE = ASSETS / "boat-fisherman-cast-v10.blend"
OUTPUT_BLEND = ASSETS / "boat-fisherman-cast-v11.blend"
OUTPUT_GLB = ASSETS / "boat-fisherman-cast-v11.glb"
for target in (OUTPUT_BLEND, OUTPUT_GLB):
    if target.exists():
        raise RuntimeError(f"Refusing to overwrite candidate: {target}")

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = bpy.data.objects["Fisherman_Armature"]
rod = bpy.data.objects["Fisherman_Rod"]
body = bpy.data.objects["Fisherman_Body"]
marker = bpy.data.objects["Fisherman_RodTip"]
socket = rig.pose.bones["Fisherman_RodSocket"]


def cork_center():
    slots = {i for i, material in enumerate(rod.data.materials) if "Cork" in material.name}
    evaluated = rod.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {i for polygon in mesh.polygons if polygon.material_index in slots for i in polygon.vertices}
    points = [rod.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError("Cork material vertices unavailable")
    return sum(points, Vector()) / len(points)


def palm_center():
    group = body.vertex_groups["Fisherman_Hand_R"]
    indices = [vertex.index for vertex in body.data.vertices
               if any(weight.group == group.index and weight.weight >= 0.40 for weight in vertex.groups)]
    if len(indices) < 100:
        raise RuntimeError(f"Hand sampling too sparse: {len(indices)}")
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [body.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points)


samples = []
for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    before = (palm_center() - cork_center()).length
    for _ in range(5):
        offset = palm_center() - cork_center()
        if offset.length < 0.002:
            break
        adjusted = socket.matrix.copy()
        adjusted.translation += rig.matrix_world.inverted().to_3x3() @ offset
        socket.matrix = adjusted
        bpy.context.view_layer.update()
    after = (palm_center() - cork_center()).length
    socket.keyframe_insert(data_path="location", frame=frame, group="Fisherman_RodSocket")
    if frame in (0, 7, 18, 24, 28, 34, 40, 48, 72):
        samples.append((frame, round(before, 4), round(after, 4),
                        tuple(round(c, 3) for c in marker.matrix_world.translation)))

if max(sample[2] for sample in samples) > 0.02:
    raise RuntimeError(f"Palm/cork contact too far apart: {samples}")

bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 72
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT_GLB), export_format="GLB",
                          export_animations=True, export_apply=False,
                          export_image_format="JPEG", export_image_quality=82)
print("CAST_V11_PALM_SAMPLES", samples)
