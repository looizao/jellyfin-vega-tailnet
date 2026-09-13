JellyVega packages a Jellyfin TV client and Tailscale 1.102.4 in one ARMv7 Vega application for the 2026 Fire TV Stick HD (2nd generation).

- Browser-based tailnet enrollment or an optional one-off auth key; saved node identity.
- Jellyfin's matching TV web interface, sign-in, library, playback, subtitles, and WebSocket traffic through one authenticated local gateway.
- Tailscale-only peer resolution, normal TLS verification, streaming Range requests, and clean connection shutdown.
- Native ARMv7 VPKG build/validation, local real-tailnet tests, and real Jellyfin browser tests in CI.
- SHA256SUMS, package metadata, npm SBOM, Go inventory, and licenses included.

This is a **device-testing preview**. Physical Fire TV playback, focus, key mapping, and lifecycle still require validation. Amazon Developer Mode/account enrollment is required. The server must be reachable on a Tailscale peer; LAN/subnet-only URLs and external content origins are outside this preview. Known upstream SDK npm advisory exceptions are documented in SECURITY.md.

Follow docs/INSTALL.md in the repository. Download the VPKG and verify its SHA-256 before installation. No real account credentials are needed by CI or included in this release.
