import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { TenantContextStore } from "../src/tenancy/tenant-context.store.js";
import { SubscriptionsService } from "../src/subscriptions/subscriptions.service.js";

describe("Phase 9 commercial service security", () => {
  const repository = {
    processWebhook: vi.fn(),
    getPaymentIntent: vi.fn(),
    confirmCheckout: vi.fn(),
  };
  const context = new TenantContextStore();
  const service = new SubscriptionsService(repository as never, context);
  const webhook = {
    tenantId: "5b9c7187-97f5-4e2c-b077-eaca57988d9b",
    eventId: "event-phase9-001",
    paymentIntentId: "7c25f243-89e7-4d8d-a591-342f07905588",
    outcome: "SUCCEEDED",
  };

  it("rejects unsigned sandbox webhooks", async () => {
    await expect(service.webhook(webhook, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects a webhook signed with a different secret", async () => {
    await expect(service.webhook(webhook, "0".repeat(64))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.processWebhook).not.toHaveBeenCalled();
  });

  it("produces a deterministic signature for the exact payload", () => {
    const first = service.signWebhook(webhook);
    const replay = service.signWebhook(webhook);
    const changed = service.signWebhook({ ...webhook, outcome: "FAILED" });
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(replay).toBe(first);
    expect(changed).not.toBe(first);
  });
});
