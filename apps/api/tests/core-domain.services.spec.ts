import { describe, expect, it, vi } from "vitest";

import { FranchisesService } from "../src/franchises/franchises.service.js";
import type { FranchisesRepository } from "../src/franchises/franchises.repository.js";
import { OrganizationsService } from "../src/organizations/organizations.service.js";
import type { OrganizationsRepository } from "../src/organizations/organizations.repository.js";
import { SubscriptionsService } from "../src/subscriptions/subscriptions.service.js";
import type { SubscriptionsRepository } from "../src/subscriptions/subscriptions.repository.js";

describe("Phase 2 domain services", () => {
  it("validates organization input before repository access", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      code: "DEMO",
    });
    const repository = { create } as unknown as OrganizationsRepository;
    const service = new OrganizationsService(repository);

    await service.create({
      code: "DEMO",
      legalName: "Demo SARL",
      displayName: "Demo",
      countryCode: "tn",
      timezone: "Africa/Tunis",
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ countryCode: "TN" }));
  });

  it("persists a validated franchise", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      organizationId: "10000000-0000-4000-8000-000000000002",
    });
    const service = new FranchisesService({
      create,
    } as unknown as FranchisesRepository);

    await service.create({
      organizationId: "10000000-0000-4000-8000-000000000002",
      code: "franchise-a",
      name: "Franchise A",
    });

    expect(create).toHaveBeenCalledOnce();
  });

  it("coerces subscription dates before repository access", async () => {
    const create = vi.fn().mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000001",
      planId: "10000000-0000-4000-8000-000000000002",
      status: "TRIALING",
    });
    const service = new SubscriptionsService({
      create,
    } as unknown as SubscriptionsRepository);

    await service.create({
      planId: "10000000-0000-4000-8000-000000000002",
      startsAt: "2026-07-26T12:00:00.000Z",
    });

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ startsAt: expect.any(Date) }));
  });
});
