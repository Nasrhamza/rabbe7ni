import { Inject, Injectable } from "@nestjs/common";
import {
  MembershipStatus,
  StaffStatus,
  UserStatus,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { InviteStaffDto, StaffList, UpdateStaffAssignmentDto } from "./dto.js";

interface ScopeInput {
  readonly organizationId: string;
  readonly franchiseId?: string | null | undefined;
  readonly merchantId?: string | null | undefined;
  readonly branchId?: string | null | undefined;
}

@Injectable()
export class StaffRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  roleGrants(roleIds: readonly string[]) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.role.findMany({
        where: { id: { in: [...roleIds] }, tenantId },
        include: {
          permissions: { include: { permission: true } },
        },
      }),
    );
  }

  listRoles() {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.role.findMany({
        where: { tenantId },
        orderBy: [{ scope: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true, description: true, scope: true, system: true },
      }),
    );
  }

  invite(input: InviteStaffDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      if (!(await this.validScope(transaction, input))) return null;
      const roles = await transaction.role.findMany({
        where: { id: { in: input.roleIds }, tenantId },
      });
      if (roles.length !== new Set(input.roleIds).size) return null;

      const normalizedEmail = input.email.trim().toLowerCase();
      let user = await transaction.user.findUnique({ where: { normalizedEmail } });
      if (!user) {
        user = await transaction.user.create({
          data: {
            email: normalizedEmail,
            normalizedEmail,
            displayName: input.displayName,
            locale: input.locale ?? "en",
            status: UserStatus.INVITED,
          },
        });
      }
      const existingMembership = await transaction.membership.findUnique({
        where: { tenantId_userId: { tenantId, userId: user.id } },
      });
      if (existingMembership && existingMembership.organizationId !== input.organizationId) {
        return null;
      }
      const membership =
        existingMembership ??
        (await transaction.membership.create({
          data: {
            tenantId,
            organizationId: input.organizationId,
            userId: user.id,
            status: MembershipStatus.INVITED,
            invitedAt: new Date(),
          },
        }));
      const staff = await transaction.staff.create({
        data: {
          tenantId,
          membershipId: membership.id,
          userId: user.id,
          organizationId: input.organizationId,
          status: StaffStatus.INVITED,
          ...(input.franchiseId ? { franchiseId: input.franchiseId } : {}),
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.employeeCode ? { employeeCode: input.employeeCode } : {}),
          ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
        },
      });
      await transaction.membershipRole.createMany({
        data: input.roleIds.map((roleId) => ({
          tenantId,
          membershipId: membership.id,
          roleId,
        })),
        skipDuplicates: true,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "staff.invite",
        eventType: "staff.staff.invited.v1",
        entityType: "staff",
        entityId: staff.id,
        payload: {
          userId: user.id,
          organizationId: staff.organizationId,
          franchiseId: staff.franchiseId,
          merchantId: staff.merchantId,
          branchId: staff.branchId,
          roleIds: input.roleIds,
        },
      });
      return staff;
    });
  }

  list(input: StaffList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.StaffWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(!input.includeRemoved ? { status: { not: StaffStatus.REMOVED } } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.franchiseId ? { franchiseId: input.franchiseId } : {}),
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.branchId ? { branchId: input.branchId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { user: { displayName: { contains: input.search, mode: "insensitive" } } },
              { user: { email: { contains: input.search, mode: "insensitive" } } },
              { employeeCode: { contains: input.search, mode: "insensitive" } },
              { jobTitle: { contains: input.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.staff.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            user: { select: { id: true, email: true, displayName: true, locale: true } },
            organization: { select: { id: true, displayName: true } },
            franchise: { select: { id: true, name: true } },
            merchant: { select: { id: true, displayName: true } },
            branch: { select: { id: true, name: true } },
            membership: {
              include: {
                roles: { include: { role: { select: { id: true, code: true, name: true } } } },
              },
            },
          },
        }),
        transaction.staff.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  findById(id: string) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.staff.findFirst({
        where: {
          id,
          ...(!principal.access.tenantWide
            ? { organizationId: { in: [...principal.access.organizationIds] } }
            : {}),
        },
        include: {
          user: true,
          organization: true,
          franchise: true,
          merchant: true,
          branch: true,
          membership: {
            include: {
              roles: {
                include: {
                  role: { include: { permissions: { include: { permission: true } } } },
                },
              },
            },
          },
        },
      }),
    );
  }

  updateAssignment(id: string, input: UpdateStaffAssignmentDto) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await this.scopedStaff(transaction, id);
      if (!existing || !(await this.validScope(transaction, input))) return null;
      if (existing.organizationId !== input.organizationId) return null;
      const staff = await transaction.staff.update({
        where: { id },
        data: Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        ) as Prisma.StaffUncheckedUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "staff.assignment.update",
        eventType: "staff.staff.assignment-updated.v1",
        entityType: "staff",
        entityId: id,
        payload: {
          organizationId: staff.organizationId,
          franchiseId: staff.franchiseId,
          merchantId: staff.merchantId,
          branchId: staff.branchId,
        },
      });
      return staff;
    });
  }

  assignRoles(id: string, roleIds: readonly string[]) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const staff = await this.scopedStaff(transaction, id);
      if (!staff) return null;
      const roles = await transaction.role.findMany({ where: { id: { in: [...roleIds] } } });
      if (roles.length !== new Set(roleIds).size) return null;
      await transaction.membershipRole.deleteMany({
        where: { tenantId, membershipId: staff.membershipId },
      });
      await transaction.membershipRole.createMany({
        data: roleIds.map((roleId) => ({ tenantId, membershipId: staff.membershipId, roleId })),
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "staff.roles.assign",
        eventType: "staff.staff.roles-assigned.v1",
        entityType: "staff",
        entityId: id,
        payload: { roleIds },
      });
      return transaction.staff.findUnique({ where: { id } });
    });
  }

  changeStatus(id: string, status: StaffStatus) {
    const request = this.context.current();
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await this.scopedStaff(transaction, id);
      if (!existing) return null;
      const now = new Date();
      const staff = await transaction.staff.update({
        where: { id },
        data: {
          status,
          ...(status === StaffStatus.ACTIVE
            ? { activatedAt: now, suspendedAt: null, removedAt: null }
            : status === StaffStatus.SUSPENDED
              ? { suspendedAt: now }
              : status === StaffStatus.REMOVED
                ? { removedAt: now }
                : {}),
        },
      });
      if (status === StaffStatus.ACTIVE) {
        await Promise.all([
          transaction.membership.update({
            where: { id: staff.membershipId },
            data: { status: MembershipStatus.ACTIVE, joinedAt: now },
          }),
          transaction.user.update({
            where: { id: staff.userId },
            data: { status: UserStatus.ACTIVE },
          }),
        ]);
      } else if (status === StaffStatus.SUSPENDED) {
        await transaction.membership.update({
          where: { id: staff.membershipId },
          data: { status: MembershipStatus.SUSPENDED },
        });
      } else if (status === StaffStatus.REMOVED) {
        await Promise.all([
          transaction.membership.update({
            where: { id: staff.membershipId },
            data: { status: MembershipStatus.REVOKED },
          }),
          transaction.membershipRole.deleteMany({
            where: { tenantId, membershipId: staff.membershipId },
          }),
        ]);
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: `staff.${status.toLowerCase()}`,
        eventType: "staff.staff.status-changed.v1",
        entityType: "staff",
        entityId: id,
        payload: { previousStatus: existing.status, status },
      });
      return staff;
    });
  }

  private scopedStaff(transaction: TenantTransaction, id: string) {
    const principal = this.context.authenticatedPrincipal();
    return transaction.staff.findFirst({
      where: {
        id,
        ...(!principal.access.tenantWide
          ? { organizationId: { in: [...principal.access.organizationIds] } }
          : {}),
      },
    });
  }

  private async validScope(transaction: TenantTransaction, input: ScopeInput): Promise<boolean> {
    if (!this.context.canAccessOrganization(input.organizationId)) return false;
    const [organization, franchise, merchant, branch] = await Promise.all([
      transaction.organization.findUnique({ where: { id: input.organizationId } }),
      input.franchiseId
        ? transaction.franchise.findUnique({ where: { id: input.franchiseId } })
        : Promise.resolve(null),
      input.merchantId
        ? transaction.merchant.findUnique({ where: { id: input.merchantId } })
        : Promise.resolve(null),
      input.branchId
        ? transaction.branch.findUnique({ where: { id: input.branchId } })
        : Promise.resolve(null),
    ]);
    if (!organization || organization.status === "ARCHIVED") return false;
    if (franchise && franchise.organizationId !== organization.id) return false;
    if (input.franchiseId && !franchise) return false;
    if (merchant && merchant.organizationId !== organization.id) return false;
    if (input.merchantId && !merchant) return false;
    if (franchise && merchant?.franchiseId && merchant.franchiseId !== franchise.id) return false;
    if (
      branch &&
      (branch.organizationId !== organization.id ||
        branch.merchantId !== input.merchantId ||
        (input.franchiseId && branch.franchiseId !== input.franchiseId))
    )
      return false;
    return !input.branchId || Boolean(branch);
  }
}
