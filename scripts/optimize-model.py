#!/usr/bin/env python3
"""
Turn the Blender export (a .gltf with everything base64-embedded, or a .glb)
into a compact .glb for the website.

What it does:
  * packs the model into a binary .glb (removes the ~33% base64 overhead)
  * re-encodes oversized textures (> 400 KB) as JPEG, at most 2048 px
  * leaves geometry, node names, materials and lights untouched

Textures used with alpha cut-outs (MASK materials) stay PNG. Opaque and
"blend" materials get their transparency from the material, not the
texture, so their PNGs are safe to turn into JPEGs.

Usage (macOS; needs only python3 and the built-in `sips` tool):
    python3 scripts/optimize-model.py
    python3 scripts/optimize-model.py path/to/in.gltf path/to/out.glb
"""

import base64
import json
import os
import struct
import subprocess
import sys
import tempfile

SRC = "src/assets/models/apartment.gltf"
DST = "public/models/apartment.glb"
MAX_BYTES = 400_000   # textures smaller than this are left alone
MAX_SIZE = 2048       # longest edge, in pixels
JPEG_QUALITY = 82


def image_size(data, mime):
    if mime == "image/png":
        w, h = struct.unpack(">II", data[16:24])
        return w, h
    i = 2
    while i < len(data) and data[i] == 0xFF:
        marker = data[i + 1]
        length = struct.unpack(">H", data[i + 2:i + 4])[0]
        if marker in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", data[i + 5:i + 9])
            return w, h
        i += 2 + length
    return 0, 0


def mask_images(gltf):
    """Indices of images used by alpha-MASK materials (must keep their alpha)."""
    keep = set()
    textures = gltf.get("textures", [])
    for mat in gltf.get("materials", []):
        if mat.get("alphaMode") != "MASK":
            continue
        refs = [
            mat.get("pbrMetallicRoughness", {}).get("baseColorTexture"),
            mat.get("emissiveTexture"),
        ]
        for ref in refs:
            if ref:
                keep.add(textures[ref["index"]]["source"])
    return keep


def to_jpeg(data, suffix):
    with tempfile.TemporaryDirectory() as tmp:
        src = os.path.join(tmp, "in" + suffix)
        dst = os.path.join(tmp, "out.jpg")
        with open(src, "wb") as f:
            f.write(data)
        w, h = image_size(data, "image/png" if suffix == ".png" else "image/jpeg")
        cmd = ["sips", "-s", "format", "jpeg", "-s", "formatOptions", str(JPEG_QUALITY)]
        if max(w, h) > MAX_SIZE:
            cmd += ["-Z", str(MAX_SIZE)]
        subprocess.run(cmd + [src, "--out", dst], check=True, capture_output=True)
        with open(dst, "rb") as f:
            return f.read()


def read_model(path):
    """The glTF JSON and its binary buffer, from a .glb or an embedded .gltf."""
    if path.endswith(".glb"):
        with open(path, "rb") as f:
            data = f.read()
        json_len = struct.unpack("<I", data[12:16])[0]
        gltf = json.loads(data[20:20 + json_len])
        bin_start = 20 + json_len
        bin_len = struct.unpack("<I", data[bin_start:bin_start + 4])[0]
        return gltf, data[bin_start + 8:bin_start + 8 + bin_len]

    with open(path) as f:
        gltf = json.load(f)
    if len(gltf["buffers"]) != 1 or not gltf["buffers"][0].get("uri", "").startswith("data:"):
        sys.exit("Expected a single base64-embedded buffer (Blender: glTF Embedded export).")
    return gltf, base64.b64decode(gltf["buffers"][0]["uri"].split(",", 1)[1])


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SRC
    dst = sys.argv[2] if len(sys.argv) > 2 else DST

    gltf, blob = read_model(src)
    views = gltf["bufferViews"]
    replacements = {}  # bufferView index -> new bytes
    keep_alpha = mask_images(gltf)

    for idx, image in enumerate(gltf.get("images", [])):
        view = views[image["bufferView"]]
        start = view.get("byteOffset", 0)
        data = blob[start:start + view["byteLength"]]
        if len(data) <= MAX_BYTES or idx in keep_alpha:
            continue
        suffix = ".png" if image["mimeType"] == "image/png" else ".jpg"
        new = to_jpeg(data, suffix)
        if len(new) < len(data):
            replacements[image["bufferView"]] = new
            image["mimeType"] = "image/jpeg"
            print(f"  {image.get('name', idx)}: {len(data) / 1e6:.2f} MB -> {len(new) / 1e6:.2f} MB")

    # Rebuild the binary buffer with every view 4-byte aligned.
    out = bytearray()
    for i, view in enumerate(views):
        start = view.get("byteOffset", 0)
        data = replacements.get(i, blob[start:start + view["byteLength"]])
        out += b"\0" * ((4 - len(out) % 4) % 4)
        view["byteOffset"] = len(out)
        view["byteLength"] = len(data)
        out += data
    out += b"\0" * ((4 - len(out) % 4) % 4)

    gltf["buffers"] = [{"byteLength": len(out)}]
    gltf.setdefault("asset", {})["generator"] = gltf["asset"].get("generator", "") + " + optimize-model.py"

    json_bytes = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)

    total = 12 + 8 + len(json_bytes) + 8 + len(out)
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(json_bytes), 0x4E4F534A))
        f.write(json_bytes)
        f.write(struct.pack("<II", len(out), 0x004E4942))
        f.write(out)

    print(f"{src} ({os.path.getsize(src) / 1e6:.1f} MB) -> {dst} ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
