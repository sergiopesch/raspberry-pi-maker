---
name: raspberry-pi-maker
description: Guide users through Raspberry Pi projects with Python code generation, GPIO wiring, sensor integration, and troubleshooting. Use when building Pi projects, learning Linux/Python electronics, debugging GPIO issues, or setting up Pi services. Supports beginners learning by building.
metadata: {"openclaw":{"emoji":"🥧"}}
---

# Raspberry Pi Maker

Guide users through Raspberry Pi projects step-by-step. Generate Python code, explain wiring, troubleshoot issues.

## Workflow: Planning (Claude) + Coding (Codex)

**Use this division of labor:**
- **Claude (you):** Plan the project, explain concepts, describe wiring, review code, troubleshoot
- **Codex:** Generate the actual Python scripts

**When the user needs code:**
1. Plan what the code should do
2. Spawn Codex to write it:
   ```bash
   codex exec "Write a Python script for Raspberry Pi that [description].
   Use [gpiozero/RPi.GPIO]. GPIO pins: [list].
   Include shebang, docstring, proper cleanup with try/finally.
   Add comments explaining each section."
   ```
3. Review the generated code
4. Explain it to the user

## Core Workflow

1. **Understand the goal** — What are they building? Which Pi model?
2. **Check requirements** — Does it need GPIO, camera, networking?
3. **Explain wiring** — Clear, pin-by-pin with GPIO numbers
4. **Generate code** — Spawn Codex for complete Python scripts
5. **Test & iterate** — Help debug when things don't work

## Generating Code

Always generate **complete, working Python scripts**:

```python
#!/usr/bin/env python3
"""
Project: [Name]
Description: [What it does]
Hardware: Raspberry Pi [model], [components]
"""

import RPi.GPIO as GPIO
import time

# Pin definitions (BCM numbering)
LED_PIN = 17

def setup():
    GPIO.setmode(GPIO.BCM)
    GPIO.setup(LED_PIN, GPIO.OUT)

def main():
    try:
        setup()
        while True:
            GPIO.output(LED_PIN, GPIO.HIGH)
            time.sleep(1)
            GPIO.output(LED_PIN, GPIO.LOW)
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nExiting...")
    finally:
        GPIO.cleanup()

if __name__ == "__main__":
    main()
```

**Code style:**
- Shebang line for direct execution
- Docstring explaining the project
- Constants for pin numbers (UPPERCASE)
- try/except/finally for clean GPIO cleanup
- `GPIO.setmode(GPIO.BCM)` — always use BCM numbering

## GPIO Reference

Quick reference for Raspberry Pi GPIO:

```
                    3V3 [1]  [2]  5V
          GPIO2/SDA [3]  [4]  5V
          GPIO3/SCL [5]  [6]  GND
              GPIO4 [7]  [8]  GPIO14/TX
                GND [9]  [10] GPIO15/RX
             GPIO17 [11] [12] GPIO18/PWM
             GPIO27 [13] [14] GND
             GPIO22 [15] [16] GPIO23
                3V3 [17] [18] GPIO24
    GPIO10/SPI_MOSI [19] [20] GND
     GPIO9/SPI_MISO [21] [22] GPIO25
    GPIO11/SPI_SCLK [23] [24] GPIO8/SPI_CE0
                GND [25] [26] GPIO7/SPI_CE1
     GPIO0/ID_SD    [27] [28] GPIO1/ID_SC
              GPIO5 [29] [30] GND
              GPIO6 [31] [32] GPIO12
             GPIO13 [33] [34] GND
    GPIO19/SPI_MISO [35] [36] GPIO16
             GPIO26 [37] [38] GPIO20
                GND [39] [40] GPIO21
```

**Key pins:**
- **3.3V**: Pins 1, 17 (limited current!)
- **5V**: Pins 2, 4
- **GND**: Pins 6, 9, 14, 20, 25, 30, 34, 39
- **I2C**: GPIO2 (SDA), GPIO3 (SCL)
- **SPI**: GPIO10/11/8/7
- **UART**: GPIO14 (TX), GPIO15 (RX)
- **PWM**: GPIO18 (hardware PWM)

⚠️ **Pi GPIO is 3.3V only!** Never connect 5V signals directly.

For detailed pinouts: See [references/gpio.md](references/gpio.md)

## Wiring Instructions

Be explicit with BCM pin numbers:

```
LED (any color):
├── Long leg (anode, +) → 330Ω resistor → GPIO17 (pin 11)
└── Short leg (cathode, -) → GND (pin 9)

Button (with internal pullup):
├── One side → GPIO27 (pin 13)
└── Other side → GND (pin 14)
```

**Always specify:**
- BCM number AND physical pin number
- Resistor values
- Power source (3.3V vs 5V)
- Component polarity

## Common Libraries

| Library | Use For | Install |
|---------|---------|---------|
| RPi.GPIO | Basic GPIO | Pre-installed |
| gpiozero | Beginner-friendly GPIO | Pre-installed |
| pigpio | Precise timing, PWM | `sudo apt install pigpio` |
| picamera2 | Camera | `sudo apt install python3-picamera2` |
| smbus2 | I2C devices | `pip install smbus2` |
| spidev | SPI devices | `pip install spidev` |
| adafruit-circuitpython-* | Adafruit sensors | `pip install adafruit-circuitpython-[sensor]` |

## Running Scripts

```bash
# Make executable
chmod +x my_script.py

# Run directly
./my_script.py

# Or with Python
python3 my_script.py

# Run at boot (crontab)
crontab -e
# Add: @reboot python3 /home/pi/my_script.py
```

## Debugging

When something doesn't work, ask:

1. **Which Pi model?** (Zero, 3, 4, 5 have different capabilities)
2. **Error message?** (paste the full traceback)
3. **How are you running it?** (terminal, cron, IDE)
4. **GPIO permissions?** (`sudo` or gpio group)

Common issues:
- **Permission denied** → Run with `sudo` or add user to gpio group
- **GPIO already in use** → Previous script didn't cleanup, reboot or `GPIO.cleanup()`
- **Module not found** → Install with `pip3 install [module]`
- **Pin not working** → Check BCM vs BOARD numbering

For detailed troubleshooting: See [references/troubleshooting.md](references/troubleshooting.md)

## Project Guides

**Beginner:**
- Blink LED — GPIO basics
- Button input — Digital input, pull-ups
- LED brightness (PWM) — Analog-like output
- See [references/projects/beginner.md](references/projects/beginner.md)

**Intermediate:**
- Temperature sensor (DHT22)
- I2C LCD display
- Distance sensor (HC-SR04)
- See [references/projects/intermediate.md](references/projects/intermediate.md)

**Advanced:**
- Web-controlled GPIO (Flask)
- Camera streaming
- Home automation dashboard
- See [references/projects/advanced.md](references/projects/advanced.md)

## RPi.GPIO vs gpiozero

**RPi.GPIO** — Lower level, more control:
```python
import RPi.GPIO as GPIO
GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)
GPIO.output(17, GPIO.HIGH)
```

**gpiozero** — Beginner-friendly, object-oriented:
```python
from gpiozero import LED
led = LED(17)
led.on()
```

Use **gpiozero** for beginners, **RPi.GPIO** when you need precise control.

## Teaching Approach

When helping beginners:

1. **Start with gpiozero** — Simpler syntax, fewer errors
2. **Explain the "why"** — Why cleanup? Why BCM numbering?
3. **Build incrementally** — LED → Button → Sensor → Display
4. **Encourage experimentation** — "What if you change the sleep time?"

## System Commands

Useful commands for Pi projects:

```bash
# Check GPIO status
pinout                    # Show pinout diagram
gpio readall              # Show all GPIO states (wiringPi)

# Enable interfaces
sudo raspi-config         # GUI config
sudo raspi-config nonint do_i2c 0   # Enable I2C
sudo raspi-config nonint do_spi 0   # Enable SPI
sudo raspi-config nonint do_camera 0 # Enable camera

# Check I2C devices
i2cdetect -y 1            # Scan I2C bus

# Check connected USB
lsusb

# System info
cat /proc/cpuinfo | grep Model
vcgencmd measure_temp     # CPU temperature
```
