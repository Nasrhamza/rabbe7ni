import {
  NotificationCategory,
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationTemplateStatus,
} from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

export const createTemplateSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  channel: z.enum(NotificationChannel),
  category: z.enum(NotificationCategory),
  status: z.enum(NotificationTemplateStatus).default(NotificationTemplateStatus.DRAFT),
  branding: jsonObject.default({}),
  locale: z.string().trim().min(2).max(20),
  subject: z.string().trim().max(300).optional(),
  body: z.string().min(1).max(100_000),
  metadata: jsonObject.default({}),
});

export const createTemplateVersionSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  subject: z.string().trim().max(300).optional(),
  body: z.string().min(1).max(100_000),
  metadata: jsonObject.default({}),
});

export const templateListSchema = paginationSchema.extend({
  channel: z.enum(NotificationChannel).optional(),
  category: z.enum(NotificationCategory).optional(),
  status: z.enum(NotificationTemplateStatus).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const renderTemplateSchema = z.object({
  locale: z.string().trim().min(2).max(20),
  variables: jsonObject.default({}),
});

export const queueNotificationSchema = z.object({
  customerId: z.uuid(),
  templateId: z.uuid(),
  campaignId: z.uuid().optional(),
  automationExecutionId: z.uuid().optional(),
  locale: z.string().trim().min(2).max(20).optional(),
  variables: jsonObject.default({}),
  deepLink: jsonObject.optional(),
  idempotencyKey: z.string().trim().min(8).max(200),
  scheduledAt: z.coerce.date().optional(),
});

export const deliveryListSchema = paginationSchema.extend({
  customerId: z.uuid().optional(),
  campaignId: z.uuid().optional(),
  channel: z.enum(NotificationChannel).optional(),
  status: z.enum(NotificationDeliveryStatus).optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const inboxListSchema = paginationSchema.extend({
  unreadOnly: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const preferenceSchema = z.object({
  customerId: z.uuid(),
  channel: z.enum(NotificationChannel),
  category: z.enum(NotificationCategory),
  optedIn: z.boolean(),
  quietHoursStart: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  quietHoursEnd: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  consentSource: z.string().trim().max(100).optional(),
});

export const notificationIdSchema = z.uuid();

export type QueueNotification = z.output<typeof queueNotificationSchema>;
export type DeliveryList = z.output<typeof deliveryListSchema>;
