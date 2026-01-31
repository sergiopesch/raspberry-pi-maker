# GPIO Reference

Complete GPIO pinout and capabilities for Raspberry Pi.

## 40-Pin Header (Pi 2/3/4/5/Zero)

```
                          +-----]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+]+-----+
                          |  3V3 [1]  [2]  5V                               |
                GPIO2/SDA |  SDA [3]  [4]  5V                               |
                GPIO3/SCL |  SCL [5]  [6]  GND                              |
                    GPIO4 | GPCK [7]  [8]  TXD   GPIO14/UART_TX             |
                          |  GND [9]  [10] RXD   GPIO15/UART_RX             |
                   GPIO17 |   17 [11] [12] 18    GPIO18/PCM_CLK/PWM0        |
                   GPIO27 |   27 [13] [14] GND                              |
                   GPIO22 |   22 [15] [16] 23    GPIO23                     |
                          |  3V3 [17] [18] 24    GPIO24                     |
          GPIO10/SPI_MOSI | MOSI [19] [20] GND                              |
           GPIO9/SPI_MISO | MISO [21] [22] 25    GPIO25                     |
          GPIO11/SPI_SCLK | SCLK [23] [24] CE0   GPIO8/SPI_CE0              |
                          |  GND [25] [26] CE1   GPIO7/SPI_CE1              |
            GPIO0/ID_SD   | ID_SD[27] [28] ID_SC GPIO1/ID_SC (EEPROM)       |
                    GPIO5 |    5 [29] [30] GND                              |
                    GPIO6 |    6 [31] [32] 12    GPIO12/PWM0                |
              GPIO13/PWM1 |   13 [33] [34] GND                              |
GPIO19/SPI1_MISO/PCM_FS   |   19 [35] [36] 16    GPIO16/SPI1_CE2            |
                   GPIO26 |   26 [37] [38] 20    GPIO20/SPI1_MOSI           |
                          |  GND [39] [40] 21    GPIO21/SPI1_SCLK           |
                          +----------------------------------------------------+
```

## BCM vs BOARD Numbering

**BCM (Broadcom)** — Recommended, uses GPIO numbers:
```python
GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)  # GPIO17
```

**BOARD** — Uses physical pin numbers:
```python
GPIO.setmode(GPIO.BOARD)
GPIO.setup(11, GPIO.OUT)  # Physical pin 11 = GPIO17
```

⚠️ **Always use BCM** — More consistent across Pi models.

## Pin Capabilities

### Power Pins
| Pin | Type | Max Current |
|-----|------|-------------|
| 1, 17 | 3.3V | ~50mA total |
| 2, 4 | 5V | ~500mA (from USB) |
| 6, 9, 14, 20, 25, 30, 34, 39 | GND | - |

### GPIO Pins
All GPIO pins are 3.3V logic, max ~16mA per pin.

| GPIO | Alternate Functions | Notes |
|------|---------------------|-------|
| 2 | SDA1 (I2C) | Has 1.8kΩ pullup |
| 3 | SCL1 (I2C) | Has 1.8kΩ pullup |
| 4 | GPCLK0 | General purpose clock |
| 7 | SPI0_CE1 | SPI chip select |
| 8 | SPI0_CE0 | SPI chip select |
| 9 | SPI0_MISO | SPI data in |
| 10 | SPI0_MOSI | SPI data out |
| 11 | SPI0_SCLK | SPI clock |
| 12 | PWM0 | Hardware PWM |
| 13 | PWM1 | Hardware PWM |
| 14 | UART_TXD | Serial transmit |
| 15 | UART_RXD | Serial receive |
| 18 | PCM_CLK / PWM0 | Audio clock / PWM |
| 19 | PCM_FS / SPI1_MISO | Audio / SPI |
| 20 | SPI1_MOSI | SPI data |
| 21 | SPI1_SCLK | SPI clock |

### Reserved Pins (avoid using)
| GPIO | Reserved For |
|------|--------------|
| 0, 1 | HAT EEPROM (ID_SD, ID_SC) |
| 2, 3 | I2C with pullups (can be used but affects I2C) |

## I2C

**Pins:** GPIO2 (SDA), GPIO3 (SCL)

**Enable:**
```bash
sudo raspi-config nonint do_i2c 0
```

**Scan for devices:**
```bash
i2cdetect -y 1
```

**Python example:**
```python
import smbus2

bus = smbus2.SMBus(1)
# Read byte from device at address 0x48, register 0x00
data = bus.read_byte_data(0x48, 0x00)
```

## SPI

**Pins:**
- SPI0: GPIO10 (MOSI), GPIO9 (MISO), GPIO11 (SCLK), GPIO8 (CE0), GPIO7 (CE1)
- SPI1: GPIO20 (MOSI), GPIO19 (MISO), GPIO21 (SCLK), GPIO16 (CE2)

**Enable:**
```bash
sudo raspi-config nonint do_spi 0
```

**Python example:**
```python
import spidev

spi = spidev.SpiDev()
spi.open(0, 0)  # Bus 0, Device 0
spi.max_speed_hz = 1000000
response = spi.xfer2([0x01, 0x02, 0x03])
```

## UART (Serial)

**Pins:** GPIO14 (TX), GPIO15 (RX)

**Enable:**
```bash
sudo raspi-config nonint do_serial 0
```

**Python example:**
```python
import serial

ser = serial.Serial('/dev/ttyS0', 9600, timeout=1)
ser.write(b'Hello\n')
data = ser.readline()
```

## PWM (Pulse Width Modulation)

**Hardware PWM pins:** GPIO12, GPIO13, GPIO18, GPIO19

**Software PWM** (any GPIO):
```python
import RPi.GPIO as GPIO

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)

pwm = GPIO.PWM(17, 1000)  # 1000 Hz
pwm.start(50)  # 50% duty cycle
pwm.ChangeDutyCycle(75)  # Change to 75%
pwm.stop()
```

**Hardware PWM** (more precise):
```python
import pigpio

pi = pigpio.pi()
pi.set_PWM_frequency(18, 1000)  # 1000 Hz
pi.set_PWM_dutycycle(18, 128)   # 50% (0-255)
```

## Raspberry Pi Models

| Model | GPIO Pins | RAM | Notes |
|-------|-----------|-----|-------|
| Pi Zero/W | 40 | 512MB | Small, low power |
| Pi 3B+ | 40 | 1GB | WiFi, Bluetooth |
| Pi 4B | 40 | 2-8GB | USB 3, dual HDMI |
| Pi 5 | 40 | 4-8GB | Fastest, PCIe |

All models with 40-pin header have identical GPIO layout.
