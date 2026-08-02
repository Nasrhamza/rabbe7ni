import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CampaignMetricType,
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTemplateStatus,
  type Prisma,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { consentAllowsMarketing } from "../segments/rule-engine.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { DeliveryList, QueueNotification } from "./dto.js";
import { nextAllowedDelivery } from "./quiet-hours.js";
import { renderSafeTemplate, templateVariables } from "./template-renderer.js";

type TemplateInput = {
  organizationId: string;
  code: string;
  name: string;
  channel: NotificationChannel;
  category: NotificationCategory;
  status: NotificationTemplateStatus;
  branding: Readonly<Record<string, unknown>>;
  locale: string;
  subject?: string | undefined;
  body: string;
  metadata: Readonly<Record<string, unknown>>;
};

@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  templates(input: {
    page: number;
    pageSize: number;
    search?: string | undefined;
    channel?: NotificationChannel | undefined;
    category?: NotificationCategory | undefined;
    status?: NotificationTemplateStatus | undefined;
    sortDirection: "asc" | "desc";
  }) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { code: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.notificationTemplate.findMany({
          where,
          ...pageWindow(input),
          orderBy: { createdAt: input.sortDirection },
          include: {
            versions: { orderBy: [{ version: "desc" }, { locale: "asc" }], take: 20 },
          },
        }),
        transaction.notificationTemplate.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  template(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const template = await transaction.notificationTemplate.findUnique({
        where: { id },
        include: {
          versions: { orderBy: [{ version: "desc" }, { locale: "asc" }] },
        },
      });
      return template && this.context.canAccessOrganization(template.organizationId)
        ? template
        : null;
    });
  }

  createTemplate(input: TemplateInput) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    const variables = templateVariables(`${input.subject ?? ""}\n${input.body}`);
    return this.transactions.run(tenantId, async (transaction) => {
      try {
        const created = await transaction.notificationTemplate.create({
          data: {
            tenantId,
            organizationId: input.organizationId,
            code: input.code,
            name: input.name,
            channel: input.channel,
            category: input.category,
            status: input.status,
            branding: input.branding as Prisma.InputJsonValue,
          } as Prisma.NotificationTemplateUncheckedCreateInput,
        });
        await transaction.notificationTemplateVersion.create({
          data: {
            tenantId,
            templateId: created.id,
            version: 1,
            locale: input.locale,
            body: input.body,
            variables: variables as unknown as Prisma.InputJsonValue,
            metadata: input.metadata as Prisma.InputJsonValue,
            ...(input.subject ? { subject: input.subject } : {}),
            ...(request.actorId ? { createdById: request.actorId } : {}),
          },
        });
        const template = await transaction.notificationTemplate.findUniqueOrThrow({
          where: { id: created.id },
          include: { versions: true },
        });
        await appendDomainChange(transaction, tenantId, request, {
          action: "notification.template.create",
          eventType: "marketing.notification-template.created.v1",
          entityType: "notification_template",
          entityId: template.id,
          payload: { channel: template.channel, category: template.category },
        });
        return template;
      } catch (error) {
        if (this.isUniqueViolation(error)) {
          throw new ConflictException("Template code already exists for this channel");
        }
        throw error;
      }
    });
  }

  addVersion(
    templateId: string,
    input: {
      locale: string;
      subject?: string | undefined;
      body: string;
      metadata: Readonly<Record<string, unknown>>;
    },
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:template:${templateId}`}))`;
      const template = await transaction.notificationTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template || !this.context.canAccessOrganization(template.organizationId)) return null;
      const latest = await transaction.notificationTemplateVersion.aggregate({
        where: { templateId },
        _max: { version: true },
      });
      const version = (latest._max.version ?? 0) + 1;
      const variables = templateVariables(`${input.subject ?? ""}\n${input.body}`);
      const created = await transaction.notificationTemplateVersion.create({
        data: {
          tenantId,
          templateId,
          version,
          locale: input.locale,
          body: input.body,
          variables: variables as unknown as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue,
          ...(input.subject ? { subject: input.subject } : {}),
          ...(request.actorId ? { createdById: request.actorId } : {}),
        },
      });
      await transaction.notificationTemplate.update({
        where: { id: templateId },
        data: { currentVersion: version },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "notification.template.version",
        eventType: "marketing.notification-template.versioned.v1",
        entityType: "notification_template",
        entityId: templateId,
        payload: { version, locale: input.locale },
      });
      return created;
    });
  }

  render(templateId: string, locale: string, variables: Readonly<Record<string, unknown>>) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const template = await transaction.notificationTemplate.findUnique({
        where: { id: templateId },
      });
      if (!template || !this.context.canAccessOrganization(template.organizationId)) return null;
      const version = await transaction.notificationTemplateVersion.findFirst({
        where: { templateId, version: template.currentVersion, locale },
      });
      const fallback =
        version ??
        (await transaction.notificationTemplateVersion.findFirst({
          where: { templateId, version: template.currentVersion },
          orderBy: { locale: "asc" },
        }));
      if (!fallback) throw new BadRequestException("Template has no renderable version");
      return {
        template,
        version: fallback,
        subject: fallback.subject ? renderSafeTemplate(fallback.subject, variables) : null,
        body: renderSafeTemplate(fallback.body, variables),
      };
    });
  }

  queue(input: QueueNotification) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tenantId}:notification:${input.idempotencyKey}`}))`;
      const existing = await transaction.notificationDelivery.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey } },
      });
      if (existing) return { delivery: existing, duplicate: true };
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundException("Customer not found");
      const template = await transaction.notificationTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (
        !template ||
        template.organizationId !== customer.organizationId ||
        template.status !== NotificationTemplateStatus.ACTIVE
      ) {
        throw new BadRequestException("Active template not found for customer organization");
      }
      if (
        template.category === NotificationCategory.MARKETING &&
        !consentAllowsMarketing(customer.consents, customer.communicationPreferences)
      ) {
        throw new BadRequestException("Customer marketing consent is not active");
      }
      const preference = await transaction.customerCommunicationPreference.findUnique({
        where: {
          tenantId_customerId_channel_category: {
            tenantId,
            customerId: customer.id,
            channel: template.channel,
            category: template.category,
          },
        },
      });
      if (preference && !preference.optedIn) {
        throw new BadRequestException("Customer opted out from this channel or category");
      }
      const locale = input.locale ?? customer.locale;
      const version =
        (await transaction.notificationTemplateVersion.findFirst({
          where: { templateId: template.id, version: template.currentVersion, locale },
        })) ??
        (await transaction.notificationTemplateVersion.findFirst({
          where: { templateId: template.id, version: template.currentVersion },
          orderBy: { locale: "asc" },
        }));
      if (!version) throw new BadRequestException("Template has no active version");
      const now = input.scheduledAt ?? new Date();
      const scheduledAt = preference
        ? nextAllowedDelivery(now, {
            start: preference.quietHoursStart,
            end: preference.quietHoursEnd,
            timezone: preference.timezone,
          })
        : now;
      await this.assertQuota(transaction, tenantId);
      if (input.campaignId) {
        await this.assertCampaignFrequency(
          transaction,
          tenantId,
          input.campaignId,
          customer.id,
          scheduledAt,
        );
      }
      const delivery = await transaction.notificationDelivery.create({
        data: {
          tenantId,
          customerId: customer.id,
          templateId: template.id,
          templateVersionId: version.id,
          channel: template.channel,
          category: template.category,
          idempotencyKey: input.idempotencyKey,
          recipient: this.recipientFor(template.channel, customer),
          locale,
          renderedSubject: version.subject
            ? renderSafeTemplate(version.subject, input.variables)
            : null,
          renderedBody: renderSafeTemplate(version.body, input.variables),
          variables: input.variables as Prisma.InputJsonValue,
          scheduledAt,
          ...(input.deepLink ? { deepLink: input.deepLink as Prisma.InputJsonValue } : {}),
          ...(input.campaignId ? { campaignId: input.campaignId } : {}),
          ...(input.automationExecutionId
            ? { automationExecutionId: input.automationExecutionId }
            : {}),
        },
      });
      if (input.campaignId) {
        await transaction.campaignMetric.create({
          data: {
            tenantId,
            campaignId: input.campaignId,
            customerId: customer.id,
            type: CampaignMetricType.QUEUED,
            eventId: delivery.id,
          },
        });
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: "notification.queue",
        eventType: "marketing.notification.queued.v1",
        entityType: "notification_delivery",
        entityId: delivery.id,
        payload: { channel: delivery.channel, scheduledAt: delivery.scheduledAt.toISOString() },
      });
      return { delivery, duplicate: false };
    });
  }

  deliveries(input: DeliveryList) {
    const tenantId = this.context.tenantId();
    const where = {
      tenantId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.notificationDelivery.findMany({
          where,
          ...pageWindow(input),
          orderBy: { createdAt: input.sortDirection },
          include: {
            customer: { select: { id: true, displayName: true, email: true, phone: true } },
            attemptsHistory: { orderBy: { attempt: "desc" }, take: 10 },
          },
        }),
        transaction.notificationDelivery.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  delivery(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.notificationDelivery.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, displayName: true, email: true, phone: true } },
          attemptsHistory: { orderBy: { attempt: "desc" } },
          template: { select: { id: true, code: true, name: true } },
          campaign: { select: { id: true, code: true, name: true } },
        },
      }),
    );
  }

  prepareRetry(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const delivery = await transaction.notificationDelivery.findUnique({ where: { id } });
      if (!delivery) return null;
      if (
        delivery.status !== NotificationDeliveryStatus.FAILED &&
        delivery.status !== NotificationDeliveryStatus.BOUNCED &&
        delivery.status !== NotificationDeliveryStatus.DEAD_LETTER
      ) {
        throw new BadRequestException("Only failed, bounced or dead-letter deliveries can retry");
      }
      return transaction.notificationDelivery.update({
        where: { id },
        data: {
          status: NotificationDeliveryStatus.QUEUED,
          scheduledAt: new Date(),
          failureCode: null,
          failureReason: null,
          failedAt: null,
          deadLetteredAt: null,
        },
      });
    });
  }

  inbox(
    customerId: string,
    input: {
      page: number;
      pageSize: number;
      unreadOnly?: boolean | undefined;
      sortDirection: "asc" | "desc";
    },
  ) {
    const tenantId = this.context.tenantId();
    const now = new Date();
    const where = {
      tenantId,
      customerId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      ...(input.unreadOnly ? { readAt: null } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total, unread] = await Promise.all([
        transaction.inAppNotification.findMany({
          where,
          ...pageWindow(input),
          orderBy: { createdAt: input.sortDirection },
        }),
        transaction.inAppNotification.count({ where }),
        transaction.inAppNotification.count({
          where: {
            tenantId,
            customerId,
            readAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
        }),
      ]);
      return { ...pageResult(items, total, input), unread };
    });
  }

  markRead(customerId: string, id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const notification = await transaction.inAppNotification.findUnique({ where: { id } });
      if (!notification || notification.customerId !== customerId) return null;
      return transaction.inAppNotification.update({
        where: { id },
        data: { readAt: notification.readAt ?? new Date() },
      });
    });
  }

  markAllRead(customerId: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.inAppNotification.updateMany({
        where: { customerId, readAt: null },
        data: { readAt: new Date() },
      }),
    );
  }

  preferences(customerId: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.customerCommunicationPreference.findMany({
        where: { customerId },
        orderBy: [{ category: "asc" }, { channel: "asc" }],
      }),
    );
  }

  upsertPreference(input: {
    customerId: string;
    channel: NotificationChannel;
    category: NotificationCategory;
    optedIn: boolean;
    quietHoursStart?: string | undefined;
    quietHoursEnd?: string | undefined;
    timezone: string;
    consentSource?: string | undefined;
  }) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone }).format();
    } catch {
      throw new BadRequestException("Invalid IANA timezone");
    }
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new NotFoundException("Customer not found");
      return transaction.customerCommunicationPreference.upsert({
        where: {
          tenantId_customerId_channel_category: {
            tenantId,
            customerId: input.customerId,
            channel: input.channel,
            category: input.category,
          },
        },
        update: {
          customerId: input.customerId,
          channel: input.channel,
          category: input.category,
          optedIn: input.optedIn,
          timezone: input.timezone,
          consentUpdatedAt: new Date(),
          ...(input.quietHoursStart ? { quietHoursStart: input.quietHoursStart } : {}),
          ...(input.quietHoursEnd ? { quietHoursEnd: input.quietHoursEnd } : {}),
          ...(input.consentSource ? { consentSource: input.consentSource } : {}),
        },
        create: {
          tenantId,
          customerId: input.customerId,
          channel: input.channel,
          category: input.category,
          optedIn: input.optedIn,
          timezone: input.timezone,
          ...(input.quietHoursStart ? { quietHoursStart: input.quietHoursStart } : {}),
          ...(input.quietHoursEnd ? { quietHoursEnd: input.quietHoursEnd } : {}),
          ...(input.consentSource ? { consentSource: input.consentSource } : {}),
        },
      });
    });
  }

  private recipientFor(
    channel: NotificationChannel,
    customer: { email: string | null; phone: string | null; id: string },
  ): string {
    if (channel === NotificationChannel.EMAIL) {
      if (!customer.email) throw new BadRequestException("Customer has no email address");
      return customer.email;
    }
    if (channel === NotificationChannel.SMS || channel === NotificationChannel.WHATSAPP) {
      if (!customer.phone) throw new BadRequestException("Customer has no phone number");
      return customer.phone;
    }
    return customer.id;
  }

  private async assertQuota(
    transaction: Parameters<Parameters<TenantTransactionService["run"]>[1]>[0],
    tenantId: string,
  ): Promise<void> {
    const setting = await transaction.tenantSetting.findUnique({
      where: {
        tenantId_namespace_key: {
          tenantId,
          namespace: "notifications",
          key: "daily_quota",
        },
      },
    });
    const value =
      typeof setting?.value === "number"
        ? setting.value
        : typeof setting?.value === "object" &&
            setting.value !== null &&
            "value" in setting.value &&
            typeof setting.value.value === "number"
          ? setting.value.value
          : 10_000;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const used = await transaction.notificationDelivery.count({
      where: { tenantId, createdAt: { gte: since } },
    });
    if (used >= value) throw new BadRequestException("Tenant daily notification quota exceeded");
  }

  private async assertCampaignFrequency(
    transaction: Parameters<Parameters<TenantTransactionService["run"]>[1]>[0],
    tenantId: string,
    campaignId: string,
    customerId: string,
    now: Date,
  ): Promise<void> {
    const campaign = await transaction.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw new BadRequestException("Campaign not found");
    const since = new Date(now.getTime() - campaign.frequencyWindowHours * 60 * 60 * 1000);
    const count = await transaction.notificationDelivery.count({
      where: { tenantId, campaignId, customerId, createdAt: { gte: since } },
    });
    if (count >= campaign.frequencyCap) {
      throw new BadRequestException("Campaign frequency cap reached for customer");
    }
  }

  private assertOrganization(organizationId: string): void {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new NotFoundException("Organization not found or outside scope");
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    );
  }
}
