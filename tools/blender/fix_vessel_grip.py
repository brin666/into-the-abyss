"""Bake rod-socket contact corrections into a new, non-destructive vessel GLB.

Usage: blender -b --python tools/blender/fix_vessel_grip.py -- input.glb output.blend output.glb
"""

import json
import os
import sys

import bpy
from mathutils import Vector


def material_points(obj, keyword):
    slots = {
        index for index, slot in enumerate(obj.material_slots)
        if slot.material and keyword in slot.material.name
    }
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {
        index for face in mesh.polygons if face.material_index in slots
        for index in face.vertices
    }
    points = [obj.matrix_world @ mesh.vertices[index].co for index in indices]
    evaluated.to_mesh_clear()
    return points


def cork_center(obj):
    points = material_points(obj, "Cork")
    return sum(points, Vector()) / len(points)


def visible_hand_center(obj, group_name):
    group = obj.vertex_groups.get(group_name)
    if not group:
        raise RuntimeError(f"Missing vertex group: {group_name}")
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = []
    for index, vertex in enumerate(obj.data.vertices):
        weight = next((item.weight for item in vertex.groups if item.group == group.index), 0)
        if weight >= 0.5:
            indices.append(index)
    points = [obj.matrix_world @ mesh.vertices[index].co for index in indices]
    evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError("Visible hand has no weighted vertices")
    return sum(points, Vector()) / len(points)


arguments = sys.argv[sys.argv.index("--") + 1:]
input_glb, output_blend, output_glb = arguments[:3]
target_mode = arguments[3] if len(arguments) > 3 else "bone"
if target_mode not in ("bone", "visible-hand"):
    raise RuntimeError(f"Unknown target mode: {target_mode}")
for path in (output_blend, output_glb):
    if os.path.exists(path):
        raise RuntimeError(f"Refusing to overwrite existing candidate: {path}")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_glb)
for obj in list(bpy.data.objects):
    if obj.name.startswith("Icosphere"):
        bpy.data.objects.remove(obj, do_unlink=True)
rig = bpy.data.objects["Fisherman_Armature"]
rod = bpy.data.objects["Fisherman_Rod"]
body = bpy.data.objects["Fisherman_Body"]
socket = rig.pose.bones["Fisherman_RodSocket"]
hand = rig.pose.bones["Fisherman_Hand_R"]
inverse_rig_rotation = rig.matrix_world.inverted().to_3x3()
samples = []

# Bake the contact trajectory at the clip's authored 24 fps. Socket rotation
# remains authored; only translation changes so the cast silhouette is intact.
for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    target = visible_hand_center(body, "Fisherman_Hand_R") if target_mode == "visible-hand" else rig.matrix_world @ hand.head.lerp(hand.tail, 0.43)
    before = (target - cork_center(rod)).length
    for _ in range(3):
        offset = target - cork_center(rod)
        if offset.length < 0.002:
            break
        transformed = socket.matrix.copy()
        transformed.translation += inverse_rig_rotation @ offset
        socket.matrix = transformed
        bpy.context.view_layer.update()
    after = (target - cork_center(rod)).length
    socket.keyframe_insert(data_path="location", frame=frame, group="Fisherman_RodSocket")
    samples.append({"frame": frame, "before": round(before, 4), "after": round(after, 4)})

if max(item["after"] for item in samples) > 0.018:
    raise RuntimeError(f"Rod grip contact remains too loose: {max(item['after'] for item in samples)} m")

bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 72
bpy.ops.wm.save_as_mainfile(filepath=output_blend)
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format="GLB",
    export_animations=True,
    export_apply=False,
    export_image_format="JPEG",
    export_image_quality=82,
)
print("GRIP_FIX=" + json.dumps({
    "source": input_glb,
    "targetMode": target_mode,
    "blend": output_blend,
    "glb": output_glb,
    "maxBeforeM": max(item["before"] for item in samples),
    "maxAfterM": max(item["after"] for item in samples),
    "samples": [samples[frame] for frame in (0, 9, 18, 24, 30, 39, 48, 60, 72)],
}))
