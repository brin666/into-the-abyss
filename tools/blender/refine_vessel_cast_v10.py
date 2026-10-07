"""Re-aim the v09 rod arc while retaining the rig, hand contact, and backups.

Run: blender -b --factory-startup --python tools/blender/refine_vessel_cast_v10.py
Never overwrites existing v10 output; inspect in candidate-review before use.
"""

import bpy
from mathutils import Matrix, Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "lux3d-delivery" / "into-the-abyss-vessel-20261003" / "assembly"
SOURCE = ASSETS / "boat-fisherman-cast-v09.blend"
OUTPUT_BLEND = ASSETS / "boat-fisherman-cast-v10.blend"
OUTPUT_GLB = ASSETS / "boat-fisherman-cast-v10.glb"
for target in (OUTPUT_BLEND, OUTPUT_GLB):
    if target.exists():
        raise RuntimeError(f"Refusing to overwrite candidate: {target}")

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = bpy.data.objects["Fisherman_Armature"]
rod = bpy.data.objects["Fisherman_Rod"]
body = bpy.data.objects["Fisherman_Body"]
marker = bpy.data.objects["Fisherman_RodTip"]
socket = rig.pose.bones["Fisherman_RodSocket"]
if socket.rotation_mode != "QUATERNION":
    raise RuntimeError("Unexpected socket rotation mode")


def material_points(obj, keyword):
    slots = {i for i, slot in enumerate(obj.material_slots)
             if slot.material and keyword in slot.material.name}
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {i for face in mesh.polygons if face.material_index in slots for i in face.vertices}
    points = [obj.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    if not points:
        raise RuntimeError(f"Missing {keyword} mesh vertices")
    return points


def visible_hand_center():
    group = body.vertex_groups.get("Fisherman_Hand_R")
    if group is None:
        raise RuntimeError("Visible right hand has no vertex group")
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = [index for index, vertex in enumerate(body.data.vertices)
               if any(weight.group == group.index and weight.weight >= 0.5 for weight in vertex.groups)]
    points = [body.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points)


def cork_center():
    points = material_points(rod, "Cork")
    return sum(points, Vector()) / len(points)


def rod_tip():
    cork = cork_center()
    return max(material_points(rod, "Carbon"), key=lambda point: (point - cork).length)


knots = [
    (0, Vector((-0.08, -0.99, 0.13))),
    (7, Vector((-0.04, -0.62, 0.78))),
    (20, Vector((0.02, 0.32, 0.95))),
    (28, Vector((0.02, 0.56, 0.83))),
    (34, Vector((0.02, -0.12, 0.99))),
    (40, Vector((-0.03, -0.91, 0.41))),
    (48, Vector((-0.08, -0.99, 0.13))),
    (72, Vector((-0.08, -0.99, 0.13))),
]


def target_direction(frame):
    for left, right in zip(knots, knots[1:]):
        if left[0] <= frame <= right[0]:
            raw = (frame - left[0]) / (right[0] - left[0])
            t = raw * raw * (3 - 2 * raw)
            return left[1].lerp(right[1], t).normalized()
    return knots[-1][1].normalized()


inverse_rig_rotation = rig.matrix_world.inverted().to_quaternion()
samples = []
for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()

    current_direction = (rod_tip() - cork_center()).normalized()
    desired = target_direction(frame)
    world_delta = current_direction.rotation_difference(desired)
    local_delta = inverse_rig_rotation @ world_delta @ rig.matrix_world.to_quaternion()
    original = socket.matrix.copy()
    adjusted = local_delta.to_matrix().to_4x4() @ original
    adjusted.translation = original.translation
    socket.matrix = adjusted
    bpy.context.view_layer.update()

    # Rotate around the socket, then move the cork back onto the actual
    # skinned palm, not an armature helper that can be offset from its mesh.
    for _ in range(5):
        offset = visible_hand_center() - cork_center()
        if offset.length < 0.002:
            break
        adjusted = socket.matrix.copy()
        adjusted.translation += rig.matrix_world.inverted().to_3x3() @ offset
        socket.matrix = adjusted
        bpy.context.view_layer.update()

    socket.keyframe_insert(data_path="rotation_quaternion", frame=frame, group="Fisherman_RodSocket")
    socket.keyframe_insert(data_path="location", frame=frame, group="Fisherman_RodSocket")
    if frame in (0, 7, 18, 24, 28, 34, 40, 48, 72):
        grip_error = (visible_hand_center() - cork_center()).length
        tip = rod_tip()
        marker_error = (marker.matrix_world.translation - tip).length
        samples.append((frame, round(grip_error, 4), round(marker_error, 4),
                        tuple(round(value, 3) for value in tip)))

if max(item[1] for item in samples) > 0.025:
    raise RuntimeError(f"Hand lost the rod: {samples}")
if max(item[2] for item in samples) > 0.025:
    raise RuntimeError(f"Rod tip marker detached: {samples}")

bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 72
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT_GLB), export_format="GLB", export_animations=True,
    export_apply=False, export_image_format="JPEG", export_image_quality=82,
)
print("CAST_V10_SAMPLES", samples)
