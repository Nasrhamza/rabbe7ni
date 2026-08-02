import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import {
  CustomerStatus,
  MembershipStatus,
  PointsEntryType,
  RoleScope,
  UserStatus,
} from "@rabbehni/database";
import type { Prisma } from "@rabbehni/database";
import { PrismaService, TenantTransactionService } from "@rabbehni/database/nest";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import type { AuthenticatedPrincipal, RabbehniTokenClaims } from "./auth.types.js";

interface SessionWrite {
  readonly tenantId: string;
  readonly userId: string;
  readonly sessionTokenHash: string;
  readonly refreshTokenCiphertext: string;
  readonly refreshTokenIv: string;
  readonly refreshTokenTag: string;
  readonly expiresAt: Date;
  readonly idleExpiresAt: Date;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

const tenantIdSchema = z.uuid();
const customerPermissionCodes = [
  "points.read",
  "reward.read",
  "reward.redeem",
  "gamification.read",
  "challenge.read",
  "habit.read",
  "streak.read",
  "badge.read",
  "leaderboard.read",
] as const;

@Injectable()
export class AuthRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TenantTransactionService)
    private readonly transactions: TenantTransactionService,
  ) {}

  async customerSignupScope(tenantId: string, organizationId: string) {
    return this.transactions.run(tenantId, async (transaction) => {
      const [tenant, organization] = await Promise.all([
        transaction.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true, status: true },
        }),
        transaction.organization.findUnique({
          where: { id_tenantId: { id: organizationId, tenantId } },
          select: { id: true, status: true },
        }),
      ]);
      if (!tenant || tenant.status !== "ACTIVE") return null;
      if (!organization || organization.status !== "ACTIVE") return null;
      return { tenantId: tenant.id, organizationId: organization.id };
    });
  }

  async registerCustomer(input: {
    readonly displayName: string;
    readonly email: string;
    readonly externalSubject: string;
    readonly locale: string;
    readonly organizationId: string;
    readonly phone: string;
    readonly referralCode?: string;
    readonly tenantId: string;
  }) {
    return this.transactions.run(input.tenantId, async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { normalizedEmail: input.email },
        select: { id: true },
      });
      if (existingUser) return null;

      const referral = input.referralCode
        ? await transaction.customerReferral.findFirst({
            where: {
              code: input.referralCode,
              organizationId: input.organizationId,
              status: "PENDING",
              referredCustomerId: null,
            },
          })
        : null;
      if (input.referralCode && !referral) {
        throw new BadRequestException(
          "Referral code is invalid, expired or outside this organization",
        );
      }

      const user = await transaction.user.create({
        data: {
          externalSubject: input.externalSubject,
          email: input.email,
          normalizedEmail: input.email,
          displayName: input.displayName,
          locale: input.locale,
          status: UserStatus.ACTIVE,
        },
      });
      const membership = await transaction.membership.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });
      const role = await transaction.role.upsert({
        where: { tenantId_code: { tenantId: input.tenantId, code: "customer" } },
        update: { system: true },
        create: {
          tenantId: input.tenantId,
          code: "customer",
          name: "Customer",
          description: "Customer mobile application access",
          scope: RoleScope.ORGANIZATION,
          system: true,
        },
      });
      const permissions = await transaction.permission.findMany({
        where: { code: { in: [...customerPermissionCodes] } },
        select: { id: true },
      });
      await transaction.rolePermission.deleteMany({
        where: {
          tenantId: input.tenantId,
          roleId: role.id,
          permission: { code: { notIn: [...customerPermissionCodes] } },
        },
      });
      await transaction.rolePermission.createMany({
        data: permissions.map(({ id }) => ({
          tenantId: input.tenantId,
          roleId: role.id,
          permissionId: id,
        })),
        skipDuplicates: true,
      });
      await transaction.membershipRole.create({
        data: {
          tenantId: input.tenantId,
          membershipId: membership.id,
          roleId: role.id,
        },
      });
      const customer = await transaction.customer.create({
        data: {
          tenantId: input.tenantId,
          organizationId: input.organizationId,
          userId: user.id,
          email: input.email,
          normalizedEmail: input.email,
          phone: input.phone,
          displayName: input.displayName,
          locale: input.locale,
          status: CustomerStatus.ACTIVE,
          activatedAt: new Date(),
          preferences: {},
          communicationPreferences: { email: true, sms: true, push: true },
          consents: {
            loyalty: { granted: true, grantedAt: new Date().toISOString() },
            marketing: { granted: false },
          },
        },
      });
      if (referral) {
        const program = await transaction.loyaltyProgram.findFirst({
          where: { organizationId: input.organizationId, status: "ACTIVE" },
          orderBy: { activatedAt: "asc" },
        });
        const now = new Date();
        await transaction.customerReferral.update({
          where: { id: referral.id },
          data: {
            referredCustomerId: customer.id,
            status: program && referral.rewardPoints > 0 ? "REWARDED" : "QUALIFIED",
            qualifiedAt: now,
            ...(program && referral.rewardPoints > 0 ? { rewardedAt: now } : {}),
          },
        });
        if (program && referral.rewardPoints > 0) {
          await transaction.pointsLedgerEntry.createMany({
            data: [
              {
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                programId: program.id,
                customerId: referral.referrerCustomerId,
                type: PointsEntryType.EARN,
                points: referral.rewardPoints,
                idempotencyKey: `referral:${referral.id}:referrer`,
                referenceType: "customer_referral",
                referenceId: referral.id,
                metadata: { role: "referrer" },
              },
              {
                tenantId: input.tenantId,
                organizationId: input.organizationId,
                programId: program.id,
                customerId: customer.id,
                type: PointsEntryType.EARN,
                points: referral.rewardPoints,
                idempotencyKey: `referral:${referral.id}:referred`,
                referenceType: "customer_referral",
                referenceId: referral.id,
                metadata: { role: "referred" },
              },
            ],
            skipDuplicates: true,
          });
          await transaction.customerActivity.createMany({
            data: [
              {
                tenantId: input.tenantId,
                customerId: referral.referrerCustomerId,
                type: "referral.rewarded",
                referenceId: referral.id,
                metadata: { points: referral.rewardPoints, role: "referrer" },
              },
              {
                tenantId: input.tenantId,
                customerId: customer.id,
                type: "referral.rewarded",
                referenceId: referral.id,
                metadata: { points: referral.rewardPoints, role: "referred" },
              },
            ],
          });
        }
      }
      const correlationId = randomUUID();
      const eventPayload = {
        channel: "customer-mobile",
        organizationId: input.organizationId,
        userId: user.id,
      };
      await Promise.all([
        transaction.auditLog.create({
          data: {
            tenantId: input.tenantId,
            actorUserId: user.id,
            action: "customer.self_registered",
            entityType: "customer",
            entityId: customer.id,
            correlationId,
            metadata: eventPayload as Prisma.InputJsonValue,
          },
        }),
        transaction.outboxEvent.create({
          data: {
            tenantId: input.tenantId,
            eventType: "customer.registered",
            aggregateType: "customer",
            aggregateId: customer.id,
            correlationId,
            payload: eventPayload as Prisma.InputJsonValue,
          },
        }),
      ]);
      return { customerId: customer.id, userId: user.id, referralApplied: Boolean(referral) };
    });
  }

  async resolveTokenPrincipal(
    claims: RabbehniTokenClaims,
    authMethod: AuthenticatedPrincipal["authMethod"],
  ): Promise<AuthenticatedPrincipal> {
    const tenantId = tenantIdSchema.safeParse(claims.tenant_id);
    if (!tenantId.success) {
      throw new ForbiddenException("The authenticated identity has no valid tenant assignment");
    }

    const normalizedEmail = claims.email?.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ externalSubject: claims.sub }, ...(normalizedEmail ? [{ normalizedEmail }] : [])],
      },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException("The authenticated user is not active in Rabbehni");
    }
    if (user.externalSubject && user.externalSubject !== claims.sub) {
      throw new ForbiddenException(
        "The authenticated identity does not match the provisioned user",
      );
    }
    if (!user.externalSubject) {
      await this.prisma.user.update({
        data: { externalSubject: claims.sub },
        where: { id: user.id },
      });
    }

    return this.resolveDatabasePrincipal(tenantId.data, user.id, claims.sub, authMethod);
  }

  resolveSessionPrincipal(
    tenantId: string,
    userId: string,
    authMethod: AuthenticatedPrincipal["authMethod"] = "session",
  ): Promise<AuthenticatedPrincipal> {
    return this.resolveDatabasePrincipal(tenantId, userId, undefined, authMethod);
  }

  createSession(input: SessionWrite) {
    return this.transactions.run(input.tenantId, (transaction) =>
      transaction.authSession.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          sessionTokenHash: input.sessionTokenHash,
          refreshTokenCiphertext: input.refreshTokenCiphertext,
          refreshTokenIv: input.refreshTokenIv,
          refreshTokenTag: input.refreshTokenTag,
          expiresAt: input.expiresAt,
          idleExpiresAt: input.idleExpiresAt,
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
          ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        },
      }),
    );
  }

  findSession(tenantId: string, sessionTokenHash: string) {
    return this.transactions.run(tenantId, (transaction) =>
      transaction.authSession.findUnique({
        where: { sessionTokenHash },
      }),
    );
  }

  touchSession(tenantId: string, id: string, idleExpiresAt: Date) {
    return this.transactions.run(tenantId, (transaction) =>
      transaction.authSession.update({
        data: {
          idleExpiresAt,
          lastSeenAt: new Date(),
        },
        where: { id },
      }),
    );
  }

  rotateSession(
    tenantId: string,
    id: string,
    input: {
      readonly refreshTokenCiphertext: string;
      readonly refreshTokenIv: string;
      readonly refreshTokenTag: string;
      readonly idleExpiresAt: Date;
    },
  ) {
    return this.transactions.run(tenantId, (transaction) =>
      transaction.authSession.update({
        data: {
          ...input,
          lastSeenAt: new Date(),
        },
        where: { id },
      }),
    );
  }

  revokeSession(tenantId: string, id: string) {
    return this.transactions.run(tenantId, (transaction) =>
      transaction.authSession.update({
        data: { revokedAt: new Date() },
        where: { id },
      }),
    );
  }

  private async resolveDatabasePrincipal(
    tenantId: string,
    userId: string,
    tokenSubject: string | undefined,
    authMethod: AuthenticatedPrincipal["authMethod"],
  ): Promise<AuthenticatedPrincipal> {
    return this.transactions.run(tenantId, async (transaction) => {
      const membership = await transaction.membership.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId,
          },
        },
        include: {
          user: true,
          staffProfiles: {
            where: {
              status: { notIn: ["REMOVED", "TERMINATED"] },
            },
            select: {
              organizationId: true,
              franchiseId: true,
              merchantId: true,
              branchId: true,
            },
          },
          roles: {
            include: {
              role: {
                include: {
                  permissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
        },
      });
      if (!membership || membership.status !== MembershipStatus.ACTIVE) {
        throw new ForbiddenException("The user has no active membership in this tenant");
      }
      if (membership.user.status !== UserStatus.ACTIVE) {
        throw new ForbiddenException("The user account is not active");
      }
      if (
        tokenSubject &&
        membership.user.externalSubject &&
        membership.user.externalSubject !== tokenSubject
      ) {
        throw new UnauthorizedException("The identity subject does not match the session user");
      }

      const roles = membership.roles.map(({ role }) => role.code);
      const permissions = [
        ...new Set(
          membership.roles.flatMap(({ role }) =>
            role.permissions.map(({ permission }) => permission.code),
          ),
        ),
      ].sort();
      const tenantWide = permissions.includes("tenant.manage");
      const organizationIds = [
        ...new Set([
          membership.organizationId,
          ...membership.staffProfiles.map((staff) => staff.organizationId),
        ]),
      ];
      const franchiseIds = [
        ...new Set(
          membership.staffProfiles.flatMap((staff) =>
            staff.franchiseId ? [staff.franchiseId] : [],
          ),
        ),
      ];
      const merchantIds = [
        ...new Set(
          membership.staffProfiles.flatMap((staff) => (staff.merchantId ? [staff.merchantId] : [])),
        ),
      ];
      const branchIds = [
        ...new Set(
          membership.staffProfiles.flatMap((staff) => (staff.branchId ? [staff.branchId] : [])),
        ),
      ];

      return {
        subject: membership.user.externalSubject ?? membership.user.id,
        userId: membership.user.id,
        tenantId,
        membershipId: membership.id,
        email: membership.user.email,
        displayName: membership.user.displayName,
        locale: membership.user.locale,
        permissions,
        roles,
        access: {
          organizationIds,
          franchiseIds,
          merchantIds,
          branchIds,
          tenantWide,
        },
        authMethod,
      };
    });
  }
}
