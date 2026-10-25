#!/usr/bin/env python3
"""Prepare only the packed manifest, retaining a guarded exact source backup."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGE = ROOT / "package.json"
BACKUP = ROOT / "reports" / "source-package-for-pack.json"


def digest(data):
    return hashlib.sha256(data).hexdigest()


def check_paths():
    if not stat.S_ISREG(PACKAGE.lstat().st_mode):
        raise ValueError("package.json must be a regular non-symlink file")
    try:
        reports_mode = BACKUP.parent.lstat().st_mode
    except FileNotFoundError:
        return False
    if not stat.S_ISDIR(reports_mode):
        raise ValueError("reports must be a non-symlink directory")
    try:
        backup_mode = BACKUP.lstat().st_mode
    except FileNotFoundError:
        return False
    if not stat.S_ISREG(backup_mode):
        raise ValueError("packing backup must be a regular non-symlink file")
    return True


def runtime_bytes(source):
    manifest = json.loads(source)
    if manifest.get("name") != "raspberry-pi-maker" or manifest.get("version") != "1.2.3":
        raise ValueError("unexpected source package identity")
    if not isinstance(manifest.get("devDependencies"), dict) or not isinstance(manifest.get("overrides"), dict):
        raise ValueError("source manifest must contain development dependencies and overrides")
    del manifest["devDependencies"]
    del manifest["overrides"]
    return (json.dumps(manifest, indent=2) + "\n").encode()


def write_package(data, mode):
    descriptor, temporary = tempfile.mkstemp(prefix=".package-manifest-", dir=ROOT)
    try:
        with os.fdopen(descriptor, "wb") as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.chmod(temporary, mode)
        os.replace(temporary, PACKAGE)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def check():
    if check_paths():
        raise ValueError("a packing backup already exists; after the original pack exits, run python3 scripts/runtime_manifest.py restore")
    runtime_bytes(PACKAGE.read_bytes())


def prepare():
    check()
    source = PACKAGE.read_bytes()
    runtime = runtime_bytes(source)
    mode = stat.S_IMODE(PACKAGE.stat().st_mode)
    if mode > 0o777:
        raise ValueError("unexpected source manifest permissions")
    record = {"format": 1, "root": str(ROOT), "source": base64.b64encode(source).decode(),
              "source_sha256": digest(source), "runtime_sha256": digest(runtime), "mode": mode}
    BACKUP.parent.mkdir(exist_ok=True)
    descriptor = os.open(BACKUP, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(descriptor, "w", encoding="utf8") as output:
        output.write(json.dumps(record) + "\n")
        output.flush()
        os.fsync(output.fileno())
    write_package(runtime, mode)
    print("Prepared runtime manifest without development dependencies or overrides.")


def restore():
    if not check_paths():
        return
    record = json.loads(BACKUP.read_text())
    if record.get("format") != 1 or record.get("root") != str(ROOT):
        raise ValueError("foreign or unsupported packing backup; source was not overwritten")
    if type(record.get("mode")) is not int or not 0 <= record["mode"] <= 0o777:
        raise ValueError("invalid packing backup permissions; source was not overwritten")
    source = base64.b64decode(record["source"], validate=True)
    runtime = runtime_bytes(source)
    if digest(source) != record["source_sha256"] or digest(runtime) != record["runtime_sha256"]:
        raise ValueError("packing backup integrity mismatch; source was not overwritten")
    current = digest(PACKAGE.read_bytes())
    if current == record["runtime_sha256"]:
        write_package(source, record["mode"])
    elif current != record["source_sha256"]:
        raise ValueError("package.json changed during packing; refusing to overwrite those changes")
    BACKUP.unlink()
    print("Restored the exact source package manifest.")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) == 2 else ""
    if command not in {"check", "prepare", "restore"}:
        raise SystemExit("usage: runtime_manifest.py check|prepare|restore")
    try:
        {"check": check, "prepare": prepare, "restore": restore}[command]()
    except (OSError, ValueError, KeyError) as error:
        raise SystemExit(str(error))
