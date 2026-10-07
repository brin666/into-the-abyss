"""Remove the bright rear-cap seam from the v3 Mola and preserve v3 rollback."""

import bpy
import bmesh
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/blender/surface-40-80/ocean-sunfish-v3.blend"
BLEND = ROOT / "assets/blender/surface-40-80/ocean-sunfish-v4.blend"
GLB = ROOT / "public/models/surface-40-80/ocean-sunfish-v4.glb"

bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
body = bpy.data.objects["Sunfish_Disc_Truncated"]
mesh = bmesh.new()
mesh.from_mesh(body.data)
mesh.faces.ensure_lookup_table()
rear_caps = [face for face in mesh.faces
             if all(vertex.co.x > 0.78 for vertex in face.verts)]
if not 1 <= len(rear_caps) <= 80:
    raise RuntimeError(f"Expected a small set of rear-cap faces; found {len(rear_caps)}")
bmesh.ops.delete(mesh, geom=rear_caps, context="FACES")
mesh.to_mesh(body.data)
mesh.free()
body.data.update()

# The clavus overlaps and closes the open edge. Widen its near/far surfaces
# slightly so the disc does not peep through at oblique viewing angles.
clavus = bpy.data.objects["Sunfish_Clavus"]
for vertex in clavus.data.vertices:
    vertex.co.y *= 1.22

BLEND.parent.mkdir(parents=True, exist_ok=True)
GLB.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(BLEND))
bpy.ops.export_scene.gltf(filepath=str(GLB), export_format="GLB", export_yup=True,
                          export_apply=True, export_vertex_color="MATERIAL")
print("CREATED", BLEND, GLB, "removed_rear_caps", len(rear_caps))
