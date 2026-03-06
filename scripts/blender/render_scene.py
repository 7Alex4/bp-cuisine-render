import json
import math
import os
import sys


def parse_args():
    if "--" not in sys.argv:
        raise RuntimeError("Expected Blender script arguments after --")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if len(args) < 2:
        raise RuntimeError("Usage: blender -b -P render_scene.py -- <package.json> <output_dir>")
    return args[0], args[1]


def load_package(package_path):
    with open(package_path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def reset_scene(bpy):
    bpy.ops.wm.read_factory_settings(use_empty=True)


def create_material(bpy, color, name):
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        red = int(color[1:3], 16) / 255.0
        green = int(color[3:5], 16) / 255.0
        blue = int(color[5:7], 16) / 255.0
        bsdf.inputs["Base Color"].default_value = (red, green, blue, 1.0)
        bsdf.inputs["Roughness"].default_value = 0.48
    return material


def create_box(bpy, mesh, material_cache):
    bpy.ops.mesh.primitive_cube_add(location=(mesh["position"]["x"], mesh["position"]["z"], mesh["position"]["y"]))
    obj = bpy.context.active_object
    obj.name = mesh["id"]
    obj.scale = (
        mesh["size"]["x"] / 2.0,
        mesh["size"]["z"] / 2.0,
        mesh["size"]["y"] / 2.0,
    )
    obj.rotation_euler[2] = mesh["rotationY"]

    material = material_cache.get(mesh["color"])
    if material is None:
        material = create_material(bpy, mesh["color"], f"Mat_{mesh['color'][1:]}")
        material_cache[mesh["color"]] = material

    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)

    if mesh.get("opacity") is not None:
        material.blend_method = "BLEND"
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Alpha"].default_value = mesh["opacity"]


def create_camera(bpy, camera_spec):
    camera_data = bpy.data.cameras.new(name="StudioCamera")
    camera = bpy.data.objects.new("StudioCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    camera.location = (
        camera_spec["position"]["x"],
        camera_spec["position"]["z"],
        camera_spec["position"]["y"],
    )
    camera.rotation_mode = "XYZ"
    target = camera_spec["target"]

    direction = (
        target["x"] - camera_spec["position"]["x"],
        target["z"] - camera_spec["position"]["z"],
        target["y"] - camera_spec["position"]["y"],
    )
    yaw = math.atan2(direction[0], direction[1])
    distance = max(math.sqrt(direction[0] ** 2 + direction[1] ** 2), 0.001)
    pitch = math.atan2(direction[2], distance)

    camera.rotation_euler = (pitch, 0.0, -yaw)
    camera_data.angle = math.radians(camera_spec["fov"])
    bpy.context.scene.camera = camera


def create_lights(bpy, room_height):
    bpy.ops.object.light_add(type="AREA", location=(0, 0, room_height + 0.8))
    area = bpy.context.active_object
    area.data.energy = 4500
    area.data.shape = "RECTANGLE"
    area.data.size = 6
    area.data.size_y = 4

    bpy.ops.object.light_add(type="SUN", location=(3, -3, room_height + 4))
    sun = bpy.context.active_object
    sun.rotation_euler = (math.radians(42), math.radians(10), math.radians(24))
    sun.data.energy = 2.2


def configure_render(bpy, render_preset, output_dir):
    scene = bpy.context.scene
    scene.render.engine = render_preset["engine"]
    scene.cycles.samples = render_preset["output"]["samples"]
    scene.render.resolution_x = render_preset["output"]["width"]
    scene.render.resolution_y = render_preset["output"]["height"]
    scene.render.image_settings.file_format = render_preset["output"]["format"]
    scene.render.filepath = os.path.join(output_dir, "final.png")
    available_looks = [
        item.name for item in scene.view_settings.bl_rna.properties["look"].enum_items
    ]
    preferred_look = render_preset.get("colorManagement")
    if preferred_look in available_looks:
        scene.view_settings.look = preferred_look
    elif "AgX - Base Contrast" in available_looks:
        scene.view_settings.look = "AgX - Base Contrast"
    elif available_looks:
        scene.view_settings.look = available_looks[0]
    scene.render.film_transparent = False


def main():
    package_path, output_dir = parse_args()
    os.makedirs(output_dir, exist_ok=True)

    import bpy

    package = load_package(package_path)
    reset_scene(bpy)

    material_cache = {}
    for mesh in package["compiled"]["meshes"]:
        create_box(bpy, mesh, material_cache)

    create_camera(bpy, package["compiled"]["camera"])
    create_lights(bpy, package["scene"]["room"]["height"])
    configure_render(bpy, package["renderPreset"], output_dir)

    bpy.ops.render.render(write_still=True)
    print(f"Rendered package {package_path} -> {output_dir}")


if __name__ == "__main__":
    main()
