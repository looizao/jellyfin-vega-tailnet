#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
mkdir -p .cache/native-tests
cc -Wall -Wextra -Werror -I native/prebuilt/host native/tests/smoke.c native/prebuilt/host/libtailscale.a -pthread -ldl -lm -o .cache/native-tests/bridge-smoke
.cache/native-tests/bridge-smoke
