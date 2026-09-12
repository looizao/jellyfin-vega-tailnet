#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
go_binary="${GO_BINARY:-go}"
target="${1:-host}"

case "$target" in
  host)
    go_os="$("$go_binary" env GOOS)"
    go_arch="$("$go_binary" env GOARCH)"
    go_arm=""
    output_dir="$project_root/native/prebuilt/$go_arch"
    ;;
  armv7)
    : "${CC:?CC must name the Vega armv7 C compiler}"
    go_os="linux"
    go_arch="arm"
    go_arm="7"
    output_dir="${OUTPUT_DIR:-$project_root/native/prebuilt/armv7}"
    ;;
  *)
    echo "Unsupported target: $target" >&2
    exit 2
    ;;
esac

mkdir -p "$output_dir" "$project_root/.cache/go-build" "$project_root/.cache/go-mod"

cd "$project_root/third_party/libtailscale"

env \
  GOOS="$go_os" \
  GOARCH="$go_arch" \
  GOARM="$go_arm" \
  CGO_ENABLED=1 \
  GOCACHE="$project_root/.cache/go-build" \
  GOMODCACHE="$project_root/.cache/go-mod" \
  "$go_binary" build -trimpath -buildmode=c-archive -ldflags=-buildid= \
    -o "$output_dir/libtailscale.a" .

echo "Built $output_dir/libtailscale.a"
