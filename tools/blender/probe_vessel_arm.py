"""Read-only search for shoulder angles that keep the v11 rod clear of torso.

Reports geometry, not visual acceptability. No Blender/GLB files are changed.
"""

import bpy
import json
import math
from mathutils import Quaternion, Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "lux3d-delivery/into-the-abyss-vessel-20261003/assembly/boat-fisherman-cast-v11.blend"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
rig = bpy.data.objects["Fisherman_Armature"]
body = bpy.data.objects["Fisherman_Body"]
rod = bpy.data.objects["Fisherman_Rod"]
shoulder = rig.pose.bones["Fisherman_Shoulder_R"]
socket = rig.pose.bones["Fisherman_RodSocket"]
hand_group = body.vertex_groups["Fisherman_Hand_R"]
torso_groups = {body.vertex_groups[name].index for name in ("Fisherman_Chest", "Fisherman_Spine", "Fisherman_Pelvis")}
rig_rotation = rig.matrix_world.to_quaternion()


def rod_points(keyword):
    slots = {i for i, material in enumerate(rod.data.materials) if keyword in material.name}
    evaluated = rod.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {index for face in mesh.polygons if face.material_index in slots for index in face.vertices}
    points = [rod.matrix_world @ mesh.vertices[index].co for index in indices]
    evaluated.to_mesh_clear()
    return points


def palm_center():
    indices = [vertex.index for vertex in body.data.vertices
               if any(weight.group == hand_group.index and weight.weight >= 0.4 for weight in vertex.groups)]
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [body.matrix_world @ mesh.vertices[index].co for index in indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points)


def torso_bvh():
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    coords = [body.matrix_world @ vertex.co for vertex in mesh.vertices]
    faces = []
    for polygon in mesh.polygons:
        scores = [sum(group.weight for group in body.data.vertices[index].groups
                      if group.group in torso_groups) for index in polygon.vertices]
        if sum(score >= 0.35 for score in scores) >= len(scores) - 1:
            faces.append(tuple(polygon.vertices))
    evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(coords, faces, all_triangles=False)


report = []
for frame in (0, 7, 8, 9, 10, 11, 12, 13, 18, 32, 33, 40):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    source_shoulder = shoulder.matrix.copy()
    source_socket = socket.matrix_basis.copy()
    options = []
    for degrees in (0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 105, 120):
        shoulder.matrix = source_shoulder
        socket.matrix_basis = source_socket
        bpy.context.view_layer.update()
        world_delta = Quaternion((0, 1, 0), math.radians(degrees))
        local_delta = rig_rotation.inverted() @ world_delta @ rig_rotation
        transformed = local_delta.to_matrix().to_4x4() @ source_shoulder
        transformed.translation = source_shoulder.translation
        shoulder.matrix = transformed
        bpy.context.view_layer.update()
        for _ in range(4):
            cork = rod_points("Cork")
            center = sum(cork, Vector()) / len(cork)
            offset = palm_center() - center
            if offset.length < 0.002:
                break
            moved = socket.matrix.copy()
            moved.translation += rig.matrix_world.inverted().to_3x3() @ offset
            socket.matrix = moved
            bpy.context.view_layer.update()
        cork = rod_points("Cork")
        center = sum(cork, Vector()) / len(cork)
        tip = max(rod_points("Carbon"), key=lambda point: (point - center).length)
        direction = tip - center
        hit = torso_bvh().ray_cast(center, direction.normalized(), direction.length)[0]
        options.append({"degrees": degrees, "cork": [round(c, 3) for c in center], "collision": hit is not None})
    report.append({"frame": frame, "options": options})
print("ARM_SWEEP=" + json.dumps(report))
