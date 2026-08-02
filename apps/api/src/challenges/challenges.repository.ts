import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  ChallengeEnrollmentStatus,
  ChallengeRewardType,
  ChallengeStatus,
  ChallengeType,
  ChallengeValidation,
  LeaderboardScope,
  type Prisma,
  type TenantTransaction,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type {
  ChallengeList,
  ChallengeProgress,
  ChallengeRewardInput,
  CreateChallenge,
} from "./dto.js";

@Injectable()
export class ChallengesRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  create(input: CreateChallenge) {
    this.assertOrganization(input.organizationId);
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await this.validateScopes(transaction, input.organizationId, input.applicability);
      await this.validateRewards(transaction, input.organizationId, input.rewards);
      const challenge = await transaction.challenge.create({
        data: {
          tenantId,
          organizationId: input.organizationId,
          code: input.code,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          type: input.type,
          cadence: input.cadence,
          status: input.status,
          validationMode: input.validationMode,
          objectiveType: input.objectiveType,
          target: input.target,
          eligibility: input.eligibility as Prisma.InputJsonValue,
          recurrence: input.recurrence as Prisma.InputJsonValue,
          startAt: input.startAt,
          endAt: input.endAt,
          autoEnroll: input.autoEnroll,
          scopes: {
            createMany: {
              data: input.applicability.map((scope) => ({ tenantId, ...scope })),
            },
          },
          rewards: {
            createMany: {
              data: input.rewards.map((reward) => ({
                tenantId,
                type: reward.type,
                metadata: reward.metadata as Prisma.InputJsonValue,
                ...(reward.amount ? { amount: reward.amount } : {}),
                ...(reward.badgeId ? { badgeId: reward.badgeId } : {}),
                ...(reward.loyaltyProgramId ? { loyaltyProgramId: reward.loyaltyProgramId } : {}),
              })),
            },
          },
        },
        include: { scopes: true, rewards: true },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.challenge.create",
        eventType: "gamification.challenge.created.v1",
        entityType: "challenge",
        entityId: challenge.id,
        payload: { type: challenge.type, cadence: challenge.cadence, target: challenge.target },
      });
      return challenge;
    });
  }

  update(id: string, input: Record<string, unknown>) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const current = await transaction.challenge.findUnique({ where: { id } });
      if (!current || !this.context.canAccessOrganization(current.organizationId)) return null;
      const startAt = input.startAt instanceof Date ? input.startAt : current.startAt;
      const endAt = input.endAt instanceof Date ? input.endAt : current.endAt;
      if (endAt <= startAt) throw new BadRequestException("Challenge end date must follow start");
      const challenge = await transaction.challenge.update({
        where: { id },
        data: input as Prisma.ChallengeUpdateInput,
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.challenge.update",
        eventType: "gamification.challenge.updated.v1",
        entityType: "challenge",
        entityId: id,
        payload: { status: challenge.status },
      });
      return challenge;
    });
  }

  list(input: ChallengeList) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    const where: Prisma.ChallengeWhereInput = {
      tenantId,
      ...(!principal.access.tenantWide
        ? { organizationId: { in: [...principal.access.organizationIds] } }
        : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.cadence ? { cadence: input.cadence } : {}),
      ...(input.objectiveType ? { objectiveType: input.objectiveType } : {}),
      ...(input.customerId ? { enrollments: { some: { customerId: input.customerId } } } : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.challenge.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: {
            scopes: true,
            rewards: true,
            _count: { select: { enrollments: true } },
            ...(input.customerId
              ? { enrollments: { where: { customerId: input.customerId } } }
              : {}),
          },
        }),
        transaction.challenge.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }

  matchingForEvent(customerId: string, eventType: string, occurredAt: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const customer = await transaction.customer.findUnique({ where: { id: customerId } });
      if (!customer || !this.context.canAccessOrganization(customer.organizationId)) return [];
      return transaction.challenge.findMany({
        where: {
          organizationId: customer.organizationId,
          objectiveType: eventType,
          status: ChallengeStatus.ACTIVE,
          startAt: { lte: occurredAt },
          endAt: { gt: occurredAt },
          OR: [{ autoEnroll: true }, { enrollments: { some: { customerId } } }],
        },
        select: { id: true },
      });
    });
  }

  detail(id: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const challenge = await transaction.challenge.findUnique({
        where: { id },
        include: {
          scopes: true,
          rewards: true,
          enrollments: {
            include: { customer: { select: { id: true, displayName: true } } },
            orderBy: { enrolledAt: "desc" },
            take: 200,
          },
        },
      });
      return challenge && this.context.canAccessOrganization(challenge.organizationId)
        ? challenge
        : null;
    });
  }

  addScope(id: string, scope: { scope: LeaderboardScope; targetId: string }) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const challenge = await this.authorizedChallenge(transaction, id);
      await this.validateScopes(transaction, challenge.organizationId, [scope]);
      return transaction.challengeApplicability.upsert({
        where: {
          tenantId_challengeId_scope_targetId: { tenantId, challengeId: id, ...scope },
        },
        update: {},
        create: { tenantId, challengeId: id, ...scope },
      });
    });
  }

  addReward(id: string, reward: ChallengeRewardInput) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const challenge = await this.authorizedChallenge(transaction, id);
      await this.validateRewards(transaction, challenge.organizationId, [reward]);
      return transaction.challengeReward.create({
        data: {
          tenantId,
          challengeId: id,
          type: reward.type,
          metadata: reward.metadata as Prisma.InputJsonValue,
          ...(reward.amount ? { amount: reward.amount } : {}),
          ...(reward.badgeId ? { badgeId: reward.badgeId } : {}),
          ...(reward.loyaltyProgramId ? { loyaltyProgramId: reward.loyaltyProgramId } : {}),
        },
      });
    });
  }

  enroll(challengeId: string, customerId: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const [challenge, customer] = await Promise.all([
        this.authorizedChallenge(transaction, challengeId),
        transaction.customer.findUnique({ where: { id: customerId } }),
      ]);
      this.assertChallengeAvailable(challenge);
      if (!customer || customer.organizationId !== challenge.organizationId) {
        throw new BadRequestException("Customer is outside challenge organization");
      }
      const enrollment = await transaction.challengeEnrollment.upsert({
        where: {
          tenantId_challengeId_customerId: { tenantId, challengeId, customerId },
        },
        update: {},
        create: { tenantId, challengeId, customerId },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.challenge.enroll",
        eventType: "gamification.challenge.enrolled.v1",
        entityType: "challenge_enrollment",
        entityId: enrollment.id,
        payload: { challengeId, customerId },
      });
      return enrollment;
    });
  }

  progress(challengeId: string, input: ChallengeProgress) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      await transaction.$queryRaw`
        SELECT true AS locked
        FROM pg_advisory_xact_lock(
          hashtextextended(${`${tenantId}:challenge:${challengeId}:${input.customerId}`}, 0)
        )
      `;
      const replay = await transaction.challengeProgressEvent.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey },
        },
        include: { enrollment: true },
      });
      if (replay) {
        return {
          event: replay,
          enrollment: replay.enrollment,
          rewards: [],
          idempotent: true,
        };
      }
      const challenge = await this.authorizedChallenge(transaction, challengeId);
      this.assertChallengeAvailable(challenge);
      let enrollment = await transaction.challengeEnrollment.findUnique({
        where: {
          tenantId_challengeId_customerId: {
            tenantId,
            challengeId,
            customerId: input.customerId,
          },
        },
      });
      if (!enrollment && challenge.autoEnroll) {
        enrollment = await transaction.challengeEnrollment.create({
          data: { tenantId, challengeId, customerId: input.customerId },
        });
      }
      if (!enrollment) throw new ConflictException("Customer is not enrolled in the challenge");
      if (
        enrollment.status === ChallengeEnrollmentStatus.COMPLETED ||
        enrollment.status === ChallengeEnrollmentStatus.CANCELED ||
        enrollment.status === ChallengeEnrollmentStatus.EXPIRED
      ) {
        throw new ConflictException("Challenge enrollment no longer accepts progress");
      }
      const nextProgress = Math.min(challenge.target, enrollment.progress + input.delta);
      const reachedTarget = nextProgress >= challenge.target;
      const nextStatus = reachedTarget
        ? challenge.validationMode === ChallengeValidation.AUTOMATIC
          ? ChallengeEnrollmentStatus.COMPLETED
          : ChallengeEnrollmentStatus.PENDING_VALIDATION
        : ChallengeEnrollmentStatus.ENROLLED;
      const event = await transaction.challengeProgressEvent.create({
        data: {
          tenantId,
          challengeId,
          enrollmentId: enrollment.id,
          customerId: input.customerId,
          source: input.source,
          delta: input.delta,
          resultingProgress: nextProgress,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata as Prisma.InputJsonValue,
          ...(input.referenceType ? { referenceType: input.referenceType } : {}),
          ...(input.referenceId ? { referenceId: input.referenceId } : {}),
        },
      });
      enrollment = await transaction.challengeEnrollment.update({
        where: { id: enrollment.id },
        data: {
          progress: nextProgress,
          status: nextStatus,
          ...(nextStatus === ChallengeEnrollmentStatus.COMPLETED
            ? { completedAt: new Date(), validatedAt: new Date() }
            : {}),
        },
      });
      if (challenge.type === ChallengeType.COMMUNITY) {
        await transaction.challenge.update({
          where: { id: challenge.id },
          data: { communityProgress: { increment: input.delta } },
        });
      }
      await appendDomainChange(transaction, tenantId, request, {
        action: "gamification.challenge.progress",
        eventType: reachedTarget
          ? "gamification.challenge.completed.v1"
          : "gamification.challenge.progress-updated.v1",
        entityType: "challenge_enrollment",
        entityId: enrollment.id,
        payload: {
          challengeId,
          customerId: input.customerId,
          progress: nextProgress,
          target: challenge.target,
          status: nextStatus,
        },
      });
      const rewards =
        nextStatus === ChallengeEnrollmentStatus.COMPLETED
          ? await transaction.challengeReward.findMany({ where: { challengeId } })
          : [];
      return { event, enrollment, rewards, idempotent: false };
    });
  }

  validate(enrollmentId: string, approved: boolean, reason: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const enrollment = await transaction.challengeEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { challenge: true },
      });
      if (!enrollment || !this.context.canAccessOrganization(enrollment.challenge.organizationId))
        return null;
      if (enrollment.status !== ChallengeEnrollmentStatus.PENDING_VALIDATION) {
        throw new ConflictException("Enrollment is not pending manual validation");
      }
      const updated = await transaction.challengeEnrollment.update({
        where: { id: enrollmentId },
        data: approved
          ? {
              status: ChallengeEnrollmentStatus.COMPLETED,
              completedAt: new Date(),
              validatedAt: new Date(),
              ...(request.actorId ? { validatedByUserId: request.actorId } : {}),
            }
          : {
              status: ChallengeEnrollmentStatus.ENROLLED,
              validatedAt: new Date(),
              ...(request.actorId ? { validatedByUserId: request.actorId } : {}),
            },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: approved
          ? "gamification.challenge.validate"
          : "gamification.challenge.reject-validation",
        eventType: approved
          ? "gamification.challenge.completed.v1"
          : "gamification.challenge.validation-rejected.v1",
        entityType: "challenge_enrollment",
        entityId: enrollmentId,
        payload: { reason, approved, challengeId: enrollment.challengeId },
      });
      return {
        enrollment: updated,
        rewards: approved
          ? await transaction.challengeReward.findMany({
              where: { challengeId: enrollment.challengeId },
            })
          : [],
      };
    });
  }

  setEnrollmentStatus(enrollmentId: string, status: "CANCELED" | "EXPIRED") {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const enrollment = await transaction.challengeEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { challenge: true },
      });
      if (!enrollment || !this.context.canAccessOrganization(enrollment.challenge.organizationId))
        return null;
      return transaction.challengeEnrollment.update({
        where: { id: enrollmentId },
        data: { status },
      });
    });
  }

  recordGrant(input: {
    challengeId: string;
    rewardId: string;
    enrollmentId: string;
    customerId: string;
    idempotencyKey: string;
    pointsEntryId?: string;
    xpEntryId?: string;
    customerBadgeId?: string;
  }) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await transaction.challengeRewardGrant.findUnique({
        where: {
          tenantId_challengeRewardId_enrollmentId: {
            tenantId,
            challengeRewardId: input.rewardId,
            enrollmentId: input.enrollmentId,
          },
        },
      });
      if (existing) return { grant: existing, idempotent: true };
      const grant = await transaction.challengeRewardGrant.create({
        data: {
          tenantId,
          challengeId: input.challengeId,
          challengeRewardId: input.rewardId,
          enrollmentId: input.enrollmentId,
          customerId: input.customerId,
          idempotencyKey: input.idempotencyKey,
          ...(input.pointsEntryId ? { pointsEntryId: input.pointsEntryId } : {}),
          ...(input.xpEntryId ? { xpEntryId: input.xpEntryId } : {}),
          ...(input.customerBadgeId ? { customerBadgeId: input.customerBadgeId } : {}),
        },
      });
      return { grant, idempotent: false };
    });
  }

  async expireDue(now: Date) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const expiredChallenges = await transaction.challenge.updateMany({
        where: {
          tenantId,
          endAt: { lte: now },
          status: { in: [ChallengeStatus.ACTIVE, ChallengeStatus.SUSPENDED] },
        },
        data: { status: ChallengeStatus.EXPIRED },
      });
      const expiredEnrollments = await transaction.challengeEnrollment.updateMany({
        where: {
          status: {
            in: [ChallengeEnrollmentStatus.ENROLLED, ChallengeEnrollmentStatus.PENDING_VALIDATION],
          },
          challenge: { endAt: { lte: now } },
        },
        data: { status: ChallengeEnrollmentStatus.EXPIRED },
      });
      return { challenges: expiredChallenges.count, enrollments: expiredEnrollments.count };
    });
  }

  private async authorizedChallenge(transaction: TenantTransaction, id: string) {
    const challenge = await transaction.challenge.findUnique({ where: { id } });
    if (!challenge || !this.context.canAccessOrganization(challenge.organizationId)) {
      throw new NotFoundException("Challenge not found or outside scope");
    }
    return challenge;
  }

  private assertChallengeAvailable(challenge: {
    status: ChallengeStatus;
    startAt: Date;
    endAt: Date;
  }) {
    const now = new Date();
    if (
      challenge.status !== ChallengeStatus.ACTIVE ||
      challenge.startAt > now ||
      challenge.endAt <= now
    ) {
      throw new ConflictException("Challenge is not currently active");
    }
  }

  private assertOrganization(organizationId: string) {
    if (!this.context.canAccessOrganization(organizationId)) {
      throw new BadRequestException("Organization is outside the authorized boundary");
    }
  }

  private async validateScopes(
    transaction: TenantTransaction,
    organizationId: string,
    scopes: readonly { scope: LeaderboardScope; targetId: string }[],
  ) {
    for (const scope of scopes) {
      const valid =
        scope.scope === LeaderboardScope.TENANT
          ? scope.targetId === this.context.tenantId()
          : scope.scope === LeaderboardScope.ORGANIZATION
            ? scope.targetId === organizationId
            : scope.scope === LeaderboardScope.FRANCHISE
              ? Boolean(
                  await transaction.franchise.findFirst({
                    where: { id: scope.targetId, organizationId },
                  }),
                )
              : scope.scope === LeaderboardScope.MERCHANT
                ? Boolean(
                    await transaction.merchant.findFirst({
                      where: { id: scope.targetId, organizationId },
                    }),
                  )
                : Boolean(
                    await transaction.branch.findFirst({
                      where: { id: scope.targetId, organizationId },
                    }),
                  );
      if (!valid) {
        throw new BadRequestException(
          `Challenge applicability ${scope.scope}:${scope.targetId} is outside organization`,
        );
      }
    }
  }

  private async validateRewards(
    transaction: TenantTransaction,
    organizationId: string,
    rewards: readonly ChallengeRewardInput[],
  ) {
    for (const reward of rewards) {
      if (reward.type === ChallengeRewardType.BADGE) {
        if (!reward.badgeId) throw new BadRequestException("Badge reward requires badgeId");
        const badge = await transaction.badge.findUnique({ where: { id: reward.badgeId } });
        if (!badge || badge.organizationId !== organizationId) {
          throw new BadRequestException("Challenge badge reward is outside organization");
        }
      }
      if (reward.type === ChallengeRewardType.POINTS) {
        if (!reward.loyaltyProgramId) {
          throw new BadRequestException("Points reward requires loyaltyProgramId");
        }
        const program = await transaction.loyaltyProgram.findUnique({
          where: { id: reward.loyaltyProgramId },
        });
        if (!program || program.organizationId !== organizationId || program.status !== "ACTIVE") {
          throw new BadRequestException("Challenge points program is not active or applicable");
        }
      }
    }
  }
}
