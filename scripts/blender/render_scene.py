import json
import math
import os
import sys

# Principled BSDF parameters per mesh kind.
# roughness: 0=mirror, 1=completely matte
# metallic:  0=dielectric, 1=full metal
# transmission: 0=opaque, 1=fully transparent (glass)
MATERIAL_PROFILES = {
    "floor": {
        "roughness": 0.58,
        "metallic": 0.00,
        "transmission": 0.00,
        "specular_ior_level": 0.34,
    },
    "ceiling": {
        "roughness": 0.98,
        "metallic": 0.00,
        "transmission": 0.00,
        "specular_ior_level": 0.24,
    },
    "wall": {
        "roughness": 0.92,
        "metallic": 0.00,
        "transmission": 0.00,
        "specular_ior_level": 0.26,
    },
    "module": {
        "roughness": 0.22,
        "metallic": 0.03,
        "transmission": 0.00,
        "specular_ior_level": 0.48,
        "coat_weight": 0.28,
        "coat_roughness": 0.14,
    },
    "worktop": {
        "roughness": 0.10,
        "metallic": 0.02,
        "transmission": 0.00,
        "specular_ior_level": 0.58,
        "coat_weight": 0.18,
        "coat_roughness": 0.05,
    },
    "opening": {
        "roughness": 0.02,
        "metallic": 0.00,
        "transmission": 0.92,
        "specular_ior_level": 0.60,
        "ior": 1.45,
    },
}
DEFAULT_PROFILE = {
    "roughness": 0.55,
    "metallic": 0.00,
    "transmission": 0.00,
    "specular_ior_level": 0.34,
}


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


def hex_to_linear(hex_color):
    """Convert #rrggbb to linear-space (r, g, b) floats."""
    r = int(hex_color[1:3], 16) / 255.0
    g = int(hex_color[3:5], 16) / 255.0
    b = int(hex_color[5:7], 16) / 255.0
    # sRGB to linear approximation (gamma 2.2)
    return (r ** 2.2, g ** 2.2, b ** 2.2)


def create_material(bpy, color, kind, name):
    """Create a Principled BSDF material with per-kind surface properties."""
    profile = MATERIAL_PROFILES.get(kind, DEFAULT_PROFILE)
    material = bpy.data.materials.new(name=name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        r, g, b = hex_to_linear(color)
        bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
        for input_name, profile_key in (
            ("Roughness", "roughness"),
            ("Metallic", "metallic"),
            ("Specular IOR Level", "specular_ior_level"),
            ("Coat Weight", "coat_weight"),
            ("Coat Roughness", "coat_roughness"),
            ("IOR", "ior"),
        ):
            if input_name in bsdf.inputs and profile_key in profile:
                bsdf.inputs[input_name].default_value = profile[profile_key]
        transmission_key = None
        for key in ("Transmission", "Transmission Weight"):
            if key in bsdf.inputs:
                transmission_key = key
                break
        if transmission_key and profile["transmission"] > 0:
            bsdf.inputs[transmission_key].default_value = profile["transmission"]
            material.blend_method = "BLEND"
    return material


def finish_object(bpy, obj, kind, render_preset):
    if kind not in ("module", "worktop"):
        return

    bevel_width = render_preset.get("bevelWidth", 0.0)
    bevel_segments = render_preset.get("bevelSegments", 0)
    if bevel_width > 0 and bevel_segments > 0:
        bevel = obj.modifiers.new(name="SoftBevel", type="BEVEL")
        bevel.width = bevel_width
        bevel.segments = bevel_segments
        bevel.limit_method = "ANGLE"
        bevel.angle_limit = math.radians(42)

    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.shade_smooth()
    obj.select_set(False)


def create_box(bpy, mesh, material_cache, render_preset):
    bpy.ops.mesh.primitive_cube_add(
        location=(mesh["position"]["x"], mesh["position"]["z"], mesh["position"]["y"])
    )
    obj = bpy.context.active_object
    obj.name = mesh["id"]
    obj.scale = (
        mesh["size"]["x"] / 2.0,
        mesh["size"]["z"] / 2.0,
        mesh["size"]["y"] / 2.0,
    )
    obj.rotation_euler[2] = mesh["rotationY"]

    kind = mesh.get("kind", "wall")
    # Cache key is (color, kind) — same color on different surfaces = different material.
    cache_key = (mesh["color"], kind)
    material = material_cache.get(cache_key)
    if material is None:
        mat_name = f"Mat_{kind}_{mesh['color'][1:]}"
        material = create_material(bpy, mesh["color"], kind, mat_name)
        material_cache[cache_key] = material

    # Override opacity for semi-transparent meshes (e.g. openings with explicit opacity).
    opacity = mesh.get("opacity")
    if opacity is not None and opacity < 1.0:
        material.blend_method = "BLEND"
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Alpha"].default_value = opacity

    if obj.data.materials:
        obj.data.materials[0] = material
    else:
        obj.data.materials.append(material)

    finish_object(bpy, obj, kind, render_preset)


def create_camera(bpy, camera_spec):
    """Place and orient the camera using a TrackTo constraint for reliable aim."""
    camera_data = bpy.data.cameras.new(name="StudioCamera")
    camera_obj = bpy.data.objects.new("StudioCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera_obj)

    # Scene coords: Y up. Blender coords: Z up. Mapping: scene(x,z,y) → blender(x,y,z).
    pos = camera_spec["position"]
    camera_obj.location = (pos["x"], pos["z"], pos["y"])

    # Create an empty as the look-at target.
    target = camera_spec["target"]
    target_empty = bpy.data.objects.new("CameraTarget", None)
    target_empty.location = (target["x"], target["z"], target["y"])
    bpy.context.scene.collection.objects.link(target_empty)

    # TrackTo constraint: camera -Z looks toward target, camera +Y is world up.
    constraint = camera_obj.constraints.new(type="TRACK_TO")
    constraint.target = target_empty
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"

    camera_data.angle = math.radians(camera_spec["fov"])
    bpy.context.scene.camera = camera_obj


def point_object_at(obj, target):
    direction = target - obj.location
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = direction.to_track_quat("-Z", "Y")
    obj.rotation_mode = "XYZ"


def create_lights(bpy, room, render_preset):
    """
    Create calibrated lighting for the kitchen:
    - Area light centered on ceiling, sized to room footprint, energy scales with area.
    - Sun light for exterior ambiance (fixed angle, moderate energy).
    """
    width = room["width"]
    depth = room["depth"]
    height = room["height"]
    lighting = render_preset.get("lighting", {})
    area_multiplier = lighting.get("areaEnergyMultiplier", 1.0)
    area_color = lighting.get("areaColor", "#ffffff")
    fill_energy = lighting.get("fillEnergy", 420.0)
    fill_color = lighting.get("fillColor", "#eef5ff")
    rim_energy = lighting.get("rimEnergy", 120.0)
    rim_color = lighting.get("rimColor", "#fffef8")
    sun_energy = lighting.get("sunEnergy", 2.2)
    sun_color = lighting.get("sunColor", "#fff9f0")
    target = bpy.data.objects.new("LightingTarget", None)
    target.location = (0.0, 0.0, height * 0.42)
    bpy.context.scene.collection.objects.link(target)

    # Area light: centered above the room (room is centered at origin in XY/XZ plane).
    # In Blender (Z up): room center XY = (0, 0), ceiling at Z = height.
    # Place light slightly below ceiling so it doesn't clip through it.
    bpy.ops.object.light_add(type="AREA", location=(0.0, 0.0, height - 0.05))
    area = bpy.context.active_object
    area.rotation_euler = (math.radians(180), 0.0, 0.0)  # point downward
    area.data.shape = "RECTANGLE"
    area.data.size = width * 0.85
    area.data.size_y = depth * 0.85
    # Energy calibrated to room footprint: 500 W/m² → typical bright kitchen.
    area.data.energy = 500.0 * width * depth * area_multiplier
    area.data.color = hex_to_linear(area_color)
    point_object_at(area, target.location)

    bpy.ops.object.light_add(
        type="AREA",
        location=(width * 0.28, depth * 0.95, height * 0.72),
    )
    fill = bpy.context.active_object
    fill.data.shape = "RECTANGLE"
    fill.data.size = width * 0.45
    fill.data.size_y = height * 0.35
    fill.data.energy = fill_energy
    fill.data.color = hex_to_linear(fill_color)
    point_object_at(fill, target.location)

    bpy.ops.object.light_add(
        type="AREA",
        location=(-width * 0.36, -depth * 0.82, height * 0.82),
    )
    rim = bpy.context.active_object
    rim.data.shape = "RECTANGLE"
    rim.data.size = width * 0.28
    rim.data.size_y = height * 0.22
    rim.data.energy = rim_energy
    rim.data.color = hex_to_linear(rim_color)
    point_object_at(rim, target.location)

    # Sun light: exterior ambiance, consistent direction independent of room size.
    bpy.ops.object.light_add(type="SUN", location=(width * 1.5, -depth * 0.5, height + 4.0))
    sun = bpy.context.active_object
    sun.rotation_euler = (math.radians(42), math.radians(10), math.radians(24))
    sun.data.energy = sun_energy
    sun.data.color = hex_to_linear(sun_color)


def configure_render(bpy, render_preset, output_dir):
    scene = bpy.context.scene
    scene.render.engine = render_preset["engine"]
    scene.cycles.samples = render_preset["output"]["samples"]
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = render_preset.get("adaptiveThreshold", 0.03)
    scene.cycles.use_denoising = render_preset.get("denoise", True)
    if hasattr(scene.cycles, "denoiser"):
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    scene.cycles.max_bounces = render_preset.get("maxBounces", 6)
    scene.cycles.diffuse_bounces = render_preset.get("diffuseBounces", 3)
    scene.cycles.glossy_bounces = render_preset.get("glossyBounces", 3)
    scene.cycles.transmission_bounces = render_preset.get("transmissionBounces", 6)
    scene.cycles.transparent_max_bounces = max(
        4, render_preset.get("transmissionBounces", 6)
    )
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
    scene.render.resolution_x = render_preset["output"]["width"]
    scene.render.resolution_y = render_preset["output"]["height"]
    scene.render.image_settings.file_format = render_preset["output"]["format"]
    scene.render.filepath = os.path.join(output_dir, "final.png")
    scene.render.filter_size = render_preset.get("filterWidth", 1.1)
    scene.render.use_persistent_data = True
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
    scene.view_settings.exposure = render_preset.get("exposure", 0.0)
    scene.render.film_transparent = False
    world = scene.world or bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        r, g, b = hex_to_linear(render_preset.get("backgroundColor", "#f6f1ea"))
        background.inputs[0].default_value = (r, g, b, 1.0)
        background.inputs[1].default_value = render_preset.get("worldStrength", 0.8)


def main():
    package_path, output_dir = parse_args()
    os.makedirs(output_dir, exist_ok=True)

    import bpy

    package = load_package(package_path)
    reset_scene(bpy)

    material_cache = {}
    for mesh in package["compiled"]["meshes"]:
        create_box(bpy, mesh, material_cache, package["renderPreset"])

    create_camera(bpy, package["compiled"]["camera"])
    create_lights(bpy, package["scene"]["room"], package["renderPreset"])
    configure_render(bpy, package["renderPreset"], output_dir)

    bpy.ops.render.render(write_still=True)
    print(f"Rendered package {package_path} -> {output_dir}")


if __name__ == "__main__":
    main()
