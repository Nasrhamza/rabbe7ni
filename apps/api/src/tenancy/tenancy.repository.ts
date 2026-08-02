import { Inject, Injectable } from "@nestjs/common";
import { MembershipStatus, TenantStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";

import { appendTechnicalEvent } from "../common/events/append-technical-event.js";
import type {
  CreateMembershipDto,
  CreateRoleDto,
  CreateTenantDto,
  SetTenantSettingDto,
} from "./dto.js";
import { TenantContextStore } from "./tenant-context.store.js";

@Injectable()
export class TenancyRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  createTenant(input: CreateTenantDto) {
    const id = randomUUID();
    const correlationId = this.context.current().correlationId;
    return this.transactions.run(id, async (transaction) => {
      const tenant = await transaction.tenant.create({
        data: {
          id,
          slug: input.slug,
          region: input.region,
          defaultLocale: input.defaultLocale ?? "en",
          defaultCurrency: input.defaultCurrency,
          status: TenantStatus.PROVISIONING,
        },
      });
      await appendTechnicalEvent(transaction, id, correlationId, {
        type: "tenancy.tenant.created.v1",
        aggregateType: "tenant",
        aggregateId: tenant.id,
        payload: { slug: tenant.slug },
      });
      return tenant;
    });
  }

  findCurrentTenant() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.tenant.findUnique({ where: { id: tenantId } }),
    );
  }

  createMembership(input: CreateMembershipDto) {
    const tenantId = this.context.tenantId();
    const correlationId = this.context.current().correlationId;
    return this.transactions.run(tenantId, async (transaction) => {
      const membership = await transaction.membership.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          userId: input.userId,
          status: MembershipStatus.INVITED,
          invitedAt: new Date(),
        },
      });
      await appendTechnicalEvent(transaction, tenantId, correlationId, {
        type: "tenancy.membership.created.v1",
        aggregateType: "membership",
        aggregateId: membership.id,
        payload: { userId: membership.userId },
      });
      return membership;
    });
  }

  createRole(input: CreateRoleDto) {
    const tenantId = this.context.tenantId();
    const correlationId = this.context.current().correlationId;
    return this.transactions.run(tenantId, async (transaction) => {
      const role = await transaction.role.create({
        data: {
          tenantId,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          scope: input.scope ?? "ORGANIZATION",
          permissions: {
            create: (input.permissionIds ?? []).map((permissionId) => ({
              tenantId,
              permissionId,
            })),
          },
        },
        include: { permissions: true },
      });
      await appendTechnicalEvent(transaction, tenantId, correlationId, {
        type: "tenancy.role.created.v1",
        aggregateType: "role",
        aggregateId: role.id,
        payload: { code: role.code },
      });
      return role;
    });
  }

  setSetting(input: SetTenantSettingDto) {
    const tenantId = this.context.tenantId();
    const correlationId = this.context.current().correlationId;
    return this.transactions.run(tenantId, async (transaction) => {
      const setting = await transaction.tenantSetting.upsert({
        where: {
          tenantId_namespace_key: {
            tenantId,
            namespace: input.namespace,
            key: input.key,
          },
        },
        update: {
          value: input.value as Prisma.InputJsonValue,
          version: { increment: 1 },
          ...(input.updatedById ? { updatedById: input.updatedById } : {}),
        },
        create: {
          tenantId,
          namespace: input.namespace,
          key: input.key,
          value: input.value as Prisma.InputJsonValue,
          ...(input.updatedById ? { updatedById: input.updatedById } : {}),
        },
      });
      await appendTechnicalEvent(transaction, tenantId, correlationId, {
        type: "tenancy.setting.changed.v1",
        aggregateType: "tenant_setting",
        aggregateId: setting.id,
        payload: { namespace: setting.namespace, key: setting.key, version: setting.version },
      });
      return setting;
    });
  }
}
