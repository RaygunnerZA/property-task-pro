/**
 * Golden-set scoring for AI capabilities.
 *
 * Pure functions only: the harness supplies model output, this decides whether
 * it got better or worse. Scores are only comparable within one `fixture_set`.
 */

export interface Fixture {
  id: string;
  input: { text?: string; image?: string };
  /** Claims the model must produce, as `field:value` pairs. */
  expected: string[];
}

export interface FixtureSet {
  fixture_set: string;
  capability: string;
  notes?: string;
  fixtures: Fixture[];
}

/** One fixture's outcome after the model was called. */
export interface FixtureOutcome {
  id: string;
  /** Claims parsed from the model response, or null when the shape was invalid. */
  actual: string[] | null;
  latencyMs: number;
  costUsd?: number | null;
}

export interface CapabilityScore {
  fixtureCount: number;
  /** Share of expected claims the model produced. */
  recall: number;
  /**
   * Share of the model's claims, in scored namespaces only, that no fixture
   * asked for. Extra unrelated fields are not penalised.
   */
  falsePositiveRate: number;
  /** Share of fixtures that returned a parseable, schema-valid response. */
  schemaValidRate: number;
  latencyMsP50: number;
  costUsd: number | null;
  /** Per-fixture detail, so a regression can be traced to an input. */
  detail: FixtureDetail[];
}

export interface FixtureDetail {
  id: string;
  schemaValid: boolean;
  missing: string[];
  unexpected: string[];
}

/** Claims are compared case- and whitespace-insensitively. */
export function normaliseClaim(claim: string): string {
  return claim.trim().toLowerCase().replace(/\s+/g, " ");
}

function namespaceOf(claim: string): string {
  const index = claim.indexOf(":");
  return index === -1 ? "" : claim.slice(0, index);
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function scoreCapability(
  fixtures: Fixture[],
  outcomes: FixtureOutcome[]
): CapabilityScore {
  const byId = new Map(outcomes.map((o) => [o.id, o]));

  // Only namespaces the fixture set actually scores can produce a false positive.
  const scoredNamespaces = new Set(
    fixtures.flatMap((f) => f.expected.map((c) => namespaceOf(normaliseClaim(c))))
  );

  let expectedTotal = 0;
  let matchedTotal = 0;
  let claimedTotal = 0;
  let unexpectedTotal = 0;
  let schemaValidCount = 0;

  const detail: FixtureDetail[] = [];
  const latencies: number[] = [];
  let costTotal = 0;
  let sawCost = false;

  for (const fixture of fixtures) {
    const outcome = byId.get(fixture.id);
    const expected = fixture.expected.map(normaliseClaim);
    expectedTotal += expected.length;

    if (outcome) {
      latencies.push(outcome.latencyMs);
      if (typeof outcome.costUsd === "number") {
        costTotal += outcome.costUsd;
        sawCost = true;
      }
    }

    const schemaValid = Boolean(outcome && outcome.actual !== null);
    if (schemaValid) schemaValidCount += 1;

    const actual = schemaValid ? (outcome!.actual as string[]).map(normaliseClaim) : [];
    const actualSet = new Set(actual);

    const missing = expected.filter((claim) => !actualSet.has(claim));
    matchedTotal += expected.length - missing.length;

    const expectedSet = new Set(expected);
    const unexpected = actual.filter(
      (claim) => !expectedSet.has(claim) && scoredNamespaces.has(namespaceOf(claim))
    );
    claimedTotal += actual.filter((claim) =>
      scoredNamespaces.has(namespaceOf(claim))
    ).length;
    unexpectedTotal += unexpected.length;

    detail.push({ id: fixture.id, schemaValid, missing, unexpected });
  }

  return {
    fixtureCount: fixtures.length,
    recall: expectedTotal === 0 ? 1 : round4(matchedTotal / expectedTotal),
    falsePositiveRate: claimedTotal === 0 ? 0 : round4(unexpectedTotal / claimedTotal),
    schemaValidRate:
      fixtures.length === 0 ? 1 : round4(schemaValidCount / fixtures.length),
    latencyMsP50: Math.round(median(latencies)),
    costUsd: sawCost ? costTotal : null,
    detail,
  };
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * True when a candidate is good enough to replace the incumbent. Deliberately
 * strict: a cheaper model that corrects less often is still a downgrade.
 */
export function isPromotable(
  candidate: CapabilityScore,
  incumbent: CapabilityScore,
  options: { recallTolerance?: number } = {}
): boolean {
  const tolerance = options.recallTolerance ?? 0;
  if (candidate.fixtureCount === 0) return false;
  if (candidate.schemaValidRate < incumbent.schemaValidRate) return false;
  if (candidate.recall < incumbent.recall - tolerance) return false;
  if (candidate.falsePositiveRate > incumbent.falsePositiveRate) return false;
  return true;
}

/** Turn a task-extraction response into scored claims. */
export function claimsFromTaskExtraction(value: Record<string, unknown>): string[] {
  const claims: string[] = [];

  const priority = value.priority;
  if (typeof priority === "string" && priority) claims.push(`priority:${priority}`);

  for (const [field, key] of [
    ["space", "spaces"],
    ["asset", "assets"],
    ["theme", "themes"],
  ] as const) {
    const list = value[key];
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      const name =
        typeof entry === "string"
          ? entry
          : entry && typeof entry === "object" && "name" in entry
            ? String((entry as { name: unknown }).name ?? "")
            : "";
      if (name) claims.push(`${field}:${name}`);
    }
  }

  return claims;
}

/** Turn a plan extraction response into scored claims. */
export function claimsFromPlanExtraction(value: Record<string, unknown>): string[] {
  const spaces = value.spaces;
  if (!Array.isArray(spaces)) return [];
  return spaces
    .map((entry) =>
      entry && typeof entry === "object" && "name" in entry
        ? String((entry as { name: unknown }).name ?? "")
        : ""
    )
    .filter(Boolean)
    .map((name) => `space:${name}`);
}
