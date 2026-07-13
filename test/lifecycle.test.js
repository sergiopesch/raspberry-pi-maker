import test from "node:test";
import assert from "node:assert/strict";
import { LIFECYCLE_STAGE_NAMES } from "../src/catalog.js";
import { lifecycleGuide } from "../src/lifecycle.js";

test("every lifecycle stage returns concrete reviewed resources", () => {
  for (const stage of LIFECYCLE_STAGE_NAMES) {
    const guide = lifecycleGuide({ stage });
    assert.equal(guide.found, true, stage);
    assert.ok(guide.resources.length > 0, stage);
  }
});

test("lifecycle aliases resolve and resources can be omitted", () => {
  assert.equal(lifecycleGuide({ stage: "troubleshoot" }).stage, "debug");
  assert.deepEqual(lifecycleGuide({ stage: "wire", includeResources: false }).resources, []);
});

test("unknown lifecycle stage returns supported choices", () => {
  const guide = lifecycleGuide({ stage: "teleport" });
  assert.equal(guide.found, false);
  assert.deepEqual(guide.supportedStages, LIFECYCLE_STAGE_NAMES);
});
