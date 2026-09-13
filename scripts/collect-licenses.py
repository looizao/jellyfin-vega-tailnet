#!/usr/bin/env python3
"""Bundle the license files of pinned Go and production npm dependencies."""
import json
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parent.parent
output = root / "assets/licenses"
if output.exists():
    shutil.rmtree(output)
output.mkdir(parents=True)
for name in ["LICENSE", "THIRD_PARTY_NOTICES.md"]:
    shutil.copyfile(root / name, output / name)

def copy_licenses(directory, name):
    files = [p for p in directory.iterdir() if p.is_file() and p.name.upper().startswith(("LICENSE", "LICENCE", "COPYING", "NOTICE", "COPYRIGHT"))]
    destination = output / name.replace("/", "_").replace("@", "_")
    destination.mkdir(exist_ok=True)
    for file in files:
        shutil.copyfile(file, destination / file.name)
    return [p.name for p in files]

subprocess.run(["go", "mod", "download"], cwd=root / "native", check=True)
raw = subprocess.check_output(["go", "list", "-m", "-json", "all"], cwd=root / "native", text=True)
decoder, modules = json.JSONDecoder(), []
while raw.strip():
    module, end = decoder.raw_decode(raw.lstrip())
    raw = raw.lstrip()[end:]
    if module.get("Main"):
        continue
    directory = Path(module["Dir"]) if module.get("Dir") else None
    modules.append({"path": module["Path"], "version": module["Version"], "licenses": copy_licenses(directory, "go_" + module["Path"]) if directory else []})
(output / "go-modules.json").write_text(json.dumps(modules, indent=2) + "\n")

lock = json.loads((root / "package-lock.json").read_text())
packages = []
for name, meta in lock["packages"].items():
    if not name or meta.get("dev") or not (root / name).is_dir():
        continue
    packages.append({"path": name, "version": meta.get("version"), "licenses": copy_licenses(root / name, "npm_" + name)})
(output / "npm-packages.json").write_text(json.dumps(packages, indent=2) + "\n")
print(f"Bundled notices for {len(modules)} Go modules and {len(packages)} npm packages.")
