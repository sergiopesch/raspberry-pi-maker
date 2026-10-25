import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [archiveArg, hostArg] = process.argv.slice(2);
assert.ok(archiveArg && hostArg, "provide the runtime TGZ and actual OpenClaw package directory");
const archive = resolve(archiveArg);
const host = realpathSync(hostArg);
const version = JSON.parse(readFileSync(join(host, "package.json"))).version;
const installers = {
  "2026.5.22": "install-BG7jqqYt.js",
  "2026.10.5": "install-BShD5boV.mjs",
};
assert.ok(installers[version], `unreviewed native installer version ${version}`);
const fixture = mkdtempSync(join(tmpdir(), "pi-maker-native-install-"));
for (const name of ["home", "config", "state", "tmp", "extensions"]) mkdirSync(join(fixture, name));
Object.assign(process.env, {
  HOME: join(fixture, "home"),
  XDG_CONFIG_HOME: join(fixture, "config"),
  OPENCLAW_HOME: join(fixture, "home"),
  OPENCLAW_STATE_DIR: join(fixture, "state"),
  OPENCLAW_CONFIG_PATH: join(fixture, "state/config.json"),
  TMPDIR: join(fixture, "tmp"),
});
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const protectedFiles = [join(host, "package.json"), join(host, "openclaw.mjs")];
const before = protectedFiles.map(hash);
const exports = await import(pathToFileURL(join(host, "dist", installers[version])));
const install = Object.values(exports).find((value) => typeof value === "function" && value.name === "installPluginFromArchive");
assert.equal(typeof install, "function");
const result = await install({
  archivePath: archive, extensionsDir: join(fixture, "extensions"),
  expectedPluginId: "raspberry-pi-maker", mode: "install", dryRun: false,
  config: {}, timeoutMs: 15_000, workTimeoutMs: 60_000,
  logger: { info: console.error, warn: console.error },
});
assert.equal(result.ok, true, result.error);
const installed = join(fixture, "extensions/raspberry-pi-maker");
const packageManifest = JSON.parse(readFileSync(join(installed, "package.json")));
assert.equal(packageManifest.version, "1.2.3");
assert.equal(packageManifest.peerDependencies.openclaw, ">=2026.5.22");
assert.deepEqual(packageManifest.peerDependenciesMeta, { openclaw: { optional: true } });
assert.equal("devDependencies" in packageManifest, false);
assert.equal("overrides" in packageManifest, false);
assert.equal(existsSync(join(installed, "vendor")), false);
assert.ok(existsSync(join(installed, "node_modules/typebox/package.json")));
assert.ok(lstatSync(join(installed, "node_modules/openclaw")).isSymbolicLink());
assert.equal(realpathSync(join(installed, "node_modules/openclaw")), host);
assert.deepEqual(readdirSync(join(installed, "node_modules")).filter((name) => !name.startsWith(".")).sort(), ["openclaw", "typebox"]);
assert.deepEqual(protectedFiles.map(hash), before);
const { default: entry } = await import(pathToFileURL(join(installed, "index.js")));
const { getToolPluginMetadata } = await import(pathToFileURL(join(host, "dist/plugin-sdk/tool-plugin.js")));
const manifest = JSON.parse(readFileSync(join(installed, "openclaw.plugin.json")));
assert.deepEqual(getToolPluginMetadata(entry).tools.map((tool) => tool.name), manifest.contracts.tools);
const tools = [];
entry.register({ pluginConfig: {}, registerTool(tool) { tools.push(tool); } });
assert.equal(tools.length, 8);
const calls = [
  ["pi_project_plan", { goal: "Read a sensor", piModel: "Pi 5" }, (value) => assert.equal(value.board.id, "raspberry-pi-5")],
  ["pi_resource_search", { query: "HC-SR04" }, (value) => assert.equal(value.results[0].id, "hc-sr04")],
  ["pi_board_compare", { boards: ["Pi 5"] }, (value) => assert.equal(value.boards[0].id, "raspberry-pi-5")],
  ["pi_lifecycle_guide", { stage: "build" }, (value) => assert.equal(value.stage, "build")],
  ["pi_pin_lookup", { pins: "GPIO17" }, (value) => assert.equal(value.queries[0].bcm, 17)],
  ["pi_wiring_safety_check", { components: "HC-SR04", wiring: "Echo to GPIO17 without a level shifter" }, (value) => assert.equal(value.status, "needs_changes_before_power")],
  ["pi_experiment_log_template", { projectName: "Native test", objective: "Check contract" }, (value) => assert.match(value, /^# Native test Experiment Log/)],
];
for (const [name, params, check] of calls) {
  const result = await tools.find((tool) => tool.name === name).execute("native-smoke", params);
  assert.equal(result.content[0].type, "text");
  check(result.details);
}
console.log(JSON.stringify({ host, version, archive, archiveSha256: hash(archive), fixture,
  registeredTools: tools.map((tool) => tool.name), executedPureTools: calls.length,
  vendorAbsent: true, hostFilesUnchanged: true }));
