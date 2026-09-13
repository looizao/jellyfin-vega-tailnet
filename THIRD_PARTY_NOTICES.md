# Third-party notices

JellyVega's initial Vega CMake, code-generation, and packaging structure derives from [looizao/tailscale-vegaos](https://github.com/looizao/tailscale-vegaos), copyright 2026 Luiz Souza, MIT licensed. That history and the original MIT notice are preserved.

The native engine links [Tailscale](https://github.com/tailscale/tailscale) v1.102.4 and its transitive Go dependencies. Tailscale is BSD-3-Clause licensed. Dependencies retain their respective licenses; generated license files and an inventory are installed in the VPKG at `assets/licenses/` and published with releases.

Amazon's Vega/Kepler libraries, React Native, React, and their dependencies retain their original license terms. `scripts/collect-licenses.py` copies installed production npm license/notice files and Go module license files; the Amazon SDK itself is obtained separately from Amazon and is not redistributed as a standalone SDK.

The app loads [Jellyfin Web](https://github.com/jellyfin/jellyfin-web) from the user's Jellyfin server, preserving its version compatibility. Jellyfin server/web distributions and their licenses remain supplied by that server; those application bundles are not vendored into this source repository. The small TV preference/remote adapter is original MIT-licensed project code.

Tailscale, Amazon, Vega, Fire TV, and Jellyfin names refer to their respective projects or owners. No endorsement or affiliation is implied.
