import { AutomationStatus, AutomationStepType, AutomationType } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

const stepSchema = z.object({
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  position: z.coerce.number().int().min(0).max(1_000),
  type: z.enum(AutomationStepType),
  configuration: jsonObject.default({}),
  delaySeconds: z.coerce.number().int().min(0).max(31_536_000).default(0),
  nextOnTrue: z.uuid().optional(),
  nextOnFalse: z.uuid().optional(),
});

const automationSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(AutomationType),
  status: z.enum(AutomationStatus).default(AutomationStatus.DRAFT),
  triggerType: z.string().trim().min(2).max(120),
  triggerConfig: jsonObject.default({}),
  schedule: z.string().trim().min(5).max(100).optional(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  exitConditions: jsonObject.default({}),
  maxExecutionsPerCustomer: z.coerce.number().int().min(1).max(10_000).default(1),
  steps: z.array(stepSchema).min(1).max(100),
});

export const createAutomationSchema = automationSchema.superRefine((value, context) => {
  if (value.type === AutomationType.SCHEDULED && !value.schedule) {
    context.addIssue({
      code: "custom",
      path: ["schedule"],
      message: "Scheduled automation requires a cron pattern",
    });
  }
});

export const updateAutomationSchema = automationSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const automationListSchema = paginationSchema.extend({
  status: z.enum(AutomationStatus).optional(),
  type: z.enum(AutomationType).optional(),
  triggerType: z.string().trim().max(120).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const consumeMarketingEventSchema = z.object({
  eventId: z.string().trim().min(8).max(200),
  eventType: z.string().trim().min(2).max(120),
  customerId: z.uuid(),
  organizationId: z.uuid(),
  occurredAt: z.coerce.date().default(() => new Date()),
  payload: jsonObject.default({}),
});

export const automationIdSchema = z.uuid();

export type AutomationCreate = z.output<typeof createAutomationSchema>;
export type AutomationUpdate = z.output<typeof updateAutomationSchema>;
export type MarketingDomainEvent = z.output<typeof consumeMarketingEventSchema>;
