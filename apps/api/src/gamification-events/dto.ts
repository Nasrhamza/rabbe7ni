import { z } from "zod";

export const consumeGamificationEventSchema = z.object({
  eventId: z.string().trim().min(8).max(200),
  eventType: z.string().trim().min(2).max(160),
  customerId: z.uuid(),
  occurredAt: z.coerce.date().default(() => new Date()),
  delta: z.coerce.number().int().positive().default(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export type ConsumeGamificationEvent = z.output<typeof consumeGamificationEventSchema>;
