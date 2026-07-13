import assert from "node:assert/strict";
import test from "node:test";

import { laptopDiscoverySnapshot } from "../src/discovery.js";

const outputs = {
  usb: "Bus 001 Device 002: ID 2e8a:000a Raspberry Pi RP2 Boot\nBus 001 Device 003: ID 1234:5678 Camera Serial ABC123",
  block: JSON.stringify({
    blockdevices: [
      { name: "nvme0n1", model: "Private Disk", size: "1T", tran: "nvme", type: "disk" },
      { name: "sdb", model: "RPI-SD", size: "32G", tran: "usb", type: "disk" },
    ],
  }),
  links: "lo UNKNOWN 00:00:00:00:00:00\neth0 UP dc:a6:32:aa:bb:cc",
  hostname: "192.168.1.42 raspberrypi.local",
  "network-manager": "eth0:ethernet:connected:HomeWifi\nwlan0:wifi:disconnected:--",
  addresses: "eth0 UP 192.168.1.10/24",
  neighbors: "192.168.1.42 dev eth0 lladdr dc:a6:32:11:22:33 REACHABLE",
  connections: "wlan0:wifi:connected:SecretSSID",
};

function fixtureDependencies(calls) {
  return {
    commandRunner(definition) {
      calls.push(definition.id);
      return {
        ...definition,
        ok: true,
        exitCode: 0,
        stdout: outputs[definition.id] ?? "",
        stderr: "",
      };
    },
    serialCollector() {
      return {
        direct: ["/dev/ttyACM0"],
        stableIds: ["/dev/serial/by-id/usb-Raspberry_Pi_Pico_E661ABC123-if00"],
      };
    },
    hostInfo() {
      return { platform: "linux", kernel: "test", node: "test" };
    },
  };
}

test("default discovery returns structured summaries without sensitive local values", () => {
  const calls = [];
  const result = laptopDiscoverySnapshot({}, fixtureDependencies(calls));
  const serialized = JSON.stringify(result);

  assert.ok(!calls.includes("addresses"));
  assert.ok(!calls.includes("neighbors"));
  assert.ok(!calls.includes("connections"));
  assert.doesNotMatch(serialized, /192\.168\./);
  assert.doesNotMatch(serialized, /dc:a6:32/i);
  assert.doesNotMatch(serialized, /HomeWifi|SecretSSID|ABC123|\/dev\/serial\/by-id/);
  assert.ok(result.commands.every((command) => !("stdout" in command)));
  assert.equal(result.serialDevices.count, 2);
  assert.deepEqual(result.serialDevices.types, ["ttyACM"]);
  assert.equal(result.piHints[0].confidence, "high");
});

test("raw discovery is explicit and includes a privacy warning", () => {
  const calls = [];
  const result = laptopDiscoverySnapshot({ includeRawOutput: true }, fixtureDependencies(calls));
  const serialized = JSON.stringify(result);

  assert.ok(calls.includes("addresses"));
  assert.ok(calls.includes("neighbors"));
  assert.ok(calls.includes("connections"));
  assert.match(serialized, /192\.168\.1\.10/);
  assert.match(serialized, /SecretSSID/);
  assert.match(result.privacy, /explicitly requested/i);
  assert.ok(result.commands.some((command) => "stdout" in command));
  assert.ok(result.serialDevices.paths.some((path) => path.includes("/dev/serial/by-id/")));
});
