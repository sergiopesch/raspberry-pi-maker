# Advanced Projects

Web interfaces, IoT, and system integration.

---

## Project 1: Web-Controlled GPIO (Flask)

**You'll learn:** Flask web framework, REST API, web UI

**Components:**
- Raspberry Pi
- LED + 330Ω resistor
- (Any GPIO-connected devices)

**Install Flask:**
```bash
pip3 install flask
```

**Code (app.py):**
```python
#!/usr/bin/env python3
"""Web-controlled GPIO with Flask"""

from flask import Flask, render_template_string, jsonify
from gpiozero import LED

app = Flask(__name__)

# Set up LEDs
leds = {
    'red': LED(17),
    'green': LED(27),
    'blue': LED(22)
}

HTML = '''
<!DOCTYPE html>
<html>
<head>
    <title>GPIO Control</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial; text-align: center; background: #1a1a2e; color: #fff; padding: 20px; }
        .btn { padding: 20px 40px; margin: 10px; border: none; border-radius: 10px; 
               font-size: 18px; cursor: pointer; transition: 0.3s; }
        .btn:hover { transform: scale(1.05); }
        .red { background: #e74c3c; }
        .green { background: #2ecc71; }
        .blue { background: #3498db; }
        .off { background: #333; color: #fff; }
        .status { margin: 20px; padding: 10px; background: #16213e; border-radius: 10px; }
    </style>
</head>
<body>
    <h1>🔌 GPIO Control</h1>
    
    <div class="status" id="status">Ready</div>
    
    <div>
        <button class="btn red" onclick="toggle('red')">Red LED</button>
        <button class="btn green" onclick="toggle('green')">Green LED</button>
        <button class="btn blue" onclick="toggle('blue')">Blue LED</button>
    </div>
    
    <div style="margin-top: 20px">
        <button class="btn off" onclick="allOff()">All Off</button>
    </div>
    
    <script>
        function toggle(color) {
            fetch('/toggle/' + color)
                .then(r => r.json())
                .then(d => document.getElementById('status').textContent = 
                    color + ' LED: ' + (d.state ? 'ON' : 'OFF'));
        }
        function allOff() {
            fetch('/all-off')
                .then(() => document.getElementById('status').textContent = 'All LEDs off');
        }
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/toggle/<color>')
def toggle(color):
    if color in leds:
        leds[color].toggle()
        return jsonify({'color': color, 'state': leds[color].is_lit})
    return jsonify({'error': 'Unknown LED'}), 404

@app.route('/all-off')
def all_off():
    for led in leds.values():
        led.off()
    return jsonify({'status': 'ok'})

@app.route('/status')
def status():
    return jsonify({color: led.is_lit for color, led in leds.items()})

if __name__ == '__main__':
    print("Starting web server on http://0.0.0.0:5000")
    app.run(host='0.0.0.0', port=5000, debug=True)
```

**Run:**
```bash
python3 app.py
# Access from browser: http://[pi-ip]:5000
```

---

## Project 2: Real-Time Temperature Dashboard

**You'll learn:** WebSocket, live updates, charts

**Install dependencies:**
```bash
pip3 install flask flask-socketio adafruit-circuitpython-dht
```

**Code:**
```python
#!/usr/bin/env python3
"""Real-time temperature dashboard"""

from flask import Flask, render_template_string
from flask_socketio import SocketIO
import board
import adafruit_dht
import time
from threading import Thread

app = Flask(__name__)
socketio = SocketIO(app)

dht = adafruit_dht.DHT22(board.D4)

HTML = '''
<!DOCTYPE html>
<html>
<head>
    <title>Temperature Dashboard</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial; background: #0f0f23; color: #fff; padding: 20px; }
        .card { background: #1a1a3e; padding: 30px; border-radius: 15px; 
                margin: 10px; display: inline-block; min-width: 200px; }
        .value { font-size: 48px; font-weight: bold; }
        .temp { color: #ff6b6b; }
        .humid { color: #4ecdc4; }
        #chart-container { max-width: 800px; margin: 20px auto; }
    </style>
</head>
<body>
    <h1>🌡️ Temperature Dashboard</h1>
    
    <div class="card">
        <div class="value temp" id="temp">--</div>
        <div>Temperature (°C)</div>
    </div>
    
    <div class="card">
        <div class="value humid" id="humid">--</div>
        <div>Humidity (%)</div>
    </div>
    
    <div id="chart-container">
        <canvas id="chart"></canvas>
    </div>
    
    <script>
        const socket = io();
        const maxPoints = 50;
        const tempData = [];
        const humidData = [];
        const labels = [];
        
        const chart = new Chart(document.getElementById('chart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Temperature', data: tempData, borderColor: '#ff6b6b', fill: false },
                    { label: 'Humidity', data: humidData, borderColor: '#4ecdc4', fill: false }
                ]
            },
            options: { animation: false }
        });
        
        socket.on('sensor_data', function(data) {
            document.getElementById('temp').textContent = data.temperature.toFixed(1);
            document.getElementById('humid').textContent = data.humidity.toFixed(0);
            
            labels.push(new Date().toLocaleTimeString());
            tempData.push(data.temperature);
            humidData.push(data.humidity);
            
            if (labels.length > maxPoints) {
                labels.shift();
                tempData.shift();
                humidData.shift();
            }
            
            chart.update();
        });
    </script>
</body>
</html>
'''

@app.route('/')
def index():
    return render_template_string(HTML)

def sensor_thread():
    while True:
        try:
            temp = dht.temperature
            humid = dht.humidity
            if temp is not None and humid is not None:
                socketio.emit('sensor_data', {
                    'temperature': temp,
                    'humidity': humid
                })
        except Exception as e:
            print(f"Sensor error: {e}")
        time.sleep(2)

if __name__ == '__main__':
    Thread(target=sensor_thread, daemon=True).start()
    socketio.run(app, host='0.0.0.0', port=5000)
```

---

## Project 3: Camera Streaming Server

**You'll learn:** picamera2, MJPEG streaming

**Install:**
```bash
sudo apt install python3-picamera2
pip3 install flask
```

**Code:**
```python
#!/usr/bin/env python3
"""Camera streaming server"""

from flask import Flask, Response, render_template_string
from picamera2 import Picamera2
from picamera2.encoders import JpegEncoder
from picamera2.outputs import FileOutput
import io
from threading import Condition

app = Flask(__name__)

class StreamingOutput(io.BufferedIOBase):
    def __init__(self):
        self.frame = None
        self.condition = Condition()

    def write(self, buf):
        with self.condition:
            self.frame = buf
            self.condition.notify_all()

output = StreamingOutput()
picam2 = Picamera2()
picam2.configure(picam2.create_video_configuration(main={"size": (640, 480)}))
picam2.start_recording(JpegEncoder(), FileOutput(output))

HTML = '''
<!DOCTYPE html>
<html>
<head>
    <title>Pi Camera Stream</title>
    <style>
        body { font-family: Arial; text-align: center; background: #222; color: #fff; }
        img { max-width: 100%; border-radius: 10px; margin: 20px; }
    </style>
</head>
<body>
    <h1>📷 Pi Camera Stream</h1>
    <img src="/stream" alt="Camera Stream">
</body>
</html>
'''

def generate():
    while True:
        with output.condition:
            output.condition.wait()
            frame = output.frame
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')

@app.route('/')
def index():
    return render_template_string(HTML)

@app.route('/stream')
def stream():
    return Response(generate(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

if __name__ == '__main__':
    try:
        app.run(host='0.0.0.0', port=5000, threaded=True)
    finally:
        picam2.stop_recording()
```

---

## Project 4: MQTT Home Automation

**You'll learn:** MQTT protocol, Home Assistant integration

**Install:**
```bash
pip3 install paho-mqtt
```

**Code:**
```python
#!/usr/bin/env python3
"""MQTT-controlled GPIO for Home Assistant"""

import paho.mqtt.client as mqtt
from gpiozero import LED, Button
import json

# Configuration
MQTT_BROKER = "homeassistant.local"  # Or IP address
MQTT_PORT = 1883
MQTT_USER = "your_user"
MQTT_PASS = "your_password"

# Devices
led = LED(17)
button = Button(27)

# MQTT Topics
TOPIC_LED_SET = "home/pi/led/set"
TOPIC_LED_STATE = "home/pi/led/state"
TOPIC_BUTTON = "home/pi/button"

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker (code {rc})")
    client.subscribe(TOPIC_LED_SET)
    # Publish discovery for Home Assistant
    discovery_payload = {
        "name": "Pi LED",
        "command_topic": TOPIC_LED_SET,
        "state_topic": TOPIC_LED_STATE,
        "payload_on": "ON",
        "payload_off": "OFF"
    }
    client.publish("homeassistant/switch/pi_led/config", 
                   json.dumps(discovery_payload), retain=True)

def on_message(client, userdata, msg):
    payload = msg.payload.decode()
    print(f"Received: {msg.topic} = {payload}")
    
    if msg.topic == TOPIC_LED_SET:
        if payload == "ON":
            led.on()
        else:
            led.off()
        # Publish state update
        client.publish(TOPIC_LED_STATE, "ON" if led.is_lit else "OFF")

def button_pressed():
    print("Button pressed!")
    client.publish(TOPIC_BUTTON, "pressed")

button.when_pressed = button_pressed

# Set up MQTT
client = mqtt.Client()
client.username_pw_set(MQTT_USER, MQTT_PASS)
client.on_connect = on_connect
client.on_message = on_message

print(f"Connecting to MQTT broker at {MQTT_BROKER}...")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_forever()
```

---

## Project 5: Systemd Service (Run at Boot)

**You'll learn:** Creating system services, logging

**Create service file:**
```bash
sudo nano /etc/systemd/system/myproject.service
```

```ini
[Unit]
Description=My Pi Project
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/myproject
ExecStart=/usr/bin/python3 /home/pi/myproject/main.py
Restart=always
RestartSec=10

# Logging
StandardOutput=append:/var/log/myproject.log
StandardError=append:/var/log/myproject.log

[Install]
WantedBy=multi-user.target
```

**Enable and start:**
```bash
sudo systemctl daemon-reload
sudo systemctl enable myproject
sudo systemctl start myproject

# Check status
sudo systemctl status myproject

# View logs
sudo journalctl -u myproject -f
```

---

## Tips for Production

1. **Error handling:** Always catch exceptions, log errors
2. **Graceful shutdown:** Handle SIGTERM for cleanup
3. **Watchdog:** Use systemd's watchdog for reliability
4. **Security:** Use HTTPS, authentication for web interfaces
5. **Logging:** Use Python's `logging` module, rotate logs
6. **Updates:** Set up automatic security updates

**Example robust main.py:**
```python
#!/usr/bin/env python3
"""Production-ready template"""

import signal
import sys
import logging
from gpiozero import LED

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

led = LED(17)
running = True

def shutdown(signum, frame):
    global running
    logger.info("Shutdown signal received")
    running = False

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

def main():
    logger.info("Starting application")
    
    try:
        while running:
            led.toggle()
            time.sleep(1)
    except Exception as e:
        logger.error(f"Error: {e}")
        raise
    finally:
        led.off()
        logger.info("Cleanup complete")

if __name__ == "__main__":
    main()
```

---

## Going Further

- **Docker:** Containerize your Pi projects
- **Kubernetes (K3s):** Cluster multiple Pis
- **Node-RED:** Visual programming for IoT
- **InfluxDB + Grafana:** Time-series data and dashboards
- **Ansible:** Automate Pi fleet management
