import type { TenantTransaction } from "@rabbehni/database";
import { describe, expect, it, vi } from "vitest";

import { appendTechnicalEvent } from "../src/common/events/append-technical-event.js";

describe("appendTechnicalEvent", () => {
  it("stores the tenant and correlation envelope in the caller transaction", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-id" });
    const transaction = {
      outboxEvent: { create },
    } as unknown as TenantTransaction;

    await appendTechnicalEvent(
      transaction,
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
      {
        type: "merchants.branch.created.v1",
        aggregateType: "branch",
        aggregateId: "10000000-0000-4000-8000-000000000003",
        payload: { merchantId: "10000000-0000-4000-8000-000000000004" },
      },
    );

    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: "10000000-0000-4000-8000-000000000001",
        correlationId: "10000000-0000-4000-8000-000000000002",
        eventType: "merchants.branch.created.v1",
      }),
    });
  });
});
