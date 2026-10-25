import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync, symlinkSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "pi-maker-manifest-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "scripts"));
  copyFileSync(new URL("../scripts/runtime_manifest.py", import.meta.url), join(root, "scripts/runtime_manifest.py"));
  const source = readFileSync(new URL("../package.json", import.meta.url));
  writeFileSync(join(root, "package.json"), source);
  return {
    root, source,
    run(command) { return spawnSync("python3", [join(root, "scripts/runtime_manifest.py"), command], { encoding: "utf8" }); },
    packagePath: join(root, "package.json"),
    backupPath: join(root, "reports/source-package-for-pack.json"),
  };
}

test("packing removes exactly the two development fields and restores exact source bytes", (t) => {
  const f = fixture(t);
  assert.equal(f.run("prepare").status, 0);
  assert.equal(statSync(f.backupPath).mode & 0o777, 0o600);
  const expected = JSON.parse(f.source);
  delete expected.devDependencies;
  delete expected.overrides;
  assert.deepEqual(JSON.parse(readFileSync(f.packagePath)), expected);
  assert.notEqual(f.run("prepare").status, 0, "concurrent/second preparation must fail closed");
  assert.equal(f.run("restore").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), f.source);
  assert.equal(existsSync(f.backupPath), false);
});

test("packing recovery preserves user edits and rejects foreign backups", (t) => {
  const f = fixture(t);
  assert.equal(f.run("prepare").status, 0);
  const runtime = readFileSync(f.packagePath);
  const backup = readFileSync(f.backupPath);
  const edited = Buffer.concat([runtime, Buffer.from("\n")]);
  writeFileSync(f.packagePath, edited);
  assert.notEqual(f.run("restore").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), edited);
  writeFileSync(f.packagePath, runtime);
  const foreign = JSON.parse(backup);
  foreign.root = join(f.root, "other-checkout");
  writeFileSync(f.backupPath, JSON.stringify(foreign));
  assert.notEqual(f.run("restore").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), runtime);
  writeFileSync(f.backupPath, backup);
  writeFileSync(f.packagePath, f.source); // A restore interrupted after its atomic replacement.
  assert.equal(f.run("restore").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), f.source);
  assert.equal(existsSync(f.backupPath), false);
});

test("packing recovery rejects corrupt hashes and invalid permissions", (t) => {
  const f = fixture(t);
  assert.equal(f.run("prepare").status, 0);
  const runtime = readFileSync(f.packagePath);
  const backup = readFileSync(f.backupPath);
  for (const change of [{ source_sha256: "0".repeat(64) }, { mode: -1 }]) {
    writeFileSync(f.backupPath, JSON.stringify({ ...JSON.parse(backup), ...change }));
    assert.notEqual(f.run("restore").status, 0);
    assert.deepEqual(readFileSync(f.packagePath), runtime);
  }
  writeFileSync(f.backupPath, backup);
  assert.equal(f.run("restore").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), f.source);
});

test("packing refuses a symlinked source or reports directory", (t) => {
  const f = fixture(t);
  const other = join(f.root, "other");
  mkdirSync(other);
  symlinkSync(other, join(f.root, "reports"), "dir");
  assert.notEqual(f.run("prepare").status, 0);
  assert.deepEqual(readFileSync(f.packagePath), f.source);
  assert.equal(existsSync(join(other, "source-package-for-pack.json")), false);
  rmSync(join(f.root, "reports"));
  writeFileSync(join(other, "package.json"), f.source);
  rmSync(f.packagePath);
  symlinkSync(join(other, "package.json"), f.packagePath);
  assert.notEqual(f.run("prepare").status, 0);
  assert.deepEqual(readFileSync(join(other, "package.json")), f.source);
});
