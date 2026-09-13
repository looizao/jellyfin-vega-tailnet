#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
mkdir -p .cache
readonly image='jellyfin/jellyfin:12.0@sha256:baba630419915985442f315f08b0cf46d9f4c8a0cc4bd38e94a6d35751dd5ef5'
readonly container="jellyvega-browser-test-$$"
readonly fixture_dir="$(mktemp -d "$project_root/.cache/browser-server.XXXXXX")"
tailnet_pid=''
cleanup() {
  if [[ -n "$tailnet_pid" ]]; then kill "$tailnet_pid" 2>/dev/null || true; wait "$tailnet_pid" 2>/dev/null || true; fi
  docker rm -f "$container" >/dev/null 2>&1 || true
  rm -rf "$fixture_dir"
  rm -f .cache/browser-login.json .cache/browser-ready.json
}
trap cleanup EXIT
mkdir -p "$fixture_dir/media" "$fixture_dir/config" "$fixture_dir/cache"
docker run --rm --user "$(id -u):$(id -g)" -v "$fixture_dir/media:/media" --entrypoint /usr/lib/jellyfin-ffmpeg/ffmpeg "$image" \
  -hide_banner -loglevel error -f lavfi -i testsrc2=size=640x360:rate=24 -f lavfi -i sine=frequency=440:sample_rate=48000 \
  -t 15 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -movflags +faststart '/media/JellyVega Test (2026).mp4'
docker run -d --name "$container" --user "$(id -u):$(id -g)" -p 127.0.0.1:18096:8096 \
  -v "$fixture_dir/media:/media:ro" -v "$fixture_dir/config:/config" -v "$fixture_dir/cache:/cache" "$image" >/dev/null
node scripts/setup-jellyfin-test.mjs
(cd native && go test -c -tags=integration -o ../.cache/browser-tailnet ./engine)
rm -f .cache/browser-ready.json
JELLYVEGA_BROWSER_READY="$project_root/.cache/browser-ready.json" .cache/browser-tailnet -test.run '^TestBrowserFixture$' -test.timeout=5m > .cache/browser-tailnet.log 2>&1 &
tailnet_pid=$!
for attempt in {1..90}; do
  if [[ -s .cache/browser-ready.json ]]; then break; fi
  if ! kill -0 "$tailnet_pid" 2>/dev/null; then cat .cache/browser-tailnet.log; exit 1; fi
  sleep 1
done
test -s .cache/browser-ready.json
npx playwright test
