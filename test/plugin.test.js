import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import entry from "../index.js";

const manifest = JSON.parse(readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"));

function registeredTools() {
  const tools = [];
  entry.register({
    pluginConfig: {},
    registerTool(tool) {
      tools.push(tool);
    },
  });
  return tools;
}

test("real SDK entrypoint exposes and registers the eight lazy tool contracts", () => {
  const metadata = getToolPluginMetadata(entry);
  assert.equal(metadata.id, manifest.id);
  assert.deepEqual(metadata.activation, { onStartup: false });
  assert.deepEqual(metadata.tools.map((tool) => tool.name), manifest.contracts.tools);
  assert.equal(metadata.tools.length, 8);
  assert.equal(entry.configSchema.safeParse({}).success, true);
  assert.equal(entry.configSchema.safeParse({ unexpected: true }).success, false);

  const tools = registeredTools();
  assert.deepEqual(tools.map((tool) => tool.name), manifest.contracts.tools);
  for (const tool of tools) {
    assert.equal(typeof tool.execute, "function");
    assert.deepEqual(tool.parameters, metadata.tools.find((item) => item.name === tool.name).parameters);
  }
  const discovery = tools.find((tool) => tool.name === "pi_laptop_discovery_snapshot");
  assert.equal(discovery.parameters.properties.includeRawOutput.type, "boolean");
  assert.ok(!discovery.parameters.required?.includes("includeRawOutput"));
});

test("SDK execution preserves planning, lookup, safety, and template results", async () => {
  const tools = new Map(registeredTools().map((tool) => [tool.name, tool]));
  const examples = [
    ["pi_project_plan", { goal: "Read a sensor", piModel: "Pi 5" }, (result) => {
      assert.equal(result.goal, "Read a sensor");
      assert.equal(result.board.id, "raspberry-pi-5");
    }],
    ["pi_resource_search", { query: "HC-SR04" }, (result) => {
      assert.equal(result.results[0].id, "hc-sr04");
    }],
    ["pi_board_compare", { boards: ["Pi 5"] }, (result) => {
      assert.equal(result.boards[0].id, "raspberry-pi-5");
    }],
    ["pi_lifecycle_guide", { stage: "build" }, (result) => {
      assert.equal(result.stage, "build");
    }],
    ["pi_pin_lookup", { pins: "physical pin 11, GPIO17" }, (result) => {
      assert.equal(result.queries.length, 2);
      assert.ok(result.queries.every((pin) => pin.bcm === 17));
    }],
    ["pi_wiring_safety_check", { components: "HC-SR04", wiring: "Echo to GPIO17 without a level shifter" }, (result) => {
      assert.equal(result.status, "needs_changes_before_power");
    }],
    ["pi_experiment_log_template", { projectName: "Sensor", objective: "Check readings" }, (result) => {
      assert.match(result, /^# Sensor Experiment Log/);
    }],
  ];

  for (const [name, params, check] of examples) {
    const result = await tools.get(name).execute("sdk-integration-test", params);
    assert.equal(result.content[0].type, "text");
    if (typeof result.details === "string") assert.equal(result.content[0].text, result.details);
    else assert.deepEqual(JSON.parse(result.content[0].text), result.details);
    check(result.details);
  }
  // Discovery's native collectors are covered with fixtures in discovery.test.js.
  // Registration above verifies its SDK contract without reading host devices.
});
