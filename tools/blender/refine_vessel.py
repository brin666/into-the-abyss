"""Refine the existing skiff/rig candidate without touching the source GLB.

Usage: blender -b --python tools/blender/refine_vessel.py -- input.glb output.blend output.glb
"""

import json
import os
import sys

import bpy
from mathutils import Matrix, Vector


def material_points(rod, material_name):
    slots = {
        index for index, slot in enumerate(rod.material_slots)
        if slot.material and material_name in slot.material.name
    }
    if not slots:
        raise RuntimeError(f"{material_name} material missing")

    evaluated = rod.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {
        index
        for polygon in mesh.polygons if polygon.material_index in slots
        for index in polygon.vertices
    }
    if not indices:
        evaluated.to_mesh_clear()
        raise RuntimeError(f"{material_name} has no vertices")

    points = [rod.matrix_world @ mesh.vertices[index].co for index in indices]
    evaluated.to_mesh_clear()
    return points


def cork_center(rod):
    points = material_points(rod, "Cork")
    return sum(points, Vector()) / len(points)


input_glb, output_blend, output_glb = sys.argv[sys.argv.index("--") + 1:]
for output in (output_blend, output_glb):
    if os.path.exists(output):
        raise RuntimeError(f"Refusing to overwrite existing candidate: {output}")

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_glb)
for helper in (obj for obj in list(bpy.data.objects) if obj.name.startswith("Icosphere")):
    bpy.data.objects.remove(helper, do_unlink=True)

armature = bpy.data.objects["Fisherman_Armature"]
rod = bpy.data.objects["Fisherman_Rod"]
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()

hand = armature.pose.bones["Fisherman_Hand_R"]
hand_grip = armature.matrix_world @ hand.head.lerp(hand.tail, 0.43)
before = cork_center(rod)
for _ in range(4):
    world_offset = hand_grip - cork_center(rod)
    if world_offset.length < 0.012:
        break
    local_offset = rod.matrix_world.inverted().to_3x3() @ world_offset
    for vertex in rod.data.vertices:
        vertex.co += local_offset
    rod.data.update()
    bpy.context.view_layer.update()
after = cork_center(rod)

rod_tip_position = max(material_points(rod, "Carbon"), key=lambda point: (point - after).length)
rod_tip = bpy.data.objects.new("Fisherman_RodTip", None)
bpy.context.scene.collection.objects.link(rod_tip)
rod_tip.parent = armature
rod_tip.parent_type = "BONE"
rod_tip.parent_bone = "Fisherman_RodSocket"
rod_tip.matrix_world = Matrix.Translation(rod_tip_position)
bpy.context.view_layer.update()

# The imported boots sit about 0.3 m above the center deck. Move the rig,
# including its cast action and rod socket, as one unit onto the deck.
armature.location.z -= 0.30
bpy.context.view_layer.update()

bpy.context.scene.frame_start = 0
bpy.context.scene.frame_end = 72
resized_images = []
for image in bpy.data.images:
    if image.source != "FILE" or not image.has_data or max(image.size) <= 1024:
        continue
    image.scale(1024, 1024)
    resized_images.append(image.name)
bpy.ops.wm.save_as_mainfile(filepath=output_blend)
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format="GLB",
    export_animations=True,
    export_apply=False,
    export_image_format="JPEG",
    export_image_quality=82,
)

print("VESSEL_REFINEMENT=" + json.dumps({
    "source": input_glb,
    "blend": output_blend,
    "glb": output_glb,
    "rodGripBefore": [round(value, 4) for value in before],
    "rightHandTarget": [round(value, 4) for value in hand_grip],
    "rodGripAfter": [round(value, 4) for value in after],
    "remainingGripDistance": round((after - hand_grip).length, 4),
    "rodTip": [round(value, 4) for value in rod_tip_position],
    "resizedImages": resized_images,
    "rigDeckAdjustment": -0.30,
}))
