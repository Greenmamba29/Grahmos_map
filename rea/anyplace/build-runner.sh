#!/usr/bin/env bash
# Compiles UNMODIFIED anyplace sources (third_party/anyplace) + runner scaffolding into rea/anyplace/.classes
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="$here/.classes"
rm -rf "$out" && mkdir -p "$out"
javac -nowarn -d "$out" "$here"/../../third_party/anyplace/server/app/location/*.java "$here"/runner/utils/LOG.java "$here"/runner/Runner.java 2>&1 | grep -v "^Picked up" || true
ls "$out/location" >/dev/null
