#!/usr/bin/env bash
set -euo pipefail

build_type="${1:-Release}"
build_version="${BUILD_VERSION:-$(node -p "require('./package.json').version")}"
build_number="${BUILD_NUMBER:-1}"

exec npx react-native build-vega \
  --build-type "$build_type" \
  --target armv7 \
  --build-version "$build_version" \
  --build-number "$build_number"
