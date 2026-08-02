import { NotificationChannel } from "@rabbehni/database";
import { describe, expect, it } from "vitest";

import { DevelopmentNotificationProvider } from "./notification-provider.js";

describe("Phase 7 notification provider abstraction", () => {
  const provider = new DevelopmentNotificationProvider();

  it("routes supported channels through a provider abstraction", async () => {
    const result = await provider.send({
      channel: NotificationChannel.IN_APP,
      recipient: "customer-id",
      body: "Hello",
    });
    expect(result).toMatchObject({
      provider: "rabbehni-in-app",
      delivered: true,
      response: { accepted: true },
    });
  });

  it("surfaces provider failures for persisted retry and DLQ handling", async () => {
    await expect(
      provider.send({
        channel: NotificationChannel.EMAIL,
        recipient: "force-failure@example.com",
        body: "Retry me",
      }),
    ).rejects.toThrow("SIMULATED_PROVIDER_FAILURE");
  });
});
