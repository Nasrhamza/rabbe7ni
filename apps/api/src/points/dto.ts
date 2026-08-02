import { PointsEntryType } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());
const baseOperation = z.object({
  customerId: z.uuid(),
  programId: z.uuid(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  referenceType: z.string().trim().max(80).optional(),
  referenceId: z.string().trim().max(200).optional(),
  metadata: jsonObject.default({}),
});
export const earnPointsSchema = baseOperation.extend({
  points: z.coerce.number().int().positive(),
});
export const consumePointsSchema = earnPointsSchema;
export const adjustPointsSchema = baseOperation.extend({
  points: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, "Points cannot be zero"),
  reason: z.string().trim().min(3).max(500),
});
export const reversePointsSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(200),
  reason: z.string().trim().min(3).max(500),
});
export const pointsEntryIdSchema = z.uuid();
export const balanceQuerySchema = z.object({
  customerId: z.uuid(),
  programId: z.uuid().optional(),
});
export const pointsListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  programId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  type: z.enum(PointsEntryType).optional(),
  sortBy: z.enum(["createdAt", "points", "type"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export type EarnPointsDto = z.output<typeof earnPointsSchema>;
export type AdjustPointsDto = z.output<typeof adjustPointsSchema>;
export type ReversePointsDto = z.output<typeof reversePointsSchema>;
export type BalanceQueryDto = z.input<typeof balanceQuerySchema>;
export type PointsListDto = z.input<typeof pointsListSchema>;
export type PointsList = z.output<typeof pointsListSchema>;
