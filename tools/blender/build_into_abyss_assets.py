import bpy
import json
import math
from pathlib import Path

from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "assets" / "models" / "blender"
PUBLIC_DIR = ROOT / "public" / "models"
BUILD_DIR = ROOT / "build" / "blender"
BLEND_PATH = SOURCE_DIR / "into_the_abyss_assets.blend"
PREVIEW_PATH = BUILD_DIR / "into_the_abyss_assets_preview.png"
MANIFEST_PATH = BUILD_DIR / "asset_manifest.json"

for directory in (SOURCE_DIR, PUBLIC_DIR, BUILD_DIR):
    directory.mkdir(parents=True, exist_ok=True)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in list(bpy.data.collections):
        if collection.name != "Collection":
            bpy.data.collections.remove(collection)
    base = bpy.data.collections.get("Collection")
    if base:
        base.name = "Preview"


def material(name, color, roughness=0.55, metallic=0.0, alpha=1.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, alpha)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, alpha)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Alpha"].default_value = alpha
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    if alpha < 1.0:
        try:
            mat.surface_render_method = "DITHERED"
        except Exception:
            pass
        mat.use_transparency_overlap = False if hasattr(mat, "use_transparency_overlap") else True
    return mat


def new_collection(name):
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    return collection


def move_to_collection(obj, collection):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    collection.objects.link(obj)


def parent_to(obj, root):
    obj.parent = root


def add_empty(name, collection, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.2
    obj.location = location
    collection.objects.link(obj)
    return obj


def apply_material(obj, mat):
    obj.data.materials.append(mat)


def smooth(obj):
    if hasattr(obj.data, "polygons"):
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def add_uv(name, collection, root, location, scale, mat, rotation=(0, 0, 0), segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=rings,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    smooth(obj)
    apply_material(obj, mat)
    move_to_collection(obj, collection)
    parent_to(obj, root)
    return obj


def add_cylinder(name, collection, root, start, end, radius, mat, vertices=12):
    start_v = Vector(start)
    end_v = Vector(end)
    direction = end_v - start_v
    length = direction.length
    midpoint = (start_v + end_v) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=midpoint)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    apply_material(obj, mat)
    smooth(obj)
    move_to_collection(obj, collection)
    parent_to(obj, root)
    return obj


def add_cone(name, collection, root, location, radius1, radius2, depth, mat, rotation=(0, 0, 0), vertices=16):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    smooth(obj)
    move_to_collection(obj, collection)
    parent_to(obj, root)
    return obj


def add_tri_prism(name, collection, root, points_xz, half_width, mat, offset=(0, 0, 0)):
    ox, oy, oz = offset
    vertices = []
    for y in (-half_width, half_width):
        vertices.extend((x + ox, y + oy, z + oz) for x, z in points_xz)
    faces = [
        (0, 1, 2),
        (5, 4, 3),
        (0, 3, 4, 1),
        (1, 4, 5, 2),
        (2, 5, 3, 0),
    ]
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    apply_material(obj, mat)
    parent_to(obj, root)
    return obj


def add_torus(name, collection, root, location, major_radius, minor_radius, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=24,
        minor_segments=8,
        location=location,
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    apply_material(obj, mat)
    smooth(obj)
    move_to_collection(obj, collection)
    parent_to(obj, root)
    return obj


def add_tentacle(name, collection, root, points, radius, mat):
    curve_data = bpy.data.curves.new(f"{name}_Curve", type="CURVE")
    curve_data.dimensions = "3D"
    curve_data.resolution_u = 2
    curve_data.bevel_depth = radius
    curve_data.bevel_resolution = 2
    spline = curve_data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coordinate in zip(spline.bezier_points, points):
        point.co = coordinate
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve_data)
    collection.objects.link(obj)
    apply_material(obj, mat)
    parent_to(obj, root)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj = bpy.context.object
    obj.name = name
    obj.select_set(False)
    return obj


def make_fisherman(materials):
    collection = new_collection("Fisherman")
    root = add_empty("Fisherman_Root", collection, (-3.0, 1.2, 0.0))
    root["asset_role"] = "surface_fisherman"
    root["height_m"] = 1.76
    root["animation_ready_parts"] = True

    coat = materials["coat"]
    warm = materials["warm"]
    skin = materials["skin"]
    dark = materials["dark"]
    hat = materials["hat"]

    add_cylinder("Fisherman_Leg_L", collection, root, (-0.11, 0.05, 0.18), (-0.11, 0.04, 0.72), 0.085, dark)
    add_cylinder("Fisherman_Leg_R", collection, root, (0.11, -0.05, 0.18), (0.11, -0.04, 0.72), 0.085, dark)
    add_uv("Fisherman_Boot_L", collection, root, (-0.11, -0.055, 0.10), (0.10, 0.17, 0.08), dark, segments=16, rings=10)
    add_uv("Fisherman_Boot_R", collection, root, (0.11, -0.055, 0.10), (0.10, 0.17, 0.08), dark, segments=16, rings=10)
    add_cone("Fisherman_Torso", collection, root, (0, 0, 1.02), 0.30, 0.23, 0.62, coat, vertices=16)
    add_cylinder("Fisherman_Neck", collection, root, (0, 0, 1.34), (0, 0, 1.44), 0.075, skin)
    add_uv("Fisherman_Head", collection, root, (0, 0, 1.58), (0.17, 0.16, 0.21), skin, segments=20, rings=12)
    add_uv("Fisherman_Nose", collection, root, (0, -0.155, 1.59), (0.035, 0.055, 0.035), skin, segments=12, rings=8)
    add_cylinder("Fisherman_Hat_Crown", collection, root, (0, 0, 1.76), (0, 0, 1.86), 0.15, hat, vertices=20)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.24, depth=0.025, location=(0, 0, 1.76))
    brim = bpy.context.object
    brim.name = "Fisherman_Hat_Brim"
    apply_material(brim, hat)
    move_to_collection(brim, collection)
    parent_to(brim, root)

    shoulder_l = (-0.22, 0.0, 1.25)
    elbow_l = (-0.32, -0.20, 1.07)
    hand_l = (-0.18, -0.38, 1.05)
    shoulder_r = (0.22, 0.0, 1.25)
    elbow_r = (0.33, -0.12, 1.13)
    hand_r = (0.20, -0.38, 1.09)
    add_cylinder("Fisherman_UpperArm_L", collection, root, shoulder_l, elbow_l, 0.07, coat)
    add_cylinder("Fisherman_Forearm_L", collection, root, elbow_l, hand_l, 0.06, warm)
    add_cylinder("Fisherman_UpperArm_R", collection, root, shoulder_r, elbow_r, 0.07, coat)
    add_cylinder("Fisherman_Forearm_R", collection, root, elbow_r, hand_r, 0.06, warm)
    add_uv("Fisherman_Hand_L", collection, root, hand_l, (0.07, 0.07, 0.07), skin, segments=12, rings=8)
    add_uv("Fisherman_Hand_R", collection, root, hand_r, (0.07, 0.07, 0.07), skin, segments=12, rings=8)
    add_cylinder("Fisherman_Rod", collection, root, (0.02, -0.36, 1.07), (0.44, -1.36, 1.92), 0.018, dark, vertices=8)
    add_uv("Fisherman_Reel", collection, root, (0.08, -0.49, 1.16), (0.075, 0.04, 0.075), warm, segments=12, rings=8)
    return collection, root


def make_baitfish(materials):
    collection = new_collection("BaitfishSchool")
    root = add_empty("BaitfishSchool_Root", collection, (-2.1, -1.65, 0.75))
    root["asset_role"] = "baitfish_school"
    root["encounter_depth_m"] = "3-8"
    root["animation_ready_parts"] = True
    body_mat = materials["fish_body"]
    fin_mat = materials["fish_fin"]
    eye_mat = materials["eye"]
    offsets = [
        (-0.55, 0.08, 0.15, 1.0),
        (0.02, -0.18, 0.02, 0.82),
        (0.44, 0.12, 0.24, 0.75),
        (0.83, -0.08, -0.08, 0.68),
        (-0.22, 0.30, -0.18, 0.7),
        (0.30, 0.36, -0.28, 0.62),
        (0.92, 0.28, 0.10, 0.58),
    ]
    for index, (x, y, z, size) in enumerate(offsets, start=1):
        prefix = f"Baitfish_{index:02d}"
        add_uv(f"{prefix}_Body", collection, root, (x, y, z), (0.34 * size, 0.105 * size, 0.135 * size), body_mat, segments=16, rings=10)
        add_tri_prism(
            f"{prefix}_Tail",
            collection,
            root,
            [(-0.31 * size, 0), (-0.53 * size, 0.18 * size), (-0.53 * size, -0.18 * size)],
            0.025 * size,
            fin_mat,
            offset=(x, y, z),
        )
        add_tri_prism(
            f"{prefix}_Dorsal",
            collection,
            root,
            [(-0.06 * size, 0.10 * size), (0.11 * size, 0.10 * size), (0.01 * size, 0.23 * size)],
            0.018 * size,
            fin_mat,
            offset=(x, y, z),
        )
        add_uv(f"{prefix}_Eye", collection, root, (x + 0.255 * size, y - 0.09 * size, z + 0.045 * size), (0.025 * size,) * 3, eye_mat, segments=10, rings=6)
    return collection, root


def make_turtle(materials):
    collection = new_collection("GreenSeaTurtle")
    root = add_empty("GreenSeaTurtle_Root", collection, (0.55, -0.15, 0.9))
    root["asset_role"] = "green_sea_turtle"
    root["scientific_name"] = "Chelonia mydas"
    root["body_length_m"] = 1.2
    root["animation_ready_parts"] = True
    shell = materials["shell"]
    shell_dark = materials["shell_dark"]
    shell_light = materials["shell_light"]
    skin = materials["turtle_skin"]
    skin_light = materials["turtle_skin_light"]
    eye = materials["eye"]

    add_uv("Turtle_Shell_Rim", collection, root, (-0.04, 0, 0.11), (0.70, 0.46, 0.18), shell_dark, segments=32, rings=18)
    add_uv("Turtle_Shell_Top", collection, root, (-0.03, 0, 0.20), (0.64, 0.41, 0.22), shell, segments=32, rings=18)
    add_uv("Turtle_Plastron", collection, root, (0.0, 0, -0.01), (0.57, 0.35, 0.10), shell_light, segments=28, rings=16)
    scutes = [
        (-0.32, 0.0, 0.39, 0.18, 0.17),
        (-0.04, 0.0, 0.43, 0.20, 0.18),
        (0.25, 0.0, 0.39, 0.18, 0.17),
        (-0.20, -0.24, 0.34, 0.16, 0.12),
        (-0.20, 0.24, 0.34, 0.16, 0.12),
        (0.16, -0.25, 0.33, 0.15, 0.11),
        (0.16, 0.25, 0.33, 0.15, 0.11),
    ]
    for index, (x, y, z, sx, sy) in enumerate(scutes, start=1):
        add_uv(f"Turtle_Scute_{index:02d}", collection, root, (x, y, z), (sx, sy, 0.018), shell_dark, segments=16, rings=8)
    add_cylinder("Turtle_Neck", collection, root, (0.48, 0, 0.08), (0.70, 0, 0.11), 0.13, skin, vertices=16)
    add_uv("Turtle_Head", collection, root, (0.80, 0, 0.12), (0.23, 0.17, 0.15), skin, segments=24, rings=14)
    add_uv("Turtle_Muzzle", collection, root, (0.98, 0, 0.10), (0.10, 0.13, 0.09), skin_light, segments=18, rings=10)
    add_uv("Turtle_Eye_L", collection, root, (0.88, -0.145, 0.17), (0.035, 0.024, 0.035), eye, segments=12, rings=8)
    add_uv("Turtle_Eye_R", collection, root, (0.88, 0.145, 0.17), (0.035, 0.024, 0.035), eye, segments=12, rings=8)
    add_uv("Turtle_Flipper_FL", collection, root, (0.30, -0.52, 0.02), (0.38, 0.13, 0.055), skin, rotation=(0.0, -0.08, 0.62), segments=22, rings=12)
    add_uv("Turtle_Flipper_FR", collection, root, (0.30, 0.52, 0.02), (0.38, 0.13, 0.055), skin, rotation=(0.0, 0.08, -0.62), segments=22, rings=12)
    add_uv("Turtle_Flipper_RL", collection, root, (-0.50, -0.35, 0.00), (0.23, 0.10, 0.045), skin, rotation=(0.0, -0.04, 0.28), segments=18, rings=10)
    add_uv("Turtle_Flipper_RR", collection, root, (-0.50, 0.35, 0.00), (0.23, 0.10, 0.045), skin, rotation=(0.0, 0.04, -0.28), segments=18, rings=10)
    add_cone("Turtle_Tail", collection, root, (-0.73, 0, 0.0), 0.06, 0.0, 0.20, skin, rotation=(0, -math.pi / 2, 0), vertices=12)
    return collection, root


def create_dome(name, collection, root, center, radius, height, mat):
    segments = 28
    rings = 8
    vertices = [(center[0], center[1], center[2] + height)]
    for ring in range(1, rings + 1):
        theta = (math.pi * 0.5) * (ring / rings)
        ring_radius = math.sin(theta) * radius
        z = center[2] + math.cos(theta) * height
        for segment in range(segments):
            angle = math.tau * segment / segments
            vertices.append((
                center[0] + math.cos(angle) * ring_radius,
                center[1] + math.sin(angle) * ring_radius,
                z,
            ))
    faces = []
    for segment in range(segments):
        faces.append((0, 1 + segment, 1 + (segment + 1) % segments))
    for ring in range(rings - 1):
        current = 1 + ring * segments
        following = current + segments
        for segment in range(segments):
            nxt = (segment + 1) % segments
            faces.append((current + segment, following + segment, following + nxt, current + nxt))
    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    apply_material(obj, mat)
    smooth(obj)
    parent_to(obj, root)
    return obj


def make_jellies(materials):
    collection = new_collection("MoonJellyCluster")
    root = add_empty("MoonJellyCluster_Root", collection, (3.0, -1.0, 0.7))
    root["asset_role"] = "moon_jelly_cluster"
    root["scientific_name"] = "Aurelia spp."
    root["encounter_depth_m"] = "24-32"
    root["animation_ready_parts"] = True
    bell = materials["jelly_bell"]
    inner = materials["jelly_inner"]
    tentacle = materials["jelly_tentacle"]
    instances = [
        (1, (0.0, 0.0, 0.0), 1.0),
        (2, (-0.48, 0.16, -0.28), 0.72),
        (3, (0.52, 0.10, -0.18), 0.82),
    ]
    for index, (ox, oy, oz), size in instances:
        center = (ox, oy, oz)
        create_dome(f"Jelly_{index:02d}_Bell", collection, root, center, 0.28 * size, 0.20 * size, bell)
        for lobe in range(4):
            angle = math.tau * lobe / 4
            add_torus(
                f"Jelly_{index:02d}_Gonad_{lobe + 1}",
                collection,
                root,
                (ox + math.cos(angle) * 0.075 * size, oy + math.sin(angle) * 0.075 * size, oz + 0.075 * size),
                0.035 * size,
                0.009 * size,
                inner,
            )
        for strand in range(6):
            angle = math.tau * strand / 6
            sx = ox + math.cos(angle) * 0.20 * size
            sy = oy + math.sin(angle) * 0.20 * size
            wobble = 0.035 * size * (1 if strand % 2 == 0 else -1)
            points = [
                (sx, sy, oz + 0.01),
                (sx + wobble, sy - wobble, oz - 0.20 * size),
                (sx - wobble, sy + wobble, oz - 0.42 * size),
            ]
            add_tentacle(f"Jelly_{index:02d}_Tentacle_{strand + 1}", collection, root, points, 0.006 * size, tentacle)
    return collection, root


def add_preview_environment(materials, roots):
    preview = bpy.data.collections.get("Preview")
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.08))
    floor = bpy.context.object
    floor.name = "Preview_Ground"
    apply_material(floor, materials["preview_floor"])
    move_to_collection(floor, preview)

    bpy.ops.object.light_add(type="AREA", location=(1.5, -4.0, 7.0))
    key = bpy.context.object
    key.name = "Preview_Key"
    key.data.energy = 1150
    key.data.shape = "DISK"
    key.data.size = 5.5
    key.rotation_euler = (math.radians(22), 0, math.radians(18))
    move_to_collection(key, preview)

    bpy.ops.object.light_add(type="AREA", location=(-5.0, -1.0, 3.0))
    fill = bpy.context.object
    fill.name = "Preview_Fill"
    fill.data.energy = 850
    fill.data.color = (0.35, 0.68, 1.0)
    fill.data.size = 4.0
    fill.rotation_euler = (math.radians(60), 0, math.radians(-70))
    move_to_collection(fill, preview)

    bpy.ops.object.light_add(type="AREA", location=(4.5, 2.0, 4.5))
    rim = bpy.context.object
    rim.name = "Preview_Rim"
    rim.data.energy = 900
    rim.data.color = (1.0, 0.68, 0.38)
    rim.data.size = 3.0
    rim.rotation_euler = (math.radians(45), 0, math.radians(135))
    move_to_collection(rim, preview)

    bpy.ops.object.camera_add(location=(8.8, -12.8, 6.4))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    target = Vector((0.0, 0.0, 0.85))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.lens = 54
    move_to_collection(camera, preview)
    bpy.context.scene.camera = camera

    world = bpy.context.scene.world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.004, 0.035, 0.075, 1.0)
    background.inputs["Strength"].default_value = 0.45


def hierarchy(root):
    result = [root]
    stack = list(root.children)
    while stack:
        child = stack.pop()
        result.append(child)
        stack.extend(child.children)
    return result


def object_stats(root):
    objects = hierarchy(root)
    mesh_objects = [obj for obj in objects if obj.type == "MESH"]
    vertices = sum(len(obj.data.vertices) for obj in mesh_objects)
    triangles = 0
    for obj in mesh_objects:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
    return {
        "objects": len(objects),
        "mesh_objects": len(mesh_objects),
        "vertices": vertices,
        "triangles": triangles,
    }


def export_asset(root, filename):
    saved_location = root.location.copy()
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    for obj in hierarchy(root):
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    output_path = PUBLIC_DIR / filename
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    root.location = saved_location
    bpy.context.view_layer.update()
    return output_path


def main():
    clear_scene()
    mats = {
        "coat": material("Fisher_Coat", (0.031, 0.10, 0.12), 0.72),
        "warm": material("Fisher_Warm", (0.85, 0.43, 0.17), 0.62),
        "skin": material("Fisher_Skin", (0.58, 0.25, 0.14), 0.72),
        "dark": material("Fisher_Dark", (0.015, 0.035, 0.055), 0.78),
        "hat": material("Fisher_Hat", (0.77, 0.25, 0.12), 0.68),
        "fish_body": material("Baitfish_Body", (0.16, 0.42, 0.56), 0.36, 0.18),
        "fish_fin": material("Baitfish_Fin", (0.04, 0.19, 0.28), 0.48),
        "eye": material("Eye_Black", (0.002, 0.004, 0.005), 0.18),
        "shell": material("Turtle_Shell", (0.26, 0.22, 0.095), 0.76),
        "shell_dark": material("Turtle_Shell_Dark", (0.075, 0.10, 0.055), 0.80),
        "shell_light": material("Turtle_Plastron", (0.55, 0.48, 0.26), 0.82),
        "turtle_skin": material("Turtle_Skin", (0.12, 0.18, 0.10), 0.78),
        "turtle_skin_light": material("Turtle_Skin_Light", (0.38, 0.38, 0.20), 0.76),
        "jelly_bell": material("Jelly_Bell", (0.42, 0.82, 0.92), 0.20, 0.0, 0.38, (0.12, 0.48, 0.56), 0.35),
        "jelly_inner": material("Jelly_Inner", (0.78, 0.42, 0.70), 0.28, 0.0, 0.58, (0.45, 0.08, 0.28), 0.25),
        "jelly_tentacle": material("Jelly_Tentacle", (0.62, 0.90, 0.94), 0.24, 0.0, 0.46, (0.16, 0.42, 0.50), 0.18),
        "preview_floor": material("Preview_Floor", (0.006, 0.055, 0.085), 0.84),
    }

    assets = {
        "fisherman": make_fisherman(mats),
        "baitfish_school": make_baitfish(mats),
        "green_sea_turtle": make_turtle(mats),
        "moon_jelly_cluster": make_jellies(mats),
    }
    add_preview_environment(mats, [root for _, root in assets.values()])

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(PREVIEW_PATH)
    scene.render.film_transparent = False
    scene.render.image_settings.color_mode = "RGBA"
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass

    exports = {
        "fisherman": "fisherman.glb",
        "baitfish_school": "baitfish_school.glb",
        "green_sea_turtle": "green_sea_turtle.glb",
        "moon_jelly_cluster": "moon_jelly_cluster.glb",
    }
    manifest = {
        "blender_version": bpy.app.version_string,
        "source": str(BLEND_PATH.relative_to(ROOT)).replace("\\", "/"),
        "preview": str(PREVIEW_PATH.relative_to(ROOT)).replace("\\", "/"),
        "assets": {},
    }
    for asset_id, (_, root) in assets.items():
        output = export_asset(root, exports[asset_id])
        manifest["assets"][asset_id] = {
            "file": str(output.relative_to(ROOT)).replace("\\", "/"),
            "root_node": root.name,
            **object_stats(root),
        }

    scene.render.filepath = str(PREVIEW_PATH)
    bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
