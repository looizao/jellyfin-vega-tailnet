#!/usr/bin/env bash
set -euo pipefail

build_type="${1:-Release}"
build_version="${BUILD_VERSION:-$(node -p "require('./package.json').version")}"
build_number="${BUILD_NUMBER:-1}"

exec npx react-native build-kepler \
  --build-type "$build_type" \
  --build-version "$build_version" \
  --build-number "$build_number"
