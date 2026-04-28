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

## Validation

Run the full local check before submitting changes:

```bash
npm test
node --check index.js
npm pack --dry-run
```

`npm test` validates plugin metadata, OpenClaw manifest shape, skill frontmatter, markdown links, safety text, and embedded Python code block syntax.
