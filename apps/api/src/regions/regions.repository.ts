import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { RegionStatus, type Prisma } from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  CountryList,
  CreateCountry,
  CreateRegion,
  RegionList,
  UpdateCountry,
  UpdateRegion,
} from "./dto.js";

@Injectable()
export class RegionsRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  listCountries(input: CountryList) {
    const tenantId = this.context.tenantId();
    const where: Prisma.PlatformCountryWhereInput = {
      tenantId,
      ...(input.active === undefined ? {} : { active: input.active }),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.platformCountry.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { _count: { select: { regions: true } } },
        }),
        transaction.platformCountry.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  createCountry(input: CreateCountry) {
    return this.write(
      "country.create",
      "platform.country.created.v1",
      async (transaction, tenantId) => {
        const country = await transaction.platformCountry.create({ data: { tenantId, ...input } });
        return { entity: country, payload: { code: country.code } };
      },
    );
  }

  updateCountry(id: string, input: UpdateCountry) {
    return this.write(
      "country.update",
      "platform.country.updated.v1",
      async (transaction, tenantId) => {
        const existing = await transaction.platformCountry.findFirst({ where: { id, tenantId } });
        if (!existing) throw new NotFoundException("Country not found");
        const data = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Prisma.PlatformCountryUncheckedUpdateInput;
        const country = await transaction.platformCountry.update({ where: { id }, data });
        return { entity: country, payload: { code: country.code, active: country.active } };
      },
    );
  }

  listRegions(input: RegionList) {
    const tenantId = this.context.tenantId();
    const where: Prisma.PlatformRegionWhereInput = {
      tenantId,
      ...(!input.includeArchived ? { status: { not: RegionStatus.ARCHIVED } } : {}),
      ...(input.countryId ? { countryId: input.countryId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" } },
              { name: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.platformRegion.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            country: true,
            administrators: {
              include: {
                user: { select: { id: true, displayName: true, email: true, status: true } },
              },
            },
          },
        }),
        transaction.platformRegion.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  getRegion(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.platformRegion.findFirst({
        where: { id, tenantId },
        include: {
          country: true,
          administrators: {
            include: {
              user: { select: { id: true, displayName: true, email: true, status: true } },
            },
          },
        },
      }),
    );
  }

  createRegion(input: CreateRegion) {
    return this.write(
      "region.create",
      "platform.region.created.v1",
      async (transaction, tenantId) => {
        const country = await transaction.platformCountry.findFirst({
          where: { id: input.countryId, tenantId, active: true },
        });
        if (!country) throw new NotFoundException("Active country not found");
        const region = await transaction.platformRegion.create({
          data: {
            tenantId,
            ...input,
            culturalProfile: input.culturalProfile as Prisma.InputJsonValue,
          },
        });
        return { entity: region, payload: { code: region.code, country: country.code } };
      },
    );
  }

  updateRegion(id: string, input: UpdateRegion) {
    return this.write(
      "region.update",
      "platform.region.updated.v1",
      async (transaction, tenantId) => {
        const existing = await transaction.platformRegion.findFirst({ where: { id, tenantId } });
        if (!existing) throw new NotFoundException("Region not found");
        if (input.countryId) {
          const country = await transaction.platformCountry.findFirst({
            where: { id: input.countryId, tenantId, active: true },
          });
          if (!country) throw new NotFoundException("Active country not found");
        }
        const data = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Prisma.PlatformRegionUncheckedUpdateInput;
        if (input.culturalProfile)
          data.culturalProfile = input.culturalProfile as Prisma.InputJsonValue;
        const region = await transaction.platformRegion.update({ where: { id }, data });
        return { entity: region, payload: { code: region.code, status: region.status } };
      },
    );
  }

  setStatus(id: string, status: RegionStatus) {
    return this.updateRegion(id, { status } as UpdateRegion);
  }

  archive(id: string) {
    return this.write(
      "region.archive",
      "platform.region.archived.v1",
      async (transaction, tenantId) => {
        const existing = await transaction.platformRegion.findFirst({ where: { id, tenantId } });
        if (!existing) throw new NotFoundException("Region not found");
        const region = await transaction.platformRegion.update({
          where: { id },
          data: { status: RegionStatus.ARCHIVED, archivedAt: new Date() },
        });
        return { entity: region, payload: { code: region.code } };
      },
    );
  }

  assignAdministrator(regionId: string, userId: string) {
    return this.write(
      "region.admin.assign",
      "platform.region-administrator.assigned.v1",
      async (transaction, tenantId) => {
        const [region, membership] = await Promise.all([
          transaction.platformRegion.findFirst({
            where: { id: regionId, tenantId, status: { not: RegionStatus.ARCHIVED } },
          }),
          transaction.membership.findFirst({ where: { tenantId, userId, status: "ACTIVE" } }),
        ]);
        if (!region) throw new NotFoundException("Region not found");
        if (!membership)
          throw new ConflictException("Only an active tenant administrator can be assigned");
        const assignment = await transaction.regionAdministrator.upsert({
          where: { tenantId_regionId_userId: { tenantId, regionId, userId } },
          update: {},
          create: { tenantId, regionId, userId },
          include: { user: { select: { id: true, displayName: true, email: true } } },
        });
        return { entity: assignment, payload: { regionId, userId } };
      },
    );
  }

  unassignAdministrator(regionId: string, userId: string) {
    return this.write(
      "region.admin.unassign",
      "platform.region-administrator.unassigned.v1",
      async (transaction, tenantId) => {
        const assignment = await transaction.regionAdministrator.findFirst({
          where: { tenantId, regionId, userId },
        });
        if (!assignment) throw new NotFoundException("Regional administrator assignment not found");
        await transaction.regionAdministrator.delete({ where: { id: assignment.id } });
        return { entity: assignment, payload: { regionId, userId } };
      },
    );
  }

  private write<T extends { id: string }>(
    action: string,
    eventType: string,
    mutation: (
      transaction: Prisma.TransactionClient,
      tenantId: string,
    ) => Promise<{ entity: T; payload: Record<string, unknown> }>,
  ) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const result = await mutation(transaction, tenantId);
      await appendDomainChange(transaction, tenantId, request, {
        action,
        eventType,
        entityType: action.startsWith("country") ? "platform_country" : "platform_region",
        entityId: result.entity.id,
        payload: result.payload,
      });
      return result.entity;
    });
  }
}
