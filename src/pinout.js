const PINOUT = new Map([
  ["1", { physical: 1, name: "3V3", kind: "power", notes: "3.3V power rail. Do not short to GND." }],
  ["2", { physical: 2, name: "5V", kind: "power", notes: "5V power rail. Never connect directly to GPIO." }],
  ["3", { physical: 3, bcm: 2, name: "GPIO2 / SDA1", kind: "gpio", notes: "I2C SDA. Has pull-up; avoid for ordinary outputs." }],
  ["4", { physical: 4, name: "5V", kind: "power", notes: "5V power rail. Never connect directly to GPIO." }],
  ["5", { physical: 5, bcm: 3, name: "GPIO3 / SCL1", kind: "gpio", notes: "I2C SCL. Has pull-up; avoid for ordinary outputs." }],
  ["6", { physical: 6, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["7", { physical: 7, bcm: 4, name: "GPIO4", kind: "gpio", notes: "General GPIO." }],
  ["8", { physical: 8, bcm: 14, name: "GPIO14 / TXD", kind: "gpio", notes: "UART TXD when serial is enabled." }],
  ["9", { physical: 9, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["10", { physical: 10, bcm: 15, name: "GPIO15 / RXD", kind: "gpio", notes: "UART RXD when serial is enabled." }],
  ["11", { physical: 11, bcm: 17, name: "GPIO17", kind: "gpio", notes: "Good general-purpose pin." }],
  ["12", { physical: 12, bcm: 18, name: "GPIO18 / PWM0", kind: "gpio", notes: "PWM-capable pin." }],
  ["13", { physical: 13, bcm: 27, name: "GPIO27", kind: "gpio", notes: "Good general-purpose pin." }],
  ["14", { physical: 14, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["15", { physical: 15, bcm: 22, name: "GPIO22", kind: "gpio", notes: "Good general-purpose pin." }],
  ["16", { physical: 16, bcm: 23, name: "GPIO23", kind: "gpio", notes: "Good general-purpose pin." }],
  ["17", { physical: 17, name: "3V3", kind: "power", notes: "3.3V power rail. Do not short to GND." }],
  ["18", { physical: 18, bcm: 24, name: "GPIO24", kind: "gpio", notes: "Good general-purpose pin." }],
  ["19", { physical: 19, bcm: 10, name: "GPIO10 / MOSI", kind: "gpio", notes: "SPI MOSI when SPI is enabled." }],
  ["20", { physical: 20, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["21", { physical: 21, bcm: 9, name: "GPIO9 / MISO", kind: "gpio", notes: "SPI MISO when SPI is enabled." }],
  ["22", { physical: 22, bcm: 25, name: "GPIO25", kind: "gpio", notes: "Good general-purpose pin." }],
  ["23", { physical: 23, bcm: 11, name: "GPIO11 / SCLK", kind: "gpio", notes: "SPI clock when SPI is enabled." }],
  ["24", { physical: 24, bcm: 8, name: "GPIO8 / CE0", kind: "gpio", notes: "SPI CE0 when SPI is enabled." }],
  ["25", { physical: 25, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["26", { physical: 26, bcm: 7, name: "GPIO7 / CE1", kind: "gpio", notes: "SPI CE1 when SPI is enabled." }],
  ["27", { physical: 27, bcm: 0, name: "GPIO0 / ID_SD", kind: "gpio", notes: "HAT EEPROM ID pin. Avoid for ordinary projects." }],
  ["28", { physical: 28, bcm: 1, name: "GPIO1 / ID_SC", kind: "gpio", notes: "HAT EEPROM ID pin. Avoid for ordinary projects." }],
  ["29", { physical: 29, bcm: 5, name: "GPIO5", kind: "gpio", notes: "Good general-purpose pin." }],
  ["30", { physical: 30, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["31", { physical: 31, bcm: 6, name: "GPIO6", kind: "gpio", notes: "Good general-purpose pin." }],
  ["32", { physical: 32, bcm: 12, name: "GPIO12 / PWM0", kind: "gpio", notes: "PWM-capable pin." }],
  ["33", { physical: 33, bcm: 13, name: "GPIO13 / PWM1", kind: "gpio", notes: "PWM-capable pin." }],
  ["34", { physical: 34, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["35", { physical: 35, bcm: 19, name: "GPIO19 / MISO / PWM1", kind: "gpio", notes: "SPI/PWM-capable pin." }],
  ["36", { physical: 36, bcm: 16, name: "GPIO16", kind: "gpio", notes: "Good general-purpose pin." }],
  ["37", { physical: 37, bcm: 26, name: "GPIO26", kind: "gpio", notes: "Good general-purpose pin." }],
  ["38", { physical: 38, bcm: 20, name: "GPIO20 / MOSI", kind: "gpio", notes: "SPI-related alternate function." }],
  ["39", { physical: 39, name: "GND", kind: "ground", notes: "Ground reference." }],
  ["40", { physical: 40, bcm: 21, name: "GPIO21 / SCLK", kind: "gpio", notes: "SPI-related alternate function." }],
]);

const BCM_TO_PHYSICAL = new Map(
  [...PINOUT.values()]
    .filter((entry) => Number.isInteger(entry.bcm))
    .map((entry) => [String(entry.bcm), entry.physical]),
);

function normalizePinExpression(expression) {
  const normalized = String(expression).trim().toLowerCase().replace(/\s+/g, " ");
  let match = normalized.match(/^(?:bcm|gpio)\s*(\d{1,3})$/);
  if (match) return `bcm${Number(match[1])}`;

  match = normalized.match(/^(?:physical(?:\s+pin)?|pin)\s*(\d{1,3})$/);
  if (match) return String(Number(match[1]));

  match = normalized.match(/^(\d{1,3})$/);
  if (match) return String(Number(match[1]));

  return `invalid:${normalized || "empty input"}`;
}

function normalizePinTokens(input) {
  const value = String(input).trim();
  if (!value) return [];

  return value.split(/[,;\n]+/).flatMap((segment) => {
    const trimmed = segment.trim();
    const exact = normalizePinExpression(trimmed);
    if (!exact.startsWith("invalid:")) return [exact];

    const matches = [...trimmed.matchAll(/(?:bcm|gpio)\s*\d{1,3}|physical(?:\s+pin)?\s*\d{1,3}|pin\s*\d{1,3}|\b\d{1,3}\b/gi)];
    if (matches.length === 0) return [exact];

    let remainder = trimmed;
    for (const match of matches) remainder = remainder.replace(match[0], " ");
    if (remainder.trim()) return [exact];
    return matches.map((match) => normalizePinExpression(match[0]));
  });
}

function lookupPin(token) {
  const normalized = String(token).trim().toLowerCase();
  if (normalized.startsWith("invalid:")) {
    return {
      query: normalized.slice("invalid:".length),
      found: false,
      issue: "Unrecognized pin expression. Use forms such as GPIO17, BCM 17, physical pin 11, or pin 11.",
    };
  }
  if (normalized.startsWith("bcm")) {
    const bcm = normalized.slice(3);
    const physical = BCM_TO_PHYSICAL.get(bcm);
    if (physical === undefined) return { query: token, found: false, issue: `Unknown BCM GPIO ${bcm}.` };
    const entry = PINOUT.get(String(physical));
    return { query: token, found: true, numbering: "BCM", ...entry };
  }
  const entry = PINOUT.get(normalized);
  if (!entry) return { query: token, found: false, issue: `Unknown physical pin ${token}.` };
  return { query: token, found: true, numbering: "physical", ...entry };
}

export { lookupPin, normalizePinExpression, normalizePinTokens };
