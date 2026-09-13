# Security

JellyVega handles a Tailscale node identity and a Jellyfin session. Keep application data private and revoke the node/session if the TV is lost. Report vulnerabilities through the repository's GitHub Security Advisories interface. Do not include auth keys, browser tokens, account passwords, node-state files, or unredacted traces in public issues.

## Boundaries

The embedded Tailscale connection belongs to this app. The HTTP gateway binds only to 127.0.0.1, requires a random session credential, validates Host/Origin, forwards to one configured server, and resolves only tailnet addresses. Its HttpOnly credential is stripped before proxying. CSP restricts web media and scripts to the gateway. HTTPS upstream certificates are verified normally. There is no general SOCKS proxy, arbitrary target parameter, TLS-bypass switch, or incoming tailnet listener in the release.

Enrollment keys are never stored in settings, build artifacts, or source. Tailscale must retain node identity on disk to reconnect. Keys can exist in native/Go memory during enrollment; memory erasure is not guaranteed. Jellyfin manages its own WebView session storage. Switching servers clears browser storage before loading the new application.

Loopback is a convenience boundary, not isolation from a compromised OS or malicious privileged local process. An attacker that controls the configured Jellyfin server controls the web client served by it. Tailscale coordination/relay behavior and its upstream engine remain part of the trust model. Developer Mode and a development build also require trusting the development machine.

## Dependency status

The Go engine is pinned to Tailscale 1.102.4 and built with Go 1.26.8. Initial `govulncheck` analysis found no reachable vulnerabilities; CI repeats this analysis. Four module-level findings were outside imported/reachable packages at initial validation. This is not a guarantee against unknown issues.

Amazon's compatible React Native 0.72 / SDK 0.22 tree inherits npm advisories in build/development dependencies including lodash, ip, image-size, toml, and fast-xml-parser. Compatible `npm audit fix` does not clear all findings. Major React Native replacement would break the pinned Vega integration, and some dependencies have no compatible fixed release.

The reviewed advisory URLs are recorded in `security/npm-advisories.json`. CI rejects newly reported advisories outside that list. The exceptions are explicit accepted preview limitations, not vulnerability fixes or a blanket clean audit. Do not expose Metro/the SDK development server to untrusted networks or build untrusted inputs. The release app does not launch Metro. Reassess these exceptions when updating Amazon's SDK and packages.

Use limited Tailscale grants and a Jellyfin account appropriate for a TV. Never embed a reusable auth key in CI secrets just to make tests pass: all automated tests use disposable local coordination and generated accounts.
