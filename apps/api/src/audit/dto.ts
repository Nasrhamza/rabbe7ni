import { z } from "zod";

export const recordAuditSchema = z.object({
  action: z.string().trim().min(1).max(150),
  entityType: z.string().trim().min(1).max(100),
  entityId: z.string().trim().max(255).optional(),
  ipAddress: z.string().trim().max(45).optional(),
  userAgent: z.string().trim().max(1000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type RecordAuditDto = z.input<typeof recordAuditSchema>;
