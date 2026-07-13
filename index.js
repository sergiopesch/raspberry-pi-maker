import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import {
  LIFECYCLE_STAGE_NAMES,
  RESOURCE_KINDS,
  boardCompare,
  normalizeSearchText,
  resourceSearch,
} from "./src/catalog.js";
import { lookupPin, normalizePinExpression, normalizePinTokens } from "./src/pinout.js";
import { buildSafetyFindings } from "./src/safety.js";
import { laptopDiscoverySnapshot } from "./src/discovery.js";

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
  normalizePinExpression,
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
        pins: Type.String({ description: "Comma-separated pins, for example 'physical pin 11, GPIO17, BCM 2'. Bare numbers mean physical pins." }),
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
        includeRawOutput: Type.Optional(Type.Boolean({ description: "Explicitly include sensitive raw local output such as device identifiers, addresses, mount details, and connection names. Defaults to false with structured redaction." })),
      }),
      execute: ({ includeRawOutput }) =>
        laptopDiscoverySnapshot({ includeRawOutput: includeRawOutput ?? false }),
    }),
  ],
});
