"""Try an outboard right-arm swing to clear the body without touching v11.

Candidate only until Blender collision and real browser preview both pass.
"""

import bpy
import math
import sys
from mathutils import Quaternion, Vector
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "lux3d-delivery/into-the-abyss-vessel-20261003/assembly"
SOURCE = ASSETS / "boat-fisherman-cast-v11.blend"
version = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "v12"
if version not in ("v12", "v13", "v14", "v15", "v16", "v17"):
    raise RuntimeError(f"Unexpected candidate version: {version}")
OUTPUT_BLEND = ASSETS / f"boat-fisherman-cast-{version}.blend"
OUTPUT_GLB = ASSETS / f"boat-fisherman-cast-{version}.glb"
for target in (OUTPUT_BLEND, OUTPUT_GLB):
    if target.exists():
        raise RuntimeError(f"Refusing to overwrite candidate: {target}")
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))

rig = bpy.data.objects["Fisherman_Armature"]
body = bpy.data.objects["Fisherman_Body"]
rod = bpy.data.objects["Fisherman_Rod"]
shoulder = rig.pose.bones["Fisherman_Shoulder_R"]
socket = rig.pose.bones["Fisherman_RodSocket"]
rig_rotation = rig.matrix_world.to_quaternion()


def arm_angle(frame):
    if version not in ("v14", "v15", "v17"):
        return 20.0
    middle = 42.0 if version == "v14" else 10.0 if version == "v15" else 60.0
    knots = ((0, 20.0), (7, middle), (18, 20.0), (72, 20.0))
    for left, right in zip(knots, knots[1:]):
        if left[0] <= frame <= right[0]:
            fraction = (frame - left[0]) / (right[0] - left[0])
            smooth = fraction * fraction * (3 - 2 * fraction)
            return left[1] + (right[1] - left[1]) * smooth
    return 20.0


def backswing_yaw(frame):
    if version != "v16":
        return 0.0
    if frame <= 7:
        fraction = frame / 7
    elif frame <= 18:
        fraction = (18 - frame) / 11
    else:
        return 0.0
    fraction = max(0.0, min(1.0, fraction))
    return -35.0 * fraction * fraction * (3 - 2 * fraction)


def cork_center():
    slots = {i for i, material in enumerate(rod.data.materials) if "Cork" in material.name}
    evaluated = rod.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {i for polygon in mesh.polygons if polygon.material_index in slots for i in polygon.vertices}
    points = [rod.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points)


def palm_center():
    group = body.vertex_groups["Fisherman_Hand_R"]
    indices = [vertex.index for vertex in body.data.vertices
               if any(weight.group == group.index and weight.weight >= 0.4 for weight in vertex.groups)]
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [body.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points)


samples = []
source_shoulder_matrices = []
for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    source_shoulder_matrices.append(shoulder.matrix.copy())

for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    original = source_shoulder_matrices[frame]
    world_rotation = (Quaternion((0, 0, 1), math.radians(backswing_yaw(frame)))
                      @ Quaternion((0, 1, 0), math.radians(arm_angle(frame))))
    local_rotation = rig_rotation.inverted() @ world_rotation @ rig_rotation
    adjusted = local_rotation.to_matrix().to_4x4() @ original
    adjusted.translation = original.translation
    shoulder.matrix = adjusted
    shoulder.keyframe_insert(data_path="rotation_quaternion", frame=frame, group="Fisherman_Shoulder_R")
    bpy.context.view_layer.update()

    for _ in range(5):
        offset = palm_center() - cork_center()
        if offset.length < 0.002:
            break
        adjusted_socket = socket.matrix.copy()
        adjusted_socket.translation += rig.matrix_world.inverted().to_3x3() @ offset
        socket.matrix = adjusted_socket
        bpy.context.view_layer.update()
    socket.keyframe_insert(data_path="location", frame=frame, group="Fisherman_RodSocket")
    if frame in (0, 7, 18, 24, 28, 34, 40, 48, 72):
        samples.append((frame, round((palm_center() - cork_center()).length, 4),
                        tuple(round(c, 3) for c in cork_center())))

if max(item[1] for item in samples) > 0.02:
    raise RuntimeError(f"Candidate palm contact failed: {samples}")
bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 72
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT_BLEND))
bpy.ops.export_scene.gltf(filepath=str(OUTPUT_GLB), export_format="GLB",
                          export_animations=True, export_apply=False,
                          export_image_format="JPEG", export_image_quality=82)
print("CAST_ARM_SAMPLES", version, samples)
