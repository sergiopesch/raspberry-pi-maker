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

Run the full local check before submitting changes:

```bash
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
