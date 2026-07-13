# Changelog

## 1.2.0 - 2026-07-13

- Parse BCM and physical pin expressions without silently crossing numbering schemes.
- Make wiring checks conservative, negation-aware, and explicit about their limits.
- Add honest no-match search, typo tolerance, exact board aliases, and lifecycle-linked resources.
- Expand the reviewed catalog from 54 to 78 sources, including legacy boards, official accessories, and popular maker components.
- Redact local addresses, identifiers, mount details, and connection names from discovery by default.
- Split runtime logic into tested modules and load the plugin lazily after Gateway startup.
- Add weekly resource-link checks and trusted GitHub OIDC publishing for auditable ClawHub releases.

## 1.1.1 - 2026-07-13

- Replace the long release-oriented README with a concise builder-first page.
- Use a durable public URL for the ClawHub hero image.
- Keep installation, capabilities, safety boundaries, and development checks easy to scan.

## 1.1.0 - 2026-07-13

- Add a provenance-aware catalog of 54 authoritative Raspberry Pi board,
  accessory, software, datasheet, and popular-component resources.
- Cover every Raspberry Pi board family through the official hardware catalog
  and Product Information Portal, with individual profiles for current and
  commonly encountered boards.
- Add `pi_resource_search`, `pi_board_compare`, and `pi_lifecycle_guide` tools.
- Add evidence and exit criteria for choose, setup, design, build, code, test,
  debug, deploy, maintain, and retire stages.
- Add licensing and source-priority rules that link to publisher-hosted
  material without redistributing third-party documents.
- Add catalog schema, coverage, provenance, safety-note, and package checks.
- Update the current camera probe command from `libcamera-hello` to
  `rpicam-hello`.

## 1.0.1 - 2026-05-26

- Align package compatibility metadata with OpenClaw 2026.5.22 and Node 22+.
- Add CLI-first electronics lab workflow guidance for OpenClaw agent use.
- Add read-only OpenClaw tools for Pi project planning, pin lookup, wiring safety checks, and experiment log templates.
- Add a read-only laptop discovery snapshot tool for USB, serial, block-device, and local network clues when a Pi is connected.
- Add experiment, pin-map, and systemd templates plus a complete LED/button logger example.
- Clarify local installation, runtime verification, and the passive guidance safety boundary.
- Strengthen validation so manifest/package versions and OpenClaw compatibility drift are caught.

## 1.0.0 - 2026-04-28

- Package Raspberry Pi Maker as a native OpenClaw plugin.
- Add OpenClaw plugin manifest, runtime entrypoint, npm metadata, and validation.
- Move the skill into `skills/raspberry-pi-maker/SKILL.md`.
- Add GPIO, troubleshooting, and project references with safety-oriented examples.
- Add a generated README hero image and package it with the plugin assets.
