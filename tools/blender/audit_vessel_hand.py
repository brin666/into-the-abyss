"""Read-only geometry audit for the right-hand/rod grip of the v10 vessel."""
import bpy
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / "lux3d-delivery/into-the-abyss-vessel-20261003/assembly/boat-fisherman-cast-v10.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))
body = bpy.data.objects["Fisherman_Body"]
rod = bpy.data.objects["Fisherman_Rod"]
hand = body.vertex_groups["Fisherman_Hand_R"]
bpy.context.scene.frame_set(0)
bpy.context.view_layer.update()
ids = [v.index for v in body.data.vertices if any(g.group == hand.index and g.weight >= 0.5 for g in v.groups)]
mesh = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh()
world = [body.matrix_world @ mesh.vertices[i].co for i in ids]
report = {
    "bodyMaterials": [(i, m.name) for i, m in enumerate(body.data.materials)],
    "rodMaterials": [(i, m.name) for i, m in enumerate(rod.data.materials)],
    "weightedHandVertices": len(ids),
    "handBoundsWorld": {
        "min": [round(min(v[a] for v in world), 4) for a in range(3)],
        "max": [round(max(v[a] for v in world), 4) for a in range(3)],
    },
    "samples": [(i, [round(c, 4) for c in body.data.vertices[i].co],
                 [round(c, 4) for c in body.matrix_world @ mesh.vertices[i].co]) for i in ids[:50]],
}
center = sum(world, world[0].copy() * 0) / len(world)
near = []
for vertex in body.data.vertices:
    point = body.matrix_world @ mesh.vertices[vertex.index].co
    if (point - center).length > 0.16:
        continue
    weighted = sorted(((body.vertex_groups[g.group].name, round(g.weight, 3)) for g in vertex.groups),
                      key=lambda item: -item[1])
    near.append((vertex.index, [round(c, 3) for c in point], weighted[:2]))
report["nearbyVertices"] = len(near)
report["nearbySamples"] = near[:80]
for threshold in (0.3, 0.4, 0.5):
    selected = [v.index for v in body.data.vertices
                if any(g.group == hand.index and g.weight >= threshold for g in v.groups)]
    points = [body.matrix_world @ mesh.vertices[i].co for i in selected]
    report[f"handWeightAtLeast{threshold}"] = {
        "vertices": len(points),
        "center": [round(sum(p[a] for p in points) / len(points), 4) for a in range(3)],
        "min": [round(min(p[a] for p in points), 4) for a in range(3)],
        "max": [round(max(p[a] for p in points), 4) for a in range(3)],
    }
body.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
print("HAND_GEOMETRY=" + json.dumps(report))
