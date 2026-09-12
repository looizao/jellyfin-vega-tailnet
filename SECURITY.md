# Security policy

## Supported versions

Until the project reaches a stable release, only the latest published release is supported with security fixes.

## Report a vulnerability

Please do not open a public issue for a vulnerability or include secrets in logs. Use GitHub's private vulnerability reporting for `looizao/tailscale-vegaos`. Include the affected version, impact, reproduction steps, and a minimal redacted proof of concept.

If private reporting is not enabled, open a public issue containing only a request for a private contact channel and no vulnerability details.

## Threat model

TailVega handles a Tailscale auth key once during enrollment, a persistent Tailscale node identity, tailnet metadata, and a generated local SOCKS5 credential. Its controls include:

- Secure text entry for the auth key.
- Clearing JavaScript and C++ auth-key buffers after use when their runtimes permit.
- A one-off auth-key recommendation.
- Engine logging disabled by default.
- Node state stored in the package's private Vega data directory.
- A randomly generated password on the `tsnet` SOCKS5 endpoint.
- No release-time secrets or prebuilt native libraries in the repository.

Residual risks include secrets existing temporarily in managed JavaScript strings or native process memory, compromise of the Fire TV or development host, upstream supply-chain compromise, policy mistakes that grant the node excessive access, and unknown behavior on an untested Vega build.

Use a dedicated restricted tag or identity when practical, grant only required tailnet destinations, keep Vega OS updated, verify release checksums, and remove stale devices from the Tailscale admin console.

## Pinned Vega toolchain advisories

The React Native 0.72 and `@amazon-devices/react-native-kepler` 2.1.0 dependency set required by Vega OS 1.1 currently pulls known npm advisories through Metro and React Native CLI packages, including `image-size`, `ip`, and `fast-xml-parser`. These packages run on the build host and are not imported into TailVega's device bundle. Forced npm remediation upgrades React Native to an incompatible non-Vega release, so the repository intentionally retains Amazon's supported versions.

Only build trusted branches and image assets, run builds on disposable CI workers, and review Dependabot alerts for a compatible Amazon package update. This exception does not cover a vulnerability that becomes reachable in the shipped application.

## Scope limitation

TailVega is not a device-wide VPN and does not protect or reroute traffic from other Fire TV apps. The local SOCKS5 endpoint is usable only by software that explicitly connects to it.
