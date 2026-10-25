# Contributing

Raspberry Pi Maker is safety-sensitive instructional content. Contributions should improve correctness, clarity, and practical reliability for real hardware projects.

## Standards

- Give both BCM GPIO numbers and physical pin numbers when describing wiring.
- Treat Raspberry Pi GPIO as 3.3V logic only.
- Require resistors, drivers, level shifters, and common ground wherever the circuit needs them.
- Prefer Raspberry Pi OS package-manager installs when available.
- Do not recommend `sudo pip install` or piping remote install scripts into a shell.
- Keep code examples complete enough to run and safe enough to stop cleanly.
- Avoid hardcoded secrets, tokens, passwords, Wi-Fi credentials, or personal hostnames.

## Resource Catalog Contributions

Catalog entries belong in `data/resources.json` and must:

- prefer manufacturer, Raspberry Pi, or upstream project documentation
- use HTTPS and identify the publisher and authority type
- provide original concise summaries instead of copying source text
- state that publisher terms apply rather than claiming public-domain status
- include lifecycle stages, useful aliases, and topics
- include an explicit safety note for component entries
- identify obsolete or end-of-life parts that remain popular in existing builds

For generic breakout modules, document that PCB variants can differ. A chip
datasheet is not proof of a breakout board's pinout, regulator, level shifting,
pull-ups, or address straps.

## Validation

Use Node.js 24.19.0 for development and release checks, then install the locked
dependencies with `npm ci`. The development SDK is pinned independently of the
consumer compatibility floor of OpenClaw 2026.5.22 and Node.js 22.
Version-specific overrides patch the SDK's Undici, Zod, and bundled npm
dependencies until OpenClaw updates its pins. The owned npm archive, source
integrities, member provenance, and rebuild tools are under `vendor/dev` and are
excluded from the published plugin. Recheck these overrides and the full
development dependency audit when upgrading the SDK. Operator hosts require
their own updates; plugin development overrides are not inherited by consumers.
OpenClaw is a host-provided peer: its >=2026.5.22 constraint and runtime SDK import
remain required, while npm does not auto-install another Gateway for the plugin.

Normal `npm pack` runs the source checks, temporarily omits only development
dependencies and overrides from the packed manifest, then restores the exact
source bytes in `postpack`. This keeps older supported native installers from
resolving source-only archive paths. A guarded backup lives under `reports`.
If packing fails after preparation (including tar or destination-write errors),
or is forcibly interrupted, wait for that pack process to exit and run
`python3 scripts/runtime_manifest.py restore` before continuing. Recovery refuses
foreign backups or a manifest edited during packing; reconcile those changes
manually. Failed packing and SIGKILL do not guarantee automatic cleanup.

Run the full local check before submitting changes:

```bash
npm run check:dev-sdk
npm audit --audit-level=low
npm test
node --check index.js
npm run plugin:validate
npm pack --dry-run
```

When changing catalog URLs, also run:

```bash
npm run check:links
```

The link check fails definite `404` and `410` responses. It reports access-denied and rate-limited publishers separately because several authoritative sites intentionally block automated clients.

`npm test` validates plugin metadata, OpenClaw manifest shape, resource catalog
schema and coverage, skill frontmatter, markdown links, safety text, and
embedded Python code block syntax. CI validates both the declared minimum
OpenClaw host and the current release used for this package.
