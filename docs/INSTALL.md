# Install on Fire TV Stick HD (2nd generation, 2026)

This package targets ARMv7 Vega OS. Verify the model under Settings → My Fire TV → About. The physical device has not yet been tested with JellyVega; use the preview release to perform the checks below.

## Prepare the home server

1. Run Jellyfin and Tailscale on the home server (or expose Jellyfin on a port of an existing tailnet peer).
2. From a different tailnet device, check `http://SERVER_TAILSCALE_IP:8096/System/Info/Public` and the Jellyfin web interface. Use your actual HTTPS URL/port/base path if configured.
3. Allow the TV node to reach that server and port in your Tailscale policy. A login identity or tagged node must have appropriate grants. Device approval may also be required.
4. Enable Jellyfin remote connections and allow remote access for the Jellyfin account. The TV's Tailscale address can be classified as remote by Jellyfin.
5. Enable transcoding for media the stick's WebView cannot decode. Begin testing with 1080p or lower H.264 video and AAC audio. Lower the Jellyfin playback quality if your home upload or a relayed Tailscale connection is slow.

Use Tailscale IPs or MagicDNS names of tailnet peers. This preview does not accept ordinary LAN IPs/subnet routes. HTTPS uses normal certificate validation; self-signed certificates must have a trusted chain on the device. For an HTTP Jellyfin port, the segment between Tailscale peers is still encrypted by Tailscale.

## Enable Amazon Developer Mode

Install Amazon's Vega SDK on a supported development host. Builds here use SDK `0.22.5850`; the included installer pins and verifies Amazon's bootstrap script. Device authentication may need the current Vega CLI. Follow [Amazon's current Developer Mode instructions](https://developer.amazon.com/docs/vega/0.24/developer-mode) for your device software.

In Settings → My Fire TV → About, select the device name seven times. Return to Developer Options and begin enabling Developer Mode. Authenticate the CLI and enter the temporary code displayed by the device:

```sh
vega devmode login
vega devmode enable-device --code DEVICE_CODE
vega device list
```

Complete Amazon account verification in your own browser. The device reboots when enabled. USB is the simplest initial connection. Amazon also documents [device connections](https://developer.amazon.com/docs/vega/0.24/run-apps) where supported. Keep developer access on a trusted local network.

Amazon controls developer access and package-signing requirements. A successful VPT build does not grant Appstore approval or bypass device enrollment. If your OS requires an Amazon-issued developer signature, use its signing flow before installation.

## Install the release

Download the ARMv7 VPKG and SHA256SUMS from this repository's Releases page. Verify the VPKG's entry using `sha256sum` (or download all listed assets and run `sha256sum -c SHA256SUMS`). Then:

```sh
vega exec vpt validate JellyVega-0.1.0-armv7.vpkg
vega device -d DEVICE_SERIAL install-app --packagePath JellyVega-0.1.0-armv7.vpkg
vega device -d DEVICE_SERIAL launch-app --appName com.looizao.jellyvega.main
```

The repository includes `scripts/install-device.sh` to validate, install, and launch with an explicit device serial. Development apps may require launching through the CLI on some device software.

## Connect

Enter the Jellyfin server root, select **Connect to tailnet**, and open the displayed Tailscale login URL in your own browser. Approve the node, wait for **Tailnet connected**, and select **Open Jellyfin**. Alternatively, enter a one-off, non-ephemeral auth key with a short enrollment expiry. The key field clears after submission. The Jellyfin username/password belongs in Jellyfin's own sign-in screen.

Menu (☰) opens connection settings. Back navigates Jellyfin. Disconnect stops the gateway and Tailscale node but preserves identity. To remove access permanently, revoke the node in the Tailscale admin console and clear/uninstall the application's data. Sign out inside Jellyfin to remove its current session.

## Device verification

- Approve enrollment, browse a library, and start a known H.264/AAC file.
- Test remote focus, Back, Menu, play/pause, seeking, and subtitles.
- Test a file requiring transcoding and watch for at least 30 minutes.
- Leave and reopen the app; reboot the stick and confirm identity/login reuse.
- Try a real remote network, inspect direct/relayed connectivity in Tailscale, and measure playback stability.

For live help, provide the device serial/IP and server tailnet URL. Complete Amazon/Tailscale authentication in your browser; do not commit credentials or put them in a GitHub issue.

## Troubleshooting

“Not a visible tailnet peer”: check that the TV joined the correct tailnet and can see the server. Try its numeric Tailscale IP. “Unreachable”: verify the port/base path, TLS certificate, Jellyfin remote access, and tailnet grants. “NeedsMachineAuth”: approve the node in Tailscale admin. Local-port errors: fully close another JellyVega process and retry.

A 502 page during a stream indicates an upstream connection problem. A playable UI with a black video can instead indicate codec or transcoding support; try H.264/AAC and lower playback quality. External content plugins/redirects are intentionally constrained to the configured server. See the physical-device checklist before assuming desktop Chromium behavior matches the stick.
