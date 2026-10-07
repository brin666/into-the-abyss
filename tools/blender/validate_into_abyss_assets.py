import json
from pathlib import Path

import bpy


PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = PROJECT_ROOT / "build" / "blender" / "asset_validation.json"

ASSETS = {
    "fisherman": ("public/models/fisherman.glb", "Fisherman_Root"),
    "baitfish_school": ("public/models/baitfish_school.glb", "BaitfishSchool_Root"),
    "green_sea_turtle": ("public/models/green_sea_turtle.glb", "GreenSeaTurtle_Root"),
    "moon_jelly_cluster": ("public/models/moon_jelly_cluster.glb", "MoonJellyCluster_Root"),
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def validate_asset(asset_id, relative_path, expected_root):
    reset_scene()
    source = PROJECT_ROOT / relative_path
    bpy.ops.import_scene.gltf(filepath=str(source))

    objects = list(bpy.context.scene.objects)
    meshes = [obj for obj in objects if obj.type == "MESH"]
    roots = [obj for obj in objects if obj.name == expected_root]
    material_names = sorted(
        {
            slot.material.name
            for obj in meshes
            for slot in obj.material_slots
            if slot.material is not None
        }
    )
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    triangles = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)

    if len(roots) != 1:
        raise RuntimeError(f"{asset_id}: expected one {expected_root}, found {len(roots)}")
    if not meshes or vertices <= 0 or triangles <= 0:
        raise RuntimeError(f"{asset_id}: GLB contains no renderable geometry")

    return {
        "file": relative_path,
        "bytes": source.stat().st_size,
        "root_node": expected_root,
        "root_type": roots[0].type,
        "objects": len(objects),
        "mesh_objects": len(meshes),
        "vertices_after_import": vertices,
        "triangles_after_import": triangles,
        "materials": material_names,
        "named_parts": sorted(obj.name for obj in objects),
        "status": "pass",
    }


def main():
    results = {
        "blender_version": bpy.app.version_string,
        "loader": "bpy.ops.import_scene.gltf",
        "assets": {},
    }
    for asset_id, (relative_path, expected_root) in ASSETS.items():
        results["assets"][asset_id] = validate_asset(asset_id, relative_path, expected_root)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
