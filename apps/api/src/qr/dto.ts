import { QrPurpose, QrTransactionStatus } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
export const qrIssueSchema = z.object({
  customerId: z.uuid().optional(),
  purpose: z.enum(QrPurpose).default(QrPurpose.IDENTITY),
  ttlSeconds: z.coerce.number().int().min(15).max(300).default(60),
  context: jsonObject.default({}),
});
export const qrScanSchema = z
  .object({
    token: z.string().trim().min(40).max(4_096),
    action: z.enum(["EARN", "REDEEM", "INSTANT"]),
    idempotencyKey: z.string().trim().min(8).max(200),
    merchantId: z.uuid().optional(),
    branchId: z.uuid().optional(),
    programId: z.uuid().optional(),
    points: z.coerce.number().int().positive().optional(),
    rewardId: z.uuid().optional(),
    quantity: z.coerce.number().int().positive().default(1),
    referenceType: z.string().trim().max(80).optional(),
    referenceId: z.string().trim().max(200).optional(),
    metadata: jsonObject.default({}),
  })
  .superRefine((value, context) => {
    if (value.action === "EARN" && (!value.programId || !value.points)) {
      context.addIssue({
        code: "custom",
        message: "programId and points are required for QR earning",
      });
    }
    if (value.action === "REDEEM" && !value.rewardId) {
      context.addIssue({ code: "custom", message: "rewardId is required for QR redemption" });
    }
    if (value.action === "INSTANT" && !value.programId) {
      context.addIssue({
        code: "custom",
        message: "programId is required for an instant QR reward",
      });
    }
  });
export const qrListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  purpose: z.enum(QrPurpose).optional(),
  status: z.enum(QrTransactionStatus).optional(),
  sortBy: z.enum(["occurredAt", "status", "purpose"]).default("occurredAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});
export const qrPayloadSchema = z.object({
  v: z.literal(1),
  tenantId: z.uuid(),
  customerId: z.uuid(),
  purpose: z.enum(QrPurpose),
  nonce: z.string().min(16),
  exp: z.number().int().positive(),
  context: jsonObject,
});

export type QrIssueDto = z.output<typeof qrIssueSchema>;
export type QrScanDto = z.output<typeof qrScanSchema>;
export type QrList = z.output<typeof qrListSchema>;
export type QrPayload = z.output<typeof qrPayloadSchema>;
