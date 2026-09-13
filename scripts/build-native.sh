#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root/native"
mkdir -p prebuilt/host
CGO_ENABLED=1 go build -buildvcs=false -trimpath -buildmode=c-archive -ldflags=-buildid= -o prebuilt/host/libtailscale.a ./bridge
