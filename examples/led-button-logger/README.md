# LED Button Logger

This beginner project turns an LED on while a button is pressed and logs button events. It is a small end-to-end test for GPIO output, GPIO input, pull-up behavior, and foreground logging.

## Hardware

- Raspberry Pi with 40-pin header
- LED
- 330 ohm resistor
- Momentary push button
- Jumper wires

## Wiring

Power off the Pi before changing wiring.

LED:

- GPIO17 / physical pin 11 -> 330 ohm resistor -> LED anode / long leg
- LED cathode / short leg -> GND / physical pin 9

Button:

- GPIO27 / physical pin 13 -> one side of button
- GND / physical pin 14 -> other side of button

The script uses the Pi internal pull-up for the button. Raspberry Pi GPIO is 3.3V logic only. Never connect a 5V signal directly to a GPIO input.

## Install

```bash
sudo apt update
sudo apt install python3-gpiozero
```

## Run

```bash
python3 led_button_logger.py
```

Expected behavior:

- The LED turns on while the button is pressed.
- The terminal prints `pressed` and `released` events with timestamps.

## Troubleshooting

- If the LED never lights, check polarity and confirm the resistor is in series.
- If the button reads backwards, confirm one side goes to GPIO27 and the other to GND.
- If the script fails under a service, run it in the foreground first and inspect `journalctl`.
