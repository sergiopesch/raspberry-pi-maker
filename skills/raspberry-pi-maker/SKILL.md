---
name: raspberry-pi-maker
description: Guide the complete Raspberry Pi maker lifecycle with safe wiring, board comparison, authoritative resources, code, testing, deployment, and troubleshooting.
homepage: https://github.com/sergiopesch/raspberry-pi-maker
metadata: {"openclaw":{"homepage":"https://github.com/sergiopesch/raspberry-pi-maker"}}
---

# Raspberry Pi Maker

Use this skill when the user is building, modifying, or troubleshooting a Raspberry Pi hardware project. Help them get to a working project while protecting the Pi, the circuit, and their time.

## Lifecycle Routing

Identify the user's current stage before giving detailed guidance: `choose`,
`setup`, `design`, `build`, `code`, `test`, `debug`, `deploy`, `maintain`, or
`retire`. Use `pi_lifecycle_guide` when the request spans a stage or needs a
clear completion criterion. Use `pi_project_plan` when the user needs an
end-to-end project plan.

Do not collapse selection, wiring, coding, and deployment into a single step.
Move forward only when the current stage has enough evidence: exact hardware,
authoritative source material, explicit electrical assumptions, and a direct
test result.

## Operating Workflow

1. Clarify the project goal, Pi model, Raspberry Pi OS version, and hardware modules when those details affect safety or code.
2. Identify electrical constraints before code: signal voltage, current draw, common ground, required resistors, pull-ups, and any level shifting.
3. Give wiring in both BCM GPIO numbers and physical header pin numbers.
4. Prefer beginner-friendly libraries first, especially `gpiozero`, unless the task needs lower-level timing or a specific vendor library.
5. Generate complete scripts, not fragments, when the user asks for code.
6. Include run commands, setup commands, and one direct test that proves the hardware path works.
7. When debugging, ask for the exact error, wiring description or photo, Pi model, OS version, and how the script is launched.
8. Prefer local package-manager installs from Raspberry Pi OS docs; do not recommend piping remote scripts into a shell for beginners.
9. Use `pi_resource_search` for boards, official accessories, software, and
   common components. Use `pi_board_compare` before recommending a platform
   when Linux, real-time behavior, form factor, or interface tradeoffs matter.

## Authoritative Sources

Use sources in this order:

1. the exact board, chip, or module manufacturer's current documentation and errata
2. Raspberry Pi official documentation and Product Information Portal
3. upstream library or operating-system documentation
4. the exact breakout vendor's guide and schematic
5. reputable supplier integration guides
6. community posts only as corroborating evidence

"Publicly accessible" does not mean "public domain." Link to publisher-hosted
documentation and identify the publisher; do not reproduce third-party
datasheets. For voltage, current, timing, thermal, connector, or absolute
maximum values, tell the user to verify the current document revision.

Generic module names are not exact identities. HC-SR04, DHT22, RC522, GY-521,
relay boards, motor-driver boards, OLED boards, and many other modules have
clones and board-level variants. Ask for the PCB marking or a clear photo and
seller link when pinout, regulator, level shifting, pull-ups, address straps,
or power routing could vary.

## CLI-First Lab Workflow

Use this skill as an OpenClaw electronics bench companion. Prefer workflows that leave a reviewable trail:

1. Create or update a short project note with the goal, hardware list, pin map, power assumptions, and test plan.
2. Generate scripts under a clear project folder such as `scripts/`, `firmware/`, or `experiments/`.
3. Use explicit commands for each step: dependency install, interface enablement, hardware probe, minimal repro, full run, and log capture.
4. Save experiment outputs under `logs/` or `experiments/<date>/` when the user is comparing sensor readings, motor behavior, camera captures, or service reliability.
5. Recommend `systemd` units only after the foreground command works and the logs are understood.
6. Prefer idempotent helper CLIs such as `robotctl`, `benchctl`, or project-local shell scripts over ad hoc hardware-control commands.
7. When the user connects a Raspberry Pi to the laptop, use `pi_laptop_discovery_snapshot` before suggesting SSH, mounting storage, flashing images, or serial-console commands.

Do not improvise direct actuation commands for motors, relays, heaters, pumps, robot motion, or power switching. First propose a named script or helper command with conservative limits, require the user to review it, and include a safe dry-run/status command where possible.

## Safety Rules

- Treat Raspberry Pi GPIO as 3.3V logic only. Never connect a 5V signal directly to a GPIO input.
- Use a resistor for LEDs. A safe default is 330 ohms.
- Use a common ground between the Pi and externally powered modules.
- Do not power motors, servos, LED strips, relays, or high-current loads from a GPIO pin. Use a driver, transistor, relay module, or dedicated power supply as appropriate.
- For HC-SR04 Echo and other 5V outputs, require a voltage divider or level shifter before the GPIO input.
- Avoid GPIO0 and GPIO1 for ordinary projects because they are reserved for HAT EEPROM.
- Mention that wiring should be changed with power off when there is any risk of shorting pins.

## Code Standards

For Python scripts:

- Start with a shebang and a short module docstring.
- Put pin numbers in uppercase constants.
- Use BCM numbering consistently.
- Use `try`/`except KeyboardInterrupt`/`finally` or the library's close/cleanup path.
- Keep hardware setup explicit and close to the top of the file.
- Include concise comments only where hardware behavior is not obvious.
- Prefer `time.monotonic()` for elapsed-time measurements.
- Avoid tight busy-wait loops; use events, sleeps, or library helpers where possible.
- For long-running services, handle `SIGTERM` as well as `KeyboardInterrupt`.

Minimal `RPi.GPIO` structure:

```python
#!/usr/bin/env python3
"""Blink an LED connected to GPIO17 through a 330 ohm resistor."""

import time
import RPi.GPIO as GPIO

LED_PIN = 17


def main() -> None:
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(LED_PIN, GPIO.OUT)

    try:
        while True:
            GPIO.output(LED_PIN, GPIO.HIGH)
            time.sleep(1)
            GPIO.output(LED_PIN, GPIO.LOW)
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        GPIO.cleanup()


if __name__ == "__main__":
    main()
```

Beginner `gpiozero` structure:

```python
#!/usr/bin/env python3
"""Blink an LED connected to GPIO17 through a 330 ohm resistor."""

from signal import pause
from gpiozero import LED

LED_PIN = 17

led = LED(LED_PIN)
led.blink(on_time=1, off_time=1)

print("Blinking LED on GPIO17. Press Ctrl+C to stop.")
pause()
```

## Wiring Format

Give wiring as a short table or block:

```text
LED:
- GPIO17 / physical pin 11 -> 330 ohm resistor -> LED anode / long leg
- LED cathode / short leg -> GND / physical pin 9
```

Always name:

- BCM GPIO number
- physical header pin number
- resistor value
- voltage rail
- component polarity
- whether a pull-up, pull-down, driver, or level shifter is required

## Common Setup Commands

```bash
# Raspberry Pi OS packages
sudo apt update
sudo apt install python3-gpiozero python3-rpi.gpio

# Enable common interfaces
sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_ssh 0

# Inspect hardware
pinout
hostname -I
vcgencmd measure_temp
i2cdetect -y 1
```

Prefer `apt` packages for Raspberry Pi OS-managed Python libraries. Use a virtual environment for `pip` packages unless the package documentation explicitly recommends system installation.

## Laptop Discovery Workflow

When a Pi is plugged into the user's laptop, start passively:

1. Run `pi_laptop_discovery_snapshot`.
2. Explain visible clues from USB, serial devices, block devices, local interfaces, `raspberrypi.local`, and the neighbor table.
3. Ask before any action that could write to storage, open SSH, flash firmware, mount a filesystem, or drive hardware.
4. If a likely Pi is visible, propose the smallest next read-only command first, such as checking `raspberrypi.local`, identifying a serial device, or confirming the exact network interface.

## Troubleshooting Checklist

When a project fails, work from physical layer upward:

1. Power: correct rail, sufficient supply, no overheating, common ground.
2. Wiring: physical pin and BCM number match, polarity is correct, resistor or level shifter is present.
3. OS setup: interface enabled, package installed, user has GPIO access.
4. Minimal repro: run a one-pin LED or button test before combining sensors, displays, or networking.
5. Runtime: capture the full traceback, command used, working directory, and whether it runs under shell, cron, or systemd.
6. Service mode: inspect `systemctl status`, `journalctl`, absolute paths, environment variables, and user permissions.

## Reference Material

- Resource catalog strategy: [references/resources.md](../../references/resources.md)
- Complete maker lifecycle: [references/lifecycle.md](../../references/lifecycle.md)
- GPIO pinout and interface notes: [references/gpio.md](../../references/gpio.md)
- Troubleshooting playbook: [references/troubleshooting.md](../../references/troubleshooting.md)
- Beginner projects: [references/projects/beginner.md](../../references/projects/beginner.md)
- Intermediate projects: [references/projects/intermediate.md](../../references/projects/intermediate.md)
- Advanced projects: [references/projects/advanced.md](../../references/projects/advanced.md)
