#!/usr/bin/env python3
import json
from pathlib import Path
import re

package = json.loads(Path("package.json").read_text())
lock = json.loads(Path("package-lock.json").read_text())
manifest = Path("manifest.toml").read_text()
assert f'version = "{package["version"]}"' in manifest, "package and manifest versions differ"
assert lock["version"] == lock["packages"][""]["version"] == package["version"], "lockfile version differs"
assert f'project(jellyvega VERSION {package["version"]} ' in Path("CMakeLists.txt").read_text(), "CMake version differs"
assert 'id = "com.looizao.jellyvega"' in manifest
assert json.loads(Path("app.json").read_text())["name"] == "com.looizao.jellyvega.main"
assert re.search(r"require(?:\s*\()?\s*tailscale.com v1\.102\.4", Path("native/go.mod").read_text())

pins = dict(line.split() for line in Path(".tool-versions").read_text().splitlines() if line.strip())
node, go = pins["nodejs"], pins["golang"]
docker = Path("tooling/Dockerfile").read_text()
workflow = Path(".github/workflows/ci.yml").read_text()
assert Path(".nvmrc").read_text().strip() == node, ".nvmrc differs from .tool-versions"
for image, version in [("node", node), ("golang", go)]:
    match = re.search(rf"^FROM {image}:([^\s]+)", docker, re.M)
    assert match and match[1].split("-")[0] == version, f"Docker {image} differs from .tool-versions; update the toolchain together"
for name, version in [("node", node), ("go", go)]:
    versions = re.findall(rf"^\s+{name}-version:\s*([^\s]+)", workflow, re.M)
    assert versions and set(versions) == {version}, f"CI {name} differs from .tool-versions"
major = int(node.split(".")[0])
assert package["engines"]["node"] == f">={major} <{major + 1}", "package Node engine differs from the pinned major"
assert int(package["devDependencies"]["@types/node"].split(".")[0]) == major, "Node types must match the runtime major"
# SDK 0.22 is validated here on Ubuntu 22.04. An OS migration needs its own build validation.
assert re.search(r"^FROM ubuntu:22\.04\s*$", docker, re.M), "Docker Ubuntu changed from the validated SDK host"
print("Package identity, Node/Go toolchains, and SDK host metadata agree.")
