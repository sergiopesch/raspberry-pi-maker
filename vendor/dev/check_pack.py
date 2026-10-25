#!/usr/bin/env python3
"""Check runtime archives without requiring source-only development assets."""
import json
from pathlib import Path
from pathlib import PurePosixPath
import sys
import tarfile

EXPECTED_FILES = {
    'package/CHANGELOG.md',
    'package/CONTRIBUTING.md',
    'package/LICENSE',
    'package/README.md',
    'package/SECURITY.md',
    'package/assets/raspberry-pi-maker-hero.png',
    'package/data/resources.json',
    'package/examples/led-button-logger/README.md',
    'package/examples/led-button-logger/led_button_logger.py',
    'package/index.js',
    'package/openclaw.plugin.json',
    'package/package.json',
    'package/references/gpio.md',
    'package/references/lifecycle.md',
    'package/references/projects/advanced.md',
    'package/references/projects/beginner.md',
    'package/references/projects/intermediate.md',
    'package/references/resources.md',
    'package/references/troubleshooting.md',
    'package/scripts/validate_plugin.py',
    'package/skills/raspberry-pi-maker/SKILL.md',
    'package/src/catalog.js',
    'package/src/discovery.js',
    'package/src/lifecycle.js',
    'package/src/pinout.js',
    'package/src/project.js',
    'package/src/safety.js',
    'package/templates/experiment.md',
    'package/templates/pin-map.md',
    'package/templates/systemd-service.md',
}

assert len(sys.argv) > 1, "provide the produced plugin archive"
for path in sys.argv[1:]:
    with tarfile.open(path) as archive:
        members = archive.getmembers()
        assert len(members) == 30 and {member.name for member in members} == EXPECTED_FILES
        for member in members:
            assert member.name.startswith("package/") and member.isfile(), member.name
            parts = PurePosixPath(member.name).parts
            assert ".." not in parts and not {"vendor", "node_modules"}.intersection(parts), member.name
            assert not member.name.endswith((".pem", ".tgz")), member.name
        package = json.load(archive.extractfile("package/package.json"))
        assert "devDependencies" not in package and "overrides" not in package
        source = json.loads((Path(__file__).resolve().parents[2] / "package.json").read_text())
        del source["devDependencies"]
        del source["overrides"]
        assert package == source, "packed manifest differs outside the two development fields"
        assert package["version"] == "1.2.3"
        assert package["peerDependencies"]["openclaw"] == ">=2026.5.22"
        assert package["engines"]["node"] == ">=22"
        assert package["peerDependenciesMeta"] == {"openclaw": {"optional": True}}
    print(f"Runtime archive {path}: {len(members)} files; no development vendor, installed modules, or TLS fixtures.")
