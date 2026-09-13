#!/usr/bin/env python3
import json
from pathlib import Path
import re

package = json.loads(Path("package.json").read_text())
manifest = Path("manifest.toml").read_text()
assert f'version = "{package["version"]}"' in manifest, "package and manifest versions differ"
assert 'id = "com.looizao.jellyvega"' in manifest
assert json.loads(Path("app.json").read_text())["name"] == "com.looizao.jellyvega.main"
assert re.search(r"require(?:\s*\()?\s*tailscale.com v1\.102\.4", Path("native/go.mod").read_text())
print("Package identity and pinned engine metadata agree.")
