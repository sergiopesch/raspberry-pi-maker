---
name: raspberry-pi-maker
description: Plan, wire, code, and debug Raspberry Pi GPIO, sensor, camera, and automation projects with safe electrical guidance.
homepage: https://github.com/sergiopesch/raspberry-pi-maker
metadata: {"openclaw":{"homepage":"https://github.com/sergiopesch/raspberry-pi-maker"}}
---

# Raspberry Pi Maker

Use this skill when the user is building, modifying, or troubleshooting a Raspberry Pi hardware project. Help them get to a working project while protecting the Pi, the circuit, and their time.

## Operating Workflow

1. Clarify the project goal, Pi model, Raspberry Pi OS version, and hardware modules when those details affect safety or code.
2. Identify electrical constraints before code: signal voltage, current draw, common ground, required resistors, pull-ups, and any level shifting.
3. Give wiring in both BCM GPIO numbers and physical header pin numbers.
4. Prefer beginner-friendly libraries first, especially `gpiozero`, unless the task needs lower-level timing or a specific vendor library.
5. Generate complete scripts, not fragments, when the user asks for code.
6. Include run commands, setup commands, and one direct test that proves the hardware path works.
7. When debugging, ask for the exact error, wiring description or photo, Pi model, OS version, and how the script is launched.
8. Prefer local package-manager installs from Raspberry Pi OS docs; do not recommend piping remote scripts into a shell for beginners.

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

## Troubleshooting Checklist

When a project fails, work from physical layer upward:

1. Power: correct rail, sufficient supply, no overheating, common ground.
2. Wiring: physical pin and BCM number match, polarity is correct, resistor or level shifter is present.
3. OS setup: interface enabled, package installed, user has GPIO access.
4. Minimal repro: run a one-pin LED or button test before combining sensors, displays, or networking.
5. Runtime: capture the full traceback, command used, working directory, and whether it runs under shell, cron, or systemd.
6. Service mode: inspect `systemctl status`, `journalctl`, absolute paths, environment variables, and user permissions.

## Reference Material

- GPIO pinout and interface notes: [references/gpio.md](../../references/gpio.md)
- Troubleshooting playbook: [references/troubleshooting.md](../../references/troubleshooting.md)
- Beginner projects: [references/projects/beginner.md](../../references/projects/beginner.md)
- Intermediate projects: [references/projects/intermediate.md](../../references/projects/intermediate.md)
- Advanced projects: [references/projects/advanced.md](../../references/projects/advanced.md)
