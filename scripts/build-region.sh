#!/usr/bin/env sh
set -eu

if [ "$#" -ne 2 ]; then
  echo "Usage: PLANETILER_IMAGE=<pinned-image> $0 INPUT.osm.pbf OUTPUT.pmtiles" >&2
  exit 64
fi

if [ -z "${PLANETILER_IMAGE:-}" ]; then
  echo "Set PLANETILER_IMAGE to an immutable Planetiler image tag or digest." >&2
  exit 64
fi

input="$(realpath "$1")"
output_dir="$(realpath "$(dirname "$2")")"
output_name="$(basename "$2")"

if [ ! -f "$input" ]; then
  echo "Input extract not found: $input" >&2
  exit 66
fi

docker run --rm \
  -v "$(dirname "$input"):/data:ro" \
  -v "$output_dir:/output" \
  "$PLANETILER_IMAGE" \
  --download=false \
  --osm_path="/data/$(basename "$input")" \
  --output="/output/$output_name"

if command -v pmtiles >/dev/null 2>&1; then
  pmtiles verify "$output_dir/$output_name"
fi

sha256sum "$output_dir/$output_name" > "$output_dir/$output_name.sha256"
