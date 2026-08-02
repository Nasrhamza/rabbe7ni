import { AiCapability } from "@rabbehni/database";
import { z } from "zod";

const rangeFields = {
  from: z.coerce.date(),
  to: z.coerce.date(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  organizationId: z.uuid().optional(),
  franchiseId: z.uuid().optional(),
  merchantId: z.uuid().optional(),
  branchId: z.uuid().optional(),
  customerId: z.uuid().optional(),
};

export const analyticsRangeSchema = z
  .object(rangeFields)
  .refine(({ from, to }) => from < to, "from must precede to");

export const insightSchema = z
  .object({
    ...rangeFields,
    capability: z.enum(AiCapability),
    idempotencyKey: z.string().trim().min(8).max(200),
    context: z
      .record(z.string().max(80), z.union([z.string().max(300), z.number(), z.boolean()]))
      .default({}),
  })
  .refine(({ from, to }) => from < to, "from must precede to");

export type AnalyticsRangeDto = z.output<typeof analyticsRangeSchema>;
