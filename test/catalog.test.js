import assert from "node:assert/strict";
import test from "node:test";

import { RESOURCE_CATALOG, boardCompare, resourceSearch } from "../src/catalog.js";

test("resource search labels exact part matches", () => {
  const result = resourceSearch({ query: "HC-SR04" });
  assert.equal(result.match.status, "exact");
  assert.equal(result.match.exact, true);
  assert.equal(result.results[0].id, "hc-sr04");
});

test("resource search tolerates small part-number spelling differences", () => {
  const result = resourceSearch({ query: "HCSR04" });
  assert.ok(["exact", "strong"].includes(result.match.status));
  assert.equal(result.results[0].id, "hc-sr04");
});

test("resource search returns an honest no-match response", () => {
  const result = resourceSearch({ query: "banana rocket transducer xyzzy" });
  assert.equal(result.match.status, "no_match");
  assert.equal(result.match.exact, false);
  assert.equal(result.resultCount, 0);
  assert.match(result.match.message, /No sufficiently relevant reviewed resource/);
});

test("resource search identifies related results as related rather than exact", () => {
  const result = resourceSearch({ query: "camera setup software" });
  assert.ok(result.resultCount > 0);
  assert.equal(result.match.exact, false);
  assert.ok(["strong", "related"].includes(result.match.status));
});

test("misspelled Sense HAT search finds Sense HAT instead of unrelated HATs", () => {
  const result = resourceSearch({ query: "raspberri pi sense hat" });
  assert.equal(result.match.status, "strong");
  assert.equal(result.results[0].id, "sense-hat");
  assert.deepEqual(result.results.map((resource) => resource.id), ["sense-hat"]);
});

test("board comparison accepts exact aliases and rejects unrelated names", () => {
  const result = boardCompare({ boards: ["Pi 5", "Pico 2 W", "banana rocket"] });
  assert.equal(result.boards[0].found, true);
  assert.equal(result.boards[0].id, "raspberry-pi-5");
  assert.equal(result.boards[1].found, true);
  assert.equal(result.boards[1].id, "raspberry-pi-pico-2");
  assert.equal(result.boards[2].found, false);
});

test("board comparison covers previously missing Pi 2 and Pi 3A+ models", () => {
  const result = boardCompare({ boards: ["Pi 2", "Pi 3A+"] });
  assert.equal(result.boards[0].id, "raspberry-pi-2-model-b");
  assert.equal(result.boards[1].id, "raspberry-pi-3-model-a-plus");
  assert.ok(result.boards.every((board) => board.found));
});

test("every structured board profile is reachable by its official title", () => {
  const profiledBoards = RESOURCE_CATALOG.resources.filter((resource) => resource.kind === "board" && resource.profile);
  assert.ok(profiledBoards.length >= 19);
  for (const resource of profiledBoards) {
    const [result] = boardCompare({ boards: [resource.title] }).boards;
    assert.equal(result.found, true, resource.title);
    assert.equal(result.id, resource.id, resource.title);
  }
});

test("expanded catalog retains required provenance and safety metadata", () => {
  assert.equal(RESOURCE_CATALOG.resources.length, 78);
  for (const resource of RESOURCE_CATALOG.resources) {
    assert.match(resource.url, /^https:\/\//);
    assert.ok(resource.publisher);
    assert.ok(resource.authority);
    if (resource.kind === "component") assert.ok(resource.safety, resource.id);
  }
});
