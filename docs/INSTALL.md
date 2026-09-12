# Setup and installation

This guide targets the Fire TV Stick HD (2nd Generation, 2026) running Vega OS 1.1. Amazon's Vega SDK 0.22 documentation confirms that Fire TV packages use ARMv7 and are installed as `.vpkg` files.

## Before you begin

You need:

- A Fire TV Stick HD (2nd Generation) updated to Vega OS 1.1.
- An Amazon Developer account.
- A supported Ubuntu 22.04 development machine with a USB data cable.
- Vega SDK `0.22.5850` and its prerequisites.
- A Tailscale tailnet whose administrator can create an auth key.
- The TailVega ARMv7 `.vpkg` and matching `.sha256` file from GitHub Releases.

Developer Mode allows sideloaded code and a developer shell. Enable it only on a device you control, do not expose the developer connection to untrusted networks, and disable it when you no longer need it.

## 1. Install the Vega SDK

Install the SDK using Amazon's official [Vega SDK setup instructions](https://developer.amazon.com/docs/vega/0.22/setup-overview). This repository pins SDK `0.22.5850` in `vega-sdk-requirements.json` because it targets Vega OS 1.1.

After installation, open a new shell or load the environment:

```bash
source "$HOME/vega/env"
vega --version
```

## 2. Enable Developer Mode

Amazon documents the current process in [Enable Developer Mode](https://developer.amazon.com/docs/vega/0.22/developer-mode).

1. Connect the Fire TV Stick to the development machine using a USB data cable.
2. On Fire TV, open **Settings > My Fire TV > About**.
3. Select the device name, then press the remote's center button seven times.
4. Go back to **My Fire TV > Developer options > Developer Mode** and select **Continue**. Keep the six-digit code visible.
5. On the development machine, authenticate the CLI:

   ```bash
   vega devmode login
   ```

6. Complete the browser authorization, then enable the device with the code shown on the TV:

   ```bash
   vega devmode enable-device --code 123456
   ```

7. Wait for the Fire TV to reboot. Confirm **Developer Mode: Enabled**, then verify the connection:

   ```bash
   vega device list
   ```

If more than one device is attached, add `-d <serial>` immediately after `vega device` in later commands.

## 3. Download and verify TailVega

Download both files from the [latest GitHub release](https://github.com/looizao/tailscale-vegaos/releases/latest):

- `TailVega-<version>-armv7.vpkg`
- `TailVega-<version>-armv7.vpkg.sha256`

Keep them in the same directory and verify the package before sideloading:

```bash
sha256sum -c TailVega-<version>-armv7.vpkg.sha256
```

The command must print `OK`. Do not install a package with a mismatched checksum.

## 4. Install and launch

With one Fire TV connected:

```bash
vega device install-app --packagePath TailVega-<version>-armv7.vpkg
vega device launch-app --appName com.looizao.tailvega.main
```

With several devices connected:

```bash
vega device -d <serial> install-app --packagePath TailVega-<version>-armv7.vpkg
vega device -d <serial> launch-app --appName com.looizao.tailvega.main
```

To remove TailVega later:

```bash
vega device uninstall-app --appName com.looizao.tailvega.main
```

Uninstalling removes the app and its private saved Tailscale identity. Also delete the corresponding machine from the Tailscale admin console if it should no longer have tailnet access.

## 5. Create a safe Tailscale auth key

Open the Tailscale admin console's [Keys page](https://login.tailscale.com/admin/settings/keys) and select **Generate auth key**.

Use these settings:

- **Reusable:** off. A one-off key is automatically revoked after its first use.
- **Expiration:** the shortest practical value.
- **Ephemeral:** off. TailVega stores and resumes one node identity.
- **Pre-approved:** on only if your tailnet uses device approval and you want to skip manual approval.
- **Tags:** optionally assign a tightly restricted tag, such as `tag:firetv`, if your policy is designed for it.

Never place the key in an issue, log, source file, shell history, or screenshot. TailVega uses it only to configure the embedded engine and then clears the UI field and native input buffer. The engine persists its node key in TailVega's private app data so the one-off auth key is not needed again.

## 6. Join the tailnet

1. Open TailVega on the Fire TV.
2. Enter a hostname such as `living-room-fire-tv`.
3. Enter the one-off auth key.
4. Select **Connect**.
5. Confirm that the TailVega node appears on the Tailscale admin console's Machines page.

Use **Probe a tailnet service** to test a TCP destination such as `nas:22` or `100.64.0.10:443`. TailVega also displays the local SOCKS5 address and generated password while connected.

The SOCKS5 listener is local to the Fire TV app environment. Other Fire TV applications will use it only if they support an explicit proxy and can reach that listener. TailVega does not change Vega OS network routing.

## Troubleshooting

### `vega device list` is empty

- Confirm the cable supports data, not only power.
- Reopen Developer Mode and confirm it is enabled.
- Disconnect other USB devices and retry.
- Follow Amazon's [run-on-device guide](https://developer.amazon.com/docs/vega/0.22/run-apps).

### Package installation fails

- Confirm the file name contains `armv7`.
- Verify the checksum again.
- Confirm the target runs Vega OS 1.1 and your CLI uses the pinned 0.22 SDK.
- Inspect installed packages with `vega device installed-packages`.

### TailVega cannot join

- Confirm the Fire TV has internet access and its date and time are correct.
- Generate a new one-off auth key if the old one expired or was already used.
- If device approval is enabled, approve the new machine or use a pre-approved key.
- If Tailnet Lock is enabled, use a pre-signed auth key according to Tailscale's policy.

### A service probe fails

- Use `host:port`, not a URL. For example, use `nas:443`, not `https://nas`.
- Confirm the peer is online and its service listens on that port.
- Check Tailscale grants or ACLs for the TailVega node or tag.
- Try the peer's Tailscale IP to distinguish MagicDNS from routing or policy issues.

### Collect logs

Do not post auth keys, node keys, SOCKS credentials, tailnet names, or private IP addresses publicly. Use the Vega CLI logging commands documented for SDK 0.22 and redact sensitive values before attaching logs to an issue.
