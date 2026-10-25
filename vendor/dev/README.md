# Development npm distribution

This directory supports the development OpenClaw 2026.10.5 SDK. It is excluded
from the published Raspberry Pi Maker plugin. Installing the plugin does not
apply these development overrides to an operator's OpenClaw host.

The owned npm 12.2.1 distribution preserves npm's module name and CLI, identifies
itself as `12.2.1+sergiopesch.security.20261025`, and replaces only its bundled
Undici 6.29.0 and ip-address 10.7.2 packages with the complete official 6.29.1 and
10.7.4 packages. All other npm code and all license files retain their original
bytes. The archive includes its downstream change and license notice.

`sources.json` pins official source archives by SHA512 integrity and SHA1.
The root development npm dependency anchors the portable archive path; the
version-specific OpenClaw override references it with npm's `$npm` syntax.
`provenance.json` records the owned archive integrity, every member hash and mode,
and the complete delta. `verify.py` verifies these bytes without executing them.

To reproduce both the patched archive and an owned-identity negative control:

```bash
python3 vendor/dev/rebuild.py
python3 vendor/dev/verify.py
```

The builder verifies every official download, preserves complete library
packages, and emits deterministic gzip/tar output. The reviewed bytes were built
with Python 3.12 and zlib 1.2.13. It does not run npm's upstream prepack script,
which requires source workspaces absent from the published npm distribution.

Run `npm run check:dev-sdk` after a normal `npm ci`. The focused compatibility
checks use local HTTP/TLS fixtures; OpenSSL is required to create a temporary
test certificate. They make no requests to an external runtime service.

The control and patched distributions have the same owned name/version but
different archive integrities. Full audits of ordinary file-archive installs
reported two vulnerable bundled packages for the control and zero for the
patched archive, with the same 148-dependency inventory. These checks establish
the development artifact boundary; upstream consumer hosts need separate audits.
