"""Print geometry and loose-island information for a GLB in Blender.

Usage: blender -b --python tools/blender/inspect_glb.py -- path/to/model.glb
"""

import json
import sys

import bpy


def bounds(points):
    return {
        "min": [round(min(point[axis] for point in points), 4) for axis in range(3)],
        "max": [round(max(point[axis] for point in points), 4) for axis in range(3)],
    }


def inspect_mesh(obj):
    mesh = obj.data
    parent = list(range(len(mesh.vertices)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    for edge in mesh.edges:
        a, b = edge.vertices
        parent[find(b)] = find(a)

    islands = {}
    for vertex in mesh.vertices:
        island = islands.setdefault(find(vertex.index), [])
        island.append(tuple(obj.matrix_world @ vertex.co))

    return {
        "name": obj.name,
        "parent": obj.parent.name if obj.parent else None,
        "worldTranslation": [round(value, 4) for value in obj.matrix_world.translation],
        "worldRotation": [round(value, 4) for value in obj.matrix_world.to_euler()],
        "worldScale": [round(value, 4) for value in obj.matrix_world.to_scale()],
        "vertices": len(mesh.vertices),
        "faces": len(mesh.polygons),
        "materials": [material.name for material in mesh.materials if material],
        "bounds": bounds([tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices]),
        "islands": [
            {"vertices": len(points), "bounds": bounds(points)}
            for points in sorted(islands.values(), key=len, reverse=True)[:12]
        ],
        "islandCount": len(islands),
    }


asset_path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=asset_path)
bpy.context.view_layer.update()
report = {
    "path": asset_path,
    "objects": [inspect_mesh(obj) for obj in bpy.data.objects if obj.type == "MESH"],
    "actions": [action.name for action in bpy.data.actions],
}
report["rigSamples"] = []
tracked_bones = (
    "Fisherman_Hand_L", "Fisherman_Hand_R", "Fisherman_RodSocket",
    "Fisherman_Foot_L", "Fisherman_Foot_R",
)
for frame in (0, 24, 39, 72):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    for armature in (obj for obj in bpy.data.objects if obj.type == "ARMATURE"):
        bones = {}
        for bone_name in tracked_bones:
            bone = armature.pose.bones.get(bone_name)
            if bone:
                head = armature.matrix_world @ bone.head
                tail = armature.matrix_world @ bone.tail
                bones[bone_name] = {
                    "head": [round(value, 4) for value in head],
                    "tail": [round(value, 4) for value in tail],
                }
        report["rigSamples"].append({"frame": frame, "armature": armature.name, "bones": bones})
print("ASSET_INSPECTION=" + json.dumps(report))
