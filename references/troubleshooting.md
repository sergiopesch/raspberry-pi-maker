# Troubleshooting Guide

Common Raspberry Pi issues and how to fix them.

## Permission Errors

### "RuntimeError: No access to /dev/mem"

**Cause:** GPIO requires elevated permissions

**Fixes:**
```bash
# Option 1: Run with sudo
sudo python3 my_script.py

# Option 2: Add user to gpio group (better)
sudo usermod -a -G gpio $USER
# Then logout and login again
```

### "Permission denied: '/dev/gpiomem'"

Same fix as above — add user to gpio group or use sudo.

---

## GPIO Issues

### "This channel is already in use"

**Cause:** Previous script didn't cleanup properly

**Fixes:**
```python
# At start of script, suppress warnings
GPIO.setwarnings(False)

# Or cleanup explicitly
GPIO.cleanup()
```

Or reboot the Pi.

### Pin not responding

**Check:**
1. Correct BCM number? (not physical pin number)
2. `GPIO.setmode(GPIO.BCM)` called?
3. Pin set as OUTPUT or INPUT correctly?
4. Wiring connected to correct pin?

**Debug script:**
```python
import RPi.GPIO as GPIO

GPIO.setmode(GPIO.BCM)
GPIO.setup(17, GPIO.OUT)

# Test the pin
GPIO.output(17, GPIO.HIGH)
print("Pin HIGH - check with multimeter (should be ~3.3V)")
input("Press Enter to continue...")

GPIO.output(17, GPIO.LOW)
print("Pin LOW - should be ~0V")

GPIO.cleanup()
```

### Button triggers multiple times

**Cause:** Switch bounce

**Fix with debounce:**
```python
from gpiozero import Button

button = Button(17, bounce_time=0.2)  # 200ms debounce
button.when_pressed = my_callback
```

Or with RPi.GPIO:
```python
GPIO.add_event_detect(17, GPIO.FALLING, callback=my_callback, bouncetime=200)
```

---

## I2C Issues

### Device not found (i2cdetect shows nothing)

**Check:**
1. I2C enabled?
   ```bash
   sudo raspi-config nonint do_i2c 0
   ```
2. Wiring correct? (SDA to SDA, SCL to SCL)
3. Device powered?
4. Correct I2C bus? (usually bus 1)
   ```bash
   i2cdetect -y 1
   ```

### "Remote I/O error"

**Causes:**
1. Wrong I2C address
2. Device not responding
3. Wiring issue

**Debug:**
```bash
# Scan for devices
i2cdetect -y 1

# Check if device responds
i2cget -y 1 0x27 0x00
```

---

## Module Not Found

### "ModuleNotFoundError: No module named 'RPi'"

**Fix:**
```bash
sudo apt update
sudo apt install python3-rpi.gpio
```

### "ModuleNotFoundError: No module named '[package]'"

**General fix:**
```bash
pip3 install [package]

# Or system-wide
sudo pip3 install [package]

# Or with apt (preferred for system packages)
sudo apt install python3-[package]
```

---

## Camera Issues

### "Camera not detected"

**Check:**
1. Camera enabled?
   ```bash
   sudo raspi-config nonint do_camera 0
   ```
2. Cable connected correctly? (blue side toward Ethernet port on Pi)
3. Cable seated fully in connector?

**Test:**
```bash
# For picamera2 (Pi 4/5)
libcamera-hello

# Check camera detected
libcamera-list
```

### "Failed to import picamera"

**For older picamera:**
```bash
sudo apt install python3-picamera
```

**For picamera2 (Pi 4/5):**
```bash
sudo apt install python3-picamera2
```

---

## Network Issues

### WiFi won't connect

**Check:**
```bash
# Network status
nmcli dev status

# Available networks
nmcli dev wifi list

# Connect
sudo nmcli dev wifi connect "SSID" password "PASSWORD"
```

### Can't SSH into Pi

**Check:**
1. SSH enabled?
   ```bash
   sudo raspi-config nonint do_ssh 0
   ```
2. Find Pi's IP:
   ```bash
   hostname -I
   ```
3. From another machine:
   ```bash
   ping raspberrypi.local
   # or
   ping [IP address]
   ```

---

## Performance Issues

### Script runs slowly

**Causes:**
1. Using `time.sleep()` in tight loop
2. Inefficient code
3. SD card slow

**Fixes:**
```python
# Bad - blocks everything
while True:
    time.sleep(0.001)  # 1ms
    
# Better - use events
GPIO.add_event_detect(17, GPIO.RISING, callback=handler)
signal.pause()  # Wait efficiently
```

### High CPU usage

**Check:**
```bash
htop
```

**Common causes:**
1. Busy-wait loops without sleep
2. Too-frequent polling
3. Memory leaks

---

## Boot Issues

### Pi doesn't boot

**Check:**
1. Power supply adequate? (5V 3A for Pi 4)
2. SD card inserted?
3. SD card corrupted? (try reflashing)

**LED patterns:**
- No LEDs: Power issue
- Red only: SD card issue
- Green blinking: Booting (activity)

### Script doesn't run at boot

**Using crontab:**
```bash
crontab -e
# Add:
@reboot /usr/bin/python3 /home/pi/my_script.py >> /home/pi/log.txt 2>&1
```

**Using systemd (better):**
```bash
sudo nano /etc/systemd/system/myscript.service
```

```ini
[Unit]
Description=My Python Script
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/my_script.py
WorkingDirectory=/home/pi
User=pi
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable myscript
sudo systemctl start myscript
```

---

## Quick Diagnostic

Run this to check Pi health:

```bash
#!/bin/bash
echo "=== Raspberry Pi Diagnostic ==="

echo -e "\n--- Model ---"
cat /proc/cpuinfo | grep Model

echo -e "\n--- Temperature ---"
vcgencmd measure_temp

echo -e "\n--- Memory ---"
free -h

echo -e "\n--- Disk ---"
df -h /

echo -e "\n--- GPIO ---"
if command -v pinout &> /dev/null; then
    echo "GPIO available (run 'pinout' for diagram)"
else
    echo "Install: sudo apt install python3-gpiozero"
fi

echo -e "\n--- I2C Devices ---"
if command -v i2cdetect &> /dev/null; then
    i2cdetect -y 1 2>/dev/null || echo "I2C not enabled"
else
    echo "Install: sudo apt install i2c-tools"
fi

echo -e "\n--- Network ---"
hostname -I
```

Save as `diagnostic.sh`, run with `bash diagnostic.sh`.
