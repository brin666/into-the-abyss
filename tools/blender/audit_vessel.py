"""Measure skiff cast contact and rig continuity on an exported GLB.

Usage: blender -b --python tools/blender/audit_vessel.py -- asset.glb
"""

import json
import sys

import bpy
from mathutils import Vector


def points_by_material(obj, keyword):
    indices = {
        index for index, slot in enumerate(obj.material_slots)
        if slot.material and keyword in slot.material.name
    }
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertex_indices = {
        index for face in mesh.polygons if face.material_index in indices
        for index in face.vertices
    }
    points = [obj.matrix_world @ mesh.vertices[index].co for index in vertex_indices]
    evaluated.to_mesh_clear()
    return points


def closest_distance(point, points):
    return min((point - other).length for other in points)


def skinned_group_center(obj, group_name):
    group = obj.vertex_groups.get(group_name)
    if not group:
        return None
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    group_indices = []
    for index, vertex in enumerate(obj.data.vertices):
        weight = next((item.weight for item in vertex.groups if item.group == group.index), 0)
        if weight >= 0.5:
            group_indices.append(index)
    points = [obj.matrix_world @ mesh.vertices[index].co for index in group_indices]
    evaluated.to_mesh_clear()
    return sum(points, Vector()) / len(points) if points else None


source = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=source)
rig = bpy.data.objects["Fisherman_Armature"]
rod = bpy.data.objects["Fisherman_Rod"]
body = bpy.data.objects["Fisherman_Body"]
marker = bpy.data.objects["Fisherman_RodTip"]
data = []
for frame in (0, 9, 18, 24, 30, 39, 48, 60, 72):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    hand = rig.pose.bones["Fisherman_Hand_R"]
    grip = rig.matrix_world @ hand.head.lerp(hand.tail, 0.43)
    cork = points_by_material(rod, "Cork")
    carbon = points_by_material(rod, "Carbon")
    cork_center = sum(cork, Vector()) / len(cork)
    far_tip = max(carbon, key=lambda point: (point - cork_center).length)
    marker_world = marker.matrix_world.translation
    visible_hand_center = skinned_group_center(body, "Fisherman_Hand_R")
    data.append({
        "frame": frame,
        "handGripToCorkCenterM": round((grip - cork_center).length, 4),
        "handGripToCorkNearestM": round(closest_distance(grip, cork), 4),
        "tipMarkerToCarbonTipM": round((marker_world - far_tip).length, 4),
        "handBoneToVisibleHandM": round((grip - visible_hand_center).length, 4) if visible_hand_center else None,
        "hand": [round(v, 3) for v in grip],
        "cork": [round(v, 3) for v in cork_center],
        "tip": [round(v, 3) for v in far_tip],
        "visibleHand": [round(v, 3) for v in visible_hand_center] if visible_hand_center else None,
    })
print("VESSEL_AUDIT=" + json.dumps(data))
