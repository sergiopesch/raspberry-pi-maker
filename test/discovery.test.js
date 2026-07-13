import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { laptopDiscoverySnapshot, runNativeProbe } from "../src/discovery.js";

const probeDefinitions = [
  {
    id: "host-board",
    purpose: "Local board identity",
    collector: () => ({ model: "", compatible: "" }),
  },
  {
    id: "usb",
    purpose: "USB devices",
    collector: () => [
      { busPath: "1-1", vendorId: "2e8a", productId: "000a", manufacturer: "Raspberry Pi", product: "RP2 Boot" },
      { busPath: "1-2", vendorId: "1234", productId: "5678", manufacturer: "Camera Serial ABC123", product: "Camera" },
    ],
  },
  {
    id: "block",
    purpose: "Block devices",
    collector: () => [
      { name: "nvme0n1", model: "Private Disk", removable: false, partition: false, transport: "nvme", sizeBytes: 1_000_000 },
      { name: "sdb", model: "RPI-SD", removable: true, partition: false, transport: "usb", sizeBytes: 32_000 },
    ],
  },
  {
    id: "links",
    purpose: "Network interface states",
    collector: () => [
      { name: "eth0", state: "up", addresses: [{ address: "192.168.1.10", cidr: "192.168.1.10/24", family: "IPv4", internal: false, mac: "dc:a6:32:aa:bb:cc" }] },
      { name: "wlan0", state: "down", addresses: [] },
    ],
  },
];

function fixtureDependencies(calls) {
  return {
    probeDefinitions,
    probeRunner(definition) {
      calls.push(definition.id);
      return runNativeProbe(definition);
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

test("default discovery returns native summaries without sensitive local values", () => {
  const calls = [];
  const result = laptopDiscoverySnapshot({}, fixtureDependencies(calls));
  const serialized = JSON.stringify(result);

  assert.deepEqual(calls, ["host-board", "usb", "block", "links"]);
  assert.doesNotMatch(serialized, /192\.168\./);
  assert.doesNotMatch(serialized, /dc:a6:32/i);
  assert.doesNotMatch(serialized, /Private Disk|ABC123|eth0|wlan0|\/dev\/serial\/by-id/);
  assert.ok(result.commands.every((command) => command.method === "native-node"));
  assert.ok(result.commands.every((command) => !("data" in command)));
  assert.equal(result.serialDevices.count, 2);
  assert.deepEqual(result.serialDevices.types, ["ttyACM"]);
  assert.equal(result.piHints[0].confidence, "high");
  assert.match(result.safetyBoundary, /No subprocesses/i);
});

test("raw discovery is explicit and includes native details with a privacy warning", () => {
  const calls = [];
  const result = laptopDiscoverySnapshot({ includeRawOutput: true }, fixtureDependencies(calls));
  const serialized = JSON.stringify(result);

  assert.deepEqual(calls, ["host-board", "usb", "block", "links"]);
  assert.match(serialized, /192\.168\.1\.10/);
  assert.match(serialized, /dc:a6:32:aa:bb:cc/i);
  assert.match(serialized, /Private Disk|ABC123|eth0/);
  assert.match(result.privacy, /explicitly requested/i);
  assert.ok(result.commands.every((command) => "data" in command));
  assert.ok(result.serialDevices.paths.some((path) => path.includes("/dev/serial/by-id/")));
});

test("discovery runtime cannot execute subprocesses", () => {
  const source = readFileSync(new URL("../src/discovery.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /node:child_process|execFile|execSync|spawnSync/);
});
