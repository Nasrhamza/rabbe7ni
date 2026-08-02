import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { PointsEntryType, QrPurpose, QrTransactionStatus } from "@rabbehni/database";
import { randomInt } from "node:crypto";

import { parseDto } from "../common/validation.js";
import { PointsService } from "../points/points.service.js";
import { RewardsService } from "../rewards/rewards.service.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import { qrIssueSchema, qrListSchema, qrScanSchema } from "./dto.js";
import { QrRepository } from "./qr.repository.js";
import { QrTokenService } from "./qr-token.service.js";

@Injectable()
export class QrService {
  constructor(
    @Inject(QrRepository) private readonly qr: QrRepository,
    @Inject(QrTokenService) private readonly tokens: QrTokenService,
    @Inject(PointsService) private readonly points: PointsService,
    @Inject(RewardsService) private readonly rewards: RewardsService,
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
  ) {}

  async issue(input: never) {
    const dto = parseDto(qrIssueSchema, input);
    const customer = await this.qr.findCustomer(dto.customerId);
    if (!customer || customer.status !== "ACTIVE") {
      throw new NotFoundException("Active customer profile not found");
    }
    const principal = this.context.authenticatedPrincipal();
    if (
      customer.userId !== principal.userId &&
      !principal.permissions.includes("customer.manage")
    ) {
      throw new ForbiddenException("Cannot issue a QR identity for another customer");
    }
    const issued = this.tokens.issue({
      tenantId: principal.tenantId,
      customerId: customer.id,
      purpose: dto.purpose,
      exp: Math.floor(Date.now() / 1_000) + dto.ttlSeconds,
      context: dto.context,
    });
    const record = await this.qr.createToken(customer.id, issued.payload, issued.hash);
    return {
      token: issued.token,
      purpose: issued.payload.purpose,
      expiresAt: record.expiresAt,
      customerId: customer.id,
    };
  }

  async scan(input: never) {
    const dto = parseDto(qrScanSchema, input);
    const replay = await this.qr.findReplay(dto.idempotencyKey);
    if (replay) return { transaction: replay, idempotent: true };
    let payload;
    try {
      payload = this.tokens.verify(dto.token);
      if (payload.tenantId !== this.context.tenantId()) {
        throw new UnauthorizedException("Cross-tenant QR token rejected");
      }
      if (
        payload.purpose !== QrPurpose.IDENTITY &&
        payload.purpose !==
          (dto.action === "EARN"
            ? QrPurpose.EARN
            : dto.action === "REDEEM"
              ? QrPurpose.REDEEM
              : QrPurpose.IDENTITY)
      ) {
        throw new UnauthorizedException("QR purpose does not authorize this operation");
      }
    } catch (error) {
      await this.qr.record({
        purpose: QrPurpose.IDENTITY,
        idempotencyKey: dto.idempotencyKey,
        status: QrTransactionStatus.REJECTED,
        merchantId: dto.merchantId,
        branchId: dto.branchId,
        failureReason: error instanceof Error ? error.message : "Invalid QR token",
      });
      throw error;
    }
    let claimed;
    try {
      claimed = await this.qr.claim(
        payload,
        this.tokens.hash(dto.token),
        dto.idempotencyKey,
        dto.merchantId,
        dto.branchId,
      );
    } catch (error) {
      await this.qr.record({
        payload,
        purpose: payload.purpose,
        idempotencyKey: dto.idempotencyKey,
        status: QrTransactionStatus.REJECTED,
        merchantId: dto.merchantId,
        branchId: dto.branchId,
        failureReason: error instanceof Error ? error.message : "QR claim rejected",
      });
      throw error;
    }
    try {
      let operation: Record<string, unknown>;
      let outcome:
        | { kind: "POINTS"; label: string; points: number }
        | { kind: "REWARD"; label: string; rewardId: string };

      if (dto.action === "INSTANT") {
        const now = Date.now();
        const catalog = await this.rewards.list({
          programId: dto.programId,
          merchantId: dto.merchantId,
          branchId: dto.branchId,
          status: "ACTIVE",
          pageSize: 100,
        } as never);
        const availableRewards = catalog.items.filter(
          (reward) =>
            (!reward.startsAt || reward.startsAt.getTime() <= now) &&
            (!reward.endsAt || reward.endsAt.getTime() >= now) &&
            (reward.unlimitedStock || (reward.stockQuantity ?? 0) > 0),
        );
        const selectedReward =
          availableRewards.length > 0 && randomInt(100) < 45
            ? availableRewards[randomInt(availableRewards.length)]
            : undefined;
        if (selectedReward) {
          operation = await this.rewards.grantInstant({
            customerId: payload.customerId,
            rewardId: selectedReward.id,
            merchantId: dto.merchantId,
            branchId: dto.branchId,
            quantity: 1,
            idempotencyKey: `qr:${dto.idempotencyKey}`,
            metadata: {
              ...dto.metadata,
              qrTokenId: claimed.token.id,
              source: "qr-instant-reward",
            },
          } as never);
          outcome = { kind: "REWARD", label: selectedReward.name, rewardId: selectedReward.id };
        } else {
          const points = [25, 50, 75, 100][randomInt(4)]!;
          operation = await this.points.postOperation({
            customerId: payload.customerId,
            programId: dto.programId as string,
            merchantId: dto.merchantId,
            branchId: dto.branchId,
            type: PointsEntryType.EARN,
            points,
            idempotencyKey: `qr:${dto.idempotencyKey}`,
            referenceType: "qr_instant_reward",
            referenceId: claimed.token.id,
            metadata: {
              ...dto.metadata,
              qrTokenId: claimed.token.id,
              source: "qr-instant-reward",
            },
          });
          outcome = { kind: "POINTS", label: `+${points} points`, points };
        }
      } else if (dto.action === "EARN") {
        operation = await this.points.postOperation({
          customerId: payload.customerId,
          programId: dto.programId as string,
          merchantId: dto.merchantId,
          branchId: dto.branchId,
          type: PointsEntryType.EARN,
          points: dto.points as number,
          idempotencyKey: `qr:${dto.idempotencyKey}`,
          referenceType: dto.referenceType ?? "qr",
          referenceId: dto.referenceId ?? claimed.token.id,
          metadata: { ...dto.metadata, qrTokenId: claimed.token.id },
        });
        outcome = {
          kind: "POINTS",
          label: `+${dto.points as number} points`,
          points: dto.points as number,
        };
      } else {
        const reward = await this.rewards.get(dto.rewardId as string);
        operation = await this.rewards.redeem({
          customerId: payload.customerId,
          rewardId: dto.rewardId as string,
          merchantId: dto.merchantId,
          branchId: dto.branchId,
          quantity: dto.quantity,
          idempotencyKey: `qr:${dto.idempotencyKey}`,
          metadata: { ...dto.metadata, qrTokenId: claimed.token.id },
        } as never);
        outcome = { kind: "REWARD", label: reward.name, rewardId: reward.id };
      }
      const resultReference =
        "entry" in operation
          ? (operation as { entry: { id: string } }).entry.id
          : (operation as { redemption: { id: string } }).redemption.id;
      const transactionPurpose = outcome.kind === "POINTS" ? QrPurpose.EARN : QrPurpose.REDEEM;
      const transaction = await this.qr.record({
        payload,
        qrTokenId: claimed.token.id,
        purpose: transactionPurpose,
        idempotencyKey: dto.idempotencyKey,
        status: QrTransactionStatus.SUCCEEDED,
        merchantId: dto.merchantId,
        branchId: dto.branchId,
        resultReference,
        metadata: { ...dto.metadata, instant: dto.action === "INSTANT", outcome },
      });
      return { transaction, operation, outcome, idempotent: false };
    } catch (error) {
      await this.qr.record({
        payload,
        qrTokenId: claimed.token.id,
        purpose: dto.action === "REDEEM" ? QrPurpose.REDEEM : QrPurpose.EARN,
        idempotencyKey: dto.idempotencyKey,
        status: QrTransactionStatus.REJECTED,
        merchantId: dto.merchantId,
        branchId: dto.branchId,
        failureReason: error instanceof Error ? error.message : "QR operation failed",
        metadata: dto.metadata,
      });
      throw error;
    }
  }

  list(input: never = {} as never) {
    return this.qr.list(parseDto(qrListSchema, input));
  }
}
