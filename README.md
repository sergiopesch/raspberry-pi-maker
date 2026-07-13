# Raspberry Pi Maker

![Raspberry Pi Maker workbench](https://raw.githubusercontent.com/sergiopesch/raspberry-pi-maker/master/assets/raspberry-pi-maker-hero.png)

Plan, wire, debug, and ship Raspberry Pi projects with authoritative docs and practical safety checks.

```bash
openclaw plugins install clawhub:raspberry-pi-maker
```

## What it does

- Finds official Raspberry Pi documentation and manufacturer datasheets.
- Compares boards by compute, connectivity, form factor, and best fit.
- Maps BCM GPIO numbers to physical pins on the 40-pin header.
- Builds project plans, test paths, lifecycle checklists, and experiment logs.

Try asking:

- “Compare Pi 5, Zero 2 W, and Pico 2 W for a battery-powered sensor.”
- “Find the official datasheet for this component.”
- “Check this wiring before I apply power.”
- “Give me a test and deployment plan for this build.”

## OpenClaw tools

| Tool | Job |
| --- | --- |
| `pi_project_plan` | Turn an idea into a build and test plan. |
| `pi_resource_search` | Search 54 reviewed board, component, software, and datasheet sources. |
| `pi_board_compare` | Compare indexed Raspberry Pi boards. |
| `pi_lifecycle_guide` | Move a project from selection through retirement. |
| `pi_pin_lookup` | Look up 40-pin header pins. |
| `pi_wiring_safety_check` | Flag common wiring risks for review. |
| `pi_experiment_log_template` | Create a repeatable lab record. |
| `pi_laptop_discovery_snapshot` | Inspect connected USB, serial, storage, and local-network clues. |

## Safety scope

Raspberry Pi GPIO uses **3.3V logic**. Never connect 5V to a GPIO input or drive motors, relays, mains voltage, or high-current loads directly from a GPIO pin.

The plugin is advisory and intentionally non-actuating. It does not flash firmware, change GPIO state, mount disks, open SSH sessions, or write user files. Verify the exact board, module, wiring, and current datasheet before applying power.

## Inside

- An authoritative resource catalog with publisher, source, lifecycle, and safety metadata.
- Beginner-to-advanced project guides and troubleshooting playbooks.
- Pin-map, experiment-log, and `systemd` handoff templates.
- One complete LED and button logger example.

Publicly accessible documentation is not necessarily public domain. This project links to publisher-hosted sources and respects their licensing terms.

## Compatibility

- OpenClaw `>=2026.5.22`
- Node.js `>=22`

## Development

```bash
npm test
npm run plugin:validate
```

See [Contributing](https://github.com/sergiopesch/raspberry-pi-maker/blob/master/CONTRIBUTING.md), [Security](https://github.com/sergiopesch/raspberry-pi-maker/blob/master/SECURITY.md), and the [changelog](https://github.com/sergiopesch/raspberry-pi-maker/blob/master/CHANGELOG.md).

MIT © Sergio Pesch
