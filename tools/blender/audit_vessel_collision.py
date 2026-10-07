"""Read-only screen-independent check for rod centreline crossing the torso.

This is a narrow geometric test. It does not establish that hands, railings,
clothing, reel, line, or all rendered pixels are free of penetration.
"""

import bpy
import json
import sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(sys.argv[sys.argv.index("--") + 1]) if "--" in sys.argv else \
    ROOT / "lux3d-delivery/into-the-abyss-vessel-20261003/assembly/boat-fisherman-cast-v11.blend"
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body = bpy.data.objects["Fisherman_Body"]
rod = bpy.data.objects["Fisherman_Rod"]
torso_groups = {body.vertex_groups[name].index for name in ("Fisherman_Chest", "Fisherman_Spine", "Fisherman_Pelvis")}


def material_points(keyword):
    slots = {i for i, material in enumerate(rod.data.materials) if keyword in material.name}
    evaluated = rod.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    indices = {i for face in mesh.polygons if face.material_index in slots for i in face.vertices}
    points = [rod.matrix_world @ mesh.vertices[i].co for i in indices]
    evaluated.to_mesh_clear()
    return points


def torso_bvh():
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    coords = [body.matrix_world @ vertex.co for vertex in mesh.vertices]
    faces = []
    originals = []
    for polygon in mesh.polygons:
        scores = []
        for index in polygon.vertices:
            scores.append(sum(group.weight for group in body.data.vertices[index].groups
                              if group.group in torso_groups))
        if sum(score >= 0.35 for score in scores) >= len(scores) - 1:
            faces.append(tuple(polygon.vertices))
            originals.append(polygon.index)
    evaluated.to_mesh_clear()
    return BVHTree.FromPolygons(coords, faces, all_triangles=False), originals


samples = []
for frame in range(73):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    cork = material_points("Cork")
    center = sum(cork, Vector()) / len(cork)
    carbon = material_points("Carbon")
    tip = max(carbon, key=lambda point: (point - center).length)
    direction = tip - center
    bvh, originals = torso_bvh()
    hit, normal, face, distance = bvh.ray_cast(center, direction.normalized(), direction.length)
    hit_groups = None
    if hit is not None:
        polygon = body.data.polygons[originals[face]]
        summary = {}
        for vertex_index in polygon.vertices:
            for weight in body.data.vertices[vertex_index].groups:
                name = body.vertex_groups[weight.group].name
                summary[name] = summary.get(name, 0.0) + weight.weight / len(polygon.vertices)
        hit_groups = sorted(((name, round(value, 3)) for name, value in summary.items()),
                            key=lambda item: -item[1])[:4]
    alternatives = []
    if hit is not None:
        for x in (-1.0, -0.8, -0.6, -0.4, -0.2, 0.0, 0.2, 0.4):
            for y in (-1.0, -0.8, -0.6, -0.4, 0.2, 0.4, 0.6, 0.8, 1.0):
                for z in (0.15, 0.35, 0.55, 0.75):
                    candidate = Vector((x, y, z)).normalized()
                    candidate_hit = bvh.ray_cast(center, candidate, direction.length)[0]
                    if candidate_hit is None:
                        alternatives.append((round(candidate.angle(direction), 3),
                                             [round(c, 2) for c in candidate]))
        alternatives.sort(key=lambda item: item[0])
    samples.append({"frame": frame, "torsoFaces": len(originals),
                    "torsoIntersection": hit is not None,
                    "hitDistanceM": round(distance, 4) if hit is not None else None,
                    "hitPoint": [round(c, 3) for c in hit] if hit is not None else None,
                    "hitGroups": hit_groups,
                    "corkCenter": [round(c, 3) for c in center],
                    "rodLengthM": round(direction.length, 4),
                    "safeDirections": alternatives[:6]})

print("VESSEL_TORSO_COLLISION=" + json.dumps(samples))
