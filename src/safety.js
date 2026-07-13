const NEGATION_BEFORE = /\b(?:no|not|without|missing|omit(?:ted)?|lack(?:s|ing)?|doesn['’]?t\s+(?:use|have)|do\s+not\s+(?:use|have))\s+(?:an?\s+)?$/i;
const NEGATION_AFTER = /^\s+(?:is\s+|was\s+)?(?:missing|omitted|absent|not\s+(?:used|fitted|installed|present))/i;
const LEVEL_PROTECTION_PATTERNS = [
  /level[ -]?shifter/i,
  /logic[ -]?level converter/i,
  /voltage divider/i,
  /resistor divider/i,
];

function classifyMentions(text, patterns) {
  const value = String(text);
  let positive = false;
  let negative = false;

  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const matcher = new RegExp(pattern.source, flags);
    for (const match of value.matchAll(matcher)) {
      const prefix = value.slice(Math.max(0, match.index - 48), match.index);
      const suffix = value.slice(match.index + match[0].length, match.index + match[0].length + 36);
      if (NEGATION_BEFORE.test(prefix) || NEGATION_AFTER.test(suffix)) negative = true;
      else positive = true;
    }
  }

  return { found: positive || negative, positive, negative };
}

function addFinding(findings, severity, topic, message, evidence) {
  if (findings.some((finding) => finding.topic === topic && finding.message === message)) return;
  findings.push({ severity, topic, message, ...(evidence ? { evidence } : {}) });
}

function circuitClauses(text) {
  return String(text)
    .split(/\n|;|\.(?:\s|$)|,(?=\s*[a-z0-9])/i)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function buildSafetyFindings({ components = "", wiring = "", powerNotes = "" }) {
  const text = `${components}\n${wiring}\n${powerNotes}`;
  const lower = text.toLowerCase();
  const findings = [];
  const warnings = [];
  const checks = [
    "Confirm the Pi is powered off before changing wiring.",
    "Verify BCM GPIO numbers against physical header pins before running code.",
  ];

  const levelProtection = classifyMentions(lower, LEVEL_PROTECTION_PATTERNS);
  const driverProtection = classifyMentions(lower, [
    /motor driver/i,
    /driver (?:board|module|stage|input)/i,
    /\b(?:mosfet|transistor|h[ -]?bridge|tb6612fng|tb6612|l298n?|uln2003|drv8833)\b/i,
  ]);
  const groundConnection = classifyMentions(lower, [
    /common ground/i,
    /shared ground/i,
    /grounds? (?:are )?(?:joined|connected|tied)/i,
    /\b(?:pi\s+)?gnd\s*(?:->|\bto\b|\bconnected to\b)\s*(?:driver\s+|supply\s+)?gnd\b/i,
  ]);
  const resistorProtection = classifyMentions(lower, [
    /current[ -]?limiting resistor/i,
    /\bresistor\b/i,
    /\b(?:220|330|470)\s*(?:ohms?|ω)?\b/i,
    /\b1\s*k(?:ohms?|ω)?\b/i,
  ]);

  for (const clause of circuitClauses(text)) {
    const hasFiveVolts = /\b5\s*v(?:olt(?:s)?)?\b/i.test(clause);
    const hasGpio = /\b(?:gpio|bcm)\s*\d*\b/i.test(clause);
    const connects = /(?:->|<-|\bto\b|\bfrom\b|\binto\b|\bconnect(?:ed|s)?\b|\bdirect(?:ly)?\b|\bsignal\b)/i.test(clause);
    const clauseProtection = classifyMentions(clause, LEVEL_PROTECTION_PATTERNS);
    if (hasFiveVolts && hasGpio && connects && !clauseProtection.positive) {
      addFinding(
        findings,
        "blocker",
        "5V GPIO input",
        "A 5V signal appears to reach a GPIO without confirmed level conversion. Raspberry Pi GPIO inputs are 3.3V only.",
        clause,
      );
    }
  }

  const isHcsr04 = /\b(?:hc-?sr04|ultrasonic distance sensor)\b/i.test(lower);
  const echoToGpio = /\becho\b.{0,80}\b(?:gpio|bcm)\s*\d*\b|\b(?:gpio|bcm)\s*\d*\b.{0,80}\becho\b/i.test(lower);
  if (isHcsr04 && echoToGpio) {
    if (levelProtection.negative || !levelProtection.positive) {
      addFinding(
        findings,
        "blocker",
        "HC-SR04 Echo",
        "HC-SR04 Echo is normally 5V. Add and verify a voltage divider or level shifter before the Pi input.",
        levelProtection.negative ? "Protection is explicitly absent." : "No level conversion is described.",
      );
    }
  } else if (isHcsr04) {
    addFinding(
      findings,
      "warning",
      "HC-SR04 topology",
      "The sensor is present, but the Echo path to the Pi is not explicit enough to verify.",
    );
  }

  const hasDiscreteLed = /\b(?:bare|discrete|single)?\s*led\b/i.test(lower) && !/\b(?:led strip|neopixel|onboard led|status led)\b/i.test(lower);
  if (hasDiscreteLed && resistorProtection.negative) {
    addFinding(
      findings,
      "blocker",
      "LED current limit",
      "A discrete LED is explicitly shown without a current-limiting resistor. Add a calculated series resistor before power-up.",
    );
  } else if (hasDiscreteLed && !resistorProtection.positive) {
    addFinding(
      findings,
      "warning",
      "LED current limit",
      "A discrete LED is present, but a current-limiting resistor is not confirmed.",
    );
  }

  const loadPattern = /\b(?:dc motor|motor|servo|pump|solenoid|relay|led strip|neopixel)\b/i;
  const hasHighCurrentLoad = loadPattern.test(lower);
  const directLoadClauses = circuitClauses(text).filter((clause) => {
    const hasLoad = loadPattern.test(clause);
    const hasGpio = /\b(?:gpio|bcm)\s*\d*\b/i.test(clause);
    const direct = /\b(?:direct|directly|drive|drives|driven|power|powers|powered)\b|(?:gpio|bcm)\s*\d*\s*(?:->|\bto\b)\s*(?:the\s+)?(?:dc\s+)?(?:motor|servo|pump|solenoid|relay|led strip|neopixel)/i.test(clause);
    const targetsDriverInput = /(?:gpio|bcm)\s*\d*\s*(?:->|\bto\b)\s*(?:(?:motor\s+)?driver|pwma?|ain\d?|bin\d?|in\d?|gate|base)/i.test(clause);
    return hasLoad && hasGpio && direct && !targetsDriverInput;
  });

  if (directLoadClauses.length > 0 || (hasHighCurrentLoad && driverProtection.negative)) {
    addFinding(
      findings,
      "blocker",
      "High-current load",
      "A GPIO must not directly power or drive this load. Use a suitable driver stage, external supply, and required flyback protection.",
      directLoadClauses[0] ?? "Driver protection is explicitly absent.",
    );
  } else if (hasHighCurrentLoad && /\b(?:gpio|bcm)\s*\d*\b/i.test(lower) && !driverProtection.positive) {
    addFinding(
      findings,
      "warning",
      "High-current topology",
      "A high-current load and GPIO are both present, but the driver path is not explicit enough to verify.",
    );
  }

  const externalPower = /\b(?:external|separate) (?:power|supply)|\bbattery\b|\bbench supply\b|\bmotor supply\b/i.test(lower);
  const isolatedInterface = /\b(?:galvanic(?:ally)? isolated|opto-?isolated)\b/i.test(lower);
  if (externalPower && !isolatedInterface) {
    if (groundConnection.negative) {
      addFinding(
        findings,
        "blocker",
        "Ground reference",
        "The design explicitly omits a common ground. Non-isolated control signals need a shared reference.",
      );
    } else if (!groundConnection.positive) {
      warnings.push("External power is present, but a common ground or intentional galvanic isolation is not confirmed.");
    }
    checks.push("Confirm the external supply and Pi share ground unless the interface is intentionally galvanically isolated.");
  }

  if (/\b(?:i2c|sda|scl)\b/i.test(lower)) {
    checks.push("Verify I2C pull-ups are to 3.3V and scan the intended bus before application testing.");
  }
  if (/\b(?:spi|miso|mosi|sclk)\b/i.test(lower)) {
    checks.push("Verify SPI logic levels, chip select, and bus mode with the smallest vendor example.");
  }
  if (/\b(?:camera|picamera|libcamera|rpicam)\b/i.test(lower)) {
    checks.push("Run `rpicam-hello --timeout 5000` before adding application code on current Raspberry Pi OS.");
  }

  const hasBlocker = findings.some((finding) => finding.severity === "blocker");
  const needsReview = findings.some((finding) => finding.severity === "warning") || warnings.length > 0;
  return {
    status: hasBlocker
      ? "needs_changes_before_power"
      : needsReview
        ? "review_before_power"
        : "no_common_risks_detected",
    findings,
    warnings,
    checks,
    limitations: "Text-only screening cannot verify the physical circuit, module revision, wire placement, power capacity, or datasheet limits. Inspect the as-built hardware before applying power.",
  };
}

export { buildSafetyFindings, classifyMentions };
