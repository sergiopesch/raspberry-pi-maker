# Pin Map

Project:
Pi model:

Use BCM numbering in code and include physical header pins for wiring checks.

| Function | Component pin | BCM GPIO | Physical pin | Direction | Logic voltage | Pull-up/down | Protection/driver | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

## Reserved And Risky Pins

- GPIO0 / physical pin 27: HAT EEPROM ID_SD. Avoid for ordinary projects.
- GPIO1 / physical pin 28: HAT EEPROM ID_SC. Avoid for ordinary projects.
- GPIO2 / physical pin 3 and GPIO3 / physical pin 5: I2C pins with pull-ups.
- 5V physical pins 2 and 4: power only. Never connect a 5V signal directly to GPIO.

## Electrical Notes

- Raspberry Pi GPIO is 3.3V logic only.
- Use a voltage divider or level shifter for 5V outputs.
- Use current-limiting resistors for LEDs.
- Use a driver or transistor for motors, servos, relays, pumps, solenoids, and LED strips.
- Use common ground when a module has an external supply.
