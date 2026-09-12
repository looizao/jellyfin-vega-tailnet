# Contributing

Issues and pull requests are welcome, especially physical-device results from Vega OS 1.1 hardware.

## Development setup

```bash
git clone --recurse-submodules https://github.com/looizao/tailscale-vegaos.git
cd tailscale-vegaos
npm ci --ignore-scripts
npm run verify
```

To build a Vega package, install the SDK version named in `vega-sdk-requirements.json`, source `$HOME/vega/env`, and run `npm run build:release`.

## Pull requests

- Keep platform limitations explicit. Do not describe TailVega as a system VPN unless a supported Vega network API is implemented.
- Do not commit auth keys, Tailscale state, logs containing private addresses, generated `.vpkg` files, native archives, SDK files, or build caches.
- Add tests for status parsing and native lifecycle changes where practical.
- Run `npm run verify` before opening a pull request.
- Document the Vega OS build and device model for hardware test results.

By contributing, you agree that your contribution is licensed under the project's MIT License.
