import { z } from "zod";

const uuid = z.uuid();
const scalar = z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]);

export const canonicalEventSchema = z.object({
  eventId: uuid,
  eventType: z.string().trim().min(3).max(180),
  eventVersion: z.coerce.number().int().min(1).max(100).default(1),
  tenantId: uuid,
  organizationId: uuid.optional(),
  franchiseId: uuid.optional(),
  merchantId: uuid.optional(),
  branchId: uuid.optional(),
  customerId: uuid.optional(),
  occurredAt: z.iso.datetime({ offset: true }),
  processedAt: z.iso.datetime({ offset: true }).default(() => new Date().toISOString()),
  source: z.string().trim().min(2).max(100),
  sourceRecordId: z.string().trim().min(1).max(200),
  correlationId: z.string().trim().min(1).max(200),
  idempotencyKey: z.string().trim().min(1).max(300),
  value: z.number().finite().default(1),
  metadata: z.record(z.string().max(100), scalar).default({}),
  lineageDigest: z.string().regex(/^[a-f0-9]{64}$/u),
});

const rangeFields = {
  from: z.coerce.date(),
  to: z.coerce.date(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  organizationId: uuid.optional(),
  franchiseId: uuid.optional(),
  merchantId: uuid.optional(),
  branchId: uuid.optional(),
  customerId: uuid.optional(),
};

export const rangeSchema = z
  .object(rangeFields)
  .refine(({ from, to }) => from < to, "from must precede to");

export const backfillSchema = z
  .object({
    ...rangeFields,
    pageSize: z.coerce.number().int().min(1).max(5_000).default(1_000),
  })
  .refine(({ from, to }) => from < to, "from must precede to");

export type CanonicalEventInput = z.output<typeof canonicalEventSchema>;
export type AnalyticsRange = z.output<typeof rangeSchema>;
