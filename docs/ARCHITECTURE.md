# Architecture and limitations

TailVega is an application-scoped userspace Tailscale node. It does not attempt to replace a system VPN service.

## Components

1. The React Native TV interface accepts the initial auth key, shows sanitized status, and invokes native operations.
2. A Kepler Turbo Module implements asynchronous `connect`, `status`, `disconnect`, and TCP `probe` methods in C++.
3. The module links a Go `c-archive` produced from the official `tailscale/libtailscale` C API.
4. `libtailscale` runs `tsnet`, stores node state in the app's private data directory, and connects directly to the Tailscale control and data planes.

The build cross-compiles Go with the Vega ARMv7 compiler and sysroot selected by CMake. No prebuilt native archive is committed or trusted by the release workflow.

## Data flow

```text
Auth key -> secure React Native input -> Turbo Module -> tsnet configuration
                                                |
                                                +-> private tailscaled.state
                                                +-> tailnet control/data traffic

Status JSON <- Turbo Module <- in-memory libtailscale LocalAPI

TCP destination -> Turbo Module -> tailscale_dial -> tailnet peer
```

The JavaScript auth-key state is cleared after `connect` returns. The C++ input buffer is overwritten after the key has been passed to `libtailscale`. Engine logs are disabled to reduce accidental credential or tailnet metadata exposure. Vega OS still controls process memory and private application storage.

## Why this is not a full VPN

A normal Tailscale client creates or integrates with a system network interface and asks the operating system to route device traffic through it. Public Vega APIs do not currently provide third-party applications with the required VPN or TUN integration. An app-scoped `tsnet` server therefore cannot intercept traffic from unrelated Fire TV applications.

Consequences:

- TailVega does not route streaming applications or the Fire TV browser through a tailnet.
- It cannot use a Tailscale exit node for device-wide internet traffic.
- It cannot advertise the Fire TV as a subnet router or exit node.
- Tailnet access must be performed by TailVega itself or by software explicitly configured for its SOCKS5 endpoint.
- Vega may suspend or terminate the app in the background, interrupting connectivity until it is launched again.

If Amazon publishes a supported VPN or TUN API, a future version can add a platform network backend while preserving much of the current UI and build pipeline.

## Lifecycle

On first connection, TailVega initializes `tsnet`, provides the one-off key, starts the node, and saves the resulting identity. On later app launches, it detects the saved state and starts without requesting another auth key. **Stop** shuts down the in-process server but intentionally preserves identity. Uninstalling the app removes the private state.

## Release integrity

CI checks JavaScript linting, TypeScript, Jest tests, and the native C ABI lifecycle on an Ubuntu host. The ARMv7 job installs a checksum-pinned Vega SDK, rebuilds `libtailscale` from the pinned submodule source, builds the `.vpkg`, and validates it with Vega Package Tooling. The release workflow publishes only that rebuilt package and its SHA-256 checksum.

These checks validate compilation and packaging. They do not substitute for runtime validation on physical hardware, which remains necessary for each release candidate.
