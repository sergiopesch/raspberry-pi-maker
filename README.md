# Raspberry Pi Maker

![Raspberry Pi Maker hero image showing a GPIO project workbench with wiring, an LED, a button, sensors, and code panels](assets/raspberry-pi-maker-hero.png)

Raspberry Pi Maker is a native OpenClaw plugin for the complete maker lifecycle: choosing hardware, setup, electrical design, wiring, coding, testing, debugging, deployment, maintenance, and responsible retirement.

## Compatibility

- OpenClaw: `>=2026.5.22`
- Node.js: `>=22`
- Package format: native OpenClaw tool plugin with a skill bundle and read-only planning helpers

## What It Provides

- A focused OpenClaw skill at `skills/raspberry-pi-maker/SKILL.md`
- GPIO and interface reference material
- Beginner, intermediate, and advanced project guides
- A generated README hero image at `assets/raspberry-pi-maker-hero.png`
- Troubleshooting workflows for GPIO, I2C, camera, networking, boot, and service issues
- A machine-readable catalog of authoritative board, accessory, component, datasheet, and software resources
- Lifecycle guidance with evidence and exit criteria from selection through retirement
- A local validation script for plugin metadata, skill frontmatter, and markdown links
- CLI-first lab workflow guidance for repeatable electronics experiments
- Templates for experiment logs, pin maps, and service handoff checklists
- Read-only OpenClaw tools for resource search, board comparison, lifecycle guidance, project planning, pin lookup, wiring safety checks, laptop discovery snapshots, and experiment log templates

## Authoritative Resource Catalog

The bundled `data/resources.json` index contains 54 reviewed entries across:

- the complete official Raspberry Pi board catalog, including current, legacy, and end-of-life families
- current and popular SBC, Zero, keyboard, Compute Module, and Pico-series boards
- official cameras, Touch Display 2, AI HATs, M.2 HAT+, Build HAT, and HAT+ design documentation
- Raspberry Pi OS, configuration, remote access, GPIO Zero, camera, AI, Pico SDK, and MicroPython documentation
- widely used sensors, ADCs, displays, LED controllers, NFC/RFID parts, and motor/load drivers

Every result includes a publisher, authority type, source URL, lifecycle tags,
and review date. High-risk component entries also carry a safety note. The
official hardware catalog and Product Information Portal provide complete
coverage for historical models and controlled product documents, while
individual entries make common hardware discoverable by aliases such as
`Pi 5`, `Pico 2 W`, `HC-SR04`, `NeoPixel`, and `RC522`.

Publicly accessible material is not necessarily public domain. Raspberry Pi's
documentation is published under CC BY-SA 4.0, while datasheets and product
briefs can use other publisher terms. This package links to authoritative
publisher-hosted documents and does not redistribute third-party PDFs. Always
verify the exact board/module marking and current document revision before
purchase, wiring, or power-up.

## Safety Scope

This plugin provides educational guidance for low-voltage Raspberry Pi projects. Users are responsible for verifying wiring before applying power and for using appropriate drivers, level shifting, fuses, isolation, and enclosures for their hardware.

Do not use Raspberry Pi GPIO pins to directly drive motors, mains voltage, high-current loads, relays without suitable driver circuitry, or any safety-critical system.

This package is intentionally non-actuating: it ships OpenClaw skill/reference material and read-only planning tools. It does not register tools that actuate GPIO, serial ports, firmware, motors, relays, or power supplies, and it does not write user files. It reads its own bundled catalog and can run bounded read-only laptop discovery commands. For robotics or electronics automation, wrap physical actions behind reviewed project-local commands such as `robotctl status`, `robotctl flash`, or `benchctl power off <target>`, then expose only those commands through your OpenClaw tool policy.

## OpenClaw Tools

The plugin registers eight deterministic helper tools:

| Tool | Purpose |
| --- | --- |
| `pi_project_plan` | Create a safety-first Raspberry Pi project plan. |
| `pi_resource_search` | Search authoritative Raspberry Pi and popular-component resources by query, kind, and lifecycle stage. |
| `pi_board_compare` | Compare Linux, real-time, wireless, form-factor, header, best-fit, and caution factors for indexed boards. |
| `pi_lifecycle_guide` | Get stage-specific actions, evidence, exit criteria, next stage, and matching resources. |
| `pi_pin_lookup` | Map physical pins and BCM GPIO numbers on the 40-pin header. |
| `pi_wiring_safety_check` | Flag common wiring risks such as 5V GPIO inputs, missing LED resistors, and direct high-current loads. |
| `pi_experiment_log_template` | Generate a repeatable experiment log template. |
| `pi_laptop_discovery_snapshot` | Collect a read-only snapshot of USB, serial, block, and local network clues visible from the laptop. |

These tools are advisory. The resource tools search a local reviewed catalog and do not fetch or copy remote documents at runtime. The laptop discovery tool runs bounded read-only inspection commands only; it does not mount disks, open SSH, scan networks, flash firmware, or touch GPIO. Verify wiring and component datasheets before applying power.

## CLI-First Lab Pattern

Use this plugin with a project workspace that keeps hardware state explicit:

```text
electronics-project/
  AGENTS.md
  hardware/
  firmware/
  templates/
  scripts/
  experiments/
  logs/
```

Recommended flow:

1. Document the goal, Pi model, connected modules, power rails, and pin map.
2. Run a minimal hardware probe before combining components.
3. Capture command output and sensor readings into `logs/` or `experiments/<date>/`.
4. Promote working commands into small helper scripts.
5. Only run services through `systemd` after the foreground command works.

## Templates And Examples

- `templates/experiment.md` - repeatable experiment log
- `templates/pin-map.md` - BCM/physical pin mapping worksheet
- `templates/systemd-service.md` - service checklist and starter unit
- `examples/led-button-logger/` - complete LED/button foreground logging project

## OpenClaw Plugin Format

This project is packaged as a native OpenClaw tool plugin with a lightweight runtime entrypoint and a declared skill root.

OpenClaw detects the plugin from:

- `package.json` with `openclaw.extensions`
- `openclaw.plugin.json`
- `skills/`

The manifest declares `skills: ["skills"]`, so OpenClaw loads the bundled skill when the plugin is enabled.
It also declares `contracts.tools` so OpenClaw can discover the read-only helper tools without importing runtime code.

## Install From ClawHub

Once the 1.1.0 release has passed ClawHub review:

```bash
openclaw plugins search "raspberry pi"
openclaw plugins install clawhub:raspberry-pi-maker
openclaw plugins inspect raspberry-pi-maker --runtime --json
```

Use the explicit `clawhub:` prefix so the install source and registry scan
record are unambiguous.

## Install From npm

After this package is published:

```bash
openclaw plugins install npm:raspberry-pi-maker
openclaw gateway restart
openclaw plugins inspect raspberry-pi-maker --runtime --json
openclaw skills info raspberry-pi-maker
openclaw health
```

## Publish Checklist

Before publishing:

```bash
npm test
node --check index.js
openclaw plugins build --root . --entry ./index.js --check
openclaw plugins validate --root . --entry ./index.js
npm pack --dry-run
clawhub package publish . --family code-plugin --owner sergiopesch --name raspberry-pi-maker --display-name "Raspberry Pi Maker" --version 1.1.0 --dry-run
```

`npm pack --dry-run` should show only the public plugin files, documentation, references, validator, and README image.

Keep `--family code-plugin` explicit. Because this package also bundles a
skill, relying on ClawHub family auto-detection can preview it as a bundle
plugin instead of a native code plugin.

The package also has `prepack` and `prepublishOnly` scripts that run the release checks automatically.

## Install Locally

From the parent directory:

```bash
openclaw plugins install ./raspberry-pi-maker --link
openclaw gateway restart
openclaw plugins inspect raspberry-pi-maker --runtime --json
openclaw skills info raspberry-pi-maker
```

Without `--link`, OpenClaw copies the plugin into its managed install area. With `--link`, edits in this repository remain live after refresh.

## Validate During Development

Run the repository validator:

```bash
npm test
```

Before publishing or sharing a release, also run:

```bash
node --check index.js
openclaw plugins build --root . --entry ./index.js --check
openclaw plugins validate --root . --entry ./index.js
npm pack --dry-run
openclaw plugins install ./raspberry-pi-maker --link
openclaw gateway restart
openclaw plugins inspect raspberry-pi-maker --runtime --json
openclaw skills info raspberry-pi-maker
```

Recommended OpenClaw checks after installation:

```bash
openclaw plugins doctor
openclaw plugins inspect raspberry-pi-maker
openclaw skills check
```

## Repository Layout

```text
package.json                       npm metadata and OpenClaw entrypoint declaration
openclaw.plugin.json               OpenClaw manifest and skill root declaration
index.js                           Lightweight native plugin entrypoint
assets/                            README and package image assets
skills/raspberry-pi-maker/SKILL.md OpenClaw-loaded Raspberry Pi skill
references/                        Supporting GPIO, troubleshooting, and project docs
data/resources.json                Reviewed board, component, datasheet, accessory, and software index
templates/                         Project worksheets and lab templates
examples/                          Complete example projects
scripts/validate_plugin.py         Dependency-free local validation
CHANGELOG.md                       Release history
SECURITY.md                        Security and hardware-safety reporting policy
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for safety and validation standards.

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting and hardware-safety scope.

## License

MIT. See [LICENSE](LICENSE).
