#!/usr/bin/env python3
"""Validate the Raspberry Pi Maker OpenClaw plugin package."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
FRONTMATTER_PATTERN = re.compile(r"\A---\n(?P<body>.*?)\n---\n", re.DOTALL)
LINK_PATTERN = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
CODE_BLOCK_PATTERN = re.compile(r"```(?P<lang>[A-Za-z0-9_-]*)\n(?P<code>.*?)\n```", re.DOTALL)
PLUGIN_ID = "raspberry-pi-maker"


def error(message: str) -> str:
    return f"ERROR: {message}"


def warn(message: str) -> str:
    return f"WARN: {message}"


def load_json(path: Path) -> tuple[dict[str, object] | None, list[str]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None, [error(f"missing {path.relative_to(ROOT)}")]
    except json.JSONDecodeError as exc:
        return None, [error(f"invalid JSON in {path.relative_to(ROOT)}: {exc}")]

    if not isinstance(data, dict):
        return None, [error(f"{path.relative_to(ROOT)} must contain a JSON object")]
    return data, []


def validate_url(value: object, label: str) -> list[str]:
    if not isinstance(value, str) or not value.strip():
        return [error(f"{label} must be a non-empty string")]
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return [error(f"{label} must be an http(s) URL")]
    return []


def validate_package_json() -> list[str]:
    manifest, issues = load_json(ROOT / "package.json")
    if manifest is None:
        return issues

    for key in ["name", "version", "description", "type", "license"]:
        value = manifest.get(key)
        if not isinstance(value, str) or not value.strip():
            issues.append(error(f"package.json field {key!r} must be a non-empty string"))

    if manifest.get("name") != PLUGIN_ID:
        issues.append(error(f"package.json name must be {PLUGIN_ID!r}"))
    if manifest.get("type") != "module":
        issues.append(error('package.json type must be "module"'))
    if manifest.get("main") != "./index.js" or manifest.get("exports") != "./index.js":
        issues.append(error('package.json main and exports must point to "./index.js"'))
    if manifest.get("private") is True:
        issues.append(error("package.json must not be private for public sharing"))

    engines = manifest.get("engines")
    if not isinstance(engines, dict) or not engines.get("node"):
        issues.append(error("package.json engines.node is required"))

    publish_config = manifest.get("publishConfig")
    if not isinstance(publish_config, dict) or publish_config.get("access") != "public":
        issues.append(error('package.json publishConfig.access must be "public"'))
    if manifest.get("license") != "MIT":
        issues.append(error('package.json license must be "MIT"'))

    openclaw = manifest.get("openclaw")
    if not isinstance(openclaw, dict):
        issues.append(error("package.json openclaw field must be an object"))
    else:
        extensions = openclaw.get("extensions")
        if extensions != ["./index.js"]:
            issues.append(error('package.json openclaw.extensions must equal ["./index.js"]'))
        compat = openclaw.get("compat")
        if not isinstance(compat, dict) or not compat.get("pluginApi"):
            issues.append(error("package.json openclaw.compat.pluginApi is required"))
        if not isinstance(compat, dict) or not compat.get("minGatewayVersion"):
            issues.append(error("package.json openclaw.compat.minGatewayVersion is required"))

    scripts = manifest.get("scripts")
    if not isinstance(scripts, dict) or scripts.get("test") != "python3 scripts/validate_plugin.py":
        issues.append(error("package.json test script must run scripts/validate_plugin.py"))
    elif scripts.get("prepack") != "npm test && node --check index.js":
        issues.append(error("package.json prepack must run validation and JS syntax checks"))
    elif scripts.get("prepublishOnly") != "npm test && node --check index.js && npm pack --dry-run":
        issues.append(error("package.json prepublishOnly must run validation, JS check, and pack dry-run"))

    peer_deps = manifest.get("peerDependencies")
    if not isinstance(peer_deps, dict) or "openclaw" not in peer_deps:
        issues.append(error("package.json peerDependencies.openclaw is required"))

    for key in ["homepage"]:
        issues.extend(validate_url(manifest.get(key), f"package.json {key}"))

    repository = manifest.get("repository")
    if not isinstance(repository, dict) or repository.get("type") != "git":
        issues.append(error("package.json repository.type must be git"))
    elif repository.get("url") != f"git+https://github.com/sergiopesch/{PLUGIN_ID}.git":
        issues.append(error("package.json repository.url must use npm-normalized git+https form"))

    files = manifest.get("files")
    required_package_files = {
        "index.js",
        "openclaw.plugin.json",
        "assets/**",
        "skills/**",
        "references/**",
        "scripts/validate_plugin.py",
        "README.md",
        "LICENSE",
        "CONTRIBUTING.md",
        "CHANGELOG.md",
        "SECURITY.md",
    }
    if not isinstance(files, list) or not required_package_files.issubset(set(files)):
        issues.append(error("package.json files must include all public package assets"))

    return issues


def validate_release_files() -> list[str]:
    issues: list[str] = []
    stale_paths = [
        ".codex-plugin",
        "raspberry-pi-maker-1.0.0.tgz",
    ]
    for relative_path in stale_paths:
        if (ROOT / relative_path).exists():
            issues.append(error(f"remove stale/generated path before release: {relative_path}"))

    required_files = [
        "README.md",
        "LICENSE",
        "CONTRIBUTING.md",
        "CHANGELOG.md",
        "SECURITY.md",
        ".npmignore",
        "assets/raspberry-pi-maker-hero.png",
    ]
    text_release_files = {
        "README.md",
        "LICENSE",
        "CONTRIBUTING.md",
        "CHANGELOG.md",
        "SECURITY.md",
        ".npmignore",
    }
    for relative_path in required_files:
        path = ROOT / relative_path
        if not path.is_file():
            issues.append(error(f"missing release file {relative_path}"))
        elif relative_path in text_release_files and not path.read_text(encoding="utf-8").strip():
            issues.append(error(f"release file {relative_path} must not be empty"))

    license_text = (ROOT / "LICENSE").read_text(encoding="utf-8") if (ROOT / "LICENSE").is_file() else ""
    if "MIT License" not in license_text or "Copyright (c) 2026 Sergio Pesch" not in license_text:
        issues.append(error("LICENSE must contain the MIT license and copyright notice"))

    readme = (ROOT / "README.md").read_text(encoding="utf-8") if (ROOT / "README.md").is_file() else ""
    for phrase in [
        "assets/raspberry-pi-maker-hero.png",
        "Install From npm",
        "Publish Checklist",
        "Safety Scope",
        "Contributing",
        "Security",
        "License",
        "npm pack --dry-run",
        "prepublishOnly",
    ]:
        if phrase not in readme:
            issues.append(error(f"README.md missing public release section or phrase: {phrase}"))

    changelog = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8") if (ROOT / "CHANGELOG.md").is_file() else ""
    if "# Changelog" not in changelog or "1.0.0" not in changelog:
        issues.append(error("CHANGELOG.md must include a 1.0.0 entry"))

    security = (ROOT / "SECURITY.md").read_text(encoding="utf-8") if (ROOT / "SECURITY.md").is_file() else ""
    for phrase in ["# Security Policy", "Raspberry Pi Maker", "Hardware Safety"]:
        if phrase not in security:
            issues.append(error(f"SECURITY.md missing expected phrase: {phrase}"))

    hero_path = ROOT / "assets" / "raspberry-pi-maker-hero.png"
    if hero_path.is_file():
        png_signature = b"\x89PNG\r\n\x1a\n"
        if not hero_path.read_bytes().startswith(png_signature):
            issues.append(error("assets/raspberry-pi-maker-hero.png must be a PNG image"))
        if hero_path.stat().st_size > 3_000_000:
            issues.append(error("hero image should stay under 3 MB for README and package usability"))

    return issues


def validate_openclaw_manifest() -> list[str]:
    manifest, issues = load_json(ROOT / "openclaw.plugin.json")
    if manifest is None:
        return issues

    if manifest.get("id") != PLUGIN_ID:
        issues.append(error(f"openclaw.plugin.json id must be {PLUGIN_ID!r}"))

    for key in ["name", "description", "version"]:
        value = manifest.get(key)
        if not isinstance(value, str) or not value.strip():
            issues.append(error(f"openclaw.plugin.json {key} must be a non-empty string"))

    schema = manifest.get("configSchema")
    if not isinstance(schema, dict):
        issues.append(error("openclaw.plugin.json configSchema must be an object"))
    elif schema.get("type") != "object" or schema.get("additionalProperties") is not False:
        issues.append(error("openclaw.plugin.json configSchema must be a closed object schema"))

    skills = manifest.get("skills")
    if skills != ["skills"]:
        issues.append(error('openclaw.plugin.json skills must equal ["skills"]'))
    else:
        skill_root = (ROOT / "skills").resolve()
        if not skill_root.is_dir():
            issues.append(error("declared skills directory does not exist"))

    documented_fields = {
        "id",
        "name",
        "description",
        "version",
        "skills",
        "configSchema",
    }
    for key in manifest:
        if key not in documented_fields:
            issues.append(error(f"openclaw.plugin.json contains unsupported field {key!r}"))

    return issues


def validate_entrypoint() -> list[str]:
    path = ROOT / "index.js"
    try:
        text = path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return [error("missing index.js")]

    issues: list[str] = []
    required_snippets = [
        "const plugin =",
        f'id: "{PLUGIN_ID}"',
        "register()",
        "export default plugin",
    ]
    for snippet in required_snippets:
        if snippet not in text:
            issues.append(error(f"index.js missing expected snippet: {snippet}"))
    return issues


def validate_python_code_blocks() -> list[str]:
    issues: list[str] = []
    for path in sorted(ROOT.glob("**/*.md")):
        rel_path = path.relative_to(ROOT)
        text = path.read_text(encoding="utf-8")
        for index, match in enumerate(CODE_BLOCK_PATTERN.finditer(text), start=1):
            if match.group("lang").lower() != "python":
                continue
            try:
                compile(match.group("code"), f"{rel_path} code block {index}", "exec")
            except SyntaxError as exc:
                issues.append(error(f"{rel_path} python block {index} has invalid syntax: {exc}"))
    return issues


def parse_simple_frontmatter(text: str, path: Path) -> tuple[dict[str, str], list[str]]:
    match = FRONTMATTER_PATTERN.match(text)
    if not match:
        return {}, [error(f"{path.relative_to(ROOT)} missing YAML frontmatter")]

    metadata: dict[str, str] = {}
    issues: list[str] = []
    for line_number, line in enumerate(match.group("body").splitlines(), start=2):
        if not line.strip():
            continue
        if ":" not in line:
            issues.append(error(f"{path.relative_to(ROOT)}:{line_number} invalid frontmatter line"))
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip()
        if not key or not value:
            issues.append(
                error(f"{path.relative_to(ROOT)}:{line_number} frontmatter key/value must be non-empty")
            )
            continue
        metadata[key] = value.strip("\"'")
    return metadata, issues


def validate_skills() -> list[str]:
    skill_root = ROOT / "skills"
    skill_files = sorted(skill_root.glob("*/SKILL.md"))
    issues: list[str] = []
    if not skill_files:
        return [error("no skills/*/SKILL.md files found")]

    seen_names: set[str] = set()
    for path in skill_files:
        text = path.read_text(encoding="utf-8")
        metadata, frontmatter_issues = parse_simple_frontmatter(text, path)
        issues.extend(frontmatter_issues)

        name = metadata.get("name")
        description = metadata.get("description")
        if not name:
            issues.append(error(f"{path.relative_to(ROOT)} missing frontmatter name"))
        elif not re.fullmatch(r"[a-z][a-z0-9-]*", name):
            issues.append(error(f"{path.relative_to(ROOT)} name must be kebab-case"))
        elif name in seen_names:
            issues.append(error(f"duplicate skill name {name!r}"))
        else:
            seen_names.add(name)

        if path.parent.name != name:
            issues.append(error(f"{path.relative_to(ROOT)} directory name must match skill name"))

        if not description:
            issues.append(error(f"{path.relative_to(ROOT)} missing frontmatter description"))
        elif len(description) > 240:
            issues.append(warn(f"{path.relative_to(ROOT)} description is long ({len(description)} chars)"))

        metadata_json = metadata.get("metadata")
        if metadata_json:
            try:
                parsed = json.loads(metadata_json)
            except json.JSONDecodeError as exc:
                issues.append(error(f"{path.relative_to(ROOT)} metadata must be single-line JSON: {exc}"))
            else:
                if not isinstance(parsed, dict) or not isinstance(parsed.get("openclaw"), dict):
                    issues.append(error(f"{path.relative_to(ROOT)} metadata.openclaw must be an object"))

    return issues


def validate_markdown_links() -> list[str]:
    issues: list[str] = []
    markdown_files = sorted(ROOT.glob("**/*.md"))

    for path in markdown_files:
        if ".git" in path.relative_to(ROOT).parts:
            continue
        text = path.read_text(encoding="utf-8")
        for match in LINK_PATTERN.finditer(text):
            target = match.group(1).split("#", 1)[0]
            if not target or re.match(r"^[a-z][a-z0-9+.-]*:", target):
                continue
            resolved = (path.parent / target).resolve()
            try:
                resolved.relative_to(ROOT)
            except ValueError:
                issues.append(error(f"{path.relative_to(ROOT)} links outside repo: {match.group(1)}"))
                continue
            if not resolved.exists():
                issues.append(error(f"{path.relative_to(ROOT)} has broken link: {match.group(1)}"))

    return issues


def validate_reference_safety() -> list[str]:
    issues: list[str] = []
    checked_paths = [
        path
        for path in sorted(ROOT.glob("**/*.md"))
        if path.name.upper() != "CONTRIBUTING.MD"
    ]
    all_text = "\n".join(path.read_text(encoding="utf-8") for path in checked_paths)
    required_phrases = [
        "3.3V logic only",
        "Never connect a 5V signal directly",
        "common ground",
        "voltage divider or level shifter",
    ]
    for phrase in required_phrases:
        if phrase not in all_text:
            issues.append(error(f"missing safety phrase: {phrase}"))

    advanced = (ROOT / "references" / "projects" / "advanced.md").read_text(encoding="utf-8")
    if "debug=True" in advanced:
        issues.append(error("advanced Flask examples must not run debug=True on 0.0.0.0"))
    if "sudo pip3 install" in all_text or "sudo pip install" in all_text:
        issues.append(error("documentation must not recommend sudo pip install"))
    forbidden_secret_patterns = [
        "your_password",
        "MQTT_PASS = \"",
        "PASSWORD = \"",
        "TOKEN = \"",
        "API_KEY = \"",
    ]
    for pattern in forbidden_secret_patterns:
        if pattern in all_text:
            issues.append(error(f"documentation must not include hardcoded secret placeholder pattern: {pattern}"))

    for relative_path in [
        "references/projects/beginner.md",
        "references/projects/intermediate.md",
    ]:
        text = (ROOT / relative_path).read_text(encoding="utf-8")
        if "time.time()" in text:
            issues.append(error(f"{relative_path} should use time.monotonic() for elapsed-time examples"))

    return issues


def main() -> int:
    checks = [
        ("release files", validate_release_files),
        ("package", validate_package_json),
        ("manifest", validate_openclaw_manifest),
        ("entrypoint", validate_entrypoint),
        ("skills", validate_skills),
        ("markdown links", validate_markdown_links),
        ("reference safety", validate_reference_safety),
        ("python code blocks", validate_python_code_blocks),
    ]

    all_issues: list[str] = []
    for label, check in checks:
        all_issues.extend(f"{label}: {issue}" for issue in check())

    errors = [issue for issue in all_issues if "ERROR:" in issue]
    for issue in all_issues:
        stream = sys.stderr if "ERROR:" in issue else sys.stdout
        print(issue, file=stream)

    if errors:
        return 1

    print("OpenClaw plugin validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
