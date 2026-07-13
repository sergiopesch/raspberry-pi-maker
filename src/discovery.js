import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { platform, release } from "node:os";

const DEFAULT_COMMAND_TIMEOUT_MS = 3000;
const SAFE_DISCOVERY_COMMANDS = [
  { id: "usb", command: "lsusb", args: [], purpose: "USB devices" },
  { id: "block", command: "lsblk", args: ["--json", "-o", "NAME,MODEL,SIZE,TRAN,TYPE"], purpose: "Block devices" },
  { id: "links", command: "ip", args: ["-brief", "link"], purpose: "Network interface states" },
  { id: "hostname", command: "getent", args: ["hosts", "raspberrypi.local"], purpose: "Default Pi hostname lookup", timeoutMs: 1500 },
  { id: "network-manager", command: "nmcli", args: ["-t", "-f", "DEVICE,TYPE,STATE", "device", "status"], purpose: "NetworkManager device states" },
];
const SENSITIVE_DISCOVERY_COMMANDS = [
  { id: "addresses", command: "ip", args: ["-brief", "addr"], purpose: "Network addresses" },
  { id: "neighbors", command: "ip", args: ["neigh", "show"], purpose: "Neighbor table" },
  { id: "connections", command: "nmcli", args: ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"], purpose: "NetworkManager connection details" },
];

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...<truncated>`;
}

function runReadOnlyCommand({ command, args, purpose, timeoutMs, id }, maxOutputLength) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: "utf8",
      maxBuffer: 128 * 1024,
      shell: false,
      timeout: timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    });
    return {
      id,
      command,
      args,
      purpose,
      ok: true,
      exitCode: 0,
      stdout: truncateText(stdout.trim(), maxOutputLength),
      stderr: "",
    };
  } catch (error) {
    const stdout = typeof error.stdout === "string" ? error.stdout : String(error.stdout ?? "");
    const stderr = typeof error.stderr === "string" ? error.stderr : String(error.stderr ?? "");
    return {
      id,
      command,
      args,
      purpose,
      ok: false,
      exitCode: Number.isInteger(error.status) ? error.status : null,
      error: error.code === "ENOENT" ? "command_not_found" : error.message,
      stdout: truncateText(stdout.trim(), maxOutputLength),
      stderr: truncateText(stderr.trim(), maxOutputLength),
    };
  }
}

function readDirectoryEntries(path) {
  try {
    return readdirSync(path, { withFileTypes: true }).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function collectSerialDevices() {
  const direct = readDirectoryEntries("/dev")
    .filter((entry) => /^(ttyACM|ttyUSB|ttyAMA)/.test(entry))
    .map((entry) => `/dev/${entry}`);
  const stableIds = readDirectoryEntries("/dev/serial/by-id").map((entry) => `/dev/serial/by-id/${entry}`);
  return { direct, stableIds };
}

function parseBlockSummary(stdout) {
  try {
    const devices = JSON.parse(stdout).blockdevices ?? [];
    const flattened = [];
    const visit = (items) => {
      for (const item of items) {
        flattened.push(item);
        if (Array.isArray(item.children)) visit(item.children);
      }
    };
    visit(devices);
    return {
      deviceCount: flattened.length,
      diskCount: flattened.filter((device) => device.type === "disk").length,
      usbDeviceCount: flattened.filter((device) => device.tran === "usb").length,
    };
  } catch {
    return { deviceCount: stdout.split("\n").filter(Boolean).length, parseError: true };
  }
}

function summarizeCommand(result) {
  const lines = result.stdout.split("\n").filter(Boolean);
  const base = {
    id: result.id,
    purpose: result.purpose,
    ok: result.ok,
    ...(result.ok ? {} : { error: result.error ?? "command_failed" }),
  };

  if (!result.ok) return base;
  if (result.id === "usb") {
    return {
      ...base,
      summary: {
        deviceCount: lines.length,
        raspberryPiIdentifierPresent: /raspberry pi|pi foundation|bcm27|rp2 boot/i.test(result.stdout),
      },
    };
  }
  if (result.id === "block") return { ...base, summary: parseBlockSummary(result.stdout) };
  if (result.id === "links") {
    const states = lines.map((line) => line.trim().split(/\s+/)[1]).filter(Boolean);
    return { ...base, summary: { interfaceCount: lines.length, states: [...new Set(states)].sort() } };
  }
  if (result.id === "hostname") return { ...base, summary: { raspberryPiLocalResolved: lines.length > 0 } };
  if (result.id === "network-manager") {
    const states = lines.map((line) => line.split(":")[2]).filter(Boolean);
    return { ...base, summary: { deviceCount: lines.length, states: [...new Set(states)].sort() } };
  }
  return { ...base, summary: { lineCount: lines.length } };
}

function inferPiHints({ commands, serialDevices }) {
  const command = (id) => commands.find((entry) => entry.id === id)?.stdout ?? "";
  const hints = [];

  if (/raspberry pi|pi foundation|bcm27|rp2 boot/i.test(command("usb"))) {
    hints.push({
      confidence: "high",
      source: "USB identifiers",
      message: "USB discovery contains a Raspberry Pi or Raspberry Pi Foundation identifier.",
    });
  }
  if (command("hostname").trim()) {
    hints.push({
      confidence: "medium",
      source: "raspberrypi.local lookup",
      message: "The default raspberrypi.local hostname resolved on this laptop.",
    });
  }
  if (serialDevices.direct.length > 0 || serialDevices.stableIds.length > 0) {
    hints.push({
      confidence: "medium",
      source: "serial device inventory",
      message: "Serial-style devices are present. They may be Pi UART/USB gadget links, microcontrollers, or adapters.",
    });
  }
  if (/169\.254\.|usb|ether/i.test(command("neighbors"))) {
    hints.push({
      confidence: "low",
      source: "neighbor summary",
      message: "Opt-in neighbor discovery contains a link-local or USB/Ethernet clue that may belong to a directly connected Pi.",
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
    commandRunner = runReadOnlyCommand,
    serialCollector = collectSerialDevices,
    hostInfo = () => ({ platform: platform(), kernel: release(), node: process.version }),
  } = {},
) {
  const definitions = includeRawOutput
    ? [...SAFE_DISCOVERY_COMMANDS, ...SENSITIVE_DISCOVERY_COMMANDS]
    : SAFE_DISCOVERY_COMMANDS;
  const maxOutputLength = includeRawOutput ? 16000 : 8000;
  const commands = definitions.map((definition) => commandRunner(definition, maxOutputLength));
  const serialDevices = serialCollector();
  const piHints = inferPiHints({ commands, serialDevices });
  const publicCommands = commands.map((result) => includeRawOutput
    ? {
        id: result.id,
        command: result.command,
        args: result.args,
        purpose: result.purpose,
        ok: result.ok,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        ...(result.error ? { error: result.error } : {}),
      }
    : summarizeCommand(result));

  return {
    generatedAt: new Date().toISOString(),
    host: hostInfo(),
    privacy: includeRawOutput
      ? "Raw local details were explicitly requested and may contain device identifiers, mount information, IP or MAC addresses, and network connection names."
      : "Default output is structured and redacted: no command stdout, IP or MAC addresses, connection names, mountpoints, or stable USB serial identifiers are returned.",
    safetyBoundary: "Read-only laptop discovery. No GPIO, disks, firmware, mounts, SSH sessions, or network scans were modified or started.",
    serialDevices: publicSerialSummary(serialDevices, includeRawOutput),
    piHints,
    commands: publicCommands,
    nextSteps: [
      "If no Pi is detected, connect power and data separately with a known data-capable USB cable or Ethernet.",
      "If raspberrypi.local resolves, ask before opening SSH and confirm the intended target and user.",
      "If a serial device appears, ask before opening it and identify the expected adapter or board.",
      "If removable storage appears, do not mount or write to it until the user confirms the device.",
    ],
  };
}

export {
  SAFE_DISCOVERY_COMMANDS,
  SENSITIVE_DISCOVERY_COMMANDS,
  laptopDiscoverySnapshot,
  runReadOnlyCommand,
  summarizeCommand,
};
