import { ReportFrequency } from "@rabbehni/database";
import { z } from "zod";

const jsonObject = z.record(z.string().max(80), z.union([z.string(), z.number(), z.boolean()]));

export const createReportSchema = z.object({
  organizationId: z.uuid(),
  recipientCustomerId: z.uuid().optional(),
  notificationTemplateId: z.uuid().optional(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  frequency: z.enum(ReportFrequency),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  filters: jsonObject.default({}),
  metrics: z.array(z.string().trim().min(2).max(120)).min(1).max(100),
  active: z.boolean().default(true),
  retentionDays: z.coerce.number().int().min(1).max(365).default(30),
});

export const reportIdSchema = z.uuid();
