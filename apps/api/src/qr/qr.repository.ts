import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import {
  QrTokenStatus,
  QrTransactionStatus,
  type Prisma,
  type QrPurpose,
} from "@rabbehni/database";
import { TenantTransactionService } from "@rabbehni/database/nest";

import { appendDomainChange } from "../common/events/append-domain-change.js";
import { pageResult, pageWindow } from "../common/pagination.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import type { QrList, QrPayload } from "./dto.js";

@Injectable()
export class QrRepository {
  constructor(
    @Inject(TenantContextStore) private readonly context: TenantContextStore,
    @Inject(TenantTransactionService) private readonly transactions: TenantTransactionService,
  ) {}

  findCustomer(customerId?: string) {
    const tenantId = this.context.tenantId();
    const principal = this.context.authenticatedPrincipal();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.customer.findFirst({
        where: customerId ? { id: customerId } : { userId: principal.userId },
      }),
    );
  }

  createToken(customerId: string, payload: QrPayload, tokenHash: string) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const token = await transaction.customerQrToken.create({
        data: {
          tenantId,
          customerId,
          purpose: payload.purpose,
          nonce: payload.nonce,
          tokenHash,
          context: payload.context as Prisma.InputJsonValue,
          expiresAt: new Date(payload.exp * 1_000),
        },
      });
      await appendDomainChange(transaction, tenantId, request, {
        action: "qr.issue",
        eventType: "qr.token.issued.v1",
        entityType: "customer_qr_token",
        entityId: token.id,
        payload: { customerId, purpose: payload.purpose, expiresAt: token.expiresAt.toISOString() },
      });
      return token;
    });
  }

  findReplay(idempotencyKey: string) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, (transaction) =>
      transaction.qrTransaction.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      }),
    );
  }

  claim(
    payload: QrPayload,
    tokenHash: string,
    idempotencyKey: string,
    merchantId?: string,
    branchId?: string,
  ) {
    const tenantId = this.context.tenantId();
    return this.transactions.run(tenantId, async (transaction) => {
      const token = await transaction.customerQrToken.findFirst({
        where: {
          customerId: payload.customerId,
          nonce: payload.nonce,
          tokenHash,
        },
      });
      if (!token) throw new UnauthorizedException("QR token is unknown in this tenant");
      if (token.expiresAt <= new Date()) {
        await transaction.customerQrToken.update({
          where: { id: token.id },
          data: { status: QrTokenStatus.EXPIRED },
        });
        throw new UnauthorizedException("QR token has expired");
      }
      const updated = await transaction.customerQrToken.updateMany({
        where: { id: token.id, status: QrTokenStatus.ACTIVE, consumedAt: null },
        data: { status: QrTokenStatus.CONSUMED, consumedAt: new Date() },
      });
      if (updated.count !== 1) throw new ConflictException("QR token was already consumed");
      if (branchId) {
        const branch = await transaction.branch.findUnique({ where: { id: branchId } });
        if (
          !branch ||
          (merchantId && branch.merchantId !== merchantId) ||
          !this.context.canAccessOrganization(branch.organizationId)
        ) {
          throw new UnauthorizedException("QR scan branch is outside the authorized scope");
        }
      }
      return { token, idempotencyKey };
    });
  }

  record(input: {
    payload?: QrPayload | undefined;
    qrTokenId?: string | undefined;
    purpose: QrPurpose;
    idempotencyKey: string;
    status: QrTransactionStatus;
    merchantId?: string | undefined;
    branchId?: string | undefined;
    resultReference?: string | undefined;
    failureReason?: string | undefined;
    metadata?: Readonly<Record<string, unknown>> | undefined;
  }) {
    const tenantId = this.context.tenantId();
    const request = this.context.current();
    return this.transactions.run(tenantId, async (transaction) => {
      const existing = await transaction.qrTransaction.findUnique({
        where: {
          tenantId_idempotencyKey: { tenantId, idempotencyKey: input.idempotencyKey },
        },
      });
      if (existing) return existing;
      const result = await transaction.qrTransaction.create({
        data: {
          tenantId,
          purpose: input.purpose,
          status: input.status,
          idempotencyKey: input.idempotencyKey,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          ...(input.qrTokenId ? { qrTokenId: input.qrTokenId } : {}),
          ...(input.payload ? { customerId: input.payload.customerId } : {}),
          ...(input.merchantId ? { merchantId: input.merchantId } : {}),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.resultReference ? { resultReference: input.resultReference } : {}),
          ...(input.failureReason ? { failureReason: input.failureReason } : {}),
        },
      });
      if (
        input.status === QrTransactionStatus.SUCCEEDED &&
        input.payload?.customerId &&
        input.merchantId &&
        input.branchId
      ) {
        const [customer, merchant, branch] = await Promise.all([
          transaction.customer.findUnique({ where: { id: input.payload.customerId } }),
          transaction.merchant.findUnique({ where: { id: input.merchantId } }),
          transaction.branch.findUnique({ where: { id: input.branchId } }),
        ]);
        if (
          customer &&
          merchant &&
          branch &&
          customer.organizationId === merchant.organizationId &&
          branch.organizationId === merchant.organizationId &&
          branch.merchantId === merchant.id
        ) {
          const visit = await transaction.customerVisit.create({
            data: {
              tenantId,
              organizationId: customer.organizationId,
              customerId: customer.id,
              merchantId: merchant.id,
              branchId: branch.id,
              qrTransactionId: result.id,
              source: "QR",
              metadata: {
                qrPurpose: input.purpose,
                resultReference: input.resultReference,
              } as Prisma.InputJsonValue,
            },
          });
          await transaction.customerActivity.create({
            data: {
              tenantId,
              customerId: customer.id,
              type: "visit",
              referenceId: visit.id,
              metadata: { merchantId: merchant.id, branchId: branch.id, source: "QR" },
            },
          });
        }
      }
      await appendDomainChange(transaction, tenantId, request, {
        action:
          input.status === QrTransactionStatus.SUCCEEDED ? "qr.scan.succeeded" : "qr.scan.rejected",
        eventType:
          input.status === QrTransactionStatus.SUCCEEDED
            ? "qr.transaction.succeeded.v1"
            : "qr.transaction.rejected.v1",
        entityType: "qr_transaction",
        entityId: result.id,
        payload: {
          purpose: input.purpose,
          customerId: input.payload?.customerId,
          failureReason: input.failureReason,
        },
      });
      return result;
    });
  }

  list(input: QrList) {
    const tenantId = this.context.tenantId();
    const access = this.context.authenticatedPrincipal().access;
    const where: Prisma.QrTransactionWhereInput = {
      tenantId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
      ...(input.purpose ? { purpose: input.purpose } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(!access.tenantWide && access.merchantIds.length
        ? { merchantId: { in: [...access.merchantIds] } }
        : {}),
    };
    return this.transactions.run(tenantId, async (transaction) => {
      const [items, total] = await Promise.all([
        transaction.qrTransaction.findMany({
          where,
          ...pageWindow(input),
          orderBy: { [input.sortBy]: input.sortDirection },
          include: { customer: { select: { id: true, displayName: true } } },
        }),
        transaction.qrTransaction.count({ where }),
      ]);
      return pageResult(items, total, input);
    });
  }
}
