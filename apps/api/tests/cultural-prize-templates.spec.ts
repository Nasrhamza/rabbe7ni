import { describe, expect, it } from "vitest";

import { suggestPrizeTemplates } from "../src/games/cultural-prize-templates.js";

describe("cultural prize templates", () => {
  it("falls back to the neutral template when no reward style is known", () => {
    const template = suggestPrizeTemplates(undefined);
    expect(template.length).toBeGreaterThan(0);
    expect(template.some((prize) => prize.type === "REWARD")).toBe(false);
  });

  it("falls back to the neutral template for an unrecognized reward style", () => {
    expect(suggestPrizeTemplates("unrecognized-style")).toEqual(suggestPrizeTemplates(undefined));
  });

  it("gives a hospitality-styled region real reward and discount slots", () => {
    const template = suggestPrizeTemplates("premium-and-hospitality");
    expect(template.some((prize) => prize.type === "REWARD")).toBe(true);
    expect(template.some((prize) => prize.type === "DISCOUNT")).toBe(true);
  });

  it("keeps a family-and-value region points-led with no reward or discount slots", () => {
    const template = suggestPrizeTemplates("family-and-value");
    expect(template.every((prize) => prize.type === "POINTS" || prize.type === "TRY_AGAIN")).toBe(
      true,
    );
  });

  it("differs in probability shape between reward styles, not just labels", () => {
    const family = suggestPrizeTemplates("family-and-value");
    const hospitality = suggestPrizeTemplates("premium-and-hospitality");
    const familyTryAgainShare = family.find(
      (prize) => prize.type === "TRY_AGAIN",
    )?.probabilityWeight;
    const hospitalityTryAgainShare = hospitality.find(
      (prize) => prize.type === "TRY_AGAIN",
    )?.probabilityWeight;
    expect(familyTryAgainShare).not.toBe(hospitalityTryAgainShare);
  });

  it("keeps every template's probability weights positive and summing above zero", () => {
    for (const style of [
      undefined,
      "family-and-value",
      "premium-and-hospitality",
      "premium-and-sustainable",
    ]) {
      const template = suggestPrizeTemplates(style);
      const total = template.reduce((sum, prize) => sum + prize.probabilityWeight, 0);
      expect(total).toBeGreaterThan(0);
      expect(template.every((prize) => prize.probabilityWeight > 0)).toBe(true);
    }
  });
});
