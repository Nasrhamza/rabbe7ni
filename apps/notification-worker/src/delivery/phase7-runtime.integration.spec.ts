import {
  AutomationExecutionStatus,
  AutomationStatus,
  AutomationStepType,
  AutomationType,
  createPrismaClient,
  MarketingStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTemplateStatus,
  SegmentMembershipAction,
  SegmentType,
  TenantTransactionManager,
} from "@rabbehni/database";
import type { Job } from "bullmq";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { NotificationDeliveryProcessor } from "./notification-delivery.processor.js";
import { DevelopmentNotificationProvider } from "./notification-provider.js";

const connectionString = process.env.TEST_DATABASE_URL;
const integrationSuite = connectionString ? describe : describe.skip;

integrationSuite("Phase 7 PostgreSQL delivery and tenant runtime", () => {
  const prisma = createPrismaClient(
    connectionString ?? "postgresql://unused:unused@127.0.0.1:1/unused",
  );
  const transactions = new TenantTransactionManager(prisma);
  const processor = new NotificationDeliveryProcessor(
    transactions as never,
    new DevelopmentNotificationProvider(),
  );
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const organizationId = randomUUID();
  const customerId = randomUUID();
  const optedOutCustomerId = randomUUID();
  const segmentId = randomUUID();
  const workflowId = randomUUID();
  const stepId = randomUUID();
  const templateId = randomUUID();
  const templateVersionId = randomUUID();
  const inAppTemplateId = randomUUID();
  const inAppTemplateVersionId = randomUUID();
  const failedDeliveryId = randomUUID();
  const optedOutDeliveryId = randomUUID();
  const inAppDeliveryId = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    await transactions.run(tenantA, async (transaction) => {
      await transaction.tenant.create({
        data: { id: tenantA, slug: `phase7-a-${tenantA}`, region: "TEST", status: "ACTIVE" },
      });
      await transaction.organization.create({
        data: {
          id: organizationId,
          tenantId: tenantA,
          code: `P7-${tenantA.slice(0, 8)}`,
          legalName: "Phase 7 Runtime",
          displayName: "Phase 7 Runtime",
          countryCode: "FR",
          timezone: "Europe/Paris",
          status: "ACTIVE",
        },
      });
      await transaction.customer.createMany({
        data: [
          {
            id: customerId,
            tenantId: tenantA,
            organizationId,
            displayName: "Provider Failure",
            email: "force-failure@example.com",
            status: "ACTIVE",
            consents: { marketing: true },
          },
          {
            id: optedOutCustomerId,
            tenantId: tenantA,
            organizationId,
            displayName: "Opted Out",
            email: "customer@example.com",
            status: "ACTIVE",
            consents: { marketing: false },
          },
        ],
      });
      await transaction.customerSegment.create({
        data: {
          id: segmentId,
          tenantId: tenantA,
          organizationId,
          code: `P7-SEG-${tenantA.slice(0, 8)}`,
          name: "Runtime segment",
          type: SegmentType.DYNAMIC,
          status: MarketingStatus.ACTIVE,
          rules: { combinator: "AND", conditions: [] },
        },
      });
      await transaction.segmentMembership.create({
        data: { tenantId: tenantA, segmentId, customerId, source: "RULE" },
      });
      await transaction.segmentMembershipHistory.create({
        data: {
          tenantId: tenantA,
          segmentId,
          customerId,
          action: SegmentMembershipAction.JOINED,
          reason: "RUNTIME_TEST",
        },
      });
      await transaction.automationWorkflow.create({
        data: {
          id: workflowId,
          tenantId: tenantA,
          organizationId,
          code: `P7-WF-${tenantA.slice(0, 8)}`,
          name: "Runtime workflow",
          type: AutomationType.EVENT_TRIGGERED,
          status: AutomationStatus.ACTIVE,
          triggerType: "phase7.runtime",
        },
      });
      await transaction.automationStep.create({
        data: {
          id: stepId,
          tenantId: tenantA,
          workflowId,
          code: "EXIT",
          name: "Exit",
          position: 1,
          type: AutomationStepType.EXIT,
        },
      });
      await transaction.notificationTemplate.create({
        data: {
          id: templateId,
          tenantId: tenantA,
          organizationId,
          code: `P7-TPL-${tenantA.slice(0, 8)}`,
          name: "Runtime template",
          channel: NotificationChannel.EMAIL,
          category: NotificationCategory.MARKETING,
          status: NotificationTemplateStatus.ACTIVE,
        },
      });
      await transaction.notificationTemplateVersion.create({
        data: {
          id: templateVersionId,
          tenantId: tenantA,
          templateId,
          version: 1,
          locale: "fr",
          subject: "Runtime",
          body: "Runtime body",
        },
      });
      await transaction.notificationTemplate.create({
        data: {
          id: inAppTemplateId,
          tenantId: tenantA,
          organizationId,
          code: `P7-INAPP-${tenantA.slice(0, 8)}`,
          name: "Runtime in-app template",
          channel: NotificationChannel.IN_APP,
          category: NotificationCategory.SYSTEM,
          status: NotificationTemplateStatus.ACTIVE,
        },
      });
      await transaction.notificationTemplateVersion.create({
        data: {
          id: inAppTemplateVersionId,
          tenantId: tenantA,
          templateId: inAppTemplateId,
          version: 1,
          locale: "fr",
          subject: "In-app runtime",
          body: "Delivered once",
        },
      });
      await transaction.notificationDelivery.createMany({
        data: [
          {
            id: failedDeliveryId,
            tenantId: tenantA,
            customerId,
            templateId,
            templateVersionId,
            channel: NotificationChannel.EMAIL,
            category: NotificationCategory.MARKETING,
            idempotencyKey: `failure:${failedDeliveryId}`,
            recipient: "force-failure@example.com",
            locale: "fr",
            renderedBody: "Runtime body",
          },
          {
            id: optedOutDeliveryId,
            tenantId: tenantA,
            customerId: optedOutCustomerId,
            templateId,
            templateVersionId,
            channel: NotificationChannel.EMAIL,
            category: NotificationCategory.MARKETING,
            idempotencyKey: `optout:${optedOutDeliveryId}`,
            recipient: "customer@example.com",
            locale: "fr",
            renderedBody: "Must not send",
          },
          {
            id: inAppDeliveryId,
            tenantId: tenantA,
            customerId,
            templateId: inAppTemplateId,
            templateVersionId: inAppTemplateVersionId,
            channel: NotificationChannel.IN_APP,
            category: NotificationCategory.SYSTEM,
            idempotencyKey: `in-app:${inAppDeliveryId}`,
            recipient: customerId,
            locale: "fr",
            renderedSubject: "In-app runtime",
            renderedBody: "Delivered once",
            deepLink: { screen: "rewards", rewardId: "runtime" },
          },
        ],
      });
    });
    await transactions.run(tenantB, (transaction) =>
      transaction.tenant.create({
        data: { id: tenantB, slug: `phase7-b-${tenantB}`, region: "TEST", status: "ACTIVE" },
      }),
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("commits provider failures before BullMQ retries and reaches DLQ exactly", async () => {
    const job = { data: { tenantId: tenantA, deliveryId: failedDeliveryId } } as Job<{
      tenantId: string;
      deliveryId: string;
    }>;
    await expect(processor.process(job)).rejects.toThrow("SIMULATED_PROVIDER_FAILURE");
    const failed = await transactions.run(tenantA, (transaction) =>
      transaction.notificationDelivery.findUniqueOrThrow({
        where: { id: failedDeliveryId },
        include: { attemptsHistory: true },
      }),
    );
    expect(failed).toMatchObject({
      status: NotificationDeliveryStatus.FAILED,
      attempts: 1,
    });
    expect(failed.attemptsHistory).toHaveLength(1);

    await transactions.run(tenantA, (transaction) =>
      transaction.notificationDelivery.update({
        where: { id: failedDeliveryId },
        data: { status: NotificationDeliveryStatus.QUEUED, attempts: 4 },
      }),
    );
    await expect(processor.process(job)).rejects.toThrow("SIMULATED_PROVIDER_FAILURE");
    const deadLetter = await transactions.run(tenantA, (transaction) =>
      transaction.notificationDelivery.findUniqueOrThrow({
        where: { id: failedDeliveryId },
        include: { attemptsHistory: true },
      }),
    );
    expect(deadLetter).toMatchObject({
      status: NotificationDeliveryStatus.DEAD_LETTER,
      attempts: 5,
      failureCode: "MAX_ATTEMPTS_EXCEEDED",
    });
    expect(deadLetter.attemptsHistory.map(({ attempt }) => attempt)).toEqual([1, 5]);
  });

  it("rechecks consent immediately before provider delivery", async () => {
    const result = await processor.process({
      data: { tenantId: tenantA, deliveryId: optedOutDeliveryId },
    } as Job<{ tenantId: string; deliveryId: string }>);
    expect(result).toMatchObject({ status: NotificationDeliveryStatus.CANCELLED });
    const delivery = await transactions.run(tenantA, (transaction) =>
      transaction.notificationDelivery.findUniqueOrThrow({
        where: { id: optedOutDeliveryId },
        include: { attemptsHistory: true },
      }),
    );
    expect(delivery.failureCode).toBe("CONSENT_REVOKED");
    expect(delivery.attemptsHistory).toHaveLength(0);
  });

  it("prevents duplicate sends and duplicate in-app inbox records on replay", async () => {
    const job = {
      data: { tenantId: tenantA, deliveryId: inAppDeliveryId },
    } as Job<{ tenantId: string; deliveryId: string }>;
    const first = await processor.process(job);
    const replay = await processor.process(job);
    expect(first).toMatchObject({
      duplicate: false,
      status: NotificationDeliveryStatus.DELIVERED,
    });
    expect(replay).toMatchObject({
      duplicate: true,
      status: NotificationDeliveryStatus.DELIVERED,
    });
    const [attempts, inbox] = await transactions.run(tenantA, (transaction) =>
      Promise.all([
        transaction.notificationAttempt.count({ where: { deliveryId: inAppDeliveryId } }),
        transaction.inAppNotification.count({ where: { deliveryId: inAppDeliveryId } }),
      ]),
    );
    expect(attempts).toBe(1);
    expect(inbox).toBe(1);
  });

  it("enforces workflow idempotency under concurrent inserts", async () => {
    const eventId = randomUUID();
    const create = () =>
      transactions.run(tenantA, (transaction) =>
        transaction.automationExecution.create({
          data: {
            tenantId: tenantA,
            workflowId,
            customerId,
            eventId,
            idempotencyKey: `event:${eventId}`,
            status: AutomationExecutionStatus.RUNNING,
            currentStepId: stepId,
          },
        }),
      );
    const results = await Promise.allSettled([create(), create()]);
    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(
      await transactions.run(tenantA, (transaction) =>
        transaction.automationExecution.count({ where: { idempotencyKey: `event:${eventId}` } }),
      ),
    ).toBe(1);
  });

  it("hides every Phase 7 row from another tenant and keeps history append-only", async () => {
    const invisible = await transactions.run(tenantB, (transaction) =>
      Promise.all([
        transaction.customerSegment.findMany(),
        transaction.segmentMembership.findMany(),
        transaction.automationWorkflow.findMany(),
        transaction.notificationDelivery.findMany(),
        transaction.notificationAttempt.findMany(),
      ]),
    );
    expect(invisible.every((rows) => rows.length === 0)).toBe(true);

    const history = await transactions.run(tenantA, (transaction) =>
      transaction.segmentMembershipHistory.findFirstOrThrow({ where: { segmentId } }),
    );
    await expect(
      transactions.run(tenantA, (transaction) =>
        transaction.segmentMembershipHistory.update({
          where: { id: history.id },
          data: { reason: "TAMPERED" },
        }),
      ),
    ).rejects.toThrow("append-only");
  });
});
