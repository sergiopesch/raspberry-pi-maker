# Experiment Log

Date:
Operator:
Project:

## Objective

Describe the behavior or measurement this experiment should prove.

## Hardware

- Raspberry Pi model:
- Raspberry Pi OS version:
- Power supply:
- Modules:
- External supplies:

## Pin Map

| Function | BCM GPIO | Physical pin | Direction | Voltage | Protection/driver | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Safety Checks

- [ ] Power is off before wiring changes.
- [ ] Raspberry Pi GPIO inputs are 3.3V logic only.
- [ ] Never connect a 5V signal directly to a GPIO input.
- [ ] LEDs have current-limiting resistors.
- [ ] Motors, servos, relays, pumps, solenoids, and LED strips use drivers.
- [ ] Every externally powered module has common ground with the Pi.
- [ ] HC-SR04 Echo and other 5V outputs use a voltage divider or level shifter.

## Setup Commands

```bash
pinout
hostname -I
vcgencmd measure_temp
```

## Test Steps

| Step | Command or action | Expected result | Actual result |
| --- | --- | --- | --- |
| 1 | | | |

## Observations

Record sensor readings, LED states, motor behavior, photos, logs, and errors.

## Outcome

- Result:
- Follow-up:
