export type SegmentOperator =
  "EQ" | "NEQ" | "IN" | "NOT_IN" | "GT" | "GTE" | "LT" | "LTE" | "CONTAINS" | "EXISTS";

export interface SegmentCondition {
  readonly field: string;
  readonly operator: SegmentOperator;
  readonly value?: unknown;
}

export interface SegmentRuleGroup {
  readonly combinator: "AND" | "OR";
  readonly conditions: readonly (SegmentCondition | SegmentRuleGroup)[];
}

export type SegmentFacts = Readonly<Record<string, unknown>>;

function isGroup(value: SegmentCondition | SegmentRuleGroup): value is SegmentRuleGroup {
  return "combinator" in value;
}

function compare(actual: unknown, operator: SegmentOperator, expected: unknown): boolean {
  if (operator === "EXISTS") return actual !== null && actual !== undefined;
  if (operator === "EQ") return actual === expected;
  if (operator === "NEQ") return actual !== expected;
  if (operator === "IN") return Array.isArray(expected) && expected.includes(actual);
  if (operator === "NOT_IN") return Array.isArray(expected) && !expected.includes(actual);
  if (operator === "CONTAINS") {
    if (Array.isArray(actual)) return actual.includes(expected);
    return typeof actual === "string" && typeof expected === "string" && actual.includes(expected);
  }
  if (typeof actual !== "number" || typeof expected !== "number") return false;
  if (operator === "GT") return actual > expected;
  if (operator === "GTE") return actual >= expected;
  if (operator === "LT") return actual < expected;
  return actual <= expected;
}

export function evaluateSegmentRule(group: SegmentRuleGroup, facts: SegmentFacts): boolean {
  const results = group.conditions.map((condition) =>
    isGroup(condition)
      ? evaluateSegmentRule(condition, facts)
      : compare(facts[condition.field], condition.operator, condition.value),
  );
  return group.combinator === "AND" ? results.every(Boolean) : results.some(Boolean);
}

export function consentAllowsMarketing(
  consents: unknown,
  communicationPreferences: unknown,
): boolean {
  const consent = typeof consents === "object" && consents !== null ? consents : {};
  const preferences =
    typeof communicationPreferences === "object" && communicationPreferences !== null
      ? communicationPreferences
      : {};
  const consentRecord = consent as Readonly<Record<string, unknown>>;
  const preferenceRecord = preferences as Readonly<Record<string, unknown>>;
  return consentRecord.marketing !== false && preferenceRecord.marketing !== false;
}
