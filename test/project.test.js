import test from "node:test";
import assert from "node:assert/strict";
import { experimentTemplate, projectPlan } from "../src/project.js";

test("project plan resolves an exact board and known modules", () => {
  const plan = projectPlan({ goal: "Environmental station", piModel: "Raspberry Pi 5", modules: ["Sense HAT"] });
  assert.equal(plan.board.found, true);
  assert.equal(plan.board.id, "raspberry-pi-5");
  assert.equal(plan.moduleResources[0].resources[0].id, "sense-hat");
  assert.deepEqual(plan.catalogGaps, []);
});

test("project plan makes catalog gaps explicit", () => {
  const plan = projectPlan({ goal: "Prototype", modules: ["banana rocket transducer xyzzy"] });
  assert.deepEqual(plan.catalogGaps, ["banana rocket transducer xyzzy"]);
  assert.equal(plan.board, null);
  assert.ok(plan.nextChecks.some((item) => item.includes("pi_wiring_safety_check")));
});

test("experiment template supports markdown and structured output", () => {
  const markdown = experimentTemplate({ projectName: "Fan", objective: "Measure temperature" });
  assert.match(markdown, /^# Fan Experiment Log/);
  const structured = experimentTemplate({ projectName: "Fan", objective: "Measure temperature", outputStyle: "json" });
  assert.equal(structured.title, "Fan");
  assert.equal(structured.markdown, markdown);
});
