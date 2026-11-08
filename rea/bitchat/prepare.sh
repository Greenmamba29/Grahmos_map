#!/usr/bin/env bash
# Copies the pinned upstream files into the runner target, byte for byte, and fails if any differ later.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="$here/../../third_party/bitchat"
dest="$here/runner/Sources/bitchat-ref/Upstream"
rm -rf "$dest" && mkdir -p "$dest"
grep -v '^#' "$here/upstream-files.txt" | while read -r f; do
  [ -n "$f" ] || continue
  cp "$src/$f" "$dest/$(basename "$f")"
  cmp "$src/$f" "$dest/$(basename "$f")"
done
echo "copied $(ls "$dest" | wc -l | tr -d ' ') upstream files"
