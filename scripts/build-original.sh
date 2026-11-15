#!/usr/bin/env bash
# Builds the original (pre-remaster) portfolio into public/original/, so it's
# served at spencersteadman.com/original alongside the new site.
#
# The original lives in git history at ORIGINAL_COMMIT. This checks that
# commit out into a temporary folder, applies the small fixes in
# scripts/original-fixes.patch, installs its own dependencies, builds it with
# every URL under /original/, and copies the result (index.html plus its
# assets) into public/original/. Vite copies public/ into dist/ as-is, so the
# normal `npm run build` then includes it.
#
# Fixes in the patch:
# - The "Me." profile sheet's content no longer runs off the bottom.
# The apartment model is also swapped for a compressed .glb, and photos and
# videos are web-sized (see below). Needs macOS `sips`, `ffmpeg` and ImageMagick.
#
# Run it again only if you want to rebuild the copy: ./scripts/build-original.sh
set -euo pipefail

ORIGINAL_COMMIT=1ceac3a05e685bdbc55d0e6eae9d4fad5938101d
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/public/original"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

git -C "$ROOT" archive "$ORIGINAL_COMMIT" | tar -x -C "$WORK"
(
  cd "$WORK"
  git apply "$ROOT/scripts/original-fixes.patch"
  # The original loads a 60 MB base64-embedded .gltf, over Cloudflare's
  # 25 MiB per-file limit. Load a compact .glb made by optimize-model.py
  # instead (same as the new site's public/models/apartment.glb).
  python3 "$ROOT/scripts/optimize-model.py" \
    src/assets/models/apartment.gltf src/assets/models/apartment.glb
  perl -pi -e 's#models/apartment\.gltf#models/apartment.glb#' src/scenes.ts
  perl -pi -e "s#assetsInclude: \['\*\*/\*\.gltf'\]#assetsInclude: ['**/*.gltf', '**/*.glb']#" vite.config.js
  grep -q 'apartment.glb' src/scenes.ts && grep -q "'\*\*/\*\.glb'" vite.config.js
  # Web-size its photos and videos: images at most 1600 px, videos 720 px on
  # the short edge. Large PNGs with no transparency (the renders) become
  # JPEGs, and the references to them are updated. Videos keep their audio,
  # since the original shows player controls.
  find src/assets -type f -iname '*.png' -size +300k | while read -r f; do
    [ "$(magick identify -format '%[opaque]' "$f")" = True ] || continue
    rel="${f#src/assets/}"
    magick "$f" -resize '1600x1600>' -quality 82 "${f%.*}.jpg"
    rm "$f"
    find index.html src -type f \( -name '*.html' -o -name '*.ts' -o -name '*.js' -o -name '*.css' \) \
      -exec perl -pi -e "s#\Q$rel\E#${rel%.*}.jpg#g" {} +
  done
  find src/assets -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \) | while read -r f; do
    w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/ {print $2}')
    h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/ {print $2}')
    if [ "$w" -le 1600 ] && [ "$h" -le 1600 ]; then continue; fi
    sips -s formatOptions 80 -Z 1600 "$f" >/dev/null
  done
  find src/assets -type f -iname '*.mp4' | while read -r f; do
    ffmpeg -loglevel error -y -i "$f" -vf "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'" \
      -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -c:a aac -b:a 96k \
      -movflags +faststart "$f.web.mp4" </dev/null
    mv "$f.web.mp4" "$f"
  done
  npm ci --no-audit --no-fund
  npx vite build --base /original/ --outDir "$WORK/dist"
)

rm -rf "$OUT"
mkdir -p "$OUT"
# Only the home page and its files; the app legal/support pages already
# exist at the top level of the new site.
cp "$WORK/dist/index.html" "$OUT/index.html"
cp -R "$WORK/dist/assets" "$OUT/assets"
echo "Built the original site into $OUT"
