#!/usr/bin/env bash
set -euo pipefail

readonly sdk_version="${VEGA_SDK_VERSION:-0.22.5850}"
readonly expected_installer_sha256="0e5386581e5cf518202687213dd26d1b35e70242d1bd190cdea7096a99476ae0"
installer_path="$(mktemp)"
trap 'rm -f "$installer_path"' EXIT

curl -fsSL https://sdk-installer.vega.labcollab.net/get_vvm.sh \
  -o "$installer_path"

actual_sha256="$(sha256sum "$installer_path" | cut -d' ' -f1)"
if [[ "$actual_sha256" != "$expected_installer_sha256" ]]; then
  echo "Vega installer checksum mismatch" >&2
  echo "Expected: $expected_installer_sha256" >&2
  echo "Actual:   $actual_sha256" >&2
  exit 1
fi

NONINTERACTIVE=true \
SKIP_VVD_INSTALL=true \
VEGA_SDK_VERSION="$sdk_version" \
  bash "$installer_path"

echo "Vega SDK $sdk_version installed. Source ~/vega/env before building."
