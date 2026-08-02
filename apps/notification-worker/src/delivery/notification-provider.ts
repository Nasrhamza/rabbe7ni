import { Injectable } from "@nestjs/common";
import type { NotificationChannel } from "@rabbehni/database";
import { randomUUID } from "node:crypto";

export interface ProviderMessage {
  readonly channel: NotificationChannel;
  readonly recipient: string;
  readonly subject?: string | null;
  readonly body: string;
}

export interface ProviderResult {
  readonly provider: string;
  readonly messageId: string;
  readonly delivered: boolean;
  readonly response: Readonly<Record<string, unknown>>;
}

@Injectable()
export class DevelopmentNotificationProvider {
  async send(message: ProviderMessage): Promise<ProviderResult> {
    if (message.recipient.toLowerCase().includes("force-failure")) {
      throw new Error("SIMULATED_PROVIDER_FAILURE");
    }
    const provider = {
      EMAIL: "mailpit-local",
      IN_APP: "rabbehni-in-app",
      PUSH: "expo-push-sandbox",
      SMS: "rabbehni-sms-sandbox",
      WHATSAPP: "rabbehni-whatsapp-sandbox",
    }[message.channel];
    const messageId = randomUUID();
    return {
      provider,
      messageId,
      delivered: message.channel === "IN_APP",
      response: {
        accepted: true,
        channel: message.channel,
        environment: message.channel === "IN_APP" ? "internal" : "sandbox",
        messageId,
        provider,
        providerStatus: message.channel === "IN_APP" ? "delivered" : "accepted",
        queuedAt: new Date().toISOString(),
        recipient: this.mask(message.recipient),
      },
    };
  }

  private mask(recipient: string): string {
    if (recipient.includes("@")) {
      const [name = "", domain = ""] = recipient.split("@");
      return `${name.slice(0, 2)}***@${domain}`;
    }
    if (recipient.length > 7) return `${recipient.slice(0, 3)}***${recipient.slice(-3)}`;
    return `${recipient.slice(0, 2)}***`;
  }
}
