# Contributing

Use the pinned Node/Go/SDK versions in README.md. Run `npm ci --ignore-scripts`, `npm run verify`, `npm run audit:go`, and `npm run test:browser`. A native or media change also requires `npm run build:release` and VPT validation. The Docker builder provides Amazon's supported Ubuntu environment.

Keep the gateway bound to loopback and limited to one tailnet peer. Preserve Range streaming, WebSockets, path prefixes, certificate verification, credential stripping, and server-change isolation. Regenerate native signatures with `npm run codegen` after modifying `src/native/NativeTailscale.ts`. Do not edit generated C++ files manually.

When changing a dependency with an audit exception, review and update SECURITY.md and the advisory inventory. Do not add blanket audit exclusions or disable the race detector to hide a failing test. Device logs and traces can contain session credentials; redact them before sharing.

## Release

Update the package/lockfile, manifest, CMake project version, native display version, and release notes together. Commit and push the verified source. Create a version tag matching package.json, for example `git tag -a v0.1.1 -m 'JellyVega 0.1.1 preview'`, then push that specific tag. The Release workflow rebuilds and tests the tag, downloads its own validated artifacts, verifies their checksums, and publishes a GitHub prerelease. No signing secrets are required for a development package.

## Dependency updates

Review the whole SDK compatibility profile before merging dependency updates. Docker-only Node or Go changes do not update the tools used by CI's source/browser jobs. `npm run metadata:check` rejects differences between `.tool-versions`, `.nvmrc`, the Docker builder, CI, and Node engine/types. Change those pins together when migrating toolchains. The ARMv7 CI job builds and uses the actual Dockerfile, so container changes must also pass native packaging. Ubuntu 22.04 remains the validated SDK host.

Keep React, React Native, Amazon's Kepler runtime, Metro, and Babel on a compatible SDK generation. A security PR that replaces that stack is a platform migration, even if it names a single vulnerable transitive package. Do not bypass peer dependency checks; the existing advisory exceptions remain documented in SECURITY.md until a compatible fix is validated. Babel 8 removes legacy runtime entry points used by older compiler stacks and needs a coordinated migration. Prettier 3 also requires replacing the SDK ESLint preset's older Prettier plugin.

Jest and ts-jest updates are grouped, as are GitHub Actions. Other tooling groups exclude major upgrades. Check Amazon's `kepler-compatibility.json` native interface mapping when updating WebView, then run the native package build; a desktop browser test alone cannot validate the native component.

Use Amazon-issued signing credentials only for the applicable Amazon publication/developer-signing workflow. Public release automation never stores personal tailnet credentials.
