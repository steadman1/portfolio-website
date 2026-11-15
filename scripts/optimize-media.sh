#!/bin/sh
# Make web-sized copies of the photos and videos the site shows.
#
# Originals stay in src/assets/ (full quality, not shipped).
# Web copies go to public/media/ (what the site actually loads).
#
# Adding a new photo:
#   1. put the original somewhere under src/assets/projects/<folder>/
#   2. run:  sh scripts/optimize-media.sh
#   3. reference it in src/content.ts as "/media/projects/<folder>/<name>.jpg"
#
# Needs macOS `sips` (built in) for images and `ffmpeg` for videos.
# Existing web copies are skipped; delete one to regenerate it.

set -e
cd "$(dirname "$0")/.."

IMAGE_SIZE=800      # longest edge in px (images show at ~320-400 css px, so ~2x)
IMAGE_QUALITY=70

out_dir="public/media"
mkdir -p "$out_dir"

# --- photos ---------------------------------------------------------------
find src/assets/projects src/assets/profile -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.heic' \) | while read -r src; do
  rel="${src#src/assets/}"
  dst="$out_dir/${rel%.*}.jpg"
  [ -f "$dst" ] && continue
  mkdir -p "$(dirname "$dst")"
  width=$(sips -g pixelWidth "$src" | awk '/pixelWidth/ {print $2}')
  height=$(sips -g pixelHeight "$src" | awk '/pixelHeight/ {print $2}')
  resize=""
  # only ever shrink; sips -Z would also enlarge small images
  if [ "$width" -gt "$IMAGE_SIZE" ] || [ "$height" -gt "$IMAGE_SIZE" ]; then resize="-Z $IMAGE_SIZE"; fi
  # shellcheck disable=SC2086
  sips -s format jpeg -s formatOptions "$IMAGE_QUALITY" $resize "$src" --out "$dst" >/dev/null
  echo "image  $dst"
done

# --- videos ---------------------------------------------------------------
# Short edge 720px (they are portrait 9:16), no audio (they play muted), streamable, plus a poster frame.
for name in katana catapult; do
  src="src/assets/videos/$name.mp4"
  dst="$out_dir/videos/$name.mp4"
  poster="$out_dir/videos/$name.jpg"
  mkdir -p "$out_dir/videos"
  if [ ! -f "$dst" ]; then
    ffmpeg -loglevel error -y -i "$src" -vf "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)'" -c:v libx264 -preset slow -crf 26 \
      -pix_fmt yuv420p -an -movflags +faststart "$dst"
    echo "video  $dst"
  fi
  if [ ! -f "$poster" ]; then
    ffmpeg -loglevel error -y -i "$dst" -frames:v 1 -q:v 4 "$poster"
    echo "poster $poster"
  fi
done
