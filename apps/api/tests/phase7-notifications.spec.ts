import { describe, expect, it } from "vitest";

import { isWithinQuietHours, nextAllowedDelivery } from "../src/notifications/quiet-hours.js";
import { renderSafeTemplate, templateVariables } from "../src/notifications/template-renderer.js";

describe("Phase 7 notification safety and quiet hours", () => {
  it("renders declared scalar variables and escapes HTML", () => {
    expect(
      renderSafeTemplate("Bonjour {{name}}, solde: {{points}}", {
        name: "<Admin>",
        points: 420,
      }),
    ).toBe("Bonjour &lt;Admin&gt;, solde: 420");
    expect(templateVariables("{{name}} / {{ points }} / {{name}}")).toEqual(["name", "points"]);
  });

  it("rejects missing or unsafe complex template variables", () => {
    expect(() => renderSafeTemplate("Bonjour {{name}}", {})).toThrow(
      "Missing template variable: name",
    );
    expect(() => renderSafeTemplate("{{payload}}", { payload: { admin: true } })).toThrow(
      "Unsafe template variable type: payload",
    );
  });

  it("handles cross-midnight quiet hours in the customer timezone", () => {
    const quiet = { start: "22:00", end: "08:00", timezone: "Europe/Paris" };
    const duringQuietHours = new Date("2026-07-27T21:30:00.000Z");
    expect(isWithinQuietHours(duringQuietHours, quiet)).toBe(true);
    const allowed = nextAllowedDelivery(duringQuietHours, quiet);
    expect(isWithinQuietHours(allowed, quiet)).toBe(false);
    expect(allowed.getTime()).toBeGreaterThan(duringQuietHours.getTime());
    expect(isWithinQuietHours(new Date("2026-07-27T10:00:00.000Z"), quiet)).toBe(false);
  });
});
