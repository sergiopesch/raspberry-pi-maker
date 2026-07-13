import assert from "node:assert/strict";
import test from "node:test";

import { buildSafetyFindings } from "../src/safety.js";

function topics(result) {
  return result.findings.map((finding) => finding.topic);
}

test("blocks HC-SR04 Echo when level conversion is explicitly absent", () => {
  const result = buildSafetyFindings({
    components: "HC-SR04 ultrasonic sensor",
    wiring: "Echo to GPIO17 without a level shifter",
  });
  assert.equal(result.status, "needs_changes_before_power");
  assert.ok(topics(result).includes("HC-SR04 Echo"));
});

test("accepts a described HC-SR04 divider without claiming the circuit is safe", () => {
  const result = buildSafetyFindings({
    components: "HC-SR04 ultrasonic sensor",
    wiring: "Echo through a 1k/2k voltage divider to GPIO17",
  });
  assert.ok(!topics(result).includes("HC-SR04 Echo"));
  assert.equal(result.status, "no_common_risks_detected");
  assert.match(result.limitations, /cannot verify the physical circuit/i);
});

test("blocks a discrete LED explicitly wired without a resistor", () => {
  const result = buildSafetyFindings({
    components: "bare LED",
    wiring: "GPIO17 to LED with no resistor, cathode to GND",
  });
  assert.equal(result.status, "needs_changes_before_power");
  assert.ok(topics(result).includes("LED current limit"));
});

test("does not warn when a discrete LED series resistor is explicit", () => {
  const result = buildSafetyFindings({
    components: "discrete LED",
    wiring: "GPIO17 through a 330 ohm resistor to LED anode; cathode to GND",
  });
  assert.ok(!topics(result).includes("LED current limit"));
});

test("does not block a motor controlled through a driver input", () => {
  const result = buildSafetyFindings({
    components: "TB6612FNG motor driver and two DC motors",
    wiring: "GPIO18 to driver PWMA; driver outputs to motors",
    powerNotes: "Separate motor supply with common ground to the Pi",
  });
  assert.ok(!topics(result).includes("High-current load"));
  assert.ok(!topics(result).includes("High-current topology"));
  assert.equal(result.status, "no_common_risks_detected");

  const explicitDriverName = buildSafetyFindings({
    components: "motor driver and DC motor",
    wiring: "GPIO18 to motor driver PWMA; motor driver output to motor",
    powerNotes: "Pi GND to driver GND; separate motor supply",
  });
  assert.ok(!topics(explicitDriverName).includes("High-current load"));
  assert.equal(explicitDriverName.status, "no_common_risks_detected");
});

test("blocks a motor directly driven from GPIO", () => {
  const result = buildSafetyFindings({
    components: "DC motor",
    wiring: "GPIO18 directly powers the motor; motor returns to GND",
  });
  assert.equal(result.status, "needs_changes_before_power");
  assert.ok(topics(result).includes("High-current load"));
});

test("blocks a direct 5V GPIO signal and accepts described conversion", () => {
  const unsafe = buildSafetyFindings({
    components: "5V sensor",
    wiring: "5V signal output connected directly to GPIO17",
  });
  assert.ok(topics(unsafe).includes("5V GPIO input"));

  const converted = buildSafetyFindings({
    components: "5V sensor and level shifter",
    wiring: "5V signal through the level shifter to GPIO17",
  });
  assert.ok(!topics(converted).includes("5V GPIO input"));

  const unrelatedProtection = buildSafetyFindings({
    components: "5V sensor plus a level shifter used on another bus",
    wiring: "5V signal output connected directly to GPIO17; level shifter on GPIO2 for I2C",
  });
  assert.ok(topics(unrelatedProtection).includes("5V GPIO input"));
});

test("requires an explicit reference for non-isolated external power", () => {
  const unclear = buildSafetyFindings({
    components: "sensor",
    wiring: "GPIO17 to sensor output",
    powerNotes: "Sensor uses a separate supply",
  });
  assert.equal(unclear.status, "review_before_power");
  assert.ok(unclear.warnings.some((warning) => /common ground/i.test(warning)));

  const explicit = buildSafetyFindings({
    components: "sensor",
    wiring: "GPIO17 to sensor output",
    powerNotes: "Sensor uses a separate supply with common ground to the Pi",
  });
  assert.ok(!explicit.warnings.some((warning) => /common ground/i.test(warning)));
});
