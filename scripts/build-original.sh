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
