#!/usr/bin/env bash
set -euo pipefail
if [[ $# -ne 2 ]]; then
  echo 'Usage: bash scripts/install-device.sh path/to/JellyVega-version-armv7.vpkg DEVICE_SERIAL' >&2
  exit 2
fi
package="$(realpath "$1")"
[[ -f "$package" && "$package" == *.vpkg ]]
vega exec vpt validate "$package"
vega device -d "$2" install-app --packagePath "$package"
vega device -d "$2" launch-app --appName com.looizao.jellyvega.main
