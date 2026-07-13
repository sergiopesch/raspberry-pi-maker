import { boardCompare, resourceSearch } from "./catalog.js";

function projectPlan({ goal, piModel = "", modules = [], constraints = "" }) {
  const cleanModules = modules.map((module) => String(module).trim()).filter(Boolean);
  const moduleResources = cleanModules.map((module) => {
    const search = resourceSearch({ query: module, limit: 3 });
    return { module, match: search.match, resources: search.results };
  });
  const board = piModel.trim() ? boardCompare({ boards: [piModel] }).boards[0] : null;

  return {
    goal,
    piModel: piModel.trim() || "Raspberry Pi model not specified",
    modules: cleanModules.length > 0 ? cleanModules : ["List modules before wiring."],
    board,
    moduleResources,
    catalogGaps: moduleResources.filter(({ resources }) => resources.length === 0).map(({ module }) => module),
    phases: [
      { name: "Capture assumptions", actions: ["Record Pi model, OS version, power supply rating, modules, and intended physical behavior.", "Create a pin map with BCM GPIO, physical pin, direction, voltage, and protection parts."] },
      { name: "Electrical safety review", actions: ["Check 3.3V logic compatibility for every GPIO input.", "Add resistors, pull-ups/pull-downs, level shifting, and drivers before applying power.", "Confirm common ground for every externally powered module."] },
      { name: "Minimal hardware probe", actions: ["Test one component at a time with a short foreground script.", "Capture command output and observations under logs/ or experiments/<date>/."] },
      { name: "Integration", actions: ["Combine components only after each minimal repro works.", "Promote repeated commands into scripts/ or a project-local helper CLI."] },
      { name: "Service mode", actions: ["Only add systemd after the foreground command is reliable.", "Use absolute paths, conservative restart policy, and journalctl checks."] },
    ],
    nextChecks: [
      "Run pi_pin_lookup for every GPIO reference and keep BCM and physical numbering explicit.",
      "Run pi_wiring_safety_check on the complete proposed wiring before applying power.",
      "Verify every catalog gap against the exact manufacturer part number and current datasheet.",
    ],
    suggestedFiles: ["hardware/pin-map.md", "experiments/README.md", "scripts/probe-<component>.py", "logs/<date>-bringup.log"],
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

export { experimentTemplate, projectPlan };
