import { readFileSync } from "node:fs";

const RESOURCE_CATALOG = Object.freeze(
  JSON.parse(readFileSync(new URL("../data/resources.json", import.meta.url), "utf8")),
);
const RESOURCE_KINDS = Object.freeze([
  "all",
  "board",
  "accessory",
  "component",
  "datasheet",
  "software",
  "learning",
]);
const LIFECYCLE_STAGE_NAMES = Object.freeze([
  "choose",
  "setup",
  "design",
  "build",
  "code",
  "test",
  "debug",
  "deploy",
  "maintain",
  "retire",
]);

const GENERIC_QUERY_TERMS = new Set([
  "a",
  "all",
  "and",
  "board",
  "component",
  "datasheet",
  "doc",
  "docs",
  "documentation",
  "for",
  "official",
  "pi",
  "raspberry",
  "resource",
  "the",
]);

function normalizeSearchText(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9+.-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function searchTokens(value) {
  return normalizeSearchText(value).split(/[\s+.-]+/).filter(Boolean);
}

function editDistance(left, right) {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitution = previous[rightIndex - 1] + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1);
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        substitution,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

function tokenSimilarity(queryToken, candidateToken) {
  if (queryToken === candidateToken) return 1;
  if (queryToken.length >= 4 && candidateToken.includes(queryToken)) return 0.9;
  if (candidateToken.length >= 4 && queryToken.includes(candidateToken)) return 0.86;
  const distance = editDistance(queryToken, candidateToken);
  const longest = Math.max(queryToken.length, candidateToken.length);
  return longest === 0 ? 0 : Math.max(0, 1 - distance / longest);
}

function isGenericQueryTerm(token) {
  if (GENERIC_QUERY_TERMS.has(token)) return true;
  return token.length >= 7 && editDistance(token, "raspberry") <= 2;
}

function resourceFields(resource) {
  return [
    { name: "id", weight: 1, values: [resource.id] },
    { name: "title", weight: 1, values: [resource.title] },
    { name: "alias", weight: 0.98, values: resource.aliases },
    { name: "topic", weight: 0.82, values: resource.topics },
    { name: "summary", weight: 0.55, values: [resource.summary] },
  ];
}

function scoreResource(resource, normalizedQuery, queryTokens) {
  const identityValues = [resource.id, resource.title, ...resource.aliases].map(normalizeSearchText);
  const exact = normalizedQuery.length > 0 && identityValues.includes(normalizedQuery);
  const fields = resourceFields(resource);
  const tokenMatches = queryTokens.map((queryToken) => {
    let best = { score: 0, field: null, value: null };
    for (const field of fields) {
      for (const value of field.values) {
        for (const candidateToken of searchTokens(value)) {
          const score = tokenSimilarity(queryToken, candidateToken) * field.weight;
          if (score > best.score) best = { score, field: field.name, value };
        }
      }
    }
    return { token: queryToken, ...best };
  });

  const meaningfulMatches = tokenMatches.filter((match) => match.score >= 0.68);
  const identityMatches = tokenMatches.filter(
    (match) => match.score >= 0.68 && ["id", "title", "alias"].includes(match.field),
  );
  const average = tokenMatches.length > 0
    ? tokenMatches.reduce((total, match) => total + match.score, 0) / tokenMatches.length
    : 0;
  const confidence = exact ? 100 : Math.round(average * 92);
  const requiredMatches = queryTokens.length <= 2 ? queryTokens.length : Math.ceil(queryTokens.length * 0.6);
  const eligible = exact || (
    meaningfulMatches.length >= Math.max(1, requiredMatches)
    && identityMatches.length >= 1
    && confidence >= 48
  );

  return {
    exact,
    eligible,
    confidence,
    tokenMatches,
    score: (exact ? 1000 : 0) + confidence + identityMatches.length * 8 + meaningfulMatches.length * 3,
  };
}

function resourceSearch({ query = "", kind = "all", stage = "all", limit = 8 } = {}) {
  const normalizedQuery = normalizeSearchText(query);
  const allQueryTokens = searchTokens(normalizedQuery);
  const distinctiveTokens = allQueryTokens.filter((token) => !isGenericQueryTerm(token));
  const queryTokens = distinctiveTokens.length > 0 ? distinctiveTokens : allQueryTokens;
  const boundedLimit = Math.min(20, Math.max(1, Number.isFinite(limit) ? Math.floor(limit) : 8));
  const normalizedKind = RESOURCE_KINDS.includes(kind) ? kind : "all";
  const normalizedStage = LIFECYCLE_STAGE_NAMES.includes(stage) ? stage : "all";
  const browsing = normalizedQuery.length === 0;

  const scored = RESOURCE_CATALOG.resources
    .filter((resource) => normalizedKind === "all" || resource.kind === normalizedKind)
    .filter((resource) => normalizedStage === "all" || resource.stages.includes(normalizedStage))
    .map((resource) => ({
      resource,
      match: browsing
        ? { exact: false, eligible: true, confidence: 0, tokenMatches: [], score: 0 }
        : scoreResource(resource, normalizedQuery, queryTokens),
    }))
    .filter(({ match }) => match.eligible)
    .sort((left, right) => right.match.score - left.match.score || left.resource.title.localeCompare(right.resource.title));

  const exactMatch = scored.some(({ match }) => match.exact);
  const bestConfidence = scored[0]?.match.confidence ?? 0;
  const results = scored.slice(0, boundedLimit).map(({ resource, match }) => ({
    id: resource.id,
    title: resource.title,
    kind: resource.kind,
    stages: resource.stages,
    summary: resource.summary,
    url: resource.url,
    publisher: resource.publisher,
    authority: resource.authority,
    license: resource.license,
    ...(resource.safety ? { safety: resource.safety } : {}),
    relevance: match.confidence,
    matchedFields: [...new Set(match.tokenMatches.filter((item) => item.score >= 0.68).map((item) => item.field))],
  }));

  const status = browsing
    ? "browse"
    : results.length === 0
      ? "no_match"
      : exactMatch
        ? "exact"
        : bestConfidence >= 75
          ? "strong"
          : "related";
  const message = status === "no_match"
    ? "No sufficiently relevant reviewed resource was found. Try a model number, part number, interface, or manufacturer."
    : status === "related"
      ? "No exact match was found. These are related reviewed resources; verify that the title matches the intended hardware."
      : null;

  return {
    query,
    filters: { kind: normalizedKind, stage: normalizedStage },
    match: {
      status,
      exact: exactMatch,
      confidence: bestConfidence,
      ...(message ? { message } : {}),
    },
    reviewedOn: RESOURCE_CATALOG.reviewedOn,
    results,
    resultCount: results.length,
    coverage: RESOURCE_CATALOG.policy.scope,
    copyright: RESOURCE_CATALOG.policy.copyright,
    freshness: RESOURCE_CATALOG.policy.freshness,
  };
}

function findBoardResource(input) {
  const query = normalizeSearchText(input);
  const candidates = RESOURCE_CATALOG.resources.filter(
    (resource) => resource.kind === "board" && resource.profile,
  );
  const exact = candidates.find((resource) =>
    [resource.id, resource.title, ...resource.aliases].map(normalizeSearchText).includes(query),
  );
  if (exact) return { resource: exact, confidence: 100, exact: true };

  const ranked = candidates
    .map((resource) => ({ resource, ...scoreResource(resource, query, searchTokens(query)) }))
    .filter((candidate) => candidate.eligible && candidate.confidence >= 72)
    .sort((left, right) => right.score - left.score);
  if (ranked.length === 0) return null;
  if (ranked[1] && ranked[0].confidence - ranked[1].confidence < 4) return null;
  return { resource: ranked[0].resource, confidence: ranked[0].confidence, exact: false };
}

function boardCompare({ boards }) {
  const uniqueBoards = [...new Set(boards.map((board) => String(board).trim()).filter(Boolean))].slice(0, 6);
  const matches = uniqueBoards.map((query) => {
    const match = findBoardResource(query);
    if (!match) {
      return {
        query,
        found: false,
        issue: "Board profile not found or the name is ambiguous. Search the catalog for an exact model or family.",
      };
    }
    const { resource } = match;
    return {
      query,
      found: true,
      exact: match.exact,
      confidence: match.confidence,
      id: resource.id,
      title: resource.title,
      summary: resource.summary,
      source: resource.url,
      ...resource.profile,
    };
  });

  return {
    reviewedOn: RESOURCE_CATALOG.reviewedOn,
    boards: matches,
    decisionQuestions: [
      "Does the project need a full Linux OS, deterministic real-time control, or both?",
      "Which camera, display, storage, PCIe, network, and GPIO interfaces are mandatory?",
      "What are the sustained power, cooling, enclosure, and physical-access constraints?",
      "Is this a one-off prototype or a maintained product that needs availability and lifecycle evidence?",
    ],
    reminder: "Confirm the exact product variant, ordering code, current documentation, and connector/cable requirements before purchasing.",
  };
}

export {
  LIFECYCLE_STAGE_NAMES,
  RESOURCE_CATALOG,
  RESOURCE_KINDS,
  boardCompare,
  editDistance,
  findBoardResource,
  normalizeSearchText,
  resourceSearch,
  tokenSimilarity,
};
