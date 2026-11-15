#!/usr/bin/env bash
# Bakes the apartment's lighting and builds the files the site loads:
#   public/models/apartment-baked.glb    the model, with lightmap UVs (Draco-compressed)
#   public/models/apartment-lightmap.jpg the baked light
#
# Needs Blender (https://www.blender.org, or `brew install --cask blender`).
# Takes about 45 minutes on an M1 Pro. For a quick, rough preview:
#   BAKE_SIZE=2048 BAKE_SAMPLES=32 ./scripts/bake-lighting.sh
# Other settings are at the top of scripts/bake-lighting.py.
set -euo pipefail
cd "$(dirname "$0")/.."

BLENDER="${BLENDER:-/Applications/Blender.app/Contents/MacOS/Blender}"
command -v "$BLENDER" >/dev/null || BLENDER=blender

"$BLENDER" -b -P scripts/bake-lighting.py
# Shrink oversized textures and pack it for the web.
python3 scripts/optimize-model.py build/apartment-baked.glb public/models/apartment-baked.glb
