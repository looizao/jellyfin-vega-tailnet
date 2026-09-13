#!/usr/bin/env python3
"""Regression checks for dependency PRs that only change one toolchain pin."""
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = ["package.json", "package-lock.json", "manifest.toml", "CMakeLists.txt",
         "app.json", "native/go.mod", ".tool-versions", ".nvmrc",
         "tooling/Dockerfile", ".github/workflows/ci.yml"]


class MetadataTests(unittest.TestCase):
    def check(self, path=None, old=None, new=None):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in FILES:
                target = root / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(ROOT / name, target)
            if path:
                target = root / path
                original = target.read_text()
                self.assertIn(old, original)
                target.write_text(original.replace(old, new))
            return subprocess.run([sys.executable, str(ROOT / "scripts/check-metadata.py")],
                                  cwd=root, capture_output=True, text=True)

    def test_consistent_checkout(self):
        result = self.check()
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_reject_docker_only_upgrades(self):
        pins = dict(line.split() for line in (ROOT / ".tool-versions").read_text().splitlines())
        for old, new, message in [
            (f"node:{pins['nodejs']}", "node:99.0.0", "Docker node differs"),
            (f"golang:{pins['golang']}", "golang:99.0.0", "Docker golang differs"),
            ("ubuntu:22.04", "ubuntu:26.04", "Docker Ubuntu changed"),
        ]:
            with self.subTest(image=old):
                result = self.check("tooling/Dockerfile", old, new)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn(message, result.stderr)

    def test_reject_ci_drift(self):
        node = (ROOT / ".nvmrc").read_text().strip()
        result = self.check(".github/workflows/ci.yml", f"node-version: {node}", "node-version: 99.0.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CI node differs", result.stderr)

    def test_reject_types_for_another_runtime(self):
        import json
        version = json.loads((ROOT / "package.json").read_text())["devDependencies"]["@types/node"]
        result = self.check("package.json", f'"@types/node": "{version}"', '"@types/node": "99.0.0"')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Node types must match", result.stderr)


if __name__ == "__main__":
    unittest.main()
