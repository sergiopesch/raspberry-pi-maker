#!/usr/bin/env python3
"""Turn on an LED while a button is pressed and log button events."""

from __future__ import annotations

import signal
import time

from gpiozero import Button, LED

LED_PIN = 17
BUTTON_PIN = 27

led = LED(LED_PIN)
button = Button(BUTTON_PIN, pull_up=True, bounce_time=0.05)
running = True


def stop(_signum: int, _frame: object) -> None:
    global running
    running = False


def timestamp() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S%z")


def on_pressed() -> None:
    led.on()
    print(f"{timestamp()} pressed", flush=True)


def on_released() -> None:
    led.off()
    print(f"{timestamp()} released", flush=True)


def main() -> None:
    signal.signal(signal.SIGTERM, stop)
    button.when_pressed = on_pressed
    button.when_released = on_released

    print("Watching button on GPIO27. LED is on GPIO17. Press Ctrl+C to stop.")
    try:
        while running:
            time.sleep(0.2)
    except KeyboardInterrupt:
        print("\nStopping.")
    finally:
        led.off()
        button.close()
        led.close()


if __name__ == "__main__":
    main()
