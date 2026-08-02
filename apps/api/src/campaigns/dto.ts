import { CampaignStatus, CampaignType } from "@rabbehni/database";
import { z } from "zod";

import { paginationSchema } from "../common/pagination.js";

const jsonObject = z.record(z.string(), z.unknown());

const campaignScopeSchema = z
  .object({
    organizationId: z.uuid().optional(),
    franchiseId: z.uuid().optional(),
    merchantId: z.uuid().optional(),
    branchId: z.uuid().optional(),
  })
  .refine(
    (scope) => Object.values(scope).filter(Boolean).length === 1,
    "Exactly one scope is required",
  );

const campaignSchema = z.object({
  organizationId: z.uuid(),
  code: z.string().trim().min(2).max(80),
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional(),
  type: z.enum(CampaignType),
  timezone: z.string().trim().min(1).max(100).default("UTC"),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  frequencyCap: z.coerce.number().int().min(1).max(100).default(1),
  frequencyWindowHours: z.coerce.number().int().min(1).max(8_760).default(24),
  requiresApproval: z.boolean().default(false),
  segmentIds: z.array(z.uuid()).min(1).max(100),
  applicability: z.array(campaignScopeSchema).max(200).default([]),
  settings: jsonObject.default({}),
});

export const createCampaignSchema = campaignSchema.refine(
  ({ startsAt, endsAt }) => !startsAt || !endsAt || endsAt > startsAt,
  "Campaign end date must be after its start date",
);

export const updateCampaignSchema = campaignSchema
  .omit({ segmentIds: true, applicability: true })
  .partial()
  .extend({
    segmentIds: z.array(z.uuid()).min(1).max(100).optional(),
    applicability: z.array(campaignScopeSchema).max(200).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required");

export const campaignListSchema = paginationSchema.extend({
  status: z.enum(CampaignStatus).optional(),
  type: z.enum(CampaignType).optional(),
  sortBy: z.enum(["createdAt", "name", "startsAt", "status"]).default("createdAt"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
});

export const campaignScheduleSchema = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional(),
  timezone: z.string().trim().min(1).max(100),
});

export const campaignMetricSchema = z.object({
  type: z.enum(["OPENED", "CLICKED", "CONVERTED", "UNSUBSCRIBED"]),
  customerId: z.uuid().optional(),
  eventId: z.string().trim().min(8).max(200),
  metadata: jsonObject.default({}),
});

export const campaignIdSchema = z.uuid();

export type CampaignList = z.output<typeof campaignListSchema>;
export type CampaignCreate = z.output<typeof createCampaignSchema>;
export type CampaignUpdate = z.output<typeof updateCampaignSchema>;
