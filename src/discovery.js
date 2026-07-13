import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { networkInterfaces, platform, release } from "node:os";

const MAX_FIELD_LENGTH = 512;

function truncateText(text, maxLength = MAX_FIELD_LENGTH) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...<truncated>`;
}

function readDirectoryEntries(path) {
  try {
    return readdirSync(path, { withFileTypes: true }).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function readText(path) {
  try {
    return truncateText(readFileSync(path, "utf8").replaceAll("\u0000", "").trim());
  } catch {
    return "";
  }
}

function collectHostBoard() {
  const model = readText("/proc/device-tree/model");
  const compatible = readText("/proc/device-tree/compatible");
  return { model, compatible };
}

function collectUsbDevices() {
  return readDirectoryEntries("/sys/bus/usb/devices")
    .map((entry) => {
      const root = `/sys/bus/usb/devices/${entry}`;
      const vendorId = readText(`${root}/idVendor`);
      const productId = readText(`${root}/idProduct`);
      if (!vendorId || !productId) return null;
      return {
        busPath: entry,
        vendorId,
        productId,
        manufacturer: readText(`${root}/manufacturer`),
        product: readText(`${root}/product`),
      };
    })
    .filter(Boolean);
}

function collectBlockDevices() {
  return readDirectoryEntries("/sys/class/block").map((name) => {
    const root = `/sys/class/block/${name}`;
    const sectors = Number.parseInt(readText(`${root}/size`), 10);
    let transport = "unknown";
    try {
      const devicePath = realpathSync(`${root}/device`).toLowerCase();
      if (devicePath.includes("/usb")) transport = "usb";
      else if (devicePath.includes("/nvme")) transport = "nvme";
      else if (devicePath.includes("/mmc")) transport = "mmc";
      else if (devicePath.includes("/ata")) transport = "ata";
    } catch {
      // Virtual and partition devices may not expose a device link.
    }
    return {
      name,
      model: readText(`${root}/device/model`),
      removable: readText(`${root}/removable`) === "1",
      partition: Boolean(readText(`${root}/partition`)),
      transport,
      sizeBytes: Number.isSafeInteger(sectors) ? sectors * 512 : null,
    };
  });
}

function collectNetworkLinks() {
  const addresses = networkInterfaces();
  const names = new Set([
    ...readDirectoryEntries("/sys/class/net"),
    ...Object.keys(addresses),
  ]);
  return [...names].sort().map((name) => ({
    name,
    state: readText(`/sys/class/net/${name}/operstate`) || "unknown",
    addresses: (addresses[name] ?? []).map((address) => ({
      address: address.address,
      cidr: address.cidr,
      family: address.family,
      internal: address.internal,
      mac: address.mac,
      scopeid: address.scopeid,
    })),
  }));
}

function collectSerialDevices() {
  const direct = readDirectoryEntries("/dev")
    .filter((entry) => /^(ttyACM|ttyUSB|ttyAMA)/.test(entry))
    .map((entry) => `/dev/${entry}`);
  const stableIds = readDirectoryEntries("/dev/serial/by-id").map((entry) => `/dev/serial/by-id/${entry}`);
  return { direct, stableIds };
}

const NATIVE_PROBES = [
  { id: "host-board", purpose: "Local board identity", collector: collectHostBoard },
  { id: "usb", purpose: "USB devices", collector: collectUsbDevices },
  { id: "block", purpose: "Block devices", collector: collectBlockDevices },
  { id: "links", purpose: "Network interface states", collector: collectNetworkLinks },
];

function runNativeProbe({ id, purpose, collector }) {
  try {
    return { id, purpose, ok: true, data: collector() };
  } catch (error) {
    return {
      id,
      purpose,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      data: null,
    };
  }
}

function summarizeProbe(result) {
  const base = {
    id: result.id,
    purpose: result.purpose,
    method: "native-node",
    ok: result.ok,
    ...(result.ok ? {} : { error: result.error ?? "probe_failed" }),
  };
  if (!result.ok) return base;

  if (result.id === "host-board") {
    return {
      ...base,
      summary: {
        raspberryPiHost: /raspberry pi|brcm,bcm/i.test(`${result.data.model} ${result.data.compatible}`),
        model: result.data.model || null,
      },
    };
  }
  if (result.id === "usb") {
    const text = JSON.stringify(result.data);
    return {
      ...base,
      summary: {
        deviceCount: result.data.length,
        raspberryPiIdentifierPresent: /raspberry pi|pi foundation|2e8a|bcm27|rp2/i.test(text),
      },
    };
  }
  if (result.id === "block") {
    return {
      ...base,
      summary: {
        deviceCount: result.data.length,
        diskCount: result.data.filter((device) => !device.partition).length,
        removableCount: result.data.filter((device) => device.removable).length,
        usbDeviceCount: result.data.filter((device) => device.transport === "usb").length,
      },
    };
  }
  if (result.id === "links") {
    const states = result.data.map((link) => link.state).filter(Boolean);
    return {
      ...base,
      summary: {
        interfaceCount: result.data.length,
        states: [...new Set(states)].sort(),
      },
    };
  }
  return { ...base, summary: {} };
}

function inferPiHints({ probes, serialDevices }) {
  const probeData = (id) => probes.find((entry) => entry.id === id)?.data;
  const board = probeData("host-board") ?? {};
  const usb = probeData("usb") ?? [];
  const hints = [];

  if (/raspberry pi|brcm,bcm/i.test(`${board.model ?? ""} ${board.compatible ?? ""}`)) {
    hints.push({
      confidence: "high",
      source: "Linux device tree",
      message: `This host identifies as ${board.model || "a Raspberry Pi"}.`,
    });
  }
  if (/raspberry pi|pi foundation|2e8a|bcm27|rp2/i.test(JSON.stringify(usb))) {
    hints.push({
      confidence: "high",
      source: "USB identifiers",
      message: "USB discovery contains a Raspberry Pi or Raspberry Pi Foundation identifier.",
    });
  }
  if (serialDevices.direct.length > 0 || serialDevices.stableIds.length > 0) {
    hints.push({
      confidence: "medium",
      source: "serial device inventory",
      message: "Serial-style devices are present. They may be Pi UART/USB gadget links, microcontrollers, or adapters.",
    });
  }
  return hints;
}

function publicSerialSummary(serialDevices, includeRawOutput) {
  const types = serialDevices.direct
    .map((device) => device.match(/tty(?:ACM|USB|AMA)/)?.[0])
    .filter(Boolean);
  return {
    count: serialDevices.direct.length + serialDevices.stableIds.length,
    types: [...new Set(types)].sort(),
    stableIdCount: serialDevices.stableIds.length,
    ...(includeRawOutput ? { paths: [...serialDevices.direct, ...serialDevices.stableIds] } : {}),
  };
}

function laptopDiscoverySnapshot(
  { includeRawOutput = false } = {},
  {
    probeDefinitions = NATIVE_PROBES,
    probeRunner = runNativeProbe,
    serialCollector = collectSerialDevices,
    hostInfo = () => ({ platform: platform(), kernel: release(), node: process.version }),
  } = {},
) {
  const probes = probeDefinitions.map((definition) => probeRunner(definition));
  const serialDevices = serialCollector();
  const piHints = inferPiHints({ probes, serialDevices });
  const publicProbes = probes.map((result) => includeRawOutput
    ? {
        id: result.id,
        purpose: result.purpose,
        method: "native-node",
        ok: result.ok,
        data: result.data,
        ...(result.error ? { error: result.error } : {}),
      }
    : summarizeProbe(result));

  return {
    generatedAt: new Date().toISOString(),
    host: hostInfo(),
    privacy: includeRawOutput
      ? "Raw local details were explicitly requested and may contain device identifiers, storage details, IP or MAC addresses, and interface names."
      : "Default output is structured and redacted: no IP or MAC addresses, interface names, device paths, storage models, or stable USB serial identifiers are returned.",
    safetyBoundary: "Read-only native Node.js discovery. No subprocesses, GPIO, disks, firmware, mounts, SSH sessions, or network scans were modified or started.",
    serialDevices: publicSerialSummary(serialDevices, includeRawOutput),
    piHints,
    commands: publicProbes,
    nextSteps: [
      "If no Pi is detected, connect power and data separately with a known data-capable USB cable or Ethernet.",
      "If the Pi is reachable, ask before opening SSH and confirm the intended target and user.",
      "If a serial device appears, ask before opening it and identify the expected adapter or board.",
      "If removable storage appears, do not mount or write to it until the user confirms the device.",
    ],
  };
}

export {
  NATIVE_PROBES,
  laptopDiscoverySnapshot,
  runNativeProbe,
  summarizeProbe,
};
