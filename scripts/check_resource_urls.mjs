import { readFile } from "node:fs/promises";

const catalog = JSON.parse(
  await readFile(new URL("../data/resources.json", import.meta.url), "utf8"),
);
const concurrency = 8;
const timeoutMs = 10000;
const definitiveFailures = new Set([404, 410]);

async function request(url, method) {
  const response = await fetch(url, {
    method,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "user-agent": "raspberry-pi-maker-link-check/1.0 (+https://github.com/sergiopesch/raspberry-pi-maker)",
      ...(method === "GET" ? { range: "bytes=0-0" } : {}),
    },
  });
  await response.body?.cancel();
  return response;
}

async function check(resource) {
  try {
    let response = await request(resource.url, "HEAD");
    if (response.status === 405 || response.status === 501) response = await request(resource.url, "GET");
    const blocked = response.status === 401 || response.status === 403 || response.status === 429;
    const ok = (response.status >= 200 && response.status < 400) || blocked;
    return {
      id: resource.id,
      url: resource.url,
      status: response.status,
      ok,
      blocked,
      definitiveFailure: definitiveFailures.has(response.status),
    };
  } catch (error) {
    return {
      id: resource.id,
      url: resource.url,
      status: null,
      ok: false,
      blocked: false,
      definitiveFailure: false,
      error: error.name === "TimeoutError" ? "timeout" : error.message,
    };
  }
}

const resources = catalog.resources;
const results = [];
let nextIndex = 0;

async function worker() {
  while (nextIndex < resources.length) {
    const resource = resources[nextIndex];
    nextIndex += 1;
    results.push(await check(resource));
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
results.sort((left, right) => left.id.localeCompare(right.id));

for (const result of results) {
  const label = result.ok ? (result.blocked ? "BLOCKED" : "OK") : "CHECK";
  const detail = result.status ?? result.error;
  console.log(`${label.padEnd(7)} ${String(detail).padEnd(8)} ${result.id} ${result.url}`);
}

const broken = results.filter((result) => result.definitiveFailure);
const transient = results.filter((result) => !result.ok && !result.definitiveFailure);
const blocked = results.filter((result) => result.blocked);
console.log(`\nChecked ${results.length}: ${broken.length} broken, ${transient.length} transient/unreachable, ${blocked.length} bot-blocked.`);

if (broken.length > 0) process.exitCode = 1;
