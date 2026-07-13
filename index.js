import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import {
  LIFECYCLE_STAGE_NAMES,
  RESOURCE_KINDS,
  boardCompare,
  resourceSearch,
} from "./src/catalog.js";
import { laptopDiscoverySnapshot } from "./src/discovery.js";
import { lifecycleGuide } from "./src/lifecycle.js";
import { lookupPin, normalizePinExpression, normalizePinTokens } from "./src/pinout.js";
import { experimentTemplate, projectPlan } from "./src/project.js";
import { buildSafetyFindings } from "./src/safety.js";

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
  activation: { onStartup: false },
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
        projectPlan({ goal, piModel: piModel ?? "", modules: modules ?? [], constraints: constraints ?? "" }),
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
