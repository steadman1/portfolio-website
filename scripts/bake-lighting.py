"""
Bakes the apartment's lighting and shadows into one texture (a "lightmap"),
so the website can draw the model without any real-time lights or shadows.

Run it through ./scripts/bake-lighting.sh, which also compresses the result
for the web.

What it does:
  1. Imports src/assets/models/apartment.gltf.
  2. Gives every visible object a second UV map ("lightmap"), all packed
     together into one square, so one image holds the light for everything.
  3. Bakes the lamps (and a soft white sky) with Cycles: light only, no
     surface colours, including bounced light and soft shadows.
  4. Denoises it and saves it as public/models/apartment-lightmap.jpg (plus a
     half-size copy for phones), divided by
     LIGHT_SCALE so bright spots near lamps fit in an ordinary image (the
     site multiplies it back).
  5. Exports the model, now with the lightmap UVs, to build/apartment-baked.glb.

Settings to tweak are just below.
"""

import os
import sys
import time

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src/assets/models/apartment.gltf")
OUT_MODEL = os.path.join(ROOT, "build/apartment-baked.glb")
OUT_LIGHTMAP = os.path.join(ROOT, "public/models/apartment-lightmap.jpg")
# Half-size copy for phones (an 8192px image takes ~350 MB of graphics memory).
OUT_LIGHTMAP_SMALL = os.path.join(ROOT, "public/models/apartment-lightmap-small.jpg")
DENOISED = os.path.join(ROOT, "build/lightmap-denoised.exr")

SIZE = int(os.environ.get("BAKE_SIZE", 8192))  # lightmap width/height, px; more = sharper shadows
SAMPLES = int(os.environ.get("BAKE_SAMPLES", 256))  # more = less grain, slower
SKY = float(os.environ.get("BAKE_SKY", 0.35))  # brightness of the white "sky" around the building
LIGHT_SCALE = 2.0  # light is stored divided by this; the site multiplies it back
# Gap between objects and smallest object on the lightmap, in pixels (scaled
# with SIZE so the half-size copy still has room around each object).
MARGIN_PX = max(4, SIZE // 1024)
MIN_PX = max(4, SIZE // 1024)
FILL_PX = max(8, SIZE // 512)  # how far each object's light is extended into the gaps around it
# How much more lightmap a bigger surface gets: 1 = exactly in proportion to
# its area; lower gives small props a bit more detail, at the expense of
# huge surfaces (the street, the foundation).
AREA_WEIGHT = 0.85
MAX_SHARE = 0.05  # no single object takes more than this share of the lightmap

# Objects that never show on the site (they only mark camera spots).
SKIP_OBJECTS = {"shop_counter_camera_outline", "bay_window_camera_outline"}

# Objects that shouldn't cast shadows, by material name (the RECORDS letters
# left a dark smudge on the wall).
NO_SHADOW_MATERIALS = {"records sign", "records sign emit"}

# Per-lamp tweaks, by the lamp's name in Blender:
#   power  multiplies its brightness (0.5 = half as bright)
#   size   its radius in metres; bigger = softer shadows and gentler hot spots
#          (lamps exported from Blender arrive with no size, i.e. pin-sharp)
LAMPS = {
    # Music shop
    "Point.006 ex": {"power": 0.35, "size": 2.0},  # spotlight in the shop ceiling
    "Point.012": {"power": 0.35, "size": 1.5},
    "Point.014": {"power": 0.35, "size": 1.5},
}


def log(*args):
    print("[bake]", *args, flush=True)


def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC, export_import_convert_lighting_mode="RAW")
    scene = bpy.context.scene
    log(f"imported in {time.time() - t0:.0f}s")

    for ob in scene.objects:
        if ob.name.replace(" ", "_") in SKIP_OBJECTS:
            ob.hide_render = True
        # Same as on the site: these don't block light (bulb covers, glass).
        if ob.type == "MESH" and ("no cast" in ob.name or only_glass(ob)):
            ob.visible_shadow = False
        if ob.type == "MESH" and any(s.material and s.material.name in NO_SHADOW_MATERIALS for s in ob.material_slots):
            # No shadow, and no darkening of nearby surfaces from bounced light either.
            ob.visible_shadow = False
            ob.visible_diffuse = False
            log(f"no shadow: {ob.name}")
        if ob.type == "LIGHT":
            # The importer names lamp objects "<name>_Orientation".
            tweak = LAMPS.get(ob.name.removesuffix("_Orientation"))
            if tweak:
                ob.data.energy *= tweak.get("power", 1)
                ob.data.shadow_soft_size = tweak.get("size", ob.data.shadow_soft_size)
                log(f"lamp {ob.name}: {ob.data.energy:.0f}W, size {ob.data.shadow_soft_size}m")

    targets = [ob for ob in scene.objects if ob.type == "MESH" and not ob.hide_render and ob.data.polygons]
    log(f"{len(targets)} mesh objects")

    # Each object needs its own place on the lightmap, so shared (instanced)
    # meshes get their own copy.
    for ob in targets:
        if ob.data.users > 1:
            ob.data = ob.data.copy()

    # 1) Lightmap UVs: a second UV map on every object, unwrapped and packed
    # into one shared square.
    t = time.time()
    unwrap_lightmap(targets)
    log(f"unwrapped and packed in {time.time() - t:.0f}s")

    # 2) Lighting: a soft white sky, like the white page around the model.
    world = bpy.data.worlds.new("bake sky")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (1, 1, 1, 1)
    bg.inputs["Strength"].default_value = SKY
    scene.world = world

    # 3) Bake target: one float image, active in every material.
    image = bpy.data.images.new("lightmap", SIZE, SIZE, float_buffer=True, alpha=False)
    added = []
    for mat in {slot.material for ob in targets for slot in ob.material_slots if slot.material}:
        if not mat.use_nodes:
            mat.use_nodes = True
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.name = "__lightmap_bake"
        mat.node_tree.nodes.active = node
        added.append((mat, node))
    for ob in targets:
        if not ob.material_slots or not any(s.material for s in ob.material_slots):
            mat = bpy.data.materials.new("__lightmap_default")
            mat.use_nodes = True
            node = mat.node_tree.nodes.new("ShaderNodeTexImage")
            node.image = image
            mat.node_tree.nodes.active = node
            ob.data.materials.append(mat)
            added.append((mat, node))

    scene.render.engine = "CYCLES"
    cycles = scene.cycles
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        cycles.device = "GPU"
        log("rendering on", [d.name for d in prefs.devices if d.use])
    except Exception as e:  # no GPU: CPU works, just slower
        log("GPU unavailable, using CPU:", e)
    cycles.samples = SAMPLES
    cycles.use_denoising = False
    bake = scene.render.bake
    bake.use_pass_direct = True
    bake.use_pass_indirect = True
    bake.use_pass_color = False  # light only; the site multiplies by the textures
    bake.margin = 0  # gaps are filled afterwards by fill_gaps()
    bake.margin_type = "EXTEND"
    bake.target = "IMAGE_TEXTURES"
    bake.use_clear = False

    # Cycles bakes each selected object as its own render (reloading the whole
    # scene every time), which takes ages for hundreds of objects. So bake one
    # merged copy of everything instead, with the originals hidden meanwhile.
    t = time.time()
    proxies = merged_copies(targets)
    log(f"merged {len(proxies)} copies in {time.time() - t:.0f}s")
    bpy.ops.object.select_all(action="DESELECT")
    for proxy in proxies:
        proxy.select_set(True)
    bpy.context.view_layer.objects.active = proxies[0]
    t = time.time()
    log(f"baking {SIZE}px at {SAMPLES} samples...")
    # Unbaked pixels keep this impossible value, so fill_gaps() can find them.
    import numpy as np
    image.pixels.foreach_set(np.tile(np.array([-1, -1, -1, 1], dtype=np.float32), SIZE * SIZE))
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=0, use_clear=False)
    log(f"baked in {time.time() - t:.0f}s")
    for proxy in proxies:
        bpy.data.objects.remove(proxy, do_unlink=True)
    for ob in targets:
        ob.hide_render = False

    # 4) Denoise, scale down and save as an ordinary (sRGB) JPEG.
    fill_gaps(image)
    save_lightmap(denoise(image))

    # 5) Remove the bake nodes and export with both UV maps.
    for mat, node in added:
        mat.node_tree.nodes.remove(node)
    for ob in targets:
        for layer in ob.data.uv_layers:
            layer.active_render = layer.name != "lightmap" or len(ob.data.uv_layers) == 1
    os.makedirs(os.path.dirname(OUT_MODEL), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=OUT_MODEL,
        export_format="GLB",
        export_texcoords=True,
        export_normals=True,
        export_lights=True,
        export_import_convert_lighting_mode="RAW",
        export_apply=False,
        export_yup=True,
        export_extras=True,
        export_image_format="AUTO",
        use_visible=False,
        # Compress the geometry (the site decodes it with public/draco).
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=7,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=14,  # finer than a lightmap texel
    )
    log(f"exported {OUT_MODEL}; total {time.time() - t0:.0f}s")


def only_glass(ob):
    mats = [s.material for s in ob.material_slots if s.material]
    return bool(mats) and all(is_glass(m) for m in mats)


def is_glass(mat):
    if not mat.node_tree:
        return False
    for node in mat.node_tree.nodes:
        if node.type == "BSDF_PRINCIPLED":
            for name in ("Transmission Weight", "Transmission"):
                if name in node.inputs and node.inputs[name].default_value > 0:
                    return True
    return False


def unwrap_lightmap(targets):
    """
    Unwraps each object on its own, then treats each object's layout as one
    block, sized by the object's real surface area, and packs the blocks into
    one square. (Packing every little UV island separately leaves most of the
    image as gaps between islands on a model this detailed.)
    """
    import numpy as np

    for ob in targets:
        me = ob.data
        if not me.uv_layers:
            me.uv_layers.new(name="UVMap")  # keep the textures' map first
        uv = me.uv_layers.get("lightmap") or me.uv_layers.new(name="lightmap")
        me.uv_layers.active = uv  # edited and baked into...
        for layer in me.uv_layers:  # ...while textures keep using the first map
            layer.active_render = layer.name != "lightmap"

    for ob in targets:
        bpy.ops.object.select_all(action="DESELECT")
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.03, area_weight=0.0, correct_aspect=True, scale_to_bounds=True)
        bpy.ops.object.mode_set(mode="OBJECT")

    blocks = []
    for ob in targets:
        me = ob.data
        data = me.uv_layers["lightmap"].data
        uvs = np.empty(len(data) * 2, dtype=np.float64)
        data.foreach_get("uv", uvs)
        uvs = uvs.reshape(-1, 2)
        lo, hi = uvs.min(0), uvs.max(0)
        world = sum(p.area for p in me.polygons) * abs(ob.matrix_world.to_3x3().determinant()) ** (2 / 3)
        uv_area = max(float(np.prod(hi - lo)), 1e-9)
        f = (max(world, 1e-6) ** AREA_WEIGHT / uv_area) ** 0.5
        blocks.append({"ob": ob, "uvs": uvs, "lo": lo, "span": np.maximum(hi - lo, 1e-9), "size": (hi - lo) * f})

    # Cap the biggest surfaces (mostly the street and foundation, which are
    # half hidden in the fog anyway).
    for _ in range(3):
        cap = MAX_SHARE * sum(float(np.prod(b["size"])) for b in blocks)
        for b in blocks:
            area = float(np.prod(b["size"]))
            if area > cap:
                b["size"] = b["size"] * (cap / area) ** 0.5

    # Shelf packing, repeated so the pixel gaps come out right once scaled.
    scale = 1.0
    for _ in range(4):
        gap = MARGIN_PX / SIZE / scale
        least = MIN_PX / SIZE / scale
        total = sum((max(b["size"][0], least) + gap) * (max(b["size"][1], least) + gap) for b in blocks)
        width = (total / 0.82) ** 0.5
        x = y = shelf = 0.0
        for b in sorted(blocks, key=lambda b: -max(b["size"][1], least)):
            w, h = max(b["size"][0], least), max(b["size"][1], least)
            if x + w > width and x > 0:
                x, y, shelf = 0.0, y + shelf + gap, 0.0
            b["at"], b["fit"] = (x, y), (w, h)
            x += w + gap
            shelf = max(shelf, h)
        extent = max(width, y + shelf)
        scale = 1 / extent

    for b in blocks:
        local = b["uvs"] - b["lo"]
        local = local / b["span"] * np.array(b["fit"])  # stretch tiny blocks up to MIN_PX
        placed = (local + np.array(b["at"]) + 0.5 * gap) * scale
        b["ob"].data.uv_layers["lightmap"].data.foreach_set("uv", placed.ravel())
    log(f"packed {len(blocks)} objects, gap {gap * scale * SIZE:.1f}px")


# Ray visibility settings that a merged copy has to keep (one copy per combination).
RAY_FLAGS = ("visible_shadow", "visible_diffuse")


def merged_copies(targets):
    """Copies of all `targets` (which get hidden from rendering), merged into
    as few objects as possible: one per combination of RAY_FLAGS, since those
    are per object and would be lost when merging."""
    groups = {}
    for ob in targets:
        groups.setdefault(tuple(getattr(ob, f) for f in RAY_FLAGS), []).append(ob)
    proxies = []
    for flags, obs in groups.items():
        copies = []
        for ob in obs:
            copy = ob.copy()
            copy.data = ob.data.copy()
            copy.parent = None
            copy.matrix_world = ob.matrix_world.copy()
            bpy.context.scene.collection.objects.link(copy)
            copies.append(copy)
            ob.hide_render = True
        bpy.ops.object.select_all(action="DESELECT")
        for copy in copies:
            copy.select_set(True)
        bpy.context.view_layer.objects.active = copies[0]
        if len(copies) > 1:
            bpy.ops.object.join()
        proxy = bpy.context.view_layer.objects.active
        proxy.name = "__bake_proxy"
        for name, value in zip(RAY_FLAGS, flags):
            setattr(proxy, name, value)
        proxy.data.uv_layers.active = proxy.data.uv_layers["lightmap"]
        proxies.append(proxy)
    return proxies


def fill_gaps(image):
    """Extends each object's light a few pixels into the empty space around
    it, so texture filtering at the edges doesn't pull in black. (Blender can
    do this itself, but with several bake copies each one's extension paints
    over the edges of objects the others already baked.) Only empty pixels are
    filled; anything left over becomes black."""
    import numpy as np

    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    band = 1024  # rows at a time, to keep memory down
    for top in range(0, h, band):
        lo, hi = max(0, top - FILL_PX), min(h, top + band + FILL_PX)
        rgb = px[lo:hi, :, :3].copy()
        filled = rgb[:, :, 0] >= 0
        for _ in range(FILL_PX):
            total = np.zeros_like(rgb)
            count = np.zeros(filled.shape, dtype=np.float32)
            for axis, shift in ((0, 1), (0, -1), (1, 1), (1, -1)):
                m = np.roll(filled, shift, axis)
                total += np.where(m[:, :, None], np.roll(rgb, shift, axis), 0)
                count += m
            grow = ~filled & (count > 0)
            rgb[grow] = total[grow] / count[grow][:, None]
            filled |= grow
        rgb[~filled] = 0
        px[top:min(h, top + band), :, :3] = rgb[top - lo : top - lo + min(band, h - top)]
    image.pixels.foreach_set(px.ravel())
    log(f"filled gaps ({FILL_PX}px)")


def denoise(image):
    """Smooths out the bake's grain with Blender's denoiser (via the compositor)."""
    scene = bpy.context.scene
    try:
        tree = bpy.data.node_groups.new("denoise lightmap", "CompositorNodeTree")
        scene.compositing_node_group = tree
        src = tree.nodes.new("CompositorNodeImage")
        src.image = image
        dn = tree.nodes.new("CompositorNodeDenoise")
        out = tree.nodes.new("NodeGroupOutput")
        tree.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
        tree.links.new(src.outputs[0], dn.inputs["Image"])
        tree.links.new(dn.outputs[0], out.inputs[0])
        if not scene.camera:  # rendering needs one, though nothing is drawn
            cam = bpy.data.objects.new("denoise camera", bpy.data.cameras.new("denoise camera"))
            scene.collection.objects.link(cam)
            scene.camera = cam
        for ob in scene.objects:  # nothing to draw; only the compositor runs
            ob.hide_render = True
        r = scene.render
        r.resolution_x, r.resolution_y = image.size
        r.resolution_percentage = 100
        r.use_compositing = True
        r.image_settings.file_format = "OPEN_EXR"
        r.image_settings.color_depth = "32"
        scene.view_settings.view_transform = "Standard"
        r.filepath = DENOISED
        bpy.ops.render.render(write_still=True)
        log("denoised")
        return bpy.data.images.load(DENOISED)
    except Exception as e:  # older/newer Blender: keep the grainy bake
        log("denoising skipped:", e)
        return image


def save_lightmap(image):
    """Divide by LIGHT_SCALE, convert to sRGB and save as 8-bit JPEGs: full
    size, and half size for phones."""
    import numpy as np

    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    rgb = px.reshape(h, w, 4)[:, :, :3]
    log(f"brightest texel {rgb.max():.2f}, mean {rgb.mean():.3f}")
    write_jpeg(rgb, OUT_LIGHTMAP)
    small = rgb.reshape(h // 2, 2, w // 2, 2, 3).mean(axis=(1, 3))  # average each 2x2 block
    write_jpeg(small, OUT_LIGHTMAP_SMALL)


def write_jpeg(rgb, path):
    import numpy as np

    h, w = rgb.shape[:2]
    linear = np.clip(rgb / LIGHT_SCALE, 0, 1)
    srgb = np.where(linear <= 0.0031308, linear * 12.92, 1.055 * np.power(linear, 1 / 2.4) - 0.055)
    out = np.ones((h, w, 4), dtype=np.float32)
    out[:, :, :3] = srgb
    jpg = bpy.data.images.new(os.path.basename(path), w, h, alpha=False, float_buffer=False)
    jpg.colorspace_settings.name = "sRGB"
    jpg.pixels.foreach_set(out.ravel())
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 92
    scene.render.image_settings.color_management = "OVERRIDE"
    scene.render.image_settings.view_settings.view_transform = "Standard"
    jpg.save_render(path, scene=scene)
    bpy.data.images.remove(jpg)
    log(f"saved {path} ({w}px, {os.path.getsize(path) / 1e6:.1f} MB)")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        import traceback

        traceback.print_exc()
        sys.exit(1)
