import { describe, expect, it } from "vitest";

import {
  consentAllowsMarketing,
  evaluateSegmentRule,
  type SegmentRuleGroup,
} from "../src/segments/rule-engine.js";

describe("Phase 7 segmentation rules", () => {
  it("evaluates nested AND/OR rules across loyalty, activity and gamification facts", () => {
    const rule: SegmentRuleGroup = {
      combinator: "AND",
      conditions: [
        { field: "status", operator: "EQ", value: "ACTIVE" },
        {
          combinator: "OR",
          conditions: [
            { field: "pointsBalance", operator: "GTE", value: 500 },
            { field: "currentStreak", operator: "GT", value: 5 },
          ],
        },
        { field: "badges", operator: "CONTAINS", value: "ambassador" },
      ],
    };

    expect(
      evaluateSegmentRule(rule, {
        status: "ACTIVE",
        pointsBalance: 200,
        currentStreak: 8,
        badges: ["ambassador", "early-adopter"],
      }),
    ).toBe(true);
    expect(
      evaluateSegmentRule(rule, {
        status: "ACTIVE",
        pointsBalance: 200,
        currentStreak: 2,
        badges: ["ambassador"],
      }),
    ).toBe(false);
  });

  it("supports collection and existence operators deterministically", () => {
    expect(
      evaluateSegmentRule(
        {
          combinator: "AND",
          conditions: [
            { field: "locale", operator: "IN", value: ["fr", "ar"] },
            { field: "lastVisitAt", operator: "EXISTS" },
            { field: "rewardRedemptions", operator: "LTE", value: 3 },
          ],
        },
        { locale: "ar", lastVisitAt: "2026-07-26", rewardRedemptions: 2 },
      ),
    ).toBe(true);
  });

  it("excludes explicit marketing opt-outs", () => {
    expect(consentAllowsMarketing({ marketing: true }, { marketing: true })).toBe(true);
    expect(consentAllowsMarketing({ marketing: false }, { marketing: true })).toBe(false);
    expect(consentAllowsMarketing({ marketing: true }, { marketing: false })).toBe(false);
  });
});
