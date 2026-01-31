# Beginner Projects

First Raspberry Pi projects for learning GPIO and Python basics.

---

## Project 1: Blink LED

**You'll learn:** GPIO output, Python basics, cleanup

**Components:**
- Raspberry Pi (any model with GPIO)
- LED
- 330Ω resistor
- Breadboard + jumper wires

**Wiring:**
```
GPIO17 (pin 11) → 330Ω resistor → LED long leg (+)
LED short leg (-) → GND (pin 9)
```

**Code (gpiozero - beginner friendly):**
```python
#!/usr/bin/env python3
"""Blink LED using gpiozero"""

from gpiozero import LED
from time import sleep

led = LED(17)

print("Blinking LED on GPIO17. Press Ctrl+C to stop.")

try:
    while True:
        led.on()
        sleep(1)
        led.off()
        sleep(1)
except KeyboardInterrupt:
    print("\nGoodbye!")
```

**Code (RPi.GPIO - more control):**
```python
#!/usr/bin/env python3
"""Blink LED using RPi.GPIO"""

import RPi.GPIO as GPIO
import time

LED_PIN = 17

GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)

print("Blinking LED on GPIO17. Press Ctrl+C to stop.")

try:
    while True:
        GPIO.output(LED_PIN, GPIO.HIGH)
        time.sleep(1)
        GPIO.output(LED_PIN, GPIO.LOW)
        time.sleep(1)
except KeyboardInterrupt:
    print("\nCleaning up...")
finally:
    GPIO.cleanup()
```

**Run it:**
```bash
python3 blink.py
```

---

## Project 2: Button Input

**You'll learn:** GPIO input, internal pull-ups, callbacks

**Components:**
- Raspberry Pi
- Push button
- LED + 330Ω resistor

**Wiring:**
```
Button: GPIO27 (pin 13) ←→ Button ←→ GND (pin 14)
LED: GPIO17 (pin 11) → 330Ω → LED → GND (pin 9)
```

**Code (gpiozero):**
```python
#!/usr/bin/env python3
"""Button controls LED"""

from gpiozero import LED, Button
from signal import pause

led = LED(17)
button = Button(27)

# Link button to LED
button.when_pressed = led.on
button.when_released = led.off

print("Press button to light LED. Ctrl+C to exit.")
pause()
```

**Code (RPi.GPIO):**
```python
#!/usr/bin/env python3
"""Button controls LED with RPi.GPIO"""

import RPi.GPIO as GPIO
import time

BUTTON_PIN = 27
LED_PIN = 17

GPIO.setmode(GPIO.BCM)
GPIO.setup(BUTTON_PIN, GPIO.IN, pull_up_down=GPIO.PUD_UP)
GPIO.setup(LED_PIN, GPIO.OUT)

print("Press button to light LED. Ctrl+C to exit.")

try:
    while True:
        if GPIO.input(BUTTON_PIN) == GPIO.LOW:  # Pressed (pulled to ground)
            GPIO.output(LED_PIN, GPIO.HIGH)
        else:
            GPIO.output(LED_PIN, GPIO.LOW)
        time.sleep(0.01)
except KeyboardInterrupt:
    pass
finally:
    GPIO.cleanup()
```

---

## Project 3: PWM LED Brightness

**You'll learn:** PWM output, analog-like control

**Components:**
- Raspberry Pi
- LED + 330Ω resistor

**Wiring:** Same as blink LED

**Code (gpiozero):**
```python
#!/usr/bin/env python3
"""LED fading with PWM"""

from gpiozero import PWMLED
from time import sleep

led = PWMLED(17)

print("LED fading. Ctrl+C to exit.")

try:
    while True:
        # Fade in
        for brightness in range(0, 101, 5):
            led.value = brightness / 100
            sleep(0.05)
        
        # Fade out
        for brightness in range(100, -1, -5):
            led.value = brightness / 100
            sleep(0.05)
except KeyboardInterrupt:
    led.off()
```

**Code (RPi.GPIO):**
```python
#!/usr/bin/env python3
"""LED fading with RPi.GPIO PWM"""

import RPi.GPIO as GPIO
import time

LED_PIN = 17

GPIO.setmode(GPIO.BCM)
GPIO.setup(LED_PIN, GPIO.OUT)

pwm = GPIO.PWM(LED_PIN, 1000)  # 1000 Hz
pwm.start(0)

print("LED fading. Ctrl+C to exit.")

try:
    while True:
        # Fade in
        for duty in range(0, 101, 5):
            pwm.ChangeDutyCycle(duty)
            time.sleep(0.05)
        
        # Fade out
        for duty in range(100, -1, -5):
            pwm.ChangeDutyCycle(duty)
            time.sleep(0.05)
except KeyboardInterrupt:
    pass
finally:
    pwm.stop()
    GPIO.cleanup()
```

---

## Project 4: Traffic Light

**You'll learn:** Multiple outputs, sequencing

**Components:**
- Raspberry Pi
- 3 LEDs (red, yellow, green)
- 3x 330Ω resistors

**Wiring:**
```
Red:    GPIO17 (pin 11) → 330Ω → LED → GND
Yellow: GPIO27 (pin 13) → 330Ω → LED → GND
Green:  GPIO22 (pin 15) → 330Ω → LED → GND
```

**Code:**
```python
#!/usr/bin/env python3
"""Traffic light sequence"""

from gpiozero import LED
from time import sleep

red = LED(17)
yellow = LED(27)
green = LED(22)

print("Traffic light running. Ctrl+C to exit.")

try:
    while True:
        # Green
        red.off()
        yellow.off()
        green.on()
        sleep(5)
        
        # Yellow
        green.off()
        yellow.on()
        sleep(2)
        
        # Red
        yellow.off()
        red.on()
        sleep(5)
        
        # Red + Yellow (getting ready)
        yellow.on()
        sleep(1)
except KeyboardInterrupt:
    red.off()
    yellow.off()
    green.off()
    print("\nTraffic light stopped.")
```

---

## Project 5: Reaction Time Game

**You'll learn:** Timing, random, user interaction

**Components:**
- Raspberry Pi
- LED + 330Ω resistor
- Push button

**Wiring:**
```
LED: GPIO17 → 330Ω → LED → GND
Button: GPIO27 ←→ Button ←→ GND
```

**Code:**
```python
#!/usr/bin/env python3
"""Reaction time game"""

from gpiozero import LED, Button
import time
import random

led = LED(17)
button = Button(27)

def play_game():
    print("\nGet ready...")
    time.sleep(random.uniform(2, 5))  # Random delay
    
    led.on()
    start_time = time.time()
    
    button.wait_for_press()
    
    reaction_time = time.time() - start_time
    led.off()
    
    print(f"Reaction time: {reaction_time:.3f} seconds")
    
    if reaction_time < 0.2:
        print("Incredible! 🏆")
    elif reaction_time < 0.3:
        print("Great! ⭐")
    elif reaction_time < 0.5:
        print("Good! 👍")
    else:
        print("Keep practicing! 💪")

print("=== Reaction Time Game ===")
print("Press the button as fast as you can when the LED lights up!")

try:
    while True:
        input("\nPress Enter to start...")
        play_game()
except KeyboardInterrupt:
    led.off()
    print("\nThanks for playing!")
```

---

## Project 6: LED Morse Code

**You'll learn:** Dictionaries, string processing

**Components:**
- Raspberry Pi
- LED + 330Ω resistor

**Code:**
```python
#!/usr/bin/env python3
"""Morse code transmitter"""

from gpiozero import LED
from time import sleep

led = LED(17)

MORSE_CODE = {
    'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.',
    'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---',
    'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---',
    'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-',
    'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--',
    'Z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...',
    '8': '---..', '9': '----.', '0': '-----', ' ': ' '
}

DOT_DURATION = 0.2

def transmit_morse(message):
    for char in message.upper():
        if char in MORSE_CODE:
            code = MORSE_CODE[char]
            print(f"{char}: {code}")
            
            for symbol in code:
                if symbol == '.':
                    led.on()
                    sleep(DOT_DURATION)
                elif symbol == '-':
                    led.on()
                    sleep(DOT_DURATION * 3)
                elif symbol == ' ':
                    sleep(DOT_DURATION * 7)
                    continue
                
                led.off()
                sleep(DOT_DURATION)
            
            sleep(DOT_DURATION * 2)  # Gap between letters

print("=== Morse Code Transmitter ===")

try:
    while True:
        message = input("\nEnter message (or 'quit'): ")
        if message.lower() == 'quit':
            break
        transmit_morse(message)
        print("Transmission complete!")
except KeyboardInterrupt:
    pass

led.off()
print("\nGoodbye!")
```

---

## What's Next?

Ready for sensors and displays? See [intermediate.md](intermediate.md)!
