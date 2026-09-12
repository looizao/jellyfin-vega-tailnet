#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
archive="$project_root/native/prebuilt/amd64/libtailscale.a"

if [[ ! -f "$archive" ]]; then
  archive="$project_root/native/prebuilt/x86_64/libtailscale.a"
fi

if [[ ! -f "$archive" ]]; then
  echo "Run npm run build:native-host first" >&2
  exit 1
fi

mkdir -p "$project_root/.cache/native-tests"
cc -O2 \
  -I"$project_root/third_party/libtailscale" \
  "$project_root/native/tests/smoke.c" \
  "$archive" \
  -pthread -ldl -lm \
  -o "$project_root/.cache/native-tests/libtailscale-smoke"

"$project_root/.cache/native-tests/libtailscale-smoke"
