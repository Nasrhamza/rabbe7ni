import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  BranchStatus,
  CustomerStatus,
  MembershipStatus,
  MerchantStatus,
  OrganizationStatus,
  PlanStatus,
  PointsEntryType,
  Prisma,
  RoleScope,
  StaffStatus,
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
} from "@rabbehni/database";
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

  /**
   * Reports whether a workspace slug is free.
   *
   * Uses the `rabbehni_workspace_slug_available` SECURITY DEFINER function rather than a query,
   * because the tenants table is under row level security keyed on its own id: an unauthenticated
   * caller has no tenant context and a direct SELECT would report every slug as free.
   */
  async isWorkspaceSlugAvailable(slug: string): Promise<{ slug: string; available: boolean }> {
    const rows = await this.prisma.$queryRaw<
      readonly { available: boolean }[]
    >`SELECT rabbehni_workspace_slug_available(${slug}) AS available`;
    return { slug, available: rows[0]?.available ?? false };
  }

  /**
   * Provisions a complete merchant workspace in a single transaction.
   *
   * Everything a self-registered merchant needs to sign in and operate — tenant, organization,
   * merchant, first branch, owner user, owner role with the full permission catalogue, staff record
   * and trial subscription — is created atomically. A partial workspace would leave an owner who
   * can authenticate but has no tenant, or a tenant nobody can administer, so there is deliberately
   * no intermediate commit.
   *
   * The Keycloak identity is created by the caller before this runs, because it lives outside the
   * database transaction; the caller deletes it when this throws.
   */
  async provisionMerchantWorkspace(input: {
    readonly workspaceSlug: string;
    readonly businessName: string;
    readonly legalName: string;
    readonly countryCode: string;
    readonly timezone: string;
    readonly currency: string;
    readonly locale: string;
    readonly branchName: string;
    readonly planCode: string;
    readonly ownerName: string;
    readonly ownerEmail: string;
    readonly ownerPhone: string;
    readonly externalSubject: string;
  }) {
    const tenantId = randomUUID();
    const correlationId = randomUUID();

    return this.transactions.run(tenantId, async (transaction) => {
      const existingUser = await transaction.user.findUnique({
        where: { normalizedEmail: input.ownerEmail },
        select: { id: true },
      });
      if (existingUser) {
        throw new ConflictException("An account already exists for this email");
      }

      // Plans are global reference data seeded by migration, not tenant rows.
      const plan =
        (await transaction.plan.findFirst({
          where: { code: input.planCode, status: PlanStatus.ACTIVE },
          select: { id: true, trialDays: true },
        })) ??
        (await transaction.plan.findFirst({
          where: { status: PlanStatus.ACTIVE },
          orderBy: { sortOrder: "asc" },
          select: { id: true, trialDays: true },
        }));
      if (!plan) {
        throw new ServiceUnavailableException("No subscription plan is available for registration");
      }

      // The tenants table is under RLS keyed on its own id, so a pre-flight slug lookup cannot see
      // rows from other tenants. The unique constraint is the only reliable check, and it is
      // enforced independently of RLS — hence catching the violation instead of querying first.
      const tenant = await transaction.tenant
        .create({
          data: {
            id: tenantId,
            slug: input.workspaceSlug,
            region: input.countryCode,
            defaultLocale: input.locale,
            defaultCurrency: input.currency,
            status: TenantStatus.ACTIVE,
          },
        })
        .catch((cause: unknown) => {
          if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") {
            throw new ConflictException("This workspace address is already taken");
          }
          throw cause;
        });

      const organization = await transaction.organization.create({
        data: {
          tenantId,
          code: "MAIN",
          legalName: input.legalName,
          displayName: input.businessName,
          countryCode: input.countryCode,
          timezone: input.timezone,
          status: OrganizationStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      const merchant = await transaction.merchant.create({
        data: {
          tenantId,
          organizationId: organization.id,
          code: "MAIN",
          legalName: input.legalName,
          displayName: input.businessName,
          countryCode: input.countryCode,
          timezone: input.timezone,
          locale: input.locale,
          contactEmail: input.ownerEmail,
          contactPhone: input.ownerPhone,
          status: MerchantStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      const branch = await transaction.branch.create({
        data: {
          tenantId,
          organizationId: organization.id,
          merchantId: merchant.id,
          code: "MAIN",
          name: input.branchName,
          countryCode: input.countryCode,
          timezone: input.timezone,
          locale: input.locale,
          currency: input.currency,
          email: input.ownerEmail,
          phone: input.ownerPhone,
          status: BranchStatus.ACTIVE,
        },
      });

      const user = await transaction.user.create({
        data: {
          externalSubject: input.externalSubject,
          email: input.ownerEmail,
          normalizedEmail: input.ownerEmail,
          displayName: input.ownerName,
          locale: input.locale,
          status: UserStatus.ACTIVE,
        },
      });

      const membership = await transaction.membership.create({
        data: {
          tenantId,
          organizationId: organization.id,
          userId: user.id,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      const role = await transaction.role.create({
        data: {
          tenantId,
          code: "owner",
          name: "Owner",
          description: "Full administrative access to the merchant workspace",
          scope: RoleScope.ORGANIZATION,
          system: true,
        },
      });

      // The owner receives every permission in the catalogue. The catalogue itself is reference
      // data installed by migration, so this is empty only on a database provisioned incorrectly.
      const permissions = await transaction.permission.findMany({ select: { id: true } });
      if (permissions.length === 0) {
        throw new ServiceUnavailableException(
          "The permission catalogue is missing; the database is not fully migrated",
        );
      }
      await transaction.rolePermission.createMany({
        data: permissions.map(({ id }) => ({ tenantId, roleId: role.id, permissionId: id })),
        skipDuplicates: true,
      });
      await transaction.membershipRole.create({
        data: { tenantId, membershipId: membership.id, roleId: role.id },
      });

      await transaction.staff.create({
        data: {
          tenantId,
          membershipId: membership.id,
          userId: user.id,
          organizationId: organization.id,
          merchantId: merchant.id,
          branchId: branch.id,
          jobTitle: "Owner",
          status: StaffStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      const now = new Date();
      const trialEndsAt = new Date(now.getTime() + plan.trialDays * 86_400_000);
      const subscription = await transaction.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: SubscriptionStatus.TRIALING,
          billingInterval: "MONTHLY",
          startsAt: now,
          trialEndsAt,
          currentPeriodStartsAt: now,
          currentPeriodEndsAt: trialEndsAt,
        },
      });

      const eventPayload = {
        channel: "merchant-web",
        organizationId: organization.id,
        merchantId: merchant.id,
        branchId: branch.id,
        userId: user.id,
        planId: plan.id,
        slug: tenant.slug,
      };
      await Promise.all([
        transaction.auditLog.create({
          data: {
            tenantId,
            actorUserId: user.id,
            action: "merchant.self_registered",
            entityType: "tenant",
            entityId: tenantId,
            correlationId,
            metadata: eventPayload as Prisma.InputJsonValue,
          },
        }),
        transaction.outboxEvent.create({
          data: {
            tenantId,
            eventType: "merchant.registered",
            aggregateType: "tenant",
            aggregateId: tenantId,
            correlationId,
            payload: eventPayload as Prisma.InputJsonValue,
          },
        }),
      ]);

      return {
        tenantId,
        slug: tenant.slug,
        organizationId: organization.id,
        merchantId: merchant.id,
        branchId: branch.id,
        userId: user.id,
        subscriptionId: subscription.id,
        trialEndsAt,
      };
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
