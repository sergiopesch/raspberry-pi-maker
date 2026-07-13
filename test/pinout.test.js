import assert from "node:assert/strict";
import test from "node:test";

import { lookupPin, normalizePinExpression, normalizePinTokens } from "../src/pinout.js";

test("BCM expressions remain BCM expressions", () => {
  assert.equal(normalizePinExpression("BCM 17"), "bcm17");
  assert.deepEqual(normalizePinTokens("BCM 17"), ["bcm17"]);

  const result = lookupPin(normalizePinTokens("BCM 17")[0]);
  assert.equal(result.found, true);
  assert.equal(result.numbering, "BCM");
  assert.equal(result.bcm, 17);
  assert.equal(result.physical, 11);
  assert.notEqual(result.physical, 17);
});

test("physical pin phrases parse without stray tokens", () => {
  assert.deepEqual(normalizePinTokens("physical pin 11"), ["11"]);
  assert.deepEqual(normalizePinTokens("physical 11"), ["11"]);
  assert.deepEqual(normalizePinTokens("pin11"), ["11"]);

  const result = lookupPin(normalizePinTokens("physical pin 11")[0]);
  assert.equal(result.found, true);
  assert.equal(result.numbering, "physical");
  assert.equal(result.physical, 11);
  assert.equal(result.bcm, 17);
});

test("mixed pin lists preserve each numbering scheme", () => {
  assert.deepEqual(
    normalizePinTokens("GPIO17, physical 11, pin11"),
    ["bcm17", "11", "11"],
  );
  assert.deepEqual(
    normalizePinTokens("GPIO17 BCM2 physical pin 13"),
    ["bcm17", "bcm2", "13"],
  );
});

test("ambiguous or malformed pin text is rejected rather than partially guessed", () => {
  for (const input of ["BCM", "GPIO seventeen", "GPIO17 plus something", "physical pin"]) {
    const tokens = normalizePinTokens(input);
    assert.equal(tokens.length, 1);
    const result = lookupPin(tokens[0]);
    assert.equal(result.found, false);
    assert.match(result.issue, /Unrecognized pin expression/);
  }
});

test("unknown but well-formed pins report the correct numbering scheme", () => {
  assert.match(lookupPin("bcm999").issue, /Unknown BCM GPIO 999/);
  assert.match(lookupPin("999").issue, /Unknown physical pin 999/);
});
