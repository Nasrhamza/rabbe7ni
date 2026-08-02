import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

export const visitListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  status: z.enum(["VALIDATED", "REVERSED"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  sortBy: z.enum(["visitedAt", "status"]).default("visitedAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const manualVisitSchema = z.object({
  customerId: z.uuid(),
  merchantId: z.uuid(),
  branchId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const reverseVisitSchema = z.object({
  reason: z.string().trim().min(3).max(300),
});

export type VisitList = z.output<typeof visitListSchema>;
export type ManualVisitDto = z.output<typeof manualVisitSchema>;
export type ReverseVisitDto = z.output<typeof reverseVisitSchema>;
