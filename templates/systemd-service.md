# Raspberry Pi systemd Service Checklist

Use this only after the foreground command works reliably.

## Preconditions

- [ ] The script runs from a shell without `sudo` unless hardware access requires it.
- [ ] The script uses absolute paths or resolves paths from its own location.
- [ ] GPIO cleanup handles `KeyboardInterrupt` and `SIGTERM`.
- [ ] Logs are visible in stdout/stderr.
- [ ] The project has a pin map and safety notes.

## Example Unit

```ini
[Unit]
Description=Raspberry Pi project service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/pi/my-project
ExecStart=/usr/bin/python3 /home/pi/my-project/scripts/main.py
Restart=on-failure
RestartSec=5
User=pi
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

## Commands

```bash
sudo cp my-project.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now my-project.service
systemctl status my-project.service
journalctl -u my-project.service -f
```

## Review

- Keep high-current hardware on a separate power path with a driver.
- Confirm common ground before enabling the service.
- Add conservative startup behavior so motors, relays, and outputs default to off.
