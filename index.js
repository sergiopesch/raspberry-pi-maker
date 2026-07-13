import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { platform, release } from "node:os";
import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";

const DEFAULT_COMMAND_TIMEOUT_MS = 3000;
const DISCOVERY_COMMANDS = [
  { command: "lsusb", args: [], purpose: "USB devices" },
  { command: "lsblk", args: ["-o", "NAME,MODEL,SIZE,TRAN,TYPE,MOUNTPOINTS"], purpose: "Block devices" },
  { command: "ip", args: ["-brief", "addr"], purpose: "Network interfaces" },
  { command: "ip", args: ["neigh", "show"], purpose: "Neighbor table" },
  { command: "getent", args: ["hosts", "raspberrypi.local"], purpose: "mDNS hostname lookup", timeoutMs: 1500 },
  { command: "nmcli", args: ["-t", "-f", "DEVICE,TYPE,STATE,CONNECTION", "device", "status"], purpose: "NetworkManager device state" },
];

const RESOURCE_CATALOG = Object.freeze(
  JSON.parse(readFileSync(new URL("./data/resources.json", import.meta.url), "utf8"))
);
const RESOURCE_KINDS = Object.freeze([
  "all",
  "board",
  "accessory",
  "component",
  "datasheet",
  "software",
  "learning",
]);
const LIFECYCLE_STAGE_NAMES = Object.freeze([
  "choose",
  "setup",
  "design",
  "build",
  "code",
  "test",
  "debug",
  "deploy",
  "maintain",
  "retire",
]);
const LIFECYCLE_ALIASES = new Map([
  ["buy", "choose"],
  ["select", "choose"],
  ["procure", "choose"],
  ["install", "setup"],
  ["prepare", "setup"],
  ["wire", "build"],
  ["prototype", "build"],
  ["program", "code"],
  ["develop", "code"],
  ["troubleshoot", "debug"],
  ["operate", "maintain"],
  ["decommission", "retire"],
  ["recycle", "retire"],
]);
const LIFECYCLE_STAGES = Object.freeze({
  choose: {
    objective: "Choose the smallest suitable platform and compatible parts from evidence, not familiarity alone.",
    actions: [
      "Write compute, real-time, I/O, camera/display, network, storage, thermal, mechanical, availability, and budget requirements.",
      "Decide whether the project needs a Linux computer, a deterministic microcontroller, or both.",
      "Compare exact variants and connector/header options against official product information.",
      "Draft the power architecture and identify every compatibility assumption before buying.",
    ],
    evidence: ["Requirements note", "Board/component shortlist", "Source links and document revisions", "Preliminary power budget"],
    exitCriteria: "The selected board, modules, power path, and critical compatibility assumptions are backed by authoritative sources.",
    resourceQuery: "board catalog product datasheet",
  },
  setup: {
    objective: "Establish a known-good, reproducible baseline before hardware integration.",
    actions: [
      "Image or flash from an official source and record the selected OS or firmware version.",
      "Apply updates, set identity and access, and enable only required interfaces.",
      "Record board identity, power status, storage, network, temperature, and interface probes.",
      "Create a project folder with hardware, scripts, experiments, and logs sections.",
    ],
    evidence: ["Image/firmware version", "Successful boot log", "Read-only baseline probes", "Known access path"],
    exitCriteria: "The board boots repeatably and baseline identity, power, storage, network, and interfaces are recorded.",
    resourceQuery: "getting started raspberry pi os configuration",
  },
  design: {
    objective: "Resolve electrical and mechanical risks before applying power.",
    actions: [
      "Create a pin map with physical pin, BCM number, direction, voltage, and protection for every signal.",
      "Build a power budget and check logic levels, absolute maximum ratings, pull resistors, and current limits.",
      "Add level shifting, current limiting, flyback protection, drivers, fusing, and decoupling where required.",
      "Check connector orientation, cable type, HAT conflicts, enclosure clearance, and thermal needs.",
    ],
    evidence: ["Reviewed pin map", "Power budget", "Exact datasheets", "Schematic or wiring diagram", "Mechanical notes"],
    exitCriteria: "Every net has a documented source, destination, voltage, direction, and protection decision, with blockers resolved.",
    resourceQuery: "datasheet gpio hat power",
  },
  build: {
    objective: "Create an as-built circuit that matches the reviewed design.",
    actions: [
      "Disconnect power before every wiring change and keep power/data colour conventions consistent.",
      "Add one component at a time and compare its exact marking and pinout with the selected source.",
      "Inspect polarity, adjacent-pin shorts, rail continuity, and common ground before energising.",
      "Photograph or diagram the final physical build and record deviations from the plan.",
    ],
    evidence: ["As-built photo or diagram", "Continuity/polarity checks", "Updated pin map", "Deviation notes"],
    exitCriteria: "The as-built circuit matches the reviewed pin map and passes continuity, polarity, and short checks.",
    resourceQuery: "component wiring gpio",
  },
  code: {
    objective: "Prove each hardware path with a minimal, observable, maintainable program.",
    actions: [
      "Start with a maintained upstream library and the smallest component probe.",
      "Keep pin assignments, addresses, bus numbers, timeouts, and hardware assumptions explicit.",
      "Add useful diagnostics, cleanup, SIGTERM handling, and bounded retries.",
      "Save exact install and run commands beside the code.",
    ],
    evidence: ["Minimal probe per component", "Pinned or recorded dependencies", "Expected diagnostic output", "Run commands"],
    exitCriteria: "Each component works independently from a reproducible command with useful diagnostic output.",
    resourceQuery: "gpiozero python pico sdk camera software",
  },
  test: {
    objective: "Demonstrate repeatable behavior and known failure handling under realistic conditions.",
    actions: [
      "Combine components incrementally and record expected versus actual outcomes.",
      "Test disconnects, bad inputs, restarts, cold boot, power recovery, and thermal load where relevant.",
      "Run the intended duration and capture logs, sensor ranges, timing, and resource use.",
      "Turn every fixed defect into a regression check when practical.",
    ],
    evidence: ["Acceptance criteria", "Experiment logs", "Failure-mode results", "Regression checks"],
    exitCriteria: "Acceptance criteria pass repeatedly and operating limits and unresolved risks are documented.",
    resourceQuery: "experiment gpiozero mock pins",
  },
  debug: {
    objective: "Find and prove the root cause without introducing multiple uncontrolled changes.",
    actions: [
      "Capture the exact symptom, command, traceback, timing, environment, and as-built wiring.",
      "Work upward from power and wiring through detection, minimal probes, application code, and service configuration.",
      "Change one variable at a time and preserve both failing and passing evidence.",
      "Reproduce the fix after a clean restart or rebuild.",
    ],
    evidence: ["Minimal reproduction", "Before/after evidence", "Root-cause statement", "Regression check"],
    exitCriteria: "The root cause and fix are reproducible; the symptom did not merely disappear.",
    resourceQuery: "troubleshooting configuration datasheet",
  },
  deploy: {
    objective: "Turn a proven foreground project into an observable, recoverable system.",
    actions: [
      "Promote only a reliable foreground command into service mode.",
      "Use an explicit user, absolute paths, minimal permissions, restart limits, and structured logs.",
      "Define safe startup, shutdown, actuator limits, backup, update, and rollback behavior.",
      "Test cold boot, restart, network loss, dependency failure, and power recovery.",
    ],
    evidence: ["Service definition", "Operations note", "Boot/recovery results", "Rollback path", "Log access"],
    exitCriteria: "The system recovers safely, is observable, and has a tested rollback path.",
    resourceQuery: "systemd service remote access",
  },
  maintain: {
    objective: "Keep the project understandable, secure, serviceable, and compatible over time.",
    actions: [
      "Track OS, firmware, dependency, hardware-revision, and configuration changes.",
      "Back up required data and configuration, rotate credentials, and review logs and storage health.",
      "Inspect connectors, cooling, corrosion, batteries, cables, and high-current paths periodically.",
      "Re-run acceptance checks after upgrades or hardware substitutions.",
    ],
    evidence: ["Change log", "Current backups", "Inspection record", "Post-update acceptance results", "Spare-parts note"],
    exitCriteria: "Maintenance evidence is current, or the system is intentionally moved to retirement.",
    resourceQuery: "documentation source updates product information",
  },
  retire: {
    objective: "Decommission safely while preserving required data and reusable hardware.",
    actions: [
      "Stop services, remove credentials, back up required data, and shut down cleanly.",
      "Disconnect power and batteries before dismantling; label reusable boards, modules, and cables.",
      "Sanitise or physically manage storage according to the data sensitivity.",
      "Record reusable spares and send failed electronics and batteries to suitable recycling routes.",
    ],
    evidence: ["Data disposition", "Credential removal", "Reusable-parts inventory", "Recycling route"],
    exitCriteria: "Data, credentials, batteries, storage, and reusable hardware have all been handled deliberately.",
    resourceQuery: "eol obsolescence legacy boards",
  },
});

const PINOUT = new Map([
  ["1", { physical: 1, name: "3V3", kind: "power", notes: "3.3V power rail. Do not short to GND." }],
  ["2", { physical: 2, name: "5V", kind: "power", notes: "5V power rail. Never connect directly to GPIO." }],
  ["3", { physical: 3, bcm: 2, name: "GPIO2 / SDA1", kind: "gpio", notes: "I2C SDA. Has pull-up; avoid for ordinary outputs." }],
  ["4", { physical: 4, name: "5V", kind: "power", notes: "5V power rail. Never connect directly to GPIO." }],
  ["5", { physical: 5, bcm: 3, name: "GPIO3 / SCL1", kind: "gpio", notes: "I2C SCL. Has pull-up; avoid for ordinary outputs." }],
  ["6", { physical: 6, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["7", { physical: 7, bcm: 4, name: "GPIO4", kind: "gpio", notes: "General GPIO." }],
  ["8", { physical: 8, bcm: 14, name: "GPIO14 / TXD", kind: "gpio", notes: "UART TXD when serial is enabled." }],
  ["9", { physical: 9, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["10", { physical: 10, bcm: 15, name: "GPIO15 / RXD", kind: "gpio", notes: "UART RXD when serial is enabled." }],
  ["11", { physical: 11, bcm: 17, name: "GPIO17", kind: "gpio", notes: "Good general-purpose pin." }],
  ["12", { physical: 12, bcm: 18, name: "GPIO18 / PWM0", kind: "gpio", notes: "PWM-capable pin." }],
  ["13", { physical: 13, bcm: 27, name: "GPIO27", kind: "gpio", notes: "Good general-purpose pin." }],
  ["14", { physical: 14, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["15", { physical: 15, bcm: 22, name: "GPIO22", kind: "gpio", notes: "Good general-purpose pin." }],
  ["16", { physical: 16, bcm: 23, name: "GPIO23", kind: "gpio", notes: "Good general-purpose pin." }],
  ["17", { physical: 17, name: "3V3", kind: "power", notes: "3.3V power rail. Do not short to GND." }],
  ["18", { physical: 18, bcm: 24, name: "GPIO24", kind: "gpio", notes: "Good general-purpose pin." }],
  ["19", { physical: 19, bcm: 10, name: "GPIO10 / MOSI", kind: "gpio", notes: "SPI MOSI when SPI is enabled." }],
  ["20", { physical: 20, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["21", { physical: 21, bcm: 9, name: "GPIO9 / MISO", kind: "gpio", notes: "SPI MISO when SPI is enabled." }],
  ["22", { physical: 22, bcm: 25, name: "GPIO25", kind: "gpio", notes: "Good general-purpose pin." }],
  ["23", { physical: 23, bcm: 11, name: "GPIO11 / SCLK", kind: "gpio", notes: "SPI clock when SPI is enabled." }],
  ["24", { physical: 24, bcm: 8, name: "GPIO8 / CE0", kind: "gpio", notes: "SPI CE0 when SPI is enabled." }],
  ["25", { physical: 25, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["26", { physical: 26, bcm: 7, name: "GPIO7 / CE1", kind: "gpio", notes: "SPI CE1 when SPI is enabled." }],
  ["27", { physical: 27, bcm: 0, name: "GPIO0 / ID_SD", kind: "gpio", notes: "HAT EEPROM ID pin. Avoid for ordinary projects." }],
  ["28", { physical: 28, bcm: 1, name: "GPIO1 / ID_SC", kind: "gpio", notes: "HAT EEPROM ID pin. Avoid for ordinary projects." }],
  ["29", { physical: 29, bcm: 5, name: "GPIO5", kind: "gpio", notes: "Good general-purpose pin." }],
  ["30", { physical: 30, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["31", { physical: 31, bcm: 6, name: "GPIO6", kind: "gpio", notes: "Good general-purpose pin." }],
  ["32", { physical: 32, bcm: 12, name: "GPIO12 / PWM0", kind: "gpio", notes: "PWM-capable pin." }],
  ["33", { physical: 33, bcm: 13, name: "GPIO13 / PWM1", kind: "gpio", notes: "PWM-capable pin." }],
  ["34", { physical: 34, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["35", { physical: 35, bcm: 19, name: "GPIO19 / MISO / PWM1", kind: "gpio", notes: "SPI/PWM-capable pin." }],
  ["36", { physical: 36, bcm: 16, name: "GPIO16", kind: "gpio", notes: "Good general-purpose pin." }],
  ["37", { physical: 37, bcm: 26, name: "GPIO26", kind: "gpio", notes: "Good general-purpose pin." }],
  ["38", { physical: 38, bcm: 20, name: "GPIO20 / MOSI", kind: "gpio", notes: "SPI-related alternate function." }],
  ["39", { physical: 39, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["40", { physical: 40, bcm: 21, name: "GPIO21 / SCLK", kind: "gpio", notes: "SPI-related alternate function." }],
]);

const BCM_TO_PHYSICAL = new Map(
  [...PINOUT.values()]
    .filter((entry) => Number.isInteger(entry.bcm))
    .map((entry) => [String(entry.bcm), entry.physical])
);

function normalizePinTokens(input) {
  return String(input)
    .split(/[\s,;]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => token.replace(/^gpio/, "bcm").replace(/^pin/, ""));
}

function lookupPin(token) {
  const normalized = token.replace(/^physical/, "");
  if (normalized.startsWith("bcm")) {
    const bcm = normalized.slice(3);
    const physical = BCM_TO_PHYSICAL.get(bcm);
    if (!physical) return { query: token, found: false, issue: `Unknown BCM GPIO ${bcm}.` };
    const entry = PINOUT.get(String(physical));
    return { query: token, found: true, numbering: "BCM", ...entry };
  }
  const entry = PINOUT.get(normalized);
  if (!entry) return { query: token, found: false, issue: `Unknown physical pin ${token}.` };
  return { query: token, found: true, numbering: "physical", ...entry };
}

function includesAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...<truncated>`;
}

function runReadOnlyCommand({ command, args, purpose, timeoutMs }, maxOutputLength) {
  try {
    const stdout = execFileSync(command, args, {
      encoding: "utf8",
      maxBuffer: 128 * 1024,
      shell: false,
      timeout: timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS,
    });
    return {
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
  const devEntries = readDirectoryEntries("/dev")
    .filter((entry) => /^(ttyACM|ttyUSB|ttyAMA|serial)/.test(entry))
    .map((entry) => `/dev/${entry}`);
  const byIdEntries = readDirectoryEntries("/dev/serial/by-id").map((entry) => `/dev/serial/by-id/${entry}`);
  return [...devEntries, ...byIdEntries];
}

function commandOutput(commands, commandName) {
  return commands.find((entry) => entry.command === commandName)?.stdout ?? "";
}

function inferPiHints({ commands, serialDevices }) {
  const lsusb = commandOutput(commands, "lsusb");
  const getent = commandOutput(commands, "getent");
  const neighbors = commands.find((entry) => entry.command === "ip" && entry.args[0] === "neigh")?.stdout ?? "";
  const hints = [];

  if (/raspberry pi|pi foundation|bcm27|rp2 boot/i.test(lsusb)) {
    hints.push({
      confidence: "high",
      source: "lsusb",
      message: "USB output contains a Raspberry Pi or Raspberry Pi Foundation identifier.",
    });
  }

  if (/raspberrypi\.local/i.test(getent) || getent.trim()) {
    hints.push({
      confidence: "medium",
      source: "getent hosts raspberrypi.local",
      message: "The default raspberrypi.local hostname resolved on this laptop.",
    });
  }

  if (serialDevices.length > 0) {
    hints.push({
      confidence: "medium",
      source: "/dev serial devices",
      message: "Serial-style devices are present. These may be Pi UART/USB gadget links, microcontrollers, or adapters.",
    });
  }

  if (/169\.254\.|usb|ether/i.test(neighbors)) {
    hints.push({
      confidence: "low",
      source: "ip neigh",
      message: "Neighbor table includes link-local or USB/Ethernet-looking entries that may be relevant to a directly connected Pi.",
    });
  }

  return hints;
}

function laptopDiscoverySnapshot({ includeRawOutput = false } = {}) {
  const maxOutputLength = includeRawOutput ? 16000 : 4000;
  const commands = DISCOVERY_COMMANDS.map((definition) =>
    runReadOnlyCommand(definition, maxOutputLength)
  );
  const serialDevices = collectSerialDevices();
  const piHints = inferPiHints({ commands, serialDevices });

  return {
    generatedAt: new Date().toISOString(),
    host: {
      platform: platform(),
      kernel: release(),
      node: process.version,
    },
    safetyBoundary: "Read-only laptop discovery. No GPIO, disks, firmware, mounts, SSH sessions, or network scans were modified or started.",
    serialDevices,
    piHints,
    commands,
    nextSteps: [
      "If no Pi is detected, connect power and data separately: use a known data-capable USB cable or Ethernet.",
      "If raspberrypi.local resolves, ask before opening SSH; first confirm the target IP and user.",
      "If a serial device appears, identify it with `udevadm info --query=all --name=/dev/<device>` before using it.",
      "If an SD card or USB mass-storage device appears, do not mount or write to it until the user confirms the device path.",
    ],
  };
}

function buildSafetyFindings({ components, wiring, powerNotes = "" }) {
  const text = `${components}\n${wiring}\n${powerNotes}`;
  const lower = text.toLowerCase();
  const findings = [];
  const warnings = [];
  const checks = [
    "Confirm the Pi is powered off before changing wiring.",
    "Confirm every external module shares common ground with the Pi.",
    "Verify BCM GPIO numbers against physical header pins before running code.",
  ];

  if (/(5v|5 v).{0,40}(gpio|input|bcm)|(?:gpio|input|bcm).{0,40}(5v|5 v)/i.test(text)) {
    findings.push({
      severity: "blocker",
      topic: "5V GPIO input",
      message: "A 5V signal appears to be connected to GPIO. Raspberry Pi GPIO is 3.3V logic only; add a voltage divider or level shifter.",
    });
  }

  if (includesAny(lower, ["hc-sr04", "hcsr04", "ultrasonic"]) && !includesAny(lower, ["divider", "level shifter", "level-shifter"])) {
    findings.push({
      severity: "blocker",
      topic: "HC-SR04 Echo",
      message: "HC-SR04 Echo is commonly 5V. Use a voltage divider or level shifter before the Pi input.",
    });
  }

  if (includesAny(lower, ["motor", "servo", "pump", "solenoid", "relay", "led strip", "neopixel"]) && /gpio|bcm/i.test(text)) {
    findings.push({
      severity: "blocker",
      topic: "High-current load",
      message: "Do not drive motors, servos, relays, pumps, solenoids, or LED strips from a GPIO pin. Use a driver/transistor/module and a suitable power supply.",
    });
  }

  if (includesAny(lower, ["led"]) && !includesAny(lower, ["resistor", "330", "220", "470", "1k"])) {
    findings.push({
      severity: "warning",
      topic: "LED current limit",
      message: "LED wiring should include a current-limiting resistor. A safe default is 330 ohms.",
    });
  }

  if (includesAny(lower, ["external", "separate supply", "battery", "bench supply", "driver"]) && !includesAny(lower, ["common ground", "shared ground", "gnd"])) {
    warnings.push("External power is mentioned but common ground is not explicit.");
  }

  if (includesAny(lower, ["i2c", "sda", "scl"])) {
    checks.push("Run `sudo raspi-config nonint do_i2c 0` and `i2cdetect -y 1` after wiring.");
  }
  if (includesAny(lower, ["spi", "miso", "mosi", "sclk"])) {
    checks.push("Run `sudo raspi-config nonint do_spi 0` and test with the smallest vendor example.");
  }
  if (includesAny(lower, ["camera", "picamera", "libcamera"])) {
    checks.push("Run `rpicam-hello --timeout 5000` before adding application code on current Raspberry Pi OS.");
  }

  return {
    status: findings.some((finding) => finding.severity === "blocker") ? "needs_changes_before_power" : "review_before_power",
    findings,
    warnings,
    checks,
  };
}

function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9+.-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function resourceSearch({ query = "", kind = "all", stage = "all", limit = 8 } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  const boundedLimit = Math.min(20, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 8));
  const normalizedKind = RESOURCE_KINDS.includes(kind) ? kind : "all";
  const normalizedStage = LIFECYCLE_STAGE_NAMES.includes(stage) ? stage : "all";

  const results = RESOURCE_CATALOG.resources
    .filter((resource) => normalizedKind === "all" || resource.kind === normalizedKind)
    .filter((resource) => normalizedStage === "all" || resource.stages.includes(normalizedStage))
    .map((resource) => {
      const id = normalizeSearchText(resource.id);
      const title = normalizeSearchText(resource.title);
      const aliases = resource.aliases.map(normalizeSearchText);
      const topics = resource.topics.map(normalizeSearchText);
      const summary = normalizeSearchText(resource.summary);
      let score = normalizedQuery ? 0 : 1;

      if (normalizedQuery && [id, title, ...aliases].includes(normalizedQuery)) score += 120;
      if (normalizedQuery && title.includes(normalizedQuery)) score += 50;
      if (normalizedQuery && aliases.some((alias) => alias.includes(normalizedQuery))) score += 40;

      for (const token of tokens) {
        if (id.includes(token)) score += 14;
        if (title.includes(token)) score += 12;
        if (aliases.some((alias) => alias.includes(token))) score += 9;
        if (topics.some((topic) => topic.includes(token))) score += 7;
        if (summary.includes(token)) score += 2;
      }

      return { resource, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || left.resource.title.localeCompare(right.resource.title))
    .slice(0, boundedLimit)
    .map(({ resource, score }) => ({
      id: resource.id,
      title: resource.title,
      kind: resource.kind,
      stages: resource.stages,
      summary: resource.summary,
      url: resource.url,
      publisher: resource.publisher,
      authority: resource.authority,
      license: resource.license,
      ...(resource.safety ? { safety: resource.safety } : {}),
      relevance: score,
    }));

  return {
    query,
    filters: { kind: normalizedKind, stage: normalizedStage },
    reviewedOn: RESOURCE_CATALOG.reviewedOn,
    results,
    resultCount: results.length,
    coverage: RESOURCE_CATALOG.policy.scope,
    copyright: RESOURCE_CATALOG.policy.copyright,
    freshness: RESOURCE_CATALOG.policy.freshness,
  };
}

function findBoardResource(input) {
  const query = normalizeSearchText(input);
  const candidates = RESOURCE_CATALOG.resources.filter(
    (resource) => resource.kind === "board" && resource.profile
  );
  const exact = candidates.find((resource) =>
    [resource.id, resource.title, ...resource.aliases]
      .map(normalizeSearchText)
      .includes(query)
  );
  if (exact) return exact;

  return candidates.find((resource) => {
    const names = [resource.id, resource.title, ...resource.aliases].map(normalizeSearchText);
    return names.some((name) => name.includes(query) || query.includes(name));
  });
}

function boardCompare({ boards }) {
  const uniqueBoards = [...new Set(boards.map((board) => String(board).trim()).filter(Boolean))].slice(0, 6);
  const matches = uniqueBoards.map((query) => {
    const resource = findBoardResource(query);
    if (!resource) {
      return {
        query,
        found: false,
        issue: "Board profile not found. Use pi_resource_search for the complete official board catalog or a legacy model.",
      };
    }
    return {
      query,
      found: true,
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      source: resource.url,
      ...resource.profile,
    };
  });

  return {
    reviewedOn: RESOURCE_CATALOG.reviewedOn,
    boards: matches,
    decisionQuestions: [
      "Does the project need a full Linux OS, deterministic real-time control, or both?",
      "Which camera, display, storage, PCIe, network, and GPIO interfaces are mandatory?",
      "What are the sustained power, cooling, enclosure, and physical-access constraints?",
      "Is this a one-off prototype or a maintained product that needs availability and lifecycle evidence?",
    ],
    reminder: "Confirm the exact product variant, ordering code, current documentation, and connector/cable requirements before purchasing.",
  };
}

function lifecycleGuide({ stage, project = "", includeResources = true }) {
  const requestedStage = normalizeSearchText(stage);
  const resolvedStage = LIFECYCLE_STAGE_NAMES.includes(requestedStage)
    ? requestedStage
    : LIFECYCLE_ALIASES.get(requestedStage);

  if (!resolvedStage) {
    return {
      found: false,
      requestedStage: stage,
      supportedStages: LIFECYCLE_STAGE_NAMES,
      issue: "Unknown lifecycle stage.",
    };
  }

  const definition = LIFECYCLE_STAGES[resolvedStage];
  return {
    found: true,
    requestedStage: stage,
    stage: resolvedStage,
    project,
    objective: definition.objective,
    actions: definition.actions,
    evidence: definition.evidence,
    exitCriteria: definition.exitCriteria,
    nextStage: LIFECYCLE_STAGE_NAMES[LIFECYCLE_STAGE_NAMES.indexOf(resolvedStage) + 1] ?? null,
    resources: includeResources
      ? resourceSearch({ query: definition.resourceQuery, stage: resolvedStage, limit: 5 }).results
      : [],
    safetyBoundary: "Treat linked summaries as navigation aids. Verify exact board/module markings and current source documents before wiring or purchase.",
  };
}

function projectPlan({ goal, piModel = "Raspberry Pi model not specified", modules = [], constraints = "" }) {
  const moduleList = modules.length > 0 ? modules : ["List modules before wiring."];
  return {
    goal,
    piModel,
    modules: moduleList,
    phases: [
      {
        name: "Capture assumptions",
        actions: [
          "Record Pi model, OS version, power supply rating, modules, and intended physical behavior.",
          "Create a pin map with BCM GPIO, physical pin, direction, voltage, and protection parts.",
        ],
      },
      {
        name: "Electrical safety review",
        actions: [
          "Check 3.3V logic compatibility for every GPIO input.",
          "Add resistors, pull-ups/pull-downs, level shifting, and drivers before applying power.",
          "Confirm common ground for every externally powered module.",
        ],
      },
      {
        name: "Minimal hardware probe",
        actions: [
          "Test one component at a time with a short foreground script.",
          "Capture command output and observations under logs/ or experiments/<date>/.",
        ],
      },
      {
        name: "Integration",
        actions: [
          "Combine components only after each minimal repro works.",
          "Promote repeated commands into scripts/ or a project-local helper CLI.",
        ],
      },
      {
        name: "Service mode",
        actions: [
          "Only add systemd after the foreground command is reliable.",
          "Use absolute paths, conservative restart policy, and journalctl checks.",
        ],
      },
    ],
    suggestedFiles: [
      "hardware/pin-map.md",
      "experiments/README.md",
      "scripts/probe-<component>.py",
      "logs/<date>-bringup.log",
    ],
    constraints,
    safetyBoundary: "Do not run direct actuation commands until the helper command and limits have been reviewed.",
  };
}

function experimentTemplate({ projectName, objective, hardware = "", outputStyle = "markdown" }) {
  const title = projectName || "Raspberry Pi Experiment";
  const body = `# ${title} Experiment Log

Date:
Operator:

## Objective

${objective}

## Hardware

${hardware || "- Raspberry Pi model:\n- OS version:\n- Modules:\n- Power supply:\n"}

## Pin Map

| Function | BCM GPIO | Physical pin | Direction | Voltage | Protection/driver | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Safety Checks

- [ ] Pi powered off before wiring changes.
- [ ] GPIO inputs are 3.3V logic only.
- [ ] 5V outputs use a voltage divider or level shifter.
- [ ] LEDs have current-limiting resistors.
- [ ] High-current loads use a driver and external supply.
- [ ] External supplies share common ground with the Pi.

## Commands

\`\`\`bash
pinout
hostname -I
vcgencmd measure_temp
\`\`\`

## Observations

| Time | Command/test | Expected | Actual | Notes |
| --- | --- | --- | --- | --- |
| | | | | |

## Result

- Outcome:
- Follow-up:
`;
  return outputStyle === "json" ? { title, markdown: body } : body;
}

export {
  boardCompare,
  buildSafetyFindings,
  experimentTemplate,
  lifecycleGuide,
  lookupPin,
  normalizePinTokens,
  projectPlan,
  resourceSearch,
};

export default defineToolPlugin({
  id: "raspberry-pi-maker",
  name: "Raspberry Pi Maker",
  description: "Plan, wire, debug, and ship Raspberry Pi projects with authoritative docs and practical safety checks.",
  tools: (tool) => [
    tool({
      name: "pi_project_plan",
      label: "Pi Project Plan",
      description: "Create a safety-first Raspberry Pi electronics project plan.",
      parameters: Type.Object({
        goal: Type.String({ description: "Project goal or experiment objective." }),
        piModel: Type.Optional(Type.String({ description: "Raspberry Pi model, if known." })),
        modules: Type.Optional(Type.Array(Type.String(), { description: "Hardware modules, sensors, actuators, HATs, or displays." })),
        constraints: Type.Optional(Type.String({ description: "Power, timing, enclosure, network, or safety constraints." })),
      }),
      execute: ({ goal, piModel, modules, constraints }) =>
        projectPlan({ goal, piModel, modules: modules ?? [], constraints }),
    }),
    tool({
      name: "pi_resource_search",
      label: "Pi Resource Search",
      description: "Search a curated index of official Raspberry Pi resources and popular component documentation.",
      parameters: Type.Object({
        query: Type.Optional(Type.String({ description: "Board, component, interface, task, or document to find." })),
        kind: Type.Optional(Type.Union(RESOURCE_KINDS.map((kind) => Type.Literal(kind)), {
          description: "Limit results to one resource kind. Defaults to all.",
        })),
        stage: Type.Optional(Type.Union([Type.Literal("all"), ...LIFECYCLE_STAGE_NAMES.map((stage) => Type.Literal(stage))], {
          description: "Limit results to a lifecycle stage. Defaults to all.",
        })),
        limit: Type.Optional(Type.Number({ minimum: 1, maximum: 20, description: "Maximum results. Defaults to 8." })),
      }),
      execute: ({ query, kind, stage, limit }) =>
        resourceSearch({ query: query ?? "", kind: kind ?? "all", stage: stage ?? "all", limit: limit ?? 8 }),
    }),
    tool({
      name: "pi_board_compare",
      label: "Pi Board Compare",
      description: "Compare indexed Raspberry Pi computers and Pico-series boards using project-relevant decision factors.",
      parameters: Type.Object({
        boards: Type.Array(Type.String(), {
          minItems: 1,
          maxItems: 6,
          description: "Board names or aliases, for example ['Pi 5', 'Zero 2 W', 'Pico 2 W'].",
        }),
      }),
      execute: boardCompare,
    }),
    tool({
      name: "pi_lifecycle_guide",
      label: "Pi Lifecycle Guide",
      description: "Get actions, evidence, exit criteria, and resources for one electronics-project lifecycle stage.",
      parameters: Type.Object({
        stage: Type.Union(LIFECYCLE_STAGE_NAMES.map((stage) => Type.Literal(stage)), {
          description: "One of choose, setup, design, build, code, test, debug, deploy, maintain, or retire.",
        }),
        project: Type.Optional(Type.String({ description: "Optional project context to include in the response." })),
        includeResources: Type.Optional(Type.Boolean({ description: "Include matching catalog resources. Defaults to true." })),
      }),
      execute: ({ stage, project, includeResources }) =>
        lifecycleGuide({ stage, project: project ?? "", includeResources: includeResources ?? true }),
    }),
    tool({
      name: "pi_pin_lookup",
      label: "Pi Pin Lookup",
      description: "Look up Raspberry Pi 40-pin header pins by physical pin or BCM GPIO number.",
      parameters: Type.Object({
        pins: Type.String({ description: "Pins to look up, for example '11, GPIO17, BCM2'." }),
      }),
      execute: ({ pins }) => ({
        queries: normalizePinTokens(pins).map(lookupPin),
        reminders: [
          "Use BCM numbering consistently in Python examples.",
          "GPIO0 and GPIO1 are HAT EEPROM pins and should usually be avoided.",
          "Raspberry Pi GPIO is 3.3V logic only.",
        ],
      }),
    }),
    tool({
      name: "pi_wiring_safety_check",
      label: "Pi Wiring Safety Check",
      description: "Review a proposed Raspberry Pi wiring plan for common GPIO safety risks.",
      parameters: Type.Object({
        components: Type.String({ description: "Components or modules in the circuit." }),
        wiring: Type.String({ description: "Proposed wiring in plain text." }),
        powerNotes: Type.Optional(Type.String({ description: "Power supply and grounding notes." })),
      }),
      execute: buildSafetyFindings,
    }),
    tool({
      name: "pi_experiment_log_template",
      label: "Pi Experiment Log Template",
      description: "Generate a repeatable experiment log template for Raspberry Pi hardware work.",
      parameters: Type.Object({
        projectName: Type.String({ description: "Project or experiment name." }),
        objective: Type.String({ description: "What this experiment should prove." }),
        hardware: Type.Optional(Type.String({ description: "Known hardware list." })),
        outputStyle: Type.Optional(Type.String({ description: "Use 'markdown' or 'json'. Defaults to markdown." })),
      }),
      execute: ({ projectName, objective, hardware, outputStyle }) =>
        experimentTemplate({ projectName, objective, hardware, outputStyle }),
    }),
    tool({
      name: "pi_laptop_discovery_snapshot",
      label: "Pi Laptop Discovery Snapshot",
      description: "Collect a read-only snapshot of Raspberry Pi-related devices visible from the laptop.",
      parameters: Type.Object({
        includeRawOutput: Type.Optional(Type.Boolean({ description: "Include longer command output. Defaults to false." })),
      }),
      execute: ({ includeRawOutput }) =>
        laptopDiscoverySnapshot({ includeRawOutput: includeRawOutput ?? false }),
    }),
  ],
});
