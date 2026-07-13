import {
  LIFECYCLE_STAGE_NAMES,
  normalizeSearchText,
  resourceSearch,
} from "./catalog.js";

const LIFECYCLE_ALIASES = new Map([
  ["buy", "choose"], ["select", "choose"], ["procure", "choose"],
  ["install", "setup"], ["prepare", "setup"],
  ["wire", "build"], ["prototype", "build"],
  ["program", "code"], ["develop", "code"],
  ["troubleshoot", "debug"], ["operate", "maintain"],
  ["decommission", "retire"], ["recycle", "retire"],
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
    resourceQueries: ["Raspberry Pi computer hardware catalog", "Raspberry Pi Product Information Portal", "PoE+ HAT"],
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
    resourceQueries: ["Raspberry Pi getting started", "Raspberry Pi configuration"],
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
    resourceQueries: ["Raspberry Pi HAT+ specification", "Raspberry Pi Product Information Portal", "GPIO Zero documentation"],
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
    resourceQueries: ["MOSFET driver and flyback protection guide", "Raspberry Pi Debug Probe"],
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
    resourceQueries: ["GPIO Zero documentation", "Pico C/C++ SDK documentation", "MicroPython on Pico-series boards"],
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
    resourceQueries: ["GPIO Zero documentation", "Raspberry Pi Debug Probe"],
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
    resourceQueries: ["Raspberry Pi configuration", "Raspberry Pi Debug Probe", "Raspberry Pi camera software"],
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
    resourceQueries: ["systemd service documentation", "Raspberry Pi remote access"],
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
    resourceQueries: ["Raspberry Pi documentation source repository", "Raspberry Pi Product Information Portal"],
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
    resourceQueries: ["Raspberry Pi computer hardware catalog", "Raspberry Pi Product Information Portal"],
  },
});

function stageResources(queries, limit = 5) {
  const resources = new Map();
  for (const query of queries) {
    for (const resource of resourceSearch({ query, limit: 3 }).results) {
      if (!resources.has(resource.id)) resources.set(resource.id, resource);
      if (resources.size >= limit) return [...resources.values()];
    }
  }
  return [...resources.values()];
}

function lifecycleGuide({ stage, project = "", includeResources = true }) {
  const requestedStage = normalizeSearchText(stage);
  const resolvedStage = LIFECYCLE_STAGE_NAMES.includes(requestedStage)
    ? requestedStage
    : LIFECYCLE_ALIASES.get(requestedStage);

  if (!resolvedStage) {
    return { found: false, requestedStage: stage, supportedStages: LIFECYCLE_STAGE_NAMES, issue: "Unknown lifecycle stage." };
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
    resources: includeResources ? stageResources(definition.resourceQueries) : [],
    safetyBoundary: "Treat linked summaries as navigation aids. Verify exact board/module markings and current source documents before wiring or purchase.",
  };
}

export { LIFECYCLE_ALIASES, LIFECYCLE_STAGES, lifecycleGuide, stageResources };
