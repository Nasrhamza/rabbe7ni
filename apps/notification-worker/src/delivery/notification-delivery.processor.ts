import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject } from "@nestjs/common";
import {
  CampaignMetricType,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  type Prisma,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import type { Job } from "bullmq";
import { randomUUID } from "node:crypto";

import { DevelopmentNotificationProvider } from "./notification-provider.js";

export const NOTIFICATION_DELIVERY_QUEUE = "notification-delivery";
export const NOTIFICATION_DEAD_LETTER_QUEUE = "notification-dead-letter";

const terminalStatuses = [
  NotificationDeliveryStatus.SENT,
  NotificationDeliveryStatus.DELIVERED,
  NotificationDeliveryStatus.CANCELLED,
] as const;

@Processor(NOTIFICATION_DELIVERY_QUEUE, {
  concurrency: 10,
  limiter: { max: 100, duration: 1_000 },
})
export class NotificationDeliveryProcessor extends WorkerHost {
  constructor(
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
    @Inject(DevelopmentNotificationProvider)
    private readonly provider: DevelopmentNotificationProvider,
  ) {
    super();
  }

  async process(job: Job<{ tenantId: string; deliveryId: string }>) {
    const outcome = await this.transactions.run(job.data.tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${job.data.tenantId}:delivery:${job.data.deliveryId}`}))`;
      const delivery = await transaction.notificationDelivery.findUnique({
        where: { id: job.data.deliveryId },
        include: { customer: true },
      });
      if (!delivery) throw new Error("NOTIFICATION_DELIVERY_NOT_FOUND");
      if (terminalStatuses.includes(delivery.status as (typeof terminalStatuses)[number])) {
        return { duplicate: true, status: delivery.status };
      }
      const preference = await transaction.customerCommunicationPreference.findUnique({
        where: {
          tenantId_customerId_channel_category: {
            tenantId: job.data.tenantId,
            customerId: delivery.customerId,
            channel: delivery.channel,
            category: delivery.category,
          },
        },
      });
      const consents = this.jsonRecord(delivery.customer.consents);
      const legacyPreferences = this.jsonRecord(delivery.customer.communicationPreferences);
      if (
        preference?.optedIn === false ||
        (delivery.category === NotificationCategory.MARKETING &&
          (consents.marketing === false || legacyPreferences.marketing === false))
      ) {
        const cancelled = await transaction.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status: NotificationDeliveryStatus.CANCELLED,
            failureCode: "CONSENT_REVOKED",
            failureReason: "Customer consent or channel preference is not active",
          },
        });
        return { duplicate: false, status: cancelled.status };
      }
      if (delivery.scheduledAt > new Date()) {
        throw new Error("DELIVERY_NOT_DUE");
      }
      const attempt = delivery.attempts + 1;
      await transaction.notificationDelivery.update({
        where: { id: delivery.id },
        data: {
          status: NotificationDeliveryStatus.PROCESSING,
          processingAt: new Date(),
          attempts: attempt,
        },
      });
      try {
        const result = await this.provider.send({
          channel: delivery.channel,
          recipient: delivery.recipient ?? delivery.customerId,
          subject: delivery.renderedSubject,
          body: delivery.renderedBody,
        });
        const status = result.delivered
          ? NotificationDeliveryStatus.DELIVERED
          : NotificationDeliveryStatus.SENT;
        const now = new Date();
        const completed = await transaction.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status,
            provider: result.provider,
            providerMessageId: result.messageId,
            providerResponse: result.response as Prisma.InputJsonValue,
            sentAt: now,
            ...(result.delivered ? { deliveredAt: now } : {}),
          },
        });
        await transaction.notificationAttempt.create({
          data: {
            tenantId: job.data.tenantId,
            deliveryId: delivery.id,
            attempt,
            status,
            provider: result.provider,
            providerResponse: result.response as Prisma.InputJsonValue,
          },
        });
        if (delivery.channel === NotificationChannel.IN_APP) {
          await transaction.inAppNotification.upsert({
            where: {
              deliveryId_tenantId: { deliveryId: delivery.id, tenantId: job.data.tenantId },
            },
            update: {},
            create: {
              tenantId: job.data.tenantId,
              customerId: delivery.customerId,
              deliveryId: delivery.id,
              category: delivery.category,
              title: delivery.renderedSubject ?? "Rabbehni",
              body: delivery.renderedBody,
              ...(delivery.deepLink
                ? { deepLink: delivery.deepLink as Prisma.InputJsonValue }
                : {}),
            },
          });
        }
        await this.recordCampaignMetric(
          transaction,
          job.data.tenantId,
          delivery.campaignId,
          delivery.customerId,
          result.delivered ? CampaignMetricType.DELIVERED : CampaignMetricType.SENT,
          `${delivery.id}:${status}`,
        );
        await this.emit(
          transaction,
          job.data.tenantId,
          "marketing.notification.sent.v1",
          delivery.id,
          { status, provider: result.provider },
        );
        return { duplicate: false, status: completed.status };
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const deadLetter = attempt >= delivery.maxAttempts;
        const status = deadLetter
          ? NotificationDeliveryStatus.DEAD_LETTER
          : NotificationDeliveryStatus.FAILED;
        await transaction.notificationDelivery.update({
          where: { id: delivery.id },
          data: {
            status,
            failedAt: new Date(),
            ...(deadLetter ? { deadLetteredAt: new Date() } : {}),
            failureCode: deadLetter ? "MAX_ATTEMPTS_EXCEEDED" : "PROVIDER_FAILURE",
            failureReason: reason,
          },
        });
        await transaction.notificationAttempt.create({
          data: {
            tenantId: job.data.tenantId,
            deliveryId: delivery.id,
            attempt,
            status,
            provider: "development-provider",
            errorCode: deadLetter ? "MAX_ATTEMPTS_EXCEEDED" : "PROVIDER_FAILURE",
            errorMessage: reason,
          },
        });
        await this.recordCampaignMetric(
          transaction,
          job.data.tenantId,
          delivery.campaignId,
          delivery.customerId,
          CampaignMetricType.FAILED,
          `${delivery.id}:failed:${attempt}`,
        );
        await this.emit(
          transaction,
          job.data.tenantId,
          "marketing.notification.failed.v1",
          delivery.id,
          { reason, deadLetter, attempt },
        );
        return { failed: true as const, reason, deadLetter };
      }
    });
    if ("failed" in outcome && outcome.failed) {
      throw new Error(outcome.reason);
    }
    return outcome;
  }

  private jsonRecord(value: Prisma.JsonValue): Readonly<Record<string, unknown>> {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Readonly<Record<string, unknown>>)
      : {};
  }

  private async recordCampaignMetric(
    transaction: Parameters<Parameters<TenantTransactionService["run"]>[1]>[0],
    tenantId: string,
    campaignId: string | null,
    customerId: string,
    type: CampaignMetricType,
    eventId: string,
  ): Promise<void> {
    if (!campaignId) return;
    await transaction.campaignMetric.upsert({
      where: {
        tenantId_campaignId_type_eventId: { tenantId, campaignId, type, eventId },
      },
      update: {},
      create: { tenantId, campaignId, customerId, type, eventId },
    });
  }

  private async emit(
    transaction: Parameters<Parameters<TenantTransactionService["run"]>[1]>[0],
    tenantId: string,
    eventType: string,
    aggregateId: string,
    payload: Readonly<Record<string, unknown>>,
  ): Promise<void> {
    await transaction.outboxEvent.create({
      data: {
        tenantId,
        eventType,
        aggregateType: "notification_delivery",
        aggregateId,
        payload: payload as Prisma.InputJsonValue,
        correlationId: randomUUID(),
      },
    });
  }
}

@Processor(NOTIFICATION_DEAD_LETTER_QUEUE)
export class NotificationDeadLetterProcessor extends WorkerHost {
  constructor(
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {
    super();
  }

  process(job: Job<{ tenantId: string; deliveryId: string; reason: string }>) {
    return this.transactions.run(job.data.tenantId, (transaction) =>
      transaction.notificationDelivery.updateMany({
        where: {
          id: job.data.deliveryId,
          status: { not: NotificationDeliveryStatus.DELIVERED },
        },
        data: {
          status: NotificationDeliveryStatus.DEAD_LETTER,
          deadLetteredAt: new Date(),
          failureReason: job.data.reason,
        },
      }),
    );
  }
}
