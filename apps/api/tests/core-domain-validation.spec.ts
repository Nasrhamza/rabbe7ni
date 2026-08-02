import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { parseDto } from "../src/common/validation.js";
import { inviteStaffSchema } from "../src/staff/dto.js";
import { createOrganizationSchema } from "../src/organizations/dto.js";
import { createSubscriptionSchema } from "../src/subscriptions/dto.js";

describe("Phase 2 DTO validation", () => {
  it("normalizes country codes", () => {
    const result = parseDto(createOrganizationSchema, {
      code: "demo",
      legalName: "Demo SARL",
      displayName: "Demo",
      countryCode: "tn",
      timezone: "Africa/Tunis",
    });

    expect(result.countryCode).toBe("TN");
  });

  it("requires a merchant whenever a branch scopes a staff assignment", () => {
    expect(() =>
      parseDto(inviteStaffSchema, {
        email: "staff@example.com",
        displayName: "Staff",
        organizationId: "10000000-0000-4000-8000-000000000001",
        roleIds: ["10000000-0000-4000-8000-000000000004"],
        branchId: "10000000-0000-4000-8000-000000000003",
      }),
    ).toThrow(BadRequestException);
  });

  it("rejects a subscription period ending before it starts", () => {
    expect(() =>
      parseDto(createSubscriptionSchema, {
        planId: "10000000-0000-4000-8000-000000000001",
        startsAt: "2026-07-26T12:00:00.000Z",
        currentPeriodEndsAt: "2026-07-25T12:00:00.000Z",
      }),
    ).toThrow(BadRequestException);
  });
});
