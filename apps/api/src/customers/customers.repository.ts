import { Inject, Injectable } from "@nestjs/common";
import { CustomerStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { randomBytes } from "node:crypto";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CreateCustomerDto,
  CustomerList,
  CustomerPreferencesDto,
  CustomerProfileDto,
  UpdateCustomerDto,
} from "./dto.js";

@Injectable()
export class CustomersRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateCustomerDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!this.context.canAccessOrganization(input.organizationId)) return null;
      const organization = await transaction.organization.findUnique({
        where: { id: input.organizationId },
      });
      if (!organization || organization.status === "ARCHIVED") return null;
      const customer = await transaction.customer.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          displayName: input.displayName,
          locale: input.locale ?? "en",
          status: CustomerStatus.ACTIVE,
          activatedAt: new Date(),
          preferences: (input.preferences ?? {}) as Prisma.InputJsonValue,
          communicationPreferences: (input.communicationPreferences ?? {}) as Prisma.InputJsonValue,
          consents: (input.consents ?? {}) as Prisma.InputJsonValue,
          ...(input.externalReference ? { externalReference: input.externalReference } : {}),
          ...(input.email
            ? { email: input.email, normalizedEmail: input.email.trim().toLowerCase() }
            : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.birthDate ? { birthDate: input.birthDate } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: { tenantId, customerId: customer.id, type: "customer.created" },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "customer.create",
        eventType: "customers.customer.created.v1",
        entityType: "customer",
        entityId: customer.id,
        payload: { organizationId: customer.organizationId },
      });
      return customer;
    });
  }

  list(input: CustomerList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.CustomerWhereInput = {
      tenantId,
      ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
      ...(!input.includeArchived ? { status: { not: CustomerStatus.ARCHIVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { displayName: { contains: input.search, mode: "insensitive" } },
              { email: { contains: input.search, mode: "insensitive" } },
              { phone: { contains: input.search, mode: "insensitive" } },
              { externalReference: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.customer.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
        }),
        transaction.customer.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.customer.findFirst({
        where: {
          id,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
        include: {
          activities: { orderBy: { occurredAt: "desc" }, take: 100 },
          _count: { select: { pointsEntries: true, rewardRedemptions: true } },
        },
      }),
    );
  }

  findMe() {
    const tenantId = this.context.tenantId();
    const userId = this.context.authenticatedPrincipal().userId;
    return this.transactions.run(tenantId, (transaction) =>
      transaction.customer.findFirst({
        where: { userId },
        include: { activities: { orderBy: { occurredAt: "desc" }, take: 50 } },
      }),
    );
  }

  updateMyProfile(input: CustomerProfileDto) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    const userId = this.context.authenticatedPrincipal().userId;
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findFirst({ where: { userId } });
      if (!customer || customer.status === CustomerStatus.ARCHIVED) return null;
      const preferences = (customer.preferences ?? {}) as Record<string, unknown>;
      const updated = await transaction.customer.update({
        where: { id: customer.id },
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.firstName ? { firstName: input.firstName } : {}),
          ...(input.lastName ? { lastName: input.lastName } : {}),
          ...(input.phone ? { phone: input.phone } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
          preferences: {
            ...preferences,
            ...(input.preferredCurrency ? { preferredCurrency: input.preferredCurrency } : {}),
            ...(input.avatarKey ? { avatarKey: input.avatarKey } : {}),
          },
        },
      });
      await transaction.user.update({
        where: { id: userId },
        data: {
          ...(input.displayName ? { displayName: input.displayName } : {}),
          ...(input.locale ? { locale: input.locale } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: { tenantId, customerId: customer.id, type: "customer.profile.updated" },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "customer.profile.update",
        eventType: "customers.customer.profile-updated.v1",
        entityType: "customer",
        entityId: customer.id,
      });
      return updated;
    });
  }

  myReferral() {
    const tenantId = this.context.tenantId();
    const userId = this.context.authenticatedPrincipal().userId;
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findFirst({ where: { userId } });
      if (!customer) return null;
      const existing = await transaction.customerReferral.findFirst({
        where: { referrerCustomerId: customer.id, referredCustomerId: null },
        orderBy: { createdAt: "desc" },
      });
      const referral =
        existing ??
        (await transaction.customerReferral.create({
          data: {
            tenantId,
            organizationId: customer.organizationId,
            referrerCustomerId: customer.id,
            code: `RAB-${randomBytes(4).toString("hex").toUpperCase()}`,
            rewardPoints: 100,
          },
        }));
      const invited = await transaction.customerReferral.count({
        where: { referrerCustomerId: customer.id, referredCustomerId: { not: null } },
      });
      const rewarded = await transaction.customerReferral.count({
        where: { referrerCustomerId: customer.id, status: "REWARDED" },
      });
      return { ...referral, invited, rewarded };
    });
  }

  myReferralHistory() {
    const tenantId = this.context.tenantId();
    const userId = this.context.authenticatedPrincipal().userId;
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findFirst({ where: { userId } });
      if (!customer) return null;
      return transaction.customerReferral.findMany({
        where: { referrerCustomerId: customer.id, referredCustomerId: { not: null } },
        include: { referred: { select: { displayName: true, activatedAt: true } } },
        orderBy: { createdAt: "desc" },
      });
    });
  }

  update(id: string, input: UpdateCustomerDto | CustomerPreferencesDto, self = false) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const access = this.context.authenticatedPrincipal().access;
      const existing = await transaction.customer.findFirst({
        where: self
          ? { id, userId: this.context.authenticatedPrincipal().userId }
          : {
              id,
              ...(!access.tenantWide
                ? { organizationId: { in: [...access.organizationIds] } }
                : {}),
            },
      });
      if (!existing || existing.status === CustomerStatus.ARCHIVED) return null;
      const typedInput = input as UpdateCustomerDto & CustomerPreferencesDto;
      const { preferences, communicationPreferences, consents, email, ...fields } = typedInput;
      const updateFields = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as Prisma.CustomerUncheckedUpdateInput;
      const customer = await transaction.customer.update({
        where: { id },
        data: {
          ...updateFields,
          ...(email !== undefined
            ? { email, normalizedEmail: email ? email.trim().toLowerCase() : null }
            : {}),
          ...(preferences ? { preferences: preferences as Prisma.InputJsonValue } : {}),
          ...(communicationPreferences
            ? { communicationPreferences: communicationPreferences as Prisma.InputJsonValue }
            : {}),
          ...(consents ? { consents: consents as Prisma.InputJsonValue } : {}),
        },
      });
      await transaction.customerActivity.create({
        data: {
          tenantId,
          customerId: id,
          type: self ? "customer.preferences.updated" : "customer.updated",
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: self ? "customer.preferences.update" : "customer.update",
        eventType: "customers.customer.updated.v1",
        entityType: "customer",
        entityId: id,
      });
      return customer;
    });
  }

  changeStatus(id: string, status: CustomerStatus) {
    return this.mutate(id, `customer.${status.toLowerCase()}`, {
      status,
      ...(status === CustomerStatus.ACTIVE ? { activatedAt: new Date() } : {}),
      ...(status === CustomerStatus.SUSPENDED ? { suspendedAt: new Date() } : {}),
    });
  }

  archive(id: string) {
    return this.mutate(id, "customer.archive", {
      status: CustomerStatus.ARCHIVED,
      archivedAt: new Date(),
    });
  }

  private mutate(id: string, action: string, data: Prisma.CustomerUpdateInput) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const access = this.context.authenticatedPrincipal().access;
      const existing = await transaction.customer.findFirst({
        where: {
          id,
          ...(!access.tenantWide ? { organizationId: { in: [...access.organizationIds] } } : {}),
        },
      });
      if (!existing) return null;
      const customer = await transaction.customer.update({ where: { id }, data });
      await transaction.customerActivity.create({
        data: { tenantId, customerId: id, type: action },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType: "customers.customer.status-changed.v1",
        entityType: "customer",
        entityId: id,
        payload: { previousStatus: existing.status, status: customer.status },
      });
      return customer;
    });
  }
}
