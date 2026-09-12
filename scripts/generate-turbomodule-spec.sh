#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
generated_dir="$project_root/kepler/turbo-modules/generated"
temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT

cd "$project_root"
npx keplerscript-turbomodule-api codegen \
  src/native/NativeTailscale.ts \
  --new \
  -o "$temporary_dir" \
  --namespace tailvega \
  --className Tailscale \
  --outFile Tailscale

mkdir -p "$generated_dir"
sed -i 's/[[:space:]]\+$//' \
  "$temporary_dir/generated/TailscaleSpec.cpp" \
  "$temporary_dir/generated/TailscaleSpec.h"

if [[ "${1:-}" == "--check" ]]; then
  diff -u "$generated_dir/TailscaleSpec.cpp" \
    "$temporary_dir/generated/TailscaleSpec.cpp"
  diff -u "$generated_dir/TailscaleSpec.h" \
    "$temporary_dir/generated/TailscaleSpec.h"
  echo "Turbo Module specification is current."
  exit 0
fi

cp "$temporary_dir/generated/TailscaleSpec.cpp" "$generated_dir/TailscaleSpec.cpp"
cp "$temporary_dir/generated/TailscaleSpec.h" "$generated_dir/TailscaleSpec.h"

echo "Regenerated the TailVega Turbo Module specification."
