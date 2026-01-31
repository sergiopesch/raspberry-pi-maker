# Intermediate Projects

Projects using sensors, I2C, and more complex Python.

---

## Project 1: Temperature & Humidity Monitor (DHT22)

**You'll learn:** Sensor libraries, data logging

**Components:**
- Raspberry Pi
- DHT22 sensor (or DHT11)
- 10kΩ resistor (pullup, some modules have built-in)

**Wiring:**
```
DHT22:
├── Pin 1 (VCC) → 3.3V (pin 1)
├── Pin 2 (Data) → GPIO4 (pin 7) with 10kΩ pullup to 3.3V
├── Pin 3 → Not connected
└── Pin 4 (GND) → GND (pin 6)
```

**Install library:**
```bash
pip3 install adafruit-circuitpython-dht
sudo apt install libgpiod2
```

**Code:**
```python
#!/usr/bin/env python3
"""Temperature and humidity monitor"""

import time
import board
import adafruit_dht

# Initialize DHT22 on GPIO4
dht = adafruit_dht.DHT22(board.D4)

print("Reading DHT22 sensor. Ctrl+C to stop.\n")

while True:
    try:
        temperature = dht.temperature
        humidity = dht.humidity
        
        print(f"Temp: {temperature:.1f}°C ({temperature * 9/5 + 32:.1f}°F)")
        print(f"Humidity: {humidity:.1f}%")
        print("-" * 30)
        
    except RuntimeError as e:
        # DHT sensors sometimes fail to read
        print(f"Reading failed: {e}")
    
    time.sleep(2)
```

---

## Project 2: Ultrasonic Distance Sensor (HC-SR04)

**You'll learn:** Timing measurements, calculations

**Components:**
- Raspberry Pi
- HC-SR04 ultrasonic sensor
- 1kΩ and 2kΩ resistors (voltage divider for Echo pin)

**Wiring:**
```
HC-SR04:
├── VCC → 5V (pin 2)
├── Trig → GPIO23 (pin 16)
├── Echo → Voltage divider → GPIO24 (pin 18)
│         Echo → 1kΩ → GPIO24
│         GPIO24 → 2kΩ → GND
└── GND → GND (pin 6)
```

⚠️ **Important:** Echo outputs 5V, Pi GPIO is 3.3V. Use voltage divider!

**Code (gpiozero):**
```python
#!/usr/bin/env python3
"""Ultrasonic distance measurement"""

from gpiozero import DistanceSensor
from time import sleep

sensor = DistanceSensor(echo=24, trigger=23)

print("Measuring distance. Ctrl+C to stop.\n")

try:
    while True:
        distance = sensor.distance * 100  # Convert to cm
        print(f"Distance: {distance:.1f} cm")
        sleep(0.5)
except KeyboardInterrupt:
    print("\nDone.")
```

**Code (RPi.GPIO - manual):**
```python
#!/usr/bin/env python3
"""Ultrasonic distance with RPi.GPIO"""

import RPi.GPIO as GPIO
import time

TRIG = 23
ECHO = 24

GPIO.setmode(GPIO.BCM)
GPIO.setup(TRIG, GPIO.OUT)
GPIO.setup(ECHO, GPIO.IN)

def measure_distance():
    # Send trigger pulse
    GPIO.output(TRIG, GPIO.LOW)
    time.sleep(0.000002)
    GPIO.output(TRIG, GPIO.HIGH)
    time.sleep(0.00001)
    GPIO.output(TRIG, GPIO.LOW)
    
    # Wait for echo
    while GPIO.input(ECHO) == 0:
        pulse_start = time.time()
    while GPIO.input(ECHO) == 1:
        pulse_end = time.time()
    
    # Calculate distance
    pulse_duration = pulse_end - pulse_start
    distance = pulse_duration * 17150  # Speed of sound / 2
    return round(distance, 1)

try:
    while True:
        dist = measure_distance()
        print(f"Distance: {dist} cm")
        time.sleep(0.5)
except KeyboardInterrupt:
    GPIO.cleanup()
```

---

## Project 3: I2C LCD Display

**You'll learn:** I2C communication, display libraries

**Components:**
- Raspberry Pi
- I2C LCD (16x2 with PCF8574 backpack)

**Wiring:**
```
LCD:
├── GND → GND (pin 6)
├── VCC → 5V (pin 2)
├── SDA → GPIO2/SDA (pin 3)
└── SCL → GPIO3/SCL (pin 5)
```

**Enable I2C:**
```bash
sudo raspi-config nonint do_i2c 0
```

**Find address:**
```bash
i2cdetect -y 1
# Usually 0x27 or 0x3F
```

**Install library:**
```bash
pip3 install RPLCD
```

**Code:**
```python
#!/usr/bin/env python3
"""I2C LCD display"""

from RPLCD.i2c import CharLCD
import time

# Initialize LCD (change address if needed)
lcd = CharLCD(i2c_expander='PCF8574', address=0x27, 
              port=1, cols=16, rows=2)

lcd.clear()
lcd.write_string('Hello World!')

lcd.cursor_pos = (1, 0)  # Row 1, Column 0
lcd.write_string('Raspberry Pi')

time.sleep(3)

# Scrolling counter
lcd.clear()
counter = 0

try:
    while True:
        lcd.cursor_pos = (0, 0)
        lcd.write_string(f'Counter: {counter:6d}')
        
        lcd.cursor_pos = (1, 0)
        lcd.write_string(time.strftime('%H:%M:%S'))
        
        counter += 1
        time.sleep(1)
except KeyboardInterrupt:
    lcd.clear()
    lcd.write_string('Goodbye!')
    time.sleep(1)
    lcd.close(clear=True)
```

---

## Project 4: Temperature Display (Combined!)

**You'll learn:** Combining sensors with displays

**Components:**
- Raspberry Pi
- DHT22 sensor
- I2C LCD

**Code:**
```python
#!/usr/bin/env python3
"""Temperature display on LCD"""

from RPLCD.i2c import CharLCD
import board
import adafruit_dht
import time

# Initialize devices
lcd = CharLCD(i2c_expander='PCF8574', address=0x27,
              port=1, cols=16, rows=2)
dht = adafruit_dht.DHT22(board.D4)

# Custom degree symbol
lcd.create_char(0, [0x06, 0x09, 0x09, 0x06, 0x00, 0x00, 0x00, 0x00])

lcd.clear()
lcd.write_string('Starting...')

try:
    while True:
        try:
            temp = dht.temperature
            humidity = dht.humidity
            
            lcd.clear()
            lcd.cursor_pos = (0, 0)
            lcd.write_string(f'Temp: {temp:.1f}')
            lcd.write(0)  # Degree symbol
            lcd.write_string('C')
            
            lcd.cursor_pos = (1, 0)
            lcd.write_string(f'Humidity: {humidity:.0f}%')
            
        except RuntimeError:
            lcd.cursor_pos = (1, 0)
            lcd.write_string('Sensor error   ')
        
        time.sleep(2)
        
except KeyboardInterrupt:
    lcd.clear()
    lcd.close(clear=True)
```

---

## Project 5: Motion Detector with Alert

**You'll learn:** PIR sensors, events, callbacks

**Components:**
- Raspberry Pi
- PIR motion sensor (HC-SR501)
- LED + 330Ω resistor
- Buzzer (optional)

**Wiring:**
```
PIR:
├── VCC → 5V (pin 2)
├── OUT → GPIO17 (pin 11)
└── GND → GND (pin 6)

LED: GPIO27 → 330Ω → LED → GND
```

**Code:**
```python
#!/usr/bin/env python3
"""Motion detector with alert"""

from gpiozero import MotionSensor, LED
from datetime import datetime
from signal import pause

pir = MotionSensor(17)
led = LED(27)

motion_count = 0

def motion_detected():
    global motion_count
    motion_count += 1
    timestamp = datetime.now().strftime('%H:%M:%S')
    print(f"[{timestamp}] Motion detected! (#{motion_count})")
    led.on()

def motion_stopped():
    print("Motion stopped.")
    led.off()

pir.when_motion = motion_detected
pir.when_no_motion = motion_stopped

print("PIR Motion Detector")
print("Warming up sensor (30 seconds)...")
pir.wait_for_no_motion()
print("Ready! Monitoring for motion...")

pause()
```

---

## Project 6: Analog Input with MCP3008

**You'll learn:** SPI, ADC converters, potentiometer reading

**Components:**
- Raspberry Pi
- MCP3008 ADC chip
- Potentiometer (10kΩ)

**Wiring:**
```
MCP3008:
├── VDD → 3.3V
├── VREF → 3.3V
├── AGND → GND
├── CLK → GPIO11/SCLK (pin 23)
├── DOUT → GPIO9/MISO (pin 21)
├── DIN → GPIO10/MOSI (pin 19)
├── CS → GPIO8/CE0 (pin 24)
└── DGND → GND

Potentiometer:
├── One end → 3.3V
├── Wiper → MCP3008 CH0
└── Other end → GND
```

**Enable SPI:**
```bash
sudo raspi-config nonint do_spi 0
```

**Code (gpiozero):**
```python
#!/usr/bin/env python3
"""Read analog with MCP3008"""

from gpiozero import MCP3008
from time import sleep

pot = MCP3008(channel=0)

print("Reading potentiometer. Ctrl+C to stop.\n")

try:
    while True:
        value = pot.value  # 0.0 to 1.0
        percent = int(value * 100)
        bar = '█' * (percent // 5) + '░' * (20 - percent // 5)
        print(f"\rValue: {value:.3f} [{bar}] {percent}%", end='')
        sleep(0.1)
except KeyboardInterrupt:
    print("\nDone.")
```

---

## What's Next?

Ready for web interfaces and IoT? See [advanced.md](advanced.md)!
