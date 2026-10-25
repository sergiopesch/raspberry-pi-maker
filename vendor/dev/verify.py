#!/usr/bin/env python3
"""Verify the source-only npm distribution before dependency installation."""
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parent
ARCHIVE = "npm-12.2.1-sergiopesch-security-20261025.tgz"
SHA256 = "4c5b6938ef9472a15e6fa793ecd6bf7512da7f8cb9cb2adf109de21a9672bf5c"
INTEGRITY = "sha512-t8p5zliV3MTIfvNuZ7hFXI9CnmE03lEz/ebzmtxd3b73wMEhk/ZMuFOw0PUFlWKqW3XSI3GSj+EdjH7p+WMUyA=="

data = (ROOT / ARCHIVE).read_bytes()
assert hashlib.sha256(data).hexdigest() == SHA256, "owned npm archive SHA256 mismatch"
assert "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode() == INTEGRITY
provenance = json.loads((ROOT / "provenance.json").read_text())
assert provenance["archive"] == ARCHIVE and provenance["sha256"] == SHA256
assert provenance["integrity"] == INTEGRITY
with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
    observed = {}
    for member in archive:
        assert member.isfile() and member.name.startswith("package/")
        assert ".." not in Path(member.name).parts and member.name not in observed
        payload = archive.extractfile(member).read()
        observed[member.name] = {"size": len(payload), "sha256": hashlib.sha256(payload).hexdigest(),
                                 "mode": member.mode, "type": "file"}
    assert observed == provenance["members"], "owned npm member inventory mismatch"
for change in provenance["full_member_delta"]:
    name = change["path"]
    assert name in {"package/package.json", "package/OWNED-DISTRIBUTION.json"} or name.startswith((
        "package/node_modules/undici/", "package/node_modules/ip-address/"))
print("Owned development npm archive and complete member provenance verified.")
