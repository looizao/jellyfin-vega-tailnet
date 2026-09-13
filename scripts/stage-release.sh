#!/usr/bin/env bash
set -euo pipefail
version="$(node -p "require('./package.json').version")"
mkdir -p dist
packages=(build/armv7-release/*.vpkg)
[[ ${#packages[@]} -eq 1 && -f "${packages[0]}" ]]
filename="JellyVega-$version-armv7.vpkg"
cp "${packages[0]}" "dist/$filename"
vega exec vpt validate "dist/$filename"
vega exec vpt info "dist/$filename" --json > dist/package-info.json
cp assets/licenses/go-modules.json dist/go-modules.json
npm sbom --sbom-format cyclonedx --omit=dev > dist/npm-sbom.cdx.json
tar --sort=name --mtime='UTC 2026-01-01' --owner=0 --group=0 --numeric-owner -czf dist/THIRD_PARTY_LICENSES.tar.gz -C assets licenses
cp LICENSE THIRD_PARTY_NOTICES.md dist/
(cd dist && sha256sum "$filename" package-info.json go-modules.json npm-sbom.cdx.json THIRD_PARTY_LICENSES.tar.gz LICENSE THIRD_PARTY_NOTICES.md > SHA256SUMS)
